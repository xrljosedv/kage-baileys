"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertMediaContent = exports.downloadMediaMessage = exports.aggregateMessageKeysNotFromMe = exports.updateMessageWithPollUpdate = exports.updateMessageWithReaction = exports.updateMessageWithReceipt = exports.getDevice = exports.extractMessageContent = exports.normalizeMessageContent = exports.getContentType = exports.generateWAMessage = exports.generateWAMessageFromContent = exports.generateWAMessageContent = exports.generateForwardMessageContent = exports.prepareDisappearingMessageSettingContent = exports.prepareWAMessageMedia = exports.generateLinkPreviewIfRequired = exports.extractUrlFromText = void 0;
exports.getAggregateVotesInPollMessage = getAggregateVotesInPollMessage;
const boom_1 = require("@hapi/boom");
const axios_1 = __importDefault(require("axios"));
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const WAProto_1 = require("../../WAProto");
const Defaults_1 = require("../Defaults");
const Types_1 = require("../Types");
const WABinary_1 = require("../WABinary");
const crypto_2 = require("./crypto");
const generics_1 = require("./generics");
const messages_media_1 = require("./messages-media");
const MIMETYPE_MAP = {
    image: 'image/jpeg',
    video: 'video/mp4',
    document: 'application/pdf',
    audio: 'audio/ogg; codecs=opus',
    sticker: 'image/webp',
    'product-catalog-image': 'image/jpeg',
};
const MessageTypeProto = {
    'image': Types_1.WAProto.Message.ImageMessage,
    'video': Types_1.WAProto.Message.VideoMessage,
    'audio': Types_1.WAProto.Message.AudioMessage,
    'sticker': Types_1.WAProto.Message.StickerMessage,
    'document': Types_1.WAProto.Message.DocumentMessage,
};
const ButtonType = WAProto_1.proto.Message.ButtonsMessage.HeaderType;
 




const extractUrlFromText = (text) => { var _a; return (_a = text.match(Defaults_1.URL_REGEX)) === null || _a === void 0 ? void 0 : _a[0]; };
exports.extractUrlFromText = extractUrlFromText;
const generateLinkPreviewIfRequired = async (text, getUrlInfo, logger) => {
    const url = (0, exports.extractUrlFromText)(text);
    if (!!getUrlInfo && url) {
        try {
            const urlInfo = await getUrlInfo(url);
            return urlInfo;
        }
        catch (error) {  
            logger === null || logger === void 0 ? void 0 : logger.warn({ trace: error.stack }, 'url generation failed');
        }
    }
};
exports.generateLinkPreviewIfRequired = generateLinkPreviewIfRequired;
const assertColor = async (color) => {
    let assertedColor;
    if (typeof color === 'number') {
        assertedColor = color > 0 ? color : 0xffffffff + Number(color) + 1;
    }
    else {
        let hex = color.trim().replace('#', '');
        if (hex.length <= 6) {
            hex = 'FF' + hex.padStart(6, '0');
        }
        assertedColor = parseInt(hex, 16);
        return assertedColor;
    }
};
const prepareWAMessageMedia = async (message, options) => {
    const logger = options.logger;
    let mediaType;
    for (const key of Defaults_1.MEDIA_KEYS) {
        if (key in message) {
            mediaType = key;
        }
    }
    if (!mediaType) {
        throw new boom_1.Boom('Invalid media type', { statusCode: 400 });
    }
    const uploadData = {
        ...message,
        media: message[mediaType]
    };
    delete uploadData[mediaType];
     
    const cacheableKey = typeof uploadData.media === 'object' &&
        ('url' in uploadData.media) &&
        !!uploadData.media.url &&
        !!options.mediaCache && (
     
    mediaType + ':' + uploadData.media.url.toString());
    if (mediaType === 'document' && !uploadData.fileName) {
        uploadData.fileName = 'file';
    }
    if (!uploadData.mimetype) {
        uploadData.mimetype = MIMETYPE_MAP[mediaType];
    }
     
    if (cacheableKey) {
        const mediaBuff = options.mediaCache.get(cacheableKey);
        if (mediaBuff) {
            logger === null || logger === void 0 ? void 0 : logger.debug({ cacheableKey }, 'got media cache hit');
            const obj = Types_1.WAProto.Message.decode(mediaBuff);
            const key = `${mediaType}Message`;
            Object.assign(obj[key], { ...uploadData, media: undefined });
            return obj;
        }
    }
    const requiresDurationComputation = mediaType === 'audio' && typeof uploadData.seconds === 'undefined';
    const requiresThumbnailComputation = (mediaType === 'image' || mediaType === 'video') &&
        (typeof uploadData['jpegThumbnail'] === 'undefined');
    const requiresWaveformProcessing = mediaType === 'audio' && uploadData.ptt === true;
    const requiresAudioBackground = options.backgroundColor && mediaType === 'audio' && uploadData.ptt === true;
    const requiresOriginalForSomeProcessing = requiresDurationComputation || requiresThumbnailComputation;
    const { mediaKey, encWriteStream, bodyPath, fileEncSha256, fileSha256, fileLength, didSaveToTmpPath, } = await (options.newsletter ? messages_media_1.prepareStream : messages_media_1.encryptedStream)(uploadData.media, options.mediaTypeOverride || mediaType, {
        logger,
        saveOriginalFileIfRequired: requiresOriginalForSomeProcessing,
        opts: options.options
    });
     
    const fileEncSha256B64 = (options.newsletter ? fileSha256 : fileEncSha256 !== null && fileEncSha256 !== void 0 ? fileEncSha256 : fileSha256).toString('base64');
    const [{ mediaUrl, directPath, handle }] = await Promise.all([
        (async () => {
            const result = await options.upload(encWriteStream, { fileEncSha256B64, mediaType, timeoutMs: options.mediaUploadTimeoutMs });
            logger === null || logger === void 0 ? void 0 : logger.debug({ mediaType, cacheableKey }, 'uploaded media');
            return result;
        })(),
        (async () => {
            try {
                if (requiresThumbnailComputation) {
                    const { thumbnail, originalImageDimensions } = await (0, messages_media_1.generateThumbnail)(bodyPath, mediaType, options);
                    uploadData.jpegThumbnail = thumbnail;
                    if (!uploadData.width && originalImageDimensions) {
                        uploadData.width = originalImageDimensions.width;
                        uploadData.height = originalImageDimensions.height;
                        logger === null || logger === void 0 ? void 0 : logger.debug('set dimensions');
                    }
                    logger === null || logger === void 0 ? void 0 : logger.debug('generated thumbnail');
                }
                if (requiresDurationComputation) {
                    uploadData.seconds = await (0, messages_media_1.getAudioDuration)(bodyPath);
                    logger === null || logger === void 0 ? void 0 : logger.debug('computed audio duration');
                }
                if (requiresWaveformProcessing) {
                    uploadData.waveform = await (0, messages_media_1.getAudioWaveform)(bodyPath, logger);
                    logger === null || logger === void 0 ? void 0 : logger.debug('processed waveform');
                }
                if (requiresAudioBackground) {
                    uploadData.backgroundArgb = await assertColor(options.backgroundColor);
                    logger === null || logger === void 0 ? void 0 : logger.debug('computed backgroundColor audio status');
                }
            }
            catch (error) {
                logger === null || logger === void 0 ? void 0 : logger.warn({ trace: error.stack }, 'failed to obtain extra info');
            }
        })(),
    ])
        .finally(async () => {
        if (!Buffer.isBuffer(encWriteStream)) {
            encWriteStream.destroy();
        }
         
        if (didSaveToTmpPath && bodyPath) {
            try {
                await fs_1.promises.access(bodyPath);
                await fs_1.promises.unlink(bodyPath);
                logger === null || logger === void 0 ? void 0 : logger.debug('removed tmp file');
            }
            catch (error) {
                logger === null || logger === void 0 ? void 0 : logger.warn('failed to remove tmp file');
            }
        }
    });
    const obj = Types_1.WAProto.Message.fromObject({
        [`${mediaType}Message`]: MessageTypeProto[mediaType].fromObject({
            url: handle ? undefined : mediaUrl,
            directPath,
            mediaKey: mediaKey,
            fileEncSha256: fileEncSha256,
            fileSha256,
            fileLength,
            mediaKeyTimestamp: handle ? undefined : (0, generics_1.unixTimestampSeconds)(),
            ...uploadData,
            media: undefined
        })
    });
    if (uploadData.ptv) {
        obj.ptvMessage = obj.videoMessage;
        delete obj.videoMessage;
    }
    if (cacheableKey) {
        logger === null || logger === void 0 ? void 0 : logger.debug({ cacheableKey }, 'set cache');
        options.mediaCache.set(cacheableKey, Types_1.WAProto.Message.encode(obj).finish());
    }
    return obj;
};
exports.prepareWAMessageMedia = prepareWAMessageMedia;
const prepareDisappearingMessageSettingContent = (ephemeralExpiration) => {
    ephemeralExpiration = ephemeralExpiration || 0;
    const content = {
        ephemeralMessage: {
            message: {
                protocolMessage: {
                    type: Types_1.WAProto.Message.ProtocolMessage.Type.EPHEMERAL_SETTING,
                    ephemeralExpiration
                }
            }
        }
    };
    return Types_1.WAProto.Message.fromObject(content);
};
exports.prepareDisappearingMessageSettingContent = prepareDisappearingMessageSettingContent;
 




const generateForwardMessageContent = (message, forceForward) => {
    var _a;
    let content = message.message;
    if (!content) {
        throw new boom_1.Boom('no content in message', { statusCode: 400 });
    }
     
    content = (0, exports.normalizeMessageContent)(content);
    content = WAProto_1.proto.Message.decode(WAProto_1.proto.Message.encode(content).finish());
    let key = Object.keys(content)[0];
    let score = ((_a = content[key].contextInfo) === null || _a === void 0 ? void 0 : _a.forwardingScore) || 0;
    score += message.key.fromMe && !forceForward ? 0 : 1;
    if (key === 'conversation') {
        content.extendedTextMessage = { text: content[key] };
        delete content.conversation;
        key = 'extendedTextMessage';
    }
    if (score > 0) {
        content[key].contextInfo = { forwardingScore: score, isForwarded: true };
    }
    else {
        content[key].contextInfo = {};
    }
    return content;
};
exports.generateForwardMessageContent = generateForwardMessageContent;
const generateWAMessageContent = async (message, options) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
    var _p, _q;
    let m = {};
    if ('text' in message) {
        const extContent = { text: message.text };
        let urlInfo = message.linkPreview;
        if (typeof urlInfo === 'undefined') {
            urlInfo = await (0, exports.generateLinkPreviewIfRequired)(message.text, options.getUrlInfo, options.logger);
        }
        if (urlInfo) {
            extContent.matchedText = urlInfo['matched-text'];
            extContent.jpegThumbnail = urlInfo.jpegThumbnail;
            extContent.description = urlInfo.description;
            extContent.title = urlInfo.title;
            extContent.previewType = 0;
            const img = urlInfo.highQualityThumbnail;
            if (img) {
                extContent.thumbnailDirectPath = img.directPath;
                extContent.mediaKey = img.mediaKey;
                extContent.mediaKeyTimestamp = img.mediaKeyTimestamp;
                extContent.thumbnailWidth = img.width;
                extContent.thumbnailHeight = img.height;
                extContent.thumbnailSha256 = img.fileSha256;
                extContent.thumbnailEncSha256 = img.fileEncSha256;
            }
        }
        if (options.backgroundColor) {
            extContent.backgroundArgb = await assertColor(options.backgroundColor);
        }
        if (options.font) {
            extContent.font = options.font;
        }
        m.extendedTextMessage = extContent;
    }
    else if ('contacts' in message) {
        const contactLen = message.contacts.contacts.length;
        if (!contactLen) {
            throw new boom_1.Boom('require atleast 1 contact', { statusCode: 400 });
        }
        if (contactLen === 1) {
            m.contactMessage = Types_1.WAProto.Message.ContactMessage.fromObject(message.contacts.contacts[0]);
        }
        else {
            m.contactsArrayMessage = Types_1.WAProto.Message.ContactsArrayMessage.fromObject(message.contacts);
        }
    }
    else if ('location' in message) {
        m.locationMessage = Types_1.WAProto.Message.LocationMessage.fromObject(message.location);
    }
    else if ('react' in message) {
        if (!message.react.senderTimestampMs) {
            message.react.senderTimestampMs = Date.now();
        }
        m.reactionMessage = Types_1.WAProto.Message.ReactionMessage.fromObject(message.react);
    }
    else if ('delete' in message) {
        m.protocolMessage = {
            key: message.delete,
            type: Types_1.WAProto.Message.ProtocolMessage.Type.REVOKE
        };
    }
    else if ('forward' in message) {
        m = (0, exports.generateForwardMessageContent)(message.forward, message.force);
    }
    else if ('disappearingMessagesInChat' in message) {
        const exp = typeof message.disappearingMessagesInChat === 'boolean' ?
            (message.disappearingMessagesInChat ? Defaults_1.WA_DEFAULT_EPHEMERAL : 0) :
            message.disappearingMessagesInChat;
        m = (0, exports.prepareDisappearingMessageSettingContent)(exp);
    }
    else if ('groupInvite' in message) {
        m.groupInviteMessage = {};
        m.groupInviteMessage.inviteCode = message.groupInvite.inviteCode;
        m.groupInviteMessage.inviteExpiration = message.groupInvite.inviteExpiration;
        m.groupInviteMessage.caption = message.groupInvite.text;
        m.groupInviteMessage.groupJid = message.groupInvite.jid;
        m.groupInviteMessage.groupName = message.groupInvite.subject;
         
         
        if (options.getProfilePicUrl) {
            const pfpUrl = await options.getProfilePicUrl(message.groupInvite.jid, 'preview');
            if (pfpUrl) {
                const resp = await axios_1.default.get(pfpUrl, { responseType: 'arraybuffer' });
                if (resp.status === 200) {
                    m.groupInviteMessage.jpegThumbnail = resp.data;
                }
            }
        }
    }
    else if ('pin' in message) {
        m.pinInChatMessage = {};
        m.messageContextInfo = {};
        m.pinInChatMessage.key = message.pin;
        m.pinInChatMessage.type = message.type;
        m.pinInChatMessage.senderTimestampMs = Date.now();
        m.messageContextInfo.messageAddOnDurationInSecs = message.type === 1 ? message.time || 86400 : 0;
    }
    else if ('keep' in message) {
        m.keepInChatMessage = {};
        m.keepInChatMessage.key = message.keep;
        m.keepInChatMessage.keepType = message.type;
        m.keepInChatMessage.timestampMs = Date.now();
    }
    else if ('call' in message) {
        m = {
            scheduledCallCreationMessage: {
                scheduledTimestampMs: (_a = message.call.time) !== null && _a !== void 0 ? _a : Date.now(),
                callType: (_b = message.call.type) !== null && _b !== void 0 ? _b : 1,
                title: message.call.title
            }
        };
    }
    else if ('paymentInvite' in message) {
        m.paymentInviteMessage = {
            serviceType: message.paymentInvite.type,
            expiryTimestamp: message.paymentInvite.expiry
        };
    }
    else if ('buttonReply' in message) {
        switch (message.type) {
            case 'template':
                m.templateButtonReplyMessage = {
                    selectedDisplayText: message.buttonReply.displayText,
                    selectedId: message.buttonReply.id,
                    selectedIndex: message.buttonReply.index,
                };
                break;
            case 'plain':
                m.buttonsResponseMessage = {
                    selectedButtonId: message.buttonReply.id,
                    selectedDisplayText: message.buttonReply.displayText,
                    type: WAProto_1.proto.Message.ButtonsResponseMessage.Type.DISPLAY_TEXT,
                };
                break;
        }
    }
    else if ('ptv' in message && message.ptv) {
        const { videoMessage } = await (0, exports.prepareWAMessageMedia)({ video: message.video }, options);
        m.ptvMessage = videoMessage;
    }
    else if ('product' in message) {
        const { imageMessage } = await (0, exports.prepareWAMessageMedia)({ image: message.product.productImage }, options);
        m.productMessage = Types_1.WAProto.Message.ProductMessage.fromObject({
            ...message,
            product: {
                ...message.product,
                productImage: imageMessage,
            }
        });
    }
    else if ('order' in message) {
        m.orderMessage = Types_1.WAProto.Message.OrderMessage.fromObject({
            orderId: message.order.id,
            thumbnail: message.order.thumbnail,
            itemCount: message.order.itemCount,
            status: message.order.status,
            surface: message.order.surface,
            orderTitle: message.order.title,
            message: message.order.text,
            sellerJid: message.order.seller,
            token: message.order.token,
            totalAmount1000: message.order.amount,
            totalCurrencyCode: message.order.currency
        });
    }
    else if ('listReply' in message) {
        m.listResponseMessage = { ...message.listReply };
    }
    else if ('poll' in message) {
        (_p = message.poll).selectableCount || (_p.selectableCount = 0);
        (_q = message.poll).toAnnouncementGroup || (_q.toAnnouncementGroup = false);
        if (!Array.isArray(message.poll.values)) {
            throw new boom_1.Boom('Invalid poll values', { statusCode: 400 });
        }
        if (message.poll.selectableCount < 0
            || message.poll.selectableCount > message.poll.values.length) {
            throw new boom_1.Boom(`poll.selectableCount in poll should be >= 0 and <= ${message.poll.values.length}`, { statusCode: 400 });
        }
        m.messageContextInfo = {
             
            messageSecret: message.poll.messageSecret || (0, crypto_1.randomBytes)(32),
        };
        const pollCreationMessage = {
            name: message.poll.name,
            selectableOptionsCount: message.poll.selectableCount,
            options: message.poll.values.map(optionName => ({ optionName })),
        };
        if (message.poll.toAnnouncementGroup) {
             
            m.pollCreationMessageV2 = pollCreationMessage;
        }
        else {
            if (message.poll.selectableCount === 1) {
                 
                m.pollCreationMessageV3 = pollCreationMessage;
            }
            else {
                 
                m.pollCreationMessage = pollCreationMessage;
            }
        }
    }
    else if ('event' in message) {
        m.messageContextInfo = {
            messageSecret: message.event.messageSecret || (0, crypto_1.randomBytes)(32),
        };
        m.eventMessage = { ...message.event };
    }
    else if ('inviteAdmin' in message) {
        m.newsletterAdminInviteMessage = {};
        m.newsletterAdminInviteMessage.inviteExpiration = message.inviteAdmin.inviteExpiration;
        m.newsletterAdminInviteMessage.caption = message.inviteAdmin.text;
        m.newsletterAdminInviteMessage.newsletterJid = message.inviteAdmin.jid;
        m.newsletterAdminInviteMessage.newsletterName = message.inviteAdmin.subject;
        m.newsletterAdminInviteMessage.jpegThumbnail = message.inviteAdmin.thumbnail;
    }
    else if ('requestPayment' in message) {
        const sticker = ((_c = message === null || message === void 0 ? void 0 : message.requestPayment) === null || _c === void 0 ? void 0 : _c.sticker) ?
            await (0, exports.prepareWAMessageMedia)({ sticker: (_d = message === null || message === void 0 ? void 0 : message.requestPayment) === null || _d === void 0 ? void 0 : _d.sticker, ...options }, options)
            : null;
        let notes = {};
        if ((_e = message === null || message === void 0 ? void 0 : message.requestPayment) === null || _e === void 0 ? void 0 : _e.sticker) {
            notes = {
                stickerMessage: {
                    ...sticker === null || sticker === void 0 ? void 0 : sticker.stickerMessage,
                    contextInfo: (_f = message === null || message === void 0 ? void 0 : message.requestPayment) === null || _f === void 0 ? void 0 : _f.contextInfo
                }
            };
        }
        else if (message.requestPayment.note) {
            notes = {
                extendedTextMessage: {
                    text: message.requestPayment.note,
                    contextInfo: (_g = message === null || message === void 0 ? void 0 : message.requestPayment) === null || _g === void 0 ? void 0 : _g.contextInfo,
                }
            };
        }
        else {
            throw new boom_1.Boom('Invalid media type', { statusCode: 400 });
        }
        m.requestPaymentMessage = Types_1.WAProto.Message.RequestPaymentMessage.fromObject({
            expiryTimestamp: message.requestPayment.expiry,
            amount1000: message.requestPayment.amount,
            currencyCodeIso4217: message.requestPayment.currency,
            requestFrom: message.requestPayment.from,
            noteMessage: { ...notes },
            background: (_h = message.requestPayment.background) !== null && _h !== void 0 ? _h : null,
        });
    }
    else if ('sharePhoneNumber' in message) {
        m.protocolMessage = {
            type: WAProto_1.proto.Message.ProtocolMessage.Type.SHARE_PHONE_NUMBER
        };
    }
    else if ('requestPhoneNumber' in message) {
        m.requestPhoneNumberMessage = {};
    }
    else if ('album' in message) {
        const imageMessages = message.album.filter(item => 'image' in item);
        const videoMessages = message.album.filter(item => 'video' in item);
        m.albumMessage = WAProto_1.proto.Message.AlbumMessage.fromObject({
            expectedImageCount: imageMessages.length,
            expectedVideoCount: videoMessages.length,
        });
    }
    else {
        m = await (0, exports.prepareWAMessageMedia)(message, options);
    }
    if ('buttons' in message && !!message.buttons) {
        const buttonsMessage = {
            buttons: message.buttons.map(b => ({ ...b, type: WAProto_1.proto.Message.ButtonsMessage.Button.Type.RESPONSE }))
        };
        if ('text' in message) {
            buttonsMessage.contentText = message.text;
            buttonsMessage.headerType = ButtonType.EMPTY;
        }
        else {
            if ('caption' in message) {
                buttonsMessage.contentText = message.caption;
            }
            const type = Object.keys(m)[0].replace('Message', '').toUpperCase();
            buttonsMessage.headerType = ButtonType[type];
            Object.assign(buttonsMessage, m);
        }
        if ('title' in message && !!message.title) {
            buttonsMessage.text = message.title,
                buttonsMessage.headerType = ButtonType.TEXT;
        }
        if ('footer' in message && !!message.footer) {
            buttonsMessage.footerText = message.footer;
        }
        if ('contextInfo' in message && !!message.contextInfo) {
            buttonsMessage.contextInfo = message.contextInfo;
        }
        if ('mentions' in message && !!message.mentions) {
            buttonsMessage.contextInfo = { mentionedJid: message.mentions };
        }
        m = { buttonsMessage };
    }
    else if ('templateButtons' in message && !!message.templateButtons) {
        const msg = {
            hydratedButtons: message.hasOwnProperty("templateButtons") ? message.templateButtons : message.templateButtons
        };
        if ('text' in message) {
            msg.hydratedContentText = message.text;
        }
        else {
            if ('caption' in message) {
                msg.hydratedContentText = message.caption;
            }
            Object.assign(msg, m);
        }
        if ('footer' in message && !!message.footer) {
            msg.hydratedFooterText = message.footer;
        }
        m = {
            templateMessage: {
                fourRowTemplate: msg,
                hydratedTemplate: msg
            }
        };
    }
    if ('sections' in message && !!message.sections) {
        const listMessage = {
            sections: message.sections,
            buttonText: message.buttonText,
            title: message.title,
            footerText: message.footer,
            description: message.text,
            listType: WAProto_1.proto.Message.ListMessage.ListType.SINGLE_SELECT
        };
        m = { listMessage };
    }
    if ('interactiveButtons' in message && !!message.interactiveButtons) {
        const interactiveMessage = {
            nativeFlowMessage: Types_1.WAProto.Message.InteractiveMessage.NativeFlowMessage.fromObject({
                buttons: message.interactiveButtons,
            })
        };
        if ('text' in message) {
            interactiveMessage.body = {
                text: message.text
            };
        }
        else if ('caption' in message) {
            interactiveMessage.body = {
                text: message.caption
            };
            interactiveMessage.header = {
                title: message.title,
                subtitle: message.subtitle,
                hasMediaAttachment: (_j = message === null || message === void 0 ? void 0 : message.media) !== null && _j !== void 0 ? _j : false,
            };
            Object.assign(interactiveMessage.header, m);
        }
        if ('footer' in message && !!message.footer) {
            interactiveMessage.footer = {
                text: message.footer
            };
        }
        if ('title' in message && !!message.title) {
            interactiveMessage.header = {
                title: message.title,
                subtitle: message.subtitle,
                hasMediaAttachment: (_k = message === null || message === void 0 ? void 0 : message.media) !== null && _k !== void 0 ? _k : false,
            };
            Object.assign(interactiveMessage.header, m);
        }
        if ('contextInfo' in message && !!message.contextInfo) {
            interactiveMessage.contextInfo = message.contextInfo;
        }
        if ('mentions' in message && !!message.mentions) {
            interactiveMessage.contextInfo = { mentionedJid: message.mentions };
        }
        m = { interactiveMessage };
    }
    if ('shop' in message && !!message.shop) {
        const interactiveMessage = {
            shopStorefrontMessage: Types_1.WAProto.Message.InteractiveMessage.ShopMessage.fromObject({
                surface: message.shop,
                id: message.id
            })
        };
        if ('text' in message) {
            interactiveMessage.body = {
                text: message.text
            };
        }
        else if ('caption' in message) {
            interactiveMessage.body = {
                text: message.caption
            };
            interactiveMessage.header = {
                title: message.title,
                subtitle: message.subtitle,
                hasMediaAttachment: (_l = message === null || message === void 0 ? void 0 : message.media) !== null && _l !== void 0 ? _l : false,
            };
            Object.assign(interactiveMessage.header, m);
        }
        if ('footer' in message && !!message.footer) {
            interactiveMessage.footer = {
                text: message.footer
            };
        }
        if ('title' in message && !!message.title) {
            interactiveMessage.header = {
                title: message.title,
                subtitle: message.subtitle,
                hasMediaAttachment: (_m = message === null || message === void 0 ? void 0 : message.media) !== null && _m !== void 0 ? _m : false,
            };
            Object.assign(interactiveMessage.header, m);
        }
        if ('contextInfo' in message && !!message.contextInfo) {
            interactiveMessage.contextInfo = message.contextInfo;
        }
        if ('mentions' in message && !!message.mentions) {
            interactiveMessage.contextInfo = { mentionedJid: message.mentions };
        }
        m = { interactiveMessage };
    }
    if ('viewOnce' in message && !!message.viewOnce) {
        m = { viewOnceMessage: { message: m } };
    }
    if ('mentions' in message && ((_o = message.mentions) === null || _o === void 0 ? void 0 : _o.length)) {
        const messageType = (0, exports.getContentType)(m) || Object.keys(m).find(key => key !== 'messageContextInfo');
        m[messageType].contextInfo = { ...(m[messageType].contextInfo || {}) };
        m[messageType].contextInfo.mentionedJid = message.mentions;
    }
    if ('edit' in message) {
        m = {
            protocolMessage: {
                key: message.edit,
                editedMessage: m,
                timestampMs: Date.now(),
                type: Types_1.WAProto.Message.ProtocolMessage.Type.MESSAGE_EDIT
            }
        };
    }
    if ('contextInfo' in message && !!message.contextInfo) {
        const messageType = (0, exports.getContentType)(m) || Object.keys(m).find(key => key !== 'messageContextInfo');
        m[messageType] = m[messageType] || {};
        m[messageType].contextInfo = { ...(m[messageType].contextInfo || {}), ...message.contextInfo };
    }
    return Types_1.WAProto.Message.fromObject(require('./event-message').prepareEventMessage(m));
};
exports.generateWAMessageContent = generateWAMessageContent;
const generateWAMessageFromContent = (jid, message, options) => {
     
     
    if (!options.timestamp) {
        options.timestamp = new Date();
    }
    const innerMessage = (0, exports.normalizeMessageContent)(message);
    const key = (0, exports.getContentType)(innerMessage);
    const timestamp = (0, generics_1.unixTimestampSeconds)(options.timestamp);
    const { quoted, userJid } = options;
     
    if (quoted && !(0, WABinary_1.isJidNewsletter)(jid)) {
        const participant = quoted.key.fromMe ? userJid : (quoted.participant || quoted.key.participant || quoted.key.remoteJid);
        let quotedMsg = (0, exports.normalizeMessageContent)(quoted.message);
        const msgType = (0, exports.getContentType)(quotedMsg);
         
        if (quotedMsg) {
            quotedMsg = WAProto_1.proto.Message.fromObject({ [msgType]: quotedMsg[msgType] });
            const quotedContent = quotedMsg[msgType];
            if (typeof quotedContent === 'object' && quotedContent && 'contextInfo' in quotedContent) {
                delete quotedContent.contextInfo;
            }
            const contextInfo = innerMessage[key].contextInfo || {};
            contextInfo.participant = (0, WABinary_1.jidNormalizedUser)(participant);
            contextInfo.stanzaId = quoted.key.id;
            contextInfo.quotedMessage = quotedMsg;
             
             
            if (jid !== quoted.key.remoteJid) {
                contextInfo.remoteJid = quoted.key.remoteJid;
            }
            innerMessage[key].contextInfo = contextInfo;
        }
    }
    if (
     
    !!(options === null || options === void 0 ? void 0 : options.ephemeralExpiration) &&
         
        key !== 'protocolMessage' &&
         
        key !== 'ephemeralMessage' &&
         
        !(0, WABinary_1.isJidNewsletter)(jid)) {
        innerMessage[key].contextInfo = {
            ...(innerMessage[key].contextInfo || {}),
            expiration: options.ephemeralExpiration || Defaults_1.WA_DEFAULT_EPHEMERAL,
             
        };
    }
    message = Types_1.WAProto.Message.fromObject(message);
    const messageJSON = {
        key: {
            remoteJid: jid,
            fromMe: true,
            id: (options === null || options === void 0 ? void 0 : options.messageId) || (0, generics_1.generateMessageIDV2)(),
        },
        message: message,
        messageTimestamp: timestamp,
        messageStubParameters: [],
        participant: (0, WABinary_1.isJidGroup)(jid) || (0, WABinary_1.isJidStatusBroadcast)(jid) ? userJid : undefined,
        status: Types_1.WAMessageStatus.PENDING
    };
    return Types_1.WAProto.WebMessageInfo.fromObject(messageJSON);
};
exports.generateWAMessageFromContent = generateWAMessageFromContent;
const generateWAMessage = async (jid, content, options) => {
    var _a;
     
    options.logger = (_a = options === null || options === void 0 ? void 0 : options.logger) === null || _a === void 0 ? void 0 : _a.child({ msgId: options.messageId });
    return (0, exports.generateWAMessageFromContent)(jid, await (0, exports.generateWAMessageContent)(content, { newsletter: (0, WABinary_1.isJidNewsletter)(jid), ...options }), options);
};
exports.generateWAMessage = generateWAMessage;
 
