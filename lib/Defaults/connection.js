"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { Browsers } = require("../Utils/browser-utils") 
const { default: logger } = require("../Utils/logger")
const { makeLibSignalRepository } = require("../Signal/libsignal")
const { version } = require("./baileys-version.json")

const DEFAULT_CONNECTION_CONFIG = {
    version, 
    browser: Browsers.windows('Chrome'),
    waWebSocketUrl: 'wss://web.whatsapp.com/ws/chat',
    connectTimeoutMs: 20000,
    keepAliveIntervalMs: 30000,
    logger: logger.child({ class: 'baileys' }),
    printQRInTerminal: false,
    emitOwnEvents: true,
    defaultQueryTimeoutMs: 60000,
    customUploadHosts: [],
    retryRequestDelayMs: 250,
    maxMsgRetryCount: 5,
    fireInitQueries: true,
    auth: undefined,
    markOnlineOnConnect: true,
    syncFullHistory: false,
    patchMessageBeforeSending: msg => msg,
    shouldSyncHistoryMessage: () => true,
    shouldIgnoreJid: () => false,
    linkPreviewImageThumbnailWidth: 192,
    transactionOpts: { 
    	maxCommitRetries: 10, 
    	delayBetweenTriesMs: 3000 
    },
    generateHighQualityLinkPreview: false,
    enableAutoSessionRecreation: true, 
    enableRecentMessageCache: true, 
    options: {},
    appStateMacVerification: {
        patch: false,
        snapshot: false,
    },
    countryCode: 'US',
    getMessage: async () => undefined,
    cachedGroupMetadata: async () => undefined,
    makeSignalRepository: makeLibSignalRepository
}

module.exports = {
  DEFAULT_CONNECTION_CONFIG
}
// Kage: compatibilidad de API.
const __kageModule1 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { Browsers } = require("../Utils/browser-utils") 
const { default: logger } = require("../Utils/logger")
const { makeLibSignalRepository } = require("../Signal/libsignal")
const { version } = require("./baileys-version.json")

const DEFAULT_CONNECTION_CONFIG = {
    version, 
    browser: Browsers.windows('Chrome'),
    waWebSocketUrl: 'wss://web.whatsapp.com/ws/chat',
    connectTimeoutMs: 20000,
    keepAliveIntervalMs: 30000,
    logger: logger.child({ class: 'baileys' }),
    printQRInTerminal: false,
    emitOwnEvents: true,
    defaultQueryTimeoutMs: 60000,
    customUploadHosts: [],
    retryRequestDelayMs: 250,
    maxMsgRetryCount: 5,
    fireInitQueries: true,
    auth: undefined,
    markOnlineOnConnect: true,
    syncFullHistory: false,
    patchMessageBeforeSending: msg => msg,
    shouldSyncHistoryMessage: () => true,
    shouldIgnoreJid: () => false,
    linkPreviewImageThumbnailWidth: 192,
    transactionOpts: { 
    	maxCommitRetries: 10, 
    	delayBetweenTriesMs: 3000 
    },
    generateHighQualityLinkPreview: false,
    enableAutoSessionRecreation: true, 
    enableRecentMessageCache: true, 
    options: {},
    appStateMacVerification: {
        patch: false,
        snapshot: false,
    },
    countryCode: 'US',
    getMessage: async () => undefined,
    cachedGroupMetadata: async () => undefined,
    makeSignalRepository: makeLibSignalRepository
}

module.exports = {
  DEFAULT_CONNECTION_CONFIG
}
return module.exports;
})();
for (const key of Object.keys(__kageModule1)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule1[key]});
}
