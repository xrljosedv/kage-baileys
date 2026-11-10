"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageRetryManager = exports.RetryReason = void 0;

const lru_cache_1 = require("lru-cache");

const RECENT_MESSAGES_SIZE = 1000;
const MESSAGE_KEY_SEPARATOR = '\u0000';
const RECREATE_SESSION_TIMEOUT = 60 * 60 * 1000;

var RetryReason;
(function (RetryReason) {
    RetryReason[RetryReason["UnknownError"] = 0] = "UnknownError";
    RetryReason[RetryReason["SignalErrorNoSession"] = 1] = "SignalErrorNoSession";
    RetryReason[RetryReason["SignalErrorInvalidKey"] = 2] = "SignalErrorInvalidKey";
    RetryReason[RetryReason["SignalErrorInvalidKeyId"] = 3] = "SignalErrorInvalidKeyId";
    RetryReason[RetryReason["SignalErrorInvalidMessage"] = 4] = "SignalErrorInvalidMessage";
    RetryReason[RetryReason["SignalErrorInvalidSignature"] = 5] = "SignalErrorInvalidSignature";
    RetryReason[RetryReason["SignalErrorFutureMessage"] = 6] = "SignalErrorFutureMessage";
    RetryReason[RetryReason["SignalErrorBadMac"] = 7] = "SignalErrorBadMac";
    RetryReason[RetryReason["SignalErrorInvalidSession"] = 8] = "SignalErrorInvalidSession";
    RetryReason[RetryReason["SignalErrorInvalidMsgKey"] = 9] = "SignalErrorInvalidMsgKey";
    RetryReason[RetryReason["BadBroadcastEphemeralSetting"] = 10] = "BadBroadcastEphemeralSetting";
    RetryReason[RetryReason["UnknownCompanionNoPrekey"] = 11] = "UnknownCompanionNoPrekey";
    RetryReason[RetryReason["AdvFailure"] = 12] = "AdvFailure";
    RetryReason[RetryReason["StatusRevokeDelay"] = 13] = "StatusRevokeDelay";
})(RetryReason = exports.RetryReason || (exports.RetryReason = {}));

const MAC_ERROR_CODES = new Set([RetryReason.SignalErrorInvalidMessage, RetryReason.SignalErrorBadMac]);

class MessageRetryManager {
    constructor(logger, maxMsgRetryCount = 5) {
        this.logger = logger;
        this.maxMsgRetryCount = maxMsgRetryCount;
        this.messageKeyIndex = new Map();
        this.pendingPhoneRequests = {};
        this.statistics = {
            totalRetries: 0,
            successfulRetries: 0,
            failedRetries: 0,
            mediaRetries: 0,
            sessionRecreations: 0,
            phoneRequests: 0
        };
        this.recentMessagesMap = new lru_cache_1.LRUCache({
            max: RECENT_MESSAGES_SIZE,
            ttl: 5 * 60 * 1000,
            ttlAutopurge: true,
            dispose: (_value, key) => {
                const separatorIndex = key.lastIndexOf(MESSAGE_KEY_SEPARATOR);
                if (separatorIndex > -1) {
                    const messageId = key.slice(separatorIndex + MESSAGE_KEY_SEPARATOR.length);
                    this.messageKeyIndex.delete(messageId);
                }
            }
        });
        this.sessionRecreateHistory = new lru_cache_1.LRUCache({
            max: 10000,
            ttl: RECREATE_SESSION_TIMEOUT,
            ttlAutopurge: true
        });
        this.retryCounters = new lru_cache_1.LRUCache({
            max: 5000,
            ttl: 15 * 60 * 1000,
            ttlAutopurge: true
        });
        this.baseKeys = new lru_cache_1.LRUCache({
            max: 1024,
            ttl: 15 * 60 * 1000,
            ttlAutopurge: true
        });
    }

