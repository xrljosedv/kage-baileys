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
__exportStar(require("./constants"), exports);
__exportStar(require("./encode"), exports);
__exportStar(require("./BinaryInfo"), exports);

// Kage: compatibilidad de API.
const __kageModule91 = (() => {
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

__exportStar(require("./constants"), exports)
__exportStar(require("./encode"), exports)
__exportStar(require("./BinaryInfo"), exports)
return module.exports;
})();
for (const key of Object.keys(__kageModule91)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule91[key]});
}

// Kage: funciones avanzadas.
const __kageModule200 = (() => {
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
__exportStar(require("./constants.js"), exports);
__exportStar(require("./encode.js"), exports);
__exportStar(require("./BinaryInfo.js"), exports);

return module.exports;
})();
for (const key of Object.keys(__kageModule200)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule200[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule200, configurable:true});
