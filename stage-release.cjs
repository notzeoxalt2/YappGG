const fs=require('fs'),path=require('path');
const staging=path.join(__dirname,'build/compact-release-staging');fs.mkdirSync(staging,{recursive:true});
fs.cpSync(path.join(__dirname,'build/compact-native'),path.join(staging,'backend-bin'),{recursive:true,dereference:true});
fs.cpSync(path.join(__dirname,'native-runtime/driver'),path.join(staging,'backend-bin/driver'),{recursive:true});
const initial=JSON.parse(fs.readFileSync(path.join(__dirname,'build/factory-presets.json'),'utf8'));
initial.configs=initial.configs.filter(c=>c.isPreset);
if(!initial.configs.some(c=>c.id===initial.selected))initial.selected=initial.configs.find(c=>c.name==='Deep Voice')?.id||initial.configs[0].id;
fs.writeFileSync(path.join(staging,'initial.json'),JSON.stringify(initial,null,2));
console.log('Staged direct microphone engine and signed driver components. GG app is not required.');

require('./build/prepare-installer.cjs')();
