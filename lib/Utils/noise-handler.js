"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeNoiseHandler = void 0;
const boom_1 = require("@hapi/boom");
const WAProto_1 = require("../../WAProto");
const Defaults_1 = require("../Defaults");
const WABinary_1 = require("../WABinary");
const crypto_1 = require("./crypto");
const generateIV = (counter) => {
    const iv = new ArrayBuffer(12);
    new DataView(iv).setUint32(8, counter);
    return new Uint8Array(iv);
};
const makeNoiseHandler = ({ keyPair: { private: privateKey, public: publicKey }, NOISE_HEADER, logger, routingInfo }) => {
    logger = logger.child({ class: 'ns' });
    const authenticate = (data) => {
        if (!isFinished) {
            hash = (0, crypto_1.sha256)(Buffer.concat([hash, data]));
        }
    };
    const encrypt = (plaintext) => {
        const result = (0, crypto_1.aesEncryptGCM)(plaintext, encKey, generateIV(writeCounter), hash);
        writeCounter += 1;
        authenticate(result);
        return result;
    };
    const decrypt = (ciphertext) => {
        // before the handshake is finished, we use the same counter
        // after handshake, the counters are different
        const iv = generateIV(isFinished ? readCounter : writeCounter);
        const result = (0, crypto_1.aesDecryptGCM)(ciphertext, decKey, iv, hash);
        if (isFinished) {
            readCounter += 1;
        }
        else {
            writeCounter += 1;
        }
        authenticate(ciphertext);
        return result;
    };
    const localHKDF = async (data) => {
        const key = await (0, crypto_1.hkdf)(Buffer.from(data), 64, { salt, info: '' });
        return [key.slice(0, 32), key.slice(32)];
    };
    const mixIntoKey = async (data) => {
        const [write, read] = await localHKDF(data);
        salt = write;
        encKey = read;
        decKey = read;
        readCounter = 0;
        writeCounter = 0;
    };
    const finishInit = async () => {
        const [write, read] = await localHKDF(new Uint8Array(0));
        encKey = write;
        decKey = read;
        hash = Buffer.from([]);
        readCounter = 0;
        writeCounter = 0;
        isFinished = true;
    };
    const data = Buffer.from(Defaults_1.NOISE_MODE);
    let hash = data.byteLength === 32 ? data : (0, crypto_1.sha256)(data);
    let salt = hash;
    let encKey = hash;
    let decKey = hash;
    let readCounter = 0;
    let writeCounter = 0;
    let isFinished = false;
    let sentIntro = false;
    let inBytes = Buffer.alloc(0);
    authenticate(NOISE_HEADER);
    authenticate(publicKey);
    return {
        encrypt,
        decrypt,
        authenticate,
        mixIntoKey,
        finishInit,
        processHandshake: async ({ serverHello }, noiseKey) => {
            authenticate(serverHello.ephemeral);
            await mixIntoKey(crypto_1.Curve.sharedKey(privateKey, serverHello.ephemeral));
            const decStaticContent = decrypt(serverHello.static);
            await mixIntoKey(crypto_1.Curve.sharedKey(privateKey, decStaticContent));
            const certDecoded = decrypt(serverHello.payload);
            const { intermediate: certIntermediate } = WAProto_1.proto.CertChain.decode(certDecoded);
            const { issuerSerial } = WAProto_1.proto.CertChain.NoiseCertificate.Details.decode(certIntermediate.details);
            if (issuerSerial !== Defaults_1.WA_CERT_DETAILS.SERIAL) {
                throw new boom_1.Boom('certification match failed', { statusCode: 400 });
            }
            const keyEnc = encrypt(noiseKey.public);
            await mixIntoKey(crypto_1.Curve.sharedKey(noiseKey.private, serverHello.ephemeral));
            return keyEnc;
        },
        encodeFrame: (data) => {
            if (isFinished) {
                data = encrypt(data);
            }
            let header;
            if (routingInfo) {
                header = Buffer.alloc(7);
                header.write('ED', 0, 'utf8');
                header.writeUint8(0, 2);
                header.writeUint8(1, 3);
                header.writeUint8(routingInfo.byteLength >> 16, 4);
                header.writeUint16BE(routingInfo.byteLength & 65535, 5);
                header = Buffer.concat([header, routingInfo, NOISE_HEADER]);
            }
            else {
                header = Buffer.from(NOISE_HEADER);
            }
            const introSize = sentIntro ? 0 : header.length;
            const frame = Buffer.alloc(introSize + 3 + data.byteLength);
            if (!sentIntro) {
                frame.set(header);
                sentIntro = true;
            }
            frame.writeUInt8(data.byteLength >> 16, introSize);
            frame.writeUInt16BE(65535 & data.byteLength, introSize + 1);
            frame.set(data, introSize + 3);
            return frame;
        },
        decodeFrame: async (newData, onFrame) => {
            var _a;
            // the binary protocol uses its own framing mechanism
            // on top of the WS frames
            // so we get this data and separate out the frames
            const getBytesSize = () => {
                if (inBytes.length >= 3) {
                    return (inBytes.readUInt8() << 16) | inBytes.readUInt16BE(1);
                }
            };
            if (!Buffer.isBuffer(newData) && !(newData instanceof Uint8Array)) throw new Error('NOISE_INVALID_CHUNK');
            if (inBytes.length + newData.byteLength > 32 * 1024 * 1024) { inBytes = Buffer.alloc(0); throw new Error('NOISE_BUFFER_LIMIT'); }
            inBytes = Buffer.concat([inBytes, newData]);
            logger.trace(`recv ${newData.length} bytes, total recv ${inBytes.length} bytes`);
            let size = getBytesSize();
            if (size === 0) { inBytes = Buffer.alloc(0); throw new Error('NOISE_EMPTY_FRAME'); }
            while (size && inBytes.length >= size + 3) {
                let frame = inBytes.slice(3, size + 3);
                inBytes = inBytes.slice(size + 3);
                if (isFinished) {
                    const result = decrypt(frame);
                    frame = await (0, WABinary_1.decodeBinaryNode)(result);
                }
                logger.trace({ msg: (_a = frame === null || frame === void 0 ? void 0 : frame.attrs) === null || _a === void 0 ? void 0 : _a.id }, 'recv frame');
                onFrame(frame);
                size = getBytesSize();
                if (size === 0) { inBytes = Buffer.alloc(0); throw new Error('NOISE_EMPTY_FRAME'); }
            }
        }
    };
};
exports.makeNoiseHandler = makeNoiseHandler;