const getContentType = (content) => {
    if (content) {
        const keys = Object.keys(content);
        const key = keys.find(k => (k === 'conversation' || k.includes('Message')) && k !== 'senderKeyDistributionMessage');
        return key;
    }
};
exports.getContentType = getContentType;
 





const normalizeMessageContent = (content) => {
    if (!content) {
        return undefined;
    }
     
    for (let i = 0; i < 5; i++) {
        const inner = getFutureProofMessage(content);
        if (!inner) {
            break;
        }
        content = inner.message;
    }
    return content;
    function getFutureProofMessage(message) {
        return ((message === null || message === void 0 ? void 0 : message.ephemeralMessage)
            || (message === null || message === void 0 ? void 0 : message.viewOnceMessage)
            || (message === null || message === void 0 ? void 0 : message.documentWithCaptionMessage)
            || (message === null || message === void 0 ? void 0 : message.viewOnceMessageV2)
            || (message === null || message === void 0 ? void 0 : message.viewOnceMessageV2Extension)
            || (message === null || message === void 0 ? void 0 : message.editedMessage)
            || (message === null || message === void 0 ? void 0 : message.groupMentionedMessage)
            || (message === null || message === void 0 ? void 0 : message.botInvokeMessage)
            || (message === null || message === void 0 ? void 0 : message.lottieStickerMessage)
            || (message === null || message === void 0 ? void 0 : message.eventCoverImage)
            || (message === null || message === void 0 ? void 0 : message.statusMentionMessage)
            || (message === null || message === void 0 ? void 0 : message.pollCreationOptionImageMessage)
            || (message === null || message === void 0 ? void 0 : message.associatedChildMessage)
            || (message === null || message === void 0 ? void 0 : message.groupStatusMentionMessage)
            || (message === null || message === void 0 ? void 0 : message.pollCreationMessageV4)
            || (message === null || message === void 0 ? void 0 : message.pollCreationMessageV5)
            || (message === null || message === void 0 ? void 0 : message.statusAddYours)
            || (message === null || message === void 0 ? void 0 : message.groupStatusMessage)
            || (message === null || message === void 0 ? void 0 : message.limitSharingMessage)
            || (message === null || message === void 0 ? void 0 : message.botTaskMessage)
            || (message === null || message === void 0 ? void 0 : message.questionMessage)
            || (message === null || message === void 0 ? void 0 : message.groupStatusMessageV2)
            || (message === null || message === void 0 ? void 0 : message.botForwardedMessage));
    }
};
exports.normalizeMessageContent = normalizeMessageContent;
 



const extractMessageContent = (content) => {
    var _a, _b, _c, _d, _e, _f;
    const extractFromTemplateMessage = (msg) => {
        if (msg.imageMessage) {
            return { imageMessage: msg.imageMessage };
        }
        else if (msg.documentMessage) {
            return { documentMessage: msg.documentMessage };
        }
        else if (msg.videoMessage) {
            return { videoMessage: msg.videoMessage };
        }
        else if (msg.locationMessage) {
            return { locationMessage: msg.locationMessage };
        }
        else {
            return {
                conversation: 'contentText' in msg
                    ? msg.contentText
                    : ('hydratedContentText' in msg ? msg.hydratedContentText : '')
            };
        }
    };
    content = (0, exports.normalizeMessageContent)(content);
    if (content === null || content === void 0 ? void 0 : content.buttonsMessage) {
        return extractFromTemplateMessage(content.buttonsMessage);
    }
    if ((_a = content === null || content === void 0 ? void 0 : content.templateMessage) === null || _a === void 0 ? void 0 : _a.hydratedFourRowTemplate) {
        return extractFromTemplateMessage((_b = content === null || content === void 0 ? void 0 : content.templateMessage) === null || _b === void 0 ? void 0 : _b.hydratedFourRowTemplate);
    }
    if ((_c = content === null || content === void 0 ? void 0 : content.templateMessage) === null || _c === void 0 ? void 0 : _c.hydratedTemplate) {
        return extractFromTemplateMessage((_d = content === null || content === void 0 ? void 0 : content.templateMessage) === null || _d === void 0 ? void 0 : _d.hydratedTemplate);
    }
    if ((_e = content === null || content === void 0 ? void 0 : content.templateMessage) === null || _e === void 0 ? void 0 : _e.fourRowTemplate) {
        return extractFromTemplateMessage((_f = content === null || content === void 0 ? void 0 : content.templateMessage) === null || _f === void 0 ? void 0 : _f.fourRowTemplate);
    }
    return content;
};
exports.extractMessageContent = extractMessageContent;
 


const getDevice = (id) => /^3A.{18}$/.test(id) ? 'ios' :
    /^3E.{20}$/.test(id) ? 'web' :
        /^(.{21}|.{32})$/.test(id) ? 'android' :
            /^(3F|.{18}$)/.test(id) ? 'desktop' :
                'unknown';
exports.getDevice = getDevice;
 
const updateMessageWithReceipt = (msg, receipt) => {
    msg.userReceipt = msg.userReceipt || [];
    const recp = msg.userReceipt.find(m => m.userJid === receipt.userJid);
    if (recp) {
        Object.assign(recp, receipt);
    }
    else {
        msg.userReceipt.push(receipt);
    }
};
exports.updateMessageWithReceipt = updateMessageWithReceipt;
 
const updateMessageWithReaction = (msg, reaction) => {
    const authorID = (0, generics_1.getKeyAuthor)(reaction.key);
    const reactions = (msg.reactions || [])
        .filter(r => (0, generics_1.getKeyAuthor)(r.key) !== authorID);
    reaction.text = reaction.text || '';
    reactions.push(reaction);
    msg.reactions = reactions;
};
exports.updateMessageWithReaction = updateMessageWithReaction;
 
const updateMessageWithPollUpdate = (msg, update) => {
    var _a, _b;
    const authorID = (0, generics_1.getKeyAuthor)(update.pollUpdateMessageKey);
    const reactions = (msg.pollUpdates || [])
        .filter(r => (0, generics_1.getKeyAuthor)(r.pollUpdateMessageKey) !== authorID);
    if ((_b = (_a = update.vote) === null || _a === void 0 ? void 0 : _a.selectedOptions) === null || _b === void 0 ? void 0 : _b.length) {
        reactions.push(update);
    }
    msg.pollUpdates = reactions;
};
exports.updateMessageWithPollUpdate = updateMessageWithPollUpdate;
 





function getAggregateVotesInPollMessage({ message, pollUpdates }, meId) {
    var _a, _b, _c;
    const opts = ((_a = message === null || message === void 0 ? void 0 : message.pollCreationMessage) === null || _a === void 0 ? void 0 : _a.options) || ((_b = message === null || message === void 0 ? void 0 : message.pollCreationMessageV2) === null || _b === void 0 ? void 0 : _b.options) || ((_c = message === null || message === void 0 ? void 0 : message.pollCreationMessageV3) === null || _c === void 0 ? void 0 : _c.options) || [];
    const voteHashMap = opts.reduce((acc, opt) => {
        const hash = (0, crypto_2.sha256)(Buffer.from(opt.optionName || '')).toString();
        acc[hash] = {
            name: opt.optionName || '',
            voters: []
        };
        return acc;
    }, {});
    for (const update of pollUpdates || []) {
        const { vote } = update;
        if (!vote) {
            continue;
        }
        for (const option of vote.selectedOptions || []) {
            const hash = option.toString();
            let data = voteHashMap[hash];
            if (!data) {
                voteHashMap[hash] = {
                    name: 'Unknown',
                    voters: []
                };
                data = voteHashMap[hash];
            }
            voteHashMap[hash].voters.push((0, generics_1.getKeyAuthor)(update.pollUpdateMessageKey, meId));
        }
    }
    return Object.values(voteHashMap);
}
 
const aggregateMessageKeysNotFromMe = (keys) => {
    const keyMap = {};
    for (const { remoteJid, id, participant, fromMe } of keys) {
        if (!fromMe) {
            const uqKey = `${remoteJid}:${participant || ''}`;
            if (!keyMap[uqKey]) {
                keyMap[uqKey] = {
                    jid: remoteJid,
                    participant: participant,
                    messageIds: []
                };
            }
            keyMap[uqKey].messageIds.push(id);
        }
    }
    return Object.values(keyMap);
};
exports.aggregateMessageKeysNotFromMe = aggregateMessageKeysNotFromMe;
const REUPLOAD_REQUIRED_STATUS = [410, 404];
 


const downloadMediaMessage = async (message, type, options, ctx) => {
    const result = await downloadMsg()
        .catch(async (error) => {
        var _a;
        if (ctx) {
            if (axios_1.default.isAxiosError(error)) {
                 
                if (REUPLOAD_REQUIRED_STATUS.includes((_a = error.response) === null || _a === void 0 ? void 0 : _a.status)) {
                    ctx.logger.info({ key: message.key }, 'sending reupload media request...');
                     
                    message = await ctx.reuploadRequest(message);
                    const result = await downloadMsg();
                    return result;
                }
            }
        }
        throw error;
    });
    return result;
    async function downloadMsg() {
        const mContent = (0, exports.extractMessageContent)(message.message);
        if (!mContent) {
            throw new boom_1.Boom('No message present', { statusCode: 400, data: message });
        }
        const contentType = (0, exports.getContentType)(mContent);
        let mediaType = contentType === null || contentType === void 0 ? void 0 : contentType.replace('Message', '');
        const media = mContent[contentType];
        if (!media || typeof media !== 'object' || (!('url' in media) && !('thumbnailDirectPath' in media))) {
            throw new boom_1.Boom(`"${contentType}" message is not a media message`);
        }
        let download;
        if ('thumbnailDirectPath' in media && !('url' in media)) {
            download = {
                directPath: media.thumbnailDirectPath,
                mediaKey: media.mediaKey
            };
            mediaType = 'thumbnail-link';
        }
        else {
            download = media;
        }
        const stream = await (0, messages_media_1.downloadContentFromMessage)(download, mediaType, options);
        if (type === 'buffer') {
            const bufferArray = [];
            for await (const chunk of stream) {
                bufferArray.push(chunk);
            }
            return Buffer.concat(bufferArray);
        }
        return stream;
    }
};
exports.downloadMediaMessage = downloadMediaMessage;
 
const assertMediaContent = (content) => {
    content = (0, exports.extractMessageContent)(content);
    const mediaContent = (content === null || content === void 0 ? void 0 : content.documentMessage)
        || (content === null || content === void 0 ? void 0 : content.imageMessage)
        || (content === null || content === void 0 ? void 0 : content.videoMessage)
        || (content === null || content === void 0 ? void 0 : content.audioMessage)
        || (content === null || content === void 0 ? void 0 : content.stickerMessage);
    if (!mediaContent) {
        throw new boom_1.Boom('given message is not a media message', { statusCode: 400, data: content });
    }
    return mediaContent;
};
exports.assertMediaContent = assertMediaContent;

