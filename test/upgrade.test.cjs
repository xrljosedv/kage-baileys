'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const { EventEmitter } = require('node:events');
const api = require('../lib');
const logger = require('pino')({level:'silent'});
const tick = () => new Promise(resolve => setImmediate(resolve));

test('API pública disponible en CJS y ESM en un único paquete', async()=>{
 const esm=await import('../lib/index.mjs');for(const key of Object.keys(api))if(key!=='__esModule')assert.ok(key in esm,key);
 assert.equal(esm.makeWASocket,api.makeWASocket);assert.equal(fs.existsSync(path.join(__dirname,'../vendor')),false);
});

test('scoped event leases cannot flush another operation or a later generation', () => {
  const ev = api.makeEventBuffer(logger), received=[];
  ev.on('contacts.upsert', list=>received.push(...list));
  const release1 = ev.buffer(), release2 = ev.buffer();
  ev.emit('contacts.upsert', [{id:'1@s.whatsapp.net'}]);
  release1(); assert.equal(ev.isBuffering(),true); release1(); assert.equal(ev.isBuffering(),true);
  release2(); assert.equal(received.length,1);
  const old = ev.buffer(); ev.flush(true); const current=ev.buffer();
  old(); assert.equal(ev.isBuffering(),true); current(); assert.equal(ev.isBuffering(),false);
});

test('reentrant events emitted while flushing are not discarded', () => {
  const ev=api.makeEventBuffer(logger), ids=[];
  ev.on('contacts.upsert', list=>{ids.push(...list.map(x=>x.id));if(ids.length===1)ev.emit('contacts.upsert',[{id:'second'}]);});
  ev.buffer(); ev.emit('contacts.upsert',[{id:'first'}]);ev.flush();
  assert.deepEqual(ids,['first','second']);
});

function mockChats({history=true, processor=async()=>{}}={}) {
  const timers=[];
  const ev=api.makeEventBuffer(logger), ws=new EventEmitter();
  const sock={ev,ws,authState:{creds:{me:{id:'51900000000@s.whatsapp.net'},accountSettings:{}},keys:{get:async()=>({}),set:async()=>{}}},query:async()=>({tag:'iq',attrs:{},content:[]}),sendNode:async()=>{},generateMessageTag:()=> 'tag',signalRepository:{},onUnexpectedError:()=>{}};
  const filename=require.resolve('../lib/Socket/chats');const nativeRequire=createRequire(filename);
  const sandbox={exports:{},Buffer,console,setTimeout(fn,ms){const t={fn,ms,unref(){}};timers.push(t);return t},clearTimeout(){},require(name){if(name==='./usync')return {makeUSyncSocket:()=>sock};if(name==='../Utils/process-message')return {__esModule:true,default:processor};return nativeRequire(name)}};
  vm.runInNewContext(fs.readFileSync(filename,'utf8'),sandbox,{filename});
  const config={...api.DEFAULT_CONNECTION_CONFIG,logger,fireInitQueries:false,markOnlineOnConnect:false,shouldSyncHistoryMessage:()=>history,initialSyncTimeoutMs:1000};
  const chats=sandbox.exports.makeChatsSocket(config);
  return {sock,chats,ev,timers};
}

test('missing app-state key no longer creates an unmatched buffering level', () => {
  const {ev,timers}=mockChats();let received=0;ev.on('chats.upsert',()=>received++);
  ev.emit('connection.update',{receivedPendingNotifications:true});
  ev.emit('chats.upsert',[{id:'123@g.us'}]);assert.equal(received,0);
  timers.find(t=>t.ms===1000).fn();assert.equal(received,1);assert.equal(ev.isBuffering(),false);
  ev.emit('connection.update',{connection:'close'});
});

test('history disabled releases the initial lease even if keys are missing', () => {
  const {ev}=mockChats({history:false});ev.emit('connection.update',{receivedPendingNotifications:true});
  assert.equal(ev.isBuffering(),false);ev.emit('connection.update',{connection:'close'});
});

