const {spawn}=require('child_process');
const readline=require('readline');
class NativeClient{
 constructor(executable,log,mode='independent'){
  const launched=Date.now();this.next=0;this.pending=new Map();this.closed=false;
  this.process=spawn(executable,[mode==='gg'?'--gg-capture-server':mode==='independent'?'--independent-server':'--exclusive-server'],{windowsHide:true,stdio:['pipe','pipe','pipe']});
  this.ready=new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{this.closed=true;this.process.kill();reject(Error('Microphone engine startup timed out.'));},15000);
   const lines=readline.createInterface({input:this.process.stdout});
   lines.on('line',line=>{try{const response=JSON.parse(line);if(response.ready){clearTimeout(timer);log({kind:'native-ready',ms:Date.now()-launched,mode});resolve(response);}else {const request=this.pending.get(response.id);if(request){clearTimeout(request.timer);this.pending.delete(response.id);response.ok?request.resolve(response):request.reject(Error(response.error));}}}catch(error){log({kind:'native-response-error',message:error.message});}});
   this.process.once('error',error=>{clearTimeout(timer);this.closed=true;reject(error);});
   this.process.once('exit',(code)=>{clearTimeout(timer);this.closed=true;reject(Error('Microphone engine exited ('+code+'). '+(mode==='gg'?'Keep SteelSeries GG/Sonar running for ClearCast.':mode==='independent'?'Check the selected input and YappGG Microphone driver.':'Microphone components are unavailable. Open Settings and choose Repair microphone.')));for(const request of this.pending.values()){clearTimeout(request.timer);request.reject(Error('Microphone engine stopped.'));}this.pending.clear();});
  });
  this.process.stderr.on('data',chunk=>log({kind:'native',message:chunk.toString().slice(0,4000)}));
 }
 async command(command,values={}){await this.ready;if(this.closed)throw Error('Microphone engine is closed.');const id=++this.next;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('Microphone command timed out: '+command));},20000);this.pending.set(id,{resolve,reject,timer});this.process.stdin.write(JSON.stringify({id,command,...values})+'\n');});}
 async close(){if(this.closed)return;this.process.stdin.end();await Promise.race([new Promise(resolve=>this.process.once('exit',resolve)),new Promise(resolve=>setTimeout(resolve,4000))]);if(!this.closed)this.process.kill();}
}
module.exports=NativeClient;