    addRecentMessage(key, message, content) {
        if (typeof key === 'string') { key = { to: key, id: message }; message = content; }
        const id = key.id;
        if (!id) return;
        const keyStr = this.keyToString(key);
        this.recentMessagesMap.set(keyStr, { message, timestamp: Date.now() });
        this.messageKeyIndex.set(id, keyStr);
    }

    getRecentMessage(key, id) {
        if (typeof key === 'string') key = { to: key, id };
        const keyStr = this.keyToString(key);
        return this.recentMessagesMap.get(keyStr);
    }

    shouldRecreateSession(jid, hasSession, errorCode) {
         
        if (typeof hasSession === 'number' && typeof errorCode === 'boolean') { hasSession = errorCode; errorCode = undefined; }
        if (!hasSession) {
            this.sessionRecreateHistory.set(jid, Date.now());
            this.statistics.sessionRecreations++;
            return { reason: 'no existing session', recreate: true };
        }
        if (errorCode !== undefined && MAC_ERROR_CODES.has(errorCode)) {
            this.sessionRecreateHistory.set(jid, Date.now());
            this.statistics.sessionRecreations++;
            this.logger.warn({ jid, errorCode: RetryReason[errorCode] }, 'MAC error detected, forcing immediate session recreation');
            return {
                reason: `MAC error (code ${errorCode}: ${RetryReason[errorCode]}), immediate session recreation`,
                recreate: true
            };
        }
        const now = Date.now();
        const prevTime = this.sessionRecreateHistory.get(jid);
        if (!prevTime || now - prevTime > RECREATE_SESSION_TIMEOUT) {
            this.sessionRecreateHistory.set(jid, now);
            this.statistics.sessionRecreations++;
            return { reason: 'session recreation timeout window expired', recreate: true };
        }
        return {
            reason: `session recreated recently at ${new Date(prevTime).toISOString()}, skipping`,
            recreate: false
        };
    }

    parseRetryErrorCode(errorAttr) {
        if (errorAttr === undefined || errorAttr === '') return undefined;
        const code = parseInt(errorAttr, 10);
        if (Number.isNaN(code)) return undefined;
        if (code >= RetryReason.UnknownError && code <= RetryReason.StatusRevokeDelay) return code;
        return RetryReason.UnknownError;
    }

    isMacError(errorCode) {
        return errorCode !== undefined && MAC_ERROR_CODES.has(errorCode);
    }

    incrementRetryCount(messageId) {
        this.retryCounters.set(messageId, (this.retryCounters.get(messageId) || 0) + 1);
        this.statistics.totalRetries++;
        return this.retryCounters.get(messageId);
    }

    getRetryCount(messageId) {
        return this.retryCounters.get(messageId) || 0;
    }

    hasExceededMaxRetries(messageId) {
        return this.getRetryCount(messageId) >= this.maxMsgRetryCount;
    }

    markRetrySuccess(messageId) {
        this.statistics.successfulRetries++;
        this.retryCounters.delete(messageId);
        this.cancelPendingPhoneRequest(messageId);
        this.removeRecentMessage(messageId);
    }

    markRetryFailed(messageId) {
        this.statistics.failedRetries++;
        this.retryCounters.delete(messageId);
        this.cancelPendingPhoneRequest(messageId);
        this.removeRecentMessage(messageId);
    }

    schedulePhoneRequest(messageId, callback, delayMs = 3000) {
        this.cancelPendingPhoneRequest(messageId);
        this.pendingPhoneRequests[messageId] = setTimeout(() => {
            delete this.pendingPhoneRequests[messageId];
            this.statistics.phoneRequests++;
            callback();
        }, delayMs);
    }

    cancelPendingPhoneRequest(messageId) {
        const timeout = this.pendingPhoneRequests[messageId];
        if (timeout) {
            clearTimeout(timeout);
            delete this.pendingPhoneRequests[messageId];
            this.logger.debug(`Cancelled pending phone request for message ${messageId}`);
        }
    }

