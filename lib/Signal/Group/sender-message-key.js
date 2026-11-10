"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SenderMessageKey = void 0;
const crypto_1 = require("libsignal/src/crypto");
class SenderMessageKey {
    constructor(iteration, seed) {
        const derivative = (0, crypto_1.deriveSecrets)(seed, Buffer.alloc(32), Buffer.from('WhisperGroup'));
        const keys = new Uint8Array(32);
        keys.set(new Uint8Array(derivative[0].slice(16)));
        keys.set(new Uint8Array(derivative[1].slice(0, 16)), 16);
        this.iv = Buffer.from(derivative[0].slice(0, 16));
        this.cipherKey = Buffer.from(keys.buffer);
        this.iteration = iteration;
        this.seed = seed;
    }
    getIteration() {
        return this.iteration;
    }
    getIv() {
        return this.iv;
    }
    getCipherKey() {
        return this.cipherKey;
    }
    getSeed() {
        return this.seed;
    }
}
exports.SenderMessageKey = SenderMessageKey;

// Kage: compatibilidad de API.
const __kageModule18 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"
Object.defineProperty(exports, "__esModule", { value: true })

const { deriveSecrets } = require("@itsukichan/libsignal-node/src/crypto")

class SenderMessageKey {
    constructor(iteration, seed) {
        const derivative = deriveSecrets(seed, Buffer.alloc(32), Buffer.from('WhisperGroup'))
        const keys = new Uint8Array(32)
        keys.set(new Uint8Array(derivative[0].slice(16)))
        keys.set(new Uint8Array(derivative[1].slice(0, 16)), 16)
        this.iv = Buffer.from(derivative[0].slice(0, 16))
        this.cipherKey = Buffer.from(keys.buffer)
        this.iteration = iteration
        this.seed = seed
    }
    getIteration() {
        return this.iteration
    }
    getIv() {
        return this.iv
    }
    getCipherKey() {
        return this.cipherKey
    }
    getSeed() {
        return this.seed
    }
}

module.exports = {
  SenderMessageKey
}
return module.exports;
})();
for (const key of Object.keys(__kageModule18)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule18[key]});
}

// Kage: funciones avanzadas.
const __kageModule124 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SenderMessageKey = void 0;
const crypto_js_1 = require("libsignal/src/crypto.js");
class SenderMessageKey {
    constructor(iteration, seed) {
        const derivative = (0, crypto_js_1.deriveSecrets)(seed, Buffer.alloc(32), Buffer.from('WhisperGroup'));
        const keys = new Uint8Array(32);
        keys.set(new Uint8Array(derivative[0].slice(16)));
        keys.set(new Uint8Array(derivative[1].slice(0, 16)), 16);
        this.iv = Buffer.from(derivative[0].slice(0, 16));
        this.cipherKey = Buffer.from(keys.buffer);
        this.iteration = iteration;
        this.seed = seed;
    }
    getIteration() {
        return this.iteration;
    }
    getIv() {
        return this.iv;
    }
    getCipherKey() {
        return this.cipherKey;
    }
    getSeed() {
        return this.seed;
    }
}
exports.SenderMessageKey = SenderMessageKey;

return module.exports;
})();
for (const key of Object.keys(__kageModule124)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule124[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule124, configurable:true});
