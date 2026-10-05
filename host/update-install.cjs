const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawn}=require('child_process');
const script=`param([int]$ParentPid,[string]$Installer,[string]$Application,[string]$ExpectedVersion,[string]$ResultFile,[string]$ReadyFile)
$ErrorActionPreference='Stop'
function Save-Result($Status,$Message){@{status=$Status;message=$Message;version=$ExpectedVersion;time=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath $ResultFile -Encoding UTF8}
try {
 if (!(Test-Path -LiteralPath $Installer -PathType Leaf)) {throw 'The downloaded installer is missing.'}
 Save-Result 'starting' 'Preparing the downloaded update.'
 Set-Content -LiteralPath $ReadyFile -Value 'ready'
 $deadline=[DateTime]::UtcNow.AddSeconds(30)
 while(Get-Process -Id $ParentPid -ErrorAction SilentlyContinue){if([DateTime]::UtcNow -gt $deadline){throw 'YappGG did not close. Please close it and retry.'};Start-Sleep -Milliseconds 200}
 Save-Result 'installing' 'Approve the Windows administrator prompt to install the update.'
 $setup=Start-Process -FilePath $Installer -ArgumentList '/S','--updated','--force-run' -Verb RunAs -WindowStyle Hidden -PassThru
 $setup.WaitForExit()
 if($setup.ExitCode -ne 0){throw ('The installer exited with code '+$setup.ExitCode+'.')}
 $actual=(Get-Item -LiteralPath $Application).VersionInfo.ProductVersion
 if($actual -ne $ExpectedVersion -and $actual -ne ($ExpectedVersion+'.0')){throw ('Installation finished but the app is still version '+$actual+'.')}
 Save-Result 'installed' ('Updated successfully to YappGG '+$ExpectedVersion+'.')
 Start-Process -FilePath $Application
} catch {
 Save-Result 'failed' ('Update did not finish: '+$_.Exception.Message+' Your previous version is still available. Retry from Settings or use the release installer.')
 if(Test-Path -LiteralPath $Application){Start-Process -FilePath $Application}
}
`;
async function verifyInstaller(file,sha512){if(!file||!sha512)throw Error('Download the update again before installing.');const digest=crypto.createHash('sha512');for await(const chunk of fs.createReadStream(file))digest.update(chunk);if(digest.digest('base64')!==sha512)throw Error('The downloaded installer failed verification. Check for updates to download it again.');}
async function launchInstaller({app,data,file,version}){const directory=path.join(data,'update-install');fs.mkdirSync(directory,{recursive:true});const scriptFile=path.join(directory,'install.ps1'),ready=path.join(directory,'ready'),result=path.join(data,'update-install-result.json');fs.rmSync(ready,{force:true});fs.writeFileSync(scriptFile,script,'utf8');const systemRoot=process.env.SystemRoot||'C:\\Windows';const powershell=path.join(systemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),args=['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',scriptFile,'-ParentPid',String(process.pid),'-Installer',file,'-Application',app.getPath('exe'),'-ExpectedVersion',version,'-ResultFile',result,'-ReadyFile',ready];const quote=value=>"'"+value.replace(/'/g,"''")+"'",argumentsText=args.map(value=>'"'+value+'"').join(' '),launch="$ErrorActionPreference='Stop'; Start-Process -FilePath "+quote(powershell)+" -ArgumentList "+quote(argumentsText)+" -WindowStyle Hidden | Out-Null";const child=spawn(powershell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(launch,'utf16le').toString('base64')],{detached:false,windowsHide:true,stdio:'ignore'});let failure;child.on('error',error=>failure=error);child.on('exit',code=>{if(code!==0)failure=Error('Windows could not launch the update helper (exit '+code+'). Try the release installer.');});const until=Date.now()+8000;while(!fs.existsSync(ready)){if(failure)throw failure;if(Date.now()>until)throw Error('Windows did not start the update installer. Try again or use the release installer.');await new Promise(resolve=>setTimeout(resolve,100));}child.unref();}
module.exports={verifyInstaller,launchInstaller};