    clear() {
        for (const cache of [this.recentMessagesMap, this.sessionRecreateHistory, this.retryCounters, this.baseKeys]) cache.clear();
        this.messageKeyIndex.clear();
        for (const id of Object.keys(this.pendingPhoneRequests)) this.cancelPendingPhoneRequest(id);
        for (const key of Object.keys(this.statistics)) this.statistics[key] = 0;
    }
    saveBaseKey(addr, msgId, baseKey) { this.baseKeys.set(addr + ':' + msgId, Buffer.from(baseKey)); }
    hasSameBaseKey(addr, msgId, baseKey) {
        const stored = this.baseKeys.get(addr + ':' + msgId);
        return !!stored && baseKey != null && Buffer.from(stored).equals(Buffer.from(baseKey));
    }
    deleteBaseKey(addr, msgId) { this.baseKeys.delete(addr + ':' + msgId); }
    keyToString(key) {
        return `${key.to}${MESSAGE_KEY_SEPARATOR}${key.id}`;
    }

    removeRecentMessage(messageId) {
        const keyStr = this.messageKeyIndex.get(messageId);
        if (!keyStr) return;
        this.recentMessagesMap.delete(keyStr);
        this.messageKeyIndex.delete(messageId);
    }
}

exports.MessageRetryManager = MessageRetryManager;

 
const __kageModule72 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { LRUCache } = require("lru-cache")

 
const RECENT_MESSAGES_SIZE = 512

const MESSAGE_KEY_SEPARATOR = '\u0000'

 
const RECREATE_SESSION_TIMEOUT = 60 * 60 * 1000  

const PHONE_REQUEST_DELAY = 3000

class MessageRetryManager {
    constructor(logger, maxMsgRetryCount) {
        this.logger = logger
        this.recentMessagesMap = new LRUCache({
            max: RECENT_MESSAGES_SIZE,
            ttl: 5 * 60 * 1000,
            ttlAutopurge: true,
            dispose: (_value, key) => {
                const separatorIndex = key.lastIndexOf(MESSAGE_KEY_SEPARATOR)
                if (separatorIndex > -1) {
                    const messageId = key.slice(separatorIndex + MESSAGE_KEY_SEPARATOR.length)
                    this.messageKeyIndex.delete(messageId)
                }
            }
        })
        this.messageKeyIndex = new Map()
        this.sessionRecreateHistory = new LRUCache({
            ttl: RECREATE_SESSION_TIMEOUT * 2,
            ttlAutopurge: true
        })
        this.retryCounters = new LRUCache({
            ttl: 15 * 60 * 1000,
            ttlAutopurge: true,
            updateAgeOnGet: true
        })  
        this.pendingPhoneRequests = {}
        this.maxMsgRetryCount = 5
        this.statistics = {
            totalRetries: 0,
            successfulRetries: 0,
            failedRetries: 0,
            mediaRetries: 0,
            sessionRecreations: 0,
            phoneRequests: 0
        }
        this.maxMsgRetryCount = maxMsgRetryCount
    }
    
     


    addRecentMessage(to, id, message) {
        const key = { to, id }
        const keyStr = this.keyToString(key)
        
         
        this.recentMessagesMap.set(keyStr, {
            message,
            timestamp: Date.now()
        })
        this.messageKeyIndex.set(id, keyStr)
        this.logger.debug(`Added message to retry cache: ${to}/${id}`)
    }
    
     


    getRecentMessage(to, id) {
        const key = { to, id }
        const keyStr = this.keyToString(key)
        
        return this.recentMessagesMap.get(keyStr)
    }
    
     


    shouldRecreateSession(jid, retryCount, hasSession) {
         
        if (!hasSession) {
            this.sessionRecreateHistory.set(jid, Date.now())
            this.statistics.sessionRecreations++
            return {
                reason: "we don't have a Signal session with them",
                recreate: true
            }
        }
        
         
        if (retryCount < 2) {
            return { reason: '', recreate: false }
        }
        
        const now = Date.now()
        const prevTime = this.sessionRecreateHistory.get(jid)
        
         
        if (!prevTime || now - prevTime > RECREATE_SESSION_TIMEOUT) {
            this.sessionRecreateHistory.set(jid, now)
            this.statistics.sessionRecreations++
            
            return {
                reason: 'retry count > 1 and over an hour since last recreation',
                recreate: true
            }
        }
        return { reason: '', recreate: false }
    }
    
     


