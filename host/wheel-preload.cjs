const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('wheelHost',{onOpen:callback=>{const listener=(_,data)=>callback(data);ipcRenderer.on('wheel:open',listener);return()=>ipcRenderer.removeListener('wheel:open',listener);},play:id=>ipcRenderer.invoke('host:wheel','play',id),cancel:()=>ipcRenderer.invoke('host:wheel','cancel')});
