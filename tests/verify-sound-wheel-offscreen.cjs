const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {app,BrowserWindow,ipcMain}=require('electron');
process.chdir(path.resolve(__dirname,'..'));app.disableHardwareAcceleration();
app.whenReady().then(async()=>{
 const report={},saved=[],pages=[],favorites=[];let win,cancels=0;
 try{
  ipcMain.handle('host:wheel',(_,command,value)=>{assert.notEqual(command,'play','This check never plays sounds');if(command==='cancel')cancels++;if(command==='folder'){saved.push(value);return {folder:value,page:0};}if(command==='page')pages.push(value);if(command==='favorite'){favorites.push(value.folder);return favorites;}return true;});
  win=new BrowserWindow({show:false,width:680,height:800,frame:false,transparent:true,focusable:false,webPreferences:{offscreen:true,preload:path.resolve('host/wheel-preload.cjs'),contextIsolation:true,nodeIntegration:false}});
  await win.loadFile(path.resolve('ui/wheel.html'));
  win.webContents.send('wheel:open',{sounds:Array.from({length:17},(_,i)=>({id:String(i),name:'Clip '+i,folder:'Favorites'})).concat({id:'nested',name:'Nested clip',folder:'Favorites/Character/Lines'}),folders:['Favorites','Music'],folder:'Favorites',slots:8});
  await new Promise(r=>setTimeout(r,80));
  report.controls=await win.webContents.executeJavaScript(`(async()=>{
   const $=id=>document.getElementById(id),release=button=>button.dispatchEvent(new PointerEvent('pointerup',{button:0,bubbles:true})),page=()=>$('page').textContent;
   release($('next'));const releaseWithoutPress=page()==='2 / 3';
   release($('next'));$('next').dispatchEvent(new MouseEvent('click',{detail:1,bubbles:true}));const singleAdvance=page()==='3 / 3';
   release($('previous'));const back=page()==='2 / 3';
   $('next').dispatchEvent(new PointerEvent('pointermove',{bubbles:true}));$('dial').dispatchEvent(new WheelEvent('wheel',{deltaY:200,bubbles:true}));document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));await new Promise(r=>setTimeout(r,500));const noHoverPaging=page()==='2 / 3';
   release($('folder-picker'));const menuVisible=!$('folder-menu').hidden;
   const noSubtypes=!document.querySelector('[data-folder="Favorites/Character/Lines"]')&&[...document.querySelectorAll('[data-folder]')].every(b=>!b.dataset.folder.includes('/'));release(document.querySelector('[aria-label="Favorite Favorites"]'));await new Promise(r=>setTimeout(r,30));const starred=!!document.querySelector('[aria-label="Unfavorite Favorites"]');release(document.querySelector('[data-folder="Favorites"]'));const allVoices=page()==='1 / 3';release($('next'));release($('next'));const nestedIncluded=[...document.querySelectorAll('.sound-label')].some(t=>t.textContent==='Nested clip');const captionAboveNumbers=$('group').compareDocumentPosition(document.querySelector('nav'))&Node.DOCUMENT_POSITION_FOLLOWING;
   release($('folder-picker'));release(document.querySelector('[data-folder="Favorites"]'));release($('folder-next'));const siblingsOnly=$('folder').value==='Music';
   return {releaseWithoutPress,singleAdvance,back,noHoverPaging,menuVisible,noSubtypes,starred,allVoices,nestedIncluded,captionAboveNumbers:!!captionAboveNumbers,siblingsOnly};
  })()`);
  const at=await win.webContents.executeJavaScript(`(()=>{const folder=document.getElementById('folder');folder.value='Favorites';folder.dispatchEvent(new Event('change'));const r=document.getElementById('next').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})()`);
  await new Promise(r=>setTimeout(r,40));
  win.webContents.sendInputEvent({type:'mouseMove',...at});
  win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...at});
  win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...at});
  await new Promise(r=>setTimeout(r,80));
  report.browserMouseClick=await win.webContents.executeJavaScript(`document.getElementById('page').textContent==='2 / 3'`);
  report.stayedHidden=!win.isVisible()&&!win.isFocused();
  report.savedFolder=saved.includes('Favorites');report.pageSaved=pages.some(p=>p.folder==='Favorites'&&p.page===2);report.favoriteSaved=favorites.includes('Favorites');win.webContents.send('wheel:open',{sounds:Array.from({length:17},(_,i)=>({id:String(i),name:'Clip '+i,folder:'Favorites'})),folders:['Favorites'],folder:'Favorites',slots:8,page:2,favorites:['Favorites']});await new Promise(r=>setTimeout(r,70));report.reopenKeepsPage=await win.webContents.executeJavaScript(`document.getElementById('page').textContent==='3 / 3'`);
  assert(Object.values(report.controls).every(Boolean));assert(report.browserMouseClick&&report.stayedHidden&&report.savedFolder&&report.pageSaved&&report.favoriteSaved&&report.reopenKeepsPage);
  report.layouts=[];for(const size of [440,560,680,800])for(const slots of [4,6,8,10,12]){win.setSize(size,size+40);win.webContents.send('wheel:open',{sounds:Array.from({length:24},(_,i)=>({id:String(i),name:'Voice line '+i,folder:'Omen/Anyone/Funny'})),folders:['Omen'],folder:'Omen',slots,page:0});await new Promise(r=>setTimeout(r,35));const geometry=await win.webContents.executeJavaScript(`(()=>{const tiles=[...document.querySelectorAll('.slice:not(.disabled)')].map(t=>t.getBoundingClientRect());return {gap:tiles.every((a,i)=>tiles.every((b,j)=>i===j||a.right+2<=b.left||b.right+2<=a.left||a.bottom+2<=b.top||b.bottom+2<=a.top)),labelsFit:[...document.querySelectorAll('.sound-label')].every(t=>{const a=t.getBBox(),b=t.previousElementSibling.getBBox();return a.x>=b.x&&a.x+a.width<=b.x+b.width&&a.y>=b.y&&a.y+a.height<=b.y+b.height;})};})()`);report.layouts.push({size,slots,...geometry});}assert(report.layouts.every(layout=>layout.gap&&layout.labelsFit));assert(!win.isVisible());
  win.webContents.send('wheel:open',{sounds:[{id:'a',name:'Basic line',folder:'Sounds/Yoru/Basic'},{id:'b',name:'Funny line',folder:'Sounds/Yoru/Anyone/Funny'}],folders:['Sounds','Sounds/Yoru','Sounds/Omen'],folder:'Sounds/Yoru',slots:8,page:0});await new Promise(r=>setTimeout(r,50));
  report.characterPicker=await win.webContents.executeJavaScript(`(()=>{const $=id=>document.getElementById(id);$('folder-picker').dispatchEvent(new PointerEvent('pointerup',{button:0,bubbles:true}));const organized=!!document.querySelector('[data-folder="Sounds/Yoru"]')&&!document.querySelector('[data-folder="Sounds/Yoru/Basic"]')&&[...document.querySelectorAll('.folder-section')].some(e=>e.textContent==='Sounds');const voices=[...document.querySelectorAll('.sound-label')].length===2;document.dispatchEvent(new PointerEvent('pointermove',{clientX:33,clientY:44,bubbles:true}));const cursor=$('wheel-cursor').style.left==='33px'&&$('wheel-cursor').style.top==='44px';document.body.dispatchEvent(new PointerEvent('pointerdown',{button:0,clientX:1,clientY:1,bubbles:true}));return {organized,voices,cursor};})()`);assert(Object.values(report.characterPicker).every(Boolean));await new Promise(r=>setTimeout(r,40));assert(cancels>0);report.outsideClickCloses=true;
  report.passed=true;
 }catch(error){report.error=error.stack;report.passed=false;}finally{win?.destroy();}
 fs.writeFileSync('../reports/sound-wheel-offscreen-test.json',JSON.stringify(report,null,2));app.exit(report.passed?0:1);
});
