'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { unzipSync, strFromU8 } = require('fflate');
const api = require('../lib');
const chat = '51987654321@s.whatsapp.net';
const now = () => Math.floor(Date.now() / 1000);
const raw = (type = 'imageMessage') => ({ key: { id: 'test', remoteJid: chat, fromMe: false }, messageTimestamp: now(), message: { ephemeralMessage: { message: { viewOnceMessageV2Extension: { message: { [type]: { viewOnce: true, mimetype: 'application/octet-stream', caption: 'Original', ptt: true, gifPlayback: true } } } } } } });
const download = async () => Readable.from([Buffer.from('original-bytes')]);
const socket = () => ({ user: {id:'34612345678@s.whatsapp.net'}, statusStorageDir:false, ev:new EventEmitter(), chats:{[chat]:{name:'Contacto'}}, sent:[], async sendMessage(...args) { this.sent.push(args); return {ok:true}; } });
for (const [type, field] of Object.entries({imageMessage:'image',videoMessage:'video',audioMessage:'audio',documentMessage:'document',stickerMessage:'sticker'})) {
 test('privacy prevents unwrapping and preserves original wrappers for ' + type, async()=>{
  const EventEmitter=require('node:events').EventEmitter;
  const typeName=typeof type==='string'?type:'imageMessage';
  const wrapName=typeof wrapper==='string'?wrapper:'viewOnceMessageV2';
  const raw={key:{id:'policy',remoteJid:'test@s.whatsapp.net'},message:{[wrapName]:{message:{[typeName]:{viewOnce:true}}}}};
  let downloads=0,sends=0,events=0;
  const socket={ev:new EventEmitter(),sendMessage:async()=>{sends++;}};
  socket.ev.on('kage.viewonce.detected',()=>events++);
  const options={consentJid:'test@s.whatsapp.net',downloader:async()=>{downloads++;throw new Error('must not download');}};
  await assert.rejects(api.downloadViewOnceMessage(socket,raw,options),/VIEW_ONCE_PROTECTED/);
  await assert.rejects(api.resendViewOnceMessage(socket,raw,options),/VIEW_ONCE_PROTECTED/);
  await assert.rejects(api.downloadConsentedViewOnce(socket,raw,options),/VIEW_ONCE_PROTECTED/);
  await api.handleAutoViewOnce(raw,socket,{autoViewOnceChats:['test@s.whatsapp.net']},options);
  await api.handleAutoViewOnce(raw,socket,{},options);
  assert.equal(downloads,0);assert.equal(sends,0);assert.equal(events,1);
 });
}
test('repair central automation has bounded deduplication and ignores own messages',async()=>{
  const EventEmitter=require('node:events').EventEmitter;
  const typeName=typeof type==='string'?type:'imageMessage';
  const wrapName=typeof wrapper==='string'?wrapper:'viewOnceMessageV2';
  const raw={key:{id:'policy',remoteJid:'test@s.whatsapp.net'},message:{[wrapName]:{message:{[typeName]:{viewOnce:true}}}}};
  let downloads=0,sends=0,events=0;
  const socket={ev:new EventEmitter(),sendMessage:async()=>{sends++;}};
  socket.ev.on('kage.viewonce.detected',()=>events++);
  const options={consentJid:'test@s.whatsapp.net',downloader:async()=>{downloads++;throw new Error('must not download');}};
  await assert.rejects(api.downloadViewOnceMessage(socket,raw,options),/VIEW_ONCE_PROTECTED/);
  await assert.rejects(api.resendViewOnceMessage(socket,raw,options),/VIEW_ONCE_PROTECTED/);
  await assert.rejects(api.downloadConsentedViewOnce(socket,raw,options),/VIEW_ONCE_PROTECTED/);
  await api.handleAutoViewOnce(raw,socket,{autoViewOnceChats:['test@s.whatsapp.net']},options);
  await api.handleAutoViewOnce(raw,socket,{},options);
  assert.equal(downloads,0);assert.equal(sends,0);assert.equal(events,1);
 });
