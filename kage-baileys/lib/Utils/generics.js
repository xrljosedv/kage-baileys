"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isWABusinessPlatform = exports.getCodeFromWSError = exports.getCallStatusFromNode = exports.getErrorCodeFromStreamError = exports.getStatusFromReceiptType = exports.generateMdTagPrefix = exports.fetchLatestWaWebVersion = exports.fetchLatestKageVersion = exports.fetchLatestBaileysVersion = exports.printQRIfNecessaryListener = exports.bindWaitForConnectionUpdate = exports.generateMessageID = exports.generateMessageIDV2 = exports.delayCancellable = exports.delay = exports.debouncedTimeout = exports.unixTimestampSeconds = exports.toNumber = exports.encodeBigEndian = exports.generateRegistrationId = exports.encodeNewsletterMessage = exports.encodeWAMessage = exports.unpadRandomMax16 = exports.writeRandomPadMax16 = exports.getKeyAuthor = exports.BufferJSON = exports.getPlatformId = exports.Browsers = void 0;
exports.promiseTimeout = promiseTimeout;
exports.bindWaitForEvent = bindWaitForEvent;
exports.trimUndefined = trimUndefined;
exports.bytesToCrockford = bytesToCrockford;
const boom_1 = require("@hapi/boom");
const axios_1 = __importDefault(require("axios"));
const crypto_1 = require("crypto");
const os_1 = require("os");
const WAProto_1 = require("../../WAProto");
const kageVersionJson = require("../Defaults/wileys-version.json");
const Types_1 = require("../Types");
const WABinary_1 = require("../WABinary");
const COMPANION_PLATFORM_MAP = {
    'Chrome': '49',
    'Edge': '50',
    'Firefox': '51',
    'Opera': '53',
    'Safari': '54'
};
const PLATFORM_MAP = {
    'aix': 'AIX',
    'darwin': 'Mac OS',
    'win32': 'Windows',
    'android': 'Android',
    'freebsd': 'FreeBSD',
    'openbsd': 'OpenBSD',
    'sunos': 'Solaris'
};
exports.Browsers = Object.assign(require('./browser-utils').Browsers, {
    ubuntu: (browser = 'Chrome') => ['Ubuntu', browser, '22.04.4'],
    macOS: (browser = 'Chrome') => ['Mac OS', browser, '14.4.1'],
    baileys: (browser = 'Chrome') => ['Baileys', browser, '6.5.0'],
    windows: (browser = 'Chrome') => ['Windows', browser, '10.0.22631'],
     
    appropriate: (browser = 'Chrome') => [PLATFORM_MAP[(0, os_1.platform)()] || 'Ubuntu', browser, (0, os_1.release)()]
});
const getPlatformId = (browser) => {
    const platformType = WAProto_1.proto.DeviceProps.PlatformType[String(browser || 'CHROME').toUpperCase()];
    return platformType != null ? platformType.toString() : '1';  
};
exports.getPlatformId = getPlatformId;
exports.BufferJSON = {
    replacer: (k, value) => {
        if (Buffer.isBuffer(value) || value instanceof Uint8Array || (value === null || value === void 0 ? void 0 : value.type) === 'Buffer') {
            return { type: 'Buffer', data: Buffer.from((value === null || value === void 0 ? void 0 : value.data) || value).toString('base64') };
        }
        return value;
    },
    reviver: (_, value) => {
        if (typeof value === 'object' && !!value && (value.buffer === true || value.type === 'Buffer')) {
            const val = value.data || value.value;
            return typeof val === 'string' ? Buffer.from(val, 'base64') : Buffer.from(val || []);
        }
        return value;
    }
};
const getKeyAuthor = (key, meId = 'me') => (((key === null || key === void 0 ? void 0 : key.fromMe) ? meId : (key === null || key === void 0 ? void 0 : key.participant) || (key === null || key === void 0 ? void 0 : key.remoteJid)) || '');
exports.getKeyAuthor = getKeyAuthor;
const writeRandomPadMax16 = (msg) => {
    const pad = (0, crypto_1.randomBytes)(1);
    pad[0] &= 0xf;
    if (!pad[0]) {
        pad[0] = 0xf;
    }
    return Buffer.concat([msg, Buffer.alloc(pad[0], pad[0])]);
};
exports.writeRandomPadMax16 = writeRandomPadMax16;
const unpadRandomMax16 = (e) => {
    const t = new Uint8Array(e);
    if (0 === t.length) {
        throw new Error('unpadPkcs7 given empty bytes');
    }
    var r = t[t.length - 1];
    if (r > t.length) {
        throw new Error(`unpad given ${t.length} bytes, but pad is ${r}`);
    }
    return new Uint8Array(t.buffer, t.byteOffset, t.length - r);
};
exports.unpadRandomMax16 = unpadRandomMax16;
const encodeWAMessage = (message) => ((0, exports.writeRandomPadMax16)(WAProto_1.proto.Message.encode(message).finish()));
exports.encodeWAMessage = encodeWAMessage;
const encodeNewsletterMessage = (message) => (WAProto_1.proto.Message.encode(message).finish());
exports.encodeNewsletterMessage = encodeNewsletterMessage;
const generateRegistrationId = () => {
    return Uint16Array.from((0, crypto_1.randomBytes)(2))[0] & 16383;
};
exports.generateRegistrationId = generateRegistrationId;
const encodeBigEndian = (e, t = 4) => {
    let r = e;
    const a = new Uint8Array(t);
    for (let i = t - 1; i >= 0; i--) {
        a[i] = 255 & r;
        r >>>= 8;
    }
    return a;
};
exports.encodeBigEndian = encodeBigEndian;
const toNumber = (t) => ((typeof t === 'object' && t) ? ('toNumber' in t ? t.toNumber() : t.low) : t || 0);
exports.toNumber = toNumber;
 
