"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pino_1 = __importDefault(require("pino"));
exports.default = (0, pino_1.default)({ timestamp: () => `,"time":"${new Date().toJSON()}"` });

// Kage: compatibilidad de API.
const __kageModule69 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const pino = require("pino")

exports.default = pino({ timestamp: () => `,"time":"${new Date().toJSON()}"` })

return module.exports;
})();
for (const key of Object.keys(__kageModule69)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule69[key]});
}

// Kage: funciones avanzadas.
const __kageModule174 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const SILENT_LOGGER = Object.freeze({
    level: 'silent',
    debug: () => { },
    info: () => { },
    warn: () => { },
    error: () => { },
    fatal: () => { },
    trace: () => { },
    child: () => SILENT_LOGGER,
    isLevelEnabled: () => false
});
exports.default = SILENT_LOGGER;

return module.exports;
})();
for (const key of Object.keys(__kageModule174)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule174[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule174, configurable:true});
