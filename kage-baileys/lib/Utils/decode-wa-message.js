"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decryptMessageNode = exports.NACK_REASONS = exports.MISSING_KEYS_ERROR_TEXT = exports.NO_MESSAGE_FOUND_ERROR_TEXT = void 0;
exports.decodeMessageNode = decodeMessageNode;
const boom_1 = require("@hapi/boom");
const WAProto_1 = require("../../WAProto");
const WABinary_1 = require("../WABinary");
const generics_1 = require("./generics");
exports.NO_MESSAGE_FOUND_ERROR_TEXT = 'Message absent from node';
exports.MISSING_KEYS_ERROR_TEXT = 'Key used already or never filled';
exports.NACK_REASONS = {
    ParsingError: 487,
    UnrecognizedStanza: 488,
    UnrecognizedStanzaClass: 489,
    UnrecognizedStanzaType: 490,
    InvalidProtobuf: 491,
    InvalidHostedCompanionStanza: 493,
    MissingMessageSecret: 495,
    SignalErrorOldCounter: 496,
    MessageDeletedOnPeer: 499,
    UnhandledError: 500,
    UnsupportedAdminRevoke: 550,
    UnsupportedLIDGroup: 551,
    DBOperationFailed: 552
};
function decodeMessageNode(stanza, meId, meLid) {
    var _a, _b, _c, _d, _e, _f, _g;
    let msgType;
    let chatId;
    let author;
    const msgId = stanza.attrs.id;
    const from = stanza.attrs.from;
    const senderPn = (_a = stanza === null || stanza === void 0 ? void 0 : stanza.attrs) === null || _a === void 0 ? void 0 : _a.sender_pn;
    const senderLid = (_b = stanza === null || stanza === void 0 ? void 0 : stanza.attrs) === null || _b === void 0 ? void 0 : _b.sender_lid;
    const participant = stanza.attrs.participant;
    const participantLid = (_c = stanza === null || stanza === void 0 ? void 0 : stanza.attrs) === null || _c === void 0 ? void 0 : _c.participant_lid;
    const recipient = stanza.attrs.recipient;
    const isMe = (jid) => (0, WABinary_1.areJidsSameUser)(jid, meId);
    const isMeLid = (jid) => (0, WABinary_1.areJidsSameUser)(jid, meLid);
    const normalizePrivateChatJid = (jid) => {
        if (!(0, WABinary_1.isLidUser)(jid)) {
            return jid;
        }
        if (senderPn && (0, WABinary_1.isJidUser)(senderPn)) {
            return senderPn;
        }
        return jid;
    };
    if ((0, WABinary_1.isJidUser)(from) || (0, WABinary_1.isLidUser)(from)) {
        const normalizedFrom = normalizePrivateChatJid(from);
        if (recipient && !(0, WABinary_1.isJidMetaAi)(recipient)) {
            if (!isMe(from) && !isMeLid(from)) {
                throw new boom_1.Boom('receipient present, but msg not from me', { data: stanza });
            }
            chatId = recipient;
        }
        else {
            chatId = normalizedFrom;
        }
        msgType = 'chat';
        author = normalizedFrom;
    }
    else if ((0, WABinary_1.isJidGroup)(from)) {
        if (!participant) {
            throw new boom_1.Boom('No participant in group message');
        }
        msgType = 'group';
        author = participant;
        chatId = from;
    }
    else if ((0, WABinary_1.isJidNewsletter)(from)) {
        msgType = 'newsletter';
        author = from;
        chatId = from;
    }
    else if ((0, WABinary_1.isJidBroadcast)(from)) {
        if (!participant) {
            throw new boom_1.Boom('No participant in group message');
        }
        const isParticipantMe = isMe(participant);
        if ((0, WABinary_1.isJidStatusBroadcast)(from)) {
            msgType = isParticipantMe ? 'direct_peer_status' : 'other_status';
        }
        else {
            msgType = isParticipantMe ? 'peer_broadcast' : 'other_broadcast';
        }
        chatId = from;
        author = participant;
    }
    else {
        throw new boom_1.Boom('Unknown message type', { data: stanza });
    }
    const fromMe = (0, WABinary_1.isJidNewsletter)(from) ? !!((_d = stanza.attrs) === null || _d === void 0 ? void 0 : _d.is_sender) || false : ((0, WABinary_1.isLidUser)(from) ? isMeLid : isMe)(stanza.attrs.participant || stanza.attrs.from);
    const pushname = (_e = stanza === null || stanza === void 0 ? void 0 : stanza.attrs) === null || _e === void 0 ? void 0 : _e.notify;
    const key = {
        remoteJid: chatId,
        fromMe,
        id: msgId,
        senderPn,
        senderLid,
        participant,
        participantLid,
        'server_id': (_f = stanza.attrs) === null || _f === void 0 ? void 0 : _f.server_id
    };
    const fullMessage = {
        key,
        messageTimestamp: +stanza.attrs.t,
        pushName: pushname,
        broadcast: (0, WABinary_1.isJidBroadcast)(from)
    };
    if (msgType === 'newsletter') {
        fullMessage.newsletterServerId = +((_g = stanza.attrs) === null || _g === void 0 ? void 0 : _g.server_id);
    }
    if (key.fromMe) {
        fullMessage.status = WAProto_1.proto.WebMessageInfo.Status.SERVER_ACK;
    }
    return {
        fullMessage,
        author,
        sender: msgType === 'chat' ? author : chatId
    };
}
const decryptMessageNode = (stanza, meId, meLid, repository, logger) => {
    const { fullMessage, author, sender } = decodeMessageNode(stanza, meId, meLid);
    return {
        fullMessage,
        category: stanza.attrs.category,
        author,
        async decrypt() {
            var _a;
            let decryptables = 0;
            if (Array.isArray(stanza.content)) {
                for (const { tag, attrs, content } of stanza.content) {
                    if (tag === 'verified_name' && content instanceof Uint8Array) {
                        const cert = WAProto_1.proto.VerifiedNameCertificate.decode(content);
                        const details = WAProto_1.proto.VerifiedNameCertificate.Details.decode(cert.details);
                        fullMessage.verifiedBizName = details.verifiedName;
                    }
                    if (tag === 'unavailable' && attrs.type === 'view_once') {
                        fullMessage.key.isViewOnce = true;
                    }
                    if (tag !== 'enc' && tag !== 'plaintext') {
                        continue;
                    }
                    if (!(content instanceof Uint8Array)) {
                        continue;
                    }
                    decryptables += 1;
                    let msgBuffer;
                    try {
                        const e2eType = tag === 'plaintext' ? 'plaintext' : attrs.type;
                        switch (e2eType) {
                            case 'skmsg':
                                msgBuffer = await repository.decryptGroupMessage({
                                    group: sender,
                                    authorJid: author,
                                    msg: content
                                });
                                break;
                            case 'pkmsg':
                            case 'msg':
                                const user = (0, WABinary_1.isJidUser)(sender) ? sender : author;
                                msgBuffer = await repository.decryptMessage({
                                    jid: user,
                                    type: e2eType,
                                    ciphertext: content
                                });
                                break;
                            case 'plaintext':
                                msgBuffer = content;
                                break;
                            case undefined:
                                msgBuffer = content;
                                break;
                            default:
                                throw new Error(`Unknown e2e type: ${e2eType}`);
                        }
                        let msg = WAProto_1.proto.Message.decode(e2eType !== 'plaintext' ? (0, generics_1.unpadRandomMax16)(msgBuffer) : msgBuffer);
                        msg = ((_a = msg === null || msg === void 0 ? void 0 : msg.deviceSentMessage) === null || _a === void 0 ? void 0 : _a.message) || msg;
                        if (msg.senderKeyDistributionMessage) {
                            try {
                                await repository.processSenderKeyDistributionMessage({
                                    authorJid: author,
                                    item: msg.senderKeyDistributionMessage
                                });
                            }
                            catch (err) {
                                logger.error({ key: fullMessage.key, err }, 'failed to decrypt message');
                            }
                        }
                        if (fullMessage.message) {
                            Object.assign(fullMessage.message, msg);
                        }
                        else {
                            fullMessage.message = msg;
                        }
                    }
                    catch (err) {
                        const isBadMac = err && /Bad MAC|No matching sessions|No session record|No sessions available|No session found|No SenderKeyRecord/.test(err.message || '');
                        if (isBadMac) {
                            logger.debug({ key: fullMessage.key, err }, 'failed to decrypt message (Bad MAC)');
                        } else {
                            logger.error({ key: fullMessage.key, err }, 'failed to decrypt message');
                        }
                        fullMessage.messageStubType = WAProto_1.proto.WebMessageInfo.StubType.CIPHERTEXT;
                        fullMessage.messageStubParameters = [err.message];
                    }
                }
            }
            if (!decryptables) {
                fullMessage.messageStubType = WAProto_1.proto.WebMessageInfo.StubType.CIPHERTEXT;
                fullMessage.messageStubParameters = [exports.NO_MESSAGE_FOUND_ERROR_TEXT];
            }
        }
    };
};
exports.decryptMessageNode = decryptMessageNode;

 
const __kageModule63 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { Boom } = require("@hapi/boom")
const { proto } = require("../../WAProto")
const {
  areJidsSameUser, 
  isHostedLidUser, 
  isHostedPnUser, 
  isJidBroadcast, 
  isJidGroup, 
  isJidMetaAI, 
  isJidNewsletter, 
  isJidStatusBroadcast, 
  isLidUser, 
  isPnUser 
} = require("../WABinary")
const { unpadRandomMax16 } = require("./generics")
const { getDevice } = require("./messages") 

