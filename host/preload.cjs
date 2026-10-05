const {contextBridge,ipcRenderer,webUtils}=require('electron');
contextBridge.exposeInMainWorld('micHost',{
  updates:(command,values)=>ipcRenderer.invoke('host:updates',command,values),
  droppedPaths:files=>Array.from(files).map(file=>webUtils.getPathForFile(file)).filter(Boolean),
  onPreferences:callback=>{const listener=(_,value)=>callback(value);ipcRenderer.on('host:preferences',listener);return()=>ipcRenderer.removeListener('host:preferences',listener);},
  onImportProgress:callback=>{const listener=(_,value)=>callback(value);ipcRenderer.on('host:import-progress',listener);return()=>ipcRenderer.removeListener('host:import-progress',listener);},
  onSoundboard:callback=>{const listener=(_,value)=>callback(value);ipcRenderer.on('host:soundboard-changed',listener);return()=>ipcRenderer.removeListener('host:soundboard-changed',listener);},
  soundboard:(command,values)=>ipcRenderer.invoke('host:soundboard',command,values),
  initial:()=>ipcRenderer.invoke('host:initial'),
  save:state=>ipcRenderer.invoke('host:save',state),
  settings:(command,values)=>ipcRenderer.invoke('host:settings',command,values),
  log:row=>ipcRenderer.invoke('host:log',row),
  window:action=>ipcRenderer.invoke('host:window',action)
  ,audio:(command,values)=>ipcRenderer.invoke('host:audio',command,values)
  ,onAudio:callback=>{const listener=(_,value)=>callback(value);ipcRenderer.on('host:audio-status',listener);return()=>ipcRenderer.removeListener('host:audio-status',listener);}
});
