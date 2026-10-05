class MicBootstrap{
 constructor({connect,enabled,onError}){Object.assign(this,{connect,enabled,onError});this.generation=0;this.pending=null;}
 start(){if(this.pending)return this.pending;if(!this.enabled())return Promise.resolve();const generation=++this.generation;const pending=Promise.resolve().then(()=>{const isCurrent=()=>generation===this.generation&&this.enabled();return isCurrent()?this.connect(isCurrent):undefined;}).catch(this.onError);this.pending=pending;pending.finally(()=>{if(this.pending===pending)this.pending=null;});return pending;}
 wait(){return this.pending||Promise.resolve();}
 cancel(){this.generation++;}
}
module.exports={MicBootstrap};
