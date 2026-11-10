"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; } async function _asyncOptionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = await fn(value); } else if (op === 'call' || op === 'optionalCall') { value = await fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }var _lrucache = require('lru-cache');
var _indexjs = require('../WABinary/index.js');
 class LIDMappingStore {
    constructor(keys, logger, pnToLIDFunc) {
        this.mappingCache = new (0, _lrucache.LRUCache)({
            ttl: 3 * 24 * 60 * 60 * 1000, // 7 days
            ttlAutopurge: true,
            updateAgeOnGet: true
        });
        this.inflightLIDLookups = new Map();
        this.inflightPNLookups = new Map();
        this.keys = keys;
        this.pnToLIDFunc = pnToLIDFunc;
        this.logger = logger;
    }
    async storeLIDPNMappings(pairs) {
        if (pairs.length === 0)
            return;
        const validatedPairs = [];
        for (const { lid, pn } of pairs) {
            if (!((_indexjs.isLidUser.call(void 0, lid) && _indexjs.isPnUser.call(void 0, pn)) || (_indexjs.isPnUser.call(void 0, lid) && _indexjs.isLidUser.call(void 0, pn)))) {
                this.logger.warn(`Invalid LID-PN mapping: ${lid}, ${pn}`);
                continue;
            }
            const lidDecoded = _indexjs.jidDecode.call(void 0, lid);
            const pnDecoded = _indexjs.jidDecode.call(void 0, pn);
            if (!lidDecoded || !pnDecoded)
                continue;
            validatedPairs.push({ pnUser: pnDecoded.user, lidUser: lidDecoded.user });
        }
        if (validatedPairs.length === 0)
            return;
        const cacheMissSet = new Set();
        const existingMappings = new Map();
        for (const { pnUser } of validatedPairs) {
            const cached = this.mappingCache.get(`pn:${pnUser}`);
            if (cached) {
                existingMappings.set(pnUser, cached);
            }
            else {
                cacheMissSet.add(pnUser);
            }
        }
        if (cacheMissSet.size > 0) {
            const cacheMisses = [...cacheMissSet];
            this.logger.trace(`Batch fetching ${cacheMisses.length} LID mappings from database`);
            const stored = await this.keys.get('lid-mapping', cacheMisses);
            for (const pnUser of cacheMisses) {
                const existingLidUser = stored[pnUser];
                if (existingLidUser) {
                    existingMappings.set(pnUser, existingLidUser);
                    this.mappingCache.set(`pn:${pnUser}`, existingLidUser);
                    this.mappingCache.set(`lid:${existingLidUser}`, pnUser);
                }
            }
        }
        const pairMap = {};
        for (const { pnUser, lidUser } of validatedPairs) {
            const existingLidUser = existingMappings.get(pnUser);
            if (existingLidUser === lidUser) {
                this.logger.debug({ pnUser, lidUser }, 'LID mapping already exists, skipping');
                continue;
            }
            pairMap[pnUser] = lidUser;
        }
        if (Object.keys(pairMap).length === 0)
            return;
        this.logger.trace({ pairMap }, `Storing ${Object.keys(pairMap).length} pn mappings`);
        const batchData = {};
        for (const [pnUser, lidUser] of Object.entries(pairMap)) {
            batchData[pnUser] = lidUser;
            batchData[`${lidUser}_reverse`] = pnUser;
        }
        await this.keys.transaction(async () => {
            await this.keys.set({ 'lid-mapping': batchData });
        }, 'lid-mapping');
        // Update cache after successful DB write
        for (const [pnUser, lidUser] of Object.entries(pairMap)) {
            this.mappingCache.set(`pn:${pnUser}`, lidUser);
            this.mappingCache.set(`lid:${lidUser}`, pnUser);
        }
    }
    async getLIDForPN(pn) {
        return await _asyncOptionalChain([(await this.getLIDsForPNs([pn])), 'optionalAccess', async _ => _[0], 'optionalAccess', async _2 => _2.lid]) || null;
    }
    async getLIDsForPNs(pns) {
        if (pns.length === 0)
            return null;
        const sortedPns = [...new Set(pns)].sort();
        const cacheKey = sortedPns.join(',');
        const inflight = this.inflightLIDLookups.get(cacheKey);
        if (inflight) {
            this.logger.trace(`Coalescing getLIDsForPNs request for ${sortedPns.length} PNs`);
            return inflight;
        }
        const promise = this._getLIDsForPNsImpl(pns);
        this.inflightLIDLookups.set(cacheKey, promise);
        try {
            return await promise;
        }
        finally {
            this.inflightLIDLookups.delete(cacheKey);
        }
    }
    async _getLIDsForPNsImpl(pns) {
        const usyncFetch = {};
        const successfulPairs = {};
        const pending = [];
        const addResolvedPair = (pn, decoded, lidUser) => {
            const normalizedLidUser = lidUser.toString();
            if (!normalizedLidUser) {
                this.logger.warn(`Invalid or empty LID user for PN ${pn}: lidUser = "${lidUser}"`);
                return false;
            }
            // Push the PN device ID to the LID to maintain device separation
            const pnDevice = decoded.device !== undefined ? decoded.device : 0;
            const deviceSpecificLid = `${normalizedLidUser}${!!pnDevice ? `:${pnDevice}` : ``}@${decoded.server === 'hosted' ? 'hosted.lid' : 'lid'}`;
            this.logger.trace(`getLIDForPN: ${pn} → ${deviceSpecificLid} (user mapping with device ${pnDevice})`);
            successfulPairs[pn] = { lid: deviceSpecificLid, pn };
            return true;
        };
        for (const pn of pns) {
            if (!_indexjs.isPnUser.call(void 0, pn) && !_indexjs.isHostedPnUser.call(void 0, pn))
                continue;
            const decoded = _indexjs.jidDecode.call(void 0, pn);
            if (!decoded)
                continue;
            const pnUser = decoded.user;
            const cached = this.mappingCache.get(`pn:${pnUser}`);
            if (cached && typeof cached === 'string') {
                if (!addResolvedPair(pn, decoded, cached)) {
                    this.logger.warn(`Invalid entry for ${pn} (pair not resolved)`);
                    continue;
                }
                continue;
            }
            pending.push({ pn, pnUser, decoded });
        }
        if (pending.length) {
            const pnUsers = [...new Set(pending.map(item => item.pnUser))];
            const stored = await this.keys.get('lid-mapping', pnUsers);
            for (const pnUser of pnUsers) {
                const lidUser = stored[pnUser];
                if (lidUser && typeof lidUser === 'string') {
                    this.mappingCache.set(`pn:${pnUser}`, lidUser);
                    this.mappingCache.set(`lid:${lidUser}`, pnUser);
                }
            }
            for (const { pn, pnUser, decoded } of pending) {
                const cached = this.mappingCache.get(`pn:${pnUser}`);
                if (cached && typeof cached === 'string') {
                    if (!addResolvedPair(pn, decoded, cached)) {
                        this.logger.warn(`Invalid entry for ${pn} (pair not resolved)`);
                        continue;
                    }
                }
                else {
                    this.logger.trace(`No LID mapping found for PN user ${pnUser}; batch getting from USync`);
                    const device = decoded.device || 0;
                    let normalizedPn = _indexjs.jidNormalizedUser.call(void 0, pn);
                    if (_indexjs.isHostedPnUser.call(void 0, normalizedPn)) {
                        normalizedPn = `${pnUser}@s.whatsapp.net`;
                    }
                    if (!usyncFetch[normalizedPn]) {
                        usyncFetch[normalizedPn] = [device];
                    }
                    else {
                        _optionalChain([usyncFetch, 'access', _3 => _3[normalizedPn], 'optionalAccess', _4 => _4.push, 'call', _5 => _5(device)]);
                    }
                }
            }
        }
        if (Object.keys(usyncFetch).length > 0) {
            const result = await _optionalChain([this, 'access', _6 => _6.pnToLIDFunc, 'optionalCall', _7 => _7(Object.keys(usyncFetch))]); // this function already adds LIDs to mapping
            if (result && result.length > 0) {
                await this.storeLIDPNMappings(result);
                for (const pair of result) {
                    const pnDecoded = _indexjs.jidDecode.call(void 0, pair.pn);
                    const pnUser = _optionalChain([pnDecoded, 'optionalAccess', _8 => _8.user]);
                    if (!pnUser)
                        continue;
                    const lidUser = _optionalChain([_indexjs.jidDecode.call(void 0, pair.lid), 'optionalAccess', _9 => _9.user]);
                    if (!lidUser)
                        continue;
                    for (const device of usyncFetch[pair.pn]) {
                        const deviceSpecificLid = `${lidUser}${!!device ? `:${device}` : ``}@${device === 99 ? 'hosted.lid' : 'lid'}`;
                        this.logger.trace(`getLIDForPN: USYNC success for ${pair.pn} → ${deviceSpecificLid} (user mapping with device ${device})`);
                        const deviceSpecificPn = `${pnUser}${!!device ? `:${device}` : ``}@${device === 99 ? 'hosted' : 's.whatsapp.net'}`;
                        successfulPairs[deviceSpecificPn] = { lid: deviceSpecificLid, pn: deviceSpecificPn };
                    }
                }
            }
            else {
                this.logger.warn('USync fetch yielded no results for pending PNs');
            }
        }
        return Object.values(successfulPairs).length > 0 ? Object.values(successfulPairs) : null;
    }
    async getPNForLID(lid) {
        return await _asyncOptionalChain([(await this.getPNsForLIDs([lid])), 'optionalAccess', async _10 => _10[0], 'optionalAccess', async _11 => _11.pn]) || null;
    }
    async getPNsForLIDs(lids) {
        if (lids.length === 0)
            return null;
        const sortedLids = [...new Set(lids)].sort();
        const cacheKey = sortedLids.join(',');
        const inflight = this.inflightPNLookups.get(cacheKey);
        if (inflight) {
            this.logger.trace(`Coalescing getPNsForLIDs request for ${sortedLids.length} LIDs`);
            return inflight;
        }
        const promise = this._getPNsForLIDsImpl(lids);
        this.inflightPNLookups.set(cacheKey, promise);
        try {
            return await promise;
        }
        finally {
            this.inflightPNLookups.delete(cacheKey);
        }
    }
    async _getPNsForLIDsImpl(lids) {
        const successfulPairs = {};
        const pending = [];
        const addResolvedPair = (lid, decoded, pnUser) => {
            if (!pnUser || typeof pnUser !== 'string') {
                return false;
            }
            const lidDevice = decoded.device !== undefined ? decoded.device : 0;
            const pnJid = `${pnUser}:${lidDevice}@${decoded.domainType === _indexjs.WAJIDDomains.HOSTED_LID ? 'hosted' : 's.whatsapp.net'}`;
            this.logger.trace(`Found reverse mapping: ${lid} → ${pnJid}`);
            successfulPairs[lid] = { lid, pn: pnJid };
            return true;
        };
        for (const lid of lids) {
            if (!_indexjs.isLidUser.call(void 0, lid))
                continue;
            const decoded = _indexjs.jidDecode.call(void 0, lid);
            if (!decoded)
                continue;
            const lidUser = decoded.user;
            const cached = this.mappingCache.get(`lid:${lidUser}`);
            if (cached && typeof cached === 'string') {
                addResolvedPair(lid, decoded, cached);
                continue;
            }
            pending.push({ lid, lidUser, decoded });
        }
        if (pending.length) {
            const reverseKeys = [...new Set(pending.map(item => `${item.lidUser}_reverse`))];
            const stored = await this.keys.get('lid-mapping', reverseKeys);
            for (const { lid, lidUser, decoded } of pending) {
                let pnUser = this.mappingCache.get(`lid:${lidUser}`);
                if (!pnUser || typeof pnUser !== 'string') {
                    pnUser = stored[`${lidUser}_reverse`];
                    if (pnUser && typeof pnUser === 'string') {
                        this.mappingCache.set(`lid:${lidUser}`, pnUser);
                        this.mappingCache.set(`pn:${pnUser}`, lidUser);
                    }
                }
                if (pnUser && typeof pnUser === 'string') {
                    addResolvedPair(lid, decoded, pnUser);
                }
                else {
                    this.logger.trace(`No reverse mapping found for LID user: ${lidUser}`);
                }
            }
        }
        return Object.values(successfulPairs).length ? Object.values(successfulPairs) : null;
    }
} exports.LIDMappingStore = LIDMappingStore;
//# 
// Kage: compatibilidad de API.
const __kageModule20 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { LRUCache } = require("lru-cache")
const { 
  isHostedPnUser, 
  isLidUser, 
  isPnUser, 
  jidDecode, 
  jidNormalizedUser, 
  WAJIDDomains 
} = require("../WABinary")

