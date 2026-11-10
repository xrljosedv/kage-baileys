"use strict";
const { proto } = require('../../WAProto/index.js');
const { generateWAMessageFromContent } = require('./messages.js')     
                                                                                                                                                           
 ;

                                                                             
                                                                
                                
                                         
                                                                                                                      
 
                                     
                                  
                       
                                                                                               
                           
 
                                                                
function textValue(value        , label        , empty = false)         {
    if (typeof value !== 'string' || (!empty && !value.trim())) throw new TypeError(`${label} must be a nonempty string`);
    return value;
}
class MessageBuilder {
                                   
                               
                                 
                                 
                               
                              
                                
                                                                        
            socket                ;
            body = '';
            heading = '';
            foot = '';
            buttons               = [];
            ids = new Set        ();
            context                                = {};
            wrap = true;
    constructor(socket                ) { this.socket = socket; }
    text(text        )       { this.body = textValue(text, 'Text', true); return this; }
    setBody(text        )       { return this.text(text); }
    title(text        )       { this.heading = textValue(text, 'Title', true); return this; }
    setTitle(text        )       { return this.title(text); }
    footer(text        )       { this.foot = textValue(text, 'Footer', true); return this; }
    setFooter(text        )       { return this.footer(text); }
    viewOnce(enabled = true)       { this.wrap = Boolean(enabled); return this; }
    setContextInfo(value                               )       {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid contextInfo');
        this.context = { ...value }; return this;
    }
            claim(id        )       {
        textValue(id, 'ID');
        if (this.ids.has(id)) throw new TypeError(`Duplicate ID: ${id}`);
        this.ids.add(id);
    }
    quickReply(label        , id        )       {
        textValue(label, 'Button label'); this.claim(id);
        this.buttons.push({ name: 'quick_reply', buttonParamsJson: JSON.stringify({ display_text: label, id }) });
        return this;
    }
    addReply(label        , id        )       { return this.quickReply(label, id); }
    url(label        , value        )       {
        textValue(label, 'Button label');
        const url = new URL(textValue(value, 'URL'));
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new TypeError('Only HTTP(S) URLs without credentials are allowed');
        this.buttons.push({ name: 'cta_url', buttonParamsJson: JSON.stringify({ display_text: label, url: url.href, merchant_url: url.href }) });
        return this;
    }
    addUrl(label        , url        )       { return this.url(label, url); }
    list(label        , sections               )       {
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
    build()                {
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
    async send(jid        , options                     = {})                                {
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

Object.assign(exports, { MessageBuilder });
