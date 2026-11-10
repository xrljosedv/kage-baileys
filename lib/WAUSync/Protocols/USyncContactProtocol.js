"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.USyncContactProtocol = void 0;
const WABinary_1 = require("../../WABinary");
class USyncContactProtocol {
    constructor() {
        this.name = 'contact';
    }
    getQueryElement() {
        return {
            tag: 'contact',
            attrs: {},
        };
    }
    getUserElement(user) {
        //TODO: Implement type / username fields (not yet supported)
        return {
            tag: 'contact',
            attrs: {},
            content: user.phone,
        };
    }
    parser(node) {
        var _a;
        if (node.tag === 'contact') {
            (0, WABinary_1.assertNodeErrorFree)(node);
            return ((_a = node === null || node === void 0 ? void 0 : node.attrs) === null || _a === void 0 ? void 0 : _a.type) === 'in';
        }
        return false;
    }
}
exports.USyncContactProtocol = USyncContactProtocol;

// Kage: compatibilidad de API.
const __kageModule93 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { assertNodeErrorFree } = require("../../WABinary")

class USyncContactProtocol {
    constructor() {
        this.name = 'contact'
    }
    getQueryElement() {
        return {
            tag: 'contact',
            attrs: {},
        }
    }
    getUserElement(user) {
        //TODO: Implement type / username fields (not yet supported)
        return {
            tag: 'contact',
            attrs: {},
            content: user.phone,
        }
    }
    parser(node) {
        if (node.tag === 'contact') {
            assertNodeErrorFree(node)
            return node?.attrs?.type === 'in'
        }
        return false
    }
}

module.exports = {
  USyncContactProtocol
}
return module.exports;
})();
for (const key of Object.keys(__kageModule93)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule93[key]});
}

// Kage: funciones avanzadas.
const __kageModule201 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.USyncContactProtocol = void 0;
const index_js_1 = require("../../WABinary/index.js");
class USyncContactProtocol {
    constructor() {
        this.name = 'contact';
    }
    getQueryElement() {
        return {
            tag: 'contact',
            attrs: {}
        };
    }
    getUserElement(user) {
        if (user.phone) {
            return {
                tag: 'contact',
                attrs: {},
                content: user.phone
            };
        }
        if (user.username) {
            return {
                tag: 'contact',
                attrs: {
                    username: user.username,
                    ...(user.usernameKey ? { pin: user.usernameKey } : {}),
                    ...(user.lid ? { lid: user.lid } : {})
                }
            };
        }
        if (user.type) {
            return {
                tag: 'contact',
                attrs: {
                    type: user.type
                }
            };
        }
        return {
            tag: 'contact',
            attrs: {}
        };
    }
    parser(node) {
        if (node.tag === 'contact') {
            (0, index_js_1.assertNodeErrorFree)(node);
            return node?.attrs?.type === 'in';
        }
        return false;
    }
}
exports.USyncContactProtocol = USyncContactProtocol;

return module.exports;
})();
for (const key of Object.keys(__kageModule201)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule201[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule201, configurable:true});
