"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeMessagesRecvSocket = void 0;
const boom_1 = require("@hapi/boom");
const crypto_1 = require("crypto");
const node_cache_1 = __importDefault(require("@cacheable/node-cache"));
const WAProto_1 = require("../../WAProto");
const Defaults_1 = require("../Defaults");
const Types_1 = require("../Types");
const Utils_1 = require("../Utils");
const make_mutex_1 = require("../Utils/make-mutex");
const WABinary_1 = require("../WABinary");
const groups_1 = require("./groups");
const messages_send_1 = require("./messages-send");
const makeMessagesRecvSocket = (config) => {
    const { logger, retryRequestDelayMs, maxMsgRetryCount, getMessage, shouldIgnoreJid } = config;
    const sock = (0, messages_send_1.makeMessagesSocket)(config);
    const { ev, authState, ws, processingMutex, signalRepository, query, upsertMessage, resyncAppState, groupMetadata, onUnexpectedError, assertSessions, sendNode, relayMessage, sendReceipt, uploadPreKeys, createParticipantNodes, getUSyncDevices, sendPeerDataOperationMessage, } = sock;
     
    const retryMutex = (0, make_mutex_1.makeMutex)();
    const msgRetryCache = config.msgRetryCounterCache || new node_cache_1.default({
        stdTTL: Defaults_1.DEFAULT_CACHE_TTLS.MSG_RETRY,  
        useClones: false
    });
    const callOfferCache = config.callOfferCache || new node_cache_1.default({
        stdTTL: Defaults_1.DEFAULT_CACHE_TTLS.CALL_OFFER,  
        useClones: false
    });
    const placeholderResendCache = config.placeholderResendCache || new node_cache_1.default({
        stdTTL: Defaults_1.DEFAULT_CACHE_TTLS.MSG_RETRY,  
        useClones: false
    });
    const groupParticipantJidCache = new node_cache_1.default({
        stdTTL: 10 * 60,  
        useClones: false
    });
    const groupMetadataWarmupCache = new node_cache_1.default({
        stdTTL: 60,  
        useClones: false
    });
    const pendingDecryptRetries = new Set();
    let sendActiveReceipts = false;
    const cacheGroupParticipants = (metadata) => {
        for (const participant of metadata.participants || []) {
            if (!participant.id || !participant.jid) {
                continue;
            }
            groupParticipantJidCache.set(`${metadata.id}:${participant.id}`, participant.jid);
            if (participant.lid) {
                groupParticipantJidCache.set(`${metadata.id}:${participant.lid}`, participant.jid);
            }
        }
    };
    const warmupGroupParticipants = async (groupJid) => {
        if (groupMetadataWarmupCache.get(groupJid)) {
            return;
        }
        groupMetadataWarmupCache.set(groupJid, true);
        try {
            const metadata = await groupMetadata(groupJid);
            cacheGroupParticipants(metadata);
        }
        catch (error) {
            logger.debug({ error, groupJid }, 'failed to warm up group participant cache');
        }
    };
    const resolveGroupParticipantJid = async (groupJid, participantLid) => {
        const cacheKey = `${groupJid}:${participantLid}`;
        const cachedParticipant = groupParticipantJidCache.get(cacheKey);
        if (cachedParticipant) {
            return cachedParticipant;
        }
        try {
            const metadata = await groupMetadata(groupJid);
            cacheGroupParticipants(metadata);
            return groupParticipantJidCache.get(cacheKey);
        }
        catch (error) {
            logger.debug({ error, groupJid, participantLid }, 'failed to resolve group participant jid');
            return undefined;
        }
    };
    const sendMessageAck = async ({ tag, attrs, content }, errorCode) => {
        const stanza = {
            tag: 'ack',
            attrs: {
                id: attrs.id,
                to: attrs.from,
                class: tag
            }
        };
        if (!!errorCode) {
            stanza.attrs.error = errorCode.toString();
        }
        if (!!attrs.participant) {
            stanza.attrs.participant = attrs.participant;
        }
        if (!!attrs.recipient) {
            stanza.attrs.recipient = attrs.recipient;
        }
        if (!!attrs.type && (tag !== 'message' || (0, WABinary_1.getBinaryNodeChild)({ tag, attrs, content }, 'unavailable') || errorCode !== 0)) {
            stanza.attrs.type = attrs.type;
        }
        if (tag === 'message' && (0, WABinary_1.getBinaryNodeChild)({ tag, attrs, content }, 'unavailable')) {
            stanza.attrs.from = authState.creds.me.id;
        }
        logger.debug({ recv: { tag, attrs }, sent: stanza.attrs }, 'sent ack');
        await sendNode(stanza);
    };
    const offerCall = async (toJid, isVideo = false) => {
        const callId = (0, crypto_1.randomBytes)(16).toString('hex').toUpperCase().substring(0, 64);
        const offerContent = [];
        offerContent.push({ tag: 'audio', attrs: { enc: 'opus', rate: '16000' }, content: undefined });
        offerContent.push({ tag: 'audio', attrs: { enc: 'opus', rate: '8000' }, content: undefined });
        if (isVideo) {
            offerContent.push({
                tag: 'video',
                attrs: {
                    orientation: '0',
                    'screen_width': '1920',
                    'screen_height': '1080',
                    'device_orientation': '0',
                    enc: 'vp8',
                    dec: 'vp8',
                }
            });
        }
        offerContent.push({ tag: 'net', attrs: { medium: '3' }, content: undefined });
        offerContent.push({ tag: 'capability', attrs: { ver: '1' }, content: new Uint8Array([1, 4, 255, 131, 207, 4]) });
        offerContent.push({ tag: 'encopt', attrs: { keygen: '2' }, content: undefined });
        const encKey = (0, crypto_1.randomBytes)(32);
        const devices = (await getUSyncDevices([toJid], true, false)).map(({ user, device }) => (0, WABinary_1.jidEncode)(user, 's.whatsapp.net', device));
        await assertSessions(devices, true);
        const { nodes: destinations, shouldIncludeDeviceIdentity } = await createParticipantNodes(devices, {
            call: {
                callKey: encKey
            }
        });
        offerContent.push({ tag: 'destination', attrs: {}, content: destinations });
        if (shouldIncludeDeviceIdentity) {
            offerContent.push({
                tag: 'device-identity',
                attrs: {},
                content: (0, Utils_1.encodeSignedDeviceIdentity)(authState.creds.account, true)
            });
        }
        const stanza = ({
            tag: 'call',
            attrs: {
                to: toJid,
            },
            content: [{
                    tag: 'offer',
                    attrs: {
                        'call-id': callId,
                        'call-creator': authState.creds.me.id,
                    },
                    content: offerContent,
                }],
        });
        await query(stanza);
        return {
            callId,
            toJid,
            isVideo,
        };
    };
    const rejectCall = async (callId, callFrom) => {
        const stanza = ({
            tag: 'call',
            attrs: {
                from: authState.creds.me.id,
                to: callFrom,
            },
            content: [{
                    tag: 'reject',
                    attrs: {
                        'call-id': callId,
                        'call-creator': callFrom,
                        count: '0',
                    },
                    content: undefined,
                }],
        });
        await query(stanza);
    };
    const sendRetryRequest = async (node, forceIncludeKeys = false) => {
        const { fullMessage } = (0, Utils_1.decodeMessageNode)(node, authState.creds.me.id, authState.creds.me.lid || '');
        const { key: msgKey } = fullMessage;
        const msgId = msgKey.id;
        const key = JSON.stringify([msgKey.remoteJid, msgKey.participant || "", msgId]);
        let retryCount = msgRetryCache.get(key) || 0;
        if (retryCount >= maxMsgRetryCount) {
            logger.debug({ retryCount, msgId }, 'reached retry limit, clearing');
            return;
        }
        retryCount += 1;
        msgRetryCache.set(key, retryCount);
        const { account, signedPreKey, signedIdentityKey: identityKey } = authState.creds;
        if (retryCount === 1) {
             
            requestPlaceholderResend(msgKey).catch(error => onUnexpectedError(error, 'placeholder resend'));
        }
        const deviceIdentity = (0, Utils_1.encodeSignedDeviceIdentity)(account, true);
        await authState.keys.transaction(async () => {
            const receipt = {
                tag: 'receipt',
                attrs: {
                    id: msgId,
                    type: 'retry',
                    to: node.attrs.from
                },
                content: [
                    {
                        tag: 'retry',
                        attrs: {
                            count: retryCount.toString(),
                            id: node.attrs.id,
                            t: node.attrs.t,
                            v: '1'
                        }
                    },
                    {
                        tag: 'registration',
                        attrs: {},
                        content: (0, Utils_1.encodeBigEndian)(authState.creds.registrationId)
                    }
                ]
            };
            if (node.attrs.recipient) {
                receipt.attrs.recipient = node.attrs.recipient;
            }
            if (node.attrs.participant) {
                receipt.attrs.participant = node.attrs.participant;
            }
            if (retryCount > 1 || forceIncludeKeys) {
                const { update, preKeys } = await (0, Utils_1.getNextPreKeys)(authState, 1);
                const [keyId] = Object.keys(preKeys);
                const key = preKeys[+keyId];
                const content = receipt.content;
                content.push({
                    tag: 'keys',
                    attrs: {},
                    content: [
                        { tag: 'type', attrs: {}, content: Buffer.from(Defaults_1.KEY_BUNDLE_TYPE) },
                        { tag: 'identity', attrs: {}, content: identityKey.public },
                        (0, Utils_1.xmppPreKey)(key, +keyId),
                        (0, Utils_1.xmppSignedPreKey)(signedPreKey),
                        { tag: 'device-identity', attrs: {}, content: deviceIdentity }
                    ]
                });
                ev.emit('creds.update', update);
            }
            await sendNode(receipt);
            logger.info({ msgAttrs: node.attrs, retryCount }, 'sent retry receipt');
        });
    };
    const handleEncryptNotification = async (node) => {
        const from = node.attrs.from;
        if (from === WABinary_1.S_WHATSAPP_NET) {
            const countChild = (0, WABinary_1.getBinaryNodeChild)(node, 'count');
            const count = +countChild.attrs.value;
            const shouldUploadMorePreKeys = count < Defaults_1.MIN_PREKEY_COUNT;
            logger.debug({ count, shouldUploadMorePreKeys }, 'recv pre-key count');
            if (shouldUploadMorePreKeys) {
                await uploadPreKeys();
            }
        }
        else {
            const identityNode = (0, WABinary_1.getBinaryNodeChild)(node, 'identity');
            if (identityNode) {
                logger.info({ jid: from }, 'identity changed');
                 
                 
            }
            else {
                logger.info({ node }, 'unknown encrypt notification');
            }
        }
    };
    const handleGroupNotification = (participant, child, msg) => {
        var _a, _b, _c, _d;
        const participantJid = ((_b = (_a = (0, WABinary_1.getBinaryNodeChild)(child, 'participant')) === null || _a === void 0 ? void 0 : _a.attrs) === null || _b === void 0 ? void 0 : _b.jid) || participant;
        switch (child === null || child === void 0 ? void 0 : child.tag) {
            case 'create':
                const metadata = (0, groups_1.extractGroupMetadata)(child);
                msg.messageStubType = Types_1.WAMessageStubType.GROUP_CREATE;
                msg.messageStubParameters = [metadata.subject];
                msg.key = { participant: metadata.owner };
                ev.emit('chats.upsert', [{
                        id: metadata.id,
                        name: metadata.subject,
                        conversationTimestamp: metadata.creation,
                    }]);
                ev.emit('groups.upsert', [{
                        ...metadata,
                        author: participant
                    }]);
                break;
            case 'ephemeral':
            case 'not_ephemeral':
                msg.message = {
                    protocolMessage: {
                        type: WAProto_1.proto.Message.ProtocolMessage.Type.EPHEMERAL_SETTING,
                        ephemeralExpiration: +(child.attrs.expiration || 0)
                    }
                };
                break;
            case 'modify':
                const oldNumber = (0, WABinary_1.getBinaryNodeChildren)(child, 'participant').map(p => p.attrs.jid);
                msg.messageStubParameters = oldNumber || [];
                msg.messageStubType = Types_1.WAMessageStubType.GROUP_PARTICIPANT_CHANGE_NUMBER;
                break;
            case 'promote':
            case 'demote':
            case 'remove':
            case 'add':
            case 'leave':
                const stubType = `GROUP_PARTICIPANT_${child.tag.toUpperCase()}`;
                msg.messageStubType = Types_1.WAMessageStubType[stubType];
                const participants = (0, WABinary_1.getBinaryNodeChildren)(child, 'participant').map(p => p.attrs.jid);
                if (participants.length === 1 &&
                     
                     
                    (0, WABinary_1.areJidsSameUser)(participants[0], participant) &&
                    child.tag === 'remove') {
                    msg.messageStubType = Types_1.WAMessageStubType.GROUP_PARTICIPANT_LEAVE;
                }
                msg.messageStubParameters = participants;
                break;
            case 'subject':
                msg.messageStubType = Types_1.WAMessageStubType.GROUP_CHANGE_SUBJECT;
                msg.messageStubParameters = [child.attrs.subject];
                break;
            case 'description':
                const description = (_d = (_c = (0, WABinary_1.getBinaryNodeChild)(child, 'body')) === null || _c === void 0 ? void 0 : _c.content) === null || _d === void 0 ? void 0 : _d.toString();
                msg.messageStubType = Types_1.WAMessageStubType.GROUP_CHANGE_DESCRIPTION;
                msg.messageStubParameters = description ? [description] : undefined;
                break;
            case 'announcement':
            case 'not_announcement':
                msg.messageStubType = Types_1.WAMessageStubType.GROUP_CHANGE_ANNOUNCE;
                msg.messageStubParameters = [(child.tag === 'announcement') ? 'on' : 'off'];
                break;
            case 'locked':
            case 'unlocked':
                msg.messageStubType = Types_1.WAMessageStubType.GROUP_CHANGE_RESTRICT;
                msg.messageStubParameters = [(child.tag === 'locked') ? 'on' : 'off'];
                break;
            case 'invite':
                msg.messageStubType = Types_1.WAMessageStubType.GROUP_CHANGE_INVITE_LINK;
                msg.messageStubParameters = [child.attrs.code];
                break;
            case 'member_add_mode':
                const addMode = child.content;
                if (addMode) {
                    msg.messageStubType = Types_1.WAMessageStubType.GROUP_MEMBER_ADD_MODE;
                    msg.messageStubParameters = [addMode.toString()];
                }
                break;
            case 'membership_approval_mode':
                const approvalMode = (0, WABinary_1.getBinaryNodeChild)(child, 'group_join');
                if (approvalMode) {
                    msg.messageStubType = Types_1.WAMessageStubType.GROUP_MEMBERSHIP_JOIN_APPROVAL_MODE;
                    msg.messageStubParameters = [approvalMode.attrs.state];
                }
                break;
            case 'created_membership_requests':
                msg.messageStubType = Types_1.WAMessageStubType.GROUP_MEMBERSHIP_JOIN_APPROVAL_REQUEST_NON_ADMIN_ADD;
                msg.messageStubParameters = [participantJid, 'created', child.attrs.request_method];
                break;
            case 'revoked_membership_requests':
                const isDenied = (0, WABinary_1.areJidsSameUser)(participantJid, participant);
                msg.messageStubType = Types_1.WAMessageStubType.GROUP_MEMBERSHIP_JOIN_APPROVAL_REQUEST_NON_ADMIN_ADD;
                msg.messageStubParameters = [participantJid, isDenied ? 'revoked' : 'rejected'];
                break;
                break;
            default:
             
        }
    };
    const handleNewsletterNotification = (id, node) => {
        const messages = (0, WABinary_1.getBinaryNodeChild)(node, 'messages');
        const message = (0, WABinary_1.getBinaryNodeChild)(messages, 'message');
        const serverId = message.attrs.server_id;
        const reactionsList = (0, WABinary_1.getBinaryNodeChild)(message, 'reactions');
        const viewsList = (0, WABinary_1.getBinaryNodeChildren)(message, 'views_count');
        if (reactionsList) {
            const reactions = (0, WABinary_1.getBinaryNodeChildren)(reactionsList, 'reaction');
            if (reactions.length === 0) {
                ev.emit('newsletter.reaction', { id, 'server_id': serverId, reaction: { removed: true } });
            }
            reactions.forEach(item => {
                var _a, _b;
                ev.emit('newsletter.reaction', { id, 'server_id': serverId, reaction: { code: (_a = item.attrs) === null || _a === void 0 ? void 0 : _a.code, count: +((_b = item.attrs) === null || _b === void 0 ? void 0 : _b.count) } });
            });
        }
        if (viewsList.length) {
            viewsList.forEach(item => {
                ev.emit('newsletter.view', { id, 'server_id': serverId, count: +item.attrs.count });
            });
        }
    };
    const handleMexNewsletterNotification = (id, node) => {
        var _a;
        const operation = node === null || node === void 0 ? void 0 : node.attrs.op_name;
        const content = JSON.parse((_a = node === null || node === void 0 ? void 0 : node.content) === null || _a === void 0 ? void 0 : _a.toString());
        let contentPath;
        if (operation === Types_1.MexOperations.PROMOTE || operation === Types_1.MexOperations.DEMOTE) {
            let action;
            if (operation === Types_1.MexOperations.PROMOTE) {
                action = 'promote';
                contentPath = content.data[Types_1.XWAPaths.PROMOTE];
            }
            if (operation === Types_1.MexOperations.DEMOTE) {
                action = 'demote';
                contentPath = content.data[Types_1.XWAPaths.DEMOTE];
            }
            ev.emit('newsletter-participants.update', { id, author: contentPath.actor.pn, user: contentPath.user.pn, new_role: contentPath.user_new_role, action });
        }
        if (operation === Types_1.MexOperations.UPDATE) {
            contentPath = content.data[Types_1.XWAPaths.METADATA_UPDATE];
            ev.emit('newsletter-settings.update', { id, update: contentPath.thread_metadata.settings });
        }
    };
    const processNotification = async (node) => {
        var _a, _b;
        const result = {};
        const [child] = (0, WABinary_1.getAllBinaryNodeChildren)(node);
        const nodeType = node.attrs.type;
        const from = (0, WABinary_1.jidNormalizedUser)(node.attrs.from);
        switch (nodeType) {
            case 'privacy_token':
                const tokenList = (0, WABinary_1.getBinaryNodeChildren)(child, 'token');
                for (const { attrs, content } of tokenList) {
                    const jid = attrs.jid;
                    ev.emit('chats.update', [
                        {
                            id: jid,
                            tcToken: content
                        }
                    ]);
                    logger.debug({ jid }, 'got privacy token update');
                }
                break;
            case 'newsletter':
                handleNewsletterNotification(node.attrs.from, child);
                break;
            case 'mex':
                handleMexNewsletterNotification(node.attrs.from, child);
                break;
            case 'w:gp2':
                handleGroupNotification(node.attrs.participant, child, result);
                break;
            case 'mediaretry':
                const event = (0, Utils_1.decodeMediaRetryNode)(node);
                ev.emit('messages.media-update', [event]);
                break;
            case 'encrypt':
                await handleEncryptNotification(node);
                break;
            case 'devices':
                const devices = (0, WABinary_1.getBinaryNodeChildren)(child, 'device');
                if ((0, WABinary_1.areJidsSameUser)(child.attrs.jid, authState.creds.me.id)) {
                    const deviceJids = devices.map(d => d.attrs.jid);
                    logger.info({ deviceJids }, 'got my own devices');
                }
                break;
            case 'server_sync':
                const update = (0, WABinary_1.getBinaryNodeChild)(node, 'collection');
                if (update) {
                    const name = update.attrs.name;
                    await resyncAppState([name], false);
                }
                break;
            case 'picture':
                const setPicture = (0, WABinary_1.getBinaryNodeChild)(node, 'set');
                const delPicture = (0, WABinary_1.getBinaryNodeChild)(node, 'delete');
                ev.emit('contacts.update', [{
                        id: from || ((_b = (_a = (setPicture || delPicture)) === null || _a === void 0 ? void 0 : _a.attrs) === null || _b === void 0 ? void 0 : _b.hash) || '',
                        imgUrl: setPicture ? 'changed' : 'removed'
                    }]);
                if ((0, WABinary_1.isJidGroup)(from)) {
                    const node = setPicture || delPicture;
                    result.messageStubType = Types_1.WAMessageStubType.GROUP_CHANGE_ICON;
                    if (setPicture) {
                        result.messageStubParameters = [setPicture.attrs.id];
                    }
                    result.participant = node === null || node === void 0 ? void 0 : node.attrs.author;
                    result.key = {
                        ...result.key || {},
                        participant: setPicture === null || setPicture === void 0 ? void 0 : setPicture.attrs.author
                    };
                }
                break;
            case 'account_sync':
                if (child.tag === 'disappearing_mode') {
                    const newDuration = +child.attrs.duration;
                    const timestamp = +child.attrs.t;
                    logger.info({ newDuration }, 'updated account disappearing mode');
                    ev.emit('creds.update', {
                        accountSettings: {
                            ...authState.creds.accountSettings,
                            defaultDisappearingMode: {
                                ephemeralExpiration: newDuration,
                                ephemeralSettingTimestamp: timestamp,
                            },
                        }
                    });
                }
                else if (child.tag === 'blocklist') {
                    const blocklists = (0, WABinary_1.getBinaryNodeChildren)(child, 'item');
                    for (const { attrs } of blocklists) {
                        const blocklist = [attrs.jid];
                        const type = (attrs.action === 'block') ? 'add' : 'remove';
                        ev.emit('blocklist.update', { blocklist, type });
                    }
                }
                break;
            case 'link_code_companion_reg':
                const linkCodeCompanionReg = (0, WABinary_1.getBinaryNodeChild)(node, 'link_code_companion_reg');
                const ref = toRequiredBuffer((0, WABinary_1.getBinaryNodeChildBuffer)(linkCodeCompanionReg, 'link_code_pairing_ref'));
                const primaryIdentityPublicKey = toRequiredBuffer((0, WABinary_1.getBinaryNodeChildBuffer)(linkCodeCompanionReg, 'primary_identity_pub'));
                const primaryEphemeralPublicKeyWrapped = toRequiredBuffer((0, WABinary_1.getBinaryNodeChildBuffer)(linkCodeCompanionReg, 'link_code_pairing_wrapped_primary_ephemeral_pub'));
                const codePairingPublicKey = await decipherLinkPublicKey(primaryEphemeralPublicKeyWrapped);
                const companionSharedKey = Utils_1.Curve.sharedKey(authState.creds.pairingEphemeralKeyPair.private, codePairingPublicKey);
                const random = (0, crypto_1.randomBytes)(32);
                const linkCodeSalt = (0, crypto_1.randomBytes)(32);
                const linkCodePairingExpanded = await (0, Utils_1.hkdf)(companionSharedKey, 32, {
                    salt: linkCodeSalt,
                    info: 'link_code_pairing_key_bundle_encryption_key'
                });
                const encryptPayload = Buffer.concat([Buffer.from(authState.creds.signedIdentityKey.public), primaryIdentityPublicKey, random]);
                const encryptIv = (0, crypto_1.randomBytes)(12);
                const encrypted = (0, Utils_1.aesEncryptGCM)(encryptPayload, linkCodePairingExpanded, encryptIv, Buffer.alloc(0));
                const encryptedPayload = Buffer.concat([linkCodeSalt, encryptIv, encrypted]);
                const identitySharedKey = Utils_1.Curve.sharedKey(authState.creds.signedIdentityKey.private, primaryIdentityPublicKey);
                const identityPayload = Buffer.concat([companionSharedKey, identitySharedKey, random]);
                authState.creds.advSecretKey = (await (0, Utils_1.hkdf)(identityPayload, 32, { info: 'adv_secret' })).toString('base64');
                await query({
                    tag: 'iq',
                    attrs: {
                        to: WABinary_1.S_WHATSAPP_NET,
                        type: 'set',
                        id: sock.generateMessageTag(),
                        xmlns: 'md'
                    },
                    content: [
                        {
                            tag: 'link_code_companion_reg',
                            attrs: {
                                jid: authState.creds.me.id,
                                stage: 'companion_finish',
                            },
                            content: [
                                {
                                    tag: 'link_code_pairing_wrapped_key_bundle',
                                    attrs: {},
                                    content: encryptedPayload
                                },
                                {
                                    tag: 'companion_identity_public',
                                    attrs: {},
                                    content: authState.creds.signedIdentityKey.public
                                },
                                {
                                    tag: 'link_code_pairing_ref',
                                    attrs: {},
                                    content: ref
                                }
                            ]
                        }
                    ]
                });
                authState.creds.registered = true;
                ev.emit('creds.update', authState.creds);
        }
        if (Object.keys(result).length) {
            return result;
        }
    };
    async function decipherLinkPublicKey(data) {
        const buffer = toRequiredBuffer(data);
        const salt = buffer.slice(0, 32);
        const secretKey = await (0, Utils_1.derivePairingCodeKey)(authState.creds.pairingCode, salt);
        const iv = buffer.slice(32, 48);
        const payload = buffer.slice(48, 80);
        return (0, Utils_1.aesDecryptCTR)(payload, secretKey, iv);
    }
    function toRequiredBuffer(data) {
        if (data === undefined) {
            throw new boom_1.Boom('Invalid buffer', { statusCode: 400 });
        }
        return data instanceof Buffer ? data : Buffer.from(data);
    }
    const willSendMessageAgain = (id, participant) => {
        const key = `${id}:${participant}`;
        const retryCount = msgRetryCache.get(key) || 0;
        return retryCount < maxMsgRetryCount;
    };
    const updateSendMessageAgainCount = (id, participant) => {
        const key = `${id}:${participant}`;
        const newValue = (msgRetryCache.get(key) || 0) + 1;
        msgRetryCache.set(key, newValue);
    };
    const sendMessagesAgain = async (key, ids, retryNode) => {
        var _a;
         
        const msgs = await Promise.all(ids.map(id => getMessage({ ...key, id })));
        const remoteJid = key.remoteJid;
        const participant = key.participant || remoteJid;
         
         
         
        const sendToAll = !((_a = (0, WABinary_1.jidDecode)(participant)) === null || _a === void 0 ? void 0 : _a.device);
        await assertSessions([participant], true);
        if ((0, WABinary_1.isJidGroup)(remoteJid)) {
            await authState.keys.set({ 'sender-key-memory': { [remoteJid]: null } });
        }
        logger.debug({ participant, sendToAll }, 'forced new session for retry recp');
        for (const [i, msg] of msgs.entries()) {
            if (msg) {
                updateSendMessageAgainCount(ids[i], participant);
                const msgRelayOpts = { messageId: ids[i] };
                if (sendToAll) {
                    msgRelayOpts.useUserDevicesCache = false;
                }
                else {
                    msgRelayOpts.participant = {
                        jid: participant,
                        count: +retryNode.attrs.count
                    };
                }
                await relayMessage(key.remoteJid, msg, msgRelayOpts);
            }
            else {
                logger.debug({ jid: key.remoteJid, id: ids[i] }, 'recv retry request, but message not available');
            }
        }
    };
    const handleReceipt = async (node) => {
        var _a, _b;
        const { attrs, content } = node;
        const isLid = attrs.from.includes('lid');
        const isNodeFromMe = (0, WABinary_1.areJidsSameUser)(attrs.participant || attrs.from, isLid ? (_a = authState.creds.me) === null || _a === void 0 ? void 0 : _a.lid : (_b = authState.creds.me) === null || _b === void 0 ? void 0 : _b.id);
        const remoteJid = !isNodeFromMe || (0, WABinary_1.isJidGroup)(attrs.from) ? attrs.from : attrs.recipient;
        const fromMe = !attrs.recipient || ((attrs.type === 'retry' || attrs.type === 'sender') && isNodeFromMe);
        const key = {
            remoteJid,
            id: '',
            fromMe,
            participant: attrs.participant
        };
        if (shouldIgnoreJid(remoteJid) && remoteJid !== '@s.whatsapp.net') {
            logger.debug({ remoteJid }, 'ignoring receipt from jid');
            await sendMessageAck(node);
            return;
        }
        const ids = [attrs.id];
        if (Array.isArray(content)) {
            const items = (0, WABinary_1.getBinaryNodeChildren)(content[0], 'item');
            ids.push(...items.map(i => i.attrs.id));
        }
        try {
            await Promise.all([
                processingMutex.mutex(async () => {
                    const status = (0, Utils_1.getStatusFromReceiptType)(attrs.type);
                    if (typeof status !== 'undefined' &&
                        (
                         
                         
                        status >= WAProto_1.proto.WebMessageInfo.Status.SERVER_ACK ||
                            !isNodeFromMe)) {
                        if ((0, WABinary_1.isJidGroup)(remoteJid) || (0, WABinary_1.isJidStatusBroadcast)(remoteJid)) {
                            if (attrs.participant) {
                                const updateKey = status === WAProto_1.proto.WebMessageInfo.Status.DELIVERY_ACK ? 'receiptTimestamp' : 'readTimestamp';
                                ev.emit('message-receipt.update', ids.map(id => ({
                                    key: { ...key, id },
                                    receipt: {
                                        userJid: (0, WABinary_1.jidNormalizedUser)(attrs.participant),
                                        [updateKey]: +attrs.t
                                    }
                                })));
                            }
                        }
                        else {
                            ev.emit('messages.update', ids.map(id => ({
                                key: { ...key, id },
                                update: { status }
                            })));
                        }
                    }
                    if (attrs.type === 'retry') {
                         
                        key.participant = key.participant || attrs.from;
                        const retryNode = (0, WABinary_1.getBinaryNodeChild)(node, 'retry');
                        if (willSendMessageAgain(ids[0], key.participant)) {
                            if (key.fromMe) {
                                try {
                                    logger.debug({ attrs, key }, 'recv retry request');
                                    await sendMessagesAgain(key, ids, retryNode);
                                }
                                catch (error) {
                                    logger.error({ key, ids, trace: error.stack }, 'error in sending message again');
                                }
                            }
                            else {
                                logger.info({ attrs, key }, 'recv retry for not fromMe message');
                            }
                        }
                        else {
                            logger.info({ attrs, key }, 'will not send message again, as sent too many times');
                        }
                    }
                })
            ]);
        }
        finally {
            await sendMessageAck(node);
        }
    };
    const handleNotification = async (node) => {
        const remoteJid = node.attrs.from;
        if (shouldIgnoreJid(remoteJid) && remoteJid !== '@s.whatsapp.net') {
            logger.debug({ remoteJid, id: node.attrs.id }, 'ignored notification');
            await sendMessageAck(node);
            return;
        }
        try {
            await Promise.all([
                processingMutex.mutex(async () => {
                    var _a;
                    const msg = await processNotification(node);
                    if (msg) {
                        const fromMe = (0, WABinary_1.areJidsSameUser)(node.attrs.participant || remoteJid, authState.creds.me.id);
                        msg.key = {
                            remoteJid,
                            fromMe,
                            participant: node.attrs.participant,
                            id: node.attrs.id,
                            ...(msg.key || {})
                        };
                        (_a = msg.participant) !== null && _a !== void 0 ? _a : (msg.participant = node.attrs.participant);
                        msg.messageTimestamp = +node.attrs.t;
                        const fullMsg = WAProto_1.proto.WebMessageInfo.fromObject(msg);
                        await upsertMessage(fullMsg, 'append');
                    }
                })
            ]);
        }
        finally {
            await sendMessageAck(node);
        }
    };
    const handleMessage = async (node) => {
        var _a, _b, _c;
        if (shouldIgnoreJid(node.attrs.from) && node.attrs.from !== '@s.whatsapp.net') {
            logger.debug({ key: node.attrs.key }, 'ignored message');
            await sendMessageAck(node);
            return;
        }
        const encNode = (0, WABinary_1.getBinaryNodeChild)(node, 'enc');
         
        if (encNode && encNode.attrs.type === 'msmsg') {
            logger.warn({ id: node.attrs.id, from: node.attrs.from }, 'msmsg no compatible: contenido cifrado no procesado');
            ev.emit('kage.unsupported-message', { id: node.attrs.id, chat: node.attrs.from, encryption: 'msmsg', reason: 'UNSUPPORTED_ENCRYPTION' });
            await sendMessageAck(node);
            return;
        }
        let response;
        if ((0, WABinary_1.getBinaryNodeChild)(node, 'unavailable') && !encNode) {
            await sendMessageAck(node);
            const { key } = (0, Utils_1.decodeMessageNode)(node, authState.creds.me.id, authState.creds.me.lid || '').fullMessage;
            response = await requestPlaceholderResend(key);
            if (response === 'RESOLVED') {
                return;
            }
            logger.debug('received unavailable message, acked and requested resend from phone');
        }
        else {
            if (placeholderResendCache.get(node.attrs.id)) {
                placeholderResendCache.del(node.attrs.id);
            }
        }
        const { fullMessage: msg, category, author, decrypt } = (0, Utils_1.decryptMessageNode)(node, authState.creds.me.id, authState.creds.me.lid || '', signalRepository, logger);
        if (response && ((_a = msg === null || msg === void 0 ? void 0 : msg.messageStubParameters) === null || _a === void 0 ? void 0 : _a[0]) === Utils_1.NO_MESSAGE_FOUND_ERROR_TEXT) {
            msg.messageStubParameters = [Utils_1.NO_MESSAGE_FOUND_ERROR_TEXT, response];
        }
        if (((_c = (_b = msg.message) === null || _b === void 0 ? void 0 : _b.protocolMessage) === null || _c === void 0 ? void 0 : _c.type) === WAProto_1.proto.Message.ProtocolMessage.Type.SHARE_PHONE_NUMBER && node.attrs.sender_pn) {
            ev.emit('chats.phoneNumberShare', { lid: node.attrs.from, jid: node.attrs.sender_pn });
        }
        try {
            await Promise.all([
                processingMutex.mutex(async () => {
                    var _a, _b, _c, _d, _e, _f;
                    await decrypt();
                     
                    if (msg.messageStubType === WAProto_1.proto.WebMessageInfo.StubType.CIPHERTEXT) {
                        if (((_a = msg === null || msg === void 0 ? void 0 : msg.messageStubParameters) === null || _a === void 0 ? void 0 : _a[0]) === Utils_1.MISSING_KEYS_ERROR_TEXT) {
                            return sendMessageAck(node, Utils_1.NACK_REASONS.ParsingError);
                        }
                        const pendingKey = JSON.stringify([node.attrs.from, node.attrs.participant || '', node.attrs.id]);
                        if (pendingDecryptRetries.has(pendingKey) || pendingDecryptRetries.size >= 128) {
                            await sendMessageAck(node);
                            return;
                        }
                        pendingDecryptRetries.add(pendingKey);
                        retryMutex.mutex(async () => {
                            if (ws.isOpen) {
                                if ((0, WABinary_1.getBinaryNodeChild)(node, 'unavailable')) {
                                    return;
                                }
                                const encNode = (0, WABinary_1.getBinaryNodeChild)(node, 'enc');
                                await sendRetryRequest(node, !encNode);
                                if (retryRequestDelayMs) {
                                    await (0, Utils_1.delay)(retryRequestDelayMs);
                                }
                            }
                            else {
                                logger.debug({ node }, 'connection closed, ignoring retry req');
                            }
                        }).catch(error => onUnexpectedError(error, 'message retry'))
                          .finally(() => pendingDecryptRetries.delete(pendingKey));
                    }
                    else {
                         
                        let type = undefined;
                        if ((_b = msg.key.participant) === null || _b === void 0 ? void 0 : _b.endsWith('@lid')) {
                            const originalLid = msg.key.participant;
                            const mapped = node.attrs.participant_pn || await Promise.resolve(signalRepository.lidMapping?.getPNForLID?.(originalLid)).catch(() => undefined);
                            if (mapped) { msg.key.participantAlt = originalLid; msg.key.participant = mapped; }
                        }
                        if ((0, WABinary_1.isJidGroup)(msg.key.remoteJid) && ((_f = (_e = (_d = (_c = msg.message) === null || _c === void 0 ? void 0 : _c.extendedTextMessage) === null || _d === void 0 ? void 0 : _d.contextInfo) === null || _e === void 0 ? void 0 : _e.participant) === null || _f === void 0 ? void 0 : _f.endsWith('@lid'))) {
                            if (msg.message.extendedTextMessage.contextInfo) {
                                const sender = msg.message.extendedTextMessage.contextInfo.participant;
                                const resolvedSender = await resolveGroupParticipantJid(msg.key.remoteJid, sender);
                                msg.message.extendedTextMessage.contextInfo.participant = resolvedSender || sender;
                            }
                        }
                        else if ((0, WABinary_1.isJidGroup)(msg.key.remoteJid)) {
                            void warmupGroupParticipants(msg.key.remoteJid);
                        }
                        if (!(0, WABinary_1.isJidGroup)(msg.key.remoteJid) && (0, WABinary_1.isLidUser)(msg.key.remoteJid)) {
                            const originalLid = msg.key.remoteJid;
                            const mapped = node.attrs.sender_pn || node.attrs.peer_recipient_pn
                                || await Promise.resolve(signalRepository.lidMapping?.getPNForLID?.(originalLid)).catch(() => undefined);
                            if (mapped) { msg.key.remoteJidAlt = originalLid; msg.key.remoteJid = mapped; }
                        }
                        let participant = msg.key.participant;
                        if (category === 'peer') {  
                            type = 'peer_msg';
                        }
                        else if (msg.key.fromMe) {  
                            type = 'sender';
                             
                            if ((0, WABinary_1.isJidUser)(msg.key.remoteJid)) {
                                participant = author;
                            }
                        }
                        else if (!sendActiveReceipts) {
                            type = 'inactive';
                        }
                        await sendReceipt(msg.key.remoteJid, participant, [msg.key.id], type);
                         
                        const isAnyHistoryMsg = (0, Utils_1.getHistoryMsg)(msg.message);
                        if (isAnyHistoryMsg) {
                            const jid = (0, WABinary_1.jidNormalizedUser)(msg.key.remoteJid);
                            await sendReceipt(jid, undefined, [msg.key.id], 'hist_sync');
                        }
                    }
                    (0, Utils_1.cleanMessage)(msg, authState.creds.me.id);
                    await sendMessageAck(node);
                    await upsertMessage(msg, node.attrs.offline ? 'append' : 'notify');
                })
            ]);
        }
        catch (error) {
            logger.error({ error, node }, 'error in handling message');
        }
    };
    const fetchMessageHistory = async (count, oldestMsgKey, oldestMsgTimestamp) => {
        var _a;
        if (!((_a = authState.creds.me) === null || _a === void 0 ? void 0 : _a.id)) {
            throw new boom_1.Boom('Not authenticated');
        }
        const pdoMessage = {
            historySyncOnDemandRequest: {
                chatJid: oldestMsgKey.remoteJid,
                oldestMsgFromMe: oldestMsgKey.fromMe,
                oldestMsgId: oldestMsgKey.id,
                oldestMsgTimestampMs: oldestMsgTimestamp,
                onDemandMsgCount: count
            },
            peerDataOperationRequestType: WAProto_1.proto.Message.PeerDataOperationRequestType.HISTORY_SYNC_ON_DEMAND
        };
        return sendPeerDataOperationMessage(pdoMessage);
    };
    const requestPlaceholderResend = async (messageKey) => {
        var _a;
        if (!((_a = authState.creds.me) === null || _a === void 0 ? void 0 : _a.id)) {
            throw new boom_1.Boom('Not authenticated');
        }
        if (placeholderResendCache.get(messageKey === null || messageKey === void 0 ? void 0 : messageKey.id)) {
            logger.debug({ messageKey }, 'already requested resend');
            return;
        }
        else {
            placeholderResendCache.set(messageKey === null || messageKey === void 0 ? void 0 : messageKey.id, true);
        }
        await (0, Utils_1.delay)(5000);
        if (!placeholderResendCache.get(messageKey === null || messageKey === void 0 ? void 0 : messageKey.id)) {
            logger.debug({ messageKey }, 'message received while resend requested');
            return 'RESOLVED';
        }
        const pdoMessage = {
            placeholderMessageResendRequest: [{
                    messageKey
                }],
            peerDataOperationRequestType: WAProto_1.proto.Message.PeerDataOperationRequestType.PLACEHOLDER_MESSAGE_RESEND
        };
        setTimeout(() => {
            if (placeholderResendCache.get(messageKey === null || messageKey === void 0 ? void 0 : messageKey.id)) {
                logger.debug({ messageKey }, 'PDO message without response after 15 seconds. Phone possibly offline');
                placeholderResendCache.del(messageKey === null || messageKey === void 0 ? void 0 : messageKey.id);
            }
        }, 15000);
        return sendPeerDataOperationMessage(pdoMessage);
    };
    const handleCall = async (node) => {
        const { attrs } = node;
        const [infoChild] = (0, WABinary_1.getAllBinaryNodeChildren)(node);
        const callId = infoChild.attrs['call-id'];
        const from = infoChild.attrs.from || infoChild.attrs['call-creator'];
        const status = (0, Utils_1.getCallStatusFromNode)(infoChild);
        const call = {
            chatId: attrs.from,
            from,
            id: callId,
            date: new Date(+attrs.t * 1000),
            offline: !!attrs.offline,
            status,
        };
        if (status === 'offer') {
            call.isVideo = !!(0, WABinary_1.getBinaryNodeChild)(infoChild, 'video');
            call.isGroup = infoChild.attrs.type === 'group' || !!infoChild.attrs['group-jid'];
            call.groupJid = infoChild.attrs['group-jid'];
            callOfferCache.set(call.id, call);
        }
        const existingCall = callOfferCache.get(call.id);
         
        if (existingCall) {
            call.isVideo = existingCall.isVideo;
            call.isGroup = existingCall.isGroup;
        }
         
        if (status === 'reject' || status === 'accept' || status === 'timeout' || status === 'terminate') {
            callOfferCache.del(call.id);
        }
        ev.emit('call', [call]);
        await sendMessageAck(node);
    };
    const handleBadAck = async ({ attrs }) => {
        const key = { remoteJid: attrs.from, fromMe: true, id: attrs.id, 'server_id': attrs === null || attrs === void 0 ? void 0 : attrs.server_id };
         
         
         
        if (attrs.phash) {
            logger.info({ attrs }, 'received phash in ack, resending message...');
            const cacheKey = `${key.remoteJid}:${key.id}`;
            if ((msgRetryCache.get(cacheKey) || 0) >= maxMsgRetryCount) {
                logger.warn({ attrs }, 'reached max retry count, not sending message again');
                msgRetryCache.set(cacheKey, maxMsgRetryCount);
                return;
            }
            const retryCount = msgRetryCache.get(cacheKey) || 0;
            const msg = await getMessage(key);
            if (msg) {
                await relayMessage(key.remoteJid, msg, { messageId: key.id, useUserDevicesCache: false });
                msgRetryCache.set(cacheKey, retryCount + 1);
            }
            else {
                logger.warn({ attrs }, 'could not send message again, as it was not found');
            }
        }
         
         
        if (attrs.error) {
            logger.warn({ attrs }, 'received error in ack');
            ev.emit('messages.update', [
                {
                    key,
                    update: {
                        status: Types_1.WAMessageStatus.ERROR,
                        messageStubParameters: [
                            attrs.error
                        ]
                    }
                }
            ]);
        }
    };
     
     
    const processNodeWithBuffer = async (node, identifier, exec) => {
        ev.buffer();
        await execTask();
        ev.flush();
        function execTask() {
            return exec(node, false)
                .catch(err => onUnexpectedError(err, identifier));
        }
    };
    const makeOfflineNodeProcessor = () => {
        const nodeProcessorMap = new Map([
            ['message', handleMessage],
            ['call', handleCall],
            ['receipt', handleReceipt],
            ['notification', handleNotification]
        ]);
        const nodes = [];
        let isProcessing = false;
        const enqueue = (type, node) => {
            nodes.push({ type, node });
            if (isProcessing) {
                return;
            }
            isProcessing = true;
            const promise = async () => {
                while (nodes.length && ws.isOpen) {
                    const { type, node } = nodes.shift();
                    const nodeProcessor = nodeProcessorMap.get(type);
                    if (!nodeProcessor) {
                        onUnexpectedError(new Error(`unknown offline node type: ${type}`), 'processing offline node');
                        continue;
                    }
                    await nodeProcessor(node);
                }
                isProcessing = false;
            };
            promise().catch(error => onUnexpectedError(error, 'processing offline nodes'));
        };
        return { enqueue };
    };
    const offlineNodeProcessor = makeOfflineNodeProcessor();
    const processNode = (type, node, identifier, exec) => {
        const isOffline = !!node.attrs.offline;
        if (isOffline) {
            offlineNodeProcessor.enqueue(type, node);
        }
        else {
            processNodeWithBuffer(node, identifier, exec);
        }
    };
     
    ws.on('CB:message', (node) => {
        processNode('message', node, 'processing message', handleMessage);
    });
    ws.on('CB:call', async (node) => {
        processNode('call', node, 'handling call', handleCall);
    });
    ws.on('CB:receipt', node => {
        processNode('receipt', node, 'handling receipt', handleReceipt);
    });
    ws.on('CB:notification', async (node) => {
        processNode('notification', node, 'handling notification', handleNotification);
    });
    ws.on('CB:ack,class:message', (node) => {
        handleBadAck(node)
            .catch(error => onUnexpectedError(error, 'handling bad ack'));
    });
    ev.on('call', ([call]) => {
         
        if (call.status === 'timeout' || (call.status === 'offer' && call.isGroup)) {
            const msg = {
                key: {
                    remoteJid: call.chatId,
                    id: call.id,
                    fromMe: false
                },
                messageTimestamp: (0, Utils_1.unixTimestampSeconds)(call.date),
            };
            if (call.status === 'timeout') {
                if (call.isGroup) {
                    msg.messageStubType = call.isVideo ? Types_1.WAMessageStubType.CALL_MISSED_GROUP_VIDEO : Types_1.WAMessageStubType.CALL_MISSED_GROUP_VOICE;
                }
                else {
                    msg.messageStubType = call.isVideo ? Types_1.WAMessageStubType.CALL_MISSED_VIDEO : Types_1.WAMessageStubType.CALL_MISSED_VOICE;
                }
            }
            else {
                msg.message = { call: { callKey: Buffer.from(call.id) } };
            }
            const protoMsg = WAProto_1.proto.WebMessageInfo.fromObject(msg);
            upsertMessage(protoMsg, call.offline ? 'append' : 'notify');
        }
    });
    ev.on('connection.update', ({ isOnline }) => {
        if (typeof isOnline !== 'undefined') {
            sendActiveReceipts = isOnline;
            logger.trace(`sendActiveReceipts set to "${sendActiveReceipts}"`);
        }
    });
    return {
        ...sock,
        sendMessageAck,
        sendRetryRequest,
        rejectCall,
        offerCall,
        fetchMessageHistory,
        requestPlaceholderResend,
    };
};
exports.makeMessagesRecvSocket = makeMessagesRecvSocket;

 
const __kageModule29 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { default: NodeCache } = require("@cacheable/node-cache")
const { Boom } = require("@hapi/boom")
const { randomBytes } = require("crypto")
const { proto } = require("../../WAProto")
const {
  KEY_BUNDLE_TYPE, 
  MIN_PREKEY_COUNT, 
  DEFAULT_CACHE_TTLS
} = require("../Defaults/constants")
const {
  XWAPaths, 
  XWAPathsMexUpdates, 
  MexOperations, 
  MexUpdatesOperations, 
  WAMessageStubType,
  WAMessageStatus
} = require("../Types")
const { 
  aesDecryptCTR, 
  aesEncryptGCM, 
  cleanMessage, 
  Curve, 
  decodeMediaRetryNode, 
  decodeMessageNode, 
  decryptMessageNode, 
  delay, 
  derivePairingCodeKey, 
  encodeBigEndian, 
  encodeSignedDeviceIdentity, 
  extractAddressingContext,
  getCallStatusFromNode,
  getHistoryMsg, 
  getNextPreKeys, 
  getStatusFromReceiptType, 
  hkdf,
  NO_MESSAGE_FOUND_ERROR_TEXT, 
  MISSING_KEYS_ERROR_TEXT, 
  NACK_REASONS, 
  unixTimestampSeconds, 
  xmppPreKey, 
  xmppSignedPreKey, 
  generateMessageID
} = require("../Utils")
const { 
  areJidsSameUser,
  binaryNodeToString, 
  getAllBinaryNodeChildren, 
  getBinaryNodeChild, 
  getBinaryNodeChildBuffer, 
  getBinaryNodeChildren, 
  getBinaryNodeChildString, 
  isJidGroup, 
  isJidNewsletter, 
  isJidStatusBroadcast, 
  isLidUser,
  isPnUser, 
  jidDecode, 
  jidNormalizedUser, 
  S_WHATSAPP_NET 
} = require("../WABinary")
const { extractGroupMetadata } = require("./groups")
const { makeMutex } = require("../Utils/make-mutex")
const { makeMessagesSocket } = require("./messages-send")

