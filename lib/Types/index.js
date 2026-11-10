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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DisconnectReason = void 0;
__exportStar(require("./Auth"), exports);
__exportStar(require("./GroupMetadata"), exports);
__exportStar(require("./Newsletter"), exports);
__exportStar(require("./Chat"), exports);
__exportStar(require("./Contact"), exports);
__exportStar(require("./State"), exports);
__exportStar(require("./Message"), exports);
__exportStar(require("./Socket"), exports);
__exportStar(require("./Events"), exports);
__exportStar(require("./Product"), exports);
__exportStar(require("./Call"), exports);
__exportStar(require("./Signal"), exports);
var DisconnectReason;
(function (DisconnectReason) {
    DisconnectReason[DisconnectReason["connectionClosed"] = 428] = "connectionClosed";
    DisconnectReason[DisconnectReason["connectionLost"] = 408] = "connectionLost";
    DisconnectReason[DisconnectReason["connectionReplaced"] = 440] = "connectionReplaced";
    DisconnectReason[DisconnectReason["timedOut"] = 408] = "timedOut";
    DisconnectReason[DisconnectReason["loggedOut"] = 401] = "loggedOut";
    DisconnectReason[DisconnectReason["badSession"] = 500] = "badSession";
    DisconnectReason[DisconnectReason["restartRequired"] = 515] = "restartRequired";
    DisconnectReason[DisconnectReason["multideviceMismatch"] = 411] = "multideviceMismatch";
    DisconnectReason[DisconnectReason["forbidden"] = 403] = "forbidden";
    DisconnectReason[DisconnectReason["unavailableService"] = 503] = "unavailableService";
})(DisconnectReason || (exports.DisconnectReason = DisconnectReason = {}));

// Kage: compatibilidad de API.
const __kageModule56 = (() => {
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

exports.DisconnectReason = null
__exportStar(require("./Auth"), exports)
__exportStar(require("./Bussines"), exports)
__exportStar(require("./Chat"), exports)
__exportStar(require("./Contact"), exports)
__exportStar(require("./GroupMetadata"), exports)
__exportStar(require("./State"), exports)
__exportStar(require("./MexUpdates"), exports) 
__exportStar(require("./Message"), exports)
__exportStar(require("./Newsletter"), exports)
__exportStar(require("./Socket"), exports)
__exportStar(require("./Events"), exports)
__exportStar(require("./Product"), exports)
__exportStar(require("./Call"), exports)
__exportStar(require("./Signal"), exports)

const DisconnectReason = {
    connectionClosed: 428,
    connectionLost: 408,
    connectionReplaced: 440,
    timedOut: 408,
    loggedOut: 401,
    badSession: 500,
    restartRequired: 515,
    multideviceMismatch: 411,
    forbidden: 403,
    unavailableService: 503
}

exports.DisconnectReason = DisconnectReason
return module.exports;
})();
for (const key of Object.keys(__kageModule56)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule56[key]});
}

// Kage: funciones avanzadas.
const __kageModule160 = (() => {
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DisconnectReason = void 0;
__exportStar(require("./Auth.js"), exports);
__exportStar(require("./GroupMetadata.js"), exports);
__exportStar(require("./Chat.js"), exports);
__exportStar(require("./Contact.js"), exports);
__exportStar(require("./State.js"), exports);
__exportStar(require("./Message.js"), exports);
__exportStar(require("./Socket.js"), exports);
__exportStar(require("./Events.js"), exports);
__exportStar(require("./Product.js"), exports);
__exportStar(require("./Call.js"), exports);
__exportStar(require("./Signal.js"), exports);
__exportStar(require("./Mex.js"), exports);
(function (DisconnectReason) {
    DisconnectReason[DisconnectReason["connectionClosed"] = 428] = "connectionClosed";
    DisconnectReason[DisconnectReason["connectionLost"] = 408] = "connectionLost";
    DisconnectReason[DisconnectReason["connectionReplaced"] = 440] = "connectionReplaced";
    DisconnectReason[DisconnectReason["timedOut"] = 408] = "timedOut";
    DisconnectReason[DisconnectReason["loggedOut"] = 401] = "loggedOut";
    DisconnectReason[DisconnectReason["badSession"] = 500] = "badSession";
    DisconnectReason[DisconnectReason["restartRequired"] = 515] = "restartRequired";
    DisconnectReason[DisconnectReason["multideviceMismatch"] = 411] = "multideviceMismatch";
    DisconnectReason[DisconnectReason["forbidden"] = 403] = "forbidden";
    DisconnectReason[DisconnectReason["unavailableService"] = 503] = "unavailableService";
})(exports.DisconnectReason || (exports.DisconnectReason = {}));

return module.exports;
})();
for (const key of Object.keys(__kageModule160)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule160[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule160, configurable:true});

// Kage: superficie pública completa.
const canonicalMex = require('./Mex');
for (const name of ['XWAPaths', 'QueryIds']) {
    if (exports[name]) Object.assign(exports[name], canonicalMex[name]);
}