const NO_MESSAGE_FOUND_ERROR_TEXT = 'Message absent from node'

const MISSING_KEYS_ERROR_TEXT = 'Key used already or never filled'

 
const DECRYPTION_RETRY_CONFIG = {
    maxRetries: 3,
    baseDelayMs: 100,
    sessionRecordErrors: ['No session record', 'SessionError: No session record']
}

const NACK_REASONS = {
    ParsingError: 487,
    UnrecognizedStanza: 488,
    UnrecognizedStanzaClass: 489,
    UnrecognizedStanzaType: 490,
    InvalidProtobuf: 491,
    InvalidHostedCompanionStanza: 493,
    MissingMessageSecret: 495,
    SignalErrorOldCounter: 496,
    MessageDeletedOnPeer: 499,
    UnhandledError: 500,
    UnsupportedAdminRevoke: 550,
    UnsupportedLIDGroup: 551,
    DBOperationFailed: 552
}

const extractAddressingContext = (stanza) => {
    let senderAlt
    let recipientAlt
    
    const sender = stanza.attrs.participant || stanza.attrs.from
    const addressingMode = stanza.attrs.addressing_mode || (sender?.endsWith('lid') ? 'lid' : 'pn')
    
    if (addressingMode === 'lid') {
         
         
        senderAlt = stanza.attrs.participant_pn || stanza.attrs.sender_pn || stanza.attrs.peer_recipient_pn
        recipientAlt = stanza.attrs.recipient_pn
         
         
    }
    else {
         
         
        senderAlt = stanza.attrs.participant_lid || stanza.attrs.sender_lid || stanza.attrs.peer_recipient_lid
        recipientAlt = stanza.attrs.recipient_lid
         
         
    }
    
    return {
        addressingMode,
        senderAlt,
        recipientAlt
    }
}

