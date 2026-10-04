const {createHash}=require('crypto');
// Gain order: 31, 62, 125, 250, 500, 1k, 2k, 4k, 8k, 16k Hz.
const designs=[
 {name:'Clear Voice',gains:[-9,-5,-2,-2,-1,1,3,2,0,-2],noise:.65,compression:.25},
 {name:'Crisp Speech',gains:[-10,-6,-3,-2,0,1,3,4,1,-3],noise:.55,compression:.2},
 {name:'Warm Studio',gains:[-9,-2,3,2,-2,-1,1,1,-1,-3],noise:.55,compression:.3},
 {name:'Smooth Broadcast',gains:[-10,-3,2,1,-2,0,2,1,-3,-5],noise:.6,compression:.45},
 {name:'Bass Monster',gains:[-8,5,9,5,0,-2,-2,-3,-5,-8],noise:0,compression:.35},
 {name:'Megaphone',gains:[-12,-10,-8,-5,3,7,5,-2,-10,-12],noise:0,compression:.75},
 {name:'Tin Can',gains:[-12,-9,-6,-4,-2,8,-5,5,-6,-12],noise:0,compression:.5,q:2.2},
 {name:'Lo-Fi Telephone',gains:[-12,-12,-9,-3,3,4,2,-8,-12,-12],noise:0,compression:.7},
 {name:'Loud Mess',gains:[3,4,0,-6,7,9,8,-8,5,-6],noise:0,compression:.05,q:1.8},
 {name:'Crappy Voice',gains:[-12,-10,-5,7,-3,9,-5,6,-10,-12],noise:0,compression:0,q:1.6},
 {name:'Busted Radio',gains:[-12,-12,-8,2,6,2,-5,-10,-12,-12],noise:0,compression:0,q:1.2},
 {name:'Midnight Radio',gains:[-12,-6,4,4,1,-2,-4,-7,-10,-12],noise:.35,compression:.65}
];
const effects={
 'Crappy Voice':{drive:60,clip:.22,bits:6,rate:11025,lowCut:180,highCut:3900},
 'Loud Mess':{drive:32,clip:.3,bits:8,rate:16000,lowCut:120,highCut:5000},
 'Busted Radio':{drive:40,clip:.3,bits:5,rate:8000,lowCut:400,highCut:2400},
 'Megaphone':{drive:12,clip:.5,bits:12,rate:24000,lowCut:300,highCut:3400},
 'Tin Can':{drive:12,clip:.7,bits:10,rate:16000,lowCut:500,highCut:3800},
 'Lo-Fi Telephone':{drive:16,clip:.7,bits:8,rate:8000,lowCut:350,highCut:3000}
};
const frequencies=[31,62,125,250,500,1000,2000,4000,8000,16000];
function extraPresets(template){return designs.map(design=>{
 const config=structuredClone(template),hash=createHash('sha256').update('yappeq-preset-v1:'+design.name).digest('hex');
 config.id=`${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;
 Object.assign(config,{name:design.name,isPreset:true,isFavorite:false,favoritePosition:-1,isNew:false,image:'sonar.svg',schemaVersion:6,virtualAudioDevice:'chatCapture'});
 config.data.parametricEQ={enabled:true};
 frequencies.forEach((frequency,index)=>{config.data.parametricEQ['filter'+(index+1)]={enabled:true,frequency,gain:design.gains[index],qFactor:index===0||index===9?.7071:design.q||.9,type:index===0?'lowShelving':index===9?'highShelving':'peakingEQ'};});
 config.data.noiseCancelingState={enabled:design.noise>0,value:design.noise};
 config.data.volumeStabilizerState={enabled:true,value:design.compression};
 config.data.noiseGateState={enabled:false,value:-60};config.data.automaticNoiseGateState={enabled:false,value:0};
 config.data.noiseReductionState={enabled:false,value:0};config.data.impactNoiseReductionState={enabled:false,value:0};
 config.data.globalEnableState=true;config.data.acousticEchoCancelingState=false;
 if(effects[design.name])config.data.yappggEffect={name:design.name,...effects[design.name]};
 config.defaultData=structuredClone(config.data);
 return config;
});}
module.exports={extraPresets,designs};
