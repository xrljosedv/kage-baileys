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
exports.keyhelper = exports.CiphertextMessage = exports.SenderChainKey = exports.SenderMessageKey = exports.SenderKeyMessage = exports.SenderKeyState = exports.GroupCipher = exports.SenderKeyName = exports.SenderKeyRecord = exports.SenderKeyDistributionMessage = exports.GroupSessionBuilder = void 0;
var group_session_builder_1 = require("./group-session-builder");
Object.defineProperty(exports, "GroupSessionBuilder", { enumerable: true, get: function () { return group_session_builder_1.GroupSessionBuilder; } });
var sender_key_distribution_message_1 = require("./sender-key-distribution-message");
Object.defineProperty(exports, "SenderKeyDistributionMessage", { enumerable: true, get: function () { return sender_key_distribution_message_1.SenderKeyDistributionMessage; } });
var sender_key_record_1 = require("./sender-key-record");
Object.defineProperty(exports, "SenderKeyRecord", { enumerable: true, get: function () { return sender_key_record_1.SenderKeyRecord; } });
var sender_key_name_1 = require("./sender-key-name");
Object.defineProperty(exports, "SenderKeyName", { enumerable: true, get: function () { return sender_key_name_1.SenderKeyName; } });
var group_cipher_1 = require("./group_cipher");
Object.defineProperty(exports, "GroupCipher", { enumerable: true, get: function () { return group_cipher_1.GroupCipher; } });
var sender_key_state_1 = require("./sender-key-state");
Object.defineProperty(exports, "SenderKeyState", { enumerable: true, get: function () { return sender_key_state_1.SenderKeyState; } });
var sender_key_message_1 = require("./sender-key-message");
Object.defineProperty(exports, "SenderKeyMessage", { enumerable: true, get: function () { return sender_key_message_1.SenderKeyMessage; } });
var sender_message_key_1 = require("./sender-message-key");
Object.defineProperty(exports, "SenderMessageKey", { enumerable: true, get: function () { return sender_message_key_1.SenderMessageKey; } });
var sender_chain_key_1 = require("./sender-chain-key");
Object.defineProperty(exports, "SenderChainKey", { enumerable: true, get: function () { return sender_chain_key_1.SenderChainKey; } });
var ciphertext_message_1 = require("./ciphertext-message");
Object.defineProperty(exports, "CiphertextMessage", { enumerable: true, get: function () { return ciphertext_message_1.CiphertextMessage; } });
exports.keyhelper = __importStar(require("./keyhelper"));

// Kage: compatibilidad de API.
const __kageModule10 = (() => {
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

__exportStar(require("./ciphertext-message"), exports)
__exportStar(require("./group-session-builder"), exports)
__exportStar(require("./group_cipher"), exports)
__exportStar(require("./keyhelper"), exports)
__exportStar(require("./sender-chain-key"), exports) 
__exportStar(require("./sender-key-distribution-message"), exports)
__exportStar(require("./sender-key-message"), exports)
__exportStar(require("./sender-key-name"), exports)
__exportStar(require("./sender-key-record"), exports)
__exportStar(require("./sender-key-state"), exports)
__exportStar(require("./sender-message-key"), exports)
return module.exports;
})();
for (const key of Object.keys(__kageModule10)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule10[key]});
}

// Kage: funciones avanzadas.
const __kageModule116 = (() => {
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
exports.keyhelper = exports.CiphertextMessage = exports.SenderChainKey = exports.SenderMessageKey = exports.SenderKeyMessage = exports.SenderKeyState = exports.GroupCipher = exports.SenderKeyName = exports.SenderKeyRecord = exports.SenderKeyDistributionMessage = exports.GroupSessionBuilder = void 0;
var group_session_builder_js_1 = require("./group-session-builder.js");
Object.defineProperty(exports, "GroupSessionBuilder", { enumerable: true, get: function () { return group_session_builder_js_1.GroupSessionBuilder; } });
var sender_key_distribution_message_js_1 = require("./sender-key-distribution-message.js");
Object.defineProperty(exports, "SenderKeyDistributionMessage", { enumerable: true, get: function () { return sender_key_distribution_message_js_1.SenderKeyDistributionMessage; } });
var sender_key_record_js_1 = require("./sender-key-record.js");
Object.defineProperty(exports, "SenderKeyRecord", { enumerable: true, get: function () { return sender_key_record_js_1.SenderKeyRecord; } });
var sender_key_name_js_1 = require("./sender-key-name.js");
Object.defineProperty(exports, "SenderKeyName", { enumerable: true, get: function () { return sender_key_name_js_1.SenderKeyName; } });
var group_cipher_js_1 = require("./group_cipher.js");
Object.defineProperty(exports, "GroupCipher", { enumerable: true, get: function () { return group_cipher_js_1.GroupCipher; } });
var sender_key_state_js_1 = require("./sender-key-state.js");
Object.defineProperty(exports, "SenderKeyState", { enumerable: true, get: function () { return sender_key_state_js_1.SenderKeyState; } });
var sender_key_message_js_1 = require("./sender-key-message.js");
Object.defineProperty(exports, "SenderKeyMessage", { enumerable: true, get: function () { return sender_key_message_js_1.SenderKeyMessage; } });
var sender_message_key_js_1 = require("./sender-message-key.js");
Object.defineProperty(exports, "SenderMessageKey", { enumerable: true, get: function () { return sender_message_key_js_1.SenderMessageKey; } });
var sender_chain_key_js_1 = require("./sender-chain-key.js");
Object.defineProperty(exports, "SenderChainKey", { enumerable: true, get: function () { return sender_chain_key_js_1.SenderChainKey; } });
var ciphertext_message_js_1 = require("./ciphertext-message.js");
Object.defineProperty(exports, "CiphertextMessage", { enumerable: true, get: function () { return ciphertext_message_js_1.CiphertextMessage; } });
exports.keyhelper = __importStar(require("./keyhelper.js"));

return module.exports;
})();
for (const key of Object.keys(__kageModule116)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule116[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule116, configurable:true});
