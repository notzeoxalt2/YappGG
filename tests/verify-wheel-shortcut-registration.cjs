const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const text=fs.readFileSync('host/main.cjs','utf8'),start=text.indexOf('function registerSoundboardShortcuts(){'),end=text.indexOf('\nasync function soundboardCommand',start),registered=[];
const context={soundboardShortcuts:new Set(),globalShortcut:{unregister(){},register(key){if(key==='Control+Alt+S')return false;registered.push(key);return true;}},verify:false,boardShortcutKeys:()=>({stop:'Control+Alt+S',pause:'Control+Alt+P',wheel:'Alt+Shift+`'}),audioPreferences:{},soundboard:{items:[]},wheel:{},audioStatus:{},sendAudio(){}};
vm.runInNewContext(text.slice(start,end)+';try{registerSoundboardShortcuts();}catch(error){failure=error.message;}',context);
assert(registered.includes('Alt+Shift+`'));assert(registered.includes('Control+Alt+P'));assert(context.failure.includes('already in use'));
console.log('PASS: a busy stop key does not prevent wheel and pause registration. Mocked shortcuts only.');
