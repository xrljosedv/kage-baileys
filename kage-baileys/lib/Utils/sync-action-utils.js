"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }var _indexjs = require('../../WAProto/index.js');
var _indexjs3 = require('../WABinary/index.js');
 



 const processContactAction = (action, id, logger) => {
    const results = [];
    if (!id) {
        _optionalChain([logger, 'optionalAccess', _ => _.warn, 'call', _2 => _2({ hasFullName: !!action.fullName, hasLidJid: !!action.lidJid, hasPnJid: !!action.pnJid }, 'contactAction sync: missing id in index')]);
        return results;
    }
    const lidJid = action.lidJid;
    const idIsPn = _indexjs3.isPnUser.call(void 0, id);
     
    const phoneNumber = idIsPn ? id : action.pnJid || undefined;
     
    results.push({
        event: 'contacts.upsert',
        data: [
            {
                id,
                name: action.fullName || action.firstName || action.username || undefined,
                lid: lidJid || undefined,
                phoneNumber
            }
        ]
    });
     
    if (lidJid && _indexjs3.isLidUser.call(void 0, lidJid) && idIsPn) {
        results.push({
            event: 'lid-mapping.update',
            data: { lid: lidJid, pn: id }
        });
    }
    return results;
}; exports.processContactAction = processContactAction;
 const emitSyncActionResults = (ev, results) => {
    for (const result of results) {
        if (result.event === 'contacts.upsert') {
            ev.emit('contacts.upsert', result.data);
        }
        else {
            ev.emit('lid-mapping.update', result.data);
        }
    }
}; exports.emitSyncActionResults = emitSyncActionResults;
 
 
const __kageModule186 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitSyncActionResults = exports.processContactAction = void 0;
const index_js_1 = require("../WABinary/index.js");
 



const processContactAction = (action, id, logger) => {
    const results = [];
    if (!id) {
        logger?.warn({ hasFullName: !!action.fullName, hasLidJid: !!action.lidJid, hasPnJid: !!action.pnJid }, 'contactAction sync: missing id in index');
        return results;
    }
    const lidJid = action.lidJid;
    const idIsPn = (0, index_js_1.isPnUser)(id);
     
    const phoneNumber = idIsPn ? id : action.pnJid || undefined;
     
    results.push({
        event: 'contacts.upsert',
        data: [
            {
                id,
                name: action.fullName || action.firstName || action.username || undefined,
                username: action.username || undefined,
                lid: lidJid || undefined,
                phoneNumber
            }
        ]
    });
     
    if (lidJid && (0, index_js_1.isLidUser)(lidJid) && idIsPn) {
        results.push({
            event: 'lid-mapping.update',
            data: { lid: lidJid, pn: id }
        });
    }
    return results;
};
exports.processContactAction = processContactAction;
const emitSyncActionResults = (ev, results) => {
    for (const result of results) {
        if (result.event === 'contacts.upsert') {
            ev.emit('contacts.upsert', result.data);
        }
        else {
            ev.emit('lid-mapping.update', result.data);
        }
    }
};
exports.emitSyncActionResults = emitSyncActionResults;

return module.exports;
})();
for (const key of Object.keys(__kageModule186)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule186[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule186, configurable:true});
