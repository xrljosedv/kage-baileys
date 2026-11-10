"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.USyncDisappearingModeProtocol = void 0;
const WABinary_1 = require("../../WABinary");
class USyncDisappearingModeProtocol {
    constructor() {
        this.name = 'disappearing_mode';
    }
    getQueryElement() {
        return {
            tag: 'disappearing_mode',
            attrs: {},
        };
    }
    getUserElement() {
        return null;
    }
    parser(node) {
        if (node.tag === 'disappearing_mode') {
            (0, WABinary_1.assertNodeErrorFree)(node);
            const duration = +(node === null || node === void 0 ? void 0 : node.attrs.duration);
            const setAt = new Date(+((node === null || node === void 0 ? void 0 : node.attrs.t) || 0) * 1000);
            return {
                duration,
                setAt,
            };
        }
    }
}
exports.USyncDisappearingModeProtocol = USyncDisappearingModeProtocol;

 
const __kageModule95 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { assertNodeErrorFree } = require("../../WABinary")

class USyncDisappearingModeProtocol {
    constructor() {
        this.name = 'disappearing_mode'
    }
    getQueryElement() {
        return {
            tag: 'disappearing_mode',
            attrs: {},
        }
    }
    getUserElement() {
        return null
    }
    parser(node) {
        if (node.tag === 'disappearing_mode') {
            assertNodeErrorFree(node)
            const duration = +node?.attrs?.duration
            const setAt = new Date(+(node?.attrs?.t || 0) * 1000)
            return {
                duration,
                setAt,
            }
        }
    }
}

module.exports = {
  USyncDisappearingModeProtocol
}
return module.exports;
})();
for (const key of Object.keys(__kageModule95)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule95[key]});
}

 
const __kageModule203 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.USyncDisappearingModeProtocol = void 0;
const index_js_1 = require("../../WABinary/index.js");
class USyncDisappearingModeProtocol {
    constructor() {
        this.name = 'disappearing_mode';
    }
    getQueryElement() {
        return {
            tag: 'disappearing_mode',
            attrs: {}
        };
    }
    getUserElement() {
        return null;
    }
    parser(node) {
        if (node.tag === 'disappearing_mode') {
            (0, index_js_1.assertNodeErrorFree)(node);
            const duration = +node?.attrs.duration;
            const setAt = new Date(+(node?.attrs.t || 0) * 1000);
            return {
                duration,
                setAt
            };
        }
    }
}
exports.USyncDisappearingModeProtocol = USyncDisappearingModeProtocol;

return module.exports;
})();
for (const key of Object.keys(__kageModule203)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule203[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule203, configurable:true});
