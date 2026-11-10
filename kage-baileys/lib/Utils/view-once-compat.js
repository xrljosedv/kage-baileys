'use strict';
const normal = require('./automation-tools');
const queues = new WeakMap();
const types = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'];
 
function getViewOnceContent(raw) {
  let message = raw?.message ?? raw;
  let viewOnce = false;
  for (let i = 0; i < 12 && message && typeof message === 'object'; i++) {
    const wrapper = ['deviceSentMessage', 'ephemeralMessage', 'documentWithCaptionMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension'].find(k => message[k]?.message);
    if (wrapper) { viewOnce ||= wrapper.startsWith('viewOnce'); message = message[wrapper].message; continue; }
    const type = types.find(k => message[k]);
    if (!type) return null;
    return { message, type, value: message[type], viewOnce: viewOnce || message[type].viewOnce === true };
  }
  return null;
}
function privacyError() { return Object.assign(new Error('VIEW_ONCE_PROTECTED: pide al remitente que reenvíe el archivo como medio normal.'), {code:'VIEW_ONCE_PROTECTED'}); }
function normalizeViewOnceMessage(raw) { if (!getViewOnceContent(raw)?.viewOnce) throw new Error('NOT_VIEW_ONCE'); throw privacyError(); }
async function downloadViewOnceMessage() { throw privacyError(); }
async function resendViewOnceMessage() { throw privacyError(); }
const observed = new WeakMap();
async function handleAutoViewOnce(raw, conn, settings = {}) {
  const media = getViewOnceContent(raw);
  if (!media?.viewOnce || !raw?.key?.id || settings.observeViewOnce === false) return null;
  let cache = observed.get(conn); if (!cache) {cache = new Map(); observed.set(conn,cache);}
  const now=Date.now(); for(const [k,t] of cache) if(now-t>300000)cache.delete(k);
  const key=JSON.stringify([raw.key.remoteJid,raw.key.participant,raw.key.id]); if(cache.has(key))return null;
  cache.set(key,now); while(cache.size>1000)cache.delete(cache.keys().next().value);
   
  conn.ev?.emit('kage.viewonce.detected', {type:media.type,protected:true,action:'observe-only'});
  return null;
}
exports.getViewOnceContent = getViewOnceContent;
exports.normalizeViewOnceMessage = normalizeViewOnceMessage;
exports.downloadViewOnceMessage = downloadViewOnceMessage;
exports.resendViewOnceMessage = resendViewOnceMessage;
exports.handleAutoViewOnce = handleAutoViewOnce;