class LIDMappingStore {
    constructor(keys, logger, pnToLIDFunc) {
        this.mappingCache = new LRUCache({
            ttl: 3 * 24 * 60 * 60 * 1000, // 7 days
            ttlAutopurge: true,
            updateAgeOnGet: true
        })
        this.keys = keys
        this.pnToLIDFunc = pnToLIDFunc
        this.logger = logger
    }
    
    /**
     * Store LID-PN mapping - USER LEVEL
     */
    async storeLIDPNMappings(pairs) {
        // Validate inputs
        const pairMap = {}
        
        for (const { lid, pn } of pairs) {
            if (!((isLidUser(lid) && isPnUser(pn)) || (isPnUser(lid) && isLidUser(pn)))) {
                this.logger.warn(`Invalid LID-PN mapping: ${lid}, ${pn}`)
                continue
            }
            
            const lidDecoded = jidDecode(lid)
            const pnDecoded = jidDecode(pn)
            
            if (!lidDecoded || !pnDecoded) return
            
            const pnUser = pnDecoded.user
            const lidUser = lidDecoded.user
            
            let existingLidUser = this.mappingCache.get(`pn:${pnUser}`)
            
            if (!existingLidUser) {
                this.logger.trace(`Cache miss for PN user ${pnUser}; checking database`)
                
                const stored = await this.keys.get('lid-mapping', [pnUser])
                
                existingLidUser = stored[pnUser]
                
                if (existingLidUser) {
                    // Update cache with database value
                    this.mappingCache.set(`pn:${pnUser}`, existingLidUser)
                    this.mappingCache.set(`lid:${existingLidUser}`, pnUser)
                }
            }
            
            if (existingLidUser === lidUser) {
                this.logger.debug({ pnUser, lidUser }, 'LID mapping already exists, skipping')
                continue
            }
            
            pairMap[pnUser] = lidUser
        }
        
        this.logger.trace({ pairMap }, `Storing ${Object.keys(pairMap).length} pn mappings`)
        
        await this.keys.transaction(async () => {
            for (const [pnUser, lidUser] of Object.entries(pairMap)) {
                await this.keys.set({
                    'lid-mapping': {
                        [pnUser]: lidUser,
                        [`${lidUser}_reverse`]: pnUser
                    }
                })
                
                this.mappingCache.set(`pn:${pnUser}`, lidUser)
                this.mappingCache.set(`lid:${lidUser}`, pnUser)
            }
        }, 'lid-mapping')
    }
    
