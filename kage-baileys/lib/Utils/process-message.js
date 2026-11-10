"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getChatId = exports.shouldIncrementChatUnread = exports.isRealMessage = exports.cleanMessage = void 0;
exports.decryptPollVote = decryptPollVote;
const WAProto_1 = require("../../WAProto");
const Types_1 = require("../Types");
const messages_1 = require("../Utils/messages");
const WABinary_1 = require("../WABinary");
const crypto_1 = require("./crypto");
const generics_1 = require("./generics");
const history_1 = require("./history");
const REAL_MSG_STUB_TYPES = new Set([
    Types_1.WAMessageStubType.CALL_MISSED_GROUP_VIDEO,
    Types_1.WAMessageStubType.CALL_MISSED_GROUP_VOICE,
    Types_1.WAMessageStubType.CALL_MISSED_VIDEO,
    Types_1.WAMessageStubType.CALL_MISSED_VOICE
]);
const REAL_MSG_REQ_ME_STUB_TYPES = new Set([
    Types_1.WAMessageStubType.GROUP_PARTICIPANT_ADD
]);
 
const cleanMessage = (message, meId) => {
     
     
    try {
        message.key.remoteJid = (0, WABinary_1.jidNormalizedUser)(message.key.remoteJid);
    }
    catch (_e) {
         
    }
    if (message.key.participant) {
        try {
            message.key.participant = (0, WABinary_1.jidNormalizedUser)(message.key.participant);
        }
        catch (_e) {
             
        }
    }
    const content = (0, messages_1.normalizeMessageContent)(message.message);
     
    if (content === null || content === void 0 ? void 0 : content.reactionMessage) {
        normaliseKey(content.reactionMessage.key);
    }
    if (content === null || content === void 0 ? void 0 : content.pollUpdateMessage) {
        normaliseKey(content.pollUpdateMessage.pollCreationMessageKey);
    }
    function normaliseKey(msgKey) {
         
         
        if (!message.key.fromMe) {
             
             
            msgKey.fromMe = !msgKey.fromMe
                ? (0, WABinary_1.areJidsSameUser)(msgKey.participant || msgKey.remoteJid, meId)
                 
                 
                : false;
             
            msgKey.remoteJid = message.key.remoteJid;
             
            msgKey.participant = msgKey.participant || message.key.participant;
        }
    }
};
exports.cleanMessage = cleanMessage;
const isRealMessage = (message, meId) => {
    var _a;
    const normalizedContent = (0, messages_1.normalizeMessageContent)(message.message);
    const hasSomeContent = !!(0, messages_1.getContentType)(normalizedContent);
    return (!!normalizedContent
        || REAL_MSG_STUB_TYPES.has(message.messageStubType)
        || (REAL_MSG_REQ_ME_STUB_TYPES.has(message.messageStubType)
            && ((_a = message.messageStubParameters) === null || _a === void 0 ? void 0 : _a.some(p => (0, WABinary_1.areJidsSameUser)(meId, p)))))
        && hasSomeContent
        && !(normalizedContent === null || normalizedContent === void 0 ? void 0 : normalizedContent.protocolMessage)
        && !(normalizedContent === null || normalizedContent === void 0 ? void 0 : normalizedContent.reactionMessage)
        && !(normalizedContent === null || normalizedContent === void 0 ? void 0 : normalizedContent.pollUpdateMessage);
};
exports.isRealMessage = isRealMessage;
const shouldIncrementChatUnread = (message) => (!message.key.fromMe && !message.messageStubType);
exports.shouldIncrementChatUnread = shouldIncrementChatUnread;
 



const getChatId = ({ remoteJid, participant, fromMe }) => {
    if ((0, WABinary_1.isJidBroadcast)(remoteJid)
        && !(0, WABinary_1.isJidStatusBroadcast)(remoteJid)
        && !fromMe) {
        return participant;
    }
    return remoteJid;
};
exports.getChatId = getChatId;
 





