const {execFile}=require('child_process'),NativeClient=require('./native-client.cjs');
class GgClient{
 constructor(executable,log){this.capture=new NativeClient(executable,log,'gg');this.address=null;this.config=null;this.gain=1;this.muted=false;this.inputId=null;this.lastPrivacy=0;}
 get closed(){return this.capture.closed;}
 async discover(){const port=await new Promise((resolve,reject)=>execFile('powershell.exe',['-NoProfile','-Command',"$p=Get-Process SteelSeriesSonar -ErrorAction Stop;Get-NetTCPConnection -State Listen -OwningProcess $p.Id | Select-Object -First 1 -ExpandProperty LocalPort"],{windowsHide:true},(error,out)=>error?reject(Error('Keep SteelSeries GG/Sonar running to supply ClearCast.')):resolve(Number(out.trim()))));if(!Number.isInteger(port)||port<1024||port>65535)throw Error('Cannot find the local Sonar service.');this.address='http://127.0.0.1:'+port;}
 async api(path,method='GET',body){if(!this.address)await this.discover();let response;try{response=await fetch(this.address+path,{method,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(5000)});}catch(error){this.address=null;throw Error('GG/Sonar is unavailable. Reopen GG and retry.');}if(!response.ok)throw Error('GG audio request failed: '+path+' ('+response.status+')');return response.status===204?null:response.json();}
 async protect(){const routes=await this.api('/streamRedirections');for(const id of ['streaming','monitoring']){const route=routes.find(r=>r.streamRedirectionId===id);if(route?.status?.some(s=>s.role==='chatCapture'&&s.isEnabled))await this.api('/streamRedirections/'+id+'/redirections/chatCapture/isEnabled/false','PUT');}this.lastPrivacy=Date.now();}
 async apply(data){const configs=await this.api('/configs?vad=chatCapture');const existing=configs.find(c=>c.name==='YappGG'&&!c.isPreset);if(!this.config)this.config=existing||(await this.api('/configs/selected')).find(c=>c.virtualAudioDevice==='chatCapture');if(!this.config)throw Error('GG microphone configuration is unavailable.');const update={...this.config,name:'YappGG',isPreset:false,isFavorite:false,favoritePosition:-1,data,defaultData:data};this.config=await this.api('/configs',existing?'PUT':'POST',update);await this.api('/configs/'+this.config.id+'/select','PUT');return {running:true};}
 async command(command,values={}){
  if(command==='apply')return this.apply(values.data);
  if(command==='start'){await this.protect();await this.api('/classicRedirections/mic/deviceId/'+encodeURIComponent(values.inputId),'PUT');this.inputId=values.inputId;await this.capture.command('start');return {running:true};}
  if(command==='gain'){await this.api('/volumeSettings/classic/chatCapture/Volume/'+values.value,'PUT');await this.api('/volumeSettings/classic/chatCapture/Mute/'+!!values.muted,'PUT');this.gain=values.value;this.muted=!!values.muted;return {running:true};}
  if(command==='stop'){await this.api('/volumeSettings/classic/chatCapture/Mute/true','PUT');this.muted=true;return this.capture.command('stop');}
  if(command==='snapshot')return {settings:this.config?.data};
  if(command==='status'){if(Date.now()-this.lastPrivacy>2000)await this.protect();const result=await this.capture.command('status');result.status={...result.status,inputId:this.inputId,gain:this.gain,muted:this.muted,streamMixMicExcluded:true};return result;}
  return this.capture.command(command,values);
 }
 async close(){await this.capture.close();}
}
module.exports=GgClient;