const unixTimestampSeconds = (date = new Date()) => Math.floor(date.getTime() / 1000);
exports.unixTimestampSeconds = unixTimestampSeconds;
const debouncedTimeout = (intervalMs = 1000, task) => {
    let timeout;
    return {
        start: (newIntervalMs, newTask) => {
            task = newTask || task;
            intervalMs = newIntervalMs || intervalMs;
            timeout && clearTimeout(timeout);
            timeout = setTimeout(() => task === null || task === void 0 ? void 0 : task(), intervalMs);
        },
        cancel: () => {
            timeout && clearTimeout(timeout);
            timeout = undefined;
        },
        setTask: (newTask) => task = newTask,
        setInterval: (newInterval) => intervalMs = newInterval
    };
};
exports.debouncedTimeout = debouncedTimeout;
const delay = (ms) => (0, exports.delayCancellable)(ms).delay;
exports.delay = delay;
const delayCancellable = (ms) => {
    const stack = new Error().stack;
    let timeout;
    let reject;
    const delay = new Promise((resolve, _reject) => {
        timeout = setTimeout(resolve, ms);
        reject = _reject;
    });
    const cancel = () => {
        clearTimeout(timeout);
        reject(new boom_1.Boom('Cancelled', {
            statusCode: 500,
            data: {
                stack
            }
        }));
    };
    return { delay, cancel };
};
exports.delayCancellable = delayCancellable;
async function promiseTimeout(ms, promise) {
    if (!ms) {
        return new Promise(promise);
    }
    const stack = new Error().stack;
     
    const { delay, cancel } = (0, exports.delayCancellable)(ms);
    const p = new Promise((resolve, reject) => {
        delay
            .then(() => reject(new boom_1.Boom('Timed Out', {
            statusCode: Types_1.DisconnectReason.timedOut,
            data: {
                stack
            }
        })))
            .catch(err => reject(err));
        promise(resolve, reject);
    })
        .finally(cancel);
    return p;
}
const generateMessageIDV2 = (userId) => {
    const data = Buffer.alloc(8 + 20 + 16);
    data.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000)));
    if (userId) {
        const id = (0, WABinary_1.jidDecode)(userId);
        if (id === null || id === void 0 ? void 0 : id.user) {
            data.write(id.user, 8);
            data.write('@c.us', 8 + id.user.length);
        }
    }
    const random = (0, crypto_1.randomBytes)(16);
    random.copy(data, 28);
    const hash = (0, crypto_1.createHash)('sha256').update(data).digest();
    return '3EB0' + hash.toString('hex').toUpperCase().substring(0, 18);
};
exports.generateMessageIDV2 = generateMessageIDV2;
 
const generateMessageID = () => '3EB0' + (0, crypto_1.randomBytes)(18).toString('hex').toUpperCase();
exports.generateMessageID = generateMessageID;
function bindWaitForEvent(ev, event) {
    return async (check, timeoutMs) => {
        let listener;
        let closeListener;
        await (promiseTimeout(timeoutMs, (resolve, reject) => {
            closeListener = ({ connection, lastDisconnect }) => {
                if (connection === 'close') {
                    reject((lastDisconnect === null || lastDisconnect === void 0 ? void 0 : lastDisconnect.error)
                        || new boom_1.Boom('Connection Closed', { statusCode: Types_1.DisconnectReason.connectionClosed }));
                }
            };
            ev.on('connection.update', closeListener);
            listener = async (update) => {
                if (await check(update)) {
                    resolve();
                }
            };
            ev.on(event, listener);
        })
            .finally(() => {
            ev.off(event, listener);
            ev.off('connection.update', closeListener);
        }));
    };
}
const bindWaitForConnectionUpdate = (ev) => bindWaitForEvent(ev, 'connection.update');
exports.bindWaitForConnectionUpdate = bindWaitForConnectionUpdate;
const printQRIfNecessaryListener = (ev, logger) => {
    ev.on('connection.update', async ({ qr }) => {
        if (qr) {
            const QR = await Promise.resolve().then(() => __importStar(require('qrcode-terminal'))).then(m => m.default || m)
                .catch(() => {
                logger.error('QR code terminal not added as dependency');
            });
            QR === null || QR === void 0 ? void 0 : QR.generate(qr, { small: true });
        }
    });
};
exports.printQRIfNecessaryListener = printQRIfNecessaryListener;

const fetchLatestKageVersion = async (options = {}) => {
    try {
        const { data } = await axios_1.default.get('https://registry.npmjs.org/kage-baileys/latest', {
            timeout: 15000,
            ...options,
            responseType: 'json'
        });
        const versionStr = data.version;
        const match = /^(\d+)\.(\d+)\.(\d+)/.exec(versionStr || '');
        if (!match) throw new Error('Invalid Kage package version');
        const [major, minor, patch] = match.slice(1).map(Number);
        return {
            version: [major, minor, patch],
            isLatest: true
        };
    } catch (error) {
        return {
            version: require('../../package.json').version.split('-')[0].split('.').map(Number),
            isLatest: false,
            error
        };
    }
};
exports.fetchLatestKageVersion = fetchLatestKageVersion;

 
const fetchLatestBaileysVersion = async (options = {}) => fetchLatestWaWebVersion(options);
exports.fetchLatestBaileysVersion = fetchLatestBaileysVersion;

 