// Kage: compatibilidad de API.
const __kageModule75 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { Boom } = require("@hapi/boom")
const { proto } = require("../../WAProto")
const {
  NOISE_MODE, 
  WA_CERT_DETAILS
} = require("../Defaults/constants")
const { decodeBinaryNode } = require("../WABinary")
const { 
  aesDecryptGCM, 
  aesEncryptGCM,
  Curve, 
  hkdf, 
  sha256 
} = require("./crypto")

const generateIV = (counter) => {
    const iv = new ArrayBuffer(12)
    new DataView(iv).setUint32(8, counter)
    return new Uint8Array(iv)
}

const makeNoiseHandler = ({ keyPair: { private: privateKey, public: publicKey }, NOISE_HEADER, logger, routingInfo }) => {
    logger = logger.child({ class: 'ns' })
    
    const authenticate = (data) => {
        if (!isFinished) {
            hash = sha256(Buffer.concat([hash, data]))
        }
    }
    
    const encrypt = (plaintext) => {
        const result = aesEncryptGCM(plaintext, encKey, generateIV(writeCounter), hash)
        writeCounter += 1
        authenticate(result)
        return result
    }
    
    const decrypt = (ciphertext) => {
        // before the handshake is finished, we use the same counter
        // after handshake, the counters are different
        const iv = generateIV(isFinished ? readCounter : writeCounter)
        const result = aesDecryptGCM(ciphertext, decKey, iv, hash)
        
        if (isFinished) {
            readCounter += 1
        }
        
        else {
            writeCounter += 1
        }
        
        authenticate(ciphertext)
        
        return result
    }
    
    const localHKDF = async (data) => {
        const key = await hkdf(Buffer.from(data), 64, { salt, info: '' })
        return [key.slice(0, 32), key.slice(32)]
    }
    
    const mixIntoKey = async (data) => {
        const [write, read] = await localHKDF(data)
        salt = write
        encKey = read
        decKey = read
        readCounter = 0
        writeCounter = 0
    }
    
    const finishInit = async () => {
        const [write, read] = await localHKDF(new Uint8Array(0))
        encKey = write
        decKey = read
        hash = Buffer.from([])
        readCounter = 0
        writeCounter = 0
        isFinished = true
    }
    
    const data = Buffer.from(NOISE_MODE)
    
    let hash = data.byteLength === 32 ? data : sha256(data)
    let salt = hash
    let encKey = hash
    let decKey = hash
    let readCounter = 0
    let writeCounter = 0
    let isFinished = false
    let sentIntro = false
    let inBytes = Buffer.alloc(0)
    
    authenticate(NOISE_HEADER)
    authenticate(publicKey)
    
    return {
        encrypt,
        decrypt,
        authenticate,
        mixIntoKey,
        finishInit,
        processHandshake: async ({ serverHello }, noiseKey) => {
            authenticate(serverHello.ephemeral)
            await mixIntoKey(Curve.sharedKey(privateKey, serverHello.ephemeral))
            const decStaticContent = decrypt(serverHello.static)
            await mixIntoKey(Curve.sharedKey(privateKey, decStaticContent))
            const certDecoded = decrypt(serverHello.payload)
            const { intermediate: certIntermediate /*leaf*/ } = proto.CertChain.decode(certDecoded)
            // TODO: handle this leaf stuff
            const { issuerSerial } = proto.CertChain.NoiseCertificate.Details.decode(certIntermediate.details)
            
            if (issuerSerial !== WA_CERT_DETAILS.SERIAL) {
                throw new Boom('certification match failed', { statusCode: 400 })
            }
            
            const keyEnc = encrypt(noiseKey.public)
            
            await mixIntoKey(Curve.sharedKey(noiseKey.private, serverHello.ephemeral))
            
            return keyEnc
        },
        encodeFrame: (data) => {
            if (isFinished) {
                data = encrypt(data)
            }
            
            let header
            
            if (routingInfo) {
                header = Buffer.alloc(7)
                header.write('ED', 0, 'utf8')
                header.writeUint8(0, 2)
                header.writeUint8(1, 3)
                header.writeUint8(routingInfo.byteLength >> 16, 4)
                header.writeUint16BE(routingInfo.byteLength & 65535, 5)
                header = Buffer.concat([header, routingInfo, NOISE_HEADER])
            }
            else {
                header = Buffer.from(NOISE_HEADER)
            }
            
            const introSize = sentIntro ? 0 : header.length
            const frame = Buffer.alloc(introSize + 3 + data.byteLength)
            
            if (!sentIntro) {
                frame.set(header)
                sentIntro = true
            }
            
            frame.writeUInt8(data.byteLength >> 16, introSize)
            frame.writeUInt16BE(65535 & data.byteLength, introSize + 1)
            frame.set(data, introSize + 3)
            return frame
        },
        decodeFrame: async (newData, onFrame) => {
            // the binary protocol uses its own framing mechanism
            // on top of the WS frames
            // so we get this data and separate out the frames
            const getBytesSize = () => {
                if (inBytes.length >= 3) {
                    return (inBytes.readUInt8() << 16) | inBytes.readUInt16BE(1)
                }
            }
            
            inBytes = Buffer.concat([inBytes, newData])
            logger.trace(`recv ${newData.length} bytes, total recv ${inBytes.length} bytes`)
            
            let size = getBytesSize()
            while (size && inBytes.length >= size + 3) {
                let frame = inBytes.slice(3, size + 3)
                
                inBytes = inBytes.slice(size + 3) 
                
                if (isFinished) {
                    const result = decrypt(frame)
                    frame = await decodeBinaryNode(result)
                }
                
                logger.trace({ msg: frame?.attrs?.id }, 'recv frame')
                
                onFrame(frame)
                
                size = getBytesSize()
            }
        }
    }
}