function decryptPollVote({ encPayload, encIv }, { pollCreatorJid, pollMsgId, pollEncKey, voterJid, }) {
    const sign = Buffer.concat([
        toBinary(pollMsgId),
        toBinary(pollCreatorJid),
        toBinary(voterJid),
        toBinary('Poll Vote'),
        new Uint8Array([1])
    ]);
    const key0 = (0, crypto_1.hmacSign)(pollEncKey, new Uint8Array(32), 'sha256');
    const decKey = (0, crypto_1.hmacSign)(sign, key0, 'sha256');
    const aad = toBinary(`${pollMsgId}\u0000${voterJid}`);
    const decrypted = (0, crypto_1.aesDecryptGCM)(encPayload, decKey, encIv, aad);
    return WAProto_1.proto.Message.PollVoteMessage.decode(decrypted);
    function toBinary(txt) {
        return Buffer.from(txt);
    }
}
const processMessage = async (message, { shouldProcessHistoryMsg, placeholderResendCache, ev, creds, keyStore, logger, options, getMessage }) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
    const meId = creds.me.id;
    const { accountSettings } = creds;
    const chat = { id: (0, WABinary_1.jidNormalizedUser)((0, exports.getChatId)(message.key)) };
    const isRealMsg = (0, exports.isRealMessage)(message, meId);
    if (isRealMsg) {
        chat.messages = [{ message }];
        chat.conversationTimestamp = (0, generics_1.toNumber)(message.messageTimestamp);
         
        if ((0, exports.shouldIncrementChatUnread)(message)) {
            chat.unreadCount = (chat.unreadCount || 0) + 1;
        }
    }
    const content = (0, messages_1.normalizeMessageContent)(message.message);
    const senderId = message.key.participant || message.key.remoteJid;
    if ((0, WABinary_1.isLidUser)(senderId)) {
        const jid = (0, WABinary_1.lidToJid)(senderId);
        if (message.key.participant) {
            message.key.participant = jid;
        }
        else {
            message.key.remoteJid = jid;
        }
    }
    const mJids = content && content.contextInfo && content.contextInfo.mentionedJid ? content.contextInfo.mentionedJid : [];
    for (let i = 0; i < mJids.length; i++) {
        if ((0, WABinary_1.isLidUser)(mJids[i])) {
            mJids[i] = (0, WABinary_1.lidToJid)(mJids[i]);
        }
    }
    if (content && content.contextInfo && content.contextInfo.participant && (0, WABinary_1.isLidUser)(content.contextInfo.participant)) {
        content.contextInfo.participant = (0, WABinary_1.lidToJid)(content.contextInfo.participant);
    }
     
     
    if ((isRealMsg || ((_b = (_a = content === null || content === void 0 ? void 0 : content.reactionMessage) === null || _a === void 0 ? void 0 : _a.key) === null || _b === void 0 ? void 0 : _b.fromMe))
        && (accountSettings === null || accountSettings === void 0 ? void 0 : accountSettings.unarchiveChats)) {
        chat.archived = false;
        chat.readOnly = false;
    }
    const protocolMsg = content === null || content === void 0 ? void 0 : content.protocolMessage;
    if (protocolMsg) {
        switch (protocolMsg.type) {
            case WAProto_1.proto.Message.ProtocolMessage.Type.HISTORY_SYNC_NOTIFICATION:
                const histNotification = protocolMsg.historySyncNotification;
                const process = shouldProcessHistoryMsg;
                const isLatest = !((_c = creds.processedHistoryMessages) === null || _c === void 0 ? void 0 : _c.length);
                logger === null || logger === void 0 ? void 0 : logger.info({
                    histNotification,
                    process,
                    id: message.key.id,
                    isLatest,
                }, 'got history notification');
                if (process && require('./history-validation').historyPayloadKind(histNotification)) {
                    const data = await (0, history_1.downloadAndProcessHistorySyncNotification)(histNotification, options);
                    if (data.skipped) break;
                    if (histNotification.syncType !== WAProto_1.proto.HistorySync.HistorySyncType.ON_DEMAND) {
                        ev.emit('creds.update', {
                            processedHistoryMessages: [
                                ...(creds.processedHistoryMessages || []).slice(-99),
                                { key: message.key, messageTimestamp: message.messageTimestamp }
                            ]
                        });
                    }
                    ev.emit('messaging-history.set', {
                        ...data,
                        isLatest: histNotification.syncType !== WAProto_1.proto.HistorySync.HistorySyncType.ON_DEMAND
                            ? isLatest
                            : undefined,
                        peerDataRequestSessionId: histNotification.peerDataRequestSessionId
                    });
                }
                break;
            case WAProto_1.proto.Message.ProtocolMessage.Type.APP_STATE_SYNC_KEY_SHARE:
                const keys = protocolMsg.appStateSyncKeyShare.keys;
                if (keys === null || keys === void 0 ? void 0 : keys.length) {
                    let newAppStateSyncKeyId = '';
                    await keyStore.transaction(async () => {
                        const newKeys = [];
                        for (const { keyData, keyId } of keys) {
                            const strKeyId = Buffer.from(keyId.keyId).toString('base64');
                            newKeys.push(strKeyId);
                            await keyStore.set({ 'app-state-sync-key': { [strKeyId]: keyData } });
                            newAppStateSyncKeyId = strKeyId;
                        }
                        logger === null || logger === void 0 ? void 0 : logger.info({ newAppStateSyncKeyId, newKeys }, 'injecting new app state sync keys');
                    });
                    ev.emit('creds.update', { myAppStateKeyId: newAppStateSyncKeyId });
                }
                else {
                    logger === null || logger === void 0 ? void 0 : logger.info({ protocolMsg }, 'recv app state sync with 0 keys');
                }
                break;
            case WAProto_1.proto.Message.ProtocolMessage.Type.REVOKE:
                ev.emit('messages.update', [
                    {
                        key: {
                            ...message.key,
                            id: protocolMsg.key.id
                        },
                        update: { message: null, messageStubType: Types_1.WAMessageStubType.REVOKE, key: message.key }
                    }
                ]);
                break;
            case WAProto_1.proto.Message.ProtocolMessage.Type.EPHEMERAL_SETTING:
                Object.assign(chat, {
                    ephemeralSettingTimestamp: (0, generics_1.toNumber)(message.messageTimestamp),
                    ephemeralExpiration: protocolMsg.ephemeralExpiration || null
                });
                break;
            case WAProto_1.proto.Message.ProtocolMessage.Type.PEER_DATA_OPERATION_REQUEST_RESPONSE_MESSAGE:
                const response = protocolMsg.peerDataOperationRequestResponseMessage;
                if (response) {
                    placeholderResendCache === null || placeholderResendCache === void 0 ? void 0 : placeholderResendCache.del(response.stanzaId);
                     
                    const { peerDataOperationResult } = response;
                    for (const result of peerDataOperationResult) {
                        const { placeholderMessageResendResponse: retryResponse } = result;
                        if (retryResponse) {
                            const webMessageInfo = WAProto_1.proto.WebMessageInfo.decode(retryResponse.webMessageInfoBytes);
                             
                            setTimeout(() => {
                                ev.emit('messages.upsert', {
                                    messages: [webMessageInfo],
                                    type: 'notify',
                                    requestId: response.stanzaId
                                });
                            }, 500);
                        }
                    }
                }
            case WAProto_1.proto.Message.ProtocolMessage.Type.MESSAGE_EDIT:
                ev.emit('messages.update', [
                    {
                         
                        key: { ...message.key, id: (_d = protocolMsg.key) === null || _d === void 0 ? void 0 : _d.id },
                        update: {
                            message: {
                                editedMessage: {
                                    message: protocolMsg.editedMessage
                                }
                            },
                            messageTimestamp: protocolMsg.timestampMs
                                ? Math.floor((0, generics_1.toNumber)(protocolMsg.timestampMs) / 1000)
                                : message.messageTimestamp
                        }
                    }
                ]);
                break;
        }
    }
    else if (content === null || content === void 0 ? void 0 : content.reactionMessage) {
        const reaction = {
            ...content.reactionMessage,
            key: message.key,
        };
        ev.emit('messages.reaction', [{
                reaction,
                key: (_e = content.reactionMessage) === null || _e === void 0 ? void 0 : _e.key,
            }]);
    }
    else if (message.messageStubType) {
        const jid = (_f = message.key) === null || _f === void 0 ? void 0 : _f.remoteJid;
         
        let participants;
        const emitParticipantsUpdate = (action) => (ev.emit('group-participants.update', { id: jid, author: message.participant, participants, action }));
        const emitGroupUpdate = (update) => {
            var _a;
            ev.emit('groups.update', [{ id: jid, ...update, author: (_a = message.participant) !== null && _a !== void 0 ? _a : undefined }]);
        };
        const emitGroupRequestJoin = (participant, action, method) => {
            ev.emit('group.join-request', { id: jid, author: message.participant, participant, action, method: method });
        };
        const participantsIncludesMe = () => participants.find(jid => (0, WABinary_1.areJidsSameUser)(meId, jid));
        switch (message.messageStubType) {
            case Types_1.WAMessageStubType.GROUP_PARTICIPANT_CHANGE_NUMBER:
                participants = message.messageStubParameters || [];
                emitParticipantsUpdate('modify');
                break;
            case Types_1.WAMessageStubType.GROUP_PARTICIPANT_LEAVE:
            case Types_1.WAMessageStubType.GROUP_PARTICIPANT_REMOVE:
                participants = message.messageStubParameters || [];
                emitParticipantsUpdate('remove');
                 
                if (participantsIncludesMe()) {
                    chat.readOnly = true;
                }
                break;
            case Types_1.WAMessageStubType.GROUP_PARTICIPANT_ADD:
            case Types_1.WAMessageStubType.GROUP_PARTICIPANT_INVITE:
            case Types_1.WAMessageStubType.GROUP_PARTICIPANT_ADD_REQUEST_JOIN:
                participants = message.messageStubParameters || [];
                if (participantsIncludesMe()) {
                    chat.readOnly = false;
                }
                emitParticipantsUpdate('add');
                break;
            case Types_1.WAMessageStubType.GROUP_PARTICIPANT_DEMOTE:
                participants = message.messageStubParameters || [];
                emitParticipantsUpdate('demote');
                break;
            case Types_1.WAMessageStubType.GROUP_PARTICIPANT_PROMOTE:
                participants = message.messageStubParameters || [];
                emitParticipantsUpdate('promote');
                break;
            case Types_1.WAMessageStubType.GROUP_CHANGE_ANNOUNCE:
                const announceValue = (_g = message.messageStubParameters) === null || _g === void 0 ? void 0 : _g[0];
                emitGroupUpdate({ announce: announceValue === 'true' || announceValue === 'on' });
                break;
            case Types_1.WAMessageStubType.GROUP_CHANGE_RESTRICT:
                const restrictValue = (_h = message.messageStubParameters) === null || _h === void 0 ? void 0 : _h[0];
                emitGroupUpdate({ restrict: restrictValue === 'true' || restrictValue === 'on' });
                break;
            case Types_1.WAMessageStubType.GROUP_CHANGE_SUBJECT:
                const name = (_j = message.messageStubParameters) === null || _j === void 0 ? void 0 : _j[0];
                chat.name = name;
                emitGroupUpdate({ subject: name });
                break;
            case Types_1.WAMessageStubType.GROUP_CHANGE_DESCRIPTION:
                const description = (_k = message.messageStubParameters) === null || _k === void 0 ? void 0 : _k[0];
                chat.description = description;
                emitGroupUpdate({ desc: description });
                break;
            case Types_1.WAMessageStubType.GROUP_CHANGE_INVITE_LINK:
                const code = (_l = message.messageStubParameters) === null || _l === void 0 ? void 0 : _l[0];
                emitGroupUpdate({ inviteCode: code });
                break;
            case Types_1.WAMessageStubType.GROUP_MEMBER_ADD_MODE:
                const memberAddValue = (_m = message.messageStubParameters) === null || _m === void 0 ? void 0 : _m[0];
                emitGroupUpdate({ memberAddMode: memberAddValue === 'all_member_add' });
                break;
            case Types_1.WAMessageStubType.GROUP_MEMBERSHIP_JOIN_APPROVAL_MODE:
                const approvalMode = (_o = message.messageStubParameters) === null || _o === void 0 ? void 0 : _o[0];
                emitGroupUpdate({ joinApprovalMode: approvalMode === 'on' });
                break;
            case Types_1.WAMessageStubType.GROUP_MEMBERSHIP_JOIN_APPROVAL_REQUEST_NON_ADMIN_ADD:
                const participant = (_p = message.messageStubParameters) === null || _p === void 0 ? void 0 : _p[0];
                const action = (_q = message.messageStubParameters) === null || _q === void 0 ? void 0 : _q[1];
                const method = (_r = message.messageStubParameters) === null || _r === void 0 ? void 0 : _r[2];
                emitGroupRequestJoin(participant, action, method);
                break;
        }
    }
    else if (content === null || content === void 0 ? void 0 : content.pollUpdateMessage) {
        const creationMsgKey = content.pollUpdateMessage.pollCreationMessageKey;
         
        const pollMsg = await getMessage(creationMsgKey);
        if (pollMsg) {
            const meIdNormalised = (0, WABinary_1.jidNormalizedUser)(meId);
            const pollCreatorJid = (0, generics_1.getKeyAuthor)(creationMsgKey, meIdNormalised);
            const voterJid = (0, generics_1.getKeyAuthor)(message.key, meIdNormalised);
            const pollEncKey = (_s = pollMsg.messageContextInfo) === null || _s === void 0 ? void 0 : _s.messageSecret;
            try {
                const voteMsg = decryptPollVote(content.pollUpdateMessage.vote, {
                    pollEncKey,
                    pollCreatorJid,
                    pollMsgId: creationMsgKey.id,
                    voterJid,
                });
                ev.emit('messages.update', [
                    {
                        key: creationMsgKey,
                        update: {
                            pollUpdates: [
                                {
                                    pollUpdateMessageKey: message.key,
                                    vote: voteMsg,
                                    senderTimestampMs: content.pollUpdateMessage.senderTimestampMs.toNumber(),
                                }
                            ]
                        }
                    }
                ]);
            }
            catch (err) {
                logger === null || logger === void 0 ? void 0 : logger.warn({ err, creationMsgKey }, 'failed to decrypt poll vote');
            }
        }
        else {
            logger === null || logger === void 0 ? void 0 : logger.warn({ creationMsgKey }, 'poll creation message not found, cannot decrypt update');
        }
    }
    if (Object.keys(chat).length > 1) {
        ev.emit('chats.update', [chat]);
    }
};
exports.default = processMessage;

 
const __kageModule77 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { proto } = require("../../WAProto")
const { WAMessageStubType } = require("../Types")
const {
  getDevice, 
  getContentType,
  normalizeMessageContent 
} = require("../Utils")
const {
  areJidsSameUser,
  isHostedLidUser, 
  isHostedPnUser, 
  isJidBroadcast,
  isJidStatusBroadcast, 
  isLidUser, 
  jidDecode, 
  jidEncode, 
  jidNormalizedUser 
} = require("../WABinary")
const { 
  aesDecryptGCM,
  hmacSign 
} = require("./crypto")
const {
  getKeyAuthor, 
  toNumber 
} = require("./generics")
const { downloadAndProcessHistorySyncNotification } = require("./history")