const makeMessagesRecvSocket = (config) => {
    const { 
        logger, 
        retryRequestDelayMs,
        maxMsgRetryCount, 
        getMessage, 
        shouldIgnoreJid, 
        enableAutoSessionRecreation 
    } = config
	
    const suki = makeMessagesSocket(config)
    
    const {
        ev, 
        authState, 
        ws, 
        messageMutex, 
        notificationMutex, 
        receiptMutex, 
        signalRepository, 
        query, 
        upsertMessage, 
        resyncAppState, 
        onUnexpectedError, 
        assertSessions,
        sendNode, 
        relayMessage, 
        sendReceipt, 
        uploadPreKeys, 
        groupMetadata, 
        getUSyncDevices,
        createParticipantNodes,
        messageRetryManager, 
        sendPeerDataOperationMessage 
     } = suki
    
     
    const retryMutex = makeMutex()
    
    const msgRetryCache = config.msgRetryCounterCache || new NodeCache({
        stdTTL: DEFAULT_CACHE_TTLS.MSG_RETRY,
        useClones: false
    })
    
    const callOfferCache = config.callOfferCache || new NodeCache({
        stdTTL: DEFAULT_CACHE_TTLS.CALL_OFFER,
        useClones: false
    })
    
    const placeholderResendCache = config.placeholderResendCache || new NodeCache({
        stdTTL: DEFAULT_CACHE_TTLS.MSG_RETRY,
        useClones: false
    })
    
     
    const identityAssertDebounce = new NodeCache({
        stdTTL: 5,
        useClones: false
    })
    
    let sendActiveReceipts = false
    
    const fetchMessageHistory = async (count, oldestMsgKey, oldestMsgTimestamp) => {
        if (!authState.creds.me?.id) {
            throw new Boom('Not authenticated')
        }
        
        const pdoMessage = {
            historySyncOnDemandRequest: {
                chatJid: oldestMsgKey.remoteJid,
                oldestMsgFromMe: oldestMsgKey.fromMe,
                oldestMsgId: oldestMsgKey.id,
                oldestMsgTimestampMs: oldestMsgTimestamp,
                onDemandMsgCount: count
            },
            peerDataOperationRequestType: proto.Message.PeerDataOperationRequestType.HISTORY_SYNC_ON_DEMAND
        }
        
        return sendPeerDataOperationMessage(pdoMessage)
    }
    
    const requestPlaceholderResend = async (messageKey) => {
        if (!authState.creds.me?.id) {
            throw new Boom('Not authenticated')
        }
        
        if (await placeholderResendCache.get(messageKey?.id)) {
            logger.debug({ messageKey }, 'already requested resend')
            return
        }
        
        else {
            await placeholderResendCache.set(messageKey?.id, true)
        }
        
        await delay(5000)
        
        if (!(await placeholderResendCache.get(messageKey?.id))) {
            logger.debug({ messageKey }, 'message received while resend requested')
            return 'RESOLVED'
        }
        
        const pdoMessage = {
            placeholderMessageResendRequest: [
                {
                    messageKey
                }
            ],
            peerDataOperationRequestType: proto.Message.PeerDataOperationRequestType.PLACEHOLDER_MESSAGE_RESEND
        }
        
        setTimeout(async () => {
            if (await placeholderResendCache.get(messageKey?.id)) {
                logger.debug({ messageKey }, 'PDO message without response after 15 seconds. Phone possibly offline')
                await placeholderResendCache.del(messageKey?.id)
            }
        }, 15000)
        
        return sendPeerDataOperationMessage(pdoMessage)
    }
    
    const sendMessageAck = async ({ tag, attrs, content }, errorCode) => {
        const stanza = {
            tag: 'ack',
            attrs: {
                id: attrs.id,
                to: attrs.from,
                class: tag
            }
        }
        
        if (!!errorCode) {
            stanza.attrs.error = errorCode.toString()
        }
        
        if (!!attrs.participant) {
            stanza.attrs.participant = attrs.participant
        }
        
        if (!!attrs.recipient) {
            stanza.attrs.recipient = attrs.recipient
        }
        
        if (!!attrs.type && (tag !== 'message' || getBinaryNodeChild({ tag, attrs, content }, 'unavailable') || errorCode !== 0)) {
            stanza.attrs.type = attrs.type
        }
        
        if (tag === 'message' && getBinaryNodeChild({ tag, attrs, content }, 'unavailable')) {
            stanza.attrs.from = authState.creds.me.id
        }
        
        logger.debug({ recv: { tag, attrs }, sent: stanza.attrs }, 'sent ack')
        await sendNode(stanza)
    }
    
    const offerCall = async (toJid, isVideo = false) => {
        const callId = randomBytes(16).toString('hex').toUpperCase().substring(0, 64)
        const offerContent = []
        offerContent.push({ tag: 'audio', attrs: { enc: 'opus', rate: '16000' }, content: undefined })
        offerContent.push({ tag: 'audio', attrs: { enc: 'opus', rate: '8000' }, content: undefined })
        
        if (isVideo) {
            offerContent.push({
                tag: 'video',
                attrs: { enc: 'vp8', dec: 'vp8', orientation: '0', 'screen_width': '1920', 'screen_height': '1080', 'device_orientation': '0' },
                content: undefined
            })
        }
        offerContent.push({ tag: 'net', attrs: { medium: '3' }, content: undefined })
        offerContent.push({ tag: 'capability', attrs: { ver: '1' }, content: new Uint8Array([1, 4, 255, 131, 207, 4]) })
        offerContent.push({ tag: 'encopt', attrs: { keygen: '2' }, content: undefined })
        
        const encKey = randomBytes(32)
        const devices = (await getUSyncDevices([toJid], true, false)).map(({ user, device }) => jidEncode(user, 's.whatsapp.net', device))
        await assertSessions(devices, true)
        
        const { nodes: destinations, shouldIncludeDeviceIdentity } = await createParticipantNodes(devices, {
            call: {
                callKey: new Uint8Array(encKey)
            }
        }, { count: '0' })
        offerContent.push({ tag: 'destination', attrs: {}, content: destinations })
        
        if (shouldIncludeDeviceIdentity) {
            offerContent.push({
                tag: 'device-identity',
                attrs: {},
                content: encodeSignedDeviceIdentity(authState.creds.account, true)
            })
        }
        
        const stanza = ({
            tag: 'call',
            attrs: {
                id: generateMessageID(),
                to: toJid,
            },
            content: [{
                    tag: 'offer',
                    attrs: {
                        'call-id': callId,
                        'call-creator': authState.creds.me.id,
                    },
                    content: offerContent,
                }],
        })
        
        await query(stanza)
        
        return {
            id: callId,
            to: toJid
        }
    }
    
    const rejectCall = async (callId, callFrom) => {
        const stanza = ({
            tag: 'call',
            attrs: {
                from: authState.creds.me.id,
                to: callFrom,
            },
            content: [{
                    tag: 'reject',
                    attrs: {
                        'call-id': callId,
                        'call-creator': callFrom,
                        count: '0',
                    },
                    content: undefined,
                }],
        })
        
        await query(stanza)
    }
    
    const sendRetryRequest = async (node, forceIncludeKeys = false) => {
        const { fullMessage } = decodeMessageNode(node, authState.creds.me.id, authState.creds.me.lid || '')
        const { key: msgKey } = fullMessage
        const msgId = msgKey.id
        
        if (messageRetryManager) {
             
            if (messageRetryManager.hasExceededMaxRetries(msgId)) {
                logger.debug({ msgId }, 'reached retry limit with new retry manager, clearing')
                messageRetryManager.markRetryFailed(msgId)
                return
            }
            
             
            const retryCount = messageRetryManager.incrementRetryCount(msgId)
            
             
            const key = JSON.stringify([msgKey.remoteJid, msgKey.participant || "", msgId])
            await msgRetryCache.set(key, retryCount)
        }
        
        else {
             
            const key = JSON.stringify([msgKey.remoteJid, msgKey.participant || "", msgId])
            
            let retryCount = (await msgRetryCache.get(key)) || 0
            
            if (retryCount >= maxMsgRetryCount) {
                logger.debug({ retryCount, msgId }, 'reached retry limit, clearing')
                
                await msgRetryCache.set(key, retryCount)
                
                return
            }
            
            retryCount += 1
            
            await msgRetryCache.set(key, retryCount)
        }
        
        const key = JSON.stringify([msgKey.remoteJid, msgKey.participant || "", msgId])
        const retryCount = (await msgRetryCache.get(key)) || 1
        const { account, signedPreKey, signedIdentityKey: identityKey } = authState.creds
        const fromJid = node.attrs.from
        
         
        let shouldRecreateSession = false
        let recreateReason = ''
        
        if (enableAutoSessionRecreation && messageRetryManager) {
            try {
                 
                const sessionId = signalRepository.jidToSignalProtocolAddress(fromJid)
                const hasSession = await signalRepository.validateSession(fromJid)
                const result = messageRetryManager.shouldRecreateSession(fromJid, retryCount, hasSession.exists)
                
                shouldRecreateSession = result.recreate
                recreateReason = result.reason
                
                if (shouldRecreateSession) {
                    logger.debug({ fromJid, retryCount, reason: recreateReason }, 'recreating session for retry')
                    
                     
                    await authState.keys.set({ session: { [sessionId]: null } })
                    
                    forceIncludeKeys = true
                }
            }
            
            catch (error) {
                logger.warn({ error, fromJid }, 'failed to check session recreation')
            }
        }
        
        if (retryCount <= 2) {
             
            if (messageRetryManager) {
                 
                messageRetryManager.schedulePhoneRequest(msgId, async () => {
                    try {
                        const requestId = await requestPlaceholderResend(msgKey)
                        
                        logger.debug(`sendRetryRequest: requested placeholder resend (${requestId}) for message ${msgId} (scheduled)`)
                    }
                    
                    catch (error) {
                        logger.warn({ error, msgId }, 'failed to send scheduled phone request')
                    }
                })
            }
            
            else {
                 
                const msgId = await requestPlaceholderResend(msgKey)
                
                logger.debug(`sendRetryRequest: requested placeholder resend for message ${msgId}`)
            }
        }
        
        const deviceIdentity = encodeSignedDeviceIdentity(account, true)
        
        await authState.keys.transaction(async () => {
            const receipt = {
                tag: 'receipt',
                attrs: {
                    id: msgId,
                    type: 'retry',
                    to: node.attrs.from
                },
                content: [
                    {
                        tag: 'retry',
                        attrs: {
                            count: retryCount.toString(),
                            id: node.attrs.id,
                            t: node.attrs.t,
                            v: '1',
                             
                            error: '0'
                        }
                    },
                    {
                        tag: 'registration',
                        attrs: {},
                        content: encodeBigEndian(authState.creds.registrationId)
                    }
                ]
            }
            
            if (node.attrs.recipient) {
                receipt.attrs.recipient = node.attrs.recipient
            }
            
            if (node.attrs.participant) {
                receipt.attrs.participant = node.attrs.participant
            }
            
            if (retryCount > 1 || forceIncludeKeys || shouldRecreateSession) {
                const { update, preKeys } = await getNextPreKeys(authState, 1)
                const [keyId] = Object.keys(preKeys)
                const key = preKeys[+keyId]
                const content = receipt.content
                
                content.push({
                    tag: 'keys',
                    attrs: {},
                    content: [
                        { tag: 'type', attrs: {}, content: Buffer.from(KEY_BUNDLE_TYPE) },
                        { tag: 'identity', attrs: {}, content: identityKey.public },
                        xmppPreKey(key, +keyId),
                        xmppSignedPreKey(signedPreKey),
                        { tag: 'device-identity', attrs: {}, content: deviceIdentity }
                    ]
                })
                
                ev.emit('creds.update', update)
            }
            
            await sendNode(receipt)
            
            logger.info({ msgAttrs: node.attrs, retryCount }, 'sent retry receipt')
        }, authState?.creds?.me?.id || 'sendRetryRequest')
    }
    
    const handleEncryptNotification = async (node) => {
        const from = node.attrs.from
        
        if (from === S_WHATSAPP_NET) {
            const countChild = getBinaryNodeChild(node, 'count')
            const count = +countChild.attrs.value
            const shouldUploadMorePreKeys = count < MIN_PREKEY_COUNT
            
            logger.debug({ count, shouldUploadMorePreKeys }, 'recv pre-key count')
            
            if (shouldUploadMorePreKeys) {
                await uploadPreKeys()
            }
        }
        
        else {
            const identityNode = getBinaryNodeChild(node, 'identity')
            
            if (identityNode) {
                logger.info({ jid: from }, 'identity changed')
                
                if (identityAssertDebounce.get(from)) {
                    logger.debug({ jid: from }, 'skipping identity assert (debounced)')
                    return
                }
                
                identityAssertDebounce.set(from, true)
                
                try {
                    await assertSessions([from], true)
                }
                
                catch (error) {
                    logger.warn({ error, jid: from }, 'failed to assert sessions after identity change')
                }
            }
            
            else {
                logger.info({ node }, 'unknown encrypt notification')
            }
        }
    }
    
    const handleGroupNotification = (fullNode, child, msg) => {
         
        const actingParticipantLid = fullNode.attrs.participant
        const actingParticipantPn = fullNode.attrs.participant_pn
        const affectedParticipantLid = getBinaryNodeChild(child, 'participant')?.attrs?.jid || actingParticipantLid
        const affectedParticipantPn = getBinaryNodeChild(child, 'participant')?.attrs?.phone_number || actingParticipantPn
        
        switch (child?.tag) {
            case 'create':
                const metadata = extractGroupMetadata(child)
                msg.messageStubType = WAMessageStubType.GROUP_CREATE
                msg.messageStubParameters = [metadata.subject]
                msg.key = { participant: metadata.owner, participantAlt: metadata.ownerPn }
                
                ev.emit('chats.upsert', [
                    {
                        id: metadata.id,
                        name: metadata.subject,
                        conversationTimestamp: metadata.creation
                    }
                ])
                
                ev.emit('groups.upsert', [
                    {
                        ...metadata,
                        author: actingParticipantLid,
                        authorPn: actingParticipantPn
                    }
                ])
                break
            case 'ephemeral':
            case 'not_ephemeral':
                msg.message = {
                    protocolMessage: {
                        type: proto.Message.ProtocolMessage.Type.EPHEMERAL_SETTING,
                        ephemeralExpiration: +(child.attrs.expiration || 0)
                    }
                }
                break
            case 'modify':
                const oldNumber = getBinaryNodeChildren(child, 'participant').map(p => p.attrs.jid)
                msg.messageStubParameters = oldNumber || []
                msg.messageStubType = WAMessageStubType.GROUP_PARTICIPANT_CHANGE_NUMBER
                break
            case 'promote':
            case 'demote':
            case 'remove':
            case 'add':
            case 'leave':
                const stubType = `GROUP_PARTICIPANT_${child.tag.toUpperCase()}`
                msg.messageStubType = WAMessageStubType[stubType]
                const participants = getBinaryNodeChildren(child, 'participant').map(({ attrs }) => {
                     
                    return {
                        id: attrs.jid,
                        phoneNumber: isLidUser(attrs.jid) && isPnUser(attrs.phone_number) ? attrs.phone_number : undefined,
                        lid: isPnUser(attrs.jid) && isLidUser(attrs.lid) ? attrs.lid : undefined,
                        admin: (attrs.type || null)
                    }
                })
                
                if (participants.length === 1 &&
                     
                     
                    (areJidsSameUser(participants[0].id, actingParticipantLid) ||
                        areJidsSameUser(participants[0].id, actingParticipantPn)) &&
                    child.tag === 'remove') {
                    msg.messageStubType = WAMessageStubType.GROUP_PARTICIPANT_LEAVE
                }
                
                msg.messageStubParameters = participants.map(a => JSON.stringify(a))
                break
            case 'subject':
                msg.messageStubType = WAMessageStubType.GROUP_CHANGE_SUBJECT
                msg.messageStubParameters = [child.attrs.subject]
                break
            case 'description':
                const description = getBinaryNodeChild(child, 'body')?.content?.toString()
                msg.messageStubType = WAMessageStubType.GROUP_CHANGE_DESCRIPTION
                msg.messageStubParameters = description ? [description] : undefined
                break
            case 'announcement':
            case 'not_announcement':
                msg.messageStubType = WAMessageStubType.GROUP_CHANGE_ANNOUNCE
                msg.messageStubParameters = [child.tag === 'announcement' ? 'on' : 'off']
                break
            case 'locked':
            case 'unlocked':
                msg.messageStubType = WAMessageStubType.GROUP_CHANGE_RESTRICT
                msg.messageStubParameters = [child.tag === 'locked' ? 'on' : 'off']
                break
            case 'invite':
                msg.messageStubType = WAMessageStubType.GROUP_CHANGE_INVITE_LINK
                msg.messageStubParameters = [child.attrs.code]
                break
            case 'member_add_mode':
                const addMode = child.content;
                if (addMode) {
                    msg.messageStubType = WAMessageStubType.GROUP_MEMBER_ADD_MODE
                    msg.messageStubParameters = [addMode.toString()]
                }
                break
            case 'membership_approval_mode':
                const approvalMode = getBinaryNodeChild(child, 'group_join')
                if (approvalMode) {
                    msg.messageStubType = WAMessageStubType.GROUP_MEMBERSHIP_JOIN_APPROVAL_MODE
                    msg.messageStubParameters = [approvalMode.attrs.state]
                }
                break
            case 'created_membership_requests':
                msg.messageStubType = WAMessageStubType.GROUP_MEMBERSHIP_JOIN_APPROVAL_REQUEST_NON_ADMIN_ADD
                msg.messageStubParameters = [
                    JSON.stringify({ lid: affectedParticipantLid, pn: affectedParticipantPn }),
                    'created',
                    child.attrs.request_method
                ]
                break
            case 'revoked_membership_requests':
                const isDenied = areJidsSameUser(affectedParticipantLid, actingParticipantLid)
                 
                msg.messageStubType = WAMessageStubType.GROUP_MEMBERSHIP_JOIN_APPROVAL_REQUEST_NON_ADMIN_ADD
                msg.messageStubParameters = [
                    JSON.stringify({ lid: affectedParticipantLid, pn: affectedParticipantPn }),
                    isDenied ? 'revoked' : 'rejected'
                ]
                break
        }
    }
    
    const handleNewsletterNotification = (id, node) => {
        const messages = getBinaryNodeChild(node, 'messages')
        const message = getBinaryNodeChild(node, 'message')
        const serverId = node.attrs.server_id

        const reactionsList = getBinaryNodeChild(node, 'reactions')
        const viewsList = getBinaryNodeChild(node, 'views_count')

        if (reactionsList) {
            const reactions = getBinaryNodeChild(reactionsList, 'reaction')

            if (reactions.length === 0) {
                ev.emit('newsletter.reaction', {
                    id,
                    newsletter_server_id: serverId,
                    reaction: {
                        removed: true
                    }
                })
            }

            reactions.forEach(item => {
                ev.emit('newsletter.reaction', {
                    id,
                    newsletter_server_id: serverId,
                    reaction: {
                        code: item.attrs?.code,
                        count: +item.attrs.count
                    }
                })
            })
        }

        if (viewsList.length) {
            viewsList.forEach(item => {
                ev.emit('newsletter.view', {
                    id,
                    newsletter_server_id: serverId,
                    count: +item.attrs.count
                })
            })
        }
    }
    
    const handleMexNotification = (id, node) => {
        const operation = node?.attrs?.op_name
        const content = JSON.parse(node?.content) 
        
        let contentPath
        let action
        
        if (operation === MexOperations.UPDATE) {
        	contentPath = content.data[XWAPaths.METADATA_UPDATE]
            
            ev.emit('newsletter-settings.update', {
            	id, 
                update: contentPath.thread_metadata.settings
            }) 
        } else if (operation === MexUpdatesOperations.GROUP_MEMBER_LINK) {
        	contentPath = content.data[XWAPathsMexUpdates.GROUP_SHARING_CHANGE]
        	
        	ev.emit('groups.update', [{
            	id, 
            	author: contentPath.updated_by.id, 
            	member_link_mode: contentPath.properties.member_link_mode
            }]) 
        } else if (operation === MexUpdatesOperations.GROUP_LIMIT_SHARING) {
        	contentPath = content.data[XWAPathsMexUpdates.GROUP_SHARING_CHANGE]
            
            ev.emit('limit-sharing.update', {
            	id, 
                author: contentPath.updated_by?.pn ? contentPath.updated_by.pn : contentPath.updated_by.id, 
                action: `${contentPath.properties.limit_sharing.limit_sharing_enabled ? 'on' : 'off'}`, 
                trigger: contentPath.properties.limit_sharing.limit_sharing_trigger, 
                update_time: contentPath.update_time 
            }) 
        } else if (operation === MexUpdatesOperations.OWNER_COMMUNITY) {
        	contentPath = content.data[XWAPathsMexUpdates.COMMUNITY_OWNER_CHANGE]
            
            ev.emit('community-owner.update', {
            	id, 
                author: contentPath.updated_by?.pn ? contentPath.updated_by.pn : contentPath.updated_by.id, 
                user: contentPath.role_updates[0].user?.pn ? contentPath.role_updates[0].user.pn : contentPath.role_updates[0].user.jid, 
                new_role: contentPath.role_updates[0].new_role, 
                update_time: contentPath.update_time 
            }) 
        } else {
            
            if (operation === MexOperations.PROMOTE) {
            	action = 'promote'
                contentPath = content.data[XWAPaths.PROMOTE]
            } else {
            	action = 'demote'
                contentPath = content.data[XWAPaths.DEMOTE]
            }
            
            ev.emit('newsletter-participants.update', {
            	id, 
                author: contentPath.actor.pn, 
                user: contentPath.user.pn, 
                new_role: contentPath.user_new_role, 
                action
            }) 
        }
    }

    const processNotification = async (node) => {
        const result = {}
        const [child] = getAllBinaryNodeChildren(node)
        const nodeType = node.attrs.type
        const from = jidNormalizedUser(node.attrs.from)
        
        switch (nodeType) {
            case 'w:gp2':
                 
                handleGroupNotification(node, child, result)
                break
            case 'newsletter':
                handleNewsletterNotification(node.attrs.from, child) 
                break
            case 'mex':
                handleMexNotification(node.attrs.from, child, result) 
                break
            case 'mediaretry':
                const event = decodeMediaRetryNode(node)
                ev.emit('messages.media-update', [event])
                break
            case 'encrypt':
                await handleEncryptNotification(node)
                break
            case 'devices':
                const devices = getBinaryNodeChildren(child, 'device')
                if (areJidsSameUser(child.attrs.jid, authState.creds.me.id) ||
                    areJidsSameUser(child.attrs.lid, authState.creds.me.lid)) {
                    const deviceData = devices.map(d => ({ id: d.attrs.jid, lid: d.attrs.lid }))
                    logger.info({ deviceData }, 'my own devices changed')
                }
                 
                break
            case 'server_sync':
                const update = getBinaryNodeChild(node, 'collection')
                if (update) {
                    const name = update.attrs.name
                    await resyncAppState([name], false)
                }
                break
            case 'picture':
                const setPicture = getBinaryNodeChild(node, 'set')
                const delPicture = getBinaryNodeChild(node, 'delete')
                
                ev.emit('contacts.update', [
                    {
                        id: jidNormalizedUser(node?.attrs?.from) || (setPicture || delPicture)?.attrs?.hash || '',
                        imgUrl: setPicture ? 'changed' : 'removed'
                    }
                ])
                
                if (isJidGroup(from)) {
                    const node = setPicture || delPicture
                    
                    result.messageStubType = WAMessageStubType.GROUP_CHANGE_ICON
                    
                    if (setPicture) {
                        result.messageStubParameters = [setPicture.attrs.id]
                    }
                    
                    result.participant = node?.attrs.author
                    result.key = {
                        ...(result.key || {}),
                        participant: setPicture?.attrs.author
                    }
                }
                break
            case 'account_sync':
                if (child.tag === 'disappearing_mode') {
                    const newDuration = +child.attrs.duration
                    const timestamp = +child.attrs.t
                    logger.info({ newDuration }, 'updated account disappearing mode')
                    ev.emit('creds.update', {
                        accountSettings: {
                            ...authState.creds.accountSettings,
                            defaultDisappearingMode: {
                                ephemeralExpiration: newDuration,
                                ephemeralSettingTimestamp: timestamp
                            }
                        }
                    })
                }
                
                else if (child.tag === 'blocklist') {
                    const blocklists = getBinaryNodeChildren(child, 'item')
                    for (const { attrs } of blocklists) {
                        const blocklist = [attrs.jid]
                        const type = attrs.action === 'block' ? 'add' : 'remove'
                        ev.emit('blocklist.update', { blocklist, type })
                    }
                }
                break
            case 'link_code_companion_reg':
                const linkCodeCompanionReg = getBinaryNodeChild(node, 'link_code_companion_reg')
                const ref = toRequiredBuffer(getBinaryNodeChildBuffer(linkCodeCompanionReg, 'link_code_pairing_ref'))
                const primaryIdentityPublicKey = toRequiredBuffer(getBinaryNodeChildBuffer(linkCodeCompanionReg, 'primary_identity_pub'))
                const primaryEphemeralPublicKeyWrapped = toRequiredBuffer(getBinaryNodeChildBuffer(linkCodeCompanionReg, 'link_code_pairing_wrapped_primary_ephemeral_pub'))
                const codePairingPublicKey = await decipherLinkPublicKey(primaryEphemeralPublicKeyWrapped)
                const companionSharedKey = Curve.sharedKey(authState.creds.pairingEphemeralKeyPair.private, codePairingPublicKey)
                const random = randomBytes(32)
                const linkCodeSalt = randomBytes(32)
                const linkCodePairingExpanded = await hkdf(companionSharedKey, 32, {
                    salt: linkCodeSalt,
                    info: 'link_code_pairing_key_bundle_encryption_key'
                })
                const encryptPayload = Buffer.concat([
                    Buffer.from(authState.creds.signedIdentityKey.public),
                    primaryIdentityPublicKey,
                    random
                ])
                const encryptIv = randomBytes(12)
                const encrypted = aesEncryptGCM(encryptPayload, linkCodePairingExpanded, encryptIv, Buffer.alloc(0))
                const encryptedPayload = Buffer.concat([linkCodeSalt, encryptIv, encrypted])
                const identitySharedKey = Curve.sharedKey(authState.creds.signedIdentityKey.private, primaryIdentityPublicKey)
                const identityPayload = Buffer.concat([companionSharedKey, identitySharedKey, random])
                
                authState.creds.advSecretKey = (await hkdf(identityPayload, 32, { info: 'adv_secret' })).toString('base64')
                
                await query({
                    tag: 'iq',
                    attrs: {
                        to: S_WHATSAPP_NET,
                        type: 'set',
                        id: suki.generateMessageTag(),
                        xmlns: 'md'
                    },
                    content: [
                        {
                            tag: 'link_code_companion_reg',
                            attrs: {
                                jid: authState.creds.me.id,
                                stage: 'companion_finish'
                            },
                            content: [
                                {
                                    tag: 'link_code_pairing_wrapped_key_bundle',
                                    attrs: {},
                                    content: encryptedPayload
                                },
                                {
                                    tag: 'companion_identity_public',
                                    attrs: {},
                                    content: authState.creds.signedIdentityKey.public
                                },
                                {
                                    tag: 'link_code_pairing_ref',
                                    attrs: {},
                                    content: ref
                                }
                            ]
                        }
                    ]
                })
                
                authState.creds.registered = true
                ev.emit('creds.update', authState.creds)
                break
            case 'privacy_token':
                await handlePrivacyTokenNotification(node)
                break
        }
        
        if (Object.keys(result).length) {
            return result
        }
    }
    
    const handlePrivacyTokenNotification = async (node) => {
        const tokensNode = getBinaryNodeChild(node, 'tokens')
        const from = jidNormalizedUser(node.attrs.from)
        
        if (!tokensNode) return
        
        const tokenNodes = getBinaryNodeChildren(tokensNode, 'token')
        
        for (const tokenNode of tokenNodes) {
            const { attrs, content } = tokenNode
            const type = attrs.type
            const timestamp = attrs.t
            
            if (type === 'trusted_contact' && content instanceof Buffer) {
                logger.debug({
                    from,
                    timestamp,
                    tcToken: content
                }, 'received trusted contact token')
                
                await authState.keys.set({
                    tctoken: { [from]: { token: content, timestamp } }
                })
            }
        }
    }
    
    async function decipherLinkPublicKey(data) {
        const buffer = toRequiredBuffer(data)
        const salt = buffer.slice(0, 32)
        const secretKey = await derivePairingCodeKey(authState.creds.pairingCode, salt)
        const iv = buffer.slice(32, 48)
        const payload = buffer.slice(48, 80)
        return aesDecryptCTR(payload, secretKey, iv)
    }
    
    function toRequiredBuffer(data) {
        if (data === undefined) {
            throw new Boom('Invalid buffer', { statusCode: 400 })
        }
        return data instanceof Buffer ? data : Buffer.from(data)
    }
    
    const willSendMessageAgain = async (id, participant) => {
        const key = `${id}:${participant}`
        const retryCount = (await msgRetryCache.get(key)) || 0
        return retryCount < maxMsgRetryCount
    }
    
    const updateSendMessageAgainCount = async (id, participant) => {
        const key = `${id}:${participant}`
        const newValue = ((await msgRetryCache.get(key)) || 0) + 1
        await msgRetryCache.set(key, newValue)
    }
    
    const sendMessagesAgain = async (key, ids, retryNode) => {
        const remoteJid = key.remoteJid
        const participant = key.participant || remoteJid
        const retryCount = +retryNode.attrs.count || 1
        
         
        const msgs = []
        
        for (const id of ids) {
            let msg
            
             
            if (messageRetryManager) {
                const cachedMsg = messageRetryManager.getRecentMessage(remoteJid, id)
                
                if (cachedMsg) {
                    msg = cachedMsg.message
                    logger.debug({ jid: remoteJid, id }, 'found message in retry cache')
                    
                     
                    messageRetryManager.markRetrySuccess(id)
                }
            }
            
             
            if (!msg) {
                msg = await getMessage({ ...key, id })
                
                if (msg) {
                    logger.debug({ jid: remoteJid, id }, 'found message via getMessage')
                    
                     
                    if (messageRetryManager) {
                        messageRetryManager.markRetrySuccess(id)
                    }
                }
            }
            
            msgs.push(msg)
        }
        
         
         
         
        const sendToAll = !jidDecode(participant)?.device
        
         
        let shouldRecreateSession = false
        let recreateReason = ''
        
        if (enableAutoSessionRecreation && messageRetryManager) {
            try {
                const sessionId = signalRepository.jidToSignalProtocolAddress(participant)
                const hasSession = await signalRepository.validateSession(participant)
                const result = messageRetryManager.shouldRecreateSession(participant, retryCount, hasSession.exists)
                
                shouldRecreateSession = result.recreate
                recreateReason = result.reason
                
                if (shouldRecreateSession) {
                    logger.debug({ participant, retryCount, reason: recreateReason }, 'recreating session for outgoing retry')
                    await authState.keys.set({ session: { [sessionId]: null } })
                }
            }
            
            catch (error) {
                logger.warn({ error, participant }, 'failed to check session recreation for outgoing retry')
            }
        }
        
        await assertSessions([participant], true)
        
        if (isJidGroup(remoteJid)) {
            await authState.keys.set({ 'sender-key-memory': { [remoteJid]: null } })
        }
        
        logger.debug({ participant, sendToAll, shouldRecreateSession, recreateReason }, 'forced new session for retry recp')
        
        for (const [i, msg] of msgs.entries()) {
            if (!ids[i]) continue
            
            if (msg && (await willSendMessageAgain(ids[i], participant))) {
                await updateSendMessageAgainCount(ids[i], participant)
                const msgRelayOpts = { messageId: ids[i] }
                
                if (sendToAll) {
                    msgRelayOpts.useUserDevicesCache = false
                }
                
                else {
                    msgRelayOpts.participant = {
                        jid: participant,
                        count: +retryNode.attrs.count
                    }
                }
                
                await relayMessage(key.remoteJid, msg, msgRelayOpts)
            }
            
            else {
                logger.debug({ jid: key.remoteJid, id: ids[i] }, 'recv retry request, but message not available')
            }
        }
    }
    
    const handleReceipt = async (node) => {
        const { attrs, content } = node
        const isLid = attrs.from.includes('lid')
        const isNodeFromMe = areJidsSameUser(attrs.participant || attrs.from, isLid ? authState.creds.me?.lid : authState.creds.me?.id)
        const remoteJid = !isNodeFromMe || isJidGroup(attrs.from) ? attrs.from : attrs.recipient
        const fromMe = !attrs.recipient || ((attrs.type === 'retry' || attrs.type === 'sender') && isNodeFromMe)
        const key = {
            remoteJid,
            id: '',
            fromMe,
            participant: attrs.participant
        }
        
        if (shouldIgnoreJid(remoteJid) && remoteJid !== S_WHATSAPP_NET) {
            logger.debug({ remoteJid }, 'ignoring receipt from jid')
            await sendMessageAck(node)
            return
        }
        
        const ids = [attrs.id]
        
        if (Array.isArray(content)) {
            const items = getBinaryNodeChildren(content[0], 'item')
            ids.push(...items.map(i => i.attrs.id))
        }
        
        try {
            await Promise.all([
                receiptMutex.mutex(async () => {
                    const status = getStatusFromReceiptType(attrs.type)
                    
                    if (typeof status !== 'undefined' &&
                         
                         
                        (status >= proto.WebMessageInfo.Status.SERVER_ACK || !isNodeFromMe)) {
                        if (isJidGroup(remoteJid) || isJidStatusBroadcast(remoteJid)) {
                            if (attrs.participant) {
                                const updateKey = status === proto.WebMessageInfo.Status.DELIVERY_ACK ? 'receiptTimestamp' : 'readTimestamp'
                                
                                ev.emit('message-receipt.update', ids.map(id => ({
                                    key: { ...key, id },
                                    receipt: {
                                        userJid: jidNormalizedUser(attrs.participant),
                                        [updateKey]: +attrs.t
                                    }
                                })))
                            }
                        }
                        
                        else {
                            ev.emit('messages.update', ids.map(id => ({
                                key: { ...key, id },
                                update: { status }
                            })))
                        }
                    }
                    
                    if (attrs.type === 'retry') {
                         
                        key.participant = key.participant || attrs.from
                        
                        const retryNode = getBinaryNodeChild(node, 'retry')
                        
                        if (ids[0] && key.participant && (await willSendMessageAgain(ids[0], key.participant))) {
                            if (key.fromMe) {
                                try {
                                    await updateSendMessageAgainCount(ids[0], key.participant)
                                    
                                    logger.debug({ attrs, key }, 'recv retry request')
                                    
                                    await sendMessagesAgain(key, ids, retryNode)
                                }
                                
                                catch (error) {
                                    logger.error({ key, ids, trace: error instanceof Error ? error.stack : 'Unknown error' }, 'error in sending message again')
                                }
                            }
                            
                            else {
                                logger.info({ attrs, key }, 'recv retry for not fromMe message')
                            }
                        }
                        
                        else {
                            logger.info({ attrs, key }, 'will not send message again, as sent too many times')
                        }
                    }
                })
            ])
        }
        
        finally {
            await sendMessageAck(node)
        }
    }
    
    const handleNotification = async (node) => {
        const remoteJid = node.attrs.from
        if (shouldIgnoreJid(remoteJid) && remoteJid !== S_WHATSAPP_NET) {
            logger.debug({ remoteJid, id: node.attrs.id }, 'ignored notification')
            await sendMessageAck(node)
            return
        }
        
        try {
            await Promise.all([
                notificationMutex.mutex(async () => {
                    const msg = await processNotification(node)
                    
                    if (msg) {
                        const fromMe = areJidsSameUser(node.attrs.participant || remoteJid, authState.creds.me.id)
                        const { senderAlt: participantAlt, addressingMode } = extractAddressingContext(node)
                        
                        msg.key = {
                            remoteJid,
                            fromMe,
                            participant: node.attrs.participant,
                            participantAlt,
                            addressingMode,
                            id: node.attrs.id,
                            ...(msg.key || {})
                        }
                        
                        msg.participant ?? (msg.participant = node.attrs.participant)
                        msg.messageTimestamp = +node.attrs.t
                        
                        const fullMsg = proto.WebMessageInfo.fromObject(msg)
                        
                        await upsertMessage(fullMsg, 'append')
                    }
                })
            ])
        }
        
        finally {
            await sendMessageAck(node)
        }
    }
    
    const handleMessage = async (node) => {
        if (shouldIgnoreJid(node.attrs.from) && node.attrs.from !== S_WHATSAPP_NET) {
            logger.debug({ key: node.attrs.key }, 'ignored message')
            await sendMessageAck(node, NACK_REASONS.UnhandledError)
            return
        }
        
        const encNode = getBinaryNodeChild(node, 'enc')
        
         
        if (encNode && encNode.attrs.type === 'msmsg') {
            logger.debug({ key: node.attrs.key }, 'ignored msmsg')
            await sendMessageAck(node, NACK_REASONS.MissingMessageSecret)
            return
        }
        
        const { fullMessage: msg, category, author, decrypt } = decryptMessageNode(node, authState.creds.me.id, authState.creds.me.lid || '', signalRepository, logger);
        const alt = msg.key.participantAlt || msg.key.remoteJidAlt;
         
        if (!!alt) {
            const altServer = jidDecode(alt)?.server
            const primaryJid = msg.key.participant || msg.key.remoteJid
            
            if (altServer === 'lid') {
                if (!(await signalRepository.lidMapping.getPNForLID(alt))) {
                    await signalRepository.lidMapping.storeLIDPNMappings([{ lid: alt, pn: primaryJid }])
                    await signalRepository.migrateSession(primaryJid, alt)
                }
            }
            
            else {
                await signalRepository.lidMapping.storeLIDPNMappings([{ lid: primaryJid, pn: alt }])
                await signalRepository.migrateSession(alt, primaryJid)
            }
        }
        
        if (msg.key?.remoteJid && msg.key?.id && messageRetryManager) {
            messageRetryManager.addRecentMessage(msg.key.remoteJid, msg.key.id, msg.message)
            logger.debug({
                jid: msg.key.remoteJid,
                id: msg.key.id
            }, 'Added message to recent cache for retry receipts')
        }
        
        try {
            await messageMutex.mutex(async () => {
                await decrypt()
                
                 
                if (msg.messageStubType === proto.WebMessageInfo.StubType.CIPHERTEXT && msg.category !== 'peer') {
                    if (msg?.messageStubParameters?.[0] === MISSING_KEYS_ERROR_TEXT ||
                        msg.messageStubParameters?.[0] === NO_MESSAGE_FOUND_ERROR_TEXT) {
                        return sendMessageAck(node)
                    }
                    
                    const errorMessage = msg?.messageStubParameters?.[0] || ''
                    const isPreKeyError = errorMessage.includes('PreKey')
                    
                    logger.debug(`[handleMessage] Attempting retry request for failed decryption`)
                    
                     
                    await retryMutex.mutex(async () => {
                        try {
                            if (!ws.isOpen) {
                                logger.debug({ node }, 'Connection closed, skipping retry')
                                return
                            }
                            
                             
                            if (isPreKeyError) {
                                logger.info({ error: errorMessage }, 'PreKey error detected, uploading and retrying')
                                
                                try {
                                    logger.debug('Uploading pre-keys for error recovery')
                                    await uploadPreKeys(5)
                                    logger.debug('Waiting for server to process new pre-keys')
                                    await delay(1000)
                                }
                                
                                catch (uploadErr) {
                                    logger.error({ uploadErr }, 'Pre-key upload failed, proceeding with retry anyway')
                                }
                            }
                            
                            const encNode = getBinaryNodeChild(node, 'enc')
                            
                            await sendRetryRequest(node, !encNode)
                            
                            if (retryRequestDelayMs) {
                                await delay(retryRequestDelayMs)
                            }
                        }
                        
                        catch (err) {
                            logger.error({ err, isPreKeyError }, 'Failed to handle retry, attempting basic retry')
                            
                             
                            try {
                                const encNode = getBinaryNodeChild(node, 'enc')
                                
                                await sendRetryRequest(node, !encNode)
                            }
                            
                            catch (retryErr) {
                                logger.error({ retryErr }, 'Failed to send retry after error handling')
                            }
                        }
                        
                        await sendMessageAck(node, NACK_REASONS.UnhandledError)
                    })
                }
                
                else {
                    if (messageRetryManager && msg.key.id) {
                        messageRetryManager.cancelPendingPhoneRequest(msg.key.id)
                    }
                    
                    const isNewsletter = isJidNewsletter(msg.key.remoteJid)
                    
                    if (!isNewsletter) {
                         
                        let type = undefined
                        let participant = msg.key.participant
                        
                        if (category === 'peer') {
                             
                            type = 'peer_msg'
                        }
                        
                        else if (msg.key.fromMe) {
                             
                            type = 'sender'
                            
                             
                            if (isLidUser(msg.key.remoteJid) || isLidUser(msg.key.remoteJidAlt)) {
                                participant = author  
                            }
                        }
                        
                        else if (!sendActiveReceipts) {
                            type = 'inactive'
                        }
                        
                        await sendReceipt(msg.key.remoteJid, participant, [msg.key.id], type)
                        
                         
                        const isAnyHistoryMsg = getHistoryMsg(msg.message)
                        
                        if (isAnyHistoryMsg) {
                            const jid = jidNormalizedUser(msg.key.remoteJid)
                            await sendReceipt(jid, undefined, [msg.key.id], 'hist_sync')  
                        }
                    }
                    
                    else {
                        await sendMessageAck(node)
                        logger.debug({ key: msg.key }, 'processed newsletter message without receipts')
                    }
                }
                
                cleanMessage(msg, authState.creds.me.id, authState.creds.me.lid)
                
                await upsertMessage(msg, node.attrs.offline ? 'append' : 'notify')
            }) 
        }
        
        catch (error) {
            logger.error({ error, node: binaryNodeToString(node) }, 'error in handling message')
        }
    }
    
    const handleCall = async (node) => {
        const { attrs } = node
        const [infoChild] = getAllBinaryNodeChildren(node)
        const status = getCallStatusFromNode(infoChild)
        
        if (!infoChild) {
            throw new Boom('Missing call info in call node')
        }
        
        const callId = infoChild.attrs['call-id']
        const from = infoChild.attrs.from || infoChild.attrs['call-creator']
        const call = {
            chatId: attrs.from,
            from,
            id: callId,
            date: new Date(+attrs.t * 1000),
            offline: !!attrs.offline,
            status
        }
        
        if (status === 'offer') {
            call.isVideo = !!getBinaryNodeChild(infoChild, 'video')
            call.isGroup = infoChild.attrs.type === 'group' || !!infoChild.attrs['group-jid']
            call.groupJid = infoChild.attrs['group-jid']
            
            await callOfferCache.set(call.id, call)
        }
        
        const existingCall = await callOfferCache.get(call.id)
        
         
        if (existingCall) {
            call.isVideo = existingCall.isVideo
            call.isGroup = existingCall.isGroup
        }
        
         
        if (status === 'reject' || status === 'accept' || status === 'timeout' || status === 'terminate') {
            await callOfferCache.del(call.id)
        }
        
        ev.emit('call', [call])
        
        await sendMessageAck(node)
    }
    
    const handleBadAck = async ({ attrs }) => {
        const key = { remoteJid: attrs.from, fromMe: true, id: attrs.id }
        
         
         
         
         
         
         
         
         
         
         
         
         
         
         
         
        if (attrs.error) {
            logger.warn({ attrs }, 'received error in ack')
            ev.emit('messages.update', [
                {
                    key,
                    update: {
                        status: WAMessageStatus.ERROR,
                        messageStubParameters: [attrs.error]
                    }
                }
            ])
            
             
             
             
             
             
             
             
             
             
             
             
             
             
        }
    }
    
     
     
    const processNodeWithBuffer = async (node, identifier, exec) => {
        ev.buffer()
        await execTask()
        ev.flush()
        
        function execTask() {
            return exec(node, false).catch(err => onUnexpectedError(err, identifier))
        }
    }
    
     
    const yieldToEventLoop = () => {
        return new Promise(resolve => setImmediate(resolve))
    }
    
    const makeOfflineNodeProcessor = () => {
        const nodeProcessorMap = new Map([
            ['message', handleMessage],
            ['call', handleCall],
            ['receipt', handleReceipt],
            ['notification', handleNotification]
        ])
        
        const nodes = []
        
        let isProcessing = false
        
         
        const BATCH_SIZE = 10
        
        const enqueue = (type, node) => {
            nodes.push({ type, node })
            
            if (isProcessing) {
                return
            }
            
            isProcessing = true
            
            const promise = async () => {
                let processedInBatch = 0
                
                while (nodes.length && ws.isOpen) {
                    const { type, node } = nodes.shift()
                    const nodeProcessor = nodeProcessorMap.get(type)
                    
                    if (!nodeProcessor) {
                        onUnexpectedError(new Error(`unknown offline node type: ${type}`), 'processing offline node')
                        continue
                    }
                    
                    await nodeProcessor(node)
                    
                    processedInBatch++
                    
                     
                     
                    if (processedInBatch >= BATCH_SIZE) {
                        processedInBatch = 0
                        await yieldToEventLoop()
                    }
                }
                
                isProcessing = false
            }
            
            promise().catch(error => onUnexpectedError(error, 'processing offline nodes'))
        }
        
        return { enqueue }
    }
    
    const offlineNodeProcessor = makeOfflineNodeProcessor()
    
    const processNode = async (type, node, identifier, exec) => {
        const isOffline = !!node.attrs.offline
        
        if (isOffline) {
            offlineNodeProcessor.enqueue(type, node)
        }
        
        else {
            await processNodeWithBuffer(node, identifier, exec)
        }
    }
    
     
    ws.on('CB:message', async (node) => {
        await processNode('message', node, 'processing message', handleMessage)
    })
    
    ws.on('CB:call', async (node) => {
        await processNode('call', node, 'handling call', handleCall)
    })
    
    ws.on('CB:receipt', async (node) => {
        await processNode('receipt', node, 'handling receipt', handleReceipt)
    })
    
    ws.on('CB:notification', async (node) => {
        await processNode('notification', node, 'handling notification', handleNotification)
    })
    
    ws.on('CB:ack,class:message', (node) => {
        handleBadAck(node).catch(error => onUnexpectedError(error, 'handling bad ack'))
    })
    
    ev.on('call', async ([call]) => {
        if (!call) {
            return;
        }
        
         
        if (call.status === 'timeout' || (call.status === 'offer' && call.isGroup)) {
            const msg = {
                key: {
                    remoteJid: call.chatId,
                    id: call.id,
                    fromMe: false
                },
                messageTimestamp: unixTimestampSeconds(call.date)
            }
            
            if (call.status === 'timeout') {
                if (call.isGroup) {
                    msg.messageStubType = call.isVideo
                        ? WAMessageStubType.CALL_MISSED_GROUP_VIDEO
                        : WAMessageStubType.CALL_MISSED_GROUP_VOICE
                }
                
                else {
                    msg.messageStubType = call.isVideo ? WAMessageStubType.CALL_MISSED_VIDEO : WAMessageStubType.CALL_MISSED_VOICE
                }
            }
            
            else {
                msg.message = { call: { callKey: Buffer.from(call.id) } };
            }
            
            const protoMsg = proto.WebMessageInfo.fromObject(msg)
            
            await upsertMessage(protoMsg, call.offline ? 'append' : 'notify')
        }
    })
    
    ev.on('connection.update', ({ isOnline }) => {
        if (typeof isOnline !== 'undefined') {
            sendActiveReceipts = isOnline
            logger.trace(`sendActiveReceipts set to "${sendActiveReceipts}"`)
        }
    })
    
    return {
        ...suki,
        sendMessageAck,
        sendRetryRequest,
        offerCall, 
        rejectCall,
        fetchMessageHistory,
        requestPlaceholderResend,
        messageRetryManager
    }
}