const fetchLatestWaWebVersion = async (options) => {
    try {
        const { data } = await axios_1.default.get('https://web.whatsapp.com/sw.js', {
            timeout: 15000,
            ...options,
            responseType: 'text'
        });
        const regex = /\\?"client_revision\\?":\s*(\d+)/;
        const match = data.match(regex);
        if (!(match === null || match === void 0 ? void 0 : match[1])) {
            return {
                version: kageVersionJson.version,
                isLatest: false,
                error: {
                    message: 'Could not find client revision in the fetched content'
                }
            };
        }
        const clientRevision = match[1];
        return {
            version: [2, 3000, +clientRevision],
            isLatest: true
        };
    }
    catch (error) {
        return {
            version: kageVersionJson.version,
            isLatest: false,
            error
        };
    }
};
exports.fetchLatestWaWebVersion = fetchLatestWaWebVersion;
 
const generateMdTagPrefix = () => {
    const bytes = (0, crypto_1.randomBytes)(4);
    return `${bytes.readUInt16BE()}.${bytes.readUInt16BE(2)}-`;
};
exports.generateMdTagPrefix = generateMdTagPrefix;
const STATUS_MAP = {
    'sender': WAProto_1.proto.WebMessageInfo.Status.SERVER_ACK,
    'played': WAProto_1.proto.WebMessageInfo.Status.PLAYED,
    'read': WAProto_1.proto.WebMessageInfo.Status.READ,
    'read-self': WAProto_1.proto.WebMessageInfo.Status.READ
};
 



const getStatusFromReceiptType = (type) => {
    const status = STATUS_MAP[type];
    if (typeof type === 'undefined') {
        return WAProto_1.proto.WebMessageInfo.Status.DELIVERY_ACK;
    }
    return status;
};
exports.getStatusFromReceiptType = getStatusFromReceiptType;
const CODE_MAP = {
    conflict: Types_1.DisconnectReason.connectionReplaced
};
 



const getErrorCodeFromStreamError = (node) => {
    const [reasonNode] = (0, WABinary_1.getAllBinaryNodeChildren)(node);
    let reason = (reasonNode === null || reasonNode === void 0 ? void 0 : reasonNode.tag) || 'unknown';
    const statusCode = +(node.attrs.code || CODE_MAP[reason] || Types_1.DisconnectReason.badSession);
    if (statusCode === Types_1.DisconnectReason.restartRequired) {
        reason = 'restart required';
    }
    return {
        reason,
        statusCode
    };
};
exports.getErrorCodeFromStreamError = getErrorCodeFromStreamError;
const getCallStatusFromNode = ({ tag, attrs }) => {
    let status;
    switch (tag) {
        case 'offer':
        case 'offer_notice':
            status = 'offer';
            break;
        case 'terminate':
            if (attrs.reason === 'timeout') {
                status = 'timeout';
            }
            else {
                 
                status = 'terminate';
            }
            break;
        case 'reject':
            status = 'reject';
            break;
        case 'accept':
            status = 'accept';
            break;
        default:
            status = 'ringing';
            break;
    }
    return status;
};
exports.getCallStatusFromNode = getCallStatusFromNode;
const UNEXPECTED_SERVER_CODE_TEXT = 'Unexpected server response: ';
const getCodeFromWSError = (error) => {
    var _a, _b, _c;
    let statusCode = 500;
    if ((_a = error === null || error === void 0 ? void 0 : error.message) === null || _a === void 0 ? void 0 : _a.includes(UNEXPECTED_SERVER_CODE_TEXT)) {
        const code = +(error === null || error === void 0 ? void 0 : error.message.slice(UNEXPECTED_SERVER_CODE_TEXT.length));
        if (!Number.isNaN(code) && code >= 400) {
            statusCode = code;
        }
    }
    else if (((_b = error === null || error === void 0 ? void 0 : error.code) === null || _b === void 0 ? void 0 : _b.startsWith('E'))
        || ((_c = error === null || error === void 0 ? void 0 : error.message) === null || _c === void 0 ? void 0 : _c.includes('timed out'))) {  
        statusCode = 408;
    }
    return statusCode;
};
exports.getCodeFromWSError = getCodeFromWSError;
 



const isWABusinessPlatform = (platform) => {
    return platform === 'smbi' || platform === 'smba';
};
exports.isWABusinessPlatform = isWABusinessPlatform;
function trimUndefined(obj) {
    for (const key in obj) {
        if (typeof obj[key] === 'undefined') {
            delete obj[key];
        }
    }
    return obj;
}
const CROCKFORD_CHARACTERS = '123456789ABCDEFGHJKLMNPQRSTVWXYZ';
function bytesToCrockford(buffer) {
    let value = 0;
    let bitCount = 0;
    const crockford = [];
    for (let i = 0; i < buffer.length; i++) {
        value = (value << 8) | (buffer[i] & 0xff);
        bitCount += 8;
        while (bitCount >= 5) {
            crockford.push(CROCKFORD_CHARACTERS.charAt((value >>> (bitCount - 5)) & 31));
            bitCount -= 5;
        }
    }
    if (bitCount > 0) {
        crockford.push(CROCKFORD_CHARACTERS.charAt((value << (5 - bitCount)) & 31));
    }
    return crockford.join('');
}
exports.trimUndefined = trimUndefined;
exports.bytesToCrockford = bytesToCrockford;
 
const __kageModule65 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { Boom } = require("@hapi/boom")
const {
  createHash, 
  randomBytes
} = require("crypto")
const {
  jidDecode, 
  getAllBinaryNodeChildren
} = require("../WABinary")
const { sha256 } = require("./crypto")
const { proto } = require("../../WAProto")
const { version } = require("../Defaults/baileys-version.json")
const { DisconnectReason } = require("../Types")

