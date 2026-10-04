/* Rewritten GG platform dependencies. Original microphone UI is untouched. */
globalThis.__actions=[];
globalThis.__renderError=null;
globalThis.__persistenceError=null;
window.addEventListener('error',e=>{window.__renderError={message:e.message,stack:e.error?.stack};});
window.addEventListener('unhandledrejection',e=>{window.__renderError={message:String(e.reason),stack:e.reason?.stack};});
const noOp=()=>{};
const apiProxy=new Proxy({}, {get:(_,key)=>new Proxy(function(){
  if(String(key).startsWith('register')||String(key).startsWith('on'))return noOp;
  if(key==='cachedCoreProps')return {};
  if(key==='getGGApiAuthToken')return '';
  if(key==='getGlobal')return {};
  if(key==='isDevelopment'||key==='isMaximized')return false;
  return Promise.resolve({});
},{get:(_,method)=>{
  if(method==='platform')return ()=> 'win32';
  if(method==='isMainWindow')return true;
  if(method==='getGlobal')return ()=>({});
  if(method==='isMaximized'||method==='isDevelopment')return ()=>false;
  if(String(method).startsWith('register')||String(method).startsWith('on'))return ()=>noOp;
  return (...args)=>{window.micHost.log({kind:'platform',method,args});return Promise.resolve({});};
}})});
window.api=apiProxy;window.lib=apiProxy;window.nativeModules=apiProxy;window.handlers=apiProxy;

