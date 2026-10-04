(async()=>{
 const pause=()=>new Promise(resolve=>setTimeout(resolve,100));
 const selected=()=>__micStore.getState().soundstage.configs.selectedConfigs.chatCapture;
 const graph=()=>__micCanvases.find(c=>c.lowerCanvasEl?.isConnected&&!c.disposed);
 function measure(){
  const canvas=graph();if(!canvas)throw Error('EQ canvas is missing');
  canvas.renderAll();
  const points=canvas.getObjects()[2].points;
  const count=Math.max(Math.floor(canvas.width/2),2);
  const frequencies=Array.from({length:count},(_,index)=>Math.exp(Math.log(50/3)+index/(count-1)*(Math.log(24000)-Math.log(50/3))));
  const expected=Array(count).fill(0),eq=selected().data.parametricEQ;
  for(let band=1;band<=10;band++){
   const filter=eq['filter'+band];
   if(filter.enabled){const response=__ggRequire(40727).P0(frequencies,48000,filter.frequency,filter.gain,filter.qFactor,filter.type);response.forEach((gain,index)=>expected[index]+=gain);}
  }
  let maxPixelError=0;
  const finite=points.length===count&&points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
  if(finite)points.forEach((point,index)=>{
   const y=(1-(expected[index]+13.75)/27.5)*canvas.height;
   maxPixelError=Math.max(maxPixelError,Math.abs(point.y-y),Math.abs(point.x-index/(count-1)*canvas.width));
  });
  const rect=canvas.lowerCanvasEl.getBoundingClientRect();
  const y=Math.max(1,Math.min(canvas.height-4,Math.round((1-(expected.at(-1)+13.75)/27.5)*canvas.height)));
  const pixels=canvas.contextContainer.getImageData(canvas.width-4,y-1,3,3).data;
  // A hovered band can tint the antialiased white response line pink.
  // Require its bright component, allowing that documented overlay blend.
  let renderedRightEdge=false;for(let p=0;p<pixels.length;p+=4){if(pixels[p]>180&&pixels[p+1]>150&&pixels[p+2]>160&&pixels[p+3]>60)renderedRightEdge=true;}
  return {preset:selected().name,samples:count,finite,maxPixelError,renderedRightEdge,pixelProbe:renderedRightEdge?undefined:{y,pixels:Array.from(pixels),canvasWidth:canvas.lowerCanvasEl.width,canvasHeight:canvas.lowerCanvasEl.height,stroke:canvas.getObjects()[2].stroke},passed:finite&&maxPixelError<1e-6&&renderedRightEdge,rangeDb:[Math.min(...expected),Math.max(...expected)],rect:rect.toJSON()};
 }
 const original=structuredClone(selected());
 async function settledMeasure(){
  // The recovered graph schedules preset response updates asynchronously.
  // Wait for that response, with a bounded timeout, instead of assuming 100ms.
  for(let attempt=0;attempt<20;attempt++){
   const result=measure();if(result.passed)return {...result,settleMs:attempt*100};
   await pause();
  }
  return measure();
 }
 const results=[];
 for(const config of Object.values(__micStore.getState().soundstage.configs.configs.chatCapture)){
  __micStore.dispatch({type:'SOUNDSTAGE_SELECT_CONFIG',configId:config.id});await pause();results.push(await settledMeasure());
 }
 __micStore.dispatch({type:'SOUNDSTAGE_SELECT_CONFIG',configId:original.id});await pause();
 const before=structuredClone(selected().data.parametricEQ);
 __micStore.dispatch({type:'SOUNDSTAGE_UPDATE_CONFIG_DATA',config:selected(),updateValues:{parametricEQ:{filter3:{gain:before.filter3.gain===5?4:5}}}});
 await pause();const edit=measure(),after=selected().data.parametricEQ;
 const preservesBands=Object.keys(before).filter(key=>key!=='filter3').every(key=>JSON.stringify(before[key])===JSON.stringify(after[key]))&&after.filter3.frequency===before.filter3.frequency&&after.filter3.qFactor===before.filter3.qFactor&&after.filter3.type===before.filter3.type;
 __micStore.dispatch({type:'SOUNDSTAGE_SAVE_CONFIG',config:original});await pause();
 const canvas=graph(),marker=canvas.getObjects().filter(o=>o.type==='circle'&&o.radius===5)[2];
 let drag=false;
 if(marker){const old=selected().data.parametricEQ.filter3;marker.set({left:(Math.log(180)-Math.log(50/3))/(Math.log(24000)-Math.log(50/3))*canvas.width,top:(1-(3+13.75)/27.5)*canvas.height});canvas.fire('object:modified',{target:marker});await pause();const changed=selected().data.parametricEQ.filter3;drag=Math.abs(changed.frequency-180)<1&&Math.abs(changed.gain-3)<0.2&&changed.qFactor===old.qFactor;}
 const dragged=await settledMeasure();
 __micStore.dispatch({type:'SOUNDSTAGE_SAVE_CONFIG',config:original});await pause();
 return {passed:results.every(r=>r.passed)&&edit.passed&&preservesBands&&drag&&dragged.passed,presets:results,edit,preservesBands,drag,dragged,restored:measure()};
})()