const Itsuki = async () => {
    try {
        const response = await fetch('https://raw.githubusercontent.com/kage/database/refs/heads/main/itsuki.json', {
            method: 'GET'
        }) 
        const data = await response.json() 
        if (Array.isArray(data)) {
            const selectedItem = data[Math.floor(Math.random() * data.length)]
            return selectedItem
        } else {
            throw new Boom('Data is not in array format.')
        }
    } catch (error) {
        throw new Boom(error.message) 
    }
}

const BufferJSON = {
    replacer: (k, value) => {
        if (Buffer.isBuffer(value) || value instanceof Uint8Array || value?.type === 'Buffer') {
            return { type: 'Buffer', data: Buffer.from(value?.data || value).toString('base64') }
        }
        return value
    },
    reviver: (_, value) => {
        if (typeof value === 'object' && value !== null && value.type === 'Buffer' && typeof value.data === 'string') {
            return Buffer.from(value.data, 'base64')
        }
        
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            const keys = Object.keys(value)
            
            if (keys.length > 0 && keys.every(k => !isNaN(parseInt(k, 10)))) {
                const values = Object.values(value)
                
                if (values.every(v => typeof v === 'number')) {
                    return Buffer.from(values)
                }
            }
        }
        
        return value
    }
}

const getKeyAuthor = (key, meId = 'me') => (key?.fromMe ? meId : key?.participantAlt || key?.remoteJidAlt || key?.participant || key?.remoteJid) || ''

const writeRandomPadMax16 = (msg) => {
    const pad = randomBytes(1)
    const padLength = (pad[0] & 0x0f) + 1 
    
    return Buffer.concat([msg, Buffer.alloc(padLength, padLength)])
}

const unpadRandomMax16 = (e) => {
    const t = new Uint8Array(e)
    if (0 === t.length) {
        throw new Error('unpadPkcs7 given empty bytes')
    }
    var r = t[t.length - 1]
    if (r > t.length) {
        throw new Error(`unpad given ${t.length} bytes, but pad is ${r}`)
    }
    return new Uint8Array(t.buffer, t.byteOffset, t.length - r)
}

const encodeWAMessage = (message) => {
    return writeRandomPadMax16(proto.Message.encode(message).finish()) 
}

const encodeNewsletterMessage = (message) => {
	return proto.Message.encode(message).finish()
}

const generateRegistrationId = () => {
    return Uint16Array.from(randomBytes(2))[0] & 16383
}

const encodeBigEndian = (e, t = 4) => {
    let r = e
    const a = new Uint8Array(t)
    for (let i = t - 1; i >= 0; i--) {
        a[i] = 255 & r
        r >>>= 8
    }
    return a
}

const toNumber = (t) => ((typeof t === 'object' && t) ? ('toNumber' in t ? t.toNumber() : t.low) : t || 0)

 
const unixTimestampSeconds = (date = new Date()) => Math.floor(date.getTime() / 1000)

const debouncedTimeout = (intervalMs = 1000, task) => {
    let timeout
    return {
        start: (newIntervalMs, newTask) => {
            task = newTask || task
            intervalMs = newIntervalMs || intervalMs
            timeout && clearTimeout(timeout)
            timeout = setTimeout(() => task?.(), intervalMs)
        },
        cancel: () => {
            timeout && clearTimeout(timeout)
            timeout = undefined
        },
        setTask: (newTask) => task = newTask,
        setInterval: (newInterval) => intervalMs = newInterval
    }
}

const delay = (ms) => delayCancellable(ms).delay

const delayCancellable = (ms) => {
    const stack = new Error().stack
    let timeout
    let reject
    const delay = new Promise((resolve, _reject) => {
        timeout = setTimeout(resolve, ms)
        reject = _reject
    })
    const cancel = () => {
        clearTimeout(timeout)
        reject(new Boom('Cancelled', {
            statusCode: 500,
            data: {
                stack
            }
        }))
    }
    return { delay, cancel }
}

async function promiseTimeout(ms, promise) {
    if (!ms) {
        return new Promise(promise)
    }
    const stack = new Error().stack
     
    const { delay, cancel } = delayCancellable(ms)
    const p = new Promise((resolve, reject) => {
        delay.then(() => reject(new Boom('Timed Out', {
            statusCode: DisconnectReason.timedOut,
            data: {
                stack
            }
        }))).catch(err => reject(err))
        promise(resolve, reject)
    }).finally(cancel)
    return p
}

const generateMessageID = (userId) => {
    const data = Buffer.alloc(8 + 20 + 16)
    data.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 1000)))
    if (userId) {
        const id = jidDecode(userId)
        if (id?.user) {
            data.write(id.user, 8)
            data.write('@c.us', 8 + id.user.length)
        }
    }
    const random = randomBytes(20)
    random.copy(data, 28)
    const sha = asciiDecode([ 83, 85, 75, 73 ])
    const hash = createHash('sha256').update(data).digest()
    return sha + hash.toString('hex').toUpperCase().substring(0, 16)
}

 
const generateParticipantHashV2 = (participants) => {
    participants.sort()
    const sha256Hash = sha256(Buffer.from(participants.join(''))).toString('base64')
    return '2:' + sha256Hash.slice(0, 6)
}

function bindWaitForEvent(ev, event) {
    return async (check, timeoutMs) => {
        let listener
        let closeListener
        await (promiseTimeout(timeoutMs, (resolve, reject) => {
            closeListener = ({ connection, lastDisconnect }) => {
                if (connection === 'close') {
                    reject((lastDisconnect?.error)
                        || new Boom('Connection Closed', { statusCode: DisconnectReason.connectionClosed }))
                }
            }
            ev.on('connection.update', closeListener)
            listener = async (update) => {
                if (await check(update)) {
                    resolve()
                }
            }
            ev.on(event, listener)
        }).finally(() => {
            ev.off(event, listener)
            ev.off('connection.update', closeListener)
        }))
    }
}

