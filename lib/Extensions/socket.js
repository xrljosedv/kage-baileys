"use strict";
const { signedKeyPair } = require("../Utils/crypto");
const { xmppSignedPreKey } = require("../Utils/signal");
Object.defineProperty(exports, "__esModule", { value: true })
const { Boom } = require("@hapi/boom")
const { randomBytes } = require("crypto")
const { URL } = require("url")
const { promisify } = require("util")
const { proto } = require("../../WAProto")
const {
  DEF_TAG_PREFIX, 
  DEF_CALLBACK_PREFIX
} = require("../Defaults/prefix")
const {
  NOISE_WA_HEADER, 
  INITIAL_PREKEY_COUNT, 
  MIN_UPLOAD_INTERVAL, 
  MIN_PREKEY_COUNT, 
  UPLOAD_TIMEOUT
} = require("../Defaults/constants")
const { DisconnectReason } = require("../Types")
const { 
  addTransactionCapability, 
  aesEncryptCTR, 
  printQRIfNecessaryListener, 
  bindWaitForConnectionUpdate, 
  bytesToCrockford, 
  configureSuccessfulPairing, 
  Curve, 
  derivePairingCodeKey, 
  generateLoginNode, 
  generateMdTagPrefix, 
  generateRegistrationNode, 
  getCodeFromWSError, 
  getErrorCodeFromStreamError, 
  getNextPreKeysNode,
  getPlatformId, 
  makeEventBuffer, 
  makeNoiseHandler, 
  promiseTimeout, 
  asciiDecode
} = require("../Utils")
const { 
  assertNodeErrorFree, 
  binaryNodeToString, 
  encodeBinaryNode, 
  getBinaryNodeChild, 
  getBinaryNodeChildren, 
  getAllBinaryNodeChildren, 
  isLidUser,
  jidDecode,
  jidEncode, 
  S_WHATSAPP_NET
} = require("../WABinary")
const { BinaryInfo } = require("../WAM")
const {
  USyncUser, 
  USyncQuery
} = require("../WAUSync")
const { WebSocketClient } = require("../Socket/Client")
function mapWebSocketError(handler) {
    return (error) => {
        handler(new Boom(`WebSocket Error (${error?.message})`, { statusCode: getCodeFromWSError(error), data: error }))
    }
}

