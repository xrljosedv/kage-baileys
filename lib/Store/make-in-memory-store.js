"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.waLabelAssociationKey = exports.waMessageID = exports.waChatKey = void 0;
const WAProto_1 = require("../../WAProto");
const Defaults_1 = require("../Defaults");
const LabelAssociation_1 = require("../Types/LabelAssociation");
const Utils_1 = require("../Utils");
const WABinary_1 = require("../WABinary");
const make_ordered_dictionary_1 = __importDefault(require("./make-ordered-dictionary"));
const object_repository_1 = require("./object-repository");
const waChatKey = (pin) => ({
    key: (c) => (pin ? (c.pinned ? '1' : '0') : '') + (c.archived ? '0' : '1') + (c.conversationTimestamp ? c.conversationTimestamp.toString(16).padStart(8, '0') : '') + c.id,
    compare: (k1, k2) => k2.localeCompare(k1)
});
exports.waChatKey = waChatKey;
const waMessageID = (m) => m.key.id || '';
exports.waMessageID = waMessageID;
exports.waLabelAssociationKey = {
    key: (la) => (la.type === LabelAssociation_1.LabelAssociationType.Chat ? la.chatId + la.labelId : la.chatId + la.messageId + la.labelId),
    compare: (k1, k2) => k2.localeCompare(k1)
};
const makeMessagesDictionary = () => (0, make_ordered_dictionary_1.default)(exports.waMessageID);
exports.default = (config = {}) => {
    const socket = config.socket;
    const chatKey = config.chatKey || (0, exports.waChatKey)(true);
    const labelAssociationKey = config.labelAssociationKey || exports.waLabelAssociationKey;
    const logger = config.logger || Defaults_1.DEFAULT_CONNECTION_CONFIG.logger.child({ stream: 'in-mem-store' });
    const KeyedDB = require('@adiwajshing/keyed-db').default;
    const chats = new KeyedDB(chatKey, c => c.id);
    const messages = {};
    const contacts = {};
    const groupMetadata = {};
    const presences = {};
    const state = { connection: 'close' };
    const labels = new object_repository_1.ObjectRepository();
    const labelAssociations = new KeyedDB(labelAssociationKey, labelAssociationKey.key);
    const assertMessageList = (jid) => {
        if (!messages[jid]) {
            messages[jid] = makeMessagesDictionary();
        }
        return messages[jid];
    };
    const contactsUpsert = (newContacts) => {
        const oldContacts = new Set(Object.keys(contacts));
        for (const contact of newContacts) {
            oldContacts.delete(contact.id);
            contacts[contact.id] = Object.assign(contacts[contact.id] || {}, contact);
        }
        return oldContacts;
    };
    const labelsUpsert = (newLabels) => {
        for (const label of newLabels) {
            labels.upsertById(label.id, label);
        }
    };
    const getValidContacts = () => {
        for (const contact of Object.keys(contacts)) {
            if (contact.indexOf('@') < 0) {
                delete contacts[contact];
            }
        }
        return Object.keys(contacts);
    };
    /**
     * binds to a KageEventEmitter.
     * It listens to all events and constructs a state that you can query accurate data from.
     * Eg. can use the store to fetch chats, contacts, messages etc.
     * @param ev typically the event emitter from the socket connection
     */
    const bind = (ev) => {
        ev.on('connection.update', update => {
            Object.assign(state, update);
        });
        ev.on('messaging-history.set', ({ chats: newChats = [], contacts: newContacts = [], messages: newMessages = [], isLatest, syncType }) => {
            const reset = config.resetOnHistorySync === true && isLatest && syncType !== WAProto_1.proto.HistorySync.HistorySyncType.ON_DEMAND;
            if (reset) {
                chats.clear();
                for (const id in messages) {
                    delete messages[id];
                }
            }
            const chatsAdded = chats.insertIfAbsent(...newChats).length;
            logger.debug({ chatsAdded }, 'synced chats');
            const oldContacts = contactsUpsert(newContacts);
            if (reset) {
                for (const jid of oldContacts) {
                    delete contacts[jid];
                }
            }
            logger.debug({ deletedContacts: isLatest ? oldContacts.size : 0, newContacts }, 'synced contacts');
            for (const msg of newMessages) {
                if (!msg?.key?.remoteJid || !msg.key.id) continue;
                const jid = msg.key.remoteJid;
                const list = assertMessageList(jid);
                list.upsert(msg, 'prepend');
            }
            logger.debug({ messages: newMessages.length }, 'synced messages');
        });
        ev.on('contacts.upsert', contacts => {
            contactsUpsert(contacts);
        });
        ev.on('contacts.update', async (updates) => {
            var _a;
            for (const update of updates) {
                let contact;
                if (contacts[update.id]) {
                    contact = contacts[update.id];
                }
                else {
                    const validContacts = getValidContacts();
                    const contactHashes = validContacts.map((contactId) => {
                        const { user } = (0, WABinary_1.jidDecode)(contactId);
                        return [contactId, ((0, Utils_1.md5)(Buffer.from(user + 'WA_ADD_NOTIF', 'utf8'))).toString('base64').slice(0, 3)];
                    });
                    contact = contacts[((_a = contactHashes.find(([, b]) => b === update.id)) === null || _a === void 0 ? void 0 : _a[0]) || '']; // find contact by attrs.hash, when user is not saved as a contact
                }
                if (contact) {
                    if (update.imgUrl === 'changed') {
                        contact.imgUrl = socket ? await (socket === null || socket === void 0 ? void 0 : socket.profilePictureUrl(contact.id)) : undefined;
                    }
                    else if (update.imgUrl === 'removed') {
                        delete contact.imgUrl;
                    }
                    Object.assign(contacts[contact.id], contact);
                }
                else {
                    logger.debug({ update }, 'got update for non-existant contact');
                }
            }
        });
        ev.on('chats.upsert', newChats => {
            chats.upsert(...newChats);
        });
        ev.on('chats.update', updates => {
            for (let update of updates) {
                const result = chats.update(update.id, chat => {
                    if (update.unreadCount > 0) {
                        update = { ...update };
                        update.unreadCount = (chat.unreadCount || 0) + update.unreadCount;
                    }
                    Object.assign(chat, update);
                });
                if (!result) {
                    logger.debug({ update }, 'got update for non-existant chat');
                }
            }
        });
        ev.on('labels.edit', (label) => {
            if (label.deleted) {
                return labels.deleteById(label.id);
            }
            // WhatsApp can store only up to 20 labels
            if (labels.count() < 20) {
                return labels.upsertById(label.id, label);
            }
            logger.error('Labels count exceed');
        });
        ev.on('labels.association', ({ type, association }) => {
            switch (type) {
                case 'add':
                    labelAssociations.upsert(association);
                    break;
                case 'remove':
                    labelAssociations.delete(association);
                    break;
                default:
                    console.error(`unknown operation type [${type}]`);
            }
        });
        ev.on('presence.update', ({ id, presences: update }) => {
            presences[id] = presences[id] || {};
            Object.assign(presences[id], update);
        });
        ev.on('chats.delete', deletions => {
            for (const item of deletions) {
                if (chats.get(item)) {
                    chats.deleteById(item);
                }
            }
        });
        ev.on('messages.upsert', ({ messages: newMessages, type }) => {
            switch (type) {
                case 'append':
                case 'notify':
                    for (const msg of newMessages) {
                        const jid = (0, WABinary_1.jidNormalizedUser)(msg.key.remoteJid);
                        const list = assertMessageList(jid);
                        list.upsert(msg, 'append');
                        if (type === 'notify' && !chats.get(jid)) {
                            ev.emit('chats.upsert', [
                                {
                                    id: jid,
                                    conversationTimestamp: (0, Utils_1.toNumber)(msg.messageTimestamp),
                                    unreadCount: 1
                                }
                            ]);
                        }
                    }
                    break;
            }
        });
        ev.on('messages.update', updates => {
            var _a;
            for (const { update, key } of updates) {
                const list = assertMessageList((0, WABinary_1.jidNormalizedUser)(key.remoteJid));
                if (update === null || update === void 0 ? void 0 : update.status) {
                    const listStatus = (_a = list.get(key.id)) === null || _a === void 0 ? void 0 : _a.status;
                    if (listStatus && (update === null || update === void 0 ? void 0 : update.status) <= listStatus) {
                        logger.debug({ update, storedStatus: listStatus }, 'status stored newer then update');
                        delete update.status;
                        logger.debug({ update }, 'new update object');
                    }
                }
                const result = list.updateAssign(key.id, update);
                if (!result) {
                    logger.debug({ update }, 'got update for non-existent message');
                }
            }
        });
        ev.on('messages.delete', item => {
            if ('all' in item) {
                const list = messages[item.jid];
                list === null || list === void 0 ? void 0 : list.clear();
            }
            else {
                const jid = item.keys[0].remoteJid;
                const list = messages[jid];
                if (list) {
                    const idSet = new Set(item.keys.map(k => k.id));
                    list.filter(m => !idSet.has(m.key.id));
                }
            }
        });
        ev.on('groups.update', updates => {
            for (const update of updates) {
                const id = update.id;
                if (groupMetadata[id]) {
                    Object.assign(groupMetadata[id], update);
                }
                else {
                    logger.debug({ update }, 'got update for non-existant group metadata');
                }
            }
        });
        ev.on('group-participants.update', ({ id, participants, action }) => {
            const metadata = groupMetadata[id];
            if (metadata) {
                switch (action) {
                    case 'add':
                        metadata.participants.push(...participants.map(id => ({ id, isAdmin: false, isSuperAdmin: false })));
                        break;
                    case 'demote':
                    case 'promote':
                        for (const participant of metadata.participants) {
                            if (participants.includes(participant.id)) {
                                participant.isAdmin = action === 'promote';
                            }
                        }
                        break;
                    case 'remove':
                        metadata.participants = metadata.participants.filter(p => !participants.includes(p.id));
                        break;
                }
            }
        });
        ev.on('message-receipt.update', updates => {
            for (const { key, receipt } of updates) {
                const obj = messages[key.remoteJid];
                const msg = obj === null || obj === void 0 ? void 0 : obj.get(key.id);
                if (msg) {
                    (0, Utils_1.updateMessageWithReceipt)(msg, receipt);
                }
            }
        });
        ev.on('messages.reaction', (reactions) => {
            for (const { key, reaction } of reactions) {
                const obj = messages[key.remoteJid];
                const msg = obj === null || obj === void 0 ? void 0 : obj.get(key.id);
                if (msg) {
                    (0, Utils_1.updateMessageWithReaction)(msg, reaction);
                }
            }
        });
    };
    const toJSON = () => ({
        chats,
        contacts,
        messages,
        labels,
        labelAssociations
    });
    let pendingWrite = Promise.resolve();
    const fromJSON = (json) => {
        if (!json || typeof json !== 'object') throw new TypeError('Invalid store snapshot');
        chats.upsert(...(json.chats || []));
        labelAssociations.upsert(...json.labelAssociations || []);
        contactsUpsert(Object.values(json.contacts || {}));
        labelsUpsert(Object.values(json.labels || {}));
        for (const jid in json.messages) {
            const list = assertMessageList(jid);
            for (const msg of json.messages[jid]) {
                list.upsert(WAProto_1.proto.WebMessageInfo.fromObject(msg), 'append');
            }
        }
    };
    return {
        chats,
        contacts,
        messages,
        groupMetadata,
        state,
        presences,
        labels,
        labelAssociations,
        bind,
        /** loads messages from the store, if not found -- uses the legacy connection */
        loadMessages: async (jid, count, cursor) => {
            const list = assertMessageList(jid);
            const mode = !cursor || 'before' in cursor ? 'before' : 'after';
            const cursorKey = !!cursor ? ('before' in cursor ? cursor.before : cursor.after) : undefined;
            const cursorValue = cursorKey ? list.get(cursorKey.id) : undefined;
            let messages;
            if (list && mode === 'before' && (!cursorKey || cursorValue)) {
                if (cursorValue) {
                    const msgIdx = list.array.findIndex(m => m.key.id === (cursorKey === null || cursorKey === void 0 ? void 0 : cursorKey.id));
                    messages = list.array.slice(0, msgIdx);
                }
                else {
                    messages = list.array;
                }
                const diff = count - messages.length;
                if (diff < 0) {
                    messages = messages.slice(-count); // get the last X messages
                }
            }
            else {
                messages = [];
            }
            return messages;
        },
        /**
         * Get all available labels for profile
         *
         * Keep in mind that the list is formed from predefined tags and tags
         * that were "caught" during their editing.
         */
        getLabels: () => {
            return labels;
        },
        /**
         * Get labels for chat
         *
         * @returns Label IDs
         **/
        getChatLabels: (chatId) => {
            return labelAssociations.filter((la) => la.chatId === chatId).all();
        },
        /**
         * Get labels for message
         *
         * @returns Label IDs
         **/
        getMessageLabels: (messageId) => {
            const associations = labelAssociations
                .filter((la) => la.messageId === messageId)
                .all();
            return associations.map(({ labelId }) => labelId);
        },
        loadMessage: async (jid, id) => { var _a; return (_a = messages[jid]) === null || _a === void 0 ? void 0 : _a.get(id); },
        mostRecentMessage: async (jid) => {
            var _a;
            const message = (_a = messages[jid]) === null || _a === void 0 ? void 0 : _a.array.slice(-1)[0];
            return message;
        },
        fetchImageUrl: async (jid, sock) => {
            const contact = contacts[jid];
            if (!contact) {
                return sock === null || sock === void 0 ? void 0 : sock.profilePictureUrl(jid);
            }
            if (typeof contact.imgUrl === 'undefined') {
                contact.imgUrl = await (sock === null || sock === void 0 ? void 0 : sock.profilePictureUrl(jid));
            }
            return contact.imgUrl;
        },
        fetchGroupMetadata: async (jid, sock) => {
            if (!groupMetadata[jid]) {
                const metadata = await (sock === null || sock === void 0 ? void 0 : sock.groupMetadata(jid));
                if (metadata) {
                    groupMetadata[jid] = metadata;
                }
            }
            return groupMetadata[jid];
        },
        // fetchBroadcastListInfo: async(jid: string, sock: WASocket | undefined) => {
        // 	if(!groupMetadata[jid]) {
        // 		const metadata = await sock?.getBroadcastListInfo(jid)
        // 		if(metadata) {
        // 			groupMetadata[jid] = metadata
        // 		}
        // 	}
        // 	return groupMetadata[jid]
        // },
        fetchMessageReceipts: async ({ remoteJid, id }) => {
            const list = messages[remoteJid];
            const msg = list === null || list === void 0 ? void 0 : list.get(id);
            return msg === null || msg === void 0 ? void 0 : msg.userReceipt;
        },
        toJSON,
        fromJSON,
        writeToFile: (path) => {
            // require fs here so that in case "fs" is not available -- the app does not crash
            const fs = require('fs');
            const temp = path + '.' + process.pid + '.' + require('crypto').randomBytes(6).toString('hex') + '.tmp';
            try {
                fs.writeFileSync(temp, JSON.stringify(toJSON(), Utils_1.BufferJSON.replacer), { mode: 0o600 });
                fs.renameSync(temp, path);
            } finally { try { fs.unlinkSync(temp); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
        },
        writeToFileAsync: (path) => {
            const write = async () => {
                const fs = require('fs/promises');
                const temp = path + '.' + process.pid + '.' + require('crypto').randomBytes(6).toString('hex') + '.tmp';
                try {
                    await fs.writeFile(temp, JSON.stringify(toJSON(), Utils_1.BufferJSON.replacer), { mode: 0o600 });
                    await fs.rename(temp, path);
                } finally { await fs.unlink(temp).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
            };
            pendingWrite = pendingWrite.catch(() => {}).then(write);
            return pendingWrite;
        },
        readFromFile: (path) => {
            // require fs here so that in case "fs" is not available -- the app does not crash
            const { readFileSync, existsSync } = require('fs');
            if (existsSync(path)) {
                logger.debug({ path }, 'reading from file');
                try {
                    const jsonStr = readFileSync(path, { encoding: 'utf-8' });
                    if (jsonStr.trim().length) {
                        const json = JSON.parse(jsonStr, Utils_1.BufferJSON.reviver);
                        fromJSON(json);
                    }
                    else {
                        logger.warn({ path }, 'skipping empty json file');
                    }
                }
                catch (err) {
                    logger.warn({ path, err }, 'failed to parse json from file');
                }
            }
        }
    };
};

// Kage: compatibilidad de API.
const __kageModule36 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { proto } = require("../../WAProto")
const { DEFAULT_CONNECTION_CONFIG } = require("../Defaults/connection")
const { LabelAssociationType } = require("../Types/LabelAssociation")
const {
  md5, 
  toNumber, 
  updateMessageWithReceipt, 
  updateMessageWithReaction
} = require("../Utils")
const {
  jidDecode, 
  jidNormalizedUser
} = require("../WABinary")
const { makeOrderedDictionary } = require("./make-ordered-dictionary")
const { ObjectRepository } = require("./object-repository")

const waChatKey = (pin) => ({
    key: (c) => (pin ? (c.pinned ? '1' : '0') : '') + (c.archived ? '0' : '1') + (c.conversationTimestamp ? c.conversationTimestamp.toString(16).padStart(8, '0') : '') + c.id,
    compare: (k1, k2) => k2.localeCompare(k1)
})

const waMessageID = (m) => m.key.id || ''

const waLabelAssociationKey = {
    key: (la) => (la.type === LabelAssociationType.Chat ? la.chatId + la.labelId : la.chatId + la.messageId + la.labelId),
    compare: (k1, k2) => k2.localeCompare(k1)
}

const makeMessagesDictionary = () => makeOrderedDictionary(waMessageID)

const makeInMemoryStore = (config) => {
    const socket = config.socket
    const chatKey = config.chatKey || waChatKey(true)
    const labelAssociationKey = config.labelAssociationKey || waLabelAssociationKey
    const logger = config.logger || DEFAULT_CONNECTION_CONFIG.logger.child({ stream: 'in-mem-store' })
    const KeyedDB = require('@adiwajshing/keyed-db').default
    const chats = new KeyedDB(chatKey, c => c.id)
    const messages = {}
    const contacts = {}
    const groupMetadata = {}
    const presences = {}
    const state = { connection: 'close' }
    const labels = new ObjectRepository()
    const labelAssociations = new KeyedDB(labelAssociationKey, labelAssociationKey.key)
    const assertMessageList = (jid) => {
        if (!messages[jid]) {
            messages[jid] = makeMessagesDictionary()
        }
        return messages[jid]
    }
    const contactsUpsert = (newContacts) => {
        const oldContacts = new Set(Object.keys(contacts))
        for (const contact of newContacts) {
            oldContacts.delete(contact.id)
            contacts[contact.id] = Object.assign(contacts[contact.id] || {}, contact)
        }
        return oldContacts
    }
    const labelsUpsert = (newLabels) => {
        for (const label of newLabels) {
            labels.upsertById(label.id, label)
        }
    }
    /**
     * binds to a BaileysEventEmitter.
     * It listens to all events and constructs a state that you can query accurate data from.
     * Eg. can use the store to fetch chats, contacts, messages etc.
     * @param ev typically the event emitter from the socket connection
     */
    const bind = (ev) => {
        ev.on('connection.update', update => {
            Object.assign(state, update)
        })
        ev.on('messaging-history.set', ({ chats: newChats, contacts: newContacts, messages: newMessages, isLatest, syncType }) => {
            if (syncType === proto.HistorySync.HistorySyncType.ON_DEMAND) {
                return // FOR NOW,
                //TODO: HANDLE
            }
            if (isLatest) {
                chats.clear()
                for (const id in messages) {
                    delete messages[id]
                }
            }
            const chatsAdded = chats.insertIfAbsent(...newChats).length
            logger.debug({ chatsAdded }, 'synced chats')
            const oldContacts = contactsUpsert(newContacts)
            if (isLatest) {
                for (const jid of oldContacts) {
                    delete contacts[jid]
                }
            }
            logger.debug({ deletedContacts: isLatest ? oldContacts.size : 0, newContacts }, 'synced contacts')
            for (const msg of newMessages) {
                const jid = msg.key.remoteJid
                const list = assertMessageList(jid)
                list.upsert(msg, 'prepend')
            }
            logger.debug({ messages: newMessages.length }, 'synced messages')
        })
        ev.on('contacts.upsert', contacts => {
            contactsUpsert(contacts)
        })
        ev.on('contacts.update', async (updates) => {
            for (const update of updates) {
                let contact
                if (contacts[update.id]) {
                    contact = contacts[update.id]
                }
                else {
                    const contactHashes = await Promise.all(Object.keys(contacts).map(async (contactId) => {
                        const { user } = jidDecode(contactId)
                        return [contactId, (await md5(Buffer.from(user + 'WA_ADD_NOTIF', 'utf8'))).toString('base64').slice(0, 3)]
                    }))
                    contact = contacts[contactHashes.find(([, b]) => b === update.id?.[0]) || ''] // find contact by attrs.hash, when user is not saved as a contact
                }
                if (contact) {
                    if (update.imgUrl === 'changed') {
                        contact.imgUrl = socket ? await socket.profilePictureUrl(contact.id) : undefined
                    }
                    else if (update.imgUrl === 'removed') {
                        delete contact.imgUrl
                    }
                }
                else {
                    return logger.debug({ update }, 'got update for non-existant contact')
                }
                Object.assign(contacts[contact.id], contact)
            }
        })
        ev.on('chats.upsert', newChats => {
            chats.upsert(...newChats)
        })
        ev.on('chats.update', updates => {
            for (let update of updates) {
                const result = chats.update(update.id, chat => {
                    if (update.unreadCount > 0) {
                        update = { ...update }
                        update.unreadCount = (chat.unreadCount || 0) + update.unreadCount
                    }
                    Object.assign(chat, update)
                })
                if (!result) {
                    logger.debug({ update }, 'got update for non-existant chat')
                }
            }
        })
        ev.on('labels.edit', (label) => {
            if (label.deleted) {
                return labels.deleteById(label.id)
            }
            // WhatsApp can store only up to 20 labels
            if (labels.count() < 20) {
                return labels.upsertById(label.id, label)
            }
            logger.error('Labels count exceed')
        })
        ev.on('labels.association', ({ type, association }) => {
            switch (type) {
                case 'add':
                    labelAssociations.upsert(association)
                    break
                case 'remove':
                    labelAssociations.delete(association)
                    break
                default:
                    console.error(`unknown operation type [${type}]`)
            }
        })
        ev.on('presence.update', ({ id, presences: update }) => {
            presences[id] = presences[id] || {}
            Object.assign(presences[id], update)
        })
        ev.on('chats.delete', deletions => {
            for (const item of deletions) {
                if (chats.get(item)) {
                    chats.deleteById(item)
                }
            }
        })
        ev.on('messages.upsert', ({ messages: newMessages, type }) => {
            switch (type) {
                case 'append':
                case 'notify':
                    for (const msg of newMessages) {
                        const jid = jidNormalizedUser(msg.key.remoteJid)
                        const list = assertMessageList(jid)
                        list.upsert(msg, 'append')
                        if (type === 'notify' && !chats.get(jid)) {
                            ev.emit('chats.upsert', [
                                {
                                    id: jid,
                                    conversationTimestamp: toNumber(msg.messageTimestamp),
                                    unreadCount: 1
                                }
                            ])
                        }
                    }
                    break
            }
        })
        ev.on('messages.update', updates => {
            for (const { update, key } of updates) {
                const list = assertMessageList(jidNormalizedUser(key.remoteJid))
                if (update?.status) {
                    const listStatus = list.get(key.id)?.status
                    if (listStatus && update?.status <= listStatus) {
                        logger.debug({ update, storedStatus: listStatus }, 'status stored newer then update')
                        delete update.status
                        logger.debug({ update }, 'new update object')
                    }
                }
                const result = list.updateAssign(key.id, update)
                if (!result) {
                    logger.debug({ update }, 'got update for non-existent message')
                }
            }
        })
        ev.on('messages.delete', item => {
            if ('all' in item) {
                const list = messages[item.jid]
                list?.clear()
            }
            else {
                const jid = item.keys[0].remoteJid
                const list = messages[jid]
                if (list) {
                    const idSet = new Set(item.keys.map(k => k.id))
                    list.filter(m => !idSet.has(m.key.id))
                }
            }
        })
        ev.on('groups.update', updates => {
            for (const update of updates) {
                const id = update.id
                if (groupMetadata[id]) {
                    Object.assign(groupMetadata[id], update)
                }
                else {
                    logger.debug({ update }, 'got update for non-existant group metadata')
                }
            }
        })
        ev.on('group-participants.update', ({ id, participants, action }) => {
            const metadata = groupMetadata[id]
            if (metadata) {
                switch (action) {
                    case 'add':
                        metadata.participants.push(...participants.map(id => ({ id, isAdmin: false, isSuperAdmin: false })))
                        break
                    case 'demote':
                    case 'promote':
                        for (const participant of metadata.participants) {
                            if (participants.includes(participant.id)) {
                                participant.isAdmin = action === 'promote'
                            }
                        }
                        break
                    case 'remove':
                        metadata.participants = metadata.participants.filter(p => !participants.includes(p.id))
                        break
                }
            }
        })
        ev.on('message-receipt.update', updates => {
            for (const { key, receipt } of updates) {
                const obj = messages[key.remoteJid]
                const msg = obj?.get(key.id)
                if (msg) {
                    updateMessageWithReceipt(msg, receipt)
                }
            }
        })
        ev.on('messages.reaction', (reactions) => {
            for (const { key, reaction } of reactions) {
                const obj = messages[key.remoteJid]
                const msg = obj?.get(key.id)
                if (msg) {
                    updateMessageWithReaction(msg, reaction)
                }
            }
        })
    }
    const toJSON = () => ({
        chats,
        contacts,
        messages,
        labels,
        labelAssociations
    })
    const fromJSON = (json) => {
        chats.upsert(...json.chats)
        labelAssociations.upsert(...json.labelAssociations || [])
        contactsUpsert(Object.values(json.contacts))
        labelsUpsert(Object.values(json.labels || {}))
        for (const jid in json.messages) {
            const list = assertMessageList(jid)
            for (const msg of json.messages[jid]) {
                list.upsert(proto.WebMessageInfo.fromObject(msg), 'append')
            }
        }
    }
    return {
        chats,
        contacts,
        messages,
        groupMetadata,
        state,
        presences,
        labels,
        labelAssociations,
        bind,
        /** loads messages from the store, if not found -- uses the legacy connection */
        loadMessages: async (jid, count, cursor) => {
            const list = assertMessageList(jid)
            const mode = !cursor || 'before' in cursor ? 'before' : 'after'
            const cursorKey = !!cursor ? ('before' in cursor ? cursor.before : cursor.after) : undefined
            const cursorValue = cursorKey ? list.get(cursorKey.id) : undefined
            let messages
            if (list && mode === 'before' && (!cursorKey || cursorValue)) {
                if (cursorValue) {
                    const msgIdx = list.array.findIndex(m => m.key.id === cursorKey?.id)
                    messages = list.array.slice(0, msgIdx)
                }
                else {
                    messages = list.array
                }
                const diff = count - messages.length
                if (diff < 0) {
                    messages = messages.slice(-count) // get the last X messages
                }
            }
            else {
                messages = []
            }
            return messages
        },
        /**
         * Get all available labels for profile
         *
         * Keep in mind that the list is formed from predefined tags and tags
         * that were "caught" during their editing.
         */
        getLabels: () => {
            return labels
        },
        /**
         * Get labels for chat
         *
         * @returns Label IDs
         **/
        getChatLabels: (chatId) => {
            return labelAssociations.filter((la) => la.chatId === chatId).all()
        },
        /**
         * Get labels for message
         *
         * @returns Label IDs
         **/
        getMessageLabels: (messageId) => {
            const associations = labelAssociations
                .filter((la) => la.messageId === messageId)
                .all()
            return associations.map(({ labelId }) => labelId)
        },
        loadMessage: async (jid, id) => messages[jid]?.get(id), 
        mostRecentMessage: async (jid) => {
            const message = messages[jid]?.array.slice(-1)[0]
            return message
        },
        fetchImageUrl: async (jid, suki) => {
            const contact = contacts[jid]
            if (!contact) {
                return suki?.profilePictureUrl(jid)
            }
            if (typeof contact.imgUrl === 'undefined') {
                contact.imgUrl = await suki?.profilePictureUrl(jid)
            }
            return contact.imgUrl
        },
        fetchGroupMetadata: async (jid, suki) => {
            if (!groupMetadata[jid]) {
                const metadata = await suki?.groupMetadata(jid)
                if (metadata) {
                    groupMetadata[jid] = metadata
                }
            }
            return groupMetadata[jid]
        },
        // fetchBroadcastListInfo: async(jid: string, sock: WASocket | undefined) => {
        // 	if(!groupMetadata[jid]) {
        // 		const metadata = await sock?.getBroadcastListInfo(jid)
        // 		if(metadata) {
        // 			groupMetadata[jid] = metadata
        // 		}
        // 	}
        // 	return groupMetadata[jid]
        // },
        fetchMessageReceipts: async ({ remoteJid, id }) => {
            const list = messages[remoteJid]
            const msg = list?.get(id)
            return msg?.userReceipt
        },
        toJSON,
        fromJSON,
        writeToFile: (path) => {
            // require fs here so that in case "fs" is not available -- the app does not crash
            const { writeFileSync } = require('fs')
            writeFileSync(path, JSON.stringify(toJSON()))
        },
        readFromFile: (path) => {
            // require fs here so that in case "fs" is not available -- the app does not crash
            const { readFileSync, existsSync } = require('fs')
            if (existsSync(path)) {
                logger.debug({ path }, 'reading from file')
                const jsonStr = readFileSync(path, { encoding: 'utf-8' })
                const json = JSON.parse(jsonStr)
                fromJSON(json)
            }
        }
    }
}

module.exports = {
  waChatKey, 
  waMessageID, 
  waLabelAssociationKey, 
  makeInMemoryStore
}
return module.exports;
})();
for (const key of Object.keys(__kageModule36)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule36[key]});
}