let state={
  app:{settings:{},isWindowFocused:true,activeApplication:'Sonar',applicationStarted:true},
  soundstage:{
    configs:{configs:{chatCapture:{}},selectedConfigs:{chatCapture:{}},configsFetched:true,selectedConfigFetched:true,activeConfigModal:null,activeConfig:null,isBrowseModalOpen:false,options:{chatCapture:{}},saveToCloudInProgress:false},
    acousticEchoCanceling:{aec:[],popper:{isOpen:false}},
    audioSamples:{audioSamples:{chatCapture:[]},selectedAudioSamples:{chatCapture:null},isPlaying:{chatCapture:false}},
    features:{},settings:{},audioDevices:[],deviceOut:{},recording:{},redirections:{},status:{},quickSet:{isEnabled:false,loadouts:[],selectedLoadout:null},keyboardShortcuts:{},fallback:{},mode:{mode:'classic'}
  }
};
const listeners=new Set();
function mergeSettings(target,patch){
  for(const [key,value] of Object.entries(patch||{})){
    if(value&&typeof value==='object'&&!Array.isArray(value)){if(!target[key]||typeof target[key]!=='object')target[key]={};mergeSettings(target[key],value);}
    else target[key]=value;
  }
  return target;
}
let saveTimer;
let applyTimer,lastApplied;
globalThis.__audioStatus={running:false,inputPeak:0,outputPeak:0};
function receiveAudio(status){const wasRunning=__audioStatus.running;globalThis.__audioStatus=status;window.dispatchEvent(new CustomEvent('mic-audio-status',{detail:status}));if(wasRunning!==status.running){const next=structuredClone(state);if(next.soundstage.micMonitoring)next.soundstage.micMonitoring.isRecording=!!status.recording;updateState(next);}}
micHost.onAudio(receiveAudio);
globalThis.__connectAudio=async inputId=>{try{const status=await micHost.audio('connect',{inputId,data:state.soundstage.configs.selectedConfigs.chatCapture.data});receiveAudio(status);return status;}catch(error){receiveAudio({...__audioStatus,running:false,error:error.message});}};
function applyAudio(){if(__micInitial?.audioStatus==='verification')return;clearTimeout(applyTimer);applyTimer=setTimeout(()=>{const data=state.soundstage.configs.selectedConfigs.chatCapture.data,encoded=JSON.stringify(data);if(encoded===lastApplied)return;micHost.audio('apply',{data}).then(()=>{lastApplied=encoded;}).catch(error=>receiveAudio({...__audioStatus,error:error.message}));},75);}
let playback;
function playSample(){
 const samples=state.soundstage.audioSamplePlayer.chatCapture.samples,sample=samples['mic-test'];if(!sample)return;
 if(playback&&!playback.paused){playback.pause();sample.isPlaying=false;updateState(structuredClone(state));return;}
 playback=new Audio(sample.url);playback.onended=()=>{const next=structuredClone(state);next.soundstage.audioSamplePlayer.chatCapture.samples['mic-test'].isPlaying=false;updateState(next);};playback.play().then(()=>{const next=structuredClone(state);next.soundstage.audioSamplePlayer.chatCapture.samples['mic-test'].isPlaying=true;updateState(next);}).catch(error=>receiveAudio({...__audioStatus,error:error.message}));
}
function persist(){
  clearTimeout(saveTimer);
  saveTimer=setTimeout(()=>window.micHost.save({configs:Object.values(state.soundstage.configs.configs.chatCapture),selected:state.soundstage.configs.selectedConfigs.chatCapture?.id}).catch(error=>{window.__persistenceError=error.message;window.micHost.log({kind:'save-error',message:error.message});}),150);
}
function updateState(next){state=next;listeners.forEach(fn=>fn());}
const store={getState:()=>state,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},dispatch:action=>{
  window.__actions.push(action);window.micHost.log({kind:'dispatch',action});
  if(typeof action==='function')return action(store.dispatch,store.getState);
  if(action.type==='SOUNDSTAGE_START_RECORDING'||action.type==='SOUNDSTAGE_STOP_RECORDING'){
   const start=action.type==='SOUNDSTAGE_START_RECORDING';
   micHost.audio(start?'record-start':'record-stop').then(result=>{const next=structuredClone(state);next.soundstage.micMonitoring.isRecording=start;if(!start)next.soundstage.audioSamplePlayer.chatCapture.samples={'mic-test':{id:'mic-test',isPlaying:false,url:'file:///'+result.path.replaceAll('\\','/')+'?t='+Date.now()}};updateState(next);}).catch(error=>receiveAudio({...__audioStatus,error:error.message}));return action;
  }
  if(action.type==='SONAR_ACTIVATE_AUDIO_SAMPLE'){playSample();return action;}
  if(action.type==='SONAR_STOP_AUDIO_PLAYERS'){if(playback&&!playback.paused){playback.pause();const next=structuredClone(state);const sample=next.soundstage.audioSamplePlayer.chatCapture.samples['mic-test'];if(sample)sample.isPlaying=false;updateState(next);}return action;}
  const handled=new Set(['SOUNDSTAGE_SELECT_CONFIG','SOUNDSTAGE_UPDATE_CONFIG_DATA','SOUNDSTAGE_SET_ACTIVE_CONFIG_MODAL','SOUNDSTAGE_SET_ACTIVE_CONFIG','SOUNDSTAGE_SET_IS_BROWSE_MODAL_OPEN','SONAR_SET_IS_FAVORITE_CONFIG','SONAR_SET_FAVORITE_CONFIG_POSITION','SOUNDSTAGE_SAVE_CONFIG','SONAR_UPDATE_SELECTED_CONFIG','SOUNDSTAGE_CREATE_NEW_CONFIG','SOUNDSTAGE_IMPORT_NEW_CONFIG','SOUNDSTAGE_DELETE_CONFIG','SONAR_REMOVE_CONFIG_NEW_TAG','SOUNDSTAGE_IMPORT_CONFIG_RESET','SOUNDSTAGE_SAVE_CONFIG_TO_CLOUD_RESET','SOUNDSTAGE_SAVE_CONFIG_TO_CLOUD','SOUNDSTAGE_GET_CONFIG_FROM_HASH']);
  if(!handled.has(action.type))return action;
  const next=structuredClone(state),c=next.soundstage.configs;
  if(action.type==='SOUNDSTAGE_SELECT_CONFIG')c.selectedConfigs.chatCapture=c.configs.chatCapture[action.configId];
  if(action.type==='SOUNDSTAGE_UPDATE_CONFIG_DATA'){
    const config=c.configs.chatCapture[action.config.id];
    for(const [key,value] of Object.entries(action.updateValues||{})){const parts=key.split('.');let current=config.data;for(const part of parts.slice(0,-1))current=current[part]??=( {} );const last=parts.at(-1);if(value&&typeof value==='object'&&!Array.isArray(value))mergeSettings(current[last]??={},value);else current[last]=value;}
    c.selectedConfigs.chatCapture=config;
  }
  if(action.type==='SOUNDSTAGE_SET_ACTIVE_CONFIG_MODAL')c.activeConfigModal=action.modal;
  if(action.type==='SOUNDSTAGE_SET_ACTIVE_CONFIG')c.activeConfig=action.activeConfig;
  if(action.type==='SOUNDSTAGE_SET_IS_BROWSE_MODAL_OPEN')c.isBrowseModalOpen=action.isOpen;
  if(action.type==='SONAR_SET_IS_FAVORITE_CONFIG')c.configs.chatCapture[action.id].isFavorite=action.isFavorite;
  if(action.type==='SONAR_SET_FAVORITE_CONFIG_POSITION')c.configs.chatCapture[action.id].favoritePosition=action.favoritePosition;
  if(action.type==='SOUNDSTAGE_SAVE_CONFIG'||action.type==='SONAR_UPDATE_SELECTED_CONFIG'){
    const config=structuredClone(action.config);c.configs.chatCapture[config.id]=config;
    if(c.selectedConfigs.chatCapture.id===config.id)c.selectedConfigs.chatCapture=config;
  }
  if(action.type==='SOUNDSTAGE_CREATE_NEW_CONFIG'||action.type==='SOUNDSTAGE_IMPORT_NEW_CONFIG'){
    const name=String(action.name||'').trim();if(!name||name.length>128)return action;
    const id=crypto.randomUUID(),data=structuredClone(action.data||c.selectedConfigs.chatCapture.data);
    const config={id,name,isPreset:false,isFavorite:false,favoritePosition:-1,virtualAudioDevice:'chatCapture',data,defaultData:structuredClone(data),schemaVersion:action.schemaVersion||6,image:action.image||'sonar.svg',isNew:false};
    c.configs.chatCapture[id]=config;c.selectedConfigs.chatCapture=config;c.activeConfigModal=null;c.activeConfig=null;
  }
  if(action.type==='SOUNDSTAGE_DELETE_CONFIG'){
    const config=c.configs.chatCapture[action.configId];
    if(config&&!config.isPreset&&Object.keys(c.configs.chatCapture).length>1){delete c.configs.chatCapture[action.configId];if(c.selectedConfigs.chatCapture.id===action.configId)c.selectedConfigs.chatCapture=Object.values(c.configs.chatCapture)[0];}
    c.activeConfigModal=null;c.activeConfig=null;
  }
  if(action.type==='SONAR_REMOVE_CONFIG_NEW_TAG'&&c.configs.chatCapture[action.config.id])c.configs.chatCapture[action.config.id].isNew=false;
  if(action.type==='SOUNDSTAGE_IMPORT_CONFIG_RESET')c.importConfigError=null;
  if(action.type==='SOUNDSTAGE_SAVE_CONFIG_TO_CLOUD_RESET'){c.saveToCloudError=null;c.saveToCloudInProgress=false;}
  if(action.type==='SOUNDSTAGE_SAVE_CONFIG_TO_CLOUD')c.saveToCloudError='Cloud sharing is unavailable in this local app. Use Export presets in the app menu.';
  if(action.type==='SOUNDSTAGE_GET_CONFIG_FROM_HASH')c.importConfigFromHashError='Cloud preset links require GG. Import your installed GG presets using the app menu.';
  if(JSON.stringify(next)===JSON.stringify(state))return action;
  updateState(next);
  if(/CONFIG/.test(action.type)&&!/MODAL|BROWSE|FETCH|CLOUD|HASH/.test(action.type))persist();
  if(['SOUNDSTAGE_SELECT_CONFIG','SOUNDSTAGE_UPDATE_CONFIG_DATA','SOUNDSTAGE_SAVE_CONFIG','SONAR_UPDATE_SELECTED_CONFIG','SOUNDSTAGE_CREATE_NEW_CONFIG','SOUNDSTAGE_IMPORT_NEW_CONFIG','SOUNDSTAGE_DELETE_CONFIG'].includes(action.type))applyAudio();
  return action;
}};
globalThis.__micStore=store;
const language=__LOCALE__;
function brandLabels(value){for(const key of Object.keys(value)){if(value[key]&&typeof value[key]==='object')brandLabels(value[key]);else if(value[key]==='SteelSeries')value[key]='YappGG';}}
brandLabels(language.locale);
const localized={getText:key=>{
  const options=typeof key==='object'?key:{key};
  let result=options.key.split('.').reduce((v,k)=>v?.[k],language.locale);
  if(typeof result!=='string')result=options.key;
  if(globalThis.__micInitial?.audioPreferences.engineMode==='independent'){
    if(options.key==='soundstage.micNoiseCanceling.label')result='Voice cleanup';
    else if(options.key==='soundstage.micNoiseCanceling.tooltip')result='Reduces quiet background noise with adaptive expansion. Independent mode uses YappGG processing rather than ClearCast.';
    else result=result.replace(/Clearcast AI noise cancellation/gi,'voice cleanup').replace(/ClearCast AI Noise Cancellation/gi,'voice cleanup');
  }
  return (options.prefix||'')+result+(options.suffix||'');
},getLocale:()=> 'en_US',getLocaleIso:()=> 'en_US',locale:language.locale};
const overrides={
  48344:(module,exports,require)=>{
    const React=require(96540),styled=require(38267),base=require(92018).A,colors={...base.colors};
    for(const key of Object.keys(colors)){
      const weight=Number(key.split('_').pop());
      if(/PRIMARY_PURPLE|SUPPORT_ORANGE/.test(key))colors[key]=weight>=90?'#F05A5A':weight>=50?'#D94A4A':weight>=20?'#5A2A2E':'#2A1719';
      else if(key==='BRAND_ORANGE')colors[key]='#D94A4A';
    }
    const replacements=new Map(Object.keys(colors).map(key=>[base.colors[key].toUpperCase(),colors[key]]));
    const recolor=value=>typeof value==='string'?(replacements.get(value.toUpperCase())||value):Array.isArray(value)?value.map(recolor):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,recolor(v)])):value;
    const theme={...recolor(base),colors},mui=require(1642).A({...require(38391).LY,palette:{mode:'dark',primary:{main:'#D94A4A'},background:{default:'#232a30',paper:'#2d343c'},text:{primary:'#c5cee7',secondary:'#8b98ae'}},typography:{...require(38391).LY.typography,fontFamily:'Inter, Segoe UI, sans-serif'}});
    exports.A=({children})=>React.createElement(styled.ID,{shouldForwardProp:(key,target)=>typeof target!=='string'||require(29247).A(key)},React.createElement(styled.NP,{theme},React.createElement(require(93688).A,{theme:mui},React.createElement(require(12813).aH,{localizedText:localized},children))));
  },
  49665:(module,exports)=>Object.assign(exports,{Ye:({children})=>children,jt:()=>noOp,_A:noOp}),
  26342:(module,exports)=>{Object.assign(exports,{getStore:()=>store,setStore:noOp,createStore:()=>store});},
  95882:(module,exports)=>{Object.assign(exports,{__esModule:true,default:localized,...localized});},
  94542:(module,exports,require)=>{
    const React=require(96540);
    for(const [key,id] of Object.entries({C8:72257,NR:50442,Uj:82337,Ur:26765,i3:93327,iD:3983,xk:48076}))exports[key]=require(id).A;
    exports.Jb=require(65794).J;exports.Xo=require(65794).X;
    const useSetting=(key,fallback)=>{
      const [value,setValue]=React.useState(()=>{if(key.includes('Onboarding')||key.includes('onboarding'))return true;try{const stored=localStorage.getItem('mic:'+key);return stored===null?fallback:JSON.parse(stored);}catch{return fallback;}});
      return [value,next=>{setValue(next);localStorage.setItem('mic:'+key,JSON.stringify(next));}];
    };
    exports.Vc=useSetting;exports.ZC=require(66048).A;
    exports.$f=({children})=>children;
  }
};
const chunks=globalThis.webpackChunksteelseriesengine3_client=[];
const push=chunks.push.bind(chunks);
chunks.push=function(item){for(const id of Object.keys(overrides))if(item[1][id])item[1][id]=overrides[id];return push(item);};
globalThis.__moduleOverrides=overrides;
globalThis.__initializeMic=async()=>{
  const initial=await window.micHost.initial();
  globalThis.__micInitial=initial;
  const defaults=window.__ggRequire(91726).A(undefined,{type:'@@MIC_INITIALIZE'});
  state={...defaults,app:{...defaults.app,...state.app},soundstage:{...defaults.soundstage,configs:state.soundstage.configs,acousticEchoCanceling:state.soundstage.acousticEchoCanceling,quickSet:state.soundstage.quickSet}};
  const next=structuredClone(state);
  next.soundstage.configs.configs.chatCapture=Object.fromEntries(initial.configs.map(c=>[c.id,c]));
  next.soundstage.configs.selectedConfigs.chatCapture=next.soundstage.configs.configs.chatCapture[initial.selected];
  next.soundstage.acousticEchoCanceling.aec=initial.configs.map(c=>({id:c.id,state:c.data.acousticEchoCancelingState,isSync:true}));
  updateState(next);
  if(initial.audioStatus!=='verification')__connectAudio(initial.audioPreferences.inputId);
};
