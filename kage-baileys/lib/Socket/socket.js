"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeSocket = void 0;
const boom_1 = require("@hapi/boom");
const crypto_1 = require("crypto");
const url_1 = require("url");
const util_1 = require("util");
const WAProto_1 = require("../../WAProto");
const Defaults_1 = require("../Defaults");
const Types_1 = require("../Types");
const Utils_1 = require("../Utils");
const WABinary_1 = require("../WABinary");
const Client_1 = require("./Client");
 





const makeSocket = (config) => {
    var _a, _b;
    const { waWebSocketUrl, connectTimeoutMs, logger, keepAliveIntervalMs, browser, auth: authState, printQRInTerminal, defaultQueryTimeoutMs, transactionOpts, qrTimeout, makeSignalRepository, } = config;
    const url = typeof waWebSocketUrl === 'string' ? new url_1.URL(waWebSocketUrl) : waWebSocketUrl;
    if (config.mobile || url.protocol === 'tcp:') {
        throw new boom_1.Boom('Mobile API is not supported anymore', { statusCode: Types_1.DisconnectReason.loggedOut });
    }
    if (url.protocol === 'wss' && ((_a = authState === null || authState === void 0 ? void 0 : authState.creds) === null || _a === void 0 ? void 0 : _a.routingInfo)) {
        url.searchParams.append('ED', authState.creds.routingInfo.toString('base64url'));
    }
    const ws = new Client_1.WebSocketClient(url, config);
    ws.connect();
    const ev = (0, Utils_1.makeEventBuffer)(logger);
     
    const ephemeralKeyPair = Utils_1.Curve.generateKeyPair();
     
    const noise = (0, Utils_1.makeNoiseHandler)({
        keyPair: ephemeralKeyPair,
        NOISE_HEADER: Defaults_1.NOISE_WA_HEADER,
        logger,
        routingInfo: (_b = authState === null || authState === void 0 ? void 0 : authState.creds) === null || _b === void 0 ? void 0 : _b.routingInfo
    });
    const { creds } = authState;
     
    const keys = (0, Utils_1.addTransactionCapability)(authState.keys, logger, transactionOpts);
    const signalRepository = makeSignalRepository({ creds, keys });
    let lastDateRecv;
    let epoch = 1;
    let keepAliveReq;
    let qrTimer;
    let closed = false;
    let serverTimeOffsetMs = 0;
    const socketEndHandlers = new Set();
    const runEndHandler = handler => {
        try {
            Promise.resolve(handler()).catch(error => logger.warn({ error }, 'socket cleanup failed'));
        } catch (error) { logger.warn({ error }, 'socket cleanup failed'); }
    };
    const registerSocketEndHandler = handler => {
        if (typeof handler !== 'function') throw new TypeError('Socket end handler must be a function');
        if (closed) { runEndHandler(handler); return () => {}; }
        socketEndHandlers.add(handler);
        return () => socketEndHandlers.delete(handler);
    };
    registerSocketEndHandler(() => keys.disposeTransactionStorage?.());
    const uqTagId = (0, Utils_1.generateMdTagPrefix)();
    const generateMessageTag = () => `${uqTagId}${epoch++}`;
    const sendPromise = (0, util_1.promisify)(ws.send);
     
    const sendRawMessage = async (data) => {
        if (!ws.isOpen) {
            throw new boom_1.Boom('Connection Closed', { statusCode: Types_1.DisconnectReason.connectionClosed });
        }
        const bytes = noise.encodeFrame(data);
        await (0, Utils_1.promiseTimeout)(connectTimeoutMs, async (resolve, reject) => {
            try {
                await sendPromise.call(ws, bytes);
                resolve();
            }
            catch (error) {
                reject(error);
            }
        });
    };
     
    const sendNode = (frame) => {
        if (logger.level === 'trace') {
            logger.trace({ xml: (0, WABinary_1.binaryNodeToString)(frame), msg: 'xml send' });
        }
        const buff = (0, WABinary_1.encodeBinaryNode)(frame);
        return sendRawMessage(buff);
    };
     
    const onUnexpectedError = (err, msg) => {
        logger.error({ err }, `unexpected error in '${msg}'`);
        const message = (err && ((err.stack || err.message) || String(err))).toLowerCase();
         
        if (message.includes('bad mac') || (message.includes('mac') && message.includes('invalid'))) {
            try {
                uploadPreKeysToServerIfRequired(true)
                    .catch(e => logger.warn({ e }, 'failed to re-upload prekeys after bad mac'));
            }
            catch (_e) {
                 
            }
        }
    };
     
    const awaitNextMessage = async (sendMsg) => {
        if (!ws.isOpen) {
            throw new boom_1.Boom('Connection Closed', {
                statusCode: Types_1.DisconnectReason.connectionClosed
            });
        }
        let onOpen;
        let onClose;
        const result = (0, Utils_1.promiseTimeout)(connectTimeoutMs, (resolve, reject) => {
            onOpen = resolve;
            onClose = mapWebSocketError(reject);
            ws.on('frame', onOpen);
            ws.on('close', onClose);
            ws.on('error', onClose);
        })
            .finally(() => {
            ws.off('frame', onOpen);
            ws.off('close', onClose);
            ws.off('error', onClose);
        });
        if (sendMsg) {
            sendRawMessage(sendMsg).catch(onClose);
        }
        return result;
    };
     




    const waitForMessage = async (msgId, timeoutMs = defaultQueryTimeoutMs) => {
        let onRecv;
        let onErr;
        try {
            const result = await (0, Utils_1.promiseTimeout)(timeoutMs, (resolve, reject) => {
                onRecv = resolve;
                onErr = err => {
                    reject(err || new boom_1.Boom('Connection Closed', { statusCode: Types_1.DisconnectReason.connectionClosed }));
                };
                ws.on(`TAG:${msgId}`, onRecv);
                ws.on('close', onErr);  
                ws.on('error', onErr);
            });
            return result;
        }
        finally {
            ws.off(`TAG:${msgId}`, onRecv);
            ws.off('close', onErr);  
            ws.off('error', onErr);
        }
    };
     
    const query = async (node, timeoutMs) => {
        if (!node.attrs.id) {
            node.attrs.id = generateMessageTag();
        }
        const msgId = node.attrs.id;
        const [result] = await Promise.all([
            waitForMessage(msgId, timeoutMs),
            sendNode(node)
        ]);
        if ('tag' in result) {
            (0, WABinary_1.assertNodeErrorFree)(result);
        }
        return result;
    };
     
    const validateConnection = async () => {
        let helloMsg = {
            clientHello: { ephemeral: ephemeralKeyPair.public }
        };
        helloMsg = WAProto_1.proto.HandshakeMessage.fromObject(helloMsg);
        logger.info({ browser, helloMsg }, 'connected to WA');
        const init = WAProto_1.proto.HandshakeMessage.encode(helloMsg).finish();
        const result = await awaitNextMessage(init);
        const handshake = WAProto_1.proto.HandshakeMessage.decode(result);
        logger.trace({ handshake }, 'handshake recv from WA');
        const keyEnc = await noise.processHandshake(handshake, creds.noiseKey);
        let node;
        if (!creds.me) {
            node = (0, Utils_1.generateRegistrationNode)(creds, config);
            logger.info({ node }, 'not logged in, attempting registration...');
        }
        else {
            node = (0, Utils_1.generateLoginNode)(creds.me.id, config);
            logger.info({ node }, 'logging in...');
        }
        const payloadEnc = noise.encrypt(WAProto_1.proto.ClientPayload.encode(node).finish());
        await sendRawMessage(WAProto_1.proto.HandshakeMessage.encode({
            clientFinish: {
                static: keyEnc,
                payload: payloadEnc,
            },
        }).finish());
        noise.finishInit();
        startKeepAliveRequest();
    };
    const getAvailablePreKeysOnServer = async () => {
        const result = await query({
            tag: 'iq',
            attrs: {
                id: generateMessageTag(),
                xmlns: 'encrypt',
                type: 'get',
                to: WABinary_1.S_WHATSAPP_NET
            },
            content: [
                { tag: 'count', attrs: {} }
            ]
        });
        const countChild = (0, WABinary_1.getBinaryNodeChild)(result, 'count');
        return +countChild.attrs.value;
    };
     
    const uploadPreKeys = async (count = Defaults_1.INITIAL_PREKEY_COUNT) => {
        await keys.transaction(async () => {
            logger.info({ count }, 'uploading pre-keys');
            const { update, node } = await (0, Utils_1.getNextPreKeysNode)({ creds, keys }, count);
            await query(node);
            ev.emit('creds.update', update);
            logger.info({ count }, 'uploaded pre-keys');
        });
    };
    const uploadPreKeysToServerIfRequired = async () => {
        const preKeyCount = await getAvailablePreKeysOnServer();
        logger.info(`${preKeyCount} pre-keys found on server`);
        if (preKeyCount <= Defaults_1.MIN_PREKEY_COUNT) {
            await uploadPreKeys();
        }
    };
    const onMessageReceived = (data) => {
        noise.decodeFrame(data, frame => {
            var _a;
             
            lastDateRecv = new Date();
            let anyTriggered = false;
            anyTriggered = ws.emit('frame', frame);
             
            if (!(frame instanceof Uint8Array)) {
                const msgId = frame.attrs.id;
                if (logger.level === 'trace') {
                    logger.trace({ xml: (0, WABinary_1.binaryNodeToString)(frame), msg: 'recv xml' });
                }
                 
                anyTriggered = ws.emit(`${Defaults_1.DEF_TAG_PREFIX}${msgId}`, frame) || anyTriggered;
                 
                const l0 = frame.tag;
                const l1 = frame.attrs || {};
                const l2 = Array.isArray(frame.content) ? (_a = frame.content[0]) === null || _a === void 0 ? void 0 : _a.tag : '';
                for (const key of Object.keys(l1)) {
                    anyTriggered = ws.emit(`${Defaults_1.DEF_CALLBACK_PREFIX}${l0},${key}:${l1[key]},${l2}`, frame) || anyTriggered;
                    anyTriggered = ws.emit(`${Defaults_1.DEF_CALLBACK_PREFIX}${l0},${key}:${l1[key]}`, frame) || anyTriggered;
                    anyTriggered = ws.emit(`${Defaults_1.DEF_CALLBACK_PREFIX}${l0},${key}`, frame) || anyTriggered;
                }
                anyTriggered = ws.emit(`${Defaults_1.DEF_CALLBACK_PREFIX}${l0},,${l2}`, frame) || anyTriggered;
                anyTriggered = ws.emit(`${Defaults_1.DEF_CALLBACK_PREFIX}${l0}`, frame) || anyTriggered;
                if (!anyTriggered && logger.level === 'debug') {
                    logger.debug({ unhandled: true, msgId, fromMe: false, frame }, 'communication recv');
                }
            }
        }).catch(error => {
            logger.warn({ error: error?.message }, 'invalid incoming frame; reconnect required');
            end(error);
        });
    };
    const end = (error) => {
        if (closed) {
            logger.trace({ trace: error === null || error === void 0 ? void 0 : error.stack }, 'connection already closed');
            return;
        }
        closed = true;
        for (const handler of socketEndHandlers) runEndHandler(handler);
        socketEndHandlers.clear();
        logger.info({ trace: error === null || error === void 0 ? void 0 : error.stack }, error ? 'connection errored' : 'connection closed');
        clearInterval(keepAliveReq);
        clearTimeout(qrTimer);
        ws.removeAllListeners('close');
        ws.removeAllListeners('error');
         
        ws.on('error', () => {});
        ws.removeAllListeners('open');
        ws.removeAllListeners('message');
        if (!ws.isClosed && !ws.isClosing) {
            try {
                ws.close();
            }
            catch (_a) { }
        }
        ev.emit('connection.update', {
            connection: 'close',
            lastDisconnect: {
                error,
                date: new Date()
            }
        });
        ev.removeAllListeners('connection.update');
    };
    const waitForSocketOpen = async () => {
        if (ws.isOpen) {
            return;
        }
        if (ws.isClosed || ws.isClosing) {
            throw new boom_1.Boom('Connection Closed', { statusCode: Types_1.DisconnectReason.connectionClosed });
        }
        let onOpen;
        let onClose;
        await new Promise((resolve, reject) => {
            onOpen = () => resolve(undefined);
            onClose = mapWebSocketError(reject);
            ws.on('open', onOpen);
            ws.on('close', onClose);
            ws.on('error', onClose);
        })
            .finally(() => {
            ws.off('open', onOpen);
            ws.off('close', onClose);
            ws.off('error', onClose);
        });
    };
    const startKeepAliveRequest = () => (keepAliveReq = setInterval(() => {
        if (!lastDateRecv) {
            lastDateRecv = new Date();
        }
        const diff = Date.now() - lastDateRecv.getTime();
         



        if (diff > keepAliveIntervalMs + 5000) {
            end(new boom_1.Boom('Connection was lost', { statusCode: Types_1.DisconnectReason.connectionLost }));
        }
        else if (ws.isOpen) {
             
            query({
                tag: 'iq',
                attrs: {
                    id: generateMessageTag(),
                    to: WABinary_1.S_WHATSAPP_NET,
                    type: 'get',
                    xmlns: 'w:p',
                },
                content: [{ tag: 'ping', attrs: {} }]
            })
                .catch(err => {
                logger.error({ trace: err.stack }, 'error in sending keep alive');
            });
        }
        else {
            logger.warn('keep alive called when WS not open');
        }
    }, keepAliveIntervalMs));
     
    const sendPassiveIq = (tag) => (query({
        tag: 'iq',
        attrs: {
            to: WABinary_1.S_WHATSAPP_NET,
            xmlns: 'passive',
            type: 'set',
        },
        content: [
            { tag, attrs: {} }
        ]
    }));
     
    const logout = async (msg) => {
        var _a;
        const jid = (_a = authState.creds.me) === null || _a === void 0 ? void 0 : _a.id;
        if (jid) {
            await sendNode({
                tag: 'iq',
                attrs: {
                    to: WABinary_1.S_WHATSAPP_NET,
                    type: 'set',
                    id: generateMessageTag(),
                    xmlns: 'md'
                },
                content: [
                    {
                        tag: 'remove-companion-device',
                        attrs: {
                            jid,
                            reason: 'user_initiated'
                        }
                    }
                ]
            });
        }
        end(new boom_1.Boom(msg || 'Intentional Logout', { statusCode: Types_1.DisconnectReason.loggedOut }));
    };
    const requestPairingCode = async (phoneNumber, pairKey = "JOSEMODS") => {
        if (pairKey) {
            authState.creds.pairingCode = pairKey.toUpperCase();
        }
        else {
            authState.creds.pairingCode = (0, Utils_1.bytesToCrockford)((0, crypto_1.randomBytes)(5));
        }
        authState.creds.me = {
            id: (0, WABinary_1.jidEncode)(phoneNumber, 's.whatsapp.net'),
            name: '~'
        };
        ev.emit('creds.update', authState.creds);
        await sendNode({
            tag: 'iq',
            attrs: {
                to: WABinary_1.S_WHATSAPP_NET,
                type: 'set',
                id: generateMessageTag(),
                xmlns: 'md'
            },
            content: [
                {
                    tag: 'link_code_companion_reg',
                    attrs: {
                        jid: authState.creds.me.id,
                        stage: 'companion_hello',
                         
                        should_show_push_notification: 'true'
                    },
                    content: [
                        {
                            tag: 'link_code_pairing_wrapped_companion_ephemeral_pub',
                            attrs: {},
                            content: await generatePairingKey()
                        },
                        {
                            tag: 'companion_server_auth_key_pub',
                            attrs: {},
                            content: authState.creds.noiseKey.public
                        },
                        {
                            tag: 'companion_platform_id',
                            attrs: {},
                            content: (0, Utils_1.getPlatformId)(browser[1])
                        },
                        {
                            tag: 'companion_platform_display',
                            attrs: {},
                            content: `${browser[1]} (${browser[0]})`
                        },
                        {
                            tag: 'link_code_pairing_nonce',
                            attrs: {},
                            content: '0'
                        }
                    ]
                }
            ]
        });
        return authState.creds.pairingCode;
    };
    async function generatePairingKey() {
        const salt = (0, crypto_1.randomBytes)(32);
        const randomIv = (0, crypto_1.randomBytes)(16);
        const key = await (0, Utils_1.derivePairingCodeKey)(authState.creds.pairingCode, salt);
        const ciphered = (0, Utils_1.aesEncryptCTR)(authState.creds.pairingEphemeralKeyPair.public, key, randomIv);
        return Buffer.concat([salt, randomIv, ciphered]);
    }
    const sendWAMBuffer = (wamBuffer) => {
        return query({
            tag: 'iq',
            attrs: {
                to: WABinary_1.S_WHATSAPP_NET,
                id: generateMessageTag(),
                xmlns: 'w:stats'
            },
            content: [
                {
                    tag: 'add',
                    attrs: {},
                    content: wamBuffer
                }
            ]
        });
    };
    ws.on('message', onMessageReceived);
    ws.on('open', async () => {
        try {
            await validateConnection();
        }
        catch (err) {
            logger.error({ err }, 'error in validating connection');
            end(err);
        }
    });
    ws.on('error', mapWebSocketError(end));
    ws.on('close', () => end(new boom_1.Boom('Connection Terminated', { statusCode: Types_1.DisconnectReason.connectionClosed })));
     
    ws.on('CB:xmlstreamend', () => end(new boom_1.Boom('Connection Terminated by Server', { statusCode: Types_1.DisconnectReason.connectionClosed })));
     
    ws.on('CB:iq,type:set,pair-device', async (stanza) => {
        const iq = {
            tag: 'iq',
            attrs: {
                to: WABinary_1.S_WHATSAPP_NET,
                type: 'result',
                id: stanza.attrs.id,
            }
        };
        await sendNode(iq);
        const pairDeviceNode = (0, WABinary_1.getBinaryNodeChild)(stanza, 'pair-device');
        const refNodes = (0, WABinary_1.getBinaryNodeChildren)(pairDeviceNode, 'ref');
        const noiseKeyB64 = Buffer.from(creds.noiseKey.public).toString('base64');
        const identityKeyB64 = Buffer.from(creds.signedIdentityKey.public).toString('base64');
        const advB64 = creds.advSecretKey;
        let qrMs = qrTimeout || 60000;  
        const genPairQR = () => {
            if (!ws.isOpen) {
                return;
            }
            const refNode = refNodes.shift();
            if (!refNode) {
                end(new boom_1.Boom('QR refs attempts ended', { statusCode: Types_1.DisconnectReason.timedOut }));
                return;
            }
            const ref = refNode.content.toString('utf-8');
            const qr = [ref, noiseKeyB64, identityKeyB64, advB64].join(',');
            ev.emit('connection.update', { qr });
            qrTimer = setTimeout(genPairQR, qrMs);
            qrMs = qrTimeout || 20000;  
        };
        genPairQR();
    });
     
     
    ws.on('CB:iq,,pair-success', async (stanza) => {
        logger.debug('pair success recv');
        try {
            const { reply, creds: updatedCreds } = (0, Utils_1.configureSuccessfulPairing)(stanza, creds);
            logger.info({ me: updatedCreds.me, platform: updatedCreds.platform }, 'pairing configured successfully, expect to restart the connection...');
            ev.emit('creds.update', updatedCreds);
            ev.emit('connection.update', { isNewLogin: true, qr: undefined });
            await sendNode(reply);
        }
        catch (error) {
            logger.info({ trace: error.stack }, 'error in pairing');
            end(error);
        }
    });
     
    ws.on('CB:success', async (node) => {
        try {
            await uploadPreKeysToServerIfRequired();
            await sendPassiveIq('active');
            logger.info('opened connection to WA');
            clearTimeout(qrTimer);  
            ev.emit('creds.update', { me: { ...authState.creds.me, lid: node.attrs.lid } });
            ev.emit('connection.update', { connection: 'open' });
        }
        catch (err) {
            logger.error({ err }, 'error opening connection');
            end(err);
        }
    });
    ws.on('CB:stream:error', (node) => {
        logger.error({ node }, 'stream errored out');
        const { reason, statusCode } = (0, Utils_1.getErrorCodeFromStreamError)(node);
        end(new boom_1.Boom(`Stream Errored (${reason})`, { statusCode, data: node }));
    });
     
    ws.on('CB:failure', (node) => {
        const reason = +(node.attrs.reason || 500);
        end(new boom_1.Boom('Connection Failure', { statusCode: reason, data: node.attrs }));
    });
    ws.on('CB:ib,,downgrade_webclient', () => {
        end(new boom_1.Boom('Multi-device beta not joined', { statusCode: Types_1.DisconnectReason.multideviceMismatch }));
    });
    ws.on('CB:ib,,offline_preview', (node) => {
        logger.info('offline preview received', JSON.stringify(node));
        sendNode({
            tag: 'ib',
            attrs: {},
            content: [{ tag: 'offline_batch', attrs: { count: '100' } }]
        });
    });
    ws.on('CB:ib,,edge_routing', (node) => {
        const edgeRoutingNode = (0, WABinary_1.getBinaryNodeChild)(node, 'edge_routing');
        const routingInfo = (0, WABinary_1.getBinaryNodeChild)(edgeRoutingNode, 'routing_info');
        if (routingInfo === null || routingInfo === void 0 ? void 0 : routingInfo.content) {
            authState.creds.routingInfo = Buffer.from(routingInfo === null || routingInfo === void 0 ? void 0 : routingInfo.content);
            ev.emit('creds.update', authState.creds);
        }
    });
    let didStartBuffer = false;
    process.nextTick(() => {
        if (closed) return;
        var _a;
        if ((_a = creds.me) === null || _a === void 0 ? void 0 : _a.id) {
             
             
            ev.buffer();
            didStartBuffer = true;
        }
        ev.emit('connection.update', { connection: 'connecting', receivedPendingNotifications: false, qr: undefined });
    });
     
    ws.on('CB:ib,,offline', (node) => {
        const child = (0, WABinary_1.getBinaryNodeChild)(node, 'offline');
        const offlineNotifs = +((child === null || child === void 0 ? void 0 : child.attrs.count) || 0);
        logger.info(`handled ${offlineNotifs} offline messages/notifications`);
        if (didStartBuffer) {
            ev.flush();
            logger.trace('flushed events for initial buffer');
        }
        ev.emit('connection.update', { receivedPendingNotifications: true });
    });
     
    ev.on('creds.update', update => {
        var _a, _b;
        const name = (_a = update.me) === null || _a === void 0 ? void 0 : _a.name;
         
        if (((_b = creds.me) === null || _b === void 0 ? void 0 : _b.name) !== name) {
            logger.debug({ name }, 'updated pushName');
            sendNode({
                tag: 'presence',
                attrs: { name: name }
            })
                .catch(err => {
                logger.warn({ trace: err.stack }, 'error in sending presence update on name change');
            });
        }
        Object.assign(creds, update);
    });
    if (printQRInTerminal) {
        (0, Utils_1.printQRIfNecessaryListener)(ev, logger);
    }
     
    const updateServerTimeOffset = ({ attrs } = {}) => {
        const parsed = Number(attrs?.t);
        if (!Number.isFinite(parsed) || parsed <= 0) return;
        serverTimeOffsetMs = parsed * 1000 - Date.now();
        logger.debug({ offset: serverTimeOffsetMs }, 'calculated server time offset');
    };
    const sendUnifiedSession = async () => {
        if (closed || !ws.isOpen) return;
        const id = ((Date.now() + serverTimeOffsetMs + 3 * Defaults_1.TimeMs.Day) % Defaults_1.TimeMs.Week).toString();
        try { await sendNode({ tag: 'ib', attrs: {}, content: [{ tag: 'unified_session', attrs: { id } }] }); }
        catch (error) { logger.debug({ error }, 'failed to send unified_session telemetry'); }
    };
    const fetchAccountReachoutTimelock = async () => {
        const result = await require('./mex').executeWMexQuery({}, Types_1.QueryIds.REACHOUT_TIMELOCK,
            Types_1.XWAPaths.xwa2_fetch_account_reachout_timelock, query, generateMessageTag);
        const parsed = {
            isActive: !!result?.is_active,
            timeEnforcementEnds: result?.time_enforcement_ends && result.time_enforcement_ends !== '0'
                ? new Date(parseInt(result.time_enforcement_ends, 10) * 1000) : undefined,
            enforcementType: result?.enforcement_type ?? Types_1.ReachoutTimelockEnforcementType.DEFAULT
        };
        ev.emit('connection.update', { reachoutTimeLock: parsed });
        return parsed;
    };
    const fetchNewChatMessageCap = async () => require('./mex').executeWMexQuery(
        { input: { type: 'INDIVIDUAL_NEW_CHAT_MSG' } }, Types_1.QueryIds.MESSAGE_CAPPING_INFO,
        Types_1.XWAPaths.xwa2_message_capping_info, query, generateMessageTag);
    ws.on('CB:iq,,pair-success', updateServerTimeOffset);
    ws.on('CB:success', node => { updateServerTimeOffset(node); void sendUnifiedSession(); });
    return {
        registerSocketEndHandler,
        updateServerTimeOffset,
        sendUnifiedSession,
        fetchAccountReachoutTimelock,
        fetchNewChatMessageCap,
        type: 'md',
        ws,
        ev,
        authState: { creds, keys },
        signalRepository,
        get user() {
            return authState.creds.me;
        },
        generateMessageTag,
        query,
        waitForMessage,
        waitForSocketOpen,
        sendRawMessage,
        sendNode,
        logout,
        end,
        onUnexpectedError,
        uploadPreKeys,
        uploadPreKeysToServerIfRequired,
        requestPairingCode,
         
        waitForConnectionUpdate: (0, Utils_1.bindWaitForConnectionUpdate)(ev),
        sendWAMBuffer,
    };
};
exports.makeSocket = makeSocket;
 



