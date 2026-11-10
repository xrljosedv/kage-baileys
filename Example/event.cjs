'use strict';
// Import this helper in your bot; it does not connect or send by itself.
async function sendEvent(conn, jid, options = {}) {
    const startTime = options.startTime ?? String(Math.floor(Date.now() / 1000) + 86400);
    const eventMessage = {
        contextInfo: {},
        isCanceled: false,
        name: options.name || 'Texto',
        location: options.location || { degreesLatitude: 0, degreesLongitude: 0 },
        startTime,
        extraGuestsAllowed: false,
        isScheduleCall: false,
        hasReminder: true,
        reminderOffsetSec: '3600'
    };
    // The library prepares the missing MessageContextInfo.messageSecret.
    // For local persistence / reply-to events, prefer conn.sendMessage(jid, { event: eventMessage }).
    return conn.relayMessage(jid, { eventMessage }, {});
}
module.exports = { sendEvent };
