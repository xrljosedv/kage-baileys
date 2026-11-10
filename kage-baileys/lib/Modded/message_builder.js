"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { newObj[key] = obj[key]; } } } newObj.default = obj; return newObj; } } function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; } function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; } 




























'use strict';

const VERSION = '4.7-kage.1';

const _indexjs = new Proxy({}, {get(_target, key) { return require('../index.js')[key]; }});
var _crypto = require('crypto'); var _crypto2 = _interopRequireDefault(_crypto);
var _stream = require('stream');

let ffmpeg;
const { resizeImage: resizeKageImage } = require('../Utils/image-processing');

try {
    ffmpeg = require('fluent-ffmpeg');
} catch (e3) {
    console.warn('⚠️ [kage-baileys] El módulo opcional fluent-ffmpeg no está instalado. Algunas vistas previas de vídeo no estarán disponibles.');
}

function extractIE(text, { extract = true, hyperlink = true, citation = true, latex = true } = {}) {
    if (!extract) {
        return {
            text,
            ie: [],
            inline_entities: [],
        };
    }

    const createIE = (type, ie) => {
        if (type == 'hyperlink') {
            return {
                key: ie.key,
                metadata: {
                    display_name: ie.text,
                    is_trusted: ie.is_trusted,
                    url: ie.url,
                    __typename: 'GenAIInlineLinkItem',
                },
            };
        }

        if (type == 'citation') {
            return {
                key: ie.key,
                metadata: {
                    reference_id: ie.reference_id,
                    reference_url: ie.url,
                    reference_title: ie.url,
                    reference_display_name: ie.url,
                    sources: [],
                    __typename: 'GenAISearchCitationItem',
                },
            };
        }

        if (type == 'latex') {
            return {
                key: ie.key,
                metadata: {
                    latex_expression: ie.text,
                    latex_image: {
                        url: ie.url,
                        width: Number(ie.width) || 100,
                        height: Number(ie.height) || 100,
                    },
                    font_height: Number(ie.font_height) || 83.333333333333,
                    padding: Number(ie.padding) || 15,
                    __typename: 'GenAILatexItem',
                },
            };
        }
    };

    let ie = [];
    let inline_entities = [];
    let result = '';
    let last = 0;
    let citation_index = 1;
    let hyperlink_index = 0;
    let latex_index = 0;
    let stack = [];

    for (let i = 0; i < text.length; i++) {
        if (text[i] == '[' && text[i - 1] != '\\') {
            stack.push(i);
        } else if (text[i] == ']' && (text[i + 1] == '(' || text[i + 1] == '<')) {
            let start = stack.pop();

            if (start == null) continue;

            let open = text[i + 1];
            let close = open == '(' ? ')' : '>';
            let type = open == '(' ? 'link' : 'latex';
            let end = i + 2;
            let depth = 1;

            while (end < text.length && depth) {
                if (text[end] == open && text[end - 1] != '\\') depth++;
                else if (text[end] == close && text[end - 1] != '\\') depth--;
                end++;
            }

            if (depth) continue;

            let raw = text.slice(start + 1, i).trim();
            let url = text.slice(i + 2, end - 1).trim();

            let key;
            let tag;
            let data;

            if (type == 'latex') {
                if (!latex) continue;

                let [txt = '', width = null, height = null, font_height = null, padding = null] = raw.split('|');

                key = `\u004E\u0049\u0058\u0045\u004C_LATEX_${latex_index++}`;
                tag = `{{${key}}}${txt || 'image'}{{/${key}}}`;

                data = {
                    type: 'latex',
                    ie: {
                        key,
                        text: txt,
                        url,
                        width,
                        height,
                        font_height,
                        padding,
                    },
                };
            } else if (raw) {
                if (!hyperlink) continue;

                const trusted = !url.startsWith('!');

                if (!trusted) {
                    url = url.slice(1);
                }

                key = `\u004E\u0049\u0058\u0045\u004C_HYPERLINK_${hyperlink_index++}`;
                tag = `{{${key}}}${url}{{/${key}}}`;

                data = {
                    type: 'hyperlink',
                    ie: {
                        key,
                        text: raw,
                        url,
                        is_trusted: trusted,
                    },
                };
            } else {
                if (!citation) continue;

                key = `\u004E\u0049\u0058\u0045\u004C_CITATION_${citation_index - 1}`;
                tag = `{{${key}}}${url}{{/${key}}}`;

                data = {
                    type: 'citation',
                    ie: {
                        reference_id: citation_index++,
                        key,
                        text: '',
                        url,
                    },
                };
            }

            result += text.slice(last, start) + tag;
            last = end;

            ie.push(data);

            const entity = createIE(data.type, data.ie);

            if (entity) {
                inline_entities.push(entity);
            }

            i = end - 1;
        }
    }

    result += text.slice(last);

    return {
        text: result,
        ie,
        inline_entities,
    };
}

async function waitAllPromises(input) {
    const isPromise = (v) => v && typeof v.then === 'function';
    const isObject = (v) => v && typeof v === 'object';

    const deep = async (v) => {
        if (isPromise(v)) return deep(await v);
        if (Array.isArray(v)) return Promise.all(v.map(deep));
        if (isObject(v)) {
            const entries = await Promise.all(Object.entries(v).map(async ([k, val]) => [k, await deep(val)]));
            return Object.fromEntries(entries);
        }
        return v;
    };

    return deep(await input);
}

class Toolkit {
    constructor() { }

    static extractIE(text, { extract = true, hyperlink = true, citation = true, latex = true } = {}) {
        return extractIE(text, { extract, hyperlink, citation, latex });
    }

    static async resize(buffer, x, y, fit = 'cover') {
        return resizeKageImage(buffer, x, y, fit);
    }

    static async waitAllPromises(input) {
        return await waitAllPromises(input);
    }

    static async fetchBuffer(url, options = {}, { silent = true } = {}) {
        try {
            let response = await fetch(url, options);
            if (!response.ok) throw Error(`HTTP ${response.status}`);
            return Buffer.from(await response.arrayBuffer());
        } catch (error) {
            if (silent) return Buffer.alloc(0);
            throw error;
        }
    }

    static async toUrl(_client, path, mediaType = 'document') {
        if (!path) throw new Error('Url or buffer needed');

        const media = await _indexjs.prepareWAMessageMedia.call(void 0, 
            {
                [mediaType]: Buffer.isBuffer(path) ? path : { url: path },
            },
            {
                upload: _client.waUploadToServer,
                jid: '\u0040\u006e\u0065\u0077\u0073\u006c\u0065\u0074\u0074\u0065\u0072',
            }
        );

        return _optionalChain([Object, 'access', _ => _.values, 'call', _2 => _2(media), 'access', _3 => _3[0], 'optionalAccess', _4 => _4.url]);
    }

    static async resolveMedia(_client, media, mediaType = 'image', { resolveUrl = false, resolveWAUrl = false, result = 'url', resize = false, width = 300, height = 300 } = {}) {
        const isUrl = (str) => /^https?:\/\/.+/i.test(str);

        const isWAUrl = (str) => /^https?:\/\/[^/]*\.whatsapp\.net\//i.test(str);

        if (Array.isArray(media)) {
            return Promise.all(
                media.map((item) =>
                    Toolkit.resolveMedia(_client, item, mediaType, {
                        resolveUrl,
                        resolveWAUrl,
                        result,
                        resize,
                        width,
                        height,
                    })
                )
            );
        }

        const originalIsBuffer = Buffer.isBuffer(media);

        if (typeof media === 'string' && isUrl(media)) {
            if (isWAUrl(media)) {
                if (resolveWAUrl) {
                    media = await Toolkit.fetchBuffer(media, {}, { silent: true });
                } else if (!resolveUrl) {
                    if (result === 'url') return media;

                    media = await Toolkit.fetchBuffer(media, {}, { silent: true });
                }
            } else {
                if (!resolveUrl) {
                    if (result === 'url') return media;

                    media = await Toolkit.fetchBuffer(media, {}, { silent: true });
                } else {
                    media = await Toolkit.fetchBuffer(media, {}, { silent: true });
                }
            }
        }

        if (typeof media === 'string' && !isUrl(media)) {
            media = Buffer.from(media, 'base64');
        }

        if (!Buffer.isBuffer(media) || !media.length) {
            return;
        }

        if (resize && Buffer.isBuffer(media)) {
            media = await Toolkit.resize(media, width, height);
        }

        if (result === 'buffer') {
            return media;
        }

        if (result === 'base64') {
            return media.toString('base64');
        }

        if (originalIsBuffer) {
            return Toolkit.toUrl(_client, media, mediaType);
        }

        return Toolkit.toUrl(_client, media, mediaType);
    }

    static getMp4Duration(buffer, { silent = true } = {}) {
        try {
            if (!Buffer.isBuffer(buffer) || buffer.length < 8) {
                if (silent) return 0;
                throw new Error('Invalid buffer');
            }

            let offset = 0;

            while (offset < buffer.length - 8) {
                const size = buffer.readUInt32BE(offset);

                if (size < 8 || offset + size > buffer.length) {
                    if (silent) return 0;
                    throw new Error('Invalid atom size');
                }

                const type = buffer.toString('ascii', offset + 4, offset + 8);

                if (type === 'moov') {
                    let moovOffset = offset + 8;
                    const moovEnd = offset + size;

                    while (moovOffset < moovEnd - 8) {
                        const childSize = buffer.readUInt32BE(moovOffset);

                        if (childSize < 8 || moovOffset + childSize > moovEnd) {
                            if (silent) return 0;
                            throw new Error('Invalid child atom size');
                        }

                        const childType = buffer.toString('ascii', moovOffset + 4, moovOffset + 8);

                        if (childType === 'mvhd') {
                            const version = buffer.readUInt8(moovOffset + 8);

                            if (version === 0) {
                                const timescale = buffer.readUInt32BE(moovOffset + 20);
                                const duration = buffer.readUInt32BE(moovOffset + 24);

                                if (!timescale) {
                                    if (silent) return 0;
                                    throw new Error('Invalid timescale');
                                }

                                return duration / timescale;
                            }

                            if (version === 1) {
                                const timescale = buffer.readUInt32BE(moovOffset + 32);
                                const duration = Number(buffer.readBigUInt64BE(moovOffset + 36));

                                if (!timescale) {
                                    if (silent) return 0;
                                    throw new Error('Invalid timescale');
                                }

                                return duration / timescale;
                            }
                        }

                        moovOffset += childSize;
                    }
                }

                offset += size;
            }

            if (silent) return 0;

            throw new Error('No mvhd found!');
        } catch (err) {
            if (silent) return 0;
            throw err;
        }
    }

    static getMp4Preview(videoBuffer, { time, result = 'buffer', resize = true, width = 300, height = 300, silent = true } = {}) {
        return new Promise((resolve, reject) => {
            const fail = (err) => {
                if (silent) {
                    return resolve(result === 'base64' ? '' : Buffer.alloc(0));
                }
                return reject(err);
            };

            try {
                if (!Buffer.isBuffer(videoBuffer) || !videoBuffer.length) {
                    return fail(new Error('videoBuffer tidak valid atau kosong'));
                }

                const inputStream = new (0, _stream.Readable)({ read() { } });
                inputStream.push(videoBuffer);
                inputStream.push(null);

                const outputStream = new (0, _stream.PassThrough)();
                const chunks = [];

                outputStream.on('data', (chunk) => chunks.push(chunk));

                outputStream.on('end', async () => {
                    try {
                        let output = Buffer.concat(chunks);

                        if (!output.length) {
                            return fail(new Error('Output kosong — cek format atau timestamp video'));
                        }

                        if (resize) {
                            output = await Toolkit.resize(output, width, height);
                        }

                        return resolve(result === 'base64' ? output.toString('base64') : output);
                    } catch (err) {
                        return fail(err);
                    }
                });

                outputStream.on('error', fail);

                time ??= Math.min(Toolkit.getMp4Duration(videoBuffer) * 0.2, 10);

                ffmpeg(inputStream)
                    .outputOptions([`-ss ${time}`, '-vframes 1', '-vcodec png', '-f image2pipe'])
                    .on('error', (err) => fail(new Error(`ffmpeg error: ${err.message}`)))
                    .pipe(outputStream, { end: true });
            } catch (err) {
                return fail(err);
            }
        });
    }
}



function finishBuilderMessage(jid, payload, options = {}, viewOnce = false) {
    const content = viewOnce ? {viewOnceMessage:{message:payload}} : payload;
    if (jid == null) return require('../../WAProto').proto.Message.fromObject(content);
    if (typeof jid !== 'string' || !jid.includes('@')) throw new TypeError('Recipient JID is required');
    return require('../Utils/messages').generateWAMessageFromContent(jid, content, options);
}
async function prepareBuilderMedia(data, socket) {
    const prepared = ['imageMessage','videoMessage','documentMessage','locationMessage','productMessage'].filter(key => data[key]);
    if (prepared.length) {
        if (prepared.length !== 1) throw new TypeError('Only one header media field is permitted');
        return data;
    }
    if (!socket?.waUploadToServer) throw new TypeError('Media upload requires a connected socket; pass prepared media for offline builds');
    return require('../Utils/messages').prepareWAMessageMedia(data, {upload:socket.waUploadToServer});
}

class RowBuilder {
    constructor() { this.buttons = []; }
    button(displayText, buttonId) {
        this.buttons.push({ buttonId, buttonText: { displayText }, type: 1 });
        return this;
    }
}
class CardBuilder {
    constructor(client) { this._card = new Button(client); }
    image(url) { this._card.setImage(url); return this; }
    video(url) { this._card.setVideo(url); return this; }
    footer(text) { this._card.setFooter(text); return this; }
    url(label, url) { this._card.addUrl(label, url); return this; }
    title(t) { this._card.setTitle(t); return this; }
    text(t) { this._card.setBody(t); return this; }
    button(displayText, id) { this._card.addReply(displayText, id); return this; }
}

class BaseBuilder {
    constructor() {
        this._title = '';
        this._subtitle = '';
        this._body = '';
        this._footer = '';
        this._contextInfo = {};
        this._extraPayload = {};
        this._viewOnce = false;
    }

    setTitle(title) {
        if (typeof title !== 'string') {
            throw new TypeError('Title must be a string');
        }
        this._title = title;
        return this;
    }

