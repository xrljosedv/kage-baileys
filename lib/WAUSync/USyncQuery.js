"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.USyncQuery = void 0;
const WABinary_1 = require("../WABinary");
const UsyncBotProfileProtocol_1 = require("./Protocols/USyncBotProfileProtocol");
const UsyncLIDProtocol_1 = require("./Protocols/USyncLIDProtocol");
const Protocols_1 = require("./Protocols");
class USyncQuery {
    constructor() {
        this.protocols = [];
        this.users = [];
        this.context = 'interactive';
        this.mode = 'query';
    }
    withMode(mode) {
        this.mode = mode;
        return this;
    }
    withContext(context) {
        this.context = context;
        return this;
    }
    withUser(user) {
        this.users.push(user);
        return this;
    }
    parseUSyncQueryResult(result) {
        if (result.attrs.type !== 'result') {
            return;
        }
        const protocolMap = Object.fromEntries(this.protocols.map((protocol) => {
            return [protocol.name, protocol.parser];
        }));
        const queryResult = {
            // TODO: implement errors etc.
            list: [],
            sideList: [],
        };
        const usyncNode = (0, WABinary_1.getBinaryNodeChild)(result, 'usync');
        //TODO: implement error backoff, refresh etc.
        //TODO: see if there are any errors in the result node
        //const resultNode = getBinaryNodeChild(usyncNode, 'result')
        const listNode = (0, WABinary_1.getBinaryNodeChild)(usyncNode, 'list');
        if (Array.isArray(listNode === null || listNode === void 0 ? void 0 : listNode.content) && typeof listNode !== 'undefined') {
            queryResult.list = listNode.content.map((node) => {
                const id = node === null || node === void 0 ? void 0 : node.attrs.jid;
                const data = Array.isArray(node === null || node === void 0 ? void 0 : node.content) ? Object.fromEntries(node.content.map((content) => {
                    const protocol = content.tag;
                    const parser = protocolMap[protocol];
                    if (parser) {
                        return [protocol, parser(content)];
                    }
                    else {
                        return [protocol, null];
                    }
                }).filter(([, b]) => b !== null)) : {};
                return { ...data, id };
            });
        }
        //TODO: implement side list
        //const sideListNode = getBinaryNodeChild(usyncNode, 'side_list')
        return queryResult;
    }
    withUsernameProtocol() {
        this.protocols.push(new (require('./Protocols/USyncUsernameProtocol').USyncUsernameProtocol)());
        return this;
    }
    withDeviceProtocol() {
        this.protocols.push(new Protocols_1.USyncDeviceProtocol());
        return this;
    }
    withContactProtocol() {
        this.protocols.push(new Protocols_1.USyncContactProtocol());
        return this;
    }
    withStatusProtocol() {
        this.protocols.push(new Protocols_1.USyncStatusProtocol());
        return this;
    }
    withDisappearingModeProtocol() {
        this.protocols.push(new Protocols_1.USyncDisappearingModeProtocol());
        return this;
    }
    withBotProfileProtocol() {
        this.protocols.push(new UsyncBotProfileProtocol_1.USyncBotProfileProtocol());
        return this;
    }
    withLIDProtocol() {
        this.protocols.push(new UsyncLIDProtocol_1.USyncLIDProtocol());
        return this;
    }
}
exports.USyncQuery = USyncQuery;

// Kage: compatibilidad de API.
const __kageModule99 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { getBinaryNodeChild } = require("../WABinary")
const {
  USyncLIDProtocol, 
  USyncDeviceProtocol, 
  USyncContactProtocol, 
  USyncStatusProtocol, 
  USyncBotProfileProtocol, 
  USyncDisappearingModeProtocol
} = require("./Protocols")

