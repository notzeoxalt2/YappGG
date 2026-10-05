const {app}=require('electron'),fs=require('fs'),path=require('path'),vm=require('vm');
app.whenReady().then(async()=>{
 const reports=path.resolve(__dirname,'../../reports'),data=fs.mkdtempSync(path.join(reports,'helper-survival-')),module={exports:{}};
 // Stop the real script before its installer/UAC branch. This fixture only
 // proves readiness and survival after the calling Electron process exits.
 const fixtureFs={...fs,writeFileSync(file,value,...args){if(String(file).endsWith('install.ps1'))value=value.slice(0,value.indexOf(' $deadline='))+" while(Get-Process -Id $ParentPid -ErrorAction SilentlyContinue){Start-Sleep -Milliseconds 100}\n Set-Content -LiteralPath ($ResultFile+'.parent-exited') -Value 'survived'\n return\n} catch { throw }\n";return fs.writeFileSync(file,value,...args);}};
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../host/update-install.cjs'),'utf8'),{module,require:name=>name==='fs'?fixtureFs:require(name),process,setTimeout,Buffer});
 const file=path.join(data,'inert.exe');fs.writeFileSync(file,'Never launched.');let report;
 try{await module.exports.launchInstaller({app,data,file,version:'0.7.8'});report={passed:true,readyBeforeQuit:true,survivalMarker:path.join(data,'update-install-result.json.parent-exited'),noInstallerLaunched:true,noAudio:true};}catch(error){report={passed:false,error:error.message,noInstallerLaunched:true};}
 fs.writeFileSync(path.join(reports,'update-helper-test.json'),JSON.stringify(report,null,2));app.exit(report.passed?0:1);
});
