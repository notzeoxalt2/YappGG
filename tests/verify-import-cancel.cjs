const fs=require('fs'),os=require('os'),path=require('path'),assert=require('assert/strict');
const {SoundboardLibrary}=require('../host/soundboard-library.cjs'),{ImportInbox}=require('../host/import-inbox.cjs');
(async()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'yappgg-cancel-'));try{
 const files=['one.wav','two.wav','three.wav'].map(name=>{const file=path.join(root,name);fs.writeFileSync(file,'fixture');return file;});let started,ready=new Promise(r=>started=r),decodes=0;
 const library=new SoundboardLibrary(path.join(root,'library'),async(input,target,{signal})=>{fs.writeFileSync(target,'partial');if(++decodes===2){started();await new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));}return {durationSeconds:1};});
 const pending=library.import(files);await ready;assert(library.cancelImport());const result=await pending;
 assert(result.cancelled);assert.equal(result.imported,1);assert.equal(result.skipped.length,0);assert.equal(decodes,2);assert.equal(library.items.length,1);
 assert.equal(fs.readdirSync(library.directory).filter(f=>f.endsWith('.wav')).length,1);assert.equal(new SoundboardLibrary(library.directory,()=>{}).items.length,1);assert(!library.importStatus().running);
 library.decode=async(_,target)=>{fs.writeFileSync(target,'fixture');return {durationSeconds:1};};assert.equal((await library.import([files[2]])).imported,1);
 let saves=0;const persist=library.persist.bind(library);library.persist=()=>{saves++;persist();};assert.equal((await library.import(Array(100).fill(files[0]))).imported,100);assert(saves<=15,'Library index should checkpoint batches, not every file');
 let inboxImports=0;const inbox=new ImportInbox({directory:path.join(root,'inbox'),importFiles:async()=>{inboxImports++;return {imported:1};},onChange:()=>{}});fs.writeFileSync(path.join(inbox.directory,'a.wav'),'fixture');inbox.pause();await inbox.scan();assert.equal(inboxImports,0);
 const restarted=new ImportInbox({directory:inbox.directory,importFiles:inbox.importFiles,onChange:()=>{}});assert(restarted.paused);await restarted.scan({resume:true});assert.equal(inboxImports,1);inbox.close();restarted.close();
 fs.writeFileSync('../reports/import-cancel-test.json',JSON.stringify({passed:true,currentDecodeCancelled:true,completedPreserved:true,partialRemoved:true,newImportAfterCancel:true,inboxPauseSurvivesRestart:true,explicitRefreshResumes:true,indexWritesFor100Clips:saves,noPlayback:true},null,2));console.log('PASS: cancellation, partial cleanup, retained clips, batched checkpoints and persistent inbox pause.');
}finally{fs.rmSync(root,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
