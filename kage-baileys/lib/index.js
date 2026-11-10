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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m)
        if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p))
            __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function(mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};

Object.defineProperty(exports, "__esModule", { value: true });
exports.proto = exports.makeWASocket = void 0;

const WAProto_1 = require("../WAProto");
Object.defineProperty(exports, "proto", {
    enumerable: true,
    get: function() {
        return WAProto_1.proto;
    }
});

const Socket_1 = __importDefault(require("./Socket"));
exports.makeWASocket = Socket_1.default;

__exportStar(require("../WAProto"), exports);
__exportStar(require("./Utils"), exports);
__exportStar(require("./Types"), exports);
__exportStar(require("./Store"), exports);
__exportStar(require("./Defaults"), exports);
__exportStar(require("./WABinary"), exports);
__exportStar(require("./WAM"), exports);
__exportStar(require("./WAUSync"), exports);

exports.default = Socket_1.default;

function __publishKageExports(mod) {
    if (!mod) return;
    for (const k of Object.keys(mod)) {
        if (!(k in exports)) exports[k] = mod[k];
    }
}
const __kageExtraModules = [
    "./Modded/message_builder.js",
    "./Socket/dugong.js",
    "./Socket/mex.js",
    "./Socket/communities.js",
    "./Signal/lid-mapping.js",
    "./Types/Bussines.js",
    "./Types/Mex.js",
    "./Utils/identity-change-handler.js",
    "./Utils/offline-node-processor.js",
    "./Utils/pre-key-manager.js",
    "./Utils/reporting-utils.js",
    "./Utils/rich-messages.js",
    "./Utils/stanza-ack.js",
    "./Utils/sticker-pack.js",
    "./Utils/sync-action-utils.js",
    "./Utils/tc-token-utils.js",
    "./Utils/companion-reg-client-utils.js",
    "./WAUSync/Protocols/USyncUsernameProtocol.js",
];
for (const __p of __kageExtraModules) {
    __publishKageExports(require(__p));
}
__publishKageExports(require("./VoIP/index.js"));
exports.KAGE_BUILD = Object.freeze({ name: "kage-baileys", version: require('../package.json').version, revision: "npm-android" });

__exportStar(require("./Utils/status-tools.js"), exports);
__exportStar(require("./Utils/country-info.js"), exports);
__exportStar(require("./Utils/automation-tools.js"), exports);

__exportStar(require("./Utils/consented-media.js"), exports);
__exportStar(require("./Utils/view-once-compat.js"), exports);
__exportStar(require("./Utils/status-archive.js"), exports);

__exportStar(require("./Utils/message-inspector.js"), exports);
__exportStar(require("./Utils/status-refresh.js"), exports);
__exportStar(require("./Utils/terminal-banner.js"), exports);

exports.cargarExtrasKage = async () => ({...require('./Modded/message_builder.js'),...require('./VoIP/index.js')});
exports.suppliedProto=exports.proto;
Object.assign(exports.default, exports);

 
const __kageModule210 = (() => {
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeWASocket = void 0;
const index_js_1 = __importDefault(require("./Socket/index.js"));
exports.makeWASocket = index_js_1.default;
__exportStar(require("../WAProto/index.js"), exports);
__exportStar(require("./Utils/index.js"), exports);
__exportStar(require("./Types/index.js"), exports);
__exportStar(require("./Store/index.js"), exports);
__exportStar(require("./Defaults/index.js"), exports);
__exportStar(require("./WABinary/index.js"), exports);
__exportStar(require("./WAM/index.js"), exports);
__exportStar(require("./WAUSync/index.js"), exports);
exports.default = index_js_1.default;

return module.exports;
})();
for (const key of Object.keys(__kageModule210)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule210[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule210, configurable:true});

Object.assign(exports.default, exports);

 
__exportStar(require('./Utils/interactive-compat.js'), exports);
Object.assign(exports.default, exports);

for (const name of ['SocketScope','CommandRegistry','BoundedDedup','ReconnectPlan']) exports[name] = require('./Utils/project-runtime')[name];
Object.assign(exports.default, exports);

__exportStar(require('./Utils/init-queries.js'), exports);
__exportStar(require('./Utils/profile-tools.js'), exports);

Object.assign(exports.default, exports);