class USyncQuery {
    constructor() {
        this.protocols = []
        this.users = []
        this.context = 'interactive'
        this.mode = 'query'
    }
    withMode(mode) {
        this.mode = mode
        return this
    }
    withContext(context) {
        this.context = context
        return this
    }
    withUser(user) {
        this.users.push(user)
        return this
    }
    parseUSyncQueryResult(result) {
        if (!result || result.attrs.type !== 'result') {
            return
        }
        
        const protocolMap = Object.fromEntries(this.protocols.map(protocol => {
            return [protocol.name, protocol.parser]
        }))
        
        const queryResult = {
            // TODO: implement errors etc.
            list: [],
            sideList: []
        }
        
        const usyncNode = getBinaryNodeChild(result, 'usync')
        
        //TODO: implement error backoff, refresh etc.
        //TODO: see if there are any errors in the result node
        //const resultNode = getBinaryNodeChild(usyncNode, 'result')
        const listNode = usyncNode ? getBinaryNodeChild(usyncNode, 'list') : undefined
        
        if (listNode?.content && Array.isArray(listNode.content)) {
            queryResult.list = listNode.content.reduce((acc, node) => {
                const id = node?.attrs.jid
                
                if (id) {
                    const data = Array.isArray(node?.content)
                        ? Object.fromEntries(node.content
                            .map(content => {
                            const protocol = content.tag
                            const parser = protocolMap[protocol]
                            
                            if (parser) {
                                return [protocol, parser(content)]
                            }
                            
                            else {
                                return [protocol, null]
                            }
                        }).filter(([, b]) => b !== null))
                        : {};
                    acc.push({ ...data, id })
                }
                
                return acc
            }, [])
        }
        
        //TODO: implement side list
        //const sideListNode = getBinaryNodeChild(usyncNode, 'side_list')
        return queryResult
    }
    withLIDProtocol() {
    	this.protocols.push(new USyncLIDProtocol()) 
        return this
    }
    withDeviceProtocol() {
        this.protocols.push(new USyncDeviceProtocol())
        return this
    }
    withContactProtocol() {
        this.protocols.push(new USyncContactProtocol())
        return this
    }
    withStatusProtocol() {
        this.protocols.push(new USyncStatusProtocol())
        return this
    }
    withBotProfileProtocol() {
    	this.protocols.push(new USyncBotProfileProtocol())
        return this
    }
    withDisappearingModeProtocol() {
        this.protocols.push(new USyncDisappearingModeProtocol())
        return this
    }
}

module.exports = {
  USyncQuery
}
return module.exports;
})();
for (const key of Object.keys(__kageModule99)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule99[key]});
}

// Kage: funciones avanzadas.
const __kageModule207 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.USyncQuery = void 0;
const index_js_1 = require("../WABinary/index.js");
const UsyncBotProfileProtocol_js_1 = require("./Protocols/USyncBotProfileProtocol.js");
const UsyncLIDProtocol_js_1 = require("./Protocols/USyncLIDProtocol.js");
const index_js_2 = require("./Protocols/index.js");
class USyncQuery {
    constructor() {
        this.protocols = [];
        this.users = [];
        this.context = 'interactive';
        this.mode = 'query';
    }
    withMode(mode) {
        this.mode = mode;
        return this;
    }
    withContext(context) {
        this.context = context;
        return this;
    }
    withUser(user) {
        this.users.push(user);
        return this;
    }
    parseUSyncQueryResult(result) {
        if (result?.attrs.type !== 'result') {
            return;
        }
        const protocolMap = Object.fromEntries(this.protocols.map(protocol => {
            return [protocol.name, protocol.parser];
        }));
        const queryResult = {
            // TODO: implement errors etc.
            list: [],
            sideList: []
        };
        const usyncNode = (0, index_js_1.getBinaryNodeChild)(result, 'usync');
        //TODO: implement error backoff, refresh etc.
        //TODO: see if there are any errors in the result node
        //const resultNode = getBinaryNodeChild(usyncNode, 'result')
        const listNode = usyncNode ? (0, index_js_1.getBinaryNodeChild)(usyncNode, 'list') : undefined;
        if (listNode?.content && Array.isArray(listNode.content)) {
            queryResult.list = listNode.content.reduce((acc, node) => {
                const id = node?.attrs.jid;
                if (id) {
                    const data = Array.isArray(node?.content)
                        ? Object.fromEntries(node.content
                            .map(content => {
                            const protocol = content.tag;
                            const parser = protocolMap[protocol];
                            if (parser) {
                                return [protocol, parser(content)];
                            }
                            else {
                                return [protocol, null];
                            }
                        })
                            .filter(([, b]) => b !== null))
                        : {};
                    acc.push({ ...data, id });
                }
                return acc;
            }, []);
        }
        //TODO: implement side list
        //const sideListNode = getBinaryNodeChild(usyncNode, 'side_list')
        return queryResult;
    }
    withDeviceProtocol() {
        this.protocols.push(new index_js_2.USyncDeviceProtocol());
        return this;
    }
    withContactProtocol() {
        this.protocols.push(new index_js_2.USyncContactProtocol());
        return this;
    }
    withStatusProtocol() {
        this.protocols.push(new index_js_2.USyncStatusProtocol());
        return this;
    }
    withDisappearingModeProtocol() {
        this.protocols.push(new index_js_2.USyncDisappearingModeProtocol());
        return this;
    }
    withBotProfileProtocol() {
        this.protocols.push(new UsyncBotProfileProtocol_js_1.USyncBotProfileProtocol());
        return this;
    }
    withLIDProtocol() {
        this.protocols.push(new UsyncLIDProtocol_js_1.USyncLIDProtocol());
        return this;
    }
    withUsernameProtocol() {
        this.protocols.push(new index_js_2.USyncUsernameProtocol());
        return this;
    }
}
exports.USyncQuery = USyncQuery;

return module.exports;
})();
for (const key of Object.keys(__kageModule207)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule207[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule207, configurable:true});
