'use strict';
const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const ts=require('typescript');const root=path.resolve(__dirname,'..');let checked=0;const failures=[];
function scan(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())scan(f);else if(/\.(?:c?js|mjs)$/.test(f)){
 const tree=ts.createSourceFile(f,fs.readFileSync(f,'utf8'),ts.ScriptTarget.Latest,true);const req=createRequire(f);
 function walk(n){let value;if(ts.isCallExpression(n)&&n.expression.getText(tree)==='require'&&n.arguments.length===1&&ts.isStringLiteral(n.arguments[0]))value=n.arguments[0].text;else if((ts.isImportDeclaration(n)||ts.isExportDeclaration(n))&&n.moduleSpecifier&&ts.isStringLiteral(n.moduleSpecifier))value=n.moduleSpecifier.text;
 if(value?.startsWith('.')){checked++;try{req.resolve(value)}catch(err){failures.push({archivo:path.relative(root,f),ruta:value,error:err.code})}}ts.forEachChild(n,walk)}walk(tree);
}}}
for(const dir of ['lib','WAProto','scripts','test','Example'])scan(path.join(root,dir));
console.log(JSON.stringify({importacionesLocales:checked,errores:failures},null,2));if(failures.length)process.exitCode=1;
