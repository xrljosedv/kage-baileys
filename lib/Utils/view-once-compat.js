'use strict';
const normal = require('./automation-tools');
const queues = new WeakMap();
const types = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage'];
// Inspect only content actually delivered to this account; never mutate its wrappers.
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
function normalizeViewOnceMessage(raw) {
  const media = getViewOnceContent(raw);
  if (!media?.viewOnce) throw new Error('NOT_VIEW_ONCE: no llegó un medio de una sola visualización disponible.');
  const value = { ...media.value }; delete value.viewOnce;
  return { ...raw, message: { [media.type]: value } };
}
async function downloadViewOnceMessage(conn, raw, options = {}) {
  return normal.downloadNormalMedia(conn, normalizeViewOnceMessage(raw), options);
}
async function resendViewOnceMessage(conn, raw, options = {}) {
  const media = getViewOnceContent(raw);
  if (!media?.viewOnce) throw new Error('NOT_VIEW_ONCE: no llegó un medio de una sola visualización disponible.');
  if (typeof conn.sendMessage !== 'function') throw new Error('SEND_UNAVAILABLE');
  const value = { ...media.value }; delete value.viewOnce;
  const result = await normal.downloadNormalMedia(conn, { ...raw, message: { [media.type]: value } }, options);
  if (options.shouldSend && !options.shouldSend()) return null;
  const field = { imageMessage: 'image', videoMessage: 'video', audioMessage: 'audio', documentMessage: 'document', stickerMessage: 'sticker' }[media.type];
  const body = { [field]: result.buffer };
  if (field !== 'sticker') body.mimetype = result.mimetype;
  if (['image', 'video', 'document'].includes(field) && result.caption) body.caption = result.caption;
  if (field === 'audio') body.ptt = !!value.ptt;
  if (field === 'video') body.gifPlayback = !!value.gifPlayback;
  if (field === 'document') body.fileName = value.fileName || 'archivo';
  return conn.sendMessage(options.jid || raw.key.remoteJid, body, options.quoted ? { quoted: options.quoted } : {});
}
async function handleAutoViewOnce(raw, conn, settings = {}, options = {}) {
  const chat = raw?.key?.remoteJid;
  const normalize = jid => String(jid || '').replace(/:\d+@/, '@');
  const aliases = new Set([chat, raw?.key?.remoteJidAlt].filter(Boolean).map(normalize));
  for (const jid of [...aliases]) {
    if (jid.endsWith('@lid')) {
      try { const pn = await conn.signalRepository?.lidMapping?.getPNForLID?.(jid); if (pn) aliases.add(normalize(pn)); } catch {}
    }
  }
  const active = () => Array.isArray(settings.autoViewOnceChats) && settings.autoViewOnceChats.some(jid => aliases.has(normalize(jid)));
  // Preserve the explicitly consented archive API for existing library clients.
  if (!active()) return require('./consented-media').handleConsentedAutoViewOnce(raw, conn, settings, options);
  if (!raw?.key?.id || (raw.key.fromMe && !settings.autoViewOnceOwn) || !/@(s\.whatsapp\.net|lid|g\.us)$/.test(chat || '') || !getViewOnceContent(raw)?.viewOnce) return Promise.resolve(null);
  const timestamp = Number(raw.messageTimestamp?.toNumber?.() ?? raw.messageTimestamp ?? 0) * 1000;
  if (!timestamp || Date.now() - timestamp > 300000 || timestamp > Date.now() + 60000) return Promise.resolve(null);
  let state = queues.get(conn);
  if (!state) { state = { tail: Promise.resolve(), pending: 0, seen: new Map() }; queues.set(conn, state); }
  const now = Date.now();
  for (const [id, date] of state.seen) if (now - date > 300000) state.seen.delete(id);
  const id = JSON.stringify([chat, raw.key.participant || '', raw.key.id]);
  if (state.seen.has(id)) return Promise.resolve(null);
  if (state.pending >= 20) return Promise.reject(new Error('VIEW_ONCE_QUEUE_FULL'));
  state.seen.set(id, now); state.pending++;
  while (state.seen.size > 500) state.seen.delete(state.seen.keys().next().value);
  const task = state.tail.then(() => active() ? resendViewOnceMessage(conn, raw, { ...options, jid: chat, shouldSend: active }) : null);
  task.then(result => conn.ev?.emit('kage.automation', { kind: 'viewonce', id: raw.key.id, chat, outcome: result ? 'sent' : 'cancelled' }), error => conn.ev?.emit('kage.automation', { kind: 'viewonce', id: raw.key.id, chat, outcome: 'failed', error: String(error.message || error).slice(0,200) })).catch(error => conn.logger?.warn?.({ error: error.message }, 'automation event listener'));
  state.tail = task.catch(() => { state.seen.delete(id); }).finally(() => { state.pending--; });
  return task;
}
exports.getViewOnceContent = getViewOnceContent;
exports.normalizeViewOnceMessage = normalizeViewOnceMessage;
exports.downloadViewOnceMessage = downloadViewOnceMessage;
exports.resendViewOnceMessage = resendViewOnceMessage;
exports.handleAutoViewOnce = handleAutoViewOnce;