const REAL_MSG_STUB_TYPES = new Set([
    WAMessageStubType.CALL_MISSED_GROUP_VIDEO,
    WAMessageStubType.CALL_MISSED_GROUP_VOICE,
    WAMessageStubType.CALL_MISSED_VIDEO,
    WAMessageStubType.CALL_MISSED_VOICE
])

const REAL_MSG_REQ_ME_STUB_TYPES = new Set([
    WAMessageStubType.GROUP_PARTICIPANT_ADD
])

 
const cleanMessage = (message, meId, meLid) => {
     
    if (isHostedPnUser(message.key.remoteJid) || isHostedLidUser(message.key.remoteJid)) {
        message.key.remoteJid = jidEncode(jidDecode(message.key?.remoteJid)?.user, isHostedPnUser(message.key.remoteJid) ? 's.whatsapp.net' : 'lid')
    }
    else {
        message.key.remoteJid = jidNormalizedUser(message.key.remoteJid)
    }
    
    if (isHostedPnUser(message.key.participant) || isHostedLidUser(message.key.participant)) {
        message.key.participant = jidEncode(jidDecode(message.key.participant)?.user, isHostedPnUser(message.key.participant) ? 's.whatsapp.net' : 'lid')
    }
    else {
        message.key.participant = jidNormalizedUser(message.key.participant)
    }
    const content = normalizeMessageContent(message.message)
    
     
    if (content?.reactionMessage) {
        normaliseKey(content.reactionMessage.key)
    }
    
    if (content?.pollUpdateMessage) {
        normaliseKey(content.pollUpdateMessage.pollCreationMessageKey)
    }
    
    function normaliseKey(msgKey) {
         
         
        if (!message.key.fromMe) {
             
             
            msgKey.fromMe = !msgKey.fromMe
                ? areJidsSameUser(msgKey.participant || msgKey.remoteJid, meId) ||
                    areJidsSameUser(msgKey.participant || msgKey.remoteJid, meLid)
                :  
                     
                    false
             
             
            msgKey.remoteJid = message.key.remoteJid
             
            msgKey.participant = msgKey.participant || message.key.participant
        }
    }
}

 
const isRealMessage = (message) => {
    const normalizedContent = normalizeMessageContent(message.message)
    const hasSomeContent = !!getContentType(normalizedContent)
    return ((!!normalizedContent ||
        REAL_MSG_STUB_TYPES.has(message.messageStubType) ||
        REAL_MSG_REQ_ME_STUB_TYPES.has(message.messageStubType)) &&
        hasSomeContent &&
        !normalizedContent?.protocolMessage &&
        !normalizedContent?.reactionMessage &&
        !normalizedContent?.pollUpdateMessage)
}

const shouldIncrementChatUnread = (message) => !message.key.fromMe && !message.messageStubType

 



const getChatId = ({ remoteJid, participant, fromMe }) => {
    if (isJidBroadcast(remoteJid)
        && !isJidStatusBroadcast(remoteJid)
        && !fromMe) {
        return participant
    }
    return remoteJid
}

 





function decryptPollVote({ encPayload, encIv }, { pollCreatorJid, pollMsgId, pollEncKey, voterJid, }) {
    const sign = Buffer.concat([
        toBinary(pollMsgId),
        toBinary(pollCreatorJid),
        toBinary(voterJid),
        toBinary('Poll Vote'),
        new Uint8Array([1])
    ])
    const key0 = hmacSign(pollEncKey, new Uint8Array(32), 'sha256')
    const decKey = hmacSign(sign, key0, 'sha256')
    const aad = toBinary(`${pollMsgId}\u0000${voterJid}`)
    const decrypted = aesDecryptGCM(encPayload, decKey, encIv, aad)
    
    return proto.Message.PollVoteMessage.decode(decrypted)
    
    function toBinary(txt) {
        return Buffer.from(txt)
    }
}

 




function decryptEventEdit({ encPayload, encIv }, { eventCreatorJid, eventMsgId, eventEncKey, responderJid }) {
    const sign = Buffer.concat([
        toBinary(eventMsgId),
        toBinary(eventCreatorJid),
        toBinary(responderJid),
        toBinary('Event Edit'),
        new Uint8Array([1])
    ])
    
    const key0 = hmacSign(eventEncKey, new Uint8Array(32), 'sha256')
    const decKey = hmacSign(sign, key0, 'sha256')
    const decrypted = aesDecryptGCM(encPayload, decKey, encIv, null)
    
    return proto.Message.decode(decrypted)
    
    function toBinary(txt) {
        return Buffer.from(txt)
    }
}

 





function decryptEventResponse({ encPayload, encIv }, { eventCreatorJid, eventMsgId, eventEncKey, responderJid }) {
    const sign = Buffer.concat([
        toBinary(eventMsgId),
        toBinary(eventCreatorJid),
        toBinary(responderJid),
        toBinary('Event Response'),
        new Uint8Array([1])
    ])
    
    const key0 = hmacSign(eventEncKey, new Uint8Array(32), 'sha256')
    const decKey = hmacSign(sign, key0, 'sha256')
    const aad = toBinary(`${eventMsgId}\u0000${responderJid}`)
    const decrypted = aesDecryptGCM(encPayload, decKey, encIv, aad)
    
    return proto.Message.EventResponseMessage.decode(decrypted)
    
    function toBinary(txt) {
        return Buffer.from(txt)
    }
}

 




function decryptComment({ encPayload, encIv }, { commentCreatorJid, commentMsgId, commentEncKey, commentJid }) {
    const sign = Buffer.concat([
        toBinary(commentMsgId),
        toBinary(commentCreatorJid),
        toBinary(commentJid),
        toBinary('Enc Comment'),
        new Uint8Array([1])
    ])
    
    const key0 = hmacSign(commentEncKey, new Uint8Array(32), 'sha256')
    const decKey = hmacSign(sign, key0, 'sha256')
    const decrypted = aesDecryptGCM(encPayload, decKey, encIv, null)
    
    return proto.Message.decode(decrypted)
    
    function toBinary(txt) {
        return Buffer.from(txt)
    }
}

 




function decryptReaction({ encPayload, encIv }, { reactionCreatorJid, reactionMsgId, reactionEncKey, reactionJid }) {
    const sign = Buffer.concat([
        toBinary(reactionMsgId),
        toBinary(reactionCreatorJid),
        toBinary(reactionJid),
        toBinary('Enc Reaction'),
        new Uint8Array([1])
    ])
    
    const key0 = hmacSign(reactionEncKey, new Uint8Array(32), 'sha256')
    const decKey = hmacSign(sign, key0, 'sha256')
    const decrypted = aesDecryptGCM(encPayload, decKey, encIv, null)
    
    return proto.Message.ReactionMessage.decode(decrypted)
    
    function toBinary(txt) {
        return Buffer.from(txt)
    }
}

