"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBinaryNodeMessages = exports.reduceBinaryNodeToDictionary = exports.assertNodeErrorFree = exports.getBinaryNodeChildUInt = exports.getBinaryNodeChildString = exports.getBinaryNodeChildBuffer = exports.getBinaryNodeChild = exports.getAllBinaryNodeChildren = exports.getBinaryNodeChildren = void 0;
exports.binaryNodeToString = binaryNodeToString;
const boom_1 = require("@hapi/boom");
const WAProto_1 = require("../../WAProto");
// some extra useful utilities
const getBinaryNodeChildren = (node, childTag) => {
    if (Array.isArray(node === null || node === void 0 ? void 0 : node.content)) {
        return node.content.filter(item => item.tag === childTag);
    }
    return [];
};
exports.getBinaryNodeChildren = getBinaryNodeChildren;
const getAllBinaryNodeChildren = ({ content }) => {
    if (Array.isArray(content)) {
        return content;
    }
    return [];
};
exports.getAllBinaryNodeChildren = getAllBinaryNodeChildren;
const getBinaryNodeChild = (node, childTag) => {
    if (Array.isArray(node === null || node === void 0 ? void 0 : node.content)) {
        return node === null || node === void 0 ? void 0 : node.content.find(item => item.tag === childTag);
    }
};
exports.getBinaryNodeChild = getBinaryNodeChild;
const getBinaryNodeChildBuffer = (node, childTag) => {
    var _a;
    const child = (_a = (0, exports.getBinaryNodeChild)(node, childTag)) === null || _a === void 0 ? void 0 : _a.content;
    if (Buffer.isBuffer(child) || child instanceof Uint8Array) {
        return child;
    }
};
exports.getBinaryNodeChildBuffer = getBinaryNodeChildBuffer;
const getBinaryNodeChildString = (node, childTag) => {
    var _a;
    const child = (_a = (0, exports.getBinaryNodeChild)(node, childTag)) === null || _a === void 0 ? void 0 : _a.content;
    if (Buffer.isBuffer(child) || child instanceof Uint8Array) {
        return Buffer.from(child).toString('utf-8');
    }
    else if (typeof child === 'string') {
        return child;
    }
};
exports.getBinaryNodeChildString = getBinaryNodeChildString;
const getBinaryNodeChildUInt = (node, childTag, length) => {
    const buff = (0, exports.getBinaryNodeChildBuffer)(node, childTag);
    if (buff) {
        return bufferToUInt(buff, length);
    }
};
exports.getBinaryNodeChildUInt = getBinaryNodeChildUInt;
const assertNodeErrorFree = (node) => {
    const errNode = (0, exports.getBinaryNodeChild)(node, 'error');
    if (errNode) {
        throw new boom_1.Boom(errNode.attrs.text || 'Unknown error', { data: +errNode.attrs.code });
    }
};
exports.assertNodeErrorFree = assertNodeErrorFree;
const reduceBinaryNodeToDictionary = (node, tag) => {
    const nodes = (0, exports.getBinaryNodeChildren)(node, tag);
    const dict = nodes.reduce((dict, { attrs }) => {
        dict[attrs.name || attrs.config_code] = attrs.value || attrs.config_value;
        return dict;
    }, {});
    return dict;
};
exports.reduceBinaryNodeToDictionary = reduceBinaryNodeToDictionary;
const getBinaryNodeMessages = ({ content }) => {
    const msgs = [];
    if (Array.isArray(content)) {
        for (const item of content) {
            if (item.tag === 'message') {
                msgs.push(WAProto_1.proto.WebMessageInfo.decode(item.content));
            }
        }
    }
    return msgs;
};
exports.getBinaryNodeMessages = getBinaryNodeMessages;
function bufferToUInt(e, t) {
    let a = 0;
    for (let i = 0; i < t; i++) {
        a = 256 * a + e[i];
    }
    return a;
}
const tabs = (n) => '\t'.repeat(n);
function binaryNodeToString(node, i = 0) {
    if (!node) {
        return node;
    }
    if (typeof node === 'string') {
        return tabs(i) + node;
    }
    if (node instanceof Uint8Array) {
        return tabs(i) + Buffer.from(node).toString('hex');
    }
    if (Array.isArray(node)) {
        return node.map((x) => tabs(i + 1) + binaryNodeToString(x, i + 1)).join('\n');
    }
    const children = binaryNodeToString(node.content, i + 1);
    const tag = `<${node.tag} ${Object.entries(node.attrs || {})
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}='${v}'`)
        .join(' ')}`;
    const content = children ? `>\n${children}\n${tabs(i)}</${node.tag}>` : '/>';
    return tag + content;
}

// Kage: compatibilidad de API.
const __kageModule84 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { Boom } = require("@hapi/boom")
const { proto } = require("../../WAProto")

// some extra useful utilities
const getBinaryNodeChildren = (node, childTag) => {
    if (Array.isArray(node?.content)) {
        return node.content.filter(item => item.tag === childTag)
    }
    return []
}

const getAllBinaryNodeChildren = ({ content }) => {
    if (Array.isArray(content)) {
        return content
    }
    return []
}

const getBinaryNodeChild = (node, childTag) => {
    if (Array.isArray(node?.content)) {
        return node?.content.find(item => item.tag === childTag)
    }
}

const getBinaryNodeChildBuffer = (node, childTag) => {
    const child = getBinaryNodeChild(node, childTag)?.content
    if (Buffer.isBuffer(child) || child instanceof Uint8Array) {
        return child
    }
}

const getBinaryNodeChildString = (node, childTag) => {
    const child = getBinaryNodeChild(node, childTag)?.content
    if (Buffer.isBuffer(child) || child instanceof Uint8Array) {
        return Buffer.from(child).toString('utf-8')
    }
    else if (typeof child === 'string') {
        return child
    }
}

const getBinaryNodeChildUInt = (node, childTag, length) => {
    const buff = getBinaryNodeChildBuffer(node, childTag)
    if (buff) {
        return bufferToUInt(buff, length)
    }
}

const assertNodeErrorFree = (node) => {
    const errNode = getBinaryNodeChild(node, 'error')
    if (errNode) {
        throw new Boom(errNode.attrs.text || 'Unknown error', { data: +errNode.attrs.code })
    }
}

const reduceBinaryNodeToDictionary = (node, tag) => {
    const nodes = getBinaryNodeChildren(node, tag)
    const dict = nodes.reduce((dict, { attrs }) => {
        dict[attrs.name || attrs.config_code] = attrs.value || attrs.config_value
        return dict
    }, {})
    return dict
}

const getBinaryNodeMessages = ({ content }) => {
    const msgs = []
    if (Array.isArray(content)) {
        for (const item of content) {
            if (item.tag === 'message') {
                msgs.push(proto.WebMessageInfo.decode(item.content))
            }
        }
    }
    return msgs
}

const getBinaryFilteredButtons = (nodeContent) => {
	if (!Array.isArray(nodeContent)) return false

    return nodeContent.some(a =>
        ['native_flow'].includes(a?.content?.[0]?.content?.[0]?.tag) ||
        ['interactive', 'buttons', 'list'].includes(a?.content?.[0]?.tag) ||
        ['hsm', 'biz'].includes(a?.tag)
    )
}

const getBinaryFilteredBizBot = (nodeContent) => {
    if (!Array.isArray(nodeContent)) return false 

    return nodeContent.some(b => 
        ['bot'].includes(b?.tag) && b?.attrs?.biz_bot === '1'
    ) 
}

function bufferToUInt(e, t) {
    let a = 0
    for (let i = 0; i < t; i++) {
        a = 256 * a + e[i]
    }
    return a
}
const tabs = (n) => '\t'.repeat(n)
function binaryNodeToString(node, i = 0) {
    if (!node) {
        return node
    }
    if (typeof node === 'string') {
        return tabs(i) + node
    }
    if (node instanceof Uint8Array) {
        return tabs(i) + Buffer.from(node).toString('hex')
    }
    if (Array.isArray(node)) {
        return node.map((x) => tabs(i + 1) + binaryNodeToString(x, i + 1)).join('\n')
    }
    const children = binaryNodeToString(node.content, i + 1)
    const tag = `<${node.tag} ${Object.entries(node.attrs || {})
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}='${v}'`)
        .join(' ')}`
    const content = children ? `>\n${children}\n${tabs(i)}</${node.tag}>` : '/>'
    return tag + content
}

