"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeMessagesSocket = void 0;
const boom_1 = require("@hapi/boom");
const node_cache_1 = __importDefault(require("@cacheable/node-cache"));
const crypto_1 = require("crypto");
const WAProto_1 = require("../../WAProto");
const Defaults_1 = require("../Defaults");
const Utils_1 = require("../Utils");
const link_preview_1 = require("../Utils/link-preview");
const WABinary_1 = require("../WABinary");
const WAUSync_1 = require("../WAUSync");
const newsletter_1 = require("./newsletter");
const makeMessagesSocket = (config) => {
    const { logger, linkPreviewImageThumbnailWidth, generateHighQualityLinkPreview, options: axiosOptions, patchMessageBeforeSending, cachedGroupMetadata, albumMessageItemDelayMs = 0, } = config;
    const sock = (0, newsletter_1.makeNewsletterSocket)(config);
    const { ev, authState, processingMutex, signalRepository, upsertMessage, query, fetchPrivacySettings, sendNode, groupMetadata, groupToggleEphemeral, } = sock;
    const userDevicesCache = config.userDevicesCache || new node_cache_1.default({
        stdTTL: Defaults_1.DEFAULT_CACHE_TTLS.USER_DEVICES, // 5 minutes
        useClones: false
    });
    let mediaConn;
    const refreshMediaConn = async (forceGet = false) => {
        const media = await mediaConn;
        if (!media || forceGet || (new Date().getTime() - media.fetchDate.getTime()) > media.ttl * 1000) {
            mediaConn = (async () => {
                const result = await query({
                    tag: 'iq',
                    attrs: {
                        type: 'set',
                        xmlns: 'w:m',
                        to: WABinary_1.S_WHATSAPP_NET,
                    },
                    content: [{ tag: 'media_conn', attrs: {} }]
                });
                const mediaConnNode = (0, WABinary_1.getBinaryNodeChild)(result, 'media_conn');
                const node = {
                    hosts: (0, WABinary_1.getBinaryNodeChildren)(mediaConnNode, 'host').map(({ attrs }) => ({
                        hostname: attrs.hostname,
                        maxContentLengthBytes: +attrs.maxContentLengthBytes,
                    })),
                    auth: mediaConnNode.attrs.auth,
                    ttl: +mediaConnNode.attrs.ttl,
                    fetchDate: new Date()
                };
                logger.debug('fetched media conn');
                return node;
            })();
        }
        return mediaConn;
    };
    /**
     * generic send receipt function
     * used for receipts of phone call, read, delivery etc.
     * */
    const sendReceipt = async (jid, participant, messageIds, type) => {
        const node = {
            tag: 'receipt',
            attrs: {
                id: messageIds[0],
            },
        };
        const isReadReceipt = type === 'read' || type === 'read-self';
        if (isReadReceipt) {
            node.attrs.t = (0, Utils_1.unixTimestampSeconds)().toString();
        }
        if (type === 'sender' && (0, WABinary_1.isJidUser)(jid)) {
            node.attrs.recipient = jid;
            node.attrs.to = participant;
        }
        else {
            node.attrs.to = jid;
            if (participant) {
                node.attrs.participant = participant;
            }
        }
        if (type) {
            node.attrs.type = (0, WABinary_1.isJidNewsletter)(jid) ? 'read-self' : type;
        }
        const remainingMessageIds = messageIds.slice(1);
        if (remainingMessageIds.length) {
            node.content = [
                {
                    tag: 'list',
                    attrs: {},
                    content: remainingMessageIds.map(id => ({
                        tag: 'item',
                        attrs: { id }
                    }))
                }
            ];
        }
        logger.debug({ attrs: node.attrs, messageIds }, 'sending receipt for messages');
        await sendNode(node);
    };
    /** Correctly bulk send receipts to multiple chats, participants */
    const sendReceipts = async (keys, type) => {
        const recps = (0, Utils_1.aggregateMessageKeysNotFromMe)(keys);
        for (const { jid, participant, messageIds } of recps) {
            await sendReceipt(jid, participant, messageIds, type);
        }
    };
    /** Bulk read messages. Keys can be from different chats & participants */
    const readMessages = async (keys) => {
        const privacySettings = await fetchPrivacySettings();
        // based on privacy settings, we have to change the read type
        const readType = privacySettings.readreceipts === 'all' ? 'read' : 'read-self';
        await sendReceipts(keys, readType);
    };
    /** Fetch all the devices we've to send a message to */
    const getUSyncDevices = async (jids, useCache, ignoreZeroDevices) => {
        var _a;
        const deviceResults = [];
        if (!useCache) {
            logger.debug('not using cache for devices');
        }
        const toFetch = [];
        jids = Array.from(new Set(jids));
        for (let jid of jids) {
            const user = (_a = (0, WABinary_1.jidDecode)(jid)) === null || _a === void 0 ? void 0 : _a.user;
            jid = (0, WABinary_1.jidNormalizedUser)(jid);
            if (useCache) {
                const devices = userDevicesCache.get(user);
                if (devices) {
                    deviceResults.push(...devices);
                    logger.trace({ user }, 'using cache for devices');
                }
                else {
                    toFetch.push(jid);
                }
            }
            else {
                toFetch.push(jid);
            }
        }
        if (!toFetch.length) {
            return deviceResults;
        }
        const query = new WAUSync_1.USyncQuery()
            .withContext('message')
            .withDeviceProtocol();
        for (const jid of toFetch) {
            query.withUser(new WAUSync_1.USyncUser().withId(jid));
        }
        const result = await sock.executeUSyncQuery(query);
        if (result) {
            const extracted = (0, Utils_1.extractDeviceJids)(result === null || result === void 0 ? void 0 : result.list, authState.creds.me.id, ignoreZeroDevices);
            const deviceMap = {};
            for (const item of extracted) {
                deviceMap[item.user] = deviceMap[item.user] || [];
                deviceMap[item.user].push(item);
                deviceResults.push(item);
            }
            for (const key in deviceMap) {
                userDevicesCache.set(key, deviceMap[key]);
            }
        }
        return deviceResults;
    };
    const assertSessions = async (jids, force) => {
        let didFetchNewSession = false;
        let jidsRequiringFetch = [];
        if (force) {
            jidsRequiringFetch = jids;
        }
        else {
            const addrs = jids.map(jid => (signalRepository
                .jidToSignalProtocolAddress(jid)));
            const sessions = await authState.keys.get('session', addrs);
            for (const jid of jids) {
                const signalId = signalRepository
                    .jidToSignalProtocolAddress(jid);
                if (!sessions[signalId]) {
                    jidsRequiringFetch.push(jid);
                }
            }
        }
        if (jidsRequiringFetch.length) {
            logger.debug({ jidsRequiringFetch }, 'fetching sessions');
            const result = await query({
                tag: 'iq',
                attrs: {
                    xmlns: 'encrypt',
                    type: 'get',
                    to: WABinary_1.S_WHATSAPP_NET,
                },
                content: [
                    {
                        tag: 'key',
                        attrs: {},
                        content: jidsRequiringFetch.map(jid => ({
                            tag: 'user',
                            attrs: { jid },
                        }))
                    }
                ]
            });
            await (0, Utils_1.parseAndInjectE2ESessions)(result, signalRepository);
            didFetchNewSession = true;
        }
        return didFetchNewSession;
    };
    const sendPeerDataOperationMessage = async (pdoMessage) => {
        var _a;
        //TODO: for later, abstract the logic to send a Peer Message instead of just PDO - useful for App State Key Resync with phone
        if (!((_a = authState.creds.me) === null || _a === void 0 ? void 0 : _a.id)) {
            throw new boom_1.Boom('Not authenticated');
        }
        const protocolMessage = {
            protocolMessage: {
                peerDataOperationRequestMessage: pdoMessage,
                type: WAProto_1.proto.Message.ProtocolMessage.Type.PEER_DATA_OPERATION_REQUEST_MESSAGE
            }
        };
        const meJid = (0, WABinary_1.jidNormalizedUser)(authState.creds.me.id);
        const msgId = await relayMessage(meJid, protocolMessage, {
            additionalAttributes: {
                category: 'peer',
                // eslint-disable-next-line camelcase
                push_priority: 'high_force',
            },
        });
        return msgId;
    };
    const createParticipantNodes = async (jids, message, extraAttrs) => {
        let patched = await patchMessageBeforeSending(message, jids);
        if (!Array.isArray(patched)) {
            patched = jids ? jids.map(jid => ({ recipientJid: jid, ...patched })) : [patched];
        }
        let shouldIncludeDeviceIdentity = false;
        const nodes = await Promise.all(patched.map(async (patchedMessageWithJid) => {
            const { recipientJid: jid, ...patchedMessage } = patchedMessageWithJid;
            if (!jid) {
                return {};
            }
            const bytes = (0, Utils_1.encodeWAMessage)(patchedMessage);
            const { type, ciphertext } = await signalRepository
                .encryptMessage({ jid, data: bytes });
            if (type === 'pkmsg') {
                shouldIncludeDeviceIdentity = true;
            }
            const node = {
                tag: 'to',
                attrs: { jid },
                content: [{
                        tag: 'enc',
                        attrs: {
                            v: '2',
                            type,
                            ...extraAttrs || {}
                        },
                        content: ciphertext
                    }]
            };
            return node;
        }));
        return { nodes, shouldIncludeDeviceIdentity };
    };
    const relayMessage = async (jid, message, { messageId: msgId, participant, additionalAttributes, additionalNodes, useUserDevicesCache, useCachedGroupMetadata, statusJidList } = {}) => {
        // Prepare raw relay events too, not only sendMessage({ event }).
        message = require('../Utils/event-message').prepareEventMessage(message);
        if (typeof jid !== 'string' || !(0, WABinary_1.jidDecode)(jid)) {
            throw new TypeError('relayMessage requires a valid WhatsApp JID');
        }
        var _a;
        const meId = authState.creds.me.id;
        let shouldIncludeDeviceIdentity = false;
        const { user, server } = (0, WABinary_1.jidDecode)(jid);
        const statusJid = 'status@broadcast';
        const isGroup = server === 'g.us';
        const isNewsletter = server === 'newsletter';
        const isStatus = jid === statusJid;
        const isLid = server === 'lid';
        msgId = msgId || (0, Utils_1.generateMessageIDV2)((_a = sock.user) === null || _a === void 0 ? void 0 : _a.id);
        useUserDevicesCache = useUserDevicesCache !== false;
        useCachedGroupMetadata = useCachedGroupMetadata !== false && !isStatus;
        const participants = [];
        const destinationJid = (!isStatus) ? (0, WABinary_1.jidEncode)(user, isLid ? 'lid' : isGroup ? 'g.us' : isNewsletter ? 'newsletter' : 's.whatsapp.net') : statusJid;
        const binaryNodeContent = [];
        const devices = [];
        const meMsg = {
            deviceSentMessage: {
                destinationJid,
                message
            },
            messageContextInfo: message.messageContextInfo
        };
        const extraAttrs = {};
        if (participant) {
            // when the retry request is not for a group
            // only send to the specific device that asked for a retry
            // otherwise the message is sent out to every device that should be a recipient
            if (!isGroup && !isStatus) {
                additionalAttributes = { ...additionalAttributes, 'device_fanout': 'false' };
            }
            const { user, device } = (0, WABinary_1.jidDecode)(participant.jid);
            devices.push({ user, device });
        }
        await authState.keys.transaction(async () => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w;
            const mediaType = getMediaType(message);
            if (mediaType) {
                extraAttrs['mediatype'] = mediaType;
            }
            if ((_a = (0, Utils_1.normalizeMessageContent)(message)) === null || _a === void 0 ? void 0 : _a.pinInChatMessage) {
                extraAttrs['decrypt-fail'] = 'hide';
            }
            if (isGroup || isStatus) {
                const [groupData, senderKeyMap] = await Promise.all([
                    (async () => {
                        let groupData = useCachedGroupMetadata && cachedGroupMetadata ? await cachedGroupMetadata(jid) : undefined;
                        if (groupData && Array.isArray(groupData === null || groupData === void 0 ? void 0 : groupData.participants)) {
                            logger.trace({ jid, participants: groupData.participants.length }, 'using cached group metadata');
                        }
                        else if (!isStatus) {
                            groupData = await groupMetadata(jid);
                        }
                        return groupData;
                    })(),
                    (async () => {
                        if (!participant && !isStatus) {
                            const result = await authState.keys.get('sender-key-memory', [jid]);
                            return result[jid] || {};
                        }
                        return {};
                    })()
                ]);
                if (!participant) {
                    const participantsList = (groupData && !isStatus) ? groupData.participants.map(p => p.id) : [];
                    if (isStatus && statusJidList) {
                        participantsList.push(...statusJidList);
                    }
                    if (!isStatus) {
                        additionalAttributes = {
                            ...additionalAttributes,
                            // eslint-disable-next-line camelcase
                            addressing_mode: (groupData === null || groupData === void 0 ? void 0 : groupData.addressingMode) || 'pn'
                        };
                    }
                    const additionalDevices = await getUSyncDevices(participantsList, !!useUserDevicesCache, false);
                    devices.push(...additionalDevices);
                }
                const patched = await patchMessageBeforeSending(message);
                if (Array.isArray(patched)) {
                    throw new boom_1.Boom('Per-jid patching is not supported in groups');
                }
                const bytes = (0, Utils_1.encodeWAMessage)(patched);
                const { ciphertext, senderKeyDistributionMessage } = await signalRepository.encryptGroupMessage({
                    group: destinationJid,
                    data: bytes,
                    meId,
                });
                const senderKeyJids = [];
                // ensure a connection is established with every device
                for (const { user, device } of devices) {
                    const jid = (0, WABinary_1.jidEncode)(user, (groupData === null || groupData === void 0 ? void 0 : groupData.addressingMode) === 'lid' ? 'lid' : 's.whatsapp.net', device);
                    if (!senderKeyMap[jid] || !!participant) {
                        senderKeyJids.push(jid);
                        // store that this person has had the sender keys sent to them
                        senderKeyMap[jid] = true;
                    }
                }
                // if there are some participants with whom the session has not been established
                // if there are, we re-send the senderkey
                if (senderKeyJids.length) {
                    logger.debug({ senderKeyJids }, 'sending new sender key');
                    const senderKeyMsg = {
                        senderKeyDistributionMessage: {
                            axolotlSenderKeyDistributionMessage: senderKeyDistributionMessage,
                            groupId: destinationJid
                        }
                    };
                    await assertSessions(senderKeyJids, false);
                    const result = await createParticipantNodes(senderKeyJids, senderKeyMsg, extraAttrs);
                    shouldIncludeDeviceIdentity = shouldIncludeDeviceIdentity || result.shouldIncludeDeviceIdentity;
                    participants.push(...result.nodes);
                }
                binaryNodeContent.push({
                    tag: 'enc',
                    attrs: { v: '2', type: 'skmsg' },
                    content: ciphertext
                });
                await authState.keys.set({ 'sender-key-memory': { [jid]: senderKeyMap } });
            }
            else if (isNewsletter) {
                // Message edit
                if ((_b = message.protocolMessage) === null || _b === void 0 ? void 0 : _b.editedMessage) {
                    msgId = (_c = message.protocolMessage.key) === null || _c === void 0 ? void 0 : _c.id;
                    message = message.protocolMessage.editedMessage;
                }
                // Message delete
                if (((_d = message.protocolMessage) === null || _d === void 0 ? void 0 : _d.type) === WAProto_1.proto.Message.ProtocolMessage.Type.REVOKE) {
                    msgId = (_e = message.protocolMessage.key) === null || _e === void 0 ? void 0 : _e.id;
                    message = {};
                }
                const patched = await patchMessageBeforeSending(message, []);
                if (Array.isArray(patched)) {
                    throw new boom_1.Boom('Per-jid patching is not supported in channel');
                }
                const bytes = (0, Utils_1.encodeNewsletterMessage)(patched);
                binaryNodeContent.push({
                    tag: 'plaintext',
                    attrs: mediaType ? { mediatype: mediaType } : {},
                    content: bytes
                });
            }
            else {
                const { user: meUser } = (0, WABinary_1.jidDecode)(meId);
                if (!participant) {
                    devices.push({ user });
                    if (user !== meUser) {
                        devices.push({ user: meUser });
                    }
                    if ((additionalAttributes === null || additionalAttributes === void 0 ? void 0 : additionalAttributes['category']) !== 'peer') {
                        const additionalDevices = await getUSyncDevices([meId, jid], !!useUserDevicesCache, true);
                        devices.push(...additionalDevices);
                    }
                }
                const allJids = [];
                const meJids = [];
                const otherJids = [];
                for (const { user, device } of devices) {
                    const isMe = user === meUser;
                    const jid = (0, WABinary_1.jidEncode)(isMe && isLid ? ((_g = (_f = authState.creds) === null || _f === void 0 ? void 0 : _f.me) === null || _g === void 0 ? void 0 : _g.lid.split(':')[0]) || user : user, isLid ? 'lid' : 's.whatsapp.net', device);
                    if (isMe) {
                        meJids.push(jid);
                    }
                    else {
                        otherJids.push(jid);
                    }
                    allJids.push(jid);
                }
                await assertSessions(allJids, false);
                const [{ nodes: meNodes, shouldIncludeDeviceIdentity: s1 }, { nodes: otherNodes, shouldIncludeDeviceIdentity: s2 }] = await Promise.all([
                    createParticipantNodes(meJids, meMsg, extraAttrs),
                    createParticipantNodes(otherJids, message, extraAttrs)
                ]);
                participants.push(...meNodes);
                participants.push(...otherNodes);
                shouldIncludeDeviceIdentity = shouldIncludeDeviceIdentity || s1 || s2;
            }
            if (participants.length) {
                if ((additionalAttributes === null || additionalAttributes === void 0 ? void 0 : additionalAttributes['category']) === 'peer') {
                    const peerNode = (_j = (_h = participants[0]) === null || _h === void 0 ? void 0 : _h.content) === null || _j === void 0 ? void 0 : _j[0];
                    if (peerNode) {
                        binaryNodeContent.push(peerNode); // push only enc
                    }
                }
                else {
                    binaryNodeContent.push({
                        tag: 'participants',
                        attrs: {},
                        content: participants
                    });
                }
            }
            const stanza = {
                tag: 'message',
                attrs: {
                    id: msgId,
                    type: isNewsletter ? getTypeMessage(message) : 'text',
                    ...(additionalAttributes || {})
                },
                content: binaryNodeContent
            };
            // if the participant to send to is explicitly specified (generally retry recp)
            // ensure the message is only sent to that person
            // if a retry receipt is sent to everyone -- it'll fail decryption for everyone else who received the msg
            if (participant) {
                if ((0, WABinary_1.isJidGroup)(destinationJid)) {
                    stanza.attrs.to = destinationJid;
                    stanza.attrs.participant = participant.jid;
                }
                else if ((0, WABinary_1.areJidsSameUser)(participant.jid, meId)) {
                    stanza.attrs.to = participant.jid;
                    stanza.attrs.recipient = destinationJid;
                }
                else {
                    stanza.attrs.to = participant.jid;
                }
            }
            else {
                stanza.attrs.to = destinationJid;
            }
            if (shouldIncludeDeviceIdentity) {
                stanza.content.push({
                    tag: 'device-identity',
                    attrs: {},
                    content: (0, Utils_1.encodeSignedDeviceIdentity)(authState.creds.account, true)
                });
                logger.debug({ jid }, 'adding device identity');
            }
            if (additionalNodes && additionalNodes.length > 0) {
                stanza.content.push(...additionalNodes);
            }
            const content = (0, Utils_1.normalizeMessageContent)(message);
            const contentType = (0, Utils_1.getContentType)(content);
            if (((0, WABinary_1.isJidGroup)(jid) || (0, WABinary_1.isJidUser)(jid)) && (contentType === 'interactiveMessage' ||
                contentType === 'buttonsMessage' ||
                contentType === 'listMessage')) {
                const bizNode = { tag: 'biz', attrs: {} };
                if ((((_l = (_k = message === null || message === void 0 ? void 0 : message.viewOnceMessage) === null || _k === void 0 ? void 0 : _k.message) === null || _l === void 0 ? void 0 : _l.interactiveMessage) || ((_o = (_m = message === null || message === void 0 ? void 0 : message.viewOnceMessageV2) === null || _m === void 0 ? void 0 : _m.message) === null || _o === void 0 ? void 0 : _o.interactiveMessage) || ((_q = (_p = message === null || message === void 0 ? void 0 : message.viewOnceMessageV2Extension) === null || _p === void 0 ? void 0 : _p.message) === null || _q === void 0 ? void 0 : _q.interactiveMessage) || (message === null || message === void 0 ? void 0 : message.interactiveMessage)) || (((_s = (_r = message === null || message === void 0 ? void 0 : message.viewOnceMessage) === null || _r === void 0 ? void 0 : _r.message) === null || _s === void 0 ? void 0 : _s.buttonsMessage) || ((_u = (_t = message === null || message === void 0 ? void 0 : message.viewOnceMessageV2) === null || _t === void 0 ? void 0 : _t.message) === null || _u === void 0 ? void 0 : _u.buttonsMessage) || ((_w = (_v = message === null || message === void 0 ? void 0 : message.viewOnceMessageV2Extension) === null || _v === void 0 ? void 0 : _v.message) === null || _w === void 0 ? void 0 : _w.buttonsMessage) || (message === null || message === void 0 ? void 0 : message.buttonsMessage))) {
                    bizNode.content = [{
                            tag: 'interactive',
                            attrs: {
                                type: 'native_flow',
                                v: '1'
                            },
                            content: [{
                                    tag: 'native_flow',
                                    attrs: { v: '9', name: 'mixed' }
                                }]
                        }];
                }
                else if (message === null || message === void 0 ? void 0 : message.listMessage) {
                    // list message only support in private chat
                    bizNode.content = [{
                            tag: 'list',
                            attrs: {
                                type: 'product_list',
                                v: '2'
                            }
                        }];
                }
                stanza.content.push(bizNode);
            }
            logger.debug({ msgId }, `sending message to ${participants.length} devices`);
            await sendNode(stanza);
        });
        return msgId;
    };
    const getTypeMessage = (msg) => {
        if (msg.viewOnceMessage) {
            return getTypeMessage(msg.viewOnceMessage.message);
        }
        else if (msg.viewOnceMessageV2) {
            return getTypeMessage(msg.viewOnceMessageV2.message);
        }
        else if (msg.viewOnceMessageV2Extension) {
            return getTypeMessage(msg.viewOnceMessageV2Extension.message);
        }
        else if (msg.ephemeralMessage) {
            return getTypeMessage(msg.ephemeralMessage.message);
        }
        else if (msg.documentWithCaptionMessage) {
            return getTypeMessage(msg.documentWithCaptionMessage.message);
        }
        else if (msg.reactionMessage) {
            return 'reaction';
        }
        else if (msg.pollCreationMessage || msg.pollCreationMessageV2 || msg.pollCreationMessageV3 || msg.pollUpdateMessage) {
            return 'poll';
        }
        else if (getMediaType(msg)) {
            return 'media';
        }
        else {
            return 'text';
        }
    };
    const getMediaType = (message) => {
        if (message.imageMessage) {
            return 'image';
        }
        else if (message.videoMessage) {
            return message.videoMessage.gifPlayback ? 'gif' : 'video';
        }
        else if (message.audioMessage) {
            return message.audioMessage.ptt ? 'ptt' : 'audio';
        }
        else if (message.contactMessage) {
            return 'vcard';
        }
        else if (message.documentMessage) {
            return 'document';
        }
        else if (message.contactsArrayMessage) {
            return 'contact_array';
        }
        else if (message.liveLocationMessage) {
            return 'livelocation';
        }
        else if (message.stickerMessage) {
            return 'sticker';
        }
        else if (message.listMessage) {
            return 'list';
        }
        else if (message.listResponseMessage) {
            return 'list_response';
        }
        else if (message.buttonsResponseMessage) {
            return 'buttons_response';
        }
        else if (message.orderMessage) {
            return 'order';
        }
        else if (message.productMessage) {
            return 'product';
        }
        else if (message.interactiveResponseMessage) {
            return 'native_flow_response';
        }
        else if (message.groupInviteMessage) {
            return 'url';
        }
    };
    const getPrivacyTokens = async (jids) => {
        const t = (0, Utils_1.unixTimestampSeconds)().toString();
        const result = await query({
            tag: 'iq',
            attrs: {
                to: WABinary_1.S_WHATSAPP_NET,
                type: 'set',
                xmlns: 'privacy'
            },
            content: [
                {
                    tag: 'tokens',
                    attrs: {},
                    content: jids.map(jid => ({
                        tag: 'token',
                        attrs: {
                            jid: (0, WABinary_1.jidNormalizedUser)(jid),
                            t,
                            type: 'trusted_contact'
                        }
                    }))
                }
            ]
        });
        return result;
    };
    const waUploadToServer = (0, Utils_1.getWAUploadToServer)(config, refreshMediaConn);
    const waitForMsgMediaUpdate = (0, Utils_1.bindWaitForEvent)(ev, 'messages.media-update');
    return {
        ...sock,
        getPrivacyTokens,
        assertSessions,
        relayMessage,
        sendReceipt,
        sendReceipts,
        readMessages,
        refreshMediaConn,
        waUploadToServer,
        fetchPrivacySettings,
        getUSyncDevices,
        createParticipantNodes,
        sendPeerDataOperationMessage,
        updateMediaMessage: async (message) => {
            const content = (0, Utils_1.assertMediaContent)(message.message);
            const mediaKey = content.mediaKey;
            const meId = authState.creds.me.id;
            const node = await (0, Utils_1.encryptMediaRetryRequest)(message.key, mediaKey, meId);
            let error = undefined;
            await Promise.all([
                sendNode(node),
                waitForMsgMediaUpdate(async (update) => {
                    const result = update.find(c => c.key.id === message.key.id);
                    if (result) {
                        if (result.error) {
                            error = result.error;
                        }
                        else {
                            try {
                                const media = await (0, Utils_1.decryptMediaRetryData)(result.media, mediaKey, result.key.id);
                                if (media.result !== WAProto_1.proto.MediaRetryNotification.ResultType.SUCCESS) {
                                    const resultStr = WAProto_1.proto.MediaRetryNotification.ResultType[media.result];
                                    throw new boom_1.Boom(`Media re-upload failed by device (${resultStr})`, { data: media, statusCode: (0, Utils_1.getStatusCodeForMediaRetry)(media.result) || 404 });
                                }
                                content.directPath = media.directPath;
                                content.url = (0, Utils_1.getUrlFromDirectPath)(content.directPath);
                                logger.debug({ directPath: media.directPath, key: result.key }, 'media update successful');
                            }
                            catch (err) {
                                error = err;
                            }
                        }
                        return true;
                    }
                })
            ]);
            if (error) {
                throw error;
            }
            ev.emit('messages.update', [
                { key: message.key, update: { message: message.message } }
            ]);
            return message;
        },
        sendMessage: async (jid, content, options = {}) => {
            var _a, _b, _c;
            const userJid = authState.creds.me.id;
            if (!options.ephemeralExpiration) {
                if ((0, WABinary_1.isJidGroup)(jid)) {
                    const groups = await sock.groupQuery(jid, 'get', [{
                            tag: 'query',
                            attrs: {
                                request: 'interactive'
                            }
                        }]);
                    const metadata = (0, WABinary_1.getBinaryNodeChild)(groups, 'group');
                    const expiration = ((_b = (_a = (0, WABinary_1.getBinaryNodeChild)(metadata, 'ephemeral')) === null || _a === void 0 ? void 0 : _a.attrs) === null || _b === void 0 ? void 0 : _b.expiration) || 0;
                    options.ephemeralExpiration = expiration;
                }
            }
            if (typeof content === 'object' &&
                'disappearingMessagesInChat' in content &&
                typeof content['disappearingMessagesInChat'] !== 'undefined' &&
                (0, WABinary_1.isJidGroup)(jid)) {
                const { disappearingMessagesInChat } = content;
                const value = typeof disappearingMessagesInChat === 'boolean' ?
                    (disappearingMessagesInChat ? Defaults_1.WA_DEFAULT_EPHEMERAL : 0) :
                    disappearingMessagesInChat;
                await groupToggleEphemeral(jid, value);
            }
            if (typeof content === 'object' && 'album' in content && content.album) {
                const { album, caption } = content;
                if (caption && !album[0].caption) {
                    album[0].caption = caption;
                }
                let mediaHandle;
                let mediaMsg;
                const albumMsg = (0, Utils_1.generateWAMessageFromContent)(jid, {
                    albumMessage: {
                        expectedImageCount: album.filter(item => 'image' in item).length,
                        expectedVideoCount: album.filter(item => 'video' in item).length
                    }
                }, { userJid, ...options });
                await relayMessage(jid, albumMsg.message, {
                    messageId: albumMsg.key.id
                });
                for (const i in album) {
                    const media = album[i];
                    if ('image' in media) {
                        mediaMsg = await (0, Utils_1.generateWAMessage)(jid, {
                            image: media.image,
                            ...(media.caption ? { caption: media.caption } : {}),
                            ...options
                        }, {
                            userJid,
                            upload: async (readStream, opts) => {
                                const up = await waUploadToServer(readStream, { ...opts, newsletter: (0, WABinary_1.isJidNewsletter)(jid) });
                                mediaHandle = up.handle;
                                return up;
                            },
                            ...options,
                        });
                    }
                    else if ('video' in media) {
                        mediaMsg = await (0, Utils_1.generateWAMessage)(jid, {
                            video: media.video,
                            ...(media.caption ? { caption: media.caption } : {}),
                            ...(media.gifPlayback !== undefined ? { gifPlayback: media.gifPlayback } : {}),
                            ...options
                        }, {
                            userJid,
                            upload: async (readStream, opts) => {
                                const up = await waUploadToServer(readStream, { ...opts, newsletter: (0, WABinary_1.isJidNewsletter)(jid) });
                                mediaHandle = up.handle;
                                return up;
                            },
                            ...options,
                        });
                    }
                    if (mediaMsg) {
                        mediaMsg.message.messageContextInfo = {
                            messageSecret: (0, crypto_1.randomBytes)(32),
                            messageAssociation: {
                                associationType: 1,
                                parentMessageKey: albumMsg.key
                            }
                        };
                    }
                    await relayMessage(jid, mediaMsg.message, {
                        messageId: mediaMsg.key.id
                    });
                    if (albumMessageItemDelayMs > 0) {
                        await new Promise(resolve => setTimeout(resolve, albumMessageItemDelayMs));
                    }
                }
                return albumMsg;
            }
            else {
                let mediaHandle;
                const fullMsg = await (0, Utils_1.generateWAMessage)(jid, content, {
                    logger,
                    userJid,
                    getUrlInfo: text => (0, link_preview_1.getUrlInfo)(text, {
                        thumbnailWidth: linkPreviewImageThumbnailWidth,
                        fetchOpts: {
                            timeout: 3000,
                            ...axiosOptions || {}
                        },
                        logger,
                        uploadImage: generateHighQualityLinkPreview
                            ? waUploadToServer
                            : undefined
                    }),
                    getProfilePicUrl: sock.profilePictureUrl,
                    upload: async (readStream, opts) => {
                        const up = await waUploadToServer(readStream, { ...opts, newsletter: (0, WABinary_1.isJidNewsletter)(jid) });
                        mediaHandle = up.handle;
                        return up;
                    },
                    mediaCache: config.mediaCache,
                    options: config.options,
                    messageId: (0, Utils_1.generateMessageIDV2)((_c = sock.user) === null || _c === void 0 ? void 0 : _c.id),
                    ...options,
                });
                const isDeleteMsg = 'delete' in content && !!content.delete;
                const isEditMsg = 'edit' in content && !!content.edit;
                const isPinMsg = 'pin' in content && !!content.pin;
                const isKeepMsg = 'keep' in content && content.keep;
                const isPollMessage = 'poll' in content && !!content.poll;
                const isAiMsg = 'ai' in content && !!content.ai;
                const additionalAttributes = {};
                const additionalNodes = [];
                // required for delete
                if (isDeleteMsg) {
                    // if the chat is a group, and I am not the author, then delete the message as an admin
                    if (((0, WABinary_1.isJidGroup)(content.delete.remoteJid) && !content.delete.fromMe) || (0, WABinary_1.isJidNewsletter)(jid)) {
                        additionalAttributes.edit = '8';
                    }
                    else {
                        additionalAttributes.edit = '7';
                    }
                    // required for edit message
                }
                else if (isEditMsg) {
                    additionalAttributes.edit = (0, WABinary_1.isJidNewsletter)(jid) ? '3' : '1';
                    // required for pin message
                }
                else if (isPinMsg) {
                    additionalAttributes.edit = '2';
                    // required for keep message
                }
                else if (isKeepMsg) {
                    additionalAttributes.edit = '6';
                    // required for polling message
                }
                else if (isPollMessage) {
                    additionalNodes.push({
                        tag: 'meta',
                        attrs: {
                            polltype: 'creation'
                        },
                    });
                    // required to display AI icon on message
                }
                else if (isAiMsg) {
                    additionalNodes.push({
                        attrs: {
                            biz_bot: '1'
                        },
                        tag: "bot"
                    });
                }
                if (mediaHandle) {
                    additionalAttributes['media_id'] = mediaHandle;
                }
                if ('cachedGroupMetadata' in options) {
                    console.warn('cachedGroupMetadata in sendMessage are deprecated, now cachedGroupMetadata is part of the socket config.');
                }
                await relayMessage(jid, fullMsg.message, { messageId: fullMsg.key.id, useCachedGroupMetadata: options.useCachedGroupMetadata, additionalAttributes, additionalNodes: isAiMsg ? additionalNodes : options.additionalNodes, statusJidList: options.statusJidList });
                if (config.emitOwnEvents) {
                    process.nextTick(() => {
                        processingMutex.mutex(() => (upsertMessage(fullMsg, 'append')));
                    });
                }
                return fullMsg;
            }
        }
    };
};
exports.makeMessagesSocket = makeMessagesSocket;