    incrementRetryCount(messageId) {
        this.retryCounters.set(messageId, (this.retryCounters.get(messageId) || 0) + 1)
        this.statistics.totalRetries++
        
        return this.retryCounters.get(messageId)
    }
    
     


    getRetryCount(messageId) {
        return this.retryCounters.get(messageId) || 0
    }
    
     


    hasExceededMaxRetries(messageId) {
        return this.getRetryCount(messageId) >= this.maxMsgRetryCount
    }
    
     


    markRetrySuccess(messageId) {
        this.statistics.successfulRetries++
         
        this.retryCounters.delete(messageId)
        this.cancelPendingPhoneRequest(messageId)
        this.removeRecentMessage(messageId)
    }
    
     


    markRetryFailed(messageId) {
        this.statistics.failedRetries++
        this.retryCounters.delete(messageId)
        this.cancelPendingPhoneRequest(messageId)
        this.removeRecentMessage(messageId)
    }
    
     


    schedulePhoneRequest(messageId, callback, delay = PHONE_REQUEST_DELAY) {
         
        this.cancelPendingPhoneRequest(messageId)
        this.pendingPhoneRequests[messageId] = setTimeout(() => {
            delete this.pendingPhoneRequests[messageId]
            
            this.statistics.phoneRequests++
            
            callback()
        }, delay)
        this.logger.debug(`Scheduled phone request for message ${messageId} with ${delay}ms delay`);
    }
    
     


    cancelPendingPhoneRequest(messageId) {
        const timeout = this.pendingPhoneRequests[messageId]
        
        if (timeout) {
            clearTimeout(timeout)
            
            delete this.pendingPhoneRequests[messageId]
            
            this.logger.debug(`Cancelled pending phone request for message ${messageId}`)
        }
    }
    
    keyToString(key) {
        return `${key.to}${MESSAGE_KEY_SEPARATOR}${key.id}`
    }
    
    removeRecentMessage(messageId) {
        const keyStr = this.messageKeyIndex.get(messageId)
        
        if (!keyStr) return
        
        this.recentMessagesMap.delete(keyStr)
        this.messageKeyIndex.delete(messageId)
    }
}

module.exports = {
  MessageRetryManager
}
return module.exports;
})();
for (const key of Object.keys(__kageModule72)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule72[key]});
}

 
const __kageModule176 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageRetryManager = exports.RetryReason = void 0;
const index_js_1 = require("../Addon/index.js");
 
const RECENT_MESSAGES_SIZE = 1024;
const MESSAGE_KEY_SEPARATOR = '\u0000';
 
const RECREATE_SESSION_TIMEOUT = 60 * 60;  
const PHONE_REQUEST_DELAY = 3000;
(function (RetryReason) {
    RetryReason[RetryReason["UnknownError"] = 0] = "UnknownError";
    RetryReason[RetryReason["SignalErrorNoSession"] = 1] = "SignalErrorNoSession";
    RetryReason[RetryReason["SignalErrorInvalidKey"] = 2] = "SignalErrorInvalidKey";
    RetryReason[RetryReason["SignalErrorInvalidKeyId"] = 3] = "SignalErrorInvalidKeyId";
     
    RetryReason[RetryReason["SignalErrorInvalidMessage"] = 4] = "SignalErrorInvalidMessage";
    RetryReason[RetryReason["SignalErrorInvalidSignature"] = 5] = "SignalErrorInvalidSignature";
    RetryReason[RetryReason["SignalErrorFutureMessage"] = 6] = "SignalErrorFutureMessage";
     
    RetryReason[RetryReason["SignalErrorBadMac"] = 7] = "SignalErrorBadMac";
    RetryReason[RetryReason["SignalErrorInvalidSession"] = 8] = "SignalErrorInvalidSession";
    RetryReason[RetryReason["SignalErrorInvalidMsgKey"] = 9] = "SignalErrorInvalidMsgKey";
    RetryReason[RetryReason["BadBroadcastEphemeralSetting"] = 10] = "BadBroadcastEphemeralSetting";
    RetryReason[RetryReason["UnknownCompanionNoPrekey"] = 11] = "UnknownCompanionNoPrekey";
    RetryReason[RetryReason["AdvFailure"] = 12] = "AdvFailure";
    RetryReason[RetryReason["StatusRevokeDelay"] = 13] = "StatusRevokeDelay";
})(exports.RetryReason || (exports.RetryReason = {}));
 