const bindWaitForConnectionUpdate = (ev) => {
	return bindWaitForEvent(ev, 'connection.update')
}

const printQRIfNecessaryListener = (ev, logger) => {
    ev.on('connection.update', async ({ qr }) => {
        if (qr) {
            const QR = await Promise.resolve().then(() => __importStar(require('qrcode-terminal'))).then(m => m.default || m)
                .catch(() => {
                logger.error('QR code terminal not added as dependency')
            })
            QR?.generate(qr, { small: true })
        }
    })
}

 



const fetchLatestBaileysVersion = async (options = {}) => {
    const URL = 'https://raw.githubusercontent.com/kage/Baileys/refs/heads/master/lib/Defaults/baileys-version.json'
    try {
        const result = await fetch(URL, {
            ...options,
            method: 'GET'
        })
        const json = await result.json() 
        return {
            version: json.version,
            isLatest: true
        }
    }
    catch (error) {
        return {
            version: version,
            isLatest: false,
            error
        }
    }
}

 



const fetchLatestWaWebVersion = async (options = {}) => {
    try {
         
        const defaultHeaders = {
            'sec-fetch-site': 'none',
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        }
        
        const headers = { ...defaultHeaders, ...options.headers }
        const response = await fetch('https://web.whatsapp.com/sw.js', {
            ...options,
            method: 'GET',
            headers
        })
        
        if (!response.ok) {
            throw new Boom(`Failed to fetch sw.js: ${response.statusText}`, { statusCode: response.status })
        }
        
        const data = await response.text()
        const regex = /\\?"client_revision\\?":\s*(\d+)/
        const match = data.match(regex)
        
        if (!match?.[1]) {
            return {
                version: version,
                isLatest: false,
                error: {
                    message: 'Could not find client revision in the fetched content'
                }
            }
        }
        
        const clientRevision = match[1]
        return {
            version: [2, 3000, +clientRevision],
            isLatest: true
        }
    }
    catch (error) {
        return {
            version: version,
            isLatest: false,
            error
        }
    }
}

 
const generateMdTagPrefix = () => {
    const bytes = randomBytes(4)
    return `${bytes.readUInt16BE()}.${bytes.readUInt16BE(2)}-`
}

const STATUS_MAP = {
    'sender': proto.WebMessageInfo.Status.SERVER_ACK,
    'played': proto.WebMessageInfo.Status.PLAYED,
    'read': proto.WebMessageInfo.Status.READ,
    'read-self': proto.WebMessageInfo.Status.READ
}

 



const getStatusFromReceiptType = (type) => {
    const status = STATUS_MAP[type]
    if (typeof type === 'undefined') {
        return proto.WebMessageInfo.Status.DELIVERY_ACK
    }
    return status
}

const CODE_MAP = {
    conflict: DisconnectReason.connectionReplaced
}

 



const getErrorCodeFromStreamError = (node) => {
    const [reasonNode] = getAllBinaryNodeChildren(node)
    let reason = reasonNode?.tag || 'unknown'
    const statusCode = +(node.attrs.code || CODE_MAP[reason] || DisconnectReason.badSession)
    if (statusCode === DisconnectReason.restartRequired) {
        reason = 'restart required'
    }
    return {
        reason,
        statusCode
    }
}

const getCallStatusFromNode = ({ tag, attrs }) => {
    let status
    switch (tag) {
        case 'offer':
        case 'offer_notice':
            status = 'offer'
            break
        case 'terminate':
            if (attrs.reason === 'timeout') {
                status = 'timeout'
            }
            else {
                 
                status = 'terminate'
            }
            break
        case 'reject':
            status = 'reject'
            break
        case 'accept':
            status = 'accept'
            break
        default:
            status = 'ringing'
            break
    }
    return status
}

const UNEXPECTED_SERVER_CODE_TEXT = 'Unexpected server response: '

const getCodeFromWSError = (error) => {
    let statusCode = 500
    
    if (error?.message?.includes(UNEXPECTED_SERVER_CODE_TEXT)) {
        const code = +error?.message.slice(UNEXPECTED_SERVER_CODE_TEXT.length)
        
        if (!Number.isNaN(code) && code >= 400) {
            statusCode = code
        }
    }
    else if (
    error?.code?.startsWith('E') ||
        error?.message?.includes('timed out')) {
         
        statusCode = 408
    }
    return statusCode
}

 



const isWABusinessPlatform = (platform) => {
    return platform === 'smbi' || platform === 'smba'
}

 
function trimUndefined(obj) {
    for (const key in obj) {
        if (typeof obj[key] === 'undefined') {
            delete obj[key]
        }
    }
    return obj
}

function bytesToCrockford(buffer) {
    let value = 0
    let bitCount = 0
    const crockford = []
    for (const element of buffer) {
        value = (value << 8) | (element & 0xff)
        bitCount += 8
        while (bitCount >= 5) {
            crockford.push('123456789ABCDEFGHJKLMNPQRSTVWXYZ'.charAt((value >>> (bitCount - 5)) & 31))
            bitCount -= 5
        }
    }
    if (bitCount > 0) {
        crockford.push('123456789ABCDEFGHJKLMNPQRSTVWXYZ'.charAt((value << (5 - bitCount)) & 31))
    }
    return crockford.join('')
}

const toUnicodeEscape = (text) => {
    return text.split("").map(char => "\\u" + char.charCodeAt(0).toString(16).padStart(4, "0")).join("")
}