const toJid = (id) => {
    if (!id)
        return '';
    if (id.endsWith('@lid'))
        return id.replace('@lid', '@s.whatsapp.net');
    if (id.includes('@'))
        return id;
    return `${id}@s.whatsapp.net`;
};
exports.toJid = toJid;
const getSenderLid = (message) => {
    const sender = message.key.participant || message.key.remoteJid;
    const user = (0, WABinary_1.jidDecode)(sender)?.user || '';
    const lid = (0, WABinary_1.jidEncode)(user, 'lid');
    console.log('sender lid:', lid);
    return { jid: sender, lid };
};
exports.getSenderLid = getSenderLid;

 
const __kageModule74 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { Boom } = require("@hapi/boom")
const { randomBytes } = require("crypto")
const { promises } = require("fs")
const { proto } = require("../../WAProto")
const {
  URL_REGEX, 
  WA_DEFAULT_EPHEMERAL
} = require("../Defaults/constants")
const { MEDIA_KEYS } = require("../Defaults/media")
const {
  WAProto, 
  WAMessageStatus
} = require("../Types")
const { 
  isJidGroup, 
  isJidNewsletter,
  isJidStatusBroadcast, 
  jidNormalizedUser
} = require("../WABinary")
const { sha256 } = require("./crypto")
const {
  generateMessageID, 
  getKeyAuthor, 
  unixTimestampSeconds 
} = require("./generics")
const { 
  downloadContentFromMessage, 
  encryptedStream, 
  generateThumbnail, 
  getAudioDuration, 
  getAudioWaveform, 
  getRawMediaUploadData, 
  getStream, 
  toBuffer 
} = require("./messages-media")

const MIMETYPE_MAP = {
    image: 'image/jpeg',
    video: 'video/mp4',
    document: 'application/pdf',
    audio: 'audio/ogg codecs=opus',
    sticker: 'image/webp',
    'product-catalog-image': 'image/jpeg'
}

const MessageTypeProto = {
    'image': WAProto.Message.ImageMessage,
    'video': WAProto.Message.VideoMessage,
    'audio': WAProto.Message.AudioMessage,
    'sticker': WAProto.Message.StickerMessage,
    'document': WAProto.Message.DocumentMessage
}

 




const extractUrlFromText = (text) => text.match(URL_REGEX)?.[0]

const generateLinkPreviewIfRequired = async (text, getUrlInfo, logger) => {
    const url = extractUrlFromText(text)

    if (!!getUrlInfo && url) {
        try {
            const urlInfo = await getUrlInfo(url)
            return urlInfo
        }

        catch (error) { 
            logger?.warn({ trace: error.stack }, 'url generation failed')
        }
    }
}

const assertColor = async (color) => {
    let assertedColor

    if (typeof color === 'number') {
        assertedColor = color > 0 ? color : 0xffffffff + Number(color) + 1
    }

    else {
        let hex = color.trim().replace('#', '')
        if (hex.length <= 6) {
            hex = 'FF' + hex.padStart(6, '0')
        }
        assertedColor = parseInt(hex, 16)
        return assertedColor
    }
}

const prepareWAMessageMedia = async (message, options) => {
    const logger = options.logger

    let mediaType

    for (const key of MEDIA_KEYS) {
        if (key in message) {
            mediaType = key
        }
    }

    if (!mediaType) {
        throw new Boom('Invalid media type', { statusCode: 400 })
    }

    const uploadData = {
        ...message,
        media: message[mediaType]
    }

    delete uploadData[mediaType]

     
    const cacheableKey = typeof uploadData.media === 'object' &&
        'url' in uploadData.media &&
        !!uploadData.media.url &&
        !!options.mediaCache &&
        mediaType + ':' + uploadData.media.url.toString()

    if (mediaType === 'document' && !uploadData.fileName) {
        uploadData.fileName = 'file'
    }

    if (!uploadData.mimetype) {
        uploadData.mimetype = MIMETYPE_MAP[mediaType]
    }

    if (cacheableKey) {
        const mediaBuff = await options.mediaCache.get(cacheableKey)

        if (mediaBuff) {
            logger?.debug({ cacheableKey }, 'got media cache hit')

            const obj = proto.Message.decode(mediaBuff)
            const key = `${mediaType}Message`

            Object.assign(obj[key], { ...uploadData, media: undefined })

            return obj
        }
    }

    const isNewsletter = !!options.jid && isJidNewsletter(options.jid)

    if (isNewsletter) {
        logger?.info({ key: cacheableKey }, 'Preparing raw media for newsletter')
        const { filePath, fileSha256, fileLength } = await getRawMediaUploadData(uploadData.media, options.mediaTypeOverride || mediaType, logger)
        const fileSha256B64 = fileSha256.toString('base64');
        const { mediaUrl, directPath } = await options.upload(filePath, {
            fileEncSha256B64: fileSha256B64,
            mediaType: mediaType,
            timeoutMs: options.mediaUploadTimeoutMs
        })

        await promises.unlink(filePath)

        const obj = WAProto.Message.fromObject({
             
            [`${mediaType}Message`]: MessageTypeProto[mediaType].fromObject({
                url: mediaUrl,
                directPath,
                fileSha256,
                fileLength,
                ...uploadData,
                media: undefined
            })
        })

        if (uploadData.ptv) {
            obj.ptvMessage = obj.videoMessage
            delete obj.videoMessage
        }

        if (obj.stickerMessage) {
            obj.stickerMessage.stickerSentTs = Date.now()
        }

        if (cacheableKey) {
            logger?.debug({ cacheableKey }, 'set cache');
            await options.mediaCache.set(cacheableKey, WAProto.Message.encode(obj).finish())
        }

        return obj
    }

    const requiresDurationComputation = mediaType === 'audio' && typeof uploadData.seconds === 'undefined'
    const requiresThumbnailComputation = (mediaType === 'image' || mediaType === 'video') && typeof uploadData['jpegThumbnail'] === 'undefined'
    const requiresWaveformProcessing = mediaType === 'audio' && uploadData.ptt === true
    const requiresAudioBackground = options.backgroundColor && mediaType === 'audio' && uploadData.ptt === true
    const requiresOriginalForSomeProcessing = requiresDurationComputation || requiresThumbnailComputation
    const { mediaKey, encFilePath, originalFilePath, fileEncSha256, fileSha256, fileLength } = await encryptedStream(uploadData.media, options.mediaTypeOverride || mediaType, {
        logger,
        saveOriginalFileIfRequired: requiresOriginalForSomeProcessing,
        opts: options.options
    })
    const fileEncSha256B64 = fileEncSha256.toString('base64')
    const [{ mediaUrl, directPath }] = await Promise.all([
        (async () => {
            const result = await options.upload(encFilePath, {
                fileEncSha256B64,
                mediaType,
                timeoutMs: options.mediaUploadTimeoutMs
            })
            logger?.debug({ mediaType, cacheableKey }, 'uploaded media')
            return result
        })(),
        (async () => {
            try {
                if (requiresThumbnailComputation) {
                    const { thumbnail, originalImageDimensions } = await generateThumbnail(originalFilePath, mediaType, options)

                    uploadData.jpegThumbnail = thumbnail

                    if (!uploadData.width && originalImageDimensions) {
                        uploadData.width = originalImageDimensions.width
                        uploadData.height = originalImageDimensions.height
                        logger?.debug('set dimensions')
                    }
                    logger?.debug('generated thumbnail')
                }

                if (requiresDurationComputation) {
                    uploadData.seconds = await getAudioDuration(originalFilePath)
                    logger?.debug('computed audio duration')
                }

                if (requiresWaveformProcessing) {
                    uploadData.waveform = await getAudioWaveform(originalFilePath, logger)
                    logger?.debug('processed waveform')
                }

                if (requiresAudioBackground) {
                    uploadData.backgroundArgb = await assertColor(options.backgroundColor)
                    logger?.debug('computed backgroundColor audio status')
                }
            }
            catch (error) {
                logger?.warn({ trace: error.stack }, 'failed to obtain extra info')
            }
        })()
    ]).finally(async () => {
        try {
            await promises.unlink(encFilePath)

            if (originalFilePath) {
                await promises.unlink(originalFilePath)
            }

            logger?.debug('removed tmp files')
        }
        catch (error) {
            logger?.warn('failed to remove tmp file')
        }
    })

    const obj = WAProto.Message.fromObject({
        [`${mediaType}Message`]: MessageTypeProto[mediaType].fromObject({
            url: mediaUrl,
            directPath,
            mediaKey,
            fileEncSha256,
            fileSha256,
            fileLength,
            mediaKeyTimestamp: unixTimestampSeconds(),
            ...uploadData,
            media: undefined
        })
    })

    if (uploadData.ptv) {
        obj.ptvMessage = obj.videoMessage
        delete obj.videoMessage
    }

    if (cacheableKey) {
        logger?.debug({ cacheableKey }, 'set cache')
        await options.mediaCache.set(cacheableKey, WAProto.Message.encode(obj).finish())
    }

    return obj
}

const prepareAlbumMessageContent = async (jid, albums, options) => {
    if (!Array.isArray(albums)) {
        throw new Error("albums must be an array containing media objects.")
    }

    if (albums.length === 0) {
        throw new Error("albums cannot be empty. At least one media item is required.")
    }

    const validCount = albums.filter(m => ('image' in m) || ('video' in m)).length

    if (validCount === 0) {
        throw new Error("albums contains no valid media. Use 'image' or 'video' keys.")
    }

    let mediaHandle
    let mediaMsg
    const message = []

    const albumMsg = generateWAMessageFromContent(jid, {
        albumMessage: {
            expectedImageCount: albums.filter(item => 'image' in item).length,
            expectedVideoCount: albums.filter(item => 'video' in item).length
        }
    }, options)

    await options.suki.relayMessage(jid, albumMsg.message, {
        messageId: albumMsg.key.id
    })

    for (const media of albums) {
        let content = {}
        if ('image' in media) {
            content = { image: media.image }
        } else if ('video' in media) {
            content = { video: media.video }
        } else {
            continue
        }

        mediaMsg = await generateWAMessage(
            jid,
            {
                ...content,
                ...media
            },
            {
                userJid: options.userJid,
                upload: async (encFilePath, opts) => {
                    const up = await options.suki.waUploadToServer(
                        encFilePath,
                        { ...opts, newsletter: isJidNewsletter(jid) }
                    )
                    mediaHandle = up.handle
                    return up
                },
                ...options
            }
        )

        if (mediaMsg) {
            mediaMsg.message.messageContextInfo = {
                messageSecret: randomBytes(32),
                messageAssociation: {
                    associationType: proto.MessageAssociation.AssociationType.MEDIA_ALBUM,
                    parentMessageKey: albumMsg.key
                }
            }
        }

        message.push(mediaMsg)
    }

    return message
}

const prepareDisappearingMessageSettingContent = (expiration) => {
    const content = {
        ephemeralMessage: {
            message: {
                protocolMessage: {
                    type: WAProto.Message.ProtocolMessage.Type.EPHEMERAL_SETTING,
                    ephemeralExpiration: expiration ? expiration : 0
                }
            }
        }
    }

    return WAProto.Message.fromObject(content)
}

 




const generateForwardMessageContent = (message, forceForward) => {
    let content = message.message

    if (!content) {
        throw new Boom('no content in message', { statusCode: 400 })
    }

     
    content = normalizeMessageContent(content)
    content = proto.Message.decode(proto.Message.encode(content).finish())

    let key = Object.keys(content)[0]
    let score = content[key].contextInfo?.forwardingScore || 0

    if (forceForward) score += forceForward ? forceForward : 1

    if (key === 'conversation') {
        content.extendedTextMessage = { text: content[key] }
        delete content.conversation
        key = 'extendedTextMessage'
    }

    if (score > 0) {
        content[key].contextInfo = { forwardingScore: score, isForwarded: true }
    }

    else {
        content[key].contextInfo = {}
    }

    return content
}

const hasNonNullishProperty = (message, key) => {
  return (
    typeof message === 'object' &&
    message !== null &&
    key in message &&
    message[key] !== null &&
    message[key] !== undefined
  )
}

function hasOptionalProperty(obj, key) {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    key in obj &&
    obj[key] !== null
  )
}

