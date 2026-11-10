"use strict"
Object.defineProperty(exports, "__esModule", { value: true })
const { default: NodeCache } = require("@cacheable/node-cache")
const { Boom } = require("@hapi/boom")
const { randomBytes } = require("crypto")
const { proto } = require("../../WAProto")
const {
  DEFAULT_CACHE_TTLS, 
  WA_DEFAULT_EPHEMERAL
} = require("../Defaults/constants")
const { 
  delay, 
  assertMediaContent, 
  bindWaitForEvent, 
  decryptMediaRetryData, 
  encodeNewsletterMessage, 
  encodeSignedDeviceIdentity, 
  encodeWAMessage, 
  encryptMediaRetryRequest,
  extractDeviceJids, 
  generateMessageID, 
  generateParticipantHashV2,
  generateWAMessage, 
  generateWAMessageFromContent, 
  getStatusCodeForMediaRetry, 
  getUrlFromDirectPath, 
  getWAUploadToServer, 
  MessageRetryManager, 
  normalizeMessageContent, 
  parseAndInjectE2ESessions, 
  unixTimestampSeconds,  
  prepareAlbumMessageContent, 
  aggregateMessageKeysNotFromMe
} = require("../Utils")
const { WAMessageAddressingMode } = require("../Types")
const { 
  areJidsSameUser, 
  getBinaryNodeChild, 
  getBinaryNodeChildren, 
  getBinaryFilteredBizBot, 
  getBinaryFilteredButtons, 
  isHostedLidUser, 
  isHostedPnUser, 
  isJidNewsletter, 
  isJidGroup,
  isLidUser, 
  isPnUser, 
  jidDecode,  
  jidEncode, 
  jidNormalizedUser,
  STORIES_JID, 
  S_WHATSAPP_NET 
} = require("../WABinary")
const {
  USyncUser, 
  USyncQuery
} = require("../WAUSync")
const { makeNewsletterSocket } = require("../Socket/newsletter")
const { getUrlInfo } = require("../Utils/link-preview")
const { makeKeyedMutex } = require("../Utils/make-mutex")

