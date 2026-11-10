"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }var _pqueue = require('p-queue'); var _pqueue2 = _interopRequireDefault(_pqueue);
 


 class PreKeyManager {
    constructor(store, logger) {
        this.store = store;
        this.logger = logger;
        this.queues = new Map();
    }
     


    getQueue(keyType) {
        if (!this.queues.has(keyType)) {
            this.queues.set(keyType, new (0, _pqueue2.default)({ concurrency: 1 }));
        }
        return this.queues.get(keyType);
    }
     


    async processOperations(data, keyType, transactionCache, mutations, isInTransaction) {
        const keyData = data[keyType];
        if (!keyData)
            return;
        return this.getQueue(keyType).add(async () => {
             
            transactionCache[keyType] = transactionCache[keyType] || {};
            mutations[keyType] = mutations[keyType] || {};
             
            const deletions = [];
            const updates = {};
            for (const keyId in keyData) {
                if (keyData[keyId] === null) {
                    deletions.push(keyId);
                }
                else {
                    updates[keyId] = keyData[keyId];
                }
            }
             
            if (Object.keys(updates).length > 0) {
                Object.assign(transactionCache[keyType], updates);
                Object.assign(mutations[keyType], updates);
            }
             
            if (deletions.length > 0) {
                await this.processDeletions(keyType, deletions, transactionCache, mutations, isInTransaction);
            }
        });
    }
     


    async processDeletions(keyType, ids, transactionCache, mutations, isInTransaction) {
        if (isInTransaction) {
             
            for (const keyId of ids) {
                if (_optionalChain([transactionCache, 'access', _ => _[keyType], 'optionalAccess', _2 => _2[keyId]])) {
                    transactionCache[keyType][keyId] = null;
                    mutations[keyType][keyId] = null;
                }
                else {
                    this.logger.warn(`Skipping deletion of non-existent ${keyType} in transaction: ${keyId}`);
                }
            }
        }
        else {
             
            const existingKeys = await this.store.get(keyType, ids);
            for (const keyId of ids) {
                if (existingKeys[keyId]) {
                    transactionCache[keyType][keyId] = null;
                    mutations[keyType][keyId] = null;
                }
                else {
                    this.logger.warn(`Skipping deletion of non-existent ${keyType}: ${keyId}`);
                }
            }
        }
    }
     


    async validateDeletions(data, keyType) {
        const keyData = data[keyType];
        if (!keyData)
            return;
        return this.getQueue(keyType).add(async () => {
             
            const deletionIds = Object.keys(keyData).filter(id => keyData[id] === null);
            if (deletionIds.length === 0)
                return;
             
            const existingKeys = await this.store.get(keyType, deletionIds);
            for (const keyId of deletionIds) {
                if (!existingKeys[keyId]) {
                    this.logger.warn(`Skipping deletion of non-existent ${keyType}: ${keyId}`);
                    delete data[keyType][keyId];
                }
            }
        });
    }
} exports.PreKeyManager = PreKeyManager;
 
 
const __kageModule76 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { default: PQueue } = require("p-queue") 

 


class PreKeyManager {
    constructor(store, logger) {
        this.store = store
        this.logger = logger
        this.queues = new Map()
    }
    
     


    getQueue(keyType) {
        if (!this.queues.has(keyType)) {
            this.queues.set(keyType, new PQueue({ concurrency: 1 }))
        }
        return this.queues.get(keyType)
    }
    
     


    async processOperations(data, keyType, transactionCache, mutations, isInTransaction) {
        const keyData = data[keyType]
        
        if (!keyData) return
        
        return this.getQueue(keyType).add(async () => {
             
            transactionCache[keyType] = transactionCache[keyType] || {}
            mutations[keyType] = mutations[keyType] || {}
            
             
            const deletions = []
            const updates = {}
            
            for (const keyId in keyData) {
                if (keyData[keyId] === null) {
                    deletions.push(keyId)
                }
                else {
                    updates[keyId] = keyData[keyId]
                }
            }
            
             
            if (Object.keys(updates).length > 0) {
                Object.assign(transactionCache[keyType], updates)
                Object.assign(mutations[keyType], updates)
            }
            
             
            if (deletions.length > 0) {
                await this.processDeletions(keyType, deletions, transactionCache, mutations, isInTransaction)
            }
        })
    }
    
     


