const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const commands=[],window={__audioStatus:{}},React={Fragment:'fragment',memo:x=>x,useCallback:x=>x,useRef:value=>({current:value}),useEffect:()=>{},useState:value=>[value===false?true:value?.running===false?{...value,running:true,imported:3,total:10,current:'clip.mp3'}:value,()=>{}],createElement:(type,props,...children)=>({type,props:props||{},children:children.flat()})};
vm.runInNewContext(fs.readFileSync('ui/soundboard.js','utf8'),{window,micHost:{soundboard:async(command)=>{commands.push(command);return true;}}});
const {SoundboardLauncher}=window.createSoundboardComponents({React},()=>{}),launcher=SoundboardLauncher(),board=launcher.children.find(node=>typeof node?.type==='function'),tree=board.type(board.props),all=[];
function walk(node){if(!node||typeof node!=='object')return;all.push(node);for(const child of node.children||[])walk(child);}walk(tree);
const cancel=all.find(node=>node.props['aria-label']==='Cancel import');assert(cancel);assert(!cancel.props.disabled);cancel.props.onClick();assert(commands.includes('cancel-import'));
assert(all.some(node=>node.props.role==='status'&&node.children.some(text=>typeof text==='string'&&text.includes('3 / 10 imported'))));
fs.writeFileSync('../reports/import-ui-test.json',JSON.stringify({passed:true,cancelButtonSendsCommand:true,progressCounterVisible:true,noWindow:true,noAudio:true}));console.log('PASS: import UI exposes enabled Cancel and progress counter. No window/audio.');
