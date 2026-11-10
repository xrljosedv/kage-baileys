'use strict';
/**
 * lid-username-utils.js
 * Utilidades avanzadas de Usernames + LIDs (estilo Ryzewa / Davizuni17)
 * Compatible con Kage Baileys / WhiskeySockets v7+
 *
 * Funciones:
 *  - getUsernameFromKey(key)
 *  - resolveLidToPN(lidJid, sock, msgKey)
 *  - convertLidMentions(text, mentions, sock)
 *  - convertSenderIfLid(m, sock)
 *  - handleIdentityChange (re-export + mejoras)
 *  - Helpers de validación E.164 y username
 */

const { jidDecode, areJidsSameUser, isJidUser, isLidUser, isJidGroup } = require('../WABinary');
const { handleIdentityChange: baseHandleIdentityChange } = require('./identity-change-handler');

// ─────────────────────────────────────────────
// 1. Caché en memoria para LID → PN (Capa 1)
// ─────────────────────────────────────────────
const lidToPnCache = new Map(); // lidUser → pnUser (sin @server)
const pnToLidCache = new Map(); // pnUser → lidUser

/** Actualiza la caché cuando llega el evento lid-mapping.update */
function onLidMappingUpdate(mappings = []) {
    for (const m of mappings) {
        if (!m) continue;
        const lid = typeof m.lid === 'string' ? m.lid : m.lidJid;
        const pn  = typeof m.pn  === 'string' ? m.pn  : m.pnJid;
        if (!lid || !pn) continue;

        const lidDecoded = jidDecode(lid);
        const pnDecoded  = jidDecode(pn);
        if (!lidDecoded || !pnDecoded) continue;

        lidToPnCache.set(lidDecoded.user, pnDecoded.user);
        pnToLidCache.set(pnDecoded.user, lidDecoded.user);
    }
}

/** Instala el listener del evento lid-mapping.update en el socket */
function installLidCacheListener(sock) {
    if (!sock || !sock.ev) return;
    const handler = (update) => {
        try {
            const list = Array.isArray(update) ? update : (update?.mappings || update?.list || []);
            onLidMappingUpdate(list);
        } catch (_) { /* silencioso */ }
    };
    sock.ev.on('lid-mapping.update', handler);
    // También escuchamos contacts.update por si traen username/LID
    sock.ev.on('contacts.update', (contacts) => {
        if (!Array.isArray(contacts)) return;
        for (const c of contacts) {
            if (c.id && c.lid) {
                try {
                    const lidDec = jidDecode(c.lid);
                    const pnDec  = jidDecode(c.id);
                    if (lidDec && pnDec) {
                        lidToPnCache.set(lidDec.user, pnDec.user);
                        pnToLidCache.set(pnDec.user, lidDec.user);
                    }
                } catch (_) {}
            }
        }
    });
    return () => {
        sock.ev.off('lid-mapping.update', handler);
    };
}

// ─────────────────────────────────────────────
// 2. getUsernameFromKey(key)  – Extracción nativa
// ─────────────────────────────────────────────
/**
 * Extrae el username limpio (sin @) de una WAMessageKey.
 * @param {import('@whiskeysockets/baileys').WAMessageKey} key
 * @returns {string|null}
 */
function getUsernameFromKey(key) {
    if (!key || typeof key !== 'object') return null;

    // Preferencia: participantUsername (grupos) → remoteJidUsername (privados)
    const raw =
        (typeof key.participantUsername === 'string' && key.participantUsername) ||
        (typeof key.remoteJidUsername   === 'string' && key.remoteJidUsername)   ||
        null;

    if (!raw) return null;

    // Limpiar @ inicial y espacios
    const cleaned = raw.trim().replace(/^@+/, '');
    if (!cleaned || cleaned.length === 0) return null;

    // Rechazar si parece un ID numérico puro (no es username real)
    if (/^\d+$/.test(cleaned)) return null;

    return cleaned;
}

// ─────────────────────────────────────────────
// 3. resolveLidToPN – Resolución multi-capa
// ─────────────────────────────────────────────
/**
 * Resuelve un JID @lid a su PN (@s.whatsapp.net) usando capas en orden:
 *  1. Caché en memoria
 *  2. signalRepository.lidMapping.getPNForLID
 *  3. msgKey.senderPn / msgKey.participantPn
 * Nunca inventa números.
 *
 * @param {string} lidJid
 * @param {import('@whiskeysockets/baileys').WASocket} sock
 * @param {import('@whiskeysockets/baileys').WAMessageKey} [msgKey]
 * @returns {Promise<string|null>}  JID completo @s.whatsapp.net o null
 */
