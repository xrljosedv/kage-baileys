"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachAdvanced = exports.buildProfilePictureQueryContent = void 0;
const index_js_1 = require("../../WAProto/index.js");
const index_js_2 = require("../Addon/index.js");
const index_js_3 = require("../Defaults/index.js");
const index_js_4 = require("../Types/index.js");
const State_js_1 = require("../Types/State.js");
const index_js_5 = require("../Utils/index.js");
const make_mutex_js_1 = require("../Utils/make-mutex.js");
const process_message_js_1 = __importDefault(require("../Utils/process-message.js"));
const tc_token_utils_js_1 = require("../Utils/tc-token-utils.js");
const index_js_6 = require("../WABinary/index.js");
const index_js_7 = require("../WAUSync/index.js");
const buildProfilePictureQueryContent = (type, tcTokenContent) => {
    const picture = { tag: 'picture', attrs: { type, query: 'url' } };
    if (tcTokenContent?.length) {
        picture.content = tcTokenContent;
    }
    return [picture];
};
exports.buildProfilePictureQueryContent = buildProfilePictureQueryContent;
const attachAdvanced = (base, config) => {
    const { logger, markOnlineOnConnect, fireInitQueries, appStateMacVerification, shouldIgnoreJid, shouldSyncHistoryMessage, getMessage } = config;
    const sock = base;
    const { ev, ws, authState, generateMessageTag, sendNode, query, signalRepository, onUnexpectedError, sendUnifiedSession, registerSocketEndHandler } = sock;
    const getLIDForPN = signalRepository.lidMapping.getLIDForPN.bind(signalRepository.lidMapping);
    let privacySettings;
     
    const serverProps = {
         
        privacyTokenOn1to1: true,
         
        profilePicPrivacyToken: true,
         
        lidTrustedTokenIssueToLid: false
    };
    let syncState = State_js_1.SyncState.Connecting;
     
    const messageMutex = (0, make_mutex_js_1.makeMutex)();
     
    const receiptMutex = (0, make_mutex_js_1.makeMutex)();
     
    const appStatePatchMutex = (0, make_mutex_js_1.makeMutex)();
     
    const notificationMutex = (0, make_mutex_js_1.makeMutex)();
     
    let awaitingSyncTimeout;
     
    const historySyncStatus = {
        initialBootstrapComplete: false,
        recentSyncComplete: false
    };
    let historySyncPausedTimeout;
     
     
    const blockedCollections = new Set();
    const placeholderResendCache = config.placeholderResendCache ||
        (0, index_js_2.createCache)({
            ttl: index_js_3.DEFAULT_CACHE_TTLS.MSG_RETRY  
        });
     
    const getAppStateSyncKey = async (keyId) => {
        const { [keyId]: key } = await authState.keys.get('app-state-sync-key', [keyId]);
        return key;
    };
    const fetchPrivacySettings = async (force = false) => {
        if (!privacySettings || force) {
            const { content } = await query({
                tag: 'iq',
                attrs: {
                    xmlns: 'privacy',
                    to: index_js_6.S_WHATSAPP_NET,
                    type: 'get'
                },
                content: [{ tag: 'privacy', attrs: {} }]
            });
            privacySettings = (0, index_js_6.reduceBinaryNodeToDictionary)(content?.[0], 'category');
        }
        return privacySettings;
    };
     
    const privacyQuery = async (name, value) => {
        await query({
            tag: 'iq',
            attrs: {
                xmlns: 'privacy',
                to: index_js_6.S_WHATSAPP_NET,
                type: 'set'
            },
            content: [
                {
                    tag: 'privacy',
                    attrs: {},
                    content: [
                        {
                            tag: 'category',
                            attrs: { name, value }
                        }
                    ]
                }
            ]
        });
    };
    const updateMessagesPrivacy = async (value) => {
        await privacyQuery('messages', value);
    };
    const updateCallPrivacy = async (value) => {
        await privacyQuery('calladd', value);
    };
    const updateLastSeenPrivacy = async (value) => {
        await privacyQuery('last', value);
    };
    const updateOnlinePrivacy = async (value) => {
        await privacyQuery('online', value);
    };
    const updateProfilePicturePrivacy = async (value) => {
        await privacyQuery('profile', value);
    };
    const updateStatusPrivacy = async (value) => {
        await privacyQuery('status', value);
    };
    const updateReadReceiptsPrivacy = async (value) => {
        await privacyQuery('readreceipts', value);
    };
    const updateGroupsAddPrivacy = async (value) => {
        await privacyQuery('groupadd', value);
    };
    const updateDefaultDisappearingMode = async (duration) => {
        await query({
            tag: 'iq',
            attrs: {
                xmlns: 'disappearing_mode',
                to: index_js_6.S_WHATSAPP_NET,
                type: 'set'
            },
            content: [
                {
                    tag: 'disappearing_mode',
                    attrs: {
                        duration: duration.toString()
                    }
                }
            ]
        });
    };
    const getBotListV2 = async () => {
        const resp = await query({
            tag: 'iq',
            attrs: {
                xmlns: 'bot',
                to: index_js_6.S_WHATSAPP_NET,
                type: 'get'
            },
            content: [
                {
                    tag: 'bot',
                    attrs: {
                        v: '2'
                    }
                }
            ]
        });
        const botNode = (0, index_js_6.getBinaryNodeChild)(resp, 'bot');
        const botList = [];
        for (const section of (0, index_js_6.getBinaryNodeChildren)(botNode, 'section')) {
            if (section.attrs.type === 'all') {
                for (const bot of (0, index_js_6.getBinaryNodeChildren)(section, 'bot')) {
                    botList.push({
                        jid: bot.attrs.jid,
                        personaId: bot.attrs['persona_id']
                    });
                }
            }
        }
        return botList;
    };
    const fetchStatus = async (...jids) => {
        const usyncQuery = new index_js_7.USyncQuery().withStatusProtocol();
        for (const jid of jids) {
            usyncQuery.withUser(new index_js_7.USyncUser().withId(jid));
        }
        const result = await sock.executeUSyncQuery(usyncQuery);
        if (result) {
            return result.list;
        }
    };
    const fetchDisappearingDuration = async (...jids) => {
        const usyncQuery = new index_js_7.USyncQuery().withDisappearingModeProtocol();
        for (const jid of jids) {
            usyncQuery.withUser(new index_js_7.USyncUser().withId(jid));
        }
        const result = await sock.executeUSyncQuery(usyncQuery);
        if (result) {
            return result.list;
        }
    };
     
    const findUserId = async (pnLid) => {
        const normalizedJid = (0, index_js_6.jidNormalizedUser)(pnLid);
        const userId = {
            lid: undefined,
            phoneNumber: undefined
        };
        if ((0, index_js_6.isPnUser)(normalizedJid) || (0, index_js_6.isHostedPnUser)(normalizedJid)) {
            userId.phoneNumber = normalizedJid;
            userId.lid = (0, index_js_6.jidNormalizedUser)((await signalRepository.lidMapping.getLIDsForPNs([normalizedJid]))?.[0]?.lid);
        }
        else if ((0, index_js_6.isLidUser)(normalizedJid) || (0, index_js_6.isHostedLidUser)(normalizedJid)) {
            userId.lid = normalizedJid;
            userId.phoneNumber = (0, index_js_6.jidNormalizedUser)((await signalRepository.lidMapping.getPNsForLIDs([normalizedJid]))?.[0]?.pn);
        }
        else {
            throw new index_js_2.HttpError('Invalid id input to find user ids', { statusCode: 400 });
        }
        return userId;
    };
     
    const updateProfilePicture = async (jid, content, dimensions) => {
        let targetJid;
        if (!jid) {
            throw new index_js_2.HttpError('Illegal no-jid profile update. Please specify either your ID or the ID of the chat you wish to update');
        }
        if ((0, index_js_6.jidNormalizedUser)(jid) !== (0, index_js_6.jidNormalizedUser)(authState.creds.me.id)) {
            targetJid = (0, index_js_6.jidNormalizedUser)(jid);  
        }
        else {
            targetJid = undefined;
        }
        const { img } = await (0, index_js_5.generateProfilePicture)(content, dimensions);
        await query({
            tag: 'iq',
            attrs: {
                to: index_js_6.S_WHATSAPP_NET,
                type: 'set',
                xmlns: 'w:profile:picture',
                ...(targetJid ? { target: targetJid } : {})
            },
            content: [
                {
                    tag: 'picture',
                    attrs: { type: 'image' },
                    content: img
                }
            ]
        });
    };
     
    const removeProfilePicture = async (jid) => {
        let targetJid;
        if (!jid) {
            throw new index_js_2.HttpError('Illegal no-jid profile update. Please specify either your ID or the ID of the chat you wish to update');
        }
        if ((0, index_js_6.jidNormalizedUser)(jid) !== (0, index_js_6.jidNormalizedUser)(authState.creds.me.id)) {
            targetJid = (0, index_js_6.jidNormalizedUser)(jid);  
        }
        else {
            targetJid = undefined;
        }
        await query({
            tag: 'iq',
            attrs: {
                to: index_js_6.S_WHATSAPP_NET,
                type: 'set',
                xmlns: 'w:profile:picture',
                ...(targetJid ? { target: targetJid } : {})
            }
        });
    };
     
    
     
    /**
     * Actualiza la foto de portada (cover photo) del perfil.
     * Compatible con cuentas normales (nueva función 2026) y Business.
     * Acepta Buffer, {url}, {stream}.
     */
    const updateProfileCoverPhoto = async (photo) => {
        const { fileSha256, filePath } = await (0, index_js_5.getRawMediaUploadData)(photo, 'cover-photo');
        const fileSha256B64 = fileSha256.toString('base64');
        const { meta_hmac, fbid, ts } = await waUploadToServer(filePath, {
            fileEncSha256B64: fileSha256B64,
            mediaType: 'cover-photo'
        });
        // Intento principal con protocolo de perfil / business compatible
        try {
            await query({
                tag: 'iq',
                attrs: {
                    to: index_js_6.S_WHATSAPP_NET,
                    type: 'set',
                    xmlns: 'w:biz'
                },
                content: [
                    {
                        tag: 'business_profile',
                        attrs: {
                            v: '3',
                            mutation_type: 'delta'
                        },
                        content: [
                            {
                                tag: 'cover_photo',
                                attrs: { id: String(fbid), op: 'update', token: meta_hmac, ts: String(ts) }
                            }
                        ]
                    }
                ]
            });
        } catch (err) {
            // Fallback / logging para cuentas normales en rollout
            config.logger?.debug?.({ err }, 'updateProfileCoverPhoto: business path failed, cover may require server-side enablement');
            throw err;
        }
        return fbid;
    };

    /**
     * Elimina la foto de portada del perfil (normal o business).
     */
    const removeProfileCoverPhoto = async (id) => {
        return await query({
            tag: 'iq',
            attrs: {
                to: index_js_6.S_WHATSAPP_NET,
                type: 'set',
                xmlns: 'w:biz'
            },
            content: [
                {
                    tag: 'business_profile',
                    attrs: {
                        v: '3',
                        mutation_type: 'delta'
                    },
                    content: [
                        {
                            tag: 'cover_photo',
                            attrs: { op: 'delete', id: String(id) }
                        }
                    ]
                }
            ]
        });
    };


    const updateProfileStatus = async (status) => {
        await query({
            tag: 'iq',
            attrs: {
                to: index_js_6.S_WHATSAPP_NET,
                type: 'set',
                xmlns: 'status'
            },
            content: [
                {
                    tag: 'status',
                    attrs: {},
                    content: Buffer.from(status, 'utf-8')
                }
            ]
        });
    };
    const updateProfileName = async (name) => {
        await chatModify({ pushNameSetting: name }, '');
    };
    const fetchBlocklist = async () => {
        const result = await query({
            tag: 'iq',
            attrs: {
                xmlns: 'blocklist',
                to: index_js_6.S_WHATSAPP_NET,
                type: 'get'
            }
        });
        const listNode = (0, index_js_6.getBinaryNodeChild)(result, 'list');
        return (0, index_js_6.getBinaryNodeChildren)(listNode, 'item').map(n => n.attrs.jid);
    };
    const updateBlockStatus = async (jid, action) => {
        const normalizedJid = (0, index_js_6.jidNormalizedUser)(jid);
        let lid;
        let pn_jid;
        if ((0, index_js_6.isLidUser)(normalizedJid) || (0, index_js_6.isHostedLidUser)(normalizedJid)) {
            lid = normalizedJid;
            if (action === 'block') {
                const pn = (await findUserId(normalizedJid)).phoneNumber;
                if (!pn) {
                    throw new index_js_2.HttpError(`Unable to resolve PN JID for LID: ${jid}`, { statusCode: 400 });
                }
                pn_jid = (0, index_js_6.jidNormalizedUser)(pn);
            }
        }
        else if ((0, index_js_6.isPnUser)(normalizedJid) || (0, index_js_6.isHostedPnUser)(normalizedJid)) {
            const mapped = (await findUserId(normalizedJid)).lid;
            if (!mapped) {
                throw new index_js_2.HttpError(`Unable to resolve LID for PN JID: ${jid}`, { statusCode: 400 });
            }
            lid = mapped;
            if (action === 'block') {
                pn_jid = (0, index_js_6.jidNormalizedUser)(normalizedJid);
            }
        }
        else {
            throw new index_js_2.HttpError(`Invalid jid: ${jid}`, { statusCode: 400 });
        }
        const itemAttrs = {
            action,
            jid: lid
        };
        if (action === 'block') {
            if (!pn_jid) {
                throw new index_js_2.HttpError(`pn_jid required for block: ${jid}`, { statusCode: 400 });
            }
            itemAttrs.pn_jid = pn_jid;
        }
        await query({
            tag: 'iq',
            attrs: {
                xmlns: 'blocklist',
                to: index_js_6.S_WHATSAPP_NET,
                type: 'set'
            },
            content: [
                {
                    tag: 'item',
                    attrs: itemAttrs
                }
            ]
        });
    };
    const getBusinessProfile = async (jid) => {
        const results = await query({
            tag: 'iq',
            attrs: {
                to: 's.whatsapp.net',
                xmlns: 'w:biz',
                type: 'get'
            },
            content: [
                {
                    tag: 'business_profile',
                    attrs: { v: '244' },
                    content: [
                        {
                            tag: 'profile',
                            attrs: { jid }
                        }
                    ]
                }
            ]
        });
        const profileNode = (0, index_js_6.getBinaryNodeChild)(results, 'business_profile');
        const profiles = (0, index_js_6.getBinaryNodeChild)(profileNode, 'profile');
        if (profiles) {
            const address = (0, index_js_6.getBinaryNodeChild)(profiles, 'address');
            const description = (0, index_js_6.getBinaryNodeChild)(profiles, 'description');
            const website = (0, index_js_6.getBinaryNodeChild)(profiles, 'website');
            const email = (0, index_js_6.getBinaryNodeChild)(profiles, 'email');
            const category = (0, index_js_6.getBinaryNodeChild)((0, index_js_6.getBinaryNodeChild)(profiles, 'categories'), 'category');
            const businessHours = (0, index_js_6.getBinaryNodeChild)(profiles, 'business_hours');
            const businessHoursConfig = businessHours
                ? (0, index_js_6.getBinaryNodeChildren)(businessHours, 'business_hours_config')
                : undefined;
            const websiteStr = website?.content?.toString();
            return {
                wid: profiles.attrs?.jid,
                address: address?.content?.toString(),
                description: description?.content?.toString() || '',
                website: require('../WABinary').getBinaryNodeChildren(profiles, 'website').map(node => typeof node.content === 'string' ? node.content : node.content?.toString()).filter(Boolean),
                email: email?.content?.toString(),
                category: category?.content?.toString(),
                business_hours: {
                    timezone: businessHours?.attrs?.timezone,
                    business_config: businessHoursConfig?.map(({ attrs }) => attrs)
                }
            };
        }
    };
    const cleanDirtyBits = async (type, fromTimestamp) => {
        logger.info({ fromTimestamp }, 'clean dirty bits ' + type);
        await sendNode({
            tag: 'iq',
            attrs: {
                to: index_js_6.S_WHATSAPP_NET,
                type: 'set',
                xmlns: 'urn:xmpp:whatsapp:dirty',
                id: generateMessageTag()
            },
            content: [
                {
                    tag: 'clean',
                    attrs: {
                        type,
                        ...(fromTimestamp ? { timestamp: fromTimestamp.toString() } : null)
                    }
                }
            ]
        });
    };
    const newAppStateChunkHandler = (isInitialSync) => {
        return {
            onMutation(mutation) {
                (0, index_js_5.processSyncAction)(mutation, ev, authState.creds.me, isInitialSync ? { accountSettings: authState.creds.accountSettings } : undefined, logger);
            }
        };
    };
    const resyncAppState = ev.createBufferedFunction(async (collections, isInitialSync) => {
        const appStateSyncKeyCache = new Map();
        const getCachedAppStateSyncKey = async (keyId) => {
            if (appStateSyncKeyCache.has(keyId)) {
                return appStateSyncKeyCache.get(keyId) ?? undefined;
            }
            const key = await getAppStateSyncKey(keyId);
            appStateSyncKeyCache.set(keyId, key ?? null);
            return key;
        };
         
         
        const initialVersionMap = {};
        const globalMutationMap = {};
        await authState.keys.transaction(async () => {
            const collectionsToHandle = new Set(collections);
             
            const attemptsMap = {};
             
             
            const forceSnapshotCollections = new Set();
             
             
             
            while (collectionsToHandle.size) {
                const states = {};
                const nodes = [];
                for (const name of collectionsToHandle) {
                    const result = await authState.keys.get('app-state-sync-version', [name]);
                    let state = result[name];
                    if (state) {
                        state = (0, index_js_5.ensureLTHashStateVersion)(state);
                        if (typeof initialVersionMap[name] === 'undefined') {
                            initialVersionMap[name] = state.version;
                        }
                    }
                    else {
                        state = (0, index_js_5.newLTHashState)();
                    }
                    states[name] = state;
                    const shouldForceSnapshot = forceSnapshotCollections.has(name);
                    if (shouldForceSnapshot) {
                        forceSnapshotCollections.delete(name);
                    }
                    logger.info(`resyncing ${name} from v${state.version}${shouldForceSnapshot ? ' (forcing snapshot)' : ''}`);
                    nodes.push({
                        tag: 'collection',
                        attrs: {
                            name,
                            version: state.version.toString(),
                             
                            return_snapshot: (shouldForceSnapshot || !state.version).toString()
                        }
                    });
                }
                const result = await query({
                    tag: 'iq',
                    attrs: {
                        to: index_js_6.S_WHATSAPP_NET,
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
                });
                 
                const decoded = await (0, index_js_5.extractSyncdPatches)(result, config?.options);
                for (const key in decoded) {
                    const name = key;
                    const { patches, hasMorePatches, snapshot } = decoded[name];
                    try {
                        if (snapshot) {
                            const { state: newState, mutationMap } = await (0, index_js_5.decodeSyncdSnapshot)(name, snapshot, getCachedAppStateSyncKey, initialVersionMap[name], appStateMacVerification.snapshot, logger);
                            states[name] = newState;
                            Object.assign(globalMutationMap, mutationMap);
                            logger.info(`restored state of ${name} from snapshot to v${newState.version} with mutations`);
                            await authState.keys.set({ 'app-state-sync-version': { [name]: newState } });
                        }
                         
                        if (patches.length) {
                            const { state: newState, mutationMap } = await (0, index_js_5.decodePatches)(name, patches, states[name], getCachedAppStateSyncKey, config.options, initialVersionMap[name], logger, appStateMacVerification.patch);
                            await authState.keys.set({ 'app-state-sync-version': { [name]: newState } });
                            logger.info(`synced ${name} to v${newState.version}`);
                            initialVersionMap[name] = newState.version;
                            Object.assign(globalMutationMap, mutationMap);
                        }
                        if (hasMorePatches) {
                            logger.info(`${name} has more patches...`);
                        }
                        else {
                             
                            collectionsToHandle.delete(name);
                        }
                    }
                    catch (error) {
                        attemptsMap[name] = (attemptsMap[name] || 0) + 1;
                        const logData = {
                            name,
                            attempt: attemptsMap[name],
                            version: states[name].version,
                            statusCode: error.output?.statusCode,
                            errorType: error.name,
                            error: error.stack
                        };
                        if ((0, index_js_5.isMissingKeyError)(error) && attemptsMap[name] >= index_js_5.MAX_SYNC_ATTEMPTS) {
                             
                             
                            logger.warn(logData, `${name} blocked on missing key from v${states[name].version}, parking after ${attemptsMap[name]} attempts`);
                            blockedCollections.add(name);
                            collectionsToHandle.delete(name);
                        }
                        else if ((0, index_js_5.isMissingKeyError)(error)) {
                             
                            logger.info(logData, `${name} blocked on missing key from v${states[name].version}, retrying with snapshot`);
                            forceSnapshotCollections.add(name);
                        }
                        else if ((0, index_js_5.isAppStateSyncIrrecoverable)(error, attemptsMap[name])) {
                            logger.warn(logData, `failed to sync ${name} from v${states[name].version}, giving up`);
                            collectionsToHandle.delete(name);
                        }
                        else {
                            logger.info(logData, `failed to sync ${name} from v${states[name].version}, forcing snapshot retry`);
                             
                             
                            forceSnapshotCollections.add(name);
                        }
                    }
                }
            }
        }, authState?.creds?.me?.id || 'resync-app-state');
        const { onMutation } = newAppStateChunkHandler(isInitialSync);
        for (const key in globalMutationMap) {
            onMutation(globalMutationMap[key]);
        }
    });
     




    const profilePictureUrl = async (jid, type = 'image', timeoutMs = 5000, shouldIncludeTcToken = true) => {
         
         
         
        const normalizedJid = (0, index_js_6.jidNormalizedUser)(jid);
        const isUserJid = (0, index_js_6.isPnUser)(normalizedJid) || (0, index_js_6.isLidUser)(normalizedJid);
        const me = authState.creds.me;
        const isSelf = me && (normalizedJid === (0, index_js_6.jidNormalizedUser)(me.id) || (me.lid && normalizedJid === (0, index_js_6.jidNormalizedUser)(me.lid)));
        let tcTokenContent;
        if (shouldIncludeTcToken && serverProps.profilePicPrivacyToken && isUserJid && !isSelf) {
            tcTokenContent = await (0, tc_token_utils_js_1.buildTcTokenFromJid)({
                authState,
                jid: normalizedJid,
                getLIDForPN
            });
        }
        jid = (0, index_js_6.jidNormalizedUser)(jid);
        const result = await query({
            tag: 'iq',
            attrs: {
                target: jid,
                to: index_js_6.S_WHATSAPP_NET,
                type: 'get',
                xmlns: 'w:profile:picture'
            },
            content: (0, exports.buildProfilePictureQueryContent)(type, tcTokenContent)
        }, timeoutMs);
        const child = (0, index_js_6.getBinaryNodeChild)(result, 'picture');
        return child?.attrs?.url;
    };
    const createCallLink = async (type, event, timeoutMs) => {
        const result = await query({
            tag: 'call',
            attrs: {
                id: generateMessageTag(),
                to: '@call'
            },
            content: [
                {
                    tag: 'link_create',
                    attrs: { media: type },
                    content: event ? [{ tag: 'event', attrs: { start_time: String(event.startTime) } }] : undefined
                }
            ]
        }, timeoutMs);
        const child = (0, index_js_6.getBinaryNodeChild)(result, 'link_create');
        return child?.attrs?.token;
    };
    const sendPresenceUpdate = async (type, toJid) => {
        const me = authState.creds.me;
        const isAvailableType = type === 'available';
        if (isAvailableType || type === 'unavailable') {
            if (!me.name) {
                logger.warn('no name present, ignoring presence update request...');
                return;
            }
            ev.emit('connection.update', { isOnline: isAvailableType });
            if (isAvailableType) {
                void sendUnifiedSession();
            }
            await sendNode({
                tag: 'presence',
                attrs: {
                    name: me.name.replace(/@/g, ''),
                    type
                }
            });
        }
        else {
            const { server } = (0, index_js_6.jidDecode)(toJid);
            const isLid = server === 'lid';
            await sendNode({
                tag: 'chatstate',
                attrs: {
                    from: isLid ? me.lid : me.id,
                    to: toJid
                },
                content: [
                    {
                        tag: type === 'recording' ? 'composing' : type,
                        attrs: type === 'recording' ? { media: 'audio' } : {}
                    }
                ]
            });
        }
    };
     



    const presenceSubscribe = async (toJid) => {
         
        const normalizedToJid = (0, index_js_6.jidNormalizedUser)(toJid);
        const isUserJid = (0, index_js_6.isPnUser)(normalizedToJid) || (0, index_js_6.isLidUser)(normalizedToJid);
        const tcTokenContent = isUserJid
            ? await (0, tc_token_utils_js_1.buildTcTokenFromJid)({ authState, jid: normalizedToJid, getLIDForPN })
            : undefined;
        return sendNode({
            tag: 'presence',
            attrs: {
                to: toJid,
                id: generateMessageTag(),
                type: 'subscribe'
            },
            content: tcTokenContent
        });
    };
    const handlePresenceUpdate = ({ tag, attrs, content }) => {
        let presence;
        const jid = attrs.from;
        const participant = attrs.participant || attrs.from;
        if (shouldIgnoreJid(jid) && jid !== index_js_6.S_WHATSAPP_NET) {
            return;
        }
        if (tag === 'presence') {
            presence = {
                lastKnownPresence: attrs.type === 'unavailable' ? 'unavailable' : 'available',
                lastSeen: attrs.last && attrs.last !== 'deny' ? +attrs.last : undefined,
                groupOnlineCount: attrs.count ? +attrs.count : undefined
            };
        }
        else if (Array.isArray(content)) {
            const [firstChild] = content;
            let type = firstChild.tag;
            if (type === 'paused') {
                type = 'available';
            }
            if (firstChild.attrs?.media === 'audio') {
                type = 'recording';
            }
            presence = { lastKnownPresence: type };
        }
        else {
            logger.error({ tag, attrs, content }, 'recv invalid presence node');
        }
        if (presence) {
            ev.emit('presence.update', { id: jid, presences: { [participant]: presence } });
        }
    };
    const appPatch = async (patchCreate) => {
        const name = patchCreate.type;
        const myAppStateKeyId = authState.creds.myAppStateKeyId;
        if (!myAppStateKeyId) {
            throw new index_js_2.HttpError('App state key not present!', { statusCode: 400 });
        }
        let initial;
        let encodeResult;
        await appStatePatchMutex.mutex(async () => {
            await authState.keys.transaction(async () => {
                logger.debug({ patch: patchCreate }, 'applying app patch');
                await resyncAppState([name], false);
                const { [name]: currentSyncVersion } = await authState.keys.get('app-state-sync-version', [name]);
                initial = currentSyncVersion ? (0, index_js_5.ensureLTHashStateVersion)(currentSyncVersion) : (0, index_js_5.newLTHashState)();
                encodeResult = await (0, index_js_5.encodeSyncdPatch)(patchCreate, myAppStateKeyId, initial, getAppStateSyncKey);
                const { patch, state } = encodeResult;
                const node = {
                    tag: 'iq',
                    attrs: {
                        to: index_js_6.S_WHATSAPP_NET,
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
                                            content: index_js_1.proto.SyncdPatch.encode(patch).finish()
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                };
                await query(node);
                await authState.keys.set({ 'app-state-sync-version': { [name]: state } });
            }, authState?.creds?.me?.id || 'app-patch');
        });
        if (config.emitOwnEvents) {
            const { onMutation } = newAppStateChunkHandler(false);
            const { mutationMap } = await (0, index_js_5.decodePatches)(name, [{ ...encodeResult.patch, version: { version: encodeResult.state.version } }], initial, getAppStateSyncKey, config.options, undefined, logger);
            for (const key in mutationMap) {
                onMutation(mutationMap[key]);
            }
        }
    };
     
    const fetchProps = async () => {
        const resultNode = await query({
            tag: 'iq',
            attrs: {
                to: index_js_6.S_WHATSAPP_NET,
                xmlns: 'abt',
                type: 'get'
            },
            content: [
                {
                    tag: 'props',
                    attrs: {
                        protocol: '1',
                        ...(authState?.creds?.lastPropHash ? { hash: authState.creds.lastPropHash } : {})
                    }
                }
            ]
        });
        const propsNode = (0, index_js_6.getBinaryNodeChild)(resultNode, 'props');
        let props = {};
        if (propsNode) {
            if (propsNode.attrs?.hash) {
                 
                authState.creds.lastPropHash = propsNode?.attrs?.hash;
                ev.emit('creds.update', authState.creds);
            }
            props = (0, index_js_6.reduceBinaryNodeToDictionary)(propsNode, 'prop');
        }
         
        const privacyTokenProp = props['10518'] ?? props['privacy_token_sending_on_all_1_on_1_messages'];
        if (privacyTokenProp !== undefined) {
            serverProps.privacyTokenOn1to1 = privacyTokenProp === 'true' || privacyTokenProp === '1';
        }
        const profilePicProp = props['9666'] ?? props['profile_scraping_privacy_token_in_photo_iq'];
        if (profilePicProp !== undefined) {
            serverProps.profilePicPrivacyToken = profilePicProp === 'true' || profilePicProp === '1';
        }
        const lidIssueProp = props['14303'] ?? props['lid_trusted_token_issue_to_lid'];
        if (lidIssueProp !== undefined) {
            serverProps.lidTrustedTokenIssueToLid = lidIssueProp === 'true' || lidIssueProp === '1';
        }
        logger.debug({ serverProps }, 'fetched props');
        return props;
    };
     




    const chatModify = (mod, jid) => {
        const patch = (0, index_js_5.chatModificationToAppPatch)(mod, jid);
        return appPatch(patch);
    };
     


    const updateDisableLinkPreviewsPrivacy = (isPreviewsDisabled) => {
        return chatModify({
            disableLinkPreviews: { isPreviewsDisabled }
        }, '');
    };
     


    const star = (jid, messages, star) => {
        return chatModify({
            star: {
                messages,
                star
            }
        }, jid);
    };
     


    const addOrEditContact = (jid, contact) => {
        return chatModify({
            contact
        }, jid);
    };
     


    const removeContact = (jid) => {
        return chatModify({
            contact: null
        }, jid);
    };
     


    const addLabel = (jid, labels) => {
        return chatModify({
            addLabel: {
                ...labels
            }
        }, jid);
    };
     


    const addChatLabel = (jid, labelId) => {
        return chatModify({
            addChatLabel: {
                labelId
            }
        }, jid);
    };
     


    const removeChatLabel = (jid, labelId) => {
        return chatModify({
            removeChatLabel: {
                labelId
            }
        }, jid);
    };
     


    const addMessageLabel = (jid, messageId, labelId) => {
        return chatModify({
            addMessageLabel: {
                messageId,
                labelId
            }
        }, jid);
    };
     


    const removeMessageLabel = (jid, messageId, labelId) => {
        return chatModify({
            removeMessageLabel: {
                messageId,
                labelId
            }
        }, jid);
    };
     


    const addOrEditQuickReply = (quickReply) => {
        return chatModify({
            quickReply
        }, '');
    };
     


    const removeQuickReply = (timestamp) => {
        return chatModify({
            quickReply: { timestamp, deleted: true }
        }, '');
    };
     



    const executeInitQueries = require('../Utils/init-queries').createInitQueryRunner(sock, config, { props: fetchProps, blocklist: fetchBlocklist, privacy: fetchPrivacySettings });
    const upsertMessage = ev.createBufferedFunction(async (msg, type) => {
        ev.emit('messages.upsert', { messages: [msg], type });
        if (!!msg.pushName) {
            let jid = msg.key.fromMe ? authState.creds.me.id : msg.key.participant || msg.key.remoteJid;
            jid = (0, index_js_6.jidNormalizedUser)(jid);
            if (!msg.key.fromMe) {
                ev.emit('contacts.update', [{ id: jid, notify: msg.pushName, verifiedName: msg.verifiedBizName }]);
            }
             
            if (msg.key.fromMe && msg.pushName && authState.creds.me?.name !== msg.pushName) {
                ev.emit('creds.update', { me: { ...authState.creds.me, name: msg.pushName } });
            }
        }
        const historyMsg = (0, index_js_5.getHistoryMsg)(msg.message);
        const shouldProcessHistoryMsg = historyMsg
            ? shouldSyncHistoryMessage(historyMsg) &&
                index_js_3.PROCESSABLE_HISTORY_TYPES.includes(historyMsg.syncType)
            : false;
        if (historyMsg && shouldProcessHistoryMsg) {
            const syncType = historyMsg.syncType;
             
            if (syncType === index_js_1.proto.HistorySync.HistorySyncType.INITIAL_BOOTSTRAP &&
                !historySyncStatus.initialBootstrapComplete) {
                historySyncStatus.initialBootstrapComplete = true;
                ev.emit('messaging-history.status', {
                    syncType,
                    status: 'complete',
                    explicit: true
                });
            }
             
            if (syncType === index_js_1.proto.HistorySync.HistorySyncType.RECENT &&
                historyMsg.progress === 100 &&
                !historySyncStatus.recentSyncComplete) {
                historySyncStatus.recentSyncComplete = true;
                clearTimeout(historySyncPausedTimeout);
                historySyncPausedTimeout = undefined;
                ev.emit('messaging-history.status', {
                    syncType,
                    status: 'complete',
                    explicit: true
                });
            }
             
            if (syncType === index_js_1.proto.HistorySync.HistorySyncType.RECENT && !historySyncStatus.recentSyncComplete) {
                clearTimeout(historySyncPausedTimeout);
                historySyncPausedTimeout = setTimeout(() => {
                    if (!historySyncStatus.recentSyncComplete) {
                        historySyncStatus.recentSyncComplete = true;
                        ev.emit('messaging-history.status', {
                            syncType: index_js_1.proto.HistorySync.HistorySyncType.RECENT,
                            status: 'paused',
                            explicit: false
                        });
                    }
                    historySyncPausedTimeout = undefined;
                }, index_js_3.HISTORY_SYNC_PAUSED_TIMEOUT_MS);
            }
        }
         
        if (historyMsg && syncState === State_js_1.SyncState.AwaitingInitialSync) {
            if (awaitingSyncTimeout) {
                clearTimeout(awaitingSyncTimeout);
                awaitingSyncTimeout = undefined;
            }
            if (shouldProcessHistoryMsg) {
                syncState = State_js_1.SyncState.Syncing;
                logger.info('Transitioned to Syncing state');
                 
            }
            else {
                syncState = State_js_1.SyncState.Online;
                logger.info('History sync skipped, transitioning to Online state and flushing buffer');
                ev.flush();
            }
        }
        const doAppStateSync = async () => {
            if (syncState === State_js_1.SyncState.Syncing) {
                 
                blockedCollections.clear();
                logger.info('Doing app state sync');
                await resyncAppState(index_js_4.ALL_WA_PATCH_NAMES, true);
                 
                syncState = State_js_1.SyncState.Online;
                logger.info('App state sync complete, transitioning to Online state and flushing buffer');
                ev.flush();
                const accountSyncCounter = (authState.creds.accountSyncCounter || 0) + 1;
                ev.emit('creds.update', { accountSyncCounter });
            }
        };
        await Promise.all([
            (async () => {
                if (shouldProcessHistoryMsg) {
                    await doAppStateSync();
                }
            })(),
            (0, process_message_js_1.default)(msg, {
                signalRepository,
                shouldProcessHistoryMsg,
                placeholderResendCache,
                ev,
                creds: authState.creds,
                keyStore: authState.keys,
                logger,
                options: config.options,
                getMessage
            })
        ]);
         
        if (msg.message?.protocolMessage?.appStateSyncKeyShare && syncState === State_js_1.SyncState.Syncing) {
            logger.info('App state sync key arrived, triggering app state sync');
            await doAppStateSync();
        }
    });
    return {
        ...sock,
        findUserId,
        serverProps,
        createCallLink,
        getBotListV2,
        messageMutex,
        receiptMutex,
        appStatePatchMutex,
        notificationMutex,
        fetchPrivacySettings,
        upsertMessage,
        appPatch,
        sendPresenceUpdate,
        presenceSubscribe,
        profilePictureUrl,
        fetchBlocklist,
        fetchStatus,
        retryInitialQueries: executeInitQueries,
        getInitialQueryState: executeInitQueries.getState,
        fetchDisappearingDuration,
        updateProfilePicture,
        removeProfilePicture,
        updateProfileCoverPhoto,
        removeProfileCoverPhoto,
        updateProfileStatus,
        updateProfileName,
        updateBlockStatus,
        updateDisableLinkPreviewsPrivacy,
        updateCallPrivacy,
        updateMessagesPrivacy,
        updateLastSeenPrivacy,
        updateOnlinePrivacy,
        updateProfilePicturePrivacy,
        updateStatusPrivacy,
        updateReadReceiptsPrivacy,
        updateGroupsAddPrivacy,
        updateDefaultDisappearingMode,
        getBusinessProfile,
        resyncAppState,
        chatModify,
        cleanDirtyBits,
        addOrEditContact,
        removeContact,
        placeholderResendCache,
        addLabel,
        addChatLabel,
        removeChatLabel,
        addMessageLabel,
        removeMessageLabel,
        star,
        addOrEditQuickReply,
        removeQuickReply
    };
};
exports.attachAdvanced = attachAdvanced;