    async processDeletions(keyType, ids, transactionCache, mutations, isInTransaction) {
        if (isInTransaction) {
             
            for (const keyId of ids) {
                if (transactionCache[keyType]?.[keyId]) {
                    transactionCache[keyType][keyId] = null
                    mutations[keyType][keyId] = null
                }
                else {
                    this.logger.warn(`Skipping deletion of non-existent ${keyType} in transaction: ${keyId}`)
                }
            }
        }
        else {
             
            const existingKeys = await this.store.get(keyType, ids)
            for (const keyId of ids) {
                if (existingKeys[keyId]) {
                    transactionCache[keyType][keyId] = null
                    mutations[keyType][keyId] = null
                }
                else {
                    this.logger.warn(`Skipping deletion of non-existent ${keyType}: ${keyId}`)
                }
            }
        }
    }
    
     


    async validateDeletions(data, keyType) {
        const keyData = data[keyType]
        
        if (!keyData) return
        
        return this.getQueue(keyType).add(async () => {
             
            const deletionIds = Object.keys(keyData).filter(id => keyData[id] === null)
            
            if (deletionIds.length === 0) return
            
             
            const existingKeys = await this.store.get(keyType, deletionIds)
            
            for (const keyId of deletionIds) {
                if (!existingKeys[keyId]) {
                    this.logger.warn(`Skipping deletion of non-existent ${keyType}: ${keyId}`)
                    delete data[keyType][keyId]
                }
            }
        })
    }
}

module.exports = {
  PreKeyManager
}
return module.exports;
})();
for (const key of Object.keys(__kageModule76)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule76[key]});
}

 
const __kageModule181 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreKeyManager = void 0;
const index_js_1 = require("../Addon/index.js");
 


class PreKeyManager {
    constructor(store, logger) {
        this.store = store;
        this.logger = logger;
        this.queues = new Map();
    }
     


    getQueue(keyType) {
        if (!this.queues.has(keyType)) {
            this.queues.set(keyType, (0, index_js_1.createQueue)(1));
        }
        return this.queues.get(keyType);
    }
     


    async processOperations(data, keyType, transactionCache, mutations, isInTransaction) {
        const keyData = data[keyType];
        if (!keyData)
            return;
        return this.getQueue(keyType).add(async () => {
             
            transactionCache[keyType] = transactionCache[keyType] || {};
            mutations[keyType] = mutations[keyType] || {};
             
            const deletions = [];
            const updates = {};
            for (const keyId in keyData) {
                if (keyData[keyId] === null) {
                    deletions.push(keyId);
                }
                else {
                    updates[keyId] = keyData[keyId];
                }
            }
             
            if (Object.keys(updates).length > 0) {
                Object.assign(transactionCache[keyType], updates);
                Object.assign(mutations[keyType], updates);
            }
             
            if (deletions.length > 0) {
                await this.processDeletions(keyType, deletions, transactionCache, mutations, isInTransaction);
            }
        });
    }
     


    async processDeletions(keyType, ids, transactionCache, mutations, isInTransaction) {
        if (isInTransaction) {
             
            for (const keyId of ids) {
                if (transactionCache[keyType]?.[keyId]) {
                    transactionCache[keyType][keyId] = null;
                    mutations[keyType][keyId] = null;
                }
                else {
                    this.logger.warn(`Skipping deletion of non-existent ${keyType} in transaction: ${keyId}`);
                }
            }
        }
        else {
             
            const existingKeys = await this.store.get(keyType, ids);
            for (const keyId of ids) {
                if (existingKeys[keyId]) {
                    transactionCache[keyType][keyId] = null;
                    mutations[keyType][keyId] = null;
                }
                else {
                    this.logger.warn(`Skipping deletion of non-existent ${keyType}: ${keyId}`);
                }
            }
        }
    }
     


    async validateDeletions(data, keyType) {
        const keyData = data[keyType];
        if (!keyData)
            return;
        return this.getQueue(keyType).add(async () => {
             
            const deletionIds = Object.keys(keyData).filter(id => keyData[id] === null);
            if (deletionIds.length === 0)
                return;
             
            const existingKeys = await this.store.get(keyType, deletionIds);
            for (const keyId of deletionIds) {
                if (!existingKeys[keyId]) {
                    this.logger.warn(`Skipping deletion of non-existent ${keyType}: ${keyId}`);
                    delete data[keyType][keyId];
                }
            }
        });
    }
}
exports.PreKeyManager = PreKeyManager;

return module.exports;
})();
for (const key of Object.keys(__kageModule181)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule181[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule181, configurable:true});
