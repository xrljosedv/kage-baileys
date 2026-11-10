"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initAuthCreds = exports.addTransactionCapability = void 0;
exports.makeCacheableSignalKeyStore = makeCacheableSignalKeyStore;
const crypto_1 = require("crypto");
const node_cache_1 = __importDefault(require("@cacheable/node-cache"));
const Defaults_1 = require("../Defaults");
const crypto_2 = require("./crypto");
const generics_1 = require("./generics");
/**
 * Adds caching capability to a SignalKeyStore
 * @param store the store to add caching to
 * @param logger to log trace events
 * @param _cache cache store to use
 */
function makeCacheableSignalKeyStore(store, logger, _cache) {
    const cache = _cache || new node_cache_1.default({
        stdTTL: Defaults_1.DEFAULT_CACHE_TTLS.SIGNAL_STORE, // 5 minutes
        useClones: false,
        deleteOnExpire: true,
    });
    function getUniqueId(type, id) {
        return `${type}.${id}`;
    }
    return {
        async get(type, ids) {
            const data = {};
            const idsToFetch = [];
            for (const id of ids) {
                const item = cache.get(getUniqueId(type, id));
                if (typeof item !== 'undefined') {
                    data[id] = item;
                }
                else {
                    idsToFetch.push(id);
                }
            }
            if (idsToFetch.length) {
                logger === null || logger === void 0 ? void 0 : logger.trace({ items: idsToFetch.length }, 'loading from store');
                const fetched = await store.get(type, idsToFetch);
                for (const id of idsToFetch) {
                    const item = fetched[id];
                    if (item) {
                        data[id] = item;
                        cache.set(getUniqueId(type, id), item);
                    }
                }
            }
            return data;
        },
        async set(data) {
            let keys = 0;
            for (const type in data) {
                for (const id in data[type]) {
                    cache.set(getUniqueId(type, id), data[type][id]);
                    keys += 1;
                }
            }
            logger === null || logger === void 0 ? void 0 : logger.trace({ keys }, 'updated cache');
            await store.set(data);
        },
        async clear() {
            var _a;
            cache.flushAll();
            await ((_a = store.clear) === null || _a === void 0 ? void 0 : _a.call(store));
        }
    };
}
/**
 * Adds DB like transaction capability (https://en.wikipedia.org/wiki/Database_transaction) to the SignalKeyStore,
 * this allows batch read & write operations & improves the performance of the lib
 * @param state the key store to apply this capability to
 * @param logger logger to log events
 * @returns SignalKeyStore with transaction capability
 */
