const fs=require('fs'),path=require('path'),crypto=require('crypto');
const quote=value=>"'"+value.replace(/'/g,"''")+"'";
function scripts(executable,directory,id){
 const out=path.join(directory,id+'.out.log'),err=path.join(directory,id+'.error.log'),result=path.join(directory,id+'.json');
 const elevated=`$ErrorActionPreference='Stop';try{$p=Start-Process -FilePath ${quote(executable)} -ArgumentList '--repair-driver' -WindowStyle Hidden -PassThru -Wait -RedirectStandardOutput ${quote(out)} -RedirectStandardError ${quote(err)};@{exitCode=$p.ExitCode}|ConvertTo-Json -Compress|Set-Content -Encoding UTF8 -LiteralPath ${quote(result)}}catch{@{exitCode=1;error=$_.Exception.Message}|ConvertTo-Json -Compress|Set-Content -Encoding UTF8 -LiteralPath ${quote(result)};exit 1}`;
 const encoded=Buffer.from(elevated,'utf16le').toString('base64');
 return {out,err,result,launcher:`$ErrorActionPreference='Stop';try{$p=Start-Process powershell.exe -ArgumentList '-NoProfile','-EncodedCommand','${encoded}' -Verb RunAs -WindowStyle Hidden -PassThru -Wait;exit $p.ExitCode}catch{[Console]::Error.WriteLine($_.Exception.Message);exit 1223}`};
}
function inspect(files){
 const read=file=>fs.existsSync(file)?fs.readFileSync(file,'utf8').replace(/^\uFEFF/,'').trim():'';
 const raw=read(files.result);if(!raw)throw Error('Repair did not return a result. It may still be running; wait before retrying.');
 const result=JSON.parse(raw),output=read(files.out),detail=read(files.err);
 if(![0,3010].includes(result.exitCode)){const diagnostic=[...detail.matchAll(/[^\r\n]*(?:failed \(0x[0-9a-f]{8}\)|device instance does not exist|administrator privileges)[^\r\n]*/gi)].at(-1)?.[0];throw Error(`Microphone repair failed (exit ${result.exitCode}). ${result.error||diagnostic||detail.slice(-2200)||'Windows did not provide error details.'}`);}
 let health;try{health=JSON.parse(output.split(/\r?\n/).filter(Boolean).at(-1));}catch{throw Error('Repair returned an unreadable result. '+(detail.slice(-1200)||output.slice(-1200)));}
 if(result.exitCode===3010||health.reboot)throw Error('Windows installed the driver but marked it as pending a PC restart. YappGG will not restart your PC automatically.');
 if(!health.installed)throw Error('Repair finished but Windows has not made the microphone driver available. '+detail.slice(-1200));
 return health;
}
async function repair({executable,directory,execFile=require('child_process').execFile}){
 fs.mkdirSync(directory,{recursive:true});const files=scripts(executable,directory,crypto.randomUUID());
 await new Promise((resolve,reject)=>execFile('powershell.exe',['-NoProfile','-EncodedCommand',Buffer.from(files.launcher,'utf16le').toString('base64')],{windowsHide:true,timeout:180000,maxBuffer:1024*1024},(error,out,stderr)=>{
  if(error&&!fs.existsSync(files.result)){reject(Error(error.killed?'Microphone repair timed out. Wait before trying again.':(Number(error.code)===1223||/cancel(?:led|ed)?/i.test(`${stderr||''} ${error.message}`))?'Windows cancelled the administrator request. Repair was not run.':'Could not launch microphone repair: '+(stderr?.trim()||error.message)));return;}resolve();
 }));return inspect(files);
}
module.exports={repair,scripts,inspect};
