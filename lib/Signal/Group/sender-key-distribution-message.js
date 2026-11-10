"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SenderKeyDistributionMessage = void 0;
const WAProto_1 = require("../../../WAProto");
const ciphertext_message_1 = require("./ciphertext-message");
class SenderKeyDistributionMessage extends ciphertext_message_1.CiphertextMessage {
    constructor(id, iteration, chainKey, signatureKey, serialized) {
        super();
        if (serialized) {
            try {
                const message = serialized.slice(1);
                const distributionMessage = WAProto_1.proto.SenderKeyDistributionMessage.decode(message).toJSON();
                this.serialized = serialized;
                this.id = distributionMessage.id;
                this.iteration = distributionMessage.iteration;
                this.chainKey =
                    typeof distributionMessage.chainKey === 'string'
                        ? Buffer.from(distributionMessage.chainKey, 'base64')
                        : distributionMessage.chainKey;
                this.signatureKey =
                    typeof distributionMessage.signingKey === 'string'
                        ? Buffer.from(distributionMessage.signingKey, 'base64')
                        : distributionMessage.signingKey;
            }
            catch (e) {
                throw new Error(String(e));
            }
        }
        else {
            const version = this.intsToByteHighAndLow(this.CURRENT_VERSION, this.CURRENT_VERSION);
            this.id = id;
            this.iteration = iteration;
            this.chainKey = chainKey;
            this.signatureKey = signatureKey;
            const message = WAProto_1.proto.SenderKeyDistributionMessage.encode(WAProto_1.proto.SenderKeyDistributionMessage.create({
                id,
                iteration,
                chainKey,
                signingKey: this.signatureKey
            })).finish();
            this.serialized = Buffer.concat([Buffer.from([version]), message]);
        }
    }
    intsToByteHighAndLow(highValue, lowValue) {
        return (((highValue << 4) | lowValue) & 0xff) % 256;
    }
    serialize() {
        return this.serialized;
    }
    getType() {
        return this.SENDERKEY_DISTRIBUTION_TYPE;
    }
    getIteration() {
        return this.iteration;
    }
    getChainKey() {
        return typeof this.chainKey === 'string' ? Buffer.from(this.chainKey, 'base64') : this.chainKey;
    }
    getSignatureKey() {
        return typeof this.signatureKey === 'string' ? Buffer.from(this.signatureKey, 'base64') : this.signatureKey;
    }
    getId() {
        return this.id;
    }
}
exports.SenderKeyDistributionMessage = SenderKeyDistributionMessage;

// Kage: compatibilidad de API.
const __kageModule13 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { proto } = require("../../../WAProto")
const { CiphertextMessage } = require("./ciphertext-message")

class SenderKeyDistributionMessage extends CiphertextMessage {
    constructor(id, iteration, chainKey, signatureKey, serialized) {
        super()
        if (serialized) {
            try {
                const message = serialized.slice(1)
                const distributionMessage = proto.SenderKeyDistributionMessage.decode(message).toJSON()
                this.serialized = serialized
                this.id = distributionMessage.id
                this.iteration = distributionMessage.iteration
                this.chainKey =
                    typeof distributionMessage.chainKey === 'string'
                        ? Buffer.from(distributionMessage.chainKey, 'base64')
                        : distributionMessage.chainKey
                this.signatureKey =
                    typeof distributionMessage.signingKey === 'string'
                        ? Buffer.from(distributionMessage.signingKey, 'base64')
                        : distributionMessage.signingKey
            }
            catch (e) {
                throw new Error(String(e))
            }
        }
        else {
            const version = this.intsToByteHighAndLow(this.CURRENT_VERSION, this.CURRENT_VERSION)
            this.id = id
            this.iteration = iteration
            this.chainKey = chainKey
            this.signatureKey = signatureKey
            const message = proto.SenderKeyDistributionMessage.encode(proto.SenderKeyDistributionMessage.create({
                id,
                iteration,
                chainKey,
                signingKey: this.signatureKey
            })).finish()
            this.serialized = Buffer.concat([Buffer.from([version]), message])
        }
    }
    intsToByteHighAndLow(highValue, lowValue) {
        return (((highValue << 4) | lowValue) & 0xff) % 256
    }
    serialize() {
        return this.serialized
    }
    getType() {
        return this.SENDERKEY_DISTRIBUTION_TYPE
    }
    getIteration() {
        return this.iteration
    }
    getChainKey() {
        return this.chainKey
    }
    getSignatureKey() {
        return this.signatureKey
    }
    getId() {
        return this.id
    }
}

module.exports = {
  SenderKeyDistributionMessage
}
return module.exports;
})();
for (const key of Object.keys(__kageModule13)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule13[key]});
}

// Kage: funciones avanzadas.
const __kageModule119 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SenderKeyDistributionMessage = void 0;
const index_js_1 = require("../../../WAProto/index.js");
const ciphertext_message_js_1 = require("./ciphertext-message.js");
class SenderKeyDistributionMessage extends ciphertext_message_js_1.CiphertextMessage {
    constructor(id, iteration, chainKey, signatureKey, serialized) {
        super();
        if (serialized) {
            try {
                const message = serialized.slice(1);
                const distributionMessage = index_js_1.proto.SenderKeyDistributionMessage.decode(message).toJSON();
                this.serialized = serialized;
                this.id = distributionMessage.id;
                this.iteration = distributionMessage.iteration;
                this.chainKey =
                    typeof distributionMessage.chainKey === 'string'
                        ? Buffer.from(distributionMessage.chainKey, 'base64')
                        : distributionMessage.chainKey;
                this.signatureKey =
                    typeof distributionMessage.signingKey === 'string'
                        ? Buffer.from(distributionMessage.signingKey, 'base64')
                        : distributionMessage.signingKey;
            }
            catch (e) {
                throw new Error(String(e));
            }
        }
        else {
            const version = this.intsToByteHighAndLow(this.CURRENT_VERSION, this.CURRENT_VERSION);
            this.id = id;
            this.iteration = iteration;
            this.chainKey = chainKey;
            this.signatureKey = signatureKey;
            const message = index_js_1.proto.SenderKeyDistributionMessage.encode(index_js_1.proto.SenderKeyDistributionMessage.create({
                id,
                iteration,
                chainKey,
                signingKey: this.signatureKey
            })).finish();
            this.serialized = Buffer.concat([Buffer.from([version]), message]);
        }
    }
    intsToByteHighAndLow(highValue, lowValue) {
        return (((highValue << 4) | lowValue) & 0xff) % 256;
    }
    serialize() {
        return this.serialized;
    }
    getType() {
        return this.SENDERKEY_DISTRIBUTION_TYPE;
    }
    getIteration() {
        return this.iteration;
    }
    getChainKey() {
        return this.chainKey;
    }
    getSignatureKey() {
        return this.signatureKey;
    }
    getId() {
        return this.id;
    }
}
exports.SenderKeyDistributionMessage = SenderKeyDistributionMessage;

return module.exports;
})();
for (const key of Object.keys(__kageModule119)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule119[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule119, configurable:true});
