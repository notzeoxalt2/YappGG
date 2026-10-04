const fs=require('fs'),path=require('path'),{execFile}=require('child_process'),{promisify}=require('util');
const execute=promisify(execFile);
let pending;
const profiles=[['discord','Discord','Discord.exe'],['discordptb','DiscordPTB','DiscordPTB.exe'],['discordcanary','DiscordCanary','DiscordCanary.exe']];
async function running(root,exe){
  const script="$items=@(Get-Process -Name ([IO.Path]::GetFileNameWithoutExtension($env:YAPPGG_DISCORD_EXE)) -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($env:YAPPGG_DISCORD_ROOT,[StringComparison]::OrdinalIgnoreCase) } | Select-Object @{Name='ProcessId';Expression={$_.Id}},@{Name='ExecutablePath';Expression={$_.Path}}); ConvertTo-Json -InputObject $items -Compress";
  let stdout;try{({stdout}=await execute('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,env:{...process.env,YAPPGG_DISCORD_ROOT:root+path.sep,YAPPGG_DISCORD_EXE:exe},timeout:30000}));}catch(error){throw Error('Could not check whether Discord is running: '+(error.stderr?.trim()||error.code||error.message));}
  return JSON.parse(stdout.trim()||'[]');
}
exports.enhance=function(options){
  if(pending)return pending;
  pending=enhance(options).finally(()=>{pending=null;});return pending;
};
exports.restore=function(options){return exports.enhance({...options,restore:true});};
async function enhance({app,data,mainScript,closeDiscord=true,restore=false}){
  const results=[];
  const reportFile=path.join(data,'discord-enhancement.json');
  const previous=fs.existsSync(reportFile)?JSON.parse(fs.readFileSync(reportFile,'utf8')):null;
  if(restore&&(!previous?.configured||previous.restored))throw Error('No applied Discord enhancement is available to revert.');
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  for(const [profile,install,exe] of profiles){
    const db=path.join(app.getPath('appData'),profile,'Local Storage','leveldb');
    if(!fs.existsSync(path.join(db,'CURRENT')))continue;
    const saved=previous?.profiles?.find(p=>p.profile===profile);
    if(restore&&!saved)continue;
    const root=path.join(process.env.LOCALAPPDATA,install),processes=await running(root,exe);
    if(processes.length&&!closeDiscord)throw Error('Quit Discord before applying microphone settings.');
    const restart=processes.length>0;
    const work=path.join(data,'discord-setup-work',stamp+'-'+profile);
    const staged=path.join(work,'profile','Local Storage','leveldb');
    const backup=path.join(data,'discord-backups',stamp,profile,'leveldb');
    try{
      if(restart){
        for(const process of processes)await execute('taskkill.exe',['/PID',String(process.ProcessId),'/T','/F'],{windowsHide:true}).catch(()=>{});
        // Windows can report a terminating process briefly after taskkill returns.
        await new Promise(resolve=>setTimeout(resolve,1000));
        if((await running(root,exe)).length){await new Promise(resolve=>setTimeout(resolve,1500));if((await running(root,exe)).length)throw Error('Discord is still running. Quit it and retry.');}
      }
      fs.mkdirSync(path.dirname(staged),{recursive:true});fs.cpSync(db,staged,{recursive:true});
      if(restore)fs.writeFileSync(path.join(work,'restore.json'),JSON.stringify(saved.before));
      const args=app.isPackaged?[]:[mainScript];
      const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
      await execute(process.execPath,[...args,'--discord-enhance-worker','--work-dir',work],{windowsHide:true,env,timeout:45000,maxBuffer:1024*1024});
      const result=JSON.parse(fs.readFileSync(path.join(work,'result.json'),'utf8'));
      if(!result.configured)throw Error(result.error||'Discord voice setup failed.');
      if((await running(root,exe)).length)throw Error('Discord reopened during setup. Quit Discord and retry.');
      fs.mkdirSync(path.dirname(backup),{recursive:true});fs.cpSync(db,backup,{recursive:true});
      // Development data may live on E: while Discord lives on C:. Prepare the
      // replacement on Discord's volume so both commit renames are atomic.
      const ready=db+'.yappgg-stage-'+stamp,rollback=db+'.yappgg-rollback-'+stamp;
      fs.cpSync(staged,ready,{recursive:true});fs.renameSync(db,rollback);
      try{fs.renameSync(ready,db);}catch(error){fs.renameSync(rollback,db);throw error;}
      for(const [target,parent] of [[rollback,path.dirname(db)],[staged,work]]){
        if(!path.resolve(target).startsWith(path.resolve(parent)+path.sep))throw Error('Invalid temporary Discord storage path.');
        fs.rmSync(target,{recursive:true,force:true});
      }
      results.push({profile,...result,before:!restore&&previous?.configured&&!previous.restored&&saved?saved.before:result.before,backup});
    }catch(error){
      const report=path.join(work,'result.json');
      if(fs.existsSync(report)){const failure=JSON.parse(fs.readFileSync(report,'utf8'));if(failure.error)throw Error(failure.error);}
      throw error;
    }finally{
      if(restart&&fs.existsSync(path.join(root,'Update.exe')))execFile(path.join(root,'Update.exe'),['--processStart',exe],{windowsHide:true},()=>{});
    }
  }
  if(!results.length)throw Error('Open the Discord desktop app once, sign in, then apply these settings.');
  const result={configured:true,restored:restore,profiles:results,message:restore?'Previous Discord voice settings restored.':'Discord processing optimized. Speak softly and adjust the manual threshold if needed.'};
  fs.writeFileSync(reportFile,JSON.stringify(result,null,2));const stale=path.join(data,'discord-enhancement-error.json');if(fs.existsSync(stale))fs.unlinkSync(stale);return result;
}