module.exports = {
  makeNoiseHandler
}
return module.exports;
})();
for (const key of Object.keys(__kageModule75)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule75[key]});
}

// Kage: funciones avanzadas.
const __kageModule179 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeNoiseHandler = void 0;
const index_js_1 = require("../../WAProto/index.js");
const index_js_2 = require("../Addon/index.js");
const index_js_3 = require("../Defaults/index.js");
const index_js_4 = require("../WABinary/index.js");
const crypto_js_1 = require("./crypto.js");
const IV_LENGTH = 12;
const EMPTY_BUFFER = Buffer.alloc(0);
const generateIV = (counter) => {
    const iv = new ArrayBuffer(IV_LENGTH);
    new DataView(iv).setUint32(8, counter);
    return new Uint8Array(iv);
};
class TransportState {
    constructor(encKey, decKey) {
        this.encKey = encKey;
        this.decKey = decKey;
        this.readCounter = 0;
        this.writeCounter = 0;
        this.iv = new Uint8Array(IV_LENGTH);
    }
    encrypt(plaintext) {
        const c = this.writeCounter++;
        this.iv[8] = (c >>> 24) & 0xff;
        this.iv[9] = (c >>> 16) & 0xff;
        this.iv[10] = (c >>> 8) & 0xff;
        this.iv[11] = c & 0xff;
        return (0, crypto_js_1.aesEncryptGCM)(plaintext, this.encKey, this.iv, EMPTY_BUFFER);
    }
    decrypt(ciphertext) {
        const c = this.readCounter++;
        this.iv[8] = (c >>> 24) & 0xff;
        this.iv[9] = (c >>> 16) & 0xff;
        this.iv[10] = (c >>> 8) & 0xff;
        this.iv[11] = c & 0xff;
        return (0, crypto_js_1.aesDecryptGCM)(ciphertext, this.decKey, this.iv, EMPTY_BUFFER);
    }
}
const makeNoiseHandler = ({ keyPair: { private: privateKey, public: publicKey }, NOISE_HEADER, logger, routingInfo }) => {
    logger = logger.child({ class: 'ns' });
    const data = Buffer.from(index_js_3.NOISE_MODE);
    let hash = data.byteLength === 32 ? data : (0, crypto_js_1.sha256)(data);
    let salt = hash;
    let encKey = hash;
    let decKey = hash;
    let counter = 0;
    let sentIntro = false;
    let inBytes = Buffer.alloc(0);
    let transport = null;
    let isWaitingForTransport = false;
    let pendingOnFrame = null;
    let introHeader;
    if (routingInfo) {
        introHeader = Buffer.alloc(7 + routingInfo.byteLength + NOISE_HEADER.length);
        introHeader.write('ED', 0, 'utf8');
        introHeader.writeUint8(0, 2);
        introHeader.writeUint8(1, 3);
        introHeader.writeUint8(routingInfo.byteLength >> 16, 4);
        introHeader.writeUint16BE(routingInfo.byteLength & 65535, 5);
        introHeader.set(routingInfo, 7);
        introHeader.set(NOISE_HEADER, 7 + routingInfo.byteLength);
    }
    else {
        introHeader = Buffer.from(NOISE_HEADER);
    }
    const authenticate = (data) => {
        if (!transport) {
            hash = (0, crypto_js_1.sha256)(Buffer.concat([hash, data]));
        }
    };
    const encrypt = (plaintext) => {
        if (transport) {
            return transport.encrypt(plaintext);
        }
        const result = (0, crypto_js_1.aesEncryptGCM)(plaintext, encKey, generateIV(counter++), hash);
        authenticate(result);
        return result;
    };
    const decrypt = (ciphertext) => {
        if (transport) {
            return transport.decrypt(ciphertext);
        }
        const result = (0, crypto_js_1.aesDecryptGCM)(ciphertext, decKey, generateIV(counter++), hash);
        authenticate(ciphertext);
        return result;
    };
    const localHKDF = (data) => {
        const key = (0, crypto_js_1.hkdf)(Buffer.from(data), 64, { salt, info: '' });
        return [key.subarray(0, 32), key.subarray(32)];
    };
    const mixIntoKey = (data) => {
        const [write, read] = localHKDF(data);
        salt = write;
        encKey = read;
        decKey = read;
        counter = 0;
    };
    const finishInit = async () => {
        isWaitingForTransport = true;
        const [write, read] = localHKDF(new Uint8Array(0));
        transport = new TransportState(write, read);
        isWaitingForTransport = false;
        logger.trace('Noise handler transitioned to Transport state');
        if (pendingOnFrame) {
            logger.trace({ length: inBytes.length }, 'Flushing buffered frames after transport ready');
            await processData(pendingOnFrame);
            pendingOnFrame = null;
        }
    };
    const processData = async (onFrame) => {
        let size;
        while (true) {
            if (inBytes.length < 3)
                return;
            size = (inBytes[0] << 16) | (inBytes[1] << 8) | inBytes[2];
            if (inBytes.length < size + 3)
                return;
            let frame = inBytes.subarray(3, size + 3);
            inBytes = inBytes.subarray(size + 3);
            if (transport) {
                const result = transport.decrypt(frame);
                frame = await (0, index_js_4.decodeBinaryNode)(result);
            }
            if (logger.level === 'trace') {
                logger.trace({ msg: frame?.attrs?.id }, 'recv frame');
            }
            onFrame(frame);
        }
    };
    authenticate(NOISE_HEADER);
    authenticate(publicKey);
    return {
        encrypt,
        decrypt,
        authenticate,
        mixIntoKey,
        finishInit,
        processHandshake: ({ serverHello }, noiseKey) => {
            authenticate(serverHello.ephemeral);
            mixIntoKey(crypto_js_1.Curve.sharedKey(privateKey, serverHello.ephemeral));
            const decStaticContent = decrypt(serverHello.static);
            mixIntoKey(crypto_js_1.Curve.sharedKey(privateKey, decStaticContent));
            const certDecoded = decrypt(serverHello.payload);
            const { intermediate: certIntermediate, leaf } = index_js_1.proto.CertChain.decode(certDecoded);
            // leaf
            if (!leaf?.details || !leaf?.signature) {
                throw new index_js_2.HttpError('invalid noise leaf certificate', { statusCode: 400 });
            }
            if (!certIntermediate?.details || !certIntermediate?.signature) {
                throw new index_js_2.HttpError('invalid noise intermediate certificate', { statusCode: 400 });
            }
            const details = index_js_1.proto.CertChain.NoiseCertificate.Details.decode(certIntermediate.details);
            const { issuerSerial } = details;
            const verify = crypto_js_1.Curve.verify(details.key, leaf.details, leaf.signature);
            const verifyIntermediate = crypto_js_1.Curve.verify(index_js_3.WA_CERT_DETAILS.PUBLIC_KEY, certIntermediate.details, certIntermediate.signature);
            if (!verify) {
                throw new index_js_2.HttpError('noise certificate signature invalid', { statusCode: 400 });
            }
            if (!verifyIntermediate) {
                throw new index_js_2.HttpError('noise intermediate certificate signature invalid', { statusCode: 400 });
            }
            if (issuerSerial !== index_js_3.WA_CERT_DETAILS.SERIAL) {
                throw new index_js_2.HttpError('certification match failed', { statusCode: 400 });
            }
            const keyEnc = encrypt(noiseKey.public);
            mixIntoKey(crypto_js_1.Curve.sharedKey(noiseKey.private, serverHello.ephemeral));
            return keyEnc;
        },
        encodeFrame: (data) => {
            if (transport) {
                data = transport.encrypt(data);
            }
            const dataLen = data.byteLength;
            const introSize = sentIntro ? 0 : introHeader.length;
            const frame = Buffer.allocUnsafe(introSize + 3 + dataLen);
            if (!sentIntro) {
                frame.set(introHeader);
                sentIntro = true;
            }
            frame[introSize] = (dataLen >>> 16) & 0xff;
            frame[introSize + 1] = (dataLen >>> 8) & 0xff;
            frame[introSize + 2] = dataLen & 0xff;
            frame.set(data, introSize + 3);
            return frame;
        },
        decodeFrame: async (newData, onFrame) => {
            if (isWaitingForTransport) {
                inBytes = Buffer.concat([inBytes, newData]);
                pendingOnFrame = onFrame;
                return;
            }
            if (inBytes.length === 0) {
                inBytes = Buffer.from(newData);
            }
            else {
                inBytes = Buffer.concat([inBytes, newData]);
            }
            await processData(onFrame);
        }
    };
};
exports.makeNoiseHandler = makeNoiseHandler;

return module.exports;
})();
for (const key of Object.keys(__kageModule179)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule179[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule179, configurable:true});
