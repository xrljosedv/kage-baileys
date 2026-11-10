'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { Readable } = require('node:stream');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const api = require('../lib');
const countries = require('../lib/Utils/countries.json');
const examples = require('libphonenumber-js/examples.mobile.json');
const raw = (id = 'S1', author = '51987654321@s.whatsapp.net', message = { conversation: 'Hola' }) => ({ key: { remoteJid: 'status@broadcast', participant: author, id, fromMe: false }, messageTimestamp: Math.floor(Date.now()/1000), message });
const socket = () => ({ user: { id: '34612345678:2@s.whatsapp.net' }, statusStorageDir: false, sendMessage: async () => ({}), readMessages: async () => {}, ev: new EventEmitter() });
for (const code of ['PE','MX','ES','AR','CO','CL','EC','BO','BR','US','CA','GB','FR','DE','IT','JP','KR','AU','NZ','IN','ZA','EG','MA','UY','PY','VE','CR','PA','DO','GT']) test(`offline country lookup ${code}`, () => {
  const info = api.getCountryInfo(require('libphonenumber-js').getExampleNumber(code, examples).number);
  assert.ok(info, code); assert.equal(info.code, code); assert.equal(info.name, countries[code].name);
  assert.match(info.callingCode, /^\+\d+$/); assert.equal(info.flag, countries[code].flag); assert.equal(info.source, 'offline-phone-prefix');
});
for (const input of ['123456@lid','123@g.us','status@broadcast','foo','',null,{},'+9999999999999999999','123','123:2@lid']) test(`country input rejection ${JSON.stringify(input)}`, () => assert.equal(api.getCountryInfo(input), null));
test('LID mapping uses explicit mapped phone only', async () => {
  assert.equal(await api.getCountryForJid({}, '123456@lid'), null);
  const conn = { signalRepository: { lidMapping: { getPNForLID: async () => '51987654321@s.whatsapp.net' } } };
  assert.equal((await api.getCountryForJid(conn, '123456@lid')).code, 'PE');
});
test('country responses do not leak mutable dataset references', () => {
  const a = api.getCountryInfo('+51987654321'); a.capitals.length = 0;
  assert.deepEqual(api.getCountryInfo('+51987654321').capitals, ['Lima']);
});
for (const type of ['imageMessage','videoMessage','audioMessage','documentMessage','stickerMessage']) {
  for (const wrapper of ['none','ephemeralMessage','documentWithCaptionMessage']) test(`normal media ${type} / ${wrapper}`, async () => {
    const message = { [type]: { mimetype: 'application/octet-stream', fileLength: 3 } };
    const r = { key: { id: type, remoteJid: '1@s.whatsapp.net' }, message: wrapper === 'none' ? message : { [wrapper]: { message } } };
    const downloaded = await api.downloadNormalMedia(socket(), r, { downloader: async () => Readable.from([Buffer.from('abc')]) });
    assert.equal(downloaded.buffer.toString(), 'abc'); assert.equal(downloaded.type, type);
  });
  for (const wrapper of ['viewOnceMessage','viewOnceMessageV2','viewOnceMessageV2Extension']) test(`view-once not archived ${type} / ${wrapper}`, () => {
    assert.throws(() => api.unwrapNormalMedia({ message: { [wrapper]: { message: { [type]: {} } } } }), /VIEW_ONCE/);
  });
}
test('normal media size limit checks actual stream bytes', async () => {
  await assert.rejects(api.downloadNormalMedia(socket(), { key: { id:'a' }, message: { imageMessage: {} } }, { maxBytes: 3, downloader: async () => Readable.from([Buffer.from('abcd')]) }), /MEDIA_TOO_LARGE/);
});
test('declared oversized media is rejected before download', async () => {
  await assert.rejects(api.downloadNormalMedia(socket(), { key: { id:'a' }, message: { imageMessage: { fileLength: 10 } } }, { maxBytes: 3, downloader: async () => { throw new Error('must not run'); } }), /MEDIA_TOO_LARGE/);
});
test('empty media reports an explicit error', async () => {
  await assert.rejects(api.downloadNormalMedia(socket(), { key: { id:'a' }, message: { imageMessage: {} } }, { downloader: async () => Readable.from([]) }), /EMPTY_MEDIA/);
});
test('download deadline destroys a late stream', async () => {
  let stream;
  await assert.rejects(api.downloadNormalMedia(socket(), { key: { id:'a' }, message: { imageMessage: {} } }, { timeoutMs: 100, downloader: async () => { await new Promise(r => setTimeout(r, 150)); stream = Readable.from([Buffer.from('abc')]); return stream; } }), /MEDIA_TIMEOUT/);
  await new Promise(r => setTimeout(r, 80)); assert.equal(stream.destroyed, true);
});
test('saved files have deterministic safe names and restrictive permissions', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'kage-media-'));
  try {
    const result = await api.saveNormalMedia(socket(), { key: { id: '../../bad', remoteJid: '1@s.whatsapp.net' }, message: { imageMessage: { mimetype: 'image/jpeg' } } }, { directory: dir, downloader: async () => Readable.from([Buffer.from('abc')]) });
    assert.equal(path.dirname(result.file), dir); assert.equal(fs.statSync(result.file).mode & 0o777, 0o600); assert.equal(fs.readFileSync(result.file,'utf8'), 'abc');
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
test('autodownload requires allowlist and ignores historical messages', async () => {
  const r = raw(); r.key.remoteJid = '123@s.whatsapp.net'; r.message = { imageMessage: {} };
  assert.equal(await api.handleAutoMedia(r, socket(), {}), null);
  r.messageTimestamp = 1; assert.equal(await api.handleAutoMedia(r, socket(), { autoDownloadChats: [r.key.remoteJid] }), null);
});
test('status survives a new socket with matching account, binary data intact', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'kage-status-'));
  try {
    const a = socket(); a.statusStorageDir = dir;
    const first = api.captureStatus(raw('a', undefined, { imageMessage: { mediaKey: Buffer.from([1,2,3]) } }), a);
    const b = socket(); b.statusStorageDir = dir;
    const restored = api.findStatus(b, first.id);
    assert.equal(restored.sourceKey.id, 'a'); assert.deepEqual(restored.value.mediaKey, Buffer.from([1,2,3]));
    assert.equal(fs.statSync(path.join(dir,fs.readdirSync(dir)[0])).mode & 0o777, 0o600);
    b.user.id = 'another';
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
test('duplicate status retains stable ID', () => {
  const c = socket(); assert.equal(api.captureStatus(raw(),c).id, api.captureStatus(raw(),c).id); assert.equal(api.listStatuses(c).length, 1);
});
test('revoke keeps only metadata tombstone and never restores deleted content', () => {
  const c = socket(); const r = raw(); const entry = api.captureStatus(r,c);
  api.captureStatus(raw('del', undefined, { protocolMessage: { type: 0, key: r.key } }), c);
  assert.equal(api.listStatuses(c).length,0); const gone = api.findStatus(c,entry.id);
  assert.equal(gone.availability,'deleted'); assert.equal(gone.raw,null); assert.equal(gone.text,'');
  assert.equal(api.captureStatus(r,c),null);
});
test('deletion is scoped by author and broadcast route', () => {
  const c = socket(); const a = api.captureStatus(raw('same'),c); const b = api.captureStatus(raw('same','5215512345678@s.whatsapp.net'),c);
  assert.equal(api.markStatusDeleted(c,{ id:'same',remoteJid:'123@g.us' }),0);
  assert.equal(api.markStatusDeleted(c,a.sourceKey),1); assert.equal(b.availability,'received');
});
test('expired status drops content and stays in short metadata history', () => {
  const c = socket(); const entry = api.captureStatus(raw(),c); entry.expiresAt = Date.now()-1;
  assert.equal(api.listStatuses(c).length,0); assert.equal(api.findStatus(c,entry.id).availability,'expired'); assert.equal(entry.raw,null);
});
test('status cache bounded to 500 entries', () => {
  const c = socket(); for (let i=0;i<510;i++) api.captureStatus(raw('id-'+i),c);
  assert.equal(api.listStatuses(c).length,500); assert.equal(api.clearStatuses(c),500);
});
test('socket bindings install and detach status listeners without duplicates', async () => {
  const c = socket(); api.installKageTools(c); api.installKageTools(c);
  const stop = c.enableStatusTracking(); assert.equal(c.enableStatusTracking(),stop); assert.equal(c.ev.listenerCount('messages.upsert'),1);
  c.ev.emit('messages.upsert',{messages:[raw()]}); await new Promise(r=>setImmediate(r)); assert.equal(c.getReceivedStatuses().length,1);
  stop(); assert.equal(c.ev.listenerCount('messages.upsert'),0); assert.equal(c.ev.listenerCount('messages.update'),0);
});
test('AI disclosure is honest text, presence always resets after failure', async () => {
  const c = socket(); const presence=[]; let body; c.sendPresenceUpdate=async p=>presence.push(p); c.sendMessage=async (_,b)=>{body=b;};
  await api.sendAIResponse(c,'1@s.whatsapp.net','Hola'); assert.match(body.text,/generado por IA/); assert.equal(body.messageContextInfo,undefined); assert.deepEqual(presence,['composing','paused']);
  c.sendMessage=async()=>{throw new Error('network');}; await assert.rejects(api.sendAIResponse(c,'1@s.whatsapp.net','Hola'),/network/); assert.equal(presence.at(-1),'paused');
});
test('rich AI envelopes serialize locally without claiming server authentication', () => {
  const secret=Buffer.alloc(32,7);
  const json = { messageContextInfo:{messageSecret:secret.toString('base64'),botMetadata:{messageDisclaimerText:'AI'}},botForwardedMessage:{message:{richResponseMessage:{messageType:'AI_RICH_RESPONSE_TYPE_STANDARD',submessages:[{messageType:'AI_RICH_RESPONSE_TEXT',messageText:'Thinking'}],unifiedResponse:{data:Buffer.from('{}').toString('base64')}}}} };
  const msg=api.generateWAMessageFromContent('1@s.whatsapp.net',json,{userJid:'2@s.whatsapp.net'});
  const result=api.proto.Message.decode(api.proto.Message.encode(msg.message).finish());
  assert.deepEqual(Buffer.from(result.messageContextInfo.messageSecret),secret); assert.equal(result.botForwardedMessage.message.richResponseMessage.submessages[0].messageText,'Thinking');
});
test('browser presets support documented calls and missing browser', () => {
  for (const name of ['macOS','windows','ubuntu','appropriate']) assert.equal(api.Browsers[name]('Chrome').length,3);
  assert.equal(api.Browsers().length,3); assert.doesNotThrow(()=>api.getPlatformId());
});

test('detaching status tracking never overwrites persisted activation setting', () => {
  const c = socket(); api.installKageTools(c); const settings = { statusReaction: true };
  const stop = c.enableStatusTracking(settings); stop(); stop();
  assert.equal(settings.statusReaction, true); assert.equal(c.ev.listenerCount('messages.upsert'),0);
});
