'use strict';
 
const { mkdirSync, readFileSync, writeFileSync, renameSync, chmodSync } = require('node:fs')
const { resolve, join } = require('node:path')
const { createHash } = require('node:crypto')
const reportError = (area, error) => console.error(`[${area}]`, error?.message || error)
const caches = new WeakMap()
const DAY = 86_400_000
const normalizeJid = jid => String(jid || '').replace(/:\d+@/, '@')
const ntime = value => Number(value?.toNumber?.() ?? value ?? 0)
function persist(state) {
  if (!state.file) return
  try {
    mkdirSync(state.dir, { recursive: true, mode: 0o700 })
    const tmp = state.file + '.tmp'
    writeFileSync(tmp, JSON.stringify({ version: 1, next: state.next, entries: [...state.entries] }), { mode: 0o600 })
    chmodSync(tmp, 0o600); renameSync(tmp, state.file)
  } catch (e) { reportError('status-storage', e) }
}
function stateFor(conn) {
  let state = caches.get(conn)
  const identity = normalizeJid(conn.user?.jid || conn.user?.id)
  if (state && state.account !== identity) { persist(state); caches.delete(conn); state = null }
  if (!state) {
    state = { entries: new Map(), next: 1, last: 0, busy: false, account: identity }
    const account = normalizeJid(conn.user?.jid || conn.user?.id)
    if (account && conn.statusStorageDir !== false) {
      state.dir = resolve(conn.statusStorageDir || 'data/status')
      state.file = join(state.dir, createHash('sha256').update(account).digest('hex').slice(0, 24) + '.json')
      try {
        const text = readFileSync(state.file, 'utf8')
        if (Buffer.byteLength(text) > 32 * 1024 * 1024) throw new Error('Status cache exceeds 32 MiB')
        const saved = JSON.parse(text, (k,v) => v?.type === 'Buffer' && Array.isArray(v.data) ? Buffer.from(v.data) : v)
        if (saved.version === 1 && Array.isArray(saved.entries)) {
          state.entries = new Map(saved.entries.slice(-500).filter(pair => Array.isArray(pair) && typeof pair[0] === 'string' && pair[1] && Number.isFinite(pair[1].expiresAt)))
          state.next = Math.max(Number(saved.next) || 1, ...[...state.entries.values()].map(e => Number(e.id?.slice(1)) + 1 || 1))
        }
      } catch (e) { if (e.code !== 'ENOENT') reportError('status-storage', e) }
    }
    caches.set(conn, state); prune(state)
  }
  return state
}
function retire(entry, status, now) {
  entry.availability = status
  entry[status === 'deleted' ? 'deletedAt' : 'expiredAt'] = now
  entry.raw = null; entry.value = {}; entry.text = ''; entry.type = ''
}
function prune(state, now = Date.now()) {
  let changed = false
  for (const [key, entry] of state.entries) {
    if (entry.expiresAt + DAY <= now) { state.entries.delete(key); changed = true }
    else if (entry.expiresAt <= now && !['expired', 'deleted'].includes(entry.availability)) { retire(entry, 'expired', now); changed = true }
  }
  while (state.entries.size > 500) { const key = state.entries.keys().next().value; retire(state.entries.get(key), 'expired', now); state.entries.delete(key); changed = true }
  if (changed) persist(state)
}
function markStatusDeleted(conn, key) {
  if (!key?.id || key.remoteJid && key.remoteJid !== 'status@broadcast') return 0
  const state = stateFor(conn); let count = 0
  for (const entry of state.entries.values()) {
    if (entry.sourceKey?.id === key.id && (!key.participant || entry.author === normalizeJid(key.participant))) {
      retire(entry, 'deleted', Date.now()); count++
    }
  }
  if (count) persist(state)
  return count
}
function flushStatuses(conn) { const state = stateFor(conn); prune(state); persist(state) }
function statusContent(message = {}) {
  let current = message
  const wrappers = []
  const contexts = []
  for (let i = 0; i < 12 && current; i++) {
    for (const value of Object.values(current)) if (value?.contextInfo) contexts.push(value.contextInfo)
    const key = ['deviceSentMessage', 'ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension',
      'documentWithCaptionMessage', 'statusMentionMessage', 'groupStatusMentionMessage', 'groupStatusMessage', 'groupStatusMessageV2']
      .find(name => current[name]?.message)
    if (!key) break
    wrappers.push(key); current = current[key].message
  }
  const type = ['conversation', 'extendedTextMessage', 'imageMessage', 'videoMessage', 'audioMessage', 'documentMessage', 'stickerMessage']
    .find(name => current?.[name] != null) || ''
  const value = type === 'conversation' ? { text: current.conversation } : (current?.[type] || {})
  return { message: current, type, value, contexts, wrappers }
}
function validStatusKey(key) { return !!(key?.id && key.remoteJid === 'status@broadcast') }
function captureStatus(raw, conn) {
  if (!raw?.key || !raw.message) return null
  const state = stateFor(conn); prune(state)
  const broadcast = raw.key.remoteJid === 'status@broadcast'
  const outer = statusContent(raw.message)
  const protocol = outer.message?.protocolMessage
  const revoked = protocol && (protocol.type === 0 || protocol.type === 'REVOKE')
  if (revoked && (broadcast || validStatusKey(protocol.key))) {
    markStatusDeleted(conn, { ...protocol.key, remoteJid: 'status@broadcast', participant: protocol.key?.participant || raw.key.participant || raw.participant })
    return null
  }
  const mentionEnvelope = outer.wrappers.some(w => /status/i.test(w)) || raw.isMentionedInStatus === true ||
    !!raw.statusMentionMessageInfo || protocol?.type === 25 || protocol?.type === 'STATUS_MENTION_MESSAGE'
  if (!broadcast && !mentionEnvelope) return null
  if (broadcast && (protocol || outer.message?.reactionMessage || outer.message?.senderKeyDistributionMessage && !outer.type)) return null
  let info = outer
  const quotedStatus = raw.statusMentionMessageInfo?.quotedStatus
  if (quotedStatus) info = statusContent(quotedStatus)
  const contexts = [...outer.contexts, ...info.contexts]
  let sourceKey = broadcast ? { ...raw.key } : null
  const possibleKeys = [raw.targetMessageId, protocol?.key, ...contexts.map(c => c.placeholderKey)]
  if (!sourceKey) sourceKey = possibleKeys.find(validStatusKey) || null
  if (!sourceKey) {
    const ctx = contexts.find(c => c.remoteJid === 'status@broadcast' && c.stanzaId && c.participant)
    if (ctx) sourceKey = { remoteJid: 'status@broadcast', id: ctx.stanzaId, participant: ctx.participant, fromMe: false }
  }
  const author = normalizeJid(sourceKey?.participant || (broadcast ? raw.participant : '') ||
    contexts.find(c => c.remoteJid === 'status@broadcast')?.participant || '')
  if (sourceKey) sourceKey = { ...sourceKey, participant: author || sourceKey.participant }
  const sender = normalizeJid(raw.key.participant || (broadcast ? raw.participant : raw.key.remoteJid))
  const now = Date.now()
  const seconds = ntime(raw.messageTimestamp)
  const publishedAt = broadcast && seconds > 0 ? seconds * 1000 : null
  if (publishedAt && (now - publishedAt >= DAY || publishedAt > now + 300_000)) return null
  const identity = sourceKey?.id ? `${author || sender}:${sourceKey.id}` : `notice:${raw.key.remoteJid}:${raw.key.id}`
  const old = state.entries.get(identity)
  if (old && ['deleted', 'expired'].includes(old.availability)) return null
  const groups = new Map(old?.groups?.map(g => [g.jid, g]) || [])
  const mentions = new Set(old?.mentions || [])
  for (const ctx of contexts) {
    for (const jid of ctx.mentionedJid || []) mentions.add(normalizeJid(jid))
    for (const group of ctx.groupMentions || []) if (group.groupJid) groups.set(group.groupJid, { jid: group.groupJid, name: group.groupSubject || '' })
    if (ctx.parentGroupJid) groups.set(ctx.parentGroupJid, { jid: ctx.parentGroupJid, name: ctx.groupSubject || '' })
  }
  for (const jid of [...(raw.statusMentions || []), ...(raw.statusMentionSources || [])]) {
    if (String(jid).endsWith('@g.us')) groups.set(jid, { jid, name: groups.get(jid)?.name || '' })
    else if (String(jid).includes('@')) mentions.add(normalizeJid(jid))
  }
  const groupChat = String(raw.key.remoteJid).endsWith('@g.us')
  if (groupChat && mentionEnvelope && !groups.has(raw.key.remoteJid)) groups.set(raw.key.remoteJid, { jid: raw.key.remoteJid, name: '' })
  const isGroup = groups.size > 0 || outer.wrappers.some(w => /groupStatus/.test(w)) || contexts.some(c => c.isGroupStatus)
  const forwarded = contexts.some(c => c.isForwarded || Number(c.forwardingScore) > 0 ||
    c.statusAttributions?.some(a => a.statusReshare))
  const content = info.type ? info : (old ? { type: old.type, value: old.value, message: old.raw?.message } : info)
   
   
  try { if (JSON.stringify(raw).length > 512 * 1024) return null } catch { return null }
  const entry = {
    ...(old || {}), availability: 'received', id: old?.id || `E${state.next++}`, author: author || old?.author || '',
    sender: sender || old?.sender || '', name: raw.pushName || old?.name || '',
    sourceKey: sourceKey || old?.sourceKey || null,
    raw: content.type ? { ...raw, key: sourceKey || raw.key, message: content.message } : old?.raw || null,
    type: content.type || '', value: content.value || {}, text: String(content.value?.text || content.value?.caption || old?.text || ''),
    receivedAt: old?.receivedAt || now, publishedAt: publishedAt || old?.publishedAt || null,
    expiresAt: Math.min(old?.expiresAt || Infinity, (publishedAt || now) + DAY),
    origin: broadcast ? (old?.origin && old.origin !== 'Estado recibido' ? old.origin : 'Estado recibido') :
      isGroup ? 'Mención/estado compartido en grupo' : 'Mención/estado compartido en privado',
    forwarded: !!(old?.forwarded || forwarded), groups: [...groups.values()], mentions: [...mentions],
    mentionDetected: !!(old?.mentionDetected || mentionEnvelope),
    viewOnce: !!(old?.viewOnce || info.wrappers.some(w => /viewOnce/.test(w))),
    routes: [...new Set([...(old?.routes || []), raw.key.remoteJid])]
  }
  const stored = old ? Object.assign(old, entry) : entry
  state.entries.set(identity, stored); prune(state); persist(state)
  return stored
}
function listStatuses(conn, includeUnavailable = false) { const state = stateFor(conn); prune(state); return [...state.entries.values()].filter(e => includeUnavailable || !['deleted', 'expired'].includes(e.availability)).sort((a, b) => a.receivedAt - b.receivedAt) }
function findStatus(conn, selector = '') {
  const id = /^\d+$/.test(selector) ? `E${selector}` : String(selector).toUpperCase()
  return listStatuses(conn, true).find(entry => entry.id === id || entry.sourceKey?.id === selector)
}
function clearStatuses(conn) { const state = stateFor(conn); const count = state.entries.size; for (const entry of state.entries.values()) retire(entry, 'expired', Date.now()); state.entries.clear(); persist(state); return count }
async function handleStatus(raw, conn, settings = {}) {
  if (raw?.key?.remoteJid !== 'status@broadcast') return false
  const entry = captureStatus(raw, conn)
  if (entry && settings.statusSave) {
    try { await require('./status-archive').handleStatusArchive(conn, entry, settings, settings.archiveOptions || {}) }
    catch (error) { reportError('status-archive', error) }
  }
  return true
}

exports.markStatusDeleted = markStatusDeleted;
exports.flushStatuses = flushStatuses;
exports.statusContent = statusContent;
exports.captureStatus = captureStatus;
exports.listStatuses = listStatuses;
exports.findStatus = findStatus;
exports.clearStatuses = clearStatuses;
exports.handleStatus = handleStatus;

