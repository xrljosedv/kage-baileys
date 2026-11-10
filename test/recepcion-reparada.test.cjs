'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');const {Readable}=require('node:stream');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const api=require('../lib');
const chat='51900000001@s.whatsapp.net';
const socket=()=>({ev:new EventEmitter(),user:{id:'51900000002:1@s.whatsapp.net'},statusStorageDir:false,sent:[],async sendMessage(jid,body){const sent={jid,body};this.sent.push(sent);return sent;}});
const raw=(type='imageMessage',wrapper='viewOnceMessageV2',route=chat)=>({key:{remoteJid:route,participant:route.endsWith('@g.us')?chat:undefined,id:'fresh',fromMe:false},messageTimestamp:Math.floor(Date.now()/1000),message:{[wrapper]:{message:{[type]:{viewOnce:true,mediaKey:Buffer.from('secret'),directPath:'/delivered',mimetype:type==='audioMessage'?'audio/ogg':'application/octet-stream',ptt:type==='audioMessage'}}}}});
const download=async()=>Readable.from([Buffer.from('delivered-content')]);
for(const type of ['imageMessage','videoMessage','audioMessage','documentMessage','stickerMessage'])for(const wrapper of ['viewOnceMessage','viewOnceMessageV2','viewOnceMessageV2Extension']){
 test(`inspección conserva ${wrapper}/${type}`,()=>{
  const message=raw(type,wrapper),before=JSON.stringify(message),detail=api.inspectMessage(message);
  assert.equal(detail.type,type);assert.equal(detail.viewOnce,true);assert.equal(detail.downloadable,true);assert.equal(JSON.stringify(message),before);assert.equal(JSON.stringify(detail).includes('secret'),false);
 });
}
for(const route of [chat,'123456@g.us'])for(const type of ['imageMessage','videoMessage','audioMessage'])test(`automático usa misma salida manual: ${route}/${type}`,async()=>{
 const a=socket(),b=socket(),message=raw(type,'viewOnceMessageV2Extension',route);
 await api.resendViewOnceMessage(a,message,{downloader:download});
 await api.handleAutoViewOnce(message,b,{autoViewOnceChats:[route]},{downloader:download});
 assert.deepEqual(b.sent,a.sent);assert.equal(b.sent.length,1);
});
test('deviceSentMessage y efímero no ocultan la vista única',async()=>{
 const c=socket(),message=raw();message.message={deviceSentMessage:{message:{ephemeralMessage:{message:message.message}}}};
 await api.handleAutoViewOnce(message,c,{autoViewOnceChats:[chat]},{downloader:download});assert.equal(c.sent.length,1);assert.equal(api.inspectMessage(message).viewOnce,true);
});
test('permiso de privado PN funciona con LID confirmado',async()=>{
 const c=socket();c.signalRepository={lidMapping:{getPNForLID:async()=>chat}};
 await api.handleAutoViewOnce(raw('imageMessage','viewOnceMessageV2','999@lid'),c,{autoViewOnceChats:[chat]},{downloader:download});assert.equal(c.sent.length,1);assert.equal(c.sent[0].jid,'999@lid');
});
test('un LID sin mapeo no se inventa como teléfono ni obtiene permiso',async()=>{
 const c=socket();await api.handleAutoViewOnce(raw('imageMessage','viewOnceMessageV2','999@lid'),c,{autoViewOnceChats:['999@s.whatsapp.net']},{downloader:download});assert.equal(c.sent.length,0);assert.equal(api.inspectMessage(raw('imageMessage','viewOnceMessageV2','999@lid')).chat,'999@lid');
});
test('medios propios solo se copian mediante autorización explícita',async()=>{
 const c=socket(),message=raw();message.key.fromMe=true;
 await api.handleAutoViewOnce(message,c,{autoViewOnceChats:[chat]},{downloader:download});assert.equal(c.sent.length,0);
 await api.handleAutoViewOnce(message,c,{autoViewOnceChats:[chat],autoViewOnceOwn:true},{downloader:download});assert.equal(c.sent.length,1);
 const normal={...message,key:{...message.key,id:'normal-output'},message:{imageMessage:{}}};await api.handleAutoViewOnce(normal,c,{autoViewOnceChats:[chat],autoViewOnceOwn:true},{downloader:download});assert.equal(c.sent.length,1);
});
test('fallo no deja el ID bloqueado para la siguiente entrega',async()=>{
 const c=socket(),message=raw(),settings={autoViewOnceChats:[chat]};
 await assert.rejects(api.handleAutoViewOnce(message,c,settings,{downloader:async()=>{throw new Error('fallo controlado');}}),/fallo controlado/);
 await api.handleAutoViewOnce(message,c,settings,{downloader:download});assert.equal(c.sent.length,1);
});
test('descarga renueva referencia 404 y reintenta una vez',async()=>{
 const c=socket();let downloads=0,reuploads=0;
 c.updateMediaMessage=async message=>{reuploads++;return message;};
 const result=await api.downloadViewOnceMessage(c,raw(),{downloader:async()=>{if(!downloads++){const e=new Error('CDN 404');e.response={status:404};throw e;}return download();}});
 assert.equal(result.buffer.toString(),'delivered-content');assert.equal(downloads,2);assert.equal(reuploads,1);
});
test('fallo persistente se detiene tras dos intentos',async()=>{
 let calls=0;await assert.rejects(api.downloadViewOnceMessage(socket(),raw(),{downloader:async()=>{calls++;const e=new Error('CDN 410');e.statusCode=410;throw e;}}),/CDN 410/);assert.equal(calls,2);
});
test('vista única automática no procesa historial antiguo',async()=>{
 const c=socket(),message=raw();message.messageTimestamp=1;
 await api.handleAutoViewOnce(message,c,{autoViewOnceChats:[chat]},{downloader:download});assert.equal(c.sent.length,0);
});
test('aviso cifrado no se clasifica como medio disponible',()=>{
 const info=api.inspectMessage({key:{remoteJid:chat,id:'pending'},messageStubType:2});assert.equal(info.type,'ciphertext');assert.equal(info.encrypted,true);assert.match(info.label,/pendiente/);
});
test('monitor detecta llamadas, presencia, reacciones y cierra sin listeners duplicados',()=>{
 const c=api.installKageTools(socket()),stop=c.enableEventTracking();assert.equal(c.enableEventTracking(),stop);
 c.ev.emit('call',[{id:'call1',from:chat,status:'offer',isVideo:true}]);
 c.ev.emit('presence.update',{id:chat,presences:{[chat]:{lastKnownPresence:'composing'}}});
 c.ev.emit('messages.reaction',[{key:{id:'reaction',remoteJid:chat},reaction:{text:'👍'}}]);
 const diag=c.getMessageDiagnostics();assert.equal(diag.counts.call,1);assert.equal(diag.counts.presence,1);assert.equal(diag.counts.reaction,1);assert.equal(diag.recent[0].isVideo,true);
 stop();assert.equal(c.ev.listenerCount('call'),0);assert.equal(c.ev.listenerCount('messages.upsert'),0);assert.equal(c.getMessageDiagnostics().active,false);
});
test('diagnóstico acotado no almacena claves de medios ni texto',()=>{
 const c=api.installKageTools(socket());const stop=c.enableEventTracking();
 for(let i=0;i<120;i++){const m=raw();m.key.id='m'+i;c.ev.emit('messages.upsert',{messages:[m],type:'notify'});}
 const diag=c.getMessageDiagnostics();assert.equal(diag.recent.length,100);assert.equal(diag.messages.length,120);assert.equal(JSON.stringify(diag).includes('secret'),false);stop();
});
test('estado de historial y actualización descifrada se reindexa',async()=>{
 const c=api.installKageTools(socket());const stop=c.enableStatusTracking();
 const key={remoteJid:'status@broadcast',participant:chat,id:'status1'};const timestamp=Math.floor(Date.now()/1000);
 c.ev.emit('messaging-history.set',{messages:[{key,messageTimestamp:timestamp,message:{conversation:'publicado'}}]});
 assert.equal(c.getReceivedStatuses().length,1);
 c.ev.emit('messages.update',[{key,update:{messageTimestamp:timestamp,message:{imageMessage:{mimetype:'image/jpeg'}}}}]);
 await new Promise(r=>setImmediate(r));assert.equal(c.getReceivedStatuses()[0].type,'imageMessage');stop();
});
test('actualización de estados usa solo claves conocidas, sin consultar estados ocultos',async()=>{
 const c=socket();api.captureStatus({key:{remoteJid:'status@broadcast',participant:chat,id:'missing'},messageTimestamp:Math.floor(Date.now()/1000),message:{}},c);
 const requests=[];c.requestPlaceholderResend=async key=>requests.push(key);
 const report=await api.refreshReceivedStatuses(c);assert.equal(report.requested,1);assert.equal(requests[0].id,'missing');
 assert.equal((await api.refreshReceivedStatuses(c)).throttled,true);
});
test('caché consultada antes del login carga su archivo al conocerse la cuenta',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'status-login-'));
 try{
  const a=socket();a.statusStorageDir=dir;api.captureStatus({key:{remoteJid:'status@broadcast',participant:chat,id:'saved'},messageTimestamp:Math.floor(Date.now()/1000),message:{conversation:'persistido'}},a);
  const b={statusStorageDir:dir};assert.equal(api.listStatuses(b).length,0);b.user=a.user;assert.equal(api.listStatuses(b).length,1);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('banner admite fuentes y colores sin efectos al importar',()=>{
 const lines=[];const stream={columns:60,isTTY:false,write:text=>lines.push(text)};
 for(const font of ['simple','console','tiny','block'])api.say('kage baileys',{font,align:'center',gradient:['red','magenta'],stream});
 assert.equal(lines.length,4);assert.match(lines[0],/KAGE BAILEYS/);assert.match(lines[3],/▰/);
});