    /**
     * Get LID for PN - Returns device-specific LID based on user mapping
     */
    async getLIDForPN(pn) {
        return (await this.getLIDsForPNs([pn]))?.[0]?.lid || null
    }
    
    async getLIDsForPNs(pns) {
        const usyncFetch = {}
        
        // mapped from pn to lid mapping to prevent duplication in results later
        const successfulPairs = {}
        
        for (const pn of pns) {
            if (!isPnUser(pn) && !isHostedPnUser(pn)) continue
            
            const decoded = jidDecode(pn)
            if (!decoded) continue
            
            // Check cache first for PN → LID mapping
            const pnUser = decoded.user
            
            let lidUser = this.mappingCache.get(`pn:${pnUser}`)
            
            if (!lidUser) {
                // Cache miss - check database
                const stored = await this.keys.get('lid-mapping', [pnUser])
                
                lidUser = stored[pnUser]
                
                if (lidUser) {
                    this.mappingCache.set(`pn:${pnUser}`, lidUser)
                    this.mappingCache.set(`lid:${lidUser}`, pnUser)
                }
                
                else {
                    this.logger.trace(`No LID mapping found for PN user ${pnUser}; batch getting from USync`)
                    
                    const device = decoded.device || 0
                    
                    let normalizedPn = jidNormalizedUser(pn)
                    
                    if (isHostedPnUser(normalizedPn)) {
                        normalizedPn = `${pnUser}@s.whatsapp.net`
                    }
                    
                    if (!usyncFetch[normalizedPn]) {
                        usyncFetch[normalizedPn] = [device]
                    }
                    
                    else {
                        usyncFetch[normalizedPn]?.push(device)
                    }
                    
                    continue
                }
            }
            
            lidUser = lidUser.toString()
            
            if (!lidUser) {
                this.logger.warn(`Invalid or empty LID user for PN ${pn}: lidUser = "${lidUser}"`)
                return null
            }
            
            // Push the PN device ID to the LID to maintain device separation
            const pnDevice = decoded.device !== undefined ? decoded.device : 0
            const deviceSpecificLid = `${lidUser}${!!pnDevice ? `:${pnDevice}` : ``}@${decoded.server === 'hosted' ? 'hosted.lid' : 'lid'}`
            
            this.logger.trace(`getLIDForPN: ${pn} → ${deviceSpecificLid} (user mapping with device ${pnDevice})`)
            
            successfulPairs[pn] = { lid: deviceSpecificLid, pn }
        }
        
        if (Object.keys(usyncFetch).length > 0) {
            const result = await this.pnToLIDFunc?.(Object.keys(usyncFetch)) // this function already adds LIDs to mapping
            
            if (result && result.length > 0) {
                await this.storeLIDPNMappings(result)
                
                for (const pair of result) {
                    const pnDecoded = jidDecode(pair.pn)
                    const pnUser = pnDecoded?.user
                    
                    if (!pnUser) continue
                    
                    const lidUser = jidDecode(pair.lid)?.user
                    
                    if (!lidUser) continue
                    
                    for (const device of usyncFetch[pair.pn]) {
                        const deviceSpecificLid = `${lidUser}${!!device ? `:${device}` : ``}@${device === 99 ? 'hosted.lid' : 'lid'}`
                        
                        this.logger.trace(`getLIDForPN: USYNC success for ${pair.pn} → ${deviceSpecificLid} (user mapping with device ${device})`)
                        
                        const deviceSpecificPn = `${pnUser}${!!device ? `:${device}` : ``}@${device === 99 ? 'hosted' : 's.whatsapp.net'}`
                        
                        successfulPairs[deviceSpecificPn] = { lid: deviceSpecificLid, pn: deviceSpecificPn }
                    }
                }
            }
            
            else {
                return null
            }
        }
        
        return Object.values(successfulPairs)
    }
    