module.exports = {
  getBinaryNodeChildren, 
  getAllBinaryNodeChildren, 
  getBinaryNodeChild, 
  getBinaryNodeChildBuffer, 
  getBinaryNodeChildString, 
  getBinaryNodeChildUInt, 
  assertNodeErrorFree, 
  reduceBinaryNodeToDictionary, 
  getBinaryNodeMessages, 
  getBinaryFilteredButtons, 
  getBinaryFilteredBizBot, 
  binaryNodeToString
}
return module.exports;
})();
for (const key of Object.keys(__kageModule84)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule84[key]});
}

// Kage: funciones avanzadas.
const __kageModule193 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBizBinaryNode = exports.getBinaryNodeMessages = exports.reduceBinaryNodeToDictionary = exports.assertNodeErrorFree = exports.getBinaryNodeChildUInt = exports.getBinaryNodeChildString = exports.getBinaryNodeChildBuffer = exports.getAllBinaryNodeChildren = exports.getBinaryNodeChild = exports.getBinaryNodeChildren = void 0;
exports.binaryNodeToString = binaryNodeToString;
const node_crypto_1 = require("node:crypto");
const index_js_1 = require("../Addon/index.js");
const index_js_2 = require("../../WAProto/index.js");
// some extra useful utilities
const indexCache = new WeakMap();
const getBinaryNodeChildren = (node, childTag) => {
    if (!node || !Array.isArray(node.content))
        return [];
    let index = indexCache.get(node);
    // Build the index once per node
    if (!index) {
        index = new Map();
        for (const child of node.content) {
            let arr = index.get(child.tag);
            if (!arr)
                index.set(child.tag, (arr = []));
            arr.push(child);
        }
        indexCache.set(node, index);
    }
    // Return first matching child
    return index.get(childTag) || [];
};
exports.getBinaryNodeChildren = getBinaryNodeChildren;
const getBinaryNodeChild = (node, childTag) => {
    return (0, exports.getBinaryNodeChildren)(node, childTag)[0];
};
exports.getBinaryNodeChild = getBinaryNodeChild;
const getAllBinaryNodeChildren = ({ content }) => {
    if (Array.isArray(content)) {
        return content;
    }
    return [];
};
exports.getAllBinaryNodeChildren = getAllBinaryNodeChildren;
const getBinaryNodeChildBuffer = (node, childTag) => {
    const child = (0, exports.getBinaryNodeChild)(node, childTag)?.content;
    if (Buffer.isBuffer(child) || child instanceof Uint8Array) {
        return child;
    }
};
exports.getBinaryNodeChildBuffer = getBinaryNodeChildBuffer;
const getBinaryNodeChildString = (node, childTag) => {
    const child = (0, exports.getBinaryNodeChild)(node, childTag)?.content;
    if (Buffer.isBuffer(child) || child instanceof Uint8Array) {
        return Buffer.from(child).toString('utf-8');
    }
    else if (typeof child === 'string') {
        return child;
    }
};
exports.getBinaryNodeChildString = getBinaryNodeChildString;
const getBinaryNodeChildUInt = (node, childTag, length) => {
    const buff = (0, exports.getBinaryNodeChildBuffer)(node, childTag);
    if (buff) {
        return bufferToUInt(buff, length);
    }
};
exports.getBinaryNodeChildUInt = getBinaryNodeChildUInt;
const assertNodeErrorFree = (node) => {
    const errNode = (0, exports.getBinaryNodeChild)(node, 'error');
    if (errNode) {
        throw new index_js_1.HttpError(errNode.attrs.text || 'Unknown error', { data: +errNode.attrs.code });
    }
};
exports.assertNodeErrorFree = assertNodeErrorFree;
const reduceBinaryNodeToDictionary = (node, tag) => {
    const nodes = (0, exports.getBinaryNodeChildren)(node, tag);
    const dict = nodes.reduce((dict, { attrs }) => {
        if (typeof attrs.name === 'string') {
            dict[attrs.name] = attrs.value || attrs.config_value;
        }
        else {
            dict[attrs.config_code] = attrs.value || attrs.config_value;
        }
        return dict;
    }, {});
    return dict;
};
exports.reduceBinaryNodeToDictionary = reduceBinaryNodeToDictionary;
const getBinaryNodeMessages = ({ content }) => {
    const msgs = [];
    if (Array.isArray(content)) {
        for (const item of content) {
            if (item.tag === 'message') {
                msgs.push(index_js_2.proto.WebMessageInfo.decode(item.content).toJSON());
            }
        }
    }
    return msgs;
};
exports.getBinaryNodeMessages = getBinaryNodeMessages;
function bufferToUInt(e, t) {
    let a = 0;
    for (let i = 0; i < t; i++) {
        a = 256 * a + e[i];
    }
    return a;
}
const tabs = (n) => '\t'.repeat(n);
function binaryNodeToString(node, i = 0) {
    if (!node) {
        return node;
    }
    if (typeof node === 'string') {
        return tabs(i) + node;
    }
    if (node instanceof Uint8Array) {
        return tabs(i) + Buffer.from(node).toString('hex');
    }
    if (Array.isArray(node)) {
        return node.map(x => tabs(i + 1) + binaryNodeToString(x, i + 1)).join('\n');
    }
    const children = binaryNodeToString(node.content, i + 1);
    const tag = `<${node.tag} ${Object.entries(node.attrs || {})
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${k}='${v}'`)
        .join(' ')}`;
    const content = children ? `>\n${children}\n${tabs(i)}</${node.tag}>` : '/>';
    return tag + content;
}
/**
 * Kage: actualización de compatibilidad.
 * ---
 * Produce the binary node (WABinary-like JSON shape) required for the specific
 * interactive button / list type.
 * compatible with observed official client traffic.
 *
 * NOTE: Returning different "v" (version) and "name" values influences how
 * WhatsApp renders & validates flows. The constants here are empirically derived.
 *
 * @param {object} message Normalized message content (after Baileys normalization).
 * @returns {object} A node with shape { tag, attrs, [content] } to inject into additionalNodes.
 */
const FLOWS_MAP = {
    mpm: true,
    cta_catalog: true,
    send_location: true,
    call_permission_request: true,
    wa_payment_transaction_details: true,
    automated_greeting_message_view_catalog: true
};
const DECISION_SOURCE_CONTENT = [
    {
        tag: 'decision_source',
        attrs: { value: 'df' }
    }
];
const LIST_TYPE_CONTENT = {
    tag: 'list',
    attrs: { v: '2', type: 'product_list' }
};
const NATIVE_FLOW_ATTRIBUTE = { type: 'native_flow', v: '1' };
const MIXED_NATIVE_FLOW = {
    tag: 'interactive',
    attrs: NATIVE_FLOW_ATTRIBUTE,
    content: [
        {
            tag: 'native_flow',
            attrs: { v: '9', name: 'mixed' }
        }
    ]
};
const getBizBinaryNode = (message) => {
    const flowMsg = message.interactiveMessage?.nativeFlowMessage;
    const firstButtonName = flowMsg?.buttons?.[0]?.name;
    const qualityContent = {
        tag: 'quality_control',
        attrs: {
            decision_id: (0, node_crypto_1.randomBytes)(20).toString('hex'),
            source_type: 'third_party'
        },
        content: DECISION_SOURCE_CONTENT
    };
    const bizAttributes = {
        actual_actors: '2',
        host_storage: '2',
        privacy_mode_ts: `${Date.now() / 1000 | 0}`
    };
    if (firstButtonName === 'review_and_pay' || firstButtonName === 'payment_info') {
        bizAttributes.native_flow_name = firstButtonName === 'review_and_pay' ?
            'order_details' :
            firstButtonName;
        return {
            tag: 'biz',
            attrs: bizAttributes,
            content: [qualityContent]
        };
    }
    if (firstButtonName && FLOWS_MAP[firstButtonName]) {
        return {
            tag: 'biz',
            attrs: bizAttributes,
            content: [
                {
                    tag: 'interactive',
                    attrs: NATIVE_FLOW_ATTRIBUTE,
                    content: [
                        {
                            tag: 'native_flow',
                            attrs: { v: '2', name: firstButtonName }
                        }
                    ]
                },
                qualityContent
            ]
        };
    }
    if (flowMsg || message.buttonsMessage || message.templateMessage) {
        return {
            tag: 'biz',
            attrs: bizAttributes,
            content: [
                MIXED_NATIVE_FLOW,
                qualityContent
            ]
        };
    }
    if (message.listMessage) {
        return {
            tag: 'biz',
            attrs: bizAttributes,
            content: [
                LIST_TYPE_CONTENT,
                qualityContent
            ]
        };
    }
    return {
        tag: 'biz',
        attrs: bizAttributes,
        content: [qualityContent]
    };
};
exports.getBizBinaryNode = getBizBinaryNode;

return module.exports;
})();
for (const key of Object.keys(__kageModule193)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule193[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule193, configurable:true});
