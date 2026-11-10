"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wrapToBotForwardedMessage = exports.botMetadataCertificate = exports.botMetadataSignature = exports.prepareRichResponseMessage = exports.toUnified = exports.tokenizeCode = void 0;
 





const node_crypto_1 = require("node:crypto");
const index_js_1 = require("../Defaults/index.js");
const constants_js_1 = require("../WABinary/constants.js");
const RichType_js_1 = require("../Types/RichType.js");
const index_js_2 = require("../../WAProto/index.js");
const NOOP = new Set([]);
const tokenizeCode = (code, language = 'javascript') => {
    const keywords = constants_js_1.LANGUAGE_KEYWORDS[language] || NOOP;
    const blocks = [];
    index_js_1.LEXER_REGEX.lastIndex = 0;
    let match;
    while ((match = index_js_1.LEXER_REGEX.exec(code)) !== null) {
        if (match[1]) {
            blocks.push({ highlightType: RichType_js_1.CodeHighlightType.COMMENT, codeContent: match[1] });
        }
        else if (match[2]) {
            blocks.push({ highlightType: RichType_js_1.CodeHighlightType.STRING, codeContent: match[2] });
        }
        else if (match[3]) {
            blocks.push({
                highlightType: keywords.has(match[3]) ? RichType_js_1.CodeHighlightType.KEYWORD : RichType_js_1.CodeHighlightType.METHOD,
                codeContent: match[3],
            });
        }
        else if (match[4]) {
            blocks.push({
                highlightType: keywords.has(match[4]) ? RichType_js_1.CodeHighlightType.KEYWORD : RichType_js_1.CodeHighlightType.DEFAULT,
                codeContent: match[4],
            });
        }
        else if (match[5]) {
            blocks.push({ highlightType: RichType_js_1.CodeHighlightType.NUMBER, codeContent: match[5] });
        }
        else {
            blocks.push({ highlightType: RichType_js_1.CodeHighlightType.DEFAULT, codeContent: match[6] });
        }
    }
    return blocks;
};
exports.tokenizeCode = tokenizeCode;
 