    /**
     * Get PN for LID - USER LEVEL with device construction
     */
     async getPNForLID(lid) {
        if (!isLidUser(lid)) return null
            
        const decoded = jidDecode(lid)
        
        if (!decoded) return null
            
        // Check cache first for LID → PN mapping
        const lidUser = decoded.user
        
        let pnUser = this.mappingCache.get(`lid:${lidUser}`)
        
        if (!pnUser || typeof pnUser !== 'string') {
            // Cache miss - check database
            const stored = await this.keys.get('lid-mapping', [`${lidUser}_reverse`])
            
            pnUser = stored[`${lidUser}_reverse`]
            
            if (!pnUser || typeof pnUser !== 'string') {
                this.logger.trace(`No reverse mapping found for LID user: ${lidUser}`)
                return null
            }
            
            this.mappingCache.set(`lid:${lidUser}`, pnUser)
        }
        
        // Construct device-specific PN JID
        const lidDevice = decoded.device !== undefined ? decoded.device : 0
        const pnJid = `${pnUser}:${lidDevice}@${decoded.domainType === WAJIDDomains.HOSTED_LID ? 'hosted' : 's.whatsapp.net'}`
        
        this.logger.trace(`Found reverse mapping: ${lid} → ${pnJid}`)
        
        return pnJid
    }
}