const MAC_ERROR_CODES = new Set([exports.RetryReason.SignalErrorInvalidMessage, exports.RetryReason.SignalErrorBadMac]);
class MessageRetryManager {
    constructor(logger, maxMsgRetryCount) {
        this.logger = logger;
        this.recentMessagesMap = (0, index_js_1.createCache)({
            max: RECENT_MESSAGES_SIZE,
            ttl: 5 * 60,
            dispose: (_value, key) => {
                const separatorIndex = key.lastIndexOf(MESSAGE_KEY_SEPARATOR);
                if (separatorIndex > -1) {
                    const messageId = key.slice(separatorIndex + MESSAGE_KEY_SEPARATOR.length);
                    this.messageKeyIndex.delete(messageId);
                }
            }
        });
        this.messageKeyIndex = new Map();
        this.sessionRecreateHistory = (0, index_js_1.createCache)({
            ttl: RECREATE_SESSION_TIMEOUT * 2
        });
        this.retryCounters = (0, index_js_1.createCache)({
            ttl: 15 * 60
        });  
        this.baseKeys = (0, index_js_1.createCache)({
            max: 1024,
            ttl: 15 * 60
        });
        this.pendingPhoneRequests = {};
        this.maxMsgRetryCount = 5;
        this.statistics = {
            totalRetries: 0,
            successfulRetries: 0,
            failedRetries: 0,
            mediaRetries: 0,
            sessionRecreations: 0,
            phoneRequests: 0
        };
        this.maxMsgRetryCount = maxMsgRetryCount;
    }
     


    addRecentMessage(to, id, message) {
        const key = { to, id };
        const keyStr = this.keyToString(key);
         
        this.recentMessagesMap.set(keyStr, {
            message,
            timestamp: Date.now()
        });
        this.messageKeyIndex.set(id, keyStr);
        this.logger.debug(`Added message to retry cache: ${to}/${id}`);
    }
     


    getRecentMessage(to, id) {
        const key = { to, id };
        const keyStr = this.keyToString(key);
        return this.recentMessagesMap.get(keyStr);
    }
     



    shouldRecreateSession(jid, hasSession, errorCode) {
         
        if (!hasSession) {
            this.sessionRecreateHistory.set(jid, Date.now());
            this.statistics.sessionRecreations++;
            return {
                reason: "we don't have a Signal session with them",
                recreate: true
            };
        }
         
        if (errorCode !== undefined && MAC_ERROR_CODES.has(errorCode)) {
            this.sessionRecreateHistory.set(jid, Date.now());
            this.statistics.sessionRecreations++;
            this.logger.warn({ jid, errorCode: exports.RetryReason[errorCode] }, 'MAC error detected, forcing immediate session recreation');
            return {
                reason: `MAC error (code ${errorCode}: ${exports.RetryReason[errorCode]}), immediate session recreation`,
                recreate: true
            };
        }
        const now = Date.now();
        const prevTime = this.sessionRecreateHistory.get(jid);
         
        if (!prevTime || now - prevTime > RECREATE_SESSION_TIMEOUT) {
            this.sessionRecreateHistory.set(jid, now);
            this.statistics.sessionRecreations++;
            return {
                reason: 'retry count > 1 and over an hour since last recreation',
                recreate: true
            };
        }
        return { reason: '', recreate: false };
    }
     