const getDecryptionJid = async (sender, repository) => {
    if (isLidUser(sender) || isHostedLidUser(sender)) {
        return sender
    }
    const mapped = await repository.lidMapping.getLIDForPN(sender)
    return mapped || sender
}

const storeMappingFromEnvelope = async (stanza, sender, repository, decryptionJid, logger) => {
     
    const { senderAlt } = extractAddressingContext(stanza)
    
    if (senderAlt && isLidUser(senderAlt) && isPnUser(sender) && decryptionJid === sender) {
        try {
            await repository.lidMapping.storeLIDPNMappings([{ lid: senderAlt, pn: sender }])
            await repository.migrateSession(sender, senderAlt)
            logger.debug({ sender, senderAlt }, 'Stored LID mapping from envelope')
        }
        catch (error) {
            logger.warn({ sender, senderAlt, error }, 'Failed to store LID mapping')
        }
    }
}

 



 function decodeMessageNode(stanza, meId, meLid) {
    let msgType
    let chatId
    let author
    let fromMe = false
    
    const msgId = stanza.attrs.id
    const from = stanza.attrs.from
    const participant = stanza.attrs.participant
    const recipient = stanza.attrs.recipient
    const addressingContext = extractAddressingContext(stanza)
    const isMe = (jid) => areJidsSameUser(jid, meId)
    const isMeLid = (jid) => areJidsSameUser(jid, meLid)
    
    if (isPnUser(from) || isLidUser(from) || isHostedLidUser(from) || isHostedPnUser(from)) {
        if (recipient && !isJidMetaAI(recipient)) {
            if (!isMe(from) && !isMeLid(from)) {
                throw new Boom('receipient present, but msg not from me', { data: stanza })
            }
            
            if (isMe(from) || isMeLid(from)) {
                fromMe = true
            }
            
            chatId = recipient
        }
        else {
            chatId = from
        }
        
        msgType = 'chat'
        author = from
    }
    
    else if (isJidGroup(from)) {
        if (!participant) {
            throw new Boom('No participant in group message')
        }
        
        if (isMe(participant) || isMeLid(participant)) {
            fromMe = true
        }
        
        msgType = 'group'
        author = participant
        chatId = from
    }
    
    else if (isJidBroadcast(from)) {
        if (!participant) {
            throw new Boom('No participant in group message')
        }
        
        const isParticipantMe = isMe(participant)
        
        if (isJidStatusBroadcast(from)) {
            msgType = isParticipantMe ? 'direct_peer_status' : 'other_status'
        }
        
        else {
            msgType = isParticipantMe ? 'peer_broadcast' : 'other_broadcast'
        }
        
        fromMe = isParticipantMe
        chatId = from
        author = participant
    }
    
    else if (isJidNewsletter(from)) {
        msgType = 'newsletter'
        chatId = from
        author = from
        
        if (isMe(from) || isMeLid(from)) {
            fromMe = true
        }
    }
    
    else {
        throw new Boom('Unknown message type', { data: stanza })
    }
    
    const pushname = stanza?.attrs?.notify
    
    const key = {
        remoteJid: chatId,
        remoteJidAlt: !isJidGroup(chatId) ? addressingContext.senderAlt : undefined,
        fromMe,
        id: msgId,
        participant,
        participantAlt: isJidGroup(chatId) ? addressingContext.senderAlt : undefined,
        addressingMode: addressingContext.addressingMode,
        ...(msgType === 'newsletter' && stanza.attrs.server_id ? { server_id: stanza.attrs.server_id } : {})
    }
    
    const fullMessage = {
        key,
        category: stanza.attrs.category,
        messageTimestamp: +stanza.attrs.t,
        pushName: pushname,
        platform: getDevice(key.id), 
        broadcast: isJidBroadcast(from), 
        newsletter: isJidNewsletter(from)
    }
    
    if (key.fromMe) {
        fullMessage.status = proto.WebMessageInfo.Status.SERVER_ACK
    }
    
    return {
        fullMessage,
        author,
        sender: msgType === 'chat' ? author : chatId
    }
}

