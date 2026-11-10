"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }var _nodecache = require('@cacheable/node-cache'); var _nodecache2 = _interopRequireDefault(_nodecache);
var _indexjs = require('../WABinary/index.js');
var _genericsjs = require('./generics.js');
 async function handleIdentityChange(node, ctx) {
    const from = node.attrs.from;
    if (!from) {
        return { action: 'invalid_notification' };
    }
    const identityNode = _indexjs.getBinaryNodeChild.call(void 0, node, 'identity');
    if (!identityNode) {
        return { action: 'no_identity_node' };
    }
    ctx.logger.info({ jid: from }, 'identity changed');
    const decoded = _indexjs.jidDecode.call(void 0, from);
    if (_optionalChain([decoded, 'optionalAccess', _ => _.device]) && decoded.device !== 0) {
        ctx.logger.debug({ jid: from, device: decoded.device }, 'ignoring identity change from companion device');
        return { action: 'skipped_companion_device', device: decoded.device };
    }
    const isSelfPrimary = ctx.meId && (_indexjs.areJidsSameUser.call(void 0, from, ctx.meId) || (ctx.meLid && _indexjs.areJidsSameUser.call(void 0, from, ctx.meLid)));
    if (isSelfPrimary) {
        ctx.logger.info({ jid: from }, 'self primary identity changed');
        return { action: 'skipped_self_primary' };
    }
    if (ctx.debounceCache.get(from)) {
        ctx.logger.debug({ jid: from }, 'skipping identity assert (debounced)');
        return { action: 'debounced' };
    }
    ctx.debounceCache.set(from, true);
    const isOfflineNotification = !_genericsjs.isStringNullOrEmpty.call(void 0, node.attrs.offline);
    const hasExistingSession = await ctx.validateSession(from);
    if (!hasExistingSession.exists) {
        ctx.logger.debug({ jid: from }, 'no old session, skipping session refresh');
        return { action: 'skipped_no_session' };
    }
    ctx.logger.debug({ jid: from }, 'old session exists, will refresh session');
    if (isOfflineNotification) {
        ctx.logger.debug({ jid: from }, 'skipping session refresh during offline processing');
        return { action: 'skipped_offline' };
    }
    try {
        await ctx.assertSessions([from], true);
        return { action: 'session_refreshed' };
    }
    catch (error) {
        ctx.logger.warn({ error, jid: from }, 'failed to assert sessions after identity change');
        return { action: 'session_refresh_failed', error };
    }
} exports.handleIdentityChange = handleIdentityChange;
//# 
// Kage: funciones avanzadas.
const __kageModule171 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleIdentityChange = handleIdentityChange;
const index_js_1 = require("../WABinary/index.js");
const generics_js_1 = require("./generics.js");
async function handleIdentityChange(node, ctx) {
    const from = node.attrs.from;
    if (!from) {
        return { action: 'invalid_notification' };
    }
    const identityNode = (0, index_js_1.getBinaryNodeChild)(node, 'identity');
    if (!identityNode) {
        return { action: 'no_identity_node' };
    }
    ctx.logger.info({ jid: from }, 'identity changed');
    const decoded = (0, index_js_1.jidDecode)(from);
    if (decoded?.device && decoded.device !== 0) {
        ctx.logger.debug({ jid: from, device: decoded.device }, 'ignoring identity change from companion device');
        return { action: 'skipped_companion_device', device: decoded.device };
    }
    const isSelfPrimary = ctx.meId && ((0, index_js_1.areJidsSameUser)(from, ctx.meId) || (ctx.meLid && (0, index_js_1.areJidsSameUser)(from, ctx.meLid)));
    if (isSelfPrimary) {
        ctx.logger.info({ jid: from }, 'self primary identity changed');
        return { action: 'skipped_self_primary' };
    }
    if (ctx.debounceCache.get(from)) {
        ctx.logger.debug({ jid: from }, 'skipping identity assert (debounced)');
        return { action: 'debounced' };
    }
    ctx.debounceCache.set(from, true);
    const isOfflineNotification = !(0, generics_js_1.isStringNullOrEmpty)(node.attrs.offline);
    const hasExistingSession = await ctx.validateSession(from);
    if (!hasExistingSession.exists) {
        ctx.logger.debug({ jid: from }, 'no old session, skipping session refresh');
        return { action: 'skipped_no_session' };
    }
    ctx.logger.debug({ jid: from }, 'old session exists, will refresh session');
    if (isOfflineNotification) {
        ctx.logger.debug({ jid: from }, 'skipping session refresh during offline processing');
        return { action: 'skipped_offline' };
    }
    ctx.onBeforeSessionRefresh?.(from);
    try {
        await ctx.assertSessions([from], true);
        return { action: 'session_refreshed' };
    }
    catch (error) {
        ctx.logger.warn({ error, jid: from }, 'failed to assert sessions after identity change');
        return { action: 'session_refresh_failed', error };
    }
}

return module.exports;
})();
for (const key of Object.keys(__kageModule171)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule171[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule171, configurable:true});