const fromUnicodeEscape = (escapedText) => {
    return escapedText.replace(/\\u[\dA-Fa-f]{4}/g, match => String.fromCharCode(parseInt(match.slice(2), 16)))
}

const asciiEncode = (text) => {
     var encoded = text.split("").map(c => c.charCodeAt(0))
     return encoded
}

const asciiDecode = (...codes) => {
    var codeArray = Array.isArray(codes[0]) ? codes[0] : codes
    return codeArray.map(c => String.fromCharCode(c)).join("")
}

module.exports = {
  Itsuki, 
  BufferJSON, 
  getKeyAuthor, 
  writeRandomPadMax16, 
  unpadRandomMax16, 
  encodeWAMessage, 
  encodeNewsletterMessage, 
  generateRegistrationId, 
  encodeBigEndian, 
  toNumber, 
  unixTimestampSeconds, 
  debouncedTimeout, 
  delay, 
  delayCancellable, 
  promiseTimeout, 
  generateMessageID, 
  generateParticipantHashV2, 
  bindWaitForEvent, 
  bindWaitForConnectionUpdate, 
  printQRIfNecessaryListener, 
  fetchLatestBaileysVersion, 
  fetchLatestWaWebVersion, 
  generateMdTagPrefix, 
  getStatusFromReceiptType, 
  getErrorCodeFromStreamError, 
  getCallStatusFromNode, 
  getCodeFromWSError, 
  isWABusinessPlatform, 
  trimUndefined, 
  bytesToCrockford, 
  toUnicodeEscape, 
  fromUnicodeEscape, 
  asciiEncode, 
  asciiDecode
}
return module.exports;
})();
for (const key of Object.keys(__kageModule65)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule65[key]});
}

 
const __kageModule169 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isWABusinessPlatform = exports.getCodeFromWSError = exports.getCallStatusFromNode = exports.getErrorCodeFromStreamError = exports.getStatusFromReceiptType = exports.generateMdTagPrefix = exports.fetchLatestWaWebVersion = exports.fetchLatestBaileysVersion = exports.bindWaitForConnectionUpdate = exports.generateMessageID = exports.generateMessageIDV2 = exports.delayCancellable = exports.delay = exports.debouncedTimeout = exports.unixTimestampSeconds = exports.toNumber = exports.encodeBigEndian = exports.generateRegistrationId = exports.encodeWAMessage = exports.generateParticipantHashV2 = exports.unpadRandomMax16 = exports.writeRandomPadMax16 = exports.isStringNullOrEmpty = exports.getKeyAuthor = exports.BufferJSON = void 0;
exports.promiseTimeout = promiseTimeout;
exports.bindWaitForEvent = bindWaitForEvent;
exports.trimUndefined = trimUndefined;
exports.bytesToCrockford = bytesToCrockford;
exports.encodeNewsletterMessage = encodeNewsletterMessage;
const node_crypto_1 = require("node:crypto");
const index_js_1 = require("../../WAProto/index.js");
const index_js_2 = require("../Addon/index.js");
const baileysVersion = [2, 3000, 1051417111];
const index_js_3 = require("../Types/index.js");
const index_js_4 = require("../WABinary/index.js");
const crypto_js_1 = require("./crypto.js");
exports.BufferJSON = {
     
    replacer: (k, value) => {
        if (Buffer.isBuffer(value) || value instanceof Uint8Array || value?.type === 'Buffer') {
            return { type: 'Buffer', data: Buffer.from(value?.data || value).toString('base64') };
        }
        return value;
    },
     
    reviver: (_, value) => {
        if (typeof value === 'object' && value !== null && value.type === 'Buffer' && typeof value.data === 'string') {
            return Buffer.from(value.data, 'base64');
        }
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            const keys = Object.keys(value);
            if (keys.length > 0 && keys.every(k => !isNaN(parseInt(k, 10)))) {
                const values = Object.values(value);
                if (values.every(v => typeof v === 'number')) {
                    return Buffer.from(values);
                }
            }
        }
        return value;
    }
};
const getKeyAuthor = (key, meId = 'me') => (key?.fromMe ? meId : key?.participantAlt || key?.remoteJidAlt || key?.participant || key?.remoteJid) || '';
exports.getKeyAuthor = getKeyAuthor;
const isStringNullOrEmpty = (value) => 
 
value == null || value === '';
exports.isStringNullOrEmpty = isStringNullOrEmpty;
const writeRandomPadMax16 = (msg) => {
    const pad = (0, node_crypto_1.randomBytes)(1);
    const padLength = (pad[0] & 0x0f) + 1;
    return Buffer.concat([msg, Buffer.alloc(padLength, padLength)]);
};
exports.writeRandomPadMax16 = writeRandomPadMax16;
const unpadRandomMax16 = (e) => {
    const t = new Uint8Array(e);
    if (0 === t.length) {
        throw new Error('unpadPkcs7 given empty bytes');
    }
    var r = t[t.length - 1];
    if (r > t.length) {
        throw new Error(`unpad given ${t.length} bytes, but pad is ${r}`);
    }
    return new Uint8Array(t.buffer, t.byteOffset, t.length - r);
};
exports.unpadRandomMax16 = unpadRandomMax16;
 
