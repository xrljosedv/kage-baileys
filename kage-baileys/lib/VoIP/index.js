"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _createNamedExportFrom(obj, localName, importedName) { Object.defineProperty(exports, localName, {enumerable: true, configurable: true, get: () => obj[importedName]}); } function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }var _nodeevents = require('node:events');
var _nodecrypto = require('node:crypto');

var _wasmenginejs = require('./wasm-engine.js');
var _relaytransportjs = require('./relay-transport.js');
var _signalingjs = require('./signaling.js');
var _audiofeederjs = require('./audio-feeder.js');
var _typesjs = require('./types.js'); _createNamedExportFrom(_typesjs, 'CallState', 'CallState');



const SHA256_LEN = 32;

const toBareJid = (jid) => {
  if (!jid) return jid;
  const at = jid.indexOf("@");
  if (at < 0) return jid;
  const user = jid.slice(0, at).split(":")[0];
  return `${user}@${jid.slice(at + 1)}`;
};

const computeHkdf = (key, salt, info, length) => {
  const effectiveSalt = salt && salt.length > 0 ? Buffer.from(salt) : Buffer.alloc(SHA256_LEN, 0);
  const prk = _nodecrypto.createHmac.call(void 0, "sha256", effectiveSalt).update(key).digest();
  const blocks = Math.ceil(length / SHA256_LEN);
  const okm = Buffer.alloc(blocks * SHA256_LEN);
  let prev = Buffer.alloc(0);
  for (let i = 1; i <= blocks; i += 1) {
    prev = _nodecrypto.createHmac.call(void 0, "sha256", prk)
      .update(prev)
      .update(info)
      .update(Buffer.from([i]))
      .digest();
    prev.copy(okm, (i - 1) * SHA256_LEN);
  }
  return new Uint8Array(okm.buffer, okm.byteOffset, length);
};

const computeHmacSha256 = (data, key) => {
  const result = _nodecrypto.createHmac.call(void 0, "sha256", Buffer.from(key)).update(data).digest();
  return new Uint8Array(result.buffer, result.byteOffset, result.byteLength);
};

