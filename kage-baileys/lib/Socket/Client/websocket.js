"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketClient = void 0;
const ws_1 = __importDefault(require("ws"));
const Defaults_1 = require("../../Defaults");
const types_1 = require("./types");
class WebSocketClient extends types_1.AbstractSocketClient {
    constructor() {
        super(...arguments);
        this.socket = null;
    }
    get isOpen() {
        var _a;
        return ((_a = this.socket) === null || _a === void 0 ? void 0 : _a.readyState) === ws_1.default.OPEN;
    }
    get isClosed() {
        var _a;
        return this.socket === null || ((_a = this.socket) === null || _a === void 0 ? void 0 : _a.readyState) === ws_1.default.CLOSED;
    }
    get isClosing() {
        var _a;
        return this.socket === null || ((_a = this.socket) === null || _a === void 0 ? void 0 : _a.readyState) === ws_1.default.CLOSING;
    }
    get isConnecting() {
        var _a;
        return ((_a = this.socket) === null || _a === void 0 ? void 0 : _a.readyState) === ws_1.default.CONNECTING;
    }
    async connect() {
        var _a, _b;
        if (this.socket) {
            return;
        }
        this.socket = new ws_1.default(this.url, {
            origin: Defaults_1.DEFAULT_ORIGIN,
            maxPayload: 32 * 1024 * 1024,
            headers: (_a = this.config.options) === null || _a === void 0 ? void 0 : _a.headers,
            handshakeTimeout: this.config.connectTimeoutMs,
            timeout: this.config.connectTimeoutMs,
            agent: this.config.agent,
        });
        this.socket.setMaxListeners(0);
        const events = ['close', 'error', 'upgrade', 'message', 'open', 'ping', 'pong', 'unexpected-response'];
        for (const event of events) {
            (_b = this.socket) === null || _b === void 0 ? void 0 : _b.on(event, (...args) => this.emit(event, ...args));
        }
    }
    async close() {
        if (!this.socket) {
            return;
        }
        this.socket.close();
        this.socket = null;
    }
    async restart() {
        if (this.socket) {
            await new Promise(resolve => {
                this.socket.once('close', resolve);
                this.socket.terminate();
            });
            this.socket = null;
        }
        await this.connect();
    }
    send(str, cb) {
        var _a;
        (_a = this.socket) === null || _a === void 0 ? void 0 : _a.send(str, cb);
        return true;
    }
}
exports.WebSocketClient = WebSocketClient;

 
const __kageModule23 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const {
  OPEN, 
  CLOSED, 
  CLOSING, 
  CONNECTING, 
  WebSocket
} = require("ws")
const { DEFAULT_ORIGIN } = require("../../Defaults/constants")
const { AbstractSocketClient } = require("./types")

class WebSocketClient extends AbstractSocketClient {
    constructor() {
        super(...arguments)
        this.socket = null
    }
    
    get isOpen() {
        return this.socket?.readyState === OPEN
    }
    
    get isClosed() {
        return this.socket?.readyState === CLOSED
    }
    
    get isClosing() {
        this.socket?.readyState === CLOSING
    }
    
    get isConnecting() {
        this.socket?.readyState === CONNECTING
    }
    
    connect() {
        if (this.socket) {
            return
        }
        this.socket = new WebSocket(this.url, {
            origin: DEFAULT_ORIGIN,
            headers: this.config.options?.headers,
            handshakeTimeout: this.config.connectTimeoutMs,
            timeout: this.config.connectTimeoutMs,
            agent: this.config.agent,
        })
        this.socket.setMaxListeners(0)
        const events = ['close', 'error', 'upgrade', 'message', 'open', 'ping', 'pong', 'unexpected-response']
        for (const event of events) {
            this.socket?.on(event, (...args) => this.emit(event, ...args))
        }
    }
    
    close() {
        if (!this.socket) {
            return
        }
        this.socket.close()
        this.socket = null
    }
    
    send(str, cb) {
        this.socket?.send(str, cb)
        return Boolean(this.socket)
    }
}

module.exports = {
  WebSocketClient
}
return module.exports;
})();
for (const key of Object.keys(__kageModule23)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule23[key]});
}

 
const __kageModule129 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketClient = void 0;
const ws_1 = __importDefault(require("ws"));
const index_js_1 = require("../../Defaults/index.js");
const types_js_1 = require("./types.js");
class WebSocketClient extends types_js_1.AbstractSocketClient {
    constructor() {
        super(...arguments);
        this.socket = null;
    }
    get isOpen() {
        return this.socket?.readyState === ws_1.default.OPEN;
    }
    get isClosed() {
        return this.socket === null || this.socket?.readyState === ws_1.default.CLOSED;
    }
    get isClosing() {
        return this.socket === null || this.socket?.readyState === ws_1.default.CLOSING;
    }
    get isConnecting() {
        return this.socket?.readyState === ws_1.default.CONNECTING;
    }
    connect() {
        if (this.socket) {
            return;
        }
        this.socket = new ws_1.default(this.url, {
            origin: index_js_1.DEFAULT_ORIGIN,
            headers: this.config.options?.headers,
            handshakeTimeout: this.config.connectTimeoutMs,
            timeout: this.config.connectTimeoutMs,
            agent: this.config.agent
        });
        this.socket.setMaxListeners(0);
        const events = ['close', 'error', 'upgrade', 'message', 'open', 'ping', 'pong', 'unexpected-response'];
        for (const event of events) {
            this.socket?.on(event, (...args) => this.emit(event, ...args));
        }
    }
    async close() {
        if (!this.socket) {
            return;
        }
        const closePromise = new Promise(resolve => {
            this.socket?.once('close', resolve);
        });
        this.socket.close();
        await closePromise;
        this.socket = null;
    }
    send(str, cb) {
        this.socket?.send(str, cb);
        return Boolean(this.socket);
    }
}
exports.WebSocketClient = WebSocketClient;

return module.exports;
})();
for (const key of Object.keys(__kageModule129)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule129[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule129, configurable:true});
