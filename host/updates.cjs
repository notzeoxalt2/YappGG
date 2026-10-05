const fs=require('fs'),path=require('path');
class Updates {
 constructor({updater,app,data,enabled=true,beforeInstall=async()=>{},afterInstallFailure=async()=>{},installer=require("./update-install.cjs")}){
  this.updater=updater;this.app=app;this.beforeInstall=beforeInstall;this.afterInstallFailure=afterInstallFailure;this.installer=installer;this.data=data;this.installing=false;this.allowed=enabled;
  this.file=path.join(data,'updates.json');this.listeners=new Set();this.busy=false;
  let saved={};try{saved=JSON.parse(fs.readFileSync(this.file,'utf8'));}catch{}
  this.state={enabled:saved.enabled!==false,status:enabled?'idle':'unavailable',version:app.getVersion(),availableVersion:null,percent:0,message:enabled?'Updates are checked in the background.':'Updates are available in the installed app.'};
  this.resultFile=path.join(data,'update-install-result.json');try{const result=JSON.parse(fs.readFileSync(this.resultFile,'utf8').replace(/^\uFEFF/,''));if(result.status==='failed')Object.assign(this.state,{status:'error',message:result.message,installFailure:result.message});else if(result.status==='installed'&&result.version===app.getVersion())Object.assign(this.state,{status:'current',message:result.message});}catch{}
  updater.autoDownload=true;updater.autoInstallOnAppQuit=false;updater.allowPrerelease=false;
  updater.on('checking-for-update',()=>this.set({status:'checking',message:'Checking GitHub for updates…'}));
  updater.on('update-available',info=>this.set({status:'downloading',availableVersion:info.version,percent:0,message:'Downloading YappGG '+info.version+'…'}));
  updater.on('download-progress',progress=>this.set({status:'downloading',percent:Math.round(progress.percent),message:'Downloading update · '+Math.round(progress.percent)+'%'}));
  updater.on('update-not-available',()=>this.set({status:'current',message:'You have the latest version.'}));
  updater.on('update-downloaded',info=>{this.downloaded=info;this.set({status:'ready',availableVersion:info.version,percent:100,message:'YappGG '+info.version+' is ready. Restart when you finish your call.'});});
  updater.on('error',error=>{fs.appendFileSync(path.join(data,'update-errors.log'),new Date().toISOString()+' '+String(error?.stack||error)+'\n');this.set({status:'error',message:'Update failed: '+String(error?.message||'Check your connection.').slice(0,220)});});
 }
 set(values){Object.assign(this.state,values);for(const listener of this.listeners)listener({...this.state});}
 async check(){if(!this.allowed||this.busy||this.state.status==='ready'||this.state.status==='downloading'||this.state.status==='installing')return {...this.state};this.busy=true;try{await this.updater.checkForUpdates();}catch{this.set({status:'error',message:'Cannot reach the update downloads. Check your connection; GitHub releases must be public.'});}finally{this.busy=false;}return {...this.state};}
 command(command,values={}){if(command==='status')return {...this.state};if(command==='check')return this.check();if(command==='enabled'){this.set({enabled:!!values.enabled});fs.writeFileSync(this.file,JSON.stringify({enabled:this.state.enabled}));return {...this.state};}if(command==='install')return this.install();throw Error('Unknown update action.');}
 async install(){
  if(this.installing)return {...this.state};if(!this.allowed||this.state.status!=='ready')throw Error('Download an update before restarting.');this.installing=true;let prepared=false;
  const event=(phase,detail='')=>fs.appendFileSync(path.join(this.data,'update-install-events.log'),JSON.stringify({time:new Date().toISOString(),phase,detail})+'\n');
  try{
   this.set({status:'installing',message:'Verifying the downloaded installer…'});event('verify-start');
   const file=this.updater.installerPath,sha512=this.downloaded?.files?.[0]?.sha512||this.downloaded?.sha512;await this.installer.verifyInstaller(file,sha512);event('verify-complete');
   this.set({message:'Closing the microphone engine…'});event('shutdown-start');await this.beforeInstall();prepared=true;event('shutdown-complete');
   this.set({message:'Starting the Windows update helper…'});event('helper-start');await this.installer.launchInstaller({app:this.app,data:this.data,file,version:this.state.availableVersion});event('helper-ready');
   this.set({message:'Installer is ready. Approve the Windows administrator prompt.'});setImmediate(()=>this.app.quit());return {...this.state};
  }catch(error){event('failed',error.message);this.set({status:'error',message:String(error.message||error)});if(prepared){try{await this.afterInstallFailure();}catch(restoreError){event('restore-failed',restoreError.message);}this.set({status:'ready',message:String(error.message||error)});}throw error;}finally{this.installing=false;}
 }

 start(){if(!this.allowed)return;this.initial=setTimeout(()=>{if(this.state.enabled)this.check();},20000);this.initial.unref();this.interval=setInterval(()=>{if(this.state.enabled)this.check();},6*60*60*1000);this.interval.unref();}
 dispose(){clearTimeout(this.initial);clearInterval(this.interval);this.listeners.clear();}
}
module.exports={Updates};
