"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }var _boom = require('@hapi/boom');
var _indexjs = require('../WABinary/index.js');
const wMexQuery = (variables, queryId, query, generateMessageTag) => {
    return query({
        tag: 'iq',
        attrs: {
            id: generateMessageTag(),
            type: 'get',
            to: _indexjs.S_WHATSAPP_NET,
            xmlns: 'w:mex'
        },
        content: [
            {
                tag: 'query',
                attrs: { query_id: queryId },
                content: Buffer.from(JSON.stringify({ variables }), 'utf-8')
            }
        ]
    });
};
 const executeWMexQuery = async (variables, queryId, dataPath, query, generateMessageTag) => {
    const result = await wMexQuery(variables, queryId, query, generateMessageTag);
    const child = _indexjs.getBinaryNodeChild.call(void 0, result, 'result');
    if (_optionalChain([child, 'optionalAccess', _ => _.content])) {
        const data = JSON.parse(child.content.toString());
        if (data.errors && data.errors.length > 0) {
            const errorMessages = data.errors.map((err) => err.message || 'Unknown error').join(', ');
            const firstError = data.errors[0];
            const errorCode = _optionalChain([firstError, 'access', _2 => _2.extensions, 'optionalAccess', _3 => _3.error_code]) || 400;
            throw new (0, _boom.Boom)(`GraphQL server error: ${errorMessages}`, { statusCode: errorCode, data: firstError });
        }
        let response = dataPath ? _optionalChain([data, 'optionalAccess', _4 => _4.data, 'optionalAccess', _5 => _5[dataPath]]) : _optionalChain([data, 'optionalAccess', _6 => _6.data]);
        if (typeof response === 'undefined' && dataPath && _optionalChain([data, 'optionalAccess', _7 => _7.data])) {
            const keys = Object.keys(data.data);
            if (keys.length === 1) {
                response = data.data[keys[0]];
            }
        }
        if (typeof response !== 'undefined') {
            return response;
        }
    }
    const action = (dataPath || '').startsWith('xwa2_')
        ? dataPath.substring(5).replace(/_/g, ' ')
        : _optionalChain([dataPath, 'optionalAccess', _8 => _8.replace, 'call', _9 => _9(/_/g, ' ')]);
    throw new (0, _boom.Boom)(`Failed to ${action}, unexpected response structure: ${JSON.stringify(result, null, 2)}`, { statusCode: 400, data: result });
}; exports.executeWMexQuery = executeWMexQuery;
 
 
const __kageModule31 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { Boom } = require("@hapi/boom") 
const {
  getBinaryNodeChild, 
  S_WHATSAPP_NET
} = require("../WABinary")

const wMexQuery = (variables, queryId, query, generateMessageTag) => {
    return query({
        tag: 'iq',
        attrs: {
            id: generateMessageTag(),
            type: 'get',
            to: S_WHATSAPP_NET,
            xmlns: 'w:mex'
        },
        content: [
            {
                tag: 'query',
                attrs: { query_id: queryId },
                content: Buffer.from(JSON.stringify({ variables }), 'utf-8')
            }
        ]
    })
}

const executeWMexQuery = async (variables, queryId, dataPath, query, generateMessageTag) => {
    const result = await wMexQuery(variables, queryId, query, generateMessageTag)
    const child = getBinaryNodeChild(result, 'result')
    
    if (child?.content) {
        const data = JSON.parse(child.content.toString())
        
        if (data.errors && data.errors.length > 0) {
            const errorMessages = data.errors.map((err) => err.message || 'Unknown error').join(', ')
            const firstError = data.errors[0]
            const errorCode = firstError.extensions?.error_code || 400
            
            throw new Boom(`GraphQL server error: ${errorMessages}`, { statusCode: errorCode, data: firstError })
        }
        
        const response = dataPath ? data?.data?.[dataPath] : data?.data
        
        if (typeof response !== 'undefined') {
            return response
        }
    }
    
    const action = (dataPath || '').startsWith('xwa2_')
        ? dataPath.substring(5).replace(/_/g, ' ')
        : dataPath?.replace(/_/g, ' ')
        
    throw new Boom(`Failed to ${action}, unexpected response structure.`, { statusCode: 400, data: result })
}

module.exports = {
  executeWMexQuery
}
return module.exports;
})();
for (const key of Object.keys(__kageModule31)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule31[key]});
}

 
const __kageModule137 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeWMexQuery = void 0;
const index_js_1 = require("../Addon/index.js");
const index_js_2 = require("../WABinary/index.js");
const wMexQuery = (variables, queryId, query, generateMessageTag) => {
    return query({
        tag: 'iq',
        attrs: {
            id: generateMessageTag(),
            type: 'get',
            to: index_js_2.S_WHATSAPP_NET,
            xmlns: 'w:mex'
        },
        content: [
            {
                tag: 'query',
                attrs: { query_id: queryId },
                content: Buffer.from(JSON.stringify({ variables }), 'utf-8')
            }
        ]
    });
};
const executeWMexQuery = async (variables, queryId, dataPath, query, generateMessageTag) => {
    const result = await wMexQuery(variables, queryId, query, generateMessageTag);
    const child = (0, index_js_2.getBinaryNodeChild)(result, 'result');
    if (child?.content) {
        const data = JSON.parse(child.content.toString());
        if (data.errors && data.errors.length > 0) {
            const errorMessages = data.errors.map((err) => err.message || 'Unknown error').join(', ');
            const firstError = data.errors[0];
            const errorCode = firstError.extensions?.error_code || 400;
            throw new index_js_1.HttpError(`GraphQL server error: ${errorMessages}`, { statusCode: errorCode, data: firstError });
        }
        const response = dataPath ? data?.data?.[dataPath] : data?.data;
        if (typeof response !== 'undefined') {
            return response;
        }
    }
    const action = (dataPath || '').startsWith('xwa2_')
        ? dataPath.substring(5).replace(/_/g, ' ')
        : dataPath?.replace(/_/g, ' ');
    throw new index_js_1.HttpError(`Failed to ${action}, unexpected response structure.`, { statusCode: 400, data: result });
};
exports.executeWMexQuery = executeWMexQuery;

return module.exports;
})();
for (const key of Object.keys(__kageModule137)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule137[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule137, configurable:true});
