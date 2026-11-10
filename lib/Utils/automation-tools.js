'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const queues = new WeakMap();
const MAX_BYTES = 32 * 1024 * 1024;
function unwrapNormalMedia(raw) {
  let msg = raw?.message;
  for (let i = 0; i < 12 && msg; i++) {
    if (msg.viewOnceMessage || msg.viewOnceMessageV2 || msg.viewOnceMessageV2Extension) throw new Error('VIEW_ONCE_PROTECTED: pide al remitente una copia normal con su consentimiento.');
    const wrapper = ['deviceSentMessage', 'ephemeralMessage', 'documentWithCaptionMessage'].find(k => msg[k]?.message);
    if (wrapper) { msg = msg[wrapper].message; continue; }
    for (const type of ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage']) {
      if (!msg[type]) continue;
      if (msg[type].viewOnce) throw new Error('VIEW_ONCE_PROTECTED: no se archiva este contenido.');
      return { type, value: msg[type], message: msg };
    }
    break;
  }
  return null;
}
async function downloadNormalMedia(conn, raw, options = {}) {
  const media = unwrapNormalMedia(raw);
  if (!media) throw new Error('NO_MEDIA: el mensaje no contiene un medio normal compatible.');
  if (!raw?.key?.id) throw new Error('INVALID_KEY: falta la clave del mensaje.');
  const maxBytes = Math.min(MAX_BYTES, Math.max(1, Number(options.maxBytes) || MAX_BYTES));
  const declaredSize = Number(media.value.fileLength?.toNumber?.() ?? media.value.fileLength ?? 0);
  if (declaredSize > maxBytes) throw new Error('MEDIA_TOO_LARGE: supera el límite de descarga.');
  const download = options.downloader || require('./messages').downloadMediaMessage;
  const logger = conn.logger || { debug() {}, info() {}, warn() {}, error() {}, trace() {}, child() { return this; } };
  const timeoutMs = Math.min(120000, Math.max(100, Number(options.timeoutMs) || 30000));
  let stream, timer, stopped = false;
  const chunks = [];
  let size = 0;
  const job = (async () => {
    let target = { ...raw, message: media.message };
    for (let attempt = 0; attempt < 2; attempt++) {
      chunks.length = 0; size = 0;
      try {
        stream = await download(target, 'stream', { options: { timeout: timeoutMs } }, { logger, reuploadRequest: conn.updateMediaMessage?.bind(conn) });
        if (stopped) { stream.destroy?.(); throw new Error('MEDIA_TIMEOUT'); }
        for await (const chunk of stream) {
          if (stopped) throw new Error('MEDIA_TIMEOUT');
          const data = Buffer.from(chunk); size += data.length;
          if (size > maxBytes) throw new Error('MEDIA_TOO_LARGE: se interrumpió al alcanzar el límite.');
          chunks.push(data);
        }
        if (!size) throw new Error('EMPTY_MEDIA: WhatsApp no entregó datos.');
        return { buffer: Buffer.concat(chunks, size), type: media.type, mimetype: media.value.mimetype || 'application/octet-stream', caption: media.value.caption || '', bytes: size };
      } catch (error) {
        stream?.destroy?.();
        const code = error?.output?.statusCode || error?.response?.status || error?.statusCode;
        const retry = [403,404,408,410,429,500,502,503,504].includes(Number(code)) || /EMPTY_MEDIA|ECONNRESET|ETIMEDOUT|ENOTFOUND/.test(error?.message || error?.code || '');
        if (attempt || stopped || !retry) throw error;
        if ([403,404,410].includes(Number(code)) && typeof conn.updateMediaMessage === 'function') {
          const updated = await conn.updateMediaMessage(target);
          if (updated?.message) target = updated;
        }
        if (stopped) throw new Error('MEDIA_TIMEOUT');
      }
    }
  })();
  try {
    return await Promise.race([job, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('MEDIA_TIMEOUT: tiempo de espera agotado.')), timeoutMs); })]);
  } finally {
    stopped = true;
    clearTimeout(timer);
    stream?.destroy?.();
    // Handle a stream that becomes available only after the timeout.
    job.finally(() => stream?.destroy?.()).catch(() => {});
  }
}
async function saveNormalMedia(conn, raw, options = {}) {
  const result = await downloadNormalMedia(conn, raw, options);
  const base = path.resolve(options.directory || 'downloads/normal');
  await fs.mkdir(base, { recursive: true, mode: 0o700 });
  const quota = Math.max(MAX_BYTES, Number(options.maxStorageBytes) || 512 * 1024 * 1024);
  const entries = await fs.readdir(base, { withFileTypes: true });
  if (entries.length > 10000) throw new Error('MEDIA_STORAGE_FULL: demasiados archivos en el directorio.');
  let used = 0;
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    try { used += (await fs.stat(path.join(base, entry.name))).size; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (used + result.bytes > quota) throw new Error('MEDIA_STORAGE_FULL: límite de almacenamiento alcanzado. Elimina archivos que ya no necesites.');
  const id = createHash('sha256').update([conn.user?.id || '', raw.key.remoteJid, raw.key.participant || '', raw.key.id].join(':')).digest('hex').slice(0, 32);
  const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'application/pdf': 'pdf' })[result.mimetype.split(';')[0]] || 'bin';
  const file = path.join(base, id + '.' + ext);
  const tmp = file + '.tmp';
  try {
    await fs.writeFile(tmp, result.buffer, { mode: 0o600 });
    await fs.chmod(tmp, 0o600);
    await fs.rename(tmp, file);
  } catch (error) { await fs.rm(tmp, { force: true }).catch(() => {}); throw error; }
  const { buffer, ...meta } = result;
  return { ...meta, file };
}
function handleAutoMedia(raw, conn, settings = {}, options = {}) {
  if (!Array.isArray(settings.autoDownloadChats) || !settings.autoDownloadChats.includes(raw?.key?.remoteJid) || raw.key.fromMe || raw.key.remoteJid === 'status@broadcast') return Promise.resolve(null);
  const age = Number(raw.messageTimestamp?.toNumber?.() ?? raw.messageTimestamp ?? 0) * 1000;
  if (!age || Date.now() - age > 300000 || age > Date.now() + 60000) return Promise.resolve(null);
  try { if (!unwrapNormalMedia(raw)) return Promise.resolve(null); }
  catch { return Promise.resolve(null); }
  let state = queues.get(conn);
  if (!state) { state = { tail: Promise.resolve(), pending: 0, seen: new Map() }; queues.set(conn, state); }
  const now = Date.now();
  for (const [id, timestamp] of state.seen) if (now - timestamp > 300000) state.seen.delete(id);
  const id = [raw.key.remoteJid, raw.key.participant || '', raw.key.id].join(':');
  if (state.seen.has(id)) return Promise.resolve(null);
  if (state.pending >= 20) return Promise.reject(new Error('MEDIA_QUEUE_FULL: máximo 20 descargas pendientes.'));
  state.seen.set(id, now);
  while (state.seen.size > 500) state.seen.delete(state.seen.keys().next().value);
  state.pending++;
  const job = state.tail.then(() => saveNormalMedia(conn, raw, options));
  state.tail = job.catch(() => { state.seen.delete(id); }).finally(() => { state.pending--; });
  return job;
}
async function sendAIResponse(conn, jid, text, options = {}) {
  if (typeof text !== 'string' || !text.trim()) throw new TypeError('AI response text must be nonempty.');
  try { await conn.sendPresenceUpdate?.('composing', jid); } catch {}
  try {
    // Honest disclosure, not a Meta verification proof or an official badge.
    const disclosure = options.disclosure || 'Kage xrljosedv AI · Este contenido fue generado por IA.';
    return await conn.sendMessage(jid, { text: text.slice(0, 60000) + '\n\n' + disclosure }, { quoted: options.quoted });
  } finally { try { await conn.sendPresenceUpdate?.('paused', jid); } catch {} }
}
function installKageTools(conn, options = {}) {
  if (conn.__kageToolsInstalled) return conn;
  Object.defineProperty(conn, '__kageToolsInstalled', { value: true });
  const status = require('./status-tools');
  const country = require('./country-info');
  conn.inspectMessage = raw => require('./message-inspector').inspectMessage(raw);
  conn.getMessageDiagnostics = () => require('./message-inspector').getMessageDiagnostics(conn);
  conn.enableEventTracking = opts => require('./message-inspector').installMessageInspector(conn, opts);
  conn.refreshReceivedStatuses = opts => require('./status-refresh').refreshReceivedStatuses(conn, opts);
  if (options.eventTracking) conn.enableEventTracking(options.eventOptions || {});
  if (options.banner) require('./terminal-banner').showKageBanner();
  conn.getReceivedStatuses = (includeUnavailable = false) => status.listStatuses(conn, includeUnavailable);
  conn.getCountryForJid = jid => country.getCountryForJid(conn, jid);
  conn.downloadNormalMedia = (raw, opts) => downloadNormalMedia(conn, raw, opts);
  conn.saveNormalMedia = (raw, opts) => saveNormalMedia(conn, raw, opts);
  conn.downloadConsentedViewOnce = (raw, opts) => require('./consented-media').downloadConsentedViewOnce(conn, raw, opts);
  conn.saveConsentedViewOnce = (raw, opts) => require('./consented-media').saveConsentedViewOnce(conn, raw, opts);
  conn.getViewOnceContent = raw => require('./view-once-compat').getViewOnceContent(raw);
  conn.normalizeViewOnceMessage = raw => require('./view-once-compat').normalizeViewOnceMessage(raw);
  conn.downloadViewOnceMessage = (raw, opts) => require('./view-once-compat').downloadViewOnceMessage(conn, raw, opts);
  conn.resendViewOnceMessage = (raw, opts) => require('./view-once-compat').resendViewOnceMessage(conn, raw, opts);
  conn.handleAutoViewOnce = (raw, settings, opts) => require('./view-once-compat').handleAutoViewOnce(raw, conn, settings, opts);
  conn.saveReceivedStatus = (entry, opts) => require('./status-archive').saveReceivedStatus(conn, entry, opts);
  conn.exportReceivedStatuses = (author, opts) => require('./status-archive').exportStatusZip(conn, author, opts);
  conn.enableMediaAutomation = (settings = {}) => {
    if (conn.__kageStopMedia) return conn.__kageStopMedia;
    let active = true;
    const recent = new Map();
    const scoped = new Proxy(settings, { get(target, key) { return !active && ['autoDownloadChats','autoViewOnceChats','autoViewOnceConsent'].includes(key) ? undefined : target[key]; } });
    const upsert = event => {
      if (event?.type && !['notify', 'append'].includes(event.type)) return;
      for (const raw of event.messages || []) {
        const id = JSON.stringify([raw.key?.remoteJid, raw.key?.id]);
        if (raw.messageTimestamp) recent.set(id, raw.messageTimestamp);
        while(recent.size > 1000) recent.delete(recent.keys().next().value);
        handleAutoMedia(raw, conn, scoped).catch(error => conn.logger?.warn?.({ error: error.message }, 'media automation'));
        require('./view-once-compat').handleAutoViewOnce(raw, conn, scoped).catch(error => conn.logger?.warn?.({ error: error.message }, 'view once automation'));
      }
    };
    const updated = items => { for (const item of items || []) if (item.update?.message) {
      const timestamp = item.update.messageTimestamp || recent.get(JSON.stringify([item.key?.remoteJid, item.key?.id]));
      if (timestamp) upsert({ type: 'append', messages: [{ ...item.update, key: item.key, messageTimestamp: timestamp }] });
    } };
    const stop = () => { active = false; recent.clear(); conn.ev.off('messages.update', updated); conn.ev.off('messages.upsert', upsert); conn.ev.off('connection.update', closed); delete conn.__kageStopMedia; };
    const closed = update => { if (update.connection === 'close') stop(); };
    conn.ev.on('messages.upsert', upsert); conn.ev.on('messages.update', updated); conn.ev.on('connection.update', closed);
    conn.__kageStopMedia = stop;
    return stop;
  };
  if (options.mediaAutomation) conn.enableMediaAutomation(options.mediaSettings || {});
  conn.sendAIResponse = (jid, text, opts) => sendAIResponse(conn, jid, text, opts);
  let stop;
  conn.enableStatusTracking = (settings = {}) => {
    if (stop) return stop;
    let active = true;
    const scopedSettings = new Proxy(settings, { get(target, key) { return key === 'statusSave' ? active && target[key] : target[key]; } });
    const upsert = event => { for (const raw of event?.messages || []) status.handleStatus(raw, conn, scopedSettings).catch(e => conn.logger?.warn?.({ error: e.message }, 'status tracking')); };
    const history = event => upsert(event);
    const deleted = event => { for (const key of event?.keys || []) status.markStatusDeleted(conn, key); };
    const updated = items => { for (const item of items || []) {
      if (item.key?.remoteJid === 'status@broadcast' && item.update?.message === null) status.markStatusDeleted(conn, item.key);
      else if (item.update?.message) upsert({ messages: [{ ...item.update, key: item.key }] });
    } }; 
    const closed = update => { if (update.connection === 'close') stop?.(); };
    const timer = setInterval(() => status.flushStatuses(conn), 60000); timer.unref?.();
    conn.ev.on('messages.upsert', upsert);
    conn.ev.on('messaging-history.set', history);
    conn.ev.on('messages.delete', deleted);
    conn.ev.on('messages.update', updated);
    conn.ev.on('connection.update', closed);
    stop = () => {
      if (!active) return;
      active = false;
      clearInterval(timer);
      conn.ev.off('messages.upsert', upsert); conn.ev.off('messaging-history.set', history); conn.ev.off('messages.delete', deleted);
      conn.ev.off('messages.update', updated); conn.ev.off('connection.update', closed);
      status.flushStatuses(conn); stop = undefined;
    };
    return stop;
  };
  if (options.statusTracking) conn.enableStatusTracking(options.statusSettings || {});
  return conn;
}
exports.installKageTools = installKageTools;
exports.unwrapNormalMedia = unwrapNormalMedia;
exports.downloadNormalMedia = downloadNormalMedia;
exports.saveNormalMedia = saveNormalMedia;
exports.handleAutoMedia = handleAutoMedia;
exports.sendAIResponse = sendAIResponse;
