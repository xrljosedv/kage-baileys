'use strict';
// Node.js >=20.18.1 (recommended: Node.js 22 LTS).
// Run from the project directory with: npm run example
const path = require('path');
const fs = require('fs');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const { default: makeWASocket, useMultiFileAuthState, makeCacheableSignalKeyStore, makeInMemoryStore, Browsers } = require('../lib');
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const dataDir = path.resolve(process.env.KAGE_DATA_DIR || './data');
fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
const storeFile = path.join(dataDir, 'store.json');
const store = makeInMemoryStore({ logger });
// Restore local chats and messages immediately, before waiting for network history.
store.readFromFile(storeFile);
let sock, auth, attempts = 0, reconnectTimer, saveTimer, shuttingDown = false;
let credsWrite = Promise.resolve();
const terminalCodes = new Set([401, 403, 411, 419, 440, 500]);
function persistSoon() {
    if (saveTimer || shuttingDown) return;
    saveTimer = setTimeout(() => {
        saveTimer = undefined;
        store.writeToFileAsync(storeFile).catch(error => logger.error({ error }, 'No se pudo guardar el historial'));
    }, 2000);
    saveTimer.unref();
}
async function connect() {
    if (shuttingDown) return;
    auth ||= await useMultiFileAuthState(path.join(dataDir, 'auth'));
    sock = makeWASocket({
        logger,
        kageTools: { banner: true, eventTracking: true, statusTracking: true },
        auth: { creds: auth.state.creds, keys: makeCacheableSignalKeyStore(auth.state.keys, logger) },
        browser: Browsers.macOS('Desktop'),
        syncFullHistory: process.env.KAGE_FULL_HISTORY !== '0',
        shouldSyncHistoryMessage: () => true,
        markOnlineOnConnect: false,
        // Releases the initial wait sooner if the server sends no history notification.
        // This does not accelerate server downloads and does not disable app-state sync.
        initialSyncTimeoutMs: 5000,
        getMessage: async key => (await store.loadMessage(key.remoteJid, key.id))?.message
    });
    store.bind(sock.ev);
    sock.ev.on('kage.event', event => {
        if (['call', 'unsupported'].includes(event.kind)) logger.info(event, 'Evento detectado');
    });
    sock.ev.on('creds.update', () => {
        credsWrite = credsWrite.then(() => auth.saveCreds()).catch(error => {
            logger.error({ error }, 'Error de escritura de credenciales; se detiene para no perder la sesión');
            shutdown(1).catch(fatal => { logger.error({ fatal }); process.exitCode = 1; });
        });
    });
    sock.ev.on('messaging-history.set', ({ chats, contacts, messages, progress }) => {
        logger.info({ chats: chats.length, contacts: contacts.length, messages: messages.length, progress }, 'Historial recibido');
        persistSoon();
    });
    sock.ev.on('messages.upsert', ({ messages, type }) => {
        // Never wait for all history to process incoming live messages.
        for (const message of messages) logger.debug({ key: message.key, type }, 'Mensaje recibido');
        persistSoon();
    });
    for (const event of ['messages.update', 'messages.delete', 'chats.update', 'chats.upsert', 'chats.delete', 'contacts.update', 'contacts.upsert']) {
        sock.ev.on(event, persistSoon);
    }
    sock.ev.on('connection.update', ({ connection, qr, lastDisconnect }) => {
        if (qr) qrcode.generate(qr, { small: true });
        if (connection === 'open') {
            logger.info('Conectado. Los datos locales ya están disponibles; el historial remoto llega de forma asíncrona.');
            // Reset backoff only after a stable connection to prevent rapid open/close loops.
            const currentSocket = sock;
            const stable = setTimeout(() => { if (sock === currentSocket && !shuttingDown) attempts = 0; }, 60000);
            stable.unref();
        }
        if (connection !== 'close' || shuttingDown) return;
        const error = lastDisconnect?.error;
        const code = error?.output?.statusCode ?? error?.statusCode;
        if (terminalCodes.has(code) || attempts >= 8) {
            logger.error({ code, attempts }, 'Reconexión detenida. Revisa la cuenta o sesión manualmente; no se borran credenciales.');
            shutdown(1).catch(fatal => { logger.error({ fatal }); process.exitCode = 1; });
            return;
        }
        const delay = code === 515 ? 1000 : Math.min(60000, 2000 * 2 ** attempts) + Math.floor(Math.random() * 1000);
        attempts++;
        clearTimeout(reconnectTimer);
        logger.warn({ code, delay, attempts }, 'Reconexión limitada con espera progresiva');
        reconnectTimer = setTimeout(() => connect().catch(fatal => {
            logger.error({ fatal }, 'No se pudo reconectar');
            shutdown(1).catch(error => { logger.error({ error }); process.exitCode = 1; });
        }), delay);
    });
}
async function shutdown(code = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    clearTimeout(reconnectTimer); clearTimeout(saveTimer);
    sock?.end(new Error('Cierre solicitado'));
    await store.writeToFileAsync(storeFile);
    // No logout(): closing the example must not unlink the device.
    process.exitCode = code;
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
    shutdown().catch(error => { logger.error({ error }); process.exitCode = 1; });
});
connect().catch(error => { logger.error({ error }, 'Error de arranque; conserva tu carpeta de sesión y revisa el problema'); process.exitCode = 1; });
