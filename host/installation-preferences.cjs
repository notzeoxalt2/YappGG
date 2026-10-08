const fs=require('fs'),path=require('path');
exports.configure=async({args,setStartup,backend,enhanceDiscord,data,trace})=>{
 const results=[];const run=async(name,action)=>{try{results.push({name,ok:true,result:await action()});}catch(error){results.push({name,ok:false,error:error.message});trace({installationSetupError:error.message,step:name});}};
 await run('startup',()=>setStartup(!args.includes('--no-startup'),true));
 await run('microphone routing',()=>backend(args.includes('--discord-setup')?'--discord-setup':'--safe-route'));
 if(args.includes('--enhance-discord'))await run('Discord enhancement',()=>enhanceDiscord());
 fs.writeFileSync(path.join(data,'installation-setup-result.json'),JSON.stringify({results},null,2));
 const errors=results.filter(result=>!result.ok),file=path.join(data,'installation-setup-error.json');
 if(errors.length)fs.writeFileSync(file,JSON.stringify({error:errors.map(result=>result.name+': '+result.error).join('\n')}));else if(fs.existsSync(file))fs.unlinkSync(file);
 return results;
};
