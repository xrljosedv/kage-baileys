"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachAdvanced = void 0;
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
const attachAdvanced = (base, config) => {
    const { logger, linkPreviewImageThumbnailWidth, generateHighQualityLinkPreview, options: httpRequestOptions, patchMessageBeforeSending, cachedGroupMetadata, enableRecentMessageCache, maxMsgRetryCount } = config;
    const sock = base;
    const { ev, authState, messageMutex, signalRepository, upsertMessage, query, fetchPrivacySettings, sendNode, groupMetadata, groupToggleEphemeral, registerSocketEndHandler } = sock;
    const getLIDForPN = signalRepository.lidMapping.getLIDForPN.bind(signalRepository.lidMapping);
     




    const inFlightTcTokenIssuance = new Set();
    const userDevicesCache = config.userDevicesCache ||
        (0, index_js_2.createCache)({
            ttl: index_js_3.DEFAULT_CACHE_TTLS.USER_DEVICES  
        });
     
    const devicesMutex = (0, make_mutex_js_1.makeMutex)();
     
    const messageRetryManager = enableRecentMessageCache ? new index_js_4.MessageRetryManager(logger, maxMsgRetryCount) : null;
     
    const encryptionMutex = (0, make_mutex_js_1.makeKeyedMutex)();
     
    const mediaConnMutex = (0, make_mutex_js_1.makeKeyedMutex)();
    let mediaConn;
     
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
     
    const sendReceipts = async (keys, type) => {
        const recps = (0, index_js_4.aggregateMessageKeysNotFromMe)(keys);
        for (const { jid, participant, messageIds } of recps) {
            await sendReceipt(jid, participant, messageIds, type);
        }
    };
     
    const readMessages = async (keys) => {
        const privacySettings = await fetchPrivacySettings();
         
        const readType = privacySettings.readreceipts === 'all' ? 'read' : 'read-self';
        await sendReceipts(keys, readType);
    };
     
    const getUSyncDevices = base.getUSyncDevices.bind(base);
     


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
    const assertSessions = base.assertSessions.bind(base);
    const sendPeerDataOperationMessage = async (pdoMessage) => {
         
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
    const createParticipantNodes = base.createParticipantNodes.bind(base);
    const relayMessage = base.relayMessage.bind(base);
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
    const waUploadToServer = require('../Utils/messages-media.js')[Symbol.for('kage.advanced')].getWAUploadToServer(config, refreshMediaConn);
    const waitForMsgMediaUpdate = (0, index_js_4.bindWaitForEvent)(ev, 'messages.media-update');
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
         
        sendMessage: async (jid, content, options = {}) => {
            var _a;
            const userJid = authState.creds.me.id;
             
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
                 
                if (isDeleteMsg || isKeepMsg) {
                     
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
exports.attachAdvanced = attachAdvanced;
