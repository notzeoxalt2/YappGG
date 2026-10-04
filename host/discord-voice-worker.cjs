// Read Chromium's own storage format offline, without loading Discord or executing
// its scripts. Only the saved voice settings are changed; other keys survive.
const fs=require('fs'),path=require('path');
exports.run=function({app,BrowserWindow,session},work){
  app.disableHardwareAcceleration();
  app.setPath('userData',path.join(work,'worker-app'));
  let stage='starting';
  const timeout=setTimeout(()=>{fs.writeFileSync(path.join(work,'result.json'),JSON.stringify({configured:false,error:'Discord setup timed out at '+stage}));app.exit(1);},20000);
  app.whenReady().then(async()=>{
    const report=path.join(work,'result.json');
    try {
      stage='opening offline storage';const isolated=session.fromPath(path.join(work,'profile'));
      isolated.protocol.handle('https',()=>new Response('<!doctype html><title>Offline microphone setup</title>',{headers:{'Content-Type':'text/html'}}));
      const window=new BrowserWindow({show:false,webPreferences:{session:isolated,sandbox:true,contextIsolation:true}});
      stage='loading offline settings';
      for(let attempt=0;;attempt++)try{await window.loadURL('https://discord.com');break;}catch(error){if(attempt===2)throw error;await new Promise(resolve=>setTimeout(resolve,500));}
      const restoreFile=path.join(work,'restore.json');
      const restore=fs.existsSync(restoreFile)?JSON.parse(fs.readFileSync(restoreFile,'utf8')):null;
      if(restore&&(!['noiseSuppression','noiseCancellation','automaticGainControl','automaticSensitivity','krispVoiceDetection'].every(k=>typeof restore[k]==='boolean')||!Number.isFinite(restore.threshold)||restore.threshold < -100||restore.threshold>0))throw Error('The saved voice settings backup is invalid.');
      stage='updating voice settings';const result=await window.webContents.executeJavaScript(`(()=>{
        const restore=${JSON.stringify(restore)};
        const raw=localStorage.getItem('MediaEngineStore');
        if(!raw)throw Error('Open Discord once and sign in before applying microphone settings.');
        const saved=JSON.parse(raw),voice=saved.default;
        if(!voice||typeof voice.modeOptions!=='object'||typeof voice.noiseSuppression!=='boolean'||typeof voice.automaticGainControl!=='boolean')
          throw Error('This Discord settings format is not supported. No settings were changed.');
        const otherKeys=Object.keys(localStorage).filter(k=>k!=='MediaEngineStore');
        const others=otherKeys.map(k=>[k,localStorage.getItem(k)]);
        const original=JSON.parse(JSON.stringify(saved));
        const select=v=>({noiseSuppression:v.noiseSuppression,noiseCancellation:v.noiseCancellation,automaticGainControl:v.automaticGainControl,
          automaticSensitivity:v.modeOptions.autoThreshold,krispVoiceDetection:v.modeOptions.vadUseKrisp,threshold:v.modeOptions.threshold});
        const before=select(voice);
        voice.noiseSuppression=restore?.noiseSuppression??false;voice.noiseCancellation=restore?.noiseCancellation??false;voice.automaticGainControl=restore?.automaticGainControl??false;
        voice.modeOptions.autoThreshold=restore?.automaticSensitivity??false;voice.modeOptions.vadUseKrisp=restore?.krispVoiceDetection??false;voice.modeOptions.threshold=restore?.threshold??-70;
        // Preserve echo cancellation for people using speakers, plus push-to-talk,
        // input/output devices, volumes, mute, shortcuts and stream settings.
        localStorage.setItem('MediaEngineStore',JSON.stringify(saved));
        const actual=JSON.parse(localStorage.getItem('MediaEngineStore'));
        if(JSON.stringify(actual)!==JSON.stringify(saved)||others.some(([k,v])=>localStorage.getItem(k)!==v))throw Error('Voice settings verification failed.');
        const allowed=new Set(['noiseSuppression','noiseCancellation','automaticGainControl','modeOptions']);
        const preserved=Object.keys(original.default).filter(k=>!allowed.has(k)).every(k=>JSON.stringify(original.default[k])===JSON.stringify(actual.default[k]))
          &&JSON.stringify(original.stream)===JSON.stringify(actual.stream)
          &&Object.keys(original.default.modeOptions).filter(k=>!['autoThreshold','vadUseKrisp','threshold'].includes(k)).every(k=>JSON.stringify(original.default.modeOptions[k])===JSON.stringify(actual.default.modeOptions[k]));
        if(!preserved)throw Error('Unrelated voice settings changed.');
        return {configured:true,restored:!!restore,before,after:select(actual.default),preservedOtherSettings:true};
      })()`);
      stage='saving voice settings';isolated.flushStorageData();
      await new Promise(resolve=>setTimeout(resolve,500));
      fs.writeFileSync(report,JSON.stringify(result,null,2));window.destroy();
    }catch(error){fs.writeFileSync(report,JSON.stringify({configured:false,error:error.message}));app.exit(1);return;}
    clearTimeout(timeout);app.quit();
  });
};
