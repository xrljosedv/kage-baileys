'use strict';
function historyPayloadKind(message) {
 if (!message || typeof message !== 'object') return null;
 if (message.initialHistBootstrapInlinePayload instanceof Uint8Array && message.initialHistBootstrapInlinePayload.byteLength > 0) return 'inline';
 let key = message.mediaKey;
 if (typeof key === 'string') {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(key)) return null;
  key = Buffer.from(key, 'base64');
 }
 if (!(key instanceof Uint8Array) || key.byteLength !== 32) return null;
 if (typeof message.directPath === 'string' && message.directPath.startsWith('/')) return 'download';
 if (typeof message.url === 'string' && /^https:\/\//i.test(message.url)) return 'download';
 return null;
}
function invalidHistoryError() {
 return Object.assign(new Error('History notification has no valid inline payload or media key and download location'), { code: 'HISTORY_NOTIFICATION_INVALID' });
}
module.exports = { historyPayloadKind, invalidHistoryError };