test('repair disabling automation while download runs prevents the send',async()=>{
  const EventEmitter=require('node:events').EventEmitter;
  const typeName=typeof type==='string'?type:'imageMessage';
  const wrapName=typeof wrapper==='string'?wrapper:'viewOnceMessageV2';
  const raw={key:{id:'policy',remoteJid:'test@s.whatsapp.net'},message:{[wrapName]:{message:{[typeName]:{viewOnce:true}}}}};
  let downloads=0,sends=0,events=0;
  const socket={ev:new EventEmitter(),sendMessage:async()=>{sends++;}};
  socket.ev.on('kage.viewonce.detected',()=>events++);
  const options={consentJid:'test@s.whatsapp.net',downloader:async()=>{downloads++;throw new Error('must not download');}};
  await assert.rejects(api.downloadViewOnceMessage(socket,raw,options),/VIEW_ONCE_PROTECTED/);
  await assert.rejects(api.resendViewOnceMessage(socket,raw,options),/VIEW_ONCE_PROTECTED/);
  await assert.rejects(api.downloadConsentedViewOnce(socket,raw,options),/VIEW_ONCE_PROTECTED/);
  await api.handleAutoViewOnce(raw,socket,{autoViewOnceChats:['test@s.whatsapp.net']},options);
  await api.handleAutoViewOnce(raw,socket,{},options);
  assert.equal(downloads,0);assert.equal(sends,0);assert.equal(events,1);
 });
test('repair public API and socket API expose all documented helpers',()=>{
 const conn=api.installKageTools(socket());
 for(const name of ['getViewOnceContent','normalizeViewOnceMessage','downloadViewOnceMessage','resendViewOnceMessage','handleAutoViewOnce','enableMediaAutomation','saveReceivedStatus','exportReceivedStatuses']) assert.equal(typeof conn[name],'function',name);
 assert.equal(typeof api.exportStatusZip,'function');
});
test('repair media listeners detach and do not duplicate',()=>{
 const conn=api.installKageTools(socket());const stop=conn.enableMediaAutomation({});
 assert.equal(conn.enableMediaAutomation({}),stop);assert.equal(conn.ev.listenerCount('messages.upsert'),1);
 conn.ev.emit('connection.update',{connection:'close'});assert.equal(conn.ev.listenerCount('messages.upsert'),0);
});
function status(conn, id='status', message={conversation:'Texto original'}) {
 return api.captureStatus({key:{id,remoteJid:'status@broadcast',participant:chat},messageTimestamp:now(),message},conn);
}
test('repair status ZIP preserves text, background colors and metadata',async()=>{
 const conn=socket();status(conn,'color',{extendedTextMessage:{text:'Hola',backgroundArgb:4289374890,textArgb:4294967295}});
 const result=await api.exportStatusZip(conn,chat);const entries=unzipSync(result.buffer);
 assert.equal(result.count,1);assert.equal(strFromU8(entries['E1.txt']),'Hola');
 const info=JSON.parse(strFromU8(entries['informacion.json']));assert.equal(info.states[0].backgroundArgb,4289374890);
});
test('repair status ZIP rejects contacts not saved and synchronized',async()=>{
 const conn=socket();conn.chats={};status(conn);await assert.rejects(api.exportStatusZip(conn,chat),/STATUS_CONTACT_REQUIRED/);
});
test('repair status ZIP records download failures rather than inventing content',async()=>{
 const conn=socket();status(conn,'media',{imageMessage:{mimetype:'image/jpeg'}});
 const result=await api.exportStatusZip(conn,chat,{downloader:async()=>{throw new Error('not delivered');}});
 const info=JSON.parse(strFromU8(unzipSync(result.buffer)['informacion.json']));
 assert.equal(result.count,0);assert.equal(info.omitted.length,1);assert.match(info.omitted[0].reason,/not delivered/);
});
test('repair status archive writes restricted files and sends only once',async()=>{
 const conn=socket(), dir=fs.mkdtempSync(path.join(os.tmpdir(),'kage-repair-')), entry=status(conn);
 const settings={statusSave:true,statusContactsOnly:true,statusDestination:'34612345678@s.whatsapp.net'};
 try {
  await api.handleStatusArchive(conn,entry,settings,{directory:dir});await api.handleStatusArchive(conn,entry,settings,{directory:dir});
  assert.equal(conn.sent.length,2);assert.equal(conn.sent[0][1].text,'Texto original');
  assert.equal(fs.statSync(entry.archive.file).mode & 0o777,0o600);
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
test('repair status handler integrates saving independently of reactions',async()=>{
 const conn=socket(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'kage-save-'));
 try {
  const message={key:{id:'save',remoteJid:'status@broadcast',participant:chat},messageTimestamp:now(),message:{conversation:'Guardado'}};
  await api.handleStatus(message,conn,{statusSave:true,statusReaction:false,statusDestination:'34612345678@s.whatsapp.net',archiveOptions:{directory:dir}});
  assert.equal(conn.sent[0][1].text,'Guardado');assert.ok(api.listStatuses(conn)[0].archiveDeliveredAt);
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
test('repair status saving refuses automatic delivery to groups',async()=>{
 const conn=socket(),entry=status(conn);assert.equal(await api.handleStatusArchive(conn,entry,{statusSave:true,statusDestination:'123@g.us'}),null);assert.equal(conn.sent.length,0);
});