const addTransactionCapability = (state, logger, { maxCommitRetries, delayBetweenTriesMs }) => {
    // number of queries made to the DB during the transaction
    // only there for logging purposes
    let dbQueriesInTransaction = 0;
    let transactionCache = {};
    let mutations = {};
    let transactionsInProgress = 0;
    return {
        get: async (type, ids) => {
            if (isInTransaction()) {
                const dict = transactionCache[type];
                const idsRequiringFetch = dict
                    ? ids.filter(item => typeof dict[item] === 'undefined')
                    : ids;
                // only fetch if there are any items to fetch
                if (idsRequiringFetch.length) {
                    dbQueriesInTransaction += 1;
                    const result = await state.get(type, idsRequiringFetch);
                    transactionCache[type] || (transactionCache[type] = {});
                    Object.assign(transactionCache[type], result);
                }
                return ids.reduce((dict, id) => {
                    var _a;
                    const value = (_a = transactionCache[type]) === null || _a === void 0 ? void 0 : _a[id];
                    if (value) {
                        dict[id] = value;
                    }
                    return dict;
                }, {});
            }
            else {
                return state.get(type, ids);
            }
        },
        set: data => {
            if (isInTransaction()) {
                logger.trace({ types: Object.keys(data) }, 'caching in transaction');
                for (const key in data) {
                    transactionCache[key] = transactionCache[key] || {};
                    Object.assign(transactionCache[key], data[key]);
                    mutations[key] = mutations[key] || {};
                    Object.assign(mutations[key], data[key]);
                }
            }
            else {
                return state.set(data);
            }
        },
        isInTransaction,
        async transaction(work) {
            let result;
            transactionsInProgress += 1;
            if (transactionsInProgress === 1) {
                logger.trace('entering transaction');
            }
            try {
                result = await work();
                // commit if this is the outermost transaction
                if (transactionsInProgress === 1) {
                    if (Object.keys(mutations).length) {
                        logger.trace('committing transaction');
                        // retry mechanism to ensure we've some recovery
                        // in case a transaction fails in the first attempt
                        let tries = maxCommitRetries;
                        while (tries) {
                            tries -= 1;
                            try {
                                await state.set(mutations);
                                logger.trace({ dbQueriesInTransaction }, 'committed transaction');
                                break;
                            }
                            catch (error) {
                                logger.warn(`failed to commit ${Object.keys(mutations).length} mutations, tries left=${tries}`);
                                await (0, generics_1.delay)(delayBetweenTriesMs);
                            }
                        }
                    }
                    else {
                        logger.trace('no mutations in transaction');
                    }
                }
            }
            finally {
                transactionsInProgress -= 1;
                if (transactionsInProgress === 0) {
                    transactionCache = {};
                    mutations = {};
                    dbQueriesInTransaction = 0;
                }
            }
            return result;
        }
    };
    function isInTransaction() {
        return transactionsInProgress > 0;
    }
};
exports.addTransactionCapability = addTransactionCapability;
const initAuthCreds = () => {
    const identityKey = crypto_2.Curve.generateKeyPair();
    return {
        noiseKey: crypto_2.Curve.generateKeyPair(),
        pairingEphemeralKeyPair: crypto_2.Curve.generateKeyPair(),
        signedIdentityKey: identityKey,
        signedPreKey: (0, crypto_2.signedKeyPair)(identityKey, 1),
        registrationId: (0, generics_1.generateRegistrationId)(),
        advSecretKey: (0, crypto_1.randomBytes)(32).toString('base64'),
        processedHistoryMessages: [],
        nextPreKeyId: 1,
        firstUnuploadedPreKeyId: 1,
        accountSyncCounter: 0,
        accountSettings: {
            unarchiveChats: false
        },
        registered: false,
        pairingCode: undefined,
        lastPropHash: undefined,
        routingInfo: undefined,
    };
};
exports.initAuthCreds = initAuthCreds;

// Kage: compatibilidad de API.
const __kageModule57 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { randomBytes } = require("crypto")
const { default: PQueue } = require("p-queue") 
const { default: NodeCache } = require("@cacheable/node-cache")
const { DEFAULT_CACHE_TTLS } = require("../Defaults/constants")
const { AsyncLocalStorage } = require("async_hooks")
const { LRUCache } = require("lru-cache") 
const { Mutex }= require("async-mutex") 
const {
  Curve, 
  signedKeyPair
} = require("./crypto")
const {
  delay, 
  generateRegistrationId
} = require("./generics")
const { PreKeyManager } = require("./pre-key-manager") 

/**
 * Adds caching capability to a SignalKeyStore
 * @param store the store to add caching to
 * @param logger to log trace events
 * @param _cache cache store to use
 */