// Kage: compatibilidad de API.
const __kageModule30 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { default: NodeCache } = require("@cacheable/node-cache")
const { Boom } = require("@hapi/boom")
const { randomBytes } = require("crypto")
const { proto } = require("../../WAProto")
const {
  DEFAULT_CACHE_TTLS, 
  WA_DEFAULT_EPHEMERAL
} = require("../Defaults/constants")
const { 
  delay, 
  assertMediaContent, 
  bindWaitForEvent, 
  decryptMediaRetryData, 
  encodeNewsletterMessage, 
  encodeSignedDeviceIdentity, 
  encodeWAMessage, 
  encryptMediaRetryRequest,
  extractDeviceJids, 
  generateMessageID, 
  generateParticipantHashV2,
  generateWAMessage, 
  generateWAMessageFromContent, 
  getStatusCodeForMediaRetry, 
  getUrlFromDirectPath, 
  getWAUploadToServer, 
  MessageRetryManager, 
  normalizeMessageContent, 
  parseAndInjectE2ESessions, 
  unixTimestampSeconds,  
  prepareAlbumMessageContent, 
  aggregateMessageKeysNotFromMe
} = require("../Utils")
const { WAMessageAddressingMode } = require("../Types")
const { 
  areJidsSameUser, 
  getBinaryNodeChild, 
  getBinaryNodeChildren, 
  getBinaryFilteredBizBot, 
  getBinaryFilteredButtons, 
  isHostedLidUser, 
  isHostedPnUser, 
  isJidNewsletter, 
  isJidGroup,
  isLidUser, 
  isPnUser, 
  jidDecode,  
  jidEncode, 
  jidNormalizedUser,
  STORIES_JID, 
  S_WHATSAPP_NET 
} = require("../WABinary")
const {
  USyncUser, 
  USyncQuery
} = require("../WAUSync") 
const { makeNewsletterSocket } = require("./newsletter")
const { getUrlInfo } = require("../Utils/link-preview")
const { makeKeyedMutex } = require("../Utils/make-mutex") 

