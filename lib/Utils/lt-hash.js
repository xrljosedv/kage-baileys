"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LT_HASH_ANTI_TAMPERING = void 0;
const crypto_1 = require("./crypto");
/**
 * LT Hash is a summation based hash algorithm that maintains the integrity of a piece of data
 * over a series of mutations. You can add/remove mutations and it'll return a hash equal to
 * if the same series of mutations was made sequentially.
 */
const o = 128;
class d {
    constructor(e) {
        this.salt = e;
    }
    add(e, t) {
        var r = this;
        for (const item of t) {
            e = r._addSingle(e, item);
        }
        return e;
    }
    subtract(e, t) {
        var r = this;
        for (const item of t) {
            e = r._subtractSingle(e, item);
        }
        return e;
    }
    subtractThenAdd(e, t, r) {
        var n = this;
        return n.add(n.subtract(e, r), t);
    }
    async _addSingle(e, t) {
        var r = this;
        const n = new Uint8Array(await (0, crypto_1.hkdf)(Buffer.from(t), o, { info: r.salt })).buffer;
        return r.performPointwiseWithOverflow(await e, n, ((e, t) => e + t));
    }
    async _subtractSingle(e, t) {
        var r = this;
        const n = new Uint8Array(await (0, crypto_1.hkdf)(Buffer.from(t), o, { info: r.salt })).buffer;
        return r.performPointwiseWithOverflow(await e, n, ((e, t) => e - t));
    }
    performPointwiseWithOverflow(e, t, r) {
        const n = new DataView(e), i = new DataView(t), a = new ArrayBuffer(n.byteLength), s = new DataView(a);
        for (let e = 0; e < n.byteLength; e += 2) {
            s.setUint16(e, r(n.getUint16(e, !0), i.getUint16(e, !0)), !0);
        }
        return a;
    }
}
exports.LT_HASH_ANTI_TAMPERING = new d('WhatsApp Patch Integrity');

// Kage: compatibilidad de API.
const __kageModule70 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { hkdf } = require("./crypto")

/**
 * LT Hash is a summation based hash algorithm that maintains the integrity of a piece of data
 * over a series of mutations. You can add/remove mutations and it'll return a hash equal to
 * if the same series of mutations was made sequentially.
 */
const o = 128

class LTHash {
    constructor(e) {
        this.salt = e
    }
    
    async add(e, t) {
        for (const item of t) {
            e = await this._addSingle(e, item)
        }
        return e
    }
    
    async subtract(e, t) {
        for (const item of t) {
            e = await this._subtractSingle(e, item)
        }
        return e
    }
    
    async subtractThenAdd(e, addList, subtractList) {
        const subtracted = await this.subtract(e, subtractList)
        return this.add(subtracted, addList)
    }
    
    async _addSingle(e, t) {
        const derived = new Uint8Array(await hkdf(Buffer.from(t), o, { info: this.salt })).buffer
        return this.performPointwiseWithOverflow(e, derived, (a, b) => a + b)
    }
    
    async _subtractSingle(e, t) {
        const derived = new Uint8Array(await hkdf(Buffer.from(t), o, { info: this.salt })).buffer
        return this.performPointwiseWithOverflow(e, derived, (a, b) => a - b)
    }
    
    performPointwiseWithOverflow(e, t, op) {
        const n = new DataView(e)
        const i = new DataView(t)
        const out = new ArrayBuffer(n.byteLength)
        const s = new DataView(out)
        for (let offset = 0; offset < n.byteLength; offset += 2) {
            s.setUint16(offset, op(n.getUint16(offset, true), i.getUint16(offset, true)), true)
        }
        return out
    }
}

const LT_HASH_ANTI_TAMPERING = new LTHash('WhatsApp Patch Integrity')

module.exports = {
  LT_HASH_ANTI_TAMPERING
}
return module.exports;
})();
for (const key of Object.keys(__kageModule70)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule70[key]});
}