    parseRetryErrorCode(errorAttr) {
        if (errorAttr === undefined || errorAttr === '') {
            return undefined;
        }
        const code = parseInt(errorAttr, 10);
        if (Number.isNaN(code)) {
            return undefined;
        }
         
        if (code >= exports.RetryReason.UnknownError && code <= exports.RetryReason.StatusRevokeDelay) {
            return code;
        }
        return exports.RetryReason.UnknownError;
    }
     


    isMacError(errorCode) {
        return errorCode !== undefined && MAC_ERROR_CODES.has(errorCode);
    }
     


    incrementRetryCount(messageId) {
        this.retryCounters.set(messageId, (this.retryCounters.get(messageId) || 0) + 1);
        this.statistics.totalRetries++;
        return this.retryCounters.get(messageId);
    }
     


    getRetryCount(messageId) {
        return this.retryCounters.get(messageId) || 0;
    }
     


    hasExceededMaxRetries(messageId) {
        return this.getRetryCount(messageId) >= this.maxMsgRetryCount;
    }
     


    markRetrySuccess(messageId) {
        this.statistics.successfulRetries++;
         
        this.retryCounters.delete(messageId);
        this.cancelPendingPhoneRequest(messageId);
        this.removeRecentMessage(messageId);
    }
     


    markRetryFailed(messageId) {
        this.statistics.failedRetries++;
        this.retryCounters.delete(messageId);
        this.cancelPendingPhoneRequest(messageId);
        this.removeRecentMessage(messageId);
    }
     


    schedulePhoneRequest(messageId, callback, delay = PHONE_REQUEST_DELAY) {
         
        this.cancelPendingPhoneRequest(messageId);
        this.pendingPhoneRequests[messageId] = setTimeout(() => {
            delete this.pendingPhoneRequests[messageId];
            this.statistics.phoneRequests++;
            callback();
        }, delay);
        this.logger.debug(`Scheduled phone request for message ${messageId} with ${delay}ms delay`);
    }
     


    cancelPendingPhoneRequest(messageId) {
        const timeout = this.pendingPhoneRequests[messageId];
        if (timeout) {
            clearTimeout(timeout);
            delete this.pendingPhoneRequests[messageId];
            this.logger.debug(`Cancelled pending phone request for message ${messageId}`);
        }
    }
    clear() {
        this.recentMessagesMap.flushAll();
        this.messageKeyIndex.clear();
        this.sessionRecreateHistory.flushAll();
        this.retryCounters.flushAll();
        this.baseKeys.flushAll();
        for (const messageId of Object.keys(this.pendingPhoneRequests)) {
            this.cancelPendingPhoneRequest(messageId);
        }
        this.statistics = {
            totalRetries: 0,
            successfulRetries: 0,
            failedRetries: 0,
            mediaRetries: 0,
            sessionRecreations: 0,
            phoneRequests: 0
        };
    }
    saveBaseKey(addr, msgId, baseKey) {
        this.baseKeys.set(`${addr}:${msgId}`, baseKey);
    }
    hasSameBaseKey(addr, msgId, baseKey) {
        const stored = this.baseKeys.get(`${addr}:${msgId}`);
        if (!stored || stored.length !== baseKey.length) {
            return false;
        }
        for (let i = 0; i < stored.length; i++) {
            if (stored[i] !== baseKey[i])
                return false;
        }
        return true;
    }
    deleteBaseKey(addr, msgId) {
        this.baseKeys.delete(`${addr}:${msgId}`);
    }
    keyToString(key) {
        return `${key.to}${MESSAGE_KEY_SEPARATOR}${key.id}`;
    }
    removeRecentMessage(messageId) {
        const keyStr = this.messageKeyIndex.get(messageId);
        if (!keyStr) {
            return;
        }
        this.recentMessagesMap.delete(keyStr);
        this.messageKeyIndex.delete(messageId);
    }
}
exports.MessageRetryManager = MessageRetryManager;

return module.exports;
})();
for (const key of Object.keys(__kageModule176)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule176[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule176, configurable:true});
