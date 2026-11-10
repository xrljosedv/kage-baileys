import makeWASocket, { proto, type SocketConfig, type WASocket, type WAMessage } from '../lib/index.js';

const message: WAMessage = proto.WebMessageInfo.create({ key: { id: 'test', remoteJid: 'test@s.whatsapp.net' }, message: { conversation: 'test' } });
const config: SocketConfig = {
 auth: { creds: {}, keys: {} },
 syncFullHistory: false,
 shouldSyncHistoryMessage: notification => Boolean(notification),
 getMessage: async () => message.message || undefined
};
const factory: (options: SocketConfig) => WASocket = makeWASocket;
void config;
void factory;
