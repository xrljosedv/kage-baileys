"use strict"
Object.defineProperty(exports, "__esModule", { value: true })
const { default: NodeCache } = require("@cacheable/node-cache")
const { Boom } = require("@hapi/boom")
const { proto } = require("../../WAProto")
const {
  CALL_VIDEO_PREFIX, 
  CALL_AUDIO_PREFIX
} = require("../Defaults/prefix")
const { DEFAULT_CACHE_TTLS } = require("../Defaults/constants")
const { PROCESSABLE_HISTORY_TYPES } = require("../Defaults/history")
const {
  SyncState, 
  ALL_WA_PATCH_NAMES
} = require("../Types")
const {
  newLTHashState, 
  processSyncAction, 
  extractSyncdPatches, 
  generateProfilePicture, 
  decodeSyncdSnapshot, 
  decodePatches, 
  encodeSyncdPatch, 
  chatModificationToAppPatch, 
  getHistoryMsg, 
  processMessage
} = require("../Utils")
const { makeMutex } = require("../Utils/make-mutex")
const {
  isPnUser, 
  getBinaryNodeChild, 
  getBinaryNodeChildren, 
  jidDecode, 
  jidNormalizedUser, 
  reduceBinaryNodeToDictionary, 
  S_WHATSAPP_NET 
} = require("../WABinary")
const {
  USyncUser, 
  USyncQuery
} = require("../WAUSync")
const { makeSocket } = require("../Socket/socket")
const MAX_SYNC_ATTEMPTS = 2

