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
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSenderKey = generateSenderKey;
exports.generateSenderKeyId = generateSenderKeyId;
exports.generateSenderSigningKey = generateSenderSigningKey;
const nodeCrypto = __importStar(require("crypto"));
const curve_1 = require("libsignal/src/curve");
function generateSenderKey() {
    return nodeCrypto.randomBytes(32);
}
function generateSenderKeyId() {
    return nodeCrypto.randomInt(2147483647);
}
function generateSenderSigningKey(key) {
    if (!key) {
        key = (0, curve_1.generateKeyPair)();
    }
    return {
        public: Buffer.from(key.pubKey),
        private: Buffer.from(key.privKey)
    };
}

 
const __kageModule11 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { 
  randomInt, 
  randomBytes 
} = require("crypto")
const { generateKeyPair } = require("libsignal/src/curve")

function generateSenderKey() {
    return randomBytes(32)
}

function generateSenderKeyId() {
    return randomInt(2147483647)
}

function generateSenderSigningKey(key) {
    if (!key) {
        key = generateKeyPair()
    }
    return {
        public: Buffer.from(key.pubKey),
        private: Buffer.from(key.privKey)
    }
}

module.exports = {
  generateSenderKey, 
  generateSenderKeyId, 
  generateSenderSigningKey
}
return module.exports;
})();
for (const key of Object.keys(__kageModule11)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule11[key]});
}

 
const __kageModule117 = (() => {
const module = { exports: {} }; const exports = module.exports;
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSenderKey = generateSenderKey;
exports.generateSenderKeyId = generateSenderKeyId;
exports.generateSenderSigningKey = generateSenderSigningKey;
const nodeCrypto = __importStar(require("crypto"));
const curve_js_1 = require("libsignal/src/curve.js");
function generateSenderKey() {
    return nodeCrypto.randomBytes(32);
}
function generateSenderKeyId() {
    return nodeCrypto.randomInt(2147483647);
}
function generateSenderSigningKey(key) {
    if (!key) {
        key = (0, curve_js_1.generateKeyPair)();
    }
    return {
        public: Buffer.from(key.pubKey),
        private: Buffer.from(key.privKey)
    };
}

return module.exports;
})();
for (const key of Object.keys(__kageModule117)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule117[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule117, configurable:true});