exports.attach = function(base, config) {
const { 
        waWebSocketUrl, 
        connectTimeoutMs, 
        logger, 
        keepAliveIntervalMs, 
        browser, 
        auth: authState, 
        printQRInTerminal, 
        defaultQueryTimeoutMs, 
        transactionOpts,
        qrTimeout, 
        makeSignalRepository 
    } = config
const uqTagId = (base["uqTagId"] !== undefined ? base["uqTagId"] : (generateMdTagPrefix()))
const generateMessageTag = (base["generateMessageTag"] !== undefined ? base["generateMessageTag"] : (() => `${uqTagId}${epoch++}`))
const publicWAMBuffer = (base["publicWAMBuffer"] !== undefined ? base["publicWAMBuffer"] : (new BinaryInfo()))
const url = (base["url"] !== undefined ? base["url"] : (typeof waWebSocketUrl === 'string' ? new URL(waWebSocketUrl) : waWebSocketUrl))
const ephemeralKeyPair = (base["ephemeralKeyPair"] !== undefined ? base["ephemeralKeyPair"] : (Curve.generateKeyPair()))
const noise = (base["noise"] !== undefined ? base["noise"] : (makeNoiseHandler({
        keyPair: ephemeralKeyPair,
        NOISE_HEADER: NOISE_WA_HEADER,
        logger,
        routingInfo: authState?.creds?.routingInfo
    })))
const ws = (base["ws"] !== undefined ? base["ws"] : (new WebSocketClient(url, config)))
const sendPromise = (base["sendPromise"] !== undefined ? base["sendPromise"] : (promisify(ws.send)))
const sendRawMessage = (base["sendRawMessage"] !== undefined ? base["sendRawMessage"] : (async (data) => {
        if (!ws.isOpen) {
            throw new Boom('Connection Closed', { statusCode: DisconnectReason.connectionClosed })
        }
        
        const bytes = noise.encodeFrame(data)
        
        await promiseTimeout(connectTimeoutMs, async (resolve, reject) => {
            try {
                await sendPromise.call(ws, bytes)
                resolve()
            }
            catch (error) {
                reject(error)
            }
        })
    }))
const sendNode = (base["sendNode"] !== undefined ? base["sendNode"] : ((frame) => {
        if (logger.level === 'trace') {
            logger.trace({ xml: binaryNodeToString(frame), msg: 'xml send' })
        }
        
        const buff = encodeBinaryNode(frame)
        
        return sendRawMessage(buff)
    }))
const waitForMessage = (base["waitForMessage"] !== undefined ? base["waitForMessage"] : (async (msgId, timeoutMs = defaultQueryTimeoutMs) => {
        let onRecv
        let onErr
        
        try {
            const result = await promiseTimeout(timeoutMs, (resolve, reject) => {
                onRecv = data => {
                    resolve(data)
                }
                
                onErr = err => {
                    reject(err ||
                        new Boom('Connection Closed', {
                            statusCode: DisconnectReason.connectionClosed
                        }))
                }
                
                ws.on(`TAG:${msgId}`, onRecv)
                ws.on('close', onErr)
                ws.on('error', onErr)
                
                return () => reject(new Boom('Query Cancelled'))
            })
            
            return result
        }
        
        catch (error) {
            // Catch timeout and return undefined instead of throwing
            if (error instanceof Boom && error.output?.statusCode === DisconnectReason.timedOut) {
                logger?.warn?.({ msgId }, 'timed out waiting for message')
                return undefined
            }
            
            throw error
        }
        
        finally {
            if (onRecv)
                ws.off(`TAG:${msgId}`, onRecv)
            if (onErr) {
                ws.off('close', onErr)
                ws.off('error', onErr)
            }
        }
    }))
const query = (base["query"] !== undefined ? base["query"] : (async (node, timeoutMs) => {
        if (!node.attrs.id) {
            node.attrs.id = generateMessageTag()
        }
        
        const msgId = node.attrs.id
        const result = await promiseTimeout(timeoutMs, async (resolve, reject) => {
            const result = waitForMessage(msgId, timeoutMs).catch(reject)
            sendNode(node)
                .then(async () => resolve(await result))
                .catch(reject)
        })
        
        if (result && 'tag' in result) {
            assertNodeErrorFree(result)
        }
        
        return result
    }))
const digestKeyBundle = (base["digestKeyBundle"] !== undefined ? base["digestKeyBundle"] : (async () => {
        const res = await query({
            tag: 'iq',
            attrs: { to: S_WHATSAPP_NET, type: 'get', xmlns: 'encrypt' },
            content: [{ tag: 'digest', attrs: {} }]
        })
        
        const digestNode = getBinaryNodeChild(res, 'digest')
        
        if (!digestNode) {
            await uploadPreKeys()
            throw new Error('encrypt/get digest returned no digest node')
        }
    }))
const rotateSignedPreKey = (base["rotateSignedPreKey"] !== undefined ? base["rotateSignedPreKey"] : (async () => {
        const newId = (creds.signedPreKey.keyId || 0) + 1
        const skey = await signedKeyPair(creds.signedIdentityKey, newId)
        
        await query({
            tag: 'iq',
            attrs: { to: S_WHATSAPP_NET, type: 'set', xmlns: 'encrypt' },
            content: [
                {
                    tag: 'rotate',
                    attrs: {},
                    content: [xmppSignedPreKey(skey)]
                }
            ]
        })
        
        // Persist new signed pre-key in creds
        ev.emit('creds.update', { signedPreKey: skey })
    }))
const executeUSyncQuery = (base["executeUSyncQuery"] !== undefined ? base["executeUSyncQuery"] : (async (usyncQuery) => {
        if (usyncQuery.protocols.length === 0) {
            throw new Boom('USyncQuery must have at least one protocol')
        }
        
        // todo: validate users, throw WARNING on no valid users
        // variable below has only validated users
        const validUsers = usyncQuery.users
        const userNodes = validUsers.map(user => {
            return {
                tag: 'user',
                attrs: {
                    jid: !user.phone ? user.id : undefined
                },
                content: usyncQuery.protocols.map(a => a.getUserElement(user)).filter(a => a !== null)
            }
        })
        
        const listNode = {
            tag: 'list',
            attrs: {},
            content: userNodes
        }
        
        const queryNode = {
            tag: 'query',
            attrs: {},
            content: usyncQuery.protocols.map(a => a.getQueryElement())
        }
        
        const iq = {
            tag: 'iq',
            attrs: {
                to: S_WHATSAPP_NET,
                type: 'get',
                xmlns: 'usync'
            },
            content: [
                {
                    tag: 'usync',
                    attrs: {
                        context: usyncQuery.context,
                        mode: usyncQuery.mode,
                        sid: generateMessageTag(),
                        last: 'true',
                        index: '0'
                    },
                    content: [queryNode, listNode]
                }
            ]
        }
        
        const result = await query(iq)
        
        return usyncQuery.parseUSyncQueryResult(result)
    }))
const onWhatsApp = (base["onWhatsApp"] !== undefined ? base["onWhatsApp"] : (async (...phoneNumber) => {
        let usyncQuery = new USyncQuery()
        let contactEnabled = false
        
        for (const jid of phoneNumber) {
            if (isLidUser(jid)) {
                logger?.warn('LIDs are not supported with onWhatsApp')
                continue
            }
            
            else {
                if (!contactEnabled) {
                    contactEnabled = true
                    usyncQuery = usyncQuery.withContactProtocol()
                }
                
                const phone = `+${jid.replace('+', '').split('@')[0]?.split(':')[0]}`
                usyncQuery.withUser(new USyncUser().withPhone(phone))
            }
        }
        
        if (usyncQuery.users.length === 0) {
            return [] // return early without forcing an empty query
        }
        
        const results = await executeUSyncQuery(usyncQuery)
        
        if (results) {
            return results.list.filter(a => !!a.contact).map(({ contact, id }) => ({ jid: id, exists: contact }))
        }
    }))
const ev = (base["ev"] !== undefined ? base["ev"] : (makeEventBuffer(logger)))
const { creds } = authState
const keys = (base["keys"] !== undefined ? base["keys"] : (addTransactionCapability(authState.keys, logger, transactionOpts)))
let epoch = (base["epoch"] !== undefined ? base["epoch"] : (1))
let uploadPreKeysPromise = (base["uploadPreKeysPromise"] !== undefined ? base["uploadPreKeysPromise"] : (null))
let lastUploadTime = (base["lastUploadTime"] !== undefined ? base["lastUploadTime"] : (0))
const uploadPreKeys = (base["uploadPreKeys"] !== undefined ? base["uploadPreKeys"] : (async (count = MIN_PREKEY_COUNT, retryCount = 0) => {
        // Check minimum interval (except for retries)
        if (retryCount === 0) {
            const timeSinceLastUpload = Date.now() - lastUploadTime
            
            if (timeSinceLastUpload < MIN_UPLOAD_INTERVAL) {
                logger.debug(`Skipping upload, only ${timeSinceLastUpload}ms since last upload`)
                return
            }
        }
        
        // Prevent multiple concurrent uploads
        if (uploadPreKeysPromise) {
            logger.debug('Pre-key upload already in progress, waiting for completion')
            await uploadPreKeysPromise
        }
        
        const uploadLogic = async () => {
            logger.info({ count, retryCount }, 'uploading pre-keys')
            
            // Generate and save pre-keys atomically (prevents ID collisions on retry)
            const node = await keys.transaction(async () => {
                logger.debug({ requestedCount: count }, 'generating pre-keys with requested count')
                
                const { update, node } = await getNextPreKeysNode({ creds, keys }, count)
                
                // Update credentials immediately to prevent duplicate IDs on retry
                ev.emit('creds.update', update)
                
                return node // Only return node since update is already used
            }, creds?.me?.id || 'upload-pre-keys')
            
            // Upload to server (outside transaction, can fail without affecting local keys)
            try {
                await query(node)
                logger.info({ count }, 'uploaded pre-keys successfully')
                lastUploadTime = Date.now()
            }
            
            catch (uploadError) {
                logger.error({ uploadError: uploadError.toString(), count }, 'Failed to upload pre-keys to server')
                
                // Exponential backoff retry (max 3 retries)
                if (retryCount < 3) {
                    const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 10000)
                    
                    logger.info(`Retrying pre-key upload in ${backoffDelay}ms`)
                    
                    await new Promise(resolve => setTimeout(resolve, backoffDelay))
                    
                    return uploadPreKeys(count, retryCount + 1)
                }
                
                throw uploadError
            }
        }
        
        // Add timeout protection
        uploadPreKeysPromise = Promise.race([
            uploadLogic(),
            new Promise((_, reject) => setTimeout(() => reject(new Boom('Pre-key upload timeout', { statusCode: 408 })), UPLOAD_TIMEOUT))
        ])
        
        try {
            await uploadPreKeysPromise
        }
        
        finally {
            uploadPreKeysPromise = null
        }
    }))
return {
digestKeyBundle,
rotateSignedPreKey,
wamBuffer: publicWAMBuffer,
executeUSyncQuery,
onWhatsApp
};
};
