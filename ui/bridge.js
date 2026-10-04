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
micHost.onPreferences(preferences=>{if(window.__micInitial){__micInitial.audioPreferences={...__micInitial.audioPreferences,...preferences};__micInitial.startupEnabled=preferences.startWithWindows??true;}});
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
const language={
  "locale": {
    "iso": "en_US",
    "aimTools": {
      "3dat": {
        "about": "About 3D Aim Trainer",
        "pageTitle": "Improve your Aim",
        "subtitle": "Pro aim training",
        "title": "3D Aim Trainer"
      },
      "addGame": {
        "button": "Add game",
        "menuTitle": "My games",
        "title": "Add a new game"
      },
      "discord": {
        "button": "JOIN DISCORD",
        "subtitle": "Exclusive content, tips, and community fun!",
        "title": "Join our Aim Community"
      },
      "ftue": {
        "button": "Get Started",
        "gameSelector": "Select Shooter",
        "gameSelectorError": "Select a game first.",
        "gameSelectorInfo": "You can add more games later.",
        "subtitle": "Find your sensitivity, train your aim, track your performance.",
        "title": "Level up your Aim Setup"
      },
      "general": {
        "alertMessageCompatibleMouseDisconnected": "Reconnect your compatible SteelSeries mouse to continue using all Aim Tools.",
        "exploreMiceText": "Get Aerox 3 Gen2",
        "lockedTileMessage": "Requires SteelSeries\n Aerox 3 Wireless"
      },
      "helpFaq": {
        "button": "HELP & FAQ"
      },
      "onboarding": {
        "3datSubtitle": "Improve your skills with drills designed for you.",
        "3datTitle": "Train your Aim",
        "engineButton": "Engine Setup",
        "engineSubtitle": "Customize your mouse in Engine.",
        "engineTitle": "Configure your mouse",
        "sensFinderSubtitle": "Play a short exercise and discover your ideal sensitivity.",
        "sensFinderTitle": "Find your best Game Sensitivity",
        "snooze": "Snooze",
        "title": "Complete your Aim Setup"
      },
      "promo": {
        "button": "Get Aerox 3 Gen2",
        "subtitle": "SteelSeries Aerox 3 Wireless unlocks all exclusive Aim Tools.",
        "title": "Unlock more Aim Tools"
      },
      "sensConverter": {
        "about": "About Sensitivity Converter",
        "advancedToggle": "Advanced",
        "copied": "Copied!",
        "copyToClipboard": "Copy to Clipboard",
        "dpiTooltip": "DPI (dots per inch) is a mouse setting that controls cursor movement distance. You can adjust your mouse DPI in Engine.",
        "onboarding": {
          "description": "Keep the same aiming feel across games with this Converter. No need to rerun the Finder per game.",
          "title": "Convert your Game Sensitivity to other games"
        },
        "origin": {
          "dpi": "Mouse DPI",
          "label": "From",
          "orDivider": "Or",
          "sensitivity": "Game Sensitivity",
          "spin": "360 SPIN"
        },
        "spinDifferenceTooltip": "There's a slight difference in 360° spin due to how each game rounds sensitivity values.",
        "spinTooltip": "Physical distance your mouse needs to travel for a full 360° turn in-game",
        "subtitle": "From game to game",
        "target": {
          "label": "To",
          "result": "Converted Game sensitivity"
        },
        "title": "Sensitivity Converter",
        "tooltip": "Convert your sensitivity value from one shooter to another"
      },
      "sensFinder": {
        "about": "About Sensitivity Finder",
        "appOpenDescription": "Close it before launching this one.",
        "appOpenTitle": "An Aim Tools app is open.",
        "copyToClipboard": "Copy Sensitivity to Clipboard",
        "pageTitle": "Set up your Game Sensitivity",
        "result": "Your sensitivity",
        "settingsInfo": "Where do I input this Sens?",
        "subtitle": "Your perfect sensitivity",
        "title": "Sensitivity Finder"
      },
      "widgets": {
        "connectedDeviceAndGameWidget": {
          "deviceDisconnectedTooltip": {
            "message": "Reconnect your compatible SteelSeries mouse to continue using all Aim Tools."
          },
          "quickSetProfileTooltip": {
            "activationMessage": "This QuickSet profile is automatically activated when you launch:",
            "activationShortcutMessage": "This QuickSet profile is activated by pressing #SHORTCUT#.\nFor a consistent feel, use it with:",
            "infoFooter": "This keeps the same mouse setup across your game and Aim Tools.",
            "infoMessage": "Edit your QuickSet profile in #PATH_LINK#."
          }
        }
      }
    },
    "bloom": {
      "audiovisualizer": {
        "amplitudeScale": {
          "title": "Amplitude Scale"
        },
        "audioSource": {
          "title": "Audio Source",
          "windowsDefault": "Windows Default"
        },
        "effectMode": {
          "dark": "Dark",
          "darkColorblind": "Deuteranopia Dark",
          "light": "Light",
          "lightColorblind": "Deuteranopia Light",
          "title": "Effect Mode"
        },
        "effectPreview": "Effect Preview",
        "mixedSelection": "Multiple effect modes selected",
        "name": "Audio Visualizer",
        "tooltip": {
          "text": "Audio Visualizer samples the audio from the selected audio source (if available) or the Windows default. On per-key keyboards, the frequency data from the audio is visualized onto the keys.  On other devices, a color is assigned based on volume."
        }
      },
      "bluetoothConnected": "Device is connected via bluetooth.  Please switch to wired or 2.4g connection to edit illumination.",
      "brandingName": "Prism",
      "configurations": {
        "addNewModal": {
          "label": "Name your new config"
        },
        "deleteModal": {
          "header": "Are you sure you want to delete?",
          "subHeader": "You will lose any settings applied to this configuration."
        },
        "renameModal": {
          "label": "Rename your config"
        },
        "saveAsModal": {
          "label": "Name your config"
        }
      },
      "dimFactor": {
        "100Brightness": "100% Brightness",
        "50Brightness": "50% Brightness",
        "lightingDisabled": "Lighting Disabled",
        "whenMonitorSleeps": "When Monitor Sleeps"
      },
      "earlyAccess": {
        "deviceSupportNote": {
          "message": "Prism is currently in Early Access and does not support all SteelSeries devices."
        },
        "faq": {
          "href": "https://support.steelseries.com/hc/en-us/articles/9693907049229",
          "linkName": "FAQ page",
          "noteLinkName": "View supported devices."
        },
        "tooltip": {
          "message": "During Early Access, not all SteelSeries devices will be supported within Prism. We will be integrating more devices in the future. Please check our #FAQLINK# to see the running list of supported devices."
        }
      },
      "noDevices": {
        "faq": {
          "href": "https://steelseries.com/engine/redirects/prism-device-support",
          "linkName": "FAQ page"
        },
        "message": "Please reconnect Prism enabled device(s) to access illumination settings. Not all SteelSeries devices are supported in Prism. Please check our #FAQLINK# to see the running list of supported devices.",
        "title": "Device Not Found"
      },
      "presets": {
        "aqua": "Aqua",
        "chasingGhosts": "Chasing Ghosts",
        "clown": "Clown",
        "colorFusion": "Color Fusion",
        "comet": "Comet",
        "disabled": "Off",
        "discoMode": "Disco Mode",
        "drain": "Drain",
        "freeway": "Freeway",
        "haze": "Haze",
        "heatmap": "Apex Pro Actuation",
        "pride": "SteelSeries Pride",
        "prism": "Prism",
        "radioactive": "Radioactive Glow",
        "rainbow": "Rainbow",
        "rainbowSplit": "Rainbow Split",
        "reactiveLine": "Line",
        "reactiveRipple": "Ripple",
        "reactiveSingleKey": "Single Key",
        "redPulse": "Red Pulse",
        "selfDestruct": "Self-Destruct",
        "shavedIce": "Shaved Ice",
        "solar": "Solar",
        "staticFade": "Static Fade",
        "steelseriesOrange": "SteelSeries Orange",
        "twilight": "Twilight",
        "vaporDreams": "Vapor Dreams",
        "wabashAndLake": "Wabash & Lake",
        "warpDrive": "Warp Drive",
        "westCoast": "West Coast"
      },
      "reflect": {
        "appConfigureButton": "Configure in Prism",
        "name": "Reflect",
        "samplingArea": {
          "mixedSelection": "Multiple sample areas selected",
          "screenExample": "Screen Example",
          "title": "Sampling Area",
          "tooltip": "Screen sampler averages the colors from the assigned sampling area on your monitor and applies that to the selected device illumination zones. Choose an illumination zone and then select a sampling area."
        }
      },
      "settings": {
        "deviceSettings": "Disable devices",
        "disableDeviceNote": "Select which devices are controlled by Prism.",
        "title": "Prism Device Settings"
      },
      "shortcuts": {
        "deviceSettings": "Device Settings",
        "moveTool": "Move tool",
        "panTool": "Hand tool",
        "panToolCopy": "Spacebar + click and drag",
        "replayIlluminationPreview": "Replay illumination preview",
        "scrollHorizontal": "Scroll horizontal",
        "scrollHorizontalCopy": "Shift + scroll wheel",
        "scrollVertical": "Scroll vertical",
        "scrollVerticalCopy": "Scroll wheel",
        "selectAll": "Select all zones",
        "selectTool": "Select tool",
        "selectionAdd": "Add to current selection",
        "selectionAddCopy": "Ctrl + click, click and drag",
        "title": "Shortcuts",
        "zoom": "Zoom",
        "zoom100": "Zoom to 100%",
        "zoom100short": "Zoom 100%",
        "zoom200short": "Zoom 200%",
        "zoom25short": "Zoom 25%",
        "zoom50short": "Zoom 50%",
        "zoomIn": "Zoom in",
        "zoomInCopy": "Ctrl + scroll up",
        "zoomOut": "Zoom out",
        "zoomOutCopy": "Ctrl + scroll down",
        "zoomToFit": "Zoom to fit"
      },
      "taskbar": {
        "configMenuTitle": "Prism configs"
      },
      "welcome": {
        "dialogTitle": "Welcome to Prism",
        "disableNote": "Prism lighting will override current device and software RGB configurations. You can enable and disable devices at any point.",
        "headline": "Lighting the Way",
        "intro": "Select which device(s) to enable in Prism: "
      }
    },
    "brawlhallapromotion": {
      "moments": {
        "enableToReceive": "Enable to receive your free apex keysword",
        "redeemBodyDescription": "Get an exclusive SteelSeries Apex Keysword by redeeming this one-time code in Brawlhalla, while supplies last.",
        "redeemBodyRequirement": "Moments auto-clips your games. You edit and share them on all your favorite social channels as you rise to the top.",
        "redeemHeader": "Free SteelSeries Apex Keysword"
      }
    },
    "common": {
      "about": "About",
      "activate": "Activate",
      "active": "Active",
      "add": "Add",
      "addNew": "Add New",
      "all": "All",
      "allFiles": "All Files",
      "animation": "Animation",
      "application": "Application",
      "apply": "Apply",
      "areYouSure": "Are you sure?",
      "assignKey": "Assign Key",
      "audio": "Audio",
      "auto": "Auto",
      "autoSync": "Auto Sync",
      "aux": "Aux",
      "back": "Back",
      "background": "Background",
      "base": "Base",
      "behavior": "Behavior",
      "beta": "Beta",
      "black": "Black",
      "blue": "Blue",
      "brightness": "Brightness",
      "button": "Button",
      "cancel": "Cancel",
      "capture": "Capture",
      "changeLocation": "Change location",
      "changeShortcut": "Change shortcut",
      "chat": "Chat",
      "chooseOne": "Choose One",
      "clear": "Clear",
      "clickToDeselect": "Click to deselect",
      "clickToSelect": "Click to select",
      "close": "Close",
      "color": "Color",
      "comingSoon": "Coming Soon",
      "complete": "complete",
      "configuration": "configuration",
      "configure": "Configure",
      "configuringEllipses": "Configuring...",
      "confirm": "Confirm",
      "connectDevice": "Connect device",
      "connected": "Connected",
      "continue": "continue",
      "contrast": "Contrast",
      "controller": "Controller",
      "controllers": "Controllers",
      "copyUrl": "Copy URL",
      "copyUrlSuccess": "Copied",
      "create": "Create",
      "cursor": "Cursor",
      "default": "Default",
      "delay": "Delay",
      "delete": "Delete",
      "description": "description",
      "deselectAll": "Deselect All",
      "desktop": "Desktop",
      "detailed": "Detailed",
      "dim": "Dim",
      "direction": "Direction",
      "disable": "Disable",
      "disabled": "Disabled",
      "discard": "Discard",
      "disconnected": "Disconnected",
      "disconnectedDevices": {
        "cardTitle": "Don't see your device? Try these steps:",
        "dialogTitle": "Don't see your device?",
        "solution1": "Restart GG.",
        "solution2": "Avoid USB hubs - connect device directly to your PC.",
        "solution3": "Try a different USB port.",
        "subtitle": "Try these steps:",
        "supportLink": "Still not seeing your device?"
      },
      "discord": {
        "join": {
          "link": "Get invite"
        }
      },
      "dismiss": "Dismiss",
      "done": "Done",
      "dongle": "Dongle",
      "dontShowThisAgain": "Don't show this again",
      "download": "Download",
      "downloading": "Downloading",
      "duplicate": "Duplicate",
      "duplicateVerb": "Duplicate",
      "earlyAccess": "Early Access",
      "edit": "Edit",
      "effect": "Effect",
      "effects": "Effects",
      "email": "Email",
      "emailAddress": "Email Address",
      "enable": "enable",
      "enabled": "Enabled",
      "error": "error",
      "export": "Export",
      "failed": "Failed",
      "faq": "Faq",
      "fast": "Fast",
      "favorites": "Favorites",
      "feedback": "Feedback",
      "filter": "filter",
      "finish": "Finish",
      "forSomething": "For #SOMETHING#",
      "forceSync": "Force Sync",
      "forgotPassword": "Forgot your password?",
      "fps": "FPS",
      "frequency": "Frequency",
      "frequencyAbbreviated": "Freq",
      "gain": "Gain",
      "game": "Game",
      "gaming": "Game",
      "getHelp": "Get help",
      "getStarted": "Get Started",
      "goBack": "Go Back",
      "green": "Green",
      "havingAnyIssues": "Having any issues?",
      "headset": "Headset",
      "headsets": "Headsets",
      "help": "Help",
      "high": "High",
      "history": "History",
      "horizontal": "Horizontal",
      "hour": "Hour",
      "hours": "Hours",
      "icon": "Icon",
      "idle": "Idle",
      "idleTimeout": "Idle Timeout",
      "ignore": "Ignore",
      "illumination": "Illumination",
      "image": "Image",
      "import": "Import",
      "inactive": "Inactive",
      "info": "Info",
      "installing": "Installing",
      "intensity": "Intensity",
      "introducing": "Introducing...",
      "keepBoth": "Keep Both",
      "keyboard": "Keyboard",
      "keyboardKey": "Key",
      "keyboards": "Keyboards",
      "layer": "Layer",
      "lcd": "LCD",
      "lcdScreen": "LCD Screen",
      "learnMore": "Learn More",
      "lengthDistance": "Length",
      "lengthMs": "Length (ms)",
      "lengthTime": "Length",
      "level": "Level",
      "lineIn": "Line In",
      "lineOut": "Line Out",
      "loading": "Loading",
      "location": "Location",
      "loginSuccessful": "Login Successful",
      "logo": "Logo",
      "logout": "Sign out",
      "logoutSuccessful": "You have been signed out",
      "long": "Long",
      "loop": "Loop",
      "loopForever": "Loop Forever",
      "low": "Low",
      "macro": "Macro",
      "manage": "Manage",
      "masterControl": "Master",
      "maximize": "Maximize",
      "media": "Media",
      "medium": "Medium",
      "meters": "Meters",
      "mice": "Mice",
      "microphone": "Microphone",
      "milliseconds": "ms",
      "minimize": "Minimize",
      "minute": "Minute",
      "minuteAbbreviated": "min",
      "minutes": "Minutes",
      "mixed": "Mixed",
      "mixer": "Mixer",
      "modify": "Modify",
      "monitor": "Monitor",
      "monitors": "Monitors",
      "moreInfo": "More Info",
      "motherboard": "Motherboard",
      "motherboards": "Motherboards",
      "mouse": "Mouse",
      "mousepad": "Mousepad",
      "mousepads": "Mousepads",
      "myAccount": "My Account",
      "name": "Name",
      "never": "Never",
      "new": "New",
      "next": "Next",
      "no": "No",
      "noAccount": "Don't have an account?",
      "noAction": "No Action",
      "noGoBack": "No, go back",
      "noInternet": "Your internet is down, please retry or come back later.",
      "none": "None",
      "notConnected": "Not Connected",
      "notNow": "Not Now",
      "off": "Off",
      "offline": "Offline",
      "offset": "Offset",
      "ok": "Okay",
      "oled": "OLED",
      "oledDisplays": "OLED Displays",
      "on": "On",
      "online": "Online",
      "open": "Open",
      "openFolder": "Open folder",
      "optimizingEllipses": "Optimizing…",
      "options": "Options",
      "orange": "Orange",
      "overwrite": "Overwrite",
      "paddle": "Paddle",
      "pairing": "Pairing",
      "password": "password",
      "pattern": "Pattern",
      "playNTimes": "Play N Times",
      "playNTimesReplace": "Play #NUM_REPEAT# Times",
      "playOnce": "Play Once",
      "preferences": "Preferences",
      "prefix": "Prefix",
      "preset": "Preset",
      "presets": "Presets",
      "privacyPolicy": "privacy policy",
      "private": "Private",
      "proceed": "Proceed",
      "public": "Public",
      "purple": "Purple",
      "radial": "Radial",
      "range": "Range",
      "reactive": "Reactive",
      "ready": "Ready",
      "recommended": "Recommended",
      "recording": "Recording",
      "recover": "Recover",
      "red": "Red",
      "refresh": "Refresh",
      "remove": "Remove",
      "rename": "Rename",
      "repeatX": "Repeat x",
      "reset": "Reset",
      "resetAll": "Reset all",
      "resetToDefault": "Reset to Default",
      "resolution": "Resolution",
      "restore": "Restore",
      "restoreDefaultLocation": "Restore default location",
      "retry": "Retry",
      "reverse": "Reverse",
      "revert": "Revert",
      "save": "Save",
      "saveAs": "Save As",
      "saving": "Saving",
      "screen": "Screen",
      "search": "Search",
      "secondsAbbreviated": "secs",
      "secondsNonAbbreviated": "seconds",
      "selectAll": "Select All",
      "selectEllipses": "Select",
      "selectUnselectAll": "Select/Unselect all",
      "set": "Set",
      "settings": "Settings",
      "share": "Share",
      "short": "Short",
      "shortcuts": "Shortcuts",
      "show": "Show",
      "signIn": "Sign In",
      "signUpNow": "Sign up now!",
      "signup": "Register now",
      "simple": "Simple",
      "single": "single",
      "size": "Size",
      "sleep": "Sleep",
      "slow": "Slow",
      "sort": "sort",
      "speakers": "Speakers",
      "speed": "Speed",
      "start": "Start",
      "startSetup": "Start Setup",
      "startingEllipses": "Starting...",
      "stat": "Stat",
      "static": "Static",
      "status": "Status",
      "steelseriesID": "SteelSeries ID",
      "step": "Step",
      "stereo": "Stereo",
      "stop": "Stop",
      "streaming": "Streaming",
      "submit": "Submit",
      "suffix": "Suffix",
      "switch": "Switch",
      "syncUp": "Sync Up.",
      "takeSurvey": "take survey",
      "team": "Team",
      "text": "Text",
      "theme": "Theme",
      "threshold": "Threshold",
      "time": "Time",
      "timer": "Timer",
      "title": "title",
      "toggle": "Toggle",
      "tools": "Tools",
      "trigger": "Trigger",
      "triple": "triple",
      "type": "Type",
      "ultra": "Ultra",
      "unlisted": "Unlisted",
      "unmapped": "Unmapped",
      "update": "Update",
      "upload": "Upload",
      "use": "Use",
      "username": "username",
      "version": "Version",
      "vertical": "Vertical",
      "veryHigh": "Very High",
      "veryLow": "Very Low",
      "videos": "Videos",
      "view": "View",
      "warning": "Warning",
      "wave": "Wave",
      "whatsThis": "What's this?",
      "wheel": "Wheel",
      "when": "When",
      "white": "White",
      "wired": "Wired",
      "wireless": "Wireless",
      "yellow": "Yellow",
      "yes": "Yes",
      "yesRecover": "Yes, start recovery"
    },
    "controller": {
      "buttonMapping": {
        "ggAction": "GG Action",
        "primary": "Primary",
        "shift": "Shift",
        "useShiftBtn": {
          "title": "Use as Shift Button",
          "tooltip": "Set this button as the shift key. Hold the shift key to access secondary mappings for other buttons."
        }
      },
      "calibration": {
        "centered": "Center - At Rest",
        "extended": "Range - When Fully Extended",
        "interrupt": "Calibration could not be completed due to a change during the process.<br><br>Please keep the controller connected and avoid switching connection modes while calibrating, then restart calibration.",
        "interruptTitle": "Calibration Interrupted.",
        "keepPressing": "Keep Pressing...",
        "keepRotating": "Keep Rotating...",
        "pressAtoContinue": "Press A to Continue",
        "recordMovement": "Recording Movement...",
        "startCalibration": "Start Calibration"
      },
      "circularity": {
        "mode": "Circularity Mode",
        "title": "Circularity",
        "tooltip": "Choose the shape of the stick’s dead-zone: <br><br>Default: Sharper up/down/left/right control; often preferred for 2D platformers, fighting games, retro games.<br><br>Circular: Even activation in all directions; often preferred for FPS, action/adventure, racing, twin-stick games."
      },
      "controllerButtonMapping": {
        "title": "Mapping"
      },
      "deadzone": {
        "inner": "Inner",
        "outer": "Outer",
        "thumbstickWarning": "Thumbstick Deadzone Warning",
        "thumbstickWarningInstruction": "You are setting the thumbstick's inner deadzone to 0%.<br><br>The stick will react to very small movements, which may:<br><br>• Make the stick feel more sensitive<br>• Cause visible drift or unintended input<br><br>For best results, recalibrate your thumbsticks after changing deadzone settings.",
        "thumbstickWarningText": "You are setting the thumbstick's inner deadzone to 0%.",
        "tooltip": "Inner deadzone ignores small movements near the center of the stick. Higher is safer for drift and shaky aim. Lower is better for fine aim in fast-paced games.<br><br>Outer deadzone controls how far you push before the stick counts as maximum input. Higher helps avoid hitting 100% by mistake. Lower reaches max turn or movement faster."
      },
      "dpadDown": "D-Pad Down",
      "dpadLeft": "D-Pad Left",
      "dpadRight": "D-Pad Right",
      "dpadUp": "D-Pad Up",
      "haptics": "Haptics",
      "leftBumper": "Left Bumper",
      "leftHandle": "Left Handle",
      "oledAndSystem": "OLED & System",
      "rightBumper": "Right Bumper",
      "rightHandle": "Right Handle",
      "sensitivity": {
        "dynamic": "Dynamic",
        "exponential": "Exponential",
        "title": "Sensitivity Adjustment",
        "tooltip": "Select the response curve for this stick. <br><br>Linear (default) provides a 1:1 response. <br><br>Dynamic increases sensitivity as you move away from center. <br><br>Exponential starts slow near center and has faster response near the edge."
      },
      "sticksWidget": {
        "alignNCalibrate": "Stick Alignment & Calibration",
        "calibrate": {
          "buttonTitle": "Calibrate Stick(s)",
          "done": "Your thumbsticks are now centered and fully calibrated.<br><br>You’re all set for smooth, precise control in every game.",
          "doneTitle": "Calibration Complete",
          "instruction": "We’ll calibrate your joysticks for accuracy.<br>Keep the controller connected and do not switch connection modes during calibration.",
          "interruptTitle": "Calibration Interrupted.",
          "step1": "Rotate each stick slowly around the outer edge one full time.<br><br>• Left stick — 1 full circle<br><br>• Right stick — 1 full circle<br><br>Moving slowly helps the controller capture the full range for more accurate calibration.<br><br>Return both sticks to center and press A to continue.",
          "step1Title": "Initial Movement Check",
          "step2": "Slowly rotate the left stick around the outer edge.<br><br>Complete 3 full circles for the most accurate calibration.<br><br>Return the stick to center when finished.<br><br>Return both sticks to center and press A to continue.",
          "step2Title": "Calibrating Left Stick",
          "step3": "Slowly rotate the right stick around the outer edge.<br><br>Complete 3 full circles for the most accurate calibration.<br><br>Return the stick to center when finished.<br><br>Return both sticks to center and press A to continue.",
          "step3Title": "Calibrating Right Stick",
          "title": "Sticks Calibration",
          "tooltip": "Run a step-by-step stick calibration to align center position and full range of motion."
        },
        "swap": "Swap Sticks",
        "swapTooltip": "Swap the functions of the left and right sticks."
      },
      "swapped": "Swapped",
      "syncHaptics": "Sync Haptics Settings",
      "syncHapticsTooltip": "Use the same haptics intensity for all zones.",
      "triggersWidget": {
        "alignNCalibrate": "Trigger Alignment & Calibration",
        "calibrate": {
          "buttonTitle": "Calibrate Trigger(s)",
          "done": "Your triggers are now fully calibrated.<br><br>You’re all set for smooth, precise control with every pull.",
          "doneTitle": "Calibration Complete",
          "instruction": "We’ll calibrate your triggers for accuracy.<br>Keep the controller connected and do not switch connection modes during calibration.",
          "step1": "Slowly press each trigger all the way down, then slowly release it.<br><br>Repeat several times so we can capture the full range accurately.",
          "step1Title": "Press and Release Triggers",
          "title": "Triggers Calibration",
          "tooltip": "Run a step-by-step trigger calibration to correct misreads and align full pull range."
        },
        "swap": "Swap Trigger",
        "swapTooltip": "Swap the functions of the left and right triggers.",
        "syncTriggers": "Sync Trigger Settings",
        "syncTriggersTooltip": "Apply the same deadzone settings to both triggers.",
        "title": "Trigger",
        "tooltip": "Inner deadzone sets how far you pull before the trigger activates. Higher helps avoid light accidental presses, useful for racing and driving games. Lower gives a shorter pull for faster actions, useful when you want quick firing or rapid inputs.<br><br>Outer deadzone sets how close to fully pressed you need to be for 100%. Higher helps avoid hitting full press by mistake. Lower reaches 100% earlier in the pull."
      },
      "wakeBehavior": {
        "onPowerOn": "Wake on Controller Power On",
        "onXboxButton": "Wake with Xbox Button",
        "title": "Wake Behavior",
        "tooltip": "Choose whether your Xbox or PC wakes automatically when the controller powers on, or only after you press the Xbox button while the controller is on."
      }
    },
    "deviceConfig": {
      "applicationAutoLaunch": "Autolaunch with Applications",
      "audioConfiguration": {
        "selectMicrophoneDevice": "Please select your microphone (line in) that your #DEVICENAME# is connected to.",
        "selectPlaybackDevice": "Please select your audio playback device that your #DEVICENAME# is connected to.",
        "setupYourDevice": "Setup your #DEVICENAME#"
      },
      "batteryMode": {
        "balanced": "Balanced Mode",
        "custom": "Custom Mode",
        "gaming": "High-Performance Mode",
        "marathon": "Power Saver Mode"
      },
      "bindingsModel": {
        "playbackOptions": {
          "types": {
            "repeatNTimes": "#ACTION_NAME#, Play #NUM_OF_TIMES# Times",
            "repeatWhilePressed": "#ACTION_NAME#, Repeat While Pressed",
            "toggleHold": "#ACTION_NAME#, Toggle Hold",
            "toggleRepeat": "#ACTION_NAME#, Toggle Auto-Repeat"
          }
        }
      },
      "bloom": {
        "permaLinkBanner": "Click here to change illumination of your device",
        "permaLinkPill": "Edit lighting settings",
        "permaLinkPillLabel": "Go to Prism"
      },
      "chooseInputDevice": "Choose input device",
      "chooseOutputDevice": "Choose output device",
      "configDialogTitle": "New Configuration",
      "configName": "Name",
      "counterfeitDevice": {
        "button1Text": "What should I do next?",
        "line1Text": "Dear player, hello.",
        "line2Text": "The #DEVICENAME# that you've connected appears to be a counterfeit.",
        "line3Text": "This mouse wasn't made by us at SteelSeries, and only some of the components inside are the same as inside the ones that we make. As a result, this mouse may not work as we intended, and we can't let SteelSeries Engine communicate with and make changes on an unauthorized device.",
        "line4Text": "We recommend returning the mouse to the retailer that you purchased it from, and let them know that they appear to be stocking counterfeit SteelSeries gear. For more info, please <a href=\"SUPPORT_PAGE\">contact our support team</a>.",
        "title": "Device Alert"
      },
      "defaultName": "Config ",
      "deviceSync": {
        "changesDetected": "We have detected changes on your #DEVICENAME#. Would you like to save to a new configuration, save to your existing configuration or revert your changes?",
        "outOfSyncPopUp": {
          "Text": "#DEVICENAME#'s on-board configurations aren't synced with Engine. Click here and open the configuration window to fix.",
          "Title": "Device trying to sync"
        },
        "overwriteCurrent": "Overwrite Current",
        "saveAsNew": "Save As New"
      },
      "deviceViewBack": "Back",
      "deviceViewBottom": "Bottom",
      "deviceViewFront": "Front",
      "deviceViewLeft": "Left",
      "deviceViewRight": "Right",
      "deviceViewTop": "Top",
      "dragHere": "Drag Here",
      "drop": "Drop",
      "duplicateConfigDialogTitle": "Duplicate Configuration",
      "editConfigDialogTitle": "Edit Configuration",
      "engineAppControlledWarning": {
        "message1": "#ENGINE_APP# is currently controlling this device.",
        "message2": "Click here to disable #ENGINE_APP#",
        "message3": "This device's OLED is being controlled by: "
      },
      "errors": {
        "configNameTaken": "This configuration name is not available"
      },
      "esportsPlayer": {
        "header": "Esport Player Configs"
      },
      "gameControls": "Game Controls",
      "gameDAC": {
        "noSurroundHiRes": "Surround not available in Hi-Res or PS4 mode"
      },
      "gamesenseBackground": {
        "title": "Default Engine App Color",
        "tooltip": "This color is displayed on the keyboard when any Engine App is active. This way you have a default color to display for when events aren't occurring."
      },
      "globalDeviceSettings": "Device Settings",
      "globalDeviceSettingsTooltip": "This will be applied to all configurations.",
      "infoAndHelp": "Product Information and Help",
      "lightsOutGameModal": "Use the Keypad Enter key to start the game, and use the keypad number keys to try to turn off all the lights.",
      "livePreview": {
        "off": "Live Preview Off",
        "on": "Live Preview On"
      },
      "liveRecord": {
        "messageMultiple": "#NUM_MACROS# new macros have been created from live recordings with the following names:",
        "messageOne": "A new macro has been created from a live recording with the name \"#MACRO_NAME#\"",
        "title": "New Macro Created"
      },
      "minesweeperGameModal": "Use the Keypad 1, 2, or 3 keys to select a difficulty, and press the lit keys to reveal keys. The number of times keys flash reveal how many mines are touching that key. Escape toggles flagging mode.",
      "missingLeftClickBindingWarning": "Removing the Button 1 action will make your mouse unusable.  Are you sure you want to do this?",
      "modalRevertConfigText": "Your changes have not been saved. Discard changes?",
      "modalRevertConfigTitle": "Discard Changes",
      "modalSaveImmutableText": "This configuration cannot be overwritten. Would you like to save this as a new configuration?",
      "modalText": "Are you sure you want to delete configuration PROFILE_NAME?",
      "modalTextWithLoadout": "PROFILE_NAME is associated with a QuickSet profile, are you sure you want to delete?",
      "modalTitle": "Delete Configuration",
      "mouseWheelBrightness": "Mouse Wheel Brightness",
      "onboardProfiles": {
        "firstTimeImport": {
          "finishedMessage": "Profiles were imported as:",
          "promptMessage": "We see this is the first time you have plugged in your device. Would you like to import the on-board profiles into Engine as configurations?"
        },
        "overwriteWarning": "This will overwrite this on-board profile, and the original profile will be lost to the void.",
        "plugIn": "Plug in #DEVICENAME# to see On-Board Profiles",
        "railTitle": "On-Board Profiles",
        "reservedSlot": "This slot is reserved for Engine. It cannot be directly modified.",
        "tooltip": "On-board profiles store nearly all the settings you apply to a configuration in Engine, including button bindings, macros and illumination settings.<br><br>Drag and drop to import or export settings from the mouse.<br><br>#DEVICE_SPECIFIC_TOOLTIP#<br><br>The first on-board profile cannot be overwritten. This profile is designated for Engine use.",
        "tutorial": {
          "modal1": {
            "text": "These are configurations that are saved on your device, and you can use them even without Engine running.",
            "title": "What are on-board profiles?"
          },
          "modal2": {
            "text": "Click on a configuration and drag it to one of the on-board profiles.",
            "title": "Copy configurations to your device"
          },
          "modal3": {
            "text": "Click and drag an on-board profile to the Configurations list.",
            "title": "Copy on-board profiles to configurations"
          }
        }
      },
      "overwriteConfig": "Do you want to overwrite the existing #CONFIG_NAME# configuration?",
      "quickset": {
        "deployConfigs": {
          "title": "Launch Configuration"
        },
        "deviceCustomAction": {
          "title": "Device Functions"
        },
        "launchApplication": {
          "deleteBindingTitle": "DELETE APP BINDING",
          "deleteBindingWarning": "If you remove this app, all buttons with this binding will be reset to their default binding.  Are you sure you want to continue?",
          "title": "Launch Application"
        },
        "otherActions": {
          "switchProfile": "Switch Profile"
        },
        "playbackOptions": {
          "directionLabel": "Play on key:",
          "tooltips": {
            "numRepeats": "The number of repeats.",
            "playOnce": "The action will play one time.",
            "repeatDelay": "The rest time between repeats.",
            "repeatNTimes": "The action will repeat a set number of times.",
            "repeatWhilePressed": "Press and hold the button to automatically repeat an action.",
            "toggleHold": "Press the button once to start playing the action continuously, and press it again to stop.",
            "toggleRepeat": "Press once to start automatically repeating the action, and press it again to stop.",
            "triggerDirection": "Choose whether the action will trigger when the key is pressed or released"
          },
          "types": {
            "playOnce": "Play Once",
            "repeatNTimes": "Play N Times",
            "repeatWhilePressed": "Repeat While Pressed",
            "toggleHold": "Toggle Hold",
            "toggleRepeat": "Toggle Auto-Repeat"
          }
        },
        "setDefaultAudioDevice": {
          "title": "Set Default Audio Devices"
        },
        "toggleEngineApps": {
          "title": "Launch Engine Apps"
        },
        "toggleRecording": {
          "actionName": "Start / Stop Recording",
          "effect": {
            "device": "Flash device",
            "key": "Flash key",
            "keyboard": "Flash keyboard",
            "none": "No effect"
          },
          "title": "Record Macro"
        }
      },
      "railTitle": "Configurations",
      "railTooltip": "Configurations can be used to quickly switch between different groups of settings for a device. Drag and drop to import or export configurations to a device.",
      "rapidTrigger": {
        "newActuationFeature": "New Actuation Feature"
      },
      "showConfigsBtn": "Configs",
      "snakeGameModal": "Use the Keypad Enter key to start the game, and use the arrow keys to control your snake.",
      "sonar": {
        "audioSettingsBanner": "Configure your audio settings in #SONAR#",
        "hyperLinkBanner": "Start using Sonar now!",
        "micBanner": "Get full control over your gaming and streaming audio when using your microphone with Sonar.",
        "permaLinkBanner": "Get full control over your gaming and chat audio when using your headset for PC gaming with Sonar.",
        "pill": {
          "description": "Switch to Sonar for advanced audio controls",
          "link": "Go to Sonar"
        }
      },
      "taskbar": {
        "configMenuTitle": "Engine configs"
      }
    },
    "dir": "ltr",
    "discordpromotion": {
      "giveaways": {
        "getThreeMonthsFree": "Get 3 months Discord Nitro for free"
      },
      "home": {
        "getThreeMonthsAndShare": "Get 3 months Discord Nitro for free and share your Moments with friends in max quality",
        "getThreeMonthsFree": "Get 3 months Discord Nitro for free",
        "limitedKeys": "Limited Keys",
        "matchMadeInClipping": "A Match Made in Clipping",
        "viewInMoments": "View in SteelSeries Moments"
      },
      "moments": {
        "enableMoments": "Enable Moments",
        "enableToAccess": "Enable to access 3 months free Discord Nitro",
        "learnMore": "Learn More",
        "loginRequired": "Login Required",
        "redeemBody": "Use Moments together with Discord Nitro to share clips with friends faster than ever in glorious Full HD. New Discord Nitro users only and credit card required.",
        "redeemBodyDescription": "Use Moments together with Discord Nitro to share clips with friends faster than ever in glorious Full HD.",
        "redeemBodyRequirement": "New Discord Nitro users only and credit card required.",
        "redeemButton": "Get 3 months of Discord Nitro",
        "redeemHeader": "3 months of Discord Nitro"
      }
    },
    "engine": {
      "actions": {
        "HeadphoneOut": "Headphone out",
        "LineOut": "Line out"
      },
      "discord": {
        "join": {
          "caption": "Join Engine Discord server"
        }
      },
      "quicksetLibrary": {
        "buttonText": "Try QuickSet now",
        "textContent": "We've upgraded Library with QuickSet."
      },
      "settings": {
        "beta": {
          "betaFirmware": {
            "currentFirmwareOffering": "Current beta firmware offers Rapid Tap support for Apex Pro keyboards, which utilizes SOCD last input priority for the A and D keys only and cannot be turned off.",
            "description": "Try Beta Firmware",
            "enableOrDisableDescription": "To enable or disable the beta:",
            "enableOrDisableSteps": {
              "step1": "Turn on or off the above Try Beta Firmware toggle.",
              "step2": "Fully disconnect and reconnect all parts of the Apex Pro Keyboard.",
              "step3": "Once complete, go to Engine and click on the firmware update banner.",
              "step4": "Go through the full Firmware Update process."
            },
            "toggleLabel": "Toggling this on will offer you beta firmware."
          },
          "description": "Enable selected beta features below"
        },
        "cloudSync": {
          "button": "Sync now",
          "description": "Back up your device settings to the cloud when you make changes.",
          "disabledStatus": "Cloud Sync has been temporarily disabled.",
          "label": "Manual sync",
          "status": {
            "error": "Error on #TIMESTAMP#: #ERROR#",
            "isSyncing": "Currently syncing",
            "neverSynced": "Last synced: Never",
            "success": "Last synced: #TIMESTAMP#"
          },
          "title": "Cloud Sync"
        },
        "overlaysNotifications": {
          "batteryOverlays": {
            "lowBattery": {
              "settingsDescription": "Engine will display an animation to let you know that your device is low on battery.",
              "settingsTitle": "Display overlays",
              "title": "Low Battery"
            },
            "title": "Battery Overlays"
          },
          "description": "Turn on & off overlays and sounds to notify you that devices are on low battery.",
          "sounds": {
            "lowBattery": {
              "settingsDescription": "Engine will play a sound when the low battery overlay is triggered",
              "settingsTitle": "Low battery notification sounds"
            },
            "title": "Sounds"
          },
          "title": "Overlays and Notifications"
        }
      }
    },
    "errors": {
      "alreadyAutolaunches": "The program $1 already autolaunches the configuration $2. A program can only autolaunch with one configuration at a time.",
      "cannotBeOpened": "This file cannot be opened.",
      "cloudSyncFailure": "Cloud Sync Failed",
      "configNameRequired": "You must enter a name for this configuration.",
      "configNameTaken": "This name has already been used. Please choose a unique name.",
      "fatalErrorMessage": "A fatal error was encountered and has been logged. SteelSeries Engine will now close. If you continue to encounter this error, please file a ticket on our <a href=\"SUPPORT_PAGE\">Support Page</a>.",
      "fatalErrorTitle": "Fatal Error",
      "fileTooLarge": "This file is too large",
      "genericAuthFailure": "Login failed.Please try again later.",
      "imageError": "There is a problem with this image.",
      "invalidAliasName": "Invalid short name given",
      "invalidCharacters": "Remove invalid characters",
      "invalidCredentials": "The email or password you entered is incorrect.",
      "maxLength": "Character limit reached",
      "missingEmail": "Please enter your email address.",
      "missingPassword": "Please enter your password.",
      "nameEmpty": "Name cannot be empty",
      "nameRequired": "Please enter a name.",
      "nameTaken": "This name has already been used. Please choose a unique name.",
      "required": "Required",
      "tooManyFrames": "That animation has too many frames (maximum #MAX_FRAMES#)"
    },
    "firmwareUpdate": {
      "common": {
        "acknowledgementText": "I understand my settings will not transfer.",
        "complete": "Complete",
        "connectDevices": "We’ve detected your devices. For a complete and compatible update, ensure your mouse and base station are connected. If a travel dongle is detected, it will be updated too.",
        "deviceChecklist": "Device Checklist",
        "doNotDisconnect": "Do not disconnect your device!",
        "firmwareUpdateChecklist": "Firmware Update Checklist",
        "firmwareUpdateComplete": "Firmware Update Complete!",
        "firmwareUpdatedText": "Please disconnect and restart your device! GLHF!",
        "firmwareUpdating": {
          "description": "Do not move your mouse and keep it near the base station or travel dongle until the update completes.",
          "title": "Firmware Updating"
        },
        "hotPlugTryAgain": "Please unplug your device and plug it back in to try again.",
        "migrationLoss": "Any previous Nova 7 configurations and settings stored will be lost.",
        "migrationWarning": "Updating to Nova 7 Gen 2 brings a brand-new experience, but your current configurations and settings #WILL NOT BE TRANSFERRED.# ",
        "mobileAppSupport": "#Mobile App Support# – Enhancing your experience for realtime audio control, wherever you play.",
        "mouseFirmwareUpdatedText": "Your mouse is ready to use! GLHF!",
        "mouseOnAndEnoughBattery": "Mouse ON and >10% Battery",
        "personalizedAudio": "#Personalized Audio (PEQ)# – Take full control of your sound with advanced customization.",
        "recoveringBaseStation": "Recovering your base station...",
        "recoveringDevice": {
          "description": "Do not unplug your device, turn off your computer or exit the software.",
          "title": "Recovering Device"
        },
        "recoveringDongle": "Recovering your dongle...",
        "recoveringMouse": "Recovering your mouse...",
        "recoveryComplete": {
          "description": "Your device has been successfully recovered. The device is now ready to use.",
          "title": "Recovery Complete"
        },
        "recoveryMode": {
          "connectDevices": "Make sure your mouse is in recovery mode and connected using either the base station or the travel dongle before continuing.",
          "description": "Your mouse is in recovery mode. Ensure your mouse is paired with your transmitter before selecting Continue. Keep the device connected throughout the process.",
          "title": "Recovery Mode"
        },
        "revampedUi": "#Revamped UI# – Sleeker, smarter, and more intuitive than ever!",
        "somethingWentWrong": "Something went wrong during the update. Please try again. If the issue persists, contact customer support.",
        "travelDongleOrBaseStationDetected": "Travel Dongle / Base Station Detected",
        "whatsNewNova7Gen2": "What’s New in Nova 7 Gen 2"
      }
    },
    "formats": {
      "date": "MM/DD/YYYY"
    },
    "gameEvents": {
      "ability1": "Ability 1",
      "ability2": "Ability 2",
      "ability3": "Ability 3",
      "ability4": "Ability 4",
      "ability5": "Ability 5",
      "abilityCooldown": "Ability Cooldown",
      "airUnderwater": "Air (Underwater)",
      "album": "Album",
      "ammo": "Ammo",
      "armor": "Armor",
      "artist": "Artist",
      "assists": "Assists",
      "avgKillsPerRound": "Average Kills per Round",
      "baronBuffTimer": "Baron Buff Timer",
      "baronDragonOledTimer": "Baron & Dragon Timer",
      "baronKill": "Baron Kill",
      "baronSpawnTimer": "Baron Spawn Timer",
      "bombDropped": "Bomb Dropped",
      "bombPickedUp": "Bomb Picked Up",
      "break": "Broken",
      "celsiusCPU": "CPU °C",
      "celsiusGPU": "GPU °C",
      "channel": "Channel",
      "compassE": "Compass East",
      "compassN": "Compass North",
      "compassS": "Compass South",
      "compassW": "Compass West",
      "compositeHunger": "Hunger Level & Hungry",
      "contextDataValue": "Context data value",
      "cpu": "CPU",
      "creepScore": "Creep Score",
      "data": "Data",
      "dayNight": "Day / Night",
      "dead": "Dead",
      "deaths": "Deaths",
      "denies": "Denies",
      "disarmed": "Disarmed",
      "doneReloading": "Done Reloading",
      "dota2": {
        "aegisClaimed": "Aegis Claimed",
        "aegisDespawn": "Aegis Expires",
        "boughtBack": "Bought Back",
        "item_arcane_boots": "Arcane Boots",
        "item_black_king_bar": "Black King Bar",
        "item_blade_mail": "Blade Mail",
        "item_blink": "Blink Dagger",
        "item_cyclone": "Eul's Scepter of Divinity",
        "item_force_staff": "Force Staff",
        "item_glimmer_cape": "Glimmer Cape",
        "item_guardian_greaves": "Guardian Greaves",
        "item_hand_of_midas": "Hand of Midas",
        "item_invis_sword": "Shadow Blade",
        "item_manta": "Manta Style",
        "item_mekansm": "Mekansm",
        "item_orchid": "Orchid Malevolence",
        "item_refresher": "Refresher Orb",
        "item_sheepstick": "Scythe of Vyse",
        "item_silver_edge": "Silver Edge",
        "item_sphere": "Linken's Sphere",
        "item_tpscroll": "Town Portal Scroll",
        "ultimateCast": "Ultimate Cast"
      },
      "dragonKill": "Dragon Kill",
      "dragonSpawnTimer": "Dragon Spawn Timer",
      "dragonType": "Dragon Type",
      "duration": "Duration",
      "enemiesAlive": "Enemies Alive",
      "eventValue": "Event Value",
      "fancyItemCooldowns": "Items",
      "flawless": "Flawless",
      "freezetimeEnded": "Freezetime Ended",
      "gameDone": "Game Done",
      "gameStarted": "Game Started",
      "gold": "Gold",
      "gpm": "GPM",
      "gpu": "GPU",
      "hasHelmet": "Helmet",
      "health": "Health",
      "heraldKill": "Rift Herald Kill",
      "hexed": "Hexed",
      "holdingGrenade": "Holding Grenade",
      "hungerLevel": "Hunger Level",
      "invisible": "Invisible",
      "isFlashed": "Flashbang Blindness",
      "isHungry": "Hungry",
      "item1": "Item Slot 1",
      "item2": "Item Slot 2",
      "item3": "Item Slot 3",
      "item4": "Item Slot 4",
      "item5": "Item Slot 5",
      "item6": "Item Slot 6",
      "itemCooldown": "Item Cooldown",
      "kdRatio": "K/D Ratio",
      "kda": "KDA",
      "killDeathRatio": "Kill / Death Ratio",
      "killStreak": "Kill Streak",
      "kills": "Kills",
      "lastHits": "Last Hits",
      "level": "Level",
      "magicimmune": "Magic Immune",
      "mana": "Mana",
      "map": "Map",
      "matchKills": "Match Kills",
      "message": "Message",
      "money": "Money",
      "mute": "Muted",
      "mutedSelf": "Muted",
      "mvps": "MVPs",
      "notification": "Notification",
      "percent": "Percent",
      "playerName": "Player Name",
      "ram": "RAM",
      "reliableBuyback": "Reliable Buyback",
      "reloading": "Reloading",
      "respawnSeconds": "Respawn Timer",
      "round": "Round",
      "roundHeadshots": "Headshots",
      "roundKills": "Round Kills",
      "roundKillsHeadshotsCombo": "Round Kills & Headshots",
      "roundOver": "Round Over",
      "roundStart": "Round Start",
      "selfJoined": "Joined Channel",
      "selfLeft": "Disconnect",
      "selfTalk": "Personal Voice Activity",
      "showTool": "Current Tool",
      "silenced": "Silenced",
      "specificUserTalking": "Specific User Talking",
      "spikePlanted": "Spike Planted",
      "statusEffect": "Status Effect",
      "stunned": "Stunned",
      "teamScore": "Team Score",
      "teammatesAlive": "Teammates Alive",
      "temp": "TEMP.",
      "thrifty": "Thrifty",
      "title": "Title",
      "toolDurability": "Tool Durability",
      "trackIsPaused": "Track is Paused",
      "trackIsPlaying": "Track is Playing",
      "trackPaused": "Track Paused",
      "trackPlaying": "Track Playing",
      "trackStarted": "Track Started",
      "trackStarts": "Track Starts",
      "ultimateAbility": "Ability Ultimate",
      "ultimateCast": "Cast Ultimate",
      "user": "User",
      "userJoined": "User Joined Channel",
      "userLeft": "User Left Channel",
      "userTalk": "Voice Activity",
      "userTalking1": "User 1 Talking",
      "userTalking10": "User 10 Talking",
      "userTalking2": "User 2 Talking",
      "userTalking3": "User 3 Talking",
      "userTalking4": "User 4 Talking",
      "userTalking5": "User 5 Talking",
      "userTalking6": "User 6 Talking",
      "userTalking7": "User 7 Talking",
      "userTalking8": "User 8 Talking",
      "userTalking9": "User 9 Talking",
      "wardPurchaseCooldown": "Ward Purchase Cooldown",
      "weapon": "Weapon",
      "weaponSwitched": "Weapon Switched",
      "xpm": "XPM"
    },
    "gameIntegration": {
      "addDisplay": "Add Display",
      "addEvent": "Add Event",
      "addRange": "Add Range",
      "allZonesWarning": "Unlinking all zones will revert each zone to its default setting.",
      "boldText": "Bold Text",
      "chooseEvent": "Choose Event",
      "chooseEventToGetStarted": "Choose an event to get started.",
      "chooseLayout": "Choose Layout",
      "config": {
        "preview": "Preview with",
        "tooltip": "Use the dropdown to preview a configuration paired with GameSense effects. This shows how the device will look during a game when this configuration is selected and GameSense is enabled."
      },
      "discord": {
        "events": "Discord Events"
      },
      "display": {
        "addGameStat": "Add Game Stat",
        "addImage": "Add Image",
        "addText": "Add Text",
        "clickToAddToQueue": "Click to add something to your display queue, so when the event is triggered something will show up on the screen.",
        "discord": {
          "addGameStat": "Add Discord Info",
          "gameStat": "Discord Info"
        },
        "gameStat": "Game Stat",
        "label": "Display",
        "noEvents": {
          "line1": "Get feedback from your game to the screen on your #DEVICE#.",
          "line2": "There aren't any screen event triggers configured yet."
        }
      },
      "downloadTheMod": "Download the Mod",
      "effectSubSelect": {
        "chooseAStatusEffect": "Choose a status effect.",
        "chooseAUser": "Choose a user.",
        "chooseAnAbility": "Choose an ability.",
        "chooseAnItemSlot": "Choose an item slot.",
        "selectAbility": "Ability",
        "selectItemName": "Select Item",
        "selectItemSlot": "Item Slot",
        "selectStatusEffect": "Status Effect",
        "selectUser": "User"
      },
      "effects": {
        "colorRange": {
          "label": "Color Range",
          "tooltip": "During your game, illumination will change colors based on current game conditions. When Display as Bar is selected, the illuminated area will shrink or grow as well as change colors."
        },
        "contextColor": {
          "label": "Dynamic Color",
          "tooltip": "This type of event will always display the specific color sent from the game."
        },
        "dualColor": {
          "label": "Dual Color",
          "tooltip": "Select a color to represent empty (0%) and full (100%) for the selected event. During your game, the illumination will gradually change from one color to the other based on conditions in the game.<br><br>When \"Display as bar\" is selected, the illuminated area will shrink or grow while changing color."
        },
        "fancy": {
          "label": "Special Events",
          "tooltip": "Enable or disable events that have been designed specifically for this game. Special Events are applied to specific keys, and cannot be customized in any way. Affected keys will be locked and cannot be selected."
        },
        "flash": {
          "above": "Flash above",
          "at": "Flash at",
          "flash": "Flash",
          "kills": "kills"
        },
        "label": "Effects",
        "showAsBar": "Display as a bar",
        "singleColor": {
          "kills": {
            "tooltip": "Illumination will flash once every time you get a kill. At the value specified in the \"Flash\" field, the illumination will continually flash until the end of the round or match."
          },
          "label": "Single Color",
          "tooltip": "Illumination will be on when the value of the event in game is above 0, and off when it's at 0. When \"Display as bar\" is enabled, the illuminated area will shrink or grow based on conditions in the game."
        }
      },
      "events": "Game Events",
      "gameDisabled": "GameSense has been disabled. Click the toggle below to view illumination settings.",
      "gameIntegration": "GameSense",
      "gameNameplate": "#GAME_NAME# Nameplate",
      "illumination": {
        "tooltip": "GameSense enables your games to interact with your SteelSeries devices in real time. Configure SteelSeries Engine so that when certain game events are triggered, the illumination on the device will change."
      },
      "multipleLines": "Multiple Lines",
      "nameplateImageWarning": "Images should be #HEIGHT#px x #WIDTH#px, less than #MAX_SIZE#, and in black and white.  Animations cannot be used as nameplates.",
      "nameplateN": "Nameplate #NAMEPLATE_NUMBER#",
      "nameplateTooltip": "Set an image that will appear on your device’s screen when GameSense begins running. If any Screen events are set, the nameplate will appear after a Screen Event is triggered and the display queue sequence is complete.",
      "nameplates": "Nameplates",
      "noConnectedDeviceType": "Please plug in a compatible SteelSeries #DEVICE_TYPE# device to use our GameSense supported apps and features.",
      "noConnectedDevices": "Plug in a compatible SteelSeries device to use GameSense features.",
      "overwriteEvent": "Adding a new instance of this event will delete the existing one.",
      "progressBar": "Progress Bar",
      "repeating": "Repeating",
      "screen": {
        "label": "Screen",
        "screenEventN": "Screen Event #EVENT_NUMBER#",
        "tooltip": "GameSense enables your games to interact with your SteelSeries devices in real time. Configure SteelSeries Engine so that when certain game events are triggered, the information displayed on the device's screen will change. Display game states, custom text and images."
      },
      "screenWillShow": "Screen will show",
      "settings": {
        "label": "Settings"
      },
      "showAsBar": {
        "tooltip": "Apply to three or more keys in a row. As the value for the selected event goes up or down, the illuminated area will shrink or grow just like a classic HP bar.<br><br>Keys should be selected in the desired illumination sequence. Relative to the order keys are selected, the last one turns off first. Select keys from left to right for a classic style or right to left for a reverse style."
      },
      "spotify": {
        "connectAccount": "Connect your Spotify account with Engine",
        "connectNow": "Connect now",
        "removeAccess": "Remove access"
      },
      "tactile": {
        "label": "Tactile",
        "noEvents": {
          "line1": "Get tactile feedback from your game straight to your #DEVICE#.",
          "line2": "There aren't any tactile event triggers configured yet."
        },
        "tactileEventN": "Tactile Event #EVENT_NUMBER#",
        "tooltip": "GameSense enables your games to interact with your SteelSeries devices in real time. Configure SteelSeries Engine so that when certain game events are triggered, the device will vibrate. Use unique vibration styles to differentiate between multiple events.",
        "vibration": "Vibration"
      },
      "textWrap": "continued"
    },
    "general": {
      "settings": {
        "linkedAccounts": {
          "clearCacheModalBody": "This will unlink your account and delete the YouTube URLs inside each clip’s share history.",
          "clearCacheModalTitle": "Delete local data",
          "confirmClearData": "Are you sure you want to delete this data?",
          "deleteLocalData": "Delete local data",
          "deleteMetadata": "Delete metadata",
          "description": "Link up your other accounts to GG to upload videos, show game info on your devices, and other fun integrations.",
          "headBackToMoments": "Head back to Moments & start uploading!",
          "linkAccount": "Link Account",
          "linkedToMoments": "#SERVICE# linked to Moments.",
          "linkedToMomentsFailed": "#SERVICE# not linked",
          "noAccount": "No connected account",
          "processing": "Processing...",
          "safeToCloseWindow": "It's safe to close this window.",
          "title": "Link YouTube account",
          "tryAgainDescription": "To link Moments to your #SERVICE# account, try again below.",
          "unlinkAccount": "Unlink",
          "waiting": "Waiting..."
        },
        "myAccount": {
          "changePassword": "Change password",
          "changeUsername": {
            "codeExplainer": "This code will accompany your username to ensure that it is unique. If the combo isn’t unique, the code will change after you save.",
            "rules1": "Can include a-z, A-Z, 0-9, -, _, space",
            "rules2": "Must be between 3-28 characters",
            "serverError": "Changes weren’t saved because our server is down, retry or come back later",
            "title": "Username guidelines",
            "tooLong": "Username is too long. Has to be between 3-28 characters",
            "tooShort": "Username is too short. Has to be between 3-28 characters",
            "validationError": "You used one or more invalid characters. Please use: a-z, A-Z, 0-9, -, _, space"
          },
          "createdOn": "Created on #DATE#",
          "description": "Make any changes to your account on your account dashboard.",
          "editUsername": "Edit Username",
          "optionLabels": {
            "accountStatus": "Account Status",
            "email": "Email",
            "password": "Password"
          },
          "title": "My Account",
          "viewAccountLink": "View your account on steelseries.com"
        }
      }
    },
    "genshinpromotion": {
      "moments": {
        "enableToReceive": "Enable to get free genshin impact rewards",
        "redeemBodyDescription": "You've earned some Mystic Enhancement Ore and Mora, just redeem this one-time code in Genshin Impact while supplies last.",
        "redeemBodyRequirement": "Moments auto-clips your games. You edit and share other courageous plays on all your favorite social channels.",
        "redeemHeader": "Free genshin impact rewards"
      }
    },
    "gg": {
      "apps": {
        "pin": "Pin",
        "unpin": "Unpin"
      },
      "appsTray": {
        "aimTools": {
          "description": "Train your aim with deadly training routines and frag enemies like a pro."
        },
        "apps": "Apps",
        "companionApp": {
          "description": "Unlock pro-level audio and EQ presets on-the-go for mobile and Console."
        },
        "giveaways": {
          "description": "New giveaways weekly - betas, skins, full copies, & more for all your favorite games."
        },
        "moments": {
          "description": "The easiest way to record and share your gameplay with friends."
        },
        "sonar": {
          "description": "Unlock pro-level audio, EQ presets, AI Noise Cancellation and more."
        }
      },
      "error": {
        "closeDescription": "GG crashed unexpectedly. Please close and re-launch.",
        "description": "GG crashed unexpectedly, but Lars is taking care of the issue.",
        "restartGG": "Restart GG",
        "restoreSession": "Restore Session",
        "title": "Oops! Something went wrong."
      },
      "login": {
        "connectionError": "Couldn’t reach the log in server. Make sure you have internet and try again.",
        "createAccount": "Not a member?  <a>create account</a>",
        "emailAddress": {
          "placeholder": "type your email address"
        },
        "forgotPassword": "Forgot Password?",
        "incorrectLogin": "Your password or email were incorrect. Try typing them out again, or click Forgot Password below.",
        "incorrectLogin3DAT": "Your password or email were incorrect. Please use 3D Aim Trainer credentials to login.",
        "loginButton": {
          "default": "Log In",
          "submitted": "Logging In"
        },
        "modalTitle": "log in",
        "password": {
          "placeholder": "type your password"
        },
        "subtitle": "Access the Moments Private Beta and Engine customization, now both inside of SteelSeries GG.",
        "title": "Welcome to SteelSeries GG"
      },
      "nav": {
        "accountSettings": "Account Settings",
        "home": "Home",
        "limitedAccess": "Limited Access",
        "loginLink": "Log in / Register",
        "loginLinkAlternate": "Log in / Create Account",
        "loginTooltip": "You're not logged in. Log in or Register to get full access.",
        "momentsDisabledToolTip": "Moments is off",
        "news": "News",
        "noUsername": "Set Username"
      },
      "onboardingDevice": {
        "common": {
          "skipSetup": "Skip Setup"
        },
        "completionStep": {
          "paragraph": "You can change any of these settings later in Engine.",
          "restart": "Restart",
          "title": "You're all set!"
        },
        "getStartedStep": {
          "title": "Setup your #DEVICE#",
          "turnOnWarning": "Turn on your headset to proceed"
        },
        "setupMicEqStep": {
          "paragraph": "Start speaking and switch between presets until your voice sounds the way you like.",
          "selectPreset": "Select a preset",
          "startSpeaking": "Start speaking",
          "title": "Set up your microphone"
        }
      },
      "requestAccess": {
        "accessRequestedSuccessText": "Yay, you're on the waiting list!",
        "accessRequestedTitle": "Access Requested",
        "checkAccountStatusButton": {
          "active": "Checking...",
          "default": "Check account status"
        },
        "checkedNoAccessButton": "Checked, no access yet",
        "connectionError": "Couldn’t communicate with the server. Make sure you have internet and try again.",
        "enterNowButton": "You have access! Enter now",
        "getOnWaitingListText": "Hit *Request access* now to get on the waiting list",
        "inviteNoteText": "We'll send invites out in waves over the coming weeks. Keep an eye on your inbox for the invite!",
        "missingAccessDescriptionOne": "Ssssorry, we looked everywhere for",
        "missingAccessDescriptionTwo": "and we don't see it in our list for closed beta.",
        "recheckAccountStatusButton": "Re-check account status",
        "requestAccessButton": {
          "default": "Request access",
          "submitted": "Requesting..."
        },
        "restrictedAccessTitle": "Restricted Access"
      },
      "settings": {
        "about": {
          "appUpdate": {
            "button": {
              "checking": "Checking...",
              "downloading": "Downloading, #PROGRESS#%",
              "failure": "Retry",
              "installing": "Installing...",
              "pending": "Check for updates",
              "success": "Install update"
            },
            "modal": {
              "cancel": "Install later",
              "continue": "Install now",
              "line1": "Installing a new update will take a minute or two, and requires restarting GG.",
              "line2": "Install update and restart GG now?",
              "title": "Install update"
            },
            "status": {
              "checking": "Checking now, an update will be downloaded if there is one.",
              "downloading": "Update #VERSION# found, downloading.",
              "failure": "Update failed. The update service may not be responding, or you may not have an internet connection.",
              "installing": "Installing update. The app will restart soon.",
              "pending": "Update checks will automatically happen once per day.",
              "rateLimited": "You're up to date. Update checks are limited to #MAX_UPDATE_ATTEMPTS# per day.",
              "success": "Update downloaded. Install now, or let the update install automatically when your display goes to sleep.",
              "upToDate": "You're on the latest version."
            }
          },
          "licenses": "Licenses",
          "softwareLibraryUse": "This software uses libraries from the #LIBRARY# project under the #LICENSE#.",
          "softwareLibraryUseCreditTeam": "This software uses libraries from the #TEAM#.",
          "title": "About and Privacy",
          "whatnew": "What's New"
        },
        "account": {
          "linkDescription": "Link your YouTube account to GG to upload videos, show game info on your devices, and other fun integrations.",
          "linkYouTube": "Link YouTube Account",
          "title": "Account"
        },
        "audioLite": {
          "disableModalDescription": "Disabling Engine advanced features will prevent ChatMix and other advanced controls from working in Engine. To restore ChatMix, turn this option back on or use Sonar.",
          "label": "Use advanced audio features like ChatMix directly in Engine. Turn this off to keep the old behavior, where ChatMix and other advanced controls remain in Sonar.",
          "title": "Engine advanced features"
        },
        "autoFlatten": {
          "disableModalDescription": "Disabling the auto-flatten EQ setting may cause audio processing issues. While turned off, you will no longer receive notifications about conflicts between Engine and Sonar.",
          "disableModalTitle": "Disable auto-flatten",
          "label": "Automatically flatten 2.4gHz equalizer while Sonar is enabled to avoid audio conflict.",
          "title": "Auto-Flatten EQ"
        },
        "autoStart": {
          "disableModal": {
            "cancelButton": "No, take me back!",
            "confirmButton": "Yes, I'm sure",
            "text": "By turning off auto run you will not get any software driven effects on your devices, such as certain illumination presets, keybinds, or macros, and Moments gameplay capture will be disabled.",
            "title": "Turn off auto-run?"
          },
          "label": "Run SteelSeries GG when my computer starts",
          "title": "Auto-run"
        },
        "betaOptIn": {
          "description": "Feeling adventurous? Then sign up to get early releases of our software.",
          "faq": "Find out more on our FAQ",
          "label": "Feeling adventurous? Then sign up to get early releases of our software.",
          "title": "Beta Opt-In"
        },
        "desktopNotifications": "Allow desktop notifications",
        "gameDetection": {
          "addGame": "Add game",
          "automaticallyScanForGames": "Automatically scan for games",
          "captureDisabledTooltip": "Capture disabled for this game",
          "captureEnabledTooltip": "Capture enabled for this game",
          "description": "GG automatically detects and adds your installed games. Detected games are available for Moments auto-clipping and QuickSet profiles.",
          "descriptionTooltip": "We automatically detect & capture games from most launchers like Steam, Battle.net, Epic, Origin, etc.",
          "detectedGames": "Detected Games",
          "recordingMode": {
            "disableCapture": "Disable capture",
            "enableCapture": "Enable capture"
          },
          "scanComplete": "Scan complete",
          "scanNow": "Scan now",
          "startingScan": "Starting scan",
          "title": "Game Detection"
        },
        "general": {
          "description": "Set your preferences for settings that apply to all of GG.",
          "title": "General"
        },
        "language": {
          "choose": "Choose your language for GG.",
          "current": "Current language",
          "modal": {
            "accept": "Change",
            "content": "You've selected #LANGUAGE# as your default language. To confirm, go ahead and hit #ACCEPT#. If you're still thinking about it, hit #DECLINE#.",
            "decline": "Keep #LANGUAGE#",
            "title": "Change language confirmation"
          }
        },
        "logout": {
          "subtitle": "Don’t worry, we’ll keep your settings."
        },
        "myAccount": {
          "defaultUsernameTooltip": "A username has been auto-generated for your account.",
          "openSettings": "Click to open account settings"
        },
        "notification": {
          "description": "Customize GG notification settings"
        },
        "notifications": {
          "description": "Turn on & off desktop notifications and OLED notifications from GG.",
          "desktopNotificationTitle": "Desktop Notifications",
          "engine": {
            "detail": "Includes notifications for device updates and device errors.",
            "label": "Allow desktop notifications from Engine"
          },
          "title": "Notifications"
        },
        "privacy": {
          "delete": {
            "detail": "We need to store and process some anonymous data in order to provide you the basic SteelSeries GG services. By using SteelSeries GG, you allow us to provide this basic service. You can stop this by disabling or deleting your account.",
            "label": "Delete My Data",
            "link": "Learn more about disabling or deleting your account."
          },
          "description": "Privacy description goes here",
          "personalizationEnabled": {
            "detail": "This setting allows us to use information that is linked to your account, such as what SteelSeries devices you have connected, or if you have captured a Moments clip, to customize SteelSeries GG for you.",
            "detailNoMoments": "This setting allows us to use information that is linked to your account, such as what SteelSeries devices you have connected, to customize SteelSeries GG for you.",
            "label": "Use Data to Personalize GG",
            "optOutModal": {
              "cancelButton": "No, take me back!",
              "confirmButton": "Yes, I'm sure",
              "text": "By turning this off you will lose access to personalized content, such as highlighted blog posts for games that you play, or how to configure devices that you have connected.",
              "title": "Turn off personalization?"
            }
          },
          "privacyLinks": "Check out our",
          "request": {
            "detail": " ",
            "label": "Request Your Data",
            "link": "Learn more about getting a copy of your personal data."
          },
          "title": "Privacy"
        },
        "services": {
          "description": "Enable and disable GG services.",
          "moments": {
            "description": "Activate or deactivate Moments application",
            "label": "Moments",
            "loadingText": {
              "turningOff": "Turning Moments off…",
              "turningOn": "Turning Moments on..."
            }
          },
          "sonar": {
            "description": "Activate or deactivate Sonar. When enabled, Sonar controls ChatMix and other advanced audio features",
            "disableModal": {
              "cancelButton": "Cancel",
              "confirmButton": "Turn Off",
              "text": "Are you sure you want to disable Sonar?",
              "title": "DISABLE SONAR?"
            },
            "label": "Sonar",
            "loadingText": {
              "turningOff": "Turning Sonar off...",
              "turningOn": "Turning Sonar on..."
            }
          },
          "title": "GG SERVICES"
        },
        "sounds": {
          "clipSaved": {
            "label": "Clip saved"
          },
          "title": "Sounds"
        }
      },
      "subAppActions": {
        "launchFrontendClient": "Open GG",
        "launchQuickSetShortcut1": "Launch QuickSet shortcut 1",
        "launchQuickSetShortcut2": "Launch QuickSet shortcut 2",
        "launchQuickSetShortcut3": "Launch QuickSet shortcut 3",
        "launchQuickSetShortcut4": "Launch QuickSet shortcut 4",
        "launchQuickSetShortcut5": "Launch QuickSet shortcut 5"
      },
      "welcomeModal": {
        "confirmButton": "Let’s go",
        "defaultMainTitle": "You’re In!",
        "defaultSubTitle": "Get ready to get more out of your game. GG comes pre-loaded with these great apps:",
        "engine": {
          "description": "Customize the lighting and more for all your SteelSeries devices.",
          "device": "Device",
          "devices": "Devices",
          "mainTitle": "Bring your gear to life",
          "subTitle": "Customize the lighting, audio, macros and more for all your SteelSeries devices."
        },
        "footerDescription": "You can change any of the above features from Settings at any time.",
        "giveaways": {
          "description": "Claim weekly giveaways, betas, skins and more.",
          "mainTitle": "Free stuff every week",
          "subTitle": "Claim weekly giveaways, game keys, skins and more.",
          "unlocked": "Unlocked"
        },
        "moments": {
          "description": "Capture, edit, and share all of your best gaming moments.",
          "mainTitle": "Share glory",
          "subTitle": "Capture, Edit, and Share all of your best gaming moments."
        },
        "sonar": {
          "description": "Customize your game audio to get the most out of your game.",
          "mainTitle": "Hear behind enemy lines",
          "subTitle": "Amplify or reduce specific in-game sounds to hear real-time footsteps."
        },
        "threedat": {
          "description": "Train your aim in shooters like a pro.",
          "freeToPlay": "Free to Play",
          "mainTitle": "Dominate the game",
          "subTitle": "Free aim trainer to level up your shooting skills."
        }
      },
      "whatsNewModal": {
        "added": "Added: ",
        "feature": "Feature: ",
        "modalTitle": "What's New",
        "momentsCTA": "Start Clipping",
        "sonarCTA": "Open Sonar",
        "v28": {
          "momentsFeature1": "Multitrack Audio will let you choose the audio you want captured and from what devices. With newly created clips you will discover audio separated into unique tracks where each can be edited independently.",
          "momentsFeature2": "Desktop Capture allows you to clip anything, anywhere, anytime. ",
          "momentsFeature4": "Rocket League is adding 3 new Auto-clip events - Assist, Demolition, Epic Save",
          "momentsIntro": "Moments has added exciting new features and expanded our Auto-clip enabled games and events in the last few updates. You have asked for more control over what you capture and how you capture gameplay - and we have heard your demands and are giving it to you!",
          "sonarFeature1": "Mixer design just got cleaner. We noticed that you didn’t use target device and levels that often, so we placed it in a menu that you can reveal by clicking the cog icon for each audio stream.",
          "sonarFeature2": "All your audio is now Hi-Res for even better sound! Game and Chat are 24 bit-96KHz and Microphone is 24bit-48Hz)",
          "sonarFeature3": "New game presets for a improved cinematic experience: World of Warcraft, Brawlhalla, Lost Ark, Ark survival evolved, Valheim, Genshin Impact, War Thunder, Fall Guys, Elden Ring, Monster Hunter World, Monster Hunter Rise, Raft, Sea of Thieves and Rocket League.",
          "sonarFeature4": "Preset search for both game, chat and mic. Simply click the drop down and type to search.",
          "sonarFeature5": "Spatial audio is now available for all you who prefer using speakers while gaming. Toggle between headset or speakers in the Spatial Audio settings widget.",
          "sonarFeature6": "When you unplug your primary audio device, Sonar will now fallback to your next available device.",
          "sonarIntro1": "This past month we've shipped a bunch of updates to improve your sound quality and give you more choice in presets, see below for details. ",
          "sonarIntro2": "We also want to say thank you for the overwhelming positive feedback we’ve received from all of you 🎉. We can’t believe that hundreds of thousands of gamers have begun using Sonar every day. More is coming, stay tuned.",
          "welcomeIntro": "Welcome to our new \"What's New\" window. We will highlight key features of every new GG release so you're always up-to-date. In this first \"What's New\" you will find some highlights of the biggest updates from the last few releases. ",
          "welcomeTitle": "What's New"
        },
        "viewReleaseNotes": "View Release Notes"
      }
    },
    "giveaways": {
      "discord": {
        "join": {
          "caption": "Join our Discord for giveaways"
        }
      },
      "newsletter": {
        "emailExample": "you@example.com",
        "emailPlaceholder": "type your email address here",
        "invalidEmail": "Please format your email like this:",
        "pitch": "Be notified of new game giveaways",
        "thankYou": "Thank you for signing up to our newsletter!"
      }
    },
    "hapticVibrations": {
      "gamesense": {
        "fastHeartbeat": "Fast Heartbeat",
        "sadTrombone": "Sad Trombone",
        "slowHeartbeat": "Slow Heartbeat"
      },
      "rumbleOnClick": {
        "buzz": "Buzz",
        "buzzAlert750": "Long Buzz",
        "doubleClick": "Double Click",
        "pulsingStrong": "Pulsing",
        "sharpClick": "Sharp Click",
        "sharpTick": "Sharp Tick",
        "shortDoubleClickStrong": "Short Double Click",
        "softBump": "Soft Bump",
        "strongClick": "Strong Click",
        "tripleClick": "Triple Click"
      }
    },
    "homepage": {
      "footer": {
        "enterEmail": "Enter your email here.",
        "followOnSocial": "Join our community",
        "newsletterConfirmation1": "Thank you for signing up to our newsletter!",
        "newsletterConfirmation2": "Please check your email to confirm your signup.",
        "newsletterDescription": "Join our newsletter and be the first to hear about new products and sales. Plus 10% off your purchase for new subscribers.",
        "otherPolicies": "Other Policies",
        "privacyPolicy": "Privacy Policy",
        "scrollToTopTooltip": "Top of page",
        "socialDescription": "Giveaways, gaming, gear... it's all here:",
        "subscribeToNewsletter": "Get 10% off your purchase",
        "support": "Support"
      },
      "sonarStreamerOptIn": {
        "BetaInfo1": "Streaming games occasionally or regularly. (No pressure, no need to be a PRO)",
        "BetaInfo2": "Willing to share feedback in surveys and on Discord.",
        "ClickBelowLabelSonarActive": "If that sounds like you click below.",
        "ClickBelowLabelSonarInactive": "Please active Sonar first and come back to activate your beta.",
        "Description": "We are building something exciting for our streamer community. We are looking for people to test our beta who are :",
        "OptInButtonLabelSonarActive": "Join BETA",
        "OptInButtonLabelSonarInactive": "Activate Sonar",
        "Title1": "Sonar streamer mode",
        "Title2": "beta activation"
      }
    },
    "loadouts": {
      "arctisCompanionPopupAppName": "Arctis Companion App",
      "arctisCompanionPopupCTA": "Fast access to custom sound settings from your smartphone with the #APP_NAME#. Enjoy superior gameplay on console or on the go.",
      "audioConflict": {
        "autoFixHeader": "Auto-fix Engine vs. Sonar audio conflict",
        "banner1": "Engine vs. Sonar Audio Conflict:",
        "banner2": "Resolve",
        "content": "Sonar and Engine equalizers are currently conflicting. GG will automatically set the Engine on-device 2.4gHz equalizer to ‘Flat’ while Sonar is enabled.",
        "doNotShowCheckbox": "Do not show message again",
        "ignore": "Ignore",
        "ignoreContent": "Dismissing this notification will not resolve the Engine 2.4gHz and Sonar Game VAD audio processing issue. ",
        "ignoreHeader": "Engine vs Sonar audio conflict",
        "ignoreTitle": "Ignore Audio Conflict?",
        "title": "Audio Conflict"
      },
      "chatMix": {
        "tooltip": {
          "finiteWheel": "Please use your hardware dial to control ChatMix"
        }
      },
      "deleteModal": {
        "deviceWarningTextBody": "Deleting this QuickSet Profile will also delete the #PROFILE_NAME# configuration on your device.",
        "multipleDevicesWarningTextBody": "Deleting this QuickSet Profile will also delete the #PROFILE_NAME# configuration on your devices.",
        "multipleProfileWarningTextBody": "Your #PROFILE_NAME# device configuration is linked to multiple QuickSet Profiles. Deleting this profile will not remove your #PROFILE_NAME# configuration from your device.",
        "textBody": "Deleting this QuickSet Profile will remove any configurations you have previously setup and will no longer auto-switch with game.",
        "title": "Delete QuickSet Profile"
      },
      "discord": {
        "join": {
          "caption": "Join our Discord server"
        }
      },
      "engineCard": {
        "activeConfigTitle": "Active Config",
        "aimToolsFirmwareUpdateDescription": "Unlock Aim Tools and powerful features designed to improve your aim.",
        "configurations": "Configurations",
        "createFromPreset": "Create from preset",
        "noSelectedLoadout": "No valid QuickSet Profile selected. Select a profile above to edit.",
        "plainTooltip": {
          "generic": {
            "title": "Engine device settings"
          },
          "onDevice": {
            "title": "Engine on-device settings"
          },
          "sensitivityTools": {
            "title": "Aim Tools"
          }
        },
        "presetAvailable": "Preset Available",
        "presetTooltip": {
          "line1": "Presets may customize Rapid Trigger, Protection Mode, Rapid Tap, and actuation levels of crucial control keys.",
          "line2": "Based on default in-game key binds. Edit the preset in the device configuration window."
        },
        "presets": "Presets",
        "richTooltip": {
          "audio": {
            "text": "Save all your settings directly to the headset: presets, mic sidetone, lighting, power and Bluetooth options. Ideal when you use your headset on console or on the go."
          },
          "generic": {
            "title": "Set up your Device"
          },
          "onDevice": {
            "title": "On‑Device Controls"
          },
          "sensitivityTools": {
            "title": "Improve your Aim in shooter games"
          }
        }
      },
      "feedbackDialog": {
        "body": "Your feedback will directly help us improve the audio features you use every day.",
        "title": "Got a moment?"
      },
      "ftueBanner": {
        "subtitle": "Play Games. Not Settings.",
        "title": "Enable QuickSet Profiles"
      },
      "gameLibrary": {
        "addGame": {
          "addManually": "Add Manually"
        },
        "customProfileExampleText": "Ex. FPS, MOBA, Study, Movie etc.",
        "customProfiles": "Custom Profiles",
        "delete": {
          "deleteButton": "Delete",
          "dialogContent": "Deleting this game will also delete any associated QuickSet Profiles.",
          "dialogTitle": "Delete game",
          "doNotShowCheckbox": "Do not show this message again"
        },
        "filters": {
          "configuredProfiles": "Configured Profiles"
        },
        "gameProfiles": "Game Profiles",
        "gameScan": {
          "scanForGames": "Scan for games",
          "scanning": "Scanning..."
        },
        "maxFavDetails": "Please remove a QuickSet Profile in order to add more.",
        "maxFavTitle": "Maximum number of favorites reached",
        "presetsAvailable": "Presets Available",
        "searchBar": {
          "placeholderText": "Search games..."
        },
        "title": "My Games",
        "uninstalled": "Uninstalled"
      },
      "mainPage": {
        "activeLoadout": {
          "headerText": "Live"
        },
        "assignShortcut": "Assign Shortcut",
        "browseGamesButtonHeader": "My Games",
        "headerText": "QuickSet",
        "quicksetProfiles": "QuickSet Profiles",
        "runningGame": "Running Game"
      },
      "npsNotificationCTA": "Enjoying your #DEVICE_NAME#?",
      "npsNotificationLinkText": "Give your feedback",
      "onboardingModal": {
        "endStep": {
          "subtitle": "Get started with profiles now",
          "textContent1": "We found your installed games!",
          "textContent2": "Now get started adding and customizing your QuickSet Profiles."
        },
        "presetsStep": {
          "engineToggle": {
            "description": "Keyboard presets utilize per-key actuation, Rapid Tap, Protection Mode, and Rapid Trigger to give you the competitive edge.",
            "title": "Keyboard presets (SteelSeries Apex Pro keyboards only)"
          },
          "mouseToggle": {
            "description": "Mouse presets optimize DPI, polling rate, and sensor behavior to deliver consistent performance and responsive aiming.",
            "title": "Mouse presets"
          },
          "sonarToggle": {
            "description": "EQ presets are designed by sound engineers with input from pro players and game developers to give you a leg up on the competition. ",
            "title": "Sonar game equalizers"
          },
          "subtitle": "GAME PRESETS TO GIVE YOU THE COMPETITIVE EDGE",
          "textContent1": "Automatically assign presets to eligible profiles for:",
          "textContent2": "Strafe faster, get that ultimate off at the perfect time, and avoid accidental key presses.",
          "toggleText": "Automatically assign keyboard presets to eligible profiles"
        },
        "profilesStep": {
          "subtitle": "EASY ACCESS TO YOUR QUICKSET PROFILES",
          "textContent1": "Once created, QuickSet Profiles are available at the top of the page for easy access and quick adjustments.",
          "textContent2": "Select the games you want to create profiles for, and use the ‘default’ Desktop profile when you are not gaming. "
        },
        "welcomeStep": {
          "subtitle": "YOUR GAMES. YOUR SETTINGS. AUTO-SWITCHED.",
          "textContent": "Create profiles for your favorite games so you can quickly change settings when you are gaming.",
          "textContent2": "Profiles can automatically launch when you start a game, or you can manually switch them quickly with shortcut keys.",
          "textContent3": "Play games. Not Settings.",
          "title": "Welcome to QuickSet"
        }
      },
      "overlays": {
        "loadoutSwitched": {
          "content": "#PROFILENAME# profile is now active",
          "title": "QuickSet Profile Switched"
        }
      },
      "preset": {
        "tooltip": {
          "apexProKeyboard": "Apex Pro Keyboard Preset",
          "engine": "Engine Preset",
          "mouse": "SteelSeries Mouse Preset",
          "sonar": "Sonar EQ Preset"
        }
      },
      "prism": {
        "enableNote": "Enable Prism lighting"
      },
      "prismCard": {
        "tooltipText": "While auto-assign will work for the majority of games, some titles do not support auto-assignment. Please ensure you’ve selected your preferred Sonar game EQ preset."
      },
      "profileBar": {
        "settings": {
          "advancedQuickSetSettings": "Advanced QuickSet Settings"
        }
      },
      "profilesBar": {
        "addTooltip": "Add new QuickSet profile",
        "clickToEnableProfiles": "Click '+' to enable QuickSet profiles",
        "enableToConfigure": "Enable QuickSet Profiles to configure",
        "overflowTooltip": "View more QuickSet profiles"
      },
      "settings": {
        "autoSwitchLoadout": {
          "label": "Auto-switch QuickSet Profile",
          "tooltip": "When toggled on, QuickSet Profiles will automatically switch when games are launched."
        },
        "overlaysNotifications": {
          "description": "QuickSet will display an overlay notification to let you know that an event has taken place",
          "displayOverlays": "Display Overlays",
          "loadoutSwitched": {
            "description": "Turn on & off screen overlays to notify you that QuickSet Profiles are switching.",
            "title": "QuickSet Profile Switched"
          },
          "loadoutSwitchedAuto": {
            "title": "Auto-switching QuickSet Profiles"
          },
          "loadoutSwitchedManual": {
            "title": "Manually switching QuickSet Profiles"
          },
          "loadoutSwitchedShortcut": {
            "title": "Profile switch via a shortcut"
          },
          "title": "Overlays and Notifications"
        },
        "presets": {
          "autoApplyPresets": {
            "description": "QuickSet will automatically assign device presets to devices on eligible game profiles.",
            "engine": {
              "description": "Keyboard presets utilize per-key actuation, Rapid Tap, Protection Mode, and Rapid Trigger to give you the competitive edge.",
              "title": "Keyboard presets"
            },
            "mouse": {
              "description": "Mouse presets optimize DPI, polling rate, and sensor behavior to deliver consistent performance and responsive aiming.",
              "title": "Mouse presets"
            },
            "sonar": {
              "description": "EQ presets are designed by sound engineers with input from pro players and game developers to give you a leg up on the competition.",
              "title": "Sonar game presets"
            },
            "title": "Automatically apply presets"
          },
          "title": "Presets"
        },
        "quicksetProfilesEnabled": {
          "label": "Enable Profiles"
        },
        "shortcuts": {
          "alreadyUsed": "QuickSet shortcut already assigned",
          "moreDetails": "Define your keybinds for deploying QuickSet profiles. Shortcuts can use modifiers like Ctrl, Shift, Alt or a single key press. If Moments and/or Sonar is on please be mindful not to set the same shortcuts.",
          "profilePlaceholder": "Assign Profile",
          "selectProfileBeforeShortcut": "Select profile from dropdown to assign shortcut",
          "sidenavTitle": "Shortcuts",
          "title": "QuickSet Shortcuts"
        },
        "title": "QuickSet"
      },
      "sideNav": {
        "title": "QuickSet"
      },
      "sonar": {
        "fixDefaultDeviceBanner": {
          "actionLabel": "Fix it",
          "message": "Sonar not set as Windows default device:"
        },
        "isntFullySetUp": {
          "engine": "Keep using Engine only",
          "message": "Sonar isn't fully set up yet.",
          "or": "or",
          "sonar": "Finish the setup"
        },
        "noSubApp": {
          "enableSubApp": "Turn on Sonar"
        },
        "targetDeviceBanner": {
          "actionLabel": "Switch it",
          "message": "Not currently set as Sonar device:"
        },
        "targetDeviceModal": {
          "bothOption": "Switch both output and input",
          "contentTitle": "Your device #DEVICE_NAME# is not selected in Sonar. We recommend you switch it for the most optimal experience.",
          "dismissCheckbox": "Dismiss for 30 days",
          "modalTitle": "Device not configured for Sonar",
          "onlyInputOption": "Switch input only",
          "onlyOutputOption": "Switch output only"
        }
      },
      "sonarCard": {
        "gamePreset": "Game preset",
        "noFavorites": "No favorites",
        "plainTooltip": {
          "title": "Sonar PC Audio Suite"
        },
        "richTooltip": {
          "text": "Keep audio settings on your PC for advanced control: ChatMix, presets, ClearCast AI noise reduction, audio mixer, spatial audio and more. Ideal when you game on PC and want fast tweaks mid‑match.",
          "title": "Powerful PC Audio"
        }
      },
      "topNav": {
        "beta": {
          "message": "Help us make QuickSet better!"
        }
      }
    },
    "login": {
      "createAccount": {
        "confirmPasswordPlaceholder": "re-type your password",
        "createAccount": "Create Account",
        "emailPlaceholder": "type your email address",
        "newsletter": "Keep me up to date about new products, discounts, and more by subscribing to the SteelSeries newsletter",
        "passwordPlaceholder": "type your password",
        "passwordRules": {
          "length": "Must contain at least 8 characters",
          "noCommon": "Cannot be a commonly used password",
          "numeric": "Cannot be only numbers",
          "title": "Password Safety Requirements"
        },
        "pleaseRead": "Please read and accept our",
        "privacyPolicy": "Privacy Policy",
        "skipStep": "Skip this step for now",
        "title": "Become a SteelSeries member!"
      },
      "errors": {
        "emailRequired": "Email is required",
        "incorrectPassword": "Incorrect password, try typing it again",
        "invalidEmail": "Please format your email address like this: you@example.com",
        "maxLengthPassword": "Password is over 1000 characters",
        "minLengthPassword": "Password is too short",
        "numericPassword": "Password can’t only be numbers",
        "passwordMismatch": "Typed passwords do not match",
        "passwordRequired": "Password is required",
        "passwordTooCommon": "Password too common, use a more obscure password",
        "privacyPolicy": "You must accept the Privacy Policy to continue",
        "tooManyRequests": "We’re getting too many requests from you, try again in a minute",
        "tryAgainLater": "Our service is having trouble responding, try again in minute or skip for now",
        "uniqueEmail": "There is already a SteelSeries account associated with this email address. Login to an existing account.",
        "uniqueEmail3DAT": "An account associated with this email already exists. Login with your 3D Aim Trainer credentials."
      },
      "login": {
        "emailPlaceholder": "type your email address",
        "passwordPlaceholder": "type your password",
        "title": "Welcome back!"
      },
      "modal": {
        "createAccountButton": "Create account",
        "loginButton": "Login",
        "subtitle": "Use your SteelSeries account to access Moments, Sonar, game giveaways and more.",
        "title": "Let’s get started!"
      },
      "skipSignupModal": {
        "backButton": "Back to registration",
        "content": "You need a registered SteelSeries account to create gameplay clips with Moments, customize your audio with Sonar or get access to the latest game giveaways.",
        "contentNoMoments": "You need a registered SteelSeries account to use Moments, Sonar or access game giveaways.",
        "continueButton": "Continue anyway",
        "title": "Skip registration?"
      },
      "welcome": {
        "createAccountButton": "I don't have a SteelSeries account",
        "helpBody": "Use your steelseries.com or games.steelseries.com account to log in. Otherwise, you can quickly and easily sign up.",
        "helpTitle": "Do you have an account?",
        "loginButton": "I have a SteelSeries account",
        "subtitle": "Choose the right path for you to continue",
        "title": "So hyped you're here!"
      }
    },
    "macroEditor": {
      "customActions": "Macros",
      "deactivationMode": "Deactivate",
      "defaultActions": "Default",
      "delayOptions": {
        "asIs": "As Recorded",
        "custom": "Custom Delay",
        "customDialog": {
          "text": "Delay Length (ms):",
          "title": "Fixed Delay"
        },
        "fixed": "Fixed Delay",
        "noDelay": "No Delay",
        "title": "Delay Options"
      },
      "deleteMacro": "Delete Macro",
      "insertDelay": "Insert Delay",
      "keyboardAction": {
        "alphanumeric": "ALPHANUMERIC",
        "arrows": "ARROWS",
        "commands": "COMMANDS",
        "editing": "EDITING",
        "extraFunction": "FUNCTION",
        "function": "FUNCTION",
        "modifiers": "MODIFIERS",
        "navigation": "NAVIGATION",
        "numpad": "NUMPAD",
        "symbols": "SYMBOLS",
        "typingMode": "TYPING MODE"
      },
      "keyboardActions": "Keyboard Buttons",
      "keypressMacro": "Keypress Macro",
      "limitModals": {
        "idleTimeText": "Recording automatically stops after two minutes of inactivity.",
        "maxEventsText": "Recording automatically stops when the maximum number of events (MAX_EVENTS) is reached.",
        "title": "Recording Stopped"
      },
      "macros": "Macros",
      "mediaAction": {
        "mute": "Mute",
        "next": "Next",
        "playPause": "Play/Pause",
        "previous": "Previous",
        "volumeDown": "Volume Down",
        "volumeUp": "Volume Up"
      },
      "mediaActions": "Media Buttons",
      "metaAction": {
        "actuationDown": "Actuation Level Down",
        "actuationUp": "Actuation Level Up",
        "bluetoothProfiles": "Bluetooth Profiles 1/2/3",
        "brightnessDown": "Brightness Down",
        "brightnessUp": "Brightness Up",
        "gamingMode": "Gaming Mode",
        "metaLayer": "Meta Layer",
        "toggleRapidTap": "Toggle Rapid Tap",
        "toggleRapidTrigger": "Toggle Rapid Trigger",
        "typingMode": "Typing Mode",
        "windowsKeyLock": "Windows Key Lock"
      },
      "metaActions": "Keyboard Functions",
      "modalRenameMacroText": "Macro Name:",
      "modalText": "Are you sure you want to delete macro MACRO_NAME?",
      "mouseButton": {
        "acPanLeft": "Tilt Left",
        "acPanRight": "Tilt Right",
        "button1": "Button 1",
        "button10": "Button 10",
        "button11": "Button 11",
        "button12": "Button 12",
        "button13": "Button 13",
        "button2": "Button 2",
        "button3": "Button 3",
        "button4": "Button 4",
        "button5": "Button 5",
        "button6": "Button 6",
        "button7": "Button 7",
        "button8": "Button 8",
        "button9": "Button 9",
        "cpiToggle": "CPI Toggle",
        "dpiToggle": "DPI Toggle",
        "scrollDown": "Scroll Down",
        "scrollUp": "Scroll Up",
        "sideButton1": "Side Button 1",
        "sideButton10": "Side Button 10",
        "sideButton11": "Side Button 11",
        "sideButton12": "Side Button 12",
        "sideButton2": "Side Button 2",
        "sideButton3": "Side Button 3",
        "sideButton4": "Side Button 4",
        "sideButton5": "Side Button 5",
        "sideButton6": "Side Button 6",
        "sideButton7": "Side Button 7",
        "sideButton8": "Side Button 8",
        "sideButton9": "Side Button 9"
      },
      "mouseButtons": "Mouse Buttons",
      "openEditor": "Open Macro Editor",
      "quickSet": {
        "manage": "Manage",
        "new": "New"
      },
      "recordPlaceholder": "Click to record",
      "renameMacro": "Rename Macro",
      "sendKey": "Send Key",
      "startKey": "Start Key",
      "textMacro": "Text Macro",
      "textMacroPlaceholder": "Enter script...",
      "typeInfoKeypress": "Create a Keypress Macro to record button presses from your mouse and keyboard. They will simulate button presses when used in a game.",
      "typeInfoText": "Text Macros will paste your own scripts or text into a game. They can be used for chat, console commands, or any program where clipboard is enabled.",
      "windowTitle": "Macro Editor"
    },
    "main": {
      "about": "About",
      "aboutHeader": "About DEVICE_NAME",
      "addADevice": "Add a Device",
      "advanced": "Advanced",
      "aerox3WirelessDongleUpdate": {
        "line1": "Your mouse has been updated; however, it will not function wirelessly until the next step of the update has completed.",
        "line2": "To begin the next step, unplug the USB cable from your mouse and plug it into the extension adapter. Connect the extension adapter to your dongle.",
        "line3": "Since your mouse is disconnected, simply press [Enter] on your keyboard to initiate the next step of the firmware update."
      },
      "analytics": {
        "installer": {
          "mac": {
            "privacyText": "By continuing the installation, you are agreeing to the terms of our privacy policy."
          },
          "windows": {
            "privacyText": "If you accept the terms of the agreement and the privacy policy, click I Agree to continue. You must accept the agreement to install $(^NameDA)."
          }
        }
      },
      "appId": "App ID",
      "appSettings": {
        "analytics": {
          "anonymous": "All usage statistics and error reports are sent anonymously.",
          "contributeToDevelopment": "Contribute to the development of SteelSeries software and devices.",
          "label": "Help make Engine better by automatically sending usage statistics and error reports to SteelSeries.",
          "learnMore": "Learn More",
          "usageStats": "Usage Stats"
        },
        "newSetting": "New Setting"
      },
      "appsTab": "My Apps",
      "appsettings": {
        "disableNotification": {
          "title": "Disable taskbar notifications"
        },
        "downloadPreference": {
          "downloadAndInstall": {
            "title": "Automatically download and install updates"
          },
          "downloadFirst": {
            "title": "Automatically download updates"
          },
          "notifyFirst": {
            "title": "Ask before downloading updates"
          }
        },
        "installUpdatesOnStartup": {
          "title": "Install updates on startup when availalbe"
        }
      },
      "backgroundInstall": {
        "downloadProgress": "Download Progress",
        "installCompleted": "Your installation completed successfully",
        "installFailed": "An error occurred. Please try again later.",
        "installingCheckTaskbar": "Installing.  Please check the taskbar below for any installation approvals."
      },
      "betaFirmwareAvailable": "Beta Firmware Available",
      "bluetooth": "Bluetooth",
      "bluetoothReconnectHeader": "Important",
      "bluetoothReconnectText": "The Bluetooth interface has been improved with this update. After the firmware update is completed, you will need to remove the Bluetooth device from your computer and then re-pair it.",
      "bluetoothVersionNumber": "Bluetooth Version: ",
      "bluetoothconnected": "Bluetooth Connected",
      "case": "Case",
      "caseVersion": "Case Version",
      "chargeMode": {
        "charged": "Charged",
        "charging": "Charging",
        "remaining": "Remaining"
      },
      "cloud": {
        "logInCallout": "Click the cloud icon to log in to CloudSync.",
        "usernameHelpTooltip": "Log in with the same email and password that you used to register for a SteelSeries ID on the SteelSeries website.  If you do not have a SteelSeries ID,<a href=\"CLOUD_REGISTER_URL\" rel=\"external\">register first</a> and then log in here to access CloudSync features."
      },
      "cloudIntro": {
        "description": "Back up your data to cloud storage and sync between computers automatically.",
        "haveLogin": "Already have a SteelSeries ID?",
        "instructions": "Log in with your SteelSeries ID to access SteelSeries CloudSync features.",
        "stepLogIn": "2. Log in",
        "stepRegister": "1. Register",
        "summary": "Bring your configurations and macros with you wherever you game."
      },
      "codec": "Codec",
      "configurationLabel": "Configuration",
      "connectDevice": {
        "notSeeing": "Not seeing your gear? Is it connected via",
        "pleaseConnect": "Please Connect A SteelSeries Engine enabled device.",
        "viaAnalogQuestionMark": "Audio Jack?",
        "viaBluetoothQuestionMark": "Bluetooth?",
        "viaUsbQuestionMark": "USB?"
      },
      "copiedExclamation": "Copied!",
      "copiedToClipboard": "Copied to clipboard!",
      "copyLink": "Click to copy",
      "devicePowerCycleTitle": "Device Power Cycle Required",
      "deviceRecovery": {
        "mainWindowInfoText": "Looks like one of your devices is not functioning properly. Would you like to attempt recovery?",
        "mainWindowTitle": "Device Recovery",
        "noSSDevices": "None",
        "recoveryFailedText": "Failed to restore your #DEVICENAME#.",
        "recoveryFailedTitle": "Recovery Failed"
      },
      "dsp": "DSP",
      "dspVersionNumber": "DSP Version:",
      "engineApps": {
        "author": "by #AUTHOR#",
        "demo": {
          "description": "Visit our <a href=\"https://steelseries.com/developer\" rel=\"external\">Developer Portal</a> to learn how you can make your very own app for SteelSeries Engine.",
          "title": "Make Your Own App"
        },
        "description": "Applications that interact with your SteelSeries devices.",
        "noSupportedDeviceConnected": {
          "title": "Unsupported Device"
        },
        "title": "Apps"
      },
      "externalSoftwareBadge": "CRITICAL UPDATE: Additional software for this device is required. Click here to install.",
      "externalSoftwareBadgeNoncritical": "Additional software for this device is required. Click here to install.",
      "externalSoftwareBadgeWithoutInstall": "Additional software for this device is required.",
      "firmwareErrorPowerCycleArenaMessage": "The #DEVICE_NAME# requires a power cycle. Please flip the power switch on the back of the subwoofer off, wait 5 seconds, and then back on again.",
      "firmwareErrorPowerCycleSubwooferMessage": "An error occurred during the firmware update. Please power cycle the subwoofer before retrying the firmware update.",
      "firmwareUpdateAdditionalTextMouseBase": "If you cannot update your base now, press Update Later. You will be asked to update it next time you connect the base.",
      "firmwareUpdateBootloaderModeHeader": "Firmware Update Failed",
      "firmwareUpdateBootloaderModeTextLine1": "The last firmware update for your #DEVICE_NAME# failed.  Your device will be unusable until you run the updater again. Click Start to begin.",
      "firmwareUpdateBootloaderModeTextLine2": " If you do not want to run the update now, please unplug your device.",
      "firmwareUpdateCloseCase": "Step 4",
      "firmwareUpdateComplete": "Update complete. Please disconnect and reconnect your device to finish the process.",
      "firmwareUpdateCompleteKeyboard": "Update is complete.  Please keep the USB-C cable attached to the keyboard for 90 seconds while the keyboard restarts.",
      "firmwareUpdateCompleteShort": "Update complete.",
      "firmwareUpdateCompleteTurnOnHeadset": "Update complete. Please power back on the headset.",
      "firmwareUpdateConnectCase": "Step 2",
      "firmwareUpdateConnectDongle": "Step 1",
      "firmwareUpdateConnectHeadset": "Step 3",
      "firmwareUpdateConnectMouseDongleWireless": "Make sure your wireless dongle is plugged into your PC and your mouse is turned on in 2.4 wireless mode. Unplug your mouse from the PC.",
      "firmwareUpdateConnectUSB": "Open the panel on the back of the controller and remove the batteries. Use the port inside to connect the controller to your computer using a Micro USB cable.",
      "firmwareUpdateDeviceSpecific": {
        "arctisProWirelessRePairText": "Please go into the pairing menu on your transmitter's OLED screen (OPTIONS -> PAIRING) and follow the on-screen instructions to re-pair your headset with the transmitter."
      },
      "firmwareUpdateEnsureKeyboardDongleConnected": "Make sure your wireless dongle is plugged in to your PC via USB cable, and your keyboard is turned on. Unplug your keyboard from the PC.",
      "firmwareUpdateEnsureMouseDongleConnected": "Make sure your wireless dongle is plugged in to your PC via USB cable, and your mouse is turned on. Unplug your mouse from the PC.",
      "firmwareUpdateFailure": "An error occurred that prevented the successful completion of the firmware update.",
      "firmwareUpdateHeader": "Firmware Update",
      "firmwareUpdateHowToCloseCase": "Close the Charging Case Lid",
      "firmwareUpdateHowToConnectCase": "Connect the Charging Case to the PC with the USB-C Cable",
      "firmwareUpdateHowToConnectDongle": "Connect the dongle to the PC",
      "firmwareUpdateHowToConnectHeadset": "Ensure both the Left & Right earbud is in the Charging Case",
      "firmwareUpdateLater": "Update Later",
      "firmwareUpdateLowBattery": "The current battery level on your device is too low to safely perform a firmware update.",
      "firmwareUpdateNotCompatibleMac": "Firmware updating is currently not supported on Mac. Please proceed with the update on a Windows 10 or later PC.",
      "firmwareUpdatePlugDongle": "Please ensure the wireless dongle is connected to your PC via USB cable. Once ready, click Start to continue. The update process may take a few minutes.",
      "firmwareUpdatePlugDonglePlugKeyboard": "To continue please do the following:<br>1. Plug in the dongle to your PC<br>2. Connect the keyboard to the PC using a USB cable<br>3. Turn off the keyboard 2.4g and bluetooth connection by putting the keyboard connection toggle (located beside the USB C input) in the center position<br><br>Then, click 'START' or press 'ENTER' on the keyboard to proceed.",
      "firmwareUpdateRePairBluetooth": "The new firmware was successfully installed. To complete the update, you must unplug the controller and replace the batteries. Then, open the Bluetooth Menu. Select the controller from the list of Bluetooth devices, and then press the Remove button. Finally, re-pair the controller.",
      "firmwareUpdateRePairDevice1": "1. Turn the mouse off",
      "firmwareUpdateRePairDevice2": "2. Disconnect the cable from the mouse",
      "firmwareUpdateRePairDevice3": "3. Plug the cable into the base",
      "firmwareUpdateRePairDevice4": "4. Turn the mouse on",
      "firmwareUpdateRePairDevice5": "5. Press the connect button on the base until the ring flashes",
      "firmwareUpdateRePairDevice6": "6. Press the connect button on the mouse until it changes color",
      "firmwareUpdateRePairDeviceHeader": "Attention: Your #DEVICE_NAME# must be re‑paired.",
      "firmwareUpdateReconnectDeviceHeader": "Attention: Your #DEVICE_NAME# must be reconnected.",
      "firmwareUpdateRequired": "Firmware Update Required",
      "firmwareUpdateRequiredForDevice": "Your #DEVICE# needs an update before you can customize it.<br><br>Update firmware now?",
      "firmwareUpdateRequiredText": "Update your device to access its configuration. Install the required firmware to ensure all settings work correctly.",
      "firmwareUpdateText": "During firmware installation, do not unplug your device, turn off your computer or exit the software. This may result in the device becoming unusable.",
      "firmwareUpdateTextV2": "Please ensure your device has at least 15% battery remaining and avoid unplugging it, turning off your computer, or closing the software during the firmware update. The process may take a few minutes to complete.",
      "firmwareUpdateUnplugDonglePlugKeyboard": "Unplug your wireless dongle from the USB cable and then use the same cable to plug in your keyboard.",
      "firmwareUpdateUnplugDonglePlugMouse": "Unplug your wireless dongle from the USB cable and then use the same cable to plug in your mouse.",
      "firmwareUpdateUnplugKeyboardPlugDongle": "To continue, please ensure the wireless dongle is plugged in to your PC via USB cable, and your keyboard is unplugged and powered off. Then, click Start to proceed.",
      "firmwareUpdateUnplugMousePlugDongle": "To continue, please ensure the wireless dongle is plugged in to your PC via USB cable, and your mouse is unplugged and powered off. Then, press [Enter] on your keyboard to proceed.",
      "firmwareUpdateWirelessMouse": "You can continue using your mouse and it will briefly reset when the update completes.",
      "firmwareUpdating": "Updating…",
      "firmwareUpdatingBluetooth": "Updating Bluetooth",
      "firmwareUpdatingCaseMcu": "Updating case MCU",
      "firmwareUpdatingController": "Updating Controller",
      "firmwareUpdatingDock": "Updating Wireless Base Station",
      "firmwareUpdatingDongleMcu": "Updating dongle MCU",
      "firmwareUpdatingDongleMcuOne": "Updating dongle MCU 1",
      "firmwareUpdatingDongleMcuTwo": "Updating dongle MCU 2",
      "firmwareUpdatingDsp": "Updating DSP",
      "firmwareUpdatingHeadsetMcu": "Updating headset MCU",
      "firmwareUpdatingLeftHeadsetMcu": "Updating left headset MCU",
      "firmwareUpdatingRightHeadsetMcu": "Updating right headset MCU",
      "firmwareValidatingVersionInfo": "Validating device firmware version information",
      "firmwareVersionNumber": "Firmware Version:",
      "fwUpdateBadge": "CRITICAL UPDATE: Click to install new firmware.",
      "gameSense": {
        "app": {
          "audiovisualizer": {
            "description": "Watch while you listen.  Render your audio spectrum dynamically across supported Prism devices."
          },
          "configure": "Configure #GAME#",
          "description": "Use your SteelSeries hardware to display game state information from #GAME_NAME#.",
          "discord": {
            "description": "Display custom effects on your devices from events in Discord. Notifications, users joining voice channel, self mute and more are supported.",
            "download": "Download Discord to get started"
          },
          "nowplaying": {
            "description": "Displays currently playing media information on your SteelSeries device’s OLED screen. Optimized for Windows 11."
          },
          "spotify": {
            "description": "Display information on your devices about tracks playing in Spotify.",
            "download": "Download Spotify to get started"
          },
          "stats": {
            "description": "Display real-time system information on your device hardware such as GPU utilization, CPU clock speed and more."
          },
          "tidal": {
            "description": "Display information on your devices about tracks playing in TIDAL.",
            "download": "Start free trial or download now"
          }
        },
        "checkOut": "Click here to customize your GameSense settings.",
        "csgo": {
          "autoStart": "GameSense will automatically start at the beginning of a match",
          "headline": "GameSense and CS:GO",
          "open": "Start playing CS:GO"
        },
        "details1": "Using GameSense",
        "details2": "GameSense and CS:GO",
        "details3": "GameSense and Minecraft",
        "details4": "Supported Devices",
        "details5": "<a href=\"GAMESENSE_DEVICES_URL\" rel=\"external\">See a full list</a> of all devices supported by GameSense.",
        "details6": "Are you a developer?",
        "details7": "Support GameSense in your game. <a href=\"GAMESENSE_DEVSUPPORT_URL\" rel=\"external\">Learn how.</a>",
        "general": {
          "customize": "Customize GameSense in SteelSeries Engine 3",
          "proTip": "Tip: GameSense will work as long as SteelSeries Engine 3 is running in the background.",
          "supported": "Plug in one of these <a href=\"GAMESENSE_DEVICES_URL\" rel=\"external\">supported devices</a>"
        },
        "minecraft": {
          "autoStart": "GameSense will automatically start when your Minecraft world loads",
          "headline": "GameSense and Minecraft",
          "modDl": "<a href=\"GAMESENSE_MINECRAFTMODDL_URL\" rel=\"external\">Download and install</a> the GameSense Minecraft Mod",
          "modInstall": "Start playing Minecraft"
        },
        "splash1": "Your SteelSeries devices now respond to your games in real time with our latest feature.",
        "splash2": "Currently supporting CS:GO and Minecraft"
      },
      "gearTab": "Gear",
      "goToEngine": "Go To Engine",
      "headsetFwVersion": "Headset Version:",
      "headsetRecovery": {
        "confirmHeadset": "You are about to run recovery for <b>#DEVICENAME#</b>.<br><br>Are you sure this is the correct device?",
        "confirmationTitle": "Recover #DEVICENAME#?",
        "mainWindowInfo": "An update on your headset had a problem, and Engine needs to run a recovery task in order for it to work properly again.",
        "progressInfo": "Recovering your #DEVICENAME#",
        "selectDevice": "Which of these devices do you have?",
        "successFollowUp": "Continue to finish your firmware update.",
        "successMessage": "Recovery Successful!",
        "successNoFollowUp": "Your #DEVICENAME# is all set.",
        "successTitle": "Recovery Successful",
        "successTitleFollowUp": "Update Headset",
        "title": "Recover Headset"
      },
      "help": {
        "faqsAndSetupGuides": "FAQs & Setup Guides",
        "shop": "Shop",
        "visitSupport": "Visit Support"
      },
      "hideBadge": "Hide Device",
      "hideDevice": "Are you sure you want to hide DEVICE_NAME?",
      "hideDeviceTitle": "Hide Device",
      "imageSync": {
        "aspectRatio": "Lock Aspect Ratio",
        "description": "Convert an animated GIF into an illumination effect for your Per-Key-RGB keyboard. Final animation size is 22 x 6px.",
        "displayTooltip": "Import a GIF to get started. It will be displayed in the editor, allowing you to edit it before applying it to your keyboard. To start over, use the \"New Import\" button. To export your GIF to share, use the \"Export\" button. To display the GIF on your keyboard and save it in your history, use the \"Save\" button.",
        "editPanel": "Edit Panel",
        "editor": "ImageSync Editor",
        "imageToolsTooltip": "Adjust your image to best fit your keyboard. Adjusting brightness and contrast may help improve the illumination effect of some images. Use the crop tool to change the size of your image. To set a background color for areas your image doesn't cover, use the background color tool.",
        "myGifs": "My GIFs",
        "myGifsTooltip": "This is a history of images you've created in the past that can be reused. To use a previous image, click on it, to see the animation in the frame, simply hover over the image.",
        "newUpload": "New Import",
        "presetsTooltip": "Here's a curated collection of our favorite GIFs for you to get started with.",
        "title": "ImageSync",
        "upload": "Import a GIF"
      },
      "language": {
        "de": "German",
        "en_US": "English",
        "es": "Spanish",
        "fr": "French",
        "it": "Italian",
        "ja": "Japanese",
        "ko": "Korean",
        "pt": "European Portuguese",
        "pt_br": "Brazilian Portuguese",
        "restart": "Please restart SteelSeries Engine for the language settings to take effect.",
        "ru_RU": "Russian",
        "systemDefault": "System Default",
        "text": "Language",
        "zh_hans": "Simplified Chinese",
        "zh_hant": "Traditional Chinese"
      },
      "launch": "Launch",
      "leftHeadsetMCUVersion": "Left Headset MCU Version:",
      "library": {
        "addADevice": "Add a Device",
        "addAnother": "Click here to link an application to a configuration",
        "addAnotherDevice": "Add Another Device",
        "addApplication": "Add An Application",
        "addApplicationCallout": "Did you know?",
        "addApplicationClickme": "Click here to try it out now!",
        "addApplicationDescription": "You can automatically change settings on your devices when you switch between applications.",
        "addGame": "Add A Game",
        "addTheseGames": "Add these games to your library?",
        "additionalGames": "Additional Games",
        "allDevicesSelected": "All devices for this application have been selected",
        "configExample": "Soldier",
        "configurationText": "Configurations",
        "confirmGames": "Confirm Games",
        "deleteModalText": "Are you sure you want to delete application APPLICATION_NAME?",
        "deleteModalTitle": "Delete Application",
        "empty": "Your Library Is Empty",
        "emptyPromptForScan": "Scan your computer for games or add a game to get started.",
        "favoriteGame": "Your Favorite Game",
        "featuredGames": "Featured Games",
        "featuredGamesTooltip": "Featured games have default lighting configurations that will be created and linked to the application when you confirm.",
        "headerDescription": "Automatically change settings on your devices when a game or application is in the foreground",
        "noAdditionalGamesFound": "No Additional Games Found",
        "noFeaturedGamesFound": "No Featured Games Found",
        "none": "None",
        "prismSyncLighting": "Prism lighting",
        "scanForGames": "Scan For Games",
        "scanResultsHeader": "Here are the games we found during our scan.  Select or deselect games before continuing.",
        "scanResultsTitle": "Scan Results",
        "scanningForGames": "Scanning...",
        "showMore": "Show More",
        "storefronts": {
          "appx": "Microsoft Store",
          "battlenet": "Battle.net",
          "epic": "Epic Games Launcher",
          "galaxy": "GOG Galaxy",
          "minecraft": "Minecraft Launcher",
          "mtgarena": "Magic: The Gathering Arena",
          "origin": "EA Origin",
          "riot": "Riot Games",
          "steam": "Steam",
          "twitch": "Twitch",
          "uplay": "Ubisoft Connect",
          "wargaming": "Wargaming.net",
          "windowsgameexplorer": "Windows Game Explorer"
        }
      },
      "libraryTab": "Library",
      "loginModal": {
        "login": {
          "heading": "Login to Your Account:"
        },
        "signup": {
          "heading": "First Time Here?",
          "listHeading": "With a SteelSeries account you can:",
          "listItem1": "Sync your settings across multiple computers using CloudSync.",
          "listItem2": "Activate Software Features available with your Arctis 3 headset.",
          "listItem3": "Enter exclusive contests and giveaways.",
          "listItem4": "Access support for technical issues or questions."
        }
      },
      "mcuVersionNumber": "MCU Version:",
      "mouseOff": "Mouse Off",
      "myDevices": {
        "activateLabel": "Activate a new product",
        "activateProduct": "Activate Product",
        "enterProductCode": "Enter Product Code",
        "errors": {
          "alreadyOwned": "Error: This product is already activated for your account",
          "anErrorOccurred": "Error: An error occurred",
          "invalidProductCode": "Error: Product code is invalid",
          "loginRequired": "Error: That action requires login"
        },
        "label": "My Devices",
        "listHeader": "Below is a list of all of your activated SteelSeries devices.",
        "noProductsActivated": "No products activated",
        "notSeeingProduct": "Not seeing your product?  Try activating it and/or clicking the 'Refresh' button above."
      },
      "newFeature": "New Feature",
      "newFwUpdateBadge": "Firmware update available: <u>Click to install</u>",
      "newFwUpdateBadgePart1": "Firmware update available: ",
      "newFwUpdateBadgePart2": "Click to update",
      "nextDeviceFirmwareUpdateText": "Plug the #DEVICE_NAME# into your computer with the USB cable to perform the update",
      "nextDeviceFirmwareUpdateTextToggleOff": "Plug the #DEVICE_NAME# into your computer with the USB cable to perform the first step of the update.  Toggle the Wireless Mode Switch to the \"Off\" position.",
      "nextDeviceFirmwareUpdateTextUnplugMouse": "The mouse has been updated and can now be unplugged. Plug the #DEVICE_NAME# into your computer with the USB cable to perform the update.",
      "noDevices": "Plug in a SteelSeries device to get started",
      "obsolete": {
        "engineApps": {
          "title": "Engine Apps"
        },
        "gearTab": "My Gear"
      },
      "offlineBadge": "Offline",
      "optimize": {
        "dont": "Don't optimize",
        "newHeadset": "New Headset",
        "notice": "SteelSeries Engine can optimize your listening experience based on what you have connected to the SteelSeries Soundcard.",
        "optimize": "Optimize",
        "soundcard": "Optimize Soundcard"
      },
      "optimizeDropdown": "Optimize for:",
      "pairing": {
        "alreadyPaired": "#DEVICE_NAME# device is already paired and does not require pairing.",
        "connectBaseStation": "Connect Wireless Base Station to PC",
        "connectController": "Connect controller directly to PC",
        "connectDongle": "Connect dongle to PC",
        "connectGameHub": "Connect Wireless Game Hub to PC",
        "connectHeadset": "Connect headset to PC",
        "currentlyPairing": "Currently pairing...",
        "enterPairingMode": "Enter Pairing Mode",
        "howToConnectBaseStation": "Use the USB-A to USB-C cable to connect your Wireless Base Station to your PC",
        "howToConnectController": "Keep the Wireless Base Station connected, then use another USB-A to USB-C cable to connect your controller directly to your PC.",
        "howToConnectDongle": "Use the USB-A to USB-C cable to connect your dongle to your PC",
        "howToConnectDongle2": "Use the USB-A dongle to connect to your PC",
        "howToConnectDongleUsba": "Use the USB-A cable attached to your dongle to connect to your PC",
        "howToConnectDongleUsbc": "Use the USB-C dongle to connect to your PC",
        "howToConnectGameHub": "Use the USB-A to USB-C cable to connect your Wireless Game Hub to your PC",
        "howToConnectHeadset": "Use the USB-A to micro-USB cable to connect your headset to your PC",
        "howToConnectUsbCHeadset": "Use the USB-A to USB-C cable to connect your headset to your PC",
        "howToEnterPairingMode": "Turn on the mouse while holding down the CPI button. Wait until the mouse wheel LED starts flashing white, then press the Start Pairing button in Engine.",
        "howToEnterPairingModeForAerox": "Toggle the wireless mode switch on the bottom of the mouse to 2.4 while holding down the CPI button. Wait until the mouse LEDs start flashing white, then press Enter or click the Start Pairing button.",
        "howToEnterPairingModeForMiniKeyboard": "Disconnect keyboard from your computer. Hold L Ctrl+Esc while switching the toggle on the back of the device to 2.4Ghz. Wait until the keyboard LEDs start flashing white then press the Start Pairing button in Engine.",
        "howToEnterPairingModeForTKLKeyboard": "Disconnect keyboard from your computer. Hold L Ctrl+Grave (`) while switching the toggle on the back of the device to 2.4Ghz. Wait until the keyboard LEDs start flashing white then press the Start Pairing button in Engine.",
        "howToEnterPairingModeWithMouseDPIButton": "Toggle the wireless mode switch on the bottom of the mouse to 2.4 while holding down the DPI button. Wait until the mouse LEDs start flashing white, then press Enter or click the Start Pairing button.",
        "howToProceed": "Once everything is connected, click 'Start Pairing'",
        "overview": "To pair your device, please follow these steps",
        "pairDevice": "Pair Device",
        "pairingFailure": "Pairing device failed!",
        "pairingSuccess": "Pairing Successful!",
        "pleaseWait": "This will take a few moments, please wait",
        "postPairingSuccess": "It's now safe to close this window",
        "startPairing": "Start Pairing",
        "thingsNotToDoWhenPairing": "Do not unplug your device, turn off your computer, or exit the software",
        "tooltip": "<b>Pair Device</b><br>Initiate or check pairing status",
        "warning": "Do not unplug your devices, turn off your computer, or exit the software while pairing is in progress"
      },
      "pref": {
        "cloudSync": "Cloud Sync",
        "viewAccount": "View Account"
      },
      "preferences": {
        "accountLinkExplanation": "Click the link to visit your SteelSeries account page on the web.",
        "autoSyncExplanation": "Auto Sync will automatically back up your data to the cloud when changes are made.",
        "forceSyncExplanation": "Manually sync to the cloud.",
        "lastSync": "Last synced",
        "lastSyncAttempt": "Last sync attempt",
        "syncFailureMessage": "An error occurred that has prevented the completion of the most recent backup.",
        "syncTroubleshootMessage": "Click here to get troubleshooting tips.",
        "title": "Preferences"
      },
      "prismSync": {
        "anyKeyboardKey": "Any Keyboard Key",
        "anyMouseClick": "Any Mouse Click",
        "description": "Illumination and effects that span across all of your SteelSeries devices.",
        "devices": "PrismSync Devices",
        "inactiveMode": "Sleep Mode",
        "leftHanded": "Left Handed Mouse Mode",
        "noSupportedDeviceConnected": {
          "message": "No PrismSync Supported #DEVICETYPE# Connected"
        },
        "reactiveActivatedBy": "Activated By",
        "title": "PrismSync",
        "tooltips": {
          "devices": "PrismSync displays illumination effects across your devices. To start, enable the devices youwant the effects to use PrismSync. Enabled devices will override your current illumination settings only.Other Engine Apps, such as gamesense take precedent over PrismSync unless they are disabled.",
          "inactiveMode": "When enabled, Sleep Mode will turn off all illumination and effects on your PrismSync devices when your display goes to sleep. When disabled, the illumination effects will continue running.",
          "templates": "Templates are predefined lighting patterns will which apply to all devices for which PrismSync is enabled"
        },
        "widgetInline": {
          "inactiveMode": "Turns off lighting with display"
        }
      },
      "prismsync": {
        "arenaSpeakerDescription": "Arena 7 or 9 Speakers"
      },
      "receiverMcuVersionNumber": "Receiver MCU Version: ",
      "reconnectController": "Reconnect Controller",
      "reconnectHeadset": "Reconnect Headset",
      "reconnectKeyboard": "Reconnect Keyboard",
      "reconnectMouse": "Reconnect Mouse",
      "reflect": {
        "description": "Extend the on-screen environment and immerse yourself in the game by utilizing Reflect on your devices. Configure Reflect in Prism.",
        "mustBeEnabledInPrism": "Device must be enabled in Prism to use Reflect.",
        "pageDescription": "Reflect lighting intelligently samples color from four quadrants on your monitor to extend and immerse your lighting experience with the Arena Speakers."
      },
      "rightHeadsetMCUVersion": "Right Headset MCU Version:",
      "rightSpeakerMcuVersion": "Right Speaker MCU:",
      "rxMcu": "RX MCU",
      "rxWireless": "RX Wireless",
      "senseiRivalProDisplay": {
        "description": "Show live Sensei / Rival Pro mouse information on your SteelSeries OLED screen, including battery, DPI, polling rate, and report rate."
      },
      "sentryUpdateBadge": "CRITICAL UPDATE: Click to install Sentry software suite.",
      "settings": "Settings",
      "softwareVersion": "Software Version",
      "speakers": {
        "center": "Center",
        "frontLeft": "Front Left",
        "frontRight": "Front Right",
        "rearLeft": "Rear Left",
        "rearRight": "Rear Right",
        "subwoofer": "Subwoofer"
      },
      "startupSetting": {
        "label": "Automatically start SteelSeries Engine 3 at login"
      },
      "stratusxl": {
        "qsg": {
          "firstPair": "If this is the first time you have paired the controller to your PC, you will need to reconnect the controller to enable full XInput functionality. Please turn the controller off, wait 2 seconds, then turn it on. It will now pair and XInput will be enabled"
        }
      },
      "subwooferMcuVersion": "Subwoofer MCU:",
      "taskbar": {
        "exitCore": "Exit",
        "openClient": "Open SteelSeries GG"
      },
      "theme": {
        "chooseTheme": "Choose a Theme",
        "firstNotice": "You have connected a DEVICE_NAME for the first time.  Which one are you using?",
        "subsequentNotice": "Choose the DEVICE_NAME you are using"
      },
      "toast": {
        "ggOnboarding": {
          "body": "Use SteelSeries GG to fully customize your gear and more.",
          "button1": "Open SteelSeries GG",
          "title": "Engine has evolved"
        }
      },
      "transmitterFwVersion": "Transmitter Version:",
      "transmitterMcuOneVersionNumber": "Transmitter MCU 1 Version: ",
      "transmitterMcuTwoVersionNumber": "Transmitter MCU 2 Version: ",
      "transmitterMcuVersionNumber": "Transmitter MCU Version: ",
      "txMcu": "TX MCU",
      "txWireless": "TX Wireless",
      "update": {
        "autoUpdateIncludesGG": "By selecting this option, you will be auto-updated to GG, our new gaming hub that includes Engine",
        "changeLog": "Change Log:",
        "header": "Software Updates",
        "inAppUpdate": {
          "downloadFailureDialogMessage": {
            "text1": "The update download has been interrupted. Please try again.",
            "text2": "The update download has been interrupted. Please try again later."
          },
          "downloadFailureNotification": {
            "text1": "#APP# #VERSION# download has failed. Click to reattempt.",
            "text2": "#APP# #VERSION# download has failed. Please try again later.",
            "title": "Update Download Failed"
          },
          "downloadNotification": {
            "text": "#APP# #VERSION# available.  Click to begin download.",
            "title": "Update Download Available"
          },
          "failureDialog": {
            "title": "Software Update"
          },
          "installNotification": {
            "text": "#APP# #VERSION# downloaded.  Click to install.",
            "title": "Update Install Available"
          },
          "verificationFailureDialogMessage": {
            "text1": "Update could not be verified. Please try again.",
            "text2": "Update could not be verified. Please try again later."
          },
          "verificationFailureNotification": {
            "text1": "#APP# #VERSION# verification has failed. Click to download it again.",
            "text2": "#APP# #VERSION# verification has failed. Please try again later.",
            "title": "Update Verification Failed"
          }
        },
        "installationStarting": "Installation is starting, please wait",
        "instruction": "Click Update to download the latest update from steelseries.com",
        "notification1": "1",
        "releaseNote": "Release Notes",
        "taskbarNotificationText": "#APP# #VERSION# is available",
        "taskbarNotificationTitle": "Update Available",
        "upToDate": "SteelSeries Engine 3 is up to date.",
        "versionNumber": "Ver:"
      },
      "updateFirmware": "Update Firmware",
      "updateFirmwareInstructions": "Follow these steps to prepare your device for the firmware update",
      "updateNow": "Update Now",
      "updatingBaseStation": "Updating base station...",
      "updatingDongle": "Updating dongle...",
      "updatingHeadset": "Updating headset...",
      "updatingKeyboard": "Updating keyboard...",
      "updatingMouse": "Updating mouse…",
      "uwbConnected": "UWB Connected",
      "viewControls": {
        "title": "#DEVICE# Product Features"
      },
      "widnowsCPI": {
        "mouseSEttingsCheckboxInfo": "Override Windows Mouse Settings on Startup"
      },
      "windowTitle": "SteelSeries GG",
      "windowsCPI": {
        "clickToFixCPI": "Click here to fix these settings.",
        "configWindowWarning": "Your mouse settings are being affected by Windows Pointer Options.",
        "enhancedpointer": "Enhanced Pointer Precision is: ",
        "fixCPISettings": "Fix these settings for me",
        "hasMultiplier": "Has Multiplier",
        "mouseAcceleration": "Windows Mouse Acceleration",
        "mouseAccelerationExplanation": "Having Windows pointer options enabled can negatively affect your native mouse tracking. We suggest having Enhanced Pointer Precision set to OFF and pointer speed set to the default value (no multiplier.)",
        "mouseSettings": "Mouse Settings",
        "noMultiplier": "Has No Multiplier",
        "pointerSpeed": "Pointer Speed"
      },
      "wirelessconnected": "2.4G Connected"
    },
    "moments": {
      "FTUE_postgame": {
        "BodyCopy1": "Never miss capturing a clutch kill, a hilarious bug or your best once-in-a-lifetime move ever again!",
        "BodyCopy2": "Auto-capture clips with GameSense or manually capture clips with your #SHORTCUT# shortcut",
        "Button": "Okay",
        "FooterCopy": "Want to learn more about Moments?",
        "FooterLinkText": "Take the Tour",
        "Headline": "NO CLIPS TODAY? NO PROBLEM, THERE IS ALWAYS NEXT TIME!",
        "WindowTitle": "NO CLIPS CAPTURED"
      },
      "FTUE_postgame_banner": {
        "info": "EDIT IT AND SHARE IT WITH THE WORLD AND SHOW THEM YOUR SKILLS.",
        "sub_title": "ON YOUR FIRST MOMENTS CLIPS",
        "title": "CONGRATS!"
      },
      "FTUE_postgame_reaction_banner": {
        "button": "LEARN MORE",
        "info": "CONFIGURE YOUR REACTION CLIP SETTINGS TO CAPTURE EVEN BETTER MOMENTS",
        "sub_title": "ON YOUR FIRST REACTION CLIP",
        "title": "CONGRATS!"
      },
      "alerts": {
        "StorageFillingUpLink": "Click to take action.",
        "StorageFillingUpMessage": "Hard Drive Space is filling up. Free up space to avoid clip capture problems.",
        "StorageFullLink": "Click to take action.",
        "StorageFullMessage": "Hard Drive Space is almost full. Free up space to avoid clip capture problems."
      },
      "autoClipTitle": {
        "apex_legends_elimination": "Elimination",
        "apex_legends_multi_dominate": "Multi-Dominate",
        "apex_legends_multi_elim": "Multi-Elim",
        "apex_legends_multi_knock": "Multi-Knock",
        "apex_legends_victory": "Victory",
        "battlefield_6_ballistic": "Ballistic",
        "battlefield_6_double_kill": "Double Kill",
        "battlefield_6_headshot": "Any headshot",
        "battlefield_6_marauder": "5+ Kill",
        "battlefield_6_quad_kill": "Quad Kill",
        "battlefield_6_redsec_kill": "REDSEC: Kill",
        "battlefield_6_redsec_victory": "REDSEC: Victory",
        "battlefield_6_tank_buster": "Tank Buster",
        "battlefield_6_triple_kill": "Triple Kill",
        "brawlhalla_berserk": "Berserk",
        "brawlhalla_dominating": "Dominating",
        "brawlhalla_double_ko": "Double KO",
        "brawlhalla_game_over": "Game Over",
        "brawlhalla_triple_ko": "Triple KO",
        "call_of_duty_bo7_headshot": "Headshot",
        "call_of_duty_bo7_longshot": "Longshot",
        "call_of_duty_bo7_multi_kill": "Multi-kills",
        "call_of_duty_wz_double_kill": "Warzone: Double Kill",
        "call_of_duty_wz_gulag_win": "Warzone: Gulag (Win)",
        "call_of_duty_wz_kill": "Warzone: Kill",
        "call_of_duty_wz_multi_kill": "Warzone: Multi-kills",
        "call_of_duty_wz_victory": "Warzone: Victory",
        "csgo_headshot_kill_event": "Headshot kill",
        "csgo_knife_kill_event": "Knife kill",
        "csgo_triple_kill_event": "3+ kill round",
        "delta_force_headshot": "Any headshot",
        "delta_force_highscore": "1000+ Score Streak",
        "delta_force_multi_kill": "Multi-kill",
        "destiny_2_double_play": "Double Play",
        "destiny_2_reaper": "Reaper",
        "destiny_2_slayer": "Slayer",
        "destiny_2_triple_play": "Triple Play",
        "destiny_2_victory": "Victory",
        "destiny_2_wrecking_crew": "Wrecking Crew",
        "diablo_iv_dungeon": "Dungeon Complete",
        "diablo_iv_quest": "Quest Complete",
        "diablo_iv_reward": "Reward Unlocked",
        "diablo_iv_world_boss": "World Event Complete",
        "escape_from_tarkov_death": "Death",
        "fall_guys_eliminated": "Eliminated",
        "fall_guys_qualified": "Qualified",
        "fall_guys_roundover": "Round Over",
        "fall_guys_winner": "Winner",
        "fortnite_bounty_kill": "Bounty Complete",
        "fortnite_distance_shot": "Distance Shot",
        "fortnite_double_kill": "Double Elimination",
        "fortnite_headshot": "Any headshot",
        "fortnite_impossible_shot": "Impossible shot",
        "fortnite_match_complete": "Match Complete",
        "fortnite_multikill": "Multi-Elimination",
        "fortnite_quest_complete": "Quest Complete",
        "fortnite_top_3": "Get into Top 3",
        "fortnite_victory_royale": "Victory Royale",
        "genshin_wish_10x": "Wish 10x",
        "helldivers_2_eliminated": "Eliminated",
        "helldivers_2_kill_streak_100": "Killstreak x100",
        "helldivers_2_kill_streak_20": "Killstreak x20",
        "helldivers_2_kill_streak_50": "Killstreak x50",
        "lol_baron_steal": "Baron steal",
        "lol_dragon_steal": "Dragon steal",
        "lol_herald_steal": "Herald steal",
        "low_health_kill_event": "Kill with low health",
        "marvel_rivals_multikill": "Multi-KO",
        "marvel_rivals_overtime": "Overtime (Endgame)",
        "multi_kill_event": "Multi-kill",
        "overwatch_round_potg": "Play of the game",
        "overwatch_round_teamkill": "Team Kill",
        "overwatch_you_elimination": "Elimination",
        "overwatch_you_multikill": "Multi-kill",
        "poe2_boss_defeat": "Boss Defeat",
        "poe2_death": "Death",
        "pubg_death": "Killed",
        "pubg_kill": "Kill",
        "pubg_long_shot": "Long Shot Kill",
        "pubg_multi_kill": "Multi-kills",
        "pubg_top1": "#1: Winner",
        "rainbow_six_siege_defeat": "Defeat",
        "rainbow_six_siege_headshot": "Any headshot",
        "rainbow_six_siege_kill": "Kill",
        "rainbow_six_siege_victory": "Victory",
        "rocket_league_you_assist": "Assist",
        "rocket_league_you_demolition": "Demolition ",
        "rocket_league_you_epic_save": "Epic Save",
        "rocket_league_you_goal": "Goal",
        "rocket_league_you_shot_on_goal": "Shot on goal",
        "street_fighter_6_perfect": "Perfect",
        "threedat_game_end": "Session End",
        "threedat_high_score_achieved": "High Score",
        "valorant_ace": "Ace",
        "valorant_clutch": "Clutch",
        "valorant_flawless": "Flawless",
        "valorant_headshot_kill_event": "Headshot kill",
        "valorant_teamAce": "Team Ace",
        "valorant_thrifty": "Thrifty",
        "valorant_triple_kill_event": "3+ kill round",
        "voice_detect_laugh": "Reaction clipping"
      },
      "autoClipping": {
        "autoClipEvents": "Auto-clip events",
        "disabled": "Disabled",
        "enableAutoClippingToUse": "Enable auto-clipping to enjoy this feature",
        "enableCaptureToUse": "Enable game capture to enjoy this feature",
        "enabled": "Enabled",
        "noAutoClipEvents": "No auto-clip events for this game. You can still clip by manually hitting your shortcut #SHORTCUT#",
        "noGameDetected": "No game detected",
        "seeAllAutoClipGames": "See all Auto-clip games",
        "title": "Auto-clipping"
      },
      "contextMenu": {
        "copyServiceUrl": "Copy #SERVICE_NAME# URL",
        "openFileLocation": "Open file location",
        "share": "Share to..."
      },
      "defaultClipTitle": "Moments clip from #DAY#",
      "defaultDesktopModeClipTitle": "Moments Desktop clip from #DAY#",
      "defaultMontageClipTitle": "Montage created #DAY#",
      "defaultTrimClipTitle": "Trimmed clip from #DAY#",
      "desktopModeGameName": "MOMENTS DESKTOP CAPTURE",
      "discord": {
        "join": {
          "caption": "Join Moments Discord server"
        }
      },
      "dragAndDrop": {
        "genericDescription": "Drop clip onto a chat channel, social media platform, or DM",
        "title": "Drag & drop magic, activated!"
      },
      "editor": {
        "9x16Format": "9:16",
        "audioTrackName": {
          "chat": "Chat device",
          "game": "Audio device",
          "mic": "Microphone"
        },
        "audioTracksError": "Something went wrong with the audio stracks, please re open the clip",
        "canvasSize": "CANVAS SIZE",
        "clipDetails": "Clip Details",
        "descriptionPlaceholder": "Type description here",
        "effects": {
          "effectTypeLabels": {
            "text": "Text"
          },
          "effectsButton": "Add Texts",
          "gifs": {
            "noResults": "No results, try another search",
            "searchSubtitle": "Use the Search to find spicy reaction GIFs"
          },
          "menu": {
            "navItems": {
              "gifs": {
                "title": "GIFs"
              },
              "text": {
                "title": "Text"
              }
            },
            "pageHeaders": {
              "gifs": "GIFs",
              "text": "Choose a Text Style"
            },
            "suggestions": "Suggestions?",
            "suggestionsTooltip": "Tell us which effects you want to see!"
          },
          "momentsClipLabel": "Moments clip",
          "removeEffectModal": {
            "button": "Remove",
            "description": "Are you sure you want to remove this effect?",
            "title": "Remove effect"
          }
        },
        "effectsNudge": {
          "add": "Add GIFs and text captions!"
        },
        "failedToLoadGif": "Gif not loading, cannot find the file specified.",
        "fileDetails": {
          "created": "Created",
          "title": "File Details",
          "videoQuality": "Video Quality"
        },
        "firstTrim": {
          "header": "YOUR FIRST TRIM!",
          "messageFirst": "A new clip was created and saved in your gallery based on your selection. Look for the ",
          "messageSecond": " icon to identify trims in your gallery. You can create several trims from this clip and delete the original if you like to save some space.",
          "title": "TRIM CREATED AND SAVED TO GALLERY"
        },
        "fullscreen": {
          "banner": "Press #HOTKEY# to exit full screen"
        },
        "gifComingBackSoon": "GIFs are no longer available. Stay tuned for more updates!",
        "header": {
          "nextClip": "Next Clip",
          "previousClip": "Previous Clip"
        },
        "invalidEffectsModal": {
          "confirm": "Remove effects & continue",
          "message": "This clip has corrupted video effects data.  To view this clip, any applied effects need to be removed.",
          "title": "Reset effects"
        },
        "metadata": {
          "captureInfo": {
            "captureDateTime": "#DATE# at #TIME#",
            "captureVideoQuality": "#RESOLUTION#p @ #FRAMERATE#fps",
            "date": "Date",
            "game": "Game",
            "title": "Details",
            "videoQuality": "Video Quality"
          },
          "description": {
            "noDescription": "No description",
            "title": "Description"
          },
          "shareActivity": {
            "noSharesText": "Once you upload this clip, the URL will be saved here",
            "sharedAt": "Shared #TIME#",
            "title": "Share activity"
          }
        },
        "openClip": "Open clip to edit",
        "originalFormat": "Original",
        "playbackControls": {
          "backFrame": "Step Back 1 Frame",
          "editClipToSaveTrim": "Edit clip to save trim",
          "forwardFrame": "Step Forward 1 Frame",
          "fullscreen": "Full screen (#HOTKEY#)",
          "goToEnd": "Go to End",
          "goToStart": "Go to Start",
          "openScreenshot": "Open screenshot",
          "openTrim": "Open Trim",
          "pause": "Pause",
          "play": "Play",
          "reducescreen": "Exit full screen (#HOTKEY#)",
          "replay": "Play again/replay",
          "saveTrim": "Save Trim",
          "screenshot": "Take Screenshot",
          "screenshotSaved": "Screenshot saved and copied to clipboard",
          "trimCreated": "Trim successfully saved to clip gallery."
        },
        "share": {
          "banner": {
            "failure": "Upload to #SERVICE_NAME# failed",
            "openInBrowser": "Open in browser",
            "openOnService": "View on #SERVICE_NAME#",
            "pending": "Establishing connection to service",
            "processing": "Getting #SERVICE_NAME# URL… (this may take a bit)",
            "success": "Finished uploading #FILE_NAME# to #SERVICE_NAME#",
            "unauthorized": {
              "youtube": "You haven't created a YouTube channel on this account. Create one to start uploading."
            },
            "uploading": "#FILENAME# is being uploaded to #SERVICE_NAME# – Progress #PROGRESS#%"
          },
          "buttonText": "Share clip",
          "default": {
            "connectAccount": "Connect Account",
            "exportOptionText": "Export",
            "exportSubmitText": "Export",
            "exportToFile": "Export to file",
            "gfycatOptionText": "Gfycat",
            "gfycatSubmitText": "Share to gfycat",
            "heading": "Share your clip",
            "lastSharedDate": "Last shared on #DATE#",
            "subheading": "Select a platform",
            "youTubeOptionText": "YouTube",
            "youTubeSubmitText": "Continue"
          },
          "warning": {
            "concurrentUploads": "You have an upload in progress. Please wait for it to finish before starting another",
            "serviceAuthentication": "Connect your #SERVICE_NAME# account to start sharing"
          },
          "youTube": {
            "connectYourAccount": "Connect your YouTube account to share",
            "descriptionLabel": "Description",
            "heading": "Share to YouTube",
            "privacySettingLabel": "Privacy and visibility",
            "submitButtonText": "Share to YouTube",
            "titleLabel": "Title"
          }
        },
        "tag": "tag",
        "time": {
          "original": "Original clip duration",
          "trimmed": "Trimmed duration"
        },
        "title": "Editor",
        "volume": "Volume",
        "volumeControls": {
          "mute": "Mute",
          "mutePlayback": "Mute playback",
          "unmute": "Unmute",
          "unmutePlayback": "Unmute playback"
        }
      },
      "export": {
        "chooseSize": "Choose a File Size",
        "largeFile": "Very large clips may not compress exactly to the selected size.",
        "preparing": "Preparing your file for export",
        "title": "Export"
      },
      "feedback": {
        "title": "Give feedback"
      },
      "gallery": {
        "all_clips": "ALL CLIPS (#NUMBER#)",
        "createMontage": {
          "bannerFailed": "Oops! The montage creation didn’t work this time.",
          "bannerSuccess": "Montage successfully created",
          "buttonText": "Create Montage",
          "creatingMontageTooltip": "Currently creating montage",
          "maximumSelectionTooltip": "Max 50 clips per montage",
          "minimumSelectionTooltip": "Select minimum 2 clips"
        },
        "createMontageText": "Select 2 or more clips to create a Montage.",
        "deleteConfirmationMessage": "Are you sure you want to delete this clip from your computer?",
        "deleteConfirmationTitle": "Delete clip?",
        "empty": {
          "FTUE": {
            "FirstStep_Description": "Turn it on, capture clips automatically for auto-clip enabled games or manually clip whenever you want with your shortcut",
            "FirstStep_Title": "Step 1: Enable Moments",
            "SecondStep_Description": "Launch your favorite game and automatically capture a clip with Auto-Clip enabled game or manually clip by using your custom Alt+S shortcut",
            "SecondStep_Title": "Step 2:  Play a Game & Clip ",
            "Title": "Enable Moments"
          },
          "InstalledGames": "YOUR AUTO-CLIP ENABLED GAMES",
          "UninstalledGames": "ALL AUTO-CLIP ENABLED GAMES",
          "greeting": "Hey Moments Tester!",
          "instructions": "Launch a game. Do something dumb or something pro. Save a clip of it with",
          "new": {
            "changeShortcut": "Change Shortcut",
            "chooseFolder": "Choose folder",
            "greetings": "Your gallery is empty (for now)",
            "instructions": "Launch a game and press #SHORTCUT# to save new clips",
            "missingClips1": "Don't see your clips? ",
            "missingClips2": "Find your clips from a folder"
          },
          "tagline": "Let's make some clips."
        },
        "filter": {
          "autoClipped": "Auto-Clip Capture",
          "byGame": "By game",
          "byTag": "By tag",
          "byType": "By type",
          "clear": "Clear All",
          "desktopCaptureClipped": "Desktop Clip Capture",
          "dropdownTitle": "Filter",
          "edited": "Edited",
          "manualClipped": "Manual Clip Capture",
          "otherFilter": "+#NUMBER# more",
          "reactionClipped": "Reaction clip Capture",
          "starred": "Starred",
          "trimmed": "Trimmed",
          "unedited": "Unedited",
          "uploaded": "Uploaded"
        },
        "filtered_clips": "FILTERED CLIPS (#NUMBER#)",
        "help": "Help",
        "multiDeleteConfirmationMessage": "Are you sure you want to delete these #NUM# clips from your computer?",
        "multiDeleteConfirmationTitle": "Delete #NUM# clips?",
        "noResult": {
          "description": "We couldn't find any clips for that search.",
          "title": "No Results"
        },
        "savedTimestamp": "Saved #TIMESTAMP#",
        "search": {
          "placeholder": "Search clips"
        },
        "selectedPluralFiles": "<span>#NUM# Clips</span> Selected",
        "selectedSingleFile": "<span>1 Clip</span> Selected",
        "sharedTimestamp": "shared to #SERVICE_NAME# #TIMESTAMP#",
        "showMoreClips": {
          "scrollToTop": "Scroll to top"
        },
        "sort": {
          "newest": "Newest",
          "oldest": "Oldest",
          "title": "Sort clips by"
        },
        "starred": {
          "tooltipStar": "Tag as Starred",
          "tooltipUnstar": "You Starred this clip. Click to unstar"
        },
        "title": "Gallery",
        "today": "TODAY",
        "trimClip": "Trim clip",
        "turnOffMoments": "Turn off Moments",
        "yesterday": "YESTERDAY"
      },
      "introduction": {
        "feature1": {
          "description": "Use a custom hotkey to capture key moments after they happen, without an intrusive overlay — or let Moments automatically clip them for you.",
          "title": "Clip gameplay"
        },
        "feature2": {
          "description": "Trim clips directly in the app to capture the exact start and end of your moment. High frame rate recording makes editing fast and precise.",
          "title": "Quick edit"
        },
        "feature3": {
          "description": "Upload your moments directly to Discord, YouTube, TikTok, Reddit, and X — or export the raw clip for anything else.",
          "title": "Share anywhere"
        },
        "title": "Never miss a Moment",
        "turnon": "TURN ON MOMENTS"
      },
      "notification": {
        "newClips": {
          "text": "Click here to view & share.",
          "title": {
            "plural": "Captured #NUMCLIPS# clips",
            "singular": "Captured #NUMCLIPS# clip"
          }
        }
      },
      "onboarding": {
        "changeShortcutIn": "Change this shortcut any time in",
        "gamesense": {
          "description": "We'll magically save clips when you do cool stuff in these games.",
          "readMore": "Read more about auto clipping in",
          "supportedGames": "Supported Games (more soon):",
          "title": "GameSense Autoclip"
        },
        "intro": {
          "createAndShare": "Moments is the easiest way to create and share gameplay clips",
          "letsTalk": "Let's talk about how it works real quick",
          "nextStep": "Get started!",
          "skipIntro": "Skip intro",
          "title": "Introducing Moments"
        },
        "microphone": {
          "description": "Background noise? We gotchu! Toggle your mic capture in-game with the ezpz shortcut.",
          "title": "Microphone",
          "toggleMic": "Toggle microphone on/off"
        },
        "savingClips": {
          "description": "This is our favorite feature: use the shortcut to save replay clips without ever leaving the game. It'll play a sound.",
          "duration": "Shortcut to save #MIN#min replay clips",
          "title": "Saving Clips"
        }
      },
      "postgame": {
        "autoclipSettings": "YOUR AUTO-CLIP SETTING FOR:",
        "clipReadyText": "Your clip is ready. Edit and share it now!",
        "deleteMultiClips": "Delete #NUMCLIPS# clips",
        "deleteSingleClip": "Delete 1 clip",
        "multiNewClip": "#NUMCLIPS# new clips",
        "newClipText": "You have a new clip",
        "newClipTitle": "New clip",
        "shareLabel": "Share",
        "singleNewClip": "1 new clip",
        "viewAllClips": "View All Clips"
      },
      "settings": {
        "audio": {
          "audioDevice": {
            "label": "Audio Device",
            "placeholder": "No audio devices found..."
          },
          "chatDevice": {
            "label": "Chat Device",
            "placeholder": "No chat devices found..."
          },
          "microphone": {
            "label": "Microphone",
            "placeholder": "No microphone devices found..."
          },
          "title": "Audio Controls"
        },
        "autocapture": {
          "allow_autoclipping": "Allow auto-clipping",
          "apex_legends_onlySupported": "Auto-clip will only save clips based on in-game events when playing with supported modes & configurations. Check out the latest <a aria-label='apex support link' href='https://support.steelseries.com/hc/en-us/articles/5372337024397'>Release & Support</a> info.",
          "autocapture_description": "Automatically create clips based on in-game events.",
          "battlefield_6_onlySupported": "Auto-clip will only save clips based on in-game events when playing with supported modes & configurations. Check out the latest <a aria-label='battlefiled 6 support link' href='https://support.steelseries.com/hc/en-us/articles/40149948138509-Moments-for-Battlefield-6'>Release & Support</a> info.",
          "brawlhalla_onlySupported": "Auto-clip will only save clips based on in-game events when playing with supported modes & configurations. Check out the latest <a aria-label='brawlhalla support link' href='https://support.steelseries.com/hc/en-us/articles/4967837092109'>Release & Support</a> info.",
          "call_of_duty_onlySupported": "Auto-clip will only save clips based on in-game events when playing with supported modes & configurations. Check out the latest <a aria-label='cod support link' href='https://support.steelseries.com/hc/en-us/articles/11270327271181'>Release & Support</a> info.",
          "delta_force_onlySupported": "Auto-clip will only save clips based on in-game events when playing with supported modes & configurations. Check out the latest <a aria-label='Delta Force support link' href='https://support.steelseries.com/hc/en-us/articles/44896977151501-Moments-For-Delta-Force'>Release & Support</a> info.",
          "description": "Auto-clip will save clips automatically based on in-game events from certain games.  Events featured below will trigger saving a new clip. Check out the latest <a href='https://support.steelseries.com/hc/en-us/sections/360003413931-Moments'>Release & Support</a> info for Moments.",
          "destiny_2_onlySupported": "Auto-clip will only save clips based on in-game events when playing with supported modes & configurations. Check out the latest <a aria-label='destiny 2 support link' href='https://support.steelseries.com/hc/en-us/articles/12796586237965'>Release & Support</a> info.",
          "diablo_iv_onlySupported": "Auto-clip will only save clips based on in-game events when playing with supported modes & configurations. Check out the latest <a aria-label='diablo 4 support link' href='https://support.steelseries.com/hc/en-us/articles/15794847049485'>Release & Support</a> info.",
          "escape_from_tarkov_onlySupported": "Auto-clip will only save clips based on in-game events when playing with supported modes & configurations. Check out the latest <a aria-label='escape from tarkov support link' href='https://support.steelseries.com/hc/en-us/articles/20266803842829'>Release & Support</a> info.",
          "eventsSelectedAll": "All events selected",
          "eventsSelectedNumber": "#NUMBER# events selected",
          "fall_guys_onlySupported": "Auto-clip will only save clips based on in-game events when playing with supported modes & configurations. Check out the latest <a aria-label='fall guys support link' href='https://support.steelseries.com/hc/en-us/articles/10454665645197'>Release & Support</a> info.",
          "fortnite_onlySupported": "Auto-clip will only save clips based on in-game events when playing with supported modes & configurations. Check out the latest <a aria-label='fortnite support link' href='https://support.steelseries.com/hc/en-us/articles/4424789563149'>Release & Support</a> info.",
          "gameNames": {
            "valorant": "Valorant",
            "valorantEarlyAccess": "Valorant - Early Access"
          },
          "game_featured_events": "Auto-clip events",
          "gamesense_and_autocapture": "GameSense and Auto-Capture",
          "genshin_onlySupported": "Auto-clip will only save clips based on in-game events when playing with supported modes & configurations. Check out the latest <a aria-label='genshin support link' href='https://support.steelseries.com/hc/en-us/articles/6375708698125'>Release & Support</a> info.",
          "helldivers_2_onlySupported": "Auto-clip will only save clips based on in-game events when playing with supported modes & configurations. Check out the latest <a aria-label='Hell Divers 2 support link' href='https://support.steelseries.com/hc/en-us/articles/25658004688909'>Release & Support</a> info.",
          "marvel_rivals_onlySupported": "Auto-clip will only save clips based on in-game events when playing with supported modes & configurations. Check out the latest <a aria-label='marvel rivals support link' href='https://support.steelseries.com/hc/en-us/articles/33748999805453-Auto-Clipping-for-Marvel-Rivals'>Release & Support</a> info.",
          "overwatch_onlySupported": "Auto-clip will only save clips based on in-game events when playing with supported modes & configurations. Check out the latest <a aria-label='overwatch support link' href='https://steelseries.zendesk.com/hc/en-us/articles/10454576566029'>Release & Support</a> info.",
          "poe2_onlySupported": "Auto-clip will only save clips based on in-game events when playing with supported modes & configurations. Check out the latest <a aria-label='poe2 support link' href='https://support.steelseries.com/hc/en-us/articles/33241204176397-auto-clip-path-of-exile-2'>Release & Support</a> info.",
          "pubg_onlySupported": "Auto-clip will only save clips based on in-game events when playing with supported modes & configurations. Check out the latest <a aria-label='apex support link' href='https://support.steelseries.com/hc/en-us/articles/29098403001357'>Release & Support</a> info.",
          "rainbow_six_siege_onlySupported": "Auto-clip will only save clips based on in-game events when playing with supported modes & configurations. Check out the latest <a aria-label='rainbow six siege X support link' href='https://support.steelseries.com/hc/en-us/articles/23266530884877'>Release & Support</a> info.",
          "rocket_league_onlySupported": "Auto-clip will only save clips based on in-game events when playing with supported modes & configurations. Check out the latest <a aria-label='rocket league support link' href='https://support.steelseries.com/hc/en-us/articles/9333320555277'>Release & Support</a> info.",
          "street_fighter_6_onlySupported": "Auto-clip will only save clips based on in-game events when playing with supported modes & configurations. Check out the latest <a aria-label='street fighter 6 support link' href='https://support.steelseries.com/hc/en-us/articles/43972102589453-Auto-Clipping-for-Street-Fighter-6'>Release & Support</a> info.",
          "threedat_onlySupported": "Auto-clip will only save clips based on in-game events when playing with supported modes & configurations. Check out the latest <a aria-label='3 Dat support link' href='https://support.steelseries.com/hc/en-us/articles/30858178908301-Moments-for-3DAT'>Release & Support</a> info.",
          "title": "Auto-clip",
          "valorant_onlySupported": "Auto-clip will only save clips based on in-game events when playing with supported modes & configurations. Check out the latest <a aria-label='valorant support link' href='https://support.steelseries.com/hc/en-us/articles/4416847694349'>Release & Support</a> info."
        },
        "captureAndSound": {
          "audioDevice": "Audio device",
          "audioSubtitle": "Audio",
          "captureDeviceOptions": "Default mic from Windows",
          "captureInstructions": "Press #SHORTCUT# to save a new clip",
          "changeShortcut": "Change Shortcut",
          "chatDevice": "Chat device",
          "clipSize": "Clip size",
          "cursorSubtitle": "Cursor",
          "defaultCommunicationsDevice": "Default communication device",
          "defaultCommunicationsDeviceFromWindows": "Default communications device from Windows",
          "defaultMicrophone": "Default microphone",
          "defaultPlaybackDevice": "Default playback device",
          "defaultPlaybackDeviceFromWindows": "Default playback device from Windows",
          "description": "Edit capture options, choose which audio devices will get captured, and control cursor capture.",
          "gameplayCaptureTitle": "Gameplay capture",
          "microphoneInput": "Microphone input",
          "microphoneSubtitle": "Microphone",
          "monitorthumbnail": {
            "primary": "Main",
            "title": "Display"
          },
          "postgameModal": "Highlight clips from my most recent gaming session",
          "postgameSubtitle": "Post-game",
          "postgameTextLabel": "Launch Moments and highlight clips after my most recent gaming session",
          "providedByLightstream": "Capture powered by #LIGHTSTREAM_LOGO#",
          "reactionclip": {
            "allow": "Allow Reaction Clipping",
            "allowDescription": "Allow Moments to capture clips based on your voice. When we detect you having an excited or funny reaction through your microphone, Moments will create a clip from your current game.",
            "high": "High",
            "low": "Low",
            "medium": "Medium",
            "sensitivity": "Sensitivity",
            "sensitivityDescription": "Sensitivity determines the length of the voice reaction received from the users microphone. High sensitivity settings will result in more clips captured while Low sensitivity settings will result in fewer clips capture."
          },
          "title": "Capture and Sound",
          "toClip": "to clip",
          "toSaveAClip": "to save a clip",
          "toggleAdminDescription": "Note: only turn this on if clips from some games are choppy. You'll be prompted to approve these permissions whenever GG is started.",
          "toggleAdminLabel": "Capture with elevated permissions",
          "toggleCaptureCursorLabel": "Capture my in-game cursor",
          "toggleMicDescription": "Record voice through your microphone when capturing your games",
          "toggleMicInstructions": "Use #SHORTCUT# to toggle mic on/off",
          "toggleMicLabel": "Record voice through mic while gaming",
          "toggleMomentsDescription": "Moments will automatically capture your games, but only when you launch them.",
          "toggleMomentsLabel": "Allow Moments to capture while gaming"
        },
        "clips": {
          "clipFileSize": {
            "description": "Based on clip settings",
            "highThresholdTooltip": "These settings may impact system performance and clip quality.",
            "mediumThresholdTooltip": "These settings may impact system performance and clip quality.",
            "title": "Clip Size Estimate",
            "upToSize": "Up to #FILESIZE# each"
          },
          "clipLength": {
            "custom": "Custom",
            "customDurationPlaceholder": "1 - 30 mins",
            "duration": "Duration",
            "label": "Clip Length",
            "tooltip": "Placeholder: Display warning text that buffer will get flushed when the clip length changes (if a game is currently being captured)"
          },
          "clipSettings": {
            "description": "Higher settings are better for clip quality. Lower settings are better for system performance and file size.",
            "title": "Clip Settings",
            "tooltip": "Higher settings are better for clip quality. Lower settings are better for system performance and file size."
          },
          "description": "Adjust settings for new clips, see clip size estimate, and edit storage.",
          "estimatedClipSize": "Estimated clip size:",
          "hardDriveSpace": {
            "barClipSizeErrorTooltip": "Current clip size estimate is too large for your hard drive space.",
            "barHighThresholdTooltip": "Current clip size estimate may quickly fill your hard drive space.",
            "free": "free",
            "freeOf": "#FREE# free of #OF#",
            "freeOn": "free on",
            "ofClips": "of clips",
            "percentageUsed": "% used",
            "possibleClipNumber": "Possible number of clips",
            "restOfPc": "Rest of PC",
            "title": "Hard Drive Space"
          },
          "memoryTitle": "CLIP SETTINGS & MEMORY",
          "ramAlert": "The current clip settings may use over #PERCENTAGE#% of your RAM, adjust clip settings to reduce impact.",
          "sizePerClip": "per clip",
          "systemMemoryUsage": "RAM usage:",
          "title": "Clip Settings",
          "videoQuality": {
            "bitrate_description": "Lower qualities use less system resources and disk space, but don't look as good.",
            "bitrate_header": "Video quality",
            "label": "Video Quality",
            "resolution_header": "capture resolution",
            "title": "Video Quality",
            "tooltips": {
              "bitrate_high": "CRF 20. Best for YouTube, Gfycat, Twitch",
              "bitrate_medium": "CRF 23. Good for X, Reddit, Facebook",
              "bitrate_ultra": "CRF 17. Studio quality, for editing"
            }
          }
        },
        "gameDetection": {
          "autoCaptureTooltip": "Using auto capture",
          "desktopmode": {
            "description1": "Clip Anytime, Anywhere, Anything with Desktop Capture Mode. Programs, browsers, games -               basically everything! Turn it on and use your Moments shortcut to clip as usual. You can               activate it through the capture dropdown in the Moments gallery as well.",
            "options": {
              "closeGG": "When I close GG",
              "goToSleep": "When my monitor goes to sleep",
              "idle": "If my system is idle for 30 minutes",
              "locked": "When my computer is locked",
              "noClip": "If I don’t save a clip for 30 minutes",
              "optionstitle": "Turn Desktop Capture Mode off"
            },
            "title": "Desktop Capture Mode"
          },
          "gameCaptureTooltip": "Using game capture",
          "recordingMode": {
            "gameCapture": "Game capture (BETA)",
            "screenCapture": "Screen capture"
          },
          "screenCaptureTooltip": "Using screen capture"
        },
        "gamesense": {
          "addGame": "Add Game",
          "detectedGames": "Detected Games",
          "events": {
            "apex_legends_elimination": "Elimination",
            "apex_legends_multi_dominate": "Multi-Dominate: Get 4+ Knockdowns and/or Elims within 1 min",
            "apex_legends_multi_elim": "Multi-Elim: Get 3+ Elims within 1 min",
            "apex_legends_multi_knock": "Multi-Knock: Get 3+ Knockdowns within 1 min",
            "apex_legends_victory": "Victory",
            "battlefield_6_ballistic": "Ballistic: any time you destroy an aircraft using a ballistic weapon.",
            "battlefield_6_double_kill": "Double Kill",
            "battlefield_6_headshot": "Any headshot",
            "battlefield_6_marauder": "5+ Kill",
            "battlefield_6_quad_kill": "Quad Kill",
            "battlefield_6_redsec_kill": "REDSEC: Kill",
            "battlefield_6_redsec_victory": "REDSEC: Victory",
            "battlefield_6_tank_buster": "Tank Buster",
            "battlefield_6_triple_kill": "Triple Kill",
            "brawlhalla_berserk": "Berserk: Any player scores 5+ KO's without being KO'ed",
            "brawlhalla_dominating": "Dominating: Any player scores 3 KO's without being KO'ed",
            "brawlhalla_double_ko": "Double KO: Any player scores 2 KO's in quick succession",
            "brawlhalla_game_over": "Game Over",
            "brawlhalla_triple_ko": "Triple KO: Any player scores 3 KO's in quick succession",
            "call_of_duty_bo7_headshot": "Black Ops 7: Any headshot",
            "call_of_duty_bo7_longshot": "Black Ops 7: Long Shot",
            "call_of_duty_bo7_multi_kill": "Black Ops 7: Triple kill or more",
            "call_of_duty_wz_double_kill": "Warzone: Double Kill",
            "call_of_duty_wz_gulag_win": "Warzone: Gulag (Win)",
            "call_of_duty_wz_kill": "Warzone: Kill",
            "call_of_duty_wz_multi_kill": "Warzone: Triple kill or more",
            "call_of_duty_wz_victory": "Warzone: Victory",
            "csgo_headshot_kill_event": "Any headshot kill",
            "csgo_knife_kill_event": "Any knife kill",
            "csgo_triple_kill_event": "3+ kills in a round",
            "delta_force_headshot": "Any headshot",
            "delta_force_highscore": "1000+ Score Streak",
            "delta_force_multi_kill": "Multikill: Any time you earn 2 or more eliminations in rapid succession",
            "destiny_2_double_play": "Double Play: Rapidly defeat 2 opposing Guardians",
            "destiny_2_reaper": "Reaper: Rapidly defeat 6 opposing Guardians",
            "destiny_2_slayer": "Slayer: Rapidly defeat five opposing Guardians",
            "destiny_2_triple_play": "Triple Play: Rapidly defeat 3 opposing Guardians",
            "destiny_2_victory": "Victory",
            "destiny_2_wrecking_crew": "Wrecking Crew: As a team, defeat 7 opposing Guardians without any of your team dying",
            "diablo_iv_dungeon": "Dungeon Complete",
            "diablo_iv_quest": "Quest Complete",
            "diablo_iv_reward": "Reward Unlocked",
            "diablo_iv_world_boss": "World Event Complete",
            "escape_from_tarkov_death": "Death",
            "fall_guys_eliminated": "Eliminated: Any time you are eliminated",
            "fall_guys_qualified": "Qualified: Any time you qualify for the next round",
            "fall_guys_roundover": "Round Over: Any time the round is over",
            "fall_guys_winner": "Winner: Any time you win",
            "fortnite_bounty_kill": "Bounty Complete",
            "fortnite_distance_shot": "Distance Shot",
            "fortnite_double_kill": "Double Elimination",
            "fortnite_headshot": "Any headshot",
            "fortnite_impossible_shot": "Impossible shot",
            "fortnite_match_complete": "Match Complete",
            "fortnite_multikill": "Multi-Elimination",
            "fortnite_quest_complete": "Quest Complete",
            "fortnite_top_3": "Get into Top 3",
            "fortnite_victory_royale": "Victory Royale",
            "genshin_wish_10x": "Wish 10x",
            "helldivers_2_eliminated": "Eliminated: Any time you are eliminated",
            "helldivers_2_kill_streak_100": "Killstreak x100",
            "helldivers_2_kill_streak_20": "Killstreak x20",
            "helldivers_2_kill_streak_50": "Killstreak x50",
            "lol_baron_steal": "Baron steal",
            "lol_dragon_steal": "Dragon steal",
            "lol_herald_steal": "Herald steal",
            "low_health_kill_event": "Any kill with low health",
            "marvel_rivals_multikill": "Multi-KO: Any time you earn 3 or more eliminations in rapid succession",
            "marvel_rivals_overtime": "Overtime (Endgame)",
            "multi_kill_event": "Multi-kills",
            "overwatch_round_potg": "Play of the game: Clip every Play of the Game",
            "overwatch_round_teamkill": "Team Kill: Any time your team kills the entire enemy team in a short time span",
            "overwatch_you_elimination": "Elimination: Any time you earn an elimination",
            "overwatch_you_multikill": "Multikill: Any time you earn 2 or more eliminations in rapid succession",
            "poe2_boss_defeat": "Boss Defeat",
            "poe2_death": "Death",
            "pubg_death": "Killed: Anytime you get killed",
            "pubg_kill": "Kill",
            "pubg_long_shot": "Long Shot Kill",
            "pubg_multi_kill": "Multi-kills: Anytime you get 2+ kills within 1min",
            "pubg_top1": "#1: Winner",
            "rainbow_six_siege_defeat": "Defeat",
            "rainbow_six_siege_headshot": "Any headshot",
            "rainbow_six_siege_kill": "Kill",
            "rainbow_six_siege_victory": "Victory",
            "rocket_league_you_assist": "Assist: Pass the ball to a teammate who scores",
            "rocket_league_you_demolition": "Demolition: Any time you demolish another player",
            "rocket_league_you_epic_save": "Epic Save: Block a shot on goal that's on the verge of scoring ",
            "rocket_league_you_goal": "Goal: Any time you score a goal",
            "rocket_league_you_shot_on_goal": "Shot on goal: Any time you make a shot on goal",
            "street_fighter_6_perfect": "Perfect",
            "threedat_game_end": "Session End: at the end of each training session",
            "threedat_high_score_achieved": "High Score: every time you surpass your previous high score",
            "valorant_ace": "Ace",
            "valorant_clutch": "Clutch",
            "valorant_flawless": "Flawless",
            "valorant_headshot_kill_event": "Any headshot kill",
            "valorant_teamAce": "Team Ace",
            "valorant_thrifty": "Thrifty",
            "valorant_triple_kill_event": "3+ kills in a round"
          },
          "games": {
            "LEAGUE_OF_LEGENDS": "League of Legends",
            "csgo": "Counter-Strike: Global Offensive",
            "dota2": "Dota 2"
          },
          "scanGames": "Scan Installed Games",
          "title": "GameSense Detection"
        },
        "logout": {
          "cancelButton": "cancel",
          "logoutButton": "log out",
          "modalTitle": "Log Out",
          "subtitle": "Don't worry, we'll keep your settings and clips.",
          "title": "Are you sure you want to log out?"
        },
        "noOptions": "No options",
        "notifications": {
          "allow_oledNotifications": "Moments OLED notifications",
          "gamesenseCaptureStarted": "Capture started",
          "gamesenseClipSaved": "Clip saved",
          "gamesenseMicMuted": "Mic muted",
          "oledDescription": "SteelSeries devices with an OLED display will alert you when these specified events take place.",
          "oledDescriptionLink": "Don't have compatible devices?",
          "oledTitle": "Moments OLED notifications"
        },
        "overlaysNotifications": {
          "clipSaveSoundVolume": "SOUND VOLUME",
          "description": "Turn on & off game overlays & sounds to notify you that Moments is working in the background.",
          "gameOverlay": {
            "detail": "Moments will display an animation to let you know that an event has taken place.",
            "label": "Display game overlays",
            "overlays": {
              "clipCaptured": "Clip captured",
              "desktopModeActivated": "Desktop Capture is on",
              "desktopModeActivatedContent": "to save a clip",
              "desktopModeActivatedTitle": "Desktop capture is on",
              "desktopModeDeactivated": "Turning off Desktop Capture",
              "desktopModeDeactivatedTitle": "Turning off desktop capture",
              "momentsActive": "Moments is active",
              "momentsActiveContent": "to clip game",
              "momentsActiveTitle": "Moments: Active",
              "reactionClipOverlay": "Reaction clip Capture"
            },
            "title": "Game overlays"
          },
          "momentsOverlayAlwaysOnShared": "An overlay will be added when sharing via the Share window.",
          "momentsOverlayExportedToggleLabel": "Show Moments overlay on exported clips",
          "momentsOverlaySharedToggleLabel": "Show Moments overlay on shared clips",
          "momentsOverlaySubtitle": "Moments Overlay",
          "overlayPositions": {
            "bottomCenter": "Bottom Center",
            "bottomLeft": "Bottom Left",
            "bottomRight": "Bottom Right",
            "label": "Overlay position",
            "topCenter": "Top Center",
            "topLeft": "Top Left",
            "topRight": "Top Right"
          },
          "position": {
            "bottomLeft": "Bottom Left",
            "bottomRight": "Bottom Right",
            "centerLeft": "Center Left",
            "centerRight": "Center Right",
            "label": "Overlay position",
            "title": "Position",
            "topLeft": "Top Left",
            "topRight": "Top Right"
          },
          "sounds": {
            "playSounds": {
              "detail": "Moments will play a sound when specified events take place.",
              "label": "Play sounds"
            },
            "title": "Sounds"
          },
          "title": "Overlays and Notifications"
        },
        "shared": {
          "resetModal": {
            "message": "Moments has to reset the last #CLIP_LENGTH# when this setting changes while a game is open. Is that okay?",
            "title": "Game capturing"
          }
        },
        "shortcuts": {
          "alreadyUsed": "Shortcut already assigned",
          "description": "Set shortcuts for functions within GG.",
          "enableMoments": "Turn Moments on/off",
          "modalConflict": {
            "content": "The default shortcut for this action (**#SHORTCUT#**) is already used by another shortcut. Resetting this to Default will make the other action Unassigned. Would you like to proceed?",
            "title": "SHORTCUT CONFLICT"
          },
          "modalError": {
            "content": "The default shortcut for this action (**#SHORTCUT#**) is already used by another shortcut. The 'Save New Clips' shortcut MUST be assigned. Please choose an alternative shortcut or reassign 'Save New Clips' action to another shortcut combo.",
            "title": "SHORTCUT ERROR"
          },
          "moreDetails": "Define shortcuts for the following actions. Shortcuts can use a modifier (control, shift, or alt) plus a single key, or just a single key.",
          "saveNewClip": "Save new clip",
          "title": "Shortcuts",
          "toggleDesktopCaptureMode": "Start/Stop Desktop Capture Mode",
          "toggleMicMute": "Toggle mic mute",
          "toggleReactionClip": "Turn Reaction clipping On/Off"
        },
        "storage": {
          "capacity": "#CLIPS_SIZE_BYTES# of clips, #AVAILABLE_BYTES# available",
          "currentFilesLocation": "Storage location",
          "description": "Check how much space your clips are using and set a new location for them to be saved.",
          "title": "Storage"
        },
        "title": "Settings"
      },
      "sharing": {
        "accountLink": {
          "youtube": {
            "checkBrowser": "Check your browser for the page to link YouTube and Moments.",
            "link": "Link to YouTube",
            "linkAccount": "Link to YouTube account",
            "tryAgain1": "Don't see it?",
            "tryAgain2": "Open it again by clicking the link below.",
            "waiting": "Waiting for YouTube link"
          }
        },
        "clipDetails": "Saved #TIME_AGO#, length #VIDEO_LENGTH#",
        "composeTweet": "Compose tweet on X",
        "copy": {
          "argh": "Arghhh!",
          "clickToCopy": "Click to copy #SERVICE_NAME# link",
          "shareItAlready": "Share it already!",
          "shareItNow": "Share it now!!",
          "stahp": "STAHP!"
        },
        "defaultMarketingDescription": "🎥 Made with Moments from @SteelSeries #ForGlory",
        "dragAndDrop": {
          "clip": "Drag & Drop",
          "compression": {
            "backToEditor": "Trim clip in editor",
            "compressing": "Compressing, please wait...",
            "failure": "Encoding failed",
            "pending": "File too big? Compress to <b>#FILESIZE#</b>",
            "success": "Your file is now #FILESIZE#. Drag it outta here.",
            "tooBig": "This clip is too long to compress to #FILESIZE#",
            "useOriginal": "Use <u>original file</u> instead"
          },
          "description": "Grab & drag clip to share it",
          "encodingMessage": "Preparing your clip",
          "encodingPercent": "#PERCENT#% complete",
          "makeClip": "Make clip",
          "onToTikTok": "Drag this clip into your TikTok Studio upload window.",
          "ontoFacebookPost": "Drag clip onto a new post or a comment box to upload it.",
          "ontoPost": "Drop clip onto your new post to upload it",
          "ontoRedditPost": "Drag clip into the “image/video” section of your Reddit post to upload it.",
          "ontoTweet": "Drag clip onto a tweet or reply to upload it.",
          "overlay": {
            "discord": "Drag this clip into any Discord chat to upload it",
            "ontoChat": "Drop clip onto any #SERVICE# chat",
            "ontoPost": "Drop clip onto browser window with new #SERVICE# post"
          },
          "preparingFile": "Preparing your file",
          "title": "Drag & drop"
        },
        "dropClipIntoDiscordChat": "Drag this clip into any Discord chat to upload it",
        "keepAudioInUpload": "Keep audio in upload",
        "linkYouTube": "Continue to link your YouTube account.",
        "loopingGifSoundOptional": "Upload as looping GIF, sound optional",
        "maxFileSize": "Choose a File Size",
        "maxFileSizeTooltip": "Clips under size remain the same.",
        "openFacebookProfile": "Open Facebook profile",
        "openTikTok": "Open TikTok",
        "openTikTokStudio": "Open TikTok Studio",
        "post": {
          "discord": {
            "info": "Show your Discord buds what you did."
          },
          "facebook": {
            "info": "Drag your clip into a Facebook post or comment."
          },
          "reddit": {
            "info": "Rack up sweet karma with your awesome clip."
          },
          "twitter": {
            "info": "Show your followers what happened with a X post or reply."
          }
        },
        "postToService": "Post to #SERVICE#",
        "shareOn": "Share on #SERVICE#",
        "sharedAs": "Shared as #NAME#",
        "startANewPost": "Start a new post",
        "startComposingTweet": "Start composing a new tweet",
        "startNewRedditPost": "Start new post on Reddit",
        "startUpload": "Start Upload",
        "upload": {
          "action": {
            "cancel": "Cancel upload",
            "createYouTubeChannel": "Create YouTube channel",
            "goToEditor": "Continue editing",
            "goToGallery": "Go to gallery",
            "linkAccount": "Link account on #SERVICE_NAME#",
            "retry": "Retry upload",
            "view": "View online"
          },
          "flavorText": {
            "canceled": "Your upload was canceled. You can retry the upload by clicking the progress ring",
            "failure": {
              "generic": "Uh oh, something went wrong during the upload. Please try again in a minute.",
              "gfycat": "Gfycat is regularly down. Try again in a minute or consider uploading to YouTube instead.",
              "requestTimeout": "Looks like #SERVICE_NAME# is down or not responding.",
              "unauthorized": "Your #SERVICE_NAME# account was unlinked, or the access has expired. Link your account and try again.",
              "uploadLimitExceeded": "So many Moments clips have been uploaded today that we’ve reached the max. Sorry – try again tomorrow.",
              "youtubeSignupRequired": "Your account is linked, but you need a create a YouTube channel to post videos."
            },
            "pendingProcessing": "Close this window any time. Moments will still upload your clip.",
            "share": "Now, send it to everyone you know!",
            "unauthorized": "Your #SERVICE_NAME# account was unlinked, or the access has expired. Link your account and try again.",
            "uploading": "It's okay to close this window now, but if you want to share your #SERVICE_NAME# link ASAP, wait here"
          },
          "previewTooltip": "Moments overlay applied when sharing",
          "selectService": "Choose where you want to share and click “Continue”",
          "shareTo": "Share to...",
          "shareToTikTok": "Show your TikTok followers what went down.",
          "status": {
            "canceled": "Upload canceled",
            "canceledWithTime": "Upload canceled, at #TIME_OF_DAY#",
            "completed": "Upload completed at #TIME_OF_DAY#",
            "dataRemaining": "#DATA_SIZE# remaning",
            "encoding": "Preparing your file",
            "failure": {
              "generic": "Upload failed",
              "requestTimeout": "#SERVICE_NAME# down or unresponsive",
              "unauthorized": "Upload failed, account unlinked or expired",
              "uploadLimitExceeded": "Upload failed, uploads exceeded",
              "youtubeSignupRequired": "Upload failed, no YouTube channel available"
            },
            "pending": "Hang on...",
            "processing": "Processing, waiting for #SERVICE_NAME# to finish",
            "success": "Finishing up, please wait...",
            "uploadInProgress": "Upload in progress...",
            "uploading": "Uploading to #SERVICE_NAME#"
          },
          "title": {
            "failure": "Error uploading",
            "uploaded": "Uploaded on #SERVICE_NAME#",
            "uploading": "Uploading on #SERVICE_NAME#"
          },
          "tooltip": {
            "cancel": "Cancel upload",
            "canceled": "Canceled step placeholder",
            "cantSelect": "Can't select while upload is in progress",
            "failure": "Failure step placeholder",
            "pendingProcessing": "Pending/processing step placeholder",
            "retry": "Retry upload",
            "success": "No action available, please wait...",
            "uploading": "Uploading step placeholder",
            "view": "View uploaded clip on #SERVICE_NAME#"
          }
        },
        "uploadAs": "Upload as #NAME#",
        "uploadToService": "Upload to #SERVICE#"
      },
      "splash": {
        "capture": {
          "description": "Use a custom hotkey to seamlessly capture moments after they happen without an invasive overlay.",
          "title": "Capture gameplay"
        },
        "edit": {
          "description": "Trim clips in-app to get the exact start and end of your moment. Adjustable frame by frame.",
          "title": "Edit fast"
        },
        "header": {
          "button": "Get started",
          "description": "Moments is the easiest and fastest way to share your gameplay with friends.",
          "title": "Share glory"
        },
        "share": {
          "description": "Upload your moments directly to YouTube, Discord and Reddit, or grab the raw clip for everything else.",
          "title": "Share anywhere"
        }
      },
      "status": {
        "desktopmode": {
          "capturing": "Capturing Desktop",
          "description1": "Clip Anytime, Anywhere, Anything with Desktop Capture Mode. Turn it on below and use your Moments shortcut to clip as usual. Configure more in #SETTINGS#.",
          "linkName": "Game Detection Settings",
          "start": "Start Desktop Capture",
          "stop": "Stop Desktop Capture"
        },
        "disabled": {
          "message": "Capture disabled",
          "tooltip": "Enable capture to save in-game clips"
        },
        "enabled": {
          "message": "READY TO CAPTURE",
          "tooltip": "Moments will automatically capture your games, but only when you launch them."
        },
        "gameplayCapture": {
          "title": "Game/Desktop Capture",
          "tooltip": "Moments will automatically capture your games, but only when you launch them."
        },
        "loading": {
          "message": "Scanning #CUR_FILE_IDX# of #NUM_FILES# clips...",
          "tooltip": "Clips need to be re-scanned after installation or changing locations."
        },
        "microphone": {
          "title": "Mic capture",
          "tooltip": "Record voice through your microphone when capturing your games"
        },
        "moreSettingsButton": {
          "title": "Advanced Settings"
        },
        "reactionClipping": {
          "title": "Reaction clipping",
          "tooltip": "Allow Moments to capture clips based on your voice. When we detect you having an excited or funny reaction through your microphone, Moments will create a clip from your current game."
        },
        "running": {
          "message": "Capturing #GAME_NAME#",
          "tooltip": "Press #SHORTCUT# to save new clips, and they'll appear here in your gallery."
        }
      },
      "subAppActions": {
        "DesktopModeToggle": "Start/Stop Desktop Capture Mode",
        "clipTrigger": "Save new clip"
      },
      "timelineEvents": {
        "assist": "Assist",
        "baronKill": "Baron kill",
        "bought": "Bought",
        "died": "Died",
        "dragonKill": "Dragon kill",
        "gameStarted": "Game started",
        "gotFlashed": "Got flashed",
        "killedEnemy": "Killed enemy",
        "killedEnemyWithHeadshot": "Killed enemy with headshot",
        "roundLost": "Team loses round, now",
        "roundWon": "Team wins round, now",
        "savedClip": "Saved clip",
        "thrown": "thrown",
        "transition": "Clip transition"
      },
      "tour": {
        "buttons": {
          "finish": "Finish",
          "next": "Next",
          "open": "Open clip",
          "save": "Save clip to continue",
          "start": "Start now"
        },
        "cancelModal": {
          "description": "Are you sure you want to skip the Moments tour? You’ll need to enable Moments capture later.",
          "title": "Skip tour"
        },
        "stepFive": {
          "descriptionOne": "Share directly to Discord, Gfycat, YouTube, X, and others, or export to use wherever.",
          "descriptionTwo": "That’s it for now!  Enjoy making more clips!",
          "title": "SHOW IT TO YOUR FRIENDS"
        },
        "stepFour": {
          "description": "Drag to adjust the start and end time of your clip.",
          "title": "CUT RIGHT TO THE GOOD PART"
        },
        "stepOne": {
          "descriptionOne": "Simply press #SHORTCUT# while in a game to save a clip of the last 60 seconds of gameplay, audio, and mic input.",
          "descriptionTwo": "Change capture preferences any time in Settings.",
          "faqLink": "Having trouble clipping? Read the capture FAQ.",
          "title": "YOU ENABLED GAMEPLAY CAPTURE"
        },
        "stepThree": {
          "descriptionOne": "Nice, you saved your first gameplay clip!",
          "descriptionTwo": "Select your clip to view it.",
          "title": "VIEW AND EDIT YOUR CLIP"
        },
        "stepTwo": {
          "descriptionOne": "Launch your favorite game and press #SHORTCUT#",
          "descriptionTwo": "You'll hear a sound, and a clip will be saved here in your gallery.",
          "title": "SAVE YOUR FIRST CLIP"
        },
        "welcome": {
          "description": "Save and edit your first clip with Moments.",
          "title": "Ready to clip your gameplay?"
        }
      },
      "trim": {
        "error": "Error encoding file"
      },
      "welcomeModal": {
        "getStarted": "Get Started",
        "modalTitleTourStep": "HOW IT WORKS",
        "takeTour": "Take Tour",
        "tourStep1": {
          "content": {
            "description1": "Simply press #SHORTCUT# while in a game to save a clip of the last 60 seconds of gameplay, audio, and mic input. You can change your capture preferences any time in Settings.",
            "description2": "Want to learn more? #FAQLINK#.",
            "href": "https://steelseri.es/qhh",
            "linkName": "Read the Moments FAQ",
            "title": "CAPTURE YOUR BEST MOMENTS"
          }
        },
        "tourStep2": {
          "content": {
            "description1": "Once you've saved a clip, it will show up in your moments gallery. Click on any clip to open it up and view, edit, or share it with your friends.",
            "description2": "You can sort, rename, and favorite clips in your gallery as well.",
            "title": "VIEW AND EDIT YOUR CLIPS"
          }
        },
        "tourStep3": {
          "content": {
            "description": "Just drag the green things on either end of the timeline to adjust the start and end points of your clip. It’s easy to edit clips down and save out just your favorite parts.",
            "title": "CUT TO THE GOOD PART"
          }
        },
        "tourStep4": {
          "content": {
            "description1": "Share to Discord, YouTube, X, and others, or export your clips to use wherever you want.",
            "description2": "Moments is now enabled and ready to clip! You can update your preferences or turn it off any time in #SETTINGS#",
            "linkName": "Settings",
            "title": "SHARE ANYWHERE"
          }
        },
        "tourStepReaction": {
          "content": {
            "description1": "You can play many Auto-clip enabled games and capture game-specific moments automatically. Try using Desktop Capture for more unique uses or Reaction clipping to get more surprising clips.",
            "description2": "Want to learn more? #FAQLINK#.",
            "href": "https://steelseri.es/qhh",
            "linkName": "Read the Moments FAQ",
            "title": "MORE WAYS TO CAPTURE"
          }
        },
        "welcomeStep": {
          "content": {
            "description": "Welcome to the easiest way to capture your favorite gaming moments and share them anywhere you want.",
            "title": "Share Glory"
          },
          "title": "Welcome to Moments"
        }
      }
    },
    "nativeLanguage": {
      "language": {
        "de": "Deutsch",
        "en_US": "English",
        "es": "Español",
        "fr": "Français",
        "it": "Italiano",
        "ja": "日本語",
        "ko": "한국어",
        "pt": "Português de Portugal",
        "pt_br": "Português do Brasil",
        "ru_RU": "Русский",
        "zh_HK": "香港",
        "zh_hans": "简体中文",
        "zh_hant": "繁體中文"
      },
      "region": {
        "arabic": "العربية",
        "belgium": "België",
        "brazil": "Brasil",
        "china": "中文",
        "englishUK": "English (UK)",
        "englishUS": "English (US)",
        "france": "Français",
        "frencheng": "French-English",
        "german": "Deutsche",
        "germany": "Deutsch",
        "israel": "עִברִית",
        "italy": "Italiano",
        "japan": "日本語",
        "korea": "한국어",
        "mexico": "Español",
        "nordic": "Nordic",
        "norwegian": "Norsk",
        "portugal": "Portugal",
        "portugueseBrazil": "Português (Brasil)",
        "portuguesePortugal": "Português (República Portuguesa)",
        "russia": "Русский",
        "russian": "Pусский язык",
        "spain": "Español",
        "spanishMexico": "Español (México)",
        "spanishSpain": "Español (España)",
        "swiss": "Schweiz",
        "taiwan": "臺灣",
        "taiwanese": "臺灣話",
        "thai": "ไทย",
        "thaiLanguage": "ภาษาไทย",
        "turkish": "Türk",
        "turkishLanguage": "Türkçe",
        "uk": "UK English",
        "ukIntl": "International English",
        "us": "English"
      }
    },
    "news": {
      "discord": {
        "join": {
          "caption": "Join our Discord for news"
        }
      }
    },
    "onboardingPrompt": {
      "common": {
        "setup": "#DEVICENAME# SETUP",
        "title": "Welcome to #DEVICENAME#"
      },
      "headsetTemplate": {
        "activateSonar": "Activate Sonar",
        "consoleGaming": "CONSOLE GAMING",
        "consoleGamingDescription": "Fast access to custom sound settings from your smartphone with the Arctis Companion App. Enjoy superior gameplay on the console or on the go.",
        "pcGaming": "PC GAMING",
        "pcGamingDescription": "Tailored for PC gaming, Sonar enhances your in-game sound for precision hearing, from the softest footsteps to the most chaotic battles.",
        "scanQrCode": "Scan QR code to download app"
      }
    },
    "osActions": {
      "action": {
        "align_left": "Align Window Left",
        "align_right": "Align Window Right",
        "back": "Back",
        "capture_screen": "Capture Screen to Clipboard",
        "capture_screen_to_file": "Capture Screen to File",
        "capture_window": "Capture Window to Clipboard",
        "capture_window_to_file": "Capture Window to File",
        "close_application": "Close Application",
        "close_window": "Close Window/Tab",
        "copy": "Copy",
        "cut": "Cut",
        "down_level": "Move Down Level",
        "explorer": "Open Explorer",
        "forward": "Forward",
        "language": "Change Language",
        "lock": "Lock Screen",
        "maximize": "Maximize Window",
        "minimize": "Minimize Window",
        "mission_control": "Mission Control",
        "mission_control_left": "Previous Desktop",
        "mission_control_right": "Next Desktop",
        "monitor_brightness_down": "Screen Brightness Down",
        "monitor_brightness_up": "Screen Brightness Up",
        "monitor_left": "Move Window to Left Screen",
        "monitor_right": "Move Window to Right Screen",
        "paste": "Paste",
        "redo": "Redo",
        "run": "Open Run Dialog",
        "show_desktop": "Show Desktop",
        "switch_apps": "Switch Applications",
        "system_info": "Open System Info",
        "task_manager": "Open Task Manager",
        "taskbar": "Show Taskbar",
        "undo": "Undo",
        "up_level": "Move Up Level"
      },
      "title": {
        "common": "Common Shortcuts",
        "mac": "Mac OS Shortcuts",
        "main": "OS Shortcuts",
        "win": "Windows Shortcuts"
      }
    },
    "presets": {
      "customLabel": "Custom",
      "presetAction": "Explosive Action",
      "presetBalanced": "Balanced",
      "presetBassBoost": "Bass Boost",
      "presetCinema": "Cinema",
      "presetDescription": {
        "cinema": "Simulates listening to 7.1 speakers in a large theater",
        "game": "Designed for accuracy, optimized for gameplay",
        "studio": "Simulates listening to 7.1 speakers in a studio environment"
      },
      "presetEntertainment": "Entertainment",
      "presetExcite": "Excite",
      "presetFPS": "FPS",
      "presetFlat": "Flat",
      "presetFocus": "Focus",
      "presetGame": "Game",
      "presetImmersion": "Immersion",
      "presetMMO": "MMO",
      "presetMovie": "Movie",
      "presetMusic": "Music",
      "presetPerformance": "Performance",
      "presetReference": "Reference",
      "presetSmiley": "Smiley",
      "presetSports": "Sports",
      "presetStudio": "Studio",
      "presetVoice": "Voice",
      "presets": "Presets"
    },
    "promos": {
      "redeemButtonError": "An error occurred. Please try again later.",
      "redeemButtonErrorLatestVersion": "An error has occurred, please ensure you are on the latest version of GG",
      "redeemButtonErrorVerifyAccount": "To claim your #GAMENAME# code, verify your email address."
    },
    "sensei": {
      "exactAccel": "ExactAccel",
      "exactAccelExactAim": "ExactAccel / ExactAim",
      "exactAim": "ExactAim",
      "exactLift": "ExactLift",
      "exactSens": "ExactSens CPI_NUM (CPI CPI_NUM)",
      "freeMove": "FreeMove",
      "onboardProfilesTooltip": "The following cannot be exported to a Sensei mouse: Text macros, custom Playback Options, Deploy Configuration bindings, Launch Application bindings, OS Shortcut bindings, Record Macro bindings, and Media Key bindings. Although Keypress Macros can be exported, they will be renamed."
    },
    "soundstage": {
      "actions": {
        "HeadphoneOut": "Headphone out",
        "LineOut": "Line out",
        "OutPathSwitch": "Audio Path - switch",
        "auxDeviceSwitch": "Sonar Aux Device switch",
        "auxMonitor": "Aux - Personal",
        "auxStream": "Aux - Stream",
        "chatDeviceSwitch": "Sonar Chat Device switch",
        "chatMixChat": "Sonar ChatMix Chat",
        "chatMixGame": "Sonar ChatMix Game",
        "chatMonitor": "Chat - Personal",
        "chatStream": "Chat - Stream",
        "gameDeviceSwitch": "Sonar Game Device switch",
        "gameMonitor": "Game - Personal",
        "gameStream": "Game - Stream",
        "masterMonitor": "Master - Personal",
        "masterMute": "Sonar Master Mute",
        "masterStream": "Master - Stream",
        "masterVolumeDown": "Sonar Master Volume Down",
        "masterVolumeUp": "Sonar Master Volume Up",
        "mediaDeviceSwitch": "Sonar Media Device switch",
        "mediaMonitor": "Media - Personal",
        "mediaStream": "Media - Stream",
        "micDeviceSwitch": "Sonar Mic Device switch",
        "micMonitor": "Mic - Personal",
        "micMute": "Sonar Mic Mute",
        "micStream": "Mic - Stream"
      },
      "aec": {
        "audioSamplePlayerPopup": "It is recommend testing Echo Cancellation effect in a real-life scenario like voice chat/call ",
        "settingOff": "ECHO CANCELLATION - OFF",
        "settingOn": "ECHO CANCELLATION - ON"
      },
      "alertBanner": {
        "doubleEq": {
          "alertText": "Ensure your #DEVICENAME# equalizer settings in Engine are set to 'Flat' to prevent audio distortion.",
          "closeModal": {
            "message": "Please ensure to set your equalizer to 'Flat' in Engine to avoid sound distortion on your #DEVICENAME#.",
            "multipleWarningsMessage": "Please ensure to set your equalizer to 'Flat' in Engine to avoid sound distortion on your devices.",
            "subtitle": "Risk of audio distortion"
          },
          "link": "Open Settings"
        },
        "notifications": "Notifications",
        "vadStatus": {
          "alertText": "Set Sonar devices as your default audio devices in your windows sound settings.",
          "aux": {
            "alertText": "Aux VAD is disabled in windows sound settings."
          },
          "link": "Click to auto set defaults",
          "media": {
            "alertText": "Media VAD is disabled in windows sound settings.",
            "link": "Click to activate it"
          }
        }
      },
      "appFaq": {
        "tooltip": "Not hearing any sounds? Check out our FAQ section to get some help."
      },
      "audioSamplePlayer": {
        "audioSamples": {
          "chat": "Communication",
          "chatNoisy": "Communication + noise",
          "gaming": "Gaming",
          "movie": "Movie",
          "music": "Music",
          "virtualSurround": "Spatial"
        },
        "pause": "Pause #AUDIOSAMPLENAME#",
        "play": "Play #AUDIOSAMPLENAME#",
        "redirectionNotSet": {
          "tooltip": "Select an output device in the Mixer tab to play the test audio sample"
        },
        "title": "Test"
      },
      "automaticNoiseGate": {
        "label": "Automatically compute the threshold for the noise gate effect."
      },
      "bassBoost": {
        "label": "Bass"
      },
      "button": {
        "iGotIt": "I got it",
        "loopback": {
          "tooltip": "Listen to what your audience hears"
        }
      },
      "chatNoiseCanceling": {
        "disabledTooltip": "Feature not available for your device",
        "label": "Clearcast AI noise cancellation",
        "lessEffect": "Min",
        "moreEffect": "Max",
        "tooltip": "Make your teammates voice crystal clear by removing any non-vocal sounds and echo with ClearCast AI powered noise cancelling, updated with the new de-reverb feature."
      },
      "chatmix": {
        "name": "ChatMix",
        "tooltipDisabed": {
          "differentDeviceSelected": "Please select same playback device for Game and Chat to use ChatMix",
          "finiteWheel": "Please use your hardware dial to control ChatMix",
          "noDeviceSelected": "Please select a playback device to use ChatMix"
        }
      },
      "configuration": {
        "addFavorite": "Add favorite",
        "browse": "browse",
        "communityPresets": "Community presets",
        "favorite": "Favorite",
        "favoriteDisabled": "Maximum number of favorites reached",
        "favorites": "Favorites",
        "importModal": {
          "activateDevice": "Activate #ROLE# channel and try again"
        },
        "live": "Live",
        "myPresets": "My presets",
        "noFavorites": "No favorites",
        "noResults": "No results.",
        "preset": "Preset",
        "search": "Search",
        "steelseries": "SteelSeries",
        "unfavorite": "Unfavorite"
      },
      "configurations": {
        "addNewModal": {
          "Label": "Name your new config"
        },
        "deleteModal": {
          "header": "Are you sure you want to delete?",
          "subHeader": "You will lose any settings applied to this configuration."
        },
        "exportModal": {
          "authorLabel": "Created By",
          "channelLabel": "Channel",
          "label": "Name",
          "saveError": "There was a problem sharing your config.  Please try again later",
          "title": "Share a configuration"
        },
        "importModal": {
          "authorLabel": "Created by",
          "fetchConfigErrorHeader": "Error: Configuration data invalid",
          "fetchConfigErrorMessage1": "Oops, this file was not handled with care and it cannot be imported into Sonar",
          "fetchConfigErrorMessage2": "Please try another configuration to import",
          "fetchConfigErrorTitle": "Configuration cannot be imported",
          "importConfigError": "There was a problem importing the config",
          "nameLabel": "Name",
          "title": "Import a configuration",
          "updateGGErrorHeader": "Error: Update needed",
          "updateGGErrorMessage": "Please update GG as the configuration you're attempting to import was made on a more recent version of Sonar",
          "updateGGErrorTitle": "Configuration cannot be imported"
        },
        "nameTaken": "This name has already been used.",
        "renameModal": {
          "label": "Rename your config"
        },
        "resetModal": {
          "header": "Are you sure you want to reset?",
          "subHeader": "Any setting applied to this configuration will be reset to default."
        },
        "saveAsModal": {
          "label": "Name your config"
        },
        "selectImageModal": {
          "title": "Choose image"
        }
      },
      "confirmationPage": {
        "bulletPoint": {
          "Mix": {
            "description": "Fine-tune your sound to perfection with our multichannel mixer. ChatMix allows you to easily balance game and chat audio.",
            "title": "Audio Mixer and ChatMix"
          },
          "anc": {
            "description": "Get crystal-clear comms with your squad. Apply noise cancellation to your audio or your friends audio, so you can focus on the action without any distractions.",
            "title": "Clearcast AI Noise Cancellation"
          },
          "eqParametric": {
            "description": "Designed by our sound engineers, these presets optimize audio for each game, enhancing key sounds to give you a competitive edge.",
            "title": "Presets"
          }
        },
        "nudgeMessage": {
          "completeOnboardingToImport": "Complete Sonar onboarding to import your preset",
          "turnOnToImport": "Turn on Sonar to import your preset"
        },
        "title": "Embrace the future of sound"
      },
      "device": {
        "excludedDeviceTooltip": "This device is excluded from the backup device switch list"
      },
      "deviceDropdown": {
        "AllExcluded": "All excluded devices",
        "AllOutput": "All output devices",
        "excludedPlaceholder": "Drag & drop a device to exclude",
        "input": "#ROLE# input",
        "output": "#ROLE# output",
        "redirectionErrorMessage": "Select a device..."
      },
      "deviceManager": {
        "allDevices": "All devices",
        "backupDeviceSwitch": {
          "auto": {
            "description": "Sonar will handle your devices like a pro ensuring an endless audio experience!",
            "label": "Auto"
          },
          "description": {
            "auto": "Auto: Sonar will automatically switch to the next available device if your current one is disconnected for any reason.",
            "manual": "Manual: You need to manually select your devices if they disconnect."
          },
          "manual": {
            "description": "You need to manually select your devices if they disconnect or run out of battery.",
            "label": "Manual"
          },
          "title": "Backup device switch",
          "turnOffModal": {
            "extra": "If deactivated you will need to manually switch between the devices.",
            "label": "Do you wish to turn off the automatic backup device switch ?"
          }
        },
        "backupDeviceSwitchOnBoot": {
          "description": "When booting up/rebooting the PC if previous playback device is unavailable Sonar will switch to the highest priority device that is available from the device priority list below",
          "title": "Automatic backup device switch at boot/reboot"
        },
        "channelFormat": "Channel format",
        "deviceList": {
          "currentDevice": "Current device",
          "excluded": {
            "title": "Excluded devices",
            "titleTooltip": "Devices that you never want to use."
          },
          "input": {
            "title": "Input device priority list"
          },
          "nextDevice": "Next device",
          "output": {
            "title": "OUTPUT DEVICE PRIORITY LIST",
            "titleTooltip": "Arrange your devices in the order you want to switch to them."
          },
          "previousDevice": "Previous device",
          "previousNextDevice": "Next / Previous device"
        },
        "deviceWidgetTitle": "#TABID# devices",
        "disableButton": "Disable #TABID# channel",
        "linkAll": {
          "confirmation": {
            "content": {
              "description": "The current device priority list and device shortcuts will be copied as displayed currently for all output channels.",
              "title": "Would you like to overwrite your settings?"
            },
            "title": "Use the same device on all output channels"
          },
          "tooltip": "Tired of changing your device one by one on each channel ? Try this !"
        },
        "onboarding": {
          "firstSlide": {
            "content": {
              "firstLine": "Drag and drop to order devices",
              "secondLine": "Exclude devices by dropping them in the exclusion area"
            },
            "footer": {
              "firstLine": "Sorting and exclusion will be used for shortcuts to switch devices and backup device switch",
              "secondLine": "Start customizing now!"
            },
            "subTitle": "Discover the new device dropdowns to effortlessly order your devices.",
            "title": "Master Your Device Setup!"
          },
          "secondSlide": {
            "content": {
              "firstLine": "Effortlessly link, order and exclude devices",
              "secondLine": "Set up volume & device shortcuts and manage all backup options"
            },
            "footer": "Gain full control over your device management now and elevate your audio experience",
            "subTitle": "Experience ultimate control over your devices with device manager page",
            "title": "Unlock Advanced Control!"
          }
        },
        "onlyActiveDevices": "Only active devices",
        "shortcuts": {
          "AllOutputDeviceChange": "All output device change",
          "deviceChange": "Device change",
          "linkAllTooltip": "Define your keybinds",
          "tooltip": "Define your keybinds for the #TABID# channel",
          "volumeMute": "Volume & Mute"
        },
        "show": "Show",
        "ssWirelessTrigger": {
          "descriptionForNova": "When enabled, your system will switch to another available audio device (like speakers) when the headset is turned off but still connected via dongle.Turn this off if you prefer to keep the headset selected even when it's powered down.",
          "descriptionForNovaPro": "Note for Arctis Nova Pro Wireless users: To allow your headset to switch to line out (e.g., via the base station) when powered off, this setting must be turned off.",
          "descriptionForNovaTitle": "*Applies only to SteelSeries Arctis Nova Wireless headsets*",
          "title": "Auto-switch when Nova Wireless headset is powered off"
        },
        "title": "Device Manager",
        "wirelessState": {
          "dropdown": {
            "tooltip": {
              "offline": "Wireless Off",
              "online": "Wireless On"
            }
          },
          "tooltip": {
            "offline": "Device is connected but the headset is off",
            "online": "Device is connected and the headset is on"
          }
        }
      },
      "deviceRouting": {
        "infoTooltip": "#APPNAME# might not allow Sonar to change the audio settings. If needed, adjust the audio settings directly within #APPNAME#",
        "warningTooltip": "#APPNAME# didn't allow Sonar to change the audio settings. Adjust the audio settings directly within #APPNAME#"
      },
      "disableVadModal": {
        "subtitle": "Disabling an audio channel will trigger the following events:",
        "warning1": "Applications will be rerouted to the default channel.",
        "warning2": "The channel won't be available for backup device switch.",
        "warning3": "Shortcuts will be deactivated.",
        "warning4": "It will not be possible to import presets to this channel."
      },
      "discord": {
        "join": {
          "caption": "Join Sonar Discord server"
        }
      },
      "dismissibleModal": {
        "checkbox": "Never show this again"
      },
      "enableVadbutton": "Enable #ROLE# channel",
      "equalizer": {
        "filterTypes": {
          "allPass": "ALL PASS",
          "bandPassPeak0dB": "BAND PASS PEAK 0dB",
          "bandPassPeakQ": "BAND PASS PEAK Q",
          "bypass": "BYPASS",
          "highPass": "HIGH PASS",
          "highShelving": "HIGH SHELVING",
          "label": "Filter Type",
          "lowPass": "LOW PASS",
          "lowShelving": "LOW SHELVING",
          "notchFilter": "NOTCH FILTER",
          "peakingEq": "PEAKING EQ"
        },
        "filters": {
          "bandNumber": "Band #BANDNUMBER#",
          "qFactor": "Q Factor"
        },
        "frequencyRanges": {
          "bass": "Bass",
          "highs": "Highs",
          "lowMids": "Low Mids",
          "midRange": "Mid Range",
          "subBass": "Sub Bass",
          "upperMids": "Upper Mids"
        },
        "label": "Equalizer",
        "tooltip": "Adjust each band to hear more or less of the sound from individual frequencies"
      },
      "generalGain": {
        "label": "Volume boost",
        "tooltip": "Increasing this value will boost the volume before processing"
      },
      "importConfigAlerts": {
        "activateSonarToImportTitle": "Configuration cannot be imported",
        "loginButtonCta": "Log in",
        "loginToImport": "Please log in to continue importing the Sonar configuration"
      },
      "information": {
        "appRouting": {
          "description": {
            "info1": "To route audio, simply drag & drop apps in the App section.",
            "info2": "Some apps like Discord and Teams require audio routing in their sound settings, select a Sonar Virtual Audio Device as an output.",
            "info3": "With these apps, the app’s tag may revert to its initial position when you try to drag it.",
            "info4": "For more information, please visit our FAQ page."
          },
          "mainLabel": "Assign your apps like a pro"
        },
        "quickset": {
          "description": {
            "info1": "With QuickSet, Sonar now auto-detects your games and loads presets instantly.",
            "info2": "1. Select your game profile in Quickset.",
            "info3": "2. Associate your Sonar presets—then let GG do the rest !",
            "info4": "Stay ahead, hear enemies first, and dominate every match!"
          },
          "mainLabel": "Game-Ready Audio, Every Time!",
          "openQuickset": "Open QuickSet"
        },
        "routing": {
          "description": {
            "checkSoundPlayingStep": "2. Make sure that the app or browser you want to link is open and playing.",
            "deviceRoutingStep": "3. Click on the button ‘App to device routing’ select your app and assign ‘Steelseries Sonar - Media’ or ‘Steelseries Sonar - Aux’ as Output device.",
            "howTo": "How to set it up ?",
            "selectDeviceStep": "1. Go to the settings panel and select your Playback device."
          },
          "mainLabel": "Blast your apps in the media and aux channel while playing and chatting!"
        }
      },
      "labelPreset": {
        "chat": {
          "default": {
            "eq": {
              "bass": "Bass",
              "highs": "Highs",
              "lowMids": "Low Mids",
              "midRange": "Mid Range",
              "subBass": "Sub Bass",
              "upperMids": "Upper Mids"
            },
            "name": "Default"
          },
          "voice": {
            "eq": {
              "air": "Air",
              "box": "Box",
              "coreVoice": "Core Voice",
              "lowEndRumbles": "Low End Rumbles",
              "midRange": "Mid Range",
              "sibilance": "Sibilance"
            },
            "name": "Voice"
          }
        },
        "gaming": {
          "apexLegends": {
            "eq": {
              "footsteps": "Footsteps",
              "heal": "Heal",
              "immersion": "Immersion",
              "knock": "Knock"
            },
            "name": "Apex Legends"
          },
          "codWarzone": {
            "eq": {
              "footsteps": "Footsteps",
              "immersion": "Immersion",
              "revive": "Revive"
            },
            "name": "COD Warzone"
          },
          "csgo": {
            "eq": {
              "bomb": "Bomb",
              "footsteps": "Footsteps",
              "immersion": "Immersion"
            },
            "name": "CS:GO"
          },
          "default": {
            "eq": {
              "bass": "Bass",
              "highs": "Highs",
              "lowMids": "Low Mids",
              "midRange": "Mid Range",
              "subBass": "Sub Bass",
              "upperMids": "Upper Mids"
            },
            "name": "Default"
          },
          "footsteps": {
            "eq": {
              "footsteps": "Footsteps",
              "immersion": "Immersion"
            },
            "name": "FPS Footsteps"
          },
          "fortnite": {
            "eq": {
              "drink": "Drink",
              "footsteps": "Footsteps"
            },
            "name": "Fortnite"
          },
          "haloInfinite": {
            "eq": {
              "footsteps": "Footsteps",
              "immersion": "Immersion"
            },
            "name": "Halo Infinite"
          },
          "rainbowSix": {
            "eq": {
              "bomb": "Bomb",
              "footsteps": "Footsteps",
              "immersion": "Immersion"
            },
            "name": "Rainbow Six Siege"
          },
          "splitgateArenaWarfare": {
            "eq": {
              "footsteps": "Footsteps",
              "immersion": "Immersion",
              "portal": "Portal"
            },
            "name": "Splitgate"
          },
          "valorant": {
            "eq": {
              "footsteps": "Footsteps",
              "immersion": "Immersion",
              "spike": "Spike"
            },
            "name": "Valorant"
          }
        },
        "microphone": {
          "default": {
            "eq": {
              "bass": "Bass",
              "highs": "Highs",
              "lowMids": "Low Mids",
              "midRange": "Mid Range",
              "subBass": "Sub Bass",
              "upperMids": "Upper Mids"
            },
            "name": "Default"
          },
          "voice": {
            "eq": {
              "air": "Air",
              "box": "Box",
              "coreVoice": "Core Voice",
              "lowEndRumbles": "Low End Rumbles",
              "midRange": "Mid Range",
              "sibilance": "Sibilance"
            },
            "name": "Voice"
          }
        }
      },
      "loading": {
        "errorPage": {
          "cantOpenDbError": "Something went wrong during setup. Please download and reinstall GG without uninstalling to preserve your settings and presets.",
          "downloadGG": "Something went wrong during setup. Please download and reinstall GG without uninstalling to preserve your settings and presets.",
          "error": "ERROR: ",
          "ggConnectionFailed": "Unable to connect to GG. Please retry. If the issue persists, close and restart it",
          "incorrectVersion": "Update error detected (incorrect version). Please download and reinstall GG without uninstalling to preserve your settings and presets.",
          "loadingFailed": "Unable to start Sonar. Please retry",
          "missingAPOFiles": "Something went wrong during setup. Please download and reinstall GG without uninstalling to preserve your settings and presets.",
          "missingFiles": "Looks like some Sonar files are missing. Please download and reinstall GG without uninstalling to preserve your settings and presets.",
          "multipleInstance": "Multiple Sonar instances are running at the same time. Please close extra ones and retry",
          "redirectionLibInitError": "Something went wrong during startup. Be sure your computer and drivers are up-to-date. If the issue persists, restart your computer.",
          "title": "OOPS !",
          "unexpectedKill": "Sonar was closed unexpectedly. Please retry",
          "unhandledError": "Startup error encountered. Please retry"
        },
        "firstLoading": {
          "audioDreams": "Bringing your audio dreams to life",
          "bootingUp": "Sonar booting up faster than you can say GG",
          "epicAudio": "Stay frosty, epic audio awaits!",
          "getReady": "Get ready to rock your gaming world with epic sound",
          "holdOn": "Hold onto your headsets, it's about to get real",
          "levelUp": "It's like leveling up, but for your ears",
          "proSound": "Get hyped for pro-level sound!",
          "readyToRace": "Ready to race through sound barriers!",
          "secretSound": "THE secret sauce for your sound",
          "title": "LOADING..."
        },
        "funFact": {
          "pepperidgeFarm": "Soundstage. Pepperidge Farm remembers.",
          "respawnJoy": "An audio experience that'll make you respawn with joy!",
          "title": "FUN FACT",
          "unbeataleSound": "Sonar: The cheat code for unbeatable sound!"
        },
        "proTip": {
          "audioSpot": "Experiment with Sonar's presets to find your audio sweet spot.",
          "clearCast": "Activate Sonar's ClearCast Ai noise-cancellation to make your voice shine amidst the chaos.",
          "compressor": "Sonar's audio compressor prevents volume spikes and distortion for balance your voice.",
          "features": "Fallback... Overlays... Shortcuts... Alias pro ?",
          "fineTune": "Use Sonar's mixer to fine-tune sound levels for every gaming setup.",
          "immersion": "Maximize audio immersion: Sonar's Spatial sound feature is your best friend.",
          "noiseGate": "Sonar's Noise Gate feature helps maintain a clean audio signal by eliminating static noises.",
          "routing": "Certain apps resist external routing changes. Navigate inside them for tweaks. Discord, we're looking at you!",
          "title": "PRO TIP"
        }
      },
      "mic": {
        "explore": "Explore",
        "exploreLabel": "Mic made for gaming"
      },
      "micMonitoring": {
        "actions": {
          "pause": "Pause",
          "play": "Play",
          "startRecord": "Record",
          "stopRecord": "Stop recording"
        },
        "errors": {
          "noChatRedirectionSet": "Please select a Chat playback device in the Mixer tab to use this feature",
          "noMicRedirectionSet": "Please select an input device in the Mixer tab to record",
          "noRecordFound": "Record a sample first"
        }
      },
      "micNoiseCanceling": {
        "label": "Clearcast AI noise cancellation",
        "lessEffect": "Min",
        "moreEffect": "Max",
        "tooltip": "Make your own voice crystal clear by removing any non-vocal sounds and echo with ClearCast AI powered noise cancelling, updated with the new de-reverb feature."
      },
      "mixer": {
        "addTo": "Add to",
        "apps": "Apps",
        "appsToBeRouted": "Apps to be routed",
        "audioPort": {
          "informationTooltip": "Works with a headset and/or speakers connected by a wire to the Alias pro microphone.",
          "title": "Audio port"
        },
        "bindings": {
          "buttonLabel": "Setup in Engine",
          "title": "Bindings"
        },
        "deviceDropdown": {
          "moreOption": "#NUMBER# more..."
        },
        "deviceFormat": {
          "48kHz24Bits": "Hi-Res 24 bit / 48 kHz",
          "96kHz24Bits": "Hi-Res 24 bit / 96 kHz",
          "label": "Format"
        },
        "devices": "Devices",
        "enableVad": "Add #ROLE# channel",
        "endpointType": {
          "capture": "Input",
          "render": "Playback"
        },
        "enterdBValue": "Enter dB value",
        "headphoneOut": "Headphone out",
        "headphoneOutMaster": "Headphone out master",
        "lineOut": "Line out",
        "lineOutMaster": "Line out master",
        "linkAll": {
          "tooltip": {
            "Off": "Click to use the same device on all output channels",
            "On": "Click to use different devices on each output channel"
          }
        },
        "noDeviceSelected": "No device selected",
        "routing": "Routing",
        "selectCaptureDevice": "Please select an input device",
        "selectDevices": "Please select devices",
        "selectRenderDevice": "Please select a playback device",
        "shortcuts": {
          "informationTooltip": "Assign your shortcuts. Press Enter to validate and ESC to cancel."
        }
      },
      "mode": {
        "dropdown": {
          "mic": "Mic Input",
          "monitor": "Personal Mix",
          "stream": "Stream Mix"
        },
        "loading": {
          "line1": "Please wait a minute",
          "line2": {
            "off": "We are turning streamer mode off for you",
            "on": "We are turning streamer mode on for you"
          }
        },
        "stream": "Streamer mode",
        "switch": {
          "tooltip": "A dedicated space for streamers, set up and manage audio channels for you and your audience"
        },
        "tutorial": {
          "stream": "Tutorial Streamer Mode"
        }
      },
      "noiseCanceling": {
        "SubTitleMessage": "Disabled while Clearcast AI noise cancellation is active"
      },
      "noiseGate": {
        "label": "Noise Gate",
        "tooltip": "Completely cut off the sound when its volume is below the threshold."
      },
      "noiseReduction": {
        "label": "Noise Reduction",
        "settings": {
          "impactNoiseReduction": "Impact",
          "noiseReduction": "Background"
        },
        "tooltip": "Background reduces static noise like the one coming from your PC fans; Impact reduces keystroke-like/click noise."
      },
      "onboarding": {
        "config": {
          "aux": {
            "description": "Optimize your media apps with SteelSeries presets made by our sound engineers",
            "title": "Custom Aux Presets"
          },
          "chat": {
            "description": "Optimize your comms with SteelSeries presets made by our sound engineers",
            "title": "Custom Chat Presets"
          },
          "game": {
            "description": "Optimize your in-game sound with SteelSeries presets made by our sound engineers",
            "title": "Custom Game Presets"
          },
          "media": {
            "description": "Optimize your media apps with SteelSeries presets made by our sound engineers",
            "title": "Custom Media Presets"
          },
          "mic": {
            "description": "Optimize your microphone with SteelSeries presets made by our sound engineers",
            "title": "Custom Mic Presets"
          },
          "selectLabel": "CONFIGURATION"
        },
        "devicesSelection": {
          "description": "Setup your playback and input device and start using Sonar",
          "label": "Just a Few Clicks Away",
          "tipMessage": {
            "description": "Customize your audio by assigning different devices to each channel in the Mixer page — game sound in your headset, music through your speakers!",
            "title": "Tip:"
          }
        },
        "fallback": {
          "description": "Sonar will automatically select the next available device if your current one is disconnected for any reason.",
          "label": "Continuous Sound with Backup Device Switch",
          "setting": {
            "disabled": {
              "tip": {
                "description": "You will need to manually select your devices if they disconnect or run out of battery.",
                "title": "Warning: "
              }
            },
            "enabled": {
              "tip": {
                "description": "Sonar will handle your devices like a pro—ensuring an endless audio experience!",
                "title": "Awesome! "
              }
            },
            "label": "Automatic Backup Device switch"
          },
          "tip": {
            "description": "Dive into advanced settings under Mixer > Devices > Device Manager",
            "title": "Tip: "
          }
        },
        "inputDevices": {
          "selectLabel": "Input"
        },
        "intro": {
          "description": "Setup your output and input devices and start using Sonar",
          "label": "Just a few clicks away"
        },
        "optimizing": {
          "done": {
            "button": "Game On"
          },
          "inProgress": {
            "description": "Hang tight ! We’re splitting the audio into channels, allowing you to personalize sound for your different apps.",
            "label": "Setting up devices"
          },
          "noDeviceSelected": "No Device Selected"
        },
        "playbackDevices": {
          "selectLabel": "Playback"
        },
        "steelseries": {
          "optimizing": {
            "description": "Get ready to rock your gaming world with epic sound",
            "label": "Setting Sonar up...",
            "steps": {
              "boot": "Booting up Sonar",
              "configureChannels": "Creating channels in Mixer",
              "setup": "Setting up your device"
            }
          }
        }
      },
      "overlays": {
        "multipleActionsOverlay": {
          "title": "Multiple actions"
        },
        "muteOverlay": {
          "muted": {
            "title": "Muted"
          },
          "unmuted": {
            "title": "Unmuted"
          }
        }
      },
      "parametricEQ": {
        "tooltip": "Adjust frequency, gain and Q-factor to shape the sound with surgical precision. Add and remove up to 10 individual bands. Easily impact bass,voice and treble frequencies with built in sliders"
      },
      "quickSet": {
        "help": {
          "tooltip": "Click to learn more"
        },
        "linkedToMulti": {
          "tooltip": "Linked to #PROFILES# profiles"
        },
        "linkedToSingle": {
          "tooltip": "Linked to #PROFILE# profile"
        }
      },
      "redirection": {
        "checkbox": {
          "monitor": "Add to personal mix",
          "stream": "Add to stream mix"
        },
        "error": "Something went wrong. Check your device's status or pick another one"
      },
      "settings": {
        "fallback": {
          "autoFallback": {
            "description": "If your current playback device is unplugged or becomes unavailable, Sonar will seamlessly switch to the next available device placed highest in the priority list below.",
            "title": "Automatic backup device switch",
            "turnOffModal": {
              "extra": "If deactivated you will need to manually switch between the devices.",
              "label": "Do you wish to turn off the automatic backup device switch ?"
            }
          },
          "autoFallbackBoot": {
            "description": "When booting up/rebooting the PC if previous playback device is unavailable Sonar will switch to the highest priority device that is available from the device priority list below",
            "title": "Automatic backup device switch at boot/reboot"
          },
          "description": "Manage the behavior of the backup system when your primary playback device becomes unavailable. Sonar will seamlessly switch to the next available audio device.#EOL#This feature is not available in streamer mode",
          "emptyFallbackList": "No device",
          "excludedDevices": "Excluded devices",
          "feedbackLink": {
            "description": "Help us improving this feature",
            "title": "Give feedback"
          },
          "linkAll": {
            "confirmation": {
              "description": "The current device priority list for all output channels will be copied as displayed currently.",
              "title": "Would you like to overwrite your settings?"
            },
            "label": "Link all output channels"
          },
          "playbackDevices": "Playback devices",
          "priorityList": {
            "description": "If the current device becomes unavailable, Sonar will pick the next one in line, as shown. Devices that are greyed out are currently not connected or unavailable.",
            "header": "Device priority list"
          },
          "ssWirelessTrigger": {
            "description": "To enable your Arctis Nova Pro Wireless to transition to line out upon powering off the headset, this feature should be off",
            "title": "Consider my wireless device as unavailable if it is plugged in but not powered on",
            "unlock": "Activate the automatic backup device switch to unlock this feature"
          },
          "title": "Backup device switch",
          "unknownDevice": "Unknown device",
          "wireless": {
            "description": "Only available with Arctis Nova wireless headset line",
            "title": "Steelseries wireless headset options"
          }
        },
        "overlays": {
          "description": "Turn on & off overlays to notify you that Sonar is working in the background.",
          "deviceChange": "Device change",
          "displayHardwareTriggeredToggle": {
            "description": "Turn on & off hardware triggered overlays (Alias - Alias pro)",
            "label": "Display hardware triggered overlays"
          },
          "displayToggle": {
            "description": "Sonar will display an animation to let you know that an event has taken place.",
            "label": "Display overlays"
          },
          "multipleActions": "Multiple actions",
          "mute": "Mute / Unmute",
          "position": {
            "bottomLeft": "Bottom Left",
            "bottomRight": "Bottom Right",
            "centerLeft": "Center Left",
            "centerRight": "Center Right",
            "label": "Overlay position",
            "topLeft": "Top Left",
            "topRight": "Top Right"
          },
          "title": "Overlays",
          "volume": "Volume"
        },
        "shortcuts": {
          "description": "Define your keybinds for Sonar. Shortcuts can use modifiers like Ctrl, Shift, Alt or a single key press. If Moments is on please be mindful not to set the same shortcuts.",
          "deviceChangeTitle": "Device change",
          "headline": "Sonar shortcuts",
          "linkedChannels": "Linked channels",
          "monitor": "Personal",
          "mute": "Mute",
          "nextDevice": "Next device",
          "previousDevice": "Previous device",
          "stream": "Stream",
          "title": "Shortcuts",
          "unmute": "Unmute",
          "volumeDown": "Volume Down",
          "volumeMuteTitle": "Volume & mute",
          "volumeUp": "Volume Up"
        }
      },
      "smartVolume": {
        "label": "Smart Volume",
        "tooltip": "Automatically keeps the volume in a range so that it never gets too loud or inaudible. Adjust the level slider to set the impact of the effect"
      },
      "sonarAudio": "Sonar Audio",
      "soundstageDisabledToolTip": "Sonar is off",
      "splash": {
        "content": {
          "1": {
            "description": "For the first time in gaming, you can tweak the entire spectrum of sound with magical precision. Hear footsteps, reloads and bomb plants better than ever.",
            "title": "Spot your enemy sooner"
          },
          "2": {
            "description": "Don’t be limited to tweaking all your sound or nothing at all. Use Sonar to tune your game and chat app audio independently for optimized in-game sound and crystal-clear comms.",
            "title": "Crush the competition – not your comms"
          },
          "3": {
            "description": "Whether you’re calling the shots or not, you wanna stay in contact with your squad. Use noise reduction or set a custom EQ to tune your microphone to perfection.",
            "title": "Slay together, stay together"
          }
        },
        "header": {
          "description": "Pinpoint your enemy’s location long before you see them with Sonar, a breakthrough in gaming sound that trains you to hear the unheard.",
          "title": "Hear what matters most"
        }
      },
      "streamMixerOnboarding": {
        "obsStudio": "OBS Studio",
        "slide1": {
          "line1": "Set up your audio channels and route sound directly to them.",
          "line2": "Filter audio from your personal and stream mix by muting channels.",
          "line3": "Send sound easily to your streaming softwares.",
          "subTitle": "Set up your streaming audio in 3 easy steps.",
          "title": "Deliver the finest audio to your audience"
        },
        "slide2": {
          "line1": "Route the sound of your apps to the channels. Remember, your apps need to be open and playing !",
          "line2": "Control the sound level for you and your stream (audience).",
          "subTitle": "How to set up your audio channels?",
          "title": "Personalize the audio experience of each app"
        },
        "slide3": {
          "line1": "Easily add and remove channels from your personal mix or your stream mix (audience) with the ‘Add to’ option in the channel’s settings panel.",
          "line2": "Or you can temporarily remove sound by muting channels.",
          "subTitle": "Decide which channels are heard by who.",
          "title": "Not everything needs to be shared!"
        },
        "slide4": {
          "line1": "Hook up your Stream mix to your streaming software.",
          "line2": "Find a detailed ‘How-to’ description in our FAQ for each software.",
          "subTitle": "Sonar supports all the streaming software on the market.",
          "title": "How to send sound to your stream"
        },
        "streamlabs": "Streamlabs",
        "twitchStudio": "Twitch studio",
        "xSplit": "XSplit"
      },
      "targetDeviceModal": {
        "bothOption": "Switch both output and input",
        "contentTitle": "Your device #DEVICE_NAME# is not selected in Sonar. We recommend you switch it for the most optimal experience.",
        "dismissCheckbox": "Dismiss for 30 days",
        "modalTitle": "Device not configured for Sonar",
        "onlyInputOption": "Switch input only",
        "onlyOutputOption": "Switch output only"
      },
      "trebleBoost": {
        "label": "Treble"
      },
      "turnOffSonar": "Turn off Sonar",
      "turnOnSonar": "Turn on Sonar",
      "updateFirmwareModal": {
        "description": "Sonar requires that your headset is updated to ensure an amazing experience.  Please click on 'Update' button below and you will be navigated to Engine, where you can update the firmware on your headset.",
        "title": "One thing before we get Sonar started",
        "updateButton": "Update"
      },
      "virtualAudioDevice": {
        "disable": " Disable channel",
        "mic": "Mic"
      },
      "virtualSurround": {
        "formFactor": {
          "headphones": "Headphone mode",
          "speakers": "Speaker mode"
        },
        "label": "Spatial Audio",
        "settings": {
          "description": "Tune slider towards Performance to improve the senses of directionality and localization, which are ideal for competitive FPS games. Or tune it towards Immersion to improve the environmental effects for a more realistic surround experience, which is ideal for story driven games and movies. Adjust the speaker position and distance to further customize your spatial audio",
          "reverbGainDB": {
            "high": "Immersion",
            "low": "Performance"
          },
          "speakerDistance": "Distance",
          "title": "Tuning "
        },
        "subLabel": {
          "surroundDevice": "Disabled while using a device with real surround system"
        },
        "tooltip": {
          "advancedTooltip": "Make the sound come from all around you for better awareness of your surroundings. Our technology is made to provide you the best competitive/immersive audio experience. Adjust advanced settings like the speaker positions and distance for more customization.",
          "lockTooltip": "Advanced settings not available for your device ",
          "surroundDevice": "You are on a Real Surround System virtualization is not available"
        },
        "widget": {
          "information": {
            "arenaSpeakers": "Optimized for Arena Speakers"
          }
        }
      },
      "virtualSurroundChannels": {
        "center": "Center",
        "frontLeft": "Front Left",
        "frontRight": "Front Right",
        "rearLeft": "Rear Left",
        "rearRight": "Rear Right",
        "sideLeft": "Side Left",
        "sideRight": "Side Right"
      },
      "voiceClarity": {
        "label": "Voice"
      },
      "volumeStabilizer": {
        "label": "Compressor",
        "tooltip": "Automatically keeps the voice in a range so that it never gets too loud or inaudiable. Adjust the levels slider to set the impact of the effect"
      },
      "windowsMixer": {
        "button": "App to device routing"
      }
    },
    "symbols": {
      "currency": "$"
    },
    "templates": {
      "lightingTemplates": {
        "americanFlag": "American Flag",
        "callAndResponse": "Call and Response",
        "default": "Default",
        "defaultActiveMode": "Default Active Mode",
        "defaultIdleMode": "Default Idle Mode",
        "defaultReactiveMode": "Default Reactive Mode",
        "disabled": "Disabled",
        "discoMode": "Disco Mode",
        "eyesInTheDark": "Eyes in the Dark",
        "fireChasesIce": "Fire Chases Ice",
        "firingLasers": "Firing Lasers",
        "flux": "Flux",
        "fourColorBreathe": "4-Color Breathe",
        "horizontalWave": "Horizontal Wave",
        "loading": "Loading",
        "macaw": "Macaw",
        "moat": "Moat",
        "nightDrive": "Night Drive",
        "orangeFade": "Orange Fade",
        "rainbow": "Rainbow",
        "rainbowSherbet": "Rainbow Sherbet",
        "randomBreathe": "Random Breathe",
        "randomHorizontal": "Random Horizontal",
        "randomVertical": "Random Vertical",
        "redAlert": "Red Alert!",
        "scanning": "Scanning",
        "shootingStar": "Shooting Star",
        "staticColorshift": "Static ColorShift",
        "steelseriesOrange": "SteelSeries Orange",
        "stopLight": "Stop Light",
        "verticalWaveDown": "Vertical Wave Down",
        "verticalWaveUp": "Vertical Wave Up",
        "warpDrive": "Warp Drive"
      }
    },
    "threeDAT": {
      "discord": {
        "join": {
          "caption": "Join 3DAT Discord server",
          "link": "Get invite"
        }
      },
      "footer": {
        "launchButton": "Launch 3D Aim Trainer",
        "title": "SECURE YOUR VICTORY NOW"
      },
      "games": {
        "selectPlaceholder": "Select a shooter game"
      },
      "header": {
        "launchButton": "Launch 3D Aim Trainer",
        "subtitle": "Join our 12M registered gamers",
        "tagline": "Train Hard",
        "title": "AIM LIKE A PRO"
      },
      "infoCards": {
        "card1": {
          "description": "Keep your skills sharp daily with short exercises.",
          "title": "Quick warm-ups"
        },
        "card2": {
          "description": "Challenge our best aimers and climb the leaderboard.",
          "title": "Climb the ranks"
        },
        "card3": {
          "description": "Repeat the routine daily. Train hard. Claim glory.",
          "title": "Dominate every match"
        }
      },
      "launchButton": {
        "getStarted": "Get started",
        "startTraining": "Start training"
      },
      "quickSet": {
        "activateProfileTooltip": "We will activate your Quickset profile of this game",
        "disabled": "Not synced",
        "live": "Live"
      },
      "sensitivityTools": {
        "converter": {
          "advancedToggle": "Advanced",
          "copied": "Copied!",
          "copyToClipboard": "Copy to Clipboard",
          "dpiTooltip": "DPI (dots per inch) is a mouse setting that controls cursor movement distance. You can adjust your mouse DPI in Engine.",
          "onboarding": {
            "description": "Keep the same aiming feel across games with this Converter. No need to rerun the Finder per game.",
            "title": "Convert your Game Sensitivity to other games"
          },
          "origin": {
            "dpi": "Mouse DPI",
            "label": "From",
            "orDivider": "Or",
            "sensitivity": "Game Sensitivity",
            "spin": "360 SPIN"
          },
          "spinDifferenceTooltip": "There's a slight difference in 360° spin due to how each game rounds sensitivity values.",
          "spinTooltip": "Physical distance your mouse needs to travel for a full 360° turn in-game",
          "target": {
            "label": "To",
            "result": "Converted Game sensitivity"
          },
          "title": "SENSITIVITY CONVERTER",
          "tooltip": "Convert your sensitivity value from one shooter to another"
        },
        "disconnected": {
          "description": "A supported device is needed to keep using Sensitivity Tools.",
          "helpButton": "Get Help",
          "title": "Please reconnect your SteelSeries mouse."
        },
        "faq": {
          "a1_1": "Consistency in sensitivity helps with maintaining muscle memory and preserving eye-hand coordination, enabling more accurate aiming, better control, and quicker reaction times across all shooter games you play. It also makes it easier to transition between different games by reducing the time it takes to reach your full aiming potential in any game.",
          "a2_1": "Not necessarily. Once you've found a comfortable sensitivity in one game, you can use the Sensitivity Converter to replicate the same aim feel in other games.",
          "a2_2": "That said, running the Finder for each game is still recommended, especially when the Field of View (FOV) of both games cannot be aligned or if you're playing with different FOVs in each game.",
          "a2_3": "A change in FOV affects how fast the game world appears to move across your monitor, even if your mouse sensitivity stays the same. With a lower FOV, for example, the screen moves faster for the same physical mouse movement, which can throw off your aim. Using the Sensitivity Finder helps compensate for this, as you can adjust your FOV to match the one you're using in that specific game, allowing for a more accurate and consistent aim feel.",
          "a3_1": "The Sensitivity Finder has two modes: an automated mode called the \"Optimizer,\" and a manual mode called the \"Tester.\"",
          "a3_2": "The Optimizer uses an algorithm to guide you through a series of sensitivity comparisons, analyzing your aim performance using a set of statistics. Ultimately determines your best overall sensitivity, giving you a consistent and reliable aim feel tailored to your selected game.",
          "a3_3": "The Tester, on the other hand, lets you freely adjust and test your sensitivity based on what feels right to you.",
          "a4_1": "The Sensitivity Converter allows you to transfer your aim feel from one game to another by matching your physical mouse movement across games.",
          "a4_2": "Start by selecting your game and entering your sensitivity in the left input field. If you've completed the Sensitivity Finder experience, your result will automatically be filled in for you.",
          "a4_3": "In Standard Mode, the tool will instantly calculate the matching sensitivity for your target game on the right, ensuring consistent physical mouse movement.",
          "a4_4": "Switch to Advanced Mode (enable via the toggle) to unlock the 360 spin value, giving you more control for fine-tuning and precision input.",
          "a4_5": "All fields are dynamic — changing any value will instantly update the others in real-time.",
          "a4_6": "Example: If you play Valorant with a sensitivity of 0.5 at 800 DPI, the converter will calculate the equivalent sensitivity in Counter-Strike 2 so your aim feels identical.",
          "a5_1": "DPI is a measure of how sensitive your mouse is at the hardware level. It determines how far your cursor moves on-screen in relation to one inch of physical mouse movement. For example, at 800 DPI, moving your mouse one inch will move the cursor 800 pixels. Higher DPI values make your cursor move faster, while lower DPI values slow it down.",
          "a5_2": "360 spin represents the physical distance (cm/inch) your mouse needs to travel to perform a full 360° turn in-game. It's a key metric for maintaining consistent aim and muscle memory between games. Matching your 360 spin helps your aim feel consistent between games — as long as your Field of View (FOV) is also aligned. For more on how FOV impacts this, check out the explanation in Question 2.",
          "q1": "Why is it important to find your ideal consistent sensitivity for my shooters?",
          "q2": "Do I need to run the Sensitivity Finder for all my shooters?",
          "q3": "How does the Sensitivity Finder work?",
          "q4": "How does the Sensitivity Converter work?",
          "q5": "What are the advanced settings, such as DPI and cm/360?",
          "title": "FAQ"
        },
        "finder": {
          "desktopProfileWarning": "We didn't find any QuickSet profile for this game. You'll play using Desktop profile.",
          "duration": "8min",
          "feedback": {
            "dontShowAgain": "Do not show this message again",
            "title": "How was the Sensitivity Finder?"
          },
          "gameSelectLabel": "Select your shooter game",
          "launchButton": "LAUNCH SENSITIVITY FINDER",
          "result": {
            "checkWhereTooltip": "Check where",
            "instructions": "Input this Game Sensitivity manually in #GAME_NAME# settings",
            "modal": {
              "message": "Enter your Sensitivity Finder result manually in #GAME_NAME#'s settings to apply your new sens."
            },
            "title": "Your game sensitivity results"
          },
          "subtitle": "Find your best Game Sensitivity for any shooter.",
          "title": "Sensitivity Finder"
        },
        "footer": {
          "button": "Check 3D Aim Trainer",
          "description": "Train and perfect your shooting skills with 3D Aim Trainer",
          "title": "Master your aim"
        },
        "snackbar": {
          "playButton": "PLAY",
          "text": "Boost your aim and rank up. Try Sensitivity Finder now!"
        }
      },
      "tabs": {
        "aimTraining": "Aim Training"
      },
      "videoCTA": {
        "exercisesCount": "200+",
        "exercisesLabel": "Aiming exercises",
        "forEveryone": "For Everyone",
        "free": "Free",
        "launchButton": "Launch 3D Aim Trainer",
        "usersCount": "12M+",
        "usersLabel": "Registered aimers"
      },
      "zigzag": {
        "section1": {
          "description": "Pick a game, adjust your sensitivity and FOV, and jump into training.",
          "title": "Customize your experience"
        },
        "section2": {
          "description": "Join our weekly league and battle for supremacy as you climb the ranks.",
          "title": "Compete against the best"
        },
        "section3": {
          "description": "Sharpen your flicking, switching, clicking and tracking skills and outplay your rivals!",
          "title": "Hone your aim skills"
        }
      }
    },
    "time": {
      "oneHour": "1 hour",
      "oneMinute": "1 minute",
      "oneSecond": "1 second",
      "xHours": "#num# hours",
      "xMinutes": "#num# minutes",
      "xSeconds": "#num# seconds"
    },
    "webInstaller": {
      "details": "Fine-tune your settings, match your RGB with music, set in-game event triggers and so much more!",
      "installEngine": "Install SteelSeries GG",
      "makeTheMost": "Unlock your gear's full potential with SteelSeries GG and Engine"
    },
    "widgets": {
      "OffOrHigh": "Off/High",
      "OnOrLow": "On/Low",
      "accelDecelTitle": "Acceleration / Deceleration",
      "acceleration": "Acceleration",
      "accelerationDescription": "Fine-tune how your mouse responds to movement speed. Choose from preset sensitivity curves below.",
      "accelerationPreset": {
        "jump": "Jump",
        "linear": "Linear",
        "natural": "Natural",
        "power": "Power",
        "s-shaped": "S-Shaped"
      },
      "accelerationXAxis": "Input Speed (Count/MS)",
      "accelerationYAxis": "Ratio of Output to Input",
      "accelgraph": {
        "doubleCpi": "2x",
        "halfCpi": "1/2"
      },
      "action": {
        "button1": "Button 1",
        "button2": "Button 2",
        "button3": "Button 3",
        "button4": "Button 4",
        "button5": "Button 5",
        "button6": "Button 6",
        "dial1": "Dial 1",
        "dial2": "Dial 2",
        "scrollDown": "Scroll Down",
        "scrollUp": "Scroll Up"
      },
      "actionFilter": {
        "all": "All Keybindings",
        "custom": "All Custom Keybindings"
      },
      "actions": "Actions",
      "activeSleepIllumTitle": "Lighting Effect",
      "actuation": {
        "actuationLevel": "Actuation Level Per Key",
        "allKeysSelected": "All #NUMBER# adjustable keys selected.",
        "currentActuationLabel": "Current actuation",
        "noSelection": "No selection",
        "protectionMode": {
          "infoTooltip": "Protection Mode safeguards the key where it is enabled by reducing its sensitivity when adjacent keys are pressed.",
          "title": "Protection Mode"
        },
        "rapidTrigger": {
          "dualActuationRapidTriggerConflictTooltip": "Dual Bindings are currently taking priority over Rapid Trigger.",
          "infoTooltip": "Rapid Trigger dynamically resets actuation levels allowing for significantly faster key presses. <b>Full access to this feature requires the latest device firmware.</b>",
          "title": "Rapid Trigger"
        },
        "resetAllConfirmation": "Reset to default actuation level on all keys?",
        "selectKeys": "Select keys to adjust actuation.",
        "selectKeysWithRapidTrigger": "Select keys to adjust actuation and/or apply Rapid Trigger.",
        "someKeysSelected": "#NUMBER# adjustable keys selected.",
        "title": "Actuation"
      },
      "additionalSoftware": {
        "clickToMainWindow": "Click here to install from the main window."
      },
      "advancedLighting": {
        "afkEffect": {
          "darkenByHalf": "Darken by half",
          "showAfter": "Show After",
          "subtitle": "Seen when no keys are pressed for a period of time.",
          "title": "AFK Effect"
        },
        "baseEffect": {
          "title": "Base Effect"
        },
        "directions": {
          "RadialIn": "Radial In",
          "RadialOut": "Radial Out",
          "VerticalDown": "Vertical Down",
          "VerticalUp": "Vertical Up",
          "horizontalLeft": "Horizontal Left",
          "horizontalRight": "Horizontal Right"
        },
        "effects": {
          "audioVisualizer": "Audio visualizer",
          "breathe": "Breathe",
          "chasingGhosts": "Chasing Ghosts",
          "colorShift": "ColorShift",
          "disabled": "Off",
          "electricOrange": "Electric Orange",
          "fade": "Fade",
          "frostBlue": "Frost Blue",
          "gradient": "Gradient",
          "haze": "Haze",
          "heatOrange": "Heat Orange",
          "line": "Line",
          "mixed": "Mixed",
          "multiple": "Multiple effects selected",
          "onBoard": "On Board",
          "prism": "Prism",
          "rainbow": "Rainbow",
          "ripple": "Ripple",
          "singleColor": "Single color",
          "vapor": "Vapor Dreams",
          "westCoast": "West Coast"
        },
        "fullKeyboardEffectText": "Applying this keyboard effect will replace all effects currently on the keyboard.",
        "fullKeyboardEffectTitle": "Full Keyboard Effect",
        "reactiveLayer": {
          "subtitle": "Seen when pressing a key.",
          "title": "Reactive Layer"
        }
      },
      "ambientLed": {
        "description": "Color adjustment for ambient lighting must be done in #PRISM#",
        "title": "Ambient Led",
        "tooltip": "Use this widget to turn on or off the Ambient Lighting LED on the bottom of the #DEVICE#. Navigate to Prism to change the color of the ambient lighting."
      },
      "ancTransparency": {
        "anc": "Active Noise Cancellation",
        "description": "Toggle on to adjust ANC and Transparency settings",
        "tooltip": "Use \"Active Noise Cancellation\" to minimize background noise or \"Transparency\" mode to stay aware of your surroundings.",
        "transparency": "Transparency"
      },
      "angleSnapping": {
        "description": "Smooths your sensor input to move in straighter lines.",
        "enhancedTooltip": "Smooths your aim by **straightening** slight hand jitters. Great for steady horizontal swipes, like tracking enemies over ridgelines.",
        "tooltip": "Smooths your aim by straightening slight hand jitters. Great for steady horizontal swipes, like tracking enemies over ridgelines.<br><br>*GG needs to be running for this feature.",
        "tooltip2": "Smooths your aim by straightening slight hand jitters. Great for steady horizontal swipes, like tracking enemies over ridgelines."
      },
      "angleSnappingTitle": "Angle Snapping",
      "audioSource": "Audio Source",
      "autoFlattenEQ": {
        "flattenEQ": "Flatten 2.4GHZ EQ",
        "sonarAndEQSettings": "Sonar & EQ Settings",
        "sonarHandlingEQLongText": "Sonar is handling EQ right now and your on-device 2.4 GHz EQ isn’t flat. Flatten to avoid conflicts.",
        "sonarHandlingEQShortText": "Sonar is handling EQ right now.",
        "turnOffAutoFlatten": "To edit 2.4GHz EQ, turn off Auto‑Flattening in #Settings#"
      },
      "autoMicGain": "Auto Mic Compression",
      "autoOff": {
        "title": "Headset Auto Shutoff",
        "tooltip": "Sets the amount of time the headset will remain idle (no audio playing) before shutting off."
      },
      "autoTriggerHighEfficiencyMode": {
        "description": "Automatically enables Low Power Mode at your chosen battery level.",
        "ledWarningOnly": "LED warning only",
        "selectLabel": "When Low Power Mode activates",
        "setPollingRateTo": "Set polling rate to #POLLING_RATE#",
        "title": "Auto Low Power Mode"
      },
      "batteryLife": {
        "sliderText": "Headset Power Off",
        "title": "Battery Life"
      },
      "batteryPerformance": {
        "dimTimer": "Illumination Dim Timer",
        "illuminationMode": "Illumination Smart Mode",
        "illuminationTooltip": "When Smart Mode is on, the logo light turns off when your hand is covering it to save power.",
        "sensorTooltip": "When Smart Mode is on, the sensor will go into a low-power state to save power when not in use.",
        "sleepTimer": "Sleep Timer",
        "smartSensorMode": "Sensor Smart Mode",
        "title": "Battery Saver Settings",
        "tooltip": "Battery Saver Settings control the device's sensor and lights in order to conserve battery life.  Use the presets, or configure your own custom settings."
      },
      "batteryPerformanceV2": {
        "illuminationTooltip": "When Smart Mode is on, illumination will turn off while the mouse is moving in order to conserve battery.",
        "tooltip": "Battery Saver Settings control the device's sleep timer and illumination to help conserve battery."
      },
      "batteryPerformanceV3": {
        "disabledHover": "Editing this setting will turn off High-Efficiency Mode.",
        "illuminationSmartModeToolTip": "Illumination turns off while the mouse is moving and reappears when stationary.",
        "lowPowerMode": "High-Efficiency Mode",
        "lowPowerModeToolTip": "Extend mouse battery life with High-Efficiency Mode automatic settings.",
        "tooltip": "Battery Saver Settings help conserve your device’s battery life. High-Efficiency Mode automatically changes polling rate to 125 Hz and disables lighting to conserve battery life."
      },
      "batteryPerformanceV4": {
        "disabledHover": "This setting is not available for editing in High-Efficiency Mode.",
        "disabledHoverBluetoothOrPollRate": "This setting is not available for editing in Bluetooth mode or when the polling rate is currently changing."
      },
      "batteryPerformanceV5": {
        "bluetoothSmoothing": "Bluetooth Smoothing",
        "bluetoothSmoothingTooltip": "Turn on for a smoother cursor movement experience in Bluetooth mode, but consumes more battery power.",
        "connectionOptimization": {
          "title": "Connection Optimization"
        },
        "disabledHover": "Editing this setting will turn off High-Efficiency Mode.",
        "lowPowerMode": "High-Efficiency Mode",
        "lowPowerModeToolTip": "Extend mouse battery life with High-Efficiency Mode automatic settings.",
        "tooltip": "Battery Saver Settings help conserve your device's battery life. High-Efficiency Mode automatically changes polling rate to 125Hz to optimize power consumption.",
        "wirelessStabilityEnhancement": "Wireless Stability Enhancement",
        "wirelessStabilityEnhancementTooltip": "Turn on if experiencing wireless interference for a more stable and reliable connection, but consumes more battery power."
      },
      "bitmapEditor": {
        "title": "Bitmap Editor"
      },
      "bluetooth": {
        "autoMode": {
          "description": "Toggling this will stop playing game audio (PC) when receiving a call from your mobile device.",
          "enableAutoMode": "Auto Mute Game Audio",
          "title": "Bluetooth Call",
          "tooltip": "Sets whether game audio will be automatically muted when a Bluetooth call is answered."
        },
        "bluetoothMode": {
          "currently": "Currently",
          "description": "Note: the settings for Key Bindings, Acceleration & Deceleration, and Angle Snapping will return to defaults in Bluetooth Mode. Polling rate will be set to 125 HZ.",
          "description2": "No settings are available for editing while in Bluetooth mode.",
          "description3": "Note: All device settings except keypress button bindings, battery saver settings, CPI, and polling rate will return to defaults while in BT mode. Polling rate will be set to 125 HZ.",
          "description4": "Note: Settings for Angle snapping, Acceleration / Deceleration, Illumination and button bindings (except keyboard button and mouse button bindings) will return to defaults while your Aerox 3 Wireless is in Bluetooth mode. Polling rate will be set to 125 HZ.",
          "description4Generic": "Note: Settings for Angle snapping, Acceleration / Deceleration, Illumination and button bindings (except keyboard button and mouse button bindings) will return to defaults while your device is in Bluetooth mode. Polling rate will be set to 125 HZ.",
          "description5": "Settings for angle snapping, acceleration, illumination, button bindings, rotation, high-efficiency modes, etc., reset to default in Bluetooth mode. Polling rate is fixed at 125 Hz.",
          "title": "Bluetooth Mode"
        },
        "disabledHover": "This setting is not available for editing in Bluetooth mode.",
        "startupState": {
          "description": "Turns Bluetooth on when headset powers on.",
          "enableOnStartup": "Enable Bluetooth on startup",
          "title": "Bluetooth Auto-Startup",
          "title2": "Bluetooth Default",
          "tooltip": "Sets whether or not Bluetooth will automatically startup when the headset is powered on."
        },
        "volumeDucker": {
          "description": "Choose what happens to game volume when you start a Bluetooth voice call",
          "duck": "Lower my game volume by 12 dB during calls",
          "lowerGameVolume": "Lower game volume",
          "mute": "Mute my game volume during calls",
          "muteGameVolume": "Mute game volume",
          "nothing": "Do nothing during calls"
        },
        "volumeDuckerA9": {
          "description": "Choose what happens to PC game volume when you start a Bluetooth voice call. These settings do not apply when using PS input.",
          "duck": "Lower my game volume by 12 dB during calls (PC)",
          "mute": "Mute my game volume during calls (PC)",
          "nothing": "Do nothing during calls (PC, Console)"
        }
      },
      "buttonMapping": {
        "micMute": "Mute/Unmute Mic",
        "noiseControl": "Cycle Noise Control",
        "playPause": "Play/Pause",
        "quickSwitch": "Toggle Audio Mode",
        "title": "Button Mapping",
        "tooltip": "Customize Button Tap Behaviour",
        "unassigned": "Unassigned",
        "voiceAssist": "Mobile Voice Assistant",
        "volumeDown": "Volume Down",
        "volumeUp": "Volume Up"
      },
      "capture": {
        "compressor": "Compressor",
        "noiseGate": "Noise Gate",
        "noiseGateTooltip": "Automatically mutes the mic when you are not speaking to suppress background noise.",
        "noiseReduction": "Noise Reduction",
        "settings": "Capture Settings",
        "title": "Capture"
      },
      "captureMode": {
        "addGame": "Add a game",
        "gameMode": "Game",
        "monitorMode": "Monitor",
        "selectedGameLabel": "Selected Game",
        "showGuidelines": "Show Bounding Box"
      },
      "captureModeLabel": "Capture Mode",
      "chatMix": "ChatMix",
      "clickResponse": {
        "8msDefault": "8ms · default",
        "adjust": "Adjust",
        "alertText": "Non-default value. Reset to 8 ms if click behavior feels inconsistent.",
        "description": "8 ms (default) is currently applied. Adjust only if you need a different click response.",
        "description2": "Controls how much filtering is applied to clicks. Lower values may improve responsiveness but can increase unintended or double clicks. Higher values add more filtering.",
        "dialogDescription": "This is an advanced setting. Lower debounce times may improve click responsiveness but can increase unintended or double clicks. 8 ms default is recommended for most users.",
        "dialogTitle": "Adjust Click Response?",
        "subTitle": "Optical Switch Debounce",
        "title": "Click Response"
      },
      "color": "Color",
      "colorPicker": {
        "randomizedColor": "Randomized Color",
        "rgb": {
          "b": "B",
          "g": "G",
          "hash": "#",
          "r": "R"
        },
        "title": "Color Picker"
      },
      "colorWithPlaceholder": "#PLACEHOLDER# Color",
      "connectionOptimization": {
        "bluetoothSmoothing": {
          "description": "Improves cursor smoothness in Bluetooth mode with increased battery consumption. Max 1000Hz Polling Rate."
        },
        "tooltip": "Applies motion smoothing to reduce stutter in Bluetooth connection mode. This enhances cursor fluidity but consumes more power.<br><br>Improves signal stability in high-interference environments by increasing transmission reliability. May reduce battery life due to higher power usage.<br><br>*GG needs to be running for this feature.",
        "wirelessStabilityEnhancement": {
          "description": "Enhance wireless stability in high-interference areas with increased battery consumption. Max 2000Hz Polling Rate.",
          "tooltip": "Wireless Stability is only available when the wireless polling rate is 2000 Hz or lower.<br><br>*GG needs to be running for this feature."
        }
      },
      "controllerButtonMapping": {
        "ggAction": "GG Action",
        "ggActionDisabledDialog": "You can only bind up to 10 GG actions. Please remove an existing binding to add a new one.",
        "pcMode": "PC Mode",
        "remappingButton": "Remapping Button",
        "resetMapping": "Reset Mapping",
        "title": "Mapping",
        "useAsShift": "Use as Shift Button"
      },
      "cpi": "Sensitivity CPI_NUM (CPI CPI_NUM)",
      "cpiInputLabel": "CPI",
      "cpiLabel": "CPI CPI_NUM",
      "customIllumination": {
        "illuminationEffect": "Illumination Effect"
      },
      "cyclePerformanceProfiles": {
        "hold2s": "Hold 2s",
        "moreInformation": "More Information",
        "press": "Press",
        "showChargingStatus": "Show charging status",
        "title": "Cycle performance profiles"
      },
      "dcpiInputLabel": "DCPI",
      "deceleration": "Deceleration",
      "disableConfigSync": {
        "bannerWarningOne": "Settings Sync is set to Overwrite.",
        "bannerWarningTwo": "Saving settings with Engine will overwrite the device's settings.",
        "subtext": "Computer having trouble going to sleep?  Use 'Overwrite'.",
        "syncDisabled": "Overwrite",
        "syncEnabled": "Sync automatically",
        "title": "Settings Sync",
        "tooltip": "Reading on-board settings from USB devices can cause computers to remain awake.  Sync Automatically will keep the device settings and Engine in sync.  Overwrite will overwrite the device settings whenever changes are saved in Engine."
      },
      "dolby": "Dolby Headphone",
      "dts": {
        "headphonex": {
          "mode": {
            "game": "Game",
            "movie": "Movie",
            "music": "Music"
          },
          "tooltip": "When enabled, DTS Headphone:X virtual surround sound simulates the 3D environment of your audio's mixing stage. Select the Movie, Music, or Game presets to match your content.",
          "tooltipNoPresets": "When enabled, DTS Headphone:X virtual surround sound simulates the 3D environment of your audio's mixing stage."
        },
        "modeCommunications": "Communications"
      },
      "dtsV2": {
        "state": {
          "on": {
            "description": "On with 7.1 Surround"
          }
        }
      },
      "dtsv2Enhancements": {
        "bass": {
          "title": "Bass Enhancement"
        },
        "dialogue": {
          "title": "Dialogue Enhancement",
          "tooltip": "Applies processing to make dialog easier to hear and understand in surround sound content"
        }
      },
      "dtsv2widget": {
        "title": "DTS Headphone:X v2"
      },
      "dualActuation": {
        "invalidSettingDialogText": "The secondary actuation must be lower than the primary actuation. (Remember that when setting actuations, #MIN_VALUE# is considered a higher actuation than #MAX_VALUE#)",
        "invalidSettingDialogTitle": "Invalid Dual Actuation Setting",
        "maxBindingsDialogText": "There is a maximum of eight dual bindings. In order to add a new dual bind, a previous one must be removed.",
        "maxBindingsDialogTitle": "Dual Binding Limit Reached",
        "maxDualActuationInfo": "Maximum of 8 dual actuation keybinds permitted",
        "noValidLevelForBindingDialogText": "A Dual Actuation level must be set on the key before you can assign a dual binding. Please set a level on the key on the Dual Actuation tab.",
        "noValidLevelForBindingDialogTitle": "Dual Actuation level needed",
        "tabHeader": "Dual Actuation"
      },
      "dualBindings": {
        "tabHeader": "Dual Bindings"
      },
      "dynamicRangeCompression": {
        "title": "Dynamic Range Compression",
        "tooltip": "This feature moderates variations in headphone volume so that all of your audio is delivered at the same discernible level."
      },
      "effect": {
        "multicolor": "Multicolor",
        "title": "Effect",
        "tooltip": "Pattern the device displays using the LEDs"
      },
      "effectTooltips": {
        "breathe": "Add up to four colors using the editor below. Add colors by clicking near the bottom edge of the gradient. Remove colors by dragging them down. Change colors by clicking on the swatches.",
        "colorshift": "Add colors to the sequence by clicking near the bottom edge of the gradient. Remove colors by dragging them down. Change colors by clicking on the swatches. Wave Mode will make the colors sweep across the keyboard in waves. When Wave Mode is enabled, click \"Set origin\" to change the starting point of the wave. Click the thumbnails to change the wave style. Move the wavelength slider to the left to make compact waves and the right to make big waves.",
        "cooldownTimer": "<div class=\"tooltipErrorHeader\">This feature only works when SteelSeries GG is running.</div><br>NOTE: This feature does not work in Live Preview mode. You must save your configuration to view it.<br><br>Cooldown Timer will cause affected keys to change from the Ready Color to the Cooldown Color for the duration of the Timer field value.  Use Trigger to initiate this effect on the selected keys when a different key is pressed. Change the Trigger by clicking in the box and then pressing the key on your keyboard that you want to trigger the effect.",
        "disable": "Disable Illumination turns off illumination on affected keys.",
        "mixed": "Two or more keys with different effects are selected. Choosing a new effect from the dropdown will give them all the same effect.",
        "onboardBreathe": "Onboard Breathe Tooltip TODO",
        "reactiveColor": "A key will normally be the rest color, but when pressed will light up with the active color. Click on the swatches next to Rest Color and Active Color to change the colors of the effect.",
        "steadyColor": "When Steady is applied to one or more keys, they will be illuminated with a single color. Use the color picker to the left to choose a color."
      },
      "enableSonarBanner": {
        "buttonText": "Enable Sonar",
        "description": "Crush the competition with Sonar's ChatMix, AI noise cancellation, and precision sound mixer.",
        "goBeyondTitle": "Go beyond Engine with Sonar",
        "switchToSonarDescription": "Need more control? Switch to Sonar to get an advanced mixer, spatial audio, and streamer-focused tools for pro‑level audio",
        "title": "Unlock Pro-Level Audio"
      },
      "equalizer": {
        "minus12": "-12",
        "plus12": "+12",
        "sonarEnabled": "Equalizer is disabled when Sonar is active",
        "title": "Equalizer",
        "zero": "0"
      },
      "factoryReset": {
        "buttonText": "Reset",
        "description": "Reset your headset to its original factory settings. To proceed, please ensure your headset is connected.",
        "inProgress": {
          "description": "Restoring factory settings... <br>Please keep your device connected and do not close GG. This may take a few moments.",
          "title": "Factory Reset in Progress"
        },
        "resetComplete": {
          "description": "Factory settings have been restored successfully.<br>All custom configurations have been removed.",
          "title": "Factory Reset Complete"
        },
        "title": "Factory Reset"
      },
      "fixedGestures": {
        "answerCall": "Answer Call",
        "doublePress": "Double Press",
        "endCall": "End Call",
        "pairingMode": "Enter Pairing Mode",
        "powerOn": "Power On",
        "shortHold": "Short Hold",
        "singlePress": "Single Press",
        "singlePressHold": "Single Press Then Hold",
        "threeSecHold": "Three Second Hold",
        "threeSecHoldCase": "Three Second Hold in Case",
        "title": "Call Controls and Others",
        "tooltip": "Other commands that cannot be remapped",
        "triplePress": "Triple Press",
        "volumeControl": "Volume (Right: Up, Left: Down)"
      },
      "gain": {
        "tooltip": "Sets the amount of gain applied to the #DEVICENAME# headset output.",
        "tooltip2": "Adjusts the amplification level of the audio output."
      },
      "ggRequired": "GG REQUIRED",
      "globalIllumination": "Global Illumination",
      "headsetVolume": "Volume",
      "highEfficiencyMode": {
        "description": "Reduces performance to extend battery life.",
        "enhancedTooltip": "**Extends battery life** by lowering the polling rate and setting the Sleep Timer to 1 min when battery drops below your selected level. Choose LED warning only to keep the warning without changing performance or Sleep Timer.",
        "title": "Low Power Mode",
        "tooltip": "Extends battery life by reducing features like lighting effects and lowering polling rate. Useful when power saving is needed.<br><br>Automatically activates Low Power Mode when battery drops below a selected percentage to conserve power.<br><br>*GG needs to be running for this feature.",
        "tooltip2": "Extends battery life by lowering the polling rate and reducing power-intensive features. Low Power Mode automatically activates when the battery drops below your selected percentage.<br><br>Automatically activates Low Power Mode when battery drops below a selected percentage to conserve power."
      },
      "homeScreenDisplayMode": {
        "title": "Home Screen Display Mode"
      },
      "homeScreenType": {
        "title": "OLED HomeScreen Mode",
        "tooltip": "Sets the home screen mode of the OLED screen on the #DEVICENAME#."
      },
      "idleTime": {
        "disableIdle": "Disable Idle",
        "setIdleIn": "Set idle in"
      },
      "illumination": "Illumination",
      "illuminationBrightness": "Illumination Brightness",
      "illuminationBrightnessV2": {
        "tooltip": "Adjusts brightness evenly across all zones. Use the color picker to set different levels with darker colors.<br><br>*GG needs to be running for this feature."
      },
      "illuminationDimTimer": {
        "description": "Illumination dims at the chosen time",
        "tooltip": "Automatically dims the lighting after a set period of inactivity to conserve power.<br><br>*GG needs to be running for this feature."
      },
      "illuminationDisabledForPrism": "Illumination components are disabled while the device is enabled in Prism",
      "illuminationEffectLimitTitle": "Illumination Effect Limit",
      "illuminationSmartMode": {
        "description": "Illumination brightness dims to 10% when keypress is detected and reappears when not in use",
        "description2": "Lights turn off while mouse is moving and reappears when stationary.",
        "label": "Illumination Smart Mode",
        "tooltip": "Automatically disables lighting while the mouse is in motion to reduce distraction and save power. Lighting resumes when stationary.<br><br>*GG needs to be running for this feature."
      },
      "illuminationZonesDisabledForPrism": "Illumination zones are disabled while the device is enabled in Prism",
      "imageTools": {
        "crop": "Crop",
        "flip": "Flip",
        "rotate": "Rotate",
        "title": "Image Tools"
      },
      "independentXYDPI": {
        "descriptionTitle": "Adjusting DPI",
        "dpiDescription": "Controls pointer speed. Higher DPI moves farther with the same movement.",
        "dpiOverdriveDescription": "Extends the range above 42K to 65K using scaling.",
        "dpiOverdriveTitle": "DPI Overdrive",
        "howThisWorks": "HOW THIS WORKS",
        "howThisWorksTip": "Tip: Start with DPI and Lift-off Distance. Adjust the others only if needed.",
        "howToAdjustTitle": "HOW TO ADJUST",
        "independentLiftOffAndLanding": "Independent Lift-off & Landing",
        "independentXYDescription": "Set horizontal and vertical DPI separately. Off: Y matches X.",
        "ladCannotBeGreaterThanLod": "LAD cannot be greater than LOD",
        "landingDistance": "Landing Distance",
        "landingDistanceDescription": "Height where tracking resumes as you place the mouse down. Higher starts tracking sooner.",
        "liftOffAndLandingDistance": "Lift-off and Landing Distance",
        "liftOffDistanceDescription": "Height where tracking stops as you lift your mouse off the surface. Lower stops sooner.",
        "liftOffDistanceTitle": "Lift Off Distance",
        "overdriveTooltip": "DPI Overdrive mode extends DPI beyond the sensor’s native 42K limit, up to 65K, using pixel scaling.",
        "sensitivity": "Sensitivity",
        "toggle": "Independent X-Y",
        "tooltip": "With a DPI (Dots Per Inch) setting of 800, a one-inch movement of your mouse moves your cursor 800 pixels. Click the sliders below to adjust, add, or remove DPI levels (5 max). Enable Independent X-Y mode to set different sensitivities for horizontal (X) and vertical (Y) movements.",
        "whyAdjustDescription": "Match pointer speed and tracking to how you aim, lift, and reposition the mouse.",
        "whyAdjustTitle": "WHY ADJUST",
        "withLiftOffDistance": {
          "tooltip": "Customize how your mouse responds to movement with up to 5 DPI stages you can switch between on the fly.<br><br>Enable Independent X/Y to fine-tune horizontal and vertical speeds separately.<br><br>Adjust Lift-Off Distance to control how high you can lift the mouse before it stops tracking — lower for precision, higher for flexibility."
        }
      },
      "inputEffect": {
        "title": "Input Effect",
        "tooltip": "LEDs behavior upon user interaction"
      },
      "keyBindings": "Key Bindings",
      "keyboardRegion": {
        "m800LayoutChangeWarning": {
          "line1": "The selected Keyboard Region has a different key layout than the current region. Applying this will cause all unsaved changes to be lost. This change will apply to all existing configs, and may alter some of your bindings or illumination settings.",
          "line2": "Illumination may appear incorrectly if the selected Keyboard Region in the software does not match your physical keyboard."
        },
        "title": "Keyboard Region"
      },
      "keygroup": {
        "comboKeys": "Combo Keybindings",
        "comboKeysTooltip": "This is the group of key combinations to which you can bind actions.",
        "functionKeyZone": "Function Key Zone",
        "functionKeyZoneTooltip": "This is the group of keys along the top of the keyboard.",
        "macroKeyZone": "Macro Key Zone",
        "macroKeyZoneTooltip": "This is the group of keys along the left side of the keyboard.",
        "numpadKeyZone": "Numpad Key Zone",
        "numpadKeyZoneTooltip": "These are the groups of keys on the right side of the keyboard.",
        "standardKeyZone": "Standard Key Zone",
        "standardKeyZoneTooltip": "This is the group of keys in the central area of the keyboard."
      },
      "lanMode": {
        "description": "Enable for best wireless performance when multiple Ultra-wideband mice are nearby (must be enabled on all mice).",
        "title": "LAN Mode"
      },
      "lcd": {
        "bestResults": "For best results, images should be #WIDTH#px x #HEIGHT#px and in black and white.",
        "bestResultsWithAnimation": "For best results, images should be #WIDTH#px x #HEIGHT#px and in black and white.  Animations will play back at 10 frames per second.",
        "clearConfirmation": "Clear the graphic on the whole screen?",
        "dither": "Dither",
        "invert": "Invert",
        "loadingImage": "Loading Image",
        "resetConfirmation": {
          "text": "Do you want to reset your OLED image to the SteelSeries default logo?",
          "title": "Reset OLED Image"
        },
        "title": "#TITLE# Settings"
      },
      "led": {
        "ColorShiftOnly": "ColorShift Only",
        "batteryStatusDescription": "Color of selected zone changes according to remaining battery power of Sensei Wireless.",
        "breatheSpeedLabel": "Speed",
        "breatheSpeeds": {
          "fast": "Fast",
          "medium": "Medium",
          "slow": "Slow"
        },
        "chargeLabel": "Charge:",
        "colorShiftModeTooltip": "Applies preset gradient across the device instead of a single color.",
        "colorshiftMode": "ColorShift Mode",
        "colorshiftModeEnabled": "ColorShift Mode Is Enabled",
        "dialogTitle": "Illumination",
        "disableIllumination": "Disable Illumination",
        "disabledColorForBatteryStatus": "Color settings are not available when Battery Status is enabled.",
        "disabledColorForColorShift": "Color settings are not available when ColorShift is enabled.",
        "disabledColorForTrigger": "Color settings are not available when Trigger is enabled. Switch to steady mode to change color.",
        "disabledIlluminationMessage": "Color settings are not available when Disable Illumination is checked.",
        "disabledInfo": "Disable Illumination is selected. Deselect it to view illumination settings.",
        "disabledReasonForRandomizedColor": "Color settings are not available when Randomized Color is checked",
        "effects": {
          "batteryStatus": "Battery Status",
          "breathe": "Breathe",
          "colorShift": "ColorShift",
          "disabled": "Disable Illumination",
          "mixed": {
            "title": "Mixed"
          },
          "multiColorBreathe": "Multi Color Breathe",
          "nonAudioTrigger": "Trigger",
          "onboardBreathe": "Single Color Breathe",
          "reactiveColor": {
            "activeColor": "Active Color",
            "restColor": "Rest Color",
            "title": "Reactive Key"
          },
          "steady": "Steady",
          "trigger": "Audio Volume Trigger"
        },
        "effectsLabel": "Effects",
        "logoTitle": "Logo",
        "singleColorOnly": "Single Color Only",
        "title": "LED"
      },
      "ledToggle": {
        "logo": "Logo Illumination",
        "wheel": "Wheel Illumination"
      },
      "ledgainIndicator": {
        "title": "Led Gain Indicator",
        "tooltip": "Use this widget to turn on or off the LED Gain Indicator on the microphone and modify its colors."
      },
      "liftDistance": {
        "title": "Lift Distance",
        "tooltip": "Lift Distance determines the distance at which the sensor on the mouse will still register movement when lifted up from from the mousing surface.  A higher lift distance value means that when the mouse is picked up, the mouse will register movement at a farther distance from the surface than it would at a lower value."
      },
      "liftOffDistance": {
        "title": "Lift-Off Distance"
      },
      "lightbar": {
        "sleeptoggle": {
          "description": "Turn off the lightbar when the lid is closed.",
          "title": "Lightbar Sleep",
          "tooltip": "Enable lightbar sleep to turn off illumination when the laptop lid is closed. For proper functioning, you must set the laptop lid Power Options in the Windows Control Panel to \"Do Nothing\"."
        }
      },
      "lightingMode": {
        "audio": "Audio Mode",
        "breathing": "Breathing Mode",
        "dualColor": "Dual Color Mode",
        "gaming": "Gaming Mode",
        "illumOff": "Illumination Off",
        "steady": "Steady Mode",
        "wave": "Wave Mode",
        "zoneDragHelp": "Click and drag your cursor over the zones on the left to select the lighting zone you wish to edit"
      },
      "lightingTimeout": {
        "title": "Lighting timeout",
        "tooltip": "Set how long until the speakers lighting will turn off after not being connected via a USB connection."
      },
      "lightingTools": {
        "customEffects": "Custom effects",
        "effectDirection": {
          "title": "Effect Direction",
          "tooltip": "Effect Direction controls the direction in which colors travel in effects with Wave Mode enabled"
        },
        "maxBaseEffects": "Number of Base Effects at max.",
        "maxIdleEffects": "Number of AFK Effects at max.",
        "maxReactiveEffects": "Number of Reactive Effects at max.",
        "multizoneSelection": "Ctrl+Click to select multiple zones.",
        "reactivePerZoneNotSupported": "Per-zone configuration is not supported for reactive effects",
        "wholeKeyboardPresets": "Whole keyboard presets"
      },
      "liveMix": "LiveMix",
      "lockKeyColor": {
        "cannotLiveDeploy": "This setting does not take effect until the configuration is saved.",
        "title": "Lock Key Color",
        "tooltip": "Use this to pick the color for active lock keys.  These include Caps Lock, Scroll Lock, and Num Lock."
      },
      "lockKeys": "Lock Keys",
      "logoPlacement": {
        "disable": "Disable Watermark"
      },
      "logoPlacementLabel": "Logo Placement",
      "lowBatteryLightingMode": {
        "label": "Low Battery Lighting Mode",
        "modes": {
          "breathe": "Breathing Red",
          "lightingOff": "Lighting Off",
          "noChange": "No change to lighting",
          "steady": "Steady Red"
        },
        "tooltip": "At 5% battery life, keyboard's illumination will change to indicate low battery."
      },
      "maxPerformance": {
        "description": "Runs the sensor in the highest performance mode all the time with the maximum capture rate for ultimate tracking precision.",
        "title": "Max Performance"
      },
      "metaBindings": "Meta Bindings",
      "micAutoOptimization": "Mic Auto Optimization",
      "micDisabled": "Connect microphone to adjust settings.",
      "micGainDial": {
        "title": "Mic Gain Dial",
        "tooltip": "Use this widget to enable or disable the LED indicator on the gain dial (Dial 1), and set its brightness level."
      },
      "micMutedLEDBrightness": {
        "title": "Mic Muted Brightness",
        "tooltip": "Set the brightness of microphone's LED when muted."
      },
      "micPreview": {
        "buttonText": "Mic Preview",
        "title": "Live Mic Preview",
        "tooltip": "Listen to yourself speak live into your own headset to preview your mic settings in action."
      },
      "micSidetone": {
        "description": "Mic Sidetone enables you to hear your own voice through selected output device.",
        "title": "Mic Sidetone",
        "tooltip": "Use this widget to change the volume of Mic Sidetone. Sidetone enables you to hear your own voice through your selected output device."
      },
      "micVolume": "Mic Volume",
      "micVolumeSidetone": {
        "micRemoved": "Mic Removed"
      },
      "motionSync": {
        "description": "Alternate mode to synchronize mouse input with polling reports which may smooth tracking with slight added latency.",
        "title": "Motion Sync"
      },
      "mouse": {
        "effectTooltips": {
          "colorshift": "With ColorShift, your mouse will cycle through a series of selected colors. Change colors by clicking on the colored boxes. Add additional colors by clicking near the bottom edge of the gradient, or remove colors by dragging the boxes down.<br><br>Wave Mode will make the colors travel across the zones in waves. When Wave Mode is enabled, click \"Set origin\" to change the starting point of the wave. Click the arrow icons to change the wave style. Move the wavelength slider to the left to make smaller waves and the right to make bigger waves."
        }
      },
      "mouseRotation": {
        "description": "Aligns sensor movement to your grip angle.",
        "description2": "Digitally tilts sensor input to better match the angle of hand movement so the cursor moves as intended.",
        "title": "Rotation",
        "tooltip": "Adjusts sensor alignment to match your grip and fix diagonal drift.<br><br>*GG needs to be running for this feature."
      },
      "mouseSensitivityMatcher": {
        "apply": "Apply",
        "calibrationAdvice": "For best calibration, turn off all mouse acceleration — in your app settings, any external tools, and Windows.",
        "checkMouse": "Check that both of your mouse is connected and try again.",
        "currentDpiLevel": "Current Level DPI: ",
        "description": "Match your new mouse to feel just like your old one. Result will adjust the current sensitivity level selected.",
        "description2": "Matches your new mouse to have the same tracking feel as your old mouse.",
        "error": "We couldn’t complete the sensitivity match.",
        "matchMouse": "Match your new mouse to feel just like your old one — same sensitivity, same control.",
        "mousePositionInstruction": "Place both mice side-by-side.",
        "moveMouseInstruction": "Click anywhere in GG to begin, then move them together in one direction until the bar fills up.",
        "newDpi": "New DPI: "
      },
      "msiBuiltinEffect": {
        "flashLighting": "Flash-Lighting",
        "flashing": "Flashing",
        "marquee": "Marquee",
        "meteor": "Meteor",
        "multiflash": "Multi-Flash",
        "rainbow": "Rainbow",
        "waterDroplet": "Water Droplet"
      },
      "multiCPI": {
        "currentCPI": "Current CPI",
        "description": "With a CPI (Counts Per Inch) setting of 800, a one-inch movement of your mouse moves your cursor 800 pixels. Click the sliders below to adjust, add, or remove CPI levels (5 max)",
        "descriptionTitle": "Adjusting CPI #NUM#",
        "label": "CPI Levels",
        "removeLevel": "Remove Level",
        "tabTitle": "Level #NUM#",
        "title": "Mouse Sensitivity Levels"
      },
      "multiDeviceFwUpdate": {
        "connect": "Connect via USB",
        "prepareUpdate": "Preparing to update firmware",
        "prepareUpdateDongle": "Preparing to update dongle firmware",
        "prepareUpdateKeyboard": "Preparing to update keyboard firmware"
      },
      "multiZone": {
        "behavior": "Multizone Behavior",
        "reflected": "<b>Reflected</b> – effect will play in both zones at opposite timings.",
        "reverseEffectDirection": "Reverse Effect Direction",
        "reverseTooltip": "Effect motion defaults from left zone to right zone.",
        "sweep": "<b>Sweep</b> – effect will start in the first zone and end in the second zone.",
        "synchronized": "<b>Synchronized</b> – effect will play in both zones at the same time.",
        "title": "Multizone Illumination Effect"
      },
      "multimediaControls": {
        "answerEndCall": "Answer/end voice call",
        "doublePress": "double press",
        "multimediaControl": "Multimedia Control",
        "nextTrack": "Next Track",
        "playPause": "Play/pause music",
        "powerButton": "Power Button",
        "previousTrack": "Previous Track",
        "singlePress": "single press",
        "triplePress": "triple press"
      },
      "mute": "mute",
      "muteButtonsLed": {
        "title": "Mute Buttons",
        "tooltip": "Use this widget to set the hue and lightness of the Mute LED."
      },
      "muteLedBrightness": {
        "title": "Mute LED Brightness",
        "tooltip": "Use this widget to adjust the brightness of the Mute LED on the microphone."
      },
      "noiseCancellation": {
        "boomMic": "Boom Mic",
        "onEarMic": "On Ear Mic",
        "title": "Noise Control",
        "tooltip": "Select the level of noise cancellation for your microphone to reduce background noise."
      },
      "oledAndSettings": {
        "editOledImage": "Edit OLED Image",
        "title": "OLED & Settings"
      },
      "oledDisplay": {
        "inactivePowerNotice": "Turn Controller Off After Inactive For",
        "oledScreen": "OLED Screen",
        "screenBrightness": {
          "title": "OLED Screen Brightness",
          "tooltip": "Sets the brightness of the OLED screen on the #DEVICENAME#.",
          "tooltipV2": "Adjust the brightness of the controller’s OLED display."
        },
        "screenIdleDimTimeout": {
          "title": "OLED Dim Screen Timeout"
        },
        "screenIdleTimeout": {
          "controlPodToolTip": "Sets how long the control pod OLED screen will remain active before it is dimmed.",
          "title": "OLED Screen Idle Timeout",
          "tooltip": "Selects how long when idle the #DEVICENAME# will wait before dimming the screen.",
          "tooltipV2": "Set how long the OLED remains fully lit before dimming when the controller is inactive."
        },
        "title": "Display Settings"
      },
      "onDeviceSettings": "On-Device Settings",
      "opacity": "Opacity",
      "output": {
        "title": "Output",
        "tooltip": "Speakers mode will combine the audio from Game, Chat, and the Mobile port and output it to the Line Out jack.<br><br>Streaming mode will unlock the ability to change the volume levels of the above audio sources, and adds in the audio from your microphone to the Line Out.",
        "tooltip2": "Select \"Speakers\" for fixed audio levels or \"Streaming\" to adjust Main, Aux, and Mic volumes separately.",
        "tooltipArenas": "Set the output levels of each speaker. Default maximum output for rear channel speakers is 80%. Increasing beyond 80% could result in unwanted sound interference."
      },
      "parametricEQ": {
        "addNewModal": {
          "aliasLabel": "Enter your 6 characters short name",
          "label": "Name your new equalizer preset"
        },
        "deleteModal": {
          "subHeader": "This custom preset will no longer be available in any additional configurations."
        },
        "equalizerPreset": "EQUALIZER PRESETS",
        "renameModal": {
          "aliasLabel": "Rename your 6 characters short name",
          "label": "Rename your equalizer preset"
        },
        "saveAsModal": {
          "label": "Name your equalizer preset"
        },
        "syncEqualizerSettings": "SYNC EQUALIZER SETTINGS",
        "tooltip": "While 2.4GHz and Bluetooth channels are synced, they will share equalizer settings. Desync equalizers to configure each channel independently.",
        "wirelessTitle": "2.4 GHz WIRELESS"
      },
      "patternWithPlaceholder": "#PLACEHOLDER# Pattern",
      "performanceCycleProfiles": {
        "description": "Pair a lower Sensor Report Rate with a higher wireless Polling Rate, kept in sync for low-latency clicks and responsive tracking without frame drops. We recommend 8K wireless Polling with a Sensor Report Rate suited to your game and system.",
        "disabledTooltip": "Report rate cannot exceed the polling rate. Increase polling rate to unlock this option.",
        "howThisWorksTip": "Sensor Report Rate cannot exceed the selected Polling Rate. Higher rates may use more CPU and may not be supported by all games.",
        "howToAdjustStep1": "1. Start with the highest Sensor Report Rate available for your selected Polling Rate.",
        "howToAdjustStep2": "2. Test it in your game.",
        "howToAdjustStep3": "3. If you experience stutter or frame drops, lower the Sensor Report Rate until performance is smooth.",
        "sensorReportRate": "Sensor Report Rate",
        "title": "Performance Profiles",
        "title2": "SuperSync Sensor & Polling",
        "whyAdjustDescription": "Games and systems handle high sensor report rates differently. Adjusting this value helps you balance tracking performance with system compatibility and stability."
      },
      "phantomPower": {
        "title": "Phantom Power",
        "tooltip": "Phantom power is an electrical signal transmitted through microphone cables to operate microphones that contain active electronic circuitry. SteelSeries Alias Pro uses a condenser element that requires this setting to be enabled for proper operation. Learn more about this topic on Steelseries.com."
      },
      "pollingRateTitle": "Polling Rate",
      "pollingrate": {
        "ledIndicator": "LED Indicator",
        "ledIndicatorDescription": "Select what the Base Station and Travel Dongle LED’s indicate.",
        "mouseBatteryLevel": "Mouse Battery Level",
        "overpolling": "with 9k Hz overpolling",
        "pollingSensorReportRate": "Polling x Sensor Report Rate",
        "tooltip": "Controls how frequently your mouse sends data to your computer.<br><br>1000 Hz = device data will be sent to computer every 1 millisecond, 125 Hz = device data will be sent to computer every 8 miliseconds.<br><br>Higher rates improve responsiveness but increase power usage.<br><br>*GG needs to be running for this feature.",
        "ultraWideBandPollingRate": "Ultra-wideband Polling Rate",
        "wirelessStabilityEnhancementOn": "Wireless Stability ON"
      },
      "powerAndDevice": "Power & Device",
      "powerManagement": {
        "title": "Power Management"
      },
      "powerOptions": {
        "batterySaverSettings": "Battery Saver Settings",
        "blinkTXLED": "Blink transmitter LED when headset is off",
        "headerLabel": "Turn headset off after inactive for",
        "keyboardSleepTimerTooltip": "Sleep Timer conserves battery life by putting your keyboard to sleep after being idle. Press any key to wake your keyboard.",
        "title": "Power Options",
        "tooltip": "The headset will turn off after not playing any sound for the specified time in order to conserve battery.  Default is 30 minutes.<br><br>The transmitter's LED will blink when the headset is off by default. Unchecking this box will turn this LED off when the headset is also off.",
        "tooltip2": "The headset will turn off after not playing any sound for the specified time in order to conserve battery. Default is 30 minutes.",
        "tooltip3": "Choose how long the controller stays idle before it automatically powers off to save battery"
      },
      "precision": {
        "title": "Precision"
      },
      "previewAudio": {
        "title": "Preview Audio"
      },
      "proximityLiftoff": {
        "changeWarningHeader": "Liftoff Distance Has Changed",
        "changeWarningLine1": "Do you wish to keep these settings?",
        "changeWarningLine2": "Reverting to previous liftoff settings in #SECONDS# seconds."
      },
      "pulsationSpeed": {
        "title": "Pulsation Speed",
        "tooltip": "The speed at which the pulsation speed will operate at. Lower values are faster. The value 0 is used for the default pulsation speed."
      },
      "qck": {
        "effectTooltips": {
          "colorshift": "With ColorShift, your mousepad will cycle through a series of selected colors. Change colors by clicking on the colored boxes. Add additional colors by clicking near the bottom edge of the gradient, or remove colors by dragging the boxes down.<br><br>Wave Mode will make the colors travel across the zones in waves. When Wave Mode is enabled, click \"Set origin\" to change the starting point of the wave. Click the arrow icons to change the wave style. Move the wavelength slider to the left to make smaller waves and the right to make bigger waves.",
          "cooldownTimer": "<div class=\"tooltipErrorHeader\">This feature only works when SteelSeries Engine 3 is running.</div><br>NOTE: This feature does not work in Live Preview mode. You must save your configuration to view it.<br><br>Cooldown Timer will cause affected zones to change from the Ready Color to the Cooldown Color for the duration of the Timer. Change the Trigger by clicking in the box and then pressing the key on your keyboard that you want to trigger the effect.",
          "disable": "Disable Illumination turns off illumination on affected zones.",
          "steadyColor": "When Steady is applied to one or more zones, they will be illuminated with that color. Use the color picker to the left to choose a color."
        },
        "tooltip": {
          "globalIllumination": "Use this widget to adjust the overall brightness of the mousepad. If you want to set different brightness levels for each zone, use the color pickers in Steady or ColorShift to apply darker colors.",
          "templates": "Templates are lighting patterns that will affect the whole mousepad when applied. They will overwrite any existing illumination effects."
        }
      },
      "quickset": {
        "buttonBinding": "Button Binding",
        "placeholder": "Quick Record",
        "playbackOptions": "Playback Options",
        "rumbleOnClick": "Vibrate on click",
        "tactileSettings": "Tactile Settings",
        "title": "#TITLE# Settings",
        "vibration": "Vibration"
      },
      "rangeExtend": {
        "description": "Reduces microphone quality in order to decrease audio interference and allow for greater connection range. ",
        "savePrompt": "Extended Range Mode requires the headset to restart to take effect. Headset will automatically cycle power after saving configuration updates.",
        "title": "Extended Range Mode"
      },
      "rapidTap": {
        "description": "SOCD monitors the 2 selected keys in each pair (up to 5) and activates them based on the selected behavior.",
        "descriptionBeforeModeEditing": "SOCD monitors the 2 selected keys and activates them based on Last Input Priority.",
        "errorStates": {
          "duplicateBinding": "A key cannot be assigned multiple times to Rapid Tap keys.",
          "emptyPair": "Each pair present must be configured",
          "halfConfiguredPair": "Each pair present must have both keys configured",
          "invalidBinding": "Keys with macros, dual bindings, and/or protection mode applied to them cannot be assigned to Rapid Tap."
        },
        "infoTooltip": "SOCD features like Rapid Tap have been banned in Counter-Strike 2. Using this feature may result in being kicked and/or banned from the game.",
        "key1": "Key 1",
        "key2": "Key 2",
        "modes": {
          "key1": "Priority Key 1",
          "key2": "Priority Key 2",
          "lastInput": "Last Input Priority",
          "neutral": "Neutral"
        },
        "removeBindingPrompt": {
          "description": "Are you sure you want to remove this Rapid Tap key binding?",
          "title": "Remove this Rapid Tap binding?"
        },
        "title": "Rapid Tap",
        "tooltips": {
          "extendedInfo": {
            "key1": "Key 1 will always take priority over Key 2",
            "key2": "Key 2 will always take priority over Key 1",
            "lastInput": "The most recently activated key overrides the previous one",
            "neutral": "When both keys are activated, neither is registered"
          },
          "keyEditDisabled": "Enable Rapid Tap to change key inputs."
        }
      },
      "rapidTriggerSensitivity": {
        "currentValue": "Current Sensitivity",
        "description": "Sensitivity dictates how far a key must be released to deactivate before pressing down to activate again.",
        "mixed": "Mixed",
        "title": "Rapid Trigger Sensitivity"
      },
      "recording": {
        "pressAKey": "Press a key"
      },
      "render": {
        "bassBoost": "Bass Boost",
        "bassBoostTooltip": "Increases the emphasis on low frequency audio content to the headset speakers.",
        "settings": "Render Settings",
        "title": "Render",
        "virtualAudio": "Virtual Audio",
        "virtualSurround": "Virtual Surround",
        "virtualSurroundTooltip": "Emulates a multi-speaker 3D audio environment by taking 7.1 audio and rendering it into a virtualized stream specifically for headsets.",
        "volumeBoost": "Volume Boost"
      },
      "replugUsbModal": {
        "text": "Replug the TX Base device",
        "title": "Replug Device"
      },
      "restoreFactoryDefault": {
        "buttonText": "Restore Factory Settings",
        "description": "Are you sure you want to restore factory settings? All your custom configurations will be lost.",
        "title": "Restore Factory Defaults",
        "tooltip": "This restores the factory defaults on the device"
      },
      "screenEditor": {
        "editYourImage": "Edit Your Image",
        "pencilColor": "Pencil Color",
        "toggleGrid": "Grid On/Off",
        "uploadFromFile": "Upload From File"
      },
      "screenSaver": {
        "title": "Screen Saver Mode",
        "tooltip": "Choose what the transmitter OLED screen should do when idle."
      },
      "screenSaverMode": {
        "dimScreen": "Dim Screen",
        "screenOff": "Screen Off",
        "screenSaver": "Screensaver"
      },
      "screenSaverOptions": {
        "title": "Screen Saver Options",
        "tooltip": "Set the screen saver mode and duration for the OLED display."
      },
      "scrollJump": {
        "description": "Delays scroll input after jump actions.",
        "description2": "Ignores the first scroll input after a cool down period to prevent an accidental jump.",
        "enhancedTooltip": "Prevents an unexpected scroll (often bound to jump in certain games) **by ignoring the next scroll step after X milliseconds.** This can be caused by the scroll wheel not fully settling on a step when activated or by accidentally brushing the scroll wheel in the heat of battle.Decrease the value if you're getting unexpected jumps and increase the value if your scrolling feels delayed.",
        "title": "Scroll Jump Protection",
        "tooltip": "Adds a short delay after fast scroll movements—like when you click the scroll bar or skip through content—to help prevent unintentional extra scrolling. Lower for speed, higher for control.<br><br>*GG needs to be running for this feature.",
        "tooltip2": "Adds a short delay after fast scroll movements—like when you click the scroll bar or skip through content—to help prevent unintentional extra scrolling. Lower for speed, higher for control."
      },
      "selectionTools": {
        "allKeysSelected": "All #NUMBER# keys selected.",
        "select": {
          "desc": "Click keys or drag selection boxes.  Shift + click to add to selection.",
          "name": "Select"
        },
        "selectAllKeys": {
          "name": "Select all keys"
        },
        "selectSame": {
          "desc": "Select all keys that have the same effect.",
          "name": "Select same"
        },
        "someKeysSelected": "#NUMBER# keys selected.",
        "title": "Selection Tools",
        "undo": {
          "name": "Undo"
        }
      },
      "sensitivity": "Sensitivity",
      "sensitivityAndBinds": "Sensitivity & Binds",
      "sensitivityMatcher": {
        "title": "Sensitivity Matcher"
      },
      "sideButtonLock": {
        "label": "Side Button Lock"
      },
      "sideTone": "Mic Sidetone",
      "simpleIlluminationWidget": {
        "tooltip": "Use this widget to choose how the LEDs on the keyboard behave. Select “Steady” if you would like the lights to remain constant. Select “Breathe” if you would like the lights to fade in and out, and then use the slider to choose the rate at which the “breathe” option functions."
      },
      "sleepTimer": {
        "description": "Device sleep at chosen time",
        "description2": "Auto-sleeps after inactivity to conserve power.",
        "tooltip": "Automatically puts the device to sleep after a set period of inactivity to conserve power.<br><br>*GG needs to be running for this feature."
      },
      "softwareEffects": {
        "cooldownTimer": {
          "cooldownColor": "Cooldown Color",
          "readyColor": "Ready Color",
          "startOnKey": "Start on key",
          "title": "Cooldown Timer"
        }
      },
      "sonarCallToAction": {
        "message": "Pinpoint your enemy's location long before you see them with Sonar, a breakthrough in gaming sound that trains you to hear what matters most."
      },
      "speed": "Speed",
      "speedOfHandMovement": "Speed of Hand Movement",
      "speedWithPlaceholder": "#PLACEHOLDER# Speed",
      "stereoMode": {
        "front": {
          "description": "Simulates listening to speakers in a small room",
          "title": "Small Room"
        },
        "title": "Stereo Profile",
        "tooltip": "Stereo profiles adjust virtual speaker placement for 2 channel audio",
        "traditional": {
          "description": "No stereo widening applied",
          "title": "Default"
        },
        "wide": {
          "description": "Simulates listening to speakers in a large room",
          "title": "Large room"
        }
      },
      "sticks": {
        "title": "Sticks"
      },
      "stratus": {
        "deadzone": "Deadzone",
        "invertX": "Invert X",
        "invertY": "Invert Y",
        "leftStick": "Left Stick",
        "leftTrigger": "Left Trigger",
        "linkSettings": "Link Joystick Settings",
        "linkTriggers": "Link Triggers",
        "maxValue": "Max Value",
        "rightStick": "Right Stick",
        "rightTrigger": "Right Trigger",
        "sensitivity": "Sensitivity",
        "tooltip": {
          "deadzone": "The deadzone is the area within which the stick will not report any events. In the representation above, the empty area around the stick represents the size of the deadzone relative to the active area.",
          "invert": "Use this to reverse the directions of the stick.",
          "linkSettings": "When enabled, this will allow you to adjust the setting of both sticks at once.",
          "linkTriggers": "When enabled, this will allow you to adjust the setting of both triggers at once.",
          "maxValue": "Max Value can be used to cap the highest sensitivity value reported by the stick. Set values for X and Y axis at the same time by clicking on the icon next to the sliders.",
          "sensitivity": "In the depiction above, blue represents the lowest sensitivity value and red represents the highest. Decrease sensitivity for better control. Increase sensitivity so you can hit the highest value quickly.<br><br>Change settings for the X and Y axis at the same time by clicking on the icon to the right of the sliders.",
          "trigger": "The deadzone is the area within which the trigger will not report any events. The gray area represents the size of the deadzone relative to the active area."
        }
      },
      "streamOut": {
        "title": "Stream Out"
      },
      "streamingOverlayLabel": "Streaming Overlay",
      "subAppActionsBinding": {
        "description": "Dial 2 and Button 2 will revert to default behavior (Headphone/Line out - volume, and Headphone/Line out - mute) while Sonar is in Gamer Mode.",
        "headphoneLineOut": "Headphone/Line out",
        "micGainDefault": "Microphone Gain (Default)",
        "micMuteDefault": "Microphone Mute (Default)",
        "title": "Bindings",
        "tooltip": "Use this widget to configure the functions of Dial 2 and Button 2 on the interface. Dial 1 and Button 1 have fixed functions that cannot be changed."
      },
      "surroundPreset": {
        "title": "Surround Profile",
        "tooltip": "Surround profiles adjust virtual speaker positioning, proximity and ambience for 5.1 or 7.1 audio"
      },
      "surroundUpmix": {
        "title": "Surround Upmix",
        "tooltip": "Expand stereo content to use your center and rear speakers. Please note, it is highly recommended you turn this feature off before playing true 5.1 surround audio content."
      },
      "tactileCooldowns": {
        "addTimer": "Add Timer",
        "duration": "Duration",
        "makeATimer": "Make a Timer",
        "placeholderText": "Set up any key on your keyboard or mouse to trigger a custom cooldown timer. At the exact moment your timers finishes, your mouse will provide a tactile alert letting you feel that your ability is now off cooldown.",
        "timerNum": "Timer #NUMBER#",
        "title": "Tactile Cooldowns",
        "tooltip": "Set up any key on your keyboard or mouse to trigger a custom cooldown timer. At the exact moment your timers finishes, your mouse will provide a tactile alert letting you feel that your ability is now off cooldown.<br><br>A Trigger is the mouse or keyboard key that will activate your cooldown timer. Timer Duration is the length of time between pressing the Trigger and receiving your cooldown notification.",
        "triggerResetsCooldown": "Trigger Resets Cooldown",
        "triggerResetsCooldownTooltip": "When pressing this button, your created tactile alert will reset to its original duration. If unchecked, your tactile alert will continue counting down even if the button is pressed again."
      },
      "templates": "Templates",
      "tooManyEffectsWarning": {
        "line1": "You have reached the limit of ColorShift and Breathe effects for this device.",
        "line2": "If you would like to use a new effect, remove one of the existing effects from the keyboard. You can do this by changing keys with a ColorShift or Breathe effect to Steady, Reactive Key, Cooldown Timer, or Disabled.",
        "line3Templates": "The template you are applying requires #NUM_TOTAL_EFFECTS# free effects (currently #NUM_FREE_EFFECTS#)."
      },
      "tooltip": {
        "accelDecel": "Acceleration and Deceleration modify your mouse cursor speed based on the speed you move your mouse. Within a normal threshold of movement, your mouse cursor will move based on the sensivity you have selected in the CPI widgets. However, if you move your mouse quickly or slowly, you can customize SteelSeries Engine to increase or decrease your CPI.",
        "accelDecelV2": "Acceleration and Deceleration modify your mouse cursor speed based on the speed you move your mouse. Within a normal threshold of movement, your mouse cursor will move based on the sensivity you have selected in the DPI widgets. However, if you move your mouse quickly or slowly, you can customize SteelSeries Engine to increase or decrease your DPI.",
        "action": "Optimize your gameplay by binding important keys to the buttons on your device. The actions menu allows quick reconfiguration of your layout including keyboard, mouse, media keys, and macros. ",
        "activeSleepIllum": "The selected Active lighting mode will control the keyboard lighting for when the notebook is in use, while the chosen Sleep lighting mode will appear when your computer is asleep.  Adjusting brightness via the Fn+/- hotkeys on the keyboard will not affect the values on-screen or in the saved configuration.",
        "anglesnapping": "Angle Snapping locks in your cursor movement. It analyzes your mouse movement in real time to help straighten out and snap your lines, compensating for human error. Very useful if you want to move your scope to the left and right to pick off enemies as they come over a hill.",
        "audioSource": "Select the Source that you would like to make active. Sources must be first configured from the transmitter menu before they appear in the list.",
        "autoMicGain": "Auto Mic Compression automatically keeps the volume level of your voice within game appropriate range so you won't overload your mic or be too quiet for others to hear you.",
        "captureMode": "Choose whether to let the overlay assume the resolution of your monitor (when streaming the contents of your desktop) or to bind it to the application specified (when streaming your gameplay). Optionally select to show the bounding box to see the actual size of the overlay in your stream.",
        "chatMix": "<p>Note! - ChatMix is only available for Sources with separate game and chat audio inputs.</p><p>ChatMix allows you to adjust the balance between the game and chat audio streams. The 12:00 position is full volume of both streams. Rotating towards game reduces the chat volume and vice versa.</p>",
        "cpi": "Sensitivity, or CPI (Counts per Inch) indicates how far your mouse cursor moves in relation to the physical movement of the mouse. Setting a higher CPI value will make the mouse cursor move farther across the screen, requiring less physical movement.",
        "cpi2": "You can configure two levels of sensitivity for your mouse. Assigned a CPI toggle to a mouse button in Actions menu allows you to change your mouse sensivity on the fly in game with a simple click of a button. Great for sniper mode!",
        "dolby": "<p>Turn on Dolby to experience content from games and movies with multi-channel (surround sound) audio streams. For more information on how to configure your soundcard to accept multi-channel audio, <p><a href='http://faq.steelseries.com/questions/511'>visit our FAQ</a>",
        "equalizer": "Personalize audio frequency response to your preferences. Drag the faders up or down to increase or decrease the amount of each frequency. Presets have been provided to quickly set up your soundcape for different settings.",
        "gameBudsVolume": "Adjusts the GameBuds volume.",
        "globalIllumination": "Use this widget to make the brightness of all zones on the keyboard the same. If you want to set different brightness levels for each zone, use the color picker to apply darker colors.",
        "globalIlluminationDevice": "Use this widget to make the brightness of all zones on the device the same. If you want to set different brightness levels for each zone, use the color picker to apply darker colors.",
        "headsetVolume": "Adjusts the main headphone volume.",
        "keyboardRegion": "Use this widget to change the appearance of the software so that it corresponds with your physical keyboard. If you want to change your keyboard output, adjust your system settings.",
        "liveMix": "<p>Note! - LiveMix is only available for Sources with separate game and chat audio inputs.</p><p>LiveMix automatically reduces the level of game volume when chat audio is present and returns the game audio to full when chat is silent.  Drag the lines up or down to choose the amount (in dB) that the game audio level will reduce when chat is present.</p>",
        "lockKeys": "Use this to pick the illumination color for active lock keys. Turn this feature off to prevent lock keys from changing color while active. Lock keys include Caps Lock, Scroll Lock, and Num Lock.",
        "logoLedToggle": "Turn on/off lighting for the logo LED",
        "logoPlacement": "In case the SteelSeries Logo Watermark obstructs the sensitive area in your game, move it to a different corner or disable it.",
        "micAutoOptimization": "Mic Auto Optimization automatically keeps the volume level of your voice within game appropriate range so you won't overload your mic or be too quiet for others to hear you.",
        "micVolume": "Increase or decrease the volume level of the mic. This provides a convenient way to adjust your mic volume per game or VOIP client without having to go into system settings.",
        "noiseCancellation": "Mic Noise Reduction reduces the amount of background noise picked up by the mic and improves the clarity of your voice.",
        "pollingrate": "Polling Rate determines how often your computer communicates with your device. The values below are measured in Hz. 1000 Hz means that your device's data will be sent to the computer every 1 millisecond. Choosing 125 Hz lowers the frequency to every 8 milliseconds.",
        "sidetone": "Mic Sidetone enables you to hear your own voice in your headset. Many people prefer a low level of Sidetone to let them know the mic is working.",
        "streamingOverlay": "Switch the streaming overlay ON or OFF. The overlay will not be visible to your streaming application unless it is turned ON.",
        "templates": "Templates are lighting patterns that will affect the whole keyboard when applied. They will overwrite any existing illumination effects.",
        "visualization": "Choose how the gaze overlay will appear in your stream. Customize it further by clicking on the color picker hotspot and setting color and opacity to desired values. The final result can be previewed on the left.",
        "wheelLedToggle": "Turn on/off lighting for the wheel LED"
      },
      "trackingTools": "Tracking Tools",
      "triggers": {
        "title": "Triggers"
      },
      "typingGamingMode": {
        "gamingMode": "Gaming Mode",
        "tooltip": {
          "line1": "Mode selection only impacts current keyboard configuration.",
          "line2": "You can also manually change the mode on your keyboard by pressing the SS key + I/O."
        },
        "typingMode": "Typing Mode"
      },
      "userImage": {
        "imageError": "There was an error using this image. Please try again.",
        "imageErrorLabel": "Image Error",
        "imageNotSupported": "This file type is not supported.",
        "imageSizeLabel": "Image Size",
        "imageTooLarge": "The image you are trying to use is too large. The maximum size of a file that can be used is 10MB."
      },
      "viewOptions": "View Options",
      "viewTutorial": "View Tutorial",
      "visualizationLabel": "Visualization",
      "voiceLeveler": {
        "title": "Voice Leveler",
        "tooltip": "This feature moderates variations in your speaking volume so that all of your speech is delivered at the same discernible level."
      },
      "volumeLimiter": {
        "title": "Volume Limiter",
        "tooltip": "Choose whether or not to apply the max volume limiter. Disabling allows the headphones to play much louder."
      },
      "volumeLimiterOrGain": "Volume Limiter/Gain",
      "waveMode": {
        "confirmDialog": "Do you want to set the new origin point before exiting Set Origin Mode?",
        "dragInstruction": "Drag the crosshairs to set the origin.",
        "setOrigin": "Set Origin",
        "title": "Wave Mode"
      },
      "wearSense": {
        "continueAudio": "Continue playing audio",
        "description": "Select your preferred action when a GameBuds is removed (Bluetooth only)",
        "pauseAudio": "Automatically pause audio",
        "title": "Wear Sense",
        "tooltip": "\"Wear Sense\" configuration will pause or continue audio stream when GameBuds are removed from the ears."
      },
      "wirelessMode": {
        "title": "2.4G Mode",
        "tooltip": "Sets the 2.4G mode setting of the #DEVICENAME#."
      },
      "zoneColors": {
        "group": "Group #GROUPNUMBER#",
        "mode": "Illumination Edit Mode",
        "noPerZoneReactive": "Per-zone configuration is not supported for reactive effects",
        "showZoneGuides": "Show Zone Guides",
        "zone": "Zone #ZONENUMBER#"
      },
      "zoneSelectTools": {
        "additionalTools": "Additional Tools",
        "brush": {
          "desc": "Paint the current effect settings on other zones.",
          "name": "Paintbrush"
        },
        "bucket": {
          "desc": "Fill the zones that are touching with the current effect settings.",
          "name": "Paintbucket"
        },
        "dragBox": {
          "desc": "Drag a box around the zones you want to edit.",
          "name": "Group Select"
        },
        "eraser": {
          "desc": "Remove effect from zone.",
          "name": "Eraser"
        },
        "eyedropper": {
          "desc": "Click on a zone to select its effect settings without changing zone selection.",
          "name": "Effect Picker"
        },
        "magicwand": {
          "desc": "Click on a zone to select all zones that share the same effect.",
          "name": "Magic Wand"
        },
        "pointer": {
          "desc": "Click the zone(s) you want to edit. Use Shift to add to selection.",
          "name": "Select"
        },
        "redo": {
          "desc": "Redo the last change made in Effect settings.",
          "name": "Redo"
        },
        "undo": {
          "desc": "Undo the last change made in Effect settings.",
          "name": "Undo"
        }
      }
    }
  }
};
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
