'use strict';
const chalk=require('chalk');
const gradient=require('gradient-string');
const tinyMap=Object.fromEntries([...('abcdefghijklmnopqrstuvwxyz')].map((c,i)=>[c,[...'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ'][i]]));
function say(text, options={}) {
  const stream=options.stream||process.stdout;
  let rendered=String(text??'').replace(/[\x00-\x08\x0b-\x1f\x7f]/g,'');
  if(options.font==='tiny')rendered=[...rendered.toLowerCase()].map(c=>tinyMap[c]||c).join('');
  else if(options.font==='block')rendered=rendered.toUpperCase().split('\n').map(line=>'▰ '+[...line].join(' ')+' ▰').join('\n');
  else if(options.font==='simple')rendered=rendered.toUpperCase();
  const width=Number(options.width)||stream.columns||80;
  const color=options.forceColor??!!stream.isTTY;
  const colors=(options.colors||[]).filter(name=>typeof chalk[name]==='function');
  rendered=rendered.split('\n').map((line,i)=>{
    const pad=options.align==='center'?Math.max(0,Math.floor((width-[...line].length)/2)):options.align==='right'?Math.max(0,width-[...line].length):0;
    let output=line;
    if(color&&Array.isArray(options.gradient)&&options.gradient.length>=2){try{output=gradient(options.gradient)(line);}catch{}}
    else if(color&&colors.length){const paint=new chalk.Instance({level:1});output=[...line].map((char,index)=>paint[colors[(index+i)%colors.length]](char)).join('');}
    return ' '.repeat(Math.min(500,pad))+output;
  }).join('\n');
  stream.write(rendered+'\n'); return rendered;
}
let shown=false;
function showKageBanner(options={}) {
 if(shown||process.env.KAGE_BANNER==='0')return;
 shown=true;
 say('kage baileys', {font:'simple',align:'center',gradient:['red','magenta'],...options});
 say('Creado por xrljosedv', {font:'console',align:'center',colors:['cyan','magenta','yellow'],...options});
 say('Socio David Zuniga', {font:'console',align:'center',colors:['cyan','magenta','yellow'],...options});
}
exports.say=say;exports.showKageBanner=showKageBanner;