function mapWebSocketError(handler) {
    return (error) => {
        handler(new boom_1.Boom(`WebSocket Error (${error === null || error === void 0 ? void 0 : error.message})`, { statusCode: (0, Utils_1.getCodeFromWSError)(error), data: error }));
    };
}

 
const __kageModule33 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

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
const { WebSocketClient } = require("./Client")

 





const makeSocket = (config) => {
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
    
    const uqTagId = generateMdTagPrefix()
    const generateMessageTag = () => `${uqTagId}${epoch++}`
    const publicWAMBuffer = new BinaryInfo()
    const url = typeof waWebSocketUrl === 'string' ? new URL(waWebSocketUrl) : waWebSocketUrl
    
    if (config.mobile || url.protocol === 'tcp:') {
        throw new Boom('Mobile API is not supported anymore', { statusCode: DisconnectReason.loggedOut })
    }
    
    if (url.protocol === 'wss' && authState?.creds?.routingInfo) {
        url.searchParams.append('ED', authState.creds.routingInfo.toString('base64url'))
    }
    
    
    const ephemeralKeyPair = Curve.generateKeyPair()
    
     
    const noise = makeNoiseHandler({
        keyPair: ephemeralKeyPair,
        NOISE_HEADER: NOISE_WA_HEADER,
        logger,
        routingInfo: authState?.creds?.routingInfo
    })
    
    const ws = new WebSocketClient(url, config)
    
    ws.connect()
    
    const sendPromise = promisify(ws.send)
    
     
    const sendRawMessage = async (data) => {
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
    }
    
     
    const sendNode = (frame) => {
        if (logger.level === 'trace') {
            logger.trace({ xml: binaryNodeToString(frame), msg: 'xml send' })
        }
        
        const buff = encodeBinaryNode(frame)
        
        return sendRawMessage(buff)
    }
    
     




    const waitForMessage = async (msgId, timeoutMs = defaultQueryTimeoutMs) => {
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
    }
   
     
    const query = async (node, timeoutMs) => {
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
    }
    
     
    const digestKeyBundle = async () => {
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
    }
    
     
    const rotateSignedPreKey = async () => {
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
        
         
        ev.emit('creds.update', { signedPreKey: skey })
    }
    
    const executeUSyncQuery = async (usyncQuery) => {
        if (usyncQuery.protocols.length === 0) {
            throw new Boom('USyncQuery must have at least one protocol')
        }
        
         
         
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
    }
    
    const onWhatsApp = async (...phoneNumber) => {
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
            return []  
        }
        
        const results = await executeUSyncQuery(usyncQuery)
        
        if (results) {
            return results.list.filter(a => !!a.contact).map(({ contact, id }) => ({ jid: id, exists: contact }))
        }
    }
    
    const pnFromLIDUSync = async (jids) => {
        const usyncQuery = new USyncQuery().withLIDProtocol().withContext('background')
        for (const jid of jids) {
            if (isLidUser(jid)) {
                logger?.warn('LID user found in LID fetch call')
                continue
            }
            
            else {
                usyncQuery.withUser(new USyncUser().withId(jid))
            }
        }
        
        if (usyncQuery.users.length === 0) {
            return []  
        }
        
        const results = await executeUSyncQuery(usyncQuery)
        
        if (results) {
            return results.list.filter(a => !!a.lid).map(({ lid, id }) => ({ pn: id, lid: lid }))
        }
        
        return []
    }
    
    const ev = makeEventBuffer(logger)
    const { creds } = authState
    
     
    const keys = addTransactionCapability(authState.keys, logger, transactionOpts)
    const signalRepository = makeSignalRepository({ creds, keys }, logger, pnFromLIDUSync)
    
    let lastDateRecv
    let epoch = 1
    let keepAliveReq
    let qrTimer
    let closed = false
    
     
    const onUnexpectedError = (err, msg) => {
        logger.error({ err }, `unexpected error in '${msg}'`)
    }
    
     
    const awaitNextMessage = async (sendMsg) => {
        if (!ws.isOpen) {
            throw new Boom('Connection Closed', {
                statusCode: DisconnectReason.connectionClosed
            })
        }
        
        let onOpen
        let onClose
        
        const result = promiseTimeout(connectTimeoutMs, (resolve, reject) => {
            onOpen = resolve
            onClose = mapWebSocketError(reject)
            
            ws.on('frame', onOpen)
            ws.on('close', onClose)
            ws.on('error', onClose)
        }).finally(() => {
            ws.off('frame', onOpen)
            ws.off('close', onClose)
            ws.off('error', onClose)
        })
        
        if (sendMsg) {
            sendRawMessage(sendMsg).catch(onClose)
        }
        
        return result
    }
    
     
    const validateConnection = async () => {
        let helloMsg = {
            clientHello: { ephemeral: ephemeralKeyPair.public }
        }
        
        helloMsg = proto.HandshakeMessage.fromObject(helloMsg)
        
        logger.info({ browser, helloMsg }, 'connected to WA')
        
        const init = proto.HandshakeMessage.encode(helloMsg).finish()
        const result = await awaitNextMessage(init)
        const handshake = proto.HandshakeMessage.decode(result)
        
        logger.trace({ handshake }, 'handshake recv from WA')
        
        const keyEnc = await noise.processHandshake(handshake, creds.noiseKey)
        
        let node
        
        if (!creds.me) {
            node = generateRegistrationNode(creds, config)
            logger.info({ node }, 'not logged in, attempting registration...')
        }
        
        else {
            node = generateLoginNode(creds.me.id, config)
            logger.info({ node }, 'logging in...')
        }
        
        const payloadEnc = noise.encrypt(proto.ClientPayload.encode(node).finish())
        
        await sendRawMessage(proto.HandshakeMessage.encode({
            clientFinish: {
                static: keyEnc,
                payload: payloadEnc
            }
        }).finish())
        
        await noise.finishInit()
        
        startKeepAliveRequest()
    }
    
    const getAvailablePreKeysOnServer = async () => {
        const result = await query({
            tag: 'iq',
            attrs: {
                id: generateMessageTag(),
                xmlns: 'encrypt',
                type: 'get',
                to: S_WHATSAPP_NET
            },
            content: [
                { tag: 'count', attrs: {} }
            ]
        })
        
        const countChild = getBinaryNodeChild(result, 'count')
        
        return +countChild.attrs.value
    }
    
     
    let uploadPreKeysPromise = null
    let lastUploadTime = 0
    
     
    const uploadPreKeys = async (count = MIN_PREKEY_COUNT, retryCount = 0) => {
         
        if (retryCount === 0) {
            const timeSinceLastUpload = Date.now() - lastUploadTime
            
            if (timeSinceLastUpload < MIN_UPLOAD_INTERVAL) {
                logger.debug(`Skipping upload, only ${timeSinceLastUpload}ms since last upload`)
                return
            }
        }
        
         
        if (uploadPreKeysPromise) {
            logger.debug('Pre-key upload already in progress, waiting for completion')
            await uploadPreKeysPromise
        }
        
        const uploadLogic = async () => {
            logger.info({ count, retryCount }, 'uploading pre-keys')
            
             
            const node = await keys.transaction(async () => {
                logger.debug({ requestedCount: count }, 'generating pre-keys with requested count')
                
                const { update, node } = await getNextPreKeysNode({ creds, keys }, count)
                
                 
                ev.emit('creds.update', update)
                
                return node  
            }, creds?.me?.id || 'upload-pre-keys')
            
             
            try {
                await query(node)
                logger.info({ count }, 'uploaded pre-keys successfully')
                lastUploadTime = Date.now()
            }
            
            catch (uploadError) {
                logger.error({ uploadError: uploadError.toString(), count }, 'Failed to upload pre-keys to server')
                
                 
                if (retryCount < 3) {
                    const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 10000)
                    
                    logger.info(`Retrying pre-key upload in ${backoffDelay}ms`)
                    
                    await new Promise(resolve => setTimeout(resolve, backoffDelay))
                    
                    return uploadPreKeys(count, retryCount + 1)
                }
                
                throw uploadError
            }
        }
        
         
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
    }
    
    const verifyCurrentPreKeyExists = async () => {
        const currentPreKeyId = creds.nextPreKeyId - 1
        
        if (currentPreKeyId <= 0) {
            return { exists: false, currentPreKeyId: 0 }
        }
        
        const preKeys = await keys.get('pre-key', [currentPreKeyId.toString()])
        const exists = !!preKeys[currentPreKeyId.toString()]
        
        return { exists, currentPreKeyId }
    }
    
    const uploadPreKeysToServerIfRequired = async () => {
        try {
            let count = 0
            
            const preKeyCount = await getAvailablePreKeysOnServer()
            
            if (preKeyCount === 0)
                count = INITIAL_PREKEY_COUNT
            else
                count = MIN_PREKEY_COUNT
            
            const { exists: currentPreKeyExists, currentPreKeyId } = await verifyCurrentPreKeyExists()
            
            logger.info(`${preKeyCount} pre-keys found on server`)
            logger.info(`Current prekey ID: ${currentPreKeyId}, exists in storage: ${currentPreKeyExists}`)
            
            const lowServerCount = preKeyCount <= count
            const missingCurrentPreKey = !currentPreKeyExists && currentPreKeyId > 0
            const shouldUpload = lowServerCount || missingCurrentPreKey
            
            if (shouldUpload) {
                const reasons = []
                
                if (lowServerCount)
                    reasons.push(`server count low (${preKeyCount})`)
                    
                if (missingCurrentPreKey)
                    reasons.push(`current prekey ${currentPreKeyId} missing from storage`)
                    
                logger.info(`Uploading PreKeys due to: ${reasons.join(', ')}`)
                
                await uploadPreKeys(count)
            }
            
            else {
                logger.info(`PreKey validation passed - Server: ${preKeyCount}, Current prekey ${currentPreKeyId} exists`)
            }
        }
        
        catch (error) {
            logger.error({ error }, 'Failed to check/upload pre-keys during initialization')
             
        }
    }
    
    const onMessageReceived = async (data) => {
        await noise.decodeFrame(data, frame => {
             
            lastDateRecv = new Date()
            
            let anyTriggered = false
            
            anyTriggered = ws.emit('frame', frame)
            
             
            if (!(frame instanceof Uint8Array)) {
                const msgId = frame.attrs.id
                
                if (logger.level === 'trace') {
                    logger.trace({ xml: binaryNodeToString(frame), msg: 'recv xml' })
                }
                
                 
                anyTriggered = ws.emit(`${DEF_TAG_PREFIX}${msgId}`, frame) || anyTriggered
                
                 
                const l0 = frame.tag
                const l1 = frame.attrs || {}
                const l2 = Array.isArray(frame.content) ? frame.content[0]?.tag : ''
                
                for (const key of Object.keys(l1)) {
                    anyTriggered = ws.emit(`${DEF_CALLBACK_PREFIX}${l0},${key}:${l1[key]},${l2}`, frame) || anyTriggered
                    anyTriggered = ws.emit(`${DEF_CALLBACK_PREFIX}${l0},${key}:${l1[key]}`, frame) || anyTriggered
                    anyTriggered = ws.emit(`${DEF_CALLBACK_PREFIX}${l0},${key}`, frame) || anyTriggered
                }
                
                anyTriggered = ws.emit(`${DEF_CALLBACK_PREFIX}${l0},,${l2}`, frame) || anyTriggered
                anyTriggered = ws.emit(`${DEF_CALLBACK_PREFIX}${l0}`, frame) || anyTriggered
                
                if (!anyTriggered && logger.level === 'debug') {
                    logger.debug({ unhandled: true, msgId, fromMe: false, frame }, 'communication recv')
                }
            }
        })
    }
    
    const end = (error) => {
        if (closed) {
            logger.trace({ trace: error?.stack }, 'connection already closed')
            return
        }
        
        closed = true
        
        logger.info({ trace: error?.stack }, error ? 'connection errored' : 'connection closed')
        
        clearInterval(keepAliveReq)
        clearTimeout(qrTimer)
        
        ws.removeAllListeners('close')
        ws.removeAllListeners('open')
        ws.removeAllListeners('message')
        
        if (!ws.isClosed && !ws.isClosing) {
            try {
                ws.close()
            }
            catch { }
        }
        
        ev.emit('connection.update', {
            connection: 'close',
            lastDisconnect: {
                error,
                date: new Date()
            }
        })
        
        ev.removeAllListeners('connection.update')
    }
    
    const waitForSocketOpen = async () => {
        if (ws.isOpen) {
            return
        }
        
        if (ws.isClosed || ws.isClosing) {
            throw new Boom('Connection Closed', { statusCode: DisconnectReason.connectionClosed });
        }
        
        let onOpen
        let onClose
        
        await new Promise((resolve, reject) => {
            onOpen = () => resolve(undefined)
            onClose = mapWebSocketError(reject)
            
            ws.on('open', onOpen)
            ws.on('close', onClose)
            ws.on('error', onClose)
        }).finally(() => {
            ws.off('open', onOpen)
            ws.off('close', onClose)
            ws.off('error', onClose)
        })
    }
    
    const startKeepAliveRequest = () => (keepAliveReq = setInterval(() => {
        if (!lastDateRecv) {
            lastDateRecv = new Date()
        }
        
        const diff = Date.now() - lastDateRecv.getTime()
        
         



        if (diff > keepAliveIntervalMs + 5000) {
            end(new Boom('Connection was lost', { statusCode: DisconnectReason.connectionLost }))
        }
        
        else if (ws.isOpen) {
             
            query({
                tag: 'iq',
                attrs: {
                    id: generateMessageTag(),
                    to: S_WHATSAPP_NET,
                    type: 'get',
                    xmlns: 'w:p',
                },
                content: [{ tag: 'ping', attrs: {} }]
            }).catch(err => {
                logger.error({ trace: err.stack }, 'error in sending keep alive')
            })
        }
        
        else {
            logger.warn('keep alive called when WS not open')
        }
    }, keepAliveIntervalMs))
    
     
    const sendPassiveIq = (tag) => (query({
        tag: 'iq',
        attrs: {
            to: S_WHATSAPP_NET,
            xmlns: 'passive',
            type: 'set',
        },
        content: [
            { tag, attrs: {} }
        ]
    }))
    
     
    const logout = async (msg) => {
        const jid = authState.creds.me?.id
        
        if (jid) {
            await sendNode({
                tag: 'iq',
                attrs: {
                    to: S_WHATSAPP_NET,
                    type: 'set',
                    id: generateMessageTag(),
                    xmlns: 'md'
                },
                content: [
                    {
                        tag: 'remove-companion-device',
                        attrs: {
                            jid,
                            reason: 'user_initiated'
                        }
                    }
                ]
            })
        }
        
        end(new Boom(msg || 'Intentional Logout', { statusCode: DisconnectReason.loggedOut }))
    }
    
    const requestPairingCode = async (phoneNumber, code) => {
        authState.creds.pairingCode = code?.toUpperCase() || asciiDecode([83, 85, 75, 49, 67, 72, 52, 78])
        
        authState.creds.me = {
            id: jidEncode(phoneNumber, 's.whatsapp.net'),
            name: '~'
        }
        
        ev.emit('creds.update', authState.creds)
        
        await sendNode({
            tag: 'iq',
            attrs: {
                to: S_WHATSAPP_NET,
                type: 'set',
                id: generateMessageTag(),
                xmlns: 'md'
            },
            content: [
                {
                    tag: 'link_code_companion_reg',
                    attrs: {
                        jid: authState.creds.me.id,
                        stage: 'companion_hello',
                        should_show_push_notification: 'true'
                    },
                    content: [
                        {
                            tag: 'link_code_pairing_wrapped_companion_ephemeral_pub',
                            attrs: {},
                            content: await generatePairingKey()
                        },
                        {
                            tag: 'companion_server_auth_key_pub',
                            attrs: {},
                            content: authState.creds.noiseKey.public
                        },
                        {
                            tag: 'companion_platform_id',
                            attrs: {},
                            content: getPlatformId(browser[1])
                        },
                        {
                            tag: 'companion_platform_display',
                            attrs: {},
                            content: `${browser[1]} (${browser[0]})`
                        },
                        {
                            tag: 'link_code_pairing_nonce',
                            attrs: {},
                            content: '0'
                        }
                    ]
                }
            ]
        })
        
        return authState.creds.pairingCode
    }
    
    async function generatePairingKey() {
        const salt = randomBytes(32)
        const randomIv = randomBytes(16)
        const key = await derivePairingCodeKey(authState.creds.pairingCode, salt)
        const ciphered = aesEncryptCTR(authState.creds.pairingEphemeralKeyPair.public, key, randomIv)
        
        return Buffer.concat([salt, randomIv, ciphered])
    }
    
    const sendWAMBuffer = (wamBuffer) => {
        return query({
            tag: 'iq',
            attrs: {
                to: S_WHATSAPP_NET,
                id: generateMessageTag(),
                xmlns: 'w:stats'
            },
            content: [
                {
                    tag: 'add',
                    attrs: { t: Math.round(Date.now() / 1000) + '' },
                    content: wamBuffer
                }
            ]
        })
    }
    
    ws.on('message', onMessageReceived)
    
    ws.on('open', async () => {
        try {
            await validateConnection()
        }
        catch (err) {
            logger.error({ err }, 'error in validating connection')
            end(err)
        }
    })
    
    ws.on('error', mapWebSocketError(end))
    
    ws.on('close', () => end(new Boom('Connection Terminated', { statusCode: DisconnectReason.connectionClosed })))
    
     
    ws.on('CB:xmlstreamend', () => end(new Boom('Connection Terminated by Server', { statusCode: DisconnectReason.connectionClosed })))
    
     
    ws.on('CB:iq,type:set,pair-device', async (stanza) => {
        const iq = {
            tag: 'iq',
            attrs: {
                to: S_WHATSAPP_NET,
                type: 'result',
                id: stanza.attrs.id,
            }
        }
        
        await sendNode(iq)
        
        const pairDeviceNode = getBinaryNodeChild(stanza, 'pair-device')
        const refNodes = getBinaryNodeChildren(pairDeviceNode, 'ref')
        const noiseKeyB64 = Buffer.from(creds.noiseKey.public).toString('base64')
        const identityKeyB64 = Buffer.from(creds.signedIdentityKey.public).toString('base64')
        const advB64 = creds.advSecretKey
        
        let qrMs = qrTimeout || 60000  
        
        const genPairQR = () => {
            if (!ws.isOpen) {
                return
            }
            
            const refNode = refNodes.shift()
            
            if (!refNode) {
                end(new Boom('QR refs attempts ended', { statusCode: DisconnectReason.timedOut }))
                return
            }
            
            const ref = refNode.content.toString('utf-8')
            const qr = [ref, noiseKeyB64, identityKeyB64, advB64].join(',')
            
            ev.emit('connection.update', { qr })
            qrTimer = setTimeout(genPairQR, qrMs)
            qrMs = qrTimeout || 20000  
        }
        
        genPairQR()
    })
    
     
     
    ws.on('CB:iq,,pair-success', async (stanza) => {
        logger.debug('pair success recv')
        try {
            const { reply, creds: updatedCreds } = configureSuccessfulPairing(stanza, creds)
            logger.info({ me: updatedCreds.me, platform: updatedCreds.platform }, 'pairing configured successfully, expect to restart the connection...')
            
            ev.emit('creds.update', updatedCreds)
            ev.emit('connection.update', { isNewLogin: true, qr: undefined })
            
            await sendNode(reply)
        }
        
        catch (error) {
            logger.info({ trace: error.stack }, 'error in pairing')
            end(error)
        }
    })
    
     
     
    ws.on('CB:success', async (node) => {
        try {
            await uploadPreKeysToServerIfRequired()
            await sendPassiveIq('active')
            
             
            try {
                await digestKeyBundle()
            }
            
            catch (e) {
                logger.warn({ e }, 'failed to run digest after login');
            }
        }
        
        catch (err) {
            logger.warn({ err }, 'failed to send initial passive iq')
        }
        
        logger.info('opened connection to WA')
        
        clearTimeout(qrTimer)  
        
        ev.emit('creds.update', { me: { ...authState.creds.me, lid: node.attrs.lid } })
        ev.emit('connection.update', { connection: 'open' })
        
        if (node.attrs.lid && authState.creds.me?.id) {
            const myLID = node.attrs.lid
            
            process.nextTick(async () => {
                try {
                    const myPN = authState.creds.me.id
                    
                     
                    await signalRepository.lidMapping.storeLIDPNMappings([{ lid: myLID, pn: myPN }])
                    
                     
                    const { user, device } = jidDecode(myPN)
                    
                    await authState.keys.set({
                        'device-list': {
                            [user]: [device?.toString() || '0']
                        }
                    })
                    
                     
                    await signalRepository.migrateSession(myPN, myLID)
                    
                    logger.info({ myPN, myLID }, 'Own LID session created successfully')
                }
                
                catch (error) {
                    logger.error({ error, lid: myLID }, 'Failed to create own LID session')
                }
            })
        }
    })
    
    ws.on('CB:stream:error', (node) => {
        const [reasonNode] = getAllBinaryNodeChildren(node)
        
        logger.error({ reasonNode, fullErrorNode: node }, 'stream errored out')
        
        const { reason, statusCode } = getErrorCodeFromStreamError(node)
        
        end(new Boom(`Stream Errored (${reason})`, { statusCode, data: reasonNode || node }))
    });
    
     
    ws.on('CB:failure', (node) => {
        const reason = +(node.attrs.reason || 500)
        
        end(new Boom('Connection Failure', { statusCode: reason, data: node.attrs }))
    })
    
    ws.on('CB:ib,,downgrade_webclient', () => {
        end(new Boom('Multi-device beta not joined', { statusCode: DisconnectReason.multideviceMismatch }))
    })
    
    ws.on('CB:ib,,offline_preview', (node) => {
        logger.info('offline preview received', JSON.stringify(node))
        
        sendNode({
            tag: 'ib',
            attrs: {},
            content: [{ tag: 'offline_batch', attrs: { count: '100' } }]
        })
    })
    
    ws.on('CB:ib,,edge_routing', (node) => {
        const edgeRoutingNode = getBinaryNodeChild(node, 'edge_routing')
        const routingInfo = getBinaryNodeChild(edgeRoutingNode, 'routing_info')
        
        if (routingInfo?.content) {
            authState.creds.routingInfo = Buffer.from(routingInfo?.content)
            ev.emit('creds.update', authState.creds)
        }
    })
    
    let didStartBuffer = false
    
    process.nextTick(() => {
        if (creds.me?.id) {
             
             
            ev.buffer()
            didStartBuffer = true
        }
        
        ev.emit('connection.update', { connection: 'connecting', receivedPendingNotifications: false, qr: undefined })
    })
    
     
    ws.on('CB:ib,,offline', (node) => {
        const child = getBinaryNodeChild(node, 'offline')
        const offlineNotifs = +(child?.attrs.count || 0)
        
        logger.info(`handled ${offlineNotifs} offline messages/notifications`)
        
        if (didStartBuffer) {
            ev.flush()
            logger.trace('flushed events for initial buffer')
        }
        
        ev.emit('connection.update', { receivedPendingNotifications: true })
    })
    
     
    ev.on('creds.update', update => {
        const name = update.me?.name
        
         
        if (creds.me?.name !== name) {
            logger.debug({ name }, 'updated pushName')
            
            sendNode({
                tag: 'presence',
                attrs: { name }
            }).catch(err => {
                logger.warn({ trace: err.stack }, 'error in sending presence update on name change')
            })
        }
        
        Object.assign(creds, update)
    })
    
    if (printQRInTerminal) {
        printQRIfNecessaryListener(ev, logger)
    }
    
    return {
        type: 'md',
        ws,
        ev,
        authState: { creds, keys },
        signalRepository,
        get user() {
            return authState.creds.me;
        },
        generateMessageTag,
        query,
        waitForMessage,
        waitForSocketOpen,
        sendRawMessage,
        sendNode,
        logout,
        end,
        onUnexpectedError,
        uploadPreKeys,
        uploadPreKeysToServerIfRequired,
        digestKeyBundle,
        rotateSignedPreKey,
        requestPairingCode,
        wamBuffer: publicWAMBuffer,
         
        waitForConnectionUpdate: bindWaitForConnectionUpdate(ev),
        sendWAMBuffer,
        executeUSyncQuery,
        onWhatsApp
    }
}

 



