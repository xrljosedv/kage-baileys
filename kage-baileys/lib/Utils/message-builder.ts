import { proto } from '../../WAProto/index.js';
const { generateWAMessageFromContent } = require('./messages.js') as {
    generateWAMessageFromContent(jid: string, message: proto.Message.$Properties, options: BuilderSendOptions & { userJid: string }): proto.WebMessageInfo;
};

export interface ListRow { id: string; title: string; description?: string; }
export interface ListSection { title: string; rows: ListRow[]; }
export interface BuilderSocket {
    user?: { id?: string; jid?: string };
    relayMessage(jid: string, message: proto.Message.$Properties, options: Record<string, unknown>): Promise<unknown>;
}
export interface BuilderSendOptions {
    quoted?: proto.WebMessageInfo;
    messageId?: string;
    additionalNodes?: Array<{ tag: string; attrs: Record<string, string>; content?: unknown }>;
    [key: string]: unknown;
}
interface FlowButton { name: string; buttonParamsJson: string; }
function textValue(value: string, label: string, empty = false): string {
    if (typeof value !== 'string' || (!empty && !value.trim())) throw new TypeError(`${label} must be a nonempty string`);
    return value;
}
export class MessageBuilder {
    declare static VERSION: string;
    declare static Button: any;
    declare static ButtonV2: any;
    declare static Carousel: any;
    declare static AIRich: any;
    declare static ORich: any;
    declare static Toolkit: any;
    declare static bind: (socket: BuilderSocket) => Record<string, any>;
    private socket?: BuilderSocket;
    private body = '';
    private heading = '';
    private foot = '';
    private buttons: FlowButton[] = [];
    private ids = new Set<string>();
    private context: proto.ContextInfo.$Properties = {};
    private wrap = true;
    constructor(socket?: BuilderSocket) { this.socket = socket; }
    text(text: string): this { this.body = textValue(text, 'Text', true); return this; }
    setBody(text: string): this { return this.text(text); }
    title(text: string): this { this.heading = textValue(text, 'Title', true); return this; }
    setTitle(text: string): this { return this.title(text); }
    footer(text: string): this { this.foot = textValue(text, 'Footer', true); return this; }
    setFooter(text: string): this { return this.footer(text); }
    viewOnce(enabled = true): this { this.wrap = Boolean(enabled); return this; }
    setContextInfo(value: proto.ContextInfo.$Properties): this {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid contextInfo');
        this.context = { ...value }; return this;
    }
    private claim(id: string): void {
        textValue(id, 'ID');
        if (this.ids.has(id)) throw new TypeError(`Duplicate ID: ${id}`);
        this.ids.add(id);
    }
    quickReply(label: string, id: string): this {
        textValue(label, 'Button label'); this.claim(id);
        this.buttons.push({ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: label, id }) });
        return this;
    }
    addReply(label: string, id: string): this { return this.quickReply(label, id); }
    url(label: string, value: string): this {
        textValue(label, 'Button label');
        const url = new URL(textValue(value, 'URL'));
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new TypeError('Only HTTP(S) URLs without credentials are allowed');
        this.buttons.push({ name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: label, url: url.href, merchant_url: url.href }) });
        return this;
    }
    addUrl(label: string, url: string): this { return this.url(label, url); }
    list(label: string, sections: ListSection[]): this {
        textValue(label, 'List label');
        if (!Array.isArray(sections) || !sections.length) throw new TypeError('List requires sections');
        const ids = new Set(this.ids);
        const normalized = sections.map(section => {
            textValue(section.title, 'Section title');
            if (!Array.isArray(section.rows) || !section.rows.length) throw new TypeError('Section requires rows');
            return { title: section.title, rows: section.rows.map(row => {
                textValue(row.id, 'Row ID'); textValue(row.title, 'Row title');
                if (ids.has(row.id)) throw new TypeError(`Duplicate ID: ${row.id}`);
                ids.add(row.id);
                if (row.description !== undefined) textValue(row.description, 'Description', true);
                return { id: row.id, title: row.title, ...(row.description !== undefined ? { description: row.description } : {}) };
            }) };
        });
        this.ids = ids;
        this.buttons.push({ name: 'single_select', buttonParamsJson: JSON.stringify({ title: label, sections: normalized }) });
        return this;
    }
    build(): proto.Message {
        if (!this.body.trim() && !this.buttons.length) throw new TypeError('Message cannot be empty');
        if (!this.buttons.length) {
            return proto.Message.fromObject({ extendedTextMessage: {
                text: [this.heading, this.body, this.foot].filter(Boolean).join('\n'), contextInfo: this.context
            } });
        }
        const interactiveMessage = {
            header: { title: this.heading, hasMediaAttachment: false },
            body: { text: this.body },
            footer: { text: this.foot },
            nativeFlowMessage: { buttons: this.buttons.map(button => ({ ...button })), messageParamsJson: '{}', messageVersion: 1 },
            contextInfo: this.context
        };
        return proto.Message.fromObject(this.wrap
            ? { viewOnceMessage: { message: { messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 }, interactiveMessage } } }
            : { interactiveMessage });
    }
    async send(jid: string, options: BuilderSendOptions = {}): Promise<proto.WebMessageInfo> {
        if (!this.socket) throw new TypeError('send requires a socket');
        if (!/^\d+(?::\d+)?@(s\.whatsapp\.net|lid|g\.us)$/.test(jid) && !/^\d+-\d+@g\.us$/.test(jid)) throw new TypeError('Unsupported destination');
        const userJid = this.socket.user?.id || this.socket.user?.jid;
        if (!userJid) throw new TypeError('Socket is not authenticated');
        const message = generateWAMessageFromContent(jid, this.build(), { ...options, userJid });
        if (!message.key?.id || !message.message) throw new Error('Message generation failed');
        await this.socket.relayMessage(jid, message.message, { ...options, messageId: message.key.id });
        return message;
    }
}
