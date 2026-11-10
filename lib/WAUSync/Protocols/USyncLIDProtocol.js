"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.USyncLIDProtocol = void 0;
class USyncLIDProtocol {
    constructor() {
        this.name = 'lid';
    }
    getQueryElement() {
        return {
            tag: 'lid',
            attrs: {},
        };
    }
    getUserElement(user = {}) {
        return user.lid ? { tag: 'lid', attrs: { jid: user.lid } } : null;
    }
    parser(node) {
        if (node.tag === 'lid') {
            return node.attrs.val;
        }
        return null;
    }
}
exports.USyncLIDProtocol = USyncLIDProtocol;

// Kage: compatibilidad de API.
const __kageModule96 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

class USyncLIDProtocol {
	constructor() {
		this.name = 'lid'
	}
	getQueryElement() {
		return {
			tag: 'lid', 
			attrs: {}
		}
	}
	getUserElement(user) {
        if (user.lid) {
            return {
                tag: 'lid',
                attrs: { jid: user.lid }
            }
        }
        else {
            return null
        }
    }
	parser(node) {
		if (node.tag === 'lid') {
			return node.attrs.val
		}		
		return null
	}
}

module.exports = {
 USyncLIDProtocol
}
return module.exports;
})();
for (const key of Object.keys(__kageModule96)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule96[key]});
}
