const fs=require('fs'),path=require('path');
const parser=require('@babel/parser'),traverse=require('@babel/traverse').default,generate=require('@babel/generator').default;
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'recovered/readable-frontend/index.js'),'utf8');
const ast=parser.parse(source,{sourceType:'script'});
let entry;
traverse(ast,{ObjectProperty(p){if(p.node.key.value===60555)entry=p.get('value');}});
if(!entry)throw Error('Original renderer entry was not found');
const wanted=new Set(),queue=['Yne','Yde','Gme','nMe','ENe','Ze','i','a','o','l','d','c','q','_l','QQ','Gj'];
while(queue.length){
  const name=queue.shift();if(wanted.has(name))continue;
  const binding=entry.scope.getBinding(name);if(!binding||binding.scope!==entry.scope)continue;
  wanted.add(name);
  binding.path.traverse({ReferencedIdentifier(p){const b=p.scope.getBinding(p.node.name);if(b&&b.scope===entry.scope&&!wanted.has(p.node.name))queue.push(p.node.name);}});
}
const statements=[];
for(const statement of entry.node.body.body){
  if(statement.type==='VariableDeclaration'){
    for(const declaration of statement.declarations){
      if(declaration.id.type==='Identifier'&&wanted.has(declaration.id.name))statements.push({...statement,declarations:[declaration]});
    }
  }else if(statement.type==='FunctionDeclaration'&&wanted.has(statement.id.name))statements.push(statement);
}
const expose=parser.parse('globalThis.__originalMic={React:i,Dom:a,Redux:o,Query:l,Preferences:d,Analytics:c,Icons:q,TitleBar:nMe,Theme:ENe.A,QueryClient:Ze.A,Mic:Yne,Header:Gme,PresetMenu:sre,MicRole:_l.xC,Selectors:QQ,ConfigActions:Gj};').program.body;
entry.node.body.body=[...statements,...expose];
const ui=path.join(__dirname,'ui');fs.mkdirSync(ui,{recursive:true});
fs.cpSync(path.join(root,'recovered/frontend/render'),ui,{recursive:true});
fs.copyFileSync('C:/Program Files/SteelSeries/GG/localization/en_US.json',path.join(ui,'en_US.json'));
let renderer=generate(ast,{compact:false,comments:false}).code.replace('var s = r.O(','globalThis.__ggRequire=r; var s = r.O(');
renderer=renderer.replace('i.createElement(h8, {\n            ref: N','i.createElement(h8, {\n            style: {gridTemplateColumns: `${f}px minmax(0, 1fr)`},\n            ref: N');
renderer=renderer.replace(/const Wse =[^\n]+;/,'const Wse = () => true;').replace(/const Qse =[^\n]+;/,'const Qse = () => !!globalThis.__audioStatus?.running;');
// Recompute the original EQ responses together when presets or canvas dimensions
// change. The incremental cache can retain two-sample responses from the initial
// unmeasured canvas, producing undefined/NaN coordinates after its first resize.
const cacheStart=renderer.indexOf('                  [y, b] = (0, i.useState)([]),');
const cacheEnd=renderer.indexOf('                const w = (0, i.useMemo)',cacheStart);
if(cacheStart<0||cacheEnd<0)throw Error('Original EQ response cache was not found');
renderer=renderer.slice(0,cacheStart)+`                  E = (0, i.useMemo)(() => Array(o.length).fill(0), [o]),
                  x = (0, i.useCallback)(e => e.enabled ? (0, T7.P0)(o, l, e.frequency, e.gain, e.qFactor, e.type) : E, [E, o, l]),
                  y = (0, i.useMemo)(() => n.concat(h).map(x), [n, h, x]);
`+renderer.slice(cacheEnd);
// The library is now a standalone dialog, so its grid receives the remaining
// content height directly rather than subtracting the former header twice.
renderer=renderer.replace('height: "inherit",\n              width: "100%"','height: "100%", minHeight: 0, flex: 1,\n              width: "100%"').replace('p = c - 300;', 'p = c;').replace('defaultHeight: c - 300,', 'defaultHeight: c,');
renderer=renderer.replace("color: n ?? PQ(t)","color: n ?? '#D94A4A'").replace("i.createElement($Q, {\n            iconId: t,\n            size: a / 3","i.createElement('img', {\n            src: 'brand/mark-light.svg', alt: '',\n            width: a / 3, height: a / 3").replace('color: PQ(t)',"color: '#D94A4A'").replace("i.createElement(Qoe, {\n            iconId: t,\n            size: 20,","i.createElement('img', {\n            src: 'brand/mark-light.svg', alt: '',\n            width: 20, height: 20, style: {alignSelf: 'flex-end'},");
fs.writeFileSync(path.join(ui,'index.js'),renderer);
fs.writeFileSync(path.join(root,'reports/ui-extraction.json'),JSON.stringify({originalEntryStatements:entry.node.body.body.length,retainedBindings:wanted.size,retainedNames:[...wanted].sort(),source:'GG 120.0.0 original production Mic React component Yne and header Yde'},null,2));
let html=fs.readFileSync(path.join(ui,'index.html'),'utf8');
html=html.replace('<title data-bind="localizedText: \'main.windowTitle\'">SteelSeries GG</title>','<title>Sonar Mic</title>');
html=html.replace('<body id="Main">','<body id="Main"><script src="bridge.js"></script>');
html=html.replace('</body>','<script defer src="mount.js"></script></body>');
fs.writeFileSync(path.join(ui,'index.html'),html);
console.log(JSON.stringify({retainedBindings:wanted.size,ui}));