const generateWAMessageContent = async (message, options) => {
    let m = {}
	
    if (hasNonNullishProperty(message, "text")) {
        const extContent = { text: message.text }

        let urlInfo = message.linkPreview

        if (typeof urlInfo === "undefined") {
            urlInfo = await generateLinkPreviewIfRequired(
                message.text,
                options.getUrlInfo,
                options.logger
            )
        }

        if (urlInfo) {
            extContent.canonicalUrl = urlInfo["canonical-url"]
            extContent.matchedText = urlInfo["matched-text"]
            extContent.jpegThumbnail = urlInfo.jpegThumbnail
            extContent.description = urlInfo.description
            extContent.title = urlInfo.title
            extContent.previewType = 0

            const img = urlInfo.highQualityThumbnail

            if (img) {
                extContent.thumbnailDirectPath = img.directPath
                extContent.mediaKey = img.mediaKey
                extContent.mediaKeyTimestamp = img.mediaKeyTimestamp
                extContent.thumbnailWidth = img.width
                extContent.thumbnailHeight = img.height
                extContent.thumbnailSha256 = img.fileSha256
                extContent.thumbnailEncSha256 = img.fileEncSha256
            }
        }

        if (options.backgroundColor) {
            extContent.backgroundArgb = await assertColor(
                options.backgroundColor
            )
        }

        if (options.textColor) {
            extContent.textArgb = await assertColor(options.textColor)
        }

        if (options.font) {
            extContent.font = options.font
        }

        m.extendedTextMessage = extContent
    } else if (hasNonNullishProperty(message, "contacts")) {
        const contactLen = message.contacts.contacts.length

        let contactMessage

        if (!contactLen) {
            throw new Boom("require atleast 1 contact", { statusCode: 400 })
        }

        if (contactLen === 1) {
            contactMessage = {
                contactMessage: WAProto.Message.ContactMessage.fromObject(
                    message.contacts.contacts[0]
                ),
            }
        } else {
            contactMessage = {
                contactsArrayMessage: WAProto.Message.ContactsArrayMessage.fromObject(
                    message.contacts
                ),
            }
        }

        m = contactMessage
    } else if (hasNonNullishProperty(message, "contacts")) {
        const contactLen = message.contacts.contacts.length

        let contactMessage

        if (!contactLen) {
            throw new Boom("require atleast 1 contact", { statusCode: 400 })
        }

        if (contactLen === 1) {
            contactMessage = {
                contactMessage: WAProto.Message.ContactMessage.fromObject(
                    message.contacts.contacts[0]
                ),
            }
        } else {
            contactMessage = {
                contactsArrayMessage: WAProto.Message.ContactsArrayMessage.fromObject(
                    message.contacts
                ),
            }
        }

        m = contactMessage
    } else if (hasNonNullishProperty(message, "location")) {
        let locationMessage

        if (message.live) {
            locationMessage = {
                liveLocationMessage: WAProto.Message.LiveLocationMessage.fromObject(
                    message.location
                ),
            }
        } else {
            locationMessage = {
                locationMessage: WAProto.Message.LocationMessage.fromObject(
                    message.location
                ),
            }
        }

        m = locationMessage
    } else if (hasNonNullishProperty(message, "react")) {
        if (!message.react.senderTimestampMs) {
            message.react.senderTimestampMs = Date.now()
        }

        m.reactionMessage = WAProto.Message.ReactionMessage.fromObject(
            message.react
        )
    } else if (hasNonNullishProperty(message, "delete")) {
        m.protocolMessage = {
            key: message.delete,
            type: WAProto.Message.ProtocolMessage.Type.REVOKE,
        }
    } else if (hasNonNullishProperty(message, "sharePhoneNumber")) {
        m.protocolMessage = {
            type: WAProto.Message.ProtocolMessage.Type.SHARE_PHONE_NUMBER,
        }
    } else if (hasNonNullishProperty(message, "requestPhoneNumber")) {
        m.requestPhoneNumberMessage = {}
    } else if (hasNonNullishProperty(message, "forward")) {
        m = generateForwardMessageContent(message.forward, message.force)
    } else if (hasNonNullishProperty(message, "disappearingMessagesInChat")) {
        const exp =
            typeof message.disappearingMessagesInChat === "boolean"
                ? message.disappearingMessagesInChat
                    ? WA_DEFAULT_EPHEMERAL
                    : 0
                : message.disappearingMessagesInChat
        m = prepareDisappearingMessageSettingContent(exp)
    } else if (hasNonNullishProperty(message, "groupInvite")) {
        m.groupInviteMessage = {}

        m.groupInviteMessage.inviteCode = message.groupInvite.code
        m.groupInviteMessage.inviteExpiration = message.groupInvite.expiration
        m.groupInviteMessage.caption = message.groupInvite.caption
        m.groupInviteMessage.groupJid = message.groupInvite.jid
        m.groupInviteMessage.groupName = message.groupInvite.name
        m.groupInviteMessage.contextInfo = message.contextInfo

        if (options.getProfilePicUrl) {
            const pfpUrl = await options.getProfilePicUrl(
                message.groupInvite.jid
            )
            const { thumbnail } = await generateThumbnail(pfpUrl, "image")
            m.groupInviteMessage.jpegThumbnail = thumbnail
        }
    } else if (hasNonNullishProperty(message, "adminInvite")) {
        m.newsletterAdminInviteMessage = {}

        m.newsletterAdminInviteMessage.newsletterJid = message.adminInvite.jid
        m.newsletterAdminInviteMessage.newsletterName =
            message.adminInvite.name
        m.newsletterAdminInviteMessage.caption = message.adminInvite.caption
        m.newsletterAdminInviteMessage.inviteExpiration =
            message.adminInvite.expiration
        m.newsletterAdminInviteMessage.contextInfo = message.contextInfo

        if (options.getProfilePicUrl) {
            const pfpUrl = await options.getProfilePicUrl(
                message.adminInvite.jid
            )
            const { thumbnail } = await generateThumbnail(pfpUrl, "image")
            m.newsletterAdminInviteMessage.jpegThumbnail = thumbnail
        }
    } else if (hasNonNullishProperty(message, "keep")) {
        m.keepInChatMessage = {}

        m.keepInChatMessage.key = message.keep.key
        m.keepInChatMessage.keepType = message.keep?.type || 1
        m.keepInChatMessage.timestampMs = message.keep?.time || Date.now()
    } else if (hasNonNullishProperty(message, "call")) {
        m.scheduledCallCreationMessage = {}

        m.scheduledCallCreationMessage.scheduledTimestampMs =
            message.call?.time || Date.now()
        m.scheduledCallCreationMessage.callType = message.call?.type || 1
        m.scheduledCallCreationMessage.title =
            message.call?.name || "Call Creation"
    } else if (hasNonNullishProperty(message, "paymentInvite")) {
        m.messageContextInfo = {}
        m.paymentInviteMessage = {}

        m.paymentInviteMessage.expiryTimestamp =
            message.paymentInvite?.expiry || 0
        m.paymentInviteMessage.serviceType = message.paymentInvite?.type || 2
    } else if (hasNonNullishProperty(message, "ptv")) {
        const { videoMessage } = await prepareWAMessageMedia(
            { video: message.video },
            options
        )

        m.ptvMessage = videoMessage
    } else if (hasNonNullishProperty(message, "order")) {
        m.orderMessage = WAProto.Message.OrderMessage.fromObject(message.order)
    } else if (hasNonNullishProperty(message, "product")) {
        const { imageMessage } = await prepareWAMessageMedia(
            { image: message.product.productImage },
            options
        )

        m.productMessage = WAProto.Message.ProductMessage.fromObject({
            ...message,
            product: {
                ...message.product,
                productImage: imageMessage,
            },
        })
    } else if (hasNonNullishProperty(message, "album")) {
        const imageMessages = message.album.filter((item) => "image" in item)
        const videoMessages = message.album.filter((item) => "video" in item)

        m.albumMessage = WAProto.Message.AlbumMessage.fromObject({
            expectedImageCount: imageMessages.length,
            expectedVideoCount: videoMessages.length,
        })
    } else if (hasNonNullishProperty(message, "event")) {
        m.eventMessage = WAProto.Message.EventMessage.fromObject(message.event)

        if (!message.event.startTime) {
            m.eventMessage.startTime = unixTimestampSeconds() + 86400
        }

        if (options.getCallLink && message.event.call) {
            const link = await options.getCallLink(
                message.event.call,
                m.eventMessage.startTime
            )
            m.eventMessage.joinLink = link
        }
    } else if (hasNonNullishProperty(message, "pollResult")) {
        if (!Array.isArray(message.pollResult.values)) {
            throw new Boom("Invalid pollResult values", { statusCode: 400 })
        }

        const pollResultSnapshotMessage = {
            name: message.pollResult.name,
            pollVotes: message.pollResult.values.map(
                ([optionName, optionVoteCount]) => ({
                    optionName,
                    optionVoteCount,
                })
            ),
        }

        m.pollResultSnapshotMessage = pollResultSnapshotMessage
    } else if (hasNonNullishProperty(message, "poll")) {
        if (!Array.isArray(message.poll.values)) {
            throw new Boom("Invalid poll values", { statusCode: 400 })
        }

        if (
            message.poll.selectableCount < 0 ||
            message.poll.selectableCount > message.poll.values.length
        ) {
            throw new Boom(
                `poll.selectableCount in poll should be >= 0 and <= ${message.poll.values.length}`,
                { statusCode: 400 }
            )
        }

        const pollCreationMessage = {
            name: message.poll.name,
            selectableOptionsCount: message.poll?.selectableCount || 0,
            options: message.poll.values.map((optionName) => ({ optionName })),
        }

        if (message.poll?.toAnnouncementGroup) {
            m.pollCreationMessageV2 = pollCreationMessage
        } else {
            if (message.poll.selectableCount > 0) {
                m.pollCreationMessageV3 = pollCreationMessage
            } else {
                m.pollCreationMessage = pollCreationMessage
            }
        }
    } else if (hasNonNullishProperty(message, "payment")) {
        const requestPaymentMessage = {
            amount: {
                currencyCode: message.payment?.currency || "IDR",
                offset: message.payment?.offset || 0,
                value: message.payment?.amount || 999999999,
            },
            expiryTimestamp: message.payment?.expiry || 0,
            amount1000: message.payment?.amount || 999999999 * 1000,
            currencyCodeIso4217: message.payment?.currency || "IDR",
            requestFrom: message.payment?.from || "0@s.whatsapp.net",
            noteMessage: {
                extendedTextMessage: {
                    text: message.payment?.note || "Notes",
                },
            },
            background: {
                placeholderArgb:
                    message.payment?.image?.placeholderArgb || 4278190080,
                textArgb: message.payment?.image?.textArgb || 4294967295,
                subtextArgb: message.payment?.image?.subtextArgb || 4294967295,
                type: 1,
            },
        }

        m.requestPaymentMessage = requestPaymentMessage
    } else if (hasNonNullishProperty(message, "stickerPack")) {
        const {
            stickers,
            cover,
            name,
            publisher,
            packId,
            description,
        } = message.stickerPack

        const { zip } = require("fflate")

        const stickerData = {}
        const stickerPromises = stickers.map(async (s, i) => {
            const { stream } = await getStream(s.sticker)
            const buffer = await toBuffer(stream)
            const hash = sha256(buffer).toString("base64url")
            const fileName = `${i.toString().padStart(2, "0")}_${hash}.webp`

            stickerData[fileName] = [new Uint8Array(buffer), { level: 0 }]

            return {
                fileName,
                mimetype: "image/webp",
                isAnimated: s.isAnimated || false,
                isLottie: s.isLottie || false,
                emojis: s.emojis || [],
                accessibilityLabel: s.accessibilityLabel || "",
            }
        })

        const stickerMetadata = await Promise.all(stickerPromises)

        const zipBuffer = await new Promise((resolve, reject) => {
            zip(stickerData, (err, data) => {
                if (err) {
                    reject(err)
                } else {
                    resolve(Buffer.from(data))
                }
            })
        })

        const coverBuffer = await toBuffer((await getStream(cover)).stream)

        const [stickerPackUpload, coverUpload] = await Promise.all([
            encryptedStream(zipBuffer, "sticker-pack", {
                logger: options.logger,
                opts: options.options,
            }),
            prepareWAMessageMedia(
                { image: coverBuffer },
                { ...options, mediaTypeOverride: "image" }
            ),
        ])

        const stickerPackUploadResult = await options.upload(
            stickerPackUpload.encFilePath,
            {
                fileEncSha256B64: stickerPackUpload.fileEncSha256.toString(
                    "base64"
                ),
                mediaType: "sticker-pack",
                timeoutMs: options.mediaUploadTimeoutMs,
            }
        )

        const coverImage = coverUpload.imageMessage
        const imageDataHash = sha256(coverBuffer).toString("base64")
        const stickerPackId = packId || generateMessageID()

        m.stickerPackMessage = {
            name,
            publisher,
            stickerPackId,
            packDescription: description,
            stickerPackOrigin:
                proto.Message.StickerPackMessage.StickerPackOrigin.THIRD_PARTY,
            stickerPackSize: stickerPackUpload.fileLength,
            stickers: stickerMetadata,
            fileSha256: stickerPackUpload.fileSha256,
            fileEncSha256: stickerPackUpload.fileEncSha256,
            mediaKey: stickerPackUpload.mediaKey,
            directPath: stickerPackUploadResult.directPath,
            fileLength: stickerPackUpload.fileLength,
            mediaKeyTimestamp: unixTimestampSeconds(),
            trayIconFileName: `${stickerPackId}.png`,
            imageDataHash,
            thumbnailDirectPath: coverImage.directPath,
            thumbnailFileSha256: coverImage.fileSha256,
            thumbnailFileEncSha256: coverImage.fileEncSha256,
            thumbnailHeight: coverImage.height,
            thumbnailWidth: coverImage.width,
        }
    } else {
        m = await prepareWAMessageMedia(message, options)
    }
    
    if (hasNonNullishProperty(message, "buttonReply")) {
        switch (message.type) {
            case "list":
                m.listResponseMessage = {
                    title: message.buttonReply.title,
                    description: message.buttonReply.description,
                    singleSelectReply: {
                        selectedRowId: message.buttonReply.rowId,
                    },
                    lisType:
                        proto.Message.ListResponseMessage.ListType
                            .SINGLE_SELECT,
                }
                break
            case "template":
                m.templateButtonReplyMessage = {
                    selectedDisplayText: message.buttonReply.displayText,
                    selectedId: message.buttonReply.id,
                    selectedIndex: message.buttonReply.index,
                }
                break
            case "plain":
                m.buttonsResponseMessage = {
                    selectedButtonId: message.buttonReply.id,
                    selectedDisplayText: message.buttonReply.displayText,
                    type:
                        proto.Message.ButtonsResponseMessage.Type.DISPLAY_TEXT,
                }
                break
            case "interactive":
                m.interactiveResponseMessage = {
                    body: {
                        text: message.buttonReply.displayText,
                        format:
                            proto.Message.InteractiveResponseMessage.Body.Format
                                .EXTENSIONS_1,
                    },
                    nativeFlowResponseMessage: {
                        name: message.buttonReply.nativeFlows.name,
                        paramsJson: message.buttonReply.nativeFlows.paramsJson,
                        version: message.buttonReply.nativeFlows.version,
                    },
                }
                break
        }
    } else if (hasNonNullishProperty(message, "sections")) {
        m.listMessage = {
            title: message.title,
            buttonText: message.buttonText,
            footerText: message.footer,
            description: message.text,
            sections: message.sections,
            listType: proto.Message.ListMessage.ListType.SINGLE_SELECT,
        }
    } else if (hasNonNullishProperty(message, "productList")) {
        const thumbnail = message.thumbnail
            ? await generateThumbnail(message.thumbnail, "image")
            : null

        m.listMessage = {
            title: message.title,
            buttonText: message.buttonText,
            footerText: message.footer,
            description: message.text,
            productListInfo: {
                productSections: message.productList,
                headerImage: {
                    productId: message.productList[0].products[0].productId,
                    jpegThumbnail: thumbnail?.thumbnail || null,
                },
                businessOwnerJid: message.businessOwnerJid,
            },
            listType: proto.Message.ListMessage.ListType.PRODUCT_LIST,
        }
    } else if (hasNonNullishProperty(message, "buttons")) {
        const buttonsMessage = {
            buttons: message.buttons.map((b) => ({
                ...b,
                type: proto.Message.ButtonsMessage.Button.Type.RESPONSE,
            })),
        }

        if (hasNonNullishProperty(message, "text")) {
            buttonsMessage.contentText = message.text
            buttonsMessage.headerType =
                proto.Message.ButtonsMessage.HeaderType.EMPTY
        } else {
            if (hasNonNullishProperty(message, "caption")) {
                buttonsMessage.contentText = message.caption
            }

            const type = Object.keys(m)[0].replace("Message", "").toUpperCase()

            buttonsMessage.headerType =
                proto.Message.ButtonsMessage.HeaderType[type]

            Object.assign(buttonsMessage, m)
        }

        if (hasNonNullishProperty(message, "title")) {
            buttonsMessage.text = message.title
            buttonsMessage.headerType =
                proto.Message.ButtonsMessage.HeaderType.TEXT
        }

        if (hasNonNullishProperty(message, "footer")) {
            buttonsMessage.footerText = message.footer
        }

        m = { buttonsMessage }
    } else if (hasNonNullishProperty(message, "templateButtons")) {
        const hydratedTemplate = {
            hydratedButtons: message.templateButtons,
        }

        if (hasNonNullishProperty(message, "text")) {
            hydratedTemplate.hydratedContentText = message.text
        } else {
            if (hasNonNullishProperty(message, "caption")) {
                hydratedTemplate.hydratedContentText = message.caption
            }

            Object.assign(msg, m)
        }

        if (hasNonNullishProperty(message, "footer")) {
            hydratedTemplate.hydratedFooterText = message.footer
        }

        m = { templateMessage: { hydratedTemplate } }
    } else if (hasNonNullishProperty(message, "interactiveButtons")) {
        const interactiveMessage = {
            nativeFlowMessage: {
                buttons: message.interactiveButtons,
            },
        }

        if (hasNonNullishProperty(message, "text")) {
            interactiveMessage.body = {
                text: message.text,
            }
        }

        if (hasNonNullishProperty(message, "title")) {
            interactiveMessage.header = {
                title: message.title,
                subtitle: null,
                hasMediaAttachment: false,
            }

            if (hasNonNullishProperty(message, "subtitle")) {
                interactiveMessage.header.subtitle = message.subtitle
            }
        } else {
            if (hasNonNullishProperty(message, "caption")) {
                interactiveMessage.body = {
                    text: message.caption,
                }

                interactiveMessage.header = {
                    title: null,
                    subtitle: null,
                    hasMediaAttachment: false,
                    ...Object.assign(interactiveMessage, m),
                }

                if (hasNonNullishProperty(message, "title")) {
                    interactiveMessage.header.title = message.title
                }

                if (hasNonNullishProperty(message, "subtitle")) {
                    interactiveMessage.header.subtitle = message.subtitle
                }

                if (hasNonNullishProperty(message, "hasMediaAttachment")) {
                    interactiveMessage.header.hasMediaAttachment = Boolean(
                        message.hasMediaAttachment
                    )
                }
            }
        }

        if (hasNonNullishProperty(message, "footer")) {
            interactiveMessage.footer = {
                text: message.footer,
            }
        }

        m = { interactiveMessage }
    } else if (hasNonNullishProperty(message, "shop")) {
        const interactiveMessage = {
            shopStorefrontMessage: {
                surface: message.shop.surface,
                id: message.shop.id,
            },
        }

        if (hasNonNullishProperty(message, "text")) {
            interactiveMessage.body = {
                text: message.text,
            }
        }

        if (hasNonNullishProperty(message, "title")) {
            interactiveMessage.header = {
                title: message.title,
                subtitle: null,
                hasMediaAttachment: false,
            }

            if (hasNonNullishProperty(message, "subtitle")) {
                interactiveMessage.header.subtitle = message.subtitle
            }
        } else {
            if (hasNonNullishProperty(message, "caption")) {
                interactiveMessage.body = {
                    text: message.caption,
                }

                interactiveMessage.header = {
                    title: null,
                    subtitle: null,
                    hasMediaAttachment: false,
                    ...Object.assign(interactiveMessage, m),
                }

                if (hasNonNullishProperty(message, "title")) {
                    interactiveMessage.header.title = message.title
                }

                if (hasNonNullishProperty(message, "subtitle")) {
                    interactiveMessage.header.subtitle = message.subtitle
                }

                if (hasNonNullishProperty(message, "hasMediaAttachment")) {
                    interactiveMessage.header.hasMediaAttachment = Boolean(
                        message.hasMediaAttachment
                    )
                }
            }
        }

        if (hasNonNullishProperty(message, "footer")) {
            interactiveMessage.footer = {
                text: message.footer,
            }
        }

        m = { interactiveMessage }
    } else if (hasNonNullishProperty(message, "collection")) {
        const interactiveMessage = {
            collectionMessage: {
                bizJid: message.collection.bizJid,
                id: message.collection.id,
                messageVersion: message?.collection?.version,
            },
        }

        if (hasNonNullishProperty(message, "text")) {
            interactiveMessage.body = {
                text: message.text,
            }
        }

        if (hasNonNullishProperty(message, "title")) {
            interactiveMessage.header = {
                title: message.title,
                subtitle: null,
                hasMediaAttachment: false,
            }

            if (hasNonNullishProperty(message, "subtitle")) {
                interactiveMessage.header.subtitle = message.subtitle
            }
        } else {
            if (hasNonNullishProperty(message, "caption")) {
                interactiveMessage.body = {
                    text: message.caption,
                }

                interactiveMessage.header = {
                    title: null,
                    subtitle: null,
                    hasMediaAttachment: false,
                    ...Object.assign(interactiveMessage, m),
                }

                if (hasNonNullishProperty(message, "title")) {
                    interactiveMessage.header.title = message.title
                }

                if (hasNonNullishProperty(message, "subtitle")) {
                    interactiveMessage.header.subtitle = message.subtitle
                }

                if (hasNonNullishProperty(message, "hasMediaAttachment")) {
                    interactiveMessage.header.hasMediaAttachment = Boolean(
                        message.hasMediaAttachment
                    )
                }
            }
        }

        if (hasNonNullishProperty(message, "footer")) {
            interactiveMessage.footer = {
                text: message.footer,
            }
        }

        m = { interactiveMessage }
    } else if (hasNonNullishProperty(message, "cards")) {
        const slides = await Promise.all(
            message.cards.map(async (slide) => {
                const {
                    image,
                    video,
                    product,
                    title,
                    body,
                    footer,
                    buttons,
                } = slide

                let header

                if (product) {
                    const { imageMessage } = await prepareWAMessageMedia(
                        { image: product.productImage, ...options },
                        options
                    )
                    header = {
                        productMessage: {
                            product: {
                                ...product,
                                productImage: imageMessage,
                            },
                            ...slide,
                        },
                    }
                } else if (image) {
                    header = await prepareWAMessageMedia(
                        { image: image, ...options },
                        options
                    )
                } else if (video) {
                    header = await prepareWAMessageMedia(
                        { video: video, ...options },
                        options
                    )
                }

                const msg = {
                    header: {
                        title,
                        hasMediaAttachment: true,
                        ...header,
                    },
                    body: {
                        text: body,
                    },
                    footer: {
                        text: footer,
                    },
                    nativeFlowMessage: {
                        buttons,
                    },
                }

                return msg
            })
        )

        const interactiveMessage = {
            carouselMessage: {
                cards: slides,
            },
        }

        if (hasNonNullishProperty(message, "text")) {
            interactiveMessage.body = {
                text: message.text,
            }
        }

        if (hasNonNullishProperty(message, "title")) {
            interactiveMessage.header = {
                title: message.title,
                subtitle: null,
                hasMediaAttachment: false,
            }

            if (hasNonNullishProperty(message, "subtitle")) {
                interactiveMessage.header.subtitle = message.subtitle
            }
        } else {
            if (hasNonNullishProperty(message, "caption")) {
                interactiveMessage.body = {
                    text: message.caption,
                }

                interactiveMessage.header = {
                    title: null,
                    subtitle: null,
                    hasMediaAttachment: false,
                    ...Object.assign(interactiveMessage, m),
                }

                if (hasNonNullishProperty(message, "title")) {
                    interactiveMessage.header.title = message.title
                }

                if (hasNonNullishProperty(message, "subtitle")) {
                    interactiveMessage.header.subtitle = message.subtitle
                }

                if (hasNonNullishProperty(message, "hasMediaAttachment")) {
                    interactiveMessage.header.hasMediaAttachment = Boolean(
                        message.hasMediaAttachment
                    )
                }
            }
        }

        if (hasNonNullishProperty(message, "footer")) {
            interactiveMessage.footer = {
                text: message.footer,
            }
        }

        m = { interactiveMessage }
    }

    if (hasOptionalProperty(message, "ephemeral")) {
        m = { ephemeralMessage: { message: m } }
    }

    if (hasOptionalProperty(message, "mentions") && message.mentions?.length) {
        const messageType = Object.keys(m)[0]
        const key = m[messageType]

        if ("contextInfo" in key && !!key.contextInfo) {
            key.contextInfo.mentionedJid = message.mentions
        } else if (key) {
            key.contextInfo = {
                mentionedJid: message.mentions,
            }
        }
    }

    if (hasOptionalProperty(message, "contextInfo") && !!message.contextInfo) {
        const messageType = Object.keys(m)[0]
        const key = m[messageType]

        if ("contextInfo" in key && !!key.contextInfo) {
            key.contextInfo = { ...key.contextInfo, ...message.contextInfo }
        } else if (key) {
            key.contextInfo = message.contextInfo
        }
    }

    if (hasOptionalProperty(message, "edit")) {
        m = {
            protocolMessage: {
                key: message.edit,
                editedMessage: m,
                timestampMs: Date.now(),
                type: WAProto.Message.ProtocolMessage.Type.MESSAGE_EDIT,
            },
        }
    }

    return WAProto.Message.fromObject(m)
}

const generateWAMessageFromContent = (jid, message, options) => {
    if (!options.timestamp) {
        options.timestamp = new Date()
    }

    const innerMessage = normalizeMessageContent(message)
    const key = getContentType(innerMessage)
    const timestamp = unixTimestampSeconds(options.timestamp)
    const threadId = []
    const { quoted, userJid } = options

    if (quoted && !isJidNewsletter(jid)) {
        const participant = quoted.key.fromMe
            ? userJid
            : quoted.participant || quoted.key.participant || quoted.key.remoteJid

        let quotedMsg = normalizeMessageContent(quoted.message)
        const msgType = getContentType(quotedMsg)

        quotedMsg = proto.Message.fromObject({ [msgType]: quotedMsg[msgType] })

        const quotedContent = quotedMsg[msgType]

        if (typeof quotedContent === 'object' && quotedContent && 'contextInfo' in quotedContent) {
            delete quotedContent.contextInfo
        }

        let requestPayment

        if (key === 'requestPaymentMessage') {
            if (innerMessage?.requestPaymentMessage && innerMessage?.requestPaymentMessage?.noteMessage?.extendedTextMessage) {
                requestPayment = innerMessage?.requestPaymentMessage?.noteMessage?.extendedTextMessage
            } else if (innerMessage?.requestPaymentMessage && innerMessage?.requestPaymentMessage?.noteMessage?.stickerMessage) {
                requestPayment = innerMessage.requestPaymentMessage?.noteMessage?.stickerMessage
            }
        }

        const contextInfo = (key === 'requestPaymentMessage' ? requestPayment?.contextInfo : innerMessage[key].contextInfo) || {}

        contextInfo.participant = jidNormalizedUser(participant)
        contextInfo.stanzaId = quoted.key.id
        contextInfo.quotedMessage = quotedMsg

        if (jid !== quoted.key.remoteJid) {
            contextInfo.remoteJid = quoted.key.remoteJid
        }

        if (contextInfo.quotedMessage) {
            contextInfo.quotedType = proto.ContextInfo.QuotedType.EXPLICIT
        }

        if (contextInfo.quotedMessage && isJidGroup(jid)) {
            threadId.push({
                threadType: proto.ThreadID.ThreadType.VIEW_REPLIES, 
                threadKey: {
                    remoteJid: quoted?.key?.remoteJid, 
                    fromMe: quoted?.key?.fromMe, 
                    id: generateMessageID(), 
                    ...(quoted?.key?.fromMe ? {} : { participant: quoted?.key?.participant }) 
                }
            })  
        }

        if (key === 'requestPaymentMessage' && requestPayment) {
            requestPayment.contextInfo = contextInfo
        } else {
            innerMessage[key].contextInfo = contextInfo
        }
    }

    if (key !== 'protocolMessage' &&
        key !== 'ephemeralMessage' &&
        !isJidNewsletter(jid)) { 
        message.messageContextInfo = {
            threadId: threadId.length > 0 ? threadId : [], 
            messageSecret: randomBytes(32), 
            ...message.messageContextInfo
        }
        innerMessage[key].contextInfo = {
            ...(innerMessage[key].contextInfo || {}),
            expiration: options.ephemeralExpiration ? options.ephemeralExpiration : 0
        }
    }

    message = WAProto.Message.fromObject(message)

    const messageJSON = {
        key: {
            remoteJid: jid,
            fromMe: true,
            id: options?.messageId || generateMessageID()
        },
        message: message,
        messageTimestamp: timestamp,
        messageStubParameters: [],
        participant: isJidGroup(jid) || isJidStatusBroadcast(jid) ? userJid : undefined,
        status: WAMessageStatus.PENDING
    }

    return WAProto.WebMessageInfo.fromObject(messageJSON)
}

