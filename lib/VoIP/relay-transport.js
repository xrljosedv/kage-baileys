"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { newObj[key] = obj[key]; } } } newObj.default = obj; return newObj; } } function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }/**
 * Relay transport.
 *
 * Tunnels UDP traffic to WhatsApp's edge relay servers via WebRTC data
 * channels (using `@roamhq/wrtc`). Mirrors the browser client's behavior:
 * pre-negotiated SCTP, custom DTLS fingerprint, ICE restart on idle.
 *
 * @author ShellTear
 */
var _nodefs = require('node:fs');
const RELAY_PROTO_UDP = 0;
const FAUX_WEB_CLIENT_RELAY_PORT = 3478;
const TRUE_WEB_CLIENT_RELAY_PORT = 3480;
const CONNECTION_TIMEOUT_MS = 20000;
const ICE_RESTART_IDLE_THRESHOLD_MS = 10000;
const ICE_RTT_POLL_MS = 1000;
const MAX_BUFFER_SIZE = 256 * 1024;
const RELAY_PACKET_LOG_PATH = _nullishCoalesce(process.env.CALL_DUMP_RELAY_PACKETS_PATH, () => ( ""));
const DISABLE_IPV6 = process.env.CALL_DISABLE_IPV6 !== "0";
const RELAY_PORT_MODE = process.env.CALL_RELAY_PORT_MODE === "original" ? "original" : "web";
const USE_ORIGINAL_RELAY_PORTS = RELAY_PORT_MODE === "original";
const RELAY_DTLS_FINGERPRINT = "F9:CA:0C:98:A3:CC:71:D6:42:CE:5A:E2:53:D2:15:20:D3:1B:BA:D8:57:A4:F0:AF:BE:0B:FB:F3:6B:0C:A0:68";
const getConnectionIdentifier = (ip, port) => ip.includes(":") ? `[${ip}]:${port}` : `${ip}:${port}`;
const createEmptyStats = () => ({
    sentPackets: 0,
    receivedPackets: 0,
    sentBytes: 0,
    receivedBytes: 0,
    droppedPackets: 0,
    openConnections: 0,
});
const getRelayLookupId = (ip, port) => getConnectionIdentifier(ip, port === TRUE_WEB_CLIENT_RELAY_PORT ? TRUE_WEB_CLIENT_RELAY_PORT : port);
const getRtcConnectPort = (info) => info.ip === "157.240.24.133" ? FAUX_WEB_CLIENT_RELAY_PORT : info.port;
const getVoipStackPort = (info) => {
    if (USE_ORIGINAL_RELAY_PORTS)
        return info.originalPort || info.port;
    const sourcePort = info.originalPort || info.port;
    return sourcePort === TRUE_WEB_CLIENT_RELAY_PORT
        ? TRUE_WEB_CLIENT_RELAY_PORT
        : FAUX_WEB_CLIENT_RELAY_PORT;
};
const bufferPacket = (connection, packet) => {
    if (packet.byteLength > MAX_BUFFER_SIZE) {
        connection.stats.droppedPackets += 1;
        return false;
    }
    while (connection.packetBuffer.length > 0 &&
        connection.bufferedBytes + packet.byteLength > MAX_BUFFER_SIZE) {
        const dropped = connection.packetBuffer.shift();
        if (dropped) {
            connection.bufferedBytes -= dropped.byteLength;
            connection.stats.droppedPackets += 1;
        }
    }
    connection.packetBuffer.push(packet);
    connection.bufferedBytes += packet.byteLength;
    return true;
};
const shiftPacket = (connection) => {
    const packet = _nullishCoalesce(connection.packetBuffer.shift(), () => ( null));
    if (packet)
        connection.bufferedBytes -= packet.byteLength;
    return packet;
};
const replaceIceCredentials = (sdp, ufrag, pwd) => sdp
    .replace(/a=ice-ufrag:[^\r\n]+/g, `a=ice-ufrag:${ufrag}`)
    .replace(/a=ice-pwd:[^\r\n]+/g, `a=ice-pwd:${pwd}`);
const replaceDtlsFingerprint = (sdp, algorithm, fingerprint) => sdp.replace(/a=fingerprint:[^\r\n]+/g, `a=fingerprint:${algorithm} ${fingerprint}`);
const removeIceCandidates = (sdp) => sdp
    .replace(/a=candidate:[^\r\n]+\r?\n/g, "")
    .replace(/a=end-of-candidates\r?\n?/g, "");