function makeCacheableSignalKeyStore(store, logger, _cache) {
    const cache = _cache || new NodeCache({
        stdTTL: DEFAULT_CACHE_TTLS.SIGNAL_STORE,
        useClones: false,
        deleteOnExpire: true
    })
    
    // Mutex for protecting cache operations
    const cacheMutex = new Mutex()
    
    function getUniqueId(type, id) {
        return `${type}.${id}`
    }
    return {
        async get(type, ids) {
            return cacheMutex.runExclusive(async () => {
                const data = {}
                const idsToFetch = []
                for (const id of ids) {
                    const item = cache.get(getUniqueId(type, id))
                    if (typeof item !== 'undefined') {
                        data[id] = item
                    }
                    else {
                        idsToFetch.push(id)
                    }
                }
                if (idsToFetch.length) {
                    logger?.trace({ items: idsToFetch.length }, 'loading from store')
                    const fetched = await store.get(type, idsToFetch)
                    for (const id of idsToFetch) {
                        const item = fetched[id]
                        if (item) {
                            data[id] = item
                            cache.set(getUniqueId(type, id), item)
                        }
                    }
                }
                return data
            })
        },
        async set(data) {
            return cacheMutex.runExclusive(async () => {
                let keys = 0
                for (const type in data) {
                    for (const id in data[type]) {
                        await cache.set(getUniqueId(type, id), data[type][id])
                        keys += 1
                    }
                }
                logger?.trace({ keys }, 'updated cache')
                await store.set(data)
            })
        },
        async clear() {
            await cache.flushAll()
            await store.clear?.call(store)
        }
    }
}

/**
 * Adds DB-like transaction capability to the SignalKeyStore
 * Uses AsyncLocalStorage for automatic context management
 * @param state the key store to apply this capability to
 * @param logger logger to log events
 * @returns SignalKeyStore with transaction capability
 */