const generateWAMessage = async (jid, content, options) => {
    options.logger = options?.logger?.child({ msgId: options.messageId })

    return generateWAMessageFromContent(jid, await generateWAMessageContent(content, { newsletter: isJidNewsletter(jid), ...options }), options)
}

const getContentType = (content) => {
    if (content) {
        const keys = Object.keys(content)
        const key = keys.find(k => (k === 'conversation' || k.endsWith('Message') || k.endsWith('V2') || k.endsWith('V3') || k.endsWith('V4')) && k !== 'senderKeyDistributionMessage' && k !== 'messageContextInfo')

        return key
    }
}

 





const normalizeMessageContent = (content) => {
    if (!content) {
        return undefined
    }

    for (let i = 0; i < 5; i++) {
        const inner = getFutureProofMessage(content)
        if (!inner) {
            break
        }

        content = inner.message
    }

    return content

    function getFutureProofMessage(message) {
        return (
               (message?.editedMessage)
            || (message?.statusAddYours) 
            || (message?.botTaskMessage) 
            || (message?.eventCoverImage) 
            || (message?.questionMessage) 
            || (message?.viewOnceMessage)
            || (message?.botInvokeMessage) 
            || (message?.ephemeralMessage) 
            || (message?.limitSharingMessage)
            || (message?.viewOnceMessageV2)
            || (message?.lottieStickerMessage)  
            || (message?.questionReplyMessage)             
            || (message?.botForwardedMessage) 
            || (message?.statusMentionMessage)  
            || (message?.pollCreationMessageV4)
            || (message?.associatedChildMessage)
            || (message?.groupMentionedMessage)             
            || (message?.groupStatusMentionMessage) 
            || (message?.viewOnceMessageV2Extension)            
            || (message?.documentWithCaptionMessage)
            || (message?.pollCreationOptionImageMessage))
    }
}

 



const extractMessageContent = (content) => {
    const extractFromButtonsMessage = (msg) => {
    const header = typeof msg.header === 'object' && msg.header !== null

        if (header ? msg.header?.imageMessage : msg.imageMessage) {
            return { imageMessage: header ? msg.header.imageMessage : msg.imageMessage }
        }

        else if (header ? msg.header?.documentMessage : msg.documentMessage) {
            return { documentMessage: header ? msg.header.documentMessage : msg.documentMessage }
        }

        else if (header ? msg.header?.videoMessage : msg.videoMessage) {
            return { videoMessage: header ? msg.header.videoMessage: msg.videoMessage }
        }

        else if (header ? msg.header?.locationMessage : msg.locationMessage) {
            return { locationMessage: header ? msg.header.locationMessage : msg.locationMessage }
        }

        else if (header ? msg.header?.productMessage : msg.productMessage) {
            return { productMessage: header ? msg.header.productMessage : msg.productMessage }
        }

        else {
            return {
                conversation: 'contentText' in msg
                    ? msg.contentText
                    : ('hydratedContentText' in msg ? msg.hydratedContentText : 'body' in msg ? msg.body.text : '')
            }
        }
    }

    content = normalizeMessageContent(content)

    if (content?.buttonsMessage) {
        return extractFromButtonsMessage(content.buttonsMessage)
    }

    if (content?.interactiveMessage) {
        return extractFromButtonsMessage(content.interactiveMessage) 
    }

    if (content?.templateMessage?.interactiveMessageTemplate) {
        return extractFromButtonsMessage(content?.templateMessage?.interactiveMessageTemplate) 
    }

    if (content?.templateMessage?.hydratedFourRowTemplate) {
        return extractFromButtonsMessage(content?.templateMessage?.hydratedFourRowTemplate)
    }

    if (content?.templateMessage?.hydratedTemplate) {
        return extractFromButtonsMessage(content?.templateMessage?.hydratedTemplate)
    }

    if (content?.templateMessage?.fourRowTemplate) {
        return extractFromButtonsMessage(content?.templateMessage?.fourRowTemplate)
    }

    return content
}

 


const getDevice = (id) => /^3A.{18}$/.test(id) ? 'ios' :
    /^3E.{20}$/.test(id) ? 'web' :
        /^(.{21}|.{32})$/.test(id) ? 'android' :
            /^(3F|.{18}$)/.test(id) ? 'desktop' :
                'baileys'

 
const updateMessageWithReceipt = (msg, receipt) => {
    msg.userReceipt = msg.userReceipt || []
    const recp = msg.userReceipt.find(m => m.userJid === receipt.userJid)

    if (recp) {
        Object.assign(recp, receipt)
    }

    else {
        msg.userReceipt.push(receipt)
    }
}

 
const updateMessageWithReaction = (msg, reaction) => {
    const authorID = getKeyAuthor(reaction.key)
    const reactions = (msg.reactions || [])
        .filter(r => getKeyAuthor(r.key) !== authorID)

    reaction.text = reaction.text || ''
    reactions.push(reaction) 
    msg.reactions = reactions
}

 
const updateMessageWithPollUpdate = (msg, update) => {
    const authorID = getKeyAuthor(update.pollUpdateMessageKey)
    const votes = (msg.pollUpdates || [])
        .filter(r => getKeyAuthor(r.pollUpdateMessageKey) !== authorID)

    if (update.vote?.selectedOptions?.length) {
        votes.push(update)
    }

    msg.pollUpdates = votes
}

 
const updateMessageWithEventResponse = (msg, update) => {
    const authorID = getKeyAuthor(update.eventResponseMessageKey)
    const responses = (msg.eventResponses || [])
            .filter(r => getKeyAuthor(r.eventResponseMessageKey) !== authorID)

    responses.push(update) 
    msg.eventResponses = responses
}

 





function getAggregateVotesInPollMessage({ message, pollUpdates }, meId) {
    message = normalizeMessageContent(message)

    const opts = message?.pollCreationMessage?.options || message?.pollCreationMessageV2?.options || message?.pollCreationMessageV3?.options || []

    const voteHashMap = opts.reduce((acc, opt) => {
        const hash = sha256(Buffer.from(opt.optionName || '')).toString()
        acc[hash] = {
            name: opt.optionName || '',
            voters: []
        }

        return acc
    }, {})

    for (const update of pollUpdates || []) {
        const { vote } = update

        if (!vote) {
            continue
        }

        for (const option of vote.selectedOptions || []) {
            const hash = option.toString()
            let data = voteHashMap[hash]

            if (!data) {
                voteHashMap[hash] = {
                    name: 'Unknown',
                    voters: []
                }

                data = voteHashMap[hash]
            }

            voteHashMap[hash].voters.push(getKeyAuthor(update.pollUpdateMessageKey, meId))
        }
    }

    return Object.values(voteHashMap)
}

 





function getAggregateResponsesInEventMessage({ eventResponses }, meLid) {
    const responseTypes = ['GOING', 'NOT_GOING', 'MAYBE']
    const responseMap = {}

    for (const type of responseTypes) {
            responseMap[type] = {
                    response: type, 
                    responders: []
            }
    }

    for (const update of eventResponses) {
            const { response } = update.response || 0
            const responseType = proto.Message.EventResponseMessage.EventResponseType[response]
            if (responseType !== 'UNKNOWN' && responseMap[responseType]) {
                    responseMap[responseType].responders.push(getKeyAuthor(update.eventResponseMessageKey, meLid)) 
            }
    }

    return Object.values(responseMap)
}

 
const aggregateMessageKeysNotFromMe = (keys) => {
    const keyMap = {}

    for (const { remoteJid, id, participant, fromMe } of keys) {
        if (!fromMe) {
            const uqKey = `${remoteJid}:${participant || ''}`

            if (!keyMap[uqKey]) {
                keyMap[uqKey] = {
                    jid: remoteJid,
                    participant: participant,
                    messageIds: []
                }
            }

            keyMap[uqKey].messageIds.push(id)
        }
    }

    return Object.values(keyMap)
}

const REUPLOAD_REQUIRED_STATUS = [410, 404]

 


const downloadMediaMessage = async (message, type, options, ctx) => {
    const result = await downloadMsg().catch(async (error) => {
        if (ctx &&
            typeof error?.status === 'number' &&  
            REUPLOAD_REQUIRED_STATUS.includes(error.status)) {
            ctx.logger.info({ key: message.key }, 'sending reupload media request...')

             
            message = await ctx.reuploadRequest(message)

            const result = await downloadMsg()
            return result
        }

        throw error
    })

    return result

    async function downloadMsg() {
        const mContent = extractMessageContent(message.message)

        if (!mContent) {
            throw new Boom('No message present', { statusCode: 400, data: message })
        }

        const contentType = getContentType(mContent)

        let mediaType = contentType?.replace('Message', '')

        const media = contentType === 'productMessage' ? mContent[contentType]?.product?.productImage : mContent[contentType]

        if (!media || typeof media !== 'object' || (!('url' in media) && !('thumbnailDirectPath' in media))) {
            throw new Boom(`"${contentType}" message is not a media message`)
        }

        let download

        if ('thumbnailDirectPath' in media && !('url' in media)) {
            download = {
                directPath: media.thumbnailDirectPath,
                mediaKey: media.mediaKey
            }
            mediaType = 'thumbnail-link'
        }
        else {
            download = media
        }

        const stream = await downloadContentFromMessage(download, mediaType, options)

        if (type === 'buffer') {
            const bufferArray = []
            for await (const chunk of stream) {
                bufferArray.push(chunk);
            }
            return Buffer.concat(bufferArray);
        }
        return stream
    }
}

 
const assertMediaContent = (content) => {
    content = extractMessageContent(content)

    const mediaContent = content?.documentMessage ||
        content?.imageMessage ||
        content?.videoMessage ||
        content?.audioMessage ||
        content?.stickerMessage

    if (!mediaContent) {
        throw new Boom('given message is not a media message', { statusCode: 400, data: content });
    }

    return mediaContent
}

module.exports = {
  extractUrlFromText, 
  generateLinkPreviewIfRequired, 
  prepareWAMessageMedia, 
  prepareAlbumMessageContent, 
  prepareDisappearingMessageSettingContent, 
  generateForwardMessageContent, 
  generateWAMessageContent, 
  generateWAMessageFromContent, 
  generateWAMessage, 
  getContentType, 
  hasNonNullishProperty, 
  normalizeMessageContent, 
  extractMessageContent, 
  getDevice,  
  updateMessageWithReceipt, 
  updateMessageWithReaction, 
  updateMessageWithPollUpdate, 
  updateMessageWithEventResponse, 
  getAggregateVotesInPollMessage, 
  getAggregateResponsesInEventMessage, 
  aggregateMessageKeysNotFromMe, 
  downloadMediaMessage, 
  assertMediaContent
}
return module.exports;
})();
for (const key of Object.keys(__kageModule74)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule74[key]});
}

 
const __kageModule178 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldIncludeBizBinaryNode = exports.assertMediaContent = exports.downloadMediaMessage = exports.aggregateMessageKeysNotFromMe = exports.updateMessageWithEventResponse = exports.updateMessageWithPollUpdate = exports.updateMessageWithReaction = exports.updateMessageWithReceipt = exports.getDevice = exports.extractMessageContent = exports.normalizeMessageContent = exports.getContentType = exports.generateWAMessage = exports.generateWAMessageFromContent = exports.generateWAMessageContent = exports.markViewOnce = exports.hasValidCarouselHeader = exports.hasValidInteractiveHeader = exports.hasValidAlbumMedia = exports.hasOptionalProperty = exports.hasNonNullishProperty = exports.generateForwardMessageContent = exports.prepareDisappearingMessageSettingContent = exports.prepareWAMessageMedia = exports.generateLinkPreviewIfRequired = exports.extractUrlFromText = void 0;
exports.getAggregateVotesInPollMessage = getAggregateVotesInPollMessage;
exports.getAggregateResponsesInEventMessage = getAggregateResponsesInEventMessage;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const index_js_1 = require("../../WAProto/index.js");
const index_js_2 = require("../Addon/index.js");
const index_js_3 = require("../Defaults/index.js");
const index_js_4 = require("../Types/index.js");
const index_js_5 = require("../WABinary/index.js");
const crypto_js_1 = require("./crypto.js");
const generics_js_1 = require("./generics.js");
const messages_media_js_1 = require("./messages-media.js");
const rich_message_utils_js_1 = require("./rich-message-utils.js");
const reporting_utils_js_1 = require("./reporting-utils.js");
const MIMETYPE_MAP = {
    image: 'image/jpeg',
    video: 'video/mp4',
    document: 'application/pdf',
    audio: 'audio/ogg; codecs=opus',
    sticker: 'image/webp',
    'product-catalog-image': 'image/jpeg'
};
 




const extractUrlFromText = (text) => text.match(index_js_3.URL_REGEX)?.[0];
exports.extractUrlFromText = extractUrlFromText;
const generateLinkPreviewIfRequired = async (text, getUrlInfo, logger) => {
    const url = (0, exports.extractUrlFromText)(text);
    if (!!getUrlInfo && url) {
        try {
            const urlInfo = await getUrlInfo(url);
            return urlInfo;
        }
        catch (error) {
             
            logger?.warn({ trace: error.stack }, 'url generation failed');
        }
    }
};
exports.generateLinkPreviewIfRequired = generateLinkPreviewIfRequired;
const ensureMessageProto = (m) => {
    if (m instanceof index_js_4.WAProto.Message)
        return m;
    return index_js_4.WAProto.Message.fromObject(m);
};
const assertColor = (color) => {
    if (typeof color === 'number') {
        return color < 0
            ? 0xffffffff + color + 1
            : color;
    }
    let hex = color.trim();
    if (hex.charCodeAt(0) === 35) {
        hex = hex.slice(1);
    }
    if (hex.length <= 6) {
        hex = hex.padStart(6, '0');
        hex = 'FF' + hex;
    }
    return parseInt(hex, 16);
};
const prepareWAMessageMedia = async (message, options) => {
    const logger = options.logger;
    let mediaType;
    for (const key of index_js_3.MEDIA_KEYS) {
        if (key in message) {
            mediaType = key;
        }
    }
    if (!mediaType) {
        throw new index_js_2.HttpError('Invalid media type', { statusCode: 400 });
    }
    const uploadData = {
        ...message,
        media: message[mediaType]
    };
    delete uploadData[mediaType];
     
    const cacheableKey = typeof uploadData.media === 'object' &&
        'url' in uploadData.media &&
        !!uploadData.media.url &&
        !!options.mediaCache &&
        mediaType + ':' + uploadData.media.url.toString();
    if (mediaType === 'document' && !uploadData.fileName) {
        uploadData.fileName = 'file';
    }
    if (!uploadData.mimetype) {
        uploadData.mimetype = MIMETYPE_MAP[mediaType];
    }
    if (cacheableKey) {
        const mediaBuff = await options.mediaCache.get(cacheableKey);
        if (mediaBuff) {
            logger?.debug({ cacheableKey }, 'got media cache hit');
            const obj = index_js_1.proto.Message.decode(mediaBuff);
            const key = `${mediaType}Message`;
            Object.assign(obj[key], { ...uploadData, media: undefined });
            return obj;
        }
    }
    const isNewsletter = !!options.jid && (0, index_js_5.isJidNewsletter)(options.jid);
    if (isNewsletter) {
        logger?.info({ key: cacheableKey }, 'Preparing raw media for newsletter');
        const { filePath, fileSha256, fileLength } = await (0, messages_media_js_1.getRawMediaUploadData)(uploadData.media, options.mediaTypeOverride || mediaType, logger);
        const fileSha256B64 = fileSha256.toString('base64');
        const { mediaUrl, directPath, thumbnailDirectPath, thumbnailSha256 } = await options.upload(filePath, {
            fileEncSha256B64: fileSha256B64,
            mediaType: mediaType,
            timeoutMs: options.mediaUploadTimeoutMs,
            newsletter: isNewsletter
        });
        await node_fs_1.promises.unlink(filePath);
        const obj = ensureMessageProto({
             
            [`${mediaType}Message`]: {
                url: mediaUrl,
                directPath,
                fileSha256,
                fileLength,
                thumbnailDirectPath,
                thumbnailSha256,
                ...uploadData,
                media: undefined
            }
        });
        if (uploadData.ptv) {
            obj.ptvMessage = obj.videoMessage;
            delete obj.videoMessage;
        }
        if (obj.stickerMessage) {
            obj.stickerMessage.stickerSentTs = Date.now();
        }
        if (cacheableKey) {
            logger?.debug({ cacheableKey }, 'set cache');
            await options.mediaCache.set(cacheableKey, index_js_4.WAProto.Message.encode(obj).finish());
        }
        return obj;
    }
    const requiresDurationComputation = mediaType === 'audio' && typeof uploadData.seconds === 'undefined';
    const requiresThumbnailComputation = (mediaType === 'image' || mediaType === 'video') && typeof uploadData['jpegThumbnail'] === 'undefined';
    const requiresWaveformProcessing = mediaType === 'audio' && uploadData.ptt === true && typeof uploadData.waveform === 'undefined';
    const requiresAudioBackground = options.backgroundColor && mediaType === 'audio' && uploadData.ptt === true;
    const requiresOriginalForSomeProcessing = requiresDurationComputation || requiresThumbnailComputation;
    const { mediaKey, encFilePath, originalFilePath, fileEncSha256, fileSha256, fileLength } = await (0, messages_media_js_1.encryptedStream)(uploadData.media, options.mediaTypeOverride || mediaType, {
        logger,
        saveOriginalFileIfRequired: requiresOriginalForSomeProcessing,
        opts: options.options
    });
    const fileEncSha256B64 = fileEncSha256.toString('base64');
    const [{ mediaUrl, directPath }] = await Promise.all([
        (async () => {
            const result = await options.upload(encFilePath, {
                fileEncSha256B64,
                mediaType,
                timeoutMs: options.mediaUploadTimeoutMs
            });
            logger?.debug({ mediaType, cacheableKey }, 'uploaded media');
            return result;
        })(),
        (async () => {
            try {
                if (requiresThumbnailComputation) {
                    const { thumbnail, originalImageDimensions } = await (0, messages_media_js_1.generateThumbnail)(originalFilePath, mediaType, options);
                    uploadData.jpegThumbnail = thumbnail;
                    if (!uploadData.width && originalImageDimensions) {
                        uploadData.width = originalImageDimensions.width;
                        uploadData.height = originalImageDimensions.height;
                        logger?.debug('set dimensions');
                    }
                    logger?.debug('generated thumbnail');
                }
                if (requiresDurationComputation || requiresWaveformProcessing) {
                    const computedData = await (0, messages_media_js_1.getAudioData)(originalFilePath, logger);
                    uploadData.seconds = computedData.durationSeconds;
                    uploadData.waveform = computedData.waveform;
                    logger?.debug('computed audio data');
                }
                if (requiresAudioBackground) {
                    uploadData.backgroundArgb = assertColor(options.backgroundColor);
                    logger?.debug('computed backgroundColor audio status');
                }
            }
            catch (error) {
                logger?.warn({ trace: error.stack }, 'failed to obtain extra info');
            }
        })()
    ]).finally(async () => {
        try {
            await node_fs_1.promises.unlink(encFilePath);
            if (originalFilePath) {
                await node_fs_1.promises.unlink(originalFilePath);
            }
            logger?.debug('removed tmp files');
        }
        catch (error) {
            logger?.warn('failed to remove tmp file');
        }
    });
    const obj = ensureMessageProto({
        [`${mediaType}Message`]: {
            url: mediaUrl,
            directPath,
            mediaKey,
            fileEncSha256,
            fileSha256,
            fileLength,
            mediaKeyTimestamp: (0, generics_js_1.unixTimestampSeconds)(),
            ...uploadData,
            media: undefined
        }
    });
    if (uploadData.ptv) {
        obj.ptvMessage = obj.videoMessage;
        delete obj.videoMessage;
    }
    if (cacheableKey) {
        logger?.debug({ cacheableKey }, 'set cache');
        await options.mediaCache.set(cacheableKey, index_js_4.WAProto.Message.encode(obj).finish());
    }
    return obj;
};
exports.prepareWAMessageMedia = prepareWAMessageMedia;
 
