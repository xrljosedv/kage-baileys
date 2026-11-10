'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const api = require('../lib');
const raw = id => ({ key: { remoteJid: 'status@broadcast', participant: '51987654321@s.whatsapp.net', id }, messageTimestamp: Math.floor(Date.now()/1000), message: { conversation: 'estado' } });
const socket = () => ({ user: { id: '34612345678@s.whatsapp.net' }, statusStorageDir: false, ev: new EventEmitter(), sent: [], async sendMessage(...args) { this.sent.push(args); } });
test('Baileys has no application-level status reaction exports or socket method', () => {
  for (const name of ['reactToStatus', 'waitStatusReactions', 'isStatusEmoji']) assert.equal(api[name], undefined);
  const conn = api.installKageTools(socket());
  assert.equal(conn.reactToReceivedStatus, undefined);
});
test('statusReaction settings never send reactions from Baileys', async () => {
  const conn = socket();
  await api.handleStatus(raw('A'), conn, { statusReaction: true, statusEmoji: '🔥' });
  await api.handleStatus(raw('A'), conn, { statusReaction: true });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(conn.sent.length, 0);
  assert.equal(api.listStatuses(conn).length, 1);
});
test('optional status tracking only records received statuses', async () => {
  const conn = api.installKageTools(socket());
  const stop = conn.enableStatusTracking({ statusReaction: true });
  conn.ev.emit('messages.upsert', { type: 'notify', messages: [raw('B')] });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(conn.sent.length, 0);
  assert.equal(conn.getReceivedStatuses().length, 1);
  stop();
  assert.equal(conn.ev.listenerCount('messages.upsert'), 0);
});
test('official status reaction schema survives encoding and decoding', () => {
  const source = { reactionMessage: { key: { remoteJid: 'status@broadcast', participant: '51987654321@s.whatsapp.net', id: 'ORIGINAL', fromMe: false }, text: '❤️', senderTimestampMs: '1770000000000' } };
  const message = api.proto.Message.fromObject(source);
  assert.equal(api.proto.Message.verify(message), null);
  const decoded = api.proto.Message.decode(api.proto.Message.encode(message).finish());
  assert.equal(decoded.reactionMessage.text, '❤️');
  assert.equal(decoded.reactionMessage.key.id, 'ORIGINAL');
  assert.equal(decoded.reactionMessage.key.remoteJid, 'status@broadcast');
  assert.equal(api.proto.MessageAssociation.AssociationType.STATUS_REACTION, 18);
});
