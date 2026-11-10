"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHistoryMsg = exports.downloadAndProcessHistorySyncNotification = exports.processHistoryMessage = exports.downloadHistory = void 0;
const util_1 = require("util");
const zlib_1 = require("zlib");
const WAProto_1 = require("../../WAProto");
const Types_1 = require("../Types");
const WABinary_1 = require("../WABinary");
const generics_1 = require("./generics");
const messages_1 = require("./messages");
const messages_media_1 = require("./messages-media");
const inflatePromise = (0, util_1.promisify)(zlib_1.inflate);
const downloadHistory = async (msg, options) => {
    const stream = await (0, messages_media_1.downloadContentFromMessage)(msg, 'md-msg-hist', { options });
    const bufferArray = [];
    for await (const chunk of stream) {
        bufferArray.push(chunk);
    }
    let buffer = Buffer.concat(bufferArray);
    // decompress buffer
    buffer = await inflatePromise(buffer);
    const syncData = WAProto_1.proto.HistorySync.decode(buffer);
    return syncData;
};
exports.downloadHistory = downloadHistory;
const processHistoryMessage = (item) => {
    var _a, _b, _c;
    const messages = [];
    const contacts = [];
    const chats = [];
    switch (item.syncType) {
        case WAProto_1.proto.HistorySync.HistorySyncType.INITIAL_BOOTSTRAP:
        case WAProto_1.proto.HistorySync.HistorySyncType.RECENT:
        case WAProto_1.proto.HistorySync.HistorySyncType.FULL:
        case WAProto_1.proto.HistorySync.HistorySyncType.ON_DEMAND:
            for (const sourceChat of item.conversations || []) {
                if (!sourceChat || !sourceChat.id) continue;
                const chat = { ...sourceChat };
                contacts.push({ id: chat.id, name: chat.name || undefined, lid: chat.lidJid || undefined, jid: (0, WABinary_1.isJidUser)(chat.id) ? chat.id : chat.pnJid });
                const msgs = chat.messages || [];
                delete chat.messages;
                delete chat.archived;
                delete chat.muteEndTime;
                delete chat.pinned;
                for (const item of msgs) {
                    const message = item && item.message;
                    if (!message || !message.key || !message.key.remoteJid || !message.key.id) continue;
                    messages.push(message);
                    if (!chat.messages?.length || (0, generics_1.toNumber)(message.messageTimestamp || 0) > (0, generics_1.toNumber)(chat.messages[0].message.messageTimestamp || 0)) {
                        // keep only the most recent message in the chat array
                        chat.messages = [{ message }];
                    }
                    if (!message.key.fromMe && (0, generics_1.toNumber)(message.messageTimestamp || 0) > (0, generics_1.toNumber)(chat.lastMessageRecvTimestamp || 0)) {
                        chat.lastMessageRecvTimestamp = (0, generics_1.toNumber)(message.messageTimestamp);
                    }
                    if ((message.messageStubType === Types_1.WAMessageStubType.BIZ_PRIVACY_MODE_TO_BSP
                        || message.messageStubType === Types_1.WAMessageStubType.BIZ_PRIVACY_MODE_TO_FB)
                        && ((_b = message.messageStubParameters) === null || _b === void 0 ? void 0 : _b[0])) {
                        contacts.push({
                            id: message.key.participant || message.key.remoteJid,
                            verifiedName: (_c = message.messageStubParameters) === null || _c === void 0 ? void 0 : _c[0],
                        });
                    }
                }
                if ((0, WABinary_1.isJidUser)(chat.id) && chat.readOnly && sourceChat.archived) {
                    delete chat.readOnly;
                }
                chats.push({ ...chat });
            }
            break;
        case WAProto_1.proto.HistorySync.HistorySyncType.PUSH_NAME:
            for (const c of item.pushnames || []) {
                contacts.push({ id: c.id, notify: c.pushname });
            }
            break;
    }
    return {
        chats,
        contacts,
        messages,
        syncType: item.syncType,
        progress: item.progress
    };
};
exports.processHistoryMessage = processHistoryMessage;
const downloadAndProcessHistorySyncNotification = async (msg, options) => {
    const historyMsg = await (0, exports.downloadHistory)(msg, options);
    return (0, exports.processHistoryMessage)(historyMsg);
};
exports.downloadAndProcessHistorySyncNotification = downloadAndProcessHistorySyncNotification;
const getHistoryMsg = (message) => {
    var _a;
    const normalizedContent = !!message ? (0, messages_1.normalizeMessageContent)(message) : undefined;
    const anyHistoryMsg = (_a = normalizedContent === null || normalizedContent === void 0 ? void 0 : normalizedContent.protocolMessage) === null || _a === void 0 ? void 0 : _a.historySyncNotification;
    return anyHistoryMsg;
};
exports.getHistoryMsg = getHistoryMsg;