async function resolveLidToPN(lidJid, sock, msgKey = null) {
    if (!lidJid || typeof lidJid !== 'string') return null;

    // Si ya es un PN válido, devolverlo normalizado
    if (isJidUser(lidJid) && !isLidUser(lidJid)) {
        const dec = jidDecode(lidJid);
        return dec ? `${dec.user}@s.whatsapp.net` : null;
    }

    if (!isLidUser(lidJid)) return null;

    const decoded = jidDecode(lidJid);
    if (!decoded || !decoded.user) return null;
    const lidUser = decoded.user;

    // ── Capa 1: Caché en memoria ──
    if (lidToPnCache.has(lidUser)) {
        const pnUser = lidToPnCache.get(lidUser);
        if (pnUser && isValidE164(pnUser)) {
            return `${pnUser}@s.whatsapp.net`;
        }
    }

    // ── Capa 2: signalRepository.lidMapping ──
    try {
        const repo = sock?.signalRepository || sock?.authState?.keys;
        const mapping = repo?.lidMapping;
        if (mapping && typeof mapping.getPNForLID === 'function') {
            const pn = await mapping.getPNForLID(lidJid);
            if (pn && typeof pn === 'string') {
                const pnDec = jidDecode(pn);
                if (pnDec && isValidE164(pnDec.user)) {
                    // Actualizar caché
                    lidToPnCache.set(lidUser, pnDec.user);
                    pnToLidCache.set(pnDec.user, lidUser);
                    return `${pnDec.user}@s.whatsapp.net`;
                }
            }
        }
    } catch (err) {
        // Nunca romper el bot por fallo de mapping
        if (sock?.logger) {
            sock.logger.debug?.({ err, lidJid }, 'resolveLidToPN: getPNForLID failed');
        }
    }

    // ── Capa 3: msgKey.senderPn / participantPn ──
    if (msgKey && typeof msgKey === 'object') {
        const candidates = [
            msgKey.senderPn,
            msgKey.participantPn,
            msgKey.sender_pn,       // por si viene en snake_case
            msgKey.participant_pn
        ].filter(Boolean);

        for (const cand of candidates) {
            if (typeof cand !== 'string') continue;
            const candDec = jidDecode(cand);
            if (candDec && isJidUser(cand) && isValidE164(candDec.user)) {
                lidToPnCache.set(lidUser, candDec.user);
                pnToLidCache.set(candDec.user, lidUser);
                return `${candDec.user}@s.whatsapp.net`;
            }
        }
    }

    return null; // Nunca inventar
}

// ─────────────────────────────────────────────
// 4. convertLidMentions – Conversión de menciones
// ─────────────────────────────────────────────
/**
 * Convierte menciones @lid a @s.whatsapp.net (o @username si está disponible)
 * antes de que el texto llegue a los comandos.
 *
 * @param {string} text
 * @param {string[]} mentions  Array de JIDs mencionados
 * @param {import('@whiskeysockets/baileys').WASocket} sock
 * @returns {Promise<{ text: string, mentions: string[] }>}
 */
async function convertLidMentions(text, mentions = [], sock) {
    if (!text || typeof text !== 'string') {
        return { text: text || '', mentions: Array.isArray(mentions) ? mentions : [] };
    }

    const newMentions = [];
    let newText = text;

    const list = Array.isArray(mentions) ? mentions : [];

    for (const jid of list) {
        if (!jid || typeof jid !== 'string') continue;

        if (isLidUser(jid)) {
            const pn = await resolveLidToPN(jid, sock);
            if (pn) {
                // Reemplazar en el texto la mención del LID por el PN
                const lidUser = jidDecode(jid)?.user;
                const pnUser  = jidDecode(pn)?.user;
                if (lidUser && pnUser) {
                    // WhatsApp usa @número en el texto para menciones
                    newText = newText
                        .split(`@${lidUser}`)
                        .join(`@${pnUser}`);
                }
                newMentions.push(pn);
            } else {
                // No se pudo resolver → dejar el LID
                newMentions.push(jid);
            }
        } else {
            newMentions.push(jid);
        }
    }

    return { text: newText, mentions: newMentions };
}

