"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SenderChainKey = void 0;
const crypto_1 = require("libsignal/src/crypto");
const sender_message_key_1 = require("./sender-message-key");
class SenderChainKey {
    constructor(iteration, chainKey) {
        this.MESSAGE_KEY_SEED = Buffer.from([0x01]);
        this.CHAIN_KEY_SEED = Buffer.from([0x02]);
        this.iteration = iteration;
        if (chainKey instanceof Buffer) {
            this.chainKey = chainKey;
        }
        else {
            this.chainKey = Buffer.from(chainKey || []);
        }
    }
    getIteration() {
        return this.iteration;
    }
    getSenderMessageKey() {
        return new sender_message_key_1.SenderMessageKey(this.iteration, this.getDerivative(this.MESSAGE_KEY_SEED, this.chainKey));
    }
    getNext() {
        return new SenderChainKey(this.iteration + 1, this.getDerivative(this.CHAIN_KEY_SEED, this.chainKey));
    }
    getSeed() {
        return this.chainKey;
    }
    getDerivative(seed, key) {
        return (0, crypto_1.calculateMAC)(key, seed);
    }
}
exports.SenderChainKey = SenderChainKey;

// Kage: compatibilidad de API.
const __kageModule12 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { calculateMAC } = require("@itsukichan/libsignal-node/src/crypto")
const { SenderMessageKey } = require("./sender-message-key")

class SenderChainKey {
    constructor(iteration, chainKey) {
        this.MESSAGE_KEY_SEED = Buffer.from([0x01])
        this.CHAIN_KEY_SEED = Buffer.from([0x02])
        this.iteration = iteration
        this.chainKey = Buffer.from(chainKey)
    }
    getIteration() {
        return this.iteration
    }
    getSenderMessageKey() {
        return new SenderMessageKey(this.iteration, this.getDerivative(this.MESSAGE_KEY_SEED, this.chainKey))
    }
    getNext() {
        return new SenderChainKey(this.iteration + 1, this.getDerivative(this.CHAIN_KEY_SEED, this.chainKey))
    }
    getSeed() {
        return this.chainKey
    }
    getDerivative(seed, key) {
        return calculateMAC(key, seed)
    }
}

module.exports = {
  SenderChainKey
}
return module.exports;
})();
for (const key of Object.keys(__kageModule12)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule12[key]});
}

// Kage: funciones avanzadas.
const __kageModule118 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SenderChainKey = void 0;
const crypto_js_1 = require("libsignal/src/crypto.js");
const sender_message_key_js_1 = require("./sender-message-key.js");
class SenderChainKey {
    constructor(iteration, chainKey) {
        this.MESSAGE_KEY_SEED = Buffer.from([0x01]);
        this.CHAIN_KEY_SEED = Buffer.from([0x02]);
        this.iteration = iteration;
        this.chainKey = Buffer.from(chainKey);
    }
    getIteration() {
        return this.iteration;
    }
    getSenderMessageKey() {
        return new sender_message_key_js_1.SenderMessageKey(this.iteration, this.getDerivative(this.MESSAGE_KEY_SEED, this.chainKey));
    }
    getNext() {
        return new SenderChainKey(this.iteration + 1, this.getDerivative(this.CHAIN_KEY_SEED, this.chainKey));
    }
    getSeed() {
        return this.chainKey;
    }
    getDerivative(seed, key) {
        return (0, crypto_js_1.calculateMAC)(key, seed);
    }
}
exports.SenderChainKey = SenderChainKey;

return module.exports;
})();
for (const key of Object.keys(__kageModule118)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule118[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule118, configurable:true});
