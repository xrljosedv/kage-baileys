'use strict';
const { randomBytes } = require('crypto');
const { proto } = require('../../WAProto');

function seconds(value, field) {
    if (typeof value === 'number' && !Number.isSafeInteger(value)) {
        throw new TypeError(`${field} must be an integer in Unix seconds, not milliseconds`);
    }
    const str = typeof value === 'bigint' ? value.toString() : String(value);
    if (!/^\d+$/.test(str)) throw new TypeError(`${field} must be a non-negative integer in Unix seconds`);
    const n = BigInt(str);
    if (n > 9223372036854775807n) throw new RangeError(`${field} exceeds int64`);
    // Dates in milliseconds are a frequent mistake. The bound is year 9999.
    if (field !== 'reminderOffsetSec' && n > 253402300799n) {
        throw new RangeError(`${field} looks like milliseconds; supply Unix seconds`);
    }
    return n.toString();
}

function normalizeEventMessage(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('eventMessage must be an object');
    const event = { ...input };
    if (!event.isCanceled && (typeof event.name !== 'string' || !event.name.trim())) {
        throw new TypeError('An event requires a non-empty name');
    }
    for (const field of ['isCanceled', 'extraGuestsAllowed', 'isScheduleCall', 'hasReminder']) {
        if (event[field] != null && typeof event[field] !== 'boolean') throw new TypeError(`${field} must be boolean`);
    }
    if (event.startTime == null && !event.isCanceled) throw new TypeError('An event requires startTime');
    for (const field of ['startTime', 'endTime', 'reminderOffsetSec']) {
        if (event[field] != null) event[field] = seconds(event[field], field);
    }
    if (event.endTime != null && event.startTime != null && BigInt(event.endTime) < BigInt(event.startTime)) {
        throw new RangeError('endTime cannot precede startTime');
    }
    if (event.hasReminder && event.reminderOffsetSec == null) event.reminderOffsetSec = '3600';
    if (event.location != null) {
        const location = { ...event.location };
        for (const [field, limit] of [['degreesLatitude', 90], ['degreesLongitude', 180]]) {
            if (location[field] != null && (typeof location[field] !== 'number' || !Number.isFinite(location[field]) || Math.abs(location[field]) > limit)) {
                throw new RangeError(`Invalid location.${field}`);
            }
        }
        event.location = location;
    }
    // This property belongs to MessageContextInfo, not EventMessage.
    delete event.messageSecret;
    const normalized = proto.Message.EventMessage.fromObject(event);
    const error = proto.Message.EventMessage.verify(normalized);
    if (error) throw new TypeError(`Invalid eventMessage: ${error}`);
    return normalized;
}

function prepareEventMessage(message) {
    if (!message || typeof message !== 'object') throw new TypeError('message must be an object');
    if (message.eventMessage != null) {
        const eventMessage = normalizeEventMessage(message.eventMessage);
        const context = { ...(message.messageContextInfo || {}) };
        const existing = context.messageSecret ?? message.eventMessage.messageSecret;
        if (existing == null) context.messageSecret = randomBytes(32);
        else {
            const secret = typeof existing === 'string' ? Buffer.from(existing, 'base64') : Buffer.from(existing);
            if (secret.length !== 32) throw new RangeError('messageSecret must contain exactly 32 bytes');
            context.messageSecret = secret;
        }
        return { ...message, eventMessage, messageContextInfo: context };
    }
    for (const field of ['ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension', 'deviceSentMessage']) {
        if (message[field]?.message) {
            const prepared = prepareEventMessage(message[field].message);
            if (prepared !== message[field].message) return { ...message, [field]: { ...message[field], message: prepared } };
        }
    }
    return message;
}

module.exports = { normalizeEventMessage, prepareEventMessage };
