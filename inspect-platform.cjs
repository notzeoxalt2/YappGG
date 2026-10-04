const fs=require('fs'),parser=require('@babel/parser'),traverse=require('@babel/traverse').default,generate=require('@babel/generator').default;
const ids=new Set([95563,81358,49665,85525]);let parts=[];
for(const file of ['151.js','679.js','954.js','index.js']){let ast=parser.parse(fs.readFileSync('ui/'+file,'utf8'));traverse(ast,{ObjectProperty(p){if(ids.has(p.node.key.value)){parts.push(generate(p.node).code);ids.delete(p.node.key.value);}}});}
fs.writeFileSync('../reports/renderer-platform-modules.js',parts.join('\n\n'));
