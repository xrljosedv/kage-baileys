"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BinaryInfo = void 0;
class BinaryInfo {
    constructor(options = {}) {
        this.protocolVersion = 5;
        this.sequence = 0;
        this.events = [];
        this.buffer = [];
        Object.assign(this, options);
    }
}
exports.BinaryInfo = BinaryInfo;

// Kage: compatibilidad de API.
const __kageModule88 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

class BinaryInfo {
    constructor(options = {}) {
        this.protocolVersion = 5
        this.sequence = 0
        this.events = []
        this.buffer = []
        Object.assign(this, options)
    }
}

module.exports = {
  BinaryInfo
}
return module.exports;
})();
for (const key of Object.keys(__kageModule88)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule88[key]});
}

// Kage: funciones avanzadas.
const __kageModule197 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BinaryInfo = void 0;
class BinaryInfo {
    constructor(options = {}) {
        this.protocolVersion = 5;
        this.sequence = 0;
        this.events = [];
        this.buffer = [];
        Object.assign(this, options);
    }
}
exports.BinaryInfo = BinaryInfo;

return module.exports;
})();
for (const key of Object.keys(__kageModule197)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule197[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule197, configurable:true});
