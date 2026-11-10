"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeChatsSocket = void 0;
const boom_1 = require("@hapi/boom");
const node_cache_1 = __importDefault(require("@cacheable/node-cache"));
const WAProto_1 = require("../../WAProto");
const Defaults_1 = require("../Defaults");
const Types_1 = require("../Types");
const Utils_1 = require("../Utils");
const make_mutex_1 = require("../Utils/make-mutex");
const process_message_1 = __importDefault(require("../Utils/process-message"));
const WABinary_1 = require("../WABinary");
const WAUSync_1 = require("../WAUSync");
const usync_1 = require("./usync");
const chalk = require('chalk');
const MAX_SYNC_ATTEMPTS = 2;
const SyncState = {
    Connecting: 'connecting',
    AwaitingInitialSync: 'awaiting_initial_sync',
    Syncing: 'syncing',
    Online: 'online'
};
const makeChatsSocket = (config) => {
    const { logger, markOnlineOnConnect, fireInitQueries, appStateMacVerification, shouldIgnoreJid, shouldSyncHistoryMessage, } = config;
    const sock = (0, usync_1.makeUSyncSocket)(config);
    const { ev, ws, authState, generateMessageTag, sendNode, query, signalRepository, onUnexpectedError, } = sock;
    let privacySettings;
    let syncState = SyncState.Connecting;
    let releaseInitialSync;
    let initialAppStateJob;
    let socketClosed = false;
    const releaseInitialEvents = () => {
        clearTimeout(awaitingSyncTimeout);
        awaitingSyncTimeout = undefined;
        syncState = SyncState.Online;
        const release = releaseInitialSync;
        releaseInitialSync = undefined;
        release?.();
    };
    let pendingAppStateSync = false;
    let awaitingSyncTimeout;
    const processingMutex = (0, make_mutex_1.makeMutex)();
    const placeholderResendCache = config.placeholderResendCache || new node_cache_1.default({
        stdTTL: Defaults_1.DEFAULT_CACHE_TTLS.MSG_RETRY,
        useClones: false
    });
    const receivedMessageDedupCache = new node_cache_1.default({
        stdTTL: 3 * 60,
        useClones: false
    });
    if (!config.placeholderResendCache) {
        config.placeholderResendCache = placeholderResendCache;
    }
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
                    to: WABinary_1.S_WHATSAPP_NET,
                    type: 'get'
                },
                content: [
                    { tag: 'privacy', attrs: {} }
                ]
            });
            privacySettings = (0, WABinary_1.reduceBinaryNodeToDictionary)(content === null || content === void 0 ? void 0 : content[0], 'category');
        }
        return privacySettings;
    };
    const privacyQuery = async (name, value) => {
        await query({
            tag: 'iq',
            attrs: {
                xmlns: 'privacy',
                to: WABinary_1.S_WHATSAPP_NET,
                type: 'set'
            },
            content: [{
                    tag: 'privacy',
                    attrs: {},
                    content: [
                        {
                            tag: 'category',
                            attrs: { name, value }
                        }
                    ]
                }]
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
    const updateDisableLinkPreviewsPrivacy = async (isPreviewsDisabled) => {
        return chatModify({ disableLinkPreviews: { isPreviewsDisabled } }, '');
    };
    const updateDefaultDisappearingMode = async (duration) => {
        await query({
            tag: 'iq',
            attrs: {
                xmlns: 'disappearing_mode',
                to: WABinary_1.S_WHATSAPP_NET,
                type: 'set'
            },
            content: [{
                    tag: 'disappearing_mode',
                    attrs: {
                        duration: duration.toString()
                    }
                }]
        });
    };
    const getBotListV2 = async () => {
        const resp = await query({
            tag: 'iq',
            attrs: {
                xmlns: 'bot',
                to: WABinary_1.S_WHATSAPP_NET,
                type: 'get'
            },
            content: [{
                    tag: 'bot',
                    attrs: {
                        v: '2'
                    }
                }]
        });
        const botNode = (0, WABinary_1.getBinaryNodeChild)(resp, 'bot');
        const botList = [];
        for (const section of (0, WABinary_1.getBinaryNodeChildren)(botNode, 'section')) {
            if (section.attrs.type === 'all') {
                for (const bot of (0, WABinary_1.getBinaryNodeChildren)(section, 'bot')) {
                    botList.push({
                        jid: bot.attrs.jid,
                        personaId: bot.attrs['persona_id']
                    });
                }
            }
        }
        return botList;
    };
    const onWhatsApp = async (...jids) => {
        const usyncQuery = new WAUSync_1.USyncQuery()
            .withContactProtocol()
            .withLIDProtocol();
        for (const jid of jids) {
            const phone = `+${jid.replace('+', '').split('@')[0].split(':')[0]}`;
            usyncQuery.withUser(new WAUSync_1.USyncUser().withPhone(phone));
        }
        const results = await sock.executeUSyncQuery(usyncQuery);
        if (results) {
            return results.list.filter((a) => !!a.contact).map(({ contact, id, lid }) => ({ jid: id, exists: contact, lid }));
        }
    };
    const fetchStatus = async (...jids) => {
        const usyncQuery = new WAUSync_1.USyncQuery()
            .withStatusProtocol();
        for (const jid of jids) {
            usyncQuery.withUser(new WAUSync_1.USyncUser().withId(jid));
        }
        const result = await sock.executeUSyncQuery(usyncQuery);
        if (result) {
            return result.list;
        }
    };
    const fetchDisappearingDuration = async (...jids) => {
        const usyncQuery = new WAUSync_1.USyncQuery()
            .withDisappearingModeProtocol();
        for (const jid of jids) {
            usyncQuery.withUser(new WAUSync_1.USyncUser().withId(jid));
        }
        const result = await sock.executeUSyncQuery(usyncQuery);
        if (result) {
            return result.list;
        }
    };
    const updateProfilePicture = async (jid, content, dimensions) => {
        let targetJid;
        if (!jid) {
            throw new boom_1.Boom('Illegal no-jid profile update. Please specify either your ID or the ID of the chat you wish to update');
        }
        if ((0, WABinary_1.jidNormalizedUser)(jid) !== (0, WABinary_1.jidNormalizedUser)(authState.creds.me.id)) {
            targetJid = (0, WABinary_1.jidNormalizedUser)(jid);
        }
        const { img } = await (0, Utils_1.generateProfilePicture)(content, dimensions);
        await query({
            tag: 'iq',
            attrs: {
                target: targetJid,
                to: WABinary_1.S_WHATSAPP_NET,
                type: 'set',
                xmlns: 'w:profile:picture'
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
            throw new boom_1.Boom('Illegal no-jid profile update. Please specify either your ID or the ID of the chat you wish to update');
        }
        if ((0, WABinary_1.jidNormalizedUser)(jid) !== (0, WABinary_1.jidNormalizedUser)(authState.creds.me.id)) {
            targetJid = (0, WABinary_1.jidNormalizedUser)(jid);
        }
        await query({
            tag: 'iq',
            attrs: {
                target: targetJid,
                to: WABinary_1.S_WHATSAPP_NET,
                type: 'set',
                xmlns: 'w:profile:picture'
            }
        });
    };
    const updateProfileStatus = async (status) => {
        await query({
            tag: 'iq',
            attrs: {
                to: WABinary_1.S_WHATSAPP_NET,
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
                to: WABinary_1.S_WHATSAPP_NET,
                type: 'get'
            }
        });
        const listNode = (0, WABinary_1.getBinaryNodeChild)(result, 'list');
        return (0, WABinary_1.getBinaryNodeChildren)(listNode, 'item')
            .map(n => n.attrs.jid);
    };
    const updateBlockStatus = async (jid, action) => {
        await query({
            tag: 'iq',
            attrs: {
                xmlns: 'blocklist',
                to: WABinary_1.S_WHATSAPP_NET,
                type: 'set'
            },
            content: [
                {
                    tag: 'item',
                    attrs: {
                        action,
                        jid
                    }
                }
            ]
        });
    };
    const getBusinessProfile = async (jid) => {
        var _a, _b, _c, _d, _e, _f, _g;
        const results = await query({
            tag: 'iq',
            attrs: {
                to: 's.whatsapp.net',
                xmlns: 'w:biz',
                type: 'get'
            },
            content: [{
                    tag: 'business_profile',
                    attrs: { v: '244' },
                    content: [{
                            tag: 'profile',
                            attrs: { jid }
                        }]
                }]
        });
        const profileNode = (0, WABinary_1.getBinaryNodeChild)(results, 'business_profile');
        const profiles = (0, WABinary_1.getBinaryNodeChild)(profileNode, 'profile');
        if (profiles) {
            const address = (0, WABinary_1.getBinaryNodeChild)(profiles, 'address');
            const description = (0, WABinary_1.getBinaryNodeChild)(profiles, 'description');
            const website = (0, WABinary_1.getBinaryNodeChild)(profiles, 'website');
            const email = (0, WABinary_1.getBinaryNodeChild)(profiles, 'email');
            const category = (0, WABinary_1.getBinaryNodeChild)((0, WABinary_1.getBinaryNodeChild)(profiles, 'categories'), 'category');
            const businessHours = (0, WABinary_1.getBinaryNodeChild)(profiles, 'business_hours');
            const businessHoursConfig = businessHours
                ? (0, WABinary_1.getBinaryNodeChildren)(businessHours, 'business_hours_config')
                : undefined;
            const websiteStr = (_a = website === null || website === void 0 ? void 0 : website.content) === null || _a === void 0 ? void 0 : _a.toString();
            return {
                wid: (_b = profiles.attrs) === null || _b === void 0 ? void 0 : _b.jid,
                address: (_c = address === null || address === void 0 ? void 0 : address.content) === null || _c === void 0 ? void 0 : _c.toString(),
                description: ((_d = description === null || description === void 0 ? void 0 : description.content) === null || _d === void 0 ? void 0 : _d.toString()) || '',
                website: websiteStr ? [websiteStr] : [],
                email: (_e = email === null || email === void 0 ? void 0 : email.content) === null || _e === void 0 ? void 0 : _e.toString(),
                category: (_f = category === null || category === void 0 ? void 0 : category.content) === null || _f === void 0 ? void 0 : _f.toString(),
                'business_hours': {
                    timezone: (_g = businessHours === null || businessHours === void 0 ? void 0 : businessHours.attrs) === null || _g === void 0 ? void 0 : _g.timezone,
                    'business_config': businessHoursConfig === null || businessHoursConfig === void 0 ? void 0 : businessHoursConfig.map(({ attrs }) => attrs)
                }
            };
        }
    };
    const cleanDirtyBits = async (type, fromTimestamp) => {
        logger.info({ fromTimestamp }, 'clean dirty bits ' + type);
        await sendNode({
            tag: 'iq',
            attrs: {
                to: WABinary_1.S_WHATSAPP_NET,
                type: 'set',
                xmlns: 'urn:xmpp:whatsapp:dirty',
                id: generateMessageTag(),
            },
            content: [
                {
                    tag: 'clean',
                    attrs: {
                        type,
                        ...(fromTimestamp ? { timestamp: fromTimestamp.toString() } : null),
                    }
                }
            ]
        });
    };
    const newAppStateChunkHandler = (isInitialSync) => {
        return {
            onMutation(mutation) {
                (0, Utils_1.processSyncAction)(mutation, ev, authState.creds.me, isInitialSync ? { accountSettings: authState.creds.accountSettings } : undefined, logger);
            }
        };
    };
    const resyncAppStateWork = async (collections, isInitialSync) => {
        const initialVersionMap = {};
        const globalMutationMap = {};
        await authState.keys.transaction(async () => {
            var _a;
            const collectionsToHandle = new Set(collections);
            const attemptsMap = {};
            while (collectionsToHandle.size) {
                const states = {};
                const nodes = [];
                for (const name of collectionsToHandle) {
                    const result = await authState.keys.get('app-state-sync-version', [name]);
                    let state = result[name];
                    if (state) {
                        if (typeof initialVersionMap[name] === 'undefined') {
                            initialVersionMap[name] = state.version;
                        }
                    }
                    else {
                        state = (0, Utils_1.newLTHashState)();
                    }
                    states[name] = state;
                    logger.info(`resyncing ${name} from v${state.version}`);
                    nodes.push({
                        tag: 'collection',
                        attrs: {
                            name,
                            version: state.version.toString(),
                            'return_snapshot': (!state.version).toString()
                        }
                    });
                }
                const result = await query({
                    tag: 'iq',
                    attrs: {
                        to: WABinary_1.S_WHATSAPP_NET,
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
                const decoded = await (0, Utils_1.extractSyncdPatches)(result, config === null || config === void 0 ? void 0 : config.options);
                for (const key in decoded) {
                    const name = key;
                    const { patches, hasMorePatches, snapshot } = decoded[name];
                    try {
                        if (snapshot) {
                            const { state: newState, mutationMap } = await (0, Utils_1.decodeSyncdSnapshot)(name, snapshot, getAppStateSyncKey, initialVersionMap[name], appStateMacVerification.snapshot);
                            states[name] = newState;
                            Object.assign(globalMutationMap, mutationMap);
                            logger.info(`restored state of ${name} from snapshot to v${newState.version} with mutations`);
                            await authState.keys.set({ 'app-state-sync-version': { [name]: newState } });
                        }
                        if (patches.length) {
                            const { state: newState, mutationMap } = await (0, Utils_1.decodePatches)(name, patches, states[name], getAppStateSyncKey, config.options, initialVersionMap[name], logger, appStateMacVerification.patch);
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
                        const isIrrecoverableError = attemptsMap[name] >= MAX_SYNC_ATTEMPTS
                            || ((_a = error.output) === null || _a === void 0 ? void 0 : _a.statusCode) === 404
                            || error.name === 'TypeError';
                        logger.info({ name, error: error.stack }, `failed to sync state from version${isIrrecoverableError ? '' : ', removing and trying from scratch'}`);
                        await authState.keys.set({ 'app-state-sync-version': { [name]: null } });
                        attemptsMap[name] = (attemptsMap[name] || 0) + 1;
                        if (isIrrecoverableError) {
                            collectionsToHandle.delete(name);
                        }
                    }
                }
            }
        });
        const { onMutation } = newAppStateChunkHandler(isInitialSync);
        for (const key in globalMutationMap) {
            onMutation(globalMutationMap[key]);
        }
    };
    const bufferedResyncAppState = ev.createBufferedFunction(resyncAppStateWork);
    const resyncAppState = (collections, isInitialSync, background = false) =>
        background ? resyncAppStateWork(collections, isInitialSync) : bufferedResyncAppState(collections, isInitialSync);

    const profilePictureUrl = async (jid, type = 'preview', timeoutMs) => {
        var _a;
        jid = (0, WABinary_1.jidNormalizedUser)(jid);
        try {
            const result = await query({
                tag: 'iq',
                attrs: {
                    target: jid,
                    to: WABinary_1.S_WHATSAPP_NET,
                    type: 'get',
                    xmlns: 'w:profile:picture'
                },
                content: [
                    { tag: 'picture', attrs: { type, query: 'url' } }
                ]
            }, timeoutMs);
            const child = (0, WABinary_1.getBinaryNodeChild)(result, 'picture');
            return (_a = child === null || child === void 0 ? void 0 : child.attrs) === null || _a === void 0 ? void 0 : _a.url;
        } catch (error) {
            if (error.message?.includes('item-not-found') || 
                error.output?.payload?.statusCode === 404 || 
                error.statusCode === 404) {
                logger.info(chalk.gray(`[INFO] Profile pic not found for ${jid}, using fallback`));
                return {
                    eurl: undefined,
                    id: jid.split('@')[0],
                    status: null,
                    img: null
                };
            }
            throw error;
        }
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
        const child = (0, WABinary_1.getBinaryNodeChild)(result, 'link_create');
        return child?.attrs?.token;
    };
    const sendPresenceUpdate = async (type, toJid) => {
        const me = authState.creds.me;
        if (type === 'available' || type === 'unavailable') {
            if (!me.name) {
                logger.warn('no name present, ignoring presence update request...');
                return;
            }
            ev.emit('connection.update', { isOnline: type === 'available' });
            await sendNode({
                tag: 'presence',
                attrs: {
                    name: me.name.replace(/@/g, ''),
                    type
                }
            });
        }
        else {
            const { server } = (0, WABinary_1.jidDecode)(toJid);
            const isLid = server === 'lid';
            await sendNode({
                tag: 'chatstate',
                attrs: {
                    from: isLid ? me.lid : me.id,
                    to: toJid,
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
    const presenceSubscribe = (toJid, tcToken) => (sendNode({
        tag: 'presence',
        attrs: {
            to: toJid,
            id: generateMessageTag(),
            type: 'subscribe'
        },
        content: tcToken
            ? [
                {
                    tag: 'tctoken',
                    attrs: {},
                    content: tcToken
                }
            ]
            : undefined
    }));
    const handlePresenceUpdate = ({ tag, attrs, content }) => {
        var _a;
        let presence;
        const jid = attrs.from;
        const participant = attrs.participant || attrs.from;
        if (shouldIgnoreJid(jid) && jid != '@s.whatsapp.net') {
            return;
        }
        if (tag === 'presence') {
            presence = {
                lastKnownPresence: attrs.type === 'unavailable' ? 'unavailable' : 'available',
                lastSeen: attrs.last && attrs.last !== 'deny' ? +attrs.last : undefined
            };
        }
        else if (Array.isArray(content)) {
            const [firstChild] = content;
            let type = firstChild.tag;
            if (type === 'paused') {
                type = 'available';
            }
            if (((_a = firstChild.attrs) === null || _a === void 0 ? void 0 : _a.media) === 'audio') {
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
            throw new boom_1.Boom('App state key not present!', { statusCode: 400 });
        }
        let initial;
        let encodeResult;
        await processingMutex.mutex(async () => {
            await authState.keys.transaction(async () => {
                logger.debug({ patch: patchCreate }, 'applying app patch');
                await resyncAppState([name], false);
                const { [name]: currentSyncVersion } = await authState.keys.get('app-state-sync-version', [name]);
                initial = currentSyncVersion || (0, Utils_1.newLTHashState)();
                encodeResult = await (0, Utils_1.encodeSyncdPatch)(patchCreate, myAppStateKeyId, initial, getAppStateSyncKey);
                const { patch, state } = encodeResult;
                const node = {
                    tag: 'iq',
                    attrs: {
                        to: WABinary_1.S_WHATSAPP_NET,
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
                                        'return_snapshot': 'false'
                                    },
                                    content: [
                                        {
                                            tag: 'patch',
                                            attrs: {},
                                            content: WAProto_1.proto.SyncdPatch.encode(patch).finish()
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                };
                await query(node);
                await authState.keys.set({ 'app-state-sync-version': { [name]: state } });
            });
        });
        if (config.emitOwnEvents) {
            const { onMutation } = newAppStateChunkHandler(false);
            const { mutationMap } = await (0, Utils_1.decodePatches)(name, [{ ...encodeResult.patch, version: { version: encodeResult.state.version }, }], initial, getAppStateSyncKey, config.options, undefined, logger);
            for (const key in mutationMap) {
                onMutation(mutationMap[key]);
            }
        }
    };
    const fetchProps = async () => {
        var _a, _b, _c;
        const resultNode = await query({
            tag: 'iq',
            attrs: {
                to: WABinary_1.S_WHATSAPP_NET,
                xmlns: 'w',
                type: 'get',
            },
            content: [
                { tag: 'props', attrs: {
                        protocol: '2',
                        hash: ((_a = authState === null || authState === void 0 ? void 0 : authState.creds) === null || _a === void 0 ? void 0 : _a.lastPropHash) || ''
                    } }
            ]
        });
        const propsNode = (0, WABinary_1.getBinaryNodeChild)(resultNode, 'props');
        let props = {};
        if (propsNode) {
            if ((_b = propsNode.attrs) === null || _b === void 0 ? void 0 : _b.hash) {
                authState.creds.lastPropHash = (_c = propsNode === null || propsNode === void 0 ? void 0 : propsNode.attrs) === null || _c === void 0 ? void 0 : _c.hash;
                ev.emit('creds.update', authState.creds);
            }
            props = (0, WABinary_1.reduceBinaryNodeToDictionary)(propsNode, 'prop');
        }
        logger.debug('fetched props');
        return props;
    };
    const chatModify = (mod, jid) => {
        const patch = (0, Utils_1.chatModificationToAppPatch)(mod, jid);
        return appPatch(patch);
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
        return chatModify({ contact }, jid);
    };
    const removeContact = (jid) => {
        return chatModify({ contact: null }, jid);
    };
    const addLabel = (jid, labels) => {
        return chatModify({ addLabel: { ...labels } }, jid);
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
    const executeInitQueries = async () => {
        await Promise.all([
            fetchProps(),
            fetchBlocklist(),
            fetchPrivacySettings(),
        ]);
    };
    const canonicalizeUserJid = (jid) => {
        if (!jid) {
            return jid;
        }
        if ((0, WABinary_1.isLidUser)(jid)) {
            return (0, WABinary_1.jidNormalizedUser)(jid);
        }
        return jid;
    };
    const extractStanzaId = (msg) => {
        var _a, _b;
        const topLevelStanzaId = (_a = msg.messageContextInfo) === null || _a === void 0 ? void 0 : _a.stanzaId;
        if (topLevelStanzaId) {
            return topLevelStanzaId;
        }
        const messageContextStanzaId = (_b = msg.message) === null || _b === void 0 ? void 0 : _b.messageContextInfo;
        if (messageContextStanzaId === null || messageContextStanzaId === void 0 ? void 0 : messageContextStanzaId.stanzaId) {
            return messageContextStanzaId.stanzaId;
        }
        const normalizedContent = (0, Utils_1.normalizeMessageContent)(msg.message);
        const contentType = normalizedContent ? (0, Utils_1.getContentType)(normalizedContent) : undefined;
        const contentContextStanzaId = contentType
            ? normalizedContent[contentType].contextInfo && normalizedContent[contentType].contextInfo.stanzaId
            : undefined;
        return contentContextStanzaId;
    };
    const buildMessageDedupKeys = (msg) => {
        const remoteJid = canonicalizeUserJid(msg.key.remoteJid);
        const participant = canonicalizeUserJid(msg.key.participant);
        const stanzaId = extractStanzaId(msg);
        const primaryKey = [remoteJid, participant, msg.key.id, msg.key.fromMe ? '1' : '0', stanzaId || ''].join('|');
        const keys = [primaryKey];
        // fallback alias key to collapse LID->PN duplicate deliveries for the same incoming user message ID
        if (!msg.key.fromMe && ((0, WABinary_1.isJidUser)(msg.key.remoteJid) || (0, WABinary_1.isLidUser)(msg.key.remoteJid))) {
            keys.push(`incoming-user-id|${msg.key.id}|${stanzaId || ''}`);
        }
        return keys;
    };
    const getDedupState = (msg) => ['ciphertext', 'stub', 'unknown'].includes(require('../Utils/message-inspector').inspectMessage(msg).type)
        ? 'ciphertext'
        : 'final';
    const getPendingDedupState = (dedupState) => dedupState === 'final' ? 'processing' : dedupState;
    const upsertMessage = ev.createBufferedFunction(async (msg, type) => {
        var _a, _b, _c;
        const dedupKeys = buildMessageDedupKeys(msg);
        const dedupState = getDedupState(msg);
        const dedupStateBeforeProcess = new Map();
        const previousDedupState = dedupKeys
            .map(key => receivedMessageDedupCache.get(key))
            .find(state => !!state);
        if (previousDedupState === 'final'
            || previousDedupState === 'processing'
            || (previousDedupState === 'ciphertext' && dedupState === 'ciphertext')) {
            logger.debug({ dedupKeys, messageId: msg.key.id, type, dedupState, previousDedupState }, 'skipping duplicate messages.upsert');
            return;
        }
        for (const key of dedupKeys) {
            dedupStateBeforeProcess.set(key, receivedMessageDedupCache.get(key));
            receivedMessageDedupCache.set(key, getPendingDedupState(dedupState));
        }
        try {
            ev.emit('messages.upsert', { messages: [msg], type });
            if (!!msg.pushName) {
                let jid = msg.key.fromMe ? authState.creds.me.id : (msg.key.participant || msg.key.remoteJid);
                jid = (0, WABinary_1.jidNormalizedUser)(jid);
                if (!msg.key.fromMe) {
                    ev.emit('contacts.update', [{ id: jid, notify: msg.pushName, verifiedName: msg.verifiedBizName }]);
                }
                if (msg.key.fromMe && msg.pushName && ((_a = authState.creds.me) === null || _a === void 0 ? void 0 : _a.name) !== msg.pushName) {
                    ev.emit('creds.update', { me: { ...authState.creds.me, name: msg.pushName } });
                }
            }
            const historyMsg = (0, Utils_1.getHistoryMsg)(msg.message);
            const shouldProcessHistoryMsg = historyMsg
                ? (shouldSyncHistoryMessage(historyMsg)
                    && Defaults_1.PROCESSABLE_HISTORY_TYPES.includes(historyMsg.syncType))
                : false;
            if (historyMsg && syncState === SyncState.AwaitingInitialSync) {
                if (shouldProcessHistoryMsg) {
                    syncState = SyncState.Syncing;
                    logger.info('Transitioned to Syncing state');
                } else {
                    syncState = SyncState.Online;
                    logger.info('History sync skipped, transitioning to Online state and flushing buffer');
                    releaseInitialEvents();
                }
            }
            const doAppStateSync = () => {
                if (socketClosed || initialAppStateJob || (!pendingAppStateSync && syncState !== SyncState.Syncing)) return;
                // Network synchronization must not hold the live message processing mutex.
                initialAppStateJob = Promise.resolve().then(() => resyncAppState(Types_1.ALL_WA_PATCH_NAMES, true, true))
                    .then(() => {
                        pendingAppStateSync = false;
                        const accountSyncCounter = (authState.creds.accountSyncCounter || 0) + 1;
                        ev.emit('creds.update', { accountSyncCounter });
                    })
                    .catch(error => onUnexpectedError(error, 'initial app state sync'))
                    .finally(() => { initialAppStateJob = undefined; releaseInitialEvents(); });
                // The short synchronization lease is released separately by its watchdog.
            };
            if (historyMsg && !authState.creds.myAppStateKeyId) {
                logger.warn('skipping app state sync, as myAppStateKeyId is not set');
                pendingAppStateSync = true;
            }
            if (historyMsg && authState.creds.myAppStateKeyId) {
                doAppStateSync();
            }
            const processJob = (0, process_message_1.default)(msg, {
                signalRepository,
                shouldProcessHistoryMsg,
                placeholderResendCache,
                ev,
                creds: authState.creds,
                keyStore: authState.keys,
                logger,
                options: config.options,
                getMessage: config.getMessage,
            });
            if (historyMsg) {
                // A history CDN download cannot hold processingMutex or a global event lease.
                Promise.resolve(processJob).catch(error => onUnexpectedError(error, 'history processing'));
            } else {
                await processJob;
            }
            if (((_c = (_b = msg.message) === null || _b === void 0 ? void 0 : _b.protocolMessage) === null || _c === void 0 ? void 0 : _c.appStateSyncKeyShare)
                && pendingAppStateSync) {
                await doAppStateSync();
                pendingAppStateSync = false;
            }
            for (const key of dedupKeys) {
                receivedMessageDedupCache.set(key, dedupState);
            }
        }
        catch (error) {
            for (const key of dedupKeys) {
                const currentState = receivedMessageDedupCache.get(key);
                if (currentState === 'processing') {
                    const previousState = dedupStateBeforeProcess.get(key);
                    if (previousState) {
                        receivedMessageDedupCache.set(key, previousState);
                    }
                    else {
                        receivedMessageDedupCache.del(key);
                    }
                }
            }
            throw error;
        }
    });
    ws.on('CB:presence', handlePresenceUpdate);
    ws.on('CB:chatstate', handlePresenceUpdate);
    ws.on('CB:ib,,dirty', async (node) => {
        const { attrs } = (0, WABinary_1.getBinaryNodeChild)(node, 'dirty');
        const type = attrs.type;
        switch (type) {
            case 'account_sync':
                if (attrs.timestamp) {
                    let { lastAccountSyncTimestamp } = authState.creds;
                    if (lastAccountSyncTimestamp) {
                        await cleanDirtyBits('account_sync', lastAccountSyncTimestamp);
                    }
                    lastAccountSyncTimestamp = +attrs.timestamp;
                    ev.emit('creds.update', { lastAccountSyncTimestamp });
                }
                break;
            case 'groups':
                break;
            default:
                logger.info({ node }, 'received unknown sync');
                break;
        }
    });
    ev.on('connection.update', ({ connection, receivedPendingNotifications }) => {
        var _a;
        if (connection === 'open') {
            if (fireInitQueries) {
                executeInitQueries()
                    .catch(error => onUnexpectedError(error, 'init queries'));
            }
            sendPresenceUpdate(markOnlineOnConnect ? 'available' : 'unavailable')
                .catch(error => onUnexpectedError(error, 'presence update requests'));
        }
        if (connection === 'close') { socketClosed = true; releaseInitialEvents(); receivedMessageDedupCache.close?.(); return; }
        if (!receivedPendingNotifications || syncState !== SyncState.Connecting) {
            return;
        }
        syncState = SyncState.AwaitingInitialSync;
        logger.info('Connection is now AwaitingInitialSync, buffering events');
        releaseInitialSync = ev.buffer();
        const willSyncHistory = shouldSyncHistoryMessage(
            WAProto_1.proto.Message.HistorySyncNotification.create({
                syncType: WAProto_1.proto.HistorySync.HistorySyncType.RECENT
            })
        );
        if (!willSyncHistory) {
            logger.info('History sync is disabled by config, not waiting for notification. Transitioning to Online.');
            syncState = SyncState.Online;
            releaseInitialEvents();
            return;
        }
        const initialSyncTimeoutMs = Number.isFinite(config.initialSyncTimeoutMs) && config.initialSyncTimeoutMs >= 1000 ? config.initialSyncTimeoutMs : 20000;
        logger.info({ initialSyncTimeoutMs }, 'History sync enabled, awaiting notification');
        if (awaitingSyncTimeout) {
            clearTimeout(awaitingSyncTimeout);
        }
        awaitingSyncTimeout = setTimeout(() => {
            if (syncState === SyncState.AwaitingInitialSync || syncState === SyncState.Syncing) {
                logger.warn('Timeout in AwaitingInitialSync, forcing state to Online and flushing buffer');
                syncState = SyncState.Online;
                releaseInitialEvents();
            }
        }, initialSyncTimeoutMs);
        awaitingSyncTimeout.unref?.();
    });
    return {
        ...sock,
        createCallLink,
        getBotListV2,
        processingMutex,
        fetchPrivacySettings,
        upsertMessage,
        appPatch,
        sendPresenceUpdate,
        presenceSubscribe,
        profilePictureUrl,
        onWhatsApp,
        fetchBlocklist,
        fetchDisappearingDuration,
        fetchStatus,
        updateProfilePicture,
        removeProfilePicture,
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
        addLabel,
        addChatLabel,
        removeChatLabel,
        addMessageLabel,
        removeMessageLabel,
        star
    };
};
exports.makeChatsSocket = makeChatsSocket;

// Kage: compatibilidad de API.
const __kageModule25 = (() => {
const module = { exports: {} }; const exports = module.exports;
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
const { makeSocket } = require("./socket")
const MAX_SYNC_ATTEMPTS = 2

const makeChatsSocket = (config) => {
    const {
        logger, 
        markOnlineOnConnect, 
        fireInitQueries, 
        appStateMacVerification,
        shouldIgnoreJid, 
        shouldSyncHistoryMessage, 
        getMessage 
    } = config
	
    const suki = makeSocket(config)
    
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
	
    let privacySettings
    let syncState = SyncState.Connecting
    
    /** this mutex ensures that messages are processed in order */
    const messageMutex = makeMutex()
    
    /** this mutex ensures that receipts are processed in order */
    const receiptMutex = makeMutex()
    
    /** this mutex ensures that app state patches are processed in order */
    const appStatePatchMutex = makeMutex()
    
    /** this mutex ensures that notifications are processed in order */
    const notificationMutex = makeMutex()
    
    // Timeout for AwaitingInitialSync state
    let awaitingSyncTimeout
    
    const placeholderResendCache = config.placeholderResendCache ||
        new NodeCache({
            stdTTL: DEFAULT_CACHE_TTLS.MSG_RETRY, // 1 hour
            useClones: false
        })
        
    if (!config.placeholderResendCache) {
        config.placeholderResendCache = placeholderResendCache
    }
    
    /** helper function to fetch the given app state sync key */
    const getAppStateSyncKey = async (keyId) => {
        const { [keyId]: key } = await authState.keys.get('app-state-sync-key', [keyId])
        return key
    }
    
    const fetchPrivacySettings = async (force = false) => {
        if (!privacySettings || force) {
            const { content } = await query({
                tag: 'iq',
                attrs: {
                    xmlns: 'privacy',
                    to: S_WHATSAPP_NET,
                    type: 'get'
                },
                content: [
                    { tag: 'privacy', attrs: {} }
                ]
            })
            privacySettings = reduceBinaryNodeToDictionary(content?.[0], 'category')
        }
        return privacySettings
    }
    
    /** helper function to run a privacy IQ query */
    const privacyQuery = async (name, value) => {
        await query({
            tag: 'iq',
            attrs: {
                xmlns: 'privacy',
                to: S_WHATSAPP_NET,
                type: 'set'
            },
            content: [{
                    tag: 'privacy',
                    attrs: {},
                    content: [
                        {
                            tag: 'category',
                            attrs: { name, value }
                        }
                    ]
                }]
        })
    }
    
    const updateMessagesPrivacy = async (value) => {
        await privacyQuery('messages', value)
    }
    
    const updateCallPrivacy = async (value) => {
        await privacyQuery('calladd', value)
    }
    
    const updateLastSeenPrivacy = async (value) => {
        await privacyQuery('last', value)
    }
    
    const updateOnlinePrivacy = async (value) => {
        await privacyQuery('online', value)
    }
    
    const updateProfilePicturePrivacy = async (value) => {
        await privacyQuery('profile', value)
    }
    
    const updateStatusPrivacy = async (value) => {
        await privacyQuery('status', value)
    }
    
    const updateReadReceiptsPrivacy = async (value) => {
        await privacyQuery('readreceipts', value)
    }
    
    const updateGroupsAddPrivacy = async (value) => {
        await privacyQuery('groupadd', value)
    }
    
    const updateDefaultDisappearingMode = async (duration) => {
        await query({
            tag: 'iq',
            attrs: {
                xmlns: 'disappearing_mode',
                to: S_WHATSAPP_NET,
                type: 'set'
            },
            content: [{
                    tag: 'disappearing_mode',
                    attrs: {
                        duration: duration.toString()
                    }
                }]
        })
    }
    
    const getBotListV2 = async () => {
	  const resp = await query({
    		tag: 'iq',
    		attrs: {
     			xmlns: 'bot',
     			to: S_WHATSAPP_NET,
     			type: 'get'
    		},
    		content: [{
     			tag: 'bot',
     			attrs: {
      				v: '2'
     			}
    		}]
   	})
   
		const botNode = getBinaryNodeChild(resp, 'bot')
		
		const botList = []
		
		for(const section of getBinaryNodeChildren(botNode, 'section')) {
		  if(section.attrs.type === 'all') {
				for(const bot of getBinaryNodeChildren(section, 'bot')) {
				  botList.push({
						jid: bot.attrs.jid,
						personaId: bot.attrs['persona_id']
					})
				}
			}
		}
		return botList
	}
	
	const getLidUser = async (jid) => {
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
    }
    
    const fetchStatus = async (...jids) => {
        const usyncQuery = new USyncQuery().withStatusProtocol()
        
        for (const jid of jids) {
            usyncQuery.withUser(new USyncUser().withId(jid))
        }
        
        const result = await suki.executeUSyncQuery(usyncQuery)
        
        if (result) {
            return result.list
        }
    }
    
    const fetchDisappearingDuration = async (...jids) => {   	
        const usyncQuery = new USyncQuery().withDisappearingModeProtocol()
        
        for (const jid of jids) {
            usyncQuery.withUser(new USyncUser().withId(jid))
        }
        
        const result = await suki.executeUSyncQuery(usyncQuery)
        
        if (result) {
            return result.list
        }
    }
    
    /** update the profile picture for yourself or a group */
    const updateProfilePicture = async (jid, content, dimensions) => {
        let targetJid
        
        if (!jid) {
            throw new Boom('Illegal no-jid profile update. Please specify either your ID or the ID of the chat you wish to update')
        }
        
        if (jidNormalizedUser(jid) !== jidNormalizedUser(authState.creds.me.id)) {
            targetJid = jidNormalizedUser(jid) // in case it is someone other than us
        }
        
        else {
            targetJid = undefined
        }
        
        const { img } = await generateProfilePicture(content, dimensions)
        
        await query({
            tag: 'iq',
            attrs: {
                to: S_WHATSAPP_NET,
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
        })
    }
    
    /** remove the profile picture for yourself or a group */
    const removeProfilePicture = async (jid) => {
        let targetJid
        
        if (!jid) {
            throw new Boom('Illegal no-jid profile update. Please specify either your ID or the ID of the chat you wish to update')
        }
        
        if (jidNormalizedUser(jid) !== jidNormalizedUser(authState.creds.me.id)) {
            targetJid = jidNormalizedUser(jid) // in case it is someone other than us
        }
        
        else {
            targetJid = undefined
        }
        
        await query({
            tag: 'iq',
            attrs: {
                to: S_WHATSAPP_NET,
                type: 'set',
                xmlns: 'w:profile:picture',
                ...(targetJid ? { target: targetJid } : {})
            }
        })
    }
    
    /** update the profile status for yourself */
    const updateProfileStatus = async (status) => {
        await query({
            tag: 'iq',
            attrs: {
                to: S_WHATSAPP_NET,
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
        })
    }
    
    const updateProfileName = async (name) => {
        await chatModify({ pushNameSetting: name }, '')
    }
    
    const fetchBlocklist = async () => {
        const result = await query({
            tag: 'iq',
            attrs: {
                xmlns: 'blocklist',
                to: S_WHATSAPP_NET,
                type: 'get'
            }
        })
        
        const listNode = getBinaryNodeChild(result, 'list')
        
        return getBinaryNodeChildren(listNode, 'item').map((n) => n.attrs.jid)
    }
    
    const updateBlockStatus = async (jid, action) => {
        await query({
            tag: 'iq',
            attrs: {
                xmlns: 'blocklist',
                to: S_WHATSAPP_NET,
                type: 'set'
            },
            content: [
                {
                    tag: 'item',
                    attrs: {
                        action,
                        jid
                    }
                }
            ]
        })
    }
    
    const getBusinessProfile = async (jid) => {
        const results = await query({
            tag: 'iq',
            attrs: {
                to: 's.whatsapp.net',
                xmlns: 'w:biz',
                type: 'get'
            },
            content: [{
                    tag: 'business_profile',
                    attrs: { v: '244' },
                    content: [{
                            tag: 'profile',
                            attrs: { jid }
                        }]
                }]
        })
        
        const profileNode = getBinaryNodeChild(results, 'business_profile')
        
        const profiles = getBinaryNodeChild(profileNode, 'profile')
        
        if (profiles) {
            const address = getBinaryNodeChild(profiles, 'address')
            const description = getBinaryNodeChild(profiles, 'description')
            const website = getBinaryNodeChild(profiles, 'website')
            const email = getBinaryNodeChild(profiles, 'email')
            const category = getBinaryNodeChild(getBinaryNodeChild(profiles, 'categories'), 'category')
            const businessHours = getBinaryNodeChild(profiles, 'business_hours')
            const businessHoursConfig = businessHours
                ? getBinaryNodeChildren(businessHours, 'business_hours_config')
                : undefined
            const websiteStr = website?.content?.toString()
            
            return {
                wid: profiles?.attrs?.jid,
                address: address?.content?.toString(),
                description: description?.content?.toString() || '',
                website: websiteStr ? [websiteStr] : [],
                email: email?.content?.toString(),
                category: category?.content?.toString(),
                'business_hours': {
                    timezone: businessHours?.attrs?.timezone,
                    'business_config': businessHoursConfig?.map(({ attrs }) => attrs)
                }
            }
        }
    }
    
    const cleanDirtyBits = async (type, fromTimestamp) => {
        logger.info({ fromTimestamp }, 'clean dirty bits ' + type)
        await sendNode({
            tag: 'iq',
            attrs: {
                to: S_WHATSAPP_NET,
                type: 'set',
                xmlns: 'urn:xmpp:whatsapp:dirty',
                id: generateMessageTag(),
            },
            content: [
                {
                    tag: 'clean',
                    attrs: {
                        type,
                        ...(fromTimestamp ? { timestamp: fromTimestamp.toString() } : null),
                    }
                }
            ]
        })
    }
    
    const newAppStateChunkHandler = (isInitialSync) => {
        return {
            onMutation(mutation) {
                processSyncAction(mutation, ev, authState.creds.me, isInitialSync ? { accountSettings: authState.creds.accountSettings } : undefined, logger)
            }
        }
    }
    
    const resyncAppState = ev.createBufferedFunction(async (collections, isInitialSync) => {
        // we use this to determine which events to fire
        // otherwise when we resync from scratch -- all notifications will fire
        const initialVersionMap = {}
        const globalMutationMap = {}
        
        await authState.keys.transaction(async () => {
            const collectionsToHandle = new Set(collections)
            
            // in case something goes wrong -- ensure we don't enter a loop that cannot be exited from
            const attemptsMap = {}
            
            // keep executing till all collections are done
            // sometimes a single patch request will not return all the patches (God knows why)
            // so we fetch till they're all done (this is determined by the "has_more_patches" flag)
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
                            // return snapshot if being synced from scratch
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
                
                // extract from binary node
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
                        
                        // only process if there are syncd patches
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
                            // collection is done with sync
                            collectionsToHandle.delete(name)
                        }
                    }
                    
                    catch (error) {
                        // if retry attempts overshoot
                        // or key not found
                        const isIrrecoverableError = attemptsMap[name] >= MAX_SYNC_ATTEMPTS ||
                            error.output?.statusCode === 404 ||
                            error.name === 'TypeError'
                            
                        logger.info({ name, error: error.stack }, `failed to sync state from version${isIrrecoverableError ? '' : ', removing and trying from scratch'}`)
                        
                        await authState.keys.set({ 'app-state-sync-version': { [name]: null } })
                        
                        // increment number of retries
                        attemptsMap[name] = (attemptsMap[name] || 0) + 1
                        
                        if (isIrrecoverableError) {
                            // stop retrying
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
    })
    
    // source: https://github.com/WhiskeySockets/Baileys/pull/1677
    const createCallLink = async (type, event, timeoutMs) => {
    	type = type?.toLowerCase() 
    
    	if (!type || (type !== 'audio' && type !== 'video')) {
    		throw new Error('Make sure the type is audio or video!') 
    	}
    
    	const result = await query({
    		tag: 'call',
    		attrs: {
    			id: generateMessageTag(), 
    			to: '@call'
    		}, 
    		content: [{
    			tag: 'link_create', 
    			attrs: {
    				media: type
    			}, 
    			content: event ? [{ 
    				tag: 'event', 
    				attrs: {
    					start_time: String(event) 
    				}
    			}] : undefined
    		}]
    	}, timeoutMs) 
    
    	const child = getBinaryNodeChild(result, 'link_create') 
    	const token = child?.attrs?.token
    
    	return type === 'audio' ? CALL_AUDIO_PREFIX + token : CALL_VIDEO_PREFIX + token
    }
    
    const sendPresenceUpdate = async (type, toJid) => {
        const me = authState.creds.me
        
        if (type === 'available' || type === 'unavailable') {
            if (!me.name) {
                logger.warn('no name present, ignoring presence update request...')
                return
            }
            
            ev.emit('connection.update', { isOnline: type === 'available' })
            await sendNode({
                tag: 'presence',
                attrs: {
                    name: me.name.replace(/@/g, ''),
                    type
                }
            })
        }
        else {
        	const { server } = jidDecode(toJid) 
        
            await sendNode({
                tag: 'chatstate',
                attrs: {
                    from: server === 'lid' ? me.lid : me.id,
                    to: toJid
                },
                content: [
                    {
                        tag: type === 'recording' ? 'composing' : type,
                        attrs: type === 'recording' ? { media: 'audio' } : {}
                    }
                ]
            })
        }
    }
    
    /**
     * @param toJid the jid to subscribe to
     * @param tcToken token for subscription, use if present
     */
    const presenceSubscribe = (toJid, tcToken) => (sendNode({
        tag: 'presence',
        attrs: {
            to: toJid,
            id: generateMessageTag(),
            type: 'subscribe'
        },
        content: tcToken
            ? [
                {
                    tag: 'tctoken',
                    attrs: {},
                    content: tcToken
                }
            ]
            : undefined
    }))
    
    const handlePresenceUpdate = ({ tag, attrs, content }) => {
        let presence
        
        const jid = attrs.from
        const participant = attrs.participant || attrs.from
        
        if (shouldIgnoreJid(jid) && jid !== S_WHATSAPP_NET) {
            return
        }
        
        if (tag === 'presence') {
            presence = {
                lastKnownPresence: attrs.type === 'unavailable' ? 'unavailable' : 'available',
                lastSeen: attrs.last && attrs.last !== 'deny' ? +attrs.last : undefined
            }
        }
        
        else if (Array.isArray(content)) {
            const [firstChild] = content
            
            let type = firstChild.tag
            
            if (type === 'paused') {
                type = 'available'
            }
            
            if (firstChild.attrs?.media === 'audio') {
                type = 'recording'
            }
            
            presence = { lastKnownPresence: type }
        }
        
        else {
            logger.error({ tag, attrs, content }, 'recv invalid presence node')
        }
        
        if (presence) {
            ev.emit('presence.update', { id: jid, presences: { [participant]: presence } })
        }
    }
    
    const appPatch = async (patchCreate) => {
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
    }
    
    /** sending non-abt props may fix QR scan fail if server expects */
    const fetchProps = async () => {
        //TODO: implement both protocol 1 and protocol 2 prop fetching, specially for abKey for WM
        const resultNode = await query({
            tag: 'iq',
            attrs: {
                to: S_WHATSAPP_NET,
                xmlns: 'w',
                type: 'get'
            },
            content: [
                {
                    tag: 'props',
                    attrs: {
                        protocol: '2',
                        hash: authState?.creds?.lastPropHash || ''
                    }
                }
            ]
        })
        
        const propsNode = getBinaryNodeChild(resultNode, 'props')
        let props = {}
        
        if (propsNode) {
            if (propsNode.attrs?.hash) {
                // on some clients, the hash is returning as undefined
                authState.creds.lastPropHash = propsNode?.attrs?.hash
                ev.emit('creds.update', authState.creds)
            }
            
            props = reduceBinaryNodeToDictionary(propsNode, 'prop')
        }
        logger.debug('fetched props')
        
        return props
    }
    
    /**
     * modify a chat -- mark unread, read etc.
     * lastMessages must be sorted in reverse chronologically
     * requires the last messages till the last message received required for archive & unread
    */
    const chatModify = (mod, jid) => {
        const patch = chatModificationToAppPatch(mod, jid)
        return appPatch(patch)
    }
    
    /**
     * Enable/Disable link preview privacy, not related to baileys link preview generation
     */
    const updateDisableLinkPreviewsPrivacy = (isPreviewsDisabled) => {
    	return chatModify({
    		disableLinkPreviews: {
    			isPreviewsDisabled
    		}
    	}, '') 
    } 
    
    /**
     * Star or Unstar a message
     */
    const star = (jid, messages, star) => {
        return chatModify({
            star: {
                messages,
                star
            }
        }, jid)
    }
    
    /**
     * Add Or Edit Contact
     */
    const addOrEditContact = (jid, contact) => {
    	return chatModify({
    	    contact
        }, jid) 
    }
    
    /**
     * Remove Contact
     */
     const removeContact = (jid) => {
     	return chatModify({
     	    contact: null
         }, jid) 
     }
    
    /**
     * Adds label
     */
    const addLabel = (jid, labels) => {
        return chatModify({
            addLabel: {
                ...labels
            }
        }, jid)
    }
    
    /**
     * Adds label for the chats
     */
    const addChatLabel = (jid, labelId) => {
        return chatModify({
            addChatLabel: {
                labelId
            }
        }, jid)
    }
    
    /**
     * Removes label for the chat
     */
    const removeChatLabel = (jid, labelId) => {
        return chatModify({
            removeChatLabel: {
                labelId
            }
        }, jid)
    }
    
    /**
     * Adds label for the message
     */
    const addMessageLabel = (jid, messageId, labelId) => {
        return chatModify({
            addMessageLabel: {
                messageId,
                labelId
            }
        }, jid)
    }
    
    /**
     * Removes label for the message
     */
    const removeMessageLabel = (jid, messageId, labelId) => {
        return chatModify({
            removeMessageLabel: {
                messageId,
                labelId
            }
        }, jid)
    }
    
    /**
     * Removes Chats 
     */
     const clearMessage = (jid, key, timeStamp) => {
         return chatModify({
           delete: true,
           lastMessages: [{
                key: key,
                messageTimestamp: timeStamp
            }],
        }, jid)
     }
     
     /**
     * Add or Edit Quick Reply
     */
    const addOrEditQuickReply = (quickReply) => {
        return chatModify({
            quickReply
        }, '')
    }
    
    /**
     * Remove Quick Reply
     */
    const removeQuickReply = (timestamp) => {
        return chatModify({
            quickReply: { timestamp, deleted: true }
        }, '')
    }
     
    /**
     * queries need to be fired on connection open
     * help ensure parity with WA Web
     * */
    const executeInitQueries = async () => {
        await Promise.all([
            fetchProps(),
            fetchBlocklist(),
            fetchPrivacySettings(),
        ])
    }
    
    const upsertMessage = ev.createBufferedFunction(async (msg, type) => {
        ev.emit('messages.upsert', { messages: [msg], type })
        
        if (!!msg.pushName) {
            let jid = msg.key.fromMe ? authState.creds.me.id : msg.key.participant || msg.key.remoteJid
            
            jid = jidNormalizedUser(jid)
            
            if (!msg.key.fromMe) {
                ev.emit('contacts.update', [{ id: jid, notify: msg.pushName, verifiedName: msg.verifiedBizName }])
            }
            
            // update our pushname too
            if (msg.key.fromMe && msg.pushName && authState.creds.me?.name !== msg.pushName) {
                ev.emit('creds.update', { me: { ...authState.creds.me, name: msg.pushName } })
            }
        }
        
        const historyMsg = getHistoryMsg(msg.message)
        const shouldProcessHistoryMsg = historyMsg
            ? shouldSyncHistoryMessage(historyMsg) &&
                PROCESSABLE_HISTORY_TYPES.includes(historyMsg.syncType)
            : false
            
        // State machine: decide on sync and flush
        if (historyMsg && syncState === SyncState.AwaitingInitialSync) {
            if (awaitingSyncTimeout) {
                clearTimeout(awaitingSyncTimeout)
                awaitingSyncTimeout = undefined
            }
            
            if (shouldProcessHistoryMsg) {
                syncState = SyncState.Syncing
                logger.info('Transitioned to Syncing state')
                // Let doAppStateSync handle the final flush after it's done
            }
            
            else {
                syncState = SyncState.Online
                
                logger.info('History sync skipped, transitioning to Online state and flushing buffer')
                
                ev.flush()
            }
        }
        
        const doAppStateSync = async () => {
            if (syncState === SyncState.Syncing) {
                logger.info('Doing app state sync')
                
                await resyncAppState(ALL_WA_PATCH_NAMES, true)
                
                // Sync is complete, go online and flush everything
                syncState = SyncState.Online
                
                logger.info('App state sync complete, transitioning to Online state and flushing buffer')
                
                ev.flush()
                
                const accountSyncCounter = (authState.creds.accountSyncCounter || 0) + 1
                
                ev.emit('creds.update', { accountSyncCounter })
            }
        }
        
        await Promise.all([
            (async () => {
                if (shouldProcessHistoryMsg) {
                    await doAppStateSync()
                }
            })(),
            processMessage(msg, {
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
        ])
        
        // If the app state key arrives and we are waiting to sync, trigger the sync now.
        if (msg.message?.protocolMessage?.appStateSyncKeyShare && syncState === SyncState.Syncing) {
            logger.info('App state sync key arrived, triggering app state sync')
            await doAppStateSync()
        }
    })
    
    ws.on('CB:presence', handlePresenceUpdate)
    ws.on('CB:chatstate', handlePresenceUpdate)
    ws.on('CB:ib,,dirty', async (node) => {
        const { attrs } = getBinaryNodeChild(node, 'dirty')
        const type = attrs.type
        
        switch (type) {
            case 'account_sync':
                if (attrs.timestamp) {
                    let { lastAccountSyncTimestamp } = authState.creds
                    
                    if (lastAccountSyncTimestamp) {
                        await cleanDirtyBits('account_sync', lastAccountSyncTimestamp)
                    }
                    
                    lastAccountSyncTimestamp = +attrs.timestamp
                    
                    ev.emit('creds.update', { lastAccountSyncTimestamp })
                }
                break
            case 'groups':
                // handled in groups.js
                break
            default:
                logger.info({ node }, 'received unknown sync')
                break
        }
    })
    
    ev.on('connection.update', ({ connection, receivedPendingNotifications }) => {
        if (connection === 'open') {
            if (fireInitQueries) {
                executeInitQueries().catch(error => onUnexpectedError(error, 'init queries'))
            }
            
            sendPresenceUpdate(markOnlineOnConnect ? 'available' : 'unavailable').catch(error => onUnexpectedError(error, 'presence update requests'))
        }
        
        if (!receivedPendingNotifications || syncState !== SyncState.Connecting) {
            return
        }
        
        syncState = SyncState.AwaitingInitialSync
        
        logger.info('Connection is now AwaitingInitialSync, buffering events')
        ev.buffer()
        
        const willSyncHistory = shouldSyncHistoryMessage(proto.Message.HistorySyncNotification.create({
            syncType: proto.HistorySync.HistorySyncType.RECENT
        }))
        
        if (!willSyncHistory) {
            logger.info('History sync is disabled by config, not waiting for notification. Transitioning to Online.')
            syncState = SyncState.Online
            setTimeout(() => ev.flush(), 0)
            return
        }
        
        logger.info('History sync is enabled, awaiting notification with a 20s timeout.')
        
        if (awaitingSyncTimeout) {
            clearTimeout(awaitingSyncTimeout);
        }
        
        awaitingSyncTimeout = setTimeout(() => {
            if (syncState === SyncState.AwaitingInitialSync) {
                // TODO: investigate
                logger.warn('Timeout in AwaitingInitialSync, forcing state to Online and flushing buffer')
                syncState = SyncState.Online
                ev.flush()
            }
        }, 20000)
    })
    
    return {
        ...suki, 
        star, 
        addOrEditContact, 
        removeContact, 
        fetchPrivacySettings,
        upsertMessage,
        appPatch,
        createCallLink, 
        sendPresenceUpdate,
        presenceSubscribe, 
        getBotListV2,  
        messageMutex, 
        receiptMutex, 
        appStatePatchMutex, 
        notificationMutex, 
        getLidUser, 
        fetchBlocklist,
        fetchStatus,
        fetchDisappearingDuration,
        updateProfilePicture,
        removeProfilePicture,
        updateProfileStatus,
        updateProfileName,
        updateBlockStatus,
        updateCallPrivacy,
        updateMessagesPrivacy, 
        updateLastSeenPrivacy,
        updateOnlinePrivacy,
        updateProfilePicturePrivacy,
        updateStatusPrivacy,
        updateReadReceiptsPrivacy,
        updateGroupsAddPrivacy,
        updateDefaultDisappearingMode,
        updateDisableLinkPreviewsPrivacy, 
        getBusinessProfile,
        resyncAppState,
        chatModify,
        cleanDirtyBits,
        addLabel,
        addChatLabel,
        removeChatLabel,
        addMessageLabel,
        removeMessageLabel,
        clearMessage, 
        addOrEditQuickReply,
        removeQuickReply
    }
}

module.exports = {
  makeChatsSocket
}
return module.exports;
})();
for (const key of Object.keys(__kageModule25)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule25[key]});
}

// Kage: funciones avanzadas.
const __kageModule131 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeChatsSocket = exports.buildProfilePictureQueryContent = void 0;
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
const socket_js_1 = require("./socket.js");
const buildProfilePictureQueryContent = (type, tcTokenContent) => {
    const picture = { tag: 'picture', attrs: { type, query: 'url' } };
    if (tcTokenContent?.length) {
        picture.content = tcTokenContent;
    }
    return [picture];
};
exports.buildProfilePictureQueryContent = buildProfilePictureQueryContent;
const makeChatsSocket = (config) => {
    const { logger, markOnlineOnConnect, fireInitQueries, appStateMacVerification, shouldIgnoreJid, shouldSyncHistoryMessage, getMessage } = config;
    const sock = (0, socket_js_1.makeSocket)(config);
    const { ev, ws, authState, generateMessageTag, sendNode, query, signalRepository, onUnexpectedError, sendUnifiedSession, registerSocketEndHandler } = sock;
    const getLIDForPN = signalRepository.lidMapping.getLIDForPN.bind(signalRepository.lidMapping);
    let privacySettings;
    /** Server-assigned AB props for protocol behavior. */
    const serverProps = {
        /** AB prop 10518: gate tctoken on 1:1 messages. Default true (safe: avoids 463). */
        privacyTokenOn1to1: true,
        /** AB prop 9666: gate tctoken on profile picture IQs. WA Web default: true. */
        profilePicPrivacyToken: true,
        /** AB prop 14303: issue tctokens to LID instead of PN. WA Web default: false. */
        lidTrustedTokenIssueToLid: false
    };
    let syncState = State_js_1.SyncState.Connecting;
    /** this mutex ensures that messages are processed in order */
    const messageMutex = (0, make_mutex_js_1.makeMutex)();
    /** this mutex ensures that receipts are processed in order */
    const receiptMutex = (0, make_mutex_js_1.makeMutex)();
    /** this mutex ensures that app state patches are processed in order */
    const appStatePatchMutex = (0, make_mutex_js_1.makeMutex)();
    /** this mutex ensures that notifications are processed in order */
    const notificationMutex = (0, make_mutex_js_1.makeMutex)();
    // Timeout for AwaitingInitialSync state
    let awaitingSyncTimeout;
    // In-memory history sync completion tracking (resets on reconnection)
    const historySyncStatus = {
        initialBootstrapComplete: false,
        recentSyncComplete: false
    };
    let historySyncPausedTimeout;
    // Collections blocked on missing app state sync keys (mirrors WA Web's "Blocked" state).
    // When a key arrives via APP_STATE_SYNC_KEY_SHARE, these are re-synced.
    const blockedCollections = new Set();
    const placeholderResendCache = config.placeholderResendCache ||
        (0, index_js_2.createCache)({
            ttl: index_js_3.DEFAULT_CACHE_TTLS.MSG_RETRY // 1 hour
        });
    /** helper function to fetch the given app state sync key */
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
    /** helper function to run a privacy IQ query */
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
    // Kage: nota de compatibilidad.
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
    /** update the profile picture for yourself or a group */
    const updateProfilePicture = async (jid, content, dimensions) => {
        let targetJid;
        if (!jid) {
            throw new index_js_2.HttpError('Illegal no-jid profile update. Please specify either your ID or the ID of the chat you wish to update');
        }
        if ((0, index_js_6.jidNormalizedUser)(jid) !== (0, index_js_6.jidNormalizedUser)(authState.creds.me.id)) {
            targetJid = (0, index_js_6.jidNormalizedUser)(jid); // in case it is someone other than us
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
    /** remove the profile picture for yourself or a group */
    const removeProfilePicture = async (jid) => {
        let targetJid;
        if (!jid) {
            throw new index_js_2.HttpError('Illegal no-jid profile update. Please specify either your ID or the ID of the chat you wish to update');
        }
        if ((0, index_js_6.jidNormalizedUser)(jid) !== (0, index_js_6.jidNormalizedUser)(authState.creds.me.id)) {
            targetJid = (0, index_js_6.jidNormalizedUser)(jid); // in case it is someone other than us
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
    /** update the profile status for yourself */
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
                website: websiteStr ? [websiteStr] : [],
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
        // we use this to determine which events to fire
        // otherwise when we resync from scratch -- all notifications will fire
        const initialVersionMap = {};
        const globalMutationMap = {};
        await authState.keys.transaction(async () => {
            const collectionsToHandle = new Set(collections);
            // in case something goes wrong -- ensure we don't enter a loop that cannot be exited from
            const attemptsMap = {};
            // collections that failed and need a full snapshot on retry
            // mirrors WA Web's ErrorFatal -> force snapshot behavior
            const forceSnapshotCollections = new Set();
            // keep executing till all collections are done
            // sometimes a single patch request will not return all the patches (God knows why)
            // so we fetch till they're all done (this is determined by the "has_more_patches" flag)
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
                            // return snapshot if syncing from scratch or forcing after a failed attempt
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
                // extract from binary node
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
                        // only process if there are syncd patches
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
                            // collection is done with sync
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
                            // WA Web treats missing keys as "Blocked" — park the collection
                            // until the key arrives via APP_STATE_SYNC_KEY_SHARE.
                            logger.warn(logData, `${name} blocked on missing key from v${states[name].version}, parking after ${attemptsMap[name]} attempts`);
                            blockedCollections.add(name);
                            collectionsToHandle.delete(name);
                        }
                        else if ((0, index_js_5.isMissingKeyError)(error)) {
                            // Retry with a snapshot which may use a different key.
                            logger.info(logData, `${name} blocked on missing key from v${states[name].version}, retrying with snapshot`);
                            forceSnapshotCollections.add(name);
                        }
                        else if ((0, index_js_5.isAppStateSyncIrrecoverable)(error, attemptsMap[name])) {
                            logger.warn(logData, `failed to sync ${name} from v${states[name].version}, giving up`);
                            collectionsToHandle.delete(name);
                        }
                        else {
                            logger.info(logData, `failed to sync ${name} from v${states[name].version}, forcing snapshot retry`);
                            // force a full snapshot on retry to recover from
                            // corrupted local state (e.g. LTHash MAC mismatch)
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
    /**
     * fetch the profile picture of a user/group
     * type = "preview" for a low res picture
     * type = "image for the high res picture"
     */
    const profilePictureUrl = async (jid, type = 'image', timeoutMs = 5000, shouldIncludeTcToken = true) => {
        // WA Web only includes tctoken for user JIDs (not groups/newsletters)
        // and never for own profile pic (Chat model for self has no tcToken).
        // Including tctoken for own JID causes the server to never respond.
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
    /**
     * @param toJid the jid to subscribe to
     * @param tcToken token for subscription, use if present
     */
    const presenceSubscribe = async (toJid) => {
        // Only include tctoken for user JIDs — groups/newsletters don't use tctokens
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
    /** fetch AB props */
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
                // on some clients, the hash is returning as undefined
                authState.creds.lastPropHash = propsNode?.attrs?.hash;
                ev.emit('creds.update', authState.creds);
            }
            props = (0, index_js_6.reduceBinaryNodeToDictionary)(propsNode, 'prop');
        }
        // Extract protocol-relevant AB props (only the ones we need)
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
    /**
     * modify a chat -- mark unread, read etc.
     * lastMessages must be sorted in reverse chronologically
     * requires the last messages till the last message received; required for archive & unread
     */
    const chatModify = (mod, jid) => {
        const patch = (0, index_js_5.chatModificationToAppPatch)(mod, jid);
        return appPatch(patch);
    };
    /**
     * Enable/Disable link preview privacy, not related to baileys link preview generation
     */
    const updateDisableLinkPreviewsPrivacy = (isPreviewsDisabled) => {
        return chatModify({
            disableLinkPreviews: { isPreviewsDisabled }
        }, '');
    };
    /**
     * Star or Unstar a message
     */
    const star = (jid, messages, star) => {
        return chatModify({
            star: {
                messages,
                star
            }
        }, jid);
    };
    /**
     * Add or Edit Contact
     */
    const addOrEditContact = (jid, contact) => {
        return chatModify({
            contact
        }, jid);
    };
    /**
     * Remove Contact
     */
    const removeContact = (jid) => {
        return chatModify({
            contact: null
        }, jid);
    };
    /**
     * Adds label
     */
    const addLabel = (jid, labels) => {
        return chatModify({
            addLabel: {
                ...labels
            }
        }, jid);
    };
    /**
     * Adds label for the chats
     */
    const addChatLabel = (jid, labelId) => {
        return chatModify({
            addChatLabel: {
                labelId
            }
        }, jid);
    };
    /**
     * Removes label for the chat
     */
    const removeChatLabel = (jid, labelId) => {
        return chatModify({
            removeChatLabel: {
                labelId
            }
        }, jid);
    };
    /**
     * Adds label for the message
     */
    const addMessageLabel = (jid, messageId, labelId) => {
        return chatModify({
            addMessageLabel: {
                messageId,
                labelId
            }
        }, jid);
    };
    /**
     * Removes label for the message
     */
    const removeMessageLabel = (jid, messageId, labelId) => {
        return chatModify({
            removeMessageLabel: {
                messageId,
                labelId
            }
        }, jid);
    };
    /**
     * Add or Edit Quick Reply
     */
    const addOrEditQuickReply = (quickReply) => {
        return chatModify({
            quickReply
        }, '');
    };
    /**
     * Remove Quick Reply
     */
    const removeQuickReply = (timestamp) => {
        return chatModify({
            quickReply: { timestamp, deleted: true }
        }, '');
    };
    /**
     * queries need to be fired on connection open
     * help ensure parity with WA Web
     * */
    const executeInitQueries = async () => {
        await Promise.all([fetchProps(), fetchBlocklist(), fetchPrivacySettings()]);
    };
    const upsertMessage = ev.createBufferedFunction(async (msg, type) => {
        ev.emit('messages.upsert', { messages: [msg], type });
        if (!!msg.pushName) {
            let jid = msg.key.fromMe ? authState.creds.me.id : msg.key.participant || msg.key.remoteJid;
            jid = (0, index_js_6.jidNormalizedUser)(jid);
            if (!msg.key.fromMe) {
                ev.emit('contacts.update', [{ id: jid, notify: msg.pushName, verifiedName: msg.verifiedBizName }]);
            }
            // update our pushname too
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
            // INITIAL_BOOTSTRAP — fire immediately, no progress check (same as WA Web K function)
            if (syncType === index_js_1.proto.HistorySync.HistorySyncType.INITIAL_BOOTSTRAP &&
                !historySyncStatus.initialBootstrapComplete) {
                historySyncStatus.initialBootstrapComplete = true;
                ev.emit('messaging-history.status', {
                    syncType,
                    status: 'complete',
                    explicit: true
                });
            }
            // RECENT with progress === 100 — explicit completion
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
            // Reset 120s paused timeout on any RECENT chunk (like WA Web's handleChunkProgress)
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
        // State machine: decide on sync and flush
        if (historyMsg && syncState === State_js_1.SyncState.AwaitingInitialSync) {
            if (awaitingSyncTimeout) {
                clearTimeout(awaitingSyncTimeout);
                awaitingSyncTimeout = undefined;
            }
            if (shouldProcessHistoryMsg) {
                syncState = State_js_1.SyncState.Syncing;
                logger.info('Transitioned to Syncing state');
                // Let doAppStateSync handle the final flush after it's done
            }
            else {
                syncState = State_js_1.SyncState.Online;
                logger.info('History sync skipped, transitioning to Online state and flushing buffer');
                ev.flush();
            }
        }
        const doAppStateSync = async () => {
            if (syncState === State_js_1.SyncState.Syncing) {
                // All collections will be synced, so clear any blocked ones
                blockedCollections.clear();
                logger.info('Doing app state sync');
                await resyncAppState(index_js_4.ALL_WA_PATCH_NAMES, true);
                // Sync is complete, go online and flush everything
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
        // If the app state key arrives and we are waiting to sync, trigger the sync now.
        if (msg.message?.protocolMessage?.appStateSyncKeyShare && syncState === State_js_1.SyncState.Syncing) {
            logger.info('App state sync key arrived, triggering app state sync');
            await doAppStateSync();
        }
    });
    ws.on('CB:presence', handlePresenceUpdate);
    ws.on('CB:chatstate', handlePresenceUpdate);
    ws.on('CB:ib,,dirty', async (node) => {
        const { attrs } = (0, index_js_6.getBinaryNodeChild)(node, 'dirty');
        const type = attrs.type;
        switch (type) {
            case 'account_sync':
                if (attrs.timestamp) {
                    let { lastAccountSyncTimestamp } = authState.creds;
                    if (lastAccountSyncTimestamp) {
                        await cleanDirtyBits('account_sync', lastAccountSyncTimestamp);
                    }
                    lastAccountSyncTimestamp = +attrs.timestamp;
                    ev.emit('creds.update', { lastAccountSyncTimestamp });
                }
                break;
            case 'groups':
                // handled in groups.ts
                break;
            default:
                logger.info({ node }, 'received unknown sync');
                break;
        }
    });
    ev.on('connection.update', ({ connection, receivedPendingNotifications }) => {
        if (connection === 'close') {
            blockedCollections.clear();
            clearTimeout(historySyncPausedTimeout);
            historySyncPausedTimeout = undefined;
        }
        if (connection === 'open') {
            if (fireInitQueries) {
                executeInitQueries().catch(error => onUnexpectedError(error, 'init queries'));
            }
            sendPresenceUpdate(markOnlineOnConnect ? 'available' : 'unavailable').catch(error => onUnexpectedError(error, 'presence update requests'));
        }
        if (!receivedPendingNotifications || syncState !== State_js_1.SyncState.Connecting) {
            return;
        }
        historySyncStatus.initialBootstrapComplete = false;
        historySyncStatus.recentSyncComplete = false;
        clearTimeout(historySyncPausedTimeout);
        historySyncPausedTimeout = undefined;
        syncState = State_js_1.SyncState.AwaitingInitialSync;
        logger.info('Connection is now AwaitingInitialSync, buffering events');
        ev.buffer();
        const willSyncHistory = shouldSyncHistoryMessage(index_js_1.proto.Message.HistorySyncNotification.create({
            syncType: index_js_1.proto.HistorySync.HistorySyncType.RECENT
        }));
        if (!willSyncHistory) {
            logger.info('History sync is disabled by config, not waiting for notification. Transitioning to Online.');
            syncState = State_js_1.SyncState.Online;
            setTimeout(() => ev.flush(), 0);
            return;
        }
        // On reconnection (accountSyncCounter > 0), the server does not push
        // history sync notifications — the device already has its data.
        // Skip the 20s wait and go online immediately.
        if (authState.creds.accountSyncCounter > 0) {
            logger.info('Reconnection with existing sync data, skipping history sync wait. Transitioning to Online.');
            syncState = State_js_1.SyncState.Online;
            setTimeout(() => ev.flush(), 0);
            return;
        }
        logger.info('First connection, awaiting history sync notification with a 20s timeout.');
        if (awaitingSyncTimeout) {
            clearTimeout(awaitingSyncTimeout);
        }
        awaitingSyncTimeout = setTimeout(() => {
            if (syncState === State_js_1.SyncState.AwaitingInitialSync) {
                logger.warn('Timeout in AwaitingInitialSync, forcing state to Online and flushing buffer');
                syncState = State_js_1.SyncState.Online;
                ev.flush();
                // Increment so subsequent reconnections skip the 20s wait.
                // Late-arriving history is still processed via processMessage
                // regardless of the state machine phase.
                const accountSyncCounter = (authState.creds.accountSyncCounter || 0) + 1;
                ev.emit('creds.update', { accountSyncCounter });
            }
        }, 20000);
    });
    // When an app state sync key arrives (myAppStateKeyId is set) and there are
    // collections blocked on a missing key, trigger a re-sync for just those collections.
    // This mirrors WA Web's Blocked → retry-on-key-arrival behavior.
    ev.on('creds.update', ({ myAppStateKeyId }) => {
        if (!myAppStateKeyId || blockedCollections.size === 0) {
            return;
        }
        // If we're in the middle of a full sync, doAppStateSync handles all collections
        if (syncState === State_js_1.SyncState.Syncing) {
            blockedCollections.clear();
            return;
        }
        const collections = [...blockedCollections];
        blockedCollections.clear();
        logger.info({ collections }, 'app state sync key arrived, re-syncing blocked collections');
        resyncAppState(collections, false).catch(error => onUnexpectedError(error, 'blocked collections resync'));
    });
    ev.on('lid-mapping.update', async ({ lid, pn }) => {
        try {
            await signalRepository.lidMapping.storeLIDPNMappings([{ lid, pn }]);
        }
        catch (error) {
            logger.warn({ lid, pn, error }, 'Failed to store LID-PN mapping');
        }
    });
    registerSocketEndHandler(() => {
        if (awaitingSyncTimeout) {
            clearTimeout(awaitingSyncTimeout);
            awaitingSyncTimeout = undefined;
        }
        if (!config.placeholderResendCache && placeholderResendCache.close) {
            placeholderResendCache.close();
        }
        syncState = State_js_1.SyncState.Connecting;
        privacySettings = undefined;
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
        fetchDisappearingDuration,
        updateProfilePicture,
        removeProfilePicture,
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
exports.makeChatsSocket = makeChatsSocket;

return module.exports;
})();
for (const key of Object.keys(__kageModule131)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule131[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule131, configurable:true});
