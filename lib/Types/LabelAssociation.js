"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LabelAssociationType = void 0;
/** Association type */
var LabelAssociationType;
(function (LabelAssociationType) {
    LabelAssociationType["Chat"] = "label_jid";
    LabelAssociationType["Message"] = "label_message";
})(LabelAssociationType || (exports.LabelAssociationType = LabelAssociationType = {}));

// Kage: compatibilidad de API.
const __kageModule47 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

/** Association type */
const LabelAssociationType = {
  Chat: "label_jid", 
  Message: "label_message"
}

module.exports = {
  LabelAssociationType
}
return module.exports;
})();
for (const key of Object.keys(__kageModule47)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule47[key]});
}

// Kage: funciones avanzadas.
const __kageModule152 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LabelAssociationType = void 0;
(function (LabelAssociationType) {
    LabelAssociationType["Chat"] = "label_jid";
    LabelAssociationType["Message"] = "label_message";
})(exports.LabelAssociationType || (exports.LabelAssociationType = {}));

return module.exports;
})();
for (const key of Object.keys(__kageModule152)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule152[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule152, configurable:true});