const decryptMessageNode = (stanza, meId, meLid, repository, logger) => {
    const { fullMessage, author, sender } = decodeMessageNode(stanza, meId, meLid)
    return {
        fullMessage,
        category: stanza.attrs.category,
        author,
        async decrypt() {
            let decryptables = 0
            
            if (Array.isArray(stanza.content)) {
                for (const { tag, attrs, content } of stanza.content) {
                    if (tag === 'verified_name' && content instanceof Uint8Array) {
                        const cert = proto.VerifiedNameCertificate.decode(content)
                        const details = proto.VerifiedNameCertificate.Details.decode(cert.details)
                        
                        fullMessage.verifiedBizName = details.verifiedName
                    }
                    
                    if (tag === 'unavailable' && attrs.type === 'view_once') {
                        fullMessage.key.isViewOnce = true  
                    }
                    
                    if (attrs.count && tag === 'enc') {
                        fullMessage.retryCount = Number(attrs.count)
                    }
                    
                    if (tag !== 'enc' && tag !== 'plaintext') {
                        continue
                    }
                    
                    if (!(content instanceof Uint8Array)) {
                        continue
                    }
                    
                    decryptables += 1
                    
                    let msgBuffer
                    
                    const decryptionJid = await getDecryptionJid(author, repository)
                    
                    if (tag !== 'plaintext') {
                         
                        await storeMappingFromEnvelope(stanza, author, repository, decryptionJid, logger)
                    }
                    
                    try {
                        const e2eType = tag === 'plaintext' ? 'plaintext' : attrs.type
                        switch (e2eType) {
                            case 'skmsg':
                                msgBuffer = await repository.decryptGroupMessage({
                                    group: sender,
                                    authorJid: author,
                                    msg: content
                                })
                                break
                            case 'pkmsg':
                            case 'msg':
                                msgBuffer = await repository.decryptMessage({
                                    jid: decryptionJid,
                                    type: e2eType,
                                    ciphertext: content
                                })
                                break
                            case 'plaintext':
                                msgBuffer = content
                                break
                            default:
                                throw new Error(`Unknown e2e type: ${e2eType}`)
                        }
                        
                        let msg = proto.Message.decode(e2eType !== 'plaintext' ? unpadRandomMax16(msgBuffer) : msgBuffer)
                        
                        msg = msg.deviceSentMessage?.message || msg
                        
                        if (msg.senderKeyDistributionMessage) {
                            try {
                                await repository.processSenderKeyDistributionMessage({
                                    authorJid: author,
                                    item: msg.senderKeyDistributionMessage
                                })
                            }
                            
                            catch (err) {
                                logger.error({ key: fullMessage.key, err }, 'failed to process sender key distribution message')
                            }
                        }
                        
                        if (fullMessage.message) {
                            Object.assign(fullMessage.message, msg)
                        }
                        
                        else {
                            fullMessage.message = msg
                        }
                    }
                    
                    catch (err) {
                        const errorContext = {
                            key: fullMessage.key,
                            err,
                            messageType: tag === 'plaintext' ? 'plaintext' : attrs.type,
                            sender,
                            author,
                            isSessionRecordError: isSessionRecordError(err)
                        }
                        
                        logger.error(errorContext, 'failed to decrypt message')
                        fullMessage.messageStubType = proto.WebMessageInfo.StubType.CIPHERTEXT
                        fullMessage.messageStubParameters = [err.message.toString()]
                    }
                }
            }
            
             
            if (!decryptables && !fullMessage.key?.isViewOnce) {
                fullMessage.messageStubType = proto.WebMessageInfo.StubType.CIPHERTEXT
                fullMessage.messageStubParameters = [NO_MESSAGE_FOUND_ERROR_TEXT]
            }
        }
    }
}

 


