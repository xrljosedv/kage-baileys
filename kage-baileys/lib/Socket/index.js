"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Defaults_1 = require("../Defaults");
const business_1 = require("./communities");
 
const makeWASocket = (config = {}) => {
    try {
        if (!(config && config.silentBanner)) {
            require('../Utils/banner/startup-banner').printBanner({ silent: !!(config && config.silentBanner) });
        }
    } catch (_) {}
    const socket = (0, business_1.makeCommunitiesSocket)({
        ...Defaults_1.DEFAULT_CONNECTION_CONFIG,
        ...config
    });
    require('../Extensions').installExtensions(socket, { ...Defaults_1.DEFAULT_CONNECTION_CONFIG, ...config });
    require('../Utils/interactive-compat').installKageInteractiveTools(socket);
    require('../Utils/profile-tools').installProfileTools(socket, config);
    socket.messageBuilder = require('../Modded/message_builder').bind(socket);
    socket.createMessageBuilder = () => new (require('../Utils/message-builder').MessageBuilder)(socket);
    socket.messageBuilder.MessageBuilder = class extends require('../Utils/message-builder').MessageBuilder {
        constructor() { super(socket); }
    };
    return require('../Utils/automation-tools').installKageTools(socket, config.kageTools || {});
};
exports.default = makeWASocket;

 
const __kageModule28 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { DEFAULT_CONNECTION_CONFIG } = require("../Defaults/connection")
const { makeCommunitiesSocket } = require("./community")

 
const makeWASocket = (config) => {
	try { require('../Utils/banner/startup-banner').printBanner({ silent: !!(config && config.silentBanner) }); } catch (_) {}
	const newConfig = {
    	...DEFAULT_CONNECTION_CONFIG,
   	 ...config
    }
    
     
     
    if (config.shouldSyncHistoryMessage === undefined) {
        newConfig.shouldSyncHistoryMessage = () => !!newConfig.syncFullHistory
    }

    return makeCommunitiesSocket(newConfig)
}

exports.default = makeWASocket
return module.exports;
})();
for (const key of Object.keys(__kageModule28)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule28[key]});
}

 
const __kageModule134 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("../Defaults/index.js");
const communities_js_1 = require("./communities.js");
 
const makeWASocket = (config) => {
    const newConfig = {
        ...index_js_1.DEFAULT_CONNECTION_CONFIG,
        ...config
    };
    return (0, communities_js_1.makeCommunitiesSocket)(newConfig);
};
exports.default = makeWASocket;

return module.exports;
})();
for (const key of Object.keys(__kageModule134)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule134[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule134, configurable:true});