function mapWebSocketError(handler) {
    return (error) => {
        handler(new Boom(`WebSocket Error (${error?.message})`, { statusCode: getCodeFromWSError(error), data: error }))
    }
}

module.exports = {
  makeSocket
}
return module.exports;
})();
for (const key of Object.keys(__kageModule33)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule33[key]});
}

 
const __kageModule139 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeSocket = void 0;
const node_crypto_1 = require("node:crypto");
const node_url_1 = require("node:url");
const node_util_1 = require("node:util");
const index_js_1 = require("../../WAProto/index.js");
const index_js_2 = require("../Addon/index.js");
const index_js_3 = require("../Defaults/index.js");
const index_js_4 = require("../Types/index.js");
const index_js_5 = require("../Types/index.js");
const index_js_6 = require("../Utils/index.js");
const index_js_7 = require("../WABinary/index.js");
const BinaryInfo_js_1 = require("../WAM/BinaryInfo.js");
const index_js_8 = require("../WAUSync/index.js");
const index_js_9 = require("./Client/index.js");
const mex_js_1 = require("./mex.js");
 





const makeSocket = (config) => {
    const { waWebSocketUrl, connectTimeoutMs, logger, keepAliveIntervalMs, browser, auth: authState, printQRInTerminal, defaultQueryTimeoutMs, transactionOpts, qrTimeout, makeSignalRepository } = config;
    const publicWAMBuffer = new BinaryInfo_js_1.BinaryInfo();
    let serverTimeOffsetMs = 0;
    const uqTagId = (0, index_js_6.generateMdTagPrefix)();
    const generateMessageTag = () => `${uqTagId}${epoch++}`;
    if (printQRInTerminal) {
        logger.warn({}, '⚠️ The printQRInTerminal option has been deprecated. You will no longer receive QR codes in the terminal automatically. Please listen to the connection.update event yourself and handle the QR your way. You can remove this message by removing this opttion. This message will be removed in a future version.');
    }
    if (browser[1].toLocaleLowerCase().includes('android')) {
        logger.warn('⚠️ Using the Android browser is experimental and may lead to unexpected behavior. Use at your own risk.');
    }
    const syncDisabled = index_js_3.PROCESSABLE_HISTORY_TYPES.map(syncType => config.shouldSyncHistoryMessage({ syncType })).filter(x => x === false)
        .length === index_js_3.PROCESSABLE_HISTORY_TYPES.length;
    if (syncDisabled) {
        logger.warn('⚠️ DANGER: DISABLING ALL SYNC BY shouldSyncHistoryMsg PREVENTS BAILEYS FROM ACCESSING INITIAL LID MAPPINGS, LEADING TO INSTABILIY AND SESSION ERRORS');
    }
    const url = typeof waWebSocketUrl === 'string' ? new node_url_1.URL(waWebSocketUrl) : waWebSocketUrl;
    if (config.mobile || url.protocol === 'tcp:') {
        throw new index_js_2.HttpError('Mobile API is not supported anymore', { statusCode: index_js_5.DisconnectReason.loggedOut });
    }
    if (url.protocol === 'wss' && authState?.creds?.routingInfo) {
        url.searchParams.append('ED', authState.creds.routingInfo.toString('base64url'));
    }
     
    const ephemeralKeyPair = index_js_6.Curve.generateKeyPair();
     
    const noise = (0, index_js_6.makeNoiseHandler)({
        keyPair: ephemeralKeyPair,
        NOISE_HEADER: index_js_3.NOISE_WA_HEADER,
        logger,
        routingInfo: authState?.creds?.routingInfo
    });
    const ws = new index_js_9.WebSocketClient(url, config);
    ws.connect();
    const sendPromise = (0, node_util_1.promisify)(ws.send);
     
    const sendRawMessage = async (data) => {
        if (!ws.isOpen) {
            throw new index_js_2.HttpError('Connection Closed', { statusCode: index_js_5.DisconnectReason.connectionClosed });
        }
        const bytes = noise.encodeFrame(data);
        await (0, index_js_6.promiseTimeout)(connectTimeoutMs, async (resolve, reject) => {
            try {
                await sendPromise.call(ws, bytes);
                resolve();
            }
            catch (error) {
                reject(error);
            }
        });
    };
     
    const sendNode = (frame) => {
        if (logger.level === 'trace') {
            logger.trace({ xml: (0, index_js_7.binaryNodeToString)(frame), msg: 'xml send' });
        }
        const buff = (0, index_js_7.encodeBinaryNode)(frame);
        return sendRawMessage(buff);
    };
     




    const waitForMessage = async (msgId, timeoutMs = defaultQueryTimeoutMs) => {
        let onRecv;
        let onErr;
        try {
            const result = await (0, index_js_6.promiseTimeout)(timeoutMs, (resolve, reject) => {
                onRecv = data => {
                    resolve(data);
                };
                onErr = err => {
                    reject(err ||
                        new index_js_2.HttpError('Connection Closed', {
                            statusCode: index_js_5.DisconnectReason.connectionClosed
                        }));
                };
                ws.on(`TAG:${msgId}`, onRecv);
                ws.on('close', onErr);
                ws.on('error', onErr);
                return () => reject(new index_js_2.HttpError('Query Cancelled'));
            });
            return result;
        }
        catch (error) {
             
            if (error instanceof index_js_2.HttpError && error.output?.statusCode === index_js_5.DisconnectReason.timedOut) {
                logger?.warn?.({ msgId }, 'timed out waiting for message');
                return undefined;
            }
            throw error;
        }
        finally {
            if (onRecv)
                ws.off(`TAG:${msgId}`, onRecv);
            if (onErr) {
                ws.off('close', onErr);
                ws.off('error', onErr);
            }
        }
    };
     
    const query = async (node, timeoutMs) => {
        if (!node.attrs.id) {
            node.attrs.id = generateMessageTag();
        }
        const msgId = node.attrs.id;
        const result = await (0, index_js_6.promiseTimeout)(timeoutMs, async (resolve, reject) => {
            const result = waitForMessage(msgId, timeoutMs).catch(reject);
            sendNode(node)
                .then(async () => resolve(await result))
                .catch(reject);
        });
        if (result && 'tag' in result) {
            (0, index_js_7.assertNodeErrorFree)(result);
        }
        return result;
    };
     
    const digestKeyBundle = async () => {
        const res = await query({
            tag: 'iq',
            attrs: { to: index_js_7.S_WHATSAPP_NET, type: 'get', xmlns: 'encrypt' },
            content: [{ tag: 'digest', attrs: {} }]
        });
        const digestNode = (0, index_js_7.getBinaryNodeChild)(res, 'digest');
        if (!digestNode) {
            await uploadPreKeys();
            throw new Error('encrypt/get digest returned no digest node');
        }
    };
     
    const rotateSignedPreKey = async () => {
        const newId = (creds.signedPreKey.keyId || 0) + 1;
        const skey = await (0, index_js_6.signedKeyPair)(creds.signedIdentityKey, newId);
        await query({
            tag: 'iq',
            attrs: { to: index_js_7.S_WHATSAPP_NET, type: 'set', xmlns: 'encrypt' },
            content: [
                {
                    tag: 'rotate',
                    attrs: {},
                    content: [(0, index_js_6.xmppSignedPreKey)(skey)]
                }
            ]
        });
         
        ev.emit('creds.update', { signedPreKey: skey });
    };
    const executeUSyncQuery = async (usyncQuery) => {
        if (usyncQuery.protocols.length === 0) {
            throw new index_js_2.HttpError('USyncQuery must have at least one protocol');
        }
         
         
        const validUsers = usyncQuery.users;
        const userNodes = validUsers.map(user => {
            return {
                tag: 'user',
                attrs: {
                    jid: !user.phone ? user.id : undefined
                },
                content: usyncQuery.protocols.map(a => a.getUserElement(user)).filter(a => a !== null)
            };
        });
        const listNode = {
            tag: 'list',
            attrs: {},
            content: userNodes
        };
        const queryNode = {
            tag: 'query',
            attrs: {},
            content: usyncQuery.protocols.map(a => a.getQueryElement())
        };
        const iq = {
            tag: 'iq',
            attrs: {
                to: index_js_7.S_WHATSAPP_NET,
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
        };
        const result = await query(iq);
        return usyncQuery.parseUSyncQueryResult(result);
    };
    const onWhatsApp = async (...phoneNumber) => {
        let usyncQuery = new index_js_8.USyncQuery();
        let contactEnabled = false;
        for (const jid of phoneNumber) {
            if ((0, index_js_7.isLidUser)(jid)) {
                logger?.warn('LIDs are not supported with onWhatsApp');
                continue;
            }
            else {
                if (!contactEnabled) {
                    contactEnabled = true;
                    usyncQuery = usyncQuery.withContactProtocol();
                }
                const phone = `+${jid.replace('+', '').split('@')[0]?.split(':')[0]}`;
                usyncQuery.withUser(new index_js_8.USyncUser().withPhone(phone));
            }
        }
        if (usyncQuery.users.length === 0) {
            return [];  
        }
        const results = await executeUSyncQuery(usyncQuery);
        if (results) {
            return results.list.filter(a => !!a.contact).map(({ contact, id }) => ({ jid: id, exists: contact }));
        }
    };
    const pnFromLIDUSync = async (jids) => {
        const usyncQuery = new index_js_8.USyncQuery().withLIDProtocol().withContext('background');
        for (const jid of jids) {
            if ((0, index_js_7.isLidUser)(jid)) {
                logger?.warn('LID user found in LID fetch call');
                continue;
            }
            else {
                usyncQuery.withUser(new index_js_8.USyncUser().withId(jid));
            }
        }
        if (usyncQuery.users.length === 0) {
            return [];  
        }
        const results = await executeUSyncQuery(usyncQuery);
        if (results) {
            return results.list.filter(a => !!a.lid).map(({ lid, id }) => ({ pn: id, lid: lid }));
        }
        return [];
    };
    const ev = (0, index_js_6.makeEventBuffer)(logger);
    const { creds } = authState;
     
    const keys = (0, index_js_6.addTransactionCapability)(authState.keys, logger, transactionOpts);
    const signalRepository = makeSignalRepository({ creds, keys }, logger, pnFromLIDUSync);
    let lastDateRecv;
    let epoch = 1;
    let keepAliveReq;
    let qrTimer;
    let closed = false;
    const socketEndHandlers = [];
     
    const onUnexpectedError = (err, msg) => {
        logger.error({ err }, `unexpected error in '${msg}'`);
    };
     
    const awaitNextMessage = async (sendMsg) => {
        if (!ws.isOpen) {
            throw new index_js_2.HttpError('Connection Closed', {
                statusCode: index_js_5.DisconnectReason.connectionClosed
            });
        }
        let onOpen;
        let onClose;
        const result = (0, index_js_6.promiseTimeout)(connectTimeoutMs, (resolve, reject) => {
            onOpen = resolve;
            onClose = mapWebSocketError(reject);
            ws.on('frame', onOpen);
            ws.on('close', onClose);
            ws.on('error', onClose);
        }).finally(() => {
            ws.off('frame', onOpen);
            ws.off('close', onClose);
            ws.off('error', onClose);
        });
        if (sendMsg) {
            sendRawMessage(sendMsg).catch(onClose);
        }
        return result;
    };
     
    const validateConnection = async () => {
        let helloMsg = {
            clientHello: { ephemeral: ephemeralKeyPair.public }
        };
        helloMsg = index_js_1.proto.HandshakeMessage.fromObject(helloMsg);
        logger.info({ browser, helloMsg }, 'connected to WA');
        const init = index_js_1.proto.HandshakeMessage.encode(helloMsg).finish();
        const result = await awaitNextMessage(init);
        const handshake = index_js_1.proto.HandshakeMessage.decode(result);
        logger.trace({ handshake }, 'handshake recv from WA');
        const keyEnc = noise.processHandshake(handshake, creds.noiseKey);
        let node;
        if (!creds.me || (!!creds.pairingCode && !creds.registered)) {
            node = (0, index_js_6.generateRegistrationNode)(creds, config);
            logger.info({ node }, 'not logged in, attempting registration...');
        }
        else {
            node = (0, index_js_6.generateLoginNode)(creds.me.id, config);
            logger.info({ node }, 'logging in...');
        }
        const payloadEnc = noise.encrypt(index_js_1.proto.ClientPayload.encode(node).finish());
        await sendRawMessage(index_js_1.proto.HandshakeMessage.encode({
            clientFinish: {
                static: keyEnc,
                payload: payloadEnc
            }
        }).finish());
        await noise.finishInit();
        startKeepAliveRequest();
    };
    const getAvailablePreKeysOnServer = async () => {
        const result = await query({
            tag: 'iq',
            attrs: {
                id: generateMessageTag(),
                xmlns: 'encrypt',
                type: 'get',
                to: index_js_7.S_WHATSAPP_NET
            },
            content: [{ tag: 'count', attrs: {} }]
        });
        const countChild = (0, index_js_7.getBinaryNodeChild)(result, 'count');
        return +countChild.attrs.value;
    };
     
    let uploadPreKeysPromise = null;
     
    const uploadPreKeys = async (count = index_js_3.MIN_PREKEY_COUNT) => {
        if (uploadPreKeysPromise) {
            logger.debug('Pre-key upload already in progress, waiting for completion');
            await uploadPreKeysPromise;
            return;
        }
        const uploadLogic = async (retryCount) => {
            logger.info({ count, retryCount }, 'uploading pre-keys');
             
            const node = await keys.transaction(async () => {
                logger.debug({ requestedCount: count }, 'generating pre-keys with requested count');
                const { update, node } = await (0, index_js_6.getNextPreKeysNode)({ creds, keys }, count);
                 
                ev.emit('creds.update', update);
                return node;
            }, creds?.me?.id || 'upload-pre-keys');
             
            try {
                await query(node);
                logger.info({ count }, 'uploaded pre-keys successfully');
            }
            catch (uploadError) {
                logger.error({ uploadError: uploadError.toString(), count }, 'Failed to upload pre-keys to server');
                 
                if (retryCount < 3) {
                    const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 10000);
                    logger.info(`Retrying pre-key upload in ${backoffDelay}ms`);
                    await new Promise(resolve => setTimeout(resolve, backoffDelay));
                    return uploadLogic(retryCount + 1);
                }
                throw uploadError;
            }
        };
         
        uploadPreKeysPromise = Promise.race([
            uploadLogic(0),
            new Promise((_, reject) => setTimeout(() => reject(new index_js_2.HttpError('Pre-key upload timeout', { statusCode: 408 })), index_js_3.UPLOAD_TIMEOUT))
        ]);
        try {
            await uploadPreKeysPromise;
        }
        finally {
            uploadPreKeysPromise = null;
        }
    };
    const verifyCurrentPreKeyExists = async () => {
        const currentPreKeyId = creds.nextPreKeyId - 1;
        if (currentPreKeyId <= 0) {
            return { exists: false, currentPreKeyId: 0 };
        }
        const preKeys = await keys.get('pre-key', [currentPreKeyId.toString()]);
        const exists = !!preKeys[currentPreKeyId.toString()];
        return { exists, currentPreKeyId };
    };
    const uploadPreKeysToServerIfRequired = async () => {
        try {
            let count = 0;
            const preKeyCount = await getAvailablePreKeysOnServer();
            if (preKeyCount === 0)
                count = index_js_3.INITIAL_PREKEY_COUNT;
            else
                count = index_js_3.MIN_PREKEY_COUNT;
            const { exists: currentPreKeyExists, currentPreKeyId } = await verifyCurrentPreKeyExists();
            logger.info(`${preKeyCount} pre-keys found on server`);
            logger.info(`Current prekey ID: ${currentPreKeyId}, exists in storage: ${currentPreKeyExists}`);
            const lowServerCount = preKeyCount <= count;
            const missingCurrentPreKey = !currentPreKeyExists && currentPreKeyId > 0;
            const shouldUpload = lowServerCount || missingCurrentPreKey;
            if (shouldUpload) {
                const reasons = [];
                if (lowServerCount)
                    reasons.push(`server count low (${preKeyCount})`);
                if (missingCurrentPreKey)
                    reasons.push(`current prekey ${currentPreKeyId} missing from storage`);
                logger.info(`Uploading PreKeys due to: ${reasons.join(', ')}`);
                await uploadPreKeys(count);
            }
            else {
                logger.info(`PreKey validation passed - Server: ${preKeyCount}, Current prekey ${currentPreKeyId} exists`);
            }
        }
        catch (error) {
            logger.error({ error }, 'Failed to check/upload pre-keys during initialization');
             
        }
    };
    const onMessageReceived = async (data) => {
        await noise.decodeFrame(data, frame => {
             
            lastDateRecv = new Date();
            let anyTriggered = false;
            anyTriggered = ws.emit('frame', frame);
             
            if (!(frame instanceof Uint8Array)) {
                const msgId = frame.attrs.id;
                if (logger.level === 'trace') {
                    logger.trace({ xml: (0, index_js_7.binaryNodeToString)(frame), msg: 'recv xml' });
                }
                 
                anyTriggered = ws.emit(`${index_js_3.DEF_TAG_PREFIX}${msgId}`, frame) || anyTriggered;
                 
                const l0 = frame.tag;
                const l1 = frame.attrs || {};
                const l2 = Array.isArray(frame.content) ? frame.content[0]?.tag : '';
                for (const key of Object.keys(l1)) {
                    anyTriggered = ws.emit(`${index_js_3.DEF_CALLBACK_PREFIX}${l0},${key}:${l1[key]},${l2}`, frame) || anyTriggered;
                    anyTriggered = ws.emit(`${index_js_3.DEF_CALLBACK_PREFIX}${l0},${key}:${l1[key]}`, frame) || anyTriggered;
                    anyTriggered = ws.emit(`${index_js_3.DEF_CALLBACK_PREFIX}${l0},${key}`, frame) || anyTriggered;
                }
                anyTriggered = ws.emit(`${index_js_3.DEF_CALLBACK_PREFIX}${l0},,${l2}`, frame) || anyTriggered;
                anyTriggered = ws.emit(`${index_js_3.DEF_CALLBACK_PREFIX}${l0}`, frame) || anyTriggered;
                if (!anyTriggered && logger.level === 'debug') {
                    logger.debug({ unhandled: true, msgId, fromMe: false, frame }, 'communication recv');
                }
            }
        });
    };
    const end = async (error) => {
        if (closed) {
            logger.trace({ trace: error?.stack }, 'connection already closed');
            return;
        }
        closed = true;
        logger.info({ trace: error?.stack }, error ? 'connection errored' : 'connection closed');
        clearInterval(keepAliveReq);
        clearTimeout(qrTimer);
        ws.removeAllListeners('close');
        ws.removeAllListeners('open');
        ws.removeAllListeners('message');
        signalRepository.close?.();
        if (!ws.isClosed && !ws.isClosing) {
            try {
                await ws.close();
            }
            catch { }
        }
        for (const handler of socketEndHandlers) {
            try {
                await handler(error);
            }
            catch (err) {
                logger.error({ err }, 'error in socket end handler');
            }
        }
        ev.emit('connection.update', {
            connection: 'close',
            lastDisconnect: {
                error,
                date: new Date()
            }
        });
        ev.removeAllListeners('connection.update');
        ev.destroy();
    };
    const waitForSocketOpen = async () => {
        if (ws.isOpen) {
            return;
        }
        if (ws.isClosed || ws.isClosing) {
            throw new index_js_2.HttpError('Connection Closed', { statusCode: index_js_5.DisconnectReason.connectionClosed });
        }
        let onOpen;
        let onClose;
        await new Promise((resolve, reject) => {
            onOpen = () => resolve(undefined);
            onClose = mapWebSocketError(reject);
            ws.on('open', onOpen);
            ws.on('close', onClose);
            ws.on('error', onClose);
        }).finally(() => {
            ws.off('open', onOpen);
            ws.off('close', onClose);
            ws.off('error', onClose);
        });
    };
    const startKeepAliveRequest = () => (keepAliveReq = setInterval(() => {
        if (!lastDateRecv) {
            lastDateRecv = new Date();
        }
        const diff = Date.now() - lastDateRecv.getTime();
         



        if (diff > keepAliveIntervalMs + 5000) {
            void end(new index_js_2.HttpError('Connection was lost', { statusCode: index_js_5.DisconnectReason.connectionLost }));
        }
        else if (ws.isOpen) {
             
            query({
                tag: 'iq',
                attrs: {
                    id: generateMessageTag(),
                    to: index_js_7.S_WHATSAPP_NET,
                    type: 'get',
                    xmlns: 'w:p'
                },
                content: [{ tag: 'ping', attrs: {} }]
            }).catch(err => {
                logger.error({ trace: err.stack }, 'error in sending keep alive');
            });
        }
        else {
            logger.warn('keep alive called when WS not open');
        }
    }, keepAliveIntervalMs));
     
    const sendPassiveIq = (tag) => query({
        tag: 'iq',
        attrs: {
            to: index_js_7.S_WHATSAPP_NET,
            xmlns: 'passive',
            type: 'set'
        },
        content: [{ tag, attrs: {} }]
    });
     
    const logout = async (msg) => {
        const jid = authState.creds.me?.id;
        if (jid) {
            await sendNode({
                tag: 'iq',
                attrs: {
                    to: index_js_7.S_WHATSAPP_NET,
                    type: 'set',
                    id: generateMessageTag(),
                    xmlns: 'md'
                },
                content: [
                    {
                        tag: 'remove-companion-device',
                        attrs: {
                            jid,
                            reason: 'user_initiated'
                        }
                    }
                ]
            });
        }
        void end(new index_js_2.HttpError(msg || 'Intentional Logout', { statusCode: index_js_5.DisconnectReason.loggedOut }));
    };
    const requestPairingCode = async (phoneNumber, customPairingCode) => {
        const pairingCode = customPairingCode ?? (0, index_js_6.bytesToCrockford)((0, node_crypto_1.randomBytes)(5));
        if (customPairingCode && customPairingCode?.length !== 8) {
            throw new Error('Custom pairing code must be exactly 8 chars');
        }
        authState.creds.pairingCode = pairingCode;
        authState.creds.me = {
            id: (0, index_js_7.jidEncode)(phoneNumber, 's.whatsapp.net'),
            name: '~'
        };
        ev.emit('creds.update', authState.creds);
        await sendNode({
            tag: 'iq',
            attrs: {
                to: index_js_7.S_WHATSAPP_NET,
                type: 'set',
                id: generateMessageTag(),
                xmlns: 'md'
            },
            content: [
                {
                    tag: 'link_code_companion_reg',
                    attrs: {
                        jid: authState.creds.me.id,
                        stage: 'companion_hello',
                        should_show_push_notification: 'true'
                    },
                    content: [
                        {
                            tag: 'link_code_pairing_wrapped_companion_ephemeral_pub',
                            attrs: {},
                            content: await generatePairingKey()
                        },
                        {
                            tag: 'companion_server_auth_key_pub',
                            attrs: {},
                            content: authState.creds.noiseKey.public
                        },
                        {
                            tag: 'companion_platform_id',
                            attrs: {},
                            content: (0, index_js_6.getCompanionPlatformId)(browser)
                        },
                        {
                            tag: 'companion_platform_display',
                            attrs: {},
                            content: `${browser[1]} (${browser[0]})`
                        },
                        {
                            tag: 'link_code_pairing_nonce',
                            attrs: {},
                            content: Buffer.alloc(1)
                        }
                    ]
                }
            ]
        });
        return authState.creds.pairingCode;
    };
    async function generatePairingKey() {
        const salt = (0, node_crypto_1.randomBytes)(32);
        const randomIv = (0, node_crypto_1.randomBytes)(16);
        const key = await (0, index_js_6.derivePairingCodeKey)(authState.creds.pairingCode, salt);
        const ciphered = (0, index_js_6.aesEncryptCTR)(authState.creds.pairingEphemeralKeyPair.public, key, randomIv);
        return Buffer.concat([salt, randomIv, ciphered]);
    }
    const sendWAMBuffer = (wamBuffer) => {
        return query({
            tag: 'iq',
            attrs: {
                to: index_js_7.S_WHATSAPP_NET,
                id: generateMessageTag(),
                xmlns: 'w:stats'
            },
            content: [
                {
                    tag: 'add',
                    attrs: { t: Math.round(Date.now() / 1000) + '' },
                    content: wamBuffer
                }
            ]
        });
    };
    ws.on('message', onMessageReceived);
    ws.on('open', async () => {
        try {
            await validateConnection();
        }
        catch (err) {
            logger.error({ err }, 'error in validating connection');
            void end(err);
        }
    });
    ws.on('error', mapWebSocketError(end));
    ws.on('close', () => void end(new index_js_2.HttpError('Connection Terminated', { statusCode: index_js_5.DisconnectReason.connectionClosed })));
     
    ws.on('CB:xmlstreamend', () => void end(new index_js_2.HttpError('Connection Terminated by Server', { statusCode: index_js_5.DisconnectReason.connectionClosed })));
     
    ws.on('CB:iq,type:set,pair-device', async (stanza) => {
        const iq = {
            tag: 'iq',
            attrs: {
                to: index_js_7.S_WHATSAPP_NET,
                type: 'result',
                id: stanza.attrs.id
            }
        };
        await sendNode(iq);
        const pairDeviceNode = (0, index_js_7.getBinaryNodeChild)(stanza, 'pair-device');
        const refNodes = (0, index_js_7.getBinaryNodeChildren)(pairDeviceNode, 'ref');
        const noiseKeyB64 = Buffer.from(creds.noiseKey.public).toString('base64');
        const identityKeyB64 = Buffer.from(creds.signedIdentityKey.public).toString('base64');
        const advB64 = creds.advSecretKey;
        let qrMs = qrTimeout || 60000;  
        const genPairQR = () => {
            if (!ws.isOpen) {
                return;
            }
            const refNode = refNodes.shift();
            if (!refNode) {
                void end(new index_js_2.HttpError('QR refs attempts ended', { statusCode: index_js_5.DisconnectReason.timedOut }));
                return;
            }
            const ref = refNode.content.toString('utf-8');
            const qr = (0, index_js_6.buildPairingQRData)(ref, noiseKeyB64, identityKeyB64, advB64, browser);
            ev.emit('connection.update', { qr });
            qrTimer = setTimeout(genPairQR, qrMs);
            qrMs = qrTimeout || 20000;  
        };
        genPairQR();
    });
     
     
    ws.on('CB:iq,,pair-success', async (stanza) => {
        logger.debug('pair success recv');
        try {
            updateServerTimeOffset(stanza);
            const { reply, creds: updatedCreds } = (0, index_js_6.configureSuccessfulPairing)(stanza, creds);
            logger.info({ me: updatedCreds.me, platform: updatedCreds.platform }, 'pairing configured successfully, expect to restart the connection...');
            ev.emit('creds.update', updatedCreds);
            ev.emit('connection.update', { isNewLogin: true, qr: undefined });
            await sendNode(reply);
            void sendUnifiedSession();
        }
        catch (error) {
            logger.info({ trace: error.stack }, 'error in pairing');
            void end(error);
        }
    });
     
    ws.on('CB:success', async (node) => {
        try {
            updateServerTimeOffset(node);
            await uploadPreKeysToServerIfRequired();
            await sendPassiveIq('active');
             
            try {
                await digestKeyBundle();
            }
            catch (e) {
                logger.warn({ e }, 'failed to run digest after login');
            }
        }
        catch (err) {
            logger.warn({ err }, 'failed to send initial passive iq');
        }
        logger.info('opened connection to WA');
        clearTimeout(qrTimer);  
        ev.emit('creds.update', { me: { ...authState.creds.me, lid: node.attrs.lid } });
        ev.emit('connection.update', { connection: 'open' });
        void sendUnifiedSession();
        if (node.attrs.lid && authState.creds.me?.id) {
            const myLID = node.attrs.lid;
            process.nextTick(async () => {
                try {
                    const myPN = authState.creds.me.id;
                     
                    await signalRepository.lidMapping.storeLIDPNMappings([{ lid: myLID, pn: myPN }]);
                     
                    const { user, device } = (0, index_js_7.jidDecode)(myPN);
                    await authState.keys.set({
                        'device-list': {
                            [user]: [device?.toString() || '0']
                        }
                    });
                     
                    await signalRepository.migrateSession(myPN, myLID);
                    logger.info({ myPN, myLID }, 'Own LID session created successfully');
                }
                catch (error) {
                    logger.error({ error, lid: myLID }, 'Failed to create own LID session');
                }
            });
        }
    });
    ws.on('CB:stream:error', (node) => {
        const [reasonNode] = (0, index_js_7.getAllBinaryNodeChildren)(node);
        logger.error({ reasonNode, fullErrorNode: node }, 'stream errored out');
        const { reason, statusCode } = (0, index_js_6.getErrorCodeFromStreamError)(node);
        void end(new index_js_2.HttpError(`Stream Errored (${reason})`, { statusCode, data: reasonNode || node }));
    });
     
    ws.on('CB:failure', (node) => {
        const reason = +(node.attrs.reason || 500);
        void end(new index_js_2.HttpError('Connection Failure', { statusCode: reason, data: node.attrs }));
    });
    ws.on('CB:ib,,downgrade_webclient', () => {
        void end(new index_js_2.HttpError('Multi-device beta not joined', { statusCode: index_js_5.DisconnectReason.multideviceMismatch }));
    });
    ws.on('CB:ib,,offline_preview', async (node) => {
        logger.info('offline preview received', JSON.stringify(node));
        await sendNode({
            tag: 'ib',
            attrs: {},
            content: [{ tag: 'offline_batch', attrs: { count: '100' } }]
        });
    });
    ws.on('CB:ib,,edge_routing', (node) => {
        const edgeRoutingNode = (0, index_js_7.getBinaryNodeChild)(node, 'edge_routing');
        const routingInfo = (0, index_js_7.getBinaryNodeChild)(edgeRoutingNode, 'routing_info');
        if (routingInfo?.content) {
            authState.creds.routingInfo = Buffer.from(routingInfo?.content);
            ev.emit('creds.update', authState.creds);
        }
    });
    let didStartBuffer = false;
    process.nextTick(() => {
        if (creds.me?.id) {
             
             
            ev.buffer();
            didStartBuffer = true;
        }
        ev.emit('connection.update', { connection: 'connecting', receivedPendingNotifications: false, qr: undefined });
    });
     
    ws.on('CB:ib,,offline', (node) => {
        const child = (0, index_js_7.getBinaryNodeChild)(node, 'offline');
        const offlineNotifs = +(child?.attrs.count || 0);
        logger.info(`handled ${offlineNotifs} offline messages/notifications`);
        if (didStartBuffer) {
            ev.flush();
            logger.trace('flushed events for initial buffer');
        }
        ev.emit('connection.update', { receivedPendingNotifications: true });
    });
     
    ev.on('creds.update', update => {
        const name = update.me?.name;
         
        if (creds.me?.name !== name) {
            logger.debug({ name }, 'updated pushName');
            sendNode({
                tag: 'presence',
                attrs: { name: name }
            }).catch(err => {
                logger.warn({ trace: err.stack }, 'error in sending presence update on name change');
            });
        }
        Object.assign(creds, update);
    });
    const updateServerTimeOffset = ({ attrs }) => {
        const tValue = attrs?.t;
        if (!tValue) {
            return;
        }
        const parsed = Number(tValue);
        if (Number.isNaN(parsed) || parsed <= 0) {
            return;
        }
        const localMs = Date.now();
        serverTimeOffsetMs = parsed * 1000 - localMs;
        logger.debug({ offset: serverTimeOffsetMs }, 'calculated server time offset');
    };
    const getUnifiedSessionId = () => {
        const offsetMs = 3 * index_js_3.TimeMs.Day;
        const now = Date.now() + serverTimeOffsetMs;
        const id = (now + offsetMs) % index_js_3.TimeMs.Week;
        return id.toString();
    };
    const sendUnifiedSession = async () => {
        if (!ws.isOpen) {
            return;
        }
        const node = {
            tag: 'ib',
            attrs: {},
            content: [
                {
                    tag: 'unified_session',
                    attrs: {
                        id: getUnifiedSessionId()
                    }
                }
            ]
        };
        try {
            await sendNode(node);
        }
        catch (error) {
            logger.debug({ error }, 'failed to send unified_session telemetry');
        }
    };
    const registerSocketEndHandler = (handler) => {
        socketEndHandlers.push(handler);
    };
     
     
     
    registerSocketEndHandler(() => {
        keys.disposeTransactionStorage();
    });
     



    const fetchAccountReachoutTimelock = async () => {
        const queryResult = await (0, mex_js_1.executeWMexQuery)({}, index_js_4.QueryIds.REACHOUT_TIMELOCK, index_js_5.XWAPaths.xwa2_fetch_account_reachout_timelock, query, generateMessageTag);
        const result = {
            isActive: !!queryResult?.is_active,
            timeEnforcementEnds: queryResult?.time_enforcement_ends && queryResult?.time_enforcement_ends !== '0'
                ? new Date(parseInt(queryResult.time_enforcement_ends, 10) * 1000)
                : undefined,
            enforcementType: queryResult?.enforcement_type ?? index_js_4.ReachoutTimelockEnforcementType.DEFAULT
        };
        ev.emit('connection.update', { reachoutTimeLock: result });
        return result;
    };
     



    const fetchNewChatMessageCap = async () => {
        return (0, mex_js_1.executeWMexQuery)({ input: { type: 'INDIVIDUAL_NEW_CHAT_MSG' } }, index_js_4.QueryIds.MESSAGE_CAPPING_INFO, index_js_5.XWAPaths.xwa2_message_capping_info, query, generateMessageTag);
    };
    return {
        type: 'md',
        ws,
        ev,
        authState: { creds, keys },
        signalRepository,
        get user() {
            return authState.creds.me;
        },
        generateMessageTag,
        query,
        waitForMessage,
        waitForSocketOpen,
        sendRawMessage,
        sendNode,
        logout,
        end,
        registerSocketEndHandler,
        onUnexpectedError,
        uploadPreKeys,
        uploadPreKeysToServerIfRequired,
        digestKeyBundle,
        rotateSignedPreKey,
        requestPairingCode,
        updateServerTimeOffset,
        sendUnifiedSession,
        wamBuffer: publicWAMBuffer,
         
        waitForConnectionUpdate: (0, index_js_6.bindWaitForConnectionUpdate)(ev),
        sendWAMBuffer,
        executeUSyncQuery,
        onWhatsApp,
        fetchAccountReachoutTimelock,
        fetchNewChatMessageCap
    };
};
exports.makeSocket = makeSocket;
 



function mapWebSocketError(handler) {
    return (error) => {
        handler(new index_js_2.HttpError(`WebSocket Error (${error?.message})`, { statusCode: (0, index_js_6.getCodeFromWSError)(error), data: error }));
    };
}

return module.exports;
})();
for (const key of Object.keys(__kageModule139)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule139[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule139, configurable:true});