exports.attach = function(base, config) {
const { 
        logger,
        linkPreviewImageThumbnailWidth, 
        generateHighQualityLinkPreview,
        options: httpRequestOptions, 
        patchMessageBeforeSending,
        cachedGroupMetadata, 
        enableRecentMessageCache, 
        maxMsgRetryCount 
    } = config
const suki = base
const { 
        ev, 
        authState, 
        messageMutex, 
        signalRepository, 
        upsertMessage, 
        createCallLink, 
        query, 
        fetchPrivacySettings, 
        sendNode, 
        groupQuery, 
        groupMetadata, 
        groupToggleEphemeral, 
        executeUSyncQuery, 
        newsletterMetadata
    } = suki
const userDevicesCache = (base["userDevicesCache"] !== undefined ? base["userDevicesCache"] : (config.userDevicesCache || new NodeCache({
        stdTTL: DEFAULT_CACHE_TTLS.USER_DEVICES,
        useClones: false
    })))
const peerSessionsCache = (base["peerSessionsCache"] !== undefined ? base["peerSessionsCache"] : (new NodeCache({
        stdTTL: DEFAULT_CACHE_TTLS.USER_DEVICES,
        useClones: false
    })))
const messageRetryManager = (base["messageRetryManager"] !== undefined ? base["messageRetryManager"] : (enableRecentMessageCache ? new MessageRetryManager(logger, maxMsgRetryCount) : null))
const encryptionMutex = (base["encryptionMutex"] !== undefined ? base["encryptionMutex"] : (makeKeyedMutex()))
let mediaConn
const refreshMediaConn = (base["refreshMediaConn"] !== undefined ? base["refreshMediaConn"] : (async (forceGet = false) => {
        const media = await mediaConn
        
        if (!media || forceGet || new Date().getTime() - media.fetchDate.getTime() > media.ttl * 1000) {
            mediaConn = (async () => {
                const result = await query({
                    tag: 'iq',
                    attrs: {
                        type: 'set',
                        xmlns: 'w:m',
                        to: S_WHATSAPP_NET
                    },
                    content: [{ tag: 'media_conn', attrs: {} }]
                })
                
                const mediaConnNode = getBinaryNodeChild(result, 'media_conn')
                
                 
                const node = {
                    hosts: getBinaryNodeChildren(mediaConnNode, 'host').map(({ attrs }) => ({
                        hostname: attrs.hostname,
                        maxContentLengthBytes: +attrs.maxContentLengthBytes
                    })),
                    auth: mediaConnNode.attrs.auth,
                    ttl: +mediaConnNode.attrs.ttl,
                    fetchDate: new Date()
                }
                
                logger.debug('fetched media conn')
                
                return node
            })()
        }
        
        return mediaConn
    }))
const getUSyncDevices = (base["getUSyncDevices"] !== undefined ? base["getUSyncDevices"] : (async (jids, useCache, ignoreZeroDevices) => {
        const deviceResults = []
        
        if (!useCache) {
            logger.debug('not using cache for devices')
        }
        
        const toFetch = []
        
        const jidsWithUser = jids
            .map(jid => {
            const decoded = jidDecode(jid)
            const user = decoded?.user
            const device = decoded?.device
            const isExplicitDevice = typeof device === 'number' && device >= 0
            
            if (isExplicitDevice && user) {
                deviceResults.push({
                    user,
                    device,
                    jid
                })
                
                return null
            }
            
            jid = jidNormalizedUser(jid)
            
            return { jid, user }
        }).filter(jid => jid !== null)
            
        let mgetDevices
        
        if (useCache && userDevicesCache.mget) {
            const usersToFetch = jidsWithUser.map(j => j?.user).filter(Boolean)
            
            mgetDevices = await userDevicesCache.mget(usersToFetch)
        }
        
        for (const { jid, user } of jidsWithUser) {
            if (useCache) {
                const devices = mgetDevices?.[user] ||
                    (userDevicesCache.mget ? undefined : (await userDevicesCache.get(user)))
                    
                if (devices) {
                    const devicesWithJid = devices.map(d => ({
                        ...d,
                        jid: jidEncode(d.user, d.server, d.device)
                    }))
                    
                    deviceResults.push(...devicesWithJid)
                    
                    logger.trace({ user }, 'using cache for devices')
                }
                
                else {
                    toFetch.push(jid)
                }
            }
            
            else {
                toFetch.push(jid)
            }
        }
        
        if (!toFetch.length) {
            return deviceResults
        }
        
        const requestedLidUsers = new Set()
        
        for (const jid of toFetch) {
            if (isLidUser(jid) || isHostedLidUser(jid)) {
                const user = jidDecode(jid)?.user
                
                if (user)
                    requestedLidUsers.add(user)
            }
        }
        
        const query = new USyncQuery().withContext('message').withDeviceProtocol().withLIDProtocol()
        
        for (const jid of toFetch) {
            query.withUser(new USyncUser().withId(jid))  
        }
        
        const result = await executeUSyncQuery(query)
        
        if (result) {
             
            const lidResults = result.list.filter(a => !!a.lid)
            
            if (lidResults.length > 0) {
                logger.trace('Storing LID maps from device call')
                
                await signalRepository.lidMapping.storeLIDPNMappings(lidResults.map(a => ({ lid: a.lid, pn: a.id })))
                
                 
                try {
                    const lids = lidResults.map(a => a.lid)
                    
                    if (lids.length) {
                        await assertSessions(lids, true)
                    }
                }
                
                catch (e) {
                    logger.warn({ e, count: lidResults.length }, 'failed to assert sessions for newly mapped LIDs')
                }
            }
            
            const extracted = extractDeviceJids(result?.list, authState.creds.me.id, authState.creds.me.lid, ignoreZeroDevices)
            
            const deviceMap = {}
            
            for (const item of extracted) {
                deviceMap[item.user] = deviceMap[item.user] || []
                deviceMap[item.user]?.push(item)
            }
            
             
            for (const [user, userDevices] of Object.entries(deviceMap)) {
                const isLidUser = requestedLidUsers.has(user);
                 
                for (const item of userDevices) {
                    const finalJid = isLidUser
                        ? jidEncode(user, item.server, item.device)
                        : jidEncode(item.user, item.server, item.device)
                    deviceResults.push({
                        ...item,
                        jid: finalJid
                    })
                    
                    logger.debug({
                        user: item.user,
                        device: item.device,
                        finalJid,
                        usedLid: isLidUser
                    }, 'Processed device with LID priority')
                }
            }
            
            if (userDevicesCache.mset) {
                 
                await userDevicesCache.mset(Object.entries(deviceMap).map(([key, value]) => ({ key, value })))
            }
            
            else {
                for (const key in deviceMap) {
                    if (deviceMap[key])
                        await userDevicesCache.set(key, deviceMap[key])
                }
            }
            
            const userDeviceUpdates = {}
            
            for (const [userId, devices] of Object.entries(deviceMap)) {
                if (devices && devices.length > 0) {
                    userDeviceUpdates[userId] = devices.map(d => d.device?.toString() || '0')
                }
            }
            
            if (Object.keys(userDeviceUpdates).length > 0) {
                try {
                    await authState.keys.set({ 'device-list': userDeviceUpdates })
                    
                    logger.debug({ userCount: Object.keys(userDeviceUpdates).length }, 'stored user device lists for bulk migration')
                }
                
                catch (error) {
                    logger.warn({ error }, 'failed to store user device lists')
                }
            }
        }
        
        return deviceResults
    }))
const updateMemberLabel = (base["updateMemberLabel"] !== undefined ? base["updateMemberLabel"] : ((jid, memberLabel) => {
        if (!isJidGroup(jid)) {
            throw new Error('Jid must a group!')
        }
        
        const protocolMessage = {
            protocolMessage: {
                type: proto.Message.ProtocolMessage.Type.GROUP_MEMBER_LABEL_CHANGE,
                memberLabel: {
                  label: memberLabel?.slice(0, 30),
                  labelTimestamp: unixTimestampSeconds()
                }
            }
        }
        
        return relayMessage(jid, protocolMessage, {
            additionalNodes: [
                {
                    tag: 'meta',
                    attrs: {
                      tag_reason: 'user_update', 
                      appdata: 'member_tag' 
                    }
                }
            ]
        })
    }))
const assertSessions = (base["assertSessions"] !== undefined ? base["assertSessions"] : (async (jids, force) => {
        let didFetchNewSession = false
        
        const uniqueJids = [...new Set(jids)]  
        const jidsRequiringFetch = []
        
        logger.debug({ jids }, 'assertSessions call with jids')
        
         
        for (const jid of uniqueJids) {
            const signalId = signalRepository.jidToSignalProtocolAddress(jid)
            const cachedSession = peerSessionsCache.get(signalId)
            
            if (cachedSession !== undefined) {
                if (cachedSession && !force) {
                    continue  
                }
            }
            
            else {
                const sessionValidation = await signalRepository.validateSession(jid)
                const hasSession = sessionValidation.exists
                
                peerSessionsCache.set(signalId, hasSession)
                
                if (hasSession && !force) {
                    continue
                }
            }
            
            jidsRequiringFetch.push(jid)
        }
        
        if (jidsRequiringFetch.length) {
             
            const wireJids = [
                ...jidsRequiringFetch.filter(jid => !!isLidUser(jid) || !!isHostedLidUser(jid)),
                ...((await signalRepository.lidMapping.getLIDsForPNs(jidsRequiringFetch.filter(jid => !!isPnUser(jid) || !!isHostedPnUser(jid)))) || []).map(a => a.lid)
            ]
            
            logger.debug({ jidsRequiringFetch, wireJids }, 'fetching sessions')
            
            const result = await query({
                tag: 'iq',
                attrs: {
                    xmlns: 'encrypt',
                    type: 'get',
                    to: S_WHATSAPP_NET
                },
                content: [
                    {
                        tag: 'key',
                        attrs: {},
                        content: wireJids.map(jid => {
                            const attrs = { jid }
                            
                            if (force) attrs.reason = 'identity'
                            
                            return { tag: 'user', attrs }
                        })
                    }
                ]
            })
            
            await parseAndInjectE2ESessions(result, signalRepository)
            
            didFetchNewSession = true
            
             
            for (const wireJid of wireJids) {
                const signalId = signalRepository.jidToSignalProtocolAddress(wireJid)
                peerSessionsCache.set(signalId, true)
            }
        }
        
        return didFetchNewSession
    }))
const createParticipantNodes = (base["createParticipantNodes"] !== undefined ? base["createParticipantNodes"] : (async (recipientJids, message, extraAttrs, dsmMessage) => {
        if (!recipientJids.length) {
            return { nodes: [], shouldIncludeDeviceIdentity: false }
        }
        
        const patched = await patchMessageBeforeSending(message, recipientJids)
        const patchedMessages = Array.isArray(patched)
            ? patched
            : recipientJids.map(jid => ({ recipientJid: jid, message: patched }))
            
        let shouldIncludeDeviceIdentity = false
        
        const meId = authState.creds.me.id
        const meLid = authState.creds.me?.lid
        const meLidUser = meLid ? jidDecode(meLid)?.user : null
        const encryptionPromises = patchedMessages.map(async ({ recipientJid: jid, message: patchedMessage }) => {
            if (!jid) return null
                
            let msgToEncrypt = patchedMessage
            
            if (dsmMessage) {
                const { user: targetUser } = jidDecode(jid)
                const { user: ownPnUser } = jidDecode(meId)
                const ownLidUser = meLidUser
                const isOwnUser = targetUser === ownPnUser || (ownLidUser && targetUser === ownLidUser)
                const isExactSenderDevice = jid === meId || (meLid && jid === meLid)
                
                if (isOwnUser && !isExactSenderDevice) {
                    msgToEncrypt = dsmMessage
                    logger.debug({ jid, targetUser }, 'Using DSM for own device')
                }
            }
            
            const bytes = encodeWAMessage(msgToEncrypt)
            const mutexKey = jid
            const node = await encryptionMutex.mutex(mutexKey, async () => {
                const { type, ciphertext } = await signalRepository.encryptMessage({
                    jid,
                    data: bytes
                })
                
                if (type === 'pkmsg') {
                    shouldIncludeDeviceIdentity = true
                }
                
                return {
                    tag: 'to',
                    attrs: { jid },
                    content: [
                        {
                            tag: 'enc',
                            attrs: {
                                v: '2',
                                type,
                                ...(extraAttrs || {})
                            },
                            content: ciphertext
                        }
                    ]
                };
            })
            
            return node
        })
        
        const nodes = (await Promise.all(encryptionPromises)).filter(node => node !== null)
        
        return { nodes, shouldIncludeDeviceIdentity }
    }))
const profilePictureUrl = (base["profilePictureUrl"] !== undefined ? base["profilePictureUrl"] : (async (jid) => {
        if (isJidNewsletter(jid)) {
            const metadata = await suki.newsletterMetadata('JID', jid) 

            return getUrlFromDirectPath(metadata.thread_metadata.picture?.direct_path || '') 

         } 

         else {               
              const result = await query({
                  tag: 'iq',
                  attrs: {
                      target: jidNormalizedUser(jid),
                      to: S_WHATSAPP_NET,
                      type: 'get',
                      xmlns: 'w:profile:picture'
                   },
                   content: [{ 
                        tag: 'picture', 
                        attrs: { 
                           type: 'image', 
                           query: 'url' 
                        }
                   }]
              })

              const child = getBinaryNodeChild(result, 'picture')

              return child?.attrs?.url || null
          }
    }))
const relayMessage = (base["relayMessage"] !== undefined ? base["relayMessage"] : (async (jid, message, { messageId: msgId, participant, additionalAttributes, useUserDevicesCache, useCachedGroupMetadata, statusJidList, additionalNodes, AI = false }) => {
        const meId = authState.creds.me.id
        const meLid = authState.creds.me?.lid
        const isRetryResend = Boolean(participant?.jid)
        
        let shouldIncludeDeviceIdentity = isRetryResend
        let didPushAdditional = false
        
        const statusJid = 'status@broadcast'
        const { user, server } = jidDecode(jid)
        const isGroup = server === 'g.us'
        const isStatus = jid === statusJid
        const isLid = server === 'lid'
        const isNewsletter = server === 'newsletter'
        const isGroupOrStatus = isGroup || isStatus
        const finalJid = jid
        
        msgId = msgId || generateMessageID(meId)
        useUserDevicesCache = useUserDevicesCache !== false;
        useCachedGroupMetadata = useCachedGroupMetadata !== false && !isStatus
        
        const participants = []
        const destinationJid = !isStatus ? finalJid : statusJid
        const binaryNodeContent = []
        const devices = []

        const meMsg = {
            deviceSentMessage: {
                destinationJid,
                message
            }, 
            messageContextInfo: message.messageContextInfo
        }

        const extraAttrs = {}

        const regexGroupOld = /^(\d{1,15})-(\d+)@g\.us$/

        const messages = normalizeMessageContent(message)  

        const buttonType = getButtonType(messages)
        const pollMessage = messages.pollCreationMessage || messages.pollCreationMessageV2 || messages.pollCreationMessageV3


        if (participant) {
            if (!isGroup && !isStatus) {
                additionalAttributes = { ...additionalAttributes, device_fanout: 'false' }
            }
            
            const { user, device } = jidDecode(participant.jid)
            
            devices.push({
                user,
                device,
                jid: participant.jid
            })
        }

        await authState.keys.transaction(async () => {
            const mediaType = getMediaType(message)

            if (mediaType) {
                extraAttrs['mediatype'] = mediaType
            }
            
            if (isNewsletter) {
                const patched = patchMessageBeforeSending ? await patchMessageBeforeSending(message, []) : message
                const bytes = encodeNewsletterMessage(patched)
                
                binaryNodeContent.push({
                    tag: 'plaintext',
                    attrs: {},
                    content: bytes
                })
                
                const stanza = {
                    tag: 'message',
                    attrs: {
                        to: jid,
                        id: msgId,
                        type: getTypeMessage(message),
                        ...(additionalAttributes || {})
                    },
                    content: binaryNodeContent
                }
                
                logger.debug({ msgId }, `sending newsletter message to ${jid}`)
                
                require('../Utils/interactive-compat').applyKageInteractiveNodes(stanza, message, additionalNodes);
            await sendNode(stanza);
                
                return
            }

            if (messages.pinInChatMessage || messages.keepInChatMessage || message.reactionMessage || message.protocolMessage?.editedMessage) {
                extraAttrs['decrypt-fail'] = 'hide'
            } 

            if (messages.interactiveResponseMessage?.nativeFlowResponseMessage) {
                extraAttrs['native_flow_name'] = messages.interactiveResponseMessage.nativeFlowResponseMessage?.name || 'menu_options'
            }

            if (isGroupOrStatus && !isRetryResend) {
                const [groupData, senderKeyMap] = await Promise.all([
                    (async () => {
                        let groupData = useCachedGroupMetadata && cachedGroupMetadata ? await cachedGroupMetadata(jid) : undefined  
                        
                        if (groupData && Array.isArray(groupData?.participants)) {
                            logger.trace({ jid, participants: groupData.participants.length }, 'using cached group metadata')
                        }
                        
                        else if (!isStatus) {
                            groupData = await groupMetadata(jid)  
                        }
                        
                        return groupData
                    })(),
                    (async () => {
                        if (!participant && !isStatus) {
                             
                             
                            const result = await authState.keys.get('sender-key-memory', [jid])  
                            
                            return result[jid] || {}
                        }
                        
                        return {}
                    })()
                ])
                
                const participantsList = groupData ? groupData.participants.map(p => p.id) : []
                
                if (groupData?.ephemeralDuration && groupData.ephemeralDuration > 0) {
                    additionalAttributes = {
                        ...additionalAttributes,
                        expiration: groupData.ephemeralDuration.toString()
                    }
                }
                
                if (isStatus && statusJidList) {
                    participantsList.push(...statusJidList)
                }
                
                const additionalDevices = await getUSyncDevices(participantsList, !!useUserDevicesCache, false)
                
                devices.push(...additionalDevices)
                
                if (isGroup) {
                    additionalAttributes = {
                        ...additionalAttributes,
                        addressing_mode: groupData?.addressingMode || 'lid'
                    }
                }
                
                const patched = await patchMessageBeforeSending(message)
                
                if (Array.isArray(patched)) {
                    throw new Boom('Per-jid patching is not supported in groups')
                }
                
                const bytes = encodeWAMessage(patched)
                const groupAddressingMode = additionalAttributes?.['addressing_mode'] || groupData?.addressingMode || 'lid'
                const groupSenderIdentity = groupAddressingMode === 'lid' && meLid ? meLid : meId
                const { ciphertext, senderKeyDistributionMessage } = await signalRepository.encryptGroupMessage({
                    group: destinationJid,
                    data: bytes,
                    meId: groupSenderIdentity
                })
                
                const senderKeyRecipients = []
                
                for (const device of devices) {
                    const deviceJid = device.jid
                    const hasKey = !!senderKeyMap[deviceJid]
                    
                    if ((!hasKey || !!participant) &&
                        !isHostedLidUser(deviceJid) &&
                        !isHostedPnUser(deviceJid) &&
                        device.device !== 99) {
                         
                         
                        senderKeyRecipients.push(deviceJid)
                        senderKeyMap[deviceJid] = true
                    }
                }
                
                if (senderKeyRecipients.length) {
                    logger.debug({ senderKeyJids: senderKeyRecipients }, 'sending new sender key')
                    
                    const senderKeyMsg = {
                        senderKeyDistributionMessage: {
                            axolotlSenderKeyDistributionMessage: senderKeyDistributionMessage,
                            groupId: destinationJid
                        }
                    }
                    
                    const senderKeySessionTargets = senderKeyRecipients
                    
                    await assertSessions(senderKeySessionTargets)
                    
                    const result = await createParticipantNodes(senderKeyRecipients, senderKeyMsg, extraAttrs)
                    
                    shouldIncludeDeviceIdentity = shouldIncludeDeviceIdentity || result.shouldIncludeDeviceIdentity;
                    participants.push(...result.nodes)
                }
                
                binaryNodeContent.push({
                    tag: 'enc',
                    attrs: { v: '2', type: 'skmsg', ...extraAttrs },
                    content: ciphertext
                })
                
                await authState.keys.set({ 'sender-key-memory': { [jid]: senderKeyMap } })
            }

            else {
                 
                 
                let ownId = meId
                
                if (isLid && meLid) {
                    ownId = meLid;
                    logger.debug({ to: jid, ownId }, 'Using LID identity for @lid conversation')
                }
                
                else {
                    logger.debug({ to: jid, ownId }, 'Using PN identity for @s.whatsapp.net conversation')
                }
                
                const { user: ownUser } = jidDecode(ownId)
                
                if (!isRetryResend) {
                    const targetUserServer = isLid ? 'lid' : 's.whatsapp.net'
                    
                    devices.push({
                        user,
                        device: 0,
                        jid: jidEncode(user, targetUserServer, 0)  
                    })
                    
                    if (user !== ownUser) {
                        const ownUserServer = isLid ? 'lid' : 's.whatsapp.net'
                        const ownUserForAddressing = isLid && meLid ? jidDecode(meLid).user : jidDecode(meId).user
                        
                        devices.push({
                            user: ownUserForAddressing,
                            device: 0,
                            jid: jidEncode(ownUserForAddressing, ownUserServer, 0)
                        })
                    }
                    
                    if (additionalAttributes?.['category'] !== 'peer') {
                         
                        devices.length = 0
                        
                         
                        const senderIdentity = isLid && meLid
                            ? jidEncode(jidDecode(meLid)?.user, 'lid', undefined)
                            : jidEncode(jidDecode(meId)?.user, 's.whatsapp.net', undefined)
                         
                        const sessionDevices = await getUSyncDevices([senderIdentity, jid], true, false)
                        
                        devices.push(...sessionDevices)
                        
                        logger.debug({
                            deviceCount: devices.length,
                            devices: devices.map(d => `${d.user}:${d.device}@${jidDecode(d.jid)?.server}`)
                        }, 'Device enumeration complete with unified addressing')
                    }
                }
                
                const allRecipients = []
                const meRecipients = []
                const otherRecipients = []
                
                const { user: mePnUser } = jidDecode(meId)
                const { user: meLidUser } = meLid ? jidDecode(meLid) : { user: null }
                
                for (const { user, jid } of devices) {
                    const isExactSenderDevice = jid === meId || (meLid && jid === meLid)
                    
                    if (isExactSenderDevice) {
                        logger.debug({ jid, meId, meLid }, 'Skipping exact sender device (whatsmeow pattern)')
                        continue
                    }
                    
                     
                    const isMe = user === mePnUser || user === meLidUser
                    
                    if (isMe) {
                        meRecipients.push(jid);
                    }
                    
                    else {
                        otherRecipients.push(jid)
                    }
                    
                    allRecipients.push(jid)
                }
                
                await assertSessions(allRecipients)
                
                const [{ nodes: meNodes, shouldIncludeDeviceIdentity: s1 }, { nodes: otherNodes, shouldIncludeDeviceIdentity: s2 }] = await Promise.all([
                     
                    createParticipantNodes(meRecipients, meMsg || message, extraAttrs),
                    createParticipantNodes(otherRecipients, message, extraAttrs, meMsg)
                ])
                
                participants.push(...meNodes)
                participants.push(...otherNodes)
                
                if (meRecipients.length > 0 || otherRecipients.length > 0) {
                    extraAttrs['phash'] = generateParticipantHashV2([...meRecipients, ...otherRecipients])
                }
                
                shouldIncludeDeviceIdentity = shouldIncludeDeviceIdentity || s1 || s2
            }
            
            if (isRetryResend) {
                const isParticipantLid = isLidUser(participant.jid)
                const isMe = areJidsSameUser(participant.jid, isParticipantLid ? meLid : meId)
                const encodedMessageToSend = isMe
                    ? encodeWAMessage({
                        deviceSentMessage: {
                            destinationJid,
                            message
                        }
                    })
                    : encodeWAMessage(message)
                const { type, ciphertext: encryptedContent } = await signalRepository.encryptMessage({
                    data: encodedMessageToSend,
                    jid: participant.jid
                })
                
                binaryNodeContent.push({
                    tag: 'enc',
                    attrs: {
                        v: '2',
                        type,
                        count: participant.count.toString()
                    },
                    content: encryptedContent
                })
            }
            
            if (participants.length) {
                if (additionalAttributes?.['category'] === 'peer') {
                    const peerNode = participants[0]?.content?.[0]
                    
                    if (peerNode) {
                        binaryNodeContent.push(peerNode)  
                    }
                }
                
                else {
                    binaryNodeContent.push({
                        tag: 'participants',
                        attrs: {},
                        content: participants
                    });
                }
            }
            
            const stanza = {
                tag: 'message',
                attrs: {
                    id: msgId,
                    to: destinationJid,
                    type: getTypeMessage(message),
                    ...(additionalAttributes || {})
                },
                content: binaryNodeContent
            }

             
             
             
            if (participant) {
                if (isJidGroup(destinationJid)) {
                    stanza.attrs.to = destinationJid
                    stanza.attrs.participant = participant.jid
                }
                
                else if (areJidsSameUser(participant.jid, meId)) {
                    stanza.attrs.to = participant.jid
                    stanza.attrs.recipient = destinationJid
                }
                
                else {
                    stanza.attrs.to = participant.jid
                }
            }
            
            else {
                stanza.attrs.to = destinationJid
            }
            
            if (shouldIncludeDeviceIdentity) {
                stanza.content.push({
                    tag: 'device-identity',
                    attrs: {},
                    content: encodeSignedDeviceIdentity(authState.creds.account, true)
                })
                
                logger.debug({ jid }, 'adding device identity')
            }
            
            const contactTcTokenData = !isGroup && !isRetryResend && !isStatus ? await authState.keys.get('tctoken', [destinationJid]) : {}
            const tcTokenBuffer = contactTcTokenData[destinationJid]?.token
            
            if (tcTokenBuffer) {
                stanza.content.push({
                    tag: 'tctoken',
                    attrs: {},
                    content: tcTokenBuffer
                })
            }

            if (isGroup && regexGroupOld.test(jid) && !message.reactionMessage) {
                stanza.content.push({
                    tag: 'multicast',
                    attrs: {}
                }) 
           }

            if (pollMessage || messages.eventMessage) {
                stanza.content.push({
                    tag: 'meta', 
                    attrs: messages.eventMessage ? {
                        event_type: 'creation'
                    } : isNewsletter ? {
                        polltype: 'creation', 
                        contenttype: pollMessage?.pollContentType === 2 ? 'image' : 'text'
                    } : {
                        polltype: 'creation'
                    }
                }) 
            }

            if (!isNewsletter && buttonType) {
                const buttonsNode = getButtonArgs(messages)
                const filteredButtons = getBinaryFilteredButtons(additionalNodes ? additionalNodes : [])

                if (filteredButtons) {
                   stanza.content.push(...additionalNodes)
                   didPushAdditional = true
                }

                else {
                    stanza.content.push(buttonsNode)
                }
            }

            if (AI && !isGroup && !isNewsletter && !isStatus) {
                const botNode = {
                    tag: 'bot', 
                    attrs: {
                        biz_bot: '1'
                    }
                }

                const filteredBizBot = getBinaryFilteredBizBot(additionalNodes ? additionalNodes : []) 

                if (filteredBizBot) {
                    stanza.content.push(...additionalNodes) 
                    didPushAdditional = true
                }

                else {
                    stanza.content.push(botNode) 
                }
            }

            if (!didPushAdditional && additionalNodes && additionalNodes.length > 0) {
                stanza.content.push(...additionalNodes)
            }  

            logger.debug({ msgId }, `sending message to ${participants.length} devices`)

            require('../Utils/interactive-compat').applyKageInteractiveNodes(stanza, message, additionalNodes);
            await sendNode(stanza);
            
             
            if (messageRetryManager && !participant) {
                messageRetryManager.addRecentMessage(destinationJid, msgId, message)
            }
        }, meId)

        return msgId
    }))
const getTypeMessage = (base["getTypeMessage"] !== undefined ? base["getTypeMessage"] : ((msg) => {
        const message = normalizeMessageContent(msg)  
        if (message.pollCreationMessage || message.pollCreationMessageV2 || message.pollCreationMessageV3) {
            return 'poll'
        }       
        else if (message.reactionMessage) {
            return 'reaction'
        }       
        else if (message.eventMessage) {
            return 'event'
        }        
        else if (getMediaType(message)) {
            return 'media'
        }        
        else {
            return 'text'
        }
    }))
const getMediaType = (base["getMediaType"] !== undefined ? base["getMediaType"] : ((message) => {
      if (message.imageMessage) {
            return 'image'
        }
        else if (message.stickerMessage) {
            return message.stickerMessage.isLottie ? '1p_sticker' : message.stickerMessage.isAvatar ? 'avatar_sticker' : 'sticker'
        }
        else if (message.videoMessage) {
            return message.videoMessage.gifPlayback ? 'gif' : 'video'
        }
        else if (message.audioMessage) {
            return message.audioMessage.ptt ? 'ptt' : 'audio'
        }
        else if (message.ptvMessage) {
            return 'ptv'
        }
        else if (message.albumMessage) {
            return 'collection'
        }
        else if (message.contactMessage) {
            return 'vcard'
        }
        else if (message.documentMessage) {
            return 'document'
        }
        else if (message.stickerPackMessage) {
            return 'sticker_pack'
        }
        else if (message.contactsArrayMessage) {
            return 'contact_array'
        }
        else if (message.locationMessage) {
            return 'location'
        }
        else if (message.liveLocationMessage) {
            return 'livelocation'
        }
        else if (message.listMessage) {
            return 'list'
        }
        else if (message.listResponseMessage) {
            return 'list_response'
        }
        else if (message.buttonsResponseMessage) {
            return 'buttons_response'
        }
        else if (message.orderMessage) {
            return 'order'
        }
        else if (message.productMessage) {
            return 'product'
        }
        else if (message.interactiveResponseMessage) {
            return 'native_flow_response'
        }
        else if (/https:\/\/wa\.me\/c\/\d+/.test(message.extendedTextMessage?.text)) {
            return 'cataloglink'
        }
        else if (/https:\/\/wa\.me\/p\/\d+\/\d+/.test(message.extendedTextMessage?.text)) {
            return 'productlink'
        }
        else if (message.extendedTextMessage?.matchedText || message.groupInviteMessage) {
            return 'url'
        }
    }))
const getButtonType = (base["getButtonType"] !== undefined ? base["getButtonType"] : ((message) => {
        if (message.listMessage) {
            return 'list'
       }
        else if (message.buttonsMessage) {
            return 'buttons'
        }
        else if(message.interactiveMessage?.nativeFlowMessage) {
            return 'native_flow'
        }
    }))
const getButtonArgs = (base["getButtonArgs"] !== undefined ? base["getButtonArgs"] : ((message) => {
        const nativeFlow = message.interactiveMessage?.nativeFlowMessage
        const firstButtonName = nativeFlow?.buttons?.[0]?.name
        const nativeFlowSpecials = [
            'mpm', 'cta_catalog', 'send_location',
            'call_permission_request', 'wa_payment_transaction_details',
            'automated_greeting_message_view_catalog'
        ]

        if (nativeFlow && (firstButtonName === 'review_and_pay' || firstButtonName === 'payment_info')) {
                return {
                    tag: 'biz', 
                    attrs: {
                        native_flow_name: firstButtonName === 'review_and_pay' ? 'order_details' : firstButtonName
                }
            } 
        } else if (nativeFlow && nativeFlowSpecials.includes(firstButtonName)) {
             
            return {
                tag: 'biz',
                attrs: {
                	actual_actors: '2', 
                	host_storage: '2', 
                	privacy_mode_ts: unixTimestampSeconds().toString()
                }, 
                content: [{
                    tag: 'interactive',
                    attrs: {
                        type: 'native_flow',
                        v: '1'
                    },
                    content: [{
                        tag: 'native_flow',
                        attrs: {
                            v: '2', 
                            name: firstButtonName
                        }
                    }]
                }, 
                {
                	tag: 'quality_control', 
                	attrs: {
                		source_type: 'third_party'
                	}
                }]
            }
        } else if (nativeFlow || message.buttonsMessage) {
             
            return {
                tag: 'biz', 
                attrs: {
                	actual_actors: '2', 
                	host_storage: '2', 
                	privacy_mode_ts: unixTimestampSeconds().toString()
                }, 
                content: [{
                    tag: 'interactive', 
                    attrs: {
                        type: 'native_flow', 
                        v: '1'
                    }, 
                    content: [{
                        tag: 'native_flow', 
                        attrs: {
                            v: '9', 
                            name: 'mixed'
                        }
                    }]
                }, 
                {
                	tag: 'quality_control', 
                	attrs: {
                		source_type: 'third_party'
                	}
                }]
            }
        } else if (message.listMessage) {
            return {
                tag: 'biz', 
                attrs: {
                	actual_actors: '2', 
                	host_storage: '2', 
                	privacy_mode_ts: unixTimestampSeconds().toString()
                }, 
                content: [{
                    tag: 'list', 
                    attrs: {
                        v: '2', 
                        type: 'product_list'
                    }
                }, 
                {
                	tag: 'quality_control', 
                	attrs: {
                		source_type: 'third_party'
                	}
                }]
            }
        } else {
            return {
                tag: 'biz', 
                attrs: {
                	actual_actors: '2', 
                	host_storage: '2', 
                	privacy_mode_ts: unixTimestampSeconds().toString()
                }
            }
        }
    }))
const getEphemeralGroup = (base["getEphemeralGroup"] !== undefined ? base["getEphemeralGroup"] : ((jid) => {
    	if (!isJidGroup(jid)) throw new TypeError("Jid should originate from a group!") 
    
        return groupQuery(jid, 'get', [{
        	tag: 'query',
            attrs: {
            	request: 'interactive'
            }
        }])
        .then((groups) => getBinaryNodeChild(groups, 'group'))
        .then((metadata) => getBinaryNodeChild(metadata, 'ephemeral')?.attrs?.expiration || 0) 
    }))
const waUploadToServer = (base["waUploadToServer"] !== undefined ? base["waUploadToServer"] : (getWAUploadToServer(config, refreshMediaConn)))
return {
profilePictureUrl,
getEphemeralGroup,
messageRetryManager,
updateMemberLabel,
sendStatusMentions: async (content, jids = []) => {
          const userJid = jidNormalizedUser(authState.creds.me.id)
          let allUsers = new Set()
          allUsers.add(userJid)

          for (const id of jids) {
            const isGroup = isJidGroup(id) 
            const isPrivate = isPnUser(id) 

            if (isGroup) {
              try {
                const metadata = await cachedGroupMetadata(id) || await groupMetadata(id)
                const participants = metadata.participants.map(p => jidNormalizedUser(p.id))
                participants.forEach(jid => allUsers.add(jid))
              } catch (error) {
                logger.error(`Error getting metadata for group ${id}: ${error}`)
              }
            } else if (isPrivate) {
              allUsers.add(jidNormalizedUser(id))
            }
          }

          const uniqueUsers = Array.from(allUsers)
          const getRandomHexColor = () => "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, "0")

          const isMedia = content.image || content.video || content.audio
          const isAudio = !!content.audio

          const messageContent = { ...content }

          if (isMedia && !isAudio) {
            if (messageContent.text) {
              messageContent.caption = messageContent.text

              delete messageContent.text
            }

            delete messageContent.ptt
            delete messageContent.font
            delete messageContent.backgroundColor
            delete messageContent.textColor
          }

          if (isAudio) {
            delete messageContent.text
            delete messageContent.caption
            delete messageContent.font
            delete messageContent.textColor
          }

          const font = !isMedia ? (content.font || Math.floor(Math.random() * 9)) : undefined
          const textColor = !isMedia ? (content.textColor || getRandomHexColor()) : undefined
          const backgroundColor = (!isMedia || isAudio) ? (content.backgroundColor || getRandomHexColor()) : undefined
          const ptt = isAudio ? (typeof content.ptt === 'boolean' ? content.ptt : true) : undefined

          let msg
          let mediaHandle
          try {
            msg = await generateWAMessage(STORIES_JID, messageContent, {
              logger,
              userJid,
              getUrlInfo: text => getUrlInfo(text, {
                thumbnailWidth: linkPreviewImageThumbnailWidth,
                fetchOpts: {
                    timeout: 3000,
                    ...(httpRequestOptions || {})
                },
                logger,
                uploadImage: generateHighQualityLinkPreview ? waUploadToServer : undefined
              }),
              upload: async (encFilePath, opts) => {
                const up = await waUploadToServer(encFilePath, { ...opts })
                mediaHandle = up.handle
                return up
              },
              mediaCache: config.mediaCache,
              options: config.options,
              font,
              textColor,
              backgroundColor,
              ptt
            })
          } catch (error) {
            logger.error(`Error generating message: ${error}`)
            throw error
          }

          await relayMessage(STORIES_JID, msg.message, {
            messageId: msg.key.id,
            statusJidList: uniqueUsers, 
            additionalNodes: [
              {
                tag: 'meta',
                attrs: {},
                content: [
                  {
                    tag: 'mentioned_users',
                    attrs: {},
                    content: jids.map(jid => ({
                      tag: 'to',
                      attrs: { jid: jidNormalizedUser(jid) }
                    }))
                  }]
              }]
          })

          for (const id of jids) {
            try {
              const normalizedId = jidNormalizedUser(id)
              const isPrivate = isPnUser(normalizedId) 
              const type = isPrivate ? 'statusMentionMessage' : 'groupStatusMentionMessage'

              const protocolMessage = {
                [type]: {
                  message: {
                    protocolMessage: {
                      key: msg.key,
                      type: 25
                    }
                  }
                },
                messageContextInfo: {
                  messageSecret: randomBytes(32)
                }
              }

              const statusMsg = await generateWAMessageFromContent(normalizedId,
                protocolMessage,
                {}
              )

              await relayMessage(
                normalizedId,
                statusMsg.message,
                {
                  additionalNodes: [{
                    tag: 'meta',
                    attrs: isPrivate ?
                    { is_status_mention: 'true' } :
                    { is_group_status_mention: 'true' }
                  }]
                }
              )

              await delay(2000)
            } catch (error) {
              logger.error(`Error sending to ${id}: ${error}`)
            }
          }

          return msg
        }
};
};
