const assert=require('assert'),{EventEmitter}=require('events'),fs=require('fs'),os=require('os'),path=require('path');
const {Updates}=require('../host/updates.cjs');
(async()=>{
 const data=fs.mkdtempSync(path.join(os.tmpdir(),'yappgg-updates-')),updater=new EventEmitter();let calls=0,installed=false,prepared=false;
 updater.checkForUpdates=async()=>{calls++;updater.emit('checking-for-update');updater.emit('update-available',{version:'0.5.2'});};
 updater.quitAndInstall=(silent,run)=>{assert.equal(silent,false);assert.equal(run,true);installed=true;};
 const updates=new Updates({updater,app:{getVersion:()=> '0.5.1'},data,beforeInstall:()=>prepared=true});
 assert.equal(updater.autoDownload,true);assert.equal(updater.autoInstallOnAppQuit,false);
 await updates.check();await updates.check();assert.equal(calls,1);
 updater.emit('download-progress',{percent:42.7});assert.equal(updates.state.percent,43);
 updater.emit('update-downloaded',{version:'0.5.2'});assert.equal(updates.state.status,'ready');assert.equal(installed,false);
 updates.command('enabled',{enabled:false});assert.equal(JSON.parse(fs.readFileSync(path.join(data,'updates.json'))).enabled,false);
 updates.command('install');assert(installed&&prepared);
 updater.emit('error',Error('secret technical failure'));assert(!updates.state.message.includes('secret'));
 updates.dispose();console.log('PASS: background download, no forced restart, progress, preferences and explicit install.');
})().catch(error=>{console.error(error);process.exitCode=1;});