const makeMessagesSocket = (config) => {
    const { 
        logger,
        linkPreviewImageThumbnailWidth, 
        generateHighQualityLinkPreview,
        options: httpRequestOptions, 
        patchMessageBeforeSending,
        cachedGroupMetadata, 
        enableRecentMessageCache, 
        maxMsgRetryCount 
    } = config
	
    const suki = makeNewsletterSocket(config)
    
    const { 
        ev, 
        authState, 
        messageMutex, 
        signalRepository, 
        upsertMessage, 
        createCallLink, 
        query, 
        fetchPrivacySettings, 
        sendNode, 
        groupQuery, 
        groupMetadata, 
        groupToggleEphemeral, 
        executeUSyncQuery, 
        newsletterMetadata
    } = suki   

    const userDevicesCache = config.userDevicesCache || new NodeCache({
        stdTTL: DEFAULT_CACHE_TTLS.USER_DEVICES,
        useClones: false
    })
    
    const peerSessionsCache = new NodeCache({
        stdTTL: DEFAULT_CACHE_TTLS.USER_DEVICES,
        useClones: false
    })
    
    // Initialize message retry manager if enabled
    const messageRetryManager = enableRecentMessageCache ? new MessageRetryManager(logger, maxMsgRetryCount) : null
    
    // Prevent race conditions in Signal session encryption by user
    const encryptionMutex = makeKeyedMutex()

    let mediaConn

    const refreshMediaConn = async (forceGet = false) => {
        const media = await mediaConn
        
        if (!media || forceGet || new Date().getTime() - media.fetchDate.getTime() > media.ttl * 1000) {
            mediaConn = (async () => {
                const result = await query({
                    tag: 'iq',
                    attrs: {
                        type: 'set',
                        xmlns: 'w:m',
                        to: S_WHATSAPP_NET
                    },
                    content: [{ tag: 'media_conn', attrs: {} }]
                })
                
                const mediaConnNode = getBinaryNodeChild(result, 'media_conn')
                
                // TODO: explore full length of data that whatsapp provides
                const node = {
                    hosts: getBinaryNodeChildren(mediaConnNode, 'host').map(({ attrs }) => ({
                        hostname: attrs.hostname,
                        maxContentLengthBytes: +attrs.maxContentLengthBytes
                    })),
                    auth: mediaConnNode.attrs.auth,
                    ttl: +mediaConnNode.attrs.ttl,
                    fetchDate: new Date()
                }
                
                logger.debug('fetched media conn')
                
                return node
            })()
        }
        
        return mediaConn
    }

    /**
     * generic send receipt function
     * used for receipts of phone call, read, delivery etc.
     * */
    const sendReceipt = async (jid, participant, messageIds, type) => {
        if (!messageIds || messageIds.length === 0) {
            throw new Boom('missing ids in receipt')
        }
        
        const node = {
            tag: 'receipt',
            attrs: {
                id: messageIds[0]
            }
        }
        
        const isReadReceipt = type === 'read' || type === 'read-self'
        
        if (isReadReceipt) {
            node.attrs.t = unixTimestampSeconds().toString()
        }
        
        if (type === 'sender' && (isPnUser(jid) || isLidUser(jid))) {
            node.attrs.recipient = jid
            node.attrs.to = participant
        }
        
        else {
            node.attrs.to = jid
            
            if (participant) {
                node.attrs.participant = participant
            }
        }
        
        if (type) {
            node.attrs.type = type
        }
        
        const remainingMessageIds = messageIds.slice(1)
        
        if (remainingMessageIds.length) {
            node.content = [
                {
                    tag: 'list',
                    attrs: {},
                    content: remainingMessageIds.map(id => ({
                        tag: 'item',
                        attrs: { id }
                    }))
                }
            ]
        }
        
        logger.debug({ attrs: node.attrs, messageIds }, 'sending receipt for messages')
        
        await sendNode(node)
    }

    /** Correctly bulk send receipts to multiple chats, participants */
    const sendReceipts = async (keys, type) => {
        const recps = aggregateMessageKeysNotFromMe(keys)

        for (const { jid, participant, messageIds } of recps) {
            await sendReceipt(jid, participant, messageIds, type)
        }
    }

    /** Bulk read messages. Keys can be from different chats & participants */
    const readMessages = async (keys) => {
        const privacySettings = await fetchPrivacySettings()

        // based on privacy settings, we have to change the read type
        const readType = privacySettings.readreceipts === 'all' ? 'read' : 'read-self'

        await sendReceipts(keys, readType)
    }
    
    /** Fetch all the devices we've to send a message to */
    const getUSyncDevices = async (jids, useCache, ignoreZeroDevices) => {
        const deviceResults = []
        
        if (!useCache) {
            logger.debug('not using cache for devices')
        }
        
        const toFetch = []
        
        const jidsWithUser = jids
            .map(jid => {
            const decoded = jidDecode(jid)
            const user = decoded?.user
            const device = decoded?.device
            const isExplicitDevice = typeof device === 'number' && device >= 0
            
            if (isExplicitDevice && user) {
                deviceResults.push({
                    user,
                    device,
                    jid
                })
                
                return null
            }
            
            jid = jidNormalizedUser(jid)
            
            return { jid, user }
        }).filter(jid => jid !== null)
            
        let mgetDevices
        
        if (useCache && userDevicesCache.mget) {
            const usersToFetch = jidsWithUser.map(j => j?.user).filter(Boolean)
            
            mgetDevices = await userDevicesCache.mget(usersToFetch)
        }
        
        for (const { jid, user } of jidsWithUser) {
            if (useCache) {
                const devices = mgetDevices?.[user] ||
                    (userDevicesCache.mget ? undefined : (await userDevicesCache.get(user)))
                    
                if (devices) {
                    const devicesWithJid = devices.map(d => ({
                        ...d,
                        jid: jidEncode(d.user, d.server, d.device)
                    }))
                    
                    deviceResults.push(...devicesWithJid)
                    
                    logger.trace({ user }, 'using cache for devices')
                }
                
                else {
                    toFetch.push(jid)
                }
            }
            
            else {
                toFetch.push(jid)
            }
        }
        
        if (!toFetch.length) {
            return deviceResults
        }
        
        const requestedLidUsers = new Set()
        
        for (const jid of toFetch) {
            if (isLidUser(jid) || isHostedLidUser(jid)) {
                const user = jidDecode(jid)?.user
                
                if (user)
                    requestedLidUsers.add(user)
            }
        }
        
        const query = new USyncQuery().withContext('message').withDeviceProtocol().withLIDProtocol()
        
        for (const jid of toFetch) {
            query.withUser(new USyncUser().withId(jid)) // todo: investigate - the idea here is that <user> should have an inline lid field with the lid being the pn equivalent
        }
        
        const result = await executeUSyncQuery(query)
        
        if (result) {
            // TODO: LID MAP this stuff (lid protocol will now return lid with devices)
            const lidResults = result.list.filter(a => !!a.lid)
            
            if (lidResults.length > 0) {
                logger.trace('Storing LID maps from device call')
                
                await signalRepository.lidMapping.storeLIDPNMappings(lidResults.map(a => ({ lid: a.lid, pn: a.id })))
                
                // Force-refresh sessions for newly mapped LIDs to align identity addressing
                try {
                    const lids = lidResults.map(a => a.lid)
                    
                    if (lids.length) {
                        await assertSessions(lids, true)
                    }
                }
                
                catch (e) {
                    logger.warn({ e, count: lidResults.length }, 'failed to assert sessions for newly mapped LIDs')
                }
            }
            
            const extracted = extractDeviceJids(result?.list, authState.creds.me.id, authState.creds.me.lid, ignoreZeroDevices)
            
            const deviceMap = {}
            
            for (const item of extracted) {
                deviceMap[item.user] = deviceMap[item.user] || []
                deviceMap[item.user]?.push(item)
            }
            
            // Process each user's devices as a group for bulk LID migration
            for (const [user, userDevices] of Object.entries(deviceMap)) {
                const isLidUser = requestedLidUsers.has(user);
                // Process all devices for this user
                for (const item of userDevices) {
                    const finalJid = isLidUser
                        ? jidEncode(user, item.server, item.device)
                        : jidEncode(item.user, item.server, item.device)
                    deviceResults.push({
                        ...item,
                        jid: finalJid
                    })
                    
                    logger.debug({
                        user: item.user,
                        device: item.device,
                        finalJid,
                        usedLid: isLidUser
                    }, 'Processed device with LID priority')
                }
            }
            
            if (userDevicesCache.mset) {
                // if the cache supports mset, we can set all devices in one go
                await userDevicesCache.mset(Object.entries(deviceMap).map(([key, value]) => ({ key, value })))
            }
            
            else {
                for (const key in deviceMap) {
                    if (deviceMap[key])
                        await userDevicesCache.set(key, deviceMap[key])
                }
            }
            
            const userDeviceUpdates = {}
            
            for (const [userId, devices] of Object.entries(deviceMap)) {
                if (devices && devices.length > 0) {
                    userDeviceUpdates[userId] = devices.map(d => d.device?.toString() || '0')
                }
            }
            
            if (Object.keys(userDeviceUpdates).length > 0) {
                try {
                    await authState.keys.set({ 'device-list': userDeviceUpdates })
                    
                    logger.debug({ userCount: Object.keys(userDeviceUpdates).length }, 'stored user device lists for bulk migration')
                }
                
                catch (error) {
                    logger.warn({ error }, 'failed to store user device lists')
                }
            }
        }
        
        return deviceResults
    }
    
    const updateMemberLabel = (jid, memberLabel) => {
        if (!isJidGroup(jid)) {
            throw new Error('Jid must a group!')
        }
        
        const protocolMessage = {
            protocolMessage: {
                type: proto.Message.ProtocolMessage.Type.GROUP_MEMBER_LABEL_CHANGE,
                memberLabel: {
                  label: memberLabel?.slice(0, 30),
                  labelTimestamp: unixTimestampSeconds()
                }
            }
        }
        
        return relayMessage(jid, protocolMessage, {
            additionalNodes: [
                {
                    tag: 'meta',
                    attrs: {
                      tag_reason: 'user_update', 
                      appdata: 'member_tag' 
                    }
                }
            ]
        })
    }
    
    const assertSessions = async (jids, force) => {
        let didFetchNewSession = false
        
        const uniqueJids = [...new Set(jids)] // Deduplicate JIDs
        const jidsRequiringFetch = []
        
        logger.debug({ jids }, 'assertSessions call with jids')
        
        // Check peerSessionsCache and validate sessions using libsignal loadSession
        for (const jid of uniqueJids) {
            const signalId = signalRepository.jidToSignalProtocolAddress(jid)
            const cachedSession = peerSessionsCache.get(signalId)
            
            if (cachedSession !== undefined) {
                if (cachedSession && !force) {
                    continue // Session exists in cache
                }
            }
            
            else {
                const sessionValidation = await signalRepository.validateSession(jid)
                const hasSession = sessionValidation.exists
                
                peerSessionsCache.set(signalId, hasSession)
                
                if (hasSession && !force) {
                    continue
                }
            }
            
            jidsRequiringFetch.push(jid)
        }
        
        if (jidsRequiringFetch.length) {
            // LID if mapped, otherwise original
            const wireJids = [
                ...jidsRequiringFetch.filter(jid => !!isLidUser(jid) || !!isHostedLidUser(jid)),
                ...((await signalRepository.lidMapping.getLIDsForPNs(jidsRequiringFetch.filter(jid => !!isPnUser(jid) || !!isHostedPnUser(jid)))) || []).map(a => a.lid)
            ]
            
            logger.debug({ jidsRequiringFetch, wireJids }, 'fetching sessions')
            
            const result = await query({
                tag: 'iq',
                attrs: {
                    xmlns: 'encrypt',
                    type: 'get',
                    to: S_WHATSAPP_NET
                },
                content: [
                    {
                        tag: 'key',
                        attrs: {},
                        content: wireJids.map(jid => {
                            const attrs = { jid }
                            
                            if (force) attrs.reason = 'identity'
                            
                            return { tag: 'user', attrs }
                        })
                    }
                ]
            })
            
            await parseAndInjectE2ESessions(result, signalRepository)
            
            didFetchNewSession = true
            
            // Cache fetched sessions using wire JIDs
            for (const wireJid of wireJids) {
                const signalId = signalRepository.jidToSignalProtocolAddress(wireJid)
                peerSessionsCache.set(signalId, true)
            }
        }
        
        return didFetchNewSession
    }
    
    const sendPeerDataOperationMessage = async (pdoMessage) => {
        //TODO: for later, abstract the logic to send a Peer Message instead of just PDO - useful for App State Key Resync with phone
        if (!authState.creds.me?.id) {
            throw new Boom('Not authenticated')
        }
        
        const protocolMessage = {
            protocolMessage: {
                peerDataOperationRequestMessage: pdoMessage,
                type: proto.Message.ProtocolMessage.Type.PEER_DATA_OPERATION_REQUEST_MESSAGE
            }
        }
        
        const meJid = jidNormalizedUser(authState.creds.me.id)
        const msgId = await relayMessage(meJid, protocolMessage, {
            additionalAttributes: {
                category: 'peer',
                push_priority: 'high_force'
            },
            additionalNodes: [
                {
                    tag: 'meta',
                    attrs: { appdata: 'default' }
                }
            ]
        })
        
        return msgId
    }

    const createParticipantNodes = async (recipientJids, message, extraAttrs, dsmMessage) => {
        if (!recipientJids.length) {
            return { nodes: [], shouldIncludeDeviceIdentity: false }
        }
        
        const patched = await patchMessageBeforeSending(message, recipientJids)
        const patchedMessages = Array.isArray(patched)
            ? patched
            : recipientJids.map(jid => ({ recipientJid: jid, message: patched }))
            
        let shouldIncludeDeviceIdentity = false
        
        const meId = authState.creds.me.id
        const meLid = authState.creds.me?.lid
        const meLidUser = meLid ? jidDecode(meLid)?.user : null
        const encryptionPromises = patchedMessages.map(async ({ recipientJid: jid, message: patchedMessage }) => {
            if (!jid) return null
                
            let msgToEncrypt = patchedMessage
            
            if (dsmMessage) {
                const { user: targetUser } = jidDecode(jid)
                const { user: ownPnUser } = jidDecode(meId)
                const ownLidUser = meLidUser
                const isOwnUser = targetUser === ownPnUser || (ownLidUser && targetUser === ownLidUser)
                const isExactSenderDevice = jid === meId || (meLid && jid === meLid)
                
                if (isOwnUser && !isExactSenderDevice) {
                    msgToEncrypt = dsmMessage
                    logger.debug({ jid, targetUser }, 'Using DSM for own device')
                }
            }
            
            const bytes = encodeWAMessage(msgToEncrypt)
            const mutexKey = jid
            const node = await encryptionMutex.mutex(mutexKey, async () => {
                const { type, ciphertext } = await signalRepository.encryptMessage({
                    jid,
                    data: bytes
                })
                
                if (type === 'pkmsg') {
                    shouldIncludeDeviceIdentity = true
                }
                
                return {
                    tag: 'to',
                    attrs: { jid },
                    content: [
                        {
                            tag: 'enc',
                            attrs: {
                                v: '2',
                                type,
                                ...(extraAttrs || {})
                            },
                            content: ciphertext
                        }
                    ]
                };
            })
            
            return node
        })
        
        const nodes = (await Promise.all(encryptionPromises)).filter(node => node !== null)
        
        return { nodes, shouldIncludeDeviceIdentity }
    }
    
    /** Fetch image for groups, user, and newsletter **/
    const profilePictureUrl = async (jid) => {
        if (isJidNewsletter(jid)) {
            const metadata = await suki.newsletterMetadata('JID', jid) 

            return getUrlFromDirectPath(metadata.thread_metadata.picture?.direct_path || '') 

         } 

         else {               
              const result = await query({
                  tag: 'iq',
                  attrs: {
                      target: jidNormalizedUser(jid),
                      to: S_WHATSAPP_NET,
                      type: 'get',
                      xmlns: 'w:profile:picture'
                   },
                   content: [{ 
                        tag: 'picture', 
                        attrs: { 
                           type: 'image', 
                           query: 'url' 
                        }
                   }]
              })

              const child = getBinaryNodeChild(result, 'picture')

              return child?.attrs?.url || null
          }
    }

    const relayMessage = async (jid, message, { messageId: msgId, participant, additionalAttributes, useUserDevicesCache, useCachedGroupMetadata, statusJidList, additionalNodes, AI = false }) => {
        const meId = authState.creds.me.id
        const meLid = authState.creds.me?.lid
        const isRetryResend = Boolean(participant?.jid)
        
        let shouldIncludeDeviceIdentity = isRetryResend
        let didPushAdditional = false
        
        const statusJid = 'status@broadcast'
        const { user, server } = jidDecode(jid)
        const isGroup = server === 'g.us'
        const isStatus = jid === statusJid
        const isLid = server === 'lid'
        const isNewsletter = server === 'newsletter'
        const isGroupOrStatus = isGroup || isStatus
        const finalJid = jid
        
        msgId = msgId || generateMessageID(meId)
        useUserDevicesCache = useUserDevicesCache !== false;
        useCachedGroupMetadata = useCachedGroupMetadata !== false && !isStatus
        
        const participants = []
        const destinationJid = !isStatus ? finalJid : statusJid
        const binaryNodeContent = []
        const devices = []

        const meMsg = {
            deviceSentMessage: {
                destinationJid,
                message
            }, 
            messageContextInfo: message.messageContextInfo
        }

        const extraAttrs = {}

        const regexGroupOld = /^(\d{1,15})-(\d+)@g\.us$/

        const messages = normalizeMessageContent(message)  

        const buttonType = getButtonType(messages)
        const pollMessage = messages.pollCreationMessage || messages.pollCreationMessageV2 || messages.pollCreationMessageV3


        if (participant) {
            if (!isGroup && !isStatus) {
                additionalAttributes = { ...additionalAttributes, device_fanout: 'false' }
            }
            
            const { user, device } = jidDecode(participant.jid)
            
            devices.push({
                user,
                device,
                jid: participant.jid
            })
        }

        await authState.keys.transaction(async () => {
            const mediaType = getMediaType(message)

            if (mediaType) {
                extraAttrs['mediatype'] = mediaType
            }
            
            if (isNewsletter) {
                const patched = patchMessageBeforeSending ? await patchMessageBeforeSending(message, []) : message
                const bytes = encodeNewsletterMessage(patched)
                
                binaryNodeContent.push({
                    tag: 'plaintext',
                    attrs: {},
                    content: bytes
                })
                
                const stanza = {
                    tag: 'message',
                    attrs: {
                        to: jid,
                        id: msgId,
                        type: getTypeMessage(message),
                        ...(additionalAttributes || {})
                    },
                    content: binaryNodeContent
                }
                
                logger.debug({ msgId }, `sending newsletter message to ${jid}`)
                
                await sendNode(stanza)
                
                return
            }

            if (messages.pinInChatMessage || messages.keepInChatMessage || message.reactionMessage || message.protocolMessage?.editedMessage) {
                extraAttrs['decrypt-fail'] = 'hide'
            } 

            if (messages.interactiveResponseMessage?.nativeFlowResponseMessage) {
                extraAttrs['native_flow_name'] = messages.interactiveResponseMessage.nativeFlowResponseMessage?.name || 'menu_options'
            }

            if (isGroupOrStatus && !isRetryResend) {
                const [groupData, senderKeyMap] = await Promise.all([
                    (async () => {
                        let groupData = useCachedGroupMetadata && cachedGroupMetadata ? await cachedGroupMetadata(jid) : undefined // todo: should we rely on the cache specially if the cache is outdated and the metadata has new fields?
                        
                        if (groupData && Array.isArray(groupData?.participants)) {
                            logger.trace({ jid, participants: groupData.participants.length }, 'using cached group metadata')
                        }
                        
                        else if (!isStatus) {
                            groupData = await groupMetadata(jid) // TODO: start storing group participant list + addr mode in Signal & stop relying on this
                        }
                        
                        return groupData
                    })(),
                    (async () => {
                        if (!participant && !isStatus) {
                            // what if sender memory is less accurate than the cached metadata
                            // on participant change in group, we should do sender memory manipulation
                            const result = await authState.keys.get('sender-key-memory', [jid]) // TODO: check out what if the sender key memory doesn't include the LID stuff now?
                            
                            return result[jid] || {}
                        }
                        
                        return {}
                    })()
                ])
                
                const participantsList = groupData ? groupData.participants.map(p => p.id) : []
                
                if (groupData?.ephemeralDuration && groupData.ephemeralDuration > 0) {
                    additionalAttributes = {
                        ...additionalAttributes,
                        expiration: groupData.ephemeralDuration.toString()
                    }
                }
                
                if (isStatus && statusJidList) {
                    participantsList.push(...statusJidList)
                }
                
                const additionalDevices = await getUSyncDevices(participantsList, !!useUserDevicesCache, false)
                
                devices.push(...additionalDevices)
                
                if (isGroup) {
                    additionalAttributes = {
                        ...additionalAttributes,
                        addressing_mode: groupData?.addressingMode || 'lid'
                    }
                }
                
                const patched = await patchMessageBeforeSending(message)
                
                if (Array.isArray(patched)) {
                    throw new Boom('Per-jid patching is not supported in groups')
                }
                
                const bytes = encodeWAMessage(patched)
                const groupAddressingMode = additionalAttributes?.['addressing_mode'] || groupData?.addressingMode || 'lid'
                const groupSenderIdentity = groupAddressingMode === 'lid' && meLid ? meLid : meId
                const { ciphertext, senderKeyDistributionMessage } = await signalRepository.encryptGroupMessage({
                    group: destinationJid,
                    data: bytes,
                    meId: groupSenderIdentity
                })
                
                const senderKeyRecipients = []
                
                for (const device of devices) {
                    const deviceJid = device.jid
                    const hasKey = !!senderKeyMap[deviceJid]
                    
                    if ((!hasKey || !!participant) &&
                        !isHostedLidUser(deviceJid) &&
                        !isHostedPnUser(deviceJid) &&
                        device.device !== 99) {
                        //todo: revamp all this logic
                        // the goal is to follow with what I said above for each group, and instead of a true false map of ids, we can set an array full of those the app has already sent pkmsgs
                        senderKeyRecipients.push(deviceJid)
                        senderKeyMap[deviceJid] = true
                    }
                }
                
                if (senderKeyRecipients.length) {
                    logger.debug({ senderKeyJids: senderKeyRecipients }, 'sending new sender key')
                    
                    const senderKeyMsg = {
                        senderKeyDistributionMessage: {
                            axolotlSenderKeyDistributionMessage: senderKeyDistributionMessage,
                            groupId: destinationJid
                        }
                    }
                    
                    const senderKeySessionTargets = senderKeyRecipients
                    
                    await assertSessions(senderKeySessionTargets)
                    
                    const result = await createParticipantNodes(senderKeyRecipients, senderKeyMsg, extraAttrs)
                    
                    shouldIncludeDeviceIdentity = shouldIncludeDeviceIdentity || result.shouldIncludeDeviceIdentity;
                    participants.push(...result.nodes)
                }
                
                binaryNodeContent.push({
                    tag: 'enc',
                    attrs: { v: '2', type: 'skmsg', ...extraAttrs },
                    content: ciphertext
                })
                
                await authState.keys.set({ 'sender-key-memory': { [jid]: senderKeyMap } })
            }

            else {
                // ADDRESSING CONSISTENCY: Match own identity to conversation context
                // TODO: investigate if this is true
                let ownId = meId
                
                if (isLid && meLid) {
                    ownId = meLid;
                    logger.debug({ to: jid, ownId }, 'Using LID identity for @lid conversation')
                }
                
                else {
                    logger.debug({ to: jid, ownId }, 'Using PN identity for @s.whatsapp.net conversation')
                }
                
                const { user: ownUser } = jidDecode(ownId)
                
                if (!isRetryResend) {
                    const targetUserServer = isLid ? 'lid' : 's.whatsapp.net'
                    
                    devices.push({
                        user,
                        device: 0,
                        jid: jidEncode(user, targetUserServer, 0) // rajeh, todo: this entire logic is convoluted and weird.
                    })
                    
                    if (user !== ownUser) {
                        const ownUserServer = isLid ? 'lid' : 's.whatsapp.net'
                        const ownUserForAddressing = isLid && meLid ? jidDecode(meLid).user : jidDecode(meId).user
                        
                        devices.push({
                            user: ownUserForAddressing,
                            device: 0,
                            jid: jidEncode(ownUserForAddressing, ownUserServer, 0)
                        })
                    }
                    
                    if (additionalAttributes?.['category'] !== 'peer') {
                        // Clear placeholders and enumerate actual devices
                        devices.length = 0
                        
                        // Use conversation-appropriate sender identity
                        const senderIdentity = isLid && meLid
                            ? jidEncode(jidDecode(meLid)?.user, 'lid', undefined)
                            : jidEncode(jidDecode(meId)?.user, 's.whatsapp.net', undefined)
                        // Enumerate devices for sender and target with consistent addressing
                        const sessionDevices = await getUSyncDevices([senderIdentity, jid], true, false)
                        
                        devices.push(...sessionDevices)
                        
                        logger.debug({
                            deviceCount: devices.length,
                            devices: devices.map(d => `${d.user}:${d.device}@${jidDecode(d.jid)?.server}`)
                        }, 'Device enumeration complete with unified addressing')
                    }
                }
                
                const allRecipients = []
                const meRecipients = []
                const otherRecipients = []
                
                const { user: mePnUser } = jidDecode(meId)
                const { user: meLidUser } = meLid ? jidDecode(meLid) : { user: null }
                
                for (const { user, jid } of devices) {
                    const isExactSenderDevice = jid === meId || (meLid && jid === meLid)
                    
                    if (isExactSenderDevice) {
                        logger.debug({ jid, meId, meLid }, 'Skipping exact sender device (whatsmeow pattern)')
                        continue
                    }
                    
                    // Check if this is our device (could match either PN or LID user)
                    const isMe = user === mePnUser || user === meLidUser
                    
                    if (isMe) {
                        meRecipients.push(jid);
                    }
                    
                    else {
                        otherRecipients.push(jid)
                    }
                    
                    allRecipients.push(jid)
                }
                
                await assertSessions(allRecipients)
                
                const [{ nodes: meNodes, shouldIncludeDeviceIdentity: s1 }, { nodes: otherNodes, shouldIncludeDeviceIdentity: s2 }] = await Promise.all([
                    // For own devices: use DSM if available (1:1 chats only)
                    createParticipantNodes(meRecipients, meMsg || message, extraAttrs),
                    createParticipantNodes(otherRecipients, message, extraAttrs, meMsg)
                ])
                
                participants.push(...meNodes)
                participants.push(...otherNodes)
                
                if (meRecipients.length > 0 || otherRecipients.length > 0) {
                    extraAttrs['phash'] = generateParticipantHashV2([...meRecipients, ...otherRecipients])
                }
                
                shouldIncludeDeviceIdentity = shouldIncludeDeviceIdentity || s1 || s2
            }
            
            if (isRetryResend) {
                const isParticipantLid = isLidUser(participant.jid)
                const isMe = areJidsSameUser(participant.jid, isParticipantLid ? meLid : meId)
                const encodedMessageToSend = isMe
                    ? encodeWAMessage({
                        deviceSentMessage: {
                            destinationJid,
                            message
                        }
                    })
                    : encodeWAMessage(message)
                const { type, ciphertext: encryptedContent } = await signalRepository.encryptMessage({
                    data: encodedMessageToSend,
                    jid: participant.jid
                })
                
                binaryNodeContent.push({
                    tag: 'enc',
                    attrs: {
                        v: '2',
                        type,
                        count: participant.count.toString()
                    },
                    content: encryptedContent
                })
            }
            
            if (participants.length) {
                if (additionalAttributes?.['category'] === 'peer') {
                    const peerNode = participants[0]?.content?.[0]
                    
                    if (peerNode) {
                        binaryNodeContent.push(peerNode) // push only enc
                    }
                }
                
                else {
                    binaryNodeContent.push({
                        tag: 'participants',
                        attrs: {},
                        content: participants
                    });
                }
            }
            
            const stanza = {
                tag: 'message',
                attrs: {
                    id: msgId,
                    to: destinationJid,
                    type: getTypeMessage(message),
                    ...(additionalAttributes || {})
                },
                content: binaryNodeContent
            }

            // if the participant to send to is explicitly specified (generally retry recp)
            // ensure the message is only sent to that person
            // if a retry receipt is sent to everyone -- it'll fail decryption for everyone else who received the msg
            if (participant) {
                if (isJidGroup(destinationJid)) {
                    stanza.attrs.to = destinationJid
                    stanza.attrs.participant = participant.jid
                }
                
                else if (areJidsSameUser(participant.jid, meId)) {
                    stanza.attrs.to = participant.jid
                    stanza.attrs.recipient = destinationJid
                }
                
                else {
                    stanza.attrs.to = participant.jid
                }
            }
            
            else {
                stanza.attrs.to = destinationJid
            }
            
            if (shouldIncludeDeviceIdentity) {
                stanza.content.push({
                    tag: 'device-identity',
                    attrs: {},
                    content: encodeSignedDeviceIdentity(authState.creds.account, true)
                })
                
                logger.debug({ jid }, 'adding device identity')
            }
            
            const contactTcTokenData = !isGroup && !isRetryResend && !isStatus ? await authState.keys.get('tctoken', [destinationJid]) : {}
            const tcTokenBuffer = contactTcTokenData[destinationJid]?.token
            
            if (tcTokenBuffer) {
                stanza.content.push({
                    tag: 'tctoken',
                    attrs: {},
                    content: tcTokenBuffer
                })
            }

            if (isGroup && regexGroupOld.test(jid) && !message.reactionMessage) {
                stanza.content.push({
                    tag: 'multicast',
                    attrs: {}
                }) 
           }

            if (pollMessage || messages.eventMessage) {
                stanza.content.push({
                    tag: 'meta', 
                    attrs: messages.eventMessage ? {
                        event_type: 'creation'
                    } : isNewsletter ? {
                        polltype: 'creation', 
                        contenttype: pollMessage?.pollContentType === 2 ? 'image' : 'text'
                    } : {
                        polltype: 'creation'
                    }
                }) 
            }

            if (!isNewsletter && buttonType) {
                const buttonsNode = getButtonArgs(messages)
                const filteredButtons = getBinaryFilteredButtons(additionalNodes ? additionalNodes : [])

                if (filteredButtons) {
                   stanza.content.push(...additionalNodes)
                   didPushAdditional = true
                }

                else {
                    stanza.content.push(buttonsNode)
                }
            }

            if (AI && isPrivate) {
                const botNode = {
                    tag: 'bot', 
                    attrs: {
                        biz_bot: '1'
                    }
                }

                const filteredBizBot = getBinaryFilteredBizBot(additionalNodes ? additionalNodes : []) 

                if (filteredBizBot) {
                    stanza.content.push(...additionalNodes) 
                    didPushAdditional = true
                }

                else {
                    stanza.content.push(botNode) 
                }
            }

            if (!didPushAdditional && additionalNodes && additionalNodes.length > 0) {
                stanza.content.push(...additionalNodes)
            }  

            logger.debug({ msgId }, `sending message to ${participants.length} devices`)

            await sendNode(stanza)
            
            // Add message to retry cache if enabled
            if (messageRetryManager && !participant) {
                messageRetryManager.addRecentMessage(destinationJid, msgId, message)
            }
        }, meId)

        return msgId
    }

    const getTypeMessage = (msg) => {
        const message = normalizeMessageContent(msg)  
        if (message.pollCreationMessage || message.pollCreationMessageV2 || message.pollCreationMessageV3) {
            return 'poll'
        }       
        else if (message.reactionMessage) {
            return 'reaction'
        }       
        else if (message.eventMessage) {
            return 'event'
        }        
        else if (getMediaType(message)) {
            return 'media'
        }        
        else {
            return 'text'
        }
    }

    const getMediaType = (message) => {
      if (message.imageMessage) {
            return 'image'
        }
        else if (message.stickerMessage) {
            return message.stickerMessage.isLottie ? '1p_sticker' : message.stickerMessage.isAvatar ? 'avatar_sticker' : 'sticker'
        }
        else if (message.videoMessage) {
            return message.videoMessage.gifPlayback ? 'gif' : 'video'
        }
        else if (message.audioMessage) {
            return message.audioMessage.ptt ? 'ptt' : 'audio'
        }
        else if (message.ptvMessage) {
            return 'ptv'
        }
        else if (message.albumMessage) {
            return 'collection'
        }
        else if (message.contactMessage) {
            return 'vcard'
        }
        else if (message.documentMessage) {
            return 'document'
        }
        else if (message.stickerPackMessage) {
            return 'sticker_pack'
        }
        else if (message.contactsArrayMessage) {
            return 'contact_array'
        }
        else if (message.locationMessage) {
            return 'location'
        }
        else if (message.liveLocationMessage) {
            return 'livelocation'
        }
        else if (message.listMessage) {
            return 'list'
        }
        else if (message.listResponseMessage) {
            return 'list_response'
        }
        else if (message.buttonsResponseMessage) {
            return 'buttons_response'
        }
        else if (message.orderMessage) {
            return 'order'
        }
        else if (message.productMessage) {
            return 'product'
        }
        else if (message.interactiveResponseMessage) {
            return 'native_flow_response'
        }
        else if (/https:\/\/wa\.me\/c\/\d+/.test(message.extendedTextMessage?.text)) {
            return 'cataloglink'
        }
        else if (/https:\/\/wa\.me\/p\/\d+\/\d+/.test(message.extendedTextMessage?.text)) {
            return 'productlink'
        }
        else if (message.extendedTextMessage?.matchedText || message.groupInviteMessage) {
            return 'url'
        }
    }

    const getButtonType = (message) => {
        if (message.listMessage) {
            return 'list'
       }
        else if (message.buttonsMessage) {
            return 'buttons'
        }
        else if(message.interactiveMessage?.nativeFlowMessage) {
            return 'native_flow'
        }
    }

    const getButtonArgs = (message) => {
        const nativeFlow = message.interactiveMessage?.nativeFlowMessage
        const firstButtonName = nativeFlow?.buttons?.[0]?.name
        const nativeFlowSpecials = [
            'mpm', 'cta_catalog', 'send_location',
            'call_permission_request', 'wa_payment_transaction_details',
            'automated_greeting_message_view_catalog'
        ]

        if (nativeFlow && (firstButtonName === 'review_and_pay' || firstButtonName === 'payment_info')) {
                return {
                    tag: 'biz', 
                    attrs: {
                        native_flow_name: firstButtonName === 'review_and_pay' ? 'order_details' : firstButtonName
                }
            } 
        } else if (nativeFlow && nativeFlowSpecials.includes(firstButtonName)) {
            // Only works for WhatsApp Original, not WhatsApp Business
            return {
                tag: 'biz',
                attrs: {
                	actual_actors: '2', 
                	host_storage: '2', 
                	privacy_mode_ts: unixTimestampSeconds().toString()
                }, 
                content: [{
                    tag: 'interactive',
                    attrs: {
                        type: 'native_flow',
                        v: '1'
                    },
                    content: [{
                        tag: 'native_flow',
                        attrs: {
                            v: '2', 
                            name: firstButtonName
                        }
                    }]
                }, 
                {
                	tag: 'quality_control', 
                	attrs: {
                		source_type: 'third_party'
                	}
                }]
            }
        } else if (nativeFlow || message.buttonsMessage) {
            // It works for whatsapp original and whatsapp business
            return {
                tag: 'biz', 
                attrs: {
                	actual_actors: '2', 
                	host_storage: '2', 
                	privacy_mode_ts: unixTimestampSeconds().toString()
                }, 
                content: [{
                    tag: 'interactive', 
                    attrs: {
                        type: 'native_flow', 
                        v: '1'
                    }, 
                    content: [{
                        tag: 'native_flow', 
                        attrs: {
                            v: '9', 
                            name: 'mixed'
                        }
                    }]
                }, 
                {
                	tag: 'quality_control', 
                	attrs: {
                		source_type: 'third_party'
                	}
                }]
            }
        } else if (message.listMessage) {
            return {
                tag: 'biz', 
                attrs: {
                	actual_actors: '2', 
                	host_storage: '2', 
                	privacy_mode_ts: unixTimestampSeconds().toString()
                }, 
                content: [{
                    tag: 'list', 
                    attrs: {
                        v: '2', 
                        type: 'product_list'
                    }
                }, 
                {
                	tag: 'quality_control', 
                	attrs: {
                		source_type: 'third_party'
                	}
                }]
            }
        } else {
            return {
                tag: 'biz', 
                attrs: {
                	actual_actors: '2', 
                	host_storage: '2', 
                	privacy_mode_ts: unixTimestampSeconds().toString()
                }
            }
        }
    }

    const getPrivacyTokens = async (jids) => {
        const t = unixTimestampSeconds().toString()

        const result = await query({
            tag: 'iq',
            attrs: {
                to: S_WHATSAPP_NET,
                type: 'set',
                xmlns: 'privacy'
            },
            content: [
                {
                    tag: 'tokens',
                    attrs: {},
                    content: jids.map(jid => ({
                        tag: 'token',
                        attrs: {
                            jid: jidNormalizedUser(jid),
                            t,
                            type: 'trusted_contact'
                        }
                    }))
                }
            ]
        })

        return result
    }    
    
    const getEphemeralGroup = (jid) => {
    	if (!isJidGroup(jid)) throw new TypeError("Jid should originate from a group!") 
    
        return groupQuery(jid, 'get', [{
        	tag: 'query',
            attrs: {
            	request: 'interactive'
            }
        }])
        .then((groups) => getBinaryNodeChild(groups, 'group'))
        .then((metadata) => getBinaryNodeChild(metadata, 'ephemeral')?.attrs?.expiration || 0) 
    }

    const waUploadToServer = getWAUploadToServer(config, refreshMediaConn)

    const waitForMsgMediaUpdate = bindWaitForEvent(ev, 'messages.media-update')
    
    return {
        ...suki,
        getPrivacyTokens,
        assertSessions,
        profilePictureUrl, 
        relayMessage,
        sendReceipt,
        sendReceipts,
        readMessages,
        getUSyncDevices,
        refreshMediaConn,
        waUploadToServer,
        getEphemeralGroup, 
        fetchPrivacySettings, 
        messageRetryManager, 
        createParticipantNodes, 
        sendPeerDataOperationMessage, 
        updateMemberLabel, 
        updateMediaMessage: async (message) => {
            const content = assertMediaContent(message.message)
            const mediaKey = content.mediaKey
            const meId = authState.creds.me.id
            const node = await encryptMediaRetryRequest(message.key, mediaKey, meId)
            
            let error = undefined
            
            await Promise.all([
                sendNode(node),
                waitForMsgMediaUpdate(async (update) => {
                    const result = update.find(c => c.key.id === message.key.id)
                    
                    if (result) {
                        if (result.error) {
                            error = result.error
                        }
                        
                        else {
                            try {
                                const media = await decryptMediaRetryData(result.media, mediaKey, result.key.id)
                                
                                if (media.result !== proto.MediaRetryNotification.ResultType.SUCCESS) {
                                    const resultStr = proto.MediaRetryNotification.ResultType[media.result]
                                    
                                    throw new Boom(`Media re-upload failed by device (${resultStr})`, {
                                        data: media,
                                        statusCode: getStatusCodeForMediaRetry(media.result) || 404
                                    })
                                }
                                
                                content.directPath = media.directPath
                                content.url = getUrlFromDirectPath(content.directPath)
                                logger.debug({ directPath: media.directPath, key: result.key }, 'media update successful')
                            }
                            
                            catch (err) {
                                error = err
                            }
                        }
                        
                        return true
                    }
                })
            ])
            
            if (error) {
                throw error
            }
            
            ev.emit('messages.update', [{ key: message.key, update: { message: message.message } }])
            
            return message
        },
        sendStatusMentions: async (content, jids = []) => {
          const userJid = jidNormalizedUser(authState.creds.me.id)
          let allUsers = new Set()
          allUsers.add(userJid)

          for (const id of jids) {
            const isGroup = isJidGroup(id) 
            const isPrivate = isPnUser(id) 

            if (isGroup) {
              try {
                const metadata = await cachedGroupMetadata(id) || await groupMetadata(id)
                const participants = metadata.participants.map(p => jidNormalizedUser(p.id))
                participants.forEach(jid => allUsers.add(jid))
              } catch (error) {
                logger.error(`Error getting metadata for group ${id}: ${error}`)
              }
            } else if (isPrivate) {
              allUsers.add(jidNormalizedUser(id))
            }
          }

          const uniqueUsers = Array.from(allUsers)
          const getRandomHexColor = () => "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0")

          const isMedia = content.image || content.video || content.audio
          const isAudio = !!content.audio

          const messageContent = { ...content }

          if (isMedia && !isAudio) {
            if (messageContent.text) {
              messageContent.caption = messageContent.text

              delete messageContent.text
            }

            delete messageContent.ptt
            delete messageContent.font
            delete messageContent.backgroundColor
            delete messageContent.textColor
          }

          if (isAudio) {
            delete messageContent.text
            delete messageContent.caption
            delete messageContent.font
            delete messageContent.textColor
          }

          const font = !isMedia ? (content.font || Math.floor(Math.random() * 9)) : undefined
          const textColor = !isMedia ? (content.textColor || getRandomHexColor()) : undefined
          const backgroundColor = (!isMedia || isAudio) ? (content.backgroundColor || getRandomHexColor()) : undefined
          const ptt = isAudio ? (typeof content.ptt === 'boolean' ? content.ptt : true) : undefined

          let msg
          let mediaHandle
          try {
            msg = await generateWAMessage(STORIES_JID, messageContent, {
              logger,
              userJid,
              getUrlInfo: text => getUrlInfo(text, {
                thumbnailWidth: linkPreviewImageThumbnailWidth,
                fetchOpts: {
                    timeout: 3000,
                    ...(httpRequestOptions || {})
                },
                logger,
                uploadImage: generateHighQualityLinkPreview ? waUploadToServer : undefined
              }),
              upload: async (encFilePath, opts) => {
                const up = await waUploadToServer(encFilePath, { ...opts })
                mediaHandle = up.handle
                return up
              },
              mediaCache: config.mediaCache,
              options: config.options,
              font,
              textColor,
              backgroundColor,
              ptt
            })
          } catch (error) {
            logger.error(`Error generating message: ${error}`)
            throw error
          }

          await relayMessage(STORIES_JID, msg.message, {
            messageId: msg.key.id,
            statusJidList: uniqueUsers, 
            additionalNodes: [
              {
                tag: 'meta',
                attrs: {},
                content: [
                  {
                    tag: 'mentioned_users',
                    attrs: {},
                    content: jids.map(jid => ({
                      tag: 'to',
                      attrs: { jid: jidNormalizedUser(jid) }
                    }))
                  }]
              }]
          })

          for (const id of jids) {
            try {
              const normalizedId = jidNormalizedUser(id)
              const isPrivate = isPnUser(normalizedId) 
              const type = isPrivate ? 'statusMentionMessage' : 'groupStatusMentionMessage'

              const protocolMessage = {
                [type]: {
                  message: {
                    protocolMessage: {
                      key: msg.key,
                      type: 25
                    }
                  }
                },
                messageContextInfo: {
                  messageSecret: randomBytes(32)
                }
              }

              const statusMsg = await generateWAMessageFromContent(normalizedId,
                protocolMessage,
                {}
              )

              await relayMessage(
                normalizedId,
                statusMsg.message,
                {
                  additionalNodes: [{
                    tag: 'meta',
                    attrs: isPrivate ?
                    { is_status_mention: 'true' } :
                    { is_group_status_mention: 'true' }
                  }]
                }
              )

              await delay(2000)
            } catch (error) {
              logger.error(`Error sending to ${id}: ${error}`)
            }
          }

          return msg
        },
        sendMessage: async (jid, content, options = {}) => {
            const userJid = authState.creds.me.id
            const additionalAttributes = {}

            if (!options.ephemeralExpiration) {
                if (isJidGroup(jid)) {
                    const expiration = await getEphemeralGroup(jid) 
                    options.ephemeralExpiration = expiration
                 }
            }
            
            if (typeof content === 'object' &&
                'disappearingMessagesInChat' in content &&
                typeof content['disappearingMessagesInChat'] !== 'undefined' &&
                isJidGroup(jid)) {

                const { disappearingMessagesInChat } = content

                const value = typeof disappearingMessagesInChat === 'boolean' ?
                    (disappearingMessagesInChat ? WA_DEFAULT_EPHEMERAL : 0) :
                    disappearingMessagesInChat

                await groupToggleEphemeral(jid, value)
            }
            
            else if (typeof content === 'object' && 'album' in content && content.album) {
            	const albumMsg = await prepareAlbumMessageContent(jid, content.album, {
            		suki: {
            			relayMessage, 
            			waUploadToServer
            		}, 
            		userJid: userJid, 
            		...options
            	}) 
            
            	for (const media of albumMsg) {
            		await delay(options.delay || 500) 
            		await relayMessage(jid, media.message, { messageId: media.key.id, useCachedGroupMetadata: options.useCachedGroupMetadata, additionalAttributes, statusJidList: options.statusJidList, additionalNodes: options.additionalNodes, AI: options.ai })
            	}
            
            	return albumMsg
            }

            else {
                let mediaHandle

                const fullMsg = await generateWAMessage(jid, content, {
                    logger,
                    userJid,
                    getUrlInfo: text => getUrlInfo(text, {
                        thumbnailWidth: linkPreviewImageThumbnailWidth,
                        fetchOpts: {
                    	    timeout: 3000,
                            ...(httpRequestOptions || {})
                        },
                        logger,
                        uploadImage: generateHighQualityLinkPreview
                            ? waUploadToServer
                            : undefined
                    }),
                    getProfilePicUrl: profilePictureUrl,
                    getCallLink: createCallLink, 
                    upload: async (encFilePath, opts) => {
                        const up = await waUploadToServer(encFilePath, { ...opts, newsletter: isJidNewsletter(jid) })
                        mediaHandle = up.handle
                        return up
                    },
                    mediaCache: config.mediaCache,
                    options: config.options,
                    messageId: generateMessageID(userJid), 
                    ...options,
                })

                const isPin = 'pin' in content && !!content.pin
                const isEdit = 'edit' in content && !!content.edit
                const isDelete = 'delete' in content && !!content.delete
                const isKeep = 'keep' in content && !!content.keep && content.keep?.type === 2

                if (isDelete || isKeep) {
                    // if the chat is a group, and I am not the author, then delete the message as an admin
                    if (isJidGroup(content.delete?.remoteJid) && !content.delete?.fromMe || isJidNewsletter(jid)) {
                        additionalAttributes.edit = '8'
                    }

                    else {
                        additionalAttributes.edit = '7'
                    }
                }

                else if (isEdit) {
                    additionalAttributes.edit = isJidNewsletter(jid) ? '3' : '1'
                }

                else if (isPin) {
                    additionalAttributes.edit = '2'
                }  

                if (mediaHandle) {
                    additionalAttributes['media_id'] = mediaHandle
                }

                if ('cachedGroupMetadata' in options) {
                    console.warn('cachedGroupMetadata in sendMessage are deprecated, now cachedGroupMetadata is part of the socket config.')
                }

                await relayMessage(jid, fullMsg.message, { messageId: fullMsg.key.id, useCachedGroupMetadata: options.useCachedGroupMetadata, additionalAttributes, statusJidList: options.statusJidList, additionalNodes: options.additionalNodes, AI: options.ai })

                if (config.emitOwnEvents) {
                    process.nextTick(async () => {
                        await messageMutex.mutex(() => upsertMessage(fullMsg, 'append'))
                    })
                }

                return fullMsg
            }
        }
    }
}

