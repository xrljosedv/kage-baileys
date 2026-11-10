"use strict";Object.defineProperty(exports, "__esModule", {value: true}); 







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
     
    if (attrs.type) {
        stanza.attrs.type = attrs.type;
    }
     
    if (tag === 'message' && meId) {
        stanza.attrs.from = meId;
    }
    return stanza;
} exports.buildAckStanza = buildAckStanza;
 
 
const __kageModule185 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAckStanza = buildAckStanza;
 







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
     
    if (attrs.type) {
        stanza.attrs.type = attrs.type;
    }
     
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
