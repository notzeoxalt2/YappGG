const path=require('path');
class SoundWheel{
 constructor({BrowserWindow,screen,directory,list,folders,play,folder,shortcut,onError}){Object.assign(this,{BrowserWindow,screen,directory,list,folders,play,folder,shortcut,onError});this.generation=0;}
 async open(){if(this.window?.isVisible()){this.close();return;}clearTimeout(this.releaseTimer);const generation=++this.generation;if(!this.window||this.window.isDestroyed()){
  const win=this.window=new this.BrowserWindow({width:560,height:620,show:false,frame:false,transparent:true,resizable:false,alwaysOnTop:true,skipTaskbar:true,hasShadow:false,title:'YappGG sound wheel',webPreferences:{preload:path.join(this.directory,'../host/wheel-preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
  win.setAlwaysOnTop(true,'pop-up-menu');win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',event=>event.preventDefault());win.on('blur',()=>{if(win.isVisible())this.close();});win.on('close',event=>{if(!this.disposed){event.preventDefault();this.close();}});win.on('closed',()=>{if(this.window===win)this.window=null;});this.ready=win.loadFile(path.join(this.directory,'wheel.html'));
 }
 await this.ready;if(this.disposed||generation!==this.generation)return;const cursor=this.screen.getCursorScreenPoint(),area=this.screen.getDisplayNearestPoint(cursor).workArea;const width=Math.min(560,area.width),height=Math.min(620,area.height);const x=Math.round(Math.max(area.x,Math.min(area.x+area.width-width,cursor.x-width/2))),y=Math.round(Math.max(area.y,Math.min(area.y+area.height-height,cursor.y-height/2)));
 this.window.setBounds({x,y,width,height});this.window.webContents.send('wheel:open',{sounds:this.list(),folders:this.folders(),folder:this.folder(),shortcut:this.shortcut(),initialCursor:{x:cursor.x-x,y:cursor.y-y}});this.window.show();this.window.focus();
 }
 close(){++this.generation;this.window?.hide();clearTimeout(this.releaseTimer);this.releaseTimer=setTimeout(()=>{this.window?.destroy();this.window=null;},30000);}
 async choose(id){if(!this.window?.isVisible())throw Error('Open the sound wheel first.');const exists=this.list().some(s=>s.id===id);if(!exists)throw Error('This sound was removed.');this.close();try{return await this.play(id);}catch(error){this.onError(error);throw error;}}
 command(event,command,id){if(event.sender!==this.window?.webContents)throw Error('Invalid sound wheel window.');if(command==='cancel'){this.close();return true;}if(command==='play')return this.choose(id);throw Error('Unknown wheel action.');}
 dispose(){this.disposed=true;++this.generation;clearTimeout(this.releaseTimer);this.window?.destroy();this.window=null;}
}
module.exports={SoundWheel};
