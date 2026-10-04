const fs=require('fs'),path=require('path'),Native=require('../host/native-client.cjs'),brand=require('../host/branding.cjs'),delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const initial=brand(JSON.parse(fs.readFileSync('../original-mic-data/initial.json'))),c=new Native(path.resolve('build/compact-native/MicBackend.exe'),()=>{},'exclusive'),report={};
 try{
  const cheap=initial.configs.find(c=>c.name==='Crappy Voice'),clean=initial.configs.find(c=>c.name==='Deep Voice');
  await c.command('apply',{data:cheap.data});await c.command('start',{inputId:'{0.0.1.00000000}.{f37f97bb-6614-413a-a27b-533a3b8db0f8}'});await c.command('gain',{value:1,muted:false});await delay(700);
  report.effect=(await c.command('status')).status.effect;
  await c.command('record-start',{path:path.resolve('../reports/crappy-voice.wav')});await delay(2500);report.loud=(await c.command('record-stop')).recording;
  await c.command('gain',{value:1,muted:true});await delay(600);await c.command('record-start',{path:path.resolve('../reports/crappy-voice-muted.wav')});await delay(1000);report.muted=(await c.command('record-stop')).recording;
  await c.command('gain',{value:1,muted:false});await c.command('apply',{data:initial.configs.find(c=>c.name==='Lo-Fi Telephone').data});report.telephone=(await c.command('status')).status;
  await c.command('apply',{data:clean.data});report.clean=(await c.command('status')).status;report.clearCast=(await c.command('snapshot')).settings.NoiseCancelingState;
  report.passed=report.effect==='Crappy Voice'&&report.loud.peak>.5&&report.loud.rms>.2&&report.muted.peak===0&&report.telephone.running&&report.telephone.effect==='Lo-Fi Telephone'&&report.clean.running&&report.clean.effect===null&&report.clearCast;
  fs.writeFileSync('../reports/fun-presets-test.json',JSON.stringify(report,null,2));console.log(report);if(!report.passed)process.exitCode=1;
 }finally{await c.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
