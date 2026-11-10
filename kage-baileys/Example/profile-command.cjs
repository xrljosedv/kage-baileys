'use strict';
/**
 * Ejemplo de comando de perfil (Dark / Anime style)
 * con las reglas de visualización de Usernames + LIDs.
 *
 * Requiere:
 *  - Kage Baileys
 *  - lib/Utils/lid-username-utils.js
 *  - opcional: awesome-phonenumber
 */

const {
    getUsernameFromKey,
    resolveLidToPN,
    isValidE164,
    isValidUsername,
    enrichMessageWithLidUsername
} = require('../lib/Utils/lid-username-utils');

// Opcional: si tienes awesome-phonenumber instalado
let PhoneNumber = null;
try {
    PhoneNumber = require('awesome-phonenumber');
} catch (_) {
    // fallback simple
}

/**
 * Formatea el número con awesome-phonenumber o fallback.
 * @returns {string|null}
 */
function formatPhone(pnUser) {
    if (!pnUser || !isValidE164(pnUser)) return null;
    try {
        if (PhoneNumber) {
            const pn = new PhoneNumber('+' + pnUser);
            if (pn.isValid()) {
                return pn.getNumber('international') || ('+' + pnUser);
            }
        }
        return '+' + pnUser;
    } catch {
        return '+' + pnUser;
    }
}

/**
 * Obtiene el nombre de país con Intl.DisplayNames
 */
function getCountryName(pnUser, locale = 'es') {
    if (!pnUser || !isValidE164(pnUser)) return 'No disponible 🏳️';
    try {
        // Extraer código de país aproximado (primeros 1-3 dígitos)
        // Mejor: usar libphonenumber si está disponible
        if (PhoneNumber) {
            const pn = new PhoneNumber('+' + pnUser);
            const region = pn.getRegionCode();
            if (region) {
                const dn = new Intl.DisplayNames([locale], { type: 'region' });
                return dn.of(region) || region;
            }
        }
        return 'No disponible 🏳️';
    } catch {
        return 'No disponible 🏳️';
    }
}

/**
 * Construye el texto del perfil según las reglas solicitadas.
 *
 * Reglas:
 * - Nombre (Nᦅmbrε): DB > @username > "Todavía no se registra"
 * - Usεr: solo si existe username público
 * - Númεrᦅ: formateado si hay PN válido, si no "Oculto por nombre de usuario 🔒"
 * - Nacionalidad: Intl si hay número, si no "No disponible 🏳️"
 * - Link: wa.me/numero | wa.me/username | "No disponible 🔒"
 *
 * @param {object} opts
 * @param {string} opts.jid          JID del usuario (puede ser @lid o @s.whatsapp.net)
 * @param {string|null} opts.dbName  Nombre registrado en tu base de datos
 * @param {string|null} opts.username Username público (sin @)
 * @param {string|null} opts.pn      Número real (solo dígitos o JID)
 * @param {import('@whiskeysockets/baileys').WASocket} opts.sock
 * @param {import('@whiskeysockets/baileys').WAMessageKey} [opts.msgKey]
 */
async function buildProfileText({ jid, dbName = null, username = null, pn = null, sock, msgKey = null }) {
    // Resolver PN si el jid es LID
    let resolvedPn = pn;
    if (!resolvedPn && jid) {
        const maybe = await resolveLidToPN(jid, sock, msgKey);
        if (maybe) {
            const dec = require('../WABinary').jidDecode(maybe);
            resolvedPn = dec ? dec.user : null;
        } else if (isValidE164(jid.replace(/\D/g, ''))) {
            resolvedPn = jid.replace(/\D/g, '');
        }
    }

    // Username limpio
    let cleanUsername = null;
    if (username && isValidUsername(username)) {
        cleanUsername = username.replace(/^@+/, '');
    }

    // ── Nombre ──
    let nombre;
    if (dbName && typeof dbName === 'string' && dbName.trim()) {
        nombre = dbName.trim();
    } else if (cleanUsername) {
        nombre = '@' + cleanUsername;
    } else {
        nombre = 'Todavía no se registra';
    }

    // ── Línea User (solo si hay username público) ──
    const userLine = cleanUsername
        ? `\n> *₊·や✿ね Usεr* » @${cleanUsername}`
        : '';

    // ── Número ──
    let numeroTexto;
    const formatted = formatPhone(resolvedPn);
    if (formatted) {
        numeroTexto = formatted;
    } else {
        numeroTexto = 'Oculto por nombre de usuario 🔒';
    }

    // ── Nacionalidad ──
    const nacionalidad = getCountryName(resolvedPn);

    // ── Link ──
    let link;
    if (resolvedPn && isValidE164(resolvedPn)) {
        link = `https://wa.me/${resolvedPn}`;
    } else if (cleanUsername) {
        link = `https://wa.me/${cleanUsername}`;
    } else {
        link = 'No disponible 🔒';
    }

    // Texto final estilo Dark/Anime
    const text =
`╭───「 *Pᥱrϝil* 」───╮
│
│  *Nᦅmbrε* » ${nombre}${userLine}
│  *Númεrᦅ* » ${numeroTexto}
│  *Nαcιόn* » ${nacionalidad}
│  *Lιnk* » ${link}
│
╰──────────────────╯`;

    return text;
}

/**
 * Handler de ejemplo para el comando de perfil.
 * Úsalo dentro de tu messages.upsert después de enrichMessageWithLidUsername.
 *
 * @example
 * sock.ev.on('messages.upsert', async ({ messages }) => {
 *   for (let m of messages) {
 *     m = await enrichMessageWithLidUsername(m, sock);
 *     if (m.message?.conversation?.startsWith('!perfil') || ...) {
 *       await handleProfileCommand(m, sock, tuDB);
 *     }
 *   }
 * });
 */
async function handleProfileCommand(m, sock, db = null) {
    // Quién está pidiendo el perfil (puede ser mención o el propio sender)
    const mentioned = m.mentionedJidResolved || m.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    const targetJid = mentioned[0] || m.senderResolved || m.sender || m.key.participant || m.key.remoteJid;

    // Username del key (si viene)
    const usernameFromKey = getUsernameFromKey(m.key);

    // Datos de DB (ajusta a tu esquema)
    let dbName = null;
    let dbUsername = null;
    if (db && typeof db.getUser === 'function') {
        try {
            const user = await db.getUser(targetJid);
            dbName = user?.name || user?.nombre || null;
            dbUsername = user?.username || null;
        } catch (_) {}
    }

    const text = await buildProfileText({
        jid: targetJid,
        dbName,
        username: dbUsername || usernameFromKey || m.username,
        pn: null, // se resuelve internamente
        sock,
        msgKey: m.key
    });

    await sock.sendMessage(m.key.remoteJid, { text }, { quoted: m });
}

module.exports = {
    buildProfileText,
    handleProfileCommand,
    formatPhone,
    getCountryName
};
