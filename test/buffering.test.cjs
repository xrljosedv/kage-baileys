'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeEventBuffer } = require('../lib/Utils/event-buffer');
const logger = require('pino')({ level: 'silent' });

test('force flush resets buffering state and live events are not trapped', () => {
    const ev = makeEventBuffer(logger);
    const received = [];
    ev.on('contacts.upsert', data => received.push(...data));
    ev.buffer(); ev.buffer();
    ev.emit('contacts.upsert', [{ id: '1@s.whatsapp.net' }]);
    assert.equal(received.length, 0);
    assert.equal(ev.flush(true), true);
    assert.equal(ev.isBuffering(), false);
    ev.emit('contacts.upsert', [{ id: '2@s.whatsapp.net' }]);
    assert.equal(received.length, 2);
});
test('normal nested buffers still require matching releases', () => {
    const ev = makeEventBuffer(logger);
    ev.buffer(); ev.buffer();
    assert.equal(ev.flush(), false); assert.equal(ev.isBuffering(), true);
    assert.equal(ev.flush(), true); assert.equal(ev.isBuffering(), false);
});
