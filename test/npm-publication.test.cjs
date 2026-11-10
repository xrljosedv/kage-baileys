'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const api = require('../lib');
const logger = require('pino')({ level: 'silent' });
const tick = () => new Promise(resolve => setImmediate(resolve));
function makeSocket() {
    return api.makeWASocket({
        auth: { creds: api.initAuthCreds(), keys: { get: async () => ({}), set: async () => {} } },
        logger, waWebSocketUrl: 'wss://127.0.0.1:1', connectTimeoutMs: 1000,
        fireInitQueries: false, kageTools: { banner: false }
    });
}
test('Android archive has no filenames differing only in case', () => {
    const seen = new Map();
    function scan(dir) {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            if (e.name === 'node_modules' || e.name === '.git') continue;
            const f = path.join(dir, e.name), key = f.toLowerCase();
            assert.ok(!seen.has(key), (seen.get(key) || '') + ' / ' + f);
            seen.set(key, f);
            if (e.isDirectory()) scan(f);
        }
    }
    scan(path.join(__dirname, '..'));
});
test('canonical LID protocol retains query, parser and per-user LID', () => {
    const { USyncLIDProtocol } = require('../lib/WAUSync/Protocols/USyncLIDProtocol');
    const p = new USyncLIDProtocol();
    assert.deepEqual(p.getQueryElement(), { tag: 'lid', attrs: {} });
    assert.equal(p.getUserElement(), null);
    assert.deepEqual(p.getUserElement({ lid: '123@lid' }), { tag: 'lid', attrs: { jid: '123@lid' } });
    assert.equal(p.parser({ tag: 'lid', attrs: { val: '123@lid' } }), '123@lid');
    const query = new api.USyncQuery().withLIDProtocol();
    assert.equal(query.protocols.find(p => p.name === 'lid').getUserElement({ lid: '123@lid' }).attrs.jid, '123@lid');
});
test('complete socket exposes every method in the supplemental surface', async () => {
    const socket = makeSocket();
    try {
        for (const layer of require('../maintenance/reference-socket-surface.json')) {
            for (const name of layer.methods) assert.ok(name in socket, layer.layer + ':' + name);
        }
    } finally { socket.end(); await tick(); }
});
test('socket end hooks run once, can be removed, and isolate rejected hooks', async () => {
    const socket = makeSocket(); let calls = 0;
    socket.registerSocketEndHandler(() => { calls++; });
    socket.registerSocketEndHandler(async () => { calls++; throw new Error('expected cleanup error'); });
    const remove = socket.registerSocketEndHandler(() => { calls += 100; });
    remove(); socket.end(); socket.end(); await tick();
    assert.equal(calls, 2);
    socket.registerSocketEndHandler(() => { calls++; });
    assert.equal(calls, 3);
});
test('account restriction and chat cap use existing WMex transport with correct paths', async () => {
    const mex = require('../lib/Socket/mex'); const old = mex.executeWMexQuery;
    const calls = [], events = []; const socket = makeSocket();
    socket.ev.on('connection.update', e => { if (e.reachoutTimeLock) events.push(e.reachoutTimeLock); });
    mex.executeWMexQuery = async (...args) => {
        calls.push(args);
        if (args[2] === api.XWAPaths.xwa2_fetch_account_reachout_timelock) {
            return { is_active: true, time_enforcement_ends: '1800000000', enforcement_type: 'test' };
        }
        return { quota: 10, usage: 2 };
    };
    try {
        const state = await socket.fetchAccountReachoutTimelock();
        assert.equal(state.isActive, true);
        assert.equal(state.timeEnforcementEnds.getTime(), 1800000000000);
        assert.equal(state.enforcementType, 'test'); assert.equal(events.length, 1);
        assert.deepEqual(await socket.fetchNewChatMessageCap(), { quota: 10, usage: 2 });
        assert.deepEqual(calls[1][0], { input: { type: 'INDIVIDUAL_NEW_CHAT_MSG' } });
        assert.equal(calls[0][1], api.QueryIds.REACHOUT_TIMELOCK);
        assert.equal(calls[1][1], api.QueryIds.MESSAGE_CAPPING_INFO);
        assert.equal(calls[0][3], socket.query);
        assert.equal(calls[1][3], socket.query);
    } finally { mex.executeWMexQuery = old; socket.end(); await tick(); }
});
test('closed socket ignores session telemetry and invalid server timestamps', async () => {
    const socket = makeSocket();
    socket.updateServerTimeOffset({ attrs: { t: 'Infinity' } });
    socket.updateServerTimeOffset({ attrs: { t: 'invalid' } });
    socket.updateServerTimeOffset({ attrs: { t: '0' } });
    socket.updateServerTimeOffset({ attrs: { t: String(Math.floor(Date.now() / 1000)) } });
    await socket.sendUnifiedSession(); socket.end(); await socket.sendUnifiedSession(); await tick();
});
test('Jimp resizing, cropping, effects and Kage thumbnails work with patched Zod', async () => {
    const { Jimp } = require('jimp');
    const image = new Jimp({ width: 32, height: 24, color: 0xff0000ff });
    image.resize({ w: 64 }).crop({ x: 1, y: 1, w: 40, h: 20 }).flip({ horizontal: true });
    image.contain({ w: 48, h: 48 }).cover({ w: 32, h: 32 }).rotate(90).circle();
    image.color([{ apply: 'red', params: [10] }]);
    const png = await image.getBuffer('image/png');
    const thumbnail = await api.extractImageThumb(png, 16);
    assert.equal(thumbnail.original.width, 32);
    const thumbImage = await Jimp.read(thumbnail.buffer);
    assert.equal(thumbImage.bitmap.width, 16);
    const profile = await api.generateProfilePicture(png);
    assert.ok(Buffer.isBuffer(profile.img));
});
test('npm overrides include each requested resolution and preserve major selection', () => {
    const p = require('../package.json');
    for (const [selector, range] of Object.entries(p.resolutions)) assert.equal(p.overrides[selector.replace('@npm:', '@')], range);
    assert.equal(p.overrides['@itsukichan/libsignal-node'].protobufjs, '^7.6.6');
    assert.equal(p.overrides['zod@^3.23.8'], '^4.6.7');
    assert.equal(p.publishConfig.access, 'public');
    assert.equal(api.KAGE_BUILD.version, p.version);
});
test('username builders and multimedia/account constants are exposed on active API', () => {
    const user = new api.USyncUser().withUsername('example').withUsernameKey('key');
    assert.equal(user.username, 'example'); assert.equal(user.usernameKey, 'key');
    const query = new api.USyncQuery().withUsernameProtocol().withUser(user);
    assert.equal(query.protocols[0].name, 'username');
    assert.equal(api.QueryIds.REACHOUT_TIMELOCK, '23983697327930364');
    assert.equal(api.QueryIds.MESSAGE_CAPPING_INFO, '24503548349331633');
    assert.equal(api.QueryIds.SUBSCRIBED, '6388546374527196');
    assert.equal(api.XWAPaths.xwa2_newsletter_subscribed, 'xwa2_newsletter_subscribed');
    assert.equal(api.XWAPaths.xwa2_message_capping_info, 'xwa2_message_capping_info');
    assert.equal(api.MEDIA_HKDF_KEY_MAPPING['sticker-pack'], 'Sticker Pack');
    assert.equal(api.MEDIA_HKDF_KEY_MAPPING['product-catalog-image'], 'Product Catalog Image');
    assert.ok(api.MEDIA_KEYS.includes('sticker-pack'));
});
test('retry manager accepts legacy and supplemental signatures and clears timers/caches', () => {
    const manager = new api.MessageRetryManager(logger, 3);
    const one = { conversation: 'one' }, two = { conversation: 'two' };
    manager.addRecentMessage({ to: '1@s.whatsapp.net', id: 'a' }, one);
    manager.addRecentMessage('2@s.whatsapp.net', 'b', two);
    assert.equal(manager.getRecentMessage('1@s.whatsapp.net', 'a').message, one);
    assert.equal(manager.getRecentMessage({ to: '2@s.whatsapp.net', id: 'b' }).message, two);
    const key = Buffer.from([1, 2]); manager.saveBaseKey('address', 'b', key); key[0] = 9;
    assert.equal(manager.hasSameBaseKey('address', 'b', Buffer.from([1, 2])), true);
    manager.deleteBaseKey('address', 'b');
    assert.equal(manager.hasSameBaseKey('address', 'b', Buffer.from([1, 2])), false);
    manager.schedulePhoneRequest('a', () => assert.fail('cancelled timer fired'), 60000);
    manager.clear();
    assert.equal(manager.getRecentMessage('1@s.whatsapp.net', 'a'), undefined);
    assert.deepEqual(Object.keys(manager.pendingPhoneRequests), []);
    assert.equal(manager.statistics.totalRetries, 0);
});
