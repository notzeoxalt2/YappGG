const assert=require('assert/strict'),fs=require('fs'),os=require('os'),path=require('path'),{configure}=require('../host/installation-preferences.cjs');
(async()=>{const data=fs.mkdtempSync(path.join(os.tmpdir(),'yappgg-install-')),calls=[];
const options={data,trace(){},setStartup:async()=>calls.push('startup'),backend:async arg=>{calls.push(arg);throw Error('Mic unavailable until reboot');},enhanceDiscord:async()=>{calls.push('enhance');throw Error('Discord not installed');},args:['--install-preferences','--discord-setup','--enhance-discord']};
const result=await configure(options);assert.equal(result.length,3);assert(result[0].ok&&!result[1].ok&&!result[2].ok);assert.deepEqual(calls,['startup','--discord-setup','enhance']);assert(fs.readFileSync(path.join(data,'installation-setup-error.json'),'utf8').includes('Discord not installed'));
await configure({...options,backend:async()=>true,enhanceDiscord:async()=>true});assert(!fs.existsSync(path.join(data,'installation-setup-error.json')));
console.log('PASS: missing mic/Discord cannot block startup or independent optional setup; errors are recorded, success clears them. No installation, Discord changes or UI.');
})().catch(error=>{console.error(error);process.exitCode=1;});