function isSessionRecordError(error) {
    const errorMessage = error?.message || error?.toString() || ''
    return DECRYPTION_RETRY_CONFIG.sessionRecordErrors.some(errorPattern => errorMessage.includes(errorPattern))
}

module.exports = {
  NACK_REASONS, 
  decodeMessageNode, 
  decryptMessageNode, 
  extractAddressingContext, 
  MISSING_KEYS_ERROR_TEXT, 
  DECRYPTION_RETRY_CONFIG, 
  NO_MESSAGE_FOUND_ERROR_TEXT
}
return module.exports;
})();
for (const key of Object.keys(__kageModule63)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule63[key]});
}

 
const __kageModule167 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decryptMessageNode = exports.extractAddressingContext = exports.SERVER_ERROR_CODES = exports.NACK_REASONS = exports.DECRYPTION_RETRY_CONFIG = exports.ACCOUNT_RESTRICTED_TEXT = exports.MISSING_KEYS_ERROR_TEXT = exports.NO_MESSAGE_FOUND_ERROR_TEXT = exports.getDecryptionJid = void 0;
exports.decodeMessageNode = decodeMessageNode;
const index_js_1 = require("../../WAProto/index.js");
const index_js_2 = require("../Addon/index.js");
const index_js_3 = require("../WABinary/index.js");
const generics_js_1 = require("./generics.js");
const getDecryptionJid = async (sender, repository) => {
    if ((0, index_js_3.isLidUser)(sender) || (0, index_js_3.isHostedLidUser)(sender)) {
        return sender;
    }
    const mapped = await repository.lidMapping.getLIDForPN(sender);
    return mapped || sender;
};
exports.getDecryptionJid = getDecryptionJid;
const storeMappingFromEnvelope = async (stanza, sender, repository, decryptionJid, logger) => {
     
    const { senderAlt } = (0, exports.extractAddressingContext)(stanza);
    if (senderAlt && (0, index_js_3.isLidUser)(senderAlt) && (0, index_js_3.isPnUser)(sender) && decryptionJid === sender) {
        try {
            await repository.lidMapping.storeLIDPNMappings([{ lid: senderAlt, pn: sender }]);
            await repository.migrateSession(sender, senderAlt);
            logger.debug({ sender, senderAlt }, 'Stored LID mapping from envelope');
        }
        catch (error) {
            logger.warn({ sender, senderAlt, error }, 'Failed to store LID mapping');
        }
    }
};
exports.NO_MESSAGE_FOUND_ERROR_TEXT = 'Message absent from node';
exports.MISSING_KEYS_ERROR_TEXT = 'Key used already or never filled';
exports.ACCOUNT_RESTRICTED_TEXT = 'Your account has been restricted';
 
