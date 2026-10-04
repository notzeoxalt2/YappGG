const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const root=path.resolve(__dirname,'..'),electron=path.join(root,'node_modules/electron/dist/electron.exe');
const work=path.resolve(root,'../original-mic-data/discord-setup-work/verify-'+Date.now());
const storage=path.join(work,'profile','Local Storage');
fs.mkdirSync(storage,{recursive:true});fs.cpSync(path.join(process.env.APPDATA,'discord','Local Storage','leveldb'),path.join(storage,'leveldb'),{recursive:true});
function run(args){execFileSync(electron,args,{windowsHide:true,timeout:45000,stdio:'pipe'});}
function inspect(){const report=path.join(work,'inspection.json');run([path.join(__dirname,'inspect-discord-voice.cjs'),'--storage',storage,'--report',report]);return JSON.parse(fs.readFileSync(report))[0].values;}
function update(){run([path.join(root,'host/main.cjs'),'--discord-enhance-worker','--work-dir',work]);return JSON.parse(fs.readFileSync(path.join(work,'result.json')));}
const original=inspect(),applied=update(),persisted=inspect();
fs.writeFileSync(path.join(work,'restore.json'),JSON.stringify(applied.before));
const reverted=update(),restored=inspect();
const report={applied,reverted,persisted,restored,
  passed:applied.configured&&applied.preservedOtherSettings&&reverted.restored&&reverted.preservedOtherSettings
    &&persisted.noiseSuppression===false&&persisted.automaticGainControl===false&&persisted.modeOptions.autoThreshold===false
    &&persisted.modeOptions.vadUseKrisp===false&&persisted.modeOptions.threshold===-70&&JSON.stringify(original)===JSON.stringify(restored)};
fs.writeFileSync(path.resolve(root,'../reports/discord-setup-test.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({passed:report.passed}));if(!report.passed)process.exitCode=1;
