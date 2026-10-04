const {app,BrowserWindow,session}=require('electron');
const fs=require('fs'),path=require('path'),os=require('os');
app.disableHardwareAcceleration();
const work=fs.mkdtempSync(path.join(os.tmpdir(),'yappgg-discord-inspect-'));
const report=process.argv.includes('--report')?process.argv[process.argv.indexOf('--report')+1]:path.join(__dirname,'../../reports/discord-voice-inspection.json');
app.setPath('userData',path.join(work,'app'));
app.whenReady().then(async()=>{
  try {
    const source=process.argv.includes('--storage')?process.argv[process.argv.indexOf('--storage')+1]:path.join(app.getPath('appData'),'discord','Local Storage');
    const profile=path.join(work,'profile');fs.mkdirSync(profile,{recursive:true});
    fs.cpSync(source,path.join(profile,'Local Storage'),{recursive:true});
    const isolated=session.fromPath(profile);
    isolated.protocol.handle('https',()=>new Response('<!doctype html><title>Offline voice settings inspection</title>',{headers:{'Content-Type':'text/html'}}));
    const window=new BrowserWindow({show:false,webPreferences:{session:isolated,sandbox:true,contextIsolation:true}});
    await window.loadURL('https://discord.com');
    const result=await window.webContents.executeJavaScript(`(()=>{
      const keys=Object.keys(localStorage).filter(k=>/^(MediaEngineStore|VoiceSettings|VoiceStore)$/i.test(k));
      return keys.map(key=>{let v;try{v=JSON.parse(localStorage.getItem(key));}catch{return {key,parseable:false};}
        const allowed=['noiseSuppression','noiseCancellation','echoCancellation','automaticGainControl','mode','modeOptions','inputDeviceId','inputVolume'];
        const values={};const current=v.default||v;for(const k of allowed)if(k in current)values[k]=current[k];
        return {key,fields:Object.keys(v),defaultFields:Object.keys(current),values};});
    })()`);
    fs.writeFileSync(report,JSON.stringify(result,null,2));window.destroy();
  }catch(error){fs.writeFileSync(report,JSON.stringify({error:error.message}));process.exitCode=1;}
  app.quit();
});