const processMessage = async (message, { shouldProcessHistoryMsg, placeholderResendCache, ev, creds, signalRepository, keyStore, logger, options, getMessage }) => {
    const meId = creds.me.id
    const meLid = creds.me.lid
    const { accountSettings } = creds
    const chat = { id: jidNormalizedUser(getChatId(message.key)) }
    const isRealMsg = isRealMessage(message)
    if (isRealMsg) {
        chat.messages = [{ message }]
        chat.conversationTimestamp = toNumber(message.messageTimestamp)
         
        if (shouldIncrementChatUnread(message)) {
            chat.unreadCount = (chat.unreadCount || 0) + 1
        }
    }
    const content = normalizeMessageContent(message.message)
     
     
    if (isRealMsg || content?.reactionMessage?.key?.fromMe
        && accountSettings?.unarchiveChats) {
        chat.archived = false
        chat.readOnly = false
    }
    const protocolMsg = content?.protocolMessage
    if (protocolMsg) {
        switch (protocolMsg.type) {
            case proto.Message.ProtocolMessage.Type.HISTORY_SYNC_NOTIFICATION:
                const histNotification = protocolMsg.historySyncNotification
                const process = shouldProcessHistoryMsg
                const isLatest = !creds.processedHistoryMessages?.length
                
                logger?.info({
                    histNotification,
                    process,
                    id: message.key.id,
                    isLatest
                }, 'got history notification')
                
                if (process) {
                     
                    if (histNotification.syncType !== proto.HistorySync.HistorySyncType.ON_DEMAND) {
                        ev.emit('creds.update', {
                            processedHistoryMessages: [
                                ...(creds.processedHistoryMessages || []).slice(-99),
                                { key: message.key, messageTimestamp: message.messageTimestamp }
                            ]
                        })
                    }
                    
                    const data = await downloadAndProcessHistorySyncNotification(histNotification, options)
                    ev.emit('messaging-history.set', {
                        ...data,
                        isLatest: histNotification.syncType !== proto.HistorySync.HistorySyncType.ON_DEMAND ? isLatest : undefined,
                        peerDataRequestSessionId: histNotification.peerDataRequestSessionId
                    })
                }
                break
            case proto.Message.ProtocolMessage.Type.APP_STATE_SYNC_KEY_SHARE:
                const keys = protocolMsg.appStateSyncKeyShare.keys
                
                if (keys?.length) {
                    let newAppStateSyncKeyId = ''
                    
                    await keyStore.transaction(async () => {
                        const newKeys = []
                        
                        for (const { keyData, keyId } of keys) {
                            const strKeyId = Buffer.from(keyId.keyId).toString('base64')
                            
                            newKeys.push(strKeyId)
                            
                            await keyStore.set({ 'app-state-sync-key': { [strKeyId]: keyData } })
                            
                            newAppStateSyncKeyId = strKeyId
                        }
                        
                        logger?.info({ newAppStateSyncKeyId, newKeys }, 'injecting new app state sync keys')
                    }, meId)
                    ev.emit('creds.update', { myAppStateKeyId: newAppStateSyncKeyId })
                }
                
                else {
                    logger?.info({ protocolMsg }, 'recv app state sync with 0 keys')
                }
                break
            case proto.Message.ProtocolMessage.Type.REVOKE:
                ev.emit('messages.update', [
                    {
                        key: {
                            ...message.key,
                            id: protocolMsg.key.id
                        },
                        update: { message: null, messageStubType: WAMessageStubType.REVOKE, key: message.key }
                    }
                ])
                break
            case proto.Message.ProtocolMessage.Type.EPHEMERAL_SETTING:
                Object.assign(chat, {
                    ephemeralSettingTimestamp: toNumber(message.messageTimestamp),
                    ephemeralExpiration: protocolMsg.ephemeralExpiration || null
                })
                break
            case proto.Message.ProtocolMessage.Type.PEER_DATA_OPERATION_REQUEST_RESPONSE_MESSAGE:
                const response = protocolMsg.peerDataOperationRequestResponseMessage
                
                if (response) {
                    await placeholderResendCache?.del(response.stanzaId)
                    
                     
                    const { peerDataOperationResult } = response
                    
                    for (const result of peerDataOperationResult) {
                        const { placeholderMessageResendResponse: retryResponse } = result
                        
                         
                        if (retryResponse) {
                            const webMessageInfo = proto.WebMessageInfo.decode(retryResponse.webMessageInfoBytes)
                             
                             
                            setTimeout(() => {
                                ev.emit('messages.upsert', {
                                    messages: [webMessageInfo],
                                    type: 'notify',
                                    requestId: response.stanzaId
                                })
                            }, 500)
                        }
                    }
                }
                break
            case proto.Message.ProtocolMessage.Type.MESSAGE_EDIT:
                ev.emit('messages.update', [
                    {
                         
                        key: { ...message.key, id: protocolMsg.key?.id },
                        update: {
                            message: {
                                editedMessage: {
                                    message: protocolMsg.editedMessage
                                }
                            },
                            messageTimestamp: protocolMsg.timestampMs
                                ? Math.floor(toNumber(protocolMsg.timestampMs) / 1000)
                                : message.messageTimestamp
                        }
                    }
                ])
                break
            case proto.Message.ProtocolMessage.Type.GROUP_MEMBER_LABEL_CHANGE:
                const labelAssociationMsg = protocolMsg.memberLabel
                
                if (labelAssociationMsg?.label) {
                	ev.emit('group.member-tag.update', {
                		groupId: chat.id, 
                		label: labelAssociationMsg.label,
                		participant: message.key.participant, 
                		participantAlt: message.key.participantAlt, 
                		messageTimestamp: Number(message.messageTimestamp)
                	}) 
                }
                break
            case proto.Message.ProtocolMessage.Type.LID_MIGRATION_MAPPING_SYNC:
                const encodedPayload = protocolMsg.lidMigrationMappingSyncMessage?.encodedMappingPayload
                
                const { pnToLidMappings, chatDbMigrationTimestamp } = proto.LIDMigrationMappingSyncPayload.decode(encodedPayload)
                
                logger?.debug({ pnToLidMappings, chatDbMigrationTimestamp }, 'got lid mappings and chat db migration timestamp')
                
                const pairs = []
                
                for (const { pn, latestLid, assignedLid } of pnToLidMappings) {
                    const lid = latestLid || assignedLid
                    pairs.push({ lid: `${lid}@lid`, pn: `${pn}@s.whatsapp.net` })
                }
                
                await signalRepository.lidMapping.storeLIDPNMappings(pairs)
                
                if (pairs.length) {
                    for (const { pn, lid } of pairs) {
                        await signalRepository.migrateSession(pn, lid)
                    }
                }
                break
            case proto.Message.ProtocolMessage.Type.LIMIT_SHARING:
                ev.emit('limit-sharing.update', {
                	id: message.key.remoteJid, 
                    author: areJidsSameUser(message.key.remoteJid, protocolMsg.key.remoteJid) ? jidNormalizedUser(meId) : message.key.remoteJid, 
                    action: `${protocolMsg.limitSharing.sharingLimited ? 'on' : 'off'}`, 
                    trigger: protocolMsg.limitSharing.trigger, 
                    update_time: protocolMsg.limitSharing.limitSharingSettingTimestamp
                }) 
                break
        }
    }
    else if (content?.reactionMessage) {
        const reaction = {
            ...content.reactionMessage,
            key: message.key,
        }
        ev.emit('messages.reaction', [{
                reaction,
                key: content.reactionMessage?.key
            }])
    }
    else if (message.messageStubType) {
        const jid = message.key?.remoteJid
        
        let participants
        
        const emitParticipantsUpdate = (action) => ev.emit('group-participants.update', {
            id: jid,
            author: message.key.participant,
            authorPn: message.key.participantAlt,
            participants,
            action
        })
        
        const emitGroupUpdate = (update) => {
            ev.emit('groups.update', [
                { id: jid, ...update, author: message.key.participant ?? undefined, authorPn: message.key.participantAlt }
            ])
        }
        
        const emitGroupRequestJoin = (participant, action, method) => {
            ev.emit('group.join-request', {
                id: jid,
                author: message.key.participant,
                authorPn: message.key.participantAlt,
                participant: participant.lid,
                participantPn: participant.pn,
                action,
                method: method
            })
        }
        
        const participantsIncludesMe = () => participants.find(jid => areJidsSameUser(meId, jid.phoneNumber))  
        switch (message.messageStubType) {
            case WAMessageStubType.GROUP_PARTICIPANT_CHANGE_NUMBER:
                participants = message.messageStubParameters.map((a) => JSON.parse(a)) || []
                emitParticipantsUpdate('modify')
                break
            case WAMessageStubType.GROUP_PARTICIPANT_LEAVE:
            case WAMessageStubType.GROUP_PARTICIPANT_REMOVE:
                participants = message.messageStubParameters.map((a) => JSON.parse(a)) || []
                emitParticipantsUpdate('remove')
                
                 
                if (participantsIncludesMe()) {
                    chat.readOnly = true
                }
                break
            case WAMessageStubType.GROUP_PARTICIPANT_ADD:
            case WAMessageStubType.GROUP_PARTICIPANT_INVITE:
            case WAMessageStubType.GROUP_PARTICIPANT_ADD_REQUEST_JOIN:
                participants = message.messageStubParameters.map((a) => JSON.parse(a)) || []
                
                if (participantsIncludesMe()) {
                    chat.readOnly = false
                }
                
                emitParticipantsUpdate('add')
                break
            case WAMessageStubType.GROUP_PARTICIPANT_DEMOTE:
                participants = message.messageStubParameters.map((a) => JSON.parse(a)) || []
                emitParticipantsUpdate('demote')
                break
            case WAMessageStubType.GROUP_PARTICIPANT_PROMOTE:
                participants = message.messageStubParameters.map((a) => JSON.parse(a)) || []
                emitParticipantsUpdate('promote')
                break
            case WAMessageStubType.GROUP_CHANGE_ANNOUNCE:
                const announceValue = message.messageStubParameters?.[0]
                emitGroupUpdate({ announce: announceValue === 'true' || announceValue === 'on' })
                break
            case WAMessageStubType.GROUP_CHANGE_RESTRICT:
                const restrictValue = message.messageStubParameters?.[0]
                emitGroupUpdate({ restrict: restrictValue === 'true' || restrictValue === 'on' })
                break
            case WAMessageStubType.GROUP_CHANGE_SUBJECT:
                const name = message.messageStubParameters?.[0]
                chat.name = name
                emitGroupUpdate({ subject: name })
                break
            case WAMessageStubType.GROUP_CHANGE_DESCRIPTION:
                const description = message.messageStubParameters?.[0]
                chat.description = description
                emitGroupUpdate({ desc: description })
                break
            case WAMessageStubType.GROUP_CHANGE_INVITE_LINK:
                const code = message.messageStubParameters?.[0]
                emitGroupUpdate({ inviteCode: code })
                break
            case WAMessageStubType.GROUP_MEMBER_ADD_MODE:
                const memberAddValue = message.messageStubParameters?.[0]
                emitGroupUpdate({ memberAddMode: memberAddValue === 'all_member_add' })
                break
            case WAMessageStubType.GROUP_MEMBERSHIP_JOIN_APPROVAL_MODE:
                const approvalMode = message.messageStubParameters?.[0]
                emitGroupUpdate({ joinApprovalMode: approvalMode === 'on' })
                break
            case WAMessageStubType.GROUP_MEMBERSHIP_JOIN_APPROVAL_REQUEST_NON_ADMIN_ADD:  
                const participant = JSON.parse(message.messageStubParameters?.[0])
                const action = message.messageStubParameters?.[1]
                const method = message.messageStubParameters?.[2]
                emitGroupRequestJoin(participant, action, method)
                break
        }
    }
    else if (content?.pollUpdateMessage) {
        const pollUpdate = content.pollUpdateMessage
        const creationMsgKey = pollUpdate.pollCreationMessageKey

         
        const pollMsg = await getMessage(creationMsgKey)
        if (pollMsg) {
            try {
                const meLidNormalised = jidNormalizedUser(meLid)
                const deviceType = getDevice(creationMsgKey.id) 
                const pollCreationFromMe = deviceType === 'baileys' ? true : false
                const pollEncKey = pollMsg.messageContextInfo?.messageSecret
                const voterJid = getKeyAuthor(message.key, meLidNormalised)

                let pollCreatorJid = getKeyAuthor(creationMsgKey, meLidNormalised)

                if (pollCreationFromMe) {
                    pollCreatorJid = meLidNormalised
                }

                if (!pollEncKey) {
                    logger?.warn({ vote: pollUpdate.vote, creationMsgKey }, 'poll creation: missing messageSecret for decryption') 
                } else {
                    const voteMsg = decryptPollVote(pollUpdate.vote, {
                        pollEncKey,
                        pollCreatorJid,
                        pollMsgId: creationMsgKey.id,
                        voterJid
                    })

                    ev.emit('messages.update', [
                        {
                            key: creationMsgKey,
                            update: {
                                pollUpdates: [
                                    {
                                        pollUpdateMessageKey: message.key,
                                        vote: voteMsg,
                                        senderTimestampMs: content.pollUpdateMessage.senderTimestampMs.toNumber()
                                    }
                                ]
                            }
                        }
                    ])
                }
            }
            catch (err) {
                logger?.warn({ err, creationMsgKey }, 'failed to decrypt poll vote')
            }
        }
        else {
            logger?.warn({ creationMsgKey }, 'poll creation message not found, cannot decrypt update')
        }
    }
    else if (content?.secretEncryptedMessage) {
        const encEventEdit = content.secretEncryptedMessage
        const creationMsgKey = encEventEdit.targetMessageKey
        
        if (proto.Message.SecretEncryptedMessage.SecretEncType[encEventEdit.secretEncType] !== 'EVENT_EDIT') return

         
        const eventMsg = await getMessage(creationMsgKey)
        if (eventMsg) {
            try {
                const meLidNormalised = jidNormalizedUser(meLid)
                const eventCreatorJid = getKeyAuthor(message.key, meLidNormalised)
                const responderJid = getKeyAuthor(message.key, meLidNormalised)
                const eventEncKey = eventMsg.messageContextInfo?.messageSecret

                if (!eventEncKey) {
                    logger?.warn({ encEventEdit, creationMsgKey }, 'event edit: missing messageSecret for decryption') 
                } else {
                    const responseMsg = decryptEventEdit(encEventEdit, {
                        eventEncKey,
                        eventCreatorJid,
                        eventMsgId: creationMsgKey.id,
                        responderJid
                    })
                    const content = normalizeMessageContent(responseMsg)
                    const protocolMsg = content?.protocolMessage

                    ev.emit('messages.update', [
                        {
                            key: { ...message.key, id: protocolMsg.key?.id },
                            update: {
                                message: {
                                	messageContextInfo: responseMsg.messageContextInfo, 
                                	editedMessage: { 
                                		message: protocolMsg.editedMessage
                                	}
                                }, 
                                messageTimestamp: protocolMsg.timestampMs
                             	   ? Math.floor(toNumber(protocolMsg.timestampMs) / 1000)
                          	      : message.messageTimestamp
                            }
                        }
                    ])
                }
            }
            catch (err) {
                logger?.warn({ err, creationMsgKey, encEventEdit }, 'failed to decrypt event edit')
            }
        }
        else {
            logger?.warn({ encEventEdit, creationMsgKey }, 'event creation message not found, cannot decrypt update')
        }
    }
    else if (content?.encEventResponseMessage) {
        const encEventResponse = content.encEventResponseMessage
        const creationMsgKey = encEventResponse.eventCreationMessageKey

         
        const eventMsg = await getMessage(creationMsgKey)
        if (eventMsg) {
            try {
                const meLidNormalised = jidNormalizedUser(meLid)
                const eventCreatorJid = getKeyAuthor(creationMsgKey, meLidNormalised)
                const responderJid = getKeyAuthor(message.key, meLidNormalised)
                const eventEncKey = eventMsg.messageContextInfo?.messageSecret

                if (!eventEncKey) {
                    logger?.warn({ encEventResponse, creationMsgKey }, 'event response: missing messageSecret for decryption') 
                } else {
                    const responseMsg = decryptEventResponse(encEventResponse, {
                        eventEncKey,
                        eventCreatorJid,
                        eventMsgId: creationMsgKey.id,
                        responderJid
                    })

                    const eventResponse = {
                        eventResponseMessageKey: message.key, 
                        senderTimestampMs: responseMsg.timestampMs, 
                        response: responseMsg
                    }

                    ev.emit('messages.update', [
                        {
                            key: creationMsgKey,
                            update: {
                                eventResponses: [eventResponse]
                            }
                        }
                    ])
                }
            }
            catch (err) {
                logger?.warn({ err, creationMsgKey, encEventResponse }, 'failed to decrypt event response')
            }
        }
        else {
            logger?.warn({ encEventResponse, creationMsgKey }, 'event creation message not found, cannot decrypt update')
        }
    }
    else if (content?.encCommentMessage) {
        const encComment = content.encCommentMessage
        const creationMsgKey = encComment.targetMessageKey

         
        const commentMsg = await getMessage(creationMsgKey)
        if (commentMsg) {
            try {
                const meLidNormalised = jidNormalizedUser(meLid)
                const commentCreatorJid = creationMsgKey.participant ? creationMsgKey.participant : message.key?.participant ? message.key.participant : meLidNormalised
                const commentJid = message.key?.participant ? message.key.participant : creationMsgKey.participant ? creationMsgKey.participant : meLidNormalised
                const commentEncKey = commentMsg.messageContextInfo?.messageSecret

                if (!commentEncKey) {
                    logger?.warn({ encComment, creationMsgKey }, 'comment message: missing messageSecret for decryption') 
                } else {
                    const responseMsg = decryptComment(encComment, {
                        commentEncKey,
                        commentCreatorJid,
                        commentMsgId: creationMsgKey.id,
                        commentJid
                    }) 

                    ev.emit('messages.upsert', {
                        messages: [{
                        	key: message.key, 
                        	message: responseMsg
                        }], 
                        type: 'append'
                    }) 
                }
            }
            catch (err) {
                logger?.warn({ err, creationMsgKey, encComment }, 'failed to decrypt comment message')
            }
        }
        else {
            logger?.warn({ encComment, creationMsgKey }, 'creation message not found, cannot decrypt')
        }
    }
    else if (content?.encReactionMessage) {
        const encReaction = content.encReactionMessage
        const creationMsgKey = encReaction.targetMessageKey

         
        const reactMsg = await getMessage(creationMsgKey)
        if (reactMsg) {
            try {
                const meLidNormalised = jidNormalizedUser(meLid)
                const reactionCreatorJid = creationMsgKey.participant ? creationMsgKey.participant : message.key?.participant ? message.key.participant : meLidNormalised
                const reactionJid = message.key?.participant ? message.key.participant : creationMsgKey.participant ? creationMsgKey.participant : meLidNormalised
                const reactionEncKey = reactMsg.messageContextInfo?.messageSecret

                if (!reactionEncKey) {
                    logger?.warn({ encReaction, creationMsgKey }, 'reaction: missing messageSecret for decryption') 
                } else {
                    const responseMsg = decryptReaction(encReaction, {
                        reactionEncKey,
                        reactionCreatorJid,
                        reactionMsgId: creationMsgKey.id,
                        reactionJid
                    })
                    
                    const Reaction = {
                        key: message.key, 
                        message: {
                            reactionMessage: {
                                key: creationMsgKey, 
                                text: responseMsg.text, 
                                senderTimestampMs: responseMsg.senderTimestampMs
                            }
                        }
                    }

                    ev.emit('messages.upsert', {
                        messages: [Reaction], 
                        type: 'append'
                    }) 
                }
            }
            catch (err) {
                logger?.warn({ err, creationMsgKey, encReaction }, 'failed to decrypt reaction')
            }
        }
        else {
            logger?.warn({ encReaction, creationMsgKey }, 'creation message not found, cannot decrypt')
        }
    }
    if (Object.keys(chat).length > 1) {
        ev.emit('chats.update', [chat])
    }
}