exports.DECRYPTION_RETRY_CONFIG = {
    maxRetries: 3,
    baseDelayMs: 100,
    sessionRecordErrors: ['No session record', 'SessionError: No session record']
};
 
exports.NACK_REASONS = {
    SenderReachoutTimelocked: 463,
    ParsingError: 487,
    UnrecognizedStanza: 488,
    UnrecognizedStanzaClass: 489,
    UnrecognizedStanzaType: 490,
    InvalidProtobuf: 491,
    InvalidHostedCompanionStanza: 493,
    MissingMessageSecret: 495,
    SignalErrorOldCounter: 496,
    MessageDeletedOnPeer: 499,
    UnhandledError: 500,
    UnsupportedAdminRevoke: 550,
    UnsupportedLIDGroup: 551,
    DBOperationFailed: 552
};
 




exports.SERVER_ERROR_CODES = {
     




    MessageAccountRestriction: '463',
     
    SmaxInvalid: '479'
};
const extractAddressingContext = (stanza) => {
    let senderAlt;
    let recipientAlt;
    const sender = stanza.attrs.participant || stanza.attrs.from;
    const addressingMode = stanza.attrs.addressing_mode || (sender?.endsWith('lid') ? 'lid' : 'pn');
    if (addressingMode === 'lid') {
         
         
        senderAlt = stanza.attrs.participant_pn || stanza.attrs.sender_pn || stanza.attrs.peer_recipient_pn;
        recipientAlt = stanza.attrs.recipient_pn;
         
         
    }
    else {
         
         
        senderAlt = stanza.attrs.participant_lid || stanza.attrs.sender_lid || stanza.attrs.peer_recipient_lid;
        recipientAlt = stanza.attrs.recipient_lid;
         
         
    }
    return {
        addressingMode,
        senderAlt,
        recipientAlt
    };
};
exports.extractAddressingContext = extractAddressingContext;
 