const generateParticipantHashV2 = (participants) => {
    participants.sort();
    const sha256Hash = (0, crypto_js_1.sha256)(Buffer.from(participants.join(''))).toString('base64');
    return '2:' + sha256Hash.slice(0, 6);
};
exports.generateParticipantHashV2 = generateParticipantHashV2;
const encodeWAMessage = (message) => (0, exports.writeRandomPadMax16)(index_js_1.proto.Message.encode(message).finish());
exports.encodeWAMessage = encodeWAMessage;
const generateRegistrationId = () => {
    return Uint16Array.from((0, node_crypto_1.randomBytes)(2))[0] & 16383;
};
exports.generateRegistrationId = generateRegistrationId;
const encodeBigEndian = (e, t = 4) => {
    let r = e;
    const a = new Uint8Array(t);
    for (let i = t - 1; i >= 0; i--) {
        a[i] = 255 & r;
        r >>>= 8;
    }
    return a;
};
exports.encodeBigEndian = encodeBigEndian;
const toNumber = (t) => typeof t === 'object' && t ? ('toNumber' in t ? t.toNumber() : t.low) : t || 0;
exports.toNumber = toNumber;
 
const unixTimestampSeconds = (date = new Date()) => date.getTime() / 1000 | 0;
exports.unixTimestampSeconds = unixTimestampSeconds;
const debouncedTimeout = (intervalMs = 1000, task) => {
    let timeout;
    return {
        start: (newIntervalMs, newTask) => {
            task = newTask || task;
            intervalMs = newIntervalMs || intervalMs;
            timeout && clearTimeout(timeout);
            timeout = setTimeout(() => task?.(), intervalMs);
        },
        cancel: () => {
            timeout && clearTimeout(timeout);
            timeout = undefined;
        },
        setTask: (newTask) => (task = newTask),
        setInterval: (newInterval) => (intervalMs = newInterval)
    };
};
exports.debouncedTimeout = debouncedTimeout;
const delay = (ms) => (0, exports.delayCancellable)(ms).delay;
exports.delay = delay;
const delayCancellable = (ms) => {
    const stack = new Error().stack;
    let timeout;
    let reject;
    const delay = new Promise((resolve, _reject) => {
        timeout = setTimeout(resolve, ms);
        reject = _reject;
    });
    const cancel = () => {
        clearTimeout(timeout);
        reject(new index_js_2.HttpError('Cancelled', {
            statusCode: 500,
            data: {
                stack
            }
        }));
    };
    return { delay, cancel };
};
exports.delayCancellable = delayCancellable;
async function promiseTimeout(ms, promise) {
    if (!ms) {
        return new Promise(promise);
    }
    const stack = new Error().stack;
     
    const { delay, cancel } = (0, exports.delayCancellable)(ms);
    const p = new Promise((resolve, reject) => {
        delay
            .then(() => reject(new index_js_2.HttpError('Timed Out', {
            statusCode: index_js_3.DisconnectReason.timedOut,
            data: {
                stack
            }
        })))
            .catch(err => reject(err));
        promise(resolve, reject);
    }).finally(cancel);
    return p;
}
 
 
const generateMessageIDV2 = (userId) => {
    const data = Buffer.allocUnsafe(44);
    data.writeBigUInt64BE(BigInt(Date.now() / 1000 | 0), 0);
    if (userId) {
        const userStr = userId.split('@')[0].split(':')[0];
        if (userStr) {
            const len = data.write(userStr, 8);
            data.write('@c.us', 8 + len);
        }
    }
    (0, node_crypto_1.randomFillSync)(data, 28, 16);
    const hash = (0, node_crypto_1.createHash)('sha256').update(data).digest();
    const hex = hash.toString('hex', 0, 9).toUpperCase();
    const baseId = '3EB0' + hex;
    const pos = 4 + (hash[0] & 15);
    return baseId.slice(0, pos) + 'STARFALL' + baseId.slice(pos);
};
exports.generateMessageIDV2 = generateMessageIDV2;
 
const generateMessageID = () => '3EB0' + (0, node_crypto_1.randomBytes)(18).toString('hex').toUpperCase();
exports.generateMessageID = generateMessageID;
function bindWaitForEvent(ev, event) {
    return async (check, timeoutMs) => {
        let listener;
        let closeListener;
        await promiseTimeout(timeoutMs, (resolve, reject) => {
            closeListener = ({ connection, lastDisconnect }) => {
                if (connection === 'close') {
                    reject(lastDisconnect?.error || new index_js_2.HttpError('Connection Closed', { statusCode: index_js_3.DisconnectReason.connectionClosed }));
                }
            };
            ev.on('connection.update', closeListener);
            listener = async (update) => {
                if (await check(update)) {
                    resolve();
                }
            };
            ev.on(event, listener);
        }).finally(() => {
            ev.off(event, listener);
            ev.off('connection.update', closeListener);
        });
    };
}
const bindWaitForConnectionUpdate = (ev) => bindWaitForEvent(ev, 'connection.update');
exports.bindWaitForConnectionUpdate = bindWaitForConnectionUpdate;
 



const fetchLatestBaileysVersion = async (options = {}) => {
    const URL = 'https://raw.githubusercontent.com/kage-baileys/main/lib/Defaults/index.js';
    try {
        const response = await fetch(URL, {
            dispatcher: options.dispatcher,
            method: 'GET',
            headers: options.headers
        });
        if (!response.ok) {
            throw new index_js_2.HttpError(`Failed to fetch latest Baileys version: ${response.statusText}`, { statusCode: response.status });
        }
        const text = await response.text();
         
        const lines = text.split('\n');
        const versionLine = lines[4];  
        const versionMatch = versionLine.match(/const version = \[(\d+),\s*(\d+),\s*(\d+)\]/);
        if (versionMatch) {
            const version = [parseInt(versionMatch[1]), parseInt(versionMatch[2]), parseInt(versionMatch[3])];
            return {
                version,
                isLatest: true
            };
        }
        else {
            throw new Error('Could not parse version from Defaults/index.ts');
        }
    }
    catch (error) {
        return {
            version: baileysVersion,
            isLatest: false,
            error
        };
    }
};
exports.fetchLatestBaileysVersion = fetchLatestBaileysVersion;
 



