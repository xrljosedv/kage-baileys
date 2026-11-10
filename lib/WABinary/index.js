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
__exportStar(require("./encode"), exports);
__exportStar(require("./decode"), exports);
__exportStar(require("./generic-utils"), exports);
__exportStar(require("./jid-utils"), exports);
__exportStar(require("./types"), exports);

// Kage: compatibilidad de API.
const __kageModule85 = (() => {
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

__exportStar(require("./encode"), exports)
__exportStar(require("./decode"), exports)
__exportStar(require("./generic-utils"), exports)
__exportStar(require("./jid-utils"), exports)
__exportStar(require("./types"), exports)
return module.exports;
})();
for (const key of Object.keys(__kageModule85)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule85[key]});
}

// Kage: funciones avanzadas.
const __kageModule194 = (() => {
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
__exportStar(require("./encode.js"), exports);
__exportStar(require("./decode.js"), exports);
__exportStar(require("./generic-utils.js"), exports);
__exportStar(require("./jid-utils.js"), exports);
__exportStar(require("./types.js"), exports);

return module.exports;
})();
for (const key of Object.keys(__kageModule194)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule194[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule194, configurable:true});