    setSubtitle(subtitle) {
        if (typeof subtitle !== 'string') {
            throw new TypeError('Subtitle must be a string');
        }
        this._subtitle = subtitle;
        return this;
    }

    setBody(body) {
        if (typeof body !== 'string') {
            throw new TypeError('Body must be a string');
        }
        this._body = body;
        return this;
    }

    setFooter(footer) {
        if (typeof footer !== 'string') {
            throw new TypeError('Footer must be a string');
        }
        this._footer = footer;
        return this;
    }

    setContextInfo(obj) {
        if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
            throw new TypeError('ContextInfo must be a plain object');
        }

        this._contextInfo = obj;
        return this;
    }

    addPayload(obj) {
        if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
            throw new TypeError('Payload must be a plain object');
        }

        Object.assign(this._extraPayload, obj);

        return this;
    }
    text(t) { return this.setBody(t); }
    header(t) { return this.setTitle(t); }
    viewOnce(enabled = true) { this._viewOnce = !!enabled; return this; }
    footer(f) { return this.setFooter(f); }
    title(t) { return this.setTitle(t); }
    subtitle(s) { return this.setSubtitle(s); }
    image(url, opts = {}) {
        if (this.setImage) return this.setImage(url, opts);
        if (this.setThumbnail) return this.setThumbnail(url);
        if (this.addImage) return this.addImage(url, opts);
        return this;
    }

}

class Button extends BaseBuilder {
    #client;

    constructor(client) {
        super();
        this.#client = client;

        this._buttons = [];
        this._data;
        this._currentSelectionIndex = -1;
        this._currentSectionIndex = -1;
        this._params = {};
    }

    setVideo(path, options = {}) {
        if (!path) throw new Error('Url or buffer needed');
        Buffer.isBuffer(path) ? (this._data = { video: path, ...options }) : (this._data = { video: { url: path }, ...options });
        return this;
    }

    setImage(path, options = {}) {
        if (!path) throw new Error('Url or buffer needed');
        Buffer.isBuffer(path) ? (this._data = { image: path, ...options }) : (this._data = { image: { url: path }, ...options });
        return this;
    }

    setDocument(path, options = {}) {
        if (!path) throw new Error('Url or buffer needed');
        Buffer.isBuffer(path) ? (this._data = { document: path, ...options }) : (this._data = { document: { url: path }, ...options });
        return this;
    }

    setMedia(obj) {
        if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
            throw new TypeError('Media must be a plain object');
        }

        this._data = obj;
        return this;
    }

    clearButtons() {
        this._buttons = [];
        return this;
    }

    setParams(obj) {
        this._params = obj;
        return this;
    }

    addButton(name, params) {
        this._buttons.push({
            name,
            buttonParamsJson: typeof params === 'string' ? params : JSON.stringify(params),
        });

        return this;
    }

    makeRow(header = '', title = '', description = '', id = '') {
        if (this._currentSelectionIndex === -1 || this._currentSectionIndex === -1) {
            throw new Error('You need to create a selection and a section first');
        }
        const buttonParams = JSON.parse(this._buttons[this._currentSelectionIndex].buttonParamsJson);
        buttonParams.sections[this._currentSectionIndex].rows.push({ header, title, description, id });
        this._buttons[this._currentSelectionIndex].buttonParamsJson = JSON.stringify(buttonParams);
        return this;
    }

    makeSection(title = '', highlight_label = '') {
        if (this._currentSelectionIndex === -1) {
            throw new Error('You need to create a selection first');
        }
        const buttonParams = JSON.parse(this._buttons[this._currentSelectionIndex].buttonParamsJson);
        buttonParams.sections.push({ title, highlight_label, rows: [] });
        this._currentSectionIndex = buttonParams.sections.length - 1;
        this._buttons[this._currentSelectionIndex].buttonParamsJson = JSON.stringify(buttonParams);
        return this;
    }

    addSelection(title, options = {}) {
        this._buttons.push({ ...options, name: 'single_select', buttonParamsJson: JSON.stringify({ title, sections: [] }) });
        this._currentSelectionIndex = this._buttons.length - 1;
        this._currentSectionIndex = -1;
        return this;
    }

    addReply(display_text = '', id = '', options = {}) {
        this._buttons.push({
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
                display_text,
                id,
                ...options,
            }),
        });
        return this;
    }

    addCall(display_text = '', id = '', options = {}) {
        this._buttons.push({
            name: 'cta_call',
            buttonParamsJson: JSON.stringify({
                display_text,
                id,
                ...options,
            }),
        });
        return this;
    }

    addReminder(display_text = '', id = '', options = {}) {
        this._buttons.push({
            name: 'cta_reminder',
            buttonParamsJson: JSON.stringify({
                display_text,
                id,
                ...options,
            }),
        });
        return this;
    }

    addCancelReminder(display_text = '', id = '', options = {}) {
        this._buttons.push({
            name: 'cta_cancel_reminder',
            buttonParamsJson: JSON.stringify({
                display_text,
                id,
                ...options,
            }),
        });
        return this;
    }

    addAddress(display_text = '', id = '', options = {}) {
        this._buttons.push({
            name: 'address_message',
            buttonParamsJson: JSON.stringify({
                display_text,
                id,
                ...options,
            }),
        });
        return this;
    }

    addLocation(options = {}) {
        this._buttons.push({
            name: 'send_location',
            buttonParamsJson: JSON.stringify(options),
        });
        return this;
    }

    addUrl(display_text = '', url = '', webview_interaction = false, options = {}) {
        this._buttons.push({
            ...options,
            name: 'cta_url',
            buttonParamsJson: JSON.stringify({
                display_text,
                url,
                webview_interaction,
                ...options,
            }),
        });
        return this;
    }

    addCopy(display_text = '', copy_code = '', options = {}) {
        this._buttons.push({
            name: 'cta_copy',
            buttonParamsJson: JSON.stringify({
                display_text,
                copy_code,
                ...options,
            }),
        });
        return this;
    }

    static __initStatic() {this.paramsList = {
        limited_time_offer: {
            text: 'string',
            url: 'string',
            copy_code: 'string',
            expiration_time: 'number',
        },
        bottom_sheet: {
            in_thread_buttons_limit: 'number',
            divider_indices: ['number'],
            list_title: 'string',
            button_title: 'string',
        },
        tap_target_configuration: {
            title: 'string',
            description: 'string',
            canonical_url: 'string',
            domain: 'string',
            buttonIndex: 'number',
        },
    }}

    async toCard() {
        return {
            body: {
                text: this._body,
            },
            footer: {
                text: this._footer,
            },
            header: {
                title: this._title,
                subtitle: this._subtitle,
                hasMediaAttachment: !!this._data,
                ...(this._data
                    ? await prepareBuilderMedia(this._data, this.#client)
                    : {}),
            },
            nativeFlowMessage: {
                messageParamsJson: JSON.stringify(this._params),
                buttons: this._buttons,
            },
        };
    }

    async build(jid, options = {}) {
        const message = await this.toCard();
        const validation = require('../Utils/interactive-compat').validateKageInteractiveMessage({interactiveMessage:message});
        if (!validation.valid) throw new TypeError(validation.errors.join('; '));
        return finishBuilderMessage(jid, { ...this._extraPayload, interactiveMessage: { ...message, contextInfo: this._contextInfo } }, options, this._viewOnce);
    }

    async send(jid, { ...options } = {}) {
        const msg = await this.build(jid, options);

        if (!this.#client?.relayMessage) throw new TypeError('A connected socket is required to send; bind(socket) or pass it to the constructor');
        await this.#client.relayMessage(msg.key.remoteJid, msg.message, {
            messageId: msg.key.id,
            additionalNodes: [
                {
                    tag: 'biz',
                    attrs: {},
                    content: [
                        {
                            tag: 'interactive',
                            attrs: { type: 'native_flow', v: '1' },
                            content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }],
                        },
                    ],
                },
            ],
            ...options,
        });
        return msg;
    }
    button(displayText, id) { return this.addReply(displayText, id || _crypto2.default.randomUUID()); }
    row(callback) {
        if (typeof callback !== 'function') throw new TypeError('Row callback required');
        const row = new RowBuilder(); callback(row);
        for (const button of row.buttons) this.addReply(button.buttonText.displayText, button.buttonId || _crypto2.default.randomUUID());
        return this;
    }

} Button.__initStatic();

class ButtonV2 extends BaseBuilder {
    #client;

    constructor(client) {
        super();

        this.#client = client;
        this._image;
        this._data;
        this._buttons = [];
    }

    addButton(displayText = '', buttonId = _crypto2.default.randomUUID()) {
        this._buttons.push({
            buttonId,
            buttonText: { displayText },
            type: 1,
        });
        return this;
    }

    addRawButton(obj) {
        if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
            throw new TypeError('Buttons must be a plain object');
        }

        this._buttons.push(obj);
        return this;
    }

    setThumbnail(path) {
        if (!path) throw new Error('Url or buffer needed');
        this._image = path;
        return this;
    }

    setMedia(obj) {
        if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
            throw new TypeError('Media must be a plain object');
        }

        this._data = obj;
        return this;
    }

    async build(jid, options = {}) {
        if (!this._buttons.length) throw new TypeError('ButtonV2 requires at least one button');
        const media = this._data ? await prepareBuilderMedia(this._data, this.#client) : {};
        const keys = ['imageMessage','videoMessage','documentMessage','locationMessage'].filter(key => media[key]);
        const headerTypes = {documentMessage:3,imageMessage:4,videoMessage:5,locationMessage:6};
        const thumbnail = this._image ? await Toolkit.resize(Buffer.isBuffer(this._image) ? this._image : await Toolkit.fetchBuffer(this._image, {}, {silent:true}),300,300) : undefined;
        const buttonsMessage = {contentText:this._body, footerText:this._footer, contextInfo:this._contextInfo,
            headerType: keys.length ? headerTypes[keys[0]] : this._title ? 2 : 1,
            ...(this._title ? {text:this._title} : {}), ...media,
            ...(thumbnail ? {headerType:6,locationMessage:{degreesLatitude:0,degreesLongitude:0,name:this._title,address:this._subtitle,jpegThumbnail:thumbnail}} : {}),
            buttons:this._buttons};
        return finishBuilderMessage(jid,{...this._extraPayload,buttonsMessage},options,this._viewOnce);
    }

    async send(jid, { ...options } = {}) {
        if (this._buttons.length < 1) throw new Error('ButtonV2 requires at least one button');
        const msg = await this.build(jid, options);

        if (!this.#client?.relayMessage) throw new TypeError('A connected socket is required to send; bind(socket) or pass it to the constructor');
        await this.#client.relayMessage(msg.key.remoteJid, msg.message, {
            messageId: msg.key.id,
            additionalNodes: [
                {
                    tag: 'biz',
                    attrs: {},
                    content: [
                        {
                            tag: 'interactive',
                            attrs: { type: 'native_flow', v: '1' },
                            content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }],
                        },
                    ],
                },
            ],
            ...options,
        });
        return msg;
    }
    button(displayText, id) { return this.addButton(displayText, id); }
    row(cb) {
        const r = new RowBuilder();
        cb(r);
        r.buttons.forEach(b => this._buttons.push(b));
        return this;
    }

}

class Carousel extends BaseBuilder {
    #client;

    constructor(client) {
        super();

        this.#client = client;
        this._cards = [];
    }

    addCard(card) {
        const cards = Array.isArray(card) ? card : [card];
        const baseIndex = this._cards.length;

        for (const [index, c] of cards.entries()) {
            if (!_optionalChain([c, 'optionalAccess', _5 => _5.header, 'optionalAccess', _6 => _6.hasMediaAttachment])) {
                throw new Error(`Card [${baseIndex + index}] must include an image or video in header`);
            }
        }

        this._cards.push(...cards);
        return this;
    }

    async build(jid, options = {}) {
        const cards = [...this._cards];
        for (const builder of this._cardBuilders || []) cards.push(await builder._card.toCard());
        if (!cards.length) throw new TypeError('Carousel requires at least one card');
        const message = { body:{text:this._body}, footer:{text:this._footer}, contextInfo:this._contextInfo, carouselMessage:{cards,messageVersion:1} };
        const validation = require('../Utils/interactive-compat').validateKageInteractiveMessage({interactiveMessage:message});
        if (!validation.valid) throw new TypeError(validation.errors.join('; '));
        return finishBuilderMessage(jid, { ...this._extraPayload, interactiveMessage:message }, options, this._viewOnce);
    }

    async send(jid, { ...options } = {}) {
        const msg = await this.build(jid, options);

        if (!this.#client?.relayMessage) throw new TypeError('A connected socket is required to send; bind(socket) or pass it to the constructor');
        await this.#client.relayMessage(msg.key.remoteJid, msg.message, {
            messageId: msg.key.id,
            additionalNodes: [
                {
                    tag: 'biz',
                    attrs: {},
                    content: [
                        {
                            tag: 'interactive',
                            attrs: { type: 'native_flow', v: '1' },
                            content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }],
                        },
                    ],
                },
            ],
            ...options,
        });
        return msg;
    }
    card(cb) {
        if (!this._cardBuilders) this._cardBuilders = [];
        const cbObj = new CardBuilder(this.#client);
        cb(cbObj);
        this._cardBuilders.push(cbObj);
        return this;
    }

}

class AIRich extends BaseBuilder {
    #client;

    constructor(client) {

        super();
        this.#client = client;
        this._contextInfo = {};
        this._submessages = [];
        this._sections = [];
        this._richResponseSources = [];
    }

    addSubmessage(submessage) {
        const items = Array.isArray(submessage) ? submessage : [submessage];

        for (const item of items) {
            if (typeof item !== 'object' || item === null || Array.isArray(item)) {
                throw new TypeError('Submessage must be a plain object or array of plain objects');
            }

            this._submessages.push(item);
        }

        return this;
    }

    addSection(section) {
        const items = Array.isArray(section) ? section : [section];

        for (const item of items) {
            if (typeof item !== 'object' || item === null || Array.isArray(item)) {
                throw new TypeError('Section must be a plain object or array of plain objects');
            }

            this._sections.push(item);
        }

        return this;
    }

