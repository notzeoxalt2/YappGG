const {spawn}=require('child_process'),readline=require('readline');
class MediaDecodeWorker{
 constructor(executable){this.executable=executable;this.serial=0;}
 decode(input,target,{signal}={}){
  signal?.throwIfAborted();if(this.pending)return Promise.reject(Error('Media decoder is busy.'));
  clearTimeout(this.idle);
  if(!this.process){const child=this.process=spawn(this.executable,['--decode-worker'],{windowsHide:true,stdio:['pipe','pipe','ignore']});
   readline.createInterface({input:child.stdout}).on('line',line=>{let value;try{value=JSON.parse(line);}catch{return;}const pending=this.pending;if(!pending||value.id!==pending.id)return;this.pending=null;pending.clean();value.error?pending.reject(Error(value.error)):pending.resolve(value.metadata);this.idle=setTimeout(()=>this.close(),5000);});
   const fail=error=>{if(this.process!==child)return;this.process=null;const pending=this.pending;if(pending){this.pending=null;pending.clean();pending.reject(error);}};
   child.on('error',fail);child.on('exit',()=>fail(Error('Media decoder stopped.')));
  }
  const child=this.process,id=++this.serial;
  return new Promise((resolve,reject)=>{const abort=()=>{this.pending=null;signal.removeEventListener('abort',abort);this.process=null;child.once('close',()=>reject(signal.reason));child.kill();};const clean=()=>signal?.removeEventListener('abort',abort);this.pending={id,resolve,reject,clean};signal?.addEventListener('abort',abort,{once:true});child.stdin.write(JSON.stringify({id,input,target})+'\n');});
 }
 close(){clearTimeout(this.idle);if(this.pending)return;const child=this.process;this.process=null;child?.stdin.end();}
}
module.exports={MediaDecodeWorker};