const addTransactionCapability = (state, logger, { maxCommitRetries, delayBetweenTriesMs }) => {
    const txStorage = new AsyncLocalStorage()
    
    // Queues for concurrency control (keyed by signal data type - bounded set)
    const keyQueues = new Map()
    
    // Transaction mutexes with reference counting for cleanup
    const txMutexes = new Map()
    
    const txMutexRefCounts = new Map()
    
    // Pre-key manager for specialized operations
    const preKeyManager = new PreKeyManager(state, logger)
    
    /**
     * Get or create a queue for a specific key type
     */
    function getQueue(key) {
        if (!keyQueues.has(key)) {
            keyQueues.set(key, new PQueue({ concurrency: 1 }))
        }
        
        return keyQueues.get(key)
    }
    
    /**
     * Get or create a transaction mutex
     */
    function getTxMutex(key) {
        if (!txMutexes.has(key)) {
            txMutexes.set(key, new Mutex())
            txMutexRefCounts.set(key, 0)
        }
        
        return txMutexes.get(key)
    }
    
    /**
     * Acquire a reference to a transaction mutex
     */
    function acquireTxMutexRef(key) {
        const count = txMutexRefCounts.get(key) ?? 0
        txMutexRefCounts.set(key, count + 1)
    }
    
    /**
     * Release a reference to a transaction mutex and cleanup if no longer needed
     */
    function releaseTxMutexRef(key) {
        const count = (txMutexRefCounts.get(key) ?? 1) - 1
        
        txMutexRefCounts.set(key, count)
        
        // Cleanup if no more references and mutex is not locked
        if (count <= 0) {
            const mutex = txMutexes.get(key)
            
            if (mutex && !mutex.isLocked()) {
                txMutexes.delete(key)
                txMutexRefCounts.delete(key)
            }
        }
    }
    
    /**
     * Check if currently in a transaction
     */
    function isInTransaction() {
        return !!txStorage.getStore()
    }
    
    /**
     * Commit transaction with retries
     */
    async function commitWithRetry(mutations) {
        if (Object.keys(mutations).length === 0) {
            logger.trace('no mutations in transaction')
            return
        }
        
        logger.trace('committing transaction')
        
        for (let attempt = 0; attempt < maxCommitRetries; attempt++) {
            try {
                await state.set(mutations)
                logger.trace({ mutationCount: Object.keys(mutations).length }, 'committed transaction')
                return
            }
            
            catch (error) {
                const retriesLeft = maxCommitRetries - attempt - 1
                
                logger.warn(`failed to commit mutations, retries left=${retriesLeft}`)
                
                if (retriesLeft === 0) {
                    throw error
                }
                
                await delay(delayBetweenTriesMs)
            }
        }
    }
    
    return {
        get: async (type, ids) => {
            const ctx = txStorage.getStore()
            
            if (!ctx) {
                // No transaction - direct read without exclusive lock for concurrency
                return state.get(type, ids)
            }
            
            // In transaction - check cache first
            const cached = ctx.cache[type] || {}
            const missing = ids.filter(id => !(id in cached))
            
            if (missing.length > 0) {
                ctx.dbQueries++
                
                logger.trace({ type, count: missing.length }, 'fetching missing keys in transaction')
                
                const fetched = await getTxMutex(type).runExclusive(() => state.get(type, missing))
                
                // Update cache
                ctx.cache[type] = ctx.cache[type] || {};
                Object.assign(ctx.cache[type], fetched);
            }
            
            // Return requested ids from cache
            const result = {}
            
            for (const id of ids) {
                const value = ctx.cache[type]?.[id]
                
                if (value !== undefined && value !== null) {
                    result[id] = value;
                }
            }
            
            return result
        },
        set: async (data) => {
            const ctx = txStorage.getStore()
            
            if (!ctx) {
                // No transaction - direct write with queue protection
                const types = Object.keys(data)
                
                // Process pre-keys with validation
                for (const type_ of types) {
                    const type = type_
                    if (type === 'pre-key') {
                        await preKeyManager.validateDeletions(data, type)
                    }
                }
                
                // Write all data in parallel
                await Promise.all(types.map(type => getQueue(type).add(async () => {
                    const typeData = { [type]: data[type] }
                    await state.set(typeData)
                })))
                
                return
            }
            
            // In transaction - update cache and mutations
            logger.trace({ types: Object.keys(data) }, 'caching in transaction')
            
            for (const key_ in data) {
                const key = key_
                
                // Ensure structures exist
                ctx.cache[key] = ctx.cache[key] || {}
                ctx.mutations[key] = ctx.mutations[key] || {}
                
                // Special handling for pre-keys
                if (key === 'pre-key') {
                    await preKeyManager.processOperations(data, key, ctx.cache, ctx.mutations, true)
                }
                
                else {
                    // Normal key types
                    Object.assign(ctx.cache[key], data[key])
                    Object.assign(ctx.mutations[key], data[key])
                }
            }
        },
        isInTransaction,
        transaction: async (work, key) => {
            const existing = txStorage.getStore()
            
            // Nested transaction - reuse existing context
            if (existing) {
                logger.trace('reusing existing transaction context')
                return work()
            }
            
            // New transaction - acquire mutex and create context
            const mutex = getTxMutex(key)
            
            acquireTxMutexRef(key)
            
            try {
                return await mutex.runExclusive(async () => {
                    const ctx = {
                        cache: {},
                        mutations: {},
                        dbQueries: 0
                    }
                    
                    logger.trace('entering transaction')
                    
                    try {
                        const result = await txStorage.run(ctx, work)
                        
                        // Commit mutations
                        await commitWithRetry(ctx.mutations)
                        
                        logger.trace({ dbQueries: ctx.dbQueries }, 'transaction completed')
                        
                        return result
                    }
                    
                    catch (error) {
                        logger.error({ error }, 'transaction failed, rolling back')
                        throw error
                    }
                })
            }
            finally {
                releaseTxMutexRef(key)
            }
        }
    }
}

const initAuthCreds = () => {
    const identityKey = Curve.generateKeyPair()
    return {
        noiseKey: Curve.generateKeyPair(),
        pairingEphemeralKeyPair: Curve.generateKeyPair(),
        signedIdentityKey: identityKey,
        signedPreKey: signedKeyPair(identityKey, 1),
        registrationId: generateRegistrationId(),
        advSecretKey: randomBytes(32).toString('base64'),
        processedHistoryMessages: [],
        nextPreKeyId: 1,
        firstUnuploadedPreKeyId: 1,
        accountSyncCounter: 0,
        accountSettings: {
            unarchiveChats: false
        },
        registered: false,
        pairingCode: undefined,
        lastPropHash: undefined,
        routingInfo: undefined,
        additionalData: undefined
    }
}