    addText(text, { extract = true, hyperlink = true, citation = true, latex = true } = {}) {
        if (typeof text != 'string') {
            throw new TypeError('Text must be a string');
        }

        const { text: extractedText, inline_entities } = extractIE(text, {
            extract,
            hyperlink,
            citation,
            latex,
        });

        this._submessages.push({
            messageType: 2,
            messageText: extractedText,
        });

        this._sections.push(
            AIRich.newLayout('Single', {
                text: extractedText,
                ...(inline_entities.length && {
                    inline_entities,
                }),
                __typename: 'GenAIMarkdownTextUXPrimitive',
            })
        );

        return this;
    }

    addCode(language, code) {
        if (typeof language !== 'string' || typeof code !== 'string') {
            throw new TypeError('Language and code must be a string');
        }

        const meta = AIRich.tokenizer(code, language);

        this._submessages.push({
            messageType: 5,
            codeMetadata: {
                codeLanguage: language,
                codeBlocks: meta.codeBlock,
            },
        });

        this._sections.push(
            AIRich.newLayout('Single', {
                language,
                code_blocks: meta.unified_codeBlock,
                __typename: 'GenAICodeUXPrimitive',
            })
        );

        return this;
    }

    addTable(table, { hyperlink = true, citation = true, latex = true } = {}) {
        if (!Array.isArray(table)) {
            throw new TypeError('Table must be an array');
        }

        const meta = AIRich.toTableMetadata(table, { hyperlink, citation, latex });

        this._submessages.push({
            messageType: 4,
            tableMetadata: {
                title: meta.title,
                rows: meta.rows,
            },
        });

        this._sections.push(
            AIRich.newLayout('Single', {
                rows: meta.unified_rows,
                __typename: 'GenATableUXPrimitive',
            })
        );

        return this;
    }

