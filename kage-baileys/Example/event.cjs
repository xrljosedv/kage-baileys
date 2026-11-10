'use strict';
 
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
     
     
    return conn.relayMessage(jid, { eventMessage }, {});
}
module.exports = { sendEvent };
