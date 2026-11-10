"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SenderKeyState = void 0;
const sender_chain_key_1 = require("./sender-chain-key");
const sender_message_key_1 = require("./sender-message-key");
class SenderKeyState {
    constructor(id, iteration, chainKey, signatureKeyPair, signatureKeyPublic, signatureKeyPrivate, senderKeyStateStructure) {
        this.MAX_MESSAGE_KEYS = 2000;
        if (senderKeyStateStructure) {
            this.senderKeyStateStructure = senderKeyStateStructure;
        }
        else {
            if (signatureKeyPair) {
                signatureKeyPublic = signatureKeyPair.public;
                signatureKeyPrivate = signatureKeyPair.private;
            }
            chainKey = typeof chainKey === 'string' ? Buffer.from(chainKey, 'base64') : chainKey;
            const senderChainKeyStructure = {
                iteration: iteration || 0,
                seed: chainKey || Buffer.alloc(0)
            };
            const signingKeyStructure = {
                public: typeof signatureKeyPublic === 'string'
                    ? Buffer.from(signatureKeyPublic, 'base64')
                    : signatureKeyPublic || Buffer.alloc(0)
            };
            if (signatureKeyPrivate) {
                signingKeyStructure.private =
                    typeof signatureKeyPrivate === 'string' ? Buffer.from(signatureKeyPrivate, 'base64') : signatureKeyPrivate;
            }
            this.senderKeyStateStructure = {
                senderKeyId: id || 0,
                senderChainKey: senderChainKeyStructure,
                senderSigningKey: signingKeyStructure,
                senderMessageKeys: []
            };
        }
    }
    getKeyId() {
        return this.senderKeyStateStructure.senderKeyId;
    }
    getSenderChainKey() {
        return new sender_chain_key_1.SenderChainKey(this.senderKeyStateStructure.senderChainKey.iteration, this.senderKeyStateStructure.senderChainKey.seed);
    }
    setSenderChainKey(chainKey) {
        this.senderKeyStateStructure.senderChainKey = {
            iteration: chainKey.getIteration(),
            seed: chainKey.getSeed()
        };
    }
    getSigningKeyPublic() {
        const publicKey = this.senderKeyStateStructure.senderSigningKey.public;
        if (publicKey instanceof Buffer) {
            return publicKey;
        }
        else if (typeof publicKey === 'string') {
            return Buffer.from(publicKey, 'base64');
        }
        return Buffer.from(publicKey || []);
    }
    getSigningKeyPrivate() {
        const privateKey = this.senderKeyStateStructure.senderSigningKey.private;
        if (!privateKey) {
            return undefined;
        }
        if (privateKey instanceof Buffer) {
            return privateKey;
        }
        else if (typeof privateKey === 'string') {
            return Buffer.from(privateKey, 'base64');
        }
        return Buffer.from(privateKey || []);
    }
    hasSenderMessageKey(iteration) {
        return this.senderKeyStateStructure.senderMessageKeys.some(key => key.iteration === iteration);
    }
    addSenderMessageKey(senderMessageKey) {
        this.senderKeyStateStructure.senderMessageKeys.push({
            iteration: senderMessageKey.getIteration(),
            seed: senderMessageKey.getSeed()
        });
        if (this.senderKeyStateStructure.senderMessageKeys.length > this.MAX_MESSAGE_KEYS) {
            this.senderKeyStateStructure.senderMessageKeys.shift();
        }
    }
    removeSenderMessageKey(iteration) {
        const index = this.senderKeyStateStructure.senderMessageKeys.findIndex(key => key.iteration === iteration);
        if (index !== -1) {
            const messageKey = this.senderKeyStateStructure.senderMessageKeys[index];
            this.senderKeyStateStructure.senderMessageKeys.splice(index, 1);
            return new sender_message_key_1.SenderMessageKey(messageKey.iteration, messageKey.seed);
        }
        return null;
    }
    getStructure() {
        return this.senderKeyStateStructure;
    }
}
exports.SenderKeyState = SenderKeyState;

// Kage: compatibilidad de API.
const __kageModule17 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { SenderChainKey } = require("./sender-chain-key")
const { SenderMessageKey } = require("./sender-message-key")

