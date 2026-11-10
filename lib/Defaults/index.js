"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CACHE_TTLS = exports.MIN_UPLOAD_INTERVAL = exports.UPLOAD_TIMEOUT = exports.INITIAL_PREKEY_COUNT = exports.MIN_PREKEY_COUNT = exports.MEDIA_KEYS = exports.MEDIA_HKDF_KEY_MAPPING = exports.MEDIA_PATH_MAP = exports.DEFAULT_CONNECTION_CONFIG = exports.PROCESSABLE_HISTORY_TYPES = exports.WA_CERT_DETAILS = exports.URL_REGEX = exports.NOISE_WA_HEADER = exports.KEY_BUNDLE_TYPE = exports.DICT_VERSION = exports.NOISE_MODE = exports.WA_DEFAULT_EPHEMERAL = exports.WA_ADV_HOSTED_DEVICE_SIG_PREFIX = exports.WA_ADV_HOSTED_ACCOUNT_SIG_PREFIX = exports.WA_ADV_DEVICE_SIG_PREFIX = exports.WA_ADV_ACCOUNT_SIG_PREFIX = exports.UNAUTHORIZED_CODES = exports.version = void 0;
const WAProto_1 = require("../../WAProto");
const libsignal_1 = require("../Signal/libsignal");
const browser_utils_1 = require("../Utils/browser-utils");
const logger_1 = __importDefault(require("../Utils/logger"));
exports.version = [2, 3000, 1043857760];
exports.UNAUTHORIZED_CODES = [401, 403, 419];
exports.DEFAULT_ORIGIN = 'https://web.whatsapp.com';
exports.CALL_VIDEO_PREFIX = 'https://call.whatsapp.com/video/';
exports.CALL_AUDIO_PREFIX = 'https://call.whatsapp.com/voice/';
exports.DEF_CALLBACK_PREFIX = 'CB:';
exports.DEF_TAG_PREFIX = 'TAG:';
exports.PHONE_CONNECTION_CB = 'CB:Pong';
exports.WA_ADV_ACCOUNT_SIG_PREFIX = Buffer.from([6, 0]);
exports.WA_ADV_DEVICE_SIG_PREFIX = Buffer.from([6, 1]);
exports.WA_ADV_HOSTED_ACCOUNT_SIG_PREFIX = Buffer.from([6, 5]);
exports.WA_ADV_HOSTED_DEVICE_SIG_PREFIX = Buffer.from([6, 6]);
exports.WA_DEFAULT_EPHEMERAL = 7 * 24 * 60 * 60;
exports.NOISE_MODE = 'Noise_XX_25519_AESGCM_SHA256\0\0\0\0';
exports.DICT_VERSION = 3;
exports.KEY_BUNDLE_TYPE = Buffer.from([5]);
exports.NOISE_WA_HEADER = Buffer.from([87, 65, 6, exports.DICT_VERSION]);
exports.URL_REGEX = /https:\/\/(?![^:@\/\s]+:[^:@\/\s]+@)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(:\d+)?(\/[^\s]*)?/g;
exports.WA_CERT_DETAILS = {
    SERIAL: 0
};
exports.PROCESSABLE_HISTORY_TYPES = [
    WAProto_1.proto.HistorySync.HistorySyncType.INITIAL_BOOTSTRAP,
    WAProto_1.proto.HistorySync.HistorySyncType.PUSH_NAME,
    WAProto_1.proto.HistorySync.HistorySyncType.RECENT,
    WAProto_1.proto.HistorySync.HistorySyncType.FULL,
    WAProto_1.proto.HistorySync.HistorySyncType.ON_DEMAND,
    WAProto_1.proto.HistorySync.HistorySyncType.NON_BLOCKING_DATA,
    WAProto_1.proto.HistorySync.HistorySyncType.INITIAL_STATUS_V3,
];
exports.DEFAULT_CONNECTION_CONFIG = {
    version: exports.version,
    browser: (0, browser_utils_1.Browsers)('Chrome'),
    waWebSocketUrl: 'wss://web.whatsapp.com/ws/chat',
    connectTimeoutMs: 20_000,
    keepAliveIntervalMs: 30_000,
    logger: logger_1.default.child({ class: 'baileys' }),
    emitOwnEvents: true,
    defaultQueryTimeoutMs: 60_000,
    customUploadHosts: [],
    retryRequestDelayMs: 250,
    maxMsgRetryCount: 5,
    fireInitQueries: true,
    auth: undefined,
    markOnlineOnConnect: true,
    syncFullHistory: true,
    // Existing 20s fallback remains the default; users may tune it explicitly.
    initialSyncTimeoutMs: 20_000,
    patchMessageBeforeSending: msg => msg,
    shouldSyncHistoryMessage: () => true,
    shouldIgnoreJid: () => false,
    linkPreviewImageThumbnailWidth: 192,
    // no forced delay between album items by default, to avoid slow perceived delivery
    albumMessageItemDelayMs: 0,
    transactionOpts: { maxCommitRetries: 10, delayBetweenTriesMs: 3000 },
    generateHighQualityLinkPreview: false,
    enableAutoSessionRecreation: true,
    enableRecentMessageCache: true,
    options: {},
    appStateMacVerification: {
        patch: false,
        snapshot: false
    },
    countryCode: 'US',
    getMessage: async () => undefined,
    cachedGroupMetadata: async () => undefined,
    makeSignalRepository: libsignal_1.makeLibSignalRepository
};
exports.MEDIA_PATH_MAP = {
    image: '/mms/image',
    video: '/mms/video',
    document: '/mms/document',
    audio: '/mms/audio',
    sticker: '/mms/image',
    'thumbnail-link': '/mms/image',
    'product-catalog-image': '/product/image',
    'md-app-state': '',
    'md-msg-hist': '/mms/md-app-state',
    'biz-cover-photo': '/pps/biz-cover-photo'
};
exports.MEDIA_HKDF_KEY_MAPPING = {
    audio: 'Audio',
    document: 'Document',
    gif: 'Video',
    image: 'Image',
    ppic: '',
    product: 'Image',
    ptt: 'Audio',
    sticker: 'Image',
    video: 'Video',
    'thumbnail-document': 'Document Thumbnail',
    'thumbnail-image': 'Image Thumbnail',
    'thumbnail-video': 'Video Thumbnail',
    'thumbnail-link': 'Link Thumbnail',
    'md-msg-hist': 'History',
    'md-app-state': 'App State',
    'product-catalog-image': '',
    'payment-bg-image': 'Payment Background',
    ptv: 'Video',
    'biz-cover-photo': 'Image'
};
exports.MEDIA_KEYS = Object.keys(exports.MEDIA_PATH_MAP);
exports.MIN_PREKEY_COUNT = 5;
exports.INITIAL_PREKEY_COUNT = 812;
exports.UPLOAD_TIMEOUT = 30000;
exports.MIN_UPLOAD_INTERVAL = 5000;
exports.DEFAULT_CACHE_TTLS = {
    SIGNAL_STORE: 5 * 60,
    MSG_RETRY: 60 * 60,
    CALL_OFFER: 5 * 60,
    USER_DEVICES: 5 * 60
};

