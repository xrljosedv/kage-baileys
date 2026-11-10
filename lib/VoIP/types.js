"use strict";Object.defineProperty(exports, "__esModule", {value: true});/**
 * Shared type definitions for baileys-caller.
 *
 * @author ShellTear
 */
/** Mirrors the WhatsApp WASM `CallState` enum. */
 const CallState = {
    Idle: 0,
    Calling: 1,
    PreacceptReceived: 2,
    ReceivedCall: 3,
    AcceptSent: 4,
    AcceptReceived: 5,
    Active: 6,
    ActiveElsewhere: 7,
    Ending: 13,
}; exports.CallState = CallState;

// Kage: herramientas de Kage.
const __kageModule107 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallState = void 0;
/**
 * Shared type definitions for baileys-caller.
 *
 * @author ShellTear
 */
/** Mirrors the WhatsApp WASM `CallState` enum. */
exports.CallState = {
    Idle: 0,
    Calling: 1,
    PreacceptReceived: 2,
    ReceivedCall: 3,
    AcceptSent: 4,
    AcceptReceived: 5,
    Active: 6,
    ActiveElsewhere: 7,
    Ending: 13,
};

return module.exports;
})();
for (const key of Object.keys(__kageModule107)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule107[key]});
}