module.exports = {
  makeCacheableSignalKeyStore, 
  addTransactionCapability, 
  initAuthCreds
}
return module.exports;
})();
for (const key of Object.keys(__kageModule57)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule57[key]});
}

// Kage: funciones avanzadas.
const __kageModule161 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initAuthCreds = exports.assertMeId = exports.addTransactionCapability = void 0;
exports.makeCacheableSignalKeyStore = makeCacheableSignalKeyStore;
const node_async_hooks_1 = require("node:async_hooks");
const node_crypto_1 = require("node:crypto");
const index_js_1 = require("../Addon/index.js");
const index_js_2 = require("../Defaults/index.js");
const crypto_js_1 = require("./crypto.js");
const generics_js_1 = require("./generics.js");
const pre_key_manager_js_1 = require("./pre-key-manager.js");
// One instance per process: a per-socket AsyncLocalStorage leaks the heap under Node's legacy
// async-context propagation, where every live instance tags every pending async resource. The
// value is keyed by store token so a store only ever sees its own context, even when another
// wrapped store runs inside its transaction.
const txStorage = new node_async_hooks_1.AsyncLocalStorage();
/**
 * Adds caching capability to a SignalKeyStore
 * @param store the store to add caching to
 * @param logger to log trace events
 * @param _cache cache store to use
 */
function makeCacheableSignalKeyStore(store, logger, _cache) {
    const cache = _cache ||
        (0, index_js_1.createCache)({
            ttl: index_js_2.DEFAULT_CACHE_TTLS.SIGNAL_STORE // 5 minutes
        });
    // Mutex for protecting cache operations
    const cacheMutex = (0, index_js_1.createMutex)();
    function getUniqueId(type, id) {
        return `${type}.${id}`;
    }
    return {
        async get(type, ids) {
            return cacheMutex.runExclusive(async () => {
                const data = {};
                const idsToFetch = [];
                for (const id of ids) {
                    const item = (await cache.get(getUniqueId(type, id)));
                    if (typeof item !== 'undefined') {
                        data[id] = item;
                    }
                    else {
                        idsToFetch.push(id);
                    }
                }
                if (idsToFetch.length) {
                    logger?.trace({ items: idsToFetch.length }, 'loading from store');
                    const fetched = await store.get(type, idsToFetch);
                    for (const id of idsToFetch) {
                        const item = fetched[id];
                        if (item) {
                            data[id] = item;
                            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
                            await cache.set(getUniqueId(type, id), item);
                        }
                    }
                }
                return data;
            });
        },
        async set(data) {
            return cacheMutex.runExclusive(async () => {
                let keys = 0;
                for (const type in data) {
                    for (const id in data[type]) {
                        await cache.set(getUniqueId(type, id), data[type][id]);
                        keys += 1;
                    }
                }
                logger?.trace({ keys }, 'updated cache');
                await store.set(data);
            });
        },
        async clear() {
            await cache.flushAll();
            await store.clear?.();
        }
    };
}
/**
 * Adds DB-like transaction capability to the SignalKeyStore
 * Uses AsyncLocalStorage for automatic context management
 * @param state the key store to apply this capability to
 * @param logger logger to log events
 * @returns SignalKeyStore with transaction capability
 */
