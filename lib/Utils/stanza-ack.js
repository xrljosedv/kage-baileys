"use strict";Object.defineProperty(exports, "__esModule", {value: true});/**
 * Builds an ACK stanza for a received node.
 * Pure function -- no I/O, no side effects.
 *
 * Mirrors WhatsApp Web's ACK construction:
 * - WAWebHandleMsgSendAck.sendAck / sendNack
 * - WAWebCreateNackFromStanza.createNackFromStanza
 */
 function buildAckStanza(node, errorCode, meId) {
    const { tag, attrs } = node;
    const stanza = {
        tag: 'ack',
        attrs: {
            id: attrs.id,
            to: attrs.from,
            class: tag
        }
    };
    if (errorCode) {
        stanza.attrs.error = errorCode.toString();
    }
    if (attrs.participant) {
        stanza.attrs.participant = attrs.participant;
    }
    if (attrs.recipient) {
        stanza.attrs.recipient = attrs.recipient;
    }
    // WA Web always includes type when present: `n.type || DROP_ATTR`
    if (attrs.type) {
        stanza.attrs.type = attrs.type;
    }
    // WA Web WAWebHandleMsgSendAck.sendAck/sendNack always include `from` for message-class ACKs
    if (tag === 'message' && meId) {
        stanza.attrs.from = meId;
    }
    return stanza;
} exports.buildAckStanza = buildAckStanza;
//# 
// Kage: funciones avanzadas.
const __kageModule185 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAckStanza = buildAckStanza;
/**
 * Builds an ACK stanza for a received node.
 * Pure function -- no I/O, no side effects.
 *
 * Mirrors WhatsApp Web's ACK construction:
 * - WAWebHandleMsgSendAck.sendAck / sendNack
 * - WAWebCreateNackFromStanza.createNackFromStanza
 */
function buildAckStanza(node, errorCode, meId) {
    const { tag, attrs } = node;
    const stanza = {
        tag: 'ack',
        attrs: {
            id: attrs.id,
            to: attrs.from,
            class: tag
        }
    };
    if (errorCode) {
        stanza.attrs.error = errorCode.toString();
    }
    if (attrs.participant) {
        stanza.attrs.participant = attrs.participant;
    }
    if (attrs.recipient) {
        stanza.attrs.recipient = attrs.recipient;
    }
    // WA Web always includes type when present: `n.type || DROP_ATTR`
    if (attrs.type) {
        stanza.attrs.type = attrs.type;
    }
    // WA Web WAWebHandleMsgSendAck.sendAck/sendNack always include `from` for message-class ACKs
    if (tag === 'message' && meId) {
        stanza.attrs.from = meId;
    }
    return stanza;
}

return module.exports;
})();
for (const key of Object.keys(__kageModule185)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule185[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule185, configurable:true});