// Kage: compatibilidad de API.
const __kageModule66 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { promisify } = require("util")
const { inflate } = require("zlib")
const { proto } = require("../../WAProto")
const { WAMessageStubType } = require("../Types")
const { toNumber } = require("./generics")
const { normalizeMessageContent } = require("./messages")
const { downloadContentFromMessage } = require("./messages-media")
const inflatePromise = promisify(inflate)

const downloadHistory = async (msg, options) => {
    const stream = await downloadContentFromMessage(msg, 'md-msg-hist', { options })
    const bufferArray = []
    for await (const chunk of stream) {
        bufferArray.push(chunk)
    }
    let buffer = Buffer.concat(bufferArray)
    // decompress buffer
    buffer = await inflatePromise(buffer)
    const syncData = proto.HistorySync.decode(buffer)
    return syncData
}

const processHistoryMessage = (item) => {
    const messages = []
    const contacts = []
    const chats = []
    switch (item.syncType) {
        case proto.HistorySync.HistorySyncType.INITIAL_BOOTSTRAP:
        case proto.HistorySync.HistorySyncType.RECENT:
        case proto.HistorySync.HistorySyncType.FULL:
        case proto.HistorySync.HistorySyncType.ON_DEMAND:
            for (const chat of item.conversations) {
                contacts.push({
                    id: chat.id,
                    name: chat.name || undefined,
                    lid: chat.lidJid || undefined,
                    phoneNumber: chat.pnJid || undefined
                })
                const msgs = chat.messages || []
                delete chat.messages
                for (const item of msgs) {
                    const message = item.message
                    messages.push(message)
                    if (!chat.messages?.length) {
                        // keep only the most recent message in the chat array
                        chat.messages = [{ message }]
                    }
                    if (!message.key.fromMe && !chat.lastMessageRecvTimestamp) {
                        chat.lastMessageRecvTimestamp = toNumber(message.messageTimestamp)
                    }
                    if (message.messageStubType === WAMessageStubType.BIZ_PRIVACY_MODE_TO_BSP
                        || message.messageStubType === WAMessageStubType.BIZ_PRIVACY_MODE_TO_FB
                        && message.messageStubParameters?.[0]) {
                        contacts.push({
                            id: message.key.participant || message.key.remoteJid,
                            verifiedName: message.messageStubParameters?.[0]
                        })
                    }
                }
                chats.push({ ...chat })
            }
            break
        case proto.HistorySync.HistorySyncType.PUSH_NAME:
            for (const c of item.pushnames) {
                contacts.push({ id: c.id, notify: c.pushname })
            }
            break
    }
    return {
        chats,
        contacts,
        messages,
        syncType: item.syncType,
        progress: item.progress
    }
}

const downloadAndProcessHistorySyncNotification = async (msg, options) => {
    let historyMsg
    
    if (msg.initialHistBootstrapInlinePayload) {
        historyMsg = proto.HistorySync.decode(await inflatePromise(msg.initialHistBootstrapInlinePayload))
    }
    else {
        historyMsg = await downloadHistory(msg, options)
    }
    
    return processHistoryMessage(historyMsg)
}

const getHistoryMsg = (message) => {
    const normalizedContent = !!message ? normalizeMessageContent(message) : undefined
    const anyHistoryMsg = normalizedContent?.protocolMessage?.historySyncNotification
    return anyHistoryMsg
}

module.exports = {
  downloadHistory, 
  processHistoryMessage, 
  downloadAndProcessHistorySyncNotification, 
  getHistoryMsg
}
return module.exports;
})();
for (const key of Object.keys(__kageModule66)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule66[key]});
}