const addTransactionCapability = (state, logger, { maxCommitRetries, delayBetweenTriesMs }) => {
    // Queues for concurrency control (keyed by signal data type - bounded set)
    const keyQueues = new Map();
    // Transaction mutexes with reference counting for cleanup
    const txMutexes = new Map();
    const txMutexRefCounts = new Map();
    // Pre-key manager for specialized operations
    const preKeyManager = new pre_key_manager_js_1.PreKeyManager(state, logger);
    /**
     * Get or create a queue for a specific key type
     */
    function getQueue(key) {
        if (!keyQueues.has(key)) {
            keyQueues.set(key, (0, index_js_1.createQueue)(1));
        }
        return keyQueues.get(key);
    }
    /**
     * Get or create a transaction mutex
     */
    function getTxMutex(key) {
        if (!txMutexes.has(key)) {
            txMutexes.set(key, (0, index_js_1.createMutex)());
            txMutexRefCounts.set(key, 0);
        }
        return txMutexes.get(key);
    }
    /**
     * Acquire a reference to a transaction mutex
     */
    function acquireTxMutexRef(key) {
        const count = txMutexRefCounts.get(key) ?? 0;
        txMutexRefCounts.set(key, count + 1);
    }
    /**
     * Release a reference to a transaction mutex and cleanup if no longer needed
     */
    function releaseTxMutexRef(key) {
        const count = (txMutexRefCounts.get(key) ?? 1) - 1;
        txMutexRefCounts.set(key, count);
        // Cleanup if no more references and mutex is not locked
        if (count <= 0) {
            const mutex = txMutexes.get(key);
            if (mutex && !mutex.isLocked()) {
                txMutexes.delete(key);
                txMutexRefCounts.delete(key);
            }
        }
    }
    /**
     * Check if currently in a transaction
     */
    function isInTransaction() {
        return !!txStorage.getStore();
    }
    /**
     * Commit transaction with retries
     */
    async function commitWithRetry(mutations) {
        if (Object.keys(mutations).length === 0) {
            logger.trace('no mutations in transaction');
            return;
        }
        logger.trace('committing transaction');
        for (let attempt = 0; attempt < maxCommitRetries; attempt++) {
            try {
                await state.set(mutations);
                logger.trace({ mutationCount: Object.keys(mutations).length }, 'committed transaction');
                return;
            }
            catch (error) {
                const retriesLeft = maxCommitRetries - attempt - 1;
                logger.warn(`failed to commit mutations, retries left=${retriesLeft}`);
                if (retriesLeft === 0) {
                    throw error;
                }
                await (0, generics_js_1.delay)(delayBetweenTriesMs);
            }
        }
    }
    return {
        get: async (type, ids) => {
            const ctx = txStorage.getStore();
            if (!ctx) {
                // No transaction - direct read without exclusive lock for concurrency
                return state.get(type, ids);
            }
            // In transaction - check cache first
            const cached = ctx.cache[type] || {};
            const missing = ids.filter(id => !(id in cached));
            if (missing.length > 0) {
                ctx.dbQueries++;
                logger.trace({ type, count: missing.length }, 'fetching missing keys in transaction');
                const fetched = await getTxMutex(type).runExclusive(() => state.get(type, missing));
                // Update cache
                ctx.cache[type] = ctx.cache[type] || {};
                Object.assign(ctx.cache[type], fetched);
            }
            // Return requested ids from cache
            const result = {};
            for (const id of ids) {
                const value = ctx.cache[type]?.[id];
                if (value !== undefined && value !== null) {
                    result[id] = value;
                }
            }
            return result;
        },
        set: async (data) => {
            const ctx = txStorage.getStore();
            if (!ctx) {
                // No transaction - direct write with queue protection
                const types = Object.keys(data);
                // Process pre-keys with validation
                for (const type_ of types) {
                    const type = type_;
                    if (type === 'pre-key') {
                        await preKeyManager.validateDeletions(data, type);
                    }
                }
                // Write all data in parallel
                await Promise.all(types.map(type => getQueue(type).add(async () => {
                    const typeData = { [type]: data[type] };
                    await state.set(typeData);
                })));
                return;
            }
            // In transaction - update cache and mutations
            logger.trace({ types: Object.keys(data) }, 'caching in transaction');
            for (const key_ in data) {
                const key = key_;
                // Ensure structures exist
                ctx.cache[key] = ctx.cache[key] || {};
                ctx.mutations[key] = ctx.mutations[key] || {};
                // Special handling for pre-keys
                if (key === 'pre-key') {
                    await preKeyManager.processOperations(data, key, ctx.cache, ctx.mutations, true);
                }
                else {
                    // Normal key types
                    Object.assign(ctx.cache[key], data[key]);
                    Object.assign(ctx.mutations[key], data[key]);
                }
            }
        },
        isInTransaction,
        transaction: async (work, key) => {
            const existing = txStorage.getStore();
            // Nested transaction - reuse existing context
            if (existing) {
                logger.trace('reusing existing transaction context');
                return work();
            }
            // New transaction - acquire mutex and create context
            const mutex = getTxMutex(key);
            acquireTxMutexRef(key);
            try {
                return await mutex.runExclusive(async () => {
                    const ctx = {
                        cache: {},
                        mutations: {},
                        dbQueries: 0
                    };
                    logger.trace('entering transaction');
                    try {
                        const result = await txStorage.run(ctx, work);
                        // Commit mutations
                        await commitWithRetry(ctx.mutations);
                        logger.trace({ dbQueries: ctx.dbQueries }, 'transaction completed');
                        return result;
                    }
                    catch (error) {
                        logger.error({ error }, 'transaction failed, rolling back');
                        throw error;
                    }
                });
            }
            finally {
                releaseTxMutexRef(key);
            }
        },
        disposeTransactionStorage: () => {
            // The first txStorage.run() enables the storage, which registers it in a
            // module-global list inside node:async_hooks holding a STRONG reference.
            // On Node < 24 every enabled storage also stamps one symbol-keyed property
            // onto every async resource created anywhere in the process, so the cost of
            // never disabling grows with sockets-ever-created x live async resources
            // (observed: 1.9GB of a 2.1GB heap after 25h at ~250 concurrent sockets).
            // Only .disable() releases it - GC alone never collects an enabled storage,
            // on any Node version.
            try {
                txStorage.disable();
            }
            catch (err) {
                logger.warn({ err }, 'failed to disable transaction storage');
            }
        }
    };
};
exports.addTransactionCapability = addTransactionCapability;
/**
 * Returns the authenticated user's JID, or throws a Boom-401 if creds are not yet authenticated.
 * Use this anywhere we'd otherwise reach for `creds.me!.id` to fail fast with a descriptive error.
 */