const appendRelayCandidate = (sdp, ip, port) => {
    const candidate = `a=candidate:2 1 udp 2122262783 ${ip} ${port} typ host generation 0 network-cost 5`;
    return `${removeIceCandidates(sdp)}${candidate}\r\na=end-of-candidates\r\n`;
};
const buildRemoteRelayAnswer = (offerSdp, info) => {
    const setupLine = info.enableEdgerayDtlsActiveMode ? "a=setup:active" : "a=setup:passive";
    let answerSdp = offerSdp.replace(/a=setup:actpass/g, setupLine);
    answerSdp = replaceIceCredentials(answerSdp, _nullishCoalesce(info.authToken, () => ( info.token)), info.key);
    answerSdp = replaceDtlsFingerprint(answerSdp, "sha-256", RELAY_DTLS_FINGERPRINT);
    answerSdp = answerSdp.replace(/a=ice-options:[^\r\n]+\r\n/g, "");
    answerSdp = answerSdp.replace(/a=max-message-size:[^\r\n]+/g, "a=max-message-size:1200");
    return appendRelayCandidate(answerSdp, info.ip, info.port);
};
const toArrayBuffer = (data) => {
    const copy = new Uint8Array(data.byteLength);
    copy.set(data);
    return copy.buffer;
};
const toUint8Array = (data) => {
    if (data instanceof Uint8Array)
        return new Uint8Array(data);
    if (Buffer.isBuffer(data))
        return new Uint8Array(data);
    if (data instanceof ArrayBuffer)
        return new Uint8Array(data);
    if (data && typeof data === "object" && "byteLength" in data && "buffer" in data) {
        const view = data;
        return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    }
    return null;
};
const classifyRelayPacket = (packet) => {
    if (packet.byteLength < 2)
        return "non_stun";
    const bytes = new Uint8Array(packet);
    const first = bytes[0];
    const second = bytes[1];
    if ((first & 0xc0) !== 0)
        return "non_stun";
    const stunType = ((first & 0x3f) << 8) | second;
    if (stunType === 0x0001)
        return "stun_bind";
    if (stunType === 0x0003)
        return "stun_alloc";
    return "stun_unknown";
};
const appendRelayPacketLog = (direction, connection, packet) => {
    if (!RELAY_PACKET_LOG_PATH)
        return;
    const buffer = packet instanceof ArrayBuffer
        ? Buffer.from(new Uint8Array(packet))
        : Buffer.from(packet.buffer, packet.byteOffset, packet.byteLength);
    _nodefs.appendFileSync.call(void 0, RELAY_PACKET_LOG_PATH, JSON.stringify({
        ts: new Date().toISOString(),
        direction,
        id: connection.info.id,
        relayId: connection.info.relayId,
        relayName: connection.info.name,
        ip: connection.info.ip,
        rtcPort: connection.info.port,
        voipPort: getVoipStackPort(connection.info),
        size: buffer.byteLength,
        hex: buffer.toString("hex"),
    }) + "\n");
};
 class RelayRtcTransport {
    
    #relayInfoById = new Map();
    #connections = new Map();
    #totals = createEmptyStats();
    #wrtcPromise = null;
    constructor(config) {;RelayRtcTransport.prototype.__init.call(this);RelayRtcTransport.prototype.__init2.call(this);RelayRtcTransport.prototype.__init3.call(this);RelayRtcTransport.prototype.__init4.call(this);
        this.config = config;
    }
    __init() {this.updateRelayList = (update) => {
        const nextInfoById = new Map();
        for (const relay of _nullishCoalesce(update.relays, () => ( []))) {
            if (relay.token_id == null || relay.token_id < 0 ||
                relay.token_id >= (_nullishCoalesce(update.relay_tokens, () => ( []))).length) {
                continue;
            }
            const authToken = update.auth_tokens && relay.auth_token_id != null && relay.auth_token_id >= 0
                ? update.auth_tokens[relay.auth_token_id]
                : undefined;
            for (const address of _nullishCoalesce(relay.addresses, () => ( []))) {
                if (address.protocol !== RELAY_PROTO_UDP)
                    continue;
                if (address.ipv4 && address.port != null) {
                    const clientPort = USE_ORIGINAL_RELAY_PORTS ? address.port : TRUE_WEB_CLIENT_RELAY_PORT;
                    const id = getConnectionIdentifier(address.ipv4, clientPort);
                    nextInfoById.set(id, {
                        id,
                        relayId: relay.relay_id,
                        ip: address.ipv4,
                        port: clientPort,
                        originalPort: address.port,
                        isIPv6: false,
                        token: update.relay_tokens[relay.token_id],
                        authToken,
                        key: update.relay_key,
                        name: relay.relay_name,
                        enableEdgerayDtlsActiveMode: update.enable_edgeray_dtls_active_mode === true,
                    });
                }
                if (!DISABLE_IPV6 && address.ipv6 && address.port_v6 != null) {
                    const clientPort = USE_ORIGINAL_RELAY_PORTS ? address.port_v6 : TRUE_WEB_CLIENT_RELAY_PORT;
                    const id = getConnectionIdentifier(address.ipv6, clientPort);
                    nextInfoById.set(id, {
                        id,
                        relayId: relay.relay_id,
                        ip: address.ipv6,
                        port: clientPort,
                        originalPort: address.port_v6,
                        isIPv6: true,
                        token: update.relay_tokens[relay.token_id],
                        authToken,
                        key: update.relay_key,
                        name: relay.relay_name,
                        enableEdgerayDtlsActiveMode: update.enable_edgeray_dtls_active_mode === true,
                    });
                }
            }
        }
        for (const id of this.#relayInfoById.keys()) {
            if (!nextInfoById.has(id))
                this.#closeConnection(id);
        }
        this.#relayInfoById.clear();
        for (const [id, info] of nextInfoById) {
            this.#relayInfoById.set(id, info);
            void this.#ensureConnection(info);
        }
    }}
    __init2() {this.send = (packet, ip, port) => {
        const requestedId = getConnectionIdentifier(ip, port);
        const preferredPort = USE_ORIGINAL_RELAY_PORTS ? port : TRUE_WEB_CLIENT_RELAY_PORT;
        const candidateIds = [
            requestedId,
            getConnectionIdentifier(ip, preferredPort),
            getRelayLookupId(ip, TRUE_WEB_CLIENT_RELAY_PORT),
            getRelayLookupId(ip, FAUX_WEB_CLIENT_RELAY_PORT),
        ];
        let info;
        for (const candidateId of candidateIds) {
            info = this.#relayInfoById.get(candidateId);
            if (info)
                break;
        }
        if (!info) {
            if (DISABLE_IPV6 && ip.includes(":"))
                return 0;
            const earlyConnection = this.#getOrCreateEarlyConnection(ip, port);
            bufferPacket(earlyConnection, toArrayBuffer(packet));
            return packet.byteLength;
        }
        const connection = this.#getOrCreateConnection(info);
        const arrayBuffer = toArrayBuffer(packet);
        if (classifyRelayPacket(arrayBuffer) === "stun_alloc" &&
            connection.state === "open" &&
            connection.sentMedia &&
            Date.now() - connection.lastRxPacketTime > ICE_RESTART_IDLE_THRESHOLD_MS) {
            connection.packetBuffer = [];
            connection.bufferedBytes = 0;
            bufferPacket(connection, arrayBuffer);
            void this.#restartIce(connection);
            return packet.byteLength;
        }
        if (connection.state === "open" && _optionalChain([connection, 'access', _3 => _3.dataChannel, 'optionalAccess', _4 => _4.readyState]) === "open") {
            if (!this.#sendBufferedPacket(connection, arrayBuffer)) {
                connection.stats.droppedPackets += 1;
            }
            return packet.byteLength;
        }
        bufferPacket(connection, arrayBuffer);
        void this.#ensureConnection(info);
        return packet.byteLength;
    }}
    __init3() {this.getStats = () => {
        let openConnections = 0;
        for (const connection of this.#connections.values()) {
            if (connection.state === "open")
                openConnections += 1;
        }
        return { ...this.#totals, openConnections };
    }}
    __init4() {this.closeAll = async () => {
        for (const id of [...this.#connections.keys()])
            this.#closeConnection(id);
    }}
    // ─── private ──────────────────────────────────────────────────────────────
    #getOrCreateConnection = (info) => {
        const existing = this.#connections.get(info.id);
        if (existing) {
            existing.info = info;
            return existing;
        }
        const created = {
            info, state: "none", peerConnection: null, dataChannel: null,
            iceCandidate: null, packetBuffer: [], bufferedBytes: 0,
            connectPromise: null, connectionTimeout: null, iceStatsInterval: null,
            lastIceRttMs: null, hasReceivedFirstPacket: false,
            hasNonStunPacketSent: false, sentMedia: false, lastRxPacketTime: 0,
            isReconnecting: false, stats: createEmptyStats(),
        };
        this.#connections.set(info.id, created);
        return created;
    };
    #getOrCreateEarlyConnection = (ip, port) => {
        const id = getConnectionIdentifier(ip, port);
        const existing = this.#connections.get(id);
        if (existing)
            return existing;
        const placeholderInfo = {
            id, relayId: 0, ip, port, originalPort: port,
            isIPv6: ip.includes(":"), token: "", key: "",
            name: "early-packet", enableEdgerayDtlsActiveMode: false,
        };
        const created = {
            info: placeholderInfo, state: "none", peerConnection: null,
            dataChannel: null, iceCandidate: null, packetBuffer: [],
            bufferedBytes: 0, connectPromise: null, connectionTimeout: null,
            iceStatsInterval: null, lastIceRttMs: null,
            hasReceivedFirstPacket: false, hasNonStunPacketSent: false,
            sentMedia: false, lastRxPacketTime: 0, isReconnecting: false,
            stats: createEmptyStats(),
        };
        this.#connections.set(id, created);
        return created;
    };
    #ensureConnection = async (info) => {
        const connection = this.#getOrCreateConnection(info);
        if (connection.state === "open" || connection.state === "connecting") {
            return _nullishCoalesce(connection.connectPromise, () => ( Promise.resolve()));
        }
        const promise = this.#connect(connection);
        connection.connectPromise = promise;
        try {
            await promise;
        }
        finally {
            connection.connectPromise = null;
        }
    };
    #connect = async (connection) => {
        const wrtcModule = await this.#loadWrtc();
        const { RTCPeerConnection } = wrtcModule;
        if (typeof RTCPeerConnection !== "function") {
            throw new Error("RTCPeerConnection unavailable from @roamhq/wrtc");
        }
        this.#closePeerObjects(connection);
        connection.state = "connecting";
        const pc = new RTCPeerConnection();
        const dc = pc.createDataChannel("pre-negotiated", {
            negotiated: true, id: 0, ordered: false, maxRetransmits: 0, priority: "high",
        });
        connection.peerConnection = pc;
        connection.dataChannel = dc;
        dc.binaryType = "arraybuffer";
        dc.onopen = () => {
            connection.state = "open";
            connection.isReconnecting = false;
            if (connection.connectionTimeout) {
                clearTimeout(connection.connectionTimeout);
                connection.connectionTimeout = null;
            }
            this.#flushBufferedPackets(connection);
            this.#startIceRttPolling(connection);
        };
        dc.onclose = () => {
            if (connection.state !== "failed")
                connection.state = "closed";
        };
        dc.onerror = () => {
            connection.state = "failed";
        };
        dc.onmessage = (event) => {
            this.#handleIncomingPacket(connection, event.data);
        };
        pc.onicecandidate = (event) => {
            if (_optionalChain([event, 'access', _5 => _5.candidate, 'optionalAccess', _6 => _6.candidate]) && !connection.iceCandidate) {
                connection.iceCandidate = event.candidate.candidate;
            }
        };
        pc.oniceconnectionstatechange = () => {
            if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "closed") {
                connection.state = "failed";
            }
        };
        connection.connectionTimeout = setTimeout(() => {
            if (connection.state === "connecting") {
                connection.state = "failed";
                this.#closePeerObjects(connection);
            }
        }, CONNECTION_TIMEOUT_MS);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const remoteSdp = buildRemoteRelayAnswer(_nullishCoalesce(offer.sdp, () => ( "")), {
            ...connection.info,
            port: getRtcConnectPort(connection.info),
        });
        await pc.setRemoteDescription({ type: "answer", sdp: remoteSdp });
    };
    #restartIce = async (connection) => {
        if (connection.isReconnecting || !connection.hasNonStunPacketSent)
            return;
        const { RTCPeerConnection } = await this.#loadWrtc();
        if (typeof RTCPeerConnection !== "function")
            return;
        connection.isReconnecting = true;
        try {
            this.#closePeerObjects(connection);
            connection.state = "connecting";
            const pc = new RTCPeerConnection();
            const dc = pc.createDataChannel("pre-negotiated", {
                negotiated: true, id: 0, ordered: false, maxRetransmits: 0, priority: "high",
            });
            connection.peerConnection = pc;
            connection.dataChannel = dc;
            dc.binaryType = "arraybuffer";
            dc.onopen = () => {
                connection.state = "open";
                connection.isReconnecting = false;
                this.#flushBufferedPackets(connection);
                this.#startIceRttPolling(connection);
            };
            dc.onclose = () => { if (connection.state !== "failed")
                connection.state = "closed"; };
            dc.onerror = () => { connection.state = "failed"; };
            dc.onmessage = (event) => {
                this.#handleIncomingPacket(connection, event.data);
            };
            pc.onicecandidate = (event) => {
                if (_optionalChain([event, 'access', _7 => _7.candidate, 'optionalAccess', _8 => _8.candidate]) && !connection.iceCandidate) {
                    connection.iceCandidate = event.candidate.candidate;
                }
            };
            const offer = await pc.createOffer({ iceRestart: false });
            let localSdp = _nullishCoalesce(offer.sdp, () => ( ""));
            if (connection.iceCandidate) {
                localSdp = `${removeIceCandidates(localSdp)}a=${connection.iceCandidate}\r\na=end-of-candidates\r\n`;
            }
            await pc.setLocalDescription({ type: "offer", sdp: localSdp });
            const remoteSdp = buildRemoteRelayAnswer(localSdp, {
                ...connection.info,
                port: getRtcConnectPort(connection.info),
            });
            await pc.setRemoteDescription({ type: "answer", sdp: remoteSdp });
        }
        catch (e) {
            connection.state = "failed";
        }
        finally {
            connection.isReconnecting = false;
        }
    };
    #handleIncomingPacket = (connection, raw) => {
        const packet = toUint8Array(raw);
        if (!packet)
            return;
        connection.stats.receivedPackets += 1;
        connection.stats.receivedBytes += packet.byteLength;
        connection.hasReceivedFirstPacket = true;
        connection.lastRxPacketTime = Date.now();
        this.#totals.receivedPackets += 1;
        this.#totals.receivedBytes += packet.byteLength;
        appendRelayPacketLog("recv", connection, packet);
        this.config.onTransportMessage(packet, connection.info.ip, getVoipStackPort(connection.info));
    };
    #flushBufferedPackets = (connection) => {
        while (connection.state === "open" &&
            _optionalChain([connection, 'access', _9 => _9.dataChannel, 'optionalAccess', _10 => _10.readyState]) === "open" &&
            connection.packetBuffer.length > 0) {
            const packet = shiftPacket(connection);
            if (!packet)
                break;
            if (!this.#sendBufferedPacket(connection, packet)) {
                connection.stats.droppedPackets += 1;
                break;
            }
        }
    };
    #sendBufferedPacket = (connection, packet) => {
        try {
            _optionalChain([connection, 'access', _11 => _11.dataChannel, 'optionalAccess', _12 => _12.send, 'call', _13 => _13(packet)]);
            if (classifyRelayPacket(packet) === "non_stun") {
                connection.hasNonStunPacketSent = true;
                connection.sentMedia = true;
            }
            connection.stats.sentPackets += 1;
            connection.stats.sentBytes += packet.byteLength;
            this.#totals.sentPackets += 1;
            this.#totals.sentBytes += packet.byteLength;
            appendRelayPacketLog("send", connection, packet);
            return true;
        }
        catch (e2) {
            return false;
        }
    };
    #startIceRttPolling = (connection) => {
        this.#stopIceRttPolling(connection);
        const pc = connection.peerConnection;
        if (!pc || typeof pc.getStats !== "function" || !this.config.onIceRtt)
            return;
        const poll = async () => {
            const rttMs = await this.#readCurrentRoundTripTimeMs(pc);
            if (rttMs == null || connection.lastIceRttMs === rttMs)
                return;
            connection.lastIceRttMs = rttMs;
            _optionalChain([this, 'access', _14 => _14.config, 'access', _15 => _15.onIceRtt, 'optionalCall', _16 => _16(rttMs, connection.info.ip, connection.info.port)]);
        };
        void poll();
        connection.iceStatsInterval = setInterval(() => { void poll(); }, ICE_RTT_POLL_MS);
        _optionalChain([connection, 'access', _17 => _17.iceStatsInterval, 'access', _18 => _18.unref, 'optionalCall', _19 => _19()]);
    };
    #stopIceRttPolling = (connection) => {
        if (connection.iceStatsInterval) {
            clearInterval(connection.iceStatsInterval);
            connection.iceStatsInterval = null;
        }
        connection.lastIceRttMs = null;
    };
    #readCurrentRoundTripTimeMs = async (pc) => {
        try {
            const stats = await pc.getStats();
            const reports = stats && typeof stats.values === "function"
                ? Array.from(stats.values())
                : Array.isArray(stats) ? stats : Object.values(_nullishCoalesce(stats, () => ( {})));
            if (!reports.length)
                return null;
            let selectedCandidatePairId = "";
            for (const report of reports) {
                if (_optionalChain([report, 'optionalAccess', _20 => _20.type]) === "transport" && typeof report.selectedCandidatePairId === "string") {
                    selectedCandidatePairId = report.selectedCandidatePairId;
                    break;
                }
            }
            const candidatePairs = reports.filter((r) => _optionalChain([r, 'optionalAccess', _21 => _21.type]) === "candidate-pair");
            const selectedPair = (selectedCandidatePairId && candidatePairs.find((r) => _optionalChain([r, 'optionalAccess', _22 => _22.id]) === selectedCandidatePairId)) ||
                candidatePairs.find((r) => _optionalChain([r, 'optionalAccess', _23 => _23.selected]) || _optionalChain([r, 'optionalAccess', _24 => _24.nominated])) ||
                candidatePairs[0];
            const rttSeconds = typeof _optionalChain([selectedPair, 'optionalAccess', _25 => _25.currentRoundTripTime]) === "number"
                ? selectedPair.currentRoundTripTime
                : typeof _optionalChain([selectedPair, 'optionalAccess', _26 => _26.totalRoundTripTime]) === "number" &&
                    typeof _optionalChain([selectedPair, 'optionalAccess', _27 => _27.responsesReceived]) === "number" &&
                    selectedPair.responsesReceived > 0
                    ? selectedPair.totalRoundTripTime / selectedPair.responsesReceived
                    : null;
            if (rttSeconds == null || !Number.isFinite(rttSeconds) || rttSeconds <= 0)
                return null;
            return Math.max(1, Math.round(rttSeconds * 1000));
        }
        catch (e3) {
            return null;
        }
    };
    #closeConnection = (id) => {
        const connection = this.#connections.get(id);
        if (!connection)
            return;
        if (connection.connectionTimeout) {
            clearTimeout(connection.connectionTimeout);
            connection.connectionTimeout = null;
        }
        this.#closePeerObjects(connection);
        connection.state = "closed";
        connection.packetBuffer = [];
        connection.bufferedBytes = 0;
        this.#connections.delete(id);
    };
    #closePeerObjects = (connection) => {
        this.#stopIceRttPolling(connection);
        try {
            _optionalChain([connection, 'access', _28 => _28.dataChannel, 'optionalAccess', _29 => _29.close, 'optionalCall', _30 => _30()]);
        }
        catch (e4) { }
        try {
            _optionalChain([connection, 'access', _31 => _31.peerConnection, 'optionalAccess', _32 => _32.close, 'optionalCall', _33 => _33()]);
        }
        catch (e5) { }
        connection.dataChannel = null;
        connection.peerConnection = null;
    };
    #loadWrtc = () => {
        this.#wrtcPromise ??= Promise.resolve().then(() => _interopRequireWildcard(require("@roamhq/wrtc"))).then((module) => (_nullishCoalesce(module.default, () => ( module))));
        return this.#wrtcPromise;
    };
} exports.RelayRtcTransport = RelayRtcTransport;

