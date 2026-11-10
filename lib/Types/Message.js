"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WAMessageStatus = exports.WAMessageStubType = exports.WAProto = void 0;
const WAProto_1 = require("../../WAProto");
Object.defineProperty(exports, "WAProto", { enumerable: true, get: function () { return WAProto_1.proto; } });
exports.WAMessageStubType = WAProto_1.proto.WebMessageInfo.StubType;
exports.WAMessageStatus = WAProto_1.proto.WebMessageInfo.Status;

// Kage: compatibilidad de API.
const __kageModule48 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { proto } = require("../../WAProto")

Object.defineProperty(exports, "__esModule", { value: true })

const WAMessageAddressingMode = {
  PN: 'pn', 
  LID: 'lid'
}

module.exports = {
  WAMessageAddressingMode, 
  WAMessageStubType: proto.WebMessageInfo.StubType, 
  WAMessageStatus: proto.WebMessageInfo.Status, 
  WAProto: proto
}
return module.exports;
})();
for (const key of Object.keys(__kageModule48)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule48[key]});
}

// Kage: funciones avanzadas.
const __kageModule153 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WAMessageAddressingMode = exports.WAMessageStatus = exports.WAMessageStubType = exports.ProtocolType = exports.ListType = exports.CarouselCardType = exports.ButtonType = exports.ButtonHeaderType = exports.AssociationType = exports.WAProto = void 0;
const index_js_1 = require("../../WAProto/index.js");
Object.defineProperty(exports, "WAProto", { enumerable: true, get: function () { return index_js_1.proto; } });
// Kage: actualización de compatibilidad.
exports.AssociationType = index_js_1.proto.MessageAssociation.AssociationType;
exports.ButtonHeaderType = index_js_1.proto.Message.ButtonsMessage.HeaderType;
exports.ButtonType = index_js_1.proto.Message.ButtonsMessage.Button.Type;
exports.CarouselCardType = index_js_1.proto.Message.InteractiveMessage.CarouselMessage.CarouselCardType;
exports.ListType = index_js_1.proto.Message.ListMessage.ListType;
exports.ProtocolType = index_js_1.proto.Message.ProtocolMessage.Type;
exports.WAMessageStubType = index_js_1.proto.WebMessageInfo.StubType;
exports.WAMessageStatus = index_js_1.proto.WebMessageInfo.Status;
(function (WAMessageAddressingMode) {
    WAMessageAddressingMode["PN"] = "pn";
    WAMessageAddressingMode["LID"] = "lid";
})(exports.WAMessageAddressingMode || (exports.WAMessageAddressingMode = {}));

return module.exports;
})();
for (const key of Object.keys(__kageModule153)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule153[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule153, configurable:true});
