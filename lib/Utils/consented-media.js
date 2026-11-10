'use strict';
const normal = require('./automation-tools');
const queues = new WeakMap();
const jid = value => String(value || '').replace(/:\d+@/, '@');
function prepareConsentedViewOnce(conn, raw, options = {}) {
  const chat = raw?.key?.remoteJid;
  if (!/^\d+@(s\.whatsapp\.net|lid)$/.test(chat || '')) throw new Error('CONSENT_PRIVATE_ONLY: solo medios propios/autorizados en privados.');
  const sender = jid(raw.key.fromMe ? conn.user?.jid || conn.user?.id : raw.key.participant || chat);
  if (!options.consentJid || sender !== jid(options.consentJid)) throw new Error('SENDER_CONSENT_REQUIRED: el remitente debe autorizar el archivo de sus propios envíos.');
  let message = raw.message, isViewOnce = false;
  for (let i = 0; i < 12 && message; i++) {
    const wrapper = ['ephemeralMessage', 'documentWithCaptionMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension'].find(k => message[k]?.message);
    if (wrapper) { if (wrapper.startsWith('viewOnce')) isViewOnce = true; message = message[wrapper].message; continue; }
    const type = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'].find(k => message[k]);
    if (!type) break;
    isViewOnce ||= message[type].viewOnce === true;
    if (!isViewOnce) throw new Error('NOT_VIEW_ONCE: usa la descarga normal para este medio.');
    const value = { ...message[type] }; delete value.viewOnce;
    return { ...raw, message: { [type]: value } };
  }
  throw new Error('VIEW_ONCE_UNAVAILABLE: WhatsApp no entregó un medio y su clave de descarga; no se puede recuperarlo.');
}
async function downloadConsentedViewOnce(conn, raw, options = {}) {
  const prepared = prepareConsentedViewOnce(conn, raw, options);
  return normal.downloadNormalMedia(conn, prepared, options);
}
async function saveConsentedViewOnce(conn, raw, options = {}) {
  const prepared = prepareConsentedViewOnce(conn, raw, options);
  return normal.saveNormalMedia(conn, prepared, { ...options, directory: options.directory || 'downloads/consented-view-once' });
}
function handleAutoViewOnce(raw, conn, settings = {}, options = {}) {
  const chat = raw?.key?.remoteJid;
  const consentJid = settings.autoViewOnceConsent?.[chat];
  if (!consentJid || !raw.key.id) return Promise.resolve(null);
  const timestamp = Number(raw.messageTimestamp?.toNumber?.() ?? raw.messageTimestamp ?? 0) * 1000;
  if (!timestamp || Date.now() - timestamp > 300000 || timestamp > Date.now() + 60000) return Promise.resolve(null);
  try { prepareConsentedViewOnce(conn, raw, { consentJid }); }
  catch { return Promise.resolve(null); }
  let state = queues.get(conn);
  if (!state) { state = { tail: Promise.resolve(), pending: 0, seen: new Map() }; queues.set(conn, state); }
  const now = Date.now();
  for (const [id, when] of state.seen) if (now - when > 300000) state.seen.delete(id);
  const id = [chat, raw.key.participant || '', raw.key.fromMe, raw.key.id].join(':');
  if (state.seen.has(id)) return Promise.resolve(null);
  if (state.pending >= 20) return Promise.reject(new Error('VIEW_ONCE_QUEUE_FULL: máximo 20 archivos pendientes.'));
  state.pending++; state.seen.set(id, now);
  while (state.seen.size > 500) state.seen.delete(state.seen.keys().next().value);
  const task = state.tail.then(() => {
    if (settings.autoViewOnceConsent?.[chat] !== consentJid) return null;
    return saveConsentedViewOnce(conn, raw, { ...options, consentJid });
  });
  state.tail = task.catch(() => {}).finally(() => { state.pending--; });
  return task;
}
exports.prepareConsentedViewOnce = prepareConsentedViewOnce;
exports.downloadConsentedViewOnce = downloadConsentedViewOnce;
exports.saveConsentedViewOnce = saveConsentedViewOnce;
exports.handleConsentedAutoViewOnce = handleAutoViewOnce;
exports.handleAutoViewOnce = (...args) => require('./view-once-compat').handleAutoViewOnce(...args);