// Kage: compatibilidad de API.
const __kageModule4 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

const __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k

    let desc = Object.getOwnPropertyDescriptor(m, k)

    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = {
          enumerable: true, 
          get: function() { 
              return m[k] 
          }
       }
    }

    Object.defineProperty(o, k2, desc) 

    }) : (function(o, m, k, k2) {
        if (k2 === undefined) k2 = k
        o[k2] = m[k]
    }
))

const __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) {
        if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) {
            __createBinding(exports, m, p)
       }
   }
}

Object.defineProperty(exports, "__esModule", { 
    value: true 
})

__exportStar(require("./connection"), exports)
__exportStar(require("./constants"), exports)
__exportStar(require("./history"), exports)
__exportStar(require("./media"), exports)
__exportStar(require("./prefix"), exports) 
return module.exports;
})();
for (const key of Object.keys(__kageModule4)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule4[key]});
}

// Kage: funciones avanzadas.
const __kageModule112 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TimeMs = exports.UPLOAD_TIMEOUT = exports.INITIAL_PREKEY_COUNT = exports.MIN_PREKEY_COUNT = exports.HISTORY_SYNC_PAUSED_TIMEOUT_MS = exports.MEDIA_KEYS = exports.MEDIA_HKDF_KEY_MAPPING = exports.NEWSLETTER_MEDIA_PATH_MAP = exports.MEDIA_PATH_MAP = exports.DEFAULT_CONNECTION_CONFIG = exports.DEFAULT_CACHE_TTLS = exports.PROCESSABLE_HISTORY_TYPES = exports.WA_CERT_DETAILS = exports.URL_REGEX = exports.LEXER_REGEX = exports.NOISE_WA_HEADER = exports.KEY_BUNDLE_TYPE = exports.DICT_VERSION = exports.NOISE_MODE = exports.PLACEHOLDER_MAX_AGE_SECONDS = exports.STATUS_EXPIRY_SECONDS = exports.WA_DEFAULT_EPHEMERAL = exports.WA_ADV_HOSTED_DEVICE_SIG_PREFIX = exports.WA_ADV_HOSTED_ACCOUNT_SIG_PREFIX = exports.WA_ADV_DEVICE_SIG_PREFIX = exports.WA_ADV_ACCOUNT_SIG_PREFIX = exports.PHONE_CONNECTION_CB = exports.DEF_TAG_PREFIX = exports.DEF_CALLBACK_PREFIX = exports.TEXT_DECODER = exports.TEXT_ENCODER = exports.LIBRARY_NAME = exports.DONATE_URL = exports.CALL_AUDIO_PREFIX = exports.CALL_VIDEO_PREFIX = exports.DEFAULT_ORIGIN = exports.BIZ_BOT_SUPPORT_PAYLOAD = exports.UNAUTHORIZED_CODES = void 0;
const index_js_1 = require("../../WAProto/index.js");
const libsignal_js_1 = require("../Signal/libsignal.js");
const browser_utils_js_1 = require("../Utils/browser-utils.js");
const logger_js_1 = __importDefault(require("../Utils/logger.js"));
const version = [2, 3000, 1051417111];
exports.UNAUTHORIZED_CODES = [401, 403, 419];
exports.BIZ_BOT_SUPPORT_PAYLOAD = '{"version":1,"is_ai_message":true,"should_upload_client_logs":false,"should_show_system_message":false,"ticket_id":"7004947587700716","citation_items":[],"ticket_locale":"us"}';
exports.DEFAULT_ORIGIN = 'https://web.whatsapp.com';
exports.CALL_VIDEO_PREFIX = 'https://call.whatsapp.com/video/';
exports.CALL_AUDIO_PREFIX = 'https://call.whatsapp.com/voice/';
exports.DONATE_URL = 'https://github.com/xrljosedv/kage-baileys'; // Kage: nota de compatibilidad.
exports.LIBRARY_NAME = 'kage-baileys';
exports.TEXT_ENCODER = new TextEncoder();
exports.TEXT_DECODER = new TextDecoder();
exports.DEF_CALLBACK_PREFIX = 'CB:';
exports.DEF_TAG_PREFIX = 'TAG:';
exports.PHONE_CONNECTION_CB = 'CB:Pong';
exports.WA_ADV_ACCOUNT_SIG_PREFIX = Buffer.from([6, 0]);
exports.WA_ADV_DEVICE_SIG_PREFIX = Buffer.from([6, 1]);
exports.WA_ADV_HOSTED_ACCOUNT_SIG_PREFIX = Buffer.from([6, 5]);
exports.WA_ADV_HOSTED_DEVICE_SIG_PREFIX = Buffer.from([6, 6]);
exports.WA_DEFAULT_EPHEMERAL = 7 * 24 * 60 * 60;
/** Status messages older than 24 hours are considered expired */
exports.STATUS_EXPIRY_SECONDS = 24 * 60 * 60;
/** WA Web enforces a 14-day maximum age for placeholder resend requests */
exports.PLACEHOLDER_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;
exports.NOISE_MODE = 'Noise_XX_25519_AESGCM_SHA256\0\0\0\0';
exports.DICT_VERSION = 3;
exports.KEY_BUNDLE_TYPE = Buffer.from([5]);
exports.NOISE_WA_HEADER = Buffer.from([87, 65, 6, exports.DICT_VERSION]); // last is "DICT_VERSION"
exports.LEXER_REGEX = /(\/\/.*|\/\*[\s\S]*?\*\/|#.*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`[\s\S]*?`)|(\b[a-zA-Z_]\w*\b)(?=\s*\()|(\b[a-zA-Z_]\w*\b)|(\b\d+(?:\.\d+)?\b)|(\s+|[^\w\s]+)/g;
/** from: https://stackoverflow.com/questions/3809401/what-is-a-good-regular-expression-to-match-a-url */
exports.URL_REGEX = /https:\/\/(?![^:@\/\s]+:[^:@\/\s]+@)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(:\d+)?(\/[^\s]*)?/g;
exports.WA_CERT_DETAILS = {
    SERIAL: 0,
    ISSUER: 'WhatsAppLongTerm1',
    PUBLIC_KEY: Buffer.from('142375574d0a587166aae71ebe516437c4a28b73e3695c6ce1f7f9545da8ee6b', 'hex')
};
exports.PROCESSABLE_HISTORY_TYPES = [
    index_js_1.proto.HistorySync.HistorySyncType.INITIAL_BOOTSTRAP,
    index_js_1.proto.HistorySync.HistorySyncType.PUSH_NAME,
    index_js_1.proto.HistorySync.HistorySyncType.RECENT,
    index_js_1.proto.HistorySync.HistorySyncType.FULL,
    index_js_1.proto.HistorySync.HistorySyncType.ON_DEMAND,
    index_js_1.proto.HistorySync.HistorySyncType.NON_BLOCKING_DATA,
    index_js_1.proto.HistorySync.HistorySyncType.INITIAL_STATUS_V3
];
exports.DEFAULT_CACHE_TTLS = {
    SIGNAL_STORE: 5 * 60, // 5 minutes
    MSG_RETRY: 60 * 60, // 1 hour
    CALL_OFFER: 5 * 60, // 5 minutes
    USER_DEVICES: 5 * 60 // 5 minutes
};
exports.DEFAULT_CONNECTION_CONFIG = {
    version: version,
    browser: browser_utils_js_1.Browsers.macOS('Chrome'),
    waWebSocketUrl: 'wss://web.whatsapp.com/ws/chat',
    connectTimeoutMs: 30000,
    keepAliveIntervalMs: 20000,
    logger: logger_js_1.default.child({ class: 'baileys' }),
    emitOwnEvents: true,
    defaultQueryTimeoutMs: 30000,
    customUploadHosts: [],
    retryRequestDelayMs: 750,
    maxMsgRetryCount: 3,
    fireInitQueries: true,
    auth: undefined,
    markOnlineOnConnect: true,
    syncFullHistory: true,
    patchMessageBeforeSending: msg => msg,
    shouldSyncHistoryMessage: ({ syncType }) => {
        return syncType !== index_js_1.proto.HistorySync.HistorySyncType.FULL;
    },
    shouldIgnoreJid: () => false,
    linkPreviewImageThumbnailWidth: 192,
    transactionOpts: { maxCommitRetries: 5, delayBetweenTriesMs: 1000 },
    generateHighQualityLinkPreview: true,
    enableAutoSessionRecreation: true,
    enableRecentMessageCache: true,
    options: {},
    appStateMacVerification: {
        patch: false,
        snapshot: false
    },
    countryCode: 'US',
    getMessage: async () => undefined,
    cachedGroupMetadata: async () => undefined,
    makeSignalRepository: libsignal_js_1.makeLibSignalRepository
};
exports.MEDIA_PATH_MAP = {
    image: '/mms/image',
    video: '/mms/video',
    document: '/mms/document',
    audio: '/mms/audio',
    sticker: '/mms/image',
    'sticker-pack': '/mms/sticker-pack',
    'thumbnail-sticker-pack': '/mms/thumbnail-sticker-pack',
    'thumbnail-link': '/mms/image',
    'thumbnail-image': '/mms/image',
    'thumbnail-video': '/mms/video',
    'thumbnail-document': '/mms/document',
    'product-catalog-image': '/product/image',
    'md-app-state': '',
    'md-msg-hist': '/mms/md-app-state',
    'biz-cover-photo': '/pps/biz-cover-photo'
};
// Kage: actualización de compatibilidad.
exports.NEWSLETTER_MEDIA_PATH_MAP = {
    image: '/newsletter/newsletter-image',
    video: '/newsletter/newsletter-video',
    document: '/newsletter/newsletter-document',
    audio: '/newsletter/newsletter-audio',
    sticker: '/newsletter/newsletter-image',
    'thumbnail-link': '/newsletter/newsletter-thumbnail-link'
};
exports.MEDIA_HKDF_KEY_MAPPING = {
    audio: 'Audio',
    document: 'Document',
    gif: 'Video',
    image: 'Image',
    ppic: '',
    product: 'Image',
    ptt: 'Audio',
    'sticker-pack': 'Sticker Pack',
    'thumbnail-sticker-pack': 'Sticker Pack Thumbnail',
    sticker: 'Image',
    video: 'Video',
    'thumbnail-document': 'Document Thumbnail',
    'thumbnail-image': 'Image Thumbnail',
    'thumbnail-video': 'Video Thumbnail',
    'thumbnail-link': 'Link Thumbnail',
    'md-msg-hist': 'History',
    'md-app-state': 'App State',
    'product-catalog-image': 'Product Catalog Image',
    'payment-bg-image': 'Payment Background',
    ptv: 'Video',
    'biz-cover-photo': 'Image',
    location: 'Location',
    contact: 'Contact',
    'voip-token': 'Voip Token'
};
exports.MEDIA_KEYS = Object.keys(exports.MEDIA_PATH_MAP);
/** 120s timeout for history sync stall detection, same as WA Web's handleChunkProgress / restartPausedTimer (g = 120) */
exports.HISTORY_SYNC_PAUSED_TIMEOUT_MS = 120000;
exports.MIN_PREKEY_COUNT = 5;
exports.INITIAL_PREKEY_COUNT = 812;
exports.UPLOAD_TIMEOUT = 30000; // 30 seconds
exports.TimeMs = {
    Minute: 60 * 1000,
    Hour: 60 * 60 * 1000,
    Day: 24 * 60 * 60 * 1000,
    Week: 7 * 24 * 60 * 60 * 1000
};

return module.exports;
})();
for (const key of Object.keys(__kageModule112)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule112[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule112, configurable:true});

// Kage: superficie pública completa.
for (const name of ['WA_CERT_DETAILS', 'MEDIA_PATH_MAP', 'MEDIA_HKDF_KEY_MAPPING']) {
    const advanced = exports[Symbol.for('kage.advanced')][name];
    for (const [key, value] of Object.entries(advanced || {})) {
        if (!(key in exports[name])) exports[name][key] = value;
    }
}
exports.MEDIA_HKDF_KEY_MAPPING['product-catalog-image'] = 'Product Catalog Image';
exports.MEDIA_KEYS = [...new Set([...exports.MEDIA_KEYS, ...Object.keys(exports.MEDIA_PATH_MAP)])];
