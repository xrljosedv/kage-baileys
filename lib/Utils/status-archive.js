'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { zipSync, strToU8 } = require('fflate');
const normal = require('./automation-tools');
const queues = new WeakMap();
const clean = value => String(value || '').replace(/:\d+@/, '@');
function accountDir(conn, options) {
  const account = clean(conn.user?.jid || conn.user?.id);
  if (!account) throw new Error('STATUS_ACCOUNT_REQUIRED');
  return path.resolve(options.directory || path.join('downloads/status', createHash('sha256').update(account).digest('hex').slice(0, 24)));
}
async function isKnownStatusContact(conn, author) {
  author = clean(author);
  if (!author || !/@(s\.whatsapp\.net|lid)$/.test(author)) return false;
  const ids = [author];
  try {
    const mapping = conn.signalRepository?.lidMapping;
    const other = author.endsWith('@lid') ? await mapping?.getPNForLID?.(author) : await mapping?.getLIDForPN?.(author);
    if (other) ids.push(clean(other));
  } catch {}
  return ids.some(id => {
    const contact = conn.contacts?.get?.(id) || conn.contacts?.[id] || conn.store?.contacts?.[id] || conn.chats?.[id];
    return !!(contact?.name || contact?.isMyContact === true || contact?.isContact === true);
  });
}
function metadata(entry) {
  return { id: entry.id, author: entry.author, sender: entry.sender, name: entry.name, type: entry.type,
    text: entry.text, publishedAt: entry.publishedAt, receivedAt: entry.receivedAt, availability: entry.availability,
    reactedWith: entry.reactedWith || null, origin: entry.origin, groups: entry.groups, mentions: entry.mentions,
    backgroundArgb: entry.value?.backgroundArgb ?? null, textArgb: entry.value?.textArgb ?? null };
}
async function saveReceivedStatus(conn, entry, options = {}) {
  if (!entry?.type || !entry.raw || entry.viewOnce || ['expired','deleted'].includes(entry.availability) || entry.expiresAt <= Date.now()) throw new Error('STATUS_UNAVAILABLE: estado no disponible.');
  const directory = accountDir(conn, options);
  let result;
  if (['conversation', 'extendedTextMessage'].includes(entry.type)) {
    const text = Buffer.from(entry.text || '', 'utf8');
    const raw = { ...entry.raw, message: { documentMessage: { mimetype: 'text/plain', fileLength: text.length } } };
    result = await normal.saveNormalMedia(conn, raw, { ...options, directory, downloader: async () => require('node:stream').Readable.from([text.length ? text : Buffer.from(' ')]) });
  } else result = await normal.saveNormalMedia(conn, entry.raw, { ...options, directory });
  entry.archive = { ...result, savedAt: Date.now() };
  require('./status-tools').flushStatuses(conn);
  return entry.archive;
}
async function exportStatusZip(conn, author, options = {}) {
  author = clean(author);
  if (options.contactsOnly !== false && !await isKnownStatusContact(conn, author)) throw new Error('STATUS_CONTACT_REQUIRED: solo contactos guardados y sincronizados.');
  const all = require('./status-tools').listStatuses(conn).filter(e => clean(e.author || e.sender) === author);
  if (!all.length) throw new Error('STATUS_EMPTY: no hay estados disponibles de este contacto.');
  const files = {}, information = { author, createdAt: new Date().toISOString(), states: [], omitted: [] };
  let bytes = 0, count = 0;
  const directory = accountDir(conn, options);
  for (const entry of all) {
    if (count >= 100) { information.omitted.push({ id: entry.id, reason: 'límite de 100 estados' }); continue; }
    try {
      if (entry.viewOnce || !entry.type || !entry.raw) throw new Error('contenido no disponible o protegido');
      let data, extension;
      if (['conversation', 'extendedTextMessage'].includes(entry.type)) { data = Buffer.from(entry.text || '', 'utf8'); extension = 'txt'; }
      else {
        // Only accept archive paths inside this account directory, never paths from untrusted metadata.
        const candidate = entry.archive?.file && path.resolve(entry.archive.file);
        if (candidate && path.dirname(candidate) === directory) {
          try {
            const stat = await fs.stat(candidate);
            if (stat.size > 32 * 1024 * 1024) throw new Error('medio mayor que 32 MiB');
            data = await fs.readFile(candidate);
          } catch (error) { if (error.code !== 'ENOENT') throw error; }
        }
        if (!data) data = (await normal.downloadNormalMedia(conn, entry.raw, options)).buffer;
        extension = ({ 'image/jpeg':'jpg','image/png':'png','image/webp':'webp','video/mp4':'mp4','audio/ogg':'ogg','audio/mpeg':'mp3','application/pdf':'pdf' })[String(entry.value.mimetype || '').split(';')[0]] || 'bin';
      }
      if (bytes + data.length > 64 * 1024 * 1024) throw new Error('límite ZIP de 64 MiB');
      const name = String(entry.id).replace(/[^a-zA-Z0-9_-]/g, '_') + '.' + extension;
      files[name] = data; bytes += data.length; count++;
      information.states.push({ ...metadata(entry), file: name, bytes: data.length });
    } catch (error) { information.omitted.push({ id: entry.id, reason: String(error.message).slice(0, 250) }); }
  }
  files['informacion.json'] = strToU8(JSON.stringify(information, null, 2));
  return { buffer: Buffer.from(zipSync(files, { level: 0 })), count, total: all.length, fileName: 'estados-' + author.replace(/[^\w.-]/g, '_') + '.zip' };
}
function handleStatusArchive(conn, entry, settings = {}, options = {}) {
  const destination = settings.statusDestination;
  if (!settings.statusSave || !/^\d+@(s\.whatsapp\.net|lid)$/.test(destination || '') || !entry?.author || entry.archiveDeliveredAt || entry.sourceKey?.fromMe) return Promise.resolve(null);
  let state = queues.get(conn);
  if (!state) { state = { tail: Promise.resolve(), pending: 0, inFlight: new Set() }; queues.set(conn, state); }
  if (state.inFlight.has(entry.id)) return Promise.resolve(null);
  if (state.pending >= 20) return Promise.reject(new Error('STATUS_QUEUE_FULL'));
  state.pending++; state.inFlight.add(entry.id);
  const job = state.tail.then(async () => {
    if (!settings.statusSave || settings.statusContactsOnly !== false && !await isKnownStatusContact(conn, entry.author)) return null;
    if (!entry.archive) await saveReceivedStatus(conn, entry, options);
    if (!settings.statusSave) return null;
    if (settings.statusZip) {
      const zip = await exportStatusZip(conn, entry.author, { ...options, contactsOnly: settings.statusContactsOnly !== false });
      await conn.sendMessage(destination, { document: zip.buffer, mimetype: 'application/zip', fileName: zip.fileName, caption: `${zip.count}/${zip.total} estados recibidos de ${entry.author}` });
    } else {
      const info = metadata(entry);
      const buffer = await fs.readFile(entry.archive.file);
      const type = {imageMessage:'image',videoMessage:'video',audioMessage:'audio',stickerMessage:'sticker',documentMessage:'document'}[entry.type];
      let body;
      if (!type) body = {text: entry.text || '(estado de texto vacío)'};
      else {
        body = {[type]: buffer};
        if (type !== 'sticker') body.mimetype = entry.value.mimetype || 'application/octet-stream';
        if (['image','video','document'].includes(type)) body.caption = entry.text || '';
        if (type === 'audio') body.ptt = !!entry.value.ptt;
        if (type === 'video') body.gifPlayback = !!entry.value.gifPlayback;
        if (type === 'document') body.fileName = 'estado-' + entry.id;
      }
      await conn.sendMessage(destination, body);
      await conn.sendMessage(destination, { document: Buffer.from(JSON.stringify(info, null, 2)), mimetype: 'application/json', fileName: entry.id + '-informacion.json' });
    }
    entry.archiveDeliveredAt = Date.now(); require('./status-tools').flushStatuses(conn);
    return entry.archive;
  });
  state.tail = job.catch(() => {}).finally(() => {state.pending--; state.inFlight.delete(entry.id);});
  return job;
}
exports.isKnownStatusContact = isKnownStatusContact;
exports.saveReceivedStatus = saveReceivedStatus;
exports.exportStatusZip = exportStatusZip;
exports.handleStatusArchive = handleStatusArchive;