function decodeMessageNode(stanza, meId, meLid) {
    let msgType;
    let chatId;
    let author;
    let fromMe = false;
    const msgId = stanza.attrs.id;
    const from = stanza.attrs.from;
    const participant = stanza.attrs.participant;
    const recipient = stanza.attrs.recipient;
    if (!msgId) {
        throw new index_js_2.HttpError('Invalid message stanza: missing id attribute', { data: stanza });
    }
    if (!from) {
        throw new index_js_2.HttpError('Invalid message stanza: missing from attribute', { data: stanza });
    }
    const addressingContext = (0, exports.extractAddressingContext)(stanza);
    const isMe = (jid) => (0, index_js_3.areJidsSameUser)(jid, meId);
    const isMeLid = (jid) => (0, index_js_3.areJidsSameUser)(jid, meLid);
    if ((0, index_js_3.isPnUser)(from) || (0, index_js_3.isLidUser)(from) || (0, index_js_3.isHostedLidUser)(from) || (0, index_js_3.isHostedPnUser)(from)) {
        if (recipient && !(0, index_js_3.isJidMetaAI)(recipient)) {
            if (!isMe(from) && !isMeLid(from)) {
                throw new index_js_2.HttpError('receipient present, but msg not from me', { data: stanza });
            }
            if (isMe(from) || isMeLid(from)) {
                fromMe = true;
            }
            chatId = recipient;
        }
        else {
             
             
             
            if (isMe(from) || isMeLid(from)) {
                fromMe = true;
            }
            chatId = from;
        }
        msgType = 'chat';
        author = from;
    }
    else if ((0, index_js_3.isJidGroup)(from)) {
        if (!participant) {
            throw new index_js_2.HttpError('No participant in group message');
        }
        if (isMe(participant) || isMeLid(participant)) {
            fromMe = true;
        }
        msgType = 'group';
        author = participant;
        chatId = from;
    }
    else if ((0, index_js_3.isJidBroadcast)(from)) {
        if (!participant) {
            throw new index_js_2.HttpError('No participant in group message');
        }
        const isParticipantMe = isMe(participant);
        if ((0, index_js_3.isJidStatusBroadcast)(from)) {
            msgType = isParticipantMe ? 'direct_peer_status' : 'other_status';
        }
        else {
            msgType = isParticipantMe ? 'peer_broadcast' : 'other_broadcast';
        }
        fromMe = isParticipantMe;
        chatId = from;
        author = participant;
    }
    else if ((0, index_js_3.isJidNewsletter)(from)) {
        msgType = 'newsletter';
        chatId = from;
        author = from;
        if (isMe(from) || isMeLid(from)) {
            fromMe = true;
        }
    }
    else {
        throw new index_js_2.HttpError('Unknown message type', { data: stanza });
    }
    const pushname = stanza?.attrs?.notify;
    const key = {
        remoteJid: chatId,
        remoteJidAlt: !(0, index_js_3.isJidGroup)(chatId) ? addressingContext.senderAlt : undefined,
        remoteJidUsername: !(0, index_js_3.isJidGroup)(chatId)
            ? stanza.attrs.peer_recipient_username || stanza.attrs.recipient_username
            : undefined,
        fromMe,
        id: msgId,
        participant,
        participantAlt: (0, index_js_3.isJidGroup)(chatId) ? addressingContext.senderAlt : undefined,
        participantUsername: stanza.attrs.participant ? stanza.attrs.participant_username : undefined,
        addressingMode: addressingContext.addressingMode,
        ...(msgType === 'newsletter' && stanza.attrs.server_id ? { server_id: stanza.attrs.server_id } : {})
    };
    const fullMessage = {
        key,
        category: stanza.attrs.category,
        messageTimestamp: +stanza.attrs.t,
        pushName: pushname,
        broadcast: (0, index_js_3.isJidBroadcast)(from)
    };
    if (key.fromMe) {
        fullMessage.status = index_js_1.proto.WebMessageInfo.Status.SERVER_ACK;
    }
    return {
        fullMessage,
        author,
        sender: msgType === 'chat' ? author : chatId
    };
}
const decryptMessageNode = (stanza, meId, meLid, repository, logger) => {
    const { fullMessage, author, sender } = decodeMessageNode(stanza, meId, meLid);
    return {
        fullMessage,
        category: stanza.attrs.category,
        author,
        async decrypt() {
            let decryptables = 0;
            if (Array.isArray(stanza.content)) {
                for (const { tag, attrs, content } of stanza.content) {
                    if (tag === 'verified_name' && content instanceof Uint8Array) {
                        const cert = index_js_1.proto.VerifiedNameCertificate.decode(content);
                        const details = index_js_1.proto.VerifiedNameCertificate.Details.decode(cert.details);
                        fullMessage.verifiedBizName = details.verifiedName;
                    }
                    if (tag === 'unavailable' && attrs.type === 'view_once') {
                        fullMessage.key.isViewOnce = true;  
                    }
                    if (attrs.count && tag === 'enc') {
                        fullMessage.retryCount = Number(attrs.count);
                    }
                    if (tag !== 'enc' && tag !== 'plaintext') {
                        continue;
                    }
                    if (!(content instanceof Uint8Array)) {
                        continue;
                    }
                    decryptables += 1;
                    let msgBuffer;
                    const decryptionJid = await (0, exports.getDecryptionJid)(author, repository);
                    if (tag !== 'plaintext') {
                         
                        await storeMappingFromEnvelope(stanza, author, repository, decryptionJid, logger);
                    }
                    try {
                        const e2eType = tag === 'plaintext' ? 'plaintext' : attrs.type;
                        switch (e2eType) {
                            case 'skmsg':
                                msgBuffer = await repository.decryptGroupMessage({
                                    group: sender,
                                    authorJid: author,
                                    msg: content
                                });
                                break;
                            case 'pkmsg':
                            case 'msg':
                                msgBuffer = await repository.decryptMessage({
                                    jid: decryptionJid,
                                    type: e2eType,
                                    ciphertext: content
                                });
                                break;
                            case 'plaintext':
                                msgBuffer = content;
                                break;
                            default:
                                throw new Error(`Unknown e2e type: ${e2eType}`);
                        }
                        let msg = index_js_1.proto.Message.decode(e2eType !== 'plaintext' ? (0, generics_js_1.unpadRandomMax16)(msgBuffer) : msgBuffer);
                        msg = msg.deviceSentMessage?.message || msg;
                        if (msg.senderKeyDistributionMessage) {
                             
                            try {
                                await repository.processSenderKeyDistributionMessage({
                                    authorJid: author,
                                    item: msg.senderKeyDistributionMessage
                                });
                            }
                            catch (err) {
                                logger.error({ key: fullMessage.key, err }, 'failed to process sender key distribution message');
                            }
                        }
                        if (fullMessage.message) {
                            Object.assign(fullMessage.message, msg);
                        }
                        else {
                            fullMessage.message = msg;
                        }
                    }
                    catch (err) {
                        const errorContext = {
                            key: fullMessage.key,
                            err,
                            messageType: tag === 'plaintext' ? 'plaintext' : attrs.type,
                            sender,
                            author,
                            isSessionRecordError: isSessionRecordError(err)
                        };
                        logger.error(errorContext, 'failed to decrypt message');
                        fullMessage.messageStubType = index_js_1.proto.WebMessageInfo.StubType.CIPHERTEXT;
                        fullMessage.messageStubParameters = [err.message.toString()];
                    }
                }
            }
             
            if (!decryptables && !fullMessage.key?.isViewOnce) {
                fullMessage.messageStubType = index_js_1.proto.WebMessageInfo.StubType.CIPHERTEXT;
                fullMessage.messageStubParameters = [exports.NO_MESSAGE_FOUND_ERROR_TEXT];
            }
        }
    };
};
exports.decryptMessageNode = decryptMessageNode;
 


function isSessionRecordError(error) {
    const errorMessage = error?.message || error?.toString() || '';
    return exports.DECRYPTION_RETRY_CONFIG.sessionRecordErrors.some(errorPattern => errorMessage.includes(errorPattern));
}

return module.exports;
})();
for (const key of Object.keys(__kageModule167)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule167[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule167, configurable:true});

 
for (const name of ["NACK_REASONS"]) {
    const advanced = exports[Symbol.for('kage.advanced')][name];
    for (const [key, value] of Object.entries(advanced || {})) if (!(key in exports[name])) exports[name][key] = value;
}