class SenderKeyState {
    constructor(id, iteration, chainKey, signatureKeyPair, signatureKeyPublic, signatureKeyPrivate, senderKeyStateStructure) {
        this.MAX_MESSAGE_KEYS = 2000
        
        if (senderKeyStateStructure) {
            this.senderKeyStateStructure = {
                ...senderKeyStateStructure,
                senderMessageKeys: Array.isArray(senderKeyStateStructure.senderMessageKeys)
                    ? senderKeyStateStructure.senderMessageKeys
                    : []
            }
        }
        else {
            if (signatureKeyPair) {
                signatureKeyPublic = signatureKeyPair.public
                signatureKeyPrivate = signatureKeyPair.private
            }
            
            this.senderKeyStateStructure = {
                senderKeyId: id || 0,
                senderChainKey: {
                    iteration: iteration || 0,
                    seed: Buffer.from(chainKey || [])
                },
                senderSigningKey: {
                    public: Buffer.from(signatureKeyPublic || []),
                    private: Buffer.from(signatureKeyPrivate || [])
                },
                senderMessageKeys: []
            }
        }
    }
    getKeyId() {
        return this.senderKeyStateStructure.senderKeyId
    }
    getSenderChainKey() {
        return new SenderChainKey(this.senderKeyStateStructure.senderChainKey.iteration, this.senderKeyStateStructure.senderChainKey.seed)
    }
    setSenderChainKey(chainKey) {
        this.senderKeyStateStructure.senderChainKey = {
            iteration: chainKey.getIteration(),
            seed: chainKey.getSeed()
        }
    }
    getSigningKeyPublic() {
        const publicKey = Buffer.from(this.senderKeyStateStructure.senderSigningKey.public)
        
        if (publicKey.length === 32) {
            const fixed = Buffer.alloc(33)
            
            fixed[0] = 0x05
            publicKey.copy(fixed, 1)
            
            return fixed
        }
        
        return publicKey
    }
    getSigningKeyPrivate() {
        const privateKey = this.senderKeyStateStructure.senderSigningKey.private
        return Buffer.from(privateKey || [])
    }
    hasSenderMessageKey(iteration) {
        return this.senderKeyStateStructure.senderMessageKeys.some(key => key.iteration === iteration)
    }
    addSenderMessageKey(senderMessageKey) {
        this.senderKeyStateStructure.senderMessageKeys.push({
            iteration: senderMessageKey.getIteration(),
            seed: senderMessageKey.getSeed()
        })
        
        if (this.senderKeyStateStructure.senderMessageKeys.length > this.MAX_MESSAGE_KEYS) {
            this.senderKeyStateStructure.senderMessageKeys.shift()
        }
    }
    removeSenderMessageKey(iteration) {
        const index = this.senderKeyStateStructure.senderMessageKeys.findIndex(key => key.iteration === iteration)
        
        if (index !== -1) {
            const messageKey = this.senderKeyStateStructure.senderMessageKeys[index]
            this.senderKeyStateStructure.senderMessageKeys.splice(index, 1)
            return new SenderMessageKey(messageKey.iteration, messageKey.seed)
        }
        
        return null
    }
    getStructure() {
        return this.senderKeyStateStructure
    }
}

module.exports = {
  SenderKeyState
}
return module.exports;
})();
for (const key of Object.keys(__kageModule17)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule17[key]});
}

// Kage: funciones avanzadas.
const __kageModule123 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SenderKeyState = void 0;
const sender_chain_key_js_1 = require("./sender-chain-key.js");
const sender_message_key_js_1 = require("./sender-message-key.js");
class SenderKeyState {
    constructor(id, iteration, chainKey, signatureKeyPair, signatureKeyPublic, signatureKeyPrivate, senderKeyStateStructure) {
        this.MAX_MESSAGE_KEYS = 2000;
        if (senderKeyStateStructure) {
            this.senderKeyStateStructure = {
                ...senderKeyStateStructure,
                senderMessageKeys: Array.isArray(senderKeyStateStructure.senderMessageKeys)
                    ? senderKeyStateStructure.senderMessageKeys
                    : []
            };
        }
        else {
            if (signatureKeyPair) {
                signatureKeyPublic = signatureKeyPair.public;
                signatureKeyPrivate = signatureKeyPair.private;
            }
            this.senderKeyStateStructure = {
                senderKeyId: id || 0,
                senderChainKey: {
                    iteration: iteration || 0,
                    seed: Buffer.from(chainKey || [])
                },
                senderSigningKey: {
                    public: Buffer.from(signatureKeyPublic || []),
                    private: Buffer.from(signatureKeyPrivate || [])
                },
                senderMessageKeys: []
            };
        }
    }
    getKeyId() {
        return this.senderKeyStateStructure.senderKeyId;
    }
    getSenderChainKey() {
        return new sender_chain_key_js_1.SenderChainKey(this.senderKeyStateStructure.senderChainKey.iteration, this.senderKeyStateStructure.senderChainKey.seed);
    }
    setSenderChainKey(chainKey) {
        this.senderKeyStateStructure.senderChainKey = {
            iteration: chainKey.getIteration(),
            seed: chainKey.getSeed()
        };
    }
    getSigningKeyPublic() {
        const publicKey = Buffer.from(this.senderKeyStateStructure.senderSigningKey.public);
        if (publicKey.length === 32) {
            const fixed = Buffer.alloc(33);
            fixed[0] = 0x05;
            publicKey.copy(fixed, 1);
            return fixed;
        }
        return publicKey;
    }
    getSigningKeyPrivate() {
        const privateKey = this.senderKeyStateStructure.senderSigningKey.private;
        return Buffer.from(privateKey || []);
    }
    hasSenderMessageKey(iteration) {
        return this.senderKeyStateStructure.senderMessageKeys.some(key => key.iteration === iteration);
    }
    addSenderMessageKey(senderMessageKey) {
        this.senderKeyStateStructure.senderMessageKeys.push({
            iteration: senderMessageKey.getIteration(),
            seed: senderMessageKey.getSeed()
        });
        if (this.senderKeyStateStructure.senderMessageKeys.length > this.MAX_MESSAGE_KEYS) {
            this.senderKeyStateStructure.senderMessageKeys.shift();
        }
    }
    removeSenderMessageKey(iteration) {
        const index = this.senderKeyStateStructure.senderMessageKeys.findIndex(key => key.iteration === iteration);
        if (index !== -1) {
            const messageKey = this.senderKeyStateStructure.senderMessageKeys[index];
            this.senderKeyStateStructure.senderMessageKeys.splice(index, 1);
            return new sender_message_key_js_1.SenderMessageKey(messageKey.iteration, messageKey.seed);
        }
        return null;
    }
    getStructure() {
        return this.senderKeyStateStructure;
    }
}
exports.SenderKeyState = SenderKeyState;

return module.exports;
})();
for (const key of Object.keys(__kageModule123)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule123[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule123, configurable:true});
