'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { EventEmitter } = require('node:events');
const { deflateSync } = require('node:zlib');
const api = require('../lib');
const history = require('../lib/Utils/history');
const { historyPayloadKind } = require('../lib/Utils/history-validation');
const logger = require('pino')({ level: 'silent' });

test('invalid histories are skipped before media-key derivation', async () => {
 for (const notification of [null, {}, { mediaKey: Buffer.alloc(0), directPath: '/path' }, { mediaKey: Buffer.alloc(31), directPath: '/path' }]) {
  const result = await history.downloadAndProcessHistorySyncNotification(notification, {});
  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'HISTORY_NOTIFICATION_INVALID');
  assert.deepEqual(result.messages, []);
 }
});
test('direct invalid history downloads return an explicit validation error', async () => {
 await assert.rejects(history.downloadHistory({}, {}), { code: 'HISTORY_NOTIFICATION_INVALID' });
});
test('inline histories decode without a media key or a network request', async () => {
 const type = api.proto.HistorySync.HistorySyncType.PUSH_NAME;
 const encoded = api.proto.HistorySync.encode({ syncType: type, pushnames: [{ id: '1@s.whatsapp.net', pushname: 'Inline' }] }).finish();
 const payload = { syncType: type, initialHistBootstrapInlinePayload: deflateSync(encoded) };
 const result = await history.downloadAndProcessHistorySyncNotification(payload, {});
 assert.equal(result.contacts[0].notify, 'Inline');
 assert.equal(historyPayloadKind(payload), 'inline');
});
test('history validation accepts real 32-byte download keys only', () => {
 assert.equal(historyPayloadKind({ mediaKey: Buffer.alloc(32), directPath: '/file' }), 'download');
 assert.equal(historyPayloadKind({ mediaKey: Buffer.alloc(32).toString('base64'), url: 'https://example.invalid/file' }), 'download');
 assert.equal(historyPayloadKind({ mediaKey: Buffer.alloc(32), url: 'file:///etc/passwd' }), null);
 assert.equal(historyPayloadKind({ mediaKey: 'bad!', directPath: '/file' }), null);
});
test('corrupt inline history is not marked successfully processed', async () => {
 const processMessage = require('../lib/Utils/process-message').default;
 const events = [];
 const notification = { syncType: api.proto.HistorySync.HistorySyncType.RECENT, initialHistBootstrapInlinePayload: Buffer.from('not deflate') };
 const raw = { key: { id: 'h', remoteJid: '1@s.whatsapp.net' }, message: { protocolMessage: { type: api.proto.Message.ProtocolMessage.Type.HISTORY_SYNC_NOTIFICATION, historySyncNotification: notification } } };
 await assert.rejects(processMessage(raw, { shouldProcessHistoryMsg: true, ev: { emit: (...args) => events.push(args) }, creds: { me: { id: '1@s.whatsapp.net' }, accountSettings: {} }, logger, options: {}, keyStore: {} }));
 assert.equal(events.some(([name]) => name === 'creds.update'), false);
});
test('invalid history notifications do not emit a successful-history event', async () => {
 const processMessage = require('../lib/Utils/process-message').default;
 const events = [];
 const raw = { key: { id: 'h', remoteJid: '1@s.whatsapp.net' }, message: { protocolMessage: { type: api.proto.Message.ProtocolMessage.Type.HISTORY_SYNC_NOTIFICATION, historySyncNotification: {} } } };
 await processMessage(raw, { shouldProcessHistoryMsg: true, ev: { emit: (...args) => events.push(args) }, creds: { me: { id: '1@s.whatsapp.net' }, accountSettings: {} }, logger, options: {}, keyStore: {} });
 assert.equal(events.some(([name]) => name === 'messaging-history.set' || name === 'creds.update'), false);
});
test('scoped cipher keeps the original verification and does not change global console', async () => {
 const original = console.error;
 const { ScopedSessionCipher } = require('../lib/Signal/session-cipher');
 const libsignal = require('libsignal');
 const cipher = new ScopedSessionCipher({}, new libsignal.ProtocolAddress('1', 1));
 assert.equal(cipher.doDecryptWhisperMessage, libsignal.SessionCipher.prototype.doDecryptWhisperMessage);
 cipher.doDecryptWhisperMessage = async () => { throw new Error('Bad MAC'); };
 await assert.rejects(cipher.decryptWithSessions(Buffer.from('bad'), [{ indexInfo: {} }]), error => error instanceof libsignal.SessionError && error.code === 'WA_SESSION_RETRY' && error.cause.message === 'Bad MAC');
 assert.equal(console.error, original);
 await assert.rejects(cipher.decryptWithSessions(Buffer.alloc(0), []), /No sessions available/);
});
test('scoped cipher selects the first valid session and updates usage', async () => {
 const { ScopedSessionCipher } = require('../lib/Signal/session-cipher');
 const libsignal = require('libsignal');
 const cipher = new ScopedSessionCipher({}, new libsignal.ProtocolAddress('1', 1));
 const sessions = [{ indexInfo: {}, valid: false }, { indexInfo: {}, valid: true }];
 cipher.doDecryptWhisperMessage = async (_, session) => { if (!session.valid) throw new Error('Bad MAC'); return Buffer.from('valid'); };
 const result = await cipher.decryptWithSessions(Buffer.alloc(0), sessions);
 assert.equal(result.session, sessions[1]);
 assert.equal(result.plaintext.toString(), 'valid');
 assert.ok(sessions[1].indexInfo.used > 0);
});
function mockReceiver(max = 2) {
 const sent = [], counters = new Map();
 const ev = new EventEmitter(), ws = new EventEmitter();
 const creds = { me: { id: '1@s.whatsapp.net' }, account: {}, signedPreKey: {}, signedIdentityKey: { public: Buffer.alloc(32) }, registrationId: 1 };
 const sock = { ev, ws, authState: { creds, keys: { transaction: fn => fn() } }, sendNode: async node => sent.push(node), onUnexpectedError: error => { throw error; } };
 const filename = require.resolve('../lib/Socket/messages-recv');
 const nativeRequire = createRequire(filename);
 const utilities = require('../lib/Utils');
 const sandbox = { exports: {}, Buffer, console, setTimeout, clearTimeout, require(name) {
  if (name === './messages-send') return { makeMessagesSocket: () => sock };
  if (name === '../Utils') return { ...utilities, decodeMessageNode: node => ({ fullMessage: { key: { remoteJid: node.attrs.from, participant: node.attrs.participant, id: node.attrs.id } } }), encodeSignedDeviceIdentity: () => Buffer.alloc(0), getNextPreKeys: async () => ({ update: {}, preKeys: { 1: { public: Buffer.alloc(32) } } }), xmppPreKey: () => ({ tag: 'key', attrs: {} }), xmppSignedPreKey: () => ({ tag: 'skey', attrs: {} }) };
  return nativeRequire(name);
 } };
 vm.runInNewContext(fs.readFileSync(filename, 'utf8'), sandbox, { filename });
 const cache = { get: key => counters.get(key), set: (key, value) => counters.set(key, value), del: key => counters.delete(key) };
 const receiver = sandbox.exports.makeMessagesRecvSocket({ logger, maxMsgRetryCount: max, msgRetryCounterCache: cache, getMessage: async () => undefined, placeholderResendCache: { get: () => true } });
 return { receiver, sent, counters };
}
test('retry exhaustion retains its tombstone instead of starting a new loop', async () => {
 const { receiver, sent, counters } = mockReceiver(2);
 const node = { tag: 'message', attrs: { from: '2@s.whatsapp.net', participant: '2:1@s.whatsapp.net', id: 'SAME', t: '1' }, content: [] };
 for (let i = 0; i < 10; i++) await receiver.sendRetryRequest(node);
 assert.equal(sent.filter(node => node.tag === 'receipt').length, 2);
 assert.equal([...counters.values()][0], 2);
});
test('identical message IDs in different chats have independent retry limits', async () => {
 const { receiver, sent, counters } = mockReceiver(1);
 for (const from of ['2@s.whatsapp.net', '3@s.whatsapp.net']) {
  const node = { tag: 'message', attrs: { from, id: 'SAME', t: '1' }, content: [] };
  await receiver.sendRetryRequest(node);
  await receiver.sendRetryRequest(node);
 }
 assert.equal(sent.filter(node => node.tag === 'receipt').length, 2);
 assert.equal(counters.size, 2);
});
test('auth writes are durable, bounded by operation, and flushable', async () => {
 const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'chiaki-auth-'));
 try {
  const auth = await api.useMultiFileAuthState(directory);
  await Promise.all(Array.from({ length: 20 }, (_, i) => auth.state.keys.set({ session: { user: Buffer.from(String(i)) } })));
  await auth.saveCreds();
  await auth.flush();
  assert.equal((await auth.state.keys.get('session', ['user'])).user.toString(), '19');
  assert.ok(fs.readdirSync(directory).every(file => !file.endsWith('.tmp')));
  assert.equal(fs.statSync(path.join(directory, 'creds.json')).mode & 0o777, 0o600);
  const reloaded = await api.useMultiFileAuthState(directory);
  assert.deepEqual(reloaded.state.creds.signedIdentityKey.private, auth.state.creds.signedIdentityKey.private);
 } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
test('corrupt Signal keys are surfaced rather than erased or silently regenerated', async () => {
 const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'chiaki-auth-'));
 try {
  const auth = await api.useMultiFileAuthState(directory);
  fs.writeFileSync(path.join(directory, 'session-user.json'), '{broken');
  await assert.rejects(auth.state.keys.get('session', ['user']), { code: 'AUTH_STATE_CORRUPT' });
  assert.equal(fs.readFileSync(path.join(directory, 'session-user.json'), 'utf8'), '{broken');
 } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
