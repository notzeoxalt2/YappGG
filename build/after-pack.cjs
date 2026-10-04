const {execFileSync}=require('child_process'),path=require('path');
module.exports=async context=>{
 const root=context.packager.projectDir;
 execFileSync(path.join(root,'node_modules/electron-winstaller/vendor/rcedit.exe'),[path.join(context.appOutDir,'YappGG.exe'),'--set-icon',path.join(root,'ui/brand/app.ico'),'--set-file-version',context.packager.appInfo.version,'--set-product-version',context.packager.appInfo.version,'--set-version-string','FileDescription','YappGG','--set-version-string','ProductName','YappGG','--set-version-string','InternalName','YappGG','--set-version-string','OriginalFilename','YappGG.exe'],{windowsHide:true});
};