const prepareProductMessage = async (message, options) => {
    if (!message.businessOwnerJid) {
        throw new index_js_2.HttpError('"businessOwnerJid" is missing from the content', { statusCode: 400 });
    }
    const { imageMessage } = await (0, exports.prepareWAMessageMedia)({ image: message.image || message.product.productImage }, options);
     
    const { image, ...content } = message;
    content.product = {
        currencyCode: 'IDR',
        priceAmount1000: 1000,
        title: index_js_3.LIBRARY_NAME,
        ...message.product,
        productImage: imageMessage
    };
    return content;
};
 





 
const prepareStickerPackMessage = async (message, options) => {
    const { cover, stickers = [], name = '📦 Sticker Pack', publisher = 'GitHub: itsliaaa', description = '🏷️ kage-baileys' } = message;
    if (stickers.length > 60) {
        throw new index_js_2.HttpError('Sticker pack exceeds the maximum limit of 60 stickers', { statusCode: 400 });
    }
    if (stickers.length === 0) {
        throw new index_js_2.HttpError('Sticker pack must contain at least one sticker', { statusCode: 400 });
    }
    if (!cover) {
        throw new index_js_2.HttpError('Sticker pack must contain a cover', { statusCode: 400 });
    }
    const logger = options.logger;
     
    let cacheableKey = false;
    if (Array.isArray(stickers) && stickers.length && options.mediaCache) {
        const urls = [];
        for (let i = 0; i < stickers.length; i++) {
            const data = stickers[i].data;
            if (typeof data === 'object' && data?.url) {
                urls.push(data.url);
            }
        }
        if (urls.length > 0) {
            cacheableKey = 'sticker:' + urls.join('@');
        }
    }
    if (cacheableKey) {
        const mediaBuff = await options.mediaCache.get(cacheableKey);
        if (mediaBuff) {
            logger?.debug({ cacheableKey }, 'got media cache hit');
            return index_js_1.proto.Message.StickerPackMessage.decode(mediaBuff);
        }
    }
    const lib = await (0, messages_media_js_1.getImageProcessingLibrary)();
    const hasSharp = 'sharp' in lib && !!lib.sharp?.default;
    const hasImage = 'image' in lib && !!lib.image?.Transformer;
    const hasJimp = 'jimp' in lib && !!lib.jimp?.Jimp;
    if (!hasSharp && !hasImage) {
        throw new index_js_2.HttpError('No image processing library (sharp or @napi-rs/image) available for converting sticker to WebP.');
    }
    const stickerPackIdValue = (0, generics_js_1.generateMessageIDV2)();
    const stickerData = new Array(stickers.length);
    const stickerMetadata = new Array(stickers.length);
    await Promise.all(stickers.map(async (sticker, index) => {
        const { stream } = await (0, messages_media_js_1.getStream)(sticker.data);
        const buffer = await (0, messages_media_js_1.toBuffer)(stream);
        let webpBuffer;
        let isAnimated = false;
        if (isWebPBuffer(buffer)) {
            webpBuffer = buffer;
            isAnimated = isAnimatedWebP(buffer);
        }
        else if (hasSharp) {
            webpBuffer = await lib.sharp.default(buffer)
                .resize(512, 512, { fit: 'inside' })
                .webp({ quality: 80 })
                .toBuffer();
        }
        else {
            webpBuffer = await new lib.image.Transformer(buffer)
                .resize(512, 512)
                .webp(80);
        }
        if (webpBuffer.length > 1024 * 1024) {
            throw new index_js_2.HttpError(`Sticker at index ${index} exceeds the 1MB size limit`, { statusCode: 400 });
        }
        const hash = (0, crypto_js_1.sha256)(webpBuffer)
            .toString('base64')
            .replace(/\//g, '-');
        const fileName = `${hash}.webp`;
        stickerData[index] = {
            name: fileName,
            data: webpBuffer
        };
        stickerMetadata[index] = {
            fileName,
            mimetype: 'image/webp',
            isAnimated,
            isLottie: sticker.isLottie || false,
            emojis: sticker.emojis || ['✨'],
            accessibilityLabel: sticker.accessibilityLabel || '‎'
        };
    }));
    const trayIconFileName = `${stickerPackIdValue}.webp`;
    const { stream: coverStream } = await (0, messages_media_js_1.getStream)(cover);
    const coverBuffer = await (0, messages_media_js_1.toBuffer)(coverStream);
    let coverWebpBuffer;
    if (isWebPBuffer(coverBuffer)) {
        coverWebpBuffer = coverBuffer;
    }
    else if (hasSharp) {
        coverWebpBuffer = await lib.sharp.default(coverBuffer)
            .resize(512, 512, { fit: 'inside' })
            .webp({ quality: 80 })
            .toBuffer();
    }
    else {
        coverWebpBuffer = await new lib.image.Transformer(coverBuffer)
            .resize(512, 512)
            .webp(80);
    }
    stickerData[stickers.length] = {
        name: trayIconFileName,
        data: coverWebpBuffer
    };
    const zipBuffer = await (0, index_js_2.createZip)(stickerData);
    const stickerPackUpload = await (0, messages_media_js_1.encryptedStream)(zipBuffer, 'sticker-pack', {
        logger,
        opts: options.options
    });
    let stickerPackUploadResult;
    try {
        stickerPackUploadResult = await options.upload(stickerPackUpload.encFilePath, {
            fileEncSha256B64: stickerPackUpload.fileEncSha256.toString('base64'),
            mediaType: 'sticker-pack',
            timeoutMs: options.mediaUploadTimeoutMs
        });
    }
    finally {
        node_fs_1.promises.unlink(stickerPackUpload.encFilePath).catch(() => logger?.warn('failed to remove tmp file'));
    }
    const obj = {
        name,
        publisher,
        stickerPackId: stickerPackIdValue,
        packDescription: description,
        stickerPackOrigin: index_js_1.proto.Message.StickerPackMessage.StickerPackOrigin.USER_CREATED,
        stickerPackSize: zipBuffer.length,
        stickers: stickerMetadata,
        fileSha256: stickerPackUpload.fileSha256,
        fileEncSha256: stickerPackUpload.fileEncSha256,
        mediaKey: stickerPackUpload.mediaKey,
        directPath: stickerPackUploadResult.directPath,
        fileLength: stickerPackUpload.fileLength,
        mediaKeyTimestamp: (0, generics_js_1.unixTimestampSeconds)(),
        trayIconFileName
    };
    try {
        let thumbnailBuffer;
        if (hasSharp) {
            thumbnailBuffer = await lib.sharp.default(coverBuffer).resize(252, 252).jpeg().toBuffer();
        }
        else if (hasImage) {
            thumbnailBuffer = await new lib.image.Transformer(coverBuffer).resize(252, 252).jpeg();
        }
        else if (hasJimp) {
            const jimpImage = await lib.jimp.Jimp.read(coverBuffer);
            thumbnailBuffer = await jimpImage.resize({ w: 252, h: 252 }).getBuffer('image/jpeg');
        }
        else {
            throw new Error('No image processing library available for thumbnail generation');
        }
        if (!thumbnailBuffer || thumbnailBuffer.length === 0) {
            throw new Error('Failed to generate thumbnail buffer');
        }
        const thumbUpload = await (0, messages_media_js_1.encryptedStream)(thumbnailBuffer, 'thumbnail-sticker-pack', {
            logger,
            opts: options.options,
            mediaKey: stickerPackUpload.mediaKey
        });
        let thumbUploadResult;
        try {
            thumbUploadResult = await options.upload(thumbUpload.encFilePath, {
                fileEncSha256B64: thumbUpload.fileEncSha256.toString('base64'),
                mediaType: 'thumbnail-sticker-pack',
                timeoutMs: options.mediaUploadTimeoutMs
            });
        }
        finally {
            node_fs_1.promises.unlink(thumbUpload.encFilePath).catch(() => logger?.warn('failed to remove tmp file'));
        }
        Object.assign(obj, {
            thumbnailDirectPath: thumbUploadResult.directPath,
            thumbnailSha256: thumbUpload.fileSha256,
            thumbnailEncSha256: thumbUpload.fileEncSha256,
            thumbnailHeight: 252,
            thumbnailWidth: 252,
            imageDataHash: (0, crypto_js_1.sha256)(thumbnailBuffer).toString('base64')
        });
    }
    catch (error) {
        logger?.warn(`Thumbnail generation failed: ${error}`);
    }
    if (cacheableKey) {
        logger?.debug({ cacheableKey }, 'set cache (background)');
        options.mediaCache.set(cacheableKey, index_js_4.WAProto.Message.StickerPackMessage.encode(obj).finish());
    }
    return index_js_4.WAProto.Message.StickerPackMessage.fromObject(obj);
};
 
const prepareNativeFlowButtons = (message) => {
    const buttons = message.nativeFlow;
    const isButtonsFieldArray = Array.isArray(buttons);
    const correctedField = isButtonsFieldArray ? buttons : buttons.buttons;
    const messageParamsJson = {};
     
    if ((0, exports.hasOptionalProperty)(message, 'offerText') && !!message.offerText) {
        Object.assign(messageParamsJson, {
            limited_time_offer: {
                text: message.offerText || index_js_3.LIBRARY_NAME,
                url: message.offerUrl || index_js_3.DONATE_URL,  
                copy_code: message.offerCode,
                expiration_time: message.offerExpiration
            }
        });
    }
    if ((0, exports.hasOptionalProperty)(message, 'optionText') && !!message.optionText) {
        Object.assign(messageParamsJson, {
            bottom_sheet: {
                in_thread_buttons_limit: 1,
                divider_indices: Array.from({ length: correctedField.length }, (_, index) => index),
                list_title: message.optionTitle || '📄 Select Options',
                button_title: message.optionText
            }
        });
    }
    return {
        buttons: correctedField.map(button => {
            const buttonText = button.text || button.buttonText;
            const buttonIcon = button.icon?.toUpperCase();
            if ((0, exports.hasOptionalProperty)(button, 'id') && !!button.id) {
                return {
                    name: 'quick_reply',
                    buttonParamsJson: JSON.stringify({
                        display_text: buttonText || '👉🏻 Click',
                        id: button.id,
                        icon: buttonIcon
                    })
                };
            }
            else if ((0, exports.hasOptionalProperty)(button, 'copy') && !!button.copy) {
                return {
                    name: 'cta_copy',
                    buttonParamsJson: JSON.stringify({
                        display_text: buttonText || '📋 Copy',
                        copy_code: button.copy,
                        icon: buttonIcon
                    })
                };
            }
            else if ((0, exports.hasOptionalProperty)(button, 'url') && !!button.url) {
                return {
                    name: 'cta_url',
                    buttonParamsJson: JSON.stringify({
                        display_text: buttonText || '🌐 Visit',
                        url: button.url,
                        merchant_url: button.url,
                        webview_interaction: button.useWebview,
                        icon: buttonIcon
                    })
                };
            }
            else if ((0, exports.hasOptionalProperty)(button, 'call') && !!button.call) {
                return {
                    name: 'cta_call',
                    buttonParamsJson: JSON.stringify({
                        display_text: buttonText || '📞 Call',
                        phone_number: button.call,
                        icon: buttonIcon
                    })
                };
            }
             
            else if ((0, exports.hasOptionalProperty)(button, 'sections') && !!button.sections) {
                return {
                    name: 'single_select',
                    buttonParamsJson: JSON.stringify({
                        title: buttonText || '📋 Select',
                        sections: button.sections,
                        icon: buttonIcon
                    })
                };
            }
            return button;
        }),
        messageParamsJson: JSON.stringify(messageParamsJson)
    };
};
const prepareDisappearingMessageSettingContent = (ephemeralExpiration) => {
    ephemeralExpiration = ephemeralExpiration || 0;
    const content = {
        ephemeralMessage: {
            message: {
                protocolMessage: {
                    type: index_js_4.WAProto.Message.ProtocolMessage.Type.EPHEMERAL_SETTING,
                    ephemeralExpiration
                }
            }
        }
    };
    return index_js_4.WAProto.Message.fromObject(content);
};
exports.prepareDisappearingMessageSettingContent = prepareDisappearingMessageSettingContent;
 




const generateForwardMessageContent = (message, forceForward) => {
    let content = message.message;
    if (!content) {
        throw new index_js_2.HttpError('no content in message', { statusCode: 400 });
    }
     
    content = (0, exports.normalizeMessageContent)(content);
    content = index_js_1.proto.Message.decode(index_js_1.proto.Message.encode(content).finish());
    let key = Object.keys(content)[0];
    let score = content?.[key]?.contextInfo?.forwardingScore || 0;
    score += message.key.fromMe && !forceForward ? 0 : 1;
    if (key === 'conversation') {
        content.extendedTextMessage = { text: content[key] };
        delete content.conversation;
        key = 'extendedTextMessage';
    }
    const key_ = content?.[key];
    if (score > 0) {
        key_.contextInfo = { forwardingScore: score, isForwarded: true };
    }
    else {
        key_.contextInfo = {};
    }
    return content;
};
exports.generateForwardMessageContent = generateForwardMessageContent;
const hasNonNullishProperty = (message, key) => {
    return message != null &&
        typeof message === 'object' &&
        key in message &&
        message[key] != null;
};
exports.hasNonNullishProperty = hasNonNullishProperty;
const hasOptionalProperty = (obj, key) => {
    return obj != null &&
        typeof obj === 'object' &&
        key in obj &&
        obj[key] != null;
};
exports.hasOptionalProperty = hasOptionalProperty;
 
const hasValidAlbumMedia = (message) => {
    return !!(message.imageMessage ||
        message.videoMessage);
};
exports.hasValidAlbumMedia = hasValidAlbumMedia;
const hasValidInteractiveHeader = (message) => {
    return !!(message.imageMessage ||
        message.videoMessage ||
        message.documentMessage ||
        message.productMessage ||
        message.locationMessage);
};
exports.hasValidInteractiveHeader = hasValidInteractiveHeader;
 
const hasValidCarouselHeader = (message) => {
    return !!(message.imageMessage ||
        message.videoMessage ||
        message.productMessage);
};
exports.hasValidCarouselHeader = hasValidCarouselHeader;
const markViewOnce = (m) => {
    const type = (0, exports.getContentType)(m);
    if (!type)
        return;
    const content = m[type];
    if (!content || typeof content !== 'object')
        return;
    const MessageType = index_js_4.WAProto.Message[type.charAt(0).toUpperCase() + type.slice(1)];
    if (!MessageType?.prototype || !('viewOnce' in MessageType.prototype))
        return;
    content.viewOnce = true;
};
exports.markViewOnce = markViewOnce;
const generateWAMessageContent = async (message, options) => {
    var _a, _b;
    let m = {};
     
    if ((0, exports.hasNonNullishProperty)(message, 'raw')) {
        delete message.raw;
        return message;
    }
     
    else if ((0, exports.hasNonNullishProperty)(message, 'code') ||
        (0, exports.hasNonNullishProperty)(message, 'links') ||
        (0, exports.hasNonNullishProperty)(message, 'table') ||
        (0, exports.hasNonNullishProperty)(message, 'richResponse')) {
        m = (0, rich_message_utils_js_1.prepareRichResponseMessage)(message);
    }
    else if ((0, exports.hasNonNullishProperty)(message, 'text')) {
        const extContent = { text: message.text };
        let urlInfo = message.linkPreview;
        if (urlInfo == null) {
            urlInfo = await (0, exports.generateLinkPreviewIfRequired)(message.text, options.getUrlInfo, options.logger);
        }
        if (urlInfo) {
            extContent.matchedText = urlInfo['matched-text'];
            extContent.jpegThumbnail = urlInfo.jpegThumbnail;
            extContent.description = urlInfo.description;
            extContent.title = urlInfo.title;
            extContent.previewType = urlInfo.previewType ?? urlInfo['preview-type'] ?? 0;
            extContent.linkPreviewMetadata = urlInfo.linkPreviewMetadata;
            const img = urlInfo.highQualityThumbnail;
            if (img) {
                extContent.thumbnailDirectPath = img.directPath;
                extContent.mediaKey = img.mediaKey;
                extContent.mediaKeyTimestamp = img.mediaKeyTimestamp;
                extContent.thumbnailWidth = img.width;
                extContent.thumbnailHeight = img.height;
                extContent.thumbnailSha256 = img.fileSha256;
                extContent.thumbnailEncSha256 = img.fileEncSha256;
            }
        }
        const customFavicon = message.favicon;
        const favicon = customFavicon && typeof options.upload === 'function'
            ? (await (0, exports.prepareWAMessageMedia)({ image: customFavicon }, options)).imageMessage
            : urlInfo?.favicon;
        if (favicon) {
            extContent.faviconMmsMetadata = {
                thumbnailDirectPath: favicon.directPath,
                mediaKey: favicon.mediaKey,
                mediaKeyTimestamp: favicon.mediaKeyTimestamp,
                thumbnailWidth: 32,
                thumbnailHeight: 32,
                thumbnailSha256: favicon.fileSha256,
                thumbnailEncSha256: favicon.fileEncSha256
            };
        }
        if (options.backgroundColor) {
            extContent.backgroundArgb = assertColor(options.backgroundColor);
        }
        if (options.font) {
            extContent.font = options.font;
        }
        m.extendedTextMessage = extContent;
    }
    else if ((0, exports.hasNonNullishProperty)(message, 'contacts')) {
        const contactLen = message.contacts.contacts.length;
        if (!contactLen) {
            throw new index_js_2.HttpError('require atleast 1 contact', { statusCode: 400 });
        }
        if (contactLen === 1) {
            m.contactMessage = index_js_4.WAProto.Message.ContactMessage.create(message.contacts.contacts[0]);
        }
        else {
            m.contactsArrayMessage = index_js_4.WAProto.Message.ContactsArrayMessage.create(message.contacts);
        }
    }
    else if ((0, exports.hasNonNullishProperty)(message, 'location')) {
        m.locationMessage = index_js_4.WAProto.Message.LocationMessage.create(message.location);
    }
    else if ((0, exports.hasNonNullishProperty)(message, 'react')) {
        if (!message.react.senderTimestampMs) {
            message.react.senderTimestampMs = Date.now();
        }
        m.reactionMessage = index_js_4.WAProto.Message.ReactionMessage.create(message.react);
    }
    else if ((0, exports.hasNonNullishProperty)(message, 'delete')) {
        m.protocolMessage = {
            key: message.delete,
            type: index_js_4.WAProto.Message.ProtocolMessage.Type.REVOKE
        };
    }
    else if ((0, exports.hasNonNullishProperty)(message, 'forward')) {
        m = (0, exports.generateForwardMessageContent)(message.forward, message.force);
    }
    else if ((0, exports.hasNonNullishProperty)(message, 'disappearingMessagesInChat')) {
        const exp = typeof message.disappearingMessagesInChat === 'boolean'
            ? message.disappearingMessagesInChat
                ? index_js_3.WA_DEFAULT_EPHEMERAL
                : 0
            : message.disappearingMessagesInChat;
        m = (0, exports.prepareDisappearingMessageSettingContent)(exp);
    }
    else if ((0, exports.hasNonNullishProperty)(message, 'groupInvite')) {
        m.groupInviteMessage = {};
        m.groupInviteMessage.inviteCode = message.groupInvite.inviteCode;
        m.groupInviteMessage.inviteExpiration = message.groupInvite.inviteExpiration;
        m.groupInviteMessage.caption = message.groupInvite.text;
        m.groupInviteMessage.groupJid = message.groupInvite.jid;
        m.groupInviteMessage.groupName = message.groupInvite.subject;
         
         
        if (options.getProfilePicUrl) {
            const pfpUrl = await options.getProfilePicUrl(message.groupInvite.jid, 'preview');
            if (pfpUrl) {
                const resp = await fetch(pfpUrl, { method: 'GET', dispatcher: options?.options?.dispatcher });
                if (resp.ok) {
                    const buf = Buffer.from(await resp.arrayBuffer());
                    m.groupInviteMessage.jpegThumbnail = buf;
                }
            }
        }
    }
    else if ((0, exports.hasNonNullishProperty)(message, 'stickers')) {
        m.stickerPackMessage = await prepareStickerPackMessage(message, options);
    }
    else if ((0, exports.hasNonNullishProperty)(message, 'pin')) {
        m.pinInChatMessage = {};
        m.messageContextInfo = {};
        m.pinInChatMessage.key = message.pin;
        m.pinInChatMessage.type = message.type;
        m.pinInChatMessage.senderTimestampMs = Date.now();
        m.messageContextInfo.messageAddOnDurationInSecs = message.type === 1 ? message.time || 86400 : 0;
    }
    else if ((0, exports.hasNonNullishProperty)(message, 'keep')) {
        m.keepInChatMessage = {};
        m.keepInChatMessage.key = message.keep;
        m.keepInChatMessage.keepType = message.type;
        m.keepInChatMessage.timestampMs = Date.now();
    }
    else if ((0, exports.hasNonNullishProperty)(message, 'flowReply')) {
        m.interactiveResponseMessage = {
            body: {
                format: message.flowReply.format || index_js_1.proto.Message.InteractiveResponseMessage.Body.Format.DEFAULT,
                text: message.flowReply.text
            },
            nativeFlowResponseMessage: {
                name: message.flowReply.name,
                paramsJson: message.flowReply.paramsJson || '{}',
                version: message.flowReply.version || 1
            }
        };
    }
    else if ((0, exports.hasNonNullishProperty)(message, 'buttonReply')) {
        switch (message.type) {
            case 'template':
                m.templateButtonReplyMessage = {
                    selectedDisplayText: message.buttonReply.displayText,
                    selectedId: message.buttonReply.id,
                    selectedIndex: message.buttonReply.index
                };
                break;
            case 'plain':
                m.buttonsResponseMessage = {
                    selectedButtonId: message.buttonReply.id,
                    selectedDisplayText: message.buttonReply.displayText,
                    type: index_js_1.proto.Message.ButtonsResponseMessage.Type.DISPLAY_TEXT
                };
                break;
        }
    }
    else if ((0, exports.hasNonNullishProperty)(message, 'listReply')) {
        m.listResponseMessage = {
            description: message.listReply.description,
            listType: index_js_1.proto.Message.ListResponseMessage.ListType.SINGLE_SELECT,
            singleSelectReply: {
                selectedRowId: message.listReply.id
            },
            title: message.listReply.title
        };
    }
    else if ((0, exports.hasOptionalProperty)(message, 'ptv') && message.ptv) {
        const { videoMessage } = await (0, exports.prepareWAMessageMedia)({ video: message.video }, options);
        m.ptvMessage = videoMessage;
    }
    else if ((0, exports.hasNonNullishProperty)(message, 'product')) {
        m.productMessage = await prepareProductMessage(message, options);
    }
    else if ((0, exports.hasNonNullishProperty)(message, 'event')) {
        m.eventMessage = {};
        const startTime = Math.floor(message.event.startDate.getTime() / 1000);
        if (message.event.call && options.getCallLink) {
            const token = await options.getCallLink(message.event.call, { startTime });
            m.eventMessage.joinLink = (message.event.call === 'audio' ? index_js_3.CALL_AUDIO_PREFIX : index_js_3.CALL_VIDEO_PREFIX) + token;
        }
        m.messageContextInfo = {
             
            messageSecret: message.event.messageSecret || (0, node_crypto_1.randomBytes)(32)
        };
        m.eventMessage.name = message.event.name;
        m.eventMessage.description = message.event.description;
        m.eventMessage.startTime = startTime;
        m.eventMessage.endTime = message.event.endDate ? message.event.endDate.getTime() / 1000 : undefined;
        m.eventMessage.isCanceled = message.event.isCancelled ?? false;
        m.eventMessage.extraGuestsAllowed = message.event.extraGuestsAllowed;
        m.eventMessage.isScheduleCall = message.event.isScheduleCall ?? false;
        m.eventMessage.location = message.event.location;
    }
    else if ((0, exports.hasNonNullishProperty)(message, 'poll')) {
        (_a = message.poll).selectableCount || (_a.selectableCount = 0);
        (_b = message.poll).toAnnouncementGroup || (_b.toAnnouncementGroup = false);
        if (!Array.isArray(message.poll.values)) {
            throw new index_js_2.HttpError('Invalid poll values', { statusCode: 400 });
        }
        if (message.poll.selectableCount < 0 || message.poll.selectableCount > message.poll.values.length) {
            throw new index_js_2.HttpError(`poll.selectableCount in poll should be >= 0 and <= ${message.poll.values.length}`, {
                statusCode: 400
            });
        }
        const pollCreationMessage = {
            name: message.poll.name,
            selectableOptionsCount: message.poll.selectableCount,
            options: message.poll.values.map(optionName => ({ optionName })),
            endTime: message.poll.endDate ? message.poll.endDate.getTime() : undefined,
            hideParticipantName: message.poll.hideVoter ?? false,
            allowAddOption: message.poll.canAddOption ?? false
        };
        if (message.poll.toAnnouncementGroup) {
             
            m.pollCreationMessageV2 = pollCreationMessage;
        }
        else {
             
            if (message.poll.pollType === 1) {
                if (!message.poll.correctAnswer) {
                    throw new index_js_2.HttpError('No "correctAnswer" provided for quiz', { statusCode: 400 });
                }
                m.pollCreationMessageV5 = {
                     
                    ...pollCreationMessage,
                    correctAnswer: {
                        optionName: message.poll.correctAnswer.toString()
                    },
                    pollType: 1,
                    selectableOptionsCount: 1
                };
            }
            else if (message.poll.selectableCount === 1) {
                 
                m.pollCreationMessageV3 = pollCreationMessage;
            }
            else {
                 
                m.pollCreationMessage = pollCreationMessage;
            }
        }
        m.messageContextInfo = {
             
            messageSecret: message.poll.messageSecret || (0, node_crypto_1.randomBytes)(32)
        };
    }
     
    else if ((0, exports.hasNonNullishProperty)(message, 'pollResult')) {
        const pollResultSnapshotMessage = {
            name: message.pollResult.name,
            pollVotes: message.pollResult.votes.map(vote => ({
                optionName: vote.name,
                optionVoteCount: parseInt(vote.voteCount)
            }))
        };
        if (message.pollResult.pollType === 1) {
            pollResultSnapshotMessage.pollType = index_js_1.proto.Message.PollType.QUIZ;
            m.pollResultSnapshotMessageV3 = pollResultSnapshotMessage;
        }
        else {
            pollResultSnapshotMessage.pollType = index_js_1.proto.Message.PollType.POLL;
            m.pollResultSnapshotMessage = pollResultSnapshotMessage;
        }
    }
     
    else if ((0, exports.hasNonNullishProperty)(message, 'pollUpdate')) {
        if (!message.pollUpdate.key) {
            throw new index_js_2.HttpError('Message key is required', { statusCode: 400 });
        }
        if (!message.pollUpdate.vote) {
            throw new index_js_2.HttpError('Encrypted vote payload is required', { statusCode: 400 });
        }
        m.pollUpdateMessage = {
            metadata: message.pollUpdate.metadata,
            pollCreationMessageKey: message.pollUpdate.key,
            senderTimestampMs: Date.now(),
            vote: message.pollUpdate.vote
        };
    }
     
    else if ((0, exports.hasNonNullishProperty)(message, 'paymentInviteServiceType')) {
        m.paymentInviteMessage = {
            expiryTimestamp: Date.now(),
            serviceType: message.paymentInviteServiceType
        };
    }
     
    else if ((0, exports.hasNonNullishProperty)(message, 'orderText')) {
        if (!Buffer.isBuffer(message.thumbnail)) {
            throw new index_js_2.HttpError('Must provide thumbnail buffer in order message', { statusCode: 400 });
        }
        m.orderMessage = {
            itemCount: 1,
            messageVersion: 1,
            orderTitle: index_js_3.LIBRARY_NAME,
            status: index_js_1.proto.Message.OrderMessage.OrderStatus.INQUIRY,
            surface: index_js_1.proto.Message.OrderMessage.OrderSurface.CATALOG,
            token: (0, generics_js_1.generateMessageIDV2)(),
            totalAmount1000: 1000,
            totalCurrencyCode: 'IDR',
            ...message,
            message: message.orderText
        };
        delete m.orderMessage.orderText;
    }
     
    else if ((0, exports.hasNonNullishProperty)(message, 'album')) {
        if (!Array.isArray(message.album)) {
            throw new index_js_2.HttpError('Invalid album type. Expected an array.', { statusCode: 400 });
        }
        let videoCount = 0;
        for (let i = 0; i < message.album.length; i++) {
            if (message.album[i].video)
                videoCount++;
        }
        ;
        let imageCount = 0;
        for (let i = 0; i < message.album.length; i++) {
            if (message.album[i].image)
                imageCount++;
        }
        ;
        if ((videoCount + imageCount) < 2) {
            throw new index_js_2.HttpError('Minimum provide 2 media to upload album message', { statusCode: 400 });
        }
        m.albumMessage = {
            expectedImageCount: imageCount,
            expectedVideoCount: videoCount
        };
    }
    else if ((0, exports.hasNonNullishProperty)(message, 'sharePhoneNumber')) {
        m.protocolMessage = {
            type: index_js_1.proto.Message.ProtocolMessage.Type.SHARE_PHONE_NUMBER
        };
    }
    else if ((0, exports.hasNonNullishProperty)(message, 'requestPhoneNumber')) {
        m.requestPhoneNumberMessage = {};
    }
    else if ((0, exports.hasNonNullishProperty)(message, 'limitSharing')) {
        m.protocolMessage = {
            type: index_js_1.proto.Message.ProtocolMessage.Type.LIMIT_SHARING,
            limitSharing: {
                sharingLimited: message.limitSharing === true,
                trigger: 1,
                limitSharingSettingTimestamp: Date.now(),
                initiatedByMe: true
            }
        };
    }
    else {
        m = await (0, exports.prepareWAMessageMedia)(message, options);
    }
     
    if ((0, exports.hasNonNullishProperty)(message, 'buttons')) {
        const buttonsMessage = {
            buttons: message.buttons.map(button => {
                 
                const buttonText = button.text || button.buttonText;
                if ((0, exports.hasOptionalProperty)(button, 'sections')) {
                    return {
                        nativeFlowInfo: {
                            name: 'single_select',
                            paramsJson: JSON.stringify({
                                title: buttonText,
                                sections: button.sections
                            })
                        },
                        type: index_js_4.ButtonType.NATIVE_FLOW
                    };
                }
                else if ((0, exports.hasOptionalProperty)(button, 'name')) {
                    return {
                        nativeFlowInfo: {
                            name: button.name,
                            paramsJson: button.paramsJson
                        },
                        type: index_js_4.ButtonType.NATIVE_FLOW
                    };
                }
                return {
                    buttonId: button.id || button.buttonId,
                    buttonText: typeof buttonText === 'string' ? { displayText: buttonText } : buttonText,
                    type: button.type || index_js_4.ButtonType.RESPONSE
                };
            })
        };
        if ((0, exports.hasOptionalProperty)(message, 'text')) {
            buttonsMessage.contentText = message.text;
            buttonsMessage.headerType = index_js_4.ButtonHeaderType.EMPTY;
        }
        else {
            if ((0, exports.hasOptionalProperty)(message, 'caption')) {
                buttonsMessage.contentText = message.caption;
            }
            const type = Object.keys(m)[0].replace('Message', '').toUpperCase();
            buttonsMessage.headerType = index_js_4.ButtonHeaderType[type];
            Object.assign(buttonsMessage, m);
        }
        if ((0, exports.hasOptionalProperty)(message, 'footer')) {
            buttonsMessage.footerText = message.footer;
        }
        m = { buttonsMessage };
    }
    else if ((0, exports.hasNonNullishProperty)(message, 'sections')) {
        const listMessage = {
            sections: message.sections,
            buttonText: message.buttonText,
            title: message.title,
            footerText: message.footer,
            description: message.text,
            listType: index_js_4.ListType.SINGLE_SELECT
        };
        m = { listMessage };
    }
     
    else if ((0, exports.hasNonNullishProperty)(message, 'templateButtons')) {
        const hydratedTemplate = {
            hydratedButtons: message.templateButtons.map((button, i) => {
                const buttonText = button.text || button.buttonText;
                if ((0, exports.hasOptionalProperty)(button, 'id')) {
                    return {
                        index: i,
                        quickReplyButton: {
                            displayText: buttonText || '👉🏻 Click',
                            id: button.id
                        }
                    };
                }
                else if ((0, exports.hasOptionalProperty)(button, 'url')) {
                    return {
                        index: i,
                        urlButton: {
                            displayText: buttonText || '🌐 Visit',
                            url: button.url
                        }
                    };
                }
                else if ((0, exports.hasOptionalProperty)(button, 'call')) {
                    return {
                        index: i,
                        callButton: {
                            displayText: buttonText || '📞 Call',
                            phoneNumber: button.call
                        }
                    };
                }
                button.index = button.index || i;
                return button;
            })
        };
        if ((0, exports.hasOptionalProperty)(message, 'text')) {
            hydratedTemplate.hydratedContentText = message.text;
        }
        else {
            if ((0, exports.hasOptionalProperty)(message, 'caption')) {
                hydratedTemplate.hydratedTitleText = message.title;
                hydratedTemplate.hydratedContentText = message.caption;
            }
            ;
            Object.assign(hydratedTemplate, m);
        }
        if ((0, exports.hasOptionalProperty)(message, 'footer')) {
            hydratedTemplate.hydratedFooterText = message.footer;
        }
        hydratedTemplate.templateId = message.id || 'template-' + Date.now();  
        m = {
            templateMessage: {
                hydratedFourRowTemplate: hydratedTemplate,
                hydratedTemplate: hydratedTemplate
            }
        };
    }
    else if ((0, exports.hasNonNullishProperty)(message, 'nativeFlow')) {
        const interactiveMessage = {
            nativeFlowMessage: prepareNativeFlowButtons(message)
        };
        if ((0, exports.hasOptionalProperty)(message, 'bizJid')) {
            interactiveMessage.collectionMessage = {
                bizJid: message.bizJid,
                id: message.id,
                messageVersion: 1
            };
        }
        else if ((0, exports.hasOptionalProperty)(message, 'shopSurface')) {
            interactiveMessage.shopStorefrontMessage = {
                surface: message.shopSurface,
                id: message.id,
                messageVersion: 1
            };
        }
        if ((0, exports.hasOptionalProperty)(message, 'text')) {
            interactiveMessage.body = { text: message.text };
        }
        else {
            if ((0, exports.hasOptionalProperty)(message, 'caption')) {
                const isValidHeader = (0, exports.hasValidInteractiveHeader)(m);
                if (!isValidHeader) {
                    throw new index_js_2.HttpError('Invalid media type for interactive message header', { statusCode: 400 });
                }
                interactiveMessage.header = {
                    title: message.title || '',
                    subtitle: message.subtitle || '',
                    hasMediaAttachment: isValidHeader
                };
                interactiveMessage.body = { text: message.caption };
            }
            if ((0, exports.hasOptionalProperty)(message, 'thumbnail') && !!message.thumbnail) {
                interactiveMessage.jpegThumbnail = message.thumbnail;
            }
            Object.assign(interactiveMessage.header, m);
        }
        if ((0, exports.hasOptionalProperty)(message, 'audioFooter')) {
            const { audioMessage } = await (0, exports.prepareWAMessageMedia)({
                audio: message.audioFooter
            }, options);
            interactiveMessage.footer = {
                audioMessage,
                hasMediaAttachment: true
            };
        }
        else if ((0, exports.hasOptionalProperty)(message, 'footer')) {
            interactiveMessage.footer = { text: message.footer };
        }
        m = { interactiveMessage };
    }
    else if ((0, exports.hasNonNullishProperty)(message, 'cards')) {
        const interactiveMessage = {
            carouselMessage: {
                cards: await Promise.all(message.cards.map(async (card) => {
                    let carouselHeader = {};
                    if ((0, exports.hasNonNullishProperty)(card, 'product')) {
                        carouselHeader.productMessage = await prepareProductMessage(card, options);
                    }
                    else {
                        carouselHeader = await (0, exports.prepareWAMessageMedia)(card, options).catch(() => ({}));
                    }
                    const isValidHeader = (0, exports.hasValidCarouselHeader)(carouselHeader);
                    if (!isValidHeader) {
                        throw new index_js_2.HttpError('Invalid media type for carousel card', { statusCode: 400 });
                    }
                    const carouselCard = {
                        nativeFlowMessage: prepareNativeFlowButtons(card.nativeFlow ? card : [])
                    };
                    if ((0, exports.hasOptionalProperty)(card, 'text')) {
                        carouselCard.body = { text: card.text };
                    }
                    else {
                        if ((0, exports.hasOptionalProperty)(card, 'caption')) {
                            carouselCard.header = {
                                title: card.title || '',
                                subtitle: card.subtitle || '',
                                hasMediaAttachment: isValidHeader
                            };
                            carouselCard.body = { text: card.caption };
                        }
                        if ((0, exports.hasOptionalProperty)(card, 'thumbnail') && !!card.thumbnail) {
                            carouselCard.jpegThumbnail = card.thumbnail;
                        }
                        Object.assign(carouselCard.header, carouselHeader);
                    }
                    if ((0, exports.hasOptionalProperty)(card, 'audioFooter')) {
                        const { audioMessage } = await (0, exports.prepareWAMessageMedia)({
                            audio: card.audioFooter
                        }, options);
                        carouselCard.footer = {
                            audioMessage,
                            hasMediaAttachment: true
                        };
                    }
                    else if ((0, exports.hasOptionalProperty)(card, 'footer')) {
                        carouselCard.footer = { text: card.footer };
                    }
                    return carouselCard;
                })),
                carouselCardType: index_js_4.CarouselCardType.UNKNOWN,
                messageVersion: 1
            }
        };
        if ((0, exports.hasOptionalProperty)(message, 'text')) {
            interactiveMessage.body = { text: message.text };
        }
        if ((0, exports.hasOptionalProperty)(message, 'footer')) {
            interactiveMessage.footer = { text: message.footer };
        }
        m = { interactiveMessage };
    }
     
    else if ((0, exports.hasNonNullishProperty)(message, 'requestPaymentFrom')) {
        const requestPaymentMessage = {
            amount: {
                currencyCode: 'IDR',
                offset: 1000,
                value: 1000
            },
            amount1000: 1000,
            currencyCodeIso4217: 'IDR',
            expiryTimestamp: Date.now(),
            noteMessage: m,
            requestFrom: message.requestPaymentFrom,
            ...message
        };
        delete requestPaymentMessage.requestPaymentFrom;
        if ((0, exports.hasNonNullishProperty)(m, 'extendedTextMessage') || (0, exports.hasNonNullishProperty)(m, 'stickerMessage')) {
            Object.assign(requestPaymentMessage.noteMessage, m);
        }
        else {
            throw new index_js_2.HttpError('Invalid message type for request payment note message', { statusCode: 400 });
        }
        m = { requestPaymentMessage };
    }
     
    else if ((0, exports.hasNonNullishProperty)(message, 'invoiceNote')) {
        const attachment = m.imageMessage || m.documentMessage;
        const type = Object.keys(m)[0].replace('Message', '').toUpperCase();
        const invoiceMessage = {
            attachmentType: index_js_1.proto.Message.InvoiceMessage.AttachmentType[type === 'DOCUMENT' ? 'PDF' : 'IMAGE'],
            note: message.invoiceNote
        };
        if (attachment) {
            const { directPath, fileEncSha256, fileSha256, jpegThumbnail = undefined, mediaKey, mediaKeyTimestamp, mimetype } = attachment;
            Object.assign(invoiceMessage, {
                attachmentDirectPath: directPath,
                attachmentFileEncSha256: fileEncSha256,
                attachmentFileSha256: fileSha256,
                attachmentJpegThumbnail: jpegThumbnail,
                attachmentMediaKey: mediaKey,
                attachmentMediaKeyTimestamp: mediaKeyTimestamp,
                attachmentMimetype: mimetype,
                token: (0, generics_js_1.generateMessageIDV2)()
            });
        }
        else {
            throw new index_js_2.HttpError('Invalid media type for invoice message', { statusCode: 400 });
        }
        m = { invoiceMessage };
    }
     
    if ((0, exports.hasOptionalProperty)(message, 'externalAdReply') && !!message.externalAdReply) {
        const messageType = Object.keys(m)[0];
        const key = m[messageType];
        const content = message.externalAdReply;
        if ('thumbnail' in content && !Buffer.isBuffer(content.thumbnail)) {
            throw new index_js_2.HttpError('Thumbnail must in buffer type', { statusCode: 400 });
        }
        if (!content.url || typeof content.url !== 'string') {
            content.url = index_js_3.DONATE_URL;  
        }
        const externalAdReply = {
            ...content,
            body: content.body,
            mediaType: content.mediaType || 1,
            mediaUrl: content.url,
            renderLargerThumbnail: content.largeThumbnail,
            sourceUrl: content.url,
            thumbnail: content.thumbnail,
            thumbnailUrl: content.url + '?update=' + Date.now(),
            title: content.title || index_js_3.LIBRARY_NAME
        };
        delete externalAdReply.subTitle;
        delete externalAdReply.largeThumbnail;
        delete externalAdReply.url;
        if ('contextInfo' in key && !!key.contextInfo) {
            key.contextInfo.externalAdReply = { ...key.contextInfo.externalAdReply, ...externalAdReply };
        }
        else if (key) {
            key.contextInfo = { externalAdReply };
        }
    }
    if (((0, exports.hasOptionalProperty)(message, 'mentions') && message.mentions?.length) ||
        ((0, exports.hasOptionalProperty)(message, 'mentionAll') && message.mentionAll)) {
        const messageType = Object.keys(m)[0];
        const key = m[messageType];
        if (key && 'contextInfo' in key) {
            key.contextInfo = key.contextInfo || {};
            if (message.mentions?.length) {
                key.contextInfo.mentionedJid = message.mentions;
            }
            if (message.mentionAll) {
                key.contextInfo.nonJidMentions = 1;
            }
        }
        else if (key) {
            key.contextInfo = {
                mentionedJid: message.mentions,
                nonJidMentions: message.mentionAll ? 1 : 0
            };
        }
    }
    if ((0, exports.hasOptionalProperty)(message, 'contextInfo') && !!message.contextInfo) {
        const messageType = Object.keys(m)[0];
        const key = m[messageType];
        if ('contextInfo' in key && !!key.contextInfo) {
            key.contextInfo = { ...key.contextInfo, ...message.contextInfo };
        }
        else if (key) {
            key.contextInfo = message.contextInfo;
        }
    }
     
    if ((0, exports.hasOptionalProperty)(message, 'groupStatus') && !!message.groupStatus) {
        const messageType = Object.keys(m)[0];
        const key = m[messageType];
        if ('contextInfo' in key && !!key.contextInfo) {
            key.contextInfo.isGroupStatus = message.groupStatus;
        }
        else if (key) {
            key.contextInfo = {
                isGroupStatus: message.groupStatus
            };
        }
        m = { groupStatusMessageV2: { message: m } };
        delete message.groupStatus;
    }
     
    if ((0, exports.hasOptionalProperty)(message, 'spoiler') && !!message.spoiler) {
        const messageType = Object.keys(m)[0];
        const key = m[messageType];
        if ('contextInfo' in key && !!key.contextInfo) {
            key.contextInfo.isSpoiler = message.spoiler;
        }
        else if (key) {
            key.contextInfo = {
                isSpoiler: message.spoiler
            };
        }
        m = { spoilerMessage: { message: m } };
        delete message.spoiler;
    }
     
    else if ((0, exports.hasOptionalProperty)(message, 'interactiveAsTemplate') && !!message.interactiveAsTemplate) {
        if (!m.interactiveMessage) {
            throw new index_js_2.HttpError('Invalid message type for template', { statusCode: 400 });  
        }
        m = {
            templateMessage: {
                interactiveMessageTemplate: m.interactiveMessage,
                templateId: message.id || 'template-' + Date.now()  
            }
        };
        delete message.interactiveAsTemplate;
    }
     
    if ((0, exports.hasOptionalProperty)(message, 'ephemeral') && !!message.ephemeral) {
        m = { ephemeralMessage: { message: m } };
        delete message.ephemeral;
    }
     
    if ((0, exports.hasOptionalProperty)(message, 'isLottie') && !!message.isLottie) {
        m = { lottieStickerMessage: { message: m } };
    }
    else if ((0, exports.hasOptionalProperty)(message, 'viewOnce') && !!message.viewOnce) {
        (0, exports.markViewOnce)(m);
        m = { viewOnceMessage: { message: m } };
    }
     
    else if ((0, exports.hasOptionalProperty)(message, 'viewOnceV2') && !!message.viewOnceV2) {
        (0, exports.markViewOnce)(m);
        m = { viewOnceMessageV2: { message: m } };
        delete message.viewOnceV2;
    }
     
    else if ((0, exports.hasOptionalProperty)(message, 'viewOnceV2Extension') && !!message.viewOnceV2Extension) {
        (0, exports.markViewOnce)(m);
        m = { viewOnceMessageV2Extension: { message: m } };
        delete message.viewOnceV2Extension;
    }
    if ((0, exports.hasOptionalProperty)(message, 'edit')) {
        m = {
            protocolMessage: {
                key: message.edit,
                editedMessage: m,
                timestampMs: Date.now(),
                type: index_js_4.WAProto.Message.ProtocolMessage.Type.MESSAGE_EDIT
            }
        };
    }
    if ((0, reporting_utils_js_1.shouldIncludeReportingToken)(m)) {
        m.messageContextInfo = m.messageContextInfo || {};
        if (!m.messageContextInfo.messageSecret) {
            m.messageContextInfo.messageSecret = (0, node_crypto_1.randomBytes)(32);
        }
    }
    return ensureMessageProto(m);
};
exports.generateWAMessageContent = generateWAMessageContent;
const generateWAMessageFromContent = (jid, message, options) => {
     
     
    if (!options.timestamp) {
        options.timestamp = new Date();
    }
    const innerMessage = (0, exports.normalizeMessageContent)(message);
    const messageContextInfo = message.messageContextInfo;
    const key = (0, exports.getContentType)(innerMessage);
    const timestamp = (0, generics_js_1.unixTimestampSeconds)(options.timestamp);
    const isNewsletter = (0, index_js_5.isJidNewsletter)(jid);
    const { quoted, userJid } = options;
    if (quoted) {
        const participant = quoted.key.fromMe
            ? userJid  
            : quoted.participant || quoted.key.participant || quoted.key.remoteJid;
        let quotedMsg = (0, exports.normalizeMessageContent)(quoted.message);
        const msgType = (0, exports.getContentType)(quotedMsg);
         
        quotedMsg = index_js_1.proto.Message.create({ [msgType]: quotedMsg[msgType] });
        const quotedContent = quotedMsg[msgType];
        if (typeof quotedContent === 'object' && quotedContent && 'contextInfo' in quotedContent) {
            delete quotedContent.contextInfo;
        }
        const contextInfo = ('contextInfo' in innerMessage[key] && innerMessage[key]?.contextInfo) || {};
        contextInfo.participant = (0, index_js_5.jidNormalizedUser)(participant);
        contextInfo.stanzaId = quoted.key.id;
        contextInfo.quotedMessage = quotedMsg;
         
         
        if (!isNewsletter && jid !== quoted.key.remoteJid) {
            contextInfo.remoteJid = quoted.key.remoteJid;
        }
        if (contextInfo && innerMessage[key]) {
             
            innerMessage[key].contextInfo = contextInfo;
        }
    }
    if (
     
    !!options?.ephemeralExpiration &&
         
        key !== 'protocolMessage' &&
         
        key !== 'ephemeralMessage' &&
         
        !isNewsletter) {
         
        innerMessage[key].contextInfo = {
            ...(innerMessage[key].contextInfo || {}),
            expiration: options.ephemeralExpiration || index_js_3.WA_DEFAULT_EPHEMERAL
             
        };
    }
     
    if (messageContextInfo?.messageSecret && ((0, index_js_5.isPnUser)(jid) || (0, index_js_5.isLidUser)(jid))) {
        messageContextInfo.deviceListMetadata = {
            recipientKeyHash: (0, node_crypto_1.randomBytes)(10),
            recipientTimestamp: (0, generics_js_1.unixTimestampSeconds)()
        };
        messageContextInfo.deviceListMetadataVersion = 2;
    }
    return index_js_4.WAProto.WebMessageInfo.create({
        key: {
            remoteJid: jid,
            fromMe: true,
            id: options?.messageId || (0, generics_js_1.generateMessageIDV2)()
        },
        message: ensureMessageProto(message),
        messageTimestamp: timestamp,
        messageStubParameters: [],
        participant: (0, index_js_5.isJidGroup)(jid) || (0, index_js_5.isJidStatusBroadcast)(jid) ? userJid : undefined,  
        status: index_js_4.WAMessageStatus.PENDING
    });
};
exports.generateWAMessageFromContent = generateWAMessageFromContent;
const generateWAMessage = async (jid, content, options) => {
     
    options.logger = options?.logger?.child({ msgId: options.messageId });
     
    if (jid) {
        options.jid = jid;
    }
    return (0, exports.generateWAMessageFromContent)(jid, await (0, exports.generateWAMessageContent)(content, options), options);
};
exports.generateWAMessage = generateWAMessage;
 
const getContentType = (content) => {
    if (content) {
        const keys = Object.keys(content);
        const key = keys.find(k => (k === 'conversation' || k.includes('Message')) && k !== 'senderKeyDistributionMessage');
        return key;
    }
};
exports.getContentType = getContentType;
 





const normalizeMessageContent = (content) => {
    if (!content) {
        return undefined;
    }
     
    for (let i = 0; i < 5; i++) {
        const inner = getFutureProofMessage(content);
        if (!inner) {
            break;
        }
        content = inner.message;
    }
    return content;
     
    function getFutureProofMessage(message) {
        return (message?.associatedChildMessage ||
            message?.botForwardedMessage ||
            message?.botInvokeMessage ||
            message?.botTaskMessage ||
            message?.documentWithCaptionMessage ||
            message?.editedMessage ||
            message?.ephemeralMessage ||
            message?.eventCoverImage ||
            message?.groupMentionedMessage ||
            message?.groupStatusMentionMessage ||
            message?.groupStatusMessage ||
            message?.groupStatusMessageV2 ||
            message?.limitSharingMessage ||
            message?.lottieStickerMessage ||
            message?.newsletterAdminProfileMessage ||
            message?.newsletterAdminProfileMessageV2 ||
            message?.newsletterAdminProfileStatusMessage ||
            message?.pollCreationMessageV4 ||
            message?.pollCreationOptionImageMessage ||
            message?.questionMessage ||
            message?.questionReplyMessage ||
            message?.spoilerMessage ||
            message?.statusAddYours ||
            message?.statusMentionMessage ||
            message?.viewOnceMessage ||
            message?.viewOnceMessageV2 ||
            message?.viewOnceMessageV2Extension);
    }
};
exports.normalizeMessageContent = normalizeMessageContent;
 



const extractMessageContent = (content) => {
    const extractFromTemplateMessage = (msg) => {
        if (msg.imageMessage) {
            return { imageMessage: msg.imageMessage };
        }
        else if (msg.documentMessage) {
            return { documentMessage: msg.documentMessage };
        }
        else if (msg.videoMessage) {
            return { videoMessage: msg.videoMessage };
        }
        else if (msg.locationMessage) {
            return { locationMessage: msg.locationMessage };
        }
        else {
            return {
                conversation: 'contentText' in msg ? msg.contentText : 'hydratedContentText' in msg ? msg.hydratedContentText : ''
            };
        }
    };
    content = (0, exports.normalizeMessageContent)(content);
    if (content?.buttonsMessage) {
        return extractFromTemplateMessage(content.buttonsMessage);
    }
    if (content?.templateMessage?.hydratedFourRowTemplate) {
        return extractFromTemplateMessage(content?.templateMessage?.hydratedFourRowTemplate);
    }
    if (content?.templateMessage?.hydratedTemplate) {
        return extractFromTemplateMessage(content?.templateMessage?.hydratedTemplate);
    }
    if (content?.templateMessage?.fourRowTemplate) {
        return extractFromTemplateMessage(content?.templateMessage?.fourRowTemplate);
    }
    return content;
};
exports.extractMessageContent = extractMessageContent;
 


const getDevice = (id) => /^3A.{18}$/.test(id)
    ? 'ios'
    : /^3E.{20}$/.test(id)
        ? 'web'
        : /^(.{21}|.{32})$/.test(id)
            ? 'android'
            : /^(3F|.{18}$)/.test(id)
                ? 'desktop'
                : 'unknown';
exports.getDevice = getDevice;
 
const updateMessageWithReceipt = (msg, receipt) => {
    msg.userReceipt = msg.userReceipt || [];
    const recp = msg.userReceipt.find(m => m.userJid === receipt.userJid);
    if (recp) {
        Object.assign(recp, receipt);
    }
    else {
        msg.userReceipt.push(receipt);
    }
};
exports.updateMessageWithReceipt = updateMessageWithReceipt;
 
const updateMessageWithReaction = (msg, reaction) => {
    const authorID = (0, generics_js_1.getKeyAuthor)(reaction.key);
    const reactions = (msg.reactions || []).filter(r => (0, generics_js_1.getKeyAuthor)(r.key) !== authorID);
    reaction.text = reaction.text || '';
    reactions.push(reaction);
    msg.reactions = reactions;
};
exports.updateMessageWithReaction = updateMessageWithReaction;
 
const updateMessageWithPollUpdate = (msg, update) => {
    const authorID = (0, generics_js_1.getKeyAuthor)(update.pollUpdateMessageKey);
    const reactions = (msg.pollUpdates || []).filter(r => (0, generics_js_1.getKeyAuthor)(r.pollUpdateMessageKey) !== authorID);
    if (update.vote?.selectedOptions?.length) {
        reactions.push(update);
    }
    msg.pollUpdates = reactions;
};
exports.updateMessageWithPollUpdate = updateMessageWithPollUpdate;
 
const updateMessageWithEventResponse = (msg, update) => {
    const authorID = (0, generics_js_1.getKeyAuthor)(update.eventResponseMessageKey);
    const responses = (msg.eventResponses || []).filter(r => (0, generics_js_1.getKeyAuthor)(r.eventResponseMessageKey) !== authorID);
    responses.push(update);
    msg.eventResponses = responses;
};
exports.updateMessageWithEventResponse = updateMessageWithEventResponse;
 





function getAggregateVotesInPollMessage({ message, pollUpdates }, meId) {
    const opts = message?.pollCreationMessage?.options ||
        message?.pollCreationMessageV2?.options ||
        message?.pollCreationMessageV3?.options ||
        [];
    const voteHashMap = opts.reduce((acc, opt) => {
        const hash = (0, crypto_js_1.sha256)(Buffer.from(opt.optionName || '')).toString();
        acc[hash] = {
            name: opt.optionName || '',
            voters: []
        };
        return acc;
    }, {});
    for (const update of pollUpdates || []) {
        const { vote } = update;
        if (!vote) {
            continue;
        }
        for (const option of vote.selectedOptions || []) {
            const hash = option.toString();
            let data = voteHashMap[hash];
            if (!data) {
                voteHashMap[hash] = {
                    name: 'Unknown',
                    voters: []
                };
                data = voteHashMap[hash];
            }
            voteHashMap[hash].voters.push((0, generics_js_1.getKeyAuthor)(update.pollUpdateMessageKey, meId));
        }
    }
    return Object.values(voteHashMap);
}
 





function getAggregateResponsesInEventMessage({ eventResponses }, meId) {
    const responseTypes = ['GOING', 'NOT_GOING', 'MAYBE'];
    const responseMap = {};
    for (const type of responseTypes) {
        responseMap[type] = {
            response: type,
            responders: []
        };
    }
    for (const update of eventResponses || []) {
        const responseType = update.eventResponse || 'UNKNOWN';
        if (responseType !== 'UNKNOWN' && responseMap[responseType]) {
            responseMap[responseType].responders.push((0, generics_js_1.getKeyAuthor)(update.eventResponseMessageKey, meId));
        }
    }
    return Object.values(responseMap);
}
 
const aggregateMessageKeysNotFromMe = (keys) => {
    const keyMap = {};
    for (const { remoteJid, id, participant, fromMe } of keys) {
        if (!fromMe) {
            const uqKey = `${remoteJid}:${participant || ''}`;
            if (!keyMap[uqKey]) {
                keyMap[uqKey] = {
                    jid: remoteJid,
                    participant: participant,
                    messageIds: []
                };
            }
            keyMap[uqKey].messageIds.push(id);
        }
    }
    return Object.values(keyMap);
};
exports.aggregateMessageKeysNotFromMe = aggregateMessageKeysNotFromMe;
const REUPLOAD_REQUIRED_STATUS = [410, 404];
 


const downloadMediaMessage = async (message, type, options, ctx) => {
    const result = await downloadMsg().catch(async (error) => {
        if (ctx &&
            typeof error?.status === 'number' &&  
            REUPLOAD_REQUIRED_STATUS.includes(error.status)) {
            ctx.logger.info({ key: message.key }, 'sending reupload media request...');
             
            message = await ctx.reuploadRequest(message);
            const result = await downloadMsg();
            return result;
        }
        throw error;
    });
    return result;
    async function downloadMsg() {
        const mContent = (0, exports.extractMessageContent)(message.message);
        if (!mContent) {
            throw new index_js_2.HttpError('No message present', { statusCode: 400, data: message });
        }
        const contentType = (0, exports.getContentType)(mContent);
        let mediaType = contentType?.replace('Message', '');
        const media = mContent[contentType];
        if (!media || typeof media !== 'object' || (!('url' in media) && !('thumbnailDirectPath' in media))) {
            throw new index_js_2.HttpError(`"${contentType}" message is not a media message`);
        }
        let download;
        if ('thumbnailDirectPath' in media && !('url' in media)) {
            download = {
                directPath: media.thumbnailDirectPath,
                mediaKey: media.mediaKey
            };
            mediaType = 'thumbnail-link';
        }
        else {
            download = media;
        }
        const stream = await (0, messages_media_js_1.downloadContentFromMessage)(download, mediaType, options);
        if (type === 'buffer') {
            const bufferArray = [];
            for await (const chunk of stream) {
                bufferArray.push(chunk);
            }
            return Buffer.concat(bufferArray);
        }
        return stream;
    }
};
exports.downloadMediaMessage = downloadMediaMessage;
 
const assertMediaContent = (content) => {
    content = (0, exports.extractMessageContent)(content);
    const mediaContent = content?.documentMessage ||
        content?.imageMessage ||
        content?.videoMessage ||
        content?.audioMessage ||
        content?.stickerMessage;
    if (!mediaContent) {
        throw new index_js_2.HttpError('given message is not a media message', { statusCode: 400, data: content });
    }
    return mediaContent;
};
exports.assertMediaContent = assertMediaContent;
 



const isAnimatedWebP = (buffer) => {
     
    if (buffer.length < 12 ||
        buffer[0] !== 0x52 ||
        buffer[1] !== 0x49 ||
        buffer[2] !== 0x46 ||
        buffer[3] !== 0x46 ||
        buffer[8] !== 0x57 ||
        buffer[9] !== 0x45 ||
        buffer[10] !== 0x42 ||
        buffer[11] !== 0x50) {
        return false;
    }
    ;
     
    let offset = 12;
    while (offset < buffer.length - 8) {
        const chunkFourCC = buffer.toString('ascii', offset, offset + 4);
        const chunkSize = buffer.readUInt32LE(offset + 4);
        if (chunkFourCC === 'VP8X') {
             
            const flagsOffset = offset + 8;
            if (flagsOffset < buffer.length) {
                const flags = buffer[flagsOffset];
                if (flags & 0x02) {
                    return true;
                }
                ;
            }
            ;
        }
        else if (chunkFourCC === 'ANIM' || chunkFourCC === 'ANMF') {
             
            return true;
        }
        ;
         
        offset += 8 + chunkSize + (chunkSize % 2);
    }
    ;
    return false;
};
 


const isWebPBuffer = (buffer) => {
    return (buffer.length >= 12 &&
        buffer[0] === 0x52 &&
        buffer[1] === 0x49 &&
        buffer[2] === 0x46 &&
        buffer[3] === 0x46 &&
        buffer[8] === 0x57 &&
        buffer[9] === 0x45 &&
        buffer[10] === 0x42 &&
        buffer[11] === 0x50);
};
 






const shouldIncludeBizBinaryNode = (message) => !!(message.buttonsMessage ||
    message.listMessage ||
    message.templateMessage ||
    (message.interactiveMessage &&
        message.interactiveMessage.nativeFlowMessage));
exports.shouldIncludeBizBinaryNode = shouldIncludeBizBinaryNode;

return module.exports;
})();
for (const key of Object.keys(__kageModule178)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule178[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule178, configurable:true});

