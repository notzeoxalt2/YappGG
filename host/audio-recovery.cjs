const transientAudioError = message => /80010012|RPC_E_SERVER_DIED|800706ba|80010108|88890004|device.*invalidat|microphone engine (stopped|closed|exited|startup timed out)|microphone capture stalled|selected microphone is disconnected|virtual microphone.*unavailable|microphone stream did not start|YappGG Troll audio endpoint|88890010|8889000f|audio service.*not running/i.test(String(message));
class AudioRecovery {
 constructor({reconnect,report,log,enabled,delays=[500,1000,2000,4000,8000]}){Object.assign(this,{reconnect,report,log,enabled,delays});this.generation=0;this.active=false;this.exhausted=false;}
 cancel(){this.generation++;this.active=false;this.exhausted=false;clearTimeout(this.timer);}
 handle(error){
  const message=error?.message||String(error);if(!transientAudioError(message)||!this.enabled())return false;
  if(this.active||this.exhausted)return true;
  this.active=true;const generation=++this.generation;
  this.log({kind:'audio-recovery',error:message});
  this.report({running:false,recording:false,error:'Audio connection interrupted. Reconnecting…'});
  const attempt=async index=>{
   if(generation!==this.generation||!this.enabled())return;
   try{await this.reconnect(()=>generation===this.generation&&this.enabled());if(generation!==this.generation)return;this.active=false;this.log({kind:'audio-recovered',attempt:index+1});}
   catch(error){if(generation!==this.generation)return;this.log({kind:'audio-recovery-failed',attempt:index+1,error:error.message});if(index+1<this.delays.length)this.timer=setTimeout(()=>attempt(index+1),this.delays[index+1]);else{this.active=false;this.exhausted=true;this.report({running:false,recording:false,error:'Could not reconnect the microphone. Check your device, then press Retry.'});}}
  };
  this.timer=setTimeout(()=>attempt(0),this.delays[0]);return true;
 }
}
module.exports={AudioRecovery,transientAudioError};
