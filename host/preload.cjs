const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('micHost',{
  updates:(command,values)=>ipcRenderer.invoke('host:updates',command,values),
  soundboard:(command,values)=>ipcRenderer.invoke('host:soundboard',command,values),
  initial:()=>ipcRenderer.invoke('host:initial'),
  save:state=>ipcRenderer.invoke('host:save',state),
  settings:(command,values)=>ipcRenderer.invoke('host:settings',command,values),
  log:row=>ipcRenderer.invoke('host:log',row),
  window:action=>ipcRenderer.invoke('host:window',action)
  ,audio:(command,values)=>ipcRenderer.invoke('host:audio',command,values)
  ,onAudio:callback=>{const listener=(_,value)=>callback(value);ipcRenderer.on('host:audio-status',listener);return()=>ipcRenderer.removeListener('host:audio-status',listener);}
});