// Kage: herramientas de Kage.
const __kageModule105 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RelayRtcTransport = void 0;
/**
 * Relay transport.
 *
 * Tunnels UDP traffic to WhatsApp's edge relay servers via WebRTC data
 * channels (using `@roamhq/wrtc`). Mirrors the browser client's behavior:
 * pre-negotiated SCTP, custom DTLS fingerprint, ICE restart on idle.
 *
 * @author ShellTear
 */
const node_fs_1 = require("node:fs");
const RELAY_PROTO_UDP = 0;
const FAUX_WEB_CLIENT_RELAY_PORT = 3478;
const TRUE_WEB_CLIENT_RELAY_PORT = 3480;
const CONNECTION_TIMEOUT_MS = 20_000;
const ICE_RESTART_IDLE_THRESHOLD_MS = 10_000;
const ICE_RTT_POLL_MS = 1_000;
const MAX_BUFFER_SIZE = 256 * 1024;
const RELAY_PACKET_LOG_PATH = process.env.CALL_DUMP_RELAY_PACKETS_PATH ?? "";
const DISABLE_IPV6 = process.env.CALL_DISABLE_IPV6 !== "0";
const RELAY_PORT_MODE = process.env.CALL_RELAY_PORT_MODE === "original" ? "original" : "web";
const USE_ORIGINAL_RELAY_PORTS = RELAY_PORT_MODE === "original";
const RELAY_DTLS_FINGERPRINT = "F9:CA:0C:98:A3:CC:71:D6:42:CE:5A:E2:53:D2:15:20:D3:1B:BA:D8:57:A4:F0:AF:BE:0B:FB:F3:6B:0C:A0:68";
const getConnectionIdentifier = (ip, port) => ip.includes(":") ? `[${ip}]:${port}` : `${ip}:${port}`;
const createEmptyStats = () => ({
    sentPackets: 0,
    receivedPackets: 0,
    sentBytes: 0,
    receivedBytes: 0,
    droppedPackets: 0,
    openConnections: 0,
});
const getRelayLookupId = (ip, port) => getConnectionIdentifier(ip, port === TRUE_WEB_CLIENT_RELAY_PORT ? TRUE_WEB_CLIENT_RELAY_PORT : port);
const getRtcConnectPort = (info) => info.ip === "157.240.24.133" ? FAUX_WEB_CLIENT_RELAY_PORT : info.port;
const getVoipStackPort = (info) => {
    if (USE_ORIGINAL_RELAY_PORTS)
        return info.originalPort || info.port;
    const sourcePort = info.originalPort || info.port;
    return sourcePort === TRUE_WEB_CLIENT_RELAY_PORT
        ? TRUE_WEB_CLIENT_RELAY_PORT
        : FAUX_WEB_CLIENT_RELAY_PORT;
};
const bufferPacket = (connection, packet) => {
    if (packet.byteLength > MAX_BUFFER_SIZE) {
        connection.stats.droppedPackets += 1;
        return false;
    }
    while (connection.packetBuffer.length > 0 &&
        connection.bufferedBytes + packet.byteLength > MAX_BUFFER_SIZE) {
        const dropped = connection.packetBuffer.shift();
        if (dropped) {
            connection.bufferedBytes -= dropped.byteLength;
            connection.stats.droppedPackets += 1;
        }
    }
    connection.packetBuffer.push(packet);
    connection.bufferedBytes += packet.byteLength;
    return true;
};
const shiftPacket = (connection) => {
    const packet = connection.packetBuffer.shift() ?? null;
    if (packet)
        connection.bufferedBytes -= packet.byteLength;
    return packet;
};
const replaceIceCredentials = (sdp, ufrag, pwd) => sdp
    .replace(/a=ice-ufrag:[^\r\n]+/g, `a=ice-ufrag:${ufrag}`)
    .replace(/a=ice-pwd:[^\r\n]+/g, `a=ice-pwd:${pwd}`);