    addSource(sources = []) {
        if (!(Array.isArray(sources) && (sources.every((item) => typeof item === 'string') || sources.every((item) => Array.isArray(item) && item.every((v) => typeof v === 'string'))))) {
            throw new TypeError('Sources must be a string array or an array of string arrays');
        }

        if (sources.every((item) => typeof item === 'string')) {
            sources = [sources];
        }

        const source = sources.map(([icon, url, text]) => ({
            source_type: 'THIRD_PARTY',
            source_display_name: _nullishCoalesce(text, () => ( '')),
            source_subtitle: 'AI',
            source_url: _nullishCoalesce(url, () => ( '')),
            favicon: {
                url: Toolkit.resolveMedia(this.#client, _nullishCoalesce(icon, () => ( '')), 'image'),
                mime_type: 'image/jpeg',
                width: 16,
                height: 16,
            },
        }));

        this._sections.push(
            AIRich.newLayout('Single', {
                sources: source,
                __typename: 'GenAISearchResultPrimitive',
            })
        );

        return this;
    }

    addReels(reelsItems = []) {
        if (
            !(
                (reelsItems && typeof reelsItems === 'object' && !Array.isArray(reelsItems)) ||
                (Array.isArray(reelsItems) && reelsItems.every((item) => item && typeof item === 'object' && !Array.isArray(item)))
            )
        ) {
            throw new TypeError('Reels items must be an object or an array of objects');
        }

        if (!Array.isArray(reelsItems)) {
            reelsItems = [reelsItems];
        }

        const reels = reelsItems.map((item) => ({
            ...item,
            _avatar: Toolkit.resolveMedia(this.#client, _nullishCoalesce(_nullishCoalesce(_nullishCoalesce(item.profileIconUrl, () => ( item.profile_url)), () => ( item.profile)), () => ( '')), 'image'),
            _thumbnail: Toolkit.resolveMedia(this.#client, _nullishCoalesce(_nullishCoalesce(item.thumbnailUrl, () => ( item.thumbnail)), () => ( '')), 'image'),
        }));

        this._submessages.push({
            messageType: 9,
            contentItemsMetadata: {
                contentType: 1,
                itemsMetadata: reels.map((item) => ({
                    reelItem: {
                        title: _nullishCoalesce(item.username, () => ( '')),
                        profileIconUrl: item._avatar,
                        thumbnailUrl: item._thumbnail,
                        videoUrl: _nullishCoalesce(_nullishCoalesce(item.videoUrl, () => ( item.url)), () => ( '')),
                    },
                })),
            },
        });

        reels.forEach((item, idx) => {
            this._richResponseSources.push({
                provider: '\u004E\u0049\u0058\u0045\u004C',
                thumbnailCDNURL: item._thumbnail,
                sourceProviderURL: _nullishCoalesce(_nullishCoalesce(item.videoUrl, () => ( item.url)), () => ( '')),
                sourceQuery: '',
                faviconCDNURL: item._avatar,
                citationNumber: idx + 1,
                sourceTitle: _nullishCoalesce(item.username, () => ( '')),
            });
        });

        this._sections.push(
            AIRich.newLayout(
                'HScroll',
                reels.map((item) => ({
                    reels_url: _nullishCoalesce(_nullishCoalesce(item.videoUrl, () => ( item.url)), () => ( '')),
                    thumbnail_url: item._thumbnail,
                    creator: _nullishCoalesce(_nullishCoalesce(item.username, () => ( item.title)), () => ( '')),
                    avatar_url: item._avatar,
                    reels_title: _nullishCoalesce(_nullishCoalesce(item.reels_title, () => ( item.title)), () => ( '')),
                    likes_count: _nullishCoalesce(_nullishCoalesce(item.likes_count, () => ( item.like)), () => ( 0)),
                    shares_count: _nullishCoalesce(_nullishCoalesce(item.shares_count, () => ( item.share)), () => ( 0)),
                    view_count: _nullishCoalesce(_nullishCoalesce(item.view_count, () => ( item.view)), () => ( 0)),
                    reel_source: _nullishCoalesce(_nullishCoalesce(item.reel_source, () => ( item.source)), () => ( 'IG')),
                    is_verified: !!(item.is_verified || item.verified),
                    __typename: 'GenAIReelPrimitive',
                }))
            )
        );

        return this;
    }

    addImage(imageUrl, { resolveUrl = false } = {}) {
        if (!(typeof imageUrl === 'string' || Buffer.isBuffer(imageUrl) || (Array.isArray(imageUrl) && imageUrl.every((v) => typeof v === 'string' || Buffer.isBuffer(v))))) {
            throw new TypeError('imageUrl must be string | buffer | array of string/buffer');
        }

        const list = Array.isArray(imageUrl)
            ? imageUrl.map((v) => {
                const url = Toolkit.resolveMedia(this.#client, v, 'image', { resolveUrl });
                return {
                    imagePreviewUrl: url,
                    imageHighResUrl: url,
                    sourceUrl: url,
                };
            })
            : (() => {
                const url = Toolkit.resolveMedia(this.#client, imageUrl, 'image', { resolveUrl });
                return [
                    {
                        imagePreviewUrl: url,
                        imageHighResUrl: url,
                        sourceUrl: url,
                    },
                ];
            })();

        this._submessages.push({
            messageType: 1,
            gridImageMetadata: {
                gridImageUrl: {
                    imagePreviewUrl: _optionalChain([list, 'access', _7 => _7[0], 'optionalAccess', _8 => _8.imagePreviewUrl]),
                },
                imageUrls: list,
            },
        });

        list.forEach(({ imagePreviewUrl }) => {
            this._sections.push(
                AIRich.newLayout('Single', {
                    media: {
                        url: imagePreviewUrl,
                        mime_type: 'image/png',
                    },
                    imagine_type: 'IMAGE',
                    status: { status: 'READY' },
                    __typename: 'GenAIImaginePrimitive',
                })
            );
        });

        return this;
    }

    addVideo(videoUrl, { autoFill = true } = {}) {
        const isObjectVideo = (v) => v && typeof v === 'object' && v.url;

        const isValidPrimitive =
            typeof videoUrl === 'string' ||
            Buffer.isBuffer(videoUrl) ||
            isObjectVideo(videoUrl) ||
            (Array.isArray(videoUrl) && videoUrl.every((v) => typeof v === 'string' || Buffer.isBuffer(v) || isObjectVideo(v)));

        if (!isValidPrimitive) {
            throw new TypeError('videoUrl must be string | buffer | object | array');
        }

        const items = Array.isArray(videoUrl) ? videoUrl : [videoUrl];

        this._submessages.push({
            messageType: 2,
            messageText: '[ CANNOT_LOAD_VIDEO - \u004E\u0049\u0058\u0045\u004C ]',
        });

        items.forEach((item) => {
            const isObject = isObjectVideo(item);

            const url = isObject ? Toolkit.resolveMedia(this.#client, _nullishCoalesce(item.url, () => ( '')), 'video') : Toolkit.resolveMedia(this.#client, item, 'video');

            const bufferPromise = autoFill ? Promise.resolve(url).then((u) => Toolkit.fetchBuffer(u)) : null;

            const file_length = isObject && item.file_length != null ? item.file_length : autoFill ? bufferPromise.then((b) => _nullishCoalesce(_optionalChain([b, 'optionalAccess', _9 => _9.length]), () => ( 0))) : 0;

            const duration =
                isObject && item.duration != null
                    ? item.duration
                    : autoFill
                        ? bufferPromise.then((b) =>
                            Toolkit.getMp4Duration(b, {
                                silent: true,
                            })
                        )
                        : 0;

            const thumbnail =
                isObject && item.thumbnail
                    ? Toolkit.resolveMedia(this.#client, item.thumbnail, 'image', {
                        result: 'base64',
                        resize: true,
                        width: 300,
                        height: 300,
                    })
                    : autoFill
                        ? bufferPromise
                            ? bufferPromise.then((b) =>
                                Toolkit.getMp4Preview(b, {
                                    time: 0,
                                    result: 'base64',
                                })
                            )
                            : null
                        : null;

            this._sections.push(
                AIRich.newLayout('Single', {
                    media: {
                        url,
                        mime_type: isObject ? (_nullishCoalesce(item.mime_type, () => ( 'video/mp4'))) : 'video/mp4',
                        file_length,
                        duration,
                    },
                    imagine_type: 'ANIMATE',
                    status: { status: 'READY' },
                    thumbnail: {
                        raw_media: thumbnail,
                    },
                    __typename: 'GenAIImaginePrimitive',
                })
            );
        });

        return this;
    }

    addProduct(data = {}) {
        if (!((data && typeof data === 'object' && !Array.isArray(data)) || (Array.isArray(data) && data.every((item) => item && typeof item === 'object' && !Array.isArray(item))))) {
            throw new TypeError('Product items must be an object or an array of objects');
        }

        this._submessages.push({
            messageType: 2,
            messageText: '[ CANNOT_LOAD_PRODUCT - NIXEL ]',
        });

        const items = Array.isArray(data) ? data : [data];

        const product = items.map((item) => ({
            title: item.title,
            brand: item.brand,
            price: item.price,
            sale_price: item.sale_price,
            product_url: _nullishCoalesce(item.product_url, () => ( item.url)),
            image: {
                url: Toolkit.resolveMedia(this.#client, _nullishCoalesce(item.image_url, () => ( item.image)), 'image'),
            },
            additional_images: [
                {
                    url: Toolkit.resolveMedia(this.#client, _nullishCoalesce(item.icon_url, () => ( item.icon)), 'image'),
                },
            ],
            __typename: 'GenAIProductItemCardPrimitive',
        }));

        this._sections.push(AIRich.newLayout(Array.isArray(data) ? 'HScroll' : 'Single', Array.isArray(data) ? product : product[0]));

        return this;
    }

    addPost(data = {}) {
        if (!((data && typeof data === 'object' && !Array.isArray(data)) || (Array.isArray(data) && data.every((item) => item && typeof item === 'object' && !Array.isArray(item))))) {
            throw new TypeError('Post items must be an object or an array of objects');
        }

        const posts = Array.isArray(data) ? data : [data];

        this._submessages.push({
            messageType: 2,
            messageText: '[ CANNOT_LOAD_POST - NIXEL ]',
        });

        const primitives = posts.map((p) => ({
            title: _nullishCoalesce(p.title, () => ( '')),
            subtitle: _nullishCoalesce(p.subtitle, () => ( '')),
            username: _nullishCoalesce(p.username, () => ( '')),
            profile_picture_url: Toolkit.resolveMedia(this.#client, _nullishCoalesce(_nullishCoalesce(_nullishCoalesce(p.profile_picture_url, () => ( p.profile_url)), () => ( p.profile)), () => ( '')), 'image'),
            is_verified: !!(p.is_verified || p.verified),
            thumbnail_url: Toolkit.resolveMedia(this.#client, _nullishCoalesce(_nullishCoalesce(p.thumbnail_url, () => ( p.thumbnail)), () => ( '')), 'image'),
            post_caption: _nullishCoalesce(_nullishCoalesce(p.post_caption, () => ( p.caption)), () => ( '')),
            likes_count: _nullishCoalesce(_nullishCoalesce(p.likes_count, () => ( p.like)), () => ( 0)),
            comments_count: _nullishCoalesce(_nullishCoalesce(p.comments_count, () => ( p.comment)), () => ( 0)),
            shares_count: _nullishCoalesce(_nullishCoalesce(p.shares_count, () => ( p.share)), () => ( 0)),
            post_url: _nullishCoalesce(_nullishCoalesce(p.post_url, () => ( p.url)), () => ( '')),
            post_deeplink: _nullishCoalesce(_nullishCoalesce(p.post_deeplink, () => ( p.deeplink)), () => ( '')),
            source_app: p.source_app || p.source || 'INSTAGRAM',
            footer_label: _nullishCoalesce(_nullishCoalesce(p.footer_label, () => ( p.footer)), () => ( '')),
            footer_icon: Toolkit.resolveMedia(this.#client, _nullishCoalesce(_nullishCoalesce(p.footer_icon, () => ( p.icon)), () => ( '')), 'image'),
            is_carousel: posts.length > 1,
            orientation: _nullishCoalesce(p.orientation, () => ( 'LANDSCAPE')),
            post_type: _nullishCoalesce(p.post_type, () => ( 'VIDEO')),
            __typename: 'GenAIPostPrimitive',
        }));

        this._sections.push(AIRich.newLayout('HScroll', primitives));

        return this;
    }

    addTip(text) {
        this._submessages.push({
            messageType: 2,
            messageText: text,
        });

        this._sections.push(
            AIRich.newLayout('Single', {
                text,
                __typename: 'GenAIMetadataTextPrimitive',
            })
        );

        return this;
    }

    addSuggest(suggestion, { scroll = true, layout } = {}) {
        if (!(typeof suggestion === 'string' || (Array.isArray(suggestion) && suggestion.every((v) => typeof v === 'string')))) {
            throw new TypeError('Suggestion must be a string or array of strings');
        }

        const suggest = Array.isArray(suggestion)
            ? suggestion.map((text) => ({
                prompt_text: text,
                prompt_type: 'SUGGESTED_PROMPT',
                __typename: 'GenAIFollowUpSuggestionPillPrimitive',
            }))
            : [
                {
                    prompt_text: suggestion,
                    prompt_type: 'SUGGESTED_PROMPT',
                    __typename: 'GenAIFollowUpSuggestionPillPrimitive',
                },
            ];

        const type = _nullishCoalesce(layout, () => ( (suggest.length === 1 ? 'Single' : scroll ? 'HScroll' : 'ActionRow')));

        this._sections.push(AIRich.newLayout(type, type === 'Single' ? suggest[0] : suggest, { __typename: 'GenAIUnifiedResponseSection' }));

        return this;
    }

    async build({ forwarded = true, notification = false, includesUnifiedResponse = true, includesSubmessages = true, quoted, quotedParticipant, ...options } = {}) {
        const forward = forwarded
            ? {
                forwardingScore: 1,
                isForwarded: true,
                forwardedAiBotMessageInfo: { botJid: '0@bot' },
                forwardOrigin: 4,
            }
            : {};

        const notif = notification
            ? {
                sessionTransparencyMetadata: {
                    disclaimerText: '~ Ahmad tumbuh kembang',
                    hcaId: `hca_${Date.now()}`,
                    sessionTransparencyType: 1,
                },
            }
            : {};

        const qObj = quoted
            ? {
                stanzaId: _optionalChain([quoted, 'optionalAccess', _10 => _10.key, 'optionalAccess', _11 => _11.id]) || _optionalChain([quoted, 'optionalAccess', _12 => _12.id]),
                participant: quotedParticipant || _optionalChain([quoted, 'optionalAccess', _13 => _13.key, 'optionalAccess', _14 => _14.participant]) || _optionalChain([quoted, 'optionalAccess', _15 => _15.key, 'optionalAccess', _16 => _16.remoteJid]),
                quotedType: 0,
                quotedMessage: typeof quoted === 'object' && quoted !== null ? (_nullishCoalesce(quoted.message, () => ( quoted))) : undefined,
            }
            : {};

        const sections = this._footer
            ? [
                ...(await waitAllPromises(this._sections)),
                AIRich.newLayout('Single', {
                    text: this._footer,
                    __typename: 'GenAIMetadataTextPrimitive',
                }),
            ]
            : [...(await waitAllPromises(this._sections))];

        return {
            messageContextInfo: {
                deviceListMetadata: {},
                deviceListMetadataVersion: 2,
                botMetadata: {
                    messageDisclaimerText: this._title,
                    richResponseSourcesMetadata: { sources: this._richResponseSources },
                    ...notif,
                },
            },
            ...this._extraPayload,
            botForwardedMessage: {
                message: {
                    richResponseMessage: {
                        messageType: 1,
                        submessages: includesSubmessages ? await waitAllPromises(this._submessages) : [],
                        unifiedResponse: {
                            data: includesUnifiedResponse ? Buffer.from(JSON.stringify({ response_id: _crypto2.default.randomUUID(), sections })).toString('base64') : '',
                        },
                        contextInfo: {
                            ...forward,
                            ...qObj,
                            ...this._contextInfo,
                        },
                    },
                },
            },
        };
    }

    async send(jid, { forwarded, notification, includesUnifiedResponse, includesSubmessages, ...options } = {}) {
        const msg = await this.build({ forwarded, notification, includesUnifiedResponse, includesSubmessages, ...options });

        if (!this.#client?.relayMessage) throw new TypeError('A connected socket is required to send');
        return await this.#client.relayMessage(jid, msg, { ...options });
    }

    static tokenizer(code, lang = 'javascript') {
        const keywordsMap = {
            javascript: new Set([
                'break',
                'case',
                'catch',
                'continue',
                'debugger',
                'delete',
                'do',
                'else',
                'finally',
                'for',
                'function',
                'if',
                'in',
                'instanceof',
                'new',
                'return',
                'switch',
                'this',
                'throw',
                'try',
                'typeof',
                'var',
                'void',
                'while',
                'with',
                'true',
                'false',
                'null',
                'undefined',
                'class',
                'const',
                'let',
                'super',
                'extends',
                'export',
                'import',
                'yield',
                'static',
                'constructor',
                'async',
                'await',
                'get',
                'set',
            ]),

            typescript: new Set([
                'abstract',
                'any',
                'as',
                'asserts',
                'bigint',
                'boolean',
                'declare',
                'enum',
                'implements',
                'infer',
                'interface',
                'is',
                'keyof',
                'module',
                'namespace',
                'never',
                'readonly',
                'require',
                'number',
                'object',
                'override',
                'private',
                'protected',
                'public',
                'satisfies',
                'string',
                'symbol',
                'type',
                'unknown',
                'using',
                'from',
                'break',
                'case',
                'catch',
                'continue',
                'do',
                'else',
                'finally',
                'for',
                'function',
                'if',
                'new',
                'return',
                'switch',
                'this',
                'throw',
                'try',
                'var',
                'void',
                'while',
                'class',
                'const',
                'let',
                'extends',
                'import',
                'export',
                'async',
                'await',
            ]),

            python: new Set([
                'False',
                'None',
                'True',
                'and',
                'as',
                'assert',
                'async',
                'await',
                'break',
                'class',
                'continue',
                'def',
                'del',
                'elif',
                'else',
                'except',
                'finally',
                'for',
                'from',
                'global',
                'if',
                'import',
                'in',
                'is',
                'lambda',
                'nonlocal',
                'not',
                'or',
                'pass',
                'raise',
                'return',
                'try',
                'while',
                'with',
                'yield',
            ]),

            java: new Set([
                'abstract',
                'assert',
                'boolean',
                'break',
                'byte',
                'case',
                'catch',
                'char',
                'class',
                'const',
                'continue',
                'default',
                'do',
                'double',
                'else',
                'enum',
                'extends',
                'final',
                'finally',
                'float',
                'for',
                'goto',
                'if',
                'implements',
                'import',
                'instanceof',
                'int',
                'interface',
                'long',
                'native',
                'new',
                'package',
                'private',
                'protected',
                'public',
                'return',
                'short',
                'static',
                'strictfp',
                'super',
                'switch',
                'synchronized',
                'this',
                'throw',
                'throws',
                'transient',
                'try',
                'void',
                'volatile',
                'while',
            ]),

            golang: new Set([
                'break',
                'case',
                'chan',
                'const',
                'continue',
                'default',
                'defer',
                'else',
                'fallthrough',
                'for',
                'func',
                'go',
                'goto',
                'if',
                'import',
                'interface',
                'map',
                'package',
                'range',
                'return',
                'select',
                'struct',
                'switch',
                'type',
                'var',
            ]),

            c: new Set([
                'auto',
                'break',
                'case',
                'char',
                'const',
                'continue',
                'default',
                'do',
                'double',
                'else',
                'enum',
                'extern',
                'float',
                'for',
                'goto',
                'if',
                'int',
                'long',
                'register',
                'return',
                'short',
                'signed',
                'sizeof',
                'static',
                'struct',
                'switch',
                'typedef',
                'union',
                'unsigned',
                'void',
                'volatile',
                'while',
            ]),

            cpp: new Set([
                'alignas',
                'alignof',
                'and',
                'auto',
                'bool',
                'break',
                'case',
                'catch',
                'class',
                'const',
                'constexpr',
                'continue',
                'delete',
                'do',
                'double',
                'else',
                'enum',
                'explicit',
                'export',
                'extern',
                'false',
                'float',
                'for',
                'friend',
                'if',
                'inline',
                'int',
                'long',
                'mutable',
                'namespace',
                'new',
                'noexcept',
                'nullptr',
                'operator',
                'private',
                'protected',
                'public',
                'return',
                'short',
                'signed',
                'sizeof',
                'static',
                'struct',
                'switch',
                'template',
                'this',
                'throw',
                'true',
                'try',
                'typedef',
                'typename',
                'union',
                'unsigned',
                'using',
                'virtual',
                'void',
                'while',
            ]),

            php: new Set([
                'abstract',
                'and',
                'array',
                'as',
                'break',
                'callable',
                'case',
                'catch',
                'class',
                'clone',
                'const',
                'continue',
                'declare',
                'default',
                'do',
                'echo',
                'else',
                'elseif',
                'empty',
                'enddeclare',
                'endfor',
                'endforeach',
                'endif',
                'endswitch',
                'endwhile',
                'extends',
                'final',
                'finally',
                'fn',
                'for',
                'foreach',
                'function',
                'global',
                'goto',
                'if',
                'implements',
                'include',
                'include_once',
                'instanceof',
                'interface',
                'match',
                'namespace',
                'new',
                'null',
                'or',
                'private',
                'protected',
                'public',
                'require',
                'require_once',
                'return',
                'static',
                'switch',
                'throw',
                'trait',
                'try',
                'use',
                'var',
                'while',
                'yield',
            ]),

            rust: new Set([
                'as',
                'break',
                'const',
                'continue',
                'crate',
                'else',
                'enum',
                'extern',
                'false',
                'fn',
                'for',
                'if',
                'impl',
                'in',
                'let',
                'loop',
                'match',
                'mod',
                'move',
                'mut',
                'pub',
                'ref',
                'return',
                'self',
                'Self',
                'static',
                'struct',
                'super',
                'trait',
                'true',
                'type',
                'unsafe',
                'use',
                'where',
                'while',
            ]),

            html: new Set([
                'html',
                'head',
                'body',
                'div',
                'span',
                'p',
                'a',
                'img',
                'video',
                'audio',
                'script',
                'style',
                'link',
                'meta',
                'form',
                'input',
                'button',
                'table',
                'tr',
                'td',
                'th',
                'ul',
                'ol',
                'li',
                'section',
                'article',
                'header',
                'footer',
                'nav',
                'main',
            ]),

            bash: new Set([
                'if',
                'then',
                'else',
                'elif',
                'fi',
                'for',
                'while',
                'do',
                'done',
                'case',
                'esac',
                'function',
                'in',
                'select',
                'until',
                'break',
                'continue',
                'return',
                'export',
                'readonly',
                'local',
                'declare',
            ]),

            markdown: new Set(['#', '##', '###', '####', '#####', '######']),
        };

        if (!lang || lang === 'txt' || lang === 'text' || lang === 'plaintext') {
            return {
                codeBlock: [
                    {
                        codeContent: code,
                        highlightType: 0,
                    },
                ],
                unified_codeBlock: [
                    {
                        content: code,
                        type: 'DEFAULT',
                    },
                ],
            };
        }

        const TYPE_MAP = {
            0: 'DEFAULT',
            1: 'KEYWORD',
            2: 'METHOD',
            3: 'STR',
            4: 'NUMBER',
            5: 'COMMENT',
        };

        const keywords = keywordsMap[lang.toLowerCase()] || new Set();
        const tokens = [];

        let i = 0;

        const push = (content, type) => {
            if (!content) return;

            const last = tokens[tokens.length - 1];

            if (last && last.highlightType === type) {
                last.codeContent += content;
            } else {
                tokens.push({
                    codeContent: content,
                    highlightType: type,
                });
            }
        };

        const isIdentifier = (char) => {
            switch (lang.toLowerCase()) {
                case 'css':
                    return /[a-zA-Z0-9_$-]/.test(char);

                case 'html':
                    return /[a-zA-Z0-9_$:-]/.test(char);

                default:
                    return /[a-zA-Z0-9_$]/.test(char);
            }
        };

        while (i < code.length) {
            const c = code[i];

            if (/\s/.test(c)) {
                let s = i;

                while (i < code.length && /\s/.test(code[i])) {
                    i++;
                }

                push(code.slice(s, i), 0);
                continue;
            }

            if ((c === '/' && code[i + 1] === '/') || (c === '#' && ['python', 'bash'].includes(lang))) {
                let s = i;

                while (i < code.length && code[i] !== '\n') {
                    i++;
                }

                push(code.slice(s, i), 5);
                continue;
            }

            if (c === '"' || c === "'" || c === '`') {
                let s = i;
                const q = c;

                i++;

                while (i < code.length) {
                    if (code[i] === '\\' && i + 1 < code.length) {
                        i += 2;
                    } else if (code[i] === q) {
                        i++;
                        break;
                    } else {
                        i++;
                    }
                }

                push(code.slice(s, i), 3);
                continue;
            }

            if (/[0-9]/.test(c)) {
                let s = i;

                while (i < code.length && /[0-9._]/.test(code[i])) {
                    i++;
                }

                push(code.slice(s, i), 4);
                continue;
            }

            if (/[a-zA-Z_$]/.test(c)) {
                let s = i;

                while (i < code.length && isIdentifier(code[i])) {
                    i++;
                }

                const word = code.slice(s, i);

                let type = 0;

                if (keywords.has(word)) {
                    type = 1;
                } else if (lang === 'css') {
                    let j = i;

                    while (j < code.length && /\s/.test(code[j])) {
                        j++;
                    }

                    if (code[j] === ':') {
                        type = 1;
                    }
                } else if (lang === 'html') {
                    let p = s - 1;

                    while (p >= 0 && /\s/.test(code[p])) {
                        p--;
                    }

                    if (code[p] === '<' || (code[p] === '/' && code[p - 1] === '<')) {
                        type = 1;
                    }
                }

                if (type === 0) {
                    let j = i;

                    while (j < code.length && /\s/.test(code[j])) {
                        j++;
                    }

                    if (code[j] === '(') {
                        type = 2;
                    }
                }

                push(word, type);
                continue;
            }

            push(c, 0);
            i++;
        }

        return {
            codeBlock: tokens,
            unified_codeBlock: tokens.map((t) => ({
                content: t.codeContent,
                type: TYPE_MAP[t.highlightType],
            })),
        };
    }

    static toTableMetadata(arr, { hyperlink = true, citation = true, latex = true } = {}) {
        if (!Array.isArray(arr) || !arr.every((row) => Array.isArray(row) && row.every((cell) => typeof cell === 'string'))) {
            throw new TypeError('Table must be a nested array of strings');
        }

        const [header, ...rows] = arr;

        const maxLen = Math.max(header.length, ...rows.map((r) => r.length));

        const normalize = (r) => [...r, ...Array(maxLen - r.length).fill('')];

        const unified_rows = [
            {
                is_header: true,
                cells: normalize(header),
            },
            ...rows.map((r) => ({
                is_header: false,
                cells: normalize(r),
            })),
        ].map((row) => {
            const markdown_cells = row.cells.map((cell) => {
                const extracted = extractIE(cell, { hyperlink, citation, latex });

                return {
                    text: extracted.text,
                    ...(extracted.inline_entities.length ? { inline_entities: extracted.inline_entities } : {}),
                };
            });

            return {
                ...row,
                ...(markdown_cells.some((c) => _optionalChain([c, 'access', _17 => _17.inline_entities, 'optionalAccess', _18 => _18.length])) ? { markdown_cells } : {}),
            };
        });

        const rowsMeta = unified_rows.map((r) => ({
            items: r.cells,
            ...(r.is_header ? { isHeading: true } : {}),
        }));

        return {
            title: '',
            rows: rowsMeta,
            unified_rows,
        };
    }

    static newLayout(name, data, extra = {}) {
        return {
            ...extra,
            view_model: {
                [Array.isArray(data) ? 'primitives' : 'primitive']: data,
                __typename: `GenAI${name}LayoutViewModel`,
            },
        };
    }
    text(t) { return this.addText(t, this._richTextOptions || {}); }
    extract(enabled) { this._richTextOptions = {...this._richTextOptions, extract:!!enabled}; return this; }
    hyperlink(enabled) { this._richTextOptions = {...this._richTextOptions, hyperlink:!!enabled}; return this; }
    citation(enabled) { this._richTextOptions = {...this._richTextOptions, citation:!!enabled}; return this; }
    latex(enabled) { this._richTextOptions = {...this._richTextOptions, latex:!!enabled}; return this; }

}

class ORich extends AIRich { }



exports.VERSION = VERSION; exports.Button = Button; exports.ButtonV2 = ButtonV2; exports.Carousel = Carousel; exports.AIRich = AIRich; exports.ORich = ORich; exports.Toolkit = Toolkit;

 
const __kageModule102 = (() => {
const module = { exports: {} }; const exports = module.exports;
 



























'use strict';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Toolkit = exports.ORich = exports.AIRich = exports.Carousel = exports.ButtonV2 = exports.Button = exports.VERSION = void 0;
const VERSION = '4.6';
exports.VERSION = VERSION;
const index_js_1 = require("../index.js");
const crypto_1 = __importDefault(require("crypto"));
const stream_1 = require("stream");
let ffmpeg;
const { resizeImage: resizeKageImage } = require('../Utils/image-processing');
try {
    ffmpeg = require('fluent-ffmpeg');
}
catch {
    console.warn('⚠️ [kage-baileys] El módulo opcional fluent-ffmpeg no está instalado. Algunas vistas previas de vídeo no estarán disponibles.');
}
function extractIE(text, { extract = true, hyperlink = true, citation = true, latex = true } = {}) {
    if (!extract) {
        return {
            text,
            ie: [],
            inline_entities: [],
        };
    }
    const createIE = (type, ie) => {
        if (type == 'hyperlink') {
            return {
                key: ie.key,
                metadata: {
                    display_name: ie.text,
                    is_trusted: ie.is_trusted,
                    url: ie.url,
                    __typename: 'GenAIInlineLinkItem',
                },
            };
        }
        if (type == 'citation') {
            return {
                key: ie.key,
                metadata: {
                    reference_id: ie.reference_id,
                    reference_url: ie.url,
                    reference_title: ie.url,
                    reference_display_name: ie.url,
                    sources: [],
                    __typename: 'GenAISearchCitationItem',
                },
            };
        }
        if (type == 'latex') {
            return {
                key: ie.key,
                metadata: {
                    latex_expression: ie.text,
                    latex_image: {
                        url: ie.url,
                        width: Number(ie.width) || 100,
                        height: Number(ie.height) || 100,
                    },
                    font_height: Number(ie.font_height) || 83.333333333333,
                    padding: Number(ie.padding) || 15,
                    __typename: 'GenAILatexItem',
                },
            };
        }
    };
    let ie = [];
    let inline_entities = [];
    let result = '';
    let last = 0;
    let citation_index = 1;
    let hyperlink_index = 0;
    let latex_index = 0;
    let stack = [];
    for (let i = 0; i < text.length; i++) {
        if (text[i] == '[' && text[i - 1] != '\\') {
            stack.push(i);
        }
        else if (text[i] == ']' && (text[i + 1] == '(' || text[i + 1] == '<')) {
            let start = stack.pop();
            if (start == null)
                continue;
            let open = text[i + 1];
            let close = open == '(' ? ')' : '>';
            let type = open == '(' ? 'link' : 'latex';
            let end = i + 2;
            let depth = 1;
            while (end < text.length && depth) {
                if (text[end] == open && text[end - 1] != '\\')
                    depth++;
                else if (text[end] == close && text[end - 1] != '\\')
                    depth--;
                end++;
            }
            if (depth)
                continue;
            let raw = text.slice(start + 1, i).trim();
            let url = text.slice(i + 2, end - 1).trim();
            let key;
            let tag;
            let data;
            if (type == 'latex') {
                if (!latex)
                    continue;
                let [txt = '', width = null, height = null, font_height = null, padding = null] = raw.split('|');
                key = `\u004E\u0049\u0058\u0045\u004C_LATEX_${latex_index++}`;
                tag = `{{${key}}}${txt || 'image'}{{/${key}}}`;
                data = {
                    type: 'latex',
                    ie: {
                        key,
                        text: txt,
                        url,
                        width,
                        height,
                        font_height,
                        padding,
                    },
                };
            }
            else if (raw) {
                if (!hyperlink)
                    continue;
                const trusted = !url.startsWith('!');
                if (!trusted) {
                    url = url.slice(1);
                }
                key = `\u004E\u0049\u0058\u0045\u004C_HYPERLINK_${hyperlink_index++}`;
                tag = `{{${key}}}${url}{{/${key}}}`;
                data = {
                    type: 'hyperlink',
                    ie: {
                        key,
                        text: raw,
                        url,
                        is_trusted: trusted,
                    },
                };
            }
            else {
                if (!citation)
                    continue;
                key = `\u004E\u0049\u0058\u0045\u004C_CITATION_${citation_index - 1}`;
                tag = `{{${key}}}${url}{{/${key}}}`;
                data = {
                    type: 'citation',
                    ie: {
                        reference_id: citation_index++,
                        key,
                        text: '',
                        url,
                    },
                };
            }
            result += text.slice(last, start) + tag;
            last = end;
            ie.push(data);
            const entity = createIE(data.type, data.ie);
            if (entity) {
                inline_entities.push(entity);
            }
            i = end - 1;
        }
    }
    result += text.slice(last);
    return {
        text: result,
        ie,
        inline_entities,
    };
}
async function waitAllPromises(input) {
    const isPromise = (v) => v && typeof v.then === 'function';
    const isObject = (v) => v && typeof v === 'object';
    const deep = async (v) => {
        if (isPromise(v))
            return deep(await v);
        if (Array.isArray(v))
            return Promise.all(v.map(deep));
        if (isObject(v)) {
            const entries = await Promise.all(Object.entries(v).map(async ([k, val]) => [k, await deep(val)]));
            return Object.fromEntries(entries);
        }
        return v;
    };
    return deep(await input);
}
class Toolkit {
    constructor() { }
    static extractIE(text, { extract = true, hyperlink = true, citation = true, latex = true } = {}) {
        return extractIE(text, { extract, hyperlink, citation, latex });
    }
    static async resize(buffer, x, y, fit = 'cover') {
        return resizeKageImage(buffer, x, y, fit);
    }
    static async waitAllPromises(input) {
        return await waitAllPromises(input);
    }
    static async fetchBuffer(url, options = {}, { silent = true } = {}) {
        try {
            let response = await fetch(url, options);
            if (!response.ok)
                throw Error(`HTTP ${response.status}`);
            return Buffer.from(await response.arrayBuffer());
        }
        catch (error) {
            if (silent)
                return Buffer.alloc(0);
            throw error;
        }
    }
    static async toUrl(_client, path, mediaType = 'document') {
        if (!path)
            throw new Error('Url or buffer needed');
        const media = await (0, index_js_1.prepareWAMessageMedia)({
            [mediaType]: Buffer.isBuffer(path) ? path : { url: path },
        }, {
            upload: _client.waUploadToServer,
            jid: '\u0040\u006e\u0065\u0077\u0073\u006c\u0065\u0074\u0074\u0065\u0072',
        });
        return Object.values(media)[0]?.url;
    }
    static async resolveMedia(_client, media, mediaType = 'image', { resolveUrl = false, resolveWAUrl = false, result = 'url', resize = false, width = 300, height = 300 } = {}) {
        const isUrl = (str) => /^https?:\/\/.+/i.test(str);
        const isWAUrl = (str) => /^https?:\/\/[^/]*\.whatsapp\.net\//i.test(str);
        if (Array.isArray(media)) {
            return Promise.all(media.map((item) => Toolkit.resolveMedia(_client, item, mediaType, {
                resolveUrl,
                resolveWAUrl,
                result,
                resize,
                width,
                height,
            })));
        }
        const originalIsBuffer = Buffer.isBuffer(media);
        if (typeof media === 'string' && isUrl(media)) {
            if (isWAUrl(media)) {
                if (resolveWAUrl) {
                    media = await Toolkit.fetchBuffer(media, {}, { silent: true });
                }
                else if (!resolveUrl) {
                    if (result === 'url')
                        return media;
                    media = await Toolkit.fetchBuffer(media, {}, { silent: true });
                }
            }
            else {
                if (!resolveUrl) {
                    if (result === 'url')
                        return media;
                    media = await Toolkit.fetchBuffer(media, {}, { silent: true });
                }
                else {
                    media = await Toolkit.fetchBuffer(media, {}, { silent: true });
                }
            }
        }
        if (typeof media === 'string' && !isUrl(media)) {
            media = Buffer.from(media, 'base64');
        }
        if (!Buffer.isBuffer(media) || !media.length) {
            return;
        }
        if (resize && Buffer.isBuffer(media)) {
            media = await Toolkit.resize(media, width, height);
        }
        if (result === 'buffer') {
            return media;
        }
        if (result === 'base64') {
            return media.toString('base64');
        }
        if (originalIsBuffer) {
            return Toolkit.toUrl(_client, media, mediaType);
        }
        return Toolkit.toUrl(_client, media, mediaType);
    }
    static getMp4Duration(buffer, { silent = true } = {}) {
        try {
            if (!Buffer.isBuffer(buffer) || buffer.length < 8) {
                if (silent)
                    return 0;
                throw new Error('Invalid buffer');
            }
            let offset = 0;
            while (offset < buffer.length - 8) {
                const size = buffer.readUInt32BE(offset);
                if (size < 8 || offset + size > buffer.length) {
                    if (silent)
                        return 0;
                    throw new Error('Invalid atom size');
                }
                const type = buffer.toString('ascii', offset + 4, offset + 8);
                if (type === 'moov') {
                    let moovOffset = offset + 8;
                    const moovEnd = offset + size;
                    while (moovOffset < moovEnd - 8) {
                        const childSize = buffer.readUInt32BE(moovOffset);
                        if (childSize < 8 || moovOffset + childSize > moovEnd) {
                            if (silent)
                                return 0;
                            throw new Error('Invalid child atom size');
                        }
                        const childType = buffer.toString('ascii', moovOffset + 4, moovOffset + 8);
                        if (childType === 'mvhd') {
                            const version = buffer.readUInt8(moovOffset + 8);
                            if (version === 0) {
                                const timescale = buffer.readUInt32BE(moovOffset + 20);
                                const duration = buffer.readUInt32BE(moovOffset + 24);
                                if (!timescale) {
                                    if (silent)
                                        return 0;
                                    throw new Error('Invalid timescale');
                                }
                                return duration / timescale;
                            }
                            if (version === 1) {
                                const timescale = buffer.readUInt32BE(moovOffset + 32);
                                const duration = Number(buffer.readBigUInt64BE(moovOffset + 36));
                                if (!timescale) {
                                    if (silent)
                                        return 0;
                                    throw new Error('Invalid timescale');
                                }
                                return duration / timescale;
                            }
                        }
                        moovOffset += childSize;
                    }
                }
                offset += size;
            }
            if (silent)
                return 0;
            throw new Error('No mvhd found!');
        }
        catch (err) {
            if (silent)
                return 0;
            throw err;
        }
    }
    static getMp4Preview(videoBuffer, { time, result = 'buffer', resize = true, width = 300, height = 300, silent = true } = {}) {
        return new Promise((resolve, reject) => {
            const fail = (err) => {
                if (silent) {
                    return resolve(result === 'base64' ? '' : Buffer.alloc(0));
                }
                return reject(err);
            };
            try {
                if (!Buffer.isBuffer(videoBuffer) || !videoBuffer.length) {
                    return fail(new Error('videoBuffer tidak valid atau kosong'));
                }
                const inputStream = new stream_1.Readable({ read() { } });
                inputStream.push(videoBuffer);
                inputStream.push(null);
                const outputStream = new stream_1.PassThrough();
                const chunks = [];
                outputStream.on('data', (chunk) => chunks.push(chunk));
                outputStream.on('end', async () => {
                    try {
                        let output = Buffer.concat(chunks);
                        if (!output.length) {
                            return fail(new Error('Output kosong — cek format atau timestamp video'));
                        }
                        if (resize) {
                            output = await Toolkit.resize(output, width, height);
                        }
                        return resolve(result === 'base64' ? output.toString('base64') : output);
                    }
                    catch (err) {
                        return fail(err);
                    }
                });
                outputStream.on('error', fail);
                time ??= Math.min(Toolkit.getMp4Duration(videoBuffer) * 0.2, 10);
                ffmpeg(inputStream)
                    .outputOptions([`-ss ${time}`, '-vframes 1', '-vcodec png', '-f image2pipe'])
                    .on('error', (err) => fail(new Error(`ffmpeg error: ${err.message}`)))
                    .pipe(outputStream, { end: true });
            }
            catch (err) {
                return fail(err);
            }
        });
    }
}
exports.Toolkit = Toolkit;
class RowBuilder {
    constructor() { this.buttons = []; }
    button(displayText, buttonId) {
        this.buttons.push({ buttonId, buttonText: { displayText }, type: 1 });
        return this;
    }
}
class CardBuilder {
    constructor(client) { this._card = new Button(client); }
    image(url) { this._card.setImage(url); return this; }
    title(t) { this._card.setTitle(t); return this; }
    text(t) { this._card.setBody(t); return this; }
    button(displayText, id) { this._card.addReply(displayText, id); return this; }
}
class BaseBuilder {
    constructor() {
        this._title = '';
        this._subtitle = '';
        this._body = '';
        this._footer = '';
        this._contextInfo = {};
        this._extraPayload = {};
    }
    setTitle(title) {
        if (typeof title !== 'string') {
            throw new TypeError('Title must be a string');
        }
        this._title = title;
        return this;
    }
    setSubtitle(subtitle) {
        if (typeof subtitle !== 'string') {
            throw new TypeError('Subtitle must be a string');
        }
        this._subtitle = subtitle;
        return this;
    }
    setBody(body) {
        if (typeof body !== 'string') {
            throw new TypeError('Body must be a string');
        }
        this._body = body;
        return this;
    }
    setFooter(footer) {
        if (typeof footer !== 'string') {
            throw new TypeError('Footer must be a string');
        }
        this._footer = footer;
        return this;
    }
    setContextInfo(obj) {
        if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
            throw new TypeError('ContextInfo must be a plain object');
        }
        this._contextInfo = obj;
        return this;
    }
    addPayload(obj) {
        if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
            throw new TypeError('Payload must be a plain object');
        }
        Object.assign(this._extraPayload, obj);
        return this;
    }
    text(t) { return this.setBody(t); }
    footer(f) { return this.setFooter(f); }
    title(t) { return this.setTitle(t); }
    subtitle(s) { return this.setSubtitle(s); }
    image(url, opts = {}) {
        if (this.setImage)
            return this.setImage(url, opts);
        if (this.setThumbnail)
            return this.setThumbnail(url);
        if (this.addImage)
            return this.addImage(url, opts);
        return this;
    }
}
class Button extends BaseBuilder {
    #client;
    constructor(client) {
        super();
        if (!client) {
            throw new Error('Socket is required');
        }
        this.#client = client;
        this._buttons = [];
        this._data;
        this._currentSelectionIndex = -1;
        this._currentSectionIndex = -1;
        this._params = {};
    }
    setVideo(path, options = {}) {
        if (!path)
            throw new Error('Url or buffer needed');
        Buffer.isBuffer(path) ? (this._data = { video: path, ...options }) : (this._data = { video: { url: path }, ...options });
        return this;
    }
    setImage(path, options = {}) {
        if (!path)
            throw new Error('Url or buffer needed');
        Buffer.isBuffer(path) ? (this._data = { image: path, ...options }) : (this._data = { image: { url: path }, ...options });
        return this;
    }
    setDocument(path, options = {}) {
        if (!path)
            throw new Error('Url or buffer needed');
        Buffer.isBuffer(path) ? (this._data = { document: path, ...options }) : (this._data = { document: { url: path }, ...options });
        return this;
    }
    setMedia(obj) {
        if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
            throw new TypeError('Media must be a plain object');
        }
        this._data = obj;
        return this;
    }
    clearButtons() {
        this._buttons = [];
        return this;
    }
    setParams(obj) {
        this._params = obj;
        return this;
    }
    addButton(name, params) {
        this._buttons.push({
            name,
            buttonParamsJson: typeof params === 'string' ? params : JSON.stringify(params),
        });
        return this;
    }
    makeRow(header = '', title = '', description = '', id = '') {
        if (this._currentSelectionIndex === -1 || this._currentSectionIndex === -1) {
            throw new Error('You need to create a selection and a section first');
        }
        const buttonParams = JSON.parse(this._buttons[this._currentSelectionIndex].buttonParamsJson);
        buttonParams.sections[this._currentSectionIndex].rows.push({ header, title, description, id });
        this._buttons[this._currentSelectionIndex].buttonParamsJson = JSON.stringify(buttonParams);
        return this;
    }
    makeSection(title = '', highlight_label = '') {
        if (this._currentSelectionIndex === -1) {
            throw new Error('You need to create a selection first');
        }
        const buttonParams = JSON.parse(this._buttons[this._currentSelectionIndex].buttonParamsJson);
        buttonParams.sections.push({ title, highlight_label, rows: [] });
        this._currentSectionIndex = buttonParams.sections.length - 1;
        this._buttons[this._currentSelectionIndex].buttonParamsJson = JSON.stringify(buttonParams);
        return this;
    }
    addSelection(title, options = {}) {
        this._buttons.push({ ...options, name: 'single_select', buttonParamsJson: JSON.stringify({ title, sections: [] }) });
        this._currentSelectionIndex = this._buttons.length - 1;
        this._currentSectionIndex = -1;
        return this;
    }
    addReply(display_text = '', id = '', options = {}) {
        this._buttons.push({
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
                display_text,
                id,
                ...options,
            }),
        });
        return this;
    }
    addCall(display_text = '', id = '', options = {}) {
        this._buttons.push({
            name: 'cta_call',
            buttonParamsJson: JSON.stringify({
                display_text,
                id,
                ...options,
            }),
        });
        return this;
    }
    addReminder(display_text = '', id = '', options = {}) {
        this._buttons.push({
            name: 'cta_reminder',
            buttonParamsJson: JSON.stringify({
                display_text,
                id,
                ...options,
            }),
        });
        return this;
    }
    addCancelReminder(display_text = '', id = '', options = {}) {
        this._buttons.push({
            name: 'cta_cancel_reminder',
            buttonParamsJson: JSON.stringify({
                display_text,
                id,
                ...options,
            }),
        });
        return this;
    }
    addAddress(display_text = '', id = '', options = {}) {
        this._buttons.push({
            name: 'address_message',
            buttonParamsJson: JSON.stringify({
                display_text,
                id,
                ...options,
            }),
        });
        return this;
    }
    addLocation(options = {}) {
        this._buttons.push({
            name: 'send_location',
            buttonParamsJson: JSON.stringify(options),
        });
        return this;
    }
    addUrl(display_text = '', url = '', webview_interaction = false, options = {}) {
        this._buttons.push({
            ...options,
            name: 'cta_url',
            buttonParamsJson: JSON.stringify({
                display_text,
                url,
                webview_interaction,
                ...options,
            }),
        });
        return this;
    }
    addCopy(display_text = '', copy_code = '', options = {}) {
        this._buttons.push({
            name: 'cta_copy',
            buttonParamsJson: JSON.stringify({
                display_text,
                copy_code,
                ...options,
            }),
        });
        return this;
    }
    static paramsList = {
        limited_time_offer: {
            text: 'string',
            url: 'string',
            copy_code: 'string',
            expiration_time: 'number',
        },
        bottom_sheet: {
            in_thread_buttons_limit: 'number',
            divider_indices: ['number'],
            list_title: 'string',
            button_title: 'string',
        },
        tap_target_configuration: {
            title: 'string',
            description: 'string',
            canonical_url: 'string',
            domain: 'string',
            buttonIndex: 'number',
        },
    };
    async toCard() {
        return {
            body: {
                text: this._body,
            },
            footer: {
                text: this._footer,
            },
            header: {
                title: this._title,
                subtitle: this._subtitle,
                hasMediaAttachment: !!this._data,
                ...(this._data
                    ? await (0, index_js_1.prepareWAMessageMedia)(this._data, { upload: this.#client.waUploadToServer }).catch((e) => {
                        if (String(e).includes('Invalid media type'))
                            return this._data;
                        throw e;
                    })
                    : {}),
            },
            nativeFlowMessage: {
                messageParamsJson: JSON.stringify(this._params),
                buttons: this._buttons,
            },
        };
    }
    async build(jid, { ...options } = {}) {
        if (this._cardBuilders && this._cardBuilders.length > 0) {
            for (const builder of this._cardBuilders) {
                this.addCard(await builder._card.toCard());
            }
            this._cardBuilders = [];
        }
        return (0, index_js_1.generateWAMessageFromContent)(jid, {
            ...this._extraPayload,
            interactiveMessage: {
                ...message,
                contextInfo: this._contextInfo,
            },
        }, { ...options });
    }
    async send(jid, { ...options } = {}) {
        const msg = await this.build(jid, options);
        await this.#client.relayMessage(msg.key.remoteJid, msg.message, {
            messageId: msg.key.id,
            additionalNodes: [
                {
                    tag: 'biz',
                    attrs: {},
                    content: [
                        {
                            tag: 'interactive',
                            attrs: { type: 'native_flow', v: '1' },
                            content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }],
                        },
                    ],
                },
            ],
            ...options,
        });
        return msg;
    }
    button(displayText, id) { return this.addReply(displayText, id); }
}
exports.Button = Button;
class ButtonV2 extends BaseBuilder {
    #client;
    constructor(client) {
        super();
        if (!client) {
            throw new Error('Socket is required');
        }
        this.#client = client;
        this._image;
        this._data;
        this._buttons = [];
    }
    addButton(displayText = '', buttonId = crypto_1.default.randomUUID()) {
        this._buttons.push({
            buttonId,
            buttonText: { displayText },
            type: 1,
        });
        return this;
    }
    addRawButton(obj) {
        if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
            throw new TypeError('Buttons must be a plain object');
        }
        this._buttons.push(obj);
        return this;
    }
    setThumbnail(path) {
        if (!path)
            throw new Error('Url or buffer needed');
        this._image = path;
        return this;
    }
    setMedia(obj) {
        if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
            throw new TypeError('Media must be a plain object');
        }
        this._data = obj;
        return this;
    }
    async build(jid, { ...options } = {}) {
        let _thumbnail = this._image ? await Toolkit.resize(Buffer.isBuffer(this._image) ? this._image : await Toolkit.fetchBuffer(this._image, {}, { silent: true }), 300, 300) : null;
        const msg = (0, index_js_1.generateWAMessageFromContent)(jid, {
            ...this._extraPayload,
            buttonsMessage: {
                contentText: this._body,
                footerText: this._footer,
                ...(this._data
                    ? this._data
                    : {
                        headerType: 6,
                        locationMessage: {
                            degreesLatitude: 0,
                            degreesLongitude: 0,
                            name: this._title,
                            address: this._subtitle,
                            jpegThumbnail: _thumbnail,
                        },
                    }),
                viewOnce: true,
                contextInfo: this._contextInfo,
                buttons: [...this._buttons],
            },
        }, { ...options });
        return msg;
    }
    async send(jid, { ...options } = {}) {
        if (this._buttons.length < 1)
            throw new Error('ButtonV2 requires at least one button');
        const msg = await this.build(jid, options);
        await this.#client.relayMessage(msg.key.remoteJid, msg.message, {
            messageId: msg.key.id,
            additionalNodes: [
                {
                    tag: 'biz',
                    attrs: {},
                    content: [
                        {
                            tag: 'interactive',
                            attrs: { type: 'native_flow', v: '1' },
                            content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }],
                        },
                    ],
                },
            ],
            ...options,
        });
        return msg;
    }
    button(displayText, id) { return this.addButton(displayText, id); }
    row(cb) {
        const r = new RowBuilder();
        cb(r);
        r.buttons.forEach(b => this._buttons.push(b));
        return this;
    }
}
exports.ButtonV2 = ButtonV2;
class Carousel extends BaseBuilder {
    #client;
    constructor(client) {
        super();
        if (!client) {
            throw new Error('Socket is required');
        }
        this.#client = client;
        this._cards = [];
    }
    addCard(card) {
        const cards = Array.isArray(card) ? card : [card];
        const baseIndex = this._cards.length;
        for (const [index, c] of cards.entries()) {
            if (!c?.header?.hasMediaAttachment) {
                throw new Error(`Card [${baseIndex + index}] must include an image or video in header`);
            }
        }
        this._cards.push(...cards);
        return this;
    }
    build(jid, { ...options } = {}) {
        return (0, index_js_1.generateWAMessageFromContent)(jid, {
            ...this._extraPayload,
            interactiveMessage: {
                header: {
                    hasMediaAttachment: false,
                },
                body: { text: this._body },
                footer: { text: this._footer },
                contextInfo: this._contextInfo,
                carouselMessage: {
                    cards: this._cards,
                },
            },
        }, { ...options });
    }
    async send(jid, { ...options } = {}) {
        const msg = await this.build(jid, options);
        await this.#client.relayMessage(msg.key.remoteJid, msg.message, {
            messageId: msg.key.id,
            additionalNodes: [
                {
                    tag: 'biz',
                    attrs: {},
                    content: [
                        {
                            tag: 'interactive',
                            attrs: { type: 'native_flow', v: '1' },
                            content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }],
                        },
                    ],
                },
            ],
            ...options,
        });
        return msg;
    }
    card(cb) {
        if (!this._cardBuilders)
            this._cardBuilders = [];
        const cbObj = new CardBuilder(this.#client);
        cb(cbObj);
        this._cardBuilders.push(cbObj);
        return this;
    }
}
exports.Carousel = Carousel;
class AIRich extends BaseBuilder {
    #client;
    constructor(client) {
        if (!client) {
            throw new Error('Socket is required');
        }
        super();
        this.#client = client;
        this._contextInfo = {};
        this._submessages = [];
        this._sections = [];
        this._richResponseSources = [];
    }
    addSubmessage(submessage) {
        const items = Array.isArray(submessage) ? submessage : [submessage];
        for (const item of items) {
            if (typeof item !== 'object' || item === null || Array.isArray(item)) {
                throw new TypeError('Submessage must be a plain object or array of plain objects');
            }
            this._submessages.push(item);
        }
        return this;
    }
    addSection(section) {
        const items = Array.isArray(section) ? section : [section];
        for (const item of items) {
            if (typeof item !== 'object' || item === null || Array.isArray(item)) {
                throw new TypeError('Section must be a plain object or array of plain objects');
            }
            this._sections.push(item);
        }
        return this;
    }
    addText(text, { hyperlink = true, citation = true, latex = true } = {}) {
        if (typeof text != 'string') {
            throw new TypeError('Text must be a string');
        }
        const { text: extractedText, inline_entities } = extractIE(text, {
            hyperlink,
            citation,
            latex,
        });
        this._submessages.push({
            messageType: 2,
            messageText: extractedText,
        });
        this._sections.push(AIRich.newLayout('Single', {
            text: extractedText,
            ...(inline_entities.length && {
                inline_entities,
            }),
            __typename: 'GenAIMarkdownTextUXPrimitive',
        }));
        return this;
    }
    addCode(language, code) {
        if (typeof language !== 'string' || typeof code !== 'string') {
            throw new TypeError('Language and code must be a string');
        }
        const meta = AIRich.tokenizer(code, language);
        this._submessages.push({
            messageType: 5,
            codeMetadata: {
                codeLanguage: language,
                codeBlocks: meta.codeBlock,
            },
        });
        this._sections.push(AIRich.newLayout('Single', {
            language,
            code_blocks: meta.unified_codeBlock,
            __typename: 'GenAICodeUXPrimitive',
        }));
        return this;
    }
    addTable(table, { hyperlink = true, citation = true, latex = true } = {}) {
        if (!Array.isArray(table)) {
            throw new TypeError('Table must be an array');
        }
        const meta = AIRich.toTableMetadata(table, { hyperlink, citation, latex });
        this._submessages.push({
            messageType: 4,
            tableMetadata: {
                title: meta.title,
                rows: meta.rows,
            },
        });
        this._sections.push(AIRich.newLayout('Single', {
            rows: meta.unified_rows,
            __typename: 'GenATableUXPrimitive',
        }));
        return this;
    }
    addSource(sources = []) {
        if (!(Array.isArray(sources) && (sources.every((item) => typeof item === 'string') || sources.every((item) => Array.isArray(item) && item.every((v) => typeof v === 'string'))))) {
            throw new TypeError('Sources must be a string array or an array of string arrays');
        }
        if (sources.every((item) => typeof item === 'string')) {
            sources = [sources];
        }
        const source = sources.map(([icon, url, text]) => ({
            source_type: 'THIRD_PARTY',
            source_display_name: text ?? '',
            source_subtitle: 'AI',
            source_url: url ?? '',
            favicon: {
                url: Toolkit.resolveMedia(this.#client, icon ?? '', 'image'),
                mime_type: 'image/jpeg',
                width: 16,
                height: 16,
            },
        }));
        this._sections.push(AIRich.newLayout('Single', {
            sources: source,
            __typename: 'GenAISearchResultPrimitive',
        }));
        return this;
    }
    addReels(reelsItems = []) {
        if (!((reelsItems && typeof reelsItems === 'object' && !Array.isArray(reelsItems)) ||
            (Array.isArray(reelsItems) && reelsItems.every((item) => item && typeof item === 'object' && !Array.isArray(item))))) {
            throw new TypeError('Reels items must be an object or an array of objects');
        }
        if (!Array.isArray(reelsItems)) {
            reelsItems = [reelsItems];
        }
        const reels = reelsItems.map((item) => ({
            ...item,
            _avatar: Toolkit.resolveMedia(this.#client, item.profileIconUrl ?? item.profile_url ?? item.profile ?? '', 'image'),
            _thumbnail: Toolkit.resolveMedia(this.#client, item.thumbnailUrl ?? item.thumbnail ?? '', 'image'),
        }));
        this._submessages.push({
            messageType: 9,
            contentItemsMetadata: {
                contentType: 1,
                itemsMetadata: reels.map((item) => ({
                    reelItem: {
                        title: item.username ?? '',
                        profileIconUrl: item._avatar,
                        thumbnailUrl: item._thumbnail,
                        videoUrl: item.videoUrl ?? item.url ?? '',
                    },
                })),
            },
        });
        reels.forEach((item, idx) => {
            this._richResponseSources.push({
                provider: '\u004E\u0049\u0058\u0045\u004C',
                thumbnailCDNURL: item._thumbnail,
                sourceProviderURL: item.videoUrl ?? item.url ?? '',
                sourceQuery: '',
                faviconCDNURL: item._avatar,
                citationNumber: idx + 1,
                sourceTitle: item.username ?? '',
            });
        });
        this._sections.push(AIRich.newLayout('HScroll', reels.map((item) => ({
            reels_url: item.videoUrl ?? item.url ?? '',
            thumbnail_url: item._thumbnail,
            creator: item.username ?? item.title ?? '',
            avatar_url: item._avatar,
            reels_title: item.reels_title ?? item.title ?? '',
            likes_count: item.likes_count ?? item.like ?? 0,
            shares_count: item.shares_count ?? item.share ?? 0,
            view_count: item.view_count ?? item.view ?? 0,
            reel_source: item.reel_source ?? item.source ?? 'IG',
            is_verified: !!(item.is_verified || item.verified),
            __typename: 'GenAIReelPrimitive',
        }))));
        return this;
    }
    addImage(imageUrl, { resolveUrl = false } = {}) {
        if (!(typeof imageUrl === 'string' || Buffer.isBuffer(imageUrl) || (Array.isArray(imageUrl) && imageUrl.every((v) => typeof v === 'string' || Buffer.isBuffer(v))))) {
            throw new TypeError('imageUrl must be string | buffer | array of string/buffer');
        }
        const list = Array.isArray(imageUrl)
            ? imageUrl.map((v) => {
                const url = Toolkit.resolveMedia(this.#client, v, 'image', { resolveUrl });
                return {
                    imagePreviewUrl: url,
                    imageHighResUrl: url,
                    sourceUrl: url,
                };
            })
            : (() => {
                const url = Toolkit.resolveMedia(this.#client, imageUrl, 'image', { resolveUrl });
                return [
                    {
                        imagePreviewUrl: url,
                        imageHighResUrl: url,
                        sourceUrl: url,
                    },
                ];
            })();
        this._submessages.push({
            messageType: 1,
            gridImageMetadata: {
                gridImageUrl: {
                    imagePreviewUrl: list[0]?.imagePreviewUrl,
                },
                imageUrls: list,
            },
        });
        list.forEach(({ imagePreviewUrl }) => {
            this._sections.push(AIRich.newLayout('Single', {
                media: {
                    url: imagePreviewUrl,
                    mime_type: 'image/png',
                },
                imagine_type: 'IMAGE',
                status: { status: 'READY' },
                __typename: 'GenAIImaginePrimitive',
            }));
        });
        return this;
    }
    addVideo(videoUrl, { autoFill = true } = {}) {
        const isObjectVideo = (v) => v && typeof v === 'object' && v.url;
        const isValidPrimitive = typeof videoUrl === 'string' ||
            Buffer.isBuffer(videoUrl) ||
            isObjectVideo(videoUrl) ||
            (Array.isArray(videoUrl) && videoUrl.every((v) => typeof v === 'string' || Buffer.isBuffer(v) || isObjectVideo(v)));
        if (!isValidPrimitive) {
            throw new TypeError('videoUrl must be string | buffer | object | array');
        }
        const items = Array.isArray(videoUrl) ? videoUrl : [videoUrl];
        this._submessages.push({
            messageType: 2,
            messageText: '[ CANNOT_LOAD_VIDEO - \u004E\u0049\u0058\u0045\u004C ]',
        });
        items.forEach((item) => {
            const isObject = isObjectVideo(item);
            const url = isObject ? Toolkit.resolveMedia(this.#client, item.url ?? '', 'video') : Toolkit.resolveMedia(this.#client, item, 'video');
            const bufferPromise = autoFill ? Promise.resolve(url).then((u) => Toolkit.fetchBuffer(u)) : null;
            const file_length = isObject && item.file_length != null ? item.file_length : autoFill ? bufferPromise.then((b) => b?.length ?? 0) : 0;
            const duration = isObject && item.duration != null
                ? item.duration
                : autoFill
                    ? bufferPromise.then((b) => Toolkit.getMp4Duration(b, {
                        silent: true,
                    }))
                    : 0;
            const thumbnail = isObject && item.thumbnail
                ? Toolkit.resolveMedia(this.#client, item.thumbnail, 'image', {
                    result: 'base64',
                    resize: true,
                    width: 300,
                    height: 300,
                })
                : autoFill
                    ? bufferPromise
                        ? bufferPromise.then((b) => Toolkit.getMp4Preview(b, {
                            time: 0,
                            result: 'base64',
                        }))
                        : null
                    : null;
            this._sections.push(AIRich.newLayout('Single', {
                media: {
                    url,
                    mime_type: isObject ? (item.mime_type ?? 'video/mp4') : 'video/mp4',
                    file_length,
                    duration,
                },
                imagine_type: 'ANIMATE',
                status: { status: 'READY' },
                thumbnail: {
                    raw_media: thumbnail,
                },
                __typename: 'GenAIImaginePrimitive',
            }));
        });
        return this;
    }
    addProduct(data = {}) {
        if (!((data && typeof data === 'object' && !Array.isArray(data)) || (Array.isArray(data) && data.every((item) => item && typeof item === 'object' && !Array.isArray(item))))) {
            throw new TypeError('Product items must be an object or an array of objects');
        }
        this._submessages.push({
            messageType: 2,
            messageText: '[ CANNOT_LOAD_PRODUCT - NIXEL ]',
        });
        const items = Array.isArray(data) ? data : [data];
        const product = items.map((item) => ({
            title: item.title,
            brand: item.brand,
            price: item.price,
            sale_price: item.sale_price,
            product_url: item.product_url ?? item.url,
            image: {
                url: Toolkit.resolveMedia(this.#client, item.image_url ?? item.image, 'image'),
            },
            additional_images: [
                {
                    url: Toolkit.resolveMedia(this.#client, item.icon_url ?? item.icon, 'image'),
                },
            ],
            __typename: 'GenAIProductItemCardPrimitive',
        }));
        this._sections.push(AIRich.newLayout(Array.isArray(data) ? 'HScroll' : 'Single', Array.isArray(data) ? product : product[0]));
        return this;
    }
    addPost(data = {}) {
        if (!((data && typeof data === 'object' && !Array.isArray(data)) || (Array.isArray(data) && data.every((item) => item && typeof item === 'object' && !Array.isArray(item))))) {
            throw new TypeError('Post items must be an object or an array of objects');
        }
        const posts = Array.isArray(data) ? data : [data];
        this._submessages.push({
            messageType: 2,
            messageText: '[ CANNOT_LOAD_POST - NIXEL ]',
        });
        const primitives = posts.map((p) => ({
            title: p.title ?? '',
            subtitle: p.subtitle ?? '',
            username: p.username ?? '',
            profile_picture_url: Toolkit.resolveMedia(this.#client, p.profile_picture_url ?? p.profile_url ?? p.profile ?? '', 'image'),
            is_verified: !!(p.is_verified || p.verified),
            thumbnail_url: Toolkit.resolveMedia(this.#client, p.thumbnail_url ?? p.thumbnail ?? '', 'image'),
            post_caption: p.post_caption ?? p.caption ?? '',
            likes_count: p.likes_count ?? p.like ?? 0,
            comments_count: p.comments_count ?? p.comment ?? 0,
            shares_count: p.shares_count ?? p.share ?? 0,
            post_url: p.post_url ?? p.url ?? '',
            post_deeplink: p.post_deeplink ?? p.deeplink ?? '',
            source_app: p.source_app || p.source || 'INSTAGRAM',
            footer_label: p.footer_label ?? p.footer ?? '',
            footer_icon: Toolkit.resolveMedia(this.#client, p.footer_icon ?? p.icon ?? '', 'image'),
            is_carousel: posts.length > 1,
            orientation: p.orientation ?? 'LANDSCAPE',
            post_type: p.post_type ?? 'VIDEO',
            __typename: 'GenAIPostPrimitive',
        }));
        this._sections.push(AIRich.newLayout('HScroll', primitives));
        return this;
    }
    addTip(text) {
        this._submessages.push({
            messageType: 2,
            messageText: text,
        });
        this._sections.push(AIRich.newLayout('Single', {
            text,
            __typename: 'GenAIMetadataTextPrimitive',
        }));
        return this;
    }
    addSuggest(suggestion, { scroll = true, layout } = {}) {
        if (!(typeof suggestion === 'string' || (Array.isArray(suggestion) && suggestion.every((v) => typeof v === 'string')))) {
            throw new TypeError('Suggestion must be a string or array of strings');
        }
        const suggest = Array.isArray(suggestion)
            ? suggestion.map((text) => ({
                prompt_text: text,
                prompt_type: 'SUGGESTED_PROMPT',
                __typename: 'GenAIFollowUpSuggestionPillPrimitive',
            }))
            : [
                {
                    prompt_text: suggestion,
                    prompt_type: 'SUGGESTED_PROMPT',
                    __typename: 'GenAIFollowUpSuggestionPillPrimitive',
                },
            ];
        const type = layout ?? (suggest.length === 1 ? 'Single' : scroll ? 'HScroll' : 'ActionRow');
        this._sections.push(AIRich.newLayout(type, type === 'Single' ? suggest[0] : suggest, { __typename: 'GenAIUnifiedResponseSection' }));
        return this;
    }
    async build({ forwarded = true, notification = false, includesUnifiedResponse = true, includesSubmessages = true, quoted, quotedParticipant, ...options } = {}) {
        const forward = forwarded
            ? {
                forwardingScore: 1,
                isForwarded: true,
                forwardedAiBotMessageInfo: { botJid: '0@bot' },
                forwardOrigin: 4,
            }
            : {};
        const notif = notification
            ? {
                sessionTransparencyMetadata: {
                    disclaimerText: '~ Ahmad tumbuh kembang',
                    hcaId: `hca_${Date.now()}`,
                    sessionTransparencyType: 1,
                },
            }
            : {};
        const qObj = quoted
            ? {
                stanzaId: quoted?.key?.id || quoted?.id,
                participant: quotedParticipant || quoted?.key?.participant || quoted?.key?.remoteJid,
                quotedType: 0,
                quotedMessage: typeof quoted === 'object' && quoted !== null ? (quoted.message ?? quoted) : undefined,
            }
            : {};
        const sections = this._footer
            ? [
                ...(await waitAllPromises(this._sections)),
                AIRich.newLayout('Single', {
                    text: this._footer,
                    __typename: 'GenAIMetadataTextPrimitive',
                }),
            ]
            : [...(await waitAllPromises(this._sections))];
        return {
            messageContextInfo: {
                deviceListMetadata: {},
                deviceListMetadataVersion: 2,
                botMetadata: {
                    messageDisclaimerText: this._title,
                    richResponseSourcesMetadata: { sources: this._richResponseSources },
                    ...notif,
                },
            },
            ...this._extraPayload,
            botForwardedMessage: {
                message: {
                    richResponseMessage: {
                        messageType: 1,
                        submessages: includesSubmessages ? await waitAllPromises(this._submessages) : [],
                        unifiedResponse: {
                            data: includesUnifiedResponse ? Buffer.from(JSON.stringify({ response_id: crypto_1.default.randomUUID(), sections })).toString('base64') : '',
                        },
                        contextInfo: {
                            ...forward,
                            ...qObj,
                            ...this._contextInfo,
                        },
                    },
                },
            },
        };
    }
    async send(jid, { forwarded, notification, includesUnifiedResponse, includesSubmessages, ...options } = {}) {
        const msg = await this.build({ forwarded, notification, includesUnifiedResponse, includesSubmessages, ...options });
        return await this.#client.relayMessage(jid, msg, { ...options });
    }
    static tokenizer(code, lang = 'javascript') {
        const keywordsMap = {
            javascript: new Set([
                'break',
                'case',
                'catch',
                'continue',
                'debugger',
                'delete',
                'do',
                'else',
                'finally',
                'for',
                'function',
                'if',
                'in',
                'instanceof',
                'new',
                'return',
                'switch',
                'this',
                'throw',
                'try',
                'typeof',
                'var',
                'void',
                'while',
                'with',
                'true',
                'false',
                'null',
                'undefined',
                'class',
                'const',
                'let',
                'super',
                'extends',
                'export',
                'import',
                'yield',
                'static',
                'constructor',
                'async',
                'await',
                'get',
                'set',
            ]),
            typescript: new Set([
                'abstract',
                'any',
                'as',
                'asserts',
                'bigint',
                'boolean',
                'declare',
                'enum',
                'implements',
                'infer',
                'interface',
                'is',
                'keyof',
                'module',
                'namespace',
                'never',
                'readonly',
                'require',
                'number',
                'object',
                'override',
                'private',
                'protected',
                'public',
                'satisfies',
                'string',
                'symbol',
                'type',
                'unknown',
                'using',
                'from',
                'break',
                'case',
                'catch',
                'continue',
                'do',
                'else',
                'finally',
                'for',
                'function',
                'if',
                'new',
                'return',
                'switch',
                'this',
                'throw',
                'try',
                'var',
                'void',
                'while',
                'class',
                'const',
                'let',
                'extends',
                'import',
                'export',
                'async',
                'await',
            ]),
            python: new Set([
                'False',
                'None',
                'True',
                'and',
                'as',
                'assert',
                'async',
                'await',
                'break',
                'class',
                'continue',
                'def',
                'del',
                'elif',
                'else',
                'except',
                'finally',
                'for',
                'from',
                'global',
                'if',
                'import',
                'in',
                'is',
                'lambda',
                'nonlocal',
                'not',
                'or',
                'pass',
                'raise',
                'return',
                'try',
                'while',
                'with',
                'yield',
            ]),
            java: new Set([
                'abstract',
                'assert',
                'boolean',
                'break',
                'byte',
                'case',
                'catch',
                'char',
                'class',
                'const',
                'continue',
                'default',
                'do',
                'double',
                'else',
                'enum',
                'extends',
                'final',
                'finally',
                'float',
                'for',
                'goto',
                'if',
                'implements',
                'import',
                'instanceof',
                'int',
                'interface',
                'long',
                'native',
                'new',
                'package',
                'private',
                'protected',
                'public',
                'return',
                'short',
                'static',
                'strictfp',
                'super',
                'switch',
                'synchronized',
                'this',
                'throw',
                'throws',
                'transient',
                'try',
                'void',
                'volatile',
                'while',
            ]),
            golang: new Set([
                'break',
                'case',
                'chan',
                'const',
                'continue',
                'default',
                'defer',
                'else',
                'fallthrough',
                'for',
                'func',
                'go',
                'goto',
                'if',
                'import',
                'interface',
                'map',
                'package',
                'range',
                'return',
                'select',
                'struct',
                'switch',
                'type',
                'var',
            ]),
            c: new Set([
                'auto',
                'break',
                'case',
                'char',
                'const',
                'continue',
                'default',
                'do',
                'double',
                'else',
                'enum',
                'extern',
                'float',
                'for',
                'goto',
                'if',
                'int',
                'long',
                'register',
                'return',
                'short',
                'signed',
                'sizeof',
                'static',
                'struct',
                'switch',
                'typedef',
                'union',
                'unsigned',
                'void',
                'volatile',
                'while',
            ]),
            cpp: new Set([
                'alignas',
                'alignof',
                'and',
                'auto',
                'bool',
                'break',
                'case',
                'catch',
                'class',
                'const',
                'constexpr',
                'continue',
                'delete',
                'do',
                'double',
                'else',
                'enum',
                'explicit',
                'export',
                'extern',
                'false',
                'float',
                'for',
                'friend',
                'if',
                'inline',
                'int',
                'long',
                'mutable',
                'namespace',
                'new',
                'noexcept',
                'nullptr',
                'operator',
                'private',
                'protected',
                'public',
                'return',
                'short',
                'signed',
                'sizeof',
                'static',
                'struct',
                'switch',
                'template',
                'this',
                'throw',
                'true',
                'try',
                'typedef',
                'typename',
                'union',
                'unsigned',
                'using',
                'virtual',
                'void',
                'while',
            ]),
            php: new Set([
                'abstract',
                'and',
                'array',
                'as',
                'break',
                'callable',
                'case',
                'catch',
                'class',
                'clone',
                'const',
                'continue',
                'declare',
                'default',
                'do',
                'echo',
                'else',
                'elseif',
                'empty',
                'enddeclare',
                'endfor',
                'endforeach',
                'endif',
                'endswitch',
                'endwhile',
                'extends',
                'final',
                'finally',
                'fn',
                'for',
                'foreach',
                'function',
                'global',
                'goto',
                'if',
                'implements',
                'include',
                'include_once',
                'instanceof',
                'interface',
                'match',
                'namespace',
                'new',
                'null',
                'or',
                'private',
                'protected',
                'public',
                'require',
                'require_once',
                'return',
                'static',
                'switch',
                'throw',
                'trait',
                'try',
                'use',
                'var',
                'while',
                'yield',
            ]),
            rust: new Set([
                'as',
                'break',
                'const',
                'continue',
                'crate',
                'else',
                'enum',
                'extern',
                'false',
                'fn',
                'for',
                'if',
                'impl',
                'in',
                'let',
                'loop',
                'match',
                'mod',
                'move',
                'mut',
                'pub',
                'ref',
                'return',
                'self',
                'Self',
                'static',
                'struct',
                'super',
                'trait',
                'true',
                'type',
                'unsafe',
                'use',
                'where',
                'while',
            ]),
            html: new Set([
                'html',
                'head',
                'body',
                'div',
                'span',
                'p',
                'a',
                'img',
                'video',
                'audio',
                'script',
                'style',
                'link',
                'meta',
                'form',
                'input',
                'button',
                'table',
                'tr',
                'td',
                'th',
                'ul',
                'ol',
                'li',
                'section',
                'article',
                'header',
                'footer',
                'nav',
                'main',
            ]),
            bash: new Set([
                'if',
                'then',
                'else',
                'elif',
                'fi',
                'for',
                'while',
                'do',
                'done',
                'case',
                'esac',
                'function',
                'in',
                'select',
                'until',
                'break',
                'continue',
                'return',
                'export',
                'readonly',
                'local',
                'declare',
            ]),
            markdown: new Set(['#', '##', '###', '####', '#####', '######']),
        };
        if (!lang || lang === 'txt' || lang === 'text' || lang === 'plaintext') {
            return {
                codeBlock: [
                    {
                        codeContent: code,
                        highlightType: 0,
                    },
                ],
                unified_codeBlock: [
                    {
                        content: code,
                        type: 'DEFAULT',
                    },
                ],
            };
        }
        const TYPE_MAP = {
            0: 'DEFAULT',
            1: 'KEYWORD',
            2: 'METHOD',
            3: 'STR',
            4: 'NUMBER',
            5: 'COMMENT',
        };
        const keywords = keywordsMap[lang.toLowerCase()] || new Set();
        const tokens = [];
        let i = 0;
        const push = (content, type) => {
            if (!content)
                return;
            const last = tokens[tokens.length - 1];
            if (last && last.highlightType === type) {
                last.codeContent += content;
            }
            else {
                tokens.push({
                    codeContent: content,
                    highlightType: type,
                });
            }
        };
        const isIdentifier = (char) => {
            switch (lang.toLowerCase()) {
                case 'css':
                    return /[a-zA-Z0-9_$-]/.test(char);
                case 'html':
                    return /[a-zA-Z0-9_$:-]/.test(char);
                default:
                    return /[a-zA-Z0-9_$]/.test(char);
            }
        };
        while (i < code.length) {
            const c = code[i];
            if (/\s/.test(c)) {
                let s = i;
                while (i < code.length && /\s/.test(code[i])) {
                    i++;
                }
                push(code.slice(s, i), 0);
                continue;
            }
            if ((c === '/' && code[i + 1] === '/') || (c === '#' && ['python', 'bash'].includes(lang))) {
                let s = i;
                while (i < code.length && code[i] !== '\n') {
                    i++;
                }
                push(code.slice(s, i), 5);
                continue;
            }
            if (c === '"' || c === "'" || c === '`') {
                let s = i;
                const q = c;
                i++;
                while (i < code.length) {
                    if (code[i] === '\\' && i + 1 < code.length) {
                        i += 2;
                    }
                    else if (code[i] === q) {
                        i++;
                        break;
                    }
                    else {
                        i++;
                    }
                }
                push(code.slice(s, i), 3);
                continue;
            }
            if (/[0-9]/.test(c)) {
                let s = i;
                while (i < code.length && /[0-9._]/.test(code[i])) {
                    i++;
                }
                push(code.slice(s, i), 4);
                continue;
            }
            if (/[a-zA-Z_$]/.test(c)) {
                let s = i;
                while (i < code.length && isIdentifier(code[i])) {
                    i++;
                }
                const word = code.slice(s, i);
                let type = 0;
                if (keywords.has(word)) {
                    type = 1;
                }
                else if (lang === 'css') {
                    let j = i;
                    while (j < code.length && /\s/.test(code[j])) {
                        j++;
                    }
                    if (code[j] === ':') {
                        type = 1;
                    }
                }
                else if (lang === 'html') {
                    let p = s - 1;
                    while (p >= 0 && /\s/.test(code[p])) {
                        p--;
                    }
                    if (code[p] === '<' || (code[p] === '/' && code[p - 1] === '<')) {
                        type = 1;
                    }
                }
                if (type === 0) {
                    let j = i;
                    while (j < code.length && /\s/.test(code[j])) {
                        j++;
                    }
                    if (code[j] === '(') {
                        type = 2;
                    }
                }
                push(word, type);
                continue;
            }
            push(c, 0);
            i++;
        }
        return {
            codeBlock: tokens,
            unified_codeBlock: tokens.map((t) => ({
                content: t.codeContent,
                type: TYPE_MAP[t.highlightType],
            })),
        };
    }
    static toTableMetadata(arr, { hyperlink = true, citation = true, latex = true } = {}) {
        if (!Array.isArray(arr) || !arr.every((row) => Array.isArray(row) && row.every((cell) => typeof cell === 'string'))) {
            throw new TypeError('Table must be a nested array of strings');
        }
        const [header, ...rows] = arr;
        const maxLen = Math.max(header.length, ...rows.map((r) => r.length));
        const normalize = (r) => [...r, ...Array(maxLen - r.length).fill('')];
        const unified_rows = [
            {
                is_header: true,
                cells: normalize(header),
            },
            ...rows.map((r) => ({
                is_header: false,
                cells: normalize(r),
            })),
        ].map((row) => {
            const markdown_cells = row.cells.map((cell) => {
                const extracted = extractIE(cell, { hyperlink, citation, latex });
                return {
                    text: extracted.text,
                    ...(extracted.inline_entities.length ? { inline_entities: extracted.inline_entities } : {}),
                };
            });
            return {
                ...row,
                ...(markdown_cells.some((c) => c.inline_entities?.length) ? { markdown_cells } : {}),
            };
        });
        const rowsMeta = unified_rows.map((r) => ({
            items: r.cells,
            ...(r.is_header ? { isHeading: true } : {}),
        }));
        return {
            title: '',
            rows: rowsMeta,
            unified_rows,
        };
    }
    static newLayout(name, data, extra = {}) {
        return {
            ...extra,
            view_model: {
                [Array.isArray(data) ? 'primitives' : 'primitive']: data,
                __typename: `GenAI${name}LayoutViewModel`,
            },
        };
    }
    text(t) { return this.addText(t); }
}
exports.AIRich = AIRich;
class ORich extends AIRich {
}
exports.ORich = ORich;

return module.exports;
})();
for (const key of Object.keys(__kageModule102)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule102[key]});
}

/** Bind constructors to one existing socket. No global connection or remote code updates. */
exports.bind = function bind(socket) {
    if (!socket || typeof socket.relayMessage !== 'function') throw new TypeError('A socket with relayMessage is required');
    const bound = { VERSION:exports.VERSION, Toolkit:exports.Toolkit };
    for (const name of ['Button','ButtonV2','Carousel','AIRich','ORich']) {
        const Base = exports[name];
        bound[name] = class extends Base { constructor(...args) { super(socket, ...args); } };
    }
    return Object.freeze(bound);
};
exports.MessageBuilder = Object.freeze({VERSION:exports.VERSION,Button:exports.Button,ButtonV2:exports.ButtonV2,Carousel:exports.Carousel,AIRich:exports.AIRich,ORich:exports.ORich,Toolkit:exports.Toolkit,bind:exports.bind});

const NativeMessageBuilder = require('../Utils/message-builder').MessageBuilder;
Object.assign(NativeMessageBuilder, exports.MessageBuilder);
exports.MessageBuilder = NativeMessageBuilder;
