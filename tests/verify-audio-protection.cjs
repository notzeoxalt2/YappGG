const fs=require('fs'),path=require('path'),{spawn}=require('child_process'),Native=require('../host/native-client.cjs');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const c=new Native(path.resolve('build/compact-native/MicBackend.exe'),()=>{},'exclusive');let fixture;
 const report={};
 try{
  const settings=JSON.parse(fs.readFileSync('../original-mic-data/settings.json'));
  await c.command('apply',{data:settings.configs.find(p=>p.id===settings.selected).data});
  await c.command('start',{inputId:'{0.0.1.00000000}.{f37f97bb-6614-413a-a27b-533a3b8db0f8}'});
  await c.command('gain',{value:Math.pow(10,6/20),muted:false});
  report.boost=(await c.command('status')).status.gain;
  fixture=spawn('dotnet',[path.resolve('tests/OutputInjectionFixture/bin/Release/net8.0-windows/OutputInjectionFixture.dll'),'{0.0.0.00000000}.{8ef8f5e6-ed55-4470-b338-aced9f7cc2ce}'],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  await new Promise((resolve,reject)=>{fixture.stdout.on('data',b=>{if(b.toString().trim()==='ready')resolve();});fixture.once('exit',code=>reject(Error('Fixture exited '+code)));fixture.stderr.on('data',b=>console.error(b.toString()));});
  await delay(1200);
  let on=(await c.command('status')).shareProtection;for(let i=0;i<3&&!on.sessions.some(s=>s.pid===c.process.pid&&!s.muted);i++){await delay(1000);on=(await c.command('status')).shareProtection;}
  report.sessions=on.sessions;report.backendPid=c.process.pid;report.blocked=on.sessions.find(s=>s.pid===fixture.pid)?.muted===true;
  report.producerUnmuted=on.sessions.some(s=>s.pid===c.process.pid&&s.producer&&!s.muted);
  await c.command('desktop-isolation',{enabled:false});await delay(1200);
  report.disabledRestores=(await c.command('status')).shareProtection.sessions.find(s=>s.pid===fixture.pid)?.muted===false;
  await c.command('desktop-isolation',{enabled:true});await delay(1200);
  const current=await c.command('status');
  report.enabledAgain=current.shareProtection.sessions.find(s=>s.pid===fixture.pid)?.muted===true;
  report.microphoneName=current.status.outputName;
  report.discord=current.shareProtection.sessions.filter(s=>s.process==='Discord');
  report.passed=report.blocked&&report.producerUnmuted&&report.disabledRestores&&report.enabledAgain&&Math.abs(report.boost-Math.pow(10,6/20))<0.001&&report.microphoneName==='YappGG Microphone (YappGG Audio)';
  fs.writeFileSync('../reports/audio-protection-test.json',JSON.stringify(report,null,2));console.log(report);
  if(!report.passed)process.exitCode=1;
 }finally{await c.command('gain',{value:1,muted:false}).catch(()=>{});await c.close();fixture?.stdin.end();}
})().catch(error=>{console.error(error);process.exitCode=1;});