module.exports = {
  LIDMappingStore
}
return module.exports;
})();
for (const key of Object.keys(__kageModule20)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule20[key]});
}

// Kage: funciones avanzadas.
const __kageModule126 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LIDMappingStore = void 0;
const index_js_1 = require("../Addon/index.js");
const index_js_2 = require("../WABinary/index.js");
class LIDMappingStore {
    constructor(keys, logger, pnToLIDFunc) {
        this.mappingCache = (0, index_js_1.createCache)({
            ttl: 3 * 24 * 60 * 60 // 3 days
        });
        this.inflightLIDLookups = new Map();
        this.inflightPNLookups = new Map();
        this.keys = keys;
        this.pnToLIDFunc = pnToLIDFunc;
        this.logger = logger;
    }
    async storeLIDPNMappings(pairs) {
        if (pairs.length === 0)
            return;
        const validatedPairs = [];
        for (const { lid, pn } of pairs) {
            if (!(((0, index_js_2.isLidUser)(lid) && (0, index_js_2.isPnUser)(pn)) || ((0, index_js_2.isPnUser)(lid) && (0, index_js_2.isLidUser)(pn)))) {
                this.logger.warn(`Invalid LID-PN mapping: ${lid}, ${pn}`);
                continue;
            }
            const lidDecoded = (0, index_js_2.jidDecode)(lid);
            const pnDecoded = (0, index_js_2.jidDecode)(pn);
            if (!lidDecoded || !pnDecoded)
                continue;
            validatedPairs.push({ pnUser: pnDecoded.user, lidUser: lidDecoded.user });
        }
        if (validatedPairs.length === 0)
            return;
        const cacheMissSet = new Set();
        const existingMappings = new Map();
        for (const { pnUser } of validatedPairs) {
            const cached = this.mappingCache.get(`pn:${pnUser}`);
            if (cached) {
                existingMappings.set(pnUser, cached);
            }
            else {
                cacheMissSet.add(pnUser);
            }
        }
        if (cacheMissSet.size > 0) {
            const cacheMisses = [...cacheMissSet];
            this.logger.trace(`Batch fetching ${cacheMisses.length} LID mappings from database`);
            const stored = await this.keys.get('lid-mapping', cacheMisses);
            for (const pnUser of cacheMisses) {
                const existingLidUser = stored[pnUser];
                if (existingLidUser) {
                    existingMappings.set(pnUser, existingLidUser);
                    this.mappingCache.set(`pn:${pnUser}`, existingLidUser);
                    this.mappingCache.set(`lid:${existingLidUser}`, pnUser);
                }
            }
        }
        const pairMap = {};
        for (const { pnUser, lidUser } of validatedPairs) {
            const existingLidUser = existingMappings.get(pnUser);
            if (existingLidUser === lidUser) {
                this.logger.debug({ pnUser, lidUser }, 'LID mapping already exists, skipping');
                continue;
            }
            pairMap[pnUser] = lidUser;
        }
        if (Object.keys(pairMap).length === 0)
            return;
        this.logger.trace({ pairMap }, `Storing ${Object.keys(pairMap).length} pn mappings`);
        const batchData = {};
        for (const [pnUser, lidUser] of Object.entries(pairMap)) {
            batchData[pnUser] = lidUser;
            batchData[`${lidUser}_reverse`] = pnUser;
        }
        await this.keys.transaction(async () => {
            await this.keys.set({ 'lid-mapping': batchData });
        }, 'lid-mapping');
        // Update cache after successful DB write
        for (const [pnUser, lidUser] of Object.entries(pairMap)) {
            this.mappingCache.set(`pn:${pnUser}`, lidUser);
            this.mappingCache.set(`lid:${lidUser}`, pnUser);
        }
    }
    async getLIDForPN(pn) {
        return (await this.getLIDsForPNs([pn]))?.[0]?.lid || null;
    }
    async getLIDsForPNs(pns) {
        if (pns.length === 0)
            return null;
        const sortedPns = [...new Set(pns)].sort();
        const cacheKey = sortedPns.join(',');
        const inflight = this.inflightLIDLookups.get(cacheKey);
        if (inflight) {
            this.logger.trace(`Coalescing getLIDsForPNs request for ${sortedPns.length} PNs`);
            return inflight;
        }
        const promise = this._getLIDsForPNsImpl(pns);
        this.inflightLIDLookups.set(cacheKey, promise);
        try {
            return await promise;
        }
        finally {
            this.inflightLIDLookups.delete(cacheKey);
        }
    }
    async _getLIDsForPNsImpl(pns) {
        const usyncFetch = {};
        const successfulPairs = {};
        const pending = [];
        const addResolvedPair = (pn, decoded, lidUser) => {
            const normalizedLidUser = lidUser.toString();
            if (!normalizedLidUser) {
                this.logger.warn(`Invalid or empty LID user for PN ${pn}: lidUser = "${lidUser}"`);
                return false;
            }
            // Push the PN device ID to the LID to maintain device separation
            const pnDevice = decoded.device !== undefined ? decoded.device : 0;
            const deviceSpecificLid = `${normalizedLidUser}${!!pnDevice ? `:${pnDevice}` : ``}@${decoded.server === 'hosted' ? 'hosted.lid' : 'lid'}`;
            this.logger.trace(`getLIDForPN: ${pn} → ${deviceSpecificLid} (user mapping with device ${pnDevice})`);
            successfulPairs[pn] = { lid: deviceSpecificLid, pn };
            return true;
        };
        for (const pn of pns) {
            if (!(0, index_js_2.isPnUser)(pn) && !(0, index_js_2.isHostedPnUser)(pn))
                continue;
            const decoded = (0, index_js_2.jidDecode)(pn);
            if (!decoded)
                continue;
            const pnUser = decoded.user;
            const cached = this.mappingCache.get(`pn:${pnUser}`);
            if (cached && typeof cached === 'string') {
                if (!addResolvedPair(pn, decoded, cached)) {
                    this.logger.warn(`Invalid entry for ${pn} (pair not resolved)`);
                    continue;
                }
                continue;
            }
            pending.push({ pn, pnUser, decoded });
        }
        if (pending.length) {
            const pnUsers = [...new Set(pending.map(item => item.pnUser))];
            const stored = await this.keys.get('lid-mapping', pnUsers);
            for (const pnUser of pnUsers) {
                const lidUser = stored[pnUser];
                if (lidUser && typeof lidUser === 'string') {
                    this.mappingCache.set(`pn:${pnUser}`, lidUser);
                    this.mappingCache.set(`lid:${lidUser}`, pnUser);
                }
            }
            for (const { pn, pnUser, decoded } of pending) {
                const cached = this.mappingCache.get(`pn:${pnUser}`);
                if (cached && typeof cached === 'string') {
                    if (!addResolvedPair(pn, decoded, cached)) {
                        this.logger.warn(`Invalid entry for ${pn} (pair not resolved)`);
                        continue;
                    }
                }
                else {
                    this.logger.trace(`No LID mapping found for PN user ${pnUser}; batch getting from USync`);
                    const device = decoded.device || 0;
                    let normalizedPn = (0, index_js_2.jidNormalizedUser)(pn);
                    if ((0, index_js_2.isHostedPnUser)(normalizedPn)) {
                        normalizedPn = `${pnUser}@s.whatsapp.net`;
                    }
                    if (!usyncFetch[normalizedPn]) {
                        usyncFetch[normalizedPn] = [device];
                    }
                    else {
                        usyncFetch[normalizedPn]?.push(device);
                    }
                }
            }
        }
        if (Object.keys(usyncFetch).length > 0) {
            const result = await this.pnToLIDFunc?.(Object.keys(usyncFetch)); // this function already adds LIDs to mapping
            if (result && result.length > 0) {
                await this.storeLIDPNMappings(result);
                for (const pair of result) {
                    const pnDecoded = (0, index_js_2.jidDecode)(pair.pn);
                    const pnUser = pnDecoded?.user;
                    if (!pnUser)
                        continue;
                    const lidUser = (0, index_js_2.jidDecode)(pair.lid)?.user;
                    if (!lidUser)
                        continue;
                    for (const device of usyncFetch[pair.pn]) {
                        const deviceSpecificLid = `${lidUser}${!!device ? `:${device}` : ``}@${device === 99 ? 'hosted.lid' : 'lid'}`;
                        this.logger.trace(`getLIDForPN: USYNC success for ${pair.pn} → ${deviceSpecificLid} (user mapping with device ${device})`);
                        const deviceSpecificPn = `${pnUser}${!!device ? `:${device}` : ``}@${device === 99 ? 'hosted' : 's.whatsapp.net'}`;
                        successfulPairs[deviceSpecificPn] = { lid: deviceSpecificLid, pn: deviceSpecificPn };
                    }
                }
            }
            else {
                this.logger.warn('USync fetch yielded no results for pending PNs');
            }
        }
        return Object.values(successfulPairs).length > 0 ? Object.values(successfulPairs) : null;
    }
    async getPNForLID(lid) {
        return (await this.getPNsForLIDs([lid]))?.[0]?.pn || null;
    }
    async getPNsForLIDs(lids) {
        if (lids.length === 0)
            return null;
        const sortedLids = [...new Set(lids)].sort();
        const cacheKey = sortedLids.join(',');
        const inflight = this.inflightPNLookups.get(cacheKey);
        if (inflight) {
            this.logger.trace(`Coalescing getPNsForLIDs request for ${sortedLids.length} LIDs`);
            return inflight;
        }
        const promise = this._getPNsForLIDsImpl(lids);
        this.inflightPNLookups.set(cacheKey, promise);
        try {
            return await promise;
        }
        finally {
            this.inflightPNLookups.delete(cacheKey);
        }
    }
    async _getPNsForLIDsImpl(lids) {
        const successfulPairs = {};
        const pending = [];
        const addResolvedPair = (lid, decoded, pnUser) => {
            if (!pnUser || typeof pnUser !== 'string') {
                return false;
            }
            const lidDevice = decoded.device !== undefined ? decoded.device : 0;
            const pnJid = `${pnUser}:${lidDevice}@${decoded.domainType === index_js_2.WAJIDDomains.HOSTED_LID ? 'hosted' : 's.whatsapp.net'}`;
            this.logger.trace(`Found reverse mapping: ${lid} → ${pnJid}`);
            successfulPairs[lid] = { lid, pn: pnJid };
            return true;
        };
        for (const lid of lids) {
            if (!(0, index_js_2.isLidUser)(lid))
                continue;
            const decoded = (0, index_js_2.jidDecode)(lid);
            if (!decoded)
                continue;
            const lidUser = decoded.user;
            const cached = this.mappingCache.get(`lid:${lidUser}`);
            if (cached && typeof cached === 'string') {
                addResolvedPair(lid, decoded, cached);
                continue;
            }
            pending.push({ lid, lidUser, decoded });
        }
        if (pending.length) {
            const reverseKeys = [...new Set(pending.map(item => `${item.lidUser}_reverse`))];
            const stored = await this.keys.get('lid-mapping', reverseKeys);
            for (const { lid, lidUser, decoded } of pending) {
                let pnUser = this.mappingCache.get(`lid:${lidUser}`);
                if (!pnUser || typeof pnUser !== 'string') {
                    pnUser = stored[`${lidUser}_reverse`];
                    if (pnUser && typeof pnUser === 'string') {
                        this.mappingCache.set(`lid:${lidUser}`, pnUser);
                        this.mappingCache.set(`pn:${pnUser}`, lidUser);
                    }
                }
                if (pnUser && typeof pnUser === 'string') {
                    addResolvedPair(lid, decoded, pnUser);
                }
                else {
                    this.logger.trace(`No reverse mapping found for LID user: ${lidUser}`);
                }
            }
        }
        return Object.values(successfulPairs).length ? Object.values(successfulPairs) : null;
    }
    /**
     * Close the cache and release resources
     */
    close() {
        this.mappingCache.flushAll();
    }
}
exports.LIDMappingStore = LIDMappingStore;

return module.exports;
})();
for (const key of Object.keys(__kageModule126)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule126[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule126, configurable:true});

// Kage: superficie pública completa.
exports.LIDMappingStore.prototype.close = function () {
    this.mappingCache.clear();
    this.inflightLIDLookups.clear();
    this.inflightPNLookups.clear();
};