module.exports = {
  cleanMessage, 
  isRealMessage, 
  shouldIncrementChatUnread, 
  getChatId, 
  decryptPollVote, 
  decryptEventEdit, 
  decryptEventResponse, 
  decryptComment, 
  decryptReaction, 
  processMessage
}

return module.exports;
})();
for (const key of Object.keys(__kageModule77)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule77[key]});
}

 
const __kageModule182 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getChatId = exports.shouldIncrementChatUnread = exports.isRealMessage = exports.cleanMessage = void 0;
exports.decryptPollVote = decryptPollVote;
exports.decryptEventResponse = decryptEventResponse;
exports.decryptMessageEdit = decryptMessageEdit;
const index_js_1 = require("../../WAProto/index.js");
const index_js_2 = require("../Addon/index.js");
const index_js_3 = require("../Types/index.js");
const messages_js_1 = require("../Utils/messages.js");
const index_js_4 = require("../WABinary/index.js");
const crypto_js_1 = require("./crypto.js");
const generics_js_1 = require("./generics.js");
const history_js_1 = require("./history.js");
const tc_token_utils_js_1 = require("./tc-token-utils.js");
const REAL_MSG_STUB_TYPES = new Set([
    index_js_3.WAMessageStubType.CALL_MISSED_GROUP_VIDEO,
    index_js_3.WAMessageStubType.CALL_MISSED_GROUP_VOICE,
    index_js_3.WAMessageStubType.CALL_MISSED_VIDEO,
    index_js_3.WAMessageStubType.CALL_MISSED_VOICE
]);
const REAL_MSG_REQ_ME_STUB_TYPES = new Set([index_js_3.WAMessageStubType.GROUP_PARTICIPANT_ADD]);
async function storeTcTokensFromHistorySync(chats, signalRepository, keyStore, logger) {
    const getLIDForPN = signalRepository.lidMapping.getLIDForPN.bind(signalRepository.lidMapping);
    const candidates = [];
    for (const chat of chats) {
        const ts = chat.tcTokenTimestamp ? (0, generics_js_1.toNumber)(chat.tcTokenTimestamp) : 0;
        if (chat.tcToken?.length && ts > 0) {
            const jid = (0, index_js_4.jidNormalizedUser)(chat.id);
            const storageJid = await (0, tc_token_utils_js_1.resolveTcTokenJid)(jid, getLIDForPN);
            candidates.push({
                storageJid,
                token: Buffer.from(chat.tcToken),
                ts,
                senderTs: chat.tcTokenSenderTimestamp ? (0, generics_js_1.toNumber)(chat.tcTokenSenderTimestamp) : undefined
            });
        }
    }
    if (!candidates.length) {
        return;
    }
    const jids = candidates.map(c => c.storageJid);
    const existing = await keyStore.get('tctoken', jids);
    const entries = {};
    for (const c of candidates) {
        const existingEntry = existing[c.storageJid];
        const existingTs = existingEntry?.timestamp ? Number(existingEntry.timestamp) : 0;
        if (existingTs > 0 && existingTs >= c.ts) {
            continue;
        }
        entries[c.storageJid] = {
            ...existingEntry,
            token: c.token,
            timestamp: String(c.ts),
            ...(c.senderTs !== undefined ? { senderTimestamp: c.senderTs } : {})
        };
    }
    if (Object.keys(entries).length) {
        logger?.debug({ count: Object.keys(entries).length }, 'storing tctokens from history sync');
        try {
             
            const indexWrite = await (0, tc_token_utils_js_1.buildMergedTcTokenIndexWrite)(keyStore, Object.keys(entries));
            await keyStore.set({ tctoken: { ...entries, ...indexWrite } });
        }
        catch (err) {
            logger?.warn({ err }, 'failed to store tctokens from history sync');
        }
    }
}
 
