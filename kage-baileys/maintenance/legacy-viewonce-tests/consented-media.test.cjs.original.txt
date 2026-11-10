'use strict';
const test=require('node:test'); const assert=require('node:assert/strict');
const {Readable}=require('node:stream'); const api=require('../lib');
const make = (type='imageMessage', wrapper='viewOnceMessageV2') => ({key:{id:'m',remoteJid:'51987654321@s.whatsapp.net',fromMe:false},messageTimestamp:Math.floor(Date.now()/1000),message:{[wrapper]:{message:{[type]:{viewOnce:true,mimetype:'application/octet-stream'}}}}});
const conn=()=>({user:{id:'34612345678:2@s.whatsapp.net'}});
for(const type of ['imageMessage','videoMessage','audioMessage','documentMessage','stickerMessage']) {
 for(const wrapper of ['viewOnceMessage','viewOnceMessageV2','viewOnceMessageV2Extension']) test(`consented ${wrapper} ${type}`,async()=>{
  const raw=make(type,wrapper);
  const result=await api.downloadConsentedViewOnce(conn(),raw,{consentJid:raw.key.remoteJid,downloader:async()=>Readable.from([Buffer.from('authorized')])});
  assert.equal(result.buffer.toString(),'authorized'); assert.equal(result.type,type);
  assert.equal(raw.message[wrapper].message[type].viewOnce,true);
 });
}
test('view once rejects missing or wrong sender authorization before download',async()=>{
 const raw=make();
 for(const opts of [{},{consentJid:'other@s.whatsapp.net'}]) await assert.rejects(api.downloadConsentedViewOnce(conn(),raw,opts),/SENDER_CONSENT_REQUIRED/);
});
test('view once rejects group and status routes',()=>{
 for(const jid of ['123@g.us','status@broadcast','123@broadcast']){const raw=make();raw.key.remoteJid=jid;assert.throws(()=>api.prepareConsentedViewOnce(conn(),raw,{consentJid:'51987654321@s.whatsapp.net'}),/CONSENT_PRIVATE_ONLY/);}
});
test('own outgoing view once can be explicitly authorized by account identity',async()=>{
 const raw=make();raw.key.fromMe=true;
 const result=await api.downloadConsentedViewOnce(conn(),raw,{consentJid:'34612345678@s.whatsapp.net',downloader:async()=>Readable.from([Buffer.from('own')])});
 assert.equal(result.buffer.toString(),'own');
});
test('consented view once does not invent content for consumed notifications',()=>{
 const raw=make();raw.message={viewOnceMessageV2:{message:{}}};
 assert.throws(()=>api.prepareConsentedViewOnce(conn(),raw,{consentJid:raw.key.remoteJid}),/VIEW_ONCE_UNAVAILABLE/);
});
test('auto view once is off without explicit chat consent and ignores historical data',async()=>{
 const raw=make();assert.equal(await api.handleAutoViewOnce(raw,conn(),{}),null);
 raw.messageTimestamp=1;assert.equal(await api.handleAutoViewOnce(raw,conn(),{autoViewOnceConsent:{[raw.key.remoteJid]:raw.key.remoteJid}}),null);
});