const toUnified = (submessages, uuid) => ({
    response_id: uuid || (0, node_crypto_1.randomUUID)(),
    sections: submessages.map((submessage, index) => {
        switch (submessage.messageType) {
            case RichType_js_1.RichSubMessageType.CODE:
                const codeMetadata = submessage.codeMetadata;
                return {
                    view_model: {
                        primitive: {
                            language: codeMetadata.codeLanguage,
                            code_blocks: codeMetadata.codeBlocks.map((block) => ({ content: block.codeContent, type: RichType_js_1.CodeHighlightType[block.highlightType] })),
                            __typename: 'GenAICodeUXPrimitive'
                        },
                        __typename: 'GenAISingleLayoutViewModel'
                    }
                };
            case RichType_js_1.RichSubMessageType.CONTENT_ITEMS:
                return {};
            case RichType_js_1.RichSubMessageType.INLINE_IMAGE:
                return {};
            case RichType_js_1.RichSubMessageType.LATEX:
                return {};
            case RichType_js_1.RichSubMessageType.TABLE:
                const tableMetadata = submessage.tableMetadata;
                return {
                    view_model: {
                        primitive: {
                            title: tableMetadata.title,
                            rows: tableMetadata.rows.map((row) => ({
                                is_header: row.isHeading,
                                cells: row.items,
                                markdown_cells: row.items.map((item) => ({ text: item }))
                            })),
                            __typename: 'GenATableUXPrimitive'
                        },
                        __typename: 'GenAISingleLayoutViewModel'
                    }
                };
            case RichType_js_1.RichSubMessageType.TEXT:
                return {
                    view_model: {
                        primitive: {
                            text: submessage.messageText,
                            inline_entities: submessage.inlineEntities || [],
                            __typename: 'GenAIMarkdownTextUXPrimitive'
                        },
                        __typename: 'GenAISingleLayoutViewModel'
                    }
                };
        }
        return submessage;
    })
});
exports.toUnified = toUnified;
const prepareRichResponseMessage = (content) => {
    const { alignment, code, contentText, disclaimerText, footerText, headerText, imageText, inlineImage, inlineVideo, items, language, latex, links, noHeading, posts, products, suggested, richResponse, table, tapLinkUrl, title } = content;
    let submessages = [];
    if (Array.isArray(richResponse)) {
        submessages = richResponse.map((submessage) => {
            if (submessage.text) {
                return {
                    messageType: RichType_js_1.RichSubMessageType.TEXT,
                    messageText: submessage.text,
                    inlineEntities: submessage.inlineEntities
                };
            }
            else if (submessage.code) {
                return {
                    messageType: RichType_js_1.RichSubMessageType.CODE,
                    codeMetadata: {
                        codeLanguage: submessage.language,
                        codeBlocks: submessage.code
                    }
                };
            }
            else if (submessage.items) {
                return {
                    messageType: RichType_js_1.RichSubMessageType.CONTENT_ITEMS,
                    contentItemsMetadata: {
                        itemsMetadata: submessage.items,
                        contentType: index_js_2.proto.AIRichResponseContentItemsMetadata.ContentType.CAROUSEL
                    }
                };
            }
            else if (submessage.inlineImage) {
                return {
                    messageType: RichType_js_1.RichSubMessageType.INLINE_IMAGE,
                    imageMetadata: {
                        imageUrl: submessage.inlineImage,
                        imageText: submessage.imageText,
                        alignment: submessage.alignment,
                        tapLinkUrl: submessage.tapLinkUrl
                    }
                };
            }
            else if (submessage.inlineVideo) {
                return {
                    messageType: RichType_js_1.RichSubMessageType.TEXT,
                    messageText: 'INLINE_VIDEO'
                };
            }
            else if (submessage.latex) {
                return {
                    messageType: RichType_js_1.RichSubMessageType.LATEX,
                    latexMetadata: {
                        text: submessage.text,
                        expressions: submessage.latex
                    }
                };
            }
            else if (submessage.posts) {
                return {
                    messageType: RichType_js_1.RichSubMessageType.TEXT,
                    messageText: 'POSTS'
                };
            }
            else if (submessage.products) {
                return {
                    messageType: RichType_js_1.RichSubMessageType.TEXT,
                    messageText: 'PRODUCTS'
                };
            }
            else if (submessage.suggested) {
                return {
                    messageType: RichType_js_1.RichSubMessageType.TEXT,
                    messageText: 'SUGGESTED_PROMPT'
                };
            }
            else if (submessage.table) {
                return {
                    messageType: RichType_js_1.RichSubMessageType.TABLE,
                    tableMetadata: {
                        title: submessage.title,
                        rows: submessage.table
                    }
                };
            }
            return submessage;
        });
    }
    else {
        if (headerText) {
            submessages.push({
                messageType: RichType_js_1.RichSubMessageType.TEXT,
                messageText: headerText
            });
        }
        if (contentText) {
            submessages.push({
                messageType: RichType_js_1.RichSubMessageType.TEXT,
                messageText: contentText
            });
        }
        if (code) {
            language || (language = 'javascript');
            submessages.push({
                messageType: RichType_js_1.RichSubMessageType.CODE,
                codeMetadata: {
                    codeLanguage: language,
                    codeBlocks: (0, exports.tokenizeCode)(code, language)
                }
            });
        }
        if (items) {
            submessages.push({
                messageType: RichType_js_1.RichSubMessageType.CONTENT_ITEMS,
                contentItemsMetadata: {
                    itemsMetadata: items,
                    contentType: index_js_2.proto.AIRichResponseContentItemsMetadata.ContentType.CAROUSEL
                }
            });
        }
        if (inlineImage) {
            submessages.push({
                messageType: RichType_js_1.RichSubMessageType.INLINE_IMAGE,
                imageMetadata: {
                    imageUrl: inlineImage,
                    imageText,
                    alignment,
                    tapLinkUrl
                }
            });
        }
        if (inlineVideo) {
            submessages.push({
                messageType: RichType_js_1.RichSubMessageType.TEXT,
                messageText: 'INLINE_VIDEO'
            });
        }
        if (latex) {
            submessages.push({
                messageType: RichType_js_1.RichSubMessageType.LATEX,
                latexMetadata: {
                    text,
                    expressions: latex
                }
            });
        }
        if (links) {
            links.forEach((linkField, index) => {
                const prefix = 'SS_' + index;
                const url = linkField.url || index_js_1.DONATE_URL;
                const sources = linkField.sources?.map((sourceField) => ({
                    source_type: 'THIRD_PARTY',
                    source_display_name: sourceField.displayName || 'Donate',
                    source_subtitle: sourceField.subtitle || 'Saweria',
                    source_url: sourceField.url || url
                }));
                submessages.push({
                    messageType: RichType_js_1.RichSubMessageType.TEXT,
                    messageText: linkField.text + ` {{${prefix}}}¹{{/${prefix}}} `,
                    inlineEntities: [{
                            key: prefix,
                            metadata: {
                                reference_id: index + 1,
                                reference_url: url,
                                reference_title: linkField.title || 'For Donation via Saweria',
                                reference_display_name: linkField.displayName || 'Donation',
                                sources: sources || [],
                                __typename: 'GenAISearchCitationItem'
                            }
                        }]
                });
            });
        }
        if (posts) {
            submessages.push({
                messageType: RichType_js_1.RichSubMessageType.TEXT,
                messageText: 'POSTS'
            });
        }
        if (products) {
            submessages.push({
                messageType: RichType_js_1.RichSubMessageType.TEXT,
                messageText: 'PRODUCTS'
            });
        }
        if (suggested) {
            submessages.push({
                messageType: RichType_js_1.RichSubMessageType.TEXT,
                messageText: 'SUGGESTED_PROMPT'
            });
        }
        if (table) {
            submessages.push({
                messageType: RichType_js_1.RichSubMessageType.TABLE,
                tableMetadata: {
                    title,
                    rows: table.map((items, index) => ({
                        isHeading: !noHeading && index == 0,
                        items
                    }))
                }
            });
        }
        if (footerText) {
            submessages.push({
                messageType: RichType_js_1.RichSubMessageType.TEXT,
                messageText: footerText
            });
        }
    }
    const uuid = (0, node_crypto_1.randomUUID)();
    const unified = (0, exports.toUnified)(submessages, uuid);
    const richResponseMessage = index_js_2.proto.AIRichResponseMessage.create({
        submessages,
        messageType: index_js_2.proto.AIRichResponseMessageType.AI_RICH_RESPONSE_TYPE_STANDARD,
        unifiedResponse: {
            data: index_js_1.TEXT_ENCODER.encode(JSON.stringify(unified))  
        },
        contextInfo: {
            isForwarded: true,
            forwardingScore: 1,
            forwardedAiBotMessageInfo: { botJid: '867051314767696@bot' },
            forwardOrigin: 4
        }
    });
    const message = (0, exports.wrapToBotForwardedMessage)(richResponseMessage);
    const botMetadata = message.messageContextInfo.botMetadata;
     
    if (disclaimerText) {
        botMetadata.messageDisclaimerText = disclaimerText;
    }
     
    botMetadata.botResponseId = uuid;
    return message;
};
exports.prepareRichResponseMessage = prepareRichResponseMessage;
 
const botMetadataSignature = () => {
    const signature = new Uint8Array(64);
    (0, node_crypto_1.getRandomValues)(signature);
    return signature;
};
exports.botMetadataSignature = botMetadataSignature;
const botMetadataCertificate = (length = 685) => {
    const certificate = new Uint8Array(length);
    certificate[0] = 48;
    certificate[1] = 130;
    (0, node_crypto_1.getRandomValues)(certificate.subarray(2));
    return certificate;
};
exports.botMetadataCertificate = botMetadataCertificate;
const wrapToBotForwardedMessage = (richResponseMessage) => ({
    messageContextInfo: {
        botMetadata: {
             
            verificationMetadata: {
                proofs: [
                    {
                        certificateChain: [
                            (0, exports.botMetadataCertificate)(),
                            (0, exports.botMetadataCertificate)(892)
                        ],
                        version: 1,
                        useCase: 1,
                        signature: (0, exports.botMetadataSignature)()
                    }
                ]
            }
        }
    },
    botForwardedMessage: {
        message: { richResponseMessage }
    }
});
exports.wrapToBotForwardedMessage = wrapToBotForwardedMessage;