const replaceDtlsFingerprint = (sdp, algorithm, fingerprint) => sdp.replace(/a=fingerprint:[^\r\n]+/g, `a=fingerprint:${algorithm} ${fingerprint}`);
const removeIceCandidates = (sdp) => sdp
    .replace(/a=candidate:[^\r\n]+\r?\n/g, "")
    .replace(/a=end-of-candidates\r?\n?/g, "");
const appendRelayCandidate = (sdp, ip, port) => {
    const candidate = `a=candidate:2 1 udp 2122262783 ${ip} ${port} typ host generation 0 network-cost 5`;
    return `${removeIceCandidates(sdp)}${candidate}\r\na=end-of-candidates\r\n`;
};
const buildRemoteRelayAnswer = (offerSdp, info) => {
    const setupLine = info.enableEdgerayDtlsActiveMode ? "a=setup:active" : "a=setup:passive";
    let answerSdp = offerSdp.replace(/a=setup:actpass/g, setupLine);
    answerSdp = replaceIceCredentials(answerSdp, info.authToken ?? info.token, info.key);
    answerSdp = replaceDtlsFingerprint(answerSdp, "sha-256", RELAY_DTLS_FINGERPRINT);
    answerSdp = answerSdp.replace(/a=ice-options:[^\r\n]+\r\n/g, "");
    answerSdp = answerSdp.replace(/a=max-message-size:[^\r\n]+/g, "a=max-message-size:1200");
    return appendRelayCandidate(answerSdp, info.ip, info.port);
};
const toArrayBuffer = (data) => {
    const copy = new Uint8Array(data.byteLength);
    copy.set(data);
    return copy.buffer;
};
const toUint8Array = (data) => {
    if (data instanceof Uint8Array)
        return new Uint8Array(data);
    if (Buffer.isBuffer(data))
        return new Uint8Array(data);
    if (data instanceof ArrayBuffer)
        return new Uint8Array(data);
    if (data && typeof data === "object" && "byteLength" in data && "buffer" in data) {
        const view = data;
        return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    }
    return null;
};
const classifyRelayPacket = (packet) => {
    if (packet.byteLength < 2)
        return "non_stun";
    const bytes = new Uint8Array(packet);
    const first = bytes[0];
    const second = bytes[1];
    if ((first & 0xc0) !== 0)
        return "non_stun";
    const stunType = ((first & 0x3f) << 8) | second;
    if (stunType === 0x0001)
        return "stun_bind";
    if (stunType === 0x0003)
        return "stun_alloc";
    return "stun_unknown";
};
const appendRelayPacketLog = (direction, connection, packet) => {
    if (!RELAY_PACKET_LOG_PATH)
        return;
    const buffer = packet instanceof ArrayBuffer
        ? Buffer.from(new Uint8Array(packet))
        : Buffer.from(packet.buffer, packet.byteOffset, packet.byteLength);
    (0, node_fs_1.appendFileSync)(RELAY_PACKET_LOG_PATH, JSON.stringify({
        ts: new Date().toISOString(),
        direction,
        id: connection.info.id,
        relayId: connection.info.relayId,
        relayName: connection.info.name,
        ip: connection.info.ip,
        rtcPort: connection.info.port,
        voipPort: getVoipStackPort(connection.info),
        size: buffer.byteLength,
        hex: buffer.toString("hex"),
    }) + "\n");
};
class RelayRtcTransport {
    config;
    #relayInfoById = new Map();
    #connections = new Map();
    #totals = createEmptyStats();
    #wrtcPromise = null;
    constructor(config) {
        this.config = config;
    }
    updateRelayList = (update) => {
        const nextInfoById = new Map();
        for (const relay of update.relays ?? []) {
            if (relay.token_id == null || relay.token_id < 0 ||
                relay.token_id >= (update.relay_tokens ?? []).length) {
                continue;
            }
            const authToken = update.auth_tokens && relay.auth_token_id != null && relay.auth_token_id >= 0
                ? update.auth_tokens[relay.auth_token_id]
                : undefined;
            for (const address of relay.addresses ?? []) {
                if (address.protocol !== RELAY_PROTO_UDP)
                    continue;
                if (address.ipv4 && address.port != null) {
                    const clientPort = USE_ORIGINAL_RELAY_PORTS ? address.port : TRUE_WEB_CLIENT_RELAY_PORT;
                    const id = getConnectionIdentifier(address.ipv4, clientPort);
                    nextInfoById.set(id, {
                        id,
                        relayId: relay.relay_id,
                        ip: address.ipv4,
                        port: clientPort,
                        originalPort: address.port,
                        isIPv6: false,
                        token: update.relay_tokens[relay.token_id],
                        authToken,
                        key: update.relay_key,
                        name: relay.relay_name,
                        enableEdgerayDtlsActiveMode: update.enable_edgeray_dtls_active_mode === true,
                    });
                }
                if (!DISABLE_IPV6 && address.ipv6 && address.port_v6 != null) {
                    const clientPort = USE_ORIGINAL_RELAY_PORTS ? address.port_v6 : TRUE_WEB_CLIENT_RELAY_PORT;
                    const id = getConnectionIdentifier(address.ipv6, clientPort);
                    nextInfoById.set(id, {
                        id,
                        relayId: relay.relay_id,
                        ip: address.ipv6,
                        port: clientPort,
                        originalPort: address.port_v6,
                        isIPv6: true,
                        token: update.relay_tokens[relay.token_id],
                        authToken,
                        key: update.relay_key,
                        name: relay.relay_name,
                        enableEdgerayDtlsActiveMode: update.enable_edgeray_dtls_active_mode === true,
                    });
                }
            }
        }
        for (const id of this.#relayInfoById.keys()) {
            if (!nextInfoById.has(id))
                this.#closeConnection(id);
        }
        this.#relayInfoById.clear();
        for (const [id, info] of nextInfoById) {
            this.#relayInfoById.set(id, info);
            void this.#ensureConnection(info);
        }
    };
    send = (packet, ip, port) => {
        const requestedId = getConnectionIdentifier(ip, port);
        const preferredPort = USE_ORIGINAL_RELAY_PORTS ? port : TRUE_WEB_CLIENT_RELAY_PORT;
        const candidateIds = [
            requestedId,
            getConnectionIdentifier(ip, preferredPort),
            getRelayLookupId(ip, TRUE_WEB_CLIENT_RELAY_PORT),
            getRelayLookupId(ip, FAUX_WEB_CLIENT_RELAY_PORT),
        ];
        let info;
        for (const candidateId of candidateIds) {
            info = this.#relayInfoById.get(candidateId);
            if (info)
                break;
        }
        if (!info) {
            if (DISABLE_IPV6 && ip.includes(":"))
                return 0;
            const earlyConnection = this.#getOrCreateEarlyConnection(ip, port);
            bufferPacket(earlyConnection, toArrayBuffer(packet));
            return packet.byteLength;
        }
        const connection = this.#getOrCreateConnection(info);
        const arrayBuffer = toArrayBuffer(packet);
        if (classifyRelayPacket(arrayBuffer) === "stun_alloc" &&
            connection.state === "open" &&
            connection.sentMedia &&
            Date.now() - connection.lastRxPacketTime > ICE_RESTART_IDLE_THRESHOLD_MS) {
            connection.packetBuffer = [];
            connection.bufferedBytes = 0;
            bufferPacket(connection, arrayBuffer);
            void this.#restartIce(connection);
            return packet.byteLength;
        }
        if (connection.state === "open" && connection.dataChannel?.readyState === "open") {
            if (!this.#sendBufferedPacket(connection, arrayBuffer)) {
                connection.stats.droppedPackets += 1;
            }
            return packet.byteLength;
        }
        bufferPacket(connection, arrayBuffer);
        void this.#ensureConnection(info);
        return packet.byteLength;
    };
    getStats = () => {
        let openConnections = 0;
        for (const connection of this.#connections.values()) {
            if (connection.state === "open")
                openConnections += 1;
        }
        return { ...this.#totals, openConnections };
    };
    closeAll = async () => {
        for (const id of [...this.#connections.keys()])
            this.#closeConnection(id);
    };
    // ─── private ──────────────────────────────────────────────────────────────
    #getOrCreateConnection = (info) => {
        const existing = this.#connections.get(info.id);
        if (existing) {
            existing.info = info;
            return existing;
        }
        const created = {
            info, state: "none", peerConnection: null, dataChannel: null,
            iceCandidate: null, packetBuffer: [], bufferedBytes: 0,
            connectPromise: null, connectionTimeout: null, iceStatsInterval: null,
            lastIceRttMs: null, hasReceivedFirstPacket: false,
            hasNonStunPacketSent: false, sentMedia: false, lastRxPacketTime: 0,
            isReconnecting: false, stats: createEmptyStats(),
        };
        this.#connections.set(info.id, created);
        return created;
    };
    #getOrCreateEarlyConnection = (ip, port) => {
        const id = getConnectionIdentifier(ip, port);
        const existing = this.#connections.get(id);
        if (existing)
            return existing;
        const placeholderInfo = {
            id, relayId: 0, ip, port, originalPort: port,
            isIPv6: ip.includes(":"), token: "", key: "",
            name: "early-packet", enableEdgerayDtlsActiveMode: false,
        };
        const created = {
            info: placeholderInfo, state: "none", peerConnection: null,
            dataChannel: null, iceCandidate: null, packetBuffer: [],
            bufferedBytes: 0, connectPromise: null, connectionTimeout: null,
            iceStatsInterval: null, lastIceRttMs: null,
            hasReceivedFirstPacket: false, hasNonStunPacketSent: false,
            sentMedia: false, lastRxPacketTime: 0, isReconnecting: false,
            stats: createEmptyStats(),
        };
        this.#connections.set(id, created);
        return created;
    };
    #ensureConnection = async (info) => {
        const connection = this.#getOrCreateConnection(info);
        if (connection.state === "open" || connection.state === "connecting") {
            return connection.connectPromise ?? Promise.resolve();
        }
        const promise = this.#connect(connection);
        connection.connectPromise = promise;
        try {
            await promise;
        }
        finally {
            connection.connectPromise = null;
        }
    };
    #connect = async (connection) => {
        const wrtcModule = await this.#loadWrtc();
        const { RTCPeerConnection } = wrtcModule;
        if (typeof RTCPeerConnection !== "function") {
            throw new Error("RTCPeerConnection unavailable from @roamhq/wrtc");
        }
        this.#closePeerObjects(connection);
        connection.state = "connecting";
        const pc = new RTCPeerConnection();
        const dc = pc.createDataChannel("pre-negotiated", {
            negotiated: true, id: 0, ordered: false, maxRetransmits: 0, priority: "high",
        });
        connection.peerConnection = pc;
        connection.dataChannel = dc;
        dc.binaryType = "arraybuffer";
        dc.onopen = () => {
            connection.state = "open";
            connection.isReconnecting = false;
            if (connection.connectionTimeout) {
                clearTimeout(connection.connectionTimeout);
                connection.connectionTimeout = null;
            }
            this.#flushBufferedPackets(connection);
            this.#startIceRttPolling(connection);
        };
        dc.onclose = () => {
            if (connection.state !== "failed")
                connection.state = "closed";
        };
        dc.onerror = () => {
            connection.state = "failed";
        };
        dc.onmessage = (event) => {
            this.#handleIncomingPacket(connection, event.data);
        };
        pc.onicecandidate = (event) => {
            if (event.candidate?.candidate && !connection.iceCandidate) {
                connection.iceCandidate = event.candidate.candidate;
            }
        };
        pc.oniceconnectionstatechange = () => {
            if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "closed") {
                connection.state = "failed";
            }
        };
        connection.connectionTimeout = setTimeout(() => {
            if (connection.state === "connecting") {
                connection.state = "failed";
                this.#closePeerObjects(connection);
            }
        }, CONNECTION_TIMEOUT_MS);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const remoteSdp = buildRemoteRelayAnswer(offer.sdp ?? "", {
            ...connection.info,
            port: getRtcConnectPort(connection.info),
        });
        await pc.setRemoteDescription({ type: "answer", sdp: remoteSdp });
    };
    #restartIce = async (connection) => {
        if (connection.isReconnecting || !connection.hasNonStunPacketSent)
            return;
        const { RTCPeerConnection } = await this.#loadWrtc();
        if (typeof RTCPeerConnection !== "function")
            return;
        connection.isReconnecting = true;
        try {
            this.#closePeerObjects(connection);
            connection.state = "connecting";
            const pc = new RTCPeerConnection();
            const dc = pc.createDataChannel("pre-negotiated", {
                negotiated: true, id: 0, ordered: false, maxRetransmits: 0, priority: "high",
            });
            connection.peerConnection = pc;
            connection.dataChannel = dc;
            dc.binaryType = "arraybuffer";
            dc.onopen = () => {
                connection.state = "open";
                connection.isReconnecting = false;
                this.#flushBufferedPackets(connection);
                this.#startIceRttPolling(connection);
            };
            dc.onclose = () => {
                if (connection.state !== "failed")
                    connection.state = "closed";
            };
            dc.onerror = () => { connection.state = "failed"; };
            dc.onmessage = (event) => {
                this.#handleIncomingPacket(connection, event.data);
            };
            pc.onicecandidate = (event) => {
                if (event.candidate?.candidate && !connection.iceCandidate) {
                    connection.iceCandidate = event.candidate.candidate;
                }
            };
            const offer = await pc.createOffer({ iceRestart: false });
            let localSdp = offer.sdp ?? "";
            if (connection.iceCandidate) {
                localSdp = `${removeIceCandidates(localSdp)}a=${connection.iceCandidate}\r\na=end-of-candidates\r\n`;
            }
            await pc.setLocalDescription({ type: "offer", sdp: localSdp });
            const remoteSdp = buildRemoteRelayAnswer(localSdp, {
                ...connection.info,
                port: getRtcConnectPort(connection.info),
            });
            await pc.setRemoteDescription({ type: "answer", sdp: remoteSdp });
        }
        catch {
            connection.state = "failed";
        }
        finally {
            connection.isReconnecting = false;
        }
    };
    #handleIncomingPacket = (connection, raw) => {
        const packet = toUint8Array(raw);
        if (!packet)
            return;
        connection.stats.receivedPackets += 1;
        connection.stats.receivedBytes += packet.byteLength;
        connection.hasReceivedFirstPacket = true;
        connection.lastRxPacketTime = Date.now();
        this.#totals.receivedPackets += 1;
        this.#totals.receivedBytes += packet.byteLength;
        appendRelayPacketLog("recv", connection, packet);
        this.config.onTransportMessage(packet, connection.info.ip, getVoipStackPort(connection.info));
    };
    #flushBufferedPackets = (connection) => {
        while (connection.state === "open" &&
            connection.dataChannel?.readyState === "open" &&
            connection.packetBuffer.length > 0) {
            const packet = shiftPacket(connection);
            if (!packet)
                break;
            if (!this.#sendBufferedPacket(connection, packet)) {
                connection.stats.droppedPackets += 1;
                break;
            }
        }
    };
    #sendBufferedPacket = (connection, packet) => {
        try {
            connection.dataChannel?.send(packet);
            if (classifyRelayPacket(packet) === "non_stun") {
                connection.hasNonStunPacketSent = true;
                connection.sentMedia = true;
            }
            connection.stats.sentPackets += 1;
            connection.stats.sentBytes += packet.byteLength;
            this.#totals.sentPackets += 1;
            this.#totals.sentBytes += packet.byteLength;
            appendRelayPacketLog("send", connection, packet);
            return true;
        }
        catch {
            return false;
        }
    };
    #startIceRttPolling = (connection) => {
        this.#stopIceRttPolling(connection);
        const pc = connection.peerConnection;
        if (!pc || typeof pc.getStats !== "function" || !this.config.onIceRtt)
            return;
        const poll = async () => {
            const rttMs = await this.#readCurrentRoundTripTimeMs(pc);
            if (rttMs == null || connection.lastIceRttMs === rttMs)
                return;
            connection.lastIceRttMs = rttMs;
            this.config.onIceRtt?.(rttMs, connection.info.ip, connection.info.port);
        };
        void poll();
        connection.iceStatsInterval = setInterval(() => { void poll(); }, ICE_RTT_POLL_MS);
        connection.iceStatsInterval.unref?.();
    };
    #stopIceRttPolling = (connection) => {
        if (connection.iceStatsInterval) {
            clearInterval(connection.iceStatsInterval);
            connection.iceStatsInterval = null;
        }
        connection.lastIceRttMs = null;
    };
    #readCurrentRoundTripTimeMs = async (pc) => {
        try {
            const stats = await pc.getStats();
            const reports = stats && typeof stats.values === "function"
                ? Array.from(stats.values())
                : Array.isArray(stats) ? stats : Object.values(stats ?? {});
            if (!reports.length)
                return null;
            let selectedCandidatePairId = "";
            for (const report of reports) {
                if (report?.type === "transport" && typeof report.selectedCandidatePairId === "string") {
                    selectedCandidatePairId = report.selectedCandidatePairId;
                    break;
                }
            }
            const candidatePairs = reports.filter((r) => r?.type === "candidate-pair");
            const selectedPair = (selectedCandidatePairId && candidatePairs.find((r) => r?.id === selectedCandidatePairId)) ||
                candidatePairs.find((r) => r?.selected || r?.nominated) ||
                candidatePairs[0];
            const rttSeconds = typeof selectedPair?.currentRoundTripTime === "number"
                ? selectedPair.currentRoundTripTime
                : typeof selectedPair?.totalRoundTripTime === "number" &&
                    typeof selectedPair?.responsesReceived === "number" &&
                    selectedPair.responsesReceived > 0
                    ? selectedPair.totalRoundTripTime / selectedPair.responsesReceived
                    : null;
            if (rttSeconds == null || !Number.isFinite(rttSeconds) || rttSeconds <= 0)
                return null;
            return Math.max(1, Math.round(rttSeconds * 1000));
        }
        catch {
            return null;
        }
    };
    #closeConnection = (id) => {
        const connection = this.#connections.get(id);
        if (!connection)
            return;
        if (connection.connectionTimeout) {
            clearTimeout(connection.connectionTimeout);
            connection.connectionTimeout = null;
        }
        this.#closePeerObjects(connection);
        connection.state = "closed";
        connection.packetBuffer = [];
        connection.bufferedBytes = 0;
        this.#connections.delete(id);
    };
    #closePeerObjects = (connection) => {
        this.#stopIceRttPolling(connection);
        try {
            connection.dataChannel?.close?.();
        }
        catch { }
        try {
            connection.peerConnection?.close?.();
        }
        catch { }
        connection.dataChannel = null;
        connection.peerConnection = null;
    };
    #loadWrtc = () => {
        this.#wrtcPromise ??= Promise.resolve().then(() => __importStar(require("@roamhq/wrtc"))).then((module) => (module.default ?? module));
        return this.#wrtcPromise;
    };
}
exports.RelayRtcTransport = RelayRtcTransport;

return module.exports;
})();
for (const key of Object.keys(__kageModule105)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule105[key]});
}