const cleanMessage = (message, meId, meLid) => {
     
    if ((0, index_js_4.isHostedPnUser)(message.key.remoteJid) || (0, index_js_4.isHostedLidUser)(message.key.remoteJid)) {
        message.key.remoteJid = (0, index_js_4.jidEncode)((0, index_js_4.jidDecode)(message.key?.remoteJid)?.user, (0, index_js_4.isHostedPnUser)(message.key.remoteJid) ? 's.whatsapp.net' : 'lid');
    }
    else {
        message.key.remoteJid = (0, index_js_4.jidNormalizedUser)(message.key.remoteJid);
    }
    if ((0, index_js_4.isHostedPnUser)(message.key.participant) || (0, index_js_4.isHostedLidUser)(message.key.participant)) {
        message.key.participant = (0, index_js_4.jidEncode)((0, index_js_4.jidDecode)(message.key.participant)?.user, (0, index_js_4.isHostedPnUser)(message.key.participant) ? 's.whatsapp.net' : 'lid');
    }
    else {
        message.key.participant = (0, index_js_4.jidNormalizedUser)(message.key.participant);
    }
    const content = (0, messages_js_1.normalizeMessageContent)(message.message);
     
    if (content?.reactionMessage) {
        normaliseKey(content.reactionMessage.key);
    }
    if (content?.pollUpdateMessage) {
        normaliseKey(content.pollUpdateMessage.pollCreationMessageKey);
    }
    function normaliseKey(msgKey) {
         
         
        if (!message.key.fromMe) {
             
             
            msgKey.fromMe = !msgKey.fromMe
                ? (0, index_js_4.areJidsSameUser)(msgKey.participant || msgKey.remoteJid, meId) ||
                    (0, index_js_4.areJidsSameUser)(msgKey.participant || msgKey.remoteJid, meLid)
                :  
                     
                    false;
             
             
            msgKey.remoteJid = message.key.remoteJid;
             
            msgKey.participant = msgKey.participant || message.key.participant;
        }
    }
};
exports.cleanMessage = cleanMessage;
 
const isRealMessage = (message) => {
    const normalizedContent = (0, messages_js_1.normalizeMessageContent)(message.message);
    const hasSomeContent = !!(0, messages_js_1.getContentType)(normalizedContent);
    return ((!!normalizedContent ||
        REAL_MSG_STUB_TYPES.has(message.messageStubType) ||
        REAL_MSG_REQ_ME_STUB_TYPES.has(message.messageStubType)) &&
        hasSomeContent &&
        !normalizedContent?.protocolMessage &&
        !normalizedContent?.reactionMessage &&
        !normalizedContent?.pollUpdateMessage);
};
exports.isRealMessage = isRealMessage;
const shouldIncrementChatUnread = (message) => !message.key.fromMe && !message.messageStubType;
exports.shouldIncrementChatUnread = shouldIncrementChatUnread;
 



const getChatId = ({ remoteJid, participant, fromMe }) => {
    if (!remoteJid) {
        throw new index_js_2.HttpError('Cannot derive chat id: message key is missing remoteJid', {
            data: { remoteJid, participant, fromMe }
        });
    }
    if ((0, index_js_4.isJidBroadcast)(remoteJid) && !(0, index_js_4.isJidStatusBroadcast)(remoteJid) && !fromMe) {
        if (!participant) {
            throw new index_js_2.HttpError('Cannot derive chat id: broadcast message key is missing participant', {
                data: { remoteJid, fromMe }
            });
        }
        return participant;
    }
    return remoteJid;
};
exports.getChatId = getChatId;
 





function decryptPollVote({ encPayload, encIv }, { pollCreatorJid, pollMsgId, pollEncKey, voterJid }) {
    const sign = Buffer.concat([
        toBinary(pollMsgId),
        toBinary(pollCreatorJid),
        toBinary(voterJid),
        toBinary('Poll Vote'),
        new Uint8Array([1])
    ]);
    const key0 = (0, crypto_js_1.hmacSign)(pollEncKey, new Uint8Array(32), 'sha256');
    const decKey = (0, crypto_js_1.hmacSign)(sign, key0, 'sha256');
    const aad = toBinary(`${pollMsgId}\u0000${voterJid}`);
    const decrypted = (0, crypto_js_1.aesDecryptGCM)(encPayload, decKey, encIv, aad);
    return index_js_1.proto.Message.PollVoteMessage.decode(decrypted);
    function toBinary(txt) {
        return Buffer.from(txt);
    }
}
 





function decryptEventResponse({ encPayload, encIv }, { eventCreatorJid, eventMsgId, eventEncKey, responderJid }) {
    const sign = Buffer.concat([
        toBinary(eventMsgId),
        toBinary(eventCreatorJid),
        toBinary(responderJid),
        toBinary('Event Response'),
        new Uint8Array([1])
    ]);
    const key0 = (0, crypto_js_1.hmacSign)(eventEncKey, new Uint8Array(32), 'sha256');
    const decKey = (0, crypto_js_1.hmacSign)(sign, key0, 'sha256');
    const aad = toBinary(`${eventMsgId}\u0000${responderJid}`);
    const decrypted = (0, crypto_js_1.aesDecryptGCM)(encPayload, decKey, encIv, aad);
    return index_js_1.proto.Message.EventResponseMessage.decode(decrypted);
    function toBinary(txt) {
        return Buffer.from(txt);
    }
}
 






















