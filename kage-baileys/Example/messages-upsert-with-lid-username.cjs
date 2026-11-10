'use strict';
/**
 * Ejemplo de integración completa de Usernames + LIDs
 * en el evento messages.upsert de Kage Baileys.
 */

const {
    getUsernameFromKey,
    resolveLidToPN,
    convertLidMentions,
    convertSenderIfLid,
    enrichMessageWithLidUsername,
    installLidCacheListener,
    handleIdentityChange
} = require('../lib/Utils/lid-username-utils');

/**
 * Llama esto UNA vez después de crear el socket.
 */
function setupLidUsername(sock) {
    // 1. Caché de LID ↔ PN
    installLidCacheListener(sock);

    // 2. Identity change (ya está en Kage, pero lo dejamos explícito)
    // Kage ya escucha los nodos <identity> internamente.
    // Si quieres forzar el handler:
    // sock.ws.on('CB:notification,type:identity', async (node) => {
    //     await handleIdentityChange(node, {
    //         logger: sock.logger,
    //         meId: sock.user?.id,
    //         meLid: sock.user?.lid,
    //         debounceCache: sock._identityDebounce || (sock._identityDebounce = new Map()),
    //         validateSession: (jid) => sock.validateSession?.(jid) || { exists: false },
    //         assertSessions: (jids, force) => sock.assertSessions(jids, force)
    //     });
    // });
}

/**
 * Middleware listo para usar en messages.upsert
 */
async function onMessagesUpsert({ messages, type }, sock, commandHandler) {
    for (let m of messages) {
        // Enriquecer con username + resolución de LID
        m = await enrichMessageWithLidUsername(m, sock);

        // Ahora tienes disponibles:
        // m.username              → string|null  (sin @)
        // m.senderResolved        → JID PN si se pudo
        // m.textResolved          → texto con menciones convertidas
        // m.mentionedJidResolved  → array de JIDs convertidos
        // m.key.remoteJidUsername
        // m.key.participantUsername

        // Ejemplo de uso en comandos:
        if (typeof commandHandler === 'function') {
            await commandHandler(m, sock);
        }
    }
}

/**
 * Ejemplo mínimo de bot
 */
/*
const { default: makeWASocket, useMultiFileAuthState } = require('kage-baileys'); // o tu path

async function start() {
    const { state, saveCreds } = await useMultiFileAuthState('auth');
    const sock = makeWASocket({
        auth: state,
        // ... tus opciones
    });

    setupLidUsername(sock);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (upsert) => {
        await onMessagesUpsert(upsert, sock, async (m, sock) => {
            const text = m.textResolved || m.message?.conversation || m.message?.extendedTextMessage?.text || '';
            const cmd = text.trim().split(/\s+/)[0]?.toLowerCase();

            if (cmd === '!perfil' || cmd === '.perfil') {
                const { handleProfileCommand } = require('./profile-command.cjs');
                await handleProfileCommand(m, sock);
            }

            // Ejemplo: mostrar username del que escribió
            if (cmd === '!quien') {
                const uname = m.username || getUsernameFromKey(m.key);
                const sender = m.senderResolved || m.sender;
                await sock.sendMessage(m.key.remoteJid, {
                    text: uname
                        ? `Eres @${uname} (${sender})`
                        : `No tienes username público. JID: ${sender}`
                }, { quoted: m });
            }
        });
    });
}

start().catch(console.error);
*/

module.exports = {
    setupLidUsername,
    onMessagesUpsert
};