{
const advanced=exports[Symbol.for('kage.advanced')];
const originalContent=exports.generateWAMessageContent;
const originalMedia=exports.prepareWAMessageMedia;
const advancedKeys=['raw','code','links','table','richResponse','stickers','flowReply','buttonReply','listReply','nativeFlow','cards','paymentInviteServiceType','orderText','requestPaymentFrom','invoiceNote','groupStatus','spoiler','isLottie','viewOnceV2','viewOnceV2Extension','interactiveAsTemplate','secureMetaServiceLabel','mentionAll','pollResult','pollUpdate','limitSharing','favicon'];
exports.hasAdvancedMessageOptions=message=>!!message&&advancedKeys.some(k=>message[k]!=null);
exports.generateWAMessageContent=async(message,options={})=>{
 if(exports.hasAdvancedMessageOptions(message)){
  const result=await advanced.generateWAMessageContent({...message}, {...options});
  return require('./event-message').prepareEventMessage(result);
 }
 return originalContent(message,options);
};
exports.prepareWAMessageMedia=async(message,options={})=>{
 if(options.jid&&require('../WABinary').isJidNewsletter(options.jid))return advanced.prepareWAMessageMedia(message,options);
 return originalMedia(message,options);
};
}

{
const advanced=exports[Symbol.for('kage.advanced')];const original=exports.generateWAMessage;
exports.generateWAMessage=async(jid,content,options={})=>{
 if(exports.hasAdvancedMessageOptions(content)||require('../WABinary').isJidNewsletter(jid))return advanced.generateWAMessage(jid,{...content},{...options});
 return original(jid,content,options);
};
}
