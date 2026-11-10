"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbstractSocketClient = void 0;
const events_1 = require("events");
class AbstractSocketClient extends events_1.EventEmitter {
    constructor(url, config) {
        super();
        this.url = url;
        this.config = config;
        this.setMaxListeners(0);
    }
}
exports.AbstractSocketClient = AbstractSocketClient;

 
const __kageModule22 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { EventEmitter } = require("events")

class AbstractSocketClient extends EventEmitter {
    constructor(url, config) {
        super()
        this.url = url
        this.config = config
        this.setMaxListeners(0)
    }
}

module.exports = {
  AbstractSocketClient
}
return module.exports;
})();
for (const key of Object.keys(__kageModule22)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule22[key]});
}

 
const __kageModule128 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbstractSocketClient = void 0;
const node_events_1 = require("node:events");
class AbstractSocketClient extends node_events_1.EventEmitter {
    constructor(url, config) {
        super();
        this.url = url;
        this.config = config;
        this.setMaxListeners(0);
    }
}
exports.AbstractSocketClient = AbstractSocketClient;

return module.exports;
})();
for (const key of Object.keys(__kageModule128)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule128[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule128, configurable:true});
