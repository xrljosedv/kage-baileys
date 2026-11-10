"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { newObj[key] = obj[key]; } } } newObj.default = obj; return newObj; } } function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; } function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }var _crypto = require('crypto'); var _crypto2 = _interopRequireDefault(_crypto);
var _indexjs = require('../../WAProto/index.js');









var _indexjs3 = require('../Utils/index.js');





var _indexjs5 = require('../WABinary/index.js');
 class Dugong {
  constructor(waUploadToServer, relayMessageFn, config, sock) {
    this.relayMessage = relayMessageFn;
    this.waUploadToServer = waUploadToServer;
    this.config = config;
    this.sock = sock;
  }
  detectType(content) {
    if (content.requestPaymentMessage) return "PAYMENT";
    if (content.productMessage) return "PRODUCT";
    if (content.interactiveButtons) return "INTERACTIVE_BUTTONS";
    if (_optionalChain([content, 'access', _ => _.interactiveMessage, 'optionalAccess', _2 => _2.carouselMessage])) return "CAROUSEL";
    if (content.interactiveMessage) return "INTERACTIVE";
    if (content.albumMessage || content.album) return "ALBUM";
    if (content.eventMessage) return "EVENT";
    if (content.pollResultMessage) return "POLL_RESULT";
    if (content.groupStatusMessage) return "GROUP_STORY";
    return null;
  }
  async handlePayment(content, quoted) {
    const data = content.requestPaymentMessage;
    let notes = {};
    if (_optionalChain([data, 'access', _3 => _3.sticker, 'optionalAccess', _4 => _4.stickerMessage])) {
      notes = {
        stickerMessage: {
          ...data.sticker.stickerMessage,
          contextInfo: {
            stanzaId: _optionalChain([quoted, 'optionalAccess', _5 => _5.key, 'optionalAccess', _6 => _6.id]),
            participant: _optionalChain([quoted, 'optionalAccess', _7 => _7.key, 'optionalAccess', _8 => _8.participant]) || content.sender,
            quotedMessage: _optionalChain([quoted, 'optionalAccess', _9 => _9.message]),
          },
        },
      };
    } else if (data.note) {
      notes = {
        extendedTextMessage: {
          text: data.note,
          contextInfo: {
            stanzaId: _optionalChain([quoted, 'optionalAccess', _10 => _10.key, 'optionalAccess', _11 => _11.id]),
            participant: _optionalChain([quoted, 'optionalAccess', _12 => _12.key, 'optionalAccess', _13 => _13.participant]) || content.sender,
            quotedMessage: _optionalChain([quoted, 'optionalAccess', _14 => _14.message]),
          },
        },
      };
    }
    return {
      requestPaymentMessage: _indexjs.proto.Message.RequestPaymentMessage.fromObject({
        expiryTimestamp: data.expiry || 0,
        amount1000: data.amount || 0,
        currencyCodeIso4217: data.currency || "IDR",
        requestFrom: data.from || "0@s.whatsapp.net",
        noteMessage: notes,
        background: _nullishCoalesce(data.background, () => ( {
          id: "DEFAULT",
          placeholderArgb: 0xfff0f0f0,
        })),
      }),
    };
  }
  async handleProduct(content, _jid, _quoted) {
    const {
      title,
      description,
      thumbnail,
      productId,
      retailerId,
      url,
      body = "",
      footer = "",
      buttons = [],
      priceAmount1000 = null,
      currencyCode = "IDR",
    } = content.productMessage;
    let productImage;
    if (Buffer.isBuffer(thumbnail)) {
      const { imageMessage } = await _indexjs3.generateWAMessageContent.call(void 0, 
        { image: thumbnail },
        { upload: this.waUploadToServer },
      );
      productImage = imageMessage;
    } else if (typeof thumbnail === "object" && thumbnail.url) {
      const { imageMessage } = await _indexjs3.generateWAMessageContent.call(void 0, 
        { image: { url: thumbnail.url } },
        { upload: this.waUploadToServer },
      );
      productImage = imageMessage;
    }
    return {
      viewOnceMessage: {
        message: {
          interactiveMessage: {
            body: { text: body },
            footer: { text: footer },
            header: {
              title,
              hasMediaAttachment: true,
              productMessage: {
                product: {
                  productImage,
                  productId,
                  title,
                  description,
                  currencyCode,
                  priceAmount1000,
                  retailerId,
                  url,
                  productImageCount: 1,
                },
                businessOwnerJid: "0@s.whatsapp.net",
              },
            },
            nativeFlowMessage: { buttons },
          },
        },
      },
    };
  }
  async handleInteractive(content, _jid, _quoted) {
    const {
      title,
      footer,
      thumbnail,
      image,
      video,
      document,
      mimetype,
      fileName,
      jpegThumbnail,
      contextInfo,
      externalAdReply,
      buttons = [],
      nativeFlowMessage,
      header,
    } = content.interactiveMessage;
    let media = null;
    let _mediaType = null;
    if (thumbnail) {
      media = await _indexjs3.prepareWAMessageMedia.call(void 0, 
        { image: { url: thumbnail } },
        { upload: this.waUploadToServer },
      );
      _mediaType = "image";
    } else if (image) {
      const src =
        typeof image === "object" && image.url
          ? { image: { url: image.url } }
          : { image };
      media = await _indexjs3.prepareWAMessageMedia.call(void 0, src, {
        upload: this.waUploadToServer,
      });
      _mediaType = "image";
    } else if (video) {
      const src =
        typeof video === "object" && video.url
          ? { video: { url: video.url } }
          : { video };
      media = await _indexjs3.prepareWAMessageMedia.call(void 0, src, {
        upload: this.waUploadToServer,
      });
      _mediaType = "video";
    } else if (document) {
      const docPayload = { document };
      if (jpegThumbnail) {
        docPayload.jpegThumbnail =
          typeof jpegThumbnail === "object" && jpegThumbnail.url
            ? { url: jpegThumbnail.url }
            : jpegThumbnail;
      }
      media = await _indexjs3.prepareWAMessageMedia.call(void 0, docPayload, {
        upload: this.waUploadToServer,
      });
      if (fileName) media.documentMessage.fileName = fileName;
      if (mimetype) media.documentMessage.mimetype = mimetype;
      _mediaType = "document";
    }
    const interactiveMessage = {
      body: { text: title || "" },
      footer: { text: footer || "" },
    };
    if (buttons && buttons.length > 0) {
      interactiveMessage.nativeFlowMessage = { buttons };
      if (nativeFlowMessage) {
        interactiveMessage.nativeFlowMessage = {
          ...interactiveMessage.nativeFlowMessage,
          ...nativeFlowMessage,
        };
      }
    } else if (nativeFlowMessage) {
      interactiveMessage.nativeFlowMessage = nativeFlowMessage;
    }
    if (media) {
      interactiveMessage.header = {
        title: header || "",
        hasMediaAttachment: true,
        ...media,
      };
    } else {
      interactiveMessage.header = {
        title: header || "",
        hasMediaAttachment: false,
      };
    }
    const finalContextInfo = {};
    if (contextInfo) {
      Object.assign(finalContextInfo, {
        mentionedJid: contextInfo.mentionedJid || [],
        forwardingScore: contextInfo.forwardingScore || 0,
        isForwarded: contextInfo.isForwarded || false,
        ...contextInfo,
      });
    }
    if (externalAdReply) {
      finalContextInfo.externalAdReply = {
        title: externalAdReply.title || "",
        body: externalAdReply.body || "",
        mediaType: externalAdReply.mediaType || 1,
        thumbnailUrl: externalAdReply.thumbnailUrl || "",
        mediaUrl: externalAdReply.mediaUrl || "",
        sourceUrl: externalAdReply.sourceUrl || "",
        showAdAttribution: externalAdReply.showAdAttribution || false,
        renderLargerThumbnail: externalAdReply.renderLargerThumbnail || false,
        ...externalAdReply,
      };
    }
    if (Object.keys(finalContextInfo).length > 0) {
      interactiveMessage.contextInfo = finalContextInfo;
    }
    return { interactiveMessage };
  }
  async handleInteractiveButtons(content, _jid, _quoted) {
    const {
      text,
      caption,
      title,
      subtitle,
      footer,
      interactiveButtons,
      hasMediaAttachment,
      image,
      video,
      document,
      mimetype,
      jpegThumbnail,
      location,
      product,
      businessOwnerJid,
    } = content;
    const bodyText = text || caption || "";
    const buttons = interactiveButtons.map((btn) => ({
      name: btn.name,
      buttonParamsJson:
        typeof btn.buttonParamsJson === "string"
          ? btn.buttonParamsJson
          : JSON.stringify(btn.buttonParamsJson),
    }));
    let headerContent = {};
    let mediaAttached =
      typeof hasMediaAttachment === "boolean" ? hasMediaAttachment : false;
    if (image) {
      const src =
        typeof image === "object" && image.url
          ? { image: { url: image.url } }
          : { image };
      const uploaded = await _indexjs3.prepareWAMessageMedia.call(void 0, src, {
        upload: this.waUploadToServer,
      });
      headerContent = { ...uploaded };
      mediaAttached =
        typeof hasMediaAttachment === "boolean" ? hasMediaAttachment : true;
    } else if (video) {
      const src =
        typeof video === "object" && video.url
          ? { video: { url: video.url } }
          : { video };
      const uploaded = await _indexjs3.prepareWAMessageMedia.call(void 0, src, {
        upload: this.waUploadToServer,
      });
      headerContent = { ...uploaded };
      mediaAttached =
        typeof hasMediaAttachment === "boolean" ? hasMediaAttachment : true;
    } else if (document) {
      const docPayload =
        typeof document === "object" && document.url
          ? { document: { url: document.url } }
          : { document };
      if (mimetype) docPayload.mimetype = mimetype;
      const uploaded = await _indexjs3.prepareWAMessageMedia.call(void 0, docPayload, {
        upload: this.waUploadToServer,
      });
      if (jpegThumbnail) {
        uploaded.documentMessage.jpegThumbnail =
          typeof jpegThumbnail === "string"
            ? Buffer.from(jpegThumbnail, "base64")
            : jpegThumbnail;
      }
      headerContent = { ...uploaded };
      mediaAttached =
        typeof hasMediaAttachment === "boolean" ? hasMediaAttachment : true;
    } else if (location) {
      headerContent = {
        locationMessage: {
          degreesLatitude:
            location.degressLatitude || location.degreesLatitude || 0,
          degreesLongitude:
            location.degressLongitude || location.degreesLongitude || 0,
          name: location.name || "",
        },
      };
      mediaAttached =
        typeof hasMediaAttachment === "boolean" ? hasMediaAttachment : true;
    } else if (product) {
      let productImage;
      if (product.productImage) {
        const imgSrc =
          typeof product.productImage === "object" && product.productImage.url
            ? { image: { url: product.productImage.url } }
            : { image: product.productImage };
        const uploaded = await _indexjs3.prepareWAMessageMedia.call(void 0, imgSrc, {
          upload: this.waUploadToServer,
        });
        productImage = uploaded.imageMessage;
      }
      headerContent = {
        productMessage: {
          product: {
            productImage,
            productId: product.productId,
            title: product.title,
            description: product.description,
            currencyCode: product.currencyCode || "IDR",
            priceAmount1000: product.priceAmount1000,
            retailerId: product.retailerId,
            url: product.url,
            productImageCount: product.productImageCount || 1,
          },
          businessOwnerJid: businessOwnerJid || "0@s.whatsapp.net",
        },
      };
      mediaAttached =
        typeof hasMediaAttachment === "boolean" ? hasMediaAttachment : true;
    }
    const interactiveMessage = {
      body: { text: bodyText },
      footer: { text: footer || "" },
      header: {
        title: title || "",
        subtitle: subtitle || "",
        hasMediaAttachment: mediaAttached,
        ...headerContent,
      },
      nativeFlowMessage: { buttons },
    };
    return {
      viewOnceMessage: {
        message: {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2,
            messageSecret: _crypto2.default.randomBytes(32),
          },
          interactiveMessage,
        },
      },
    };
  }
  async handleCarousel(content, _jid, _quoted) {
    const { interactiveMessage } = content;
    const { body, footer, header, carouselMessage, contextInfo } =
      interactiveMessage;
    const processedCards = [];
    for (const card of carouselMessage.cards) {
      const cardMsg = {
        body: card.body || { text: "" },
        footer: card.footer || { text: "" },
        header: {
          title: _optionalChain([card, 'access', _15 => _15.header, 'optionalAccess', _16 => _16.title]) || "",
          hasMediaAttachment: false,
        },
      };
      if (card.nativeFlowMessage) {
        cardMsg.nativeFlowMessage = card.nativeFlowMessage;
      }
      if (
        _optionalChain([card, 'access', _17 => _17.header, 'optionalAccess', _18 => _18.imageMessage]) ||
        _optionalChain([card, 'access', _19 => _19.header, 'optionalAccess', _20 => _20.videoMessage]) ||
        _optionalChain([card, 'access', _21 => _21.header, 'optionalAccess', _22 => _22.documentMessage])
      ) {
        let headerContent = {};
        let mediaAttached = true;
        if (card.header.imageMessage) {
          const url = card.header.imageMessage.url || card.header.imageMessage;
          const src =
            typeof url === "string" ? { image: { url } } : { image: url };
          const uploaded = await _indexjs3.prepareWAMessageMedia.call(void 0, src, {
            upload: this.waUploadToServer,
          });
          headerContent = { ...uploaded };
        } else if (card.header.videoMessage) {
          const url = card.header.videoMessage.url || card.header.videoMessage;
          const src =
            typeof url === "string" ? { video: { url } } : { video: url };
          const uploaded = await _indexjs3.prepareWAMessageMedia.call(void 0, src, {
            upload: this.waUploadToServer,
          });
          headerContent = { ...uploaded };
        } else if (card.header.documentMessage) {
          const url =
            card.header.documentMessage.url || card.header.documentMessage;
          const src =
            typeof url === "string" ? { document: { url } } : { document: url };
          const uploaded = await _indexjs3.prepareWAMessageMedia.call(void 0, src, {
            upload: this.waUploadToServer,
          });
          headerContent = { ...uploaded };
        }
        cardMsg.header = {
          title: _optionalChain([card, 'access', _23 => _23.header, 'optionalAccess', _24 => _24.title]) || "",
          hasMediaAttachment: mediaAttached,
          ...headerContent,
        };
      }
      processedCards.push(cardMsg);
    }
    const interactiveMsg = {
      body: body || { text: "" },
      footer: footer || { text: "" },
      header: header || { title: "", hasMediaAttachment: false },
      carouselMessage: {
        cards: processedCards,
        messageVersion: carouselMessage.messageVersion || 1,
        carouselCardType: _nullishCoalesce(carouselMessage.carouselCardType, () => ( 1)),
      },
    };
    if (contextInfo) {
      interactiveMsg.contextInfo = contextInfo;
    }
    return {
      viewOnceMessage: {
        message: {
          messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2,
            messageSecret: _crypto2.default.randomBytes(32),
          },
          interactiveMessage: interactiveMsg,
        },
      },
    };
  }
  async handleAlbum(content, jid, quoted) {
    const array = content.albumMessage || content.album;
    const ctxInfo = content.contextInfo || {};
    const album = await _indexjs3.generateWAMessageFromContent.call(void 0, 
      jid,
      {
        messageContextInfo: {
          messageSecret: _crypto2.default.randomBytes(32),
        },
        albumMessage: {
          expectedImageCount: array.filter((a) => "image" in a).length,
          expectedVideoCount: array.filter((a) => "video" in a).length,
        },
      },
      {
        userJid: _indexjs5.jidNormalizedUser.call(void 0, _optionalChain([this, 'access', _25 => _25.sock, 'access', _26 => _26.authState, 'optionalAccess', _27 => _27.creds, 'optionalAccess', _28 => _28.me, 'optionalAccess', _29 => _29.id]) || ""),
        quoted,
        upload: this.waUploadToServer,
      },
    );
    await this.relayMessage(jid, album.message, {
      messageId: album.key.id,
    });
    for (let item of array) {
      if (ctxInfo && Object.keys(ctxInfo).length > 0 && !item.contextInfo) {
        item = { ...item, contextInfo: ctxInfo };
      }
      const img = await _indexjs3.generateWAMessage.call(void 0, jid, item, {
        upload: this.waUploadToServer,
        userJid: _indexjs5.jidNormalizedUser.call(void 0, _optionalChain([this, 'access', _30 => _30.sock, 'access', _31 => _31.authState, 'optionalAccess', _32 => _32.creds, 'optionalAccess', _33 => _33.me, 'optionalAccess', _34 => _34.id]) || ""),
      });
      img.message.messageContextInfo = {
        messageSecret: _crypto2.default.randomBytes(32),
        messageAssociation: {
          associationType: 1,
          parentMessageKey: album.key,
        },
      };
      await this.relayMessage(jid, img.message, {
        messageId: img.key.id,
      });
    }
    return album;
  }
  async handleEvent(content, jid, quoted) {
    const eventData = content.eventMessage;
    const msg = await _indexjs3.generateWAMessageFromContent.call(void 0, 
      jid,
      {
        viewOnceMessage: {
          message: {
            messageContextInfo: {
              deviceListMetadata: {},
              deviceListMetadataVersion: 2,
              messageSecret: _crypto2.default.randomBytes(32),
            },
            eventMessage: {
              isCanceled: eventData.isCanceled || false,
              name: eventData.name,
              description: eventData.description,
              location: eventData.location || {
                degreesLatitude: 0,
                degreesLongitude: 0,
                name: "Location",
              },
              joinLink: eventData.joinLink || "",
              startTime:
                typeof eventData.startTime === "string"
                  ? parseInt(eventData.startTime)
                  : eventData.startTime || Date.now(),
              endTime:
                typeof eventData.endTime === "string"
                  ? parseInt(eventData.endTime)
                  : eventData.endTime || Date.now() + 3600000,
              extraGuestsAllowed: eventData.extraGuestsAllowed !== false,
            },
          },
        },
      },
      {
        quoted,
        userJid: _indexjs5.jidNormalizedUser.call(void 0, _optionalChain([this, 'access', _35 => _35.sock, 'access', _36 => _36.authState, 'optionalAccess', _37 => _37.creds, 'optionalAccess', _38 => _38.me, 'optionalAccess', _39 => _39.id]) || ""),
      },
    );
    await this.relayMessage(jid, msg.message, {
      messageId: msg.key.id,
    });
    return msg;
  }
  async handlePollResult(content, jid, quoted) {
    const pollData = content.pollResultMessage;
    const msg = await _indexjs3.generateWAMessageFromContent.call(void 0, 
      jid,
      {
        pollResultSnapshotMessage: {
          name: pollData.name,
          pollVotes: pollData.pollVotes.map((vote) => ({
            optionName: vote.optionName,
            optionVoteCount:
              typeof vote.optionVoteCount === "number"
                ? vote.optionVoteCount.toString()
                : vote.optionVoteCount,
          })),
        },
      },
      {
        quoted,
        userJid: _indexjs5.jidNormalizedUser.call(void 0, _optionalChain([this, 'access', _40 => _40.sock, 'access', _41 => _41.authState, 'optionalAccess', _42 => _42.creds, 'optionalAccess', _43 => _43.me, 'optionalAccess', _44 => _44.id]) || ""),
      },
    );
    await this.relayMessage(jid, msg.message, {
      messageId: msg.key.id,
    });
    return msg;
  }
  async handleGroupStory(content, jid, _quoted, options = {}) {
    const storyData = content.groupStatusMessage;
    let waMsgContent;
    if (storyData.message) {
      waMsgContent = storyData;
    } else {
      waMsgContent = await _indexjs3.generateWAMessageContent.call(void 0, storyData, {
        upload: this.waUploadToServer,
      });
    }
    const innerMsg = waMsgContent.message || waMsgContent;
    const msgKey = Object.keys(innerMsg).find(
      (k) => innerMsg[k] && typeof innerMsg[k] === "object",
    );
    if (msgKey) {
      innerMsg[msgKey].contextInfo = innerMsg[msgKey].contextInfo || {};
      innerMsg[msgKey].contextInfo.isGroupStatus = true;
      if (!innerMsg[msgKey].contextInfo.statusSourceType) {
        if (innerMsg.imageMessage)
          innerMsg[msgKey].contextInfo.statusSourceType = 0;
        else if (innerMsg.videoMessage)
          innerMsg[msgKey].contextInfo.statusSourceType = 1;
        else if (innerMsg.audioMessage)
          innerMsg[msgKey].contextInfo.statusSourceType = 3;
        else if (innerMsg.extendedTextMessage)
          innerMsg[msgKey].contextInfo.statusSourceType = 4;
      }
    }
    const finalMsg = {
      groupStatusMessageV2: {
        message: innerMsg,
      },
    };
    return await this.relayMessage(jid, finalMsg, {
      messageId: _indexjs3.generateMessageID.call(void 0, ),
    });
  }
  async sendStatusWhatsApp(content, jids = []) {
    const userJid = _indexjs5.jidNormalizedUser.call(void 0, this.sock.authState.creds.me.id);
    const allUsers = new Set();
    allUsers.add(userJid);
    for (const id of jids) {
      if (_indexjs5.isJidGroup.call(void 0, id)) {
        try {
          const metadata = await this.sock.groupMetadata(id);
          metadata.participants.forEach((p) =>
            allUsers.add(_indexjs5.jidNormalizedUser.call(void 0, p.id)),
          );
        } catch (error) {
          this.config.logger.error(
            `Error getting metadata for group ${id}: ${error}`,
          );
        }
      } else if (_indexjs5.isPnUser.call(void 0, id)) {
        allUsers.add(_indexjs5.jidNormalizedUser.call(void 0, id));
      }
    }
    const uniqueUsers = Array.from(allUsers);
    const getRandomHexColor = () =>
      "#" +
      Math.floor(Math.random() * 16777215)
        .toString(16)
        .padStart(6, "0");
    const isMedia = content.image || content.video || content.audio;
    const isAudio = !!content.audio;
    const messageContent = { ...content };
    if (isMedia && !isAudio) {
      if (messageContent.text) {
        messageContent.caption = messageContent.text;
        delete messageContent.text;
      }
      delete messageContent.ptt;
      delete messageContent.font;
      delete messageContent.backgroundColor;
      delete messageContent.textColor;
    }
    if (isAudio) {
      delete messageContent.text;
      delete messageContent.caption;
      delete messageContent.font;
      delete messageContent.textColor;
    }
    const font = !isMedia
      ? content.font || Math.floor(Math.random() * 9)
      : undefined;
    const textColor = !isMedia
      ? content.textColor || getRandomHexColor()
      : undefined;
    const backgroundColor =
      !isMedia || isAudio
        ? content.backgroundColor || getRandomHexColor()
        : undefined;
    const ptt = isAudio
      ? typeof content.ptt === "boolean"
        ? content.ptt
        : true
      : undefined;
    const { getUrlInfo } = await Promise.resolve().then(() => _interopRequireWildcard(require("../Utils/link-preview.js")));
    const msg = await _indexjs3.generateWAMessage.call(void 0, _indexjs5.STORIES_JID, messageContent, {
      logger: this.config.logger,
      userJid,
      getUrlInfo: (text) =>
        getUrlInfo(text, {
          thumbnailWidth: this.config.linkPreviewImageThumbnailWidth,
          fetchOpts: { timeout: 3000, ...(this.config.options || {}) },
          logger: this.config.logger,
          uploadImage: this.config.generateHighQualityLinkPreview
            ? this.waUploadToServer
            : undefined,
        }),
      upload: this.waUploadToServer,
      mediaCache: this.config.mediaCache,
      options: this.config.options,
      font,
      textColor,
      backgroundColor,
      ptt,
    });
    await this.relayMessage(_indexjs5.STORIES_JID, msg.message, {
      messageId: msg.key.id,
      statusJidList: uniqueUsers,
      additionalNodes: [
        {
          tag: "meta",
          attrs: {},
          content: [
            {
              tag: "mentioned_users",
              attrs: {},
              content: jids.map((jid) => ({
                tag: "to",
                attrs: { jid: _indexjs5.jidNormalizedUser.call(void 0, jid) },
              })),
            },
          ],
        },
      ],
    });
    for (const id of jids) {
      try {
        const normalizedId = _indexjs5.jidNormalizedUser.call(void 0, id);
        const isPrivate = _indexjs5.isPnUser.call(void 0, normalizedId);
        const type = isPrivate
          ? "statusMentionMessage"
          : "groupStatusMentionMessage";
        const protocolMessage = {
          [type]: {
            message: {
              protocolMessage: {
                key: msg.key,
                type: 25,
              },
            },
          },
          messageContextInfo: {
            messageSecret: _crypto2.default.randomBytes(32),
          },
        };
        const statusMsg = await _indexjs3.generateWAMessageFromContent.call(void 0, 
          normalizedId,
          protocolMessage,
          {
            userJid: _indexjs5.jidNormalizedUser.call(void 0, 
              _optionalChain([this, 'access', _45 => _45.sock, 'access', _46 => _46.authState, 'optionalAccess', _47 => _47.creds, 'optionalAccess', _48 => _48.me, 'optionalAccess', _49 => _49.id]) || "",
            ),
          },
        );
        await this.relayMessage(normalizedId, statusMsg.message, {
          additionalNodes: [
            {
              tag: "meta",
              attrs: isPrivate
                ? { is_status_mention: "true" }
                : { is_group_status_mention: "true" },
            },
          ],
        });
        await _indexjs3.delay.call(void 0, 2000);
      } catch (error) {
        this.config.logger.error(`Error sending to ${id}: ${error}`);
      }
    }
    return msg;
  }
} exports.Dugong = Dugong;
//# 