module.exports = {
  makeMessagesSocket
}
return module.exports;
})();
for (const key of Object.keys(__kageModule30)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule30[key]});
}

// Kage: funciones avanzadas.
const __kageModule136 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeMessagesSocket = void 0;
const node_crypto_1 = require("node:crypto");
const index_js_1 = require("../../WAProto/index.js");
const index_js_2 = require("../Addon/index.js");
const index_js_3 = require("../Defaults/index.js");
const index_js_4 = require("../Utils/index.js");
const index_js_5 = require("../Types/index.js");
const link_preview_js_1 = require("../Utils/link-preview.js");
const make_mutex_js_1 = require("../Utils/make-mutex.js");
const reporting_utils_js_1 = require("../Utils/reporting-utils.js");
const tc_token_utils_js_1 = require("../Utils/tc-token-utils.js");
const index_js_6 = require("../WABinary/index.js");
const index_js_7 = require("../WAUSync/index.js");
const newsletter_js_1 = require("./newsletter.js");
const makeMessagesSocket = (config) => {
    const { logger, linkPreviewImageThumbnailWidth, generateHighQualityLinkPreview, options: httpRequestOptions, patchMessageBeforeSending, cachedGroupMetadata, enableRecentMessageCache, maxMsgRetryCount } = config;
    const sock = (0, newsletter_js_1.makeNewsletterSocket)(config);
    const { ev, authState, messageMutex, signalRepository, upsertMessage, query, fetchPrivacySettings, sendNode, groupMetadata, groupToggleEphemeral, registerSocketEndHandler } = sock;
    const getLIDForPN = signalRepository.lidMapping.getLIDForPN.bind(signalRepository.lidMapping);
    /**
     * Set of tctoken storage JIDs with a fire-and-forget `issuePrivacyTokens` IQ in flight.
     * Prevents duplicate IQs from rapid back-to-back sends before `senderTimestamp` persists.
     * Entries are always removed in `.finally()`, so the set is bounded by concurrency.
     */
    const inFlightTcTokenIssuance = new Set();
    const userDevicesCache = config.userDevicesCache ||
        (0, index_js_2.createCache)({
            ttl: index_js_3.DEFAULT_CACHE_TTLS.USER_DEVICES // 5 minutes
        });
    /** Serializes writes to userDevicesCache across USync refresh and device-notification handling. */
    const devicesMutex = (0, make_mutex_js_1.makeMutex)();
    // Initialize message retry manager if enabled
    const messageRetryManager = enableRecentMessageCache ? new index_js_4.MessageRetryManager(logger, maxMsgRetryCount) : null;
    // Prevent race conditions in Signal session encryption by user
    const encryptionMutex = (0, make_mutex_js_1.makeKeyedMutex)();
    // Prevent race conditions in media connection refresh
    const mediaConnMutex = (0, make_mutex_js_1.makeKeyedMutex)();
    let mediaConn;
    /** Per-socket media host; updated whenever media_conn is fetched. Defaults to the public WhatsApp host. */
    let mediaHost = index_js_4.DEF_MEDIA_HOST;
    const refreshMediaConn = async (forceGet = false) => {
        return mediaConnMutex.mutex('media-conn', async () => {
            const media = await mediaConn;
            if (!media || forceGet || new Date().getTime() - media.fetchDate.getTime() > media.ttl * 1000) {
                mediaConn = (async () => {
                    const result = await query({
                        tag: 'iq',
                        attrs: {
                            type: 'set',
                            xmlns: 'w:m',
                            to: index_js_6.S_WHATSAPP_NET
                        },
                        content: [{ tag: 'media_conn', attrs: {} }]
                    });
                    const mediaConnNode = (0, index_js_6.getBinaryNodeChild)(result, 'media_conn');
                    // TODO: explore full length of data that whatsapp provides
                    const node = {
                        hosts: (0, index_js_6.getBinaryNodeChildren)(mediaConnNode, 'host').map(({ attrs }) => ({
                            hostname: attrs.hostname,
                            maxContentLengthBytes: +attrs.maxContentLengthBytes
                        })),
                        auth: mediaConnNode.attrs.auth,
                        ttl: +mediaConnNode.attrs.ttl,
                        fetchDate: new Date()
                    };
                    logger.debug('fetched media conn');
                    if (node.hosts[0]) {
                        mediaHost = node.hosts[0].hostname;
                    }
                    return node;
                })();
            }
            return mediaConn;
        });
    };
    /**
     * generic send receipt function
     * used for receipts of phone call, read, delivery etc.
     * */
    const sendReceipt = async (jid, participant, messageIds, type) => {
        if (!messageIds || messageIds.length === 0) {
            throw new index_js_2.HttpError('missing ids in receipt');
        }
        const node = {
            tag: 'receipt',
            attrs: {
                id: messageIds[0]
            }
        };
        const isReadReceipt = type === 'read' || type === 'read-self';
        if (isReadReceipt) {
            node.attrs.t = (0, index_js_4.unixTimestampSeconds)().toString();
        }
        if (type === 'sender' && ((0, index_js_6.isPnUser)(jid) || (0, index_js_6.isLidUser)(jid))) {
            node.attrs.recipient = jid;
            node.attrs.to = participant;
        }
        else {
            node.attrs.to = jid;
            if (participant) {
                node.attrs.participant = participant;
            }
        }
        if (type) {
            node.attrs.type = type;
        }
        const remainingMessageIds = messageIds.slice(1);
        if (remainingMessageIds.length) {
            node.content = [
                {
                    tag: 'list',
                    attrs: {},
                    content: remainingMessageIds.map(id => ({
                        tag: 'item',
                        attrs: { id }
                    }))
                }
            ];
        }
        logger.debug({ attrs: node.attrs, messageIds }, 'sending receipt for messages');
        await sendNode(node);
    };
    /** Correctly bulk send receipts to multiple chats, participants */
    const sendReceipts = async (keys, type) => {
        const recps = (0, index_js_4.aggregateMessageKeysNotFromMe)(keys);
        for (const { jid, participant, messageIds } of recps) {
            await sendReceipt(jid, participant, messageIds, type);
        }
    };
    /** Bulk read messages. Keys can be from different chats & participants */
    const readMessages = async (keys) => {
        const privacySettings = await fetchPrivacySettings();
        // based on privacy settings, we have to change the read type
        const readType = privacySettings.readreceipts === 'all' ? 'read' : 'read-self';
        await sendReceipts(keys, readType);
    };
    /** Fetch all the devices we've to send a message to */
    const getUSyncDevices = async (jids, useCache, ignoreZeroDevices) => {
        const deviceResults = [];
        if (!useCache) {
            logger.debug('not using cache for devices');
        }
        const toFetch = [];
        const jidsWithUser = jids
            .map(jid => {
            const decoded = (0, index_js_6.jidDecode)(jid);
            const user = decoded?.user;
            const device = decoded?.device;
            const isExplicitDevice = typeof device === 'number' && device >= 0;
            if (isExplicitDevice && user) {
                deviceResults.push({
                    user,
                    device,
                    jid
                });
                return null;
            }
            jid = (0, index_js_6.jidNormalizedUser)(jid);
            return { jid, user };
        })
            .filter(jid => jid !== null);
        let mgetDevices;
        if (useCache && userDevicesCache.mget) {
            const usersToFetch = jidsWithUser.map(j => j?.user).filter(Boolean);
            mgetDevices = await userDevicesCache.mget(usersToFetch);
        }
        for (const { jid, user } of jidsWithUser) {
            if (useCache) {
                const devices = mgetDevices?.[user] ||
                    (userDevicesCache.mget ? undefined : (await userDevicesCache.get(user)));
                if (devices) {
                    const devicesWithJid = devices.map(d => ({
                        ...d,
                        jid: (0, index_js_6.jidEncode)(d.user, d.server, d.device)
                    }));
                    deviceResults.push(...devicesWithJid);
                    logger.trace({ user }, 'using cache for devices');
                }
                else {
                    toFetch.push(jid);
                }
            }
            else {
                toFetch.push(jid);
            }
        }
        if (!toFetch.length) {
            return deviceResults;
        }
        const requestedLidUsers = new Set();
        for (const jid of toFetch) {
            if ((0, index_js_6.isLidUser)(jid) || (0, index_js_6.isHostedLidUser)(jid)) {
                const user = (0, index_js_6.jidDecode)(jid)?.user;
                if (user)
                    requestedLidUsers.add(user);
            }
        }
        const query = new index_js_7.USyncQuery().withContext('message').withDeviceProtocol().withLIDProtocol();
        for (const jid of toFetch) {
            query.withUser(new index_js_7.USyncUser().withId(jid)); // todo: investigate - the idea here is that <user> should have an inline lid field with the lid being the pn equivalent
        }
        const result = await sock.executeUSyncQuery(query);
        if (result) {
            // TODO: LID MAP this stuff (lid protocol will now return lid with devices)
            const lidResults = result.list.filter(a => !!a.lid);
            if (lidResults.length > 0) {
                logger.trace('Storing LID maps from device call');
                await signalRepository.lidMapping.storeLIDPNMappings(lidResults.map(a => ({ lid: a.lid, pn: a.id })));
                // Force-refresh sessions for newly mapped LIDs to align identity addressing
                try {
                    const lids = lidResults.map(a => a.lid);
                    if (lids.length) {
                        await assertSessions(lids, true);
                    }
                }
                catch (e) {
                    logger.warn({ e, count: lidResults.length }, 'failed to assert sessions for newly mapped LIDs');
                }
            }
            const extracted = (0, index_js_4.extractDeviceJids)(result?.list, authState.creds.me.id, authState.creds.me.lid, ignoreZeroDevices);
            const deviceMap = {};
            for (const item of extracted) {
                deviceMap[item.user] = deviceMap[item.user] || [];
                deviceMap[item.user]?.push(item);
            }
            // Process each user's devices as a group for bulk LID migration
            for (const [user, userDevices] of Object.entries(deviceMap)) {
                const isLidUser = requestedLidUsers.has(user);
                // Process all devices for this user
                for (const item of userDevices) {
                    const finalJid = isLidUser
                        ? (0, index_js_6.jidEncode)(user, item.server, item.device)
                        : (0, index_js_6.jidEncode)(item.user, item.server, item.device);
                    deviceResults.push({
                        ...item,
                        jid: finalJid
                    });
                    logger.debug({
                        user: item.user,
                        device: item.device,
                        finalJid,
                        usedLid: isLidUser
                    }, 'Processed device with LID priority');
                }
            }
            await devicesMutex.mutex(async () => {
                if (userDevicesCache.mset) {
                    // if the cache supports mset, we can set all devices in one go
                    await userDevicesCache.mset(Object.entries(deviceMap).map(([key, value]) => ({ key, value })));
                }
                else {
                    for (const key in deviceMap) {
                        if (deviceMap[key])
                            await userDevicesCache.set(key, deviceMap[key]);
                    }
                }
            });
            const userDeviceUpdates = {};
            for (const [userId, devices] of Object.entries(deviceMap)) {
                if (devices && devices.length > 0) {
                    userDeviceUpdates[userId] = devices.map(d => d.device?.toString() || '0');
                }
            }
            if (Object.keys(userDeviceUpdates).length > 0) {
                try {
                    await authState.keys.set({ 'device-list': userDeviceUpdates });
                    logger.debug({ userCount: Object.keys(userDeviceUpdates).length }, 'stored user device lists for bulk migration');
                }
                catch (error) {
                    logger.warn({ error }, 'failed to store user device lists');
                }
            }
        }
        return deviceResults;
    };
    /**
     * Update Member Label
     */
    const updateMemberLabel = (jid, memberLabel) => {
        return relayMessage(jid, {
            protocolMessage: {
                type: index_js_1.proto.Message.ProtocolMessage.Type.GROUP_MEMBER_LABEL_CHANGE,
                memberLabel: {
                    label: memberLabel?.slice(0, 30),
                    labelTimestamp: (0, index_js_4.unixTimestampSeconds)()
                }
            }
        }, {
            additionalNodes: [
                {
                    tag: 'meta',
                    attrs: {
                        tag_reason: 'user_update',
                        appdata: 'member_tag'
                    },
                    content: undefined
                }
            ]
        });
    };
    const assertSessions = async (jids, force) => {
        let didFetchNewSession = false;
        const uniqueJids = [...new Set(jids)];
        const jidsRequiringFetch = [];
        logger.debug({ jids }, 'assertSessions call with jids');
        for (const jid of uniqueJids) {
            if (!force) {
                const sessionValidation = await signalRepository.validateSession(jid);
                if (sessionValidation.exists) {
                    continue;
                }
            }
            jidsRequiringFetch.push(jid);
        }
        if (jidsRequiringFetch.length) {
            // LID if mapped, otherwise original
            const wireJids = [
                ...jidsRequiringFetch.filter(jid => !!(0, index_js_6.isLidUser)(jid) || !!(0, index_js_6.isHostedLidUser)(jid)),
                ...((await signalRepository.lidMapping.getLIDsForPNs(jidsRequiringFetch.filter(jid => !!(0, index_js_6.isPnUser)(jid) || !!(0, index_js_6.isHostedPnUser)(jid)))) || []).map(a => a.lid)
            ];
            logger.debug({ jidsRequiringFetch, wireJids }, 'fetching sessions');
            const result = await query({
                tag: 'iq',
                attrs: {
                    xmlns: 'encrypt',
                    type: 'get',
                    to: index_js_6.S_WHATSAPP_NET
                },
                content: [
                    {
                        tag: 'key',
                        attrs: {},
                        content: wireJids.map(jid => {
                            const attrs = { jid };
                            if (force)
                                attrs.reason = 'identity';
                            return { tag: 'user', attrs };
                        })
                    }
                ]
            });
            await (0, index_js_4.parseAndInjectE2ESessions)(result, signalRepository);
            didFetchNewSession = true;
        }
        return didFetchNewSession;
    };
    const sendPeerDataOperationMessage = async (pdoMessage) => {
        //TODO: for later, abstract the logic to send a Peer Message instead of just PDO - useful for App State Key Resync with phone
        if (!authState.creds.me?.id) {
            throw new index_js_2.HttpError('Not authenticated');
        }
        const protocolMessage = {
            protocolMessage: {
                peerDataOperationRequestMessage: pdoMessage,
                type: index_js_1.proto.Message.ProtocolMessage.Type.PEER_DATA_OPERATION_REQUEST_MESSAGE
            }
        };
        const meJid = (0, index_js_6.jidNormalizedUser)(authState.creds.me.id);
        const msgId = await relayMessage(meJid, protocolMessage, {
            additionalAttributes: {
                category: 'peer',
                push_priority: 'high_force'
            },
            additionalNodes: [
                {
                    tag: 'meta',
                    attrs: { appdata: 'default' }
                }
            ]
        });
        return msgId;
    };
    const createParticipantNodes = async (recipientJids, message, extraAttrs, dsmMessage) => {
        if (!recipientJids.length) {
            return { nodes: [], shouldIncludeDeviceIdentity: false };
        }
        const patched = await patchMessageBeforeSending(message, recipientJids);
        const patchedMessages = Array.isArray(patched)
            ? patched
            : recipientJids.map(jid => ({ recipientJid: jid, message: patched }));
        let shouldIncludeDeviceIdentity = false;
        const meId = authState.creds.me.id;
        const meLid = authState.creds.me?.lid;
        const meLidUser = meLid ? (0, index_js_6.jidDecode)(meLid)?.user : null;
        const encryptionPromises = patchedMessages.map(async ({ recipientJid: jid, message: patchedMessage }) => {
            try {
                if (!jid)
                    return null;
                let msgToEncrypt = patchedMessage;
                if (dsmMessage) {
                    const { user: targetUser } = (0, index_js_6.jidDecode)(jid);
                    const { user: ownPnUser } = (0, index_js_6.jidDecode)(meId);
                    const ownLidUser = meLidUser;
                    const isOwnUser = targetUser === ownPnUser || (ownLidUser && targetUser === ownLidUser);
                    const isExactSenderDevice = jid === meId || (meLid && jid === meLid);
                    if (isOwnUser && !isExactSenderDevice) {
                        msgToEncrypt = dsmMessage;
                        logger.debug({ jid, targetUser }, 'Using DSM for own device');
                    }
                }
                const bytes = (0, index_js_4.encodeWAMessage)(msgToEncrypt);
                const mutexKey = jid;
                const node = await encryptionMutex.mutex(mutexKey, async () => {
                    const { type, ciphertext } = await signalRepository.encryptMessage({ jid, data: bytes });
                    if (type === 'pkmsg') {
                        shouldIncludeDeviceIdentity = true;
                    }
                    return {
                        tag: 'to',
                        attrs: { jid },
                        content: [
                            {
                                tag: 'enc',
                                attrs: { v: '2', type, ...(extraAttrs || {}) },
                                content: ciphertext
                            }
                        ]
                    };
                });
                return node;
            }
            catch (err) {
                logger.error({ jid, err }, 'Failed to encrypt for recipient');
                return null;
            }
        });
        const nodes = (await Promise.all(encryptionPromises)).filter(node => node !== null);
        if (recipientJids.length > 0 && nodes.length === 0) {
            throw new index_js_2.HttpError('All encryptions failed', { statusCode: 500 });
        }
        return { nodes, shouldIncludeDeviceIdentity };
    };
    const relayMessage = async (jid, message, { messageId: msgId, participant, additionalAttributes, additionalNodes, useUserDevicesCache, useCachedGroupMetadata, addBizAttributes, statusJidList }) => {
        const meId = (0, index_js_4.assertMeId)(authState.creds);
        const meLid = authState.creds.me?.lid;
        const isRetryResend = Boolean(participant?.jid);
        let shouldIncludeDeviceIdentity = isRetryResend;
        const statusJid = 'status@broadcast';
        const { user, server } = (0, index_js_6.jidDecode)(jid);
        const isGroup = server === 'g.us';
        const isStatus = jid === statusJid;
        const isLid = server === 'lid';
        const isNewsletter = server === 'newsletter';
        const isGroupOrStatus = isGroup || isStatus;
        const finalJid = jid;
        msgId = msgId || (0, index_js_4.generateMessageIDV2)(meId);
        useUserDevicesCache = useUserDevicesCache !== false;
        useCachedGroupMetadata = useCachedGroupMetadata !== false && !isStatus;
        const participants = [];
        const destinationJid = !isStatus ? finalJid : statusJid;
        const binaryNodeContent = [];
        const devices = [];
        let reportingMessage;
        const meMsg = {
            deviceSentMessage: {
                destinationJid,
                message
            },
            messageContextInfo: message.messageContextInfo
        };
        const extraAttrs = {};
        if (participant) {
            if (!isGroup && !isStatus) {
                additionalAttributes = { ...additionalAttributes, device_fanout: 'false' };
            }
            const { user, device } = (0, index_js_6.jidDecode)(participant.jid);
            devices.push({
                user,
                device,
                jid: participant.jid
            });
        }
        await authState.keys.transaction(async () => {
            // Kage: actualización de compatibilidad.
            const innerMessage = (0, index_js_4.normalizeMessageContent)(message);
            const mediaType = getMediaType(innerMessage);
            if (mediaType) {
                extraAttrs['mediatype'] = mediaType;
            }
            if (isNewsletter) {
                const patched = patchMessageBeforeSending ? await patchMessageBeforeSending(message, []) : message;
                const bytes = (0, index_js_4.encodeNewsletterMessage)(patched);
                // Kage: actualización de compatibilidad.
                if (additionalNodes && additionalNodes.length > 0) {
                    ;
                    binaryNodeContent.push(...additionalNodes);
                }
                binaryNodeContent.push({
                    tag: 'plaintext',
                    attrs: extraAttrs, // Kage: actualización de compatibilidad.
                    content: bytes
                });
                const stanza = {
                    tag: 'message',
                    attrs: {
                        to: jid,
                        id: msgId,
                        type: getMessageType(innerMessage),
                        ...(additionalAttributes || {})
                    },
                    content: binaryNodeContent
                };
                logger.debug({ msgId }, `sending newsletter message to ${jid}`);
                await sendNode(stanza);
                return;
            }
            // Kage: actualización de compatibilidad.
            const isNeedMetaAttrs = innerMessage?.pinInChatMessage || innerMessage?.keepInChatMessage || innerMessage?.reactionMessage;
            // Kage: actualización de compatibilidad.
            const isGroupStatus = message?.groupStatusMessage || message?.groupStatusMessageV2;
            const isPollUpdate = innerMessage?.pollUpdateMessage;
            if (isNeedMetaAttrs || isGroupStatus || isPollUpdate) {
                const metaAttrs = {};
                if (isNeedMetaAttrs) {
                    metaAttrs.content_type = 'add_on';
                }
                if (isPollUpdate && !isGroupStatus) {
                    metaAttrs.polltype = 'vote';
                }
                if (isGroupStatus) {
                    metaAttrs.is_group_status = 'true';
                }
                binaryNodeContent.push({
                    tag: 'meta',
                    attrs: metaAttrs,
                    content: undefined
                });
            }
            if (isNeedMetaAttrs || innerMessage?.protocolMessage?.memberLabel || innerMessage?.protocolMessage?.editedMessage || innerMessage?.protocolMessage?.mediaNotifyMessage) {
                extraAttrs['decrypt-fail'] = 'hide'; // todo: expand for reactions and other types
            }
            // Kage: actualización de compatibilidad.
            if (innerMessage?.interactiveResponseMessage?.nativeFlowResponseMessage) {
                extraAttrs['native_flow_name'] = innerMessage.interactiveResponseMessage.nativeFlowResponseMessage.name;
            }
            if (isGroupOrStatus && !isRetryResend) {
                const [groupData, senderKeyMap] = await Promise.all([
                    (async () => {
                        let groupData = useCachedGroupMetadata && cachedGroupMetadata ? await cachedGroupMetadata(jid) : undefined; // todo: should we rely on the cache specially if the cache is outdated and the metadata has new fields?
                        if (groupData && Array.isArray(groupData?.participants)) {
                            logger.trace({ jid, participants: groupData.participants.length }, 'using cached group metadata');
                        }
                        else if (!isStatus) {
                            groupData = await groupMetadata(jid); // TODO: start storing group participant list + addr mode in Signal & stop relying on this
                        }
                        return groupData;
                    })(),
                    (async () => {
                        if (!participant && !isStatus) {
                            // what if sender memory is less accurate than the cached metadata
                            // on participant change in group, we should do sender memory manipulation
                            const result = await authState.keys.get('sender-key-memory', [jid]); // TODO: check out what if the sender key memory doesn't include the LID stuff now?
                            return result[jid] || {};
                        }
                        return {};
                    })()
                ]);
                const participantsList = groupData ? groupData.participants.map(p => p.id) : [];
                if (groupData?.ephemeralDuration && groupData.ephemeralDuration > 0) {
                    additionalAttributes = {
                        ...additionalAttributes,
                        expiration: groupData.ephemeralDuration.toString()
                    };
                }
                if (isStatus && statusJidList) {
                    participantsList.push(...statusJidList);
                }
                const additionalDevices = await getUSyncDevices(participantsList, !!useUserDevicesCache, false);
                devices.push(...additionalDevices);
                if (isGroup) {
                    additionalAttributes = {
                        ...additionalAttributes,
                        addressing_mode: groupData?.addressingMode || 'lid'
                    };
                }
                const patched = await patchMessageBeforeSending(message);
                if (Array.isArray(patched)) {
                    throw new index_js_2.HttpError('Per-jid patching is not supported in groups');
                }
                const bytes = (0, index_js_4.encodeWAMessage)(patched);
                reportingMessage = patched;
                const groupAddressingMode = additionalAttributes?.['addressing_mode'] || groupData?.addressingMode || 'lid';
                const groupSenderIdentity = groupAddressingMode === 'lid' && meLid ? meLid : meId;
                const { ciphertext, senderKeyDistributionMessage } = await signalRepository.encryptGroupMessage({
                    group: destinationJid,
                    data: bytes,
                    meId: groupSenderIdentity
                });
                const senderKeyRecipients = [];
                for (const device of devices) {
                    const deviceJid = device.jid;
                    const hasKey = !!senderKeyMap[deviceJid];
                    if ((!hasKey || !!participant) &&
                        !(0, index_js_6.isHostedLidUser)(deviceJid) &&
                        !(0, index_js_6.isHostedPnUser)(deviceJid) &&
                        device.device !== 99) {
                        //todo: revamp all this logic
                        // the goal is to follow with what I said above for each group, and instead of a true false map of ids, we can set an array full of those the app has already sent pkmsgs
                        senderKeyRecipients.push(deviceJid);
                        senderKeyMap[deviceJid] = true;
                    }
                }
                if (senderKeyRecipients.length) {
                    logger.debug({ senderKeyJids: senderKeyRecipients }, 'sending new sender key');
                    const senderKeyMsg = {
                        senderKeyDistributionMessage: {
                            axolotlSenderKeyDistributionMessage: senderKeyDistributionMessage,
                            groupId: destinationJid
                        }
                    };
                    const senderKeySessionTargets = senderKeyRecipients;
                    await assertSessions(senderKeySessionTargets);
                    const result = await createParticipantNodes(senderKeyRecipients, senderKeyMsg, extraAttrs);
                    shouldIncludeDeviceIdentity = shouldIncludeDeviceIdentity || result.shouldIncludeDeviceIdentity;
                    participants.push(...result.nodes);
                }
                binaryNodeContent.push({
                    tag: 'enc',
                    attrs: { v: '2', type: 'skmsg', ...extraAttrs },
                    content: ciphertext
                });
                await authState.keys.set({ 'sender-key-memory': { [jid]: senderKeyMap } });
            }
            else {
                // ADDRESSING CONSISTENCY: Match own identity to conversation context
                // TODO: investigate if this is true
                let ownId = meId;
                if (isLid && meLid) {
                    ownId = meLid;
                    logger.debug({ to: jid, ownId }, 'Using LID identity for @lid conversation');
                }
                else {
                    logger.debug({ to: jid, ownId }, 'Using PN identity for @s.whatsapp.net conversation');
                }
                const { user: ownUser } = (0, index_js_6.jidDecode)(ownId);
                if (!participant) {
                    const patchedForReporting = await patchMessageBeforeSending(message, [jid]);
                    reportingMessage = Array.isArray(patchedForReporting)
                        ? patchedForReporting.find(item => item.recipientJid === jid) || patchedForReporting[0]
                        : patchedForReporting;
                }
                if (!isRetryResend) {
                    const targetUserServer = isLid ? 'lid' : 's.whatsapp.net';
                    devices.push({
                        user,
                        device: 0,
                        jid: (0, index_js_6.jidEncode)(user, targetUserServer, 0) // rajeh, todo: this entire logic is convoluted and weird.
                    });
                    if (user !== ownUser) {
                        const ownUserServer = isLid ? 'lid' : 's.whatsapp.net';
                        const ownUserForAddressing = isLid && meLid ? (0, index_js_6.jidDecode)(meLid).user : (0, index_js_6.jidDecode)(meId).user;
                        devices.push({
                            user: ownUserForAddressing,
                            device: 0,
                            jid: (0, index_js_6.jidEncode)(ownUserForAddressing, ownUserServer, 0)
                        });
                    }
                    if (additionalAttributes?.['category'] !== 'peer') {
                        // Clear placeholders and enumerate actual devices
                        devices.length = 0;
                        // Use conversation-appropriate sender identity
                        const senderIdentity = isLid && meLid
                            ? (0, index_js_6.jidEncode)((0, index_js_6.jidDecode)(meLid)?.user, 'lid', undefined)
                            : (0, index_js_6.jidEncode)((0, index_js_6.jidDecode)(meId)?.user, 's.whatsapp.net', undefined);
                        // Enumerate devices for sender and target with consistent addressing
                        const sessionDevices = await getUSyncDevices([senderIdentity, jid], true, false);
                        devices.push(...sessionDevices);
                        logger.debug({
                            deviceCount: devices.length,
                            devices: devices.map(d => `${d.user}:${d.device}@${(0, index_js_6.jidDecode)(d.jid)?.server}`)
                        }, 'Device enumeration complete with unified addressing');
                    }
                }
                const allRecipients = [];
                const meRecipients = [];
                const otherRecipients = [];
                const { user: mePnUser } = (0, index_js_6.jidDecode)(meId);
                const { user: meLidUser } = meLid ? (0, index_js_6.jidDecode)(meLid) : { user: null };
                for (const { user, jid } of devices) {
                    const isExactSenderDevice = jid === meId || (meLid && jid === meLid);
                    if (isExactSenderDevice) {
                        logger.debug({ jid, meId, meLid }, 'Skipping exact sender device (whatsmeow pattern)');
                        continue;
                    }
                    // Check if this is our device (could match either PN or LID user)
                    const isMe = user === mePnUser || user === meLidUser;
                    if (isMe) {
                        meRecipients.push(jid);
                    }
                    else {
                        otherRecipients.push(jid);
                    }
                    allRecipients.push(jid);
                }
                await assertSessions(allRecipients);
                const [{ nodes: meNodes, shouldIncludeDeviceIdentity: s1 }, { nodes: otherNodes, shouldIncludeDeviceIdentity: s2 }] = await Promise.all([
                    // For own devices: use DSM if available (1:1 chats only)
                    createParticipantNodes(meRecipients, meMsg || message, extraAttrs),
                    createParticipantNodes(otherRecipients, message, extraAttrs, meMsg)
                ]);
                participants.push(...meNodes);
                participants.push(...otherNodes);
                if (meRecipients.length > 0 || otherRecipients.length > 0) {
                    extraAttrs['phash'] = (0, index_js_4.generateParticipantHashV2)([...meRecipients, ...otherRecipients]);
                }
                shouldIncludeDeviceIdentity = shouldIncludeDeviceIdentity || s1 || s2;
            }
            if (isRetryResend) {
                const isParticipantLid = (0, index_js_6.isLidUser)(participant.jid);
                const isMe = (0, index_js_6.areJidsSameUser)(participant.jid, isParticipantLid ? meLid : meId);
                let messageToSend = message;
                if (isGroupOrStatus) {
                    let groupSenderIdentity;
                    if (meLid && (await signalRepository.hasSenderKey({ group: destinationJid, meId: meLid }))) {
                        groupSenderIdentity = meLid;
                    }
                    else if (await signalRepository.hasSenderKey({ group: destinationJid, meId })) {
                        groupSenderIdentity = meId;
                    }
                    if (groupSenderIdentity) {
                        try {
                            const skdm = await signalRepository.getSenderKeyDistributionMessage({
                                group: destinationJid,
                                meId: groupSenderIdentity
                            });
                            messageToSend = {
                                ...message,
                                senderKeyDistributionMessage: {
                                    groupId: destinationJid,
                                    axolotlSenderKeyDistributionMessage: skdm
                                }
                            };
                        }
                        catch (err) {
                            logger.warn({ err, jid: destinationJid }, 'failed to build SKDM for retry, sending without it');
                        }
                    }
                }
                const encodedMessageToSend = isMe
                    ? (0, index_js_4.encodeWAMessage)({
                        deviceSentMessage: {
                            destinationJid,
                            message: messageToSend
                        }
                    })
                    : (0, index_js_4.encodeWAMessage)(messageToSend);
                const { type, ciphertext: encryptedContent } = await signalRepository.encryptMessage({
                    data: encodedMessageToSend,
                    jid: participant.jid
                });
                binaryNodeContent.push({
                    tag: 'enc',
                    attrs: {
                        v: '2',
                        type,
                        count: (participant.count || 0).toString()
                    },
                    content: encryptedContent
                });
            }
            if (participants.length) {
                if (additionalAttributes?.['category'] === 'peer') {
                    const peerNode = participants[0]?.content?.[0];
                    if (peerNode) {
                        binaryNodeContent.push(peerNode); // push only enc
                    }
                }
                else {
                    binaryNodeContent.push({
                        tag: 'participants',
                        attrs: {},
                        content: participants
                    });
                }
            }
            const stanza = {
                tag: 'message',
                attrs: {
                    id: msgId,
                    to: destinationJid,
                    type: getMessageType(innerMessage),
                    ...(additionalAttributes || {})
                },
                content: binaryNodeContent
            };
            // if the participant to send to is explicitly specified (generally retry recp)
            // ensure the message is only sent to that person
            // if a retry receipt is sent to everyone -- it'll fail decryption for everyone else who received the msg
            if (participant) {
                if ((0, index_js_6.isJidGroup)(destinationJid)) {
                    stanza.attrs.to = destinationJid;
                    stanza.attrs.participant = participant.jid;
                }
                else if ((0, index_js_6.areJidsSameUser)(participant.jid, meId)) {
                    stanza.attrs.to = participant.jid;
                    stanza.attrs.recipient = destinationJid;
                }
                else {
                    stanza.attrs.to = participant.jid;
                }
            }
            else {
                stanza.attrs.to = destinationJid;
            }
            if (shouldIncludeDeviceIdentity) {
                ;
                stanza.content.push({
                    tag: 'device-identity',
                    attrs: {},
                    content: (0, index_js_4.encodeSignedDeviceIdentity)(authState.creds.account, true)
                });
                logger.debug({ jid }, 'adding device identity');
            }
            if (!isNewsletter &&
                !isRetryResend &&
                reportingMessage?.messageContextInfo?.messageSecret &&
                (0, reporting_utils_js_1.shouldIncludeReportingToken)(reportingMessage)) {
                try {
                    const encoded = (0, index_js_4.encodeWAMessage)(reportingMessage);
                    const reportingKey = {
                        id: msgId,
                        fromMe: true,
                        remoteJid: destinationJid,
                        participant: participant?.jid
                    };
                    const reportingNode = await (0, reporting_utils_js_1.getMessageReportingToken)(encoded, reportingMessage, reportingKey);
                    if (reportingNode) {
                        ;
                        stanza.content.push(reportingNode);
                        logger.trace({ jid }, 'added reporting token to message');
                    }
                }
                catch (error) {
                    logger.warn({ jid, trace: error?.stack }, 'failed to attach reporting token');
                }
            }
            // WA Web never attaches tctoken to peer (AppStateSync) messages — server rejects with 479
            const isPeerMessage = additionalAttributes?.['category'] === 'peer';
            const is1on1Send = !isGroup && !isRetryResend && !isStatus && !isNewsletter && !isPeerMessage;
            // Resolve destination to LID for tctoken storage — matches Signal session key pattern
            const tcTokenJid = is1on1Send ? await (0, tc_token_utils_js_1.resolveTcTokenJid)(destinationJid, getLIDForPN) : destinationJid;
            const contactTcTokenData = is1on1Send ? await authState.keys.get('tctoken', [tcTokenJid]) : {};
            const existingTokenEntry = contactTcTokenData[tcTokenJid];
            let tcTokenBuffer = existingTokenEntry?.token;
            // Treat expired tokens the same as missing — clear from cache
            if (tcTokenBuffer?.length && (0, tc_token_utils_js_1.isTcTokenExpired)(existingTokenEntry?.timestamp)) {
                logger.debug({ jid: destinationJid, timestamp: existingTokenEntry?.timestamp }, 'tctoken expired, clearing');
                tcTokenBuffer = undefined;
                // Preserve senderTimestamp so the fire-and-forget issuance dedupe survives cleanup.
                const cleared = existingTokenEntry?.senderTimestamp !== undefined
                    ? { token: Buffer.alloc(0), senderTimestamp: existingTokenEntry.senderTimestamp }
                    : null;
                try {
                    await authState.keys.set({ tctoken: { [tcTokenJid]: cleared } });
                }
                catch (err) {
                    logger.debug({ jid: destinationJid, err: err?.message }, 'failed to persist tctoken expiry cleanup');
                }
            }
            if (tcTokenBuffer?.length && sock.serverProps.privacyTokenOn1to1) {
                ;
                stanza.content.push({
                    tag: 'tctoken',
                    attrs: {},
                    content: tcTokenBuffer
                });
            }
            let alreadyHasBizNode = false;
            if (additionalNodes && additionalNodes.length > 0) {
                ;
                stanza.content.push(...additionalNodes);
                alreadyHasBizNode = !addBizAttributes &&
                    additionalNodes.some(node => node.tag === 'biz');
            }
            // Kage: actualización de compatibilidad.
            if ((!alreadyHasBizNode && (0, index_js_4.shouldIncludeBizBinaryNode)(innerMessage)) || addBizAttributes) {
                const bizNode = (0, index_js_6.getBizBinaryNode)(innerMessage);
                stanza.content.push(bizNode);
            }
            logger.debug({ msgId }, `sending message to ${participants.length} devices`);
            await sendNode(stanza);
            // Fire-and-forget: issue our token to the contact AFTER message send.
            // WA Web skips protocol messages and PSA/bot contacts (TcTokenChatAction: isRegularUser)
            const isProtocolMsg = !!innerMessage?.protocolMessage;
            const isBotOrPSA = destinationJid === index_js_6.PSA_WID || (0, index_js_6.isJidBot)(destinationJid) || (0, index_js_6.isJidMetaAI)(destinationJid);
            if (is1on1Send &&
                !isProtocolMsg &&
                !isBotOrPSA &&
                (0, tc_token_utils_js_1.shouldSendNewTcToken)(existingTokenEntry?.senderTimestamp) &&
                !inFlightTcTokenIssuance.has(tcTokenJid)) {
                inFlightTcTokenIssuance.add(tcTokenJid);
                const issueTimestamp = (0, index_js_4.unixTimestampSeconds)();
                const getPNForLID = signalRepository.lidMapping.getPNForLID.bind(signalRepository.lidMapping);
                (0, tc_token_utils_js_1.resolveIssuanceJid)(destinationJid, sock.serverProps.lidTrustedTokenIssueToLid, getLIDForPN, getPNForLID)
                    .then(issueJid => issuePrivacyTokens([issueJid], issueTimestamp))
                    .then(async (result) => {
                    await (0, tc_token_utils_js_1.storeTcTokensFromIqResult)({
                        result,
                        fallbackJid: tcTokenJid,
                        keys: authState.keys,
                        getLIDForPN
                    });
                    const currentData = await authState.keys.get('tctoken', [tcTokenJid]);
                    const currentEntry = currentData[tcTokenJid];
                    const indexWrite = await (0, tc_token_utils_js_1.buildMergedTcTokenIndexWrite)(authState.keys, [tcTokenJid]);
                    await authState.keys.set({
                        tctoken: {
                            [tcTokenJid]: {
                                token: Buffer.alloc(0),
                                ...currentEntry,
                                senderTimestamp: issueTimestamp
                            },
                            ...indexWrite
                        }
                    });
                })
                    .catch(err => {
                    logger.debug({ jid: destinationJid, err: err?.message }, 'fire-and-forget tctoken issuance failed');
                })
                    .finally(() => {
                    inFlightTcTokenIssuance.delete(tcTokenJid);
                });
            }
            // Add message to retry cache if enabled
            if (messageRetryManager && !participant) {
                messageRetryManager.addRecentMessage(destinationJid, msgId, message);
            }
        }, meId);
        return msgId;
    };
    const getMessageType = (message) => {
        if (!message)
            return 'text';
        if (message.reactionMessage || message.encReactionMessage) {
            return 'reaction';
        }
        if (message.pollCreationMessage ||
            message.pollCreationMessageV2 ||
            message.pollCreationMessageV3 ||
            message.pollCreationMessageV5 ||
            message.pollCreationMessageV6 ||
            message.pollUpdateMessage) {
            return 'poll';
        }
        if (message.eventMessage) {
            return 'event';
        }
        if (getMediaType(message) !== '') {
            return 'media';
        }
        return 'text';
    };
    const getMediaType = (message) => {
        if (message.imageMessage) {
            return 'image';
        }
        else if (message.videoMessage) {
            return message.videoMessage.gifPlayback ? 'gif' : 'video';
        }
        else if (message.stickerMessage) {
            return message.stickerMessage.isLottie ? '1p_sticker' : message.stickerMessage.isAvatar ? 'avatar_sticker' : 'sticker';
        }
        else if (message.audioMessage) {
            return message.audioMessage.ptt ? 'ptt' : 'audio';
        }
        else if (message.albumMessage) {
            return 'collection';
        }
        else if (message.contactMessage) {
            return 'vcard';
        }
        else if (message.documentMessage) {
            return 'document';
        }
        else if (message.contactsArrayMessage) {
            return 'contact_array';
        }
        else if (message.liveLocationMessage) {
            return 'livelocation';
        }
        else if (message.stickerPackMessage) {
            return 'sticker_pack';
        }
        else if (message.listMessage) {
            return 'list';
        }
        else if (message.listResponseMessage) {
            return 'list_response';
        }
        else if (message.buttonsResponseMessage) {
            return 'buttons_response';
        }
        else if (message.orderMessage) {
            return 'order';
        }
        else if (message.productMessage) {
            return 'product';
        }
        else if (message.interactiveResponseMessage) {
            return 'native_flow_response';
        }
        else if (message.extendedTextMessage?.matchedText || message.groupInviteMessage) {
            return 'url';
        }
        // Kage: nota de compatibilidad.
        else if ((message.extendedTextMessage?.text || message.conversation || '').includes('://wa.me/c/')) {
            return 'cataloglink';
        }
        else if ((message.extendedTextMessage?.text || message.conversation || '').includes('://wa.me/p/')) {
            return 'productlink';
        }
        return '';
    };
    const issuePrivacyTokens = async (jids, timestamp) => {
        const t = (timestamp ?? (0, index_js_4.unixTimestampSeconds)()).toString();
        const result = await query({
            tag: 'iq',
            attrs: {
                to: index_js_6.S_WHATSAPP_NET,
                type: 'set',
                xmlns: 'privacy'
            },
            content: [
                {
                    tag: 'tokens',
                    attrs: {},
                    content: jids.map(jid => ({
                        tag: 'token',
                        attrs: {
                            jid: (0, index_js_6.jidNormalizedUser)(jid),
                            t,
                            type: 'trusted_contact'
                        }
                    }))
                }
            ]
        });
        return result;
    };
    const waUploadToServer = (0, index_js_4.getWAUploadToServer)(config, refreshMediaConn);
    const waitForMsgMediaUpdate = (0, index_js_4.bindWaitForEvent)(ev, 'messages.media-update');
    registerSocketEndHandler(() => {
        if (!config.userDevicesCache && userDevicesCache.close) {
            userDevicesCache.close();
        }
        mediaConn = undefined;
        if (messageRetryManager) {
            messageRetryManager.flushAll();
        }
    });
    return {
        ...sock,
        userDevicesCache,
        devicesMutex,
        issuePrivacyTokens,
        assertSessions,
        relayMessage,
        sendReceipt,
        sendReceipts,
        readMessages,
        refreshMediaConn,
        // Function (not getter) so the spread in chats.ts preserves the live closure binding.
        getMediaHost: () => mediaHost,
        waUploadToServer,
        fetchPrivacySettings,
        sendPeerDataOperationMessage,
        createParticipantNodes,
        getUSyncDevices,
        messageRetryManager,
        updateMemberLabel,
        updateMediaMessage: async (message) => {
            const content = (0, index_js_4.assertMediaContent)(message.message);
            const mediaKey = content.mediaKey;
            const meId = authState.creds.me.id;
            const node = (0, index_js_4.encryptMediaRetryRequest)(message.key, mediaKey, meId);
            let error = undefined;
            await Promise.all([
                sendNode(node),
                waitForMsgMediaUpdate(async (update) => {
                    const result = update.find(c => c.key.id === message.key.id);
                    if (result) {
                        if (result.error) {
                            error = result.error;
                        }
                        else {
                            try {
                                const media = (0, index_js_4.decryptMediaRetryData)(result.media, mediaKey, result.key.id);
                                if (media.result !== index_js_1.proto.MediaRetryNotification.ResultType.SUCCESS) {
                                    const resultStr = index_js_1.proto.MediaRetryNotification.ResultType[media.result];
                                    throw new index_js_2.HttpError(`Media re-upload failed by device (${resultStr})`, {
                                        data: media,
                                        statusCode: (0, index_js_4.getStatusCodeForMediaRetry)(media.result) || 404
                                    });
                                }
                                content.directPath = media.directPath;
                                content.url = (0, index_js_4.getUrlFromDirectPath)(content.directPath, mediaHost);
                                logger.debug({ directPath: media.directPath, key: result.key }, 'media update successful');
                            }
                            catch (err) {
                                error = err;
                            }
                        }
                        return true;
                    }
                })
            ]);
            if (error) {
                throw error;
            }
            ev.emit('messages.update', [{ key: message.key, update: { message: message.message } }]);
            return message;
        },
        // Kage: actualización de compatibilidad.
        sendMessage: async (jid, content, options = {}) => {
            var _a;
            const userJid = authState.creds.me.id;
            // Kage: actualización de compatibilidad.
            if (Array.isArray(jid)) {
                const { delayMs = 1500 } = options;
                const allUsers = new Set();
                const fullMsg = await (0, index_js_4.generateWAMessage)('status@broadcast', content, {
                    logger,
                    userJid,
                    upload: waUploadToServer,
                    mediaCache: config.mediaCache,
                    options: config.options,
                    ...options,
                    messageId: (0, index_js_4.generateMessageIDV2)(userJid)
                });
                for (const id of jid) {
                    if ((0, index_js_6.isJidGroup)(id)) {
                        try {
                            const groupData = (cachedGroupMetadata ? await cachedGroupMetadata(id) : null) || await groupMetadata(id);
                            for (const participant of groupData.participants) {
                                if (allUsers.has(participant.id))
                                    continue;
                                allUsers.add(participant.id);
                            }
                        }
                        catch (error) {
                            logger.error(`Error getting metadata group from ${id}: ${error}`);
                        }
                    }
                    else if (!allUsers.has(id)) {
                        allUsers.add(id);
                    }
                }
                await relayMessage('status@broadcast', fullMsg.message, {
                    messageId: fullMsg.key.id,
                    statusJidList: Array.from(allUsers),
                    additionalNodes: [
                        {
                            tag: 'meta',
                            attrs: {},
                            content: [
                                {
                                    tag: 'mentioned_users',
                                    attrs: {},
                                    content: jid.map(id => ({
                                        tag: 'to',
                                        attrs: { jid: id },
                                        content: undefined
                                    }))
                                }
                            ]
                        }
                    ]
                });
                if (config.emitOwnEvents) {
                    process.nextTick(async () => {
                        await messageMutex.mutex(() => upsertMessage(fullMsg, 'append'));
                    });
                }
                for (const id of jid) {
                    const isGroup = (0, index_js_6.isJidGroup)(id);
                    const sendType = isGroup ? 'groupStatusMentionMessage' : 'statusMentionMessage';
                    const mentionMsg = (0, index_js_4.generateWAMessageFromContent)(id, {
                        messageContextInfo: {
                            messageSecret: (0, node_crypto_1.randomBytes)(32)
                        },
                        [sendType]: {
                            message: {
                                protocolMessage: {
                                    key: fullMsg.key,
                                    type: 25
                                }
                            }
                        }
                    }, {
                        userJid
                    });
                    await relayMessage(id, mentionMsg.message, {
                        additionalNodes: [
                            {
                                tag: 'meta',
                                attrs: isGroup ?
                                    { is_group_status_mention: 'true' } :
                                    { is_status_mention: 'true' },
                                content: undefined
                            }
                        ]
                    });
                    if (config.emitOwnEvents) {
                        process.nextTick(async () => {
                            await messageMutex.mutex(() => upsertMessage(mentionMsg, 'append'));
                        });
                    }
                    await (0, index_js_4.delay)(delayMs);
                }
                return fullMsg;
            }
            else if ('disappearingMessagesInChat' in content && (0, index_js_6.isJidGroup)(jid)) {
                const { disappearingMessagesInChat } = content;
                const value = typeof disappearingMessagesInChat === 'boolean'
                    ? disappearingMessagesInChat
                        ? index_js_3.WA_DEFAULT_EPHEMERAL
                        : 0
                    : disappearingMessagesInChat;
                await groupToggleEphemeral(jid, value);
            }
            else {
                const fullMsg = await (0, index_js_4.generateWAMessage)(jid, content, {
                    logger,
                    userJid,
                    getUrlInfo: text => (0, link_preview_js_1.getUrlInfo)(text, {
                        thumbnailWidth: linkPreviewImageThumbnailWidth,
                        fetchOpts: {
                            timeout: 3000,
                            ...(httpRequestOptions || {})
                        },
                        logger,
                        uploadImage: generateHighQualityLinkPreview ? waUploadToServer : undefined
                    }),
                    //TODO: CACHE
                    getProfilePicUrl: sock.profilePictureUrl,
                    getCallLink: sock.createCallLink,
                    upload: waUploadToServer,
                    mediaCache: config.mediaCache,
                    options: config.options,
                    ...options,
                    messageId: (0, index_js_4.generateMessageIDV2)(userJid)
                });
                const isNewsletter = (0, index_js_6.isJidNewsletter)(jid);
                const isEventMsg = 'event' in content && !!content.event;
                const isDeleteMsg = 'delete' in content && !!content.delete;
                const isEditMsg = 'edit' in content && !!content.edit;
                const isPinMsg = 'pin' in content && !!content.pin;
                const isKeepMsg = 'keep' in content && !!content.keep;
                const isPollMsg = 'poll' in content && !!content.poll;
                const isQuizMsg = 'poll' in content && !!content.poll.pollType;
                const isAiMsg = 'ai' in content && !!content.ai;
                const isNeedBizAttrs = 'secureMetaServiceLabel' in content && !!content.secureMetaServiceLabel;
                const additionalAttributes = options.additionalAttributes || {};
                const additionalNodes = options.additionalNodes || [];
                // required for delete
                if (isDeleteMsg || isKeepMsg) {
                    // if the chat is a group, and I am not the author, then delete the message as an admin
                    if ((0, index_js_6.isJidGroup)(content.delete?.remoteJid) && !content.delete?.fromMe) {
                        additionalAttributes.edit = '8';
                    }
                    else {
                        additionalAttributes.edit = '7';
                    }
                }
                else if (isEditMsg) {
                    additionalAttributes.edit = isNewsletter ? '3' : '1';
                }
                else if (isPinMsg) {
                    additionalAttributes.edit = '2';
                }
                else if (isPollMsg) {
                    if (!isNewsletter && isQuizMsg) {
                        throw new index_js_2.HttpError('Quiz are only allowed for newsletter', { statusCode: 400 });
                    }
                    additionalNodes.push({
                        tag: 'meta',
                        attrs: {
                            // Kage: nota de compatibilidad.
                            polltype: isQuizMsg ? 'quiz_creation' : 'creation',
                            contenttype: isPollMsg && isNewsletter ? 'text' : undefined
                        },
                        content: undefined
                    });
                }
                else if (isEventMsg) {
                    additionalNodes.push({
                        tag: 'meta',
                        attrs: {
                            event_type: 'creation'
                        },
                        content: undefined
                    });
                }
                // Kage: actualización de compatibilidad.
                else if (isAiMsg) {
                    if (!((0, index_js_6.isPnUser)(jid) || (0, index_js_6.isLidUser)(jid))) {
                        throw new index_js_2.HttpError('AI icon on message are only allowed in private chat', { statusCode: 400 });
                    }
                    if ('messageContextInfo' in fullMsg.message && !!fullMsg.message.messageContextInfo) {
                        fullMsg.message.messageContextInfo.supportPayload = index_js_3.BIZ_BOT_SUPPORT_PAYLOAD;
                    }
                    ;
                    additionalNodes.push({
                        tag: 'bot',
                        attrs: {
                            biz_bot: '1'
                        },
                        content: undefined
                    });
                    delete content.ai;
                }
                await relayMessage(jid, fullMsg.message, {
                    messageId: fullMsg.key.id,
                    useCachedGroupMetadata: options.useCachedGroupMetadata,
                    addBizAttributes: isNeedBizAttrs,
                    statusJidList: options.statusJidList,
                    additionalAttributes,
                    additionalNodes
                });
                if (config.emitOwnEvents) {
                    process.nextTick(async () => {
                        await messageMutex.mutex(() => upsertMessage(fullMsg, 'append'));
                    });
                }
                // Kage: actualización de compatibilidad.
                // Kage: nota de compatibilidad.
                if ('album' in content) {
                    const { delayMs = 1500 } = options;
                    for (const albumMedia of content.album) {
                        const albumMsg = await (0, index_js_4.generateWAMessage)(jid, albumMedia, {
                            logger,
                            userJid,
                            upload: waUploadToServer,
                            mediaCache: config.mediaCache,
                            options: config.options,
                            ...options,
                            messageId: (0, index_js_4.generateMessageIDV2)(userJid)
                        });
                        if (!(0, index_js_4.hasValidAlbumMedia)((0, index_js_4.normalizeMessageContent)(albumMsg.message))) {
                            throw new index_js_2.HttpError('Invalid message type for album', { statusCode: 400 });
                        }
                        (_a = albumMsg.message).messageContextInfo || (_a.messageContextInfo = {});
                        albumMsg.message.messageContextInfo.messageAssociation = {
                            parentMessageKey: fullMsg.key,
                            associationType: index_js_5.AssociationType.MEDIA_ALBUM
                        };
                        await relayMessage(jid, albumMsg.message, {
                            messageId: albumMsg.key.id,
                            useCachedGroupMetadata: options.useCachedGroupMetadata,
                            addBizAttributes: isNeedBizAttrs,
                            statusJidList: options.statusJidList,
                            additionalAttributes,
                            additionalNodes
                        });
                        if (config.emitOwnEvents) {
                            process.nextTick(async () => {
                                await messageMutex.mutex(() => upsertMessage(albumMsg, 'append'));
                            });
                        }
                        await (0, index_js_4.delay)(delayMs);
                    }
                }
                return fullMsg;
            }
        }
    };
};
exports.makeMessagesSocket = makeMessagesSocket;

return module.exports;
})();
for (const key of Object.keys(__kageModule136)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule136[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule136, configurable:true});