// Kage: funciones avanzadas.
const __kageModule170 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHistoryMsg = exports.downloadAndProcessHistorySyncNotification = exports.processHistoryMessage = exports.downloadHistory = void 0;
const promises_1 = require("node:stream/promises");
const node_util_1 = require("node:util");
const node_zlib_1 = require("node:zlib");
const index_js_1 = require("../../WAProto/index.js");
const index_js_2 = require("../Types/index.js");
const index_js_3 = require("../WABinary/index.js");
const generics_js_1 = require("./generics.js");
const messages_js_1 = require("./messages.js");
const messages_media_js_1 = require("./messages-media.js");
const inflatePromise = (0, node_util_1.promisify)(node_zlib_1.inflate);
const extractPnFromMessages = (messages) => {
    for (const msgItem of messages) {
        const message = msgItem.message;
        // Only extract from outgoing messages (fromMe: true) in 1:1 chats
        // because userReceipt.userJid is the recipient's JID
        if (!message?.key?.fromMe || !message.userReceipt?.length) {
            continue;
        }
        const userJid = message.userReceipt[0]?.userJid;
        if (userJid && ((0, index_js_3.isPnUser)(userJid) || (0, index_js_3.isHostedPnUser)(userJid))) {
            return userJid;
        }
    }
    return undefined;
};
const downloadHistory = async (msg, options) => {
    const stream = await (0, messages_media_js_1.downloadContentFromMessage)(msg, 'md-msg-hist', { options });
    // Pipe decrypted stream directly through zlib inflate
    // This avoids allocating an intermediate buffer for the compressed data
    const inflater = (0, node_zlib_1.createInflate)();
    const chunks = [];
    inflater.on('data', (chunk) => chunks.push(chunk));
    await (0, promises_1.pipeline)(stream, inflater);
    const buffer = Buffer.concat(chunks);
    const syncData = index_js_1.proto.HistorySync.decode(buffer);
    return syncData;
};
exports.downloadHistory = downloadHistory;
const processHistoryMessage = (item, logger) => {
    const messages = [];
    const contacts = [];
    const chats = [];
    const lidPnMappings = [];
    logger?.trace({ progress: item.progress }, 'processing history of type ' + item.syncType?.toString());
    // Extract LID-PN mappings for all sync types
    for (const m of item.phoneNumberToLidMappings || []) {
        if (m.lidJid && m.pnJid) {
            lidPnMappings.push({ lid: m.lidJid, pn: m.pnJid });
        }
    }
    switch (item.syncType) {
        case index_js_1.proto.HistorySync.HistorySyncType.INITIAL_BOOTSTRAP:
        case index_js_1.proto.HistorySync.HistorySyncType.RECENT:
        case index_js_1.proto.HistorySync.HistorySyncType.FULL:
        case index_js_1.proto.HistorySync.HistorySyncType.ON_DEMAND:
            for (const chat of item.conversations) {
                contacts.push({
                    id: chat.id,
                    name: chat.displayName || chat.name || chat.username || undefined,
                    username: chat.username || undefined,
                    lid: chat.lidJid || chat.accountLid || undefined,
                    phoneNumber: chat.pnJid || undefined
                });
                const chatId = chat.id;
                const isLid = (0, index_js_3.isLidUser)(chatId) || (0, index_js_3.isHostedLidUser)(chatId);
                const isPn = (0, index_js_3.isPnUser)(chatId) || (0, index_js_3.isHostedPnUser)(chatId);
                if (isLid && chat.pnJid) {
                    lidPnMappings.push({ lid: chatId, pn: chat.pnJid });
                }
                else if (isPn && chat.lidJid) {
                    lidPnMappings.push({ lid: chat.lidJid, pn: chatId });
                }
                else if (isLid && !chat.pnJid) {
                    // Fallback: extract PN from userReceipt in messages when pnJid is missing
                    const pnFromReceipt = extractPnFromMessages(chat.messages || []);
                    if (pnFromReceipt) {
                        lidPnMappings.push({ lid: chatId, pn: pnFromReceipt });
                    }
                }
                const msgs = chat.messages || [];
                delete chat.messages;
                for (const item of msgs) {
                    const message = item.message;
                    messages.push(message);
                    if (!chat.messages?.length) {
                        // keep only the most recent message in the chat array
                        chat.messages = [{ message }];
                    }
                    if (!message.key.fromMe && !chat.lastMessageRecvTimestamp) {
                        chat.lastMessageRecvTimestamp = (0, generics_js_1.toNumber)(message.messageTimestamp);
                    }
                    if ((message.messageStubType === index_js_2.WAMessageStubType.BIZ_PRIVACY_MODE_TO_BSP ||
                        message.messageStubType === index_js_2.WAMessageStubType.BIZ_PRIVACY_MODE_TO_FB) &&
                        message.messageStubParameters?.[0]) {
                        contacts.push({
                            id: message.key.participant || message.key.remoteJid,
                            verifiedName: message.messageStubParameters?.[0]
                        });
                    }
                }
                chats.push(chat);
            }
            break;
        case index_js_1.proto.HistorySync.HistorySyncType.PUSH_NAME:
            for (const c of item.pushnames) {
                contacts.push({ id: c.id, notify: c.pushname });
            }
            break;
    }
    return {
        chats,
        contacts,
        messages,
        lidPnMappings,
        pastParticipants: item.pastParticipants,
        syncType: item.syncType,
        progress: item.progress
    };
};
exports.processHistoryMessage = processHistoryMessage;
const downloadAndProcessHistorySyncNotification = async (msg, options, logger) => {
    let historyMsg;
    if (msg.initialHistBootstrapInlinePayload) {
        historyMsg = index_js_1.proto.HistorySync.decode(await inflatePromise(msg.initialHistBootstrapInlinePayload));
    }
    else {
        historyMsg = await (0, exports.downloadHistory)(msg, options);
    }
    return (0, exports.processHistoryMessage)(historyMsg, logger);
};
exports.downloadAndProcessHistorySyncNotification = downloadAndProcessHistorySyncNotification;
const getHistoryMsg = (message) => {
    const normalizedContent = !!message ? (0, messages_js_1.normalizeMessageContent)(message) : undefined;
    const anyHistoryMsg = normalizedContent?.protocolMessage?.historySyncNotification;
    return anyHistoryMsg;
};
exports.getHistoryMsg = getHistoryMsg;

return module.exports;
})();
for (const key of Object.keys(__kageModule170)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule170[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule170, configurable:true});
