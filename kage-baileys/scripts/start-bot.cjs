'use strict';
const {spawn}=require('node:child_process');const path=require('node:path');
console.log('[KAGE BAILEYS] Iniciando el runtime completo adaptado de Chiaki.');
const child=spawn(process.execPath,['scripts/start.cjs',...process.argv.slice(2)],{cwd:path.resolve(__dirname,'../bot'),stdio:'inherit',env:process.env});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.once('error',error=>{console.error(error);process.exitCode=1;});
child.once('exit',(code,signal)=>{process.exitCode=code ?? (signal?1:0);});