/**
 * Convierte m.sender si viene como @lid.
 * Devuelve el JID resuelto o el original si no se pudo.
 */
async function convertSenderIfLid(m, sock) {
    if (!m) return m;

    const sender = m.sender || m.key?.participant || m.key?.remoteJid;
    if (!sender || !isLidUser(sender)) return m;

    const pn = await resolveLidToPN(sender, sock, m.key);
    if (pn) {
        m.sender = pn;
        // También actualizar key si es necesario
        if (m.key) {
            if (isLidUser(m.key.participant)) m.key.participant = pn;
            if (isLidUser(m.key.remoteJid) && !isJidGroup(m.key.remoteJid)) {
                m.key.remoteJid = pn;
            }
        }
    }
    return m;
}

// ─────────────────────────────────────────────
// 5. handleIdentityChange (con debounce ya incluido en Kage)
// ─────────────────────────────────────────────
/**
 * Wrapper sobre el handleIdentityChange nativo de Kage.
 * Mantiene el debounceCache y el refresh de sesión Signal.
 */
async function handleIdentityChange(node, ctx) {
    return baseHandleIdentityChange(node, ctx);
}

// ─────────────────────────────────────────────
// 6. Validaciones
// ─────────────────────────────────────────────
/** Valida que un string sea un número E.164 razonable (solo dígitos, 7-15) */
function isValidE164(num) {
    if (typeof num !== 'string') return false;
    const cleaned = num.replace(/\D/g, '');
    return cleaned.length >= 7 && cleaned.length <= 15 && /^\d+$/.test(cleaned);
}

/** Valida que un username no sea un ID numérico */
function isValidUsername(name) {
    if (typeof name !== 'string') return false;
    const cleaned = name.trim().replace(/^@+/, '');
    if (!cleaned || cleaned.length > 128) return false;
    if (/^\d+$/.test(cleaned)) return false; // no numérico puro
    if (/[\s/@\u0000-\u001f]/.test(cleaned)) return false;
    return true;
}

// ─────────────────────────────────────────────
// 7. Middleware listo para messages.upsert
// ─────────────────────────────────────────────
/**
 * Middleware que se puede usar dentro de sock.ev.on('messages.upsert', ...)
 * Enriquece cada mensaje con:
 *  - m.username          (string|null)
 *  - m.senderResolved    (JID PN si se pudo resolver)
 *  - m.key.remoteJidUsername / participantUsername ya vienen de decode
 *
 * Uso:
 *   sock.ev.on('messages.upsert', async ({ messages, type }) => {
 *     for (const m of messages) {
 *       await enrichMessageWithLidUsername(m, sock);
 *       // ... tu lógica de comandos
 *     }
 *   });
 */
async function enrichMessageWithLidUsername(m, sock) {
    if (!m || !m.key) return m;

    // Username nativo
    m.username = getUsernameFromKey(m.key);

    // Resolver sender si es LID
    await convertSenderIfLid(m, sock);
    m.senderResolved = m.sender || m.key.participant || m.key.remoteJid;

    // Convertir menciones del cuerpo del mensaje si existen
    const msg = m.message;
    if (msg) {
        const text =
            msg.conversation ||
            msg.extendedTextMessage?.text ||
            msg.imageMessage?.caption ||
            msg.videoMessage?.caption ||
            msg.documentMessage?.caption ||
            '';

        const ctxInfo =
            msg.extendedTextMessage?.contextInfo ||
            msg.imageMessage?.contextInfo ||
            msg.videoMessage?.contextInfo ||
            msg.documentMessage?.contextInfo ||
            {};

        if (text && Array.isArray(ctxInfo.mentionedJid) && ctxInfo.mentionedJid.length) {
            const { text: newText, mentions: newMentions } = await convertLidMentions(
                text,
                ctxInfo.mentionedJid,
                sock
            );
            // Actualizar el texto y las menciones (solo en memoria para el bot)
            m.mentionedJidResolved = newMentions;
            m.textResolved = newText;
        }
    }

    return m;
}

// ─────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────
module.exports = {
    // Principales
    getUsernameFromKey,
    resolveLidToPN,
    convertLidMentions,
    convertSenderIfLid,
    handleIdentityChange,
    enrichMessageWithLidUsername,

    // Caché
    lidToPnCache,
    pnToLidCache,
    onLidMappingUpdate,
    installLidCacheListener,

    // Validación
    isValidE164,
    isValidUsername
};
