const fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto'),zlib=require('zlib'),assert=require('assert/strict');
const {SoundboardLibrary}=require('../host/soundboard-library.cjs');
function zipOne(name,value){const n=Buffer.from(name),data=Buffer.from(value),crc=zlib.crc32(data),header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt32LE(crc,14);header.writeUInt32LE(data.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(n.length,26);const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt32LE(crc,16);central.writeUInt32LE(data.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(n.length,28);const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(46+n.length,12);end.writeUInt32LE(30+n.length+data.length,16);return Buffer.concat([header,n,data,central,n,end]);}
(async()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'yappgg-external-delete-'));try{
 const source=path.join(root,'original.wav');fs.writeFileSync(source,'inert fixture');
 const directory=path.join(root,'managed');const lib=new SoundboardLibrary(directory,async(input,target)=>{await fs.promises.copyFile(input,target);return {durationSeconds:1};});
 await lib.import([source]);const first=lib.items[0];await lib.refresh();assert.equal(lib.list()[0].missing,false);
 fs.unlinkSync(path.join(directory,first.id+'.wav'));lib.lastRefresh=0;assert.equal((await lib.refresh())[0].missing,true);
 await lib.remove(first.id);assert.equal(lib.list().length,0);
 await lib.import([source]);await lib.clear();assert.equal(lib.list().length,0);assert(fs.existsSync(source));
 assert.equal(new SoundboardLibrary(directory,()=>{}).items.length,0);
 assert.equal(JSON.parse(fs.readFileSync(lib.index+'.backup.json')).sounds.length,1);
 await lib.import([source]);assert.equal((await lib.refresh()).length,1);
 lib.items=Array.from({length:8000},(_,i)=>({id:crypto.randomUUID(),name:'Clip '+i,folder:'Sounds'}));lib.persist();
 lib.lastRefresh=0;let reads=0;const read=fs.promises.readdir;fs.promises.readdir=async(...args)=>{reads++;return read.apply(fs.promises,args);};try{await Promise.all(Array.from({length:12},()=>lib.refresh()));assert.equal(reads,1);}finally{fs.promises.readdir=read;}
 const exists=fs.existsSync;fs.existsSync=()=>{throw Error('list must not block on file checks');};try{assert.equal(lib.list().length,8000);}finally{fs.existsSync=exists;}
 await lib.clear();assert.equal(lib.items.length,0);await lib.import([source]);assert.equal(lib.items.length,1);
 const linkedDirectory=path.join(root,'linked-library'),linked=new SoundboardLibrary(linkedDirectory,async()=>{throw Error('linked audio must not be copied or decoded');},()=>{},{linkSources:true,probe:async()=>({durationSeconds:1})});await linked.import([source]);const linkedItem=linked.items[0];assert.equal(linked.file(linkedItem.id),source);assert(!fs.existsSync(path.join(linkedDirectory,linkedItem.id+'.wav')));await linked.remove(linkedItem.id);assert(fs.existsSync(source));
 await linked.import([source]);fs.unlinkSync(source);linked.lastRefresh=0;assert.equal((await linked.refresh()).length,0);assert.equal(linked.items.length,0);
 const archive=path.join(root,'voices.zip'),extraction=path.join(root,'chosen-extraction-folder');fs.writeFileSync(archive,zipOne('Omen/Jett/hello.wav','inert zip fixture'));await assert.rejects(linked.import([archive]),/Choose where to extract/);const zipResult=await linked.import([archive],'',{extractDirectory:extraction});assert.equal(zipResult.imported,1);const zipItem=linked.items[0];assert(zipItem.sourcePath.startsWith(extraction+path.sep));assert(fs.existsSync(zipItem.sourcePath));assert(!fs.existsSync(path.join(linkedDirectory,zipItem.id+'.wav')));await linked.clear();assert(fs.existsSync(zipItem.sourcePath));
 console.log('PASS: external deletion, linked files without managed copies, user-chosen ZIP extraction, empty/reimport recovery, original-file preservation, metadata backup, shared async scan and zero filesystem calls in list. Inert fixtures only.');
}finally{fs.rmSync(root,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