exports.attach = function(base, config) {
const {
        logger, 
        markOnlineOnConnect, 
        fireInitQueries, 
        appStateMacVerification,
        shouldIgnoreJid, 
        shouldSyncHistoryMessage, 
        getMessage 
    } = config
const suki = base
const { 
        ev, 
        ws, 
        authState, 
        generateMessageTag, 
        sendNode, 
        query, 
        signalRepository, 
        onUnexpectedError
    } = suki
const messageMutex = (base["messageMutex"] !== undefined ? base["messageMutex"] : (makeMutex()))
const receiptMutex = (base["receiptMutex"] !== undefined ? base["receiptMutex"] : (makeMutex()))
const appStatePatchMutex = (base["appStatePatchMutex"] !== undefined ? base["appStatePatchMutex"] : (makeMutex()))
const notificationMutex = (base["notificationMutex"] !== undefined ? base["notificationMutex"] : (makeMutex()))
const getAppStateSyncKey = (base["getAppStateSyncKey"] !== undefined ? base["getAppStateSyncKey"] : (async (keyId) => {
        const { [keyId]: key } = await authState.keys.get('app-state-sync-key', [keyId])
        return key
    }))
const getLidUser = (base["getLidUser"] !== undefined ? base["getLidUser"] : (async (jid) => {
        if (!jid) {
            throw new Boom('Please input a jid user')
        }
        
        if (!isPnUser(jid)) {
        	throw new Boom('Invalid JID: Not a user JID!')
        }
        
        const targetJid = jidNormalizedUser(jid)
        
        const usyncQuery = new USyncQuery() 
        usyncQuery.protocols.push({
        	name: 'lid', 
            getQueryElement: () => ({
            	tag: 'lid', 
                attrs: {}, 
                content: undefined
            }), 
            getUserElement: () => null, 
            parser: (node) => node.attrs.val
        }) 
        usyncQuery.users.push({
        	id: targetJid
        })
        
        const result = await suki.executeUSyncQuery(usyncQuery)
        
        if (result) {
            return result.list
        }
    }))
const newAppStateChunkHandler = (base["newAppStateChunkHandler"] !== undefined ? base["newAppStateChunkHandler"] : ((isInitialSync) => {
        return {
            onMutation(mutation) {
                processSyncAction(mutation, ev, authState.creds.me, isInitialSync ? { accountSettings: authState.creds.accountSettings } : undefined, logger)
            }
        }
    }))
const resyncAppState = (base["resyncAppState"] !== undefined ? base["resyncAppState"] : (ev.createBufferedFunction(async (collections, isInitialSync) => {
         
         
        const initialVersionMap = {}
        const globalMutationMap = {}
        
        await authState.keys.transaction(async () => {
            const collectionsToHandle = new Set(collections)
            
             
            const attemptsMap = {}
            
             
             
             
            while (collectionsToHandle.size) {
                const states = {}
                const nodes = []
                
                for (const name of collectionsToHandle) {
                    const result = await authState.keys.get('app-state-sync-version', [name])
                    
                    let state = result[name]
                    
                    if (state) {
                        if (typeof initialVersionMap[name] === 'undefined') {
                            initialVersionMap[name] = state.version
                        }
                    }
                    
                    else {
                        state = newLTHashState()
                    }
                    
                    states[name] = state
                    logger.info(`resyncing ${name} from v${state.version}`)
                    nodes.push({
                        tag: 'collection',
                        attrs: {
                            name,
                            version: state.version.toString(),
                             
                            return_snapshot: (!state.version).toString()
                        }
                    })
                }
                
                const result = await query({
                    tag: 'iq',
                    attrs: {
                        to: S_WHATSAPP_NET,
                        xmlns: 'w:sync:app:state',
                        type: 'set'
                    },
                    content: [
                        {
                            tag: 'sync',
                            attrs: {},
                            content: nodes
                        }
                    ]
                })
                
                 
                const decoded = await extractSyncdPatches(result, config?.options)
                
                for (const key in decoded) {
                    const name = key
                    const { patches, hasMorePatches, snapshot } = decoded[name]
                    
                    try {
                        if (snapshot) {
                            const { state: newState, mutationMap } = await decodeSyncdSnapshot(name, snapshot, getAppStateSyncKey, initialVersionMap[name], appStateMacVerification.snapshot)
                            
                            states[name] = newState
                            
                            Object.assign(globalMutationMap, mutationMap)
                            
                            logger.info(`restored state of ${name} from snapshot to v${newState.version} with mutations`)
                            
                            await authState.keys.set({ 'app-state-sync-version': { [name]: newState } })
                        }
                        
                         
                        if (patches.length) {
                            const { state: newState, mutationMap } = await decodePatches(name, patches, states[name], getAppStateSyncKey, config.options, initialVersionMap[name], logger, appStateMacVerification.patch)
                            
                            await authState.keys.set({ 'app-state-sync-version': { [name]: newState } })
                            
                            logger.info(`synced ${name} to v${newState.version}`)
                            
                            initialVersionMap[name] = newState.version
                            
                            Object.assign(globalMutationMap, mutationMap)
                        }
                        
                        if (hasMorePatches) {
                            logger.info(`${name} has more patches...`)
                        }
                        
                        else {
                             
                            collectionsToHandle.delete(name)
                        }
                    }
                    
                    catch (error) {
                         
                         
                        const isIrrecoverableError = attemptsMap[name] >= MAX_SYNC_ATTEMPTS ||
                            error.output?.statusCode === 404 ||
                            error.name === 'TypeError'
                            
                        logger.info({ name, error: error.stack }, `failed to sync state from version${isIrrecoverableError ? '' : ', removing and trying from scratch'}`)
                        
                        await authState.keys.set({ 'app-state-sync-version': { [name]: null } })
                        
                         
                        attemptsMap[name] = (attemptsMap[name] || 0) + 1
                        
                        if (isIrrecoverableError) {
                             
                            collectionsToHandle.delete(name);
                        }
                    }
                }
            }
        }, authState?.creds?.me?.id || 'resync-app-state')
        const { onMutation } = newAppStateChunkHandler(isInitialSync)
        
        for (const key in globalMutationMap) {
            onMutation(globalMutationMap[key])
        }
    })))
const appPatch = (base["appPatch"] !== undefined ? base["appPatch"] : (async (patchCreate) => {
        const name = patchCreate.type
        const myAppStateKeyId = authState.creds.myAppStateKeyId
        
        if (!myAppStateKeyId) {
            throw new Boom('App state key not present!', { statusCode: 400 })
        }
        
        let initial
        let encodeResult
        
        await appStatePatchMutex.mutex(async () => {
            await authState.keys.transaction(async () => {
                logger.debug({ patch: patchCreate }, 'applying app patch')
                
                await resyncAppState([name], false)
                
                const { [name]: currentSyncVersion } = await authState.keys.get('app-state-sync-version', [name])
                
                initial = currentSyncVersion || newLTHashState()
                encodeResult = await encodeSyncdPatch(patchCreate, myAppStateKeyId, initial, getAppStateSyncKey)
                
                const { patch, state } = encodeResult
                const node = {
                    tag: 'iq',
                    attrs: {
                        to: S_WHATSAPP_NET,
                        type: 'set',
                        xmlns: 'w:sync:app:state'
                    },
                    content: [
                        {
                            tag: 'sync',
                            attrs: {},
                            content: [
                                {
                                    tag: 'collection',
                                    attrs: {
                                        name,
                                        version: (state.version - 1).toString(),
                                        return_snapshot: 'false'
                                    },
                                    content: [
                                        {
                                            tag: 'patch',
                                            attrs: {},
                                            content: proto.SyncdPatch.encode(patch).finish()
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
                
                await query(node)
                await authState.keys.set({ 'app-state-sync-version': { [name]: state } })
            }, authState?.creds?.me?.id || 'app-patch')
        })
        
        if (config.emitOwnEvents) {
            const { onMutation } = newAppStateChunkHandler(false)
            const { mutationMap } = await decodePatches(name, [{ ...encodeResult.patch, version: { version: encodeResult.state.version } }], initial, getAppStateSyncKey, config.options, undefined, logger)
            
            for (const key in mutationMap) {
                onMutation(mutationMap[key])
            }
        }
    }))
const chatModify = ((mod, jid) => {
        const patch = chatModificationToAppPatch(mod, jid)
        return appPatch(patch)
    })
const clearMessage = (base["clearMessage"] !== undefined ? base["clearMessage"] : ((jid, key, timeStamp) => {
         return chatModify({
           delete: true,
           lastMessages: [{
                key: key,
                messageTimestamp: timeStamp
            }],
        }, jid)
     }))
const addOrEditQuickReply = (base["addOrEditQuickReply"] !== undefined ? base["addOrEditQuickReply"] : ((quickReply) => {
        return chatModify({
            quickReply
        }, '')
    }))
const removeQuickReply = (base["removeQuickReply"] !== undefined ? base["removeQuickReply"] : ((timestamp) => {
        return chatModify({
            quickReply: { timestamp, deleted: true }
        }, '')
    }))
return {
messageMutex,
receiptMutex,
appStatePatchMutex,
notificationMutex,
getLidUser,
clearMessage,
addOrEditQuickReply,
removeQuickReply
};
};
