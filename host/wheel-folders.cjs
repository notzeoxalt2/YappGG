// Character packs commonly put their voices under Basic/Anyone/Overall.
// Keep those categories in storage, but project only packs and characters.
function wheelFolders(folders){const result=new Set(folders.map(folder=>folder.split('/')[0]));for(const folder of folders){const parts=folder.split('/');if(parts.length>1&&['basic','anyone','overall'].includes(parts.at(-1).toLowerCase()))result.add(parts.slice(0,-1).join('/'));}return [...result].sort((a,b)=>a.localeCompare(b));}
function visibleFolder(folder,choices){if(folder==='All')return 'All';return choices.filter(choice=>folder===choice||folder.startsWith(choice+'/')).sort((a,b)=>b.length-a.length)[0]||'All';}
module.exports={wheelFolders,visibleFolder};
