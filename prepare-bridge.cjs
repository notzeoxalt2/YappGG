const fs=require('fs'),path=require('path');
const root=__dirname;
fs.writeFileSync(path.join(root,'ui/bridge.js'),fs.readFileSync(path.join(root,'bridge-template.js'),'utf8').replace('__LOCALE__',fs.readFileSync(path.join(root,'ui/en_US.json'),'utf8')));
fs.copyFileSync(path.join(root,'mount-template.js'),path.join(root,'ui/mount.js'));
