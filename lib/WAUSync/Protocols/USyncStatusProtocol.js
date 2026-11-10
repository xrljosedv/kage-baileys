"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.USyncStatusProtocol = void 0;
const WABinary_1 = require("../../WABinary");
class USyncStatusProtocol {
    constructor() {
        this.name = 'status';
    }
    getQueryElement() {
        return {
            tag: 'status',
            attrs: {},
        };
    }
    getUserElement() {
        return null;
    }
    parser(node) {
        var _a, _b, _c;
        if (node.tag === 'status') {
            (0, WABinary_1.assertNodeErrorFree)(node);
            let status = (_b = (_a = node === null || node === void 0 ? void 0 : node.content) === null || _a === void 0 ? void 0 : _a.toString()) !== null && _b !== void 0 ? _b : null;
            const setAt = new Date(+((node === null || node === void 0 ? void 0 : node.attrs.t) || 0) * 1000);
            if (!status) {
                if (+((_c = node.attrs) === null || _c === void 0 ? void 0 : _c.code) === 401) {
                    status = '';
                }
                else {
                    status = null;
                }
            }
            else if (typeof status === 'string' && status.length === 0) {
                status = null;
            }
            return {
                status,
                setAt,
            };
        }
    }
}
exports.USyncStatusProtocol = USyncStatusProtocol;

// Kage: compatibilidad de API.
const __kageModule97 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { assertNodeErrorFree } = require("../../WABinary")

class USyncStatusProtocol {
    constructor() {
        this.name = 'status'
    }
    getQueryElement() {
        return {
            tag: 'status',
            attrs: {},
        }
    }
    getUserElement() {
        return null
    }
    parser(node) {
        if (node.tag === 'status') {
            assertNodeErrorFree(node)
            let status = node?.content?.toString() || null
            const setAt = new Date(+(node?.attrs?.t || 0) * 1000)
            if (!status) {
                if (+node.attrs?.code === 401) {
                    status = ''
                }
                else {
                    status = null
                }
            }
            else if (typeof status === 'string' && status.length === 0) {
                status = null
            }
            return {
                status,
                setAt,
            }
        }
    }
}

module.exports = {
  USyncStatusProtocol
}
return module.exports;
})();
for (const key of Object.keys(__kageModule97)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule97[key]});
}

// Kage: funciones avanzadas.
const __kageModule204 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.USyncStatusProtocol = void 0;
const index_js_1 = require("../../WABinary/index.js");
class USyncStatusProtocol {
    constructor() {
        this.name = 'status';
    }
    getQueryElement() {
        return {
            tag: 'status',
            attrs: {}
        };
    }
    getUserElement() {
        return null;
    }
    parser(node) {
        if (node.tag === 'status') {
            (0, index_js_1.assertNodeErrorFree)(node);
            let status = node?.content?.toString() ?? null;
            const setAt = new Date(+(node?.attrs.t || 0) * 1000);
            if (!status) {
                if (node.attrs?.code && +node.attrs.code === 401) {
                    status = '';
                }
                else {
                    status = null;
                }
            }
            else if (typeof status === 'string' && status.length === 0) {
                status = null;
            }
            return {
                status,
                setAt
            };
        }
    }
}
exports.USyncStatusProtocol = USyncStatusProtocol;

return module.exports;
})();
for (const key of Object.keys(__kageModule204)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule204[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule204, configurable:true});