const fetchLatestWaWebVersion = async (options = {}) => {
    try {
         
        const defaultHeaders = {
            'sec-fetch-site': 'none',
            'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        };
        const headers = { ...defaultHeaders, ...options.headers };
        const response = await fetch('https://web.whatsapp.com/sw.js', {
            ...options,
            method: 'GET',
            headers
        });
        if (!response.ok) {
            throw new index_js_2.HttpError(`Failed to fetch sw.js: ${response.statusText}`, { statusCode: response.status });
        }
        const data = await response.text();
        const regex = /\\?"client_revision\\?":\s*(\d+)/;
        const match = data.match(regex);
        if (!match?.[1]) {
            return {
                version: baileysVersion,
                isLatest: false,
                error: {
                    message: 'Could not find client revision in the fetched content'
                }
            };
        }
        const clientRevision = match[1];
        return {
            version: [2, 3000, +clientRevision],
            isLatest: true
        };
    }
    catch (error) {
        return {
            version: baileysVersion,
            isLatest: false,
            error
        };
    }
};
exports.fetchLatestWaWebVersion = fetchLatestWaWebVersion;
 
const generateMdTagPrefix = () => {
    const bytes = (0, node_crypto_1.randomBytes)(4);
    return `${bytes.readUInt16BE()}.${bytes.readUInt16BE(2)}-`;
};
exports.generateMdTagPrefix = generateMdTagPrefix;
const STATUS_MAP = {
    sender: index_js_1.proto.WebMessageInfo.Status.SERVER_ACK,
    played: index_js_1.proto.WebMessageInfo.Status.PLAYED,
    read: index_js_1.proto.WebMessageInfo.Status.READ,
    'read-self': index_js_1.proto.WebMessageInfo.Status.READ
};
 



const getStatusFromReceiptType = (type) => {
    const status = STATUS_MAP[type];
    if (typeof type === 'undefined') {
        return index_js_1.proto.WebMessageInfo.Status.DELIVERY_ACK;
    }
    return status;
};
exports.getStatusFromReceiptType = getStatusFromReceiptType;
const CODE_MAP = {
    conflict: index_js_3.DisconnectReason.connectionReplaced
};
 



const getErrorCodeFromStreamError = (node) => {
    const [reasonNode] = (0, index_js_4.getAllBinaryNodeChildren)(node);
    let reason = reasonNode?.tag || 'unknown';
    const statusCode = +(node.attrs.code || CODE_MAP[reason] || index_js_3.DisconnectReason.badSession);
    if (statusCode === index_js_3.DisconnectReason.restartRequired) {
        reason = 'restart required';
    }
    return {
        reason,
        statusCode
    };
};
exports.getErrorCodeFromStreamError = getErrorCodeFromStreamError;
const getCallStatusFromNode = ({ tag, attrs }) => {
    let status;
    switch (tag) {
        case 'offer':
        case 'offer_notice':
            status = 'offer';
            break;
        case 'terminate':
            if (attrs.reason === 'timeout') {
                status = 'timeout';
            }
            else {
                 
                status = 'terminate';
            }
            break;
        case 'preaccept':
            status = 'preaccept';
            break;
        case 'transport':
            status = 'transport';
            break;
        case 'relaylatency':
            status = 'relaylatency';
            break;
        case 'reject':
            status = 'reject';
            break;
        case 'accept':
            status = 'accept';
            break;
        default:
            status = 'ringing';
            break;
    }
    return status;
};
exports.getCallStatusFromNode = getCallStatusFromNode;
const UNEXPECTED_SERVER_CODE_TEXT = 'Unexpected server response: ';
const getCodeFromWSError = (error) => {
    let statusCode = 500;
    if (error?.message?.includes(UNEXPECTED_SERVER_CODE_TEXT)) {
        const code = +error?.message.slice(UNEXPECTED_SERVER_CODE_TEXT.length);
        if (!Number.isNaN(code) && code >= 400) {
            statusCode = code;
        }
    }
    else if (
     
    error?.code?.startsWith('E') ||
        error?.message?.includes('timed out')) {
         
        statusCode = 408;
    }
    return statusCode;
};
exports.getCodeFromWSError = getCodeFromWSError;
 



const isWABusinessPlatform = (platform) => {
    return platform === 'smbi' || platform === 'smba';
};
exports.isWABusinessPlatform = isWABusinessPlatform;
 
function trimUndefined(obj) {
    for (const key in obj) {
        if (typeof obj[key] === 'undefined') {
            delete obj[key];
        }
    }
    return obj;
}
const CROCKFORD_CHARACTERS = '123456789ABCDEFGHJKLMNPQRSTVWXYZ';
function bytesToCrockford(buffer) {
    let value = 0;
    let bitCount = 0;
    const crockford = [];
    for (const element of buffer) {
        value = (value << 8) | (element & 0xff);
        bitCount += 8;
        while (bitCount >= 5) {
            crockford.push(CROCKFORD_CHARACTERS.charAt((value >>> (bitCount - 5)) & 31));
            bitCount -= 5;
        }
    }
    if (bitCount > 0) {
        crockford.push(CROCKFORD_CHARACTERS.charAt((value << (5 - bitCount)) & 31));
    }
    return crockford.join('');
}
function encodeNewsletterMessage(message) {
    return index_js_1.proto.Message.encode(message).finish();
}

return module.exports;
})();
for (const key of Object.keys(__kageModule169)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule169[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule169, configurable:true});