// Kage: funciones avanzadas.
const __kageModule141 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeInMemoryStore = exports.waLabelAssociationKey = exports.waMessageID = exports.waChatKey = void 0;
/**
 * Kage: nota de compatibilidad.
 * Manually converted to ESM and modified by me
 * Originally based on @whiskeysockets/baileys v6.7.16
 * Minor adjustments for compatibility with baileys v7 (⁠つ⁠≧⁠▽⁠≦⁠)⁠つ
 */
const node_fs_1 = require("node:fs");
const index_js_1 = require("../Addon/index.js");
const index_js_2 = require("../Types/index.js");
const LabelAssociation_js_1 = require("../Types/LabelAssociation.js");
const index_js_3 = require("../Defaults/index.js");
const index_js_4 = require("../Utils/index.js");
const index_js_5 = require("../WABinary/index.js");
const make_ordered_dictionary_js_1 = require("./make-ordered-dictionary.js");
const object_repository_js_1 = require("./object-repository.js");
const waChatKey = (pin) => ({
    key: (c) => (pin ? (c.pinned ? '1' : '0') : '') + (c.archived ? '0' : '1') + (c.conversationTimestamp ? c.conversationTimestamp.toString(16).padStart(8, '0') : '') + c.id,
    compare: (k1, k2) => k2.localeCompare(k1)
});
exports.waChatKey = waChatKey;
const waMessageID = (m) => m.key.id || '';
exports.waMessageID = waMessageID;
exports.waLabelAssociationKey = {
    key: (la) => (la.type === LabelAssociation_js_1.LabelAssociationType.Chat ? la.chatId + la.labelId : la.chatId + la.messageId + la.labelId),
    compare: (k1, k2) => k2.localeCompare(k1)
};
const makeMessagesDictionary = () => (0, make_ordered_dictionary_js_1.makeOrderedDictionary)(exports.waMessageID);
const makeInMemoryStore = (config = {}) => {
    const socket = config.socket;
    const chatKey = config.chatKey || (0, exports.waChatKey)(true);
    const labelAssociationKey = config.labelAssociationKey || exports.waLabelAssociationKey;
    const logger = config.logger || index_js_3.DEFAULT_CONNECTION_CONFIG.logger.child({ stream: 'in-mem-store' });
    const chats = new index_js_1.KeyedDB(chatKey, c => c.id);
    const messages = {};
    const contacts = {};
    const groupMetadata = {};
    const presences = {};
    const state = { connection: 'close' };
    const labels = new object_repository_js_1.ObjectRepository();
    const labelAssociations = new index_js_1.KeyedDB(labelAssociationKey, labelAssociationKey.key);
    const assertMessageList = (jid) => {
        if (!messages[jid]) {
            messages[jid] = makeMessagesDictionary();
        }
        return messages[jid];
    };
    const contactsUpsert = (newContacts) => {
        const oldContacts = new Set(Object.keys(contacts));
        for (const contact of newContacts) {
            oldContacts.delete(contact.id);
            contacts[contact.id] = Object.assign(contacts[contact.id] || {}, contact);
        }
        return oldContacts;
    };
    const labelsUpsert = (newLabels) => {
        for (const label of newLabels) {
            labels.upsertById(label.id, label);
        }
    };
    /**
     * binds to a BaileysEventEmitter.
     * It listens to all events and constructs a state that you can query accurate data from.
     * Eg. can use the store to fetch chats, contacts, messages etc.
     * @param ev typically the event emitter from the socket connection
     */
    const bind = (ev) => {
        ev.on('connection.update', update => {
            Object.assign(state, update);
        });
        ev.on('messaging-history.set', ({ chats: newChats, contacts: newContacts, messages: newMessages, isLatest, syncType }) => {
            if (syncType === index_js_2.WAProto.HistorySync.HistorySyncType.ON_DEMAND) {
                return; // FOR NOW,
                //TODO: HANDLE
            }
            if (isLatest) {
                chats.clear();
                for (const id in messages) {
                    delete messages[id];
                }
            }
            const chatsAdded = chats.insertIfAbsent(...newChats).length;
            logger.debug({ chatsAdded }, 'synced chats');
            const oldContacts = contactsUpsert(newContacts);
            if (isLatest) {
                for (const jid of oldContacts) {
                    delete contacts[jid];
                }
            }
            logger.debug({ deletedContacts: isLatest ? oldContacts.size : 0, newContacts }, 'synced contacts');
            for (const msg of newMessages) {
                const jid = msg.key.remoteJidAlt || msg.key.remoteJid;
                const list = assertMessageList(jid);
                list.upsert(msg, 'prepend');
            }
            logger.debug({ messages: newMessages.length }, 'synced messages');
        });
        ev.on('contacts.upsert', contacts => {
            contactsUpsert(contacts);
        });
        ev.on('contacts.update', async (updates) => {
            var _a;
            for (const update of updates) {
                let contact;
                if (contacts[update.id]) {
                    contact = contacts[update.id];
                }
                else {
                    const contactHashes = await Promise.all(Object.keys(contacts).map(async (contactId) => {
                        const { user } = (0, index_js_5.jidDecode)(contactId);
                        return [contactId, (await (0, index_js_4.md5)(Buffer.from(user + 'WA_ADD_NOTIF', 'utf8'))).toString('base64').slice(0, 3)];
                    }));
                    contact = contacts[((_a = contactHashes.find(([, b]) => b === update.id)) === null || _a === void 0 ? void 0 : _a[0]) || '']; // find contact by attrs.hash, when user is not saved as a contact
                }
                if (contact) {
                    if (update.imgUrl === 'changed') {
                        contact.imgUrl = socket ? await (socket === null || socket === void 0 ? void 0 : socket.profilePictureUrl(contact.id)) : undefined;
                    }
                    else if (update.imgUrl === 'removed') {
                        delete contact.imgUrl;
                    }
                }
                else {
                    return logger.debug({ update }, 'got update for non-existant contact');
                }
                Object.assign(contacts[contact.id], contact);
            }
        });
        ev.on('chats.upsert', newChats => {
            chats.upsert(...newChats);
        });
        ev.on('chats.update', updates => {
            for (let update of updates) {
                const result = chats.update(update.id, chat => {
                    if (update.unreadCount > 0) {
                        update = { ...update };
                        update.unreadCount = (chat.unreadCount || 0) + update.unreadCount;
                    }
                    Object.assign(chat, update);
                });
                if (!result) {
                    logger.debug({ update }, 'got update for non-existant chat');
                }
            }
        });
        ev.on('labels.edit', (label) => {
            if (label.deleted) {
                return labels.deleteById(label.id);
            }
            // WhatsApp can store only up to 20 labels
            if (labels.count() < 20) {
                return labels.upsertById(label.id, label);
            }
            logger.error('Labels count exceed');
        });
        ev.on('labels.association', ({ type, association }) => {
            switch (type) {
                case 'add':
                    labelAssociations.upsert(association);
                    break;
                case 'remove':
                    labelAssociations.delete(association);
                    break;
                default:
                    console.error(`unknown operation type [${type}]`);
            }
        });
        ev.on('presence.update', ({ id, presences: update }) => {
            presences[id] = presences[id] || {};
            Object.assign(presences[id], update);
        });
        ev.on('chats.delete', deletions => {
            for (const item of deletions) {
                if (chats.get(item)) {
                    chats.deleteById(item);
                }
            }
        });
        ev.on('messages.upsert', ({ messages: newMessages, type }) => {
            switch (type) {
                case 'append':
                case 'notify':
                    for (const msg of newMessages) {
                        const jid = (0, index_js_5.jidNormalizedUser)(msg.key.remoteJidAlt || msg.key.remoteJid);
                        const list = assertMessageList(jid);
                        list.upsert(msg, 'append');
                        if (type === 'notify' && !chats.get(jid)) {
                            ev.emit('chats.upsert', [
                                {
                                    id: jid,
                                    conversationTimestamp: (0, index_js_4.toNumber)(msg.messageTimestamp),
                                    unreadCount: 1
                                }
                            ]);
                        }
                    }
                    break;
            }
        });
        ev.on('messages.update', updates => {
            var _a;
            for (const { update, key } of updates) {
                const list = assertMessageList((0, index_js_5.jidNormalizedUser)(key.remoteJid));
                if (update === null || update === void 0 ? void 0 : update.status) {
                    const listStatus = (_a = list.get(key.id)) === null || _a === void 0 ? void 0 : _a.status;
                    if (listStatus && (update === null || update === void 0 ? void 0 : update.status) <= listStatus) {
                        logger.debug({ update, storedStatus: listStatus }, 'status stored newer then update');
                        delete update.status;
                        logger.debug({ update }, 'new update object');
                    }
                }
                const result = list.updateAssign(key.id, update);
                if (!result) {
                    logger.debug({ update }, 'got update for non-existent message');
                }
            }
        });
        ev.on('messages.delete', item => {
            if ('all' in item) {
                const list = messages[item.jid];
                list === null || list === void 0 ? void 0 : list.clear();
            }
            else {
                const jid = item.keys[0].remoteJidAlt || item.keys[0].remoteJid;
                const list = messages[jid];
                if (list) {
                    const idSet = new Set(item.keys.map(k => k.id));
                    list.filter(m => !idSet.has(m.key.id));
                }
            }
        });
        ev.on('groups.update', updates => {
            for (const update of updates) {
                const id = update.id;
                if (groupMetadata[id]) {
                    Object.assign(groupMetadata[id], update);
                }
                else {
                    logger.debug({ update }, 'got update for non-existant group metadata');
                }
            }
        });
        ev.on('group-participants.update', ({ id, participants, action }) => {
            const metadata = groupMetadata[id];
            if (metadata) {
                switch (action) {
                    case 'add':
                        metadata.participants.push(...participants.map(participant => ({ id: participant.id, phoneNumber: participant.phoneNumber, admin: participant.admin })));
                        break;
                    case 'demote':
                    case 'promote':
                        for (const participant of metadata.participants) {
                            for (const participantData of participants) {
                                if (participantData.id === participant.id || participantData.phoneNumber === participant.phoneNumber) {
                                    participant.admin = action === 'promote' && 'admin';
                                }
                            }
                        }
                        break;
                    case 'remove':
                        const removeSet = new Set();
                        for (const p of participants) {
                            if (p.id)
                                removeSet.add(p.id);
                            if (p.phoneNumber)
                                removeSet.add(p.phoneNumber);
                        }
                        metadata.participants = metadata.participants.reduce((acc, p) => {
                            if (!removeSet.has(p.id) && !removeSet.has(p.phoneNumber))
                                acc.push(p);
                            return acc;
                        }, []);
                        break;
                }
            }
        });
        ev.on('message-receipt.update', updates => {
            for (const { key, receipt } of updates) {
                const obj = messages[key.remoteJidAlt || key.remoteJid];
                const msg = obj === null || obj === void 0 ? void 0 : obj.get(key.id);
                if (msg) {
                    (0, index_js_4.updateMessageWithReceipt)(msg, receipt);
                }
            }
        });
        ev.on('messages.reaction', (reactions) => {
            for (const { key, reaction } of reactions) {
                const obj = messages[key.remoteJidAlt || key.remoteJid];
                const msg = obj === null || obj === void 0 ? void 0 : obj.get(key.id);
                if (msg) {
                    (0, index_js_4.updateMessageWithReaction)(msg, reaction);
                }
            }
        });
    };
    const toJSON = () => ({
        chats,
        contacts,
        messages,
        labels,
        labelAssociations
    });
    const fromJSON = (json) => {
        chats.upsert(...json.chats);
        labelAssociations.upsert(...json.labelAssociations || []);
        contactsUpsert(Object.values(json.contacts));
        labelsUpsert(Object.values(json.labels || {}));
        for (const jid in json.messages) {
            const list = assertMessageList(jid);
            for (const msg of json.messages[jid]) {
                list.upsert(index_js_2.WAProto.WebMessageInfo.fromObject(msg), 'append');
            }
        }
    };
    return {
        chats,
        contacts,
        messages,
        groupMetadata,
        state,
        presences,
        labels,
        labelAssociations,
        bind,
        /** loads messages from the store, if not found -- uses the legacy connection */
        loadMessages: async (jid, count, cursor) => {
            const list = assertMessageList(jid);
            const mode = !cursor || 'before' in cursor ? 'before' : 'after';
            const cursorKey = !!cursor ? ('before' in cursor ? cursor.before : cursor.after) : undefined;
            const cursorValue = cursorKey ? list.get(cursorKey.id) : undefined;
            let messages;
            if (list && mode === 'before' && (!cursorKey || cursorValue)) {
                if (cursorValue) {
                    const msgIdx = list.array.findIndex(m => m.key.id === (cursorKey === null || cursorKey === void 0 ? void 0 : cursorKey.id));
                    messages = list.array.slice(0, msgIdx);
                }
                else {
                    messages = list.array;
                }
                const diff = count - messages.length;
                if (diff < 0) {
                    messages = messages.slice(-count); // get the last X messages
                }
            }
            else {
                messages = [];
            }
            return messages;
        },
        /**
         * Get all available labels for profile
         *
         * Keep in mind that the list is formed from predefined tags and tags
         * that were "caught" during their editing.
         */
        getLabels: () => {
            return labels;
        },
        /**
         * Get labels for chat
         *
         * @returns Label IDs
         **/
        getChatLabels: (chatId) => {
            return labelAssociations.filter((la) => la.chatId === chatId).all();
        },
        /**
         * Get labels for message
         *
         * @returns Label IDs
         **/
        getMessageLabels: (messageId) => {
            const associations = labelAssociations
                .filter((la) => la.messageId === messageId)
                .all();
            return associations.map(({ labelId }) => labelId);
        },
        loadMessage: async (jid, id) => { var _a; return (_a = messages[jid]) === null || _a === void 0 ? void 0 : _a.get(id); },
        mostRecentMessage: async (jid) => {
            var _a;
            const message = (_a = messages[jid]) === null || _a === void 0 ? void 0 : _a.array.slice(-1)[0];
            return message;
        },
        fetchImageUrl: async (jid, sock) => {
            const contact = contacts[jid];
            if (!contact) {
                return sock === null || sock === void 0 ? void 0 : sock.profilePictureUrl(jid);
            }
            if (typeof contact.imgUrl === 'undefined') {
                contact.imgUrl = await (sock === null || sock === void 0 ? void 0 : sock.profilePictureUrl(jid));
            }
            return contact.imgUrl;
        },
        fetchGroupMetadata: async (jid, sock) => {
            if (!groupMetadata[jid]) {
                const metadata = await (sock === null || sock === void 0 ? void 0 : sock.groupMetadata(jid));
                if (metadata) {
                    groupMetadata[jid] = metadata;
                }
            }
            return groupMetadata[jid];
        },
        fetchMessageReceipts: async ({ remoteJid, id }) => {
            const list = messages[remoteJid];
            const msg = list === null || list === void 0 ? void 0 : list.get(id);
            return msg === null || msg === void 0 ? void 0 : msg.userReceipt;
        },
        toJSON,
        fromJSON,
        writeToFile: (path) => {
            (0, node_fs_1.writeFileSync)(path, JSON.stringify(toJSON()));
        },
        readFromFile: (path) => {
            if ((0, node_fs_1.existsSync)(path)) {
                logger.debug({ path }, 'reading from file');
                const jsonStr = (0, node_fs_1.readFileSync)(path, { encoding: 'utf-8' });
                const json = JSON.parse(jsonStr);
                fromJSON(json);
            }
        }
    };
};
exports.makeInMemoryStore = makeInMemoryStore;

return module.exports;
})();
for (const key of Object.keys(__kageModule141)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule141[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule141, configurable:true});