module.exports = {
  makeMessagesRecvSocket
}
return module.exports;
})();
for (const key of Object.keys(__kageModule29)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule29[key]});
}

 
const __kageModule135 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeMessagesRecvSocket = void 0;
const node_crypto_1 = require("node:crypto");
const index_js_1 = require("../../WAProto/index.js");
const index_js_2 = require("../Addon/index.js");
const index_js_3 = require("../Defaults/index.js");
const index_js_4 = require("../Types/index.js");
const index_js_5 = require("../Utils/index.js");
const make_mutex_js_1 = require("../Utils/make-mutex.js");
const offline_node_processor_js_1 = require("../Utils/offline-node-processor.js");
const stanza_ack_js_1 = require("../Utils/stanza-ack.js");
const tc_token_utils_js_1 = require("../Utils/tc-token-utils.js");
const index_js_6 = require("../WABinary/index.js");
const groups_js_1 = require("./groups.js");
const messages_send_js_1 = require("./messages-send.js");
const ENFORCEMENT_TYPE_VALUES = new Set(Object.values(index_js_4.ReachoutTimelockEnforcementType));
function isValidEnforcementType(value) {
    return typeof value === 'string' && ENFORCEMENT_TYPE_VALUES.has(value);
}
const makeMessagesRecvSocket = (config) => {
    const { logger, retryRequestDelayMs, maxMsgRetryCount, getMessage, shouldIgnoreJid, enableAutoSessionRecreation } = config;
    const sock = (0, messages_send_js_1.makeMessagesSocket)(config);
    const { userDevicesCache, devicesMutex, ev, authState, ws, messageMutex, notificationMutex, receiptMutex, signalRepository, query, upsertMessage, resyncAppState, onUnexpectedError, assertSessions, sendNode, relayMessage, sendReceipt, uploadPreKeys, sendPeerDataOperationMessage, messageRetryManager, registerSocketEndHandler, issuePrivacyTokens, fetchAccountReachoutTimelock, placeholderResendCache } = sock;
    const getLIDForPN = signalRepository.lidMapping.getLIDForPN.bind(signalRepository.lidMapping);
     
    const retryMutex = (0, make_mutex_js_1.makeMutex)();
    const msgRetryCache = config.msgRetryCounterCache ||
        (0, index_js_2.createCache)({
            ttl: index_js_3.DEFAULT_CACHE_TTLS.MSG_RETRY  
        });
    const callOfferCache = config.callOfferCache ||
        (0, index_js_2.createCache)({
            ttl: index_js_3.DEFAULT_CACHE_TTLS.CALL_OFFER  
        });
     
    const identityAssertDebounce = (0, index_js_2.createCache)({ ttl: 5 });
    let sendActiveReceipts = false;
    const fetchMessageHistory = async (count, oldestMsgKey, oldestMsgTimestamp) => {
        if (!authState.creds.me?.id) {
            throw new index_js_2.HttpError('Not authenticated');
        }
        const pdoMessage = {
            historySyncOnDemandRequest: {
                chatJid: oldestMsgKey.remoteJid,
                oldestMsgFromMe: oldestMsgKey.fromMe,
                oldestMsgId: oldestMsgKey.id,
                oldestMsgTimestampMs: oldestMsgTimestamp,
                onDemandMsgCount: count
            },
            peerDataOperationRequestType: index_js_1.proto.Message.PeerDataOperationRequestType.HISTORY_SYNC_ON_DEMAND
        };
        return sendPeerDataOperationMessage(pdoMessage);
    };
    const requestPlaceholderResend = async (messageKey, msgData) => {
        if (!authState.creds.me?.id) {
            throw new index_js_2.HttpError('Not authenticated');
        }
        if (await placeholderResendCache.get(messageKey?.id)) {
            logger.debug({ messageKey }, 'already requested resend');
            return;
        }
        else {
             
             
            await placeholderResendCache.set(messageKey?.id, msgData || true);
        }
        await (0, index_js_5.delay)(2000);
        if (!(await placeholderResendCache.get(messageKey?.id))) {
            logger.debug({ messageKey }, 'message received while resend requested');
            return 'RESOLVED';
        }
        const pdoMessage = {
            placeholderMessageResendRequest: [
                {
                    messageKey
                }
            ],
            peerDataOperationRequestType: index_js_1.proto.Message.PeerDataOperationRequestType.PLACEHOLDER_MESSAGE_RESEND
        };
        setTimeout(async () => {
            if (await placeholderResendCache.get(messageKey?.id)) {
                logger.debug({ messageKey }, 'PDO message without response after 8 seconds. Phone possibly offline');
                await placeholderResendCache.del(messageKey?.id);
            }
        }, 8000);
        return sendPeerDataOperationMessage(pdoMessage);
    };
    const handleMexNotification = async (node) => {
        const updateNode = (0, index_js_6.getBinaryNodeChild)(node, 'update');
        if (updateNode) {
            const opName = updateNode.attrs?.op_name;
            if (!opName) {
                logger.warn({ node: (0, index_js_6.binaryNodeToString)(node) }, 'mex notification missing op_name, fallback to legacy');
                await handleLegacyMexNewsletterNotification(node);
                return;
            }
            let mexResponse;
            try {
                mexResponse = JSON.parse(updateNode.content.toString());
            }
            catch (error) {
                logger.error({ err: error, opName }, 'failed to parse mex notification JSON');
                return;
            }
            if (mexResponse.errors?.length) {
                logger.warn({ errors: mexResponse.errors, opName }, 'mex notification has GQL errors');
                return;
            }
            const data = mexResponse.data;
            if (!data) {
                logger.warn({ opName }, 'mex notification has null data');
                return;
            }
            logger.debug({ opName }, 'processing mex notification');
            switch (opName) {
                case 'NotificationUserReachoutTimelockUpdate':
                    handleReachoutTimelockNotification(data);
                    break;
                case 'MessageCappingInfoNotification':
                    handleMessageCappingNotification(data);
                    break;
                 
                case 'NotificationNewsletterUpdate':
                case 'NotificationLinkedProfilesUpdates':
                case 'NotificationNewsletterAdminPromote':
                case 'NotificationNewsletterAdminDemote':
                case 'NotificationNewsletterUserSettingChange':
                case 'NotificationNewsletterJoin':
                case 'NotificationNewsletterLeave':
                case 'NotificationNewsletterStateChange':
                case 'NotificationNewsletterAdminMetadataUpdate':
                case 'NotificationNewsletterOwnerUpdate':
                case 'NotificationNewsletterAdminInviteRevoke':
                case 'NotificationNewsletterWamoSubStatusChange':
                case 'NotificationNewsletterBlockUser':
                case 'NotificationNewsletterPaidPartnership':
                case 'NotificationNewsletterMilestone':
                case 'NewsletterResponseStateUpdate':
                    await handleLegacyMexNewsletterNotification(node);
                    break;
                default:
                    logger.debug({ opName }, 'unhandled mex notification');
                    break;
            }
            return;
        }
        await handleLegacyMexNewsletterNotification(node);
    };
    const handleReachoutTimelockNotification = (data) => {
        const payload = data.xwa2_notify_account_reachout_timelock;
        if (!payload) {
            logger.warn('reachout timelock notification missing payload');
            return;
        }
        if (!payload.is_active) {
            logger.info('reachout timelock restriction lifted');
            ev.emit('connection.update', {
                reachoutTimeLock: {
                    isActive: false,
                    enforcementType: index_js_4.ReachoutTimelockEnforcementType.DEFAULT
                }
            });
            return;
        }
         
        const timeEnforcementEnds = payload.time_enforcement_ends
            ? new Date(parseInt(payload.time_enforcement_ends, 10) * 1000)
            : new Date(Date.now() + 60000);
        const enforcementType = isValidEnforcementType(payload.enforcement_type)
            ? payload.enforcement_type
            : index_js_4.ReachoutTimelockEnforcementType.DEFAULT;
        logger.info({ enforcementType, timeEnforcementEnds }, 'reachout timelock restriction set');
        ev.emit('connection.update', {
            reachoutTimeLock: {
                isActive: true,
                timeEnforcementEnds,
                enforcementType
            }
        });
    };
    const handleMessageCappingNotification = (data) => {
        const payload = data.xwa2_notify_new_chat_messages_capping_info_update;
        if (!payload) {
            logger.warn('message capping notification missing payload');
            return;
        }
        logger.info({ payload }, 'received message capping update');
        ev.emit('message-capping.update', payload);
    };
    const handleLegacyMexNewsletterNotification = async (node) => {
        const mexNode = (0, index_js_6.getBinaryNodeChild)(node, 'mex');
        const updateNode = mexNode?.content ? null : (0, index_js_6.getBinaryNodeChild)(node, 'update') || (0, index_js_6.getAllBinaryNodeChildren)(node)[0];
        const payloadNode = mexNode?.content ? mexNode : updateNode;
        if (!payloadNode?.content) {
            logger.warn({ node: (0, index_js_6.binaryNodeToString)(node) }, 'invalid mex newsletter notification');
            return;
        }
        let data;
        try {
            const payloadContent = payloadNode.content;
            if (Array.isArray(payloadContent)) {
                logger.warn({ payloadNode }, 'invalid mex newsletter notification payload format');
                return;
            }
            const contentBuf = typeof payloadContent === 'string' ? Buffer.from(payloadContent, 'binary') : Buffer.from(payloadContent);
            data = JSON.parse(contentBuf.toString());
        }
        catch (error) {
            logger.error({ err: error, node: (0, index_js_6.binaryNodeToString)(node) }, 'failed to parse mex newsletter notification');
            return;
        }
        const operation = data?.operation ?? payloadNode?.attrs?.op_name;
        let updates = data?.updates;
        if (!updates) {
            const linkedProfiles = data?.data?.xwa2_notify_linked_profiles;
            if (linkedProfiles) {
                updates = [linkedProfiles];
            }
        }
        if (!updates || !operation) {
            logger.warn({ data }, 'invalid mex newsletter notification content');
            return;
        }
        logger.info({ operation, updates }, 'got mex newsletter notification');
        switch (operation) {
            case 'NotificationNewsletterUpdate':
                for (const update of updates) {
                    if (update.jid && update.settings && Object.keys(update.settings).length > 0) {
                        ev.emit('newsletter-settings.update', {
                            id: update.jid,
                            update: update.settings
                        });
                    }
                }
                break;
            case 'NotificationNewsletterAdminPromote':
                for (const update of updates) {
                    if (update.jid && update.user) {
                        ev.emit('newsletter-participants.update', {
                            id: update.jid,
                            author: node.attrs.from,
                            user: update.user,
                            new_role: 'ADMIN',
                            action: 'promote'
                        });
                    }
                }
                break;
            case 'NotificationLinkedProfilesUpdates':
                for (const update of updates) {
                    const lid = update?.jid;
                    const addedProfiles = Array.isArray(update?.added_profiles) ? update.added_profiles : [];
                    const mappings = [];
                    for (const profile of addedProfiles) {
                        const pn = typeof profile === 'string' ? profile : (profile?.pn ?? profile?.jid ?? null);
                        if (lid && pn) {
                            const mapping = { lid, pn };
                            ev.emit('lid-mapping.update', mapping);
                            mappings.push(mapping);
                        }
                    }
                    await signalRepository.lidMapping.storeLIDPNMappings(mappings);
                }
                break;
            default:
                logger.info({ operation, data }, 'unhandled mex newsletter notification');
                break;
        }
    };
     
    const handleNewsletterNotification = async (node) => {
        const from = node.attrs.from;
        const children = (0, index_js_6.getAllBinaryNodeChildren)(node);
        const author = node.attrs.participant;
        for (const child of children) {
            logger.debug({ from, child }, 'got newsletter notification');
            switch (child.tag) {
                case 'reaction': {
                    const reactionUpdate = {
                        id: from,
                        server_id: child.attrs.message_id,
                        reaction: {
                            code: (0, index_js_6.getBinaryNodeChildString)(child, 'reaction'),
                            count: 1
                        }
                    };
                    ev.emit('newsletter.reaction', reactionUpdate);
                    break;
                }
                case 'view': {
                    const viewUpdate = {
                        id: from,
                        server_id: child.attrs.message_id,
                        count: parseInt(child.content?.toString() || '0', 10)
                    };
                    ev.emit('newsletter.view', viewUpdate);
                    break;
                }
                case 'participant': {
                    const participantUpdate = {
                        id: from,
                        author,
                        user: child.attrs.jid,
                        action: child.attrs.action,
                        new_role: child.attrs.role
                    };
                    ev.emit('newsletter-participants.update', participantUpdate);
                    break;
                }
                case 'update': {
                    const settingsNode = (0, index_js_6.getBinaryNodeChild)(child, 'settings');
                    if (settingsNode) {
                        const update = {};
                        const nameNode = (0, index_js_6.getBinaryNodeChild)(settingsNode, 'name');
                        if (nameNode?.content)
                            update.name = nameNode.content.toString();
                        const descriptionNode = (0, index_js_6.getBinaryNodeChild)(settingsNode, 'description');
                        if (descriptionNode?.content)
                            update.description = descriptionNode.content.toString();
                        ev.emit('newsletter-settings.update', {
                            id: from,
                            update
                        });
                    }
                    break;
                }
                case 'message': {
                    const plaintextNode = (0, index_js_6.getBinaryNodeChild)(child, 'plaintext');
                    if (plaintextNode?.content) {
                        try {
                            const contentBuf = typeof plaintextNode.content === 'string'
                                ? Buffer.from(plaintextNode.content, 'binary')
                                : Buffer.from(plaintextNode.content);
                            const messageProto = index_js_1.proto.Message.decode(contentBuf).toJSON();
                            const fullMessage = index_js_1.proto.WebMessageInfo.fromObject({
                                key: {
                                    remoteJid: from,
                                    id: child.attrs.message_id || child.attrs.server_id,
                                    fromMe: false  
                                },
                                message: messageProto,
                                messageTimestamp: +child.attrs.t
                            }).toJSON();
                            await upsertMessage(fullMessage, 'append');
                            logger.debug('Processed plaintext newsletter message');
                        }
                        catch (error) {
                            logger.error({ error }, 'Failed to decode plaintext newsletter message');
                        }
                    }
                    break;
                }
                default:
                    logger.warn({ node, child }, 'Unknown newsletter notification child');
                    break;
            }
        }
    };
    const sendMessageAck = async (node, errorCode) => {
        const stanza = (0, stanza_ack_js_1.buildAckStanza)(node, errorCode, authState.creds.me.id);
        logger.debug({ recv: { tag: node.tag, attrs: node.attrs }, sent: stanza.attrs }, 'sent ack');
        await sendNode(stanza);
    };
    const rejectCall = async (callId, callFrom) => {
        const stanza = {
            tag: 'call',
            attrs: {
                from: authState.creds.me.id,
                to: callFrom
            },
            content: [
                {
                    tag: 'reject',
                    attrs: {
                        'call-id': callId,
                        'call-creator': callFrom,
                        count: '0'
                    },
                    content: undefined
                }
            ]
        };
        await query(stanza);
    };
    const sendRetryRequest = async (node, forceIncludeKeys = false) => {
        const { fullMessage } = (0, index_js_5.decodeMessageNode)(node, authState.creds.me.id, authState.creds.me.lid || '');
        const { key: msgKey } = fullMessage;
        const msgId = msgKey.id;
        if (messageRetryManager) {
             
            if (messageRetryManager.hasExceededMaxRetries(msgId)) {
                logger.debug({ msgId }, 'reached retry limit with new retry manager, clearing');
                messageRetryManager.markRetryFailed(msgId);
                return;
            }
             
            const retryCount = messageRetryManager.incrementRetryCount(msgId);
             
            const key = JSON.stringify([msgKey.remoteJid, msgKey.participant || "", msgId]);
            await msgRetryCache.set(key, retryCount);
        }
        else {
             
            const key = JSON.stringify([msgKey.remoteJid, msgKey.participant || "", msgId]);
            let retryCount = (await msgRetryCache.get(key)) || 0;
            if (retryCount >= maxMsgRetryCount) {
                logger.debug({ retryCount, msgId }, 'reached retry limit, clearing');
                await msgRetryCache.set(key, retryCount);
                return;
            }
            retryCount += 1;
            await msgRetryCache.set(key, retryCount);
        }
        const key = JSON.stringify([msgKey.remoteJid, msgKey.participant || "", msgId]);
        const retryCount = (await msgRetryCache.get(key)) || 1;
        const { account, signedPreKey, signedIdentityKey: identityKey } = authState.creds;
        const fromJid = node.attrs.from;
         
        let shouldRecreateSession = false;
        let recreateReason = '';
        if (enableAutoSessionRecreation && messageRetryManager && retryCount > 1) {
            try {
                 
                const sessionId = signalRepository.jidToSignalProtocolAddress(fromJid);
                const hasSession = await signalRepository.validateSession(fromJid);
                const result = messageRetryManager.shouldRecreateSession(fromJid, hasSession.exists);
                shouldRecreateSession = result.recreate;
                recreateReason = result.reason;
                if (shouldRecreateSession) {
                    logger.debug({ fromJid, retryCount, reason: recreateReason }, 'recreating session for retry');
                     
                    await authState.keys.set({ session: { [sessionId]: null } });
                    forceIncludeKeys = true;
                }
            }
            catch (error) {
                logger.warn({ error, fromJid }, 'failed to check session recreation');
            }
        }
        if (retryCount <= 2) {
             
            if (messageRetryManager) {
                 
                messageRetryManager.schedulePhoneRequest(msgId, async () => {
                    try {
                        const requestId = await requestPlaceholderResend(msgKey);
                        logger.debug(`sendRetryRequest: requested placeholder resend (${requestId}) for message ${msgId} (scheduled)`);
                    }
                    catch (error) {
                        logger.warn({ error, msgId }, 'failed to send scheduled phone request');
                    }
                });
            }
            else {
                 
                const msgId = await requestPlaceholderResend(msgKey);
                logger.debug(`sendRetryRequest: requested placeholder resend for message ${msgId}`);
            }
        }
        const deviceIdentity = (0, index_js_5.encodeSignedDeviceIdentity)(account, true);
        await authState.keys.transaction(async () => {
            const receipt = {
                tag: 'receipt',
                attrs: {
                    id: msgId,
                    type: 'retry',
                    to: node.attrs.from
                },
                content: [
                    {
                        tag: 'retry',
                        attrs: {
                            count: retryCount.toString(),
                            id: node.attrs.id,
                            t: node.attrs.t,
                            v: '1',
                             
                            error: '0'
                        }
                    },
                    {
                        tag: 'registration',
                        attrs: {},
                        content: (0, index_js_5.encodeBigEndian)(authState.creds.registrationId)
                    }
                ]
            };
            if (node.attrs.recipient) {
                receipt.attrs.recipient = node.attrs.recipient;
            }
            if (node.attrs.participant) {
                receipt.attrs.participant = node.attrs.participant;
            }
            if (retryCount > 1 || forceIncludeKeys || shouldRecreateSession) {
                const { update, preKeys } = await (0, index_js_5.getNextPreKeys)(authState, 1);
                const [keyId] = Object.keys(preKeys);
                const key = preKeys[+keyId];
                const content = receipt.content;
                content.push({
                    tag: 'keys',
                    attrs: {},
                    content: [
                        { tag: 'type', attrs: {}, content: Buffer.from(index_js_3.KEY_BUNDLE_TYPE) },
                        { tag: 'identity', attrs: {}, content: identityKey.public },
                        (0, index_js_5.xmppPreKey)(key, +keyId),
                        (0, index_js_5.xmppSignedPreKey)(signedPreKey),
                        { tag: 'device-identity', attrs: {}, content: deviceIdentity }
                    ]
                });
                ev.emit('creds.update', update);
            }
            await sendNode(receipt);
            logger.info({ msgAttrs: node.attrs, retryCount }, 'sent retry receipt');
        }, authState?.creds?.me?.id || 'sendRetryRequest');
    };
     
    const inFlightPreKeyLow = new Set();
     




    const reissueTcTokenAfterIdentityChange = (from) => {
        void (async () => {
            const normalizedJid = (0, index_js_6.jidNormalizedUser)(from);
            const tcJid = await (0, tc_token_utils_js_1.resolveTcTokenJid)(normalizedJid, getLIDForPN);
            const tcTokenData = await authState.keys.get('tctoken', [tcJid]);
            const senderTs = tcTokenData?.[tcJid]?.senderTimestamp;
            if (senderTs === null || senderTs === undefined || (0, tc_token_utils_js_1.isTcTokenExpired)(senderTs)) {
                return;
            }
            logger.debug({ jid: normalizedJid, senderTimestamp: senderTs }, 'identity changed, re-issuing tctoken');
            const getPNForLID = signalRepository.lidMapping.getPNForLID.bind(signalRepository.lidMapping);
            const issueJid = await (0, tc_token_utils_js_1.resolveIssuanceJid)(normalizedJid, sock.serverProps.lidTrustedTokenIssueToLid, getLIDForPN, getPNForLID);
            const result = await issuePrivacyTokens([issueJid], senderTs);
            await (0, tc_token_utils_js_1.storeTcTokensFromIqResult)({
                result,
                fallbackJid: tcJid,
                keys: authState.keys,
                getLIDForPN,
                onNewJidStored: trackTcTokenJid
            });
        })().catch(err => {
            logger.debug({ jid: from, err: err?.message }, 'failed to re-issue tctoken after identity change');
        });
    };
    const handleEncryptNotification = async (node) => {
        const from = node.attrs.from;
        if (from === index_js_6.S_WHATSAPP_NET) {
            const stanzaId = node.attrs.id;
            if (stanzaId && inFlightPreKeyLow.has(stanzaId)) {
                return;
            }
            const countChild = (0, index_js_6.getBinaryNodeChild)(node, 'count');
            const count = +countChild.attrs.value;
            const shouldUploadMorePreKeys = count < index_js_3.MIN_PREKEY_COUNT;
            logger.debug({ count, shouldUploadMorePreKeys }, 'recv pre-key count');
            if (shouldUploadMorePreKeys) {
                if (stanzaId)
                    inFlightPreKeyLow.add(stanzaId);
                try {
                    await uploadPreKeys();
                }
                finally {
                    if (stanzaId)
                        inFlightPreKeyLow.delete(stanzaId);
                }
            }
        }
        else {
            const result = await (0, index_js_5.handleIdentityChange)(node, {
                meId: authState.creds.me?.id,
                meLid: authState.creds.me?.lid,
                validateSession: signalRepository.validateSession,
                assertSessions,
                debounceCache: identityAssertDebounce,
                logger,
                onBeforeSessionRefresh: reissueTcTokenAfterIdentityChange
            });
            if (result.action === 'no_identity_node') {
                logger.info({ node }, 'unknown encrypt notification');
            }
        }
    };
    const handleGroupNotification = (fullNode, child, msg) => {
         
        const actingParticipantLid = fullNode.attrs.participant;
        const actingParticipantPn = fullNode.attrs.participant_pn;
        const actingParticipantUsername = fullNode.attrs.participant_username;
        const affectedParticipantLid = (0, index_js_6.getBinaryNodeChild)(child, 'participant')?.attrs?.jid || actingParticipantLid;
        const affectedParticipantPn = (0, index_js_6.getBinaryNodeChild)(child, 'participant')?.attrs?.phone_number || actingParticipantPn;
        switch (child?.tag) {
            case 'create':
                const metadata = (0, groups_js_1.extractGroupMetadata)(child);
                msg.messageStubType = index_js_4.WAMessageStubType.GROUP_CREATE;
                msg.messageStubParameters = [metadata.subject];
                msg.key = { participant: metadata.owner, participantAlt: metadata.ownerPn };
                ev.emit('chats.upsert', [
                    {
                        id: metadata.id,
                        name: metadata.subject,
                        conversationTimestamp: metadata.creation
                    }
                ]);
                ev.emit('groups.upsert', [
                    {
                        ...metadata,
                        author: actingParticipantLid,
                        authorPn: actingParticipantPn,
                        authorUsername: actingParticipantUsername
                    }
                ]);
                break;
            case 'ephemeral':
            case 'not_ephemeral':
                msg.message = {
                    protocolMessage: {
                        type: index_js_1.proto.Message.ProtocolMessage.Type.EPHEMERAL_SETTING,
                        ephemeralExpiration: +(child.attrs.expiration || 0)
                    }
                };
                break;
            case 'modify':
                const oldNumber = (0, index_js_6.getBinaryNodeChildren)(child, 'participant').map(p => p.attrs.jid);
                msg.messageStubParameters = oldNumber || [];
                msg.messageStubType = index_js_4.WAMessageStubType.GROUP_PARTICIPANT_CHANGE_NUMBER;
                break;
            case 'promote':
            case 'demote':
            case 'remove':
            case 'add':
            case 'leave':
                const stubType = `GROUP_PARTICIPANT_${child.tag.toUpperCase()}`;
                msg.messageStubType = index_js_4.WAMessageStubType[stubType];
                const participants = (0, index_js_6.getBinaryNodeChildren)(child, 'participant').map(({ attrs }) => {
                     
                    return {
                        id: attrs.jid,
                        phoneNumber: (0, index_js_6.isLidUser)(attrs.jid) && (0, index_js_6.isPnUser)(attrs.phone_number) ? attrs.phone_number : undefined,
                        lid: (0, index_js_6.isPnUser)(attrs.jid) && (0, index_js_6.isLidUser)(attrs.lid) ? attrs.lid : undefined,
                        username: attrs.participant_username || attrs.username || undefined,
                        admin: (attrs.type || null)
                    };
                });
                if (participants.length === 1 &&
                     
                     
                    ((0, index_js_6.areJidsSameUser)(participants[0].id, actingParticipantLid) ||
                        (0, index_js_6.areJidsSameUser)(participants[0].id, actingParticipantPn)) &&
                    child.tag === 'remove') {
                    msg.messageStubType = index_js_4.WAMessageStubType.GROUP_PARTICIPANT_LEAVE;
                }
                msg.messageStubParameters = participants.map(a => JSON.stringify(a));
                break;
            case 'subject':
                msg.messageStubType = index_js_4.WAMessageStubType.GROUP_CHANGE_SUBJECT;
                msg.messageStubParameters = [child.attrs.subject];
                break;
            case 'description':
                const description = (0, index_js_6.getBinaryNodeChild)(child, 'body')?.content?.toString();
                msg.messageStubType = index_js_4.WAMessageStubType.GROUP_CHANGE_DESCRIPTION;
                msg.messageStubParameters = description ? [description] : undefined;
                break;
            case 'announcement':
            case 'not_announcement':
                msg.messageStubType = index_js_4.WAMessageStubType.GROUP_CHANGE_ANNOUNCE;
                msg.messageStubParameters = [child.tag === 'announcement' ? 'on' : 'off'];
                break;
            case 'locked':
            case 'unlocked':
                msg.messageStubType = index_js_4.WAMessageStubType.GROUP_CHANGE_RESTRICT;
                msg.messageStubParameters = [child.tag === 'locked' ? 'on' : 'off'];
                break;
            case 'invite':
                msg.messageStubType = index_js_4.WAMessageStubType.GROUP_CHANGE_INVITE_LINK;
                msg.messageStubParameters = [child.attrs.code];
                break;
            case 'member_add_mode':
                const addMode = child.content;
                if (addMode) {
                    msg.messageStubType = index_js_4.WAMessageStubType.GROUP_MEMBER_ADD_MODE;
                    msg.messageStubParameters = [addMode.toString()];
                }
                break;
            case 'membership_approval_mode':
                const approvalMode = (0, index_js_6.getBinaryNodeChild)(child, 'group_join');
                if (approvalMode) {
                    msg.messageStubType = index_js_4.WAMessageStubType.GROUP_MEMBERSHIP_JOIN_APPROVAL_MODE;
                    msg.messageStubParameters = [approvalMode.attrs.state];
                }
                break;
            case 'created_membership_requests':
                msg.messageStubType = index_js_4.WAMessageStubType.GROUP_MEMBERSHIP_JOIN_APPROVAL_REQUEST_NON_ADMIN_ADD;
                msg.messageStubParameters = [
                    JSON.stringify({ lid: affectedParticipantLid, pn: affectedParticipantPn }),
                    'created',
                    child.attrs.request_method
                ];
                break;
            case 'revoked_membership_requests':
                const isDenied = (0, index_js_6.areJidsSameUser)(affectedParticipantLid, actingParticipantLid);
                 
                msg.messageStubType = index_js_4.WAMessageStubType.GROUP_MEMBERSHIP_JOIN_APPROVAL_REQUEST_NON_ADMIN_ADD;
                msg.messageStubParameters = [
                    JSON.stringify({ lid: affectedParticipantLid, pn: affectedParticipantPn }),
                    isDenied ? 'revoked' : 'rejected'
                ];
                break;
        }
    };
    const handleDevicesNotification = async (node) => {
        const [child] = (0, index_js_6.getAllBinaryNodeChildren)(node);
        const from = (0, index_js_6.jidNormalizedUser)(node.attrs.from);
        if (!child) {
            logger.debug({ from }, 'devices notification missing child, skipping');
            return;
        }
        const tag = child.tag;
        const deviceHash = child.attrs.device_hash;
        const devices = (0, index_js_6.getBinaryNodeChildren)(child, 'device');
        if ((0, index_js_6.areJidsSameUser)(from, authState.creds.me.id) || (0, index_js_6.areJidsSameUser)(from, authState.creds.me.lid)) {
            const deviceJids = devices.map(d => d.attrs.jid);
            logger.info({ deviceJids }, 'got my own devices');
        }
        if (!devices.length) {
            logger.debug({ from, tag }, 'no devices in notification, skipping');
            return;
        }
        const decoded = [];
        for (const d of devices) {
            const jid = d.attrs.jid;
            if (!jid)
                continue;
            const parts = (0, index_js_6.jidDecode)(jid);
            if (!parts) {
                logger.debug({ jid }, 'failed to decode device jid, skipping');
                continue;
            }
            decoded.push({ jid, user: parts.user, server: parts.server, device: parts.device });
        }
        if (!decoded.length)
            return;
        await devicesMutex.mutex(async () => {
            const byUser = new Map();
            for (const d of decoded) {
                const list = byUser.get(d.user) || [];
                list.push(d);
                byUser.set(d.user, list);
            }
            for (const [user, entries] of byUser) {
                if (tag === 'update') {
                    logger.debug({ user }, `${user}'s device list updated, dropping cached devices`);
                    await userDevicesCache?.del(user);
                    continue;
                }
                if (tag === 'remove') {
                    await signalRepository.deleteSession(entries.map(e => e.jid));
                }
                const existingCache = (await userDevicesCache?.get(user)) || [];
                if (!existingCache.length) {
                     
                     
                     
                    logger.debug({ user, tag }, 'device list not cached, deferring to USync refresh');
                    continue;
                }
                const affected = new Set(entries.map(e => e.device));
                let updatedDevices;
                switch (tag) {
                    case 'add':
                        logger.info({ deviceHash, count: entries.length }, 'devices added');
                        updatedDevices = [
                            ...existingCache.filter(d => !affected.has(d.device)),
                            ...entries.map(e => ({ user: e.user, server: e.server, device: e.device }))
                        ];
                        break;
                    case 'remove':
                        logger.info({ deviceHash, count: entries.length }, 'devices removed');
                        updatedDevices = existingCache.filter(d => !affected.has(d.device));
                        break;
                    default:
                        logger.debug({ tag }, 'Unknown device list change tag');
                        continue;
                }
                if (updatedDevices.length === 0) {
                    await userDevicesCache?.del(user);
                }
                else {
                    await userDevicesCache?.set(user, updatedDevices);
                }
            }
        });
    };
    const processNotification = async (node) => {
        const result = {};
        const [child] = (0, index_js_6.getAllBinaryNodeChildren)(node);
        const nodeType = node.attrs.type;
        const from = (0, index_js_6.jidNormalizedUser)(node.attrs.from);
        switch (nodeType) {
            case 'newsletter':
                await handleNewsletterNotification(node);
                break;
            case 'mex':
                await handleMexNotification(node);
                break;
            case 'w:gp2':
                 
                handleGroupNotification(node, child, result);
                break;
            case 'mediaretry':
                const event = (0, index_js_5.decodeMediaRetryNode)(node);
                ev.emit('messages.media-update', [event]);
                break;
            case 'encrypt':
                await handleEncryptNotification(node);
                break;
            case 'devices':
                try {
                    await handleDevicesNotification(node);
                }
                catch (error) {
                    logger.error({ error, node }, 'failed to handle devices notification');
                }
                break;
            case 'server_sync':
                const update = (0, index_js_6.getBinaryNodeChild)(node, 'collection');
                if (update) {
                    const name = update.attrs.name;
                    await resyncAppState([name], false);
                }
                break;
            case 'picture':
                const setPicture = (0, index_js_6.getBinaryNodeChild)(node, 'set');
                const delPicture = (0, index_js_6.getBinaryNodeChild)(node, 'delete');
                 
                ev.emit('contacts.update', [
                    {
                        id: (0, index_js_6.jidNormalizedUser)(node?.attrs?.from) || (setPicture || delPicture)?.attrs?.hash || '',
                        imgUrl: setPicture ? 'changed' : 'removed'
                    }
                ]);
                if ((0, index_js_6.isJidGroup)(from)) {
                    const node = setPicture || delPicture;
                    result.messageStubType = index_js_4.WAMessageStubType.GROUP_CHANGE_ICON;
                    if (setPicture) {
                        result.messageStubParameters = [setPicture.attrs.id];
                    }
                    result.participant = node?.attrs.author;
                    result.key = {
                        ...(result.key || {}),
                        participant: setPicture?.attrs.author
                    };
                }
                break;
            case 'account_sync':
                if (child.tag === 'disappearing_mode') {
                    const newDuration = +child.attrs.duration;
                    const timestamp = +child.attrs.t;
                    logger.info({ newDuration }, 'updated account disappearing mode');
                    ev.emit('creds.update', {
                        accountSettings: {
                            ...authState.creds.accountSettings,
                            defaultDisappearingMode: {
                                ephemeralExpiration: newDuration,
                                ephemeralSettingTimestamp: timestamp
                            }
                        }
                    });
                }
                else if (child.tag === 'blocklist') {
                    const blocklists = (0, index_js_6.getBinaryNodeChildren)(child, 'item');
                    for (const { attrs } of blocklists) {
                        const blocklist = [attrs.jid];
                        const type = attrs.action === 'block' ? 'add' : 'remove';
                        ev.emit('blocklist.update', { blocklist, type });
                    }
                }
                break;
            case 'link_code_companion_reg': {
                const linkCodeCompanionReg = (0, index_js_6.getBinaryNodeChild)(node, 'link_code_companion_reg');
                 
                 
                 
                if (linkCodeCompanionReg?.attrs?.stage !== 'primary_hello')
                    break;
                const ref = toRequiredBuffer((0, index_js_6.getBinaryNodeChildBuffer)(linkCodeCompanionReg, 'link_code_pairing_ref'));
                const primaryIdentityPublicKey = toRequiredBuffer((0, index_js_6.getBinaryNodeChildBuffer)(linkCodeCompanionReg, 'primary_identity_pub'));
                const primaryEphemeralPublicKeyWrapped = toRequiredBuffer((0, index_js_6.getBinaryNodeChildBuffer)(linkCodeCompanionReg, 'link_code_pairing_wrapped_primary_ephemeral_pub'));
                const codePairingPublicKey = await decipherLinkPublicKey(primaryEphemeralPublicKeyWrapped);
                const companionSharedKey = index_js_5.Curve.sharedKey(authState.creds.pairingEphemeralKeyPair.private, codePairingPublicKey);
                const random = (0, node_crypto_1.randomBytes)(32);
                const linkCodeSalt = (0, node_crypto_1.randomBytes)(32);
                const linkCodePairingExpanded = (0, index_js_5.hkdf)(companionSharedKey, 32, {
                    salt: linkCodeSalt,
                    info: 'link_code_pairing_key_bundle_encryption_key'
                });
                const encryptPayload = Buffer.concat([
                    Buffer.from(authState.creds.signedIdentityKey.public),
                    primaryIdentityPublicKey,
                    random
                ]);
                const encryptIv = (0, node_crypto_1.randomBytes)(12);
                const encrypted = (0, index_js_5.aesEncryptGCM)(encryptPayload, linkCodePairingExpanded, encryptIv, Buffer.alloc(0));
                const encryptedPayload = Buffer.concat([linkCodeSalt, encryptIv, encrypted]);
                const identitySharedKey = index_js_5.Curve.sharedKey(authState.creds.signedIdentityKey.private, primaryIdentityPublicKey);
                const identityPayload = Buffer.concat([companionSharedKey, identitySharedKey, random]);
                authState.creds.advSecretKey = Buffer.from((0, index_js_5.hkdf)(identityPayload, 32, { info: 'adv_secret' })).toString('base64');
                await query({
                    tag: 'iq',
                    attrs: {
                        to: index_js_6.S_WHATSAPP_NET,
                        type: 'set',
                        id: sock.generateMessageTag(),
                        xmlns: 'md'
                    },
                    content: [
                        {
                            tag: 'link_code_companion_reg',
                            attrs: {
                                jid: authState.creds.me.id,
                                stage: 'companion_finish'
                            },
                            content: [
                                {
                                    tag: 'link_code_pairing_wrapped_key_bundle',
                                    attrs: {},
                                    content: encryptedPayload
                                },
                                {
                                    tag: 'companion_identity_public',
                                    attrs: {},
                                    content: authState.creds.signedIdentityKey.public
                                },
                                {
                                    tag: 'link_code_pairing_ref',
                                    attrs: {},
                                    content: ref
                                }
                            ]
                        }
                    ]
                });
                authState.creds.registered = true;
                ev.emit('creds.update', authState.creds);
                break;
            }
            case 'privacy_token':
                await handlePrivacyTokenNotification(node);
                break;
        }
        if (Object.keys(result).length) {
            return result;
        }
    };
     




    const tcTokenKnownJids = new Set();
    const tcTokenIndexLoaded = (async () => {
        try {
            const jids = await (0, tc_token_utils_js_1.readTcTokenIndex)(authState.keys);
            for (const jid of jids)
                tcTokenKnownJids.add(jid);
            logger.debug({ count: tcTokenKnownJids.size }, 'loaded tctoken index');
        }
        catch (err) {
            logger.warn({ err: err?.message }, 'failed to load tctoken index');
        }
    })();
    let tcTokenIndexTimer;
    async function flushTcTokenIndex() {
        if (tcTokenIndexTimer) {
            clearTimeout(tcTokenIndexTimer);
            tcTokenIndexTimer = undefined;
        }
         
         
        const write = await (0, tc_token_utils_js_1.buildMergedTcTokenIndexWrite)(authState.keys, tcTokenKnownJids);
        return authState.keys.set({ tctoken: write });
    }
    function scheduleTcTokenIndexSave() {
        if (tcTokenIndexTimer) {
            clearTimeout(tcTokenIndexTimer);
        }
        tcTokenIndexTimer = setTimeout(() => {
            tcTokenIndexTimer = undefined;
            flushTcTokenIndex().catch(err => {
                logger.warn({ err: err?.message }, 'failed to save tctoken index');
            });
        }, 5000);
    }
    function trackTcTokenJid(jid) {
        if (jid && jid !== tc_token_utils_js_1.TC_TOKEN_INDEX_KEY && !tcTokenKnownJids.has(jid)) {
            tcTokenKnownJids.add(jid);
            scheduleTcTokenIndexSave();
        }
    }
    const handlePrivacyTokenNotification = async (node) => {
        const tokensNode = (0, index_js_6.getBinaryNodeChild)(node, 'tokens');
        if (!tokensNode)
            return;
        const from = (0, index_js_6.jidNormalizedUser)(node.attrs.from);
         
         
        const senderLid = node.attrs.sender_lid && (0, index_js_6.isLidUser)((0, index_js_6.jidNormalizedUser)(node.attrs.sender_lid))
            ? (0, index_js_6.jidNormalizedUser)(node.attrs.sender_lid)
            : undefined;
        const fallbackJid = senderLid ?? (await (0, tc_token_utils_js_1.resolveTcTokenJid)(from, getLIDForPN));
        logger.debug({ from, storageJid: fallbackJid }, 'processing privacy token notification');
        await (0, tc_token_utils_js_1.storeTcTokensFromIqResult)({
            result: node,
            fallbackJid,
            keys: authState.keys,
            getLIDForPN,
            onNewJidStored: trackTcTokenJid
        });
    };
    async function decipherLinkPublicKey(data) {
        const buffer = toRequiredBuffer(data);
        const salt = buffer.slice(0, 32);
        const secretKey = await (0, index_js_5.derivePairingCodeKey)(authState.creds.pairingCode, salt);
        const iv = buffer.slice(32, 48);
        const payload = buffer.slice(48, 80);
        return (0, index_js_5.aesDecryptCTR)(payload, secretKey, iv);
    }
    function toRequiredBuffer(data) {
        if (data === undefined) {
            throw new index_js_2.HttpError('Invalid buffer', { statusCode: 400 });
        }
        return data instanceof Buffer ? data : Buffer.from(data);
    }
    const willSendMessageAgain = async (id, participant) => {
        const key = `${id}:${participant}`;
        const retryCount = (await msgRetryCache.get(key)) || 0;
        return retryCount < maxMsgRetryCount;
    };
    const updateSendMessageAgainCount = async (id, participant) => {
        const key = `${id}:${participant}`;
        const newValue = ((await msgRetryCache.get(key)) || 0) + 1;
        await msgRetryCache.set(key, newValue);
    };
    const sendMessagesAgain = async (key, ids, retryNode, receiptNode) => {
        const remoteJid = key.remoteJid;
        const participant = key.participant || remoteJid;
        const retryCount = +retryNode.attrs.count || 1;
        const msgId = ids[0];
         
        const msgs = [];
        for (const id of ids) {
            let msg;
             
            if (messageRetryManager) {
                const cachedMsg = messageRetryManager.getRecentMessage(remoteJid, id);
                if (cachedMsg) {
                    msg = cachedMsg.message;
                    logger.debug({ jid: remoteJid, id }, 'found message in retry cache');
                     
                    messageRetryManager.markRetrySuccess(id);
                }
            }
             
            if (!msg) {
                msg = await getMessage({ ...key, id });
                if (msg) {
                    logger.debug({ jid: remoteJid, id }, 'found message via getMessage');
                     
                    if (messageRetryManager) {
                        messageRetryManager.markRetrySuccess(id);
                    }
                }
            }
            msgs.push(msg);
        }
         
         
         
        const sendToAll = !(0, index_js_6.jidDecode)(participant)?.device;
        const sessionId = signalRepository.jidToSignalProtocolAddress(participant);
        let injectedFromBundle = false;
        const bundle = (0, index_js_5.extractE2ESessionFromRetryReceipt)(receiptNode);
        if (bundle) {
            try {
                await signalRepository.injectE2ESession({ jid: participant, session: bundle });
                injectedFromBundle = true;
                logger.debug({ participant, retryCount }, 'injected session from retry receipt key bundle');
            }
            catch (error) {
                logger.warn({ error, participant }, 'failed to inject session from retry receipt');
            }
        }
        if (!injectedFromBundle) {
            const receivedRegId = (0, index_js_6.getBinaryNodeChildUInt)(receiptNode, 'registration', 4);
            if (typeof receivedRegId === 'number' && Number.isInteger(receivedRegId)) {
                const info = await signalRepository.getSessionInfo(participant);
                if (info && info.registrationId !== 0 && info.registrationId !== receivedRegId) {
                    logger.info({ participant, stored: info.registrationId, received: receivedRegId }, 'reg id mismatch on retry without bundle, deleting session');
                    await authState.keys.set({ session: { [sessionId]: null } });
                }
            }
        }
        const BASE_KEY_CHECK_RETRY = 2;
        if (msgId && messageRetryManager) {
            const info = await signalRepository.getSessionInfo(participant);
            if (info) {
                if (retryCount === BASE_KEY_CHECK_RETRY) {
                    messageRetryManager.saveBaseKey(sessionId, msgId, info.baseKey);
                }
                else if (retryCount > BASE_KEY_CHECK_RETRY) {
                    if (messageRetryManager.hasSameBaseKey(sessionId, msgId, info.baseKey)) {
                        logger.warn({ participant, retryCount }, 'base key collision on retry, forcing fresh session');
                        await authState.keys.set({ session: { [sessionId]: null } });
                    }
                    messageRetryManager.deleteBaseKey(sessionId, msgId);
                }
            }
        }
        let shouldRecreateSession = false;
        let recreateReason = '';
        if (enableAutoSessionRecreation && messageRetryManager && retryCount > 1 && !injectedFromBundle) {
            try {
                const hasSession = await signalRepository.validateSession(participant);
                const result = messageRetryManager.shouldRecreateSession(participant, hasSession.exists);
                shouldRecreateSession = result.recreate;
                recreateReason = result.reason;
                if (shouldRecreateSession) {
                    logger.debug({ participant, retryCount, reason: recreateReason }, 'recreating session for outgoing retry');
                    await authState.keys.set({ session: { [sessionId]: null } });
                }
            }
            catch (error) {
                logger.warn({ error, participant }, 'failed to check session recreation for outgoing retry');
            }
        }
        if (!injectedFromBundle) {
            await assertSessions([participant], true);
        }
        if ((0, index_js_6.isJidGroup)(remoteJid)) {
            await authState.keys.set({ 'sender-key-memory': { [remoteJid]: null } });
        }
        logger.debug({ participant, sendToAll, shouldRecreateSession, recreateReason, injectedFromBundle }, 'prepared session for retry resend');
        for (const [i, msg] of msgs.entries()) {
            if (!ids[i])
                continue;
            if (msg && (await willSendMessageAgain(ids[i], participant))) {
                await updateSendMessageAgainCount(ids[i], participant);
                const msgRelayOpts = { messageId: ids[i] };
                if (sendToAll) {
                    msgRelayOpts.useUserDevicesCache = false;
                }
                else {
                    msgRelayOpts.participant = {
                        jid: participant,
                        count: +retryNode.attrs.count
                    };
                }
                await relayMessage(key.remoteJid, msg, msgRelayOpts);
            }
            else {
                logger.debug({ jid: key.remoteJid, id: ids[i] }, 'recv retry request, but message not available');
            }
        }
    };
    const handleReceipt = async (node) => {
        const { attrs, content } = node;
        const isLid = attrs.from.includes('lid');
        const isNodeFromMe = (0, index_js_6.areJidsSameUser)(attrs.participant || attrs.from, isLid ? authState.creds.me?.lid : authState.creds.me?.id);
        const remoteJid = !isNodeFromMe || (0, index_js_6.isJidGroup)(attrs.from) ? attrs.from : attrs.recipient;
        const fromMe = !attrs.recipient || ((attrs.type === 'retry' || attrs.type === 'sender') && isNodeFromMe);
        const key = {
            remoteJid,
            id: '',
            fromMe,
            participant: attrs.participant
        };
        const ids = [attrs.id];
        if (Array.isArray(content)) {
            const items = (0, index_js_6.getBinaryNodeChildren)(content[0], 'item');
            ids.push(...items.map(i => i.attrs.id));
        }
        try {
            await Promise.all([
                receiptMutex.mutex(async () => {
                    const status = (0, index_js_5.getStatusFromReceiptType)(attrs.type);
                    if (typeof status !== 'undefined' &&
                         
                         
                        (status >= index_js_1.proto.WebMessageInfo.Status.SERVER_ACK || !isNodeFromMe)) {
                        if ((0, index_js_6.isJidGroup)(remoteJid) || (0, index_js_6.isJidStatusBroadcast)(remoteJid)) {
                            if (attrs.participant) {
                                const updateKey = status === index_js_1.proto.WebMessageInfo.Status.DELIVERY_ACK ? 'receiptTimestamp' : 'readTimestamp';
                                ev.emit('message-receipt.update', ids.map(id => ({
                                    key: { ...key, id },
                                    receipt: {
                                        userJid: (0, index_js_6.jidNormalizedUser)(attrs.participant),
                                        [updateKey]: +attrs.t
                                    }
                                })));
                            }
                        }
                        else {
                            ev.emit('messages.update', ids.map(id => ({
                                key: { ...key, id },
                                update: { status, messageTimestamp: (0, index_js_5.toNumber)(+(attrs.t ?? 0)) }
                            })));
                        }
                    }
                    if (attrs.type === 'retry') {
                         
                        key.participant = key.participant || attrs.from;
                        const retryNode = (0, index_js_6.getBinaryNodeChild)(node, 'retry');
                        if (ids[0] && key.participant && (await willSendMessageAgain(ids[0], key.participant))) {
                            if (key.fromMe) {
                                try {
                                    await updateSendMessageAgainCount(ids[0], key.participant);
                                    logger.debug({ attrs, key }, 'recv retry request');
                                    await sendMessagesAgain(key, ids, retryNode, node);
                                }
                                catch (error) {
                                    logger.error({ key, ids, trace: error instanceof Error ? error.stack : 'Unknown error' }, 'error in sending message again');
                                }
                            }
                            else {
                                logger.info({ attrs, key }, 'recv retry for not fromMe message');
                            }
                        }
                        else {
                            logger.info({ attrs, key }, 'will not send message again, as sent too many times');
                        }
                    }
                })
            ]);
        }
        finally {
            await sendMessageAck(node).catch(ackErr => logger.error({ ackErr }, 'failed to ack receipt'));
        }
    };
    const handleNotification = async (node) => {
        const remoteJid = node.attrs.from;
        try {
            await Promise.all([
                notificationMutex.mutex(async () => {
                    const msg = await processNotification(node);
                    if (msg) {
                        const fromMe = (0, index_js_6.areJidsSameUser)(node.attrs.participant || remoteJid, authState.creds.me.id);
                        const { senderAlt: participantAlt, addressingMode } = (0, index_js_5.extractAddressingContext)(node);
                        msg.key = {
                            remoteJid,
                            fromMe,
                            participant: node.attrs.participant,
                            participantAlt,
                            participantUsername: node.attrs.participant_username,
                            addressingMode,
                            id: node.attrs.id,
                            ...(msg.key || {})
                        };
                        msg.participant ?? (msg.participant = node.attrs.participant);
                        msg.messageTimestamp = +node.attrs.t;
                        const fullMsg = index_js_1.proto.WebMessageInfo.fromObject(msg);
                        await upsertMessage(fullMsg, 'append');
                    }
                })
            ]);
        }
        finally {
            await sendMessageAck(node).catch(ackErr => logger.error({ ackErr }, 'failed to ack notification'));
        }
    };
    const handleMessage = async (node) => {
        const encNode = (0, index_js_6.getBinaryNodeChild)(node, 'enc');
         
        if (encNode?.attrs.type === 'msmsg') {
            logger.debug({ key: node.attrs.key }, 'ignored msmsg');
            await sendMessageAck(node, index_js_5.NACK_REASONS.MissingMessageSecret);
            return;
        }
        let acked = false;
        try {
            const { fullMessage: msg, category, author, decrypt } = (0, index_js_5.decryptMessageNode)(node, authState.creds.me.id, authState.creds.me.lid || '', signalRepository, logger);
            const alt = msg.key.participantAlt || msg.key.remoteJidAlt;
             
            if (!!alt) {
                const altServer = (0, index_js_6.jidDecode)(alt)?.server;
                const primaryJid = msg.key.participant || msg.key.remoteJid;
                if (altServer === 'lid') {
                    if (!(await signalRepository.lidMapping.getPNForLID(alt))) {
                        await signalRepository.lidMapping.storeLIDPNMappings([{ lid: alt, pn: primaryJid }]);
                        await signalRepository.migrateSession(primaryJid, alt);
                    }
                }
                else {
                    await signalRepository.lidMapping.storeLIDPNMappings([{ lid: primaryJid, pn: alt }]);
                    await signalRepository.migrateSession(alt, primaryJid);
                }
            }
            await messageMutex.mutex(async () => {
                await decrypt();
                if (msg.key?.remoteJid && msg.key?.id && msg.message && messageRetryManager) {
                    messageRetryManager.addRecentMessage(msg.key.remoteJid, msg.key.id, msg.message);
                }
                 
                if (msg.messageStubType === index_js_1.proto.WebMessageInfo.StubType.CIPHERTEXT && msg.category !== 'peer') {
                    if (msg?.messageStubParameters?.[0] === index_js_5.MISSING_KEYS_ERROR_TEXT) {
                        acked = true;
                        return sendMessageAck(node, index_js_5.NACK_REASONS.ParsingError);
                    }
                    if (msg.messageStubParameters?.[0] === index_js_5.NO_MESSAGE_FOUND_ERROR_TEXT) {
                         
                         
                        const unavailableNode = (0, index_js_6.getBinaryNodeChild)(node, 'unavailable');
                        const unavailableType = unavailableNode?.attrs?.type;
                        if (unavailableType === 'bot_unavailable_fanout' ||
                            unavailableType === 'hosted_unavailable_fanout' ||
                            unavailableType === 'view_once_unavailable_fanout') {
                            logger.debug({ msgId: msg.key.id, unavailableType }, 'skipping placeholder resend for excluded unavailable type');
                            acked = true;
                            return sendMessageAck(node);
                        }
                        const messageAge = (0, index_js_5.unixTimestampSeconds)() - (0, index_js_5.toNumber)(msg.messageTimestamp);
                        if (messageAge > index_js_3.PLACEHOLDER_MAX_AGE_SECONDS) {
                            logger.debug({ msgId: msg.key.id, messageAge }, 'skipping placeholder resend for old message');
                            acked = true;
                            return sendMessageAck(node);
                        }
                         
                         
                         
                         
                        const cleanKey = {
                            remoteJid: msg.key.remoteJid,
                            fromMe: msg.key.fromMe,
                            id: msg.key.id,
                            participant: msg.key.participant
                        };
                         
                         
                        const msgData = {
                            key: msg.key,
                            messageTimestamp: msg.messageTimestamp,
                            pushName: msg.pushName,
                            participant: msg.participant,
                            verifiedBizName: msg.verifiedBizName
                        };
                        requestPlaceholderResend(cleanKey, msgData)
                            .then(requestId => {
                            if (requestId && requestId !== 'RESOLVED') {
                                logger.debug({ msgId: msg.key.id, requestId }, 'requested placeholder resend for unavailable message');
                                ev.emit('messages.update', [
                                    {
                                        key: msg.key,
                                        update: { messageStubParameters: [index_js_5.NO_MESSAGE_FOUND_ERROR_TEXT, requestId] }
                                    }
                                ]);
                            }
                        })
                            .catch(err => {
                            logger.warn({ err, msgId: msg.key.id }, 'failed to request placeholder resend for unavailable message');
                        });
                        acked = true;
                        await sendMessageAck(node);
                         
                    }
                    else {
                         
                        if ((0, index_js_6.isJidStatusBroadcast)(msg.key.remoteJid)) {
                            const messageAge = (0, index_js_5.unixTimestampSeconds)() - (0, index_js_5.toNumber)(msg.messageTimestamp);
                            if (messageAge > index_js_3.STATUS_EXPIRY_SECONDS) {
                                logger.debug({ msgId: msg.key.id, messageAge, remoteJid: msg.key.remoteJid }, 'skipping retry for expired status message');
                                acked = true;
                                return sendMessageAck(node);
                            }
                        }
                        logger.debug('[handleMessage] Attempting retry request for failed decryption');
                         
                        await retryMutex.mutex(async () => {
                            try {
                                if (!ws.isOpen) {
                                    logger.debug({ node }, 'Connection closed, skipping retry');
                                    return;
                                }
                                const encNode = (0, index_js_6.getBinaryNodeChild)(node, 'enc');
                                await sendRetryRequest(node, !encNode);
                                if (retryRequestDelayMs) {
                                    await (0, index_js_5.delay)(retryRequestDelayMs);
                                }
                            }
                            catch (err) {
                                logger.error({ err }, 'Failed to send retry');
                            }
                            acked = true;
                            await sendMessageAck(node, index_js_5.NACK_REASONS.UnhandledError);
                        });
                    }
                }
                else {
                    if (messageRetryManager && msg.key.id) {
                        messageRetryManager.cancelPendingPhoneRequest(msg.key.id);
                    }
                    const isNewsletter = (0, index_js_6.isJidNewsletter)(msg.key.remoteJid);
                    if (!isNewsletter) {
                         
                        let type = undefined;
                        let participant = msg.key.participant;
                        if (category === 'peer') {
                             
                            type = 'peer_msg';
                        }
                        else if (msg.key.fromMe) {
                             
                            type = 'sender';
                             
                            if ((0, index_js_6.isLidUser)(msg.key.remoteJid) || (0, index_js_6.isLidUser)(msg.key.remoteJidAlt)) {
                                participant = author;  
                            }
                        }
                        else if (!sendActiveReceipts) {
                            type = 'inactive';
                        }
                        acked = true;
                        await sendReceipt(msg.key.remoteJid, participant, [msg.key.id], type);
                         
                        const isAnyHistoryMsg = (0, index_js_5.getHistoryMsg)(msg.message);
                        if (isAnyHistoryMsg) {
                            const jid = (0, index_js_6.jidNormalizedUser)(msg.key.remoteJid);
                            await sendReceipt(jid, undefined, [msg.key.id], 'hist_sync');  
                        }
                    }
                    else {
                        acked = true;
                        await sendMessageAck(node);
                        logger.debug({ key: msg.key }, 'processed newsletter message without receipts');
                    }
                }
                (0, index_js_5.cleanMessage)(msg, authState.creds.me.id, authState.creds.me.lid);
                await upsertMessage(msg, node.attrs.offline ? 'append' : 'notify');
            });
        }
        catch (error) {
            logger.error({ error, node: (0, index_js_6.binaryNodeToString)(node) }, 'error in handling message');
            if (!acked) {
                await sendMessageAck(node, index_js_5.NACK_REASONS.UnhandledError).catch(ackErr => logger.error({ ackErr }, 'failed to ack message after error'));
            }
        }
    };
    const handleCall = async (node) => {
        try {
            const { attrs } = node;
            const [infoChild] = (0, index_js_6.getAllBinaryNodeChildren)(node);
            if (!infoChild) {
                throw new index_js_2.HttpError('Missing call info in call node');
            }
            const status = (0, index_js_5.getCallStatusFromNode)(infoChild);
            const callId = infoChild.attrs['call-id'];
            const from = infoChild.attrs.from || infoChild.attrs['call-creator'];
            const call = {
                chatId: attrs.from,
                from,
                callerPn: infoChild.attrs['caller_pn'],
                id: callId,
                date: new Date(+attrs.t * 1000),
                offline: !!attrs.offline,
                status
            };
            if (status === 'relaylatency') {
                const latencyValue = infoChild.attrs.latency || infoChild.attrs['latency_ms'] || infoChild.attrs['latency-ms'];
                const latencyMs = latencyValue ? Number(latencyValue) : undefined;
                if (Number.isFinite(latencyMs)) {
                    call.latencyMs = latencyMs;
                }
            }
            if (status === 'offer') {
                call.isVideo = !!(0, index_js_6.getBinaryNodeChild)(infoChild, 'video');
                call.isGroup = infoChild.attrs.type === 'group' || !!infoChild.attrs['group-jid'];
                call.groupJid = infoChild.attrs['group-jid'];
                await callOfferCache.set(call.id, call);
            }
            const existingCall = await callOfferCache.get(call.id);
             
            if (existingCall) {
                call.isVideo = existingCall.isVideo;
                call.isGroup = existingCall.isGroup;
                call.callerPn = call.callerPn || existingCall.callerPn;
            }
             
            if (status === 'reject' || status === 'accept' || status === 'timeout' || status === 'terminate') {
                await callOfferCache.del(call.id);
            }
            ev.emit('call', [call]);
        }
        catch (error) {
            logger.error({ error, node: (0, index_js_6.binaryNodeToString)(node) }, 'error in handling call');
        }
        finally {
            await sendMessageAck(node).catch(ackErr => logger.error({ ackErr }, 'failed to ack call'));
        }
    };
    const handleBadAck = async ({ attrs }) => {
        const key = { remoteJid: attrs.from, fromMe: true, id: attrs.id };
         
         
         
         
         
         
         
         
         
         
         
         
         
         
         
        if (attrs.error) {
            const isReachoutTimelocked = attrs.error === String(index_js_5.NACK_REASONS.SenderReachoutTimelocked);
            if (attrs.error === index_js_5.SERVER_ERROR_CODES.MessageAccountRestriction) {
                 
                 
                 
                 
                 
                logger.warn({ msgId: attrs.id, from: attrs.from }, 'error 463: account restricted or missing tctoken for contact');
                const ackFrom = attrs.from;
                if (ackFrom && !inFlight463Recoveries.has(ackFrom)) {
                    inFlight463Recoveries.add(ackFrom);
                    void (async () => {
                        try {
                            const getPNForLID = signalRepository.lidMapping.getPNForLID.bind(signalRepository.lidMapping);
                            const tcStorageJid = await (0, tc_token_utils_js_1.resolveTcTokenJid)(ackFrom, getLIDForPN);
                            const issueJid = await (0, tc_token_utils_js_1.resolveIssuanceJid)(ackFrom, sock.serverProps.lidTrustedTokenIssueToLid, getLIDForPN, getPNForLID);
                            const result = await issuePrivacyTokens([issueJid], (0, index_js_5.unixTimestampSeconds)());
                            await (0, tc_token_utils_js_1.storeTcTokensFromIqResult)({
                                result,
                                fallbackJid: tcStorageJid,
                                keys: authState.keys,
                                getLIDForPN,
                                onNewJidStored: trackTcTokenJid
                            });
                            logger.debug({ from: ackFrom }, 'completed 463 token recovery issuance');
                        }
                        catch (err) {
                            logger.debug({ from: ackFrom, err: err?.message }, 'failed 463 token recovery issuance');
                        }
                        finally {
                            inFlight463Recoveries.delete(ackFrom);
                        }
                    })();
                }
            }
            else if (attrs.error === index_js_5.SERVER_ERROR_CODES.SmaxInvalid) {
                logger.warn({ msgId: attrs.id, from: attrs.from }, 'smax-invalid (479): stanza rejected by server — likely stale device session or malformed addressing');
            }
            else if (isReachoutTimelocked) {
                 
                await fetchAccountReachoutTimelock().catch(err => logger.warn({ err }, 'failed to fetch reachout timelock'));
                logger.warn({ attrs }, 'received error in ack');
            }
            else {
                logger.warn({ attrs }, 'received error in ack');
            }
            ev.emit('messages.update', [
                {
                    key,
                    update: {
                        status: index_js_4.WAMessageStatus.ERROR,
                        messageStubParameters: isReachoutTimelocked ? [attrs.error, index_js_5.ACCOUNT_RESTRICTED_TEXT] : [attrs.error]
                    }
                }
            ]);
        }
    };
     
     
    const processNodeWithBuffer = async (node, identifier, exec) => {
        ev.buffer();
        await execTask();
        ev.flush();
        function execTask() {
            return exec(node, false).catch(err => onUnexpectedError(err, identifier));
        }
    };
    const offlineNodeProcessor = (0, offline_node_processor_js_1.makeOfflineNodeProcessor)(new Map([
        ['message', handleMessage],
        ['call', handleCall],
        ['receipt', handleReceipt],
        ['notification', handleNotification]
    ]), {
        isWsOpen: () => ws.isOpen,
        onUnexpectedError,
        yieldToEventLoop: () => new Promise(resolve => setImmediate(resolve))
    });
    const processNode = async (type, node, identifier, exec) => {
         
        const from = node.attrs.from;
        let ignoreJid = from;
        if (type === 'receipt' && from) {
            const attrs = node.attrs;
            const isLid = attrs.from.includes('lid');
            const isNodeFromMe = (0, index_js_6.areJidsSameUser)(attrs.participant || attrs.from, isLid ? authState.creds.me?.lid : authState.creds.me?.id);
            ignoreJid = !isNodeFromMe || (0, index_js_6.isJidGroup)(attrs.from) ? attrs.from : attrs.recipient;
        }
        if (ignoreJid && ignoreJid !== index_js_6.S_WHATSAPP_NET && shouldIgnoreJid(ignoreJid)) {
            await sendMessageAck(node, type === 'message' ? index_js_5.NACK_REASONS.UnhandledError : undefined);
            return;
        }
        const isOffline = !!node.attrs.offline;
        if (isOffline) {
            offlineNodeProcessor.enqueue(type, node);
        }
        else {
            await processNodeWithBuffer(node, identifier, exec);
        }
    };
     
    ws.on('CB:message', async (node) => {
        await processNode('message', node, 'processing message', handleMessage);
    });
    ws.on('CB:call', async (node) => {
        await processNode('call', node, 'handling call', handleCall);
    });
    ws.on('CB:receipt', async (node) => {
        await processNode('receipt', node, 'handling receipt', handleReceipt);
    });
    ws.on('CB:notification', async (node) => {
        await processNode('notification', node, 'handling notification', handleNotification);
    });
    ws.on('CB:ack,class:message', (node) => {
        handleBadAck(node).catch(error => onUnexpectedError(error, 'handling bad ack'));
    });
    ev.on('call', async ([call]) => {
        if (!call) {
            return;
        }
         
        if (call.status === 'timeout' || (call.status === 'offer' && call.isGroup)) {
            const msg = {
                key: {
                    remoteJid: call.chatId,
                    id: call.id,
                    fromMe: false
                },
                messageTimestamp: (0, index_js_5.unixTimestampSeconds)(call.date)
            };
            if (call.status === 'timeout') {
                if (call.isGroup) {
                    msg.messageStubType = call.isVideo
                        ? index_js_4.WAMessageStubType.CALL_MISSED_GROUP_VIDEO
                        : index_js_4.WAMessageStubType.CALL_MISSED_GROUP_VOICE;
                }
                else {
                    msg.messageStubType = call.isVideo ? index_js_4.WAMessageStubType.CALL_MISSED_VIDEO : index_js_4.WAMessageStubType.CALL_MISSED_VOICE;
                }
            }
            else {
                msg.message = { call: { callKey: Buffer.from(call.id) } };
            }
            const protoMsg = index_js_1.proto.WebMessageInfo.fromObject(msg);
            await upsertMessage(protoMsg, call.offline ? 'append' : 'notify');
        }
    });
     
    let lastTcTokenPruneTs = 0;
     
    const inFlight463Recoveries = new Set();
    ev.on('connection.update', ({ isOnline, connection }) => {
        if (typeof isOnline !== 'undefined') {
            sendActiveReceipts = isOnline;
            logger.trace(`sendActiveReceipts set to "${sendActiveReceipts}"`);
        }
         
        if (connection === 'close' && tcTokenIndexTimer) {
            clearTimeout(tcTokenIndexTimer);
            tcTokenIndexTimer = undefined;
             
            try {
                void Promise.resolve(flushTcTokenIndex()).catch(() => { });
            }
            catch {
                 
            }
        }
         
         
         
        if (isOnline) {
            const now = Date.now();
            const DAY_MS = 24 * 60 * 60 * 1000;
            if (now - lastTcTokenPruneTs >= DAY_MS) {
                lastTcTokenPruneTs = now;
                void pruneExpiredTcTokens();
            }
        }
    });
    registerSocketEndHandler(() => {
        if (!config.msgRetryCounterCache && msgRetryCache.close) {
            msgRetryCache.close();
        }
        if (!config.callOfferCache && callOfferCache.close) {
            callOfferCache.close();
        }
        identityAssertDebounce.flushAll();
        sendActiveReceipts = false;
    });
    async function pruneExpiredTcTokens() {
        try {
            await tcTokenIndexLoaded;
             
             
            const persisted = await (0, tc_token_utils_js_1.readTcTokenIndex)(authState.keys);
            const allJids = new Set(tcTokenKnownJids);
            for (const jid of persisted)
                allJids.add(jid);
            if (!allJids.size)
                return;
            const jids = [...allJids];
            const allTokens = await authState.keys.get('tctoken', jids);
            const writes = {};
            const survivors = new Set();
            let mutated = 0;
            for (const jid of jids) {
                const entry = allTokens[jid];
                if (!entry) {
                     
                    mutated++;
                    continue;
                }
                const hasPeerToken = !!entry.token?.length;
                const peerTokenExpired = hasPeerToken && (0, tc_token_utils_js_1.isTcTokenExpired)(entry.timestamp);
                const hasSenderTs = entry.senderTimestamp !== undefined;
                const senderTsExpired = hasSenderTs && (0, tc_token_utils_js_1.isTcTokenExpired)(entry.senderTimestamp);
                const keepPeerToken = hasPeerToken && !peerTokenExpired;
                const keepSenderTs = hasSenderTs && !senderTsExpired;
                if (!keepPeerToken && !keepSenderTs) {
                    writes[jid] = null;
                    mutated++;
                }
                else if (peerTokenExpired && keepSenderTs) {
                    writes[jid] = { token: Buffer.alloc(0), senderTimestamp: entry.senderTimestamp };
                    survivors.add(jid);
                    mutated++;
                }
                else {
                    survivors.add(jid);
                }
            }
            if (mutated === 0)
                return;
            await authState.keys.set({
                tctoken: {
                    ...writes,
                    [tc_token_utils_js_1.TC_TOKEN_INDEX_KEY]: {
                        token: Buffer.from(JSON.stringify([...survivors]))
                    }
                }
            });
            tcTokenKnownJids.clear();
            for (const jid of survivors)
                tcTokenKnownJids.add(jid);
            logger.debug({ mutated, remaining: survivors.size }, 'pruned expired tctokens');
        }
        catch (err) {
            logger.warn({ err: err?.message }, 'failed to prune expired tctokens');
        }
    }
    return {
        ...sock,
        sendMessageAck,
        sendRetryRequest,
        rejectCall,
        fetchMessageHistory,
        requestPlaceholderResend,
        messageRetryManager
    };
};
exports.makeMessagesRecvSocket = makeMessagesRecvSocket;

return module.exports;
})();
for (const key of Object.keys(__kageModule135)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule135[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule135, configurable:true});
