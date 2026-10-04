const fs=require('fs'),path=require('path');
class Updates {
 constructor({updater,app,data,enabled=true,beforeInstall=()=>{}}){
  this.updater=updater;this.app=app;this.beforeInstall=beforeInstall;this.allowed=enabled;
  this.file=path.join(data,'updates.json');this.listeners=new Set();this.busy=false;
  let saved={};try{saved=JSON.parse(fs.readFileSync(this.file,'utf8'));}catch{}
  this.state={enabled:saved.enabled!==false,status:enabled?'idle':'unavailable',version:app.getVersion(),availableVersion:null,percent:0,message:enabled?'Updates are checked in the background.':'Updates are available in the installed app.'};
  updater.autoDownload=true;updater.autoInstallOnAppQuit=false;updater.allowPrerelease=false;
  updater.on('checking-for-update',()=>this.set({status:'checking',message:'Checking GitHub for updates…'}));
  updater.on('update-available',info=>this.set({status:'downloading',availableVersion:info.version,percent:0,message:'Downloading YappGG '+info.version+'…'}));
  updater.on('download-progress',progress=>this.set({status:'downloading',percent:Math.round(progress.percent),message:'Downloading update · '+Math.round(progress.percent)+'%'}));
  updater.on('update-not-available',()=>this.set({status:'current',message:'You have the latest version.'}));
  updater.on('update-downloaded',info=>this.set({status:'ready',availableVersion:info.version,percent:100,message:'YappGG '+info.version+' is ready. Restart when you finish your call.'}));
  updater.on('error',()=>this.set({status:'error',message:'Cannot reach the update downloads. Check your connection; GitHub releases must be public.'}));
 }
 set(values){Object.assign(this.state,values);for(const listener of this.listeners)listener({...this.state});}
 async check(){if(!this.allowed||this.busy||this.state.status==='ready'||this.state.status==='downloading')return {...this.state};this.busy=true;try{await this.updater.checkForUpdates();}catch{this.set({status:'error',message:'Cannot reach the update downloads. Check your connection; GitHub releases must be public.'});}finally{this.busy=false;}return {...this.state};}
 command(command,values={}){if(command==='status')return {...this.state};if(command==='check')return this.check();if(command==='enabled'){this.set({enabled:!!values.enabled});fs.writeFileSync(this.file,JSON.stringify({enabled:this.state.enabled}));return {...this.state};}if(command==='install'){if(!this.allowed||this.state.status!=='ready')throw Error('Download an update before restarting.');this.beforeInstall();this.updater.quitAndInstall(false,true);return true;}throw Error('Unknown update action.');}
 start(){if(!this.allowed)return;this.initial=setTimeout(()=>{if(this.state.enabled)this.check();},20000);this.initial.unref();this.interval=setInterval(()=>{if(this.state.enabled)this.check();},6*60*60*1000);this.interval.unref();}
 dispose(){clearTimeout(this.initial);clearInterval(this.interval);this.listeners.clear();}
}
module.exports={Updates};
