window.createUpdateSettings=(R)=>{
 const el=R.createElement;
 return R.memo(function UpdateSettings(){
  const [state,setState]=R.useState({enabled:true,status:'idle',message:'Loading update settings…'});
  R.useEffect(()=>{let active=true;const read=()=>micHost.updates('status').then(value=>{if(active)setState(value);}).catch(()=>{});read();const timer=setInterval(read,1000);return()=>{active=false;clearInterval(timer);};},[]);
  const action=async(command,values)=>{try{const next=await micHost.updates(command,values);if(next&&typeof next==='object')setState(next);}catch(error){setState(previous=>({...previous,message:String(error.message).replace(/^Error invoking remote method '[^']+': (?:Error: )?/,'' )}));}};
  return el(R.Fragment,null,el('h3',null,'Updates'),el('label',{className:'settings-row'},el('div',null,el('strong',null,'Automatic updates'),el('p',null,'Download new versions from GitHub in the background. Restart when you’re ready.')),el('input',{type:'checkbox',role:'switch','aria-label':'Automatic updates',checked:state.enabled,onChange:event=>action('enabled',{enabled:event.target.checked})})),el('div',{className:'settings-row'},el('div',null,el('strong',null,'YappGG '+(state.version||'')),el('p',{role:'status'},state.message)),el('button',{disabled:['checking','downloading','unavailable'].includes(state.status),onClick:()=>action(state.status==='ready'?'install':'check')},state.status==='ready'?'Restart to update':state.status==='checking'?'Checking…':state.status==='downloading'?'Downloading…':'Check for updates')));
 });
};