const assertMeId = (creds) => {
    const id = creds.me?.id;
    if (!id) {
        throw new index_js_1.HttpError('Cannot proceed: socket is not authenticated yet (creds.me.id is missing)', { statusCode: 401 });
    }
    return id;
};
exports.assertMeId = assertMeId;
const initAuthCreds = () => {
    const identityKey = crypto_js_1.Curve.generateKeyPair();
    return {
        noiseKey: crypto_js_1.Curve.generateKeyPair(),
        pairingEphemeralKeyPair: crypto_js_1.Curve.generateKeyPair(),
        signedIdentityKey: identityKey,
        signedPreKey: (0, crypto_js_1.signedKeyPair)(identityKey, 1),
        registrationId: (0, generics_js_1.generateRegistrationId)(),
        advSecretKey: (0, node_crypto_1.randomBytes)(32).toString('base64'),
        processedHistoryMessages: [],
        nextPreKeyId: 1,
        firstUnuploadedPreKeyId: 1,
        accountSyncCounter: 0,
        accountSettings: {
            unarchiveChats: false
        },
        registered: false,
        pairingCode: undefined,
        lastPropHash: undefined,
        routingInfo: undefined,
        additionalData: undefined
    };
};
exports.initAuthCreds = initAuthCreds;

return module.exports;
})();
for (const key of Object.keys(__kageModule161)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule161[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule161, configurable:true});