function decryptMessageEdit({ encPayload, encIv }, { originalSenderJid, originalMsgId, editEncKey, editorJid }) {
    const sign = Buffer.concat([
        toBinary(originalMsgId),
        toBinary(originalSenderJid),
        toBinary(editorJid),
        toBinary('Message Edit'),
        new Uint8Array([1])
    ]);
    const key0 = (0, crypto_js_1.hmacSign)(editEncKey, new Uint8Array(32), 'sha256');
    const decKey = (0, crypto_js_1.hmacSign)(sign, key0, 'sha256');
     
     
    const aad = Buffer.alloc(0);
    const decrypted = (0, crypto_js_1.aesDecryptGCM)(encPayload, decKey, encIv, aad);
    return index_js_1.proto.Message.decode(decrypted);
    function toBinary(txt) {
        return Buffer.from(txt);
    }
}
const buildEditUpdate = (args) => {
    const editedInner = decryptMessageEdit({ encPayload: args.encPayload, encIv: args.encIv }, {
        editEncKey: args.editEncKey,
        originalSenderJid: args.originalSenderJid,
        originalMsgId: args.originalMsgId,
        editorJid: args.editorJid
    });
    const editProtocol = editedInner.protocolMessage;
    const innerEdited = editProtocol?.editedMessage;
    if (!innerEdited) {
        args.logger?.warn({ targetKey: args.targetKey }, 'decrypted MESSAGE_EDIT plaintext had no protocolMessage.editedMessage — skipping update');
        return null;
    }
    return {
        key: { ...args.messageKey, id: args.targetKeyId },
        update: {
            message: {
                editedMessage: {
                    message: innerEdited
                }
            },
            messageTimestamp: editProtocol?.timestampMs
                ? Math.floor((0, generics_js_1.toNumber)(editProtocol.timestampMs) / 1000)
                : args.fallbackTimestamp
        }
    };
};
const processMessage = async (message, { shouldProcessHistoryMsg, placeholderResendCache, ev, creds, signalRepository, keyStore, logger, options, getMessage }) => {
    const meId = creds.me.id;
    const { accountSettings } = creds;
    const chat = { id: (0, index_js_4.jidNormalizedUser)((0, exports.getChatId)(message.key)) };
    const isRealMsg = (0, exports.isRealMessage)(message);
    if (isRealMsg) {
        chat.messages = [{ message }];
        chat.conversationTimestamp = (0, generics_js_1.toNumber)(message.messageTimestamp);
         
        if ((0, exports.shouldIncrementChatUnread)(message)) {
            chat.unreadCount = (chat.unreadCount || 0) + 1;
        }
    }
    const content = (0, messages_js_1.normalizeMessageContent)(message.message);
     
     
    if ((isRealMsg || content?.reactionMessage?.key?.fromMe) && accountSettings?.unarchiveChats) {
        chat.archived = false;
        chat.readOnly = false;
    }
    const protocolMsg = content?.protocolMessage;
    if (protocolMsg) {
         
         
         
         
         
         
         
         
         
         
         
         
         
         
         
         
         
         
         
         
        const SELF_ONLY_TYPES = new Set([
            index_js_1.proto.Message.ProtocolMessage.Type.HISTORY_SYNC_NOTIFICATION,
            index_js_1.proto.Message.ProtocolMessage.Type.APP_STATE_SYNC_KEY_SHARE,
            index_js_1.proto.Message.ProtocolMessage.Type.LID_MIGRATION_MAPPING_SYNC,
            index_js_1.proto.Message.ProtocolMessage.Type.PEER_DATA_OPERATION_REQUEST_RESPONSE_MESSAGE
        ]);
        if (protocolMsg.type !== null &&
            protocolMsg.type !== undefined &&
            SELF_ONLY_TYPES.has(protocolMsg.type) &&
            !message.key.fromMe) {
            logger?.warn({ msgId: message.key.id, type: protocolMsg.type, from: message.key.participant || message.key.remoteJid }, 'dropping spoofed self-only protocolMessage from non-self origin');
            return;
        }
        switch (protocolMsg.type) {
            case index_js_1.proto.Message.ProtocolMessage.Type.HISTORY_SYNC_NOTIFICATION:
                const histNotification = protocolMsg.historySyncNotification;
                const process = shouldProcessHistoryMsg;
                const isLatest = !creds.processedHistoryMessages?.length;
                logger?.info({
                    histNotification,
                    process,
                    id: message.key.id,
                    isLatest
                }, 'got history notification');
                if (process) {
                     
                    if (histNotification.syncType !== index_js_1.proto.HistorySync.HistorySyncType.ON_DEMAND) {
                        ev.emit('creds.update', {
                            processedHistoryMessages: [
                                ...(creds.processedHistoryMessages || []).slice(-99),
                                { key: message.key, messageTimestamp: message.messageTimestamp }
                            ]
                        });
                    }
                    const data = await (0, history_js_1.downloadAndProcessHistorySyncNotification)(histNotification, options, logger);
                    if (data.lidPnMappings?.length) {
                        logger?.debug({ count: data.lidPnMappings.length }, 'processing LID-PN mappings from history sync');
                        await signalRepository.lidMapping
                            .storeLIDPNMappings(data.lidPnMappings)
                            .catch(err => logger?.warn({ err }, 'failed to store LID-PN mappings from history sync'));
                    }
                    await storeTcTokensFromHistorySync(data.chats, signalRepository, keyStore, logger);
                    ev.emit('messaging-history.set', {
                        ...data,
                        isLatest: histNotification.syncType !== index_js_1.proto.HistorySync.HistorySyncType.ON_DEMAND ? isLatest : undefined,
                        chunkOrder: histNotification.chunkOrder,
                        peerDataRequestSessionId: histNotification.peerDataRequestSessionId
                    });
                }
                break;
            case index_js_1.proto.Message.ProtocolMessage.Type.APP_STATE_SYNC_KEY_SHARE:
                const keys = protocolMsg.appStateSyncKeyShare.keys;
                if (keys?.length) {
                    let newAppStateSyncKeyId = '';
                    await keyStore.transaction(async () => {
                        const newKeys = [];
                        for (const { keyData, keyId } of keys) {
                            const strKeyId = Buffer.from(keyId.keyId).toString('base64');
                            newKeys.push(strKeyId);
                            await keyStore.set({ 'app-state-sync-key': { [strKeyId]: keyData } });
                            newAppStateSyncKeyId = strKeyId;
                        }
                        logger?.info({ newAppStateSyncKeyId, newKeys }, 'injecting new app state sync keys');
                    }, meId);
                    ev.emit('creds.update', { myAppStateKeyId: newAppStateSyncKeyId });
                }
                else {
                    logger?.info({ protocolMsg }, 'recv app state sync with 0 keys');
                }
                break;
            case index_js_1.proto.Message.ProtocolMessage.Type.REVOKE:
                ev.emit('messages.update', [
                    {
                        key: {
                            ...message.key,
                            id: protocolMsg.key.id
                        },
                        update: { message: null, messageStubType: index_js_3.WAMessageStubType.REVOKE, key: message.key }
                    }
                ]);
                break;
            case index_js_1.proto.Message.ProtocolMessage.Type.EPHEMERAL_SETTING:
                Object.assign(chat, {
                    ephemeralSettingTimestamp: (0, generics_js_1.toNumber)(message.messageTimestamp),
                    ephemeralExpiration: protocolMsg.ephemeralExpiration || null
                });
                break;
            case index_js_1.proto.Message.ProtocolMessage.Type.PEER_DATA_OPERATION_REQUEST_RESPONSE_MESSAGE:
                const response = protocolMsg.peerDataOperationRequestResponseMessage;
                if (response) {
                     
                    const peerDataOperationResult = response.peerDataOperationResult || [];
                    for (const result of peerDataOperationResult) {
                        const retryResponse = result?.placeholderMessageResendResponse;
                         
                        if (!retryResponse?.webMessageInfoBytes) {
                            continue;
                        }
                         
                        try {
                            const webMessageInfo = index_js_1.proto.WebMessageInfo.decode(retryResponse.webMessageInfoBytes);
                            const msgId = webMessageInfo.key?.id;
                             
                             
                            const cachedData = msgId ? await placeholderResendCache?.get(msgId) : undefined;
                             
                            if (msgId) {
                                await placeholderResendCache?.del(msgId);
                            }
                            let finalMsg;
                             
                            if (cachedData && typeof cachedData === 'object') {
                                 
                                cachedData.message = webMessageInfo.message;
                                 
                                if (webMessageInfo.messageTimestamp) {
                                    cachedData.messageTimestamp = webMessageInfo.messageTimestamp;
                                }
                                finalMsg = cachedData;
                            }
                            else {
                                finalMsg = webMessageInfo;
                            }
                            logger?.debug({ msgId, requestId: response.stanzaId }, 'received placeholder resend');
                            ev.emit('messages.upsert', {
                                messages: [finalMsg],
                                type: 'notify',
                                requestId: response.stanzaId
                            });
                        }
                        catch (err) {
                            logger?.warn({ err, stanzaId: response.stanzaId }, 'failed to decode placeholder resend response');
                        }
                    }
                }
                break;
            case index_js_1.proto.Message.ProtocolMessage.Type.MESSAGE_EDIT:
                ev.emit('messages.update', [
                    {
                         
                        key: { ...message.key, id: protocolMsg.key?.id },
                        update: {
                            message: {
                                editedMessage: {
                                    message: protocolMsg.editedMessage
                                }
                            },
                            messageTimestamp: protocolMsg.timestampMs
                                ? Math.floor((0, generics_js_1.toNumber)(protocolMsg.timestampMs) / 1000)
                                : message.messageTimestamp
                        }
                    }
                ]);
                break;
            case index_js_1.proto.Message.ProtocolMessage.Type.GROUP_MEMBER_LABEL_CHANGE:
                const labelAssociationMsg = protocolMsg.memberLabel;
                if (labelAssociationMsg?.label) {
                    ev.emit('group.member-tag.update', {
                        groupId: chat.id,
                        label: labelAssociationMsg.label,
                        participant: message.key.participant,
                        participantAlt: message.key.participantAlt,
                        messageTimestamp: Number(message.messageTimestamp)
                    });
                }
                break;
            case index_js_1.proto.Message.ProtocolMessage.Type.LID_MIGRATION_MAPPING_SYNC:
                const encodedPayload = protocolMsg.lidMigrationMappingSyncMessage?.encodedMappingPayload;
                const { pnToLidMappings, chatDbMigrationTimestamp } = index_js_1.proto.LIDMigrationMappingSyncPayload.decode(encodedPayload);
                logger?.debug({ pnToLidMappings, chatDbMigrationTimestamp }, 'got lid mappings and chat db migration timestamp');
                const pairs = [];
                for (const { pn, latestLid, assignedLid } of pnToLidMappings) {
                    const lid = latestLid || assignedLid;
                    pairs.push({ lid: `${lid}@lid`, pn: `${pn}@s.whatsapp.net` });
                }
                await signalRepository.lidMapping.storeLIDPNMappings(pairs);
                if (pairs.length) {
                    for (const { pn, lid } of pairs) {
                        await signalRepository.migrateSession(pn, lid);
                    }
                }
        }
    }
    else if (content?.reactionMessage) {
        const reaction = {
            ...content.reactionMessage,
            key: message.key
        };
        ev.emit('messages.reaction', [
            {
                reaction,
                key: content.reactionMessage?.key
            }
        ]);
    }
    else if (content?.encEventResponseMessage) {
        const encEventResponse = content.encEventResponseMessage;
        const creationMsgKey = encEventResponse.eventCreationMessageKey;
         
        const eventMsg = await getMessage(creationMsgKey);
        if (eventMsg) {
            try {
                const meIdNormalised = (0, index_js_4.jidNormalizedUser)(meId);
                 
                const eventCreatorKey = creationMsgKey.participant || creationMsgKey.remoteJid;
                const eventCreatorPn = (0, index_js_4.isLidUser)(eventCreatorKey)
                    ? await signalRepository.lidMapping.getPNForLID(eventCreatorKey)
                    : eventCreatorKey;
                const eventCreatorJid = (0, generics_js_1.getKeyAuthor)({ remoteJid: (0, index_js_4.jidNormalizedUser)(eventCreatorPn), fromMe: meIdNormalised === eventCreatorPn }, meIdNormalised);
                const responderJid = (0, generics_js_1.getKeyAuthor)(message.key, meIdNormalised);
                const eventEncKey = eventMsg?.messageContextInfo?.messageSecret;
                if (!eventEncKey) {
                    logger?.warn({ creationMsgKey }, 'event response: missing messageSecret for decryption');
                }
                else {
                    const responseMsg = decryptEventResponse(encEventResponse, {
                        eventEncKey,
                        eventCreatorJid,
                        eventMsgId: creationMsgKey.id,
                        responderJid
                    });
                    const eventResponse = {
                        eventResponseMessageKey: message.key,
                        senderTimestampMs: responseMsg.timestampMs,
                        response: responseMsg
                    };
                    ev.emit('messages.update', [
                        {
                            key: creationMsgKey,
                            update: {
                                eventResponses: [eventResponse]
                            }
                        }
                    ]);
                }
            }
            catch (err) {
                logger?.warn({ err, creationMsgKey }, 'failed to decrypt event response');
            }
        }
        else {
            logger?.warn({ creationMsgKey }, 'event creation message not found, cannot decrypt response');
        }
    }
    else if (content?.secretEncryptedMessage &&
        content.secretEncryptedMessage.secretEncType === index_js_1.proto.Message.SecretEncryptedMessage.SecretEncType.MESSAGE_EDIT) {
         
         
         
         
         
         
        const secEnc = content.secretEncryptedMessage;
        const targetKey = secEnc.targetMessageKey;
        const targetMsg = await getMessage(targetKey);
        if (targetMsg) {
            try {
                const meIdNormalised = (0, index_js_4.jidNormalizedUser)(meId);
                const origSenderRaw = targetKey.participant || targetKey.remoteJid;
                const origSenderPn = (0, index_js_4.isLidUser)(origSenderRaw)
                    ? await signalRepository.lidMapping.getPNForLID(origSenderRaw)
                    : origSenderRaw;
                const originalSenderJid = (0, generics_js_1.getKeyAuthor)({ remoteJid: (0, index_js_4.jidNormalizedUser)(origSenderPn), fromMe: meIdNormalised === origSenderPn }, meIdNormalised);
                const editorJid = (0, generics_js_1.getKeyAuthor)(message.key, meIdNormalised);
                const editEncKey = targetMsg?.messageContextInfo?.messageSecret;
                if (!editEncKey) {
                    logger?.warn({ targetKey }, 'message edit: missing messageSecret on original message — cannot decrypt');
                    return;
                }
                const update = buildEditUpdate({
                    editEncKey,
                    encPayload: secEnc.encPayload,
                    encIv: secEnc.encIv,
                    originalSenderJid,
                    originalMsgId: targetKey.id,
                    editorJid,
                    messageKey: message.key,
                    targetKeyId: targetKey.id,
                    fallbackTimestamp: (0, generics_js_1.toNumber)(message.messageTimestamp),
                    logger,
                    targetKey
                });
                if (update) {
                    ev.emit('messages.update', [update]);
                }
            }
            catch (err) {
                logger?.warn({ err, targetKey }, 'failed to decrypt secretEncryptedMessage MESSAGE_EDIT');
            }
        }
        else {
            logger?.warn({ targetKey }, 'original message not found in store, cannot decrypt secretEncryptedMessage edit');
        }
    }
    else if (message.messageStubType) {
        const jid = message.key?.remoteJid;
         
        let participants;
        const emitParticipantsUpdate = (action) => ev.emit('group-participants.update', {
            id: jid,
            author: message.key.participant,
            authorPn: message.key.participantAlt,
            authorUsername: message.key.participantUsername,
            participants,
            action
        });
        const emitGroupUpdate = (update) => {
            ev.emit('groups.update', [
                {
                    id: jid,
                    ...update,
                    author: message.key.participant ?? undefined,
                    authorPn: message.key.participantAlt,
                    authorUsername: message.key.participantUsername
                }
            ]);
        };
        const emitGroupRequestJoin = (participant, action, method) => {
            ev.emit('group.join-request', {
                id: jid,
                author: message.key.participant,
                authorPn: message.key.participantAlt,
                authorUsername: message.key.participantUsername,
                participant: participant.lid,
                participantPn: participant.pn,
                action,
                method: method
            });
        };
        const participantsIncludesMe = () => participants.find(jid => (0, index_js_4.areJidsSameUser)(meId, jid.phoneNumber));  
        switch (message.messageStubType) {
            case index_js_3.WAMessageStubType.GROUP_PARTICIPANT_CHANGE_NUMBER:
                participants = message.messageStubParameters.map((a) => JSON.parse(a)) || [];
                emitParticipantsUpdate('modify');
                break;
            case index_js_3.WAMessageStubType.GROUP_PARTICIPANT_LEAVE:
            case index_js_3.WAMessageStubType.GROUP_PARTICIPANT_REMOVE:
                participants = message.messageStubParameters.map((a) => JSON.parse(a)) || [];
                emitParticipantsUpdate('remove');
                 
                if (participantsIncludesMe()) {
                    chat.readOnly = true;
                }
                break;
            case index_js_3.WAMessageStubType.GROUP_PARTICIPANT_ADD:
            case index_js_3.WAMessageStubType.GROUP_PARTICIPANT_INVITE:
            case index_js_3.WAMessageStubType.GROUP_PARTICIPANT_ADD_REQUEST_JOIN:
                participants = message.messageStubParameters.map((a) => JSON.parse(a)) || [];
                if (participantsIncludesMe()) {
                    chat.readOnly = false;
                }
                emitParticipantsUpdate('add');
                break;
            case index_js_3.WAMessageStubType.GROUP_PARTICIPANT_DEMOTE:
                participants = message.messageStubParameters.map((a) => JSON.parse(a)) || [];
                emitParticipantsUpdate('demote');
                break;
            case index_js_3.WAMessageStubType.GROUP_PARTICIPANT_PROMOTE:
                participants = message.messageStubParameters.map((a) => JSON.parse(a)) || [];
                emitParticipantsUpdate('promote');
                break;
            case index_js_3.WAMessageStubType.GROUP_CHANGE_ANNOUNCE:
                const announceValue = message.messageStubParameters?.[0];
                emitGroupUpdate({ announce: announceValue === 'true' || announceValue === 'on' });
                break;
            case index_js_3.WAMessageStubType.GROUP_CHANGE_RESTRICT:
                const restrictValue = message.messageStubParameters?.[0];
                emitGroupUpdate({ restrict: restrictValue === 'true' || restrictValue === 'on' });
                break;
            case index_js_3.WAMessageStubType.GROUP_CHANGE_SUBJECT:
                const name = message.messageStubParameters?.[0];
                chat.name = name;
                emitGroupUpdate({ subject: name });
                break;
            case index_js_3.WAMessageStubType.GROUP_CHANGE_DESCRIPTION:
                const description = message.messageStubParameters?.[0];
                chat.description = description;
                emitGroupUpdate({ desc: description });
                break;
            case index_js_3.WAMessageStubType.GROUP_CHANGE_INVITE_LINK:
                const code = message.messageStubParameters?.[0];
                emitGroupUpdate({ inviteCode: code });
                break;
            case index_js_3.WAMessageStubType.GROUP_MEMBER_ADD_MODE:
                const memberAddValue = message.messageStubParameters?.[0];
                emitGroupUpdate({ memberAddMode: memberAddValue === 'all_member_add' });
                break;
            case index_js_3.WAMessageStubType.GROUP_MEMBERSHIP_JOIN_APPROVAL_MODE:
                const approvalMode = message.messageStubParameters?.[0];
                emitGroupUpdate({ joinApprovalMode: approvalMode === 'on' });
                break;
            case index_js_3.WAMessageStubType.GROUP_MEMBERSHIP_JOIN_APPROVAL_REQUEST_NON_ADMIN_ADD:  
                const participant = JSON.parse(message.messageStubParameters?.[0]);
                const action = message.messageStubParameters?.[1];
                const method = message.messageStubParameters?.[2];
                emitGroupRequestJoin(participant, action, method);
                break;
        }
    }  
















































    if (Object.keys(chat).length > 1) {
        ev.emit('chats.update', [chat]);
    }
};
exports.default = processMessage;

return module.exports;
})();
for (const key of Object.keys(__kageModule182)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule182[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule182, configurable:true});
