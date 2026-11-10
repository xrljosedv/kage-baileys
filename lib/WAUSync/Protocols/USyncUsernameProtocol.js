"use strict";Object.defineProperty(exports, "__esModule", {value: true});var _indexjs = require('../../WABinary/index.js');
var _USyncUserjs = require('../USyncUser.js');
 class USyncUsernameProtocol {
    constructor() {
        this.name = 'username';
    }
    getQueryElement() {
        return {
            tag: 'username',
            attrs: {}
        };
    }
    getUserElement(user) {
        void user;
        return null;
    }
    parser(node) {
        if (node.tag === 'username') {
            _indexjs.assertNodeErrorFree.call(void 0, node);
            return typeof node.content === 'string' ? node.content : null;
        }
        return null;
    }
} exports.USyncUsernameProtocol = USyncUsernameProtocol;
//# 
// Kage: funciones avanzadas.
const __kageModule205 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.USyncUsernameProtocol = void 0;
const index_js_1 = require("../../WABinary/index.js");
class USyncUsernameProtocol {
    constructor() {
        this.name = 'username';
    }
    getQueryElement() {
        return {
            tag: 'username',
            attrs: {}
        };
    }
    getUserElement(user) {
        void user;
        return null;
    }
    parser(node) {
        if (node.tag === 'username') {
            (0, index_js_1.assertNodeErrorFree)(node);
            return typeof node.content === 'string' ? node.content : null;
        }
        return null;
    }
}
exports.USyncUsernameProtocol = USyncUsernameProtocol;

return module.exports;
})();
for (const key of Object.keys(__kageModule205)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule205[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule205, configurable:true});
