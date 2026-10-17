const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict');
const {scripts,inspect,repair}=require('../host/driver-repair.cjs');
(async()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'yappgg-repair-'));try{
 const f=scripts("C:\\Program Files\\Friend's YappGG\\MicBackend.exe",root,'test');assert(f.launcher.includes('-Verb RunAs'));assert(!f.launcher.includes('Restart-Computer'));
 const save=(code,output,error='')=>{fs.writeFileSync(f.result,JSON.stringify({exitCode:code}));fs.writeFileSync(f.out,output);fs.writeFileSync(f.err,error);};
 save(1,'','Bind signed microphone driver failed (0xE000020B).');assert.throws(()=>inspect(f),/0xE000020B/);
 save(0,'{"installed":true,"reboot":false}');assert(inspect(f).installed);
 save(3010,'{"installed":true,"reboot":true}');assert.throws(()=>inspect(f),/pending a PC restart/);
 save(0,'not JSON');assert.throws(()=>inspect(f),/unreadable/);
 await assert.rejects(repair({executable:'inert',directory:root,execFile:(_exe,_args,_options,callback)=>callback({code:1223},'','cancelled')}),/cancelled/);
 console.log('PASS: exact repair error, success, pending-reboot, malformed report and UAC cancellation. No elevation or driver install executed.');
}finally{fs.rmSync(root,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