const isCallReceiptNode = (node) => {
  if (_optionalChain([node, 'optionalAccess', _ => _.tag]) !== "receipt") return false;
  const child = Array.isArray(node.content) ? node.content[0] : null;
  return !!(_optionalChain([child, 'optionalAccess', _2 => _2.attrs, 'optionalAccess', _3 => _3["call-id"]]) || _optionalChain([child, 'optionalAccess', _4 => _4.attrs, 'optionalAccess', _5 => _5.call_id]));
};

 class ActiveCall extends _nodeevents.EventEmitter {
  #state = _typesjs.CallState.Idle;
  #endResolver;
  #endPromise;
  #endTimer = null;
  #ended = false;
  #hasBeenActive = false;
  __init() {this._audioSource = "silence"}

  constructor(callId, engine, durationMs) {
    super();ActiveCall.prototype.__init.call(this);ActiveCall.prototype.__init2.call(this);ActiveCall.prototype.__init3.call(this);ActiveCall.prototype.__init4.call(this);ActiveCall.prototype.__init5.call(this);ActiveCall.prototype.__init6.call(this);ActiveCall.prototype.__init7.call(this);;
    this.callId = callId;
    this.engine = engine;
    this.#endPromise = new Promise((res) => { this.#endResolver = res; });
    if (durationMs > 0) {
      this.#endTimer = setTimeout(() => this.end(), durationMs);
    }
  }

  get state() { return this.#state; }

  __init2() {this.end = () => {
    if (this.#ended) return;
    this.#ended = true;
    if (this.#endTimer) { clearTimeout(this.#endTimer); this.#endTimer = null; }
    try { this.engine.endCall(0, true); } catch (e3) {}
  }}

  __init3() {this.mute = (muted) => {
    try { this.engine.setMute(muted); } catch (e4) {}
  }}

  __init4() {this.waitForEnd = () => this.#endPromise}

  __init5() {this._updateState = (state) => {
    this.#state = state;
    if (state === _typesjs.CallState.Calling || state === _typesjs.CallState.PreacceptReceived || state === _typesjs.CallState.Active) {
      this.#hasBeenActive = true;
    }
    if (state === _typesjs.CallState.PreacceptReceived) this.emit("ringing");
    else if (state === _typesjs.CallState.Active) this.emit("connected");
    else if (this.#hasBeenActive && (state === _typesjs.CallState.Idle || state === _typesjs.CallState.Ending)) {
      this._forceEnd("ended");
    }
  }}

  __init6() {this._emitAudio = (pcm) => { this.emit("audio", pcm); }}

  __init7() {this._forceEnd = (reason) => {
    if (this.#ended) return;
    this.#ended = true;
    if (this.#endTimer) { clearTimeout(this.#endTimer); this.#endTimer = null; }
    this.emit("ended", reason);
    this.#endResolver(reason);
  }}
} exports.ActiveCall = ActiveCall;

 class VoipClient {
  #config;
  #engine = null;
  #relay = null;
  #signaling = null;
  #sock = null;
  #activeCall = null;
  #capturePtr = 0;
  #captureChunkBytes = 0;
  #captureSampleRate = 16000;
  #captureChannels = 1;
  #captureFramesPerChunk = 320;
  #feeder = null;

  constructor(config = {}) {;VoipClient.prototype.__init8.call(this);VoipClient.prototype.__init9.call(this);VoipClient.prototype.__init10.call(this);
    this.#config = config;
  }

  __init8() {this.connectWithSocket = async (existingSock) => {
    this.#sock = existingSock;
    await this.#initVoipStack();
  }}

  #initVoipStack = async () => {
    this.#signaling = new (0, _signalingjs.SignalingBridge)({ sock: this.#sock });
    await this.#signaling.init();

    this.#relay = new (0, _relaytransportjs.RelayRtcTransport)({
      onTransportMessage: (data, ip, port) => _optionalChain([this, 'access', _15 => _15.#engine, 'optionalAccess', _16 => _16.handleOnTransportMessage, 'call', _17 => _17(data, ip, port)]),
      onIceRtt: (rttMs, ip, port) => _optionalChain([this, 'access', _18 => _18.#engine, 'optionalAccess', _19 => _19.updateIceRtt, 'call', _20 => _20(rttMs, ip, port)]),
    });

    this.#engine = new (0, _wasmenginejs.WasmEngine)({
      resourcesPath: this.#config.resourcesPath,
      callbacks: {
        onSignalingXmpp: (peerJid, callId, xmlPayload) =>
          this.#signaling.sendSignaling(peerJid, callId, xmlPayload),
        onCallEvent: (eventType, eventData) => this.#handleCallEvent(eventType, eventData),
        sendDataToRelay: (data, ip, port) => this.#relay.send(data, ip, port),
        onAudioCaptureInit: (config) => this.#handleAudioCaptureInit(config),
        onAudioCaptureStart: () => this.#handleAudioCaptureStart(),
        onAudioCaptureStop: () => this.#handleAudioCaptureStop(),
        onAudioPlaybackData: (audioData) => _optionalChain([this, 'access', _21 => _21.#activeCall, 'optionalAccess', _22 => _22._emitAudio, 'call', _23 => _23(audioData)]),
        cryptoHkdf: computeHkdf,
        hmacSha256: computeHmacSha256,
      },
    });

    await this.#engine.initialize();
    this.#signaling.attachEngine(this.#engine);

    const selfPnJid = _optionalChain([this, 'access', _24 => _24.#sock, 'access', _25 => _25.authState, 'access', _26 => _26.creds, 'access', _27 => _27.me, 'optionalAccess', _28 => _28.id]);
    const selfLidJid = _optionalChain([this, 'access', _29 => _29.#sock, 'access', _30 => _30.authState, 'access', _31 => _31.creds, 'access', _32 => _32.me, 'optionalAccess', _33 => _33.lid]);
    this.#engine.initVoipStack(selfPnJid, toBareJid(selfPnJid), selfLidJid);
    await this.#engine.waitForVoipStackReady();
    try { this.#engine.updateNetworkMedium(2, 0); } catch (e6) {}

    this.#sock.ws.on("CB:call", (node) => {
      this.#signaling.processIncomingCall(node, this.#engine, _nullishCoalesce(_optionalChain([this, 'access', _34 => _34.#activeCall, 'optionalAccess', _35 => _35.callId]), () => ( "")));
    });
    this.#sock.ws.on("CB:receipt", (node) => {
      if (!isCallReceiptNode(node)) return;
      this.#signaling.processIncomingReceipt(node, this.#engine, _nullishCoalesce(_optionalChain([this, 'access', _36 => _36.#activeCall, 'optionalAccess', _37 => _37.callId]), () => ( "")));
    });
  };

  __init9() {this.call = async (phoneNumber, opts = {}) => {
    if (!this.#engine || !this.#signaling) throw new Error("Not connected. Call connectWithSocket() first.");
    if (this.#activeCall) throw new Error("A call is already active.");

    const targetNumber = phoneNumber.replace(/\D/g, "");
    const targetPnJid = `${targetNumber}@s.whatsapp.net`;
    const durationMs = _nullishCoalesce(opts.durationMs, () => ( 120000));
    const audioSource = _nullishCoalesce(opts.audioSource, () => ( "silence"));

    const peerLid = await this.#signaling.resolveLid(targetPnJid);
    if (!peerLid) throw new Error(`Could not resolve LID for ${targetPnJid}`);

    for (const jid of [targetPnJid, peerLid]) {
      try { await this.#sock.presenceSubscribe(jid); } catch (e7) {}
    }
    await new Promise((r) => setTimeout(r, 750));

    const peerDeviceJids = await this.#signaling.discoverPeerDevices(peerLid);
    const deviceList = peerDeviceJids.length ? peerDeviceJids : [toBareJid(peerLid)];

    const allSessionTargets = [...new Set([...deviceList, peerLid, toBareJid(peerLid), targetPnJid, toBareJid(targetPnJid)])];
    await this.#signaling.ensureSessionsForPeers(allSessionTargets);

    await new Promise((r) => setTimeout(r, 500));
    await this.#signaling.issueTcToken(peerLid);
    const tcToken = await this.#signaling.ensureTcToken(peerLid, targetPnJid);

    const callId = ("00" + _nodecrypto.randomBytes.call(void 0, 16).toString("hex").slice(2)).toUpperCase();

    const call = new ActiveCall(callId, this.#engine, durationMs);
    call._audioSource = audioSource;
    this.#activeCall = call;

    this.#engine.startCall({
      peerJid: peerLid,
      peerPn: targetPnJid,
      peerList: deviceList,
      callId,
      isVideo: false,
      isLidCall: true,
      isFromDialer: false,
      extraData: tcToken,
    });

    return call;
  }}

  __init10() {this.disconnect = () => {
    _optionalChain([this, 'access', _38 => _38.#activeCall, 'optionalAccess', _39 => _39._forceEnd, 'call', _40 => _40("disconnect")]);
    this.#activeCall = null;
    _optionalChain([this, 'access', _41 => _41.#relay, 'optionalAccess', _42 => _42.closeAll, 'call', _43 => _43()]);
    _optionalChain([this, 'access', _44 => _44.#engine, 'optionalAccess', _45 => _45.destroy, 'call', _46 => _46()]);
    this.#engine = null;
    this.#relay = null;
    this.#signaling = null;
    this.#sock = null;
  }}

  #handleCallEvent = (eventType, eventData) => {
    if (eventType === 16 && eventData) {
      try {
        const parsed = JSON.parse(eventData);
        const info = _nullishCoalesce(_nullishCoalesce(parsed.call_info, () => ( parsed.callInfo)), () => ( {}));
        const callState = Number(_nullishCoalesce(_nullishCoalesce(info.call_state, () => ( info.callState)), () => ( 0)));
        _optionalChain([this, 'access', _47 => _47.#activeCall, 'optionalAccess', _48 => _48._updateState, 'call', _49 => _49(callState)]);
      } catch (e8) {}
    } else if (eventType === 156 && eventData) {
      try {
        const update = JSON.parse(eventData);
        _optionalChain([this, 'access', _50 => _50.#relay, 'optionalAccess', _51 => _51.updateRelayList, 'call', _52 => _52(update)]);
      } catch (e9) {}
    } else if (eventType === 2) {
      _optionalChain([this, 'access', _53 => _53.#activeCall, 'optionalAccess', _54 => _54._forceEnd, 'call', _55 => _55("remote_end")]);
    }
  };

  #handleAudioCaptureInit = (config) => {
    if (!this.#engine) return;
    this.#captureSampleRate = config.sampleRate || 16000;
    this.#captureChannels = config.channels || 1;
    this.#captureFramesPerChunk = config.framesPerChunk || 320;
    const chunkSamples = this.#captureFramesPerChunk * this.#captureChannels;
    this.#captureChunkBytes = chunkSamples * Float32Array.BYTES_PER_ELEMENT;
    this.#capturePtr = this.#engine.malloc(this.#captureChunkBytes);
  };

  #handleAudioCaptureStart = () => {
    if (!this.#engine || !this.#capturePtr) return;
    const audioSource = _nullishCoalesce(_optionalChain([this, 'access', _56 => _56.#activeCall, 'optionalAccess', _57 => _57._audioSource]), () => ( "silence"));
    this.#feeder = new (0, _audiofeederjs.AudioFeeder)(
      this.#captureSampleRate,
      this.#captureChannels,
      this.#captureFramesPerChunk,
      (chunk) => {
        if (this.#engine && this.#capturePtr) this.#engine.sendAudioData(chunk, this.#capturePtr);
      },
      audioSource,
    );
    this.#feeder.start();
  };

  #handleAudioCaptureStop = () => {
    _optionalChain([this, 'access', _58 => _58.#feeder, 'optionalAccess', _59 => _59.stop, 'call', _60 => _60()]);
    this.#feeder = null;
    if (this.#engine && this.#capturePtr) {
      try { this.#engine.free(this.#capturePtr); } catch (e10) {}
      this.#capturePtr = 0;
    }
  };
} exports.VoipClient = VoipClient;

 
const __kageModule104 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoipClient = exports.ActiveCall = exports.CallState = void 0;
const node_events_1 = require("node:events");
const node_crypto_1 = require("node:crypto");
const wasm_engine_js_1 = require("./wasm-engine.js");
const relay_transport_js_1 = require("./relay-transport.js");
const signaling_js_1 = require("./signaling.js");
const audio_feeder_js_1 = require("./audio-feeder.js");
const types_js_1 = require("./types.js");
var types_js_2 = require("./types.js");
Object.defineProperty(exports, "CallState", { enumerable: true, get: function () { return types_js_2.CallState; } });
const SHA256_LEN = 32;
const toBareJid = (jid) => {
    if (!jid)
        return jid;
    const at = jid.indexOf("@");
    if (at < 0)
        return jid;
    const user = jid.slice(0, at).split(":")[0];
    return `${user}@${jid.slice(at + 1)}`;
};
const computeHkdf = (key, salt, info, length) => {
    const effectiveSalt = salt && salt.length > 0 ? Buffer.from(salt) : Buffer.alloc(SHA256_LEN, 0);
    const prk = (0, node_crypto_1.createHmac)("sha256", effectiveSalt).update(key).digest();
    const blocks = Math.ceil(length / SHA256_LEN);
    const okm = Buffer.alloc(blocks * SHA256_LEN);
    let prev = Buffer.alloc(0);
    for (let i = 1; i <= blocks; i += 1) {
        prev = (0, node_crypto_1.createHmac)("sha256", prk)
            .update(prev)
            .update(info)
            .update(Buffer.from([i]))
            .digest();
        prev.copy(okm, (i - 1) * SHA256_LEN);
    }
    return new Uint8Array(okm.buffer, okm.byteOffset, length);
};
const computeHmacSha256 = (data, key) => {
    const result = (0, node_crypto_1.createHmac)("sha256", Buffer.from(key)).update(data).digest();
    return new Uint8Array(result.buffer, result.byteOffset, result.byteLength);
};
const isCallReceiptNode = (node) => {
    if (node?.tag !== "receipt")
        return false;
    const child = Array.isArray(node.content) ? node.content[0] : null;
    return !!(child?.attrs?.["call-id"] || child?.attrs?.call_id);
};
class ActiveCall extends node_events_1.EventEmitter {
    #state = types_js_1.CallState.Idle;
    #endResolver;
    #endPromise;
    #endTimer = null;
    #ended = false;
    #hasBeenActive = false;
    _audioSource = "silence";
    constructor(callId, engine, durationMs) {
        super();
        this.callId = callId;
        this.engine = engine;
        this.#endPromise = new Promise((res) => { this.#endResolver = res; });
        if (durationMs > 0) {
            this.#endTimer = setTimeout(() => this.end(), durationMs);
        }
    }
    get state() { return this.#state; }
    end = () => {
        if (this.#ended)
            return;
        this.#ended = true;
        if (this.#endTimer) {
            clearTimeout(this.#endTimer);
            this.#endTimer = null;
        }
        try {
            this.engine.endCall(0, true);
        }
        catch { }
    };
    mute = (muted) => {
        try {
            this.engine.setMute(muted);
        }
        catch { }
    };
    waitForEnd = () => this.#endPromise;
    _updateState = (state) => {
        this.#state = state;
        if (state === types_js_1.CallState.Calling || state === types_js_1.CallState.PreacceptReceived || state === types_js_1.CallState.Active) {
            this.#hasBeenActive = true;
        }
        if (state === types_js_1.CallState.PreacceptReceived)
            this.emit("ringing");
        else if (state === types_js_1.CallState.Active)
            this.emit("connected");
        else if (this.#hasBeenActive && (state === types_js_1.CallState.Idle || state === types_js_1.CallState.Ending)) {
            this._forceEnd("ended");
        }
    };
    _emitAudio = (pcm) => { this.emit("audio", pcm); };
    _forceEnd = (reason) => {
        if (this.#ended)
            return;
        this.#ended = true;
        if (this.#endTimer) {
            clearTimeout(this.#endTimer);
            this.#endTimer = null;
        }
        this.emit("ended", reason);
        this.#endResolver(reason);
    };
}
exports.ActiveCall = ActiveCall;
class VoipClient {
    #config;
    #engine = null;
    #relay = null;
    #signaling = null;
    #sock = null;
    #activeCall = null;
    #capturePtr = 0;
    #captureChunkBytes = 0;
    #captureSampleRate = 16000;
    #captureChannels = 1;
    #captureFramesPerChunk = 320;
    #feeder = null;
    constructor(config = {}) {
        this.#config = config;
    }
    connectWithSocket = async (existingSock) => {
        this.#sock = existingSock;
        await this.#initVoipStack();
    };
    #initVoipStack = async () => {
        this.#signaling = new signaling_js_1.SignalingBridge({ sock: this.#sock });
        await this.#signaling.init();
        this.#relay = new relay_transport_js_1.RelayRtcTransport({
            onTransportMessage: (data, ip, port) => this.#engine?.handleOnTransportMessage(data, ip, port),
            onIceRtt: (rttMs, ip, port) => this.#engine?.updateIceRtt(rttMs, ip, port),
        });
        this.#engine = new wasm_engine_js_1.WasmEngine({
            resourcesPath: this.#config.resourcesPath,
            callbacks: {
                onSignalingXmpp: (peerJid, callId, xmlPayload) => this.#signaling.sendSignaling(peerJid, callId, xmlPayload),
                onCallEvent: (eventType, eventData) => this.#handleCallEvent(eventType, eventData),
                sendDataToRelay: (data, ip, port) => this.#relay.send(data, ip, port),
                onAudioCaptureInit: (config) => this.#handleAudioCaptureInit(config),
                onAudioCaptureStart: () => this.#handleAudioCaptureStart(),
                onAudioCaptureStop: () => this.#handleAudioCaptureStop(),
                onAudioPlaybackData: (audioData) => this.#activeCall?._emitAudio(audioData),
                cryptoHkdf: computeHkdf,
                hmacSha256: computeHmacSha256,
            },
        });
        await this.#engine.initialize();
        this.#signaling.attachEngine(this.#engine);
        const selfPnJid = this.#sock.authState.creds.me?.id;
        const selfLidJid = this.#sock.authState.creds.me?.lid;
        this.#engine.initVoipStack(selfPnJid, toBareJid(selfPnJid), selfLidJid);
        await this.#engine.waitForVoipStackReady();
        try {
            this.#engine.updateNetworkMedium(2, 0);
        }
        catch { }
        this.#sock.ws.on("CB:call", (node) => {
            this.#signaling.processIncomingCall(node, this.#engine, this.#activeCall?.callId ?? "");
        });
        this.#sock.ws.on("CB:receipt", (node) => {
            if (!isCallReceiptNode(node))
                return;
            this.#signaling.processIncomingReceipt(node, this.#engine, this.#activeCall?.callId ?? "");
        });
    };
    call = async (phoneNumber, opts = {}) => {
        if (!this.#engine || !this.#signaling)
            throw new Error("Not connected. Call connectWithSocket() first.");
        if (this.#activeCall)
            throw new Error("A call is already active.");
        const targetNumber = phoneNumber.replace(/\D/g, "");
        const targetPnJid = `${targetNumber}@s.whatsapp.net`;
        const durationMs = opts.durationMs ?? 120_000;
        const audioSource = opts.audioSource ?? "silence";
        const peerLid = await this.#signaling.resolveLid(targetPnJid);
        if (!peerLid)
            throw new Error(`Could not resolve LID for ${targetPnJid}`);
        for (const jid of [targetPnJid, peerLid]) {
            try {
                await this.#sock.presenceSubscribe(jid);
            }
            catch { }
        }
        await new Promise((r) => setTimeout(r, 750));
        const peerDeviceJids = await this.#signaling.discoverPeerDevices(peerLid);
        const deviceList = peerDeviceJids.length ? peerDeviceJids : [toBareJid(peerLid)];
        const allSessionTargets = [...new Set([...deviceList, peerLid, toBareJid(peerLid), targetPnJid, toBareJid(targetPnJid)])];
        await this.#signaling.ensureSessionsForPeers(allSessionTargets);
        await new Promise((r) => setTimeout(r, 500));
        await this.#signaling.issueTcToken(peerLid);
        const tcToken = await this.#signaling.ensureTcToken(peerLid, targetPnJid);
        const callId = ("00" + (0, node_crypto_1.randomBytes)(16).toString("hex").slice(2)).toUpperCase();
        const call = new ActiveCall(callId, this.#engine, durationMs);
        call._audioSource = audioSource;
        this.#activeCall = call;
        this.#engine.startCall({
            peerJid: peerLid,
            peerPn: targetPnJid,
            peerList: deviceList,
            callId,
            isVideo: false,
            isLidCall: true,
            isFromDialer: false,
            extraData: tcToken,
        });
        return call;
    };
    disconnect = () => {
        this.#activeCall?._forceEnd("disconnect");
        this.#activeCall = null;
        this.#relay?.closeAll();
        this.#engine?.destroy();
        this.#engine = null;
        this.#relay = null;
        this.#signaling = null;
        this.#sock = null;
    };
    #handleCallEvent = (eventType, eventData) => {
        if (eventType === 16 && eventData) {
            try {
                const parsed = JSON.parse(eventData);
                const info = parsed.call_info ?? parsed.callInfo ?? {};
                const callState = Number(info.call_state ?? info.callState ?? 0);
                this.#activeCall?._updateState(callState);
            }
            catch { }
        }
        else if (eventType === 156 && eventData) {
            try {
                const update = JSON.parse(eventData);
                this.#relay?.updateRelayList(update);
            }
            catch { }
        }
        else if (eventType === 2) {
            this.#activeCall?._forceEnd("remote_end");
        }
    };
    #handleAudioCaptureInit = (config) => {
        if (!this.#engine)
            return;
        this.#captureSampleRate = config.sampleRate || 16000;
        this.#captureChannels = config.channels || 1;
        this.#captureFramesPerChunk = config.framesPerChunk || 320;
        const chunkSamples = this.#captureFramesPerChunk * this.#captureChannels;
        this.#captureChunkBytes = chunkSamples * Float32Array.BYTES_PER_ELEMENT;
        this.#capturePtr = this.#engine.malloc(this.#captureChunkBytes);
    };
    #handleAudioCaptureStart = () => {
        if (!this.#engine || !this.#capturePtr)
            return;
        const audioSource = this.#activeCall?._audioSource ?? "silence";
        this.#feeder = new audio_feeder_js_1.AudioFeeder(this.#captureSampleRate, this.#captureChannels, this.#captureFramesPerChunk, (chunk) => {
            if (this.#engine && this.#capturePtr)
                this.#engine.sendAudioData(chunk, this.#capturePtr);
        }, audioSource);
        this.#feeder.start();
    };
    #handleAudioCaptureStop = () => {
        this.#feeder?.stop();
        this.#feeder = null;
        if (this.#engine && this.#capturePtr) {
            try {
                this.#engine.free(this.#capturePtr);
            }
            catch { }
            this.#capturePtr = 0;
        }
    };
}
exports.VoipClient = VoipClient;

return module.exports;
})();
for (const key of Object.keys(__kageModule104)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule104[key]});
}
