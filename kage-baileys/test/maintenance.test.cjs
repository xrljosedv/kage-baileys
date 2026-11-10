'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { EventEmitter } = require('events');
const { proto } = require('../WAProto');
const { prepareEventMessage, normalizeEventMessage } = require('../lib/Utils/event-message');
const { processHistoryMessage } = require('../lib/Utils/history');
const { generateWAMessageContent } = require('../lib/Utils/messages');
const { useMultiFileAuthState } = require('../lib/Utils/use-multi-file-auth-state');
const makeStore = require('../lib/Store/make-in-memory-store').default;
const log = require('pino')({ level: 'silent' });
const historyType = proto.HistorySync.HistorySyncType;
const example = () => ({
    contextInfo: {}, isCanceled: false, name: 'Texto',
    location: { degreesLatitude: 0, degreesLongitude: 0 },
    startTime: '1792544400', extraGuestsAllowed: false,
    isScheduleCall: false, hasReminder: true, reminderOffsetSec: '3600'
});
const message = (id, timestamp = 100) => ({ key: { remoteJid: '123@g.us', fromMe: false, id }, messageTimestamp: timestamp, message: { conversation: id } });
function roundTrip(object) { return proto.Message.decode(proto.Message.encode(object).finish()); }

test('single canonical proto resolves every message, enum and wire identifier', () => {
    const pb = require('protobufjs');
    const root = pb.loadSync(path.join(__dirname, '../WAProto/WAProto.proto')).resolveAll();
    let fields = 0, types = 0;
    function walk(node) {
        if (node.fieldsArray) { assert.equal(Object.keys(node.fieldsById).length, node.fieldsArray.length); fields += node.fieldsArray.length; types++; }
        for (const child of node.nestedArray || []) walk(child);
    }
    walk(root);
    assert.ok(fields >= 2705); assert.ok(types >= 539);
    assert.equal(fs.existsSync(path.join(__dirname, '../WAProto/WAProto.kage-original.proto')), false);
});
test('restored media, bot and sync fields survive serialization', () => {
    for (const field of ['audioMessage', 'imageMessage', 'videoMessage', 'documentMessage', 'stickerMessage']) {
        const result = roundTrip(proto.Message.fromObject({ [field]: { mediaKeyDomain: 'E2EE_CHAT' } }));
        assert.equal(result[field].mediaKeyDomain, 1);
    }
    assert.equal(proto.Message.MediaKeyDomain.BOT, 4);
    const metadata = proto.BotMetadata.fromObject({ avatarMetadata: {} });
    assert.ok(proto.BotMetadata.decode(proto.BotMetadata.encode(metadata).finish()).avatarMetadata);
    const sync = proto.SyncActionValue.fromObject({ businessBroadcastAssociationAction: {} });
    assert.ok(proto.SyncActionValue.decode(proto.SyncActionValue.encode(sync).finish()).businessBroadcastAssociationAction);
});
test('historical enum aliases and timestamp alias remain usable', () => {
    const e = proto.BotModeSelectionMetadata.BotUserSelectionMode;
    assert.equal(e.UNKNOWN_MODE, e.DEFAULT_MODE); assert.equal(e.REASONING_MODE, e.THINK_HARD_MODE);
    const Type = proto.Message.MessageHistoryMetadata;
    const value = Type.fromObject({ oldestMessageTimestamp: '1792544400' });
    const decoded = Type.decode(Type.encode(value).finish());
    assert.equal(String(decoded.oldestMessageTimestampInWindow), '1792544400');
    assert.equal(String(decoded.oldestMessageTimestamp), '1792544400');
});
test('poll snapshot canonical and legacy tags decode independently', () => {
    for (const field of ['pollResultSnapshotMessageV3', 'pollResultSnapshotMessageV3Legacy']) {
        assert.ok(roundTrip(proto.Message.fromObject({ [field]: {} }))[field]);
    }
});
test('exact supplied event payload round trips including reminder and false flags', () => {
    const raw = { eventMessage: example() };
    const prepared = prepareEventMessage(raw);
    const decoded = roundTrip(prepared);
    const event = proto.Message.EventMessage.toObject(decoded.eventMessage, { longs: String });
    assert.deepEqual(event, example());
    assert.equal(decoded.messageContextInfo.messageSecret.length, 32);
    assert.equal(raw.messageContextInfo, undefined);
    assert.equal(typeof raw.eventMessage.startTime, 'string');
});
test('event secret is retained across retries and wrappers', () => {
    const first = prepareEventMessage({ eventMessage: example() });
    const second = prepareEventMessage(first);
    assert.deepEqual(first.messageContextInfo.messageSecret, second.messageContextInfo.messageSecret);
    const wrapped = prepareEventMessage({ ephemeralMessage: { message: first } });
    assert.deepEqual(wrapped.ephemeralMessage.message.messageContextInfo.messageSecret, first.messageContextInfo.messageSecret);
});
test('event secret supplied as base64 is normalized without replacement', () => {
    const secret = Buffer.alloc(32, 5);
    const prepared = prepareEventMessage({ eventMessage: example(), messageContextInfo: { messageSecret: secret.toString('base64') } });
    assert.deepEqual(prepared.messageContextInfo.messageSecret, secret);
});
test('legacy event.messageSecret is moved out of EventMessage', () => {
    const secret = Buffer.alloc(32, 7);
    const prepared = prepareEventMessage({ eventMessage: { ...example(), messageSecret: secret } });
    assert.deepEqual(prepared.messageContextInfo.messageSecret, secret);
    assert.equal(prepared.eventMessage.messageSecret, undefined);
});
for (const [name, fields] of [
    ['missing name', { name: '' }], ['milliseconds', { startTime: Date.now() }],
    ['invalid latitude', { location: { degreesLatitude: 91 } }],
    ['end before start', { endTime: '1' }], ['string boolean', { hasReminder: 'false' }],
    ['negative reminder', { reminderOffsetSec: '-1' }], ['decimal timestamp', { startTime: 1.5 }]
]) test(`event validation rejects ${name}`, () => assert.throws(() => normalizeEventMessage({ ...example(), ...fields })));
test('invalid event secret fails locally', () => assert.throws(() => prepareEventMessage({ eventMessage: example(), messageContextInfo: { messageSecret: Buffer.alloc(2) } }), /32 bytes/));
test('int64 strings and bigint convert without losing precision in toObject', () => {
    const plain = { eventMessage: { startTime: '1792544400', reminderOffsetSec: '3600' } };
    assert.equal(proto.Message.toObject(plain, { longs: String }).eventMessage.startTime, '1792544400');
    assert.equal(proto.Message.toObject(plain, { longs: Number }).eventMessage.reminderOffsetSec, 3600);
    assert.equal(proto.Message.toObject(plain, { longs: BigInt }).eventMessage.startTime, 1792544400n);
    const value = proto.Message.fromObject({ audioMessage: { fileLength: '18446744073709551615' } });
    assert.equal(proto.Message.toObject(value, { longs: String }).audioMessage.fileLength, '18446744073709551615');
});
test('sendMessage content builder supports event shorthand and preserves mention context', async () => {
    const built = await generateWAMessageContent({ event: example(), mentions: ['1@s.whatsapp.net'] }, {});
    assert.equal(built.messageContextInfo.messageSecret.length, 32);
    assert.equal(built.eventMessage.hasReminder, true);
    assert.deepEqual(built.eventMessage.contextInfo.mentionedJid, ['1@s.whatsapp.net']);
});
test('mention handling does not overwrite existing context fields', async () => {
    const built = await generateWAMessageContent({ text: 'hola', contextInfo: { stanzaId: 'quoted' }, mentions: ['1@s.whatsapp.net'] }, {});
    assert.equal(built.extendedTextMessage.contextInfo.stanzaId, 'quoted');
    assert.deepEqual(built.extendedTextMessage.contextInfo.mentionedJid, ['1@s.whatsapp.net']);
});
test('text, reaction, location, poll and revoke messages still serialize', async () => {
    for (const content of [
        { text: 'hola' }, { react: { text: '👍', key: message('key').key } },
        { location: { degreesLatitude: 0, degreesLongitude: 0 } },
        { poll: { name: 'Encuesta', values: ['Sí', 'No'], selectableCount: 1 } },
        { delete: message('delete').key }
    ]) { const result = await generateWAMessageContent(content, {}); assert.ok(Object.keys(roundTrip(result)).length); }
});
test('history skips malformed rows, selects newest message and does not mutate input', () => {
    const item = { syncType: historyType.FULL, conversations: [{ id: '123@g.us', name: 'Grupo', messages: [ {}, { message: message('old', 100) }, { message: message('new', 200) } ] }] };
    const before = JSON.stringify(item); const result = processHistoryMessage(item);
    assert.equal(JSON.stringify(item), before); assert.equal(result.messages.length, 2);
    assert.equal(result.chats[0].messages[0].message.key.id, 'new');
    assert.equal(result.chats[0].lastMessageRecvTimestamp, 200);
});
test('missing optional history arrays are accepted', () => {
    assert.deepEqual(processHistoryMessage({ syncType: historyType.FULL }).messages, []);
    assert.deepEqual(processHistoryMessage({ syncType: historyType.PUSH_NAME }).contacts, []);
});
test('on-demand history is merged instead of discarded', async () => {
    const store = makeStore({ logger: log }); const ev = new EventEmitter(); store.bind(ev);
    ev.emit('messaging-history.set', { syncType: historyType.ON_DEMAND, chats: [{ id: '123@g.us' }], messages: [message('old')], contacts: [] });
    assert.ok(await store.loadMessage('123@g.us', 'old')); assert.ok(store.chats.get('123@g.us'));
});
test('initial history does not erase already received live messages by default', async () => {
    const store = makeStore({ logger: log }); const ev = new EventEmitter(); store.bind(ev);
    ev.emit('messages.upsert', { messages: [message('live')], type: 'notify' });
    ev.emit('messaging-history.set', { syncType: historyType.RECENT, isLatest: true, chats: [], messages: [message('old')], contacts: [] });
    assert.ok(await store.loadMessage('123@g.us', 'live')); assert.ok(await store.loadMessage('123@g.us', 'old'));
});
test('store snapshots preserve bytes and support serialized async atomic writes', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kage-store-')); const file = path.join(dir, 'store.json');
    try {
        const store = makeStore({ logger: log }); const ev = new EventEmitter(); store.bind(ev);
        const media = message('media'); media.message = { imageMessage: { mediaKey: Buffer.alloc(32, 9) } };
        ev.emit('messages.upsert', { type: 'notify', messages: [media] });
        await Promise.all([store.writeToFileAsync(file), store.writeToFileAsync(file)]);
        const copy = makeStore({ logger: log }); copy.readFromFile(file);
        const restored = await copy.loadMessage('123@g.us', 'media');
        assert.deepEqual(Buffer.from(restored.message.imageMessage.mediaKey), Buffer.alloc(32, 9));
        assert.deepEqual(fs.readdirSync(dir), ['store.json']);
        store.writeToFile(file); assert.doesNotThrow(() => JSON.parse(fs.readFileSync(file)));
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('auth concurrent saves round trip credentials and Signal keys atomically', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kage-auth-'));
    try {
        const auth = await useMultiFileAuthState(dir);
        await Promise.all([auth.saveCreds(), auth.saveCreds(), auth.state.keys.set({ session: { abc: Buffer.from([1, 2, 3]) } })]);
        const copy = await useMultiFileAuthState(dir);
        assert.deepEqual(copy.state.creds.signedIdentityKey.public, auth.state.creds.signedIdentityKey.public);
        assert.deepEqual((await copy.state.keys.get('session', ['abc'])).abc, Buffer.from([1, 2, 3]));
        assert.ok(fs.readdirSync(dir).every(file => !file.endsWith('.tmp')));
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('corrupt auth is surfaced instead of silently creating a new identity', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kage-corrupt-'));
    try { fs.writeFileSync(path.join(dir, 'creds.json'), '{broken'); await assert.rejects(useMultiFileAuthState(dir), SyntaxError); }
    finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('updated Jimp thumbnails and profile pictures work without native sharp', async () => {
    const { Jimp } = require('jimp'); const img = new Jimp({ width: 32, height: 24, color: 0xff0000ff });
    const png = await img.getBuffer('image/png');
    const { extractImageThumb, generateProfilePicture } = require('../lib/Utils/messages-media');
    const thumbnail = await extractImageThumb(png, 16); assert.ok(thumbnail.buffer.length > 0); assert.equal(thumbnail.original.width, 32);
    const profile = await generateProfilePicture(png); assert.ok(profile.img.length > 0);
});
test('updated music metadata parses generated PCM WAV', async () => {
    const wav = Buffer.alloc(44 + 16000 * 2);
    wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28);
    wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
    const { getAudioDuration } = require('../lib/Utils/messages-media');
    assert.ok(Math.abs((await getAudioDuration(wav)) - 1) < 0.01);
});
test('queue module supports CommonJS and package exports load', () => {
    assert.equal(typeof require('p-queue').default, 'function');
    assert.equal(typeof require('../lib/Utils/pre-key-manager').PreKeyManager, 'function');
    const lib = require('../lib'); assert.equal(typeof lib.makeWASocket, 'function');
    assert.equal(typeof lib.Browsers, 'function');
    assert.deepEqual(lib.Browsers.macOS('Desktop').slice(0, 2), ['Mac OS', 'Desktop']);
});

test('relayMessage group pipeline encrypts the supplied event with reminder and secret', async () => {
    const newsletter = require('../lib/Socket/newsletter'); const original = newsletter.makeNewsletterSocket;
    let encoded, stanza;
    newsletter.makeNewsletterSocket = () => ({
        ev: new EventEmitter(), user: { id: '1@s.whatsapp.net' },
        authState: { creds: { me: { id: '1@s.whatsapp.net' } }, keys: { transaction: fn => fn(), get: async () => ({}), set: async () => {} } },
        signalRepository: { encryptGroupMessage: async ({ data }) => { encoded = data; return { ciphertext: Buffer.from('encrypted'), senderKeyDistributionMessage: Buffer.alloc(0) }; } },
        groupMetadata: async () => ({ participants: [], addressingMode: 'pn' }),
        sendNode: async node => { stanza = node; }
    });
    const modulePath = require.resolve('../lib/Socket/messages-send'); delete require.cache[modulePath];
    try {
        const { makeMessagesSocket } = require(modulePath);
        const config = { ...require('../lib/Defaults').DEFAULT_CONNECTION_CONFIG, logger: log };
        const sock = makeMessagesSocket(config);
        const id = await sock.relayMessage('123@g.us', { eventMessage: example() }, {});
        assert.equal(typeof id, 'string'); assert.equal(stanza.attrs.to, '123@g.us');
        const { unpadRandomMax16 } = require('../lib/Utils/generics');
        const decoded = proto.Message.decode(unpadRandomMax16(encoded));
        assert.equal(decoded.eventMessage.hasReminder, true);
        assert.equal(String(decoded.eventMessage.reminderOffsetSec), '3600');
        assert.equal(decoded.messageContextInfo.messageSecret.length, 32);
        await sock.relayMessage('123@g.us', { eventMessage: example() });
    } finally { newsletter.makeNewsletterSocket = original; delete require.cache[modulePath]; }
});
