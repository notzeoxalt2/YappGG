const fs=require('fs'),path=require('path'),crypto=require('crypto'),zlib=require('zlib'),{promisify}=require('util');
const inflate=promisify(zlib.inflateRaw);
const supported=new Set(['.mp3','.mp4','.wav','.m4a','.aac','.flac','.wma','.ogg','.opus','.webm','.aif','.aiff','.mkv','.mov','.avi']);
const videoExtensions=new Set(['.mp4','.webm','.mov','.mkv','.avi']);
const validShortcut=value=>!value||/^(?:(?:Control|Alt|Shift|Super)\+)+(?:[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4]))$/.test(value);
async function fileRange(file,offset,length){const handle=await fs.promises.open(file,'r');try{const buffer=Buffer.alloc(length);let at=0;while(at<length){const read=await handle.read(buffer,at,length-at,offset+at);if(!read.bytesRead)throw Error('The ZIP archive is incomplete.');at+=read.bytesRead;}return buffer;}finally{await handle.close();}}
async function zipEntries(file){
 const fileSize=(await fs.promises.stat(file)).size;if(fileSize>512*1048576)throw Error('ZIP files can be up to 512 MB.');
 const tailOffset=Math.max(0,fileSize-65557),zip=await fileRange(file,tailOffset,fileSize-tailOffset);
 let end=-1;for(let i=zip.length-22;i>=Math.max(0,zip.length-65557);i--)if(zip.readUInt32LE(i)===0x06054b50&&i+22+zip.readUInt16LE(i+20)===zip.length){end=i;break;}
 if(end<0)throw Error('This ZIP archive is incomplete.');
 const count=zip.readUInt16LE(end+10),start=zip.readUInt32LE(end+16);if(count===65535||count>5000||zip.readUInt16LE(end+4)||zip.readUInt16LE(end+6))throw Error('Split or ZIP64 archives are not supported.');
 const directorySize=zip.readUInt32LE(end+12);if(directorySize>16*1048576||start+directorySize>tailOffset+end)throw Error('Invalid ZIP directory size.');const directory=await fileRange(file,start,directorySize);let at=0,total=0;const entries=[];
 for(let i=0;i<count;i++){
  if(at+46>directory.length||directory.readUInt32LE(at)!==0x02014b50)throw Error('Invalid ZIP directory.');
  const flags=directory.readUInt16LE(at+8),method=directory.readUInt16LE(at+10),crc=directory.readUInt32LE(at+16),compressed=directory.readUInt32LE(at+20),size=directory.readUInt32LE(at+24),length=directory.readUInt16LE(at+28),extra=directory.readUInt16LE(at+30),comment=directory.readUInt16LE(at+32),offset=directory.readUInt32LE(at+42);
  if(at+46+length+extra+comment>directory.length)throw Error('Invalid ZIP filename.');
  const name=directory.subarray(at+46,at+46+length).toString('utf8').replace(/\\/g,'/');at+=46+length+extra+comment;
  if(name.startsWith('/')||/^[a-z]:/i.test(name)||name.split('/').includes('..')||name.includes('\0'))throw Error('The ZIP contains an unsafe file path.');
  if(name.endsWith('/')||!supported.has(path.extname(name).toLowerCase()))continue;
  if(flags&1)throw Error('Password-protected ZIP files are not supported.');if(![0,8].includes(method))throw Error('Use a standard ZIP with Deflate compression.');
  total+=size;if(compressed>256*1048576||size>256*1048576||total>2*1024**3||entries.length>=1000)throw Error('This sound pack is too large (1,000 sounds, 256 MB per source, 2 GB total).');
  if(offset+30>start)throw Error('Invalid ZIP file entry.');
  entries.push({name,read:async()=>{const header=await fileRange(file,offset,30);if(header.readUInt32LE(0)!==0x04034b50)throw Error('Invalid ZIP file entry.');const begin=offset+30+header.readUInt16LE(26)+header.readUInt16LE(28);if(begin+compressed>start)throw Error('Invalid ZIP data range.');const raw=await fileRange(file,begin,compressed),data=method===0?raw:await inflate(raw,{maxOutputLength:size||1});if(data.length!==size||zlib.crc32(data)!==crc)throw Error('ZIP file checksum failed.');return data;}});
 }
 return entries;
}
function folderPath(value){const segments=String(value||'').replace(/\\/g,'/').split('/').map(s=>s.trim());if(!segments.length||segments.some(s=>!s||s==='.'||s==='..'||s.length>80||/[\x00-\x1f]/.test(s))||segments.length>8||segments.join('/').length>300||segments[0].toLowerCase()==='all')throw Error('Use up to eight folder levels with names of 1–80 characters. All is reserved.');return segments.join('/');}
const ancestors=value=>value.split('/').map((_,i)=>value.split('/').slice(0,i+1).join('/'));
async function mediaEntries(directory,relative=path.basename(directory),depth=0){if(depth>=8)throw Error('Keep folders within eight levels.');const entries=[];for(const item of await fs.promises.readdir(directory,{withFileTypes:true})){if(item.isSymbolicLink()||item.name.startsWith('.'))continue;const file=path.join(directory,item.name),name=relative+'/'+item.name;if(item.isDirectory())entries.push(...await mediaEntries(file,name,depth+1));else if(item.isFile()&&supported.has(path.extname(item.name).toLowerCase()))entries.push({name,file});if(entries.length>1000)throw Error('Import up to 1,000 media files at once.');}return entries;}
class SoundboardLibrary{
 constructor(directory,decode){this.directory=directory;this.decode=decode;fs.mkdirSync(directory,{recursive:true});this.index=path.join(directory,'library.json');this.items=fs.existsSync(this.index)?JSON.parse(fs.readFileSync(this.index,'utf8')).sounds:[];this.groups=fs.existsSync(this.index)?(JSON.parse(fs.readFileSync(this.index,'utf8')).folders||['Sounds','Music & videos']):['Sounds','Music & videos'];this.importing=false;}
 list(){return this.items.map(({id,name,shortcut,volume,durationSeconds,folder='Sounds',videoExt})=>({id,name,shortcut,volume,durationSeconds,folder,video:!!videoExt,missing:!fs.existsSync(path.join(this.directory,id+'.wav'))}));}
 folders(){return [...new Set([...this.groups,...this.items.map(s=>s.folder||'Sounds')].flatMap(ancestors))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));}
 addFolder(name){name=folderPath(name);const folders=new Set([...this.folders(),...ancestors(name)]);if(folders.size>250)throw Error('You can create up to 250 folders and subfolders.');if(!this.groups.includes(name)){this.groups=[...folders];this.persist();}return this.folders();}
 moveFolder(from,to){from=folderPath(from);to=folderPath(to);if(!this.folders().includes(from))throw Error('Folder not found.');if(from===to)return this.folders();if(to.startsWith(from+'/'))throw Error('A folder cannot be moved inside itself.');if(this.folders().includes(to))throw Error('A folder already exists at that location.');const replace=value=>value===from||value.startsWith(from+'/')?to+value.slice(from.length):value;const groups=[...new Set(this.folders().map(replace).flatMap(ancestors))];if(groups.length>250)throw Error('You can create up to 250 folders.');this.groups=groups;for(const item of this.items)item.folder=replace(item.folder||'Sounds');this.persist();return this.folders();}
 videoFile(id){const item=this.item(id);this.file(id);if(!videoExtensions.has(item.videoExt))throw Error('This sound has no video.');return path.join(this.directory,id+item.videoExt);}
 persist(){if(fs.existsSync(this.index)&&!fs.existsSync(this.index+'.pre-subfolders.json')&&(JSON.parse(fs.readFileSync(this.index,'utf8')).schemaVersion||1)<3)fs.copyFileSync(this.index,this.index+'.pre-subfolders.json');if(fs.existsSync(this.index))fs.copyFileSync(this.index,this.index+'.backup.json');fs.writeFileSync(this.index+'.tmp',JSON.stringify({schemaVersion:3,sounds:this.items,folders:this.groups},null,2));fs.renameSync(this.index+'.tmp',this.index);}
 item(id){const item=this.items.find(s=>s.id===id);if(!item)throw Error('Sound not found.');return item;}
 file(id){this.item(id);if(!/^[a-f0-9-]{36}$/.test(id))throw Error('Invalid sound identifier.');return path.join(this.directory,id+'.wav');}
 async import(files,folder=""){
  if(folder)folder=folderPath(folder);
  if(this.importing)throw Error('A sound import is already running.');this.importing=true;const report={imported:0,skipped:[]};
  try{for(const file of files){const info=await fs.promises.lstat(file);if(info.isSymbolicLink())throw Error('Import the original folder, not a folder link.');const ext=path.extname(file).toLowerCase();const entries=info.isDirectory()?await mediaEntries(file):ext==='.zip'?await zipEntries(file):supported.has(ext)?[{name:path.basename(file),file}]:[];
   for(const entry of entries){if(this.items.length>=1000){report.skipped.push({name:entry.name,reason:'The library contains 1,000 sounds.'});continue;}
    const id=crypto.randomUUID(),temporary=path.join(this.directory,id+'.source'+path.extname(entry.name)),target=path.join(this.directory,id+'.wav');
    try{const nested=path.posix.dirname(entry.name),entryFolder=folderPath([folder,nested==='.'?'':nested].filter(Boolean).join('/')||'Sounds');this.addFolder(entryFolder);if(entry.file){const info=await fs.promises.stat(entry.file);if(info.size>256*1048576)throw Error('This source file is over 256 MB.');}else await fs.promises.writeFile(temporary,await entry.read());
     const metadata=await this.decode(entry.file||temporary,target),videoExt=videoExtensions.has(path.extname(entry.name).toLowerCase())?path.extname(entry.name).toLowerCase():null,mediaBytes=videoExt?(await fs.promises.stat(entry.file||temporary)).size:0,bytes=(await fs.promises.stat(target)).size;const used=this.items.reduce((sum,item)=>sum+(item.bytes??Math.ceil(item.durationSeconds*192000)),0);if(used+bytes+mediaBytes>2*1024**3)throw Error('The sound library has reached its 2 GB limit. Remove some sounds first.');if(videoExt)await fs.promises.copyFile(entry.file||temporary,path.join(this.directory,id+videoExt));this.items.push({id,bytes:bytes+mediaBytes,folder:entryFolder,videoExt,name:path.basename(entry.name,path.extname(entry.name))||'Untitled sound',shortcut:'',volume:.7,durationSeconds:metadata.durationSeconds});this.persist();report.imported++;
    }catch(error){await fs.promises.rm(target,{force:true});report.skipped.push({name:entry.name,reason:error.message});}
    finally{if(!entry.file)await fs.promises.rm(temporary,{force:true});}
   }
  }return {...report,sounds:this.list()};}finally{this.importing=false;}
 }
 update(id,values){const item=this.item(id);if(values.name!==undefined){const name=String(values.name).trim();if(!name||name.length>100)throw Error('Use a sound name between 1 and 100 characters.');item.name=name;}
  if(values.folder!==undefined){this.addFolder(values.folder);item.folder=folderPath(values.folder);}
  if(values.volume!==undefined){const volume=Number(values.volume);if(!Number.isFinite(volume)||volume<0||volume>1)throw Error('Sound volume must be between 0 and 100%.');item.volume=volume;}
  if(values.shortcut!==undefined){const shortcut=String(values.shortcut);if(!validShortcut(shortcut))throw Error('Use a modifier plus a letter, number or function key.');if(shortcut&&this.items.some(s=>s.id!==id&&s.shortcut===shortcut))throw Error('Another sound already uses this shortcut.');item.shortcut=shortcut;}
  this.persist();return this.list();
 }
 async replaceMissing(id,source){const item=this.item(id),target=this.file(id);if(fs.existsSync(target))throw Error('This clip already has its audio file.');const temporary=target+'.restore.wav';try{const metadata=await this.decode(source,temporary);fs.renameSync(temporary,target);item.durationSeconds=metadata.durationSeconds;item.bytes=fs.statSync(target).size;this.persist();return this.list();}finally{await fs.promises.rm(temporary,{force:true});}}
 async remove(id){const item=this.item(id);if(item.videoExt)await fs.promises.rm(this.videoFile(id),{force:true});await fs.promises.rm(this.file(id),{force:true});this.items=this.items.filter(s=>s.id!==id);this.persist();return this.list();}
}
module.exports={SoundboardLibrary,zipEntries,supported,validShortcut,folderPath};