test('a stalled history download never holds live upserts or their event leases', async () => {
  let finish;const stalled=new Promise(resolve=>finish=resolve);
  const {chats,ev,timers}=mockChats({processor:msg=>msg.key.id==='history'?stalled:Promise.resolve()});
  ev.emit('connection.update',{receivedPendingNotifications:true});
  const history={key:{remoteJid:'51900000000@s.whatsapp.net',id:'history',fromMe:false},message:{protocolMessage:{historySyncNotification:{syncType:api.proto.HistorySync.HistorySyncType.RECENT}}}};
  const result=await Promise.race([chats.upsertMessage(history,'append').then(()=>true),new Promise(resolve=>setTimeout(()=>resolve(false),500))]);
  assert.equal(result,true);
  const messages=[];ev.on('messages.upsert',event=>messages.push(...event.messages));
  timers.find(t=>t.ms===1000).fn();
  await chats.upsertMessage({key:{remoteJid:'51900000001@s.whatsapp.net',id:'live'},message:{conversation:'ping'}},'notify');
  assert.ok(messages.some(m=>m.key.id==='live'));assert.equal(ev.isBuffering(),false);
  finish();await tick();ev.emit('connection.update',{connection:'close'});
});

test('complete socket exposes supplemental methods and closes safely during handshake', async () => {
  const socket=api.makeWASocket({auth:{creds:api.initAuthCreds(),keys:{get:async()=>({}),set:async()=>{}}},logger,waWebSocketUrl:'wss://127.0.0.1:1',connectTimeoutMs:1000,fireInitQueries:false,kageTools:{banner:false}});
  for (const group of require('../maintenance/extension-inventory.json')) for (const key of group.methods) assert.ok(key in socket,key);
  assert.equal(typeof socket.communityCreate,'function');
  socket.end(new Error('local test complete'));
  await new Promise(resolve=>setTimeout(resolve,30));
});

test('supplemental quick replies use the supplied converter and existing appPatch', async () => {
  const calls=[];
  const base={authState:{creds:{}},ev:api.makeEventBuffer(logger),ws:new EventEmitter(),appPatch:async patch=>calls.push(patch),query:async()=>{},chatModify:()=>{throw new Error('older converter must not be called')}};
  const extra=require('../lib/Extensions/chats').attach(base,{...api.DEFAULT_CONNECTION_CONFIG,logger});
  await extra.addOrEditQuickReply({shortcut:'hola',message:'Hola',timestamp:'123'});
  await extra.removeQuickReply('123');
  assert.equal(calls.length,2);assert.equal(calls[0].syncAction.quickReplyAction.shortcut,'hola');assert.equal(calls[1].syncAction.quickReplyAction.deleted,true);
});

test('supplemental business and community methods use the same query transport', async () => {
  const calls=[];const base={authState:{creds:{}},query:async node=>{calls.push(node);return {tag:'iq',attrs:{},content:[]}},waUploadToServer:async()=>{},ev:new EventEmitter()};
  const business=require('../lib/Extensions/business').attach(base,{});
  await business.updateBussinesProfile({description:'Prueba'});await business.removeCoverPhoto();
  const community=require('../lib/Extensions/community').attach(base,{});await community.communityQuery('123@g.us','get',[]);
  assert.equal(calls.length,3);assert.equal(calls[0].attrs.xmlns,'w:biz');assert.equal(calls[2].attrs.xmlns,'w:g2');
});

test('banner includes requested creator and partner without ANSI in a non-TTY stream', () => {
  const output=[];api.showKageBanner({stream:{columns:60,isTTY:false,write:text=>output.push(text)}});
  const text=output.join('');assert.match(text,/Creado por xrljosedv/);assert.match(text,/Socio David Zuniga/);assert.ok(!text.includes('\x1b['));
});
