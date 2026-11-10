"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { newObj[key] = obj[key]; } } } newObj.default = obj; return newObj; } } function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; } var _class; var _class2;var _a;
 








var _nodevm = require('node:vm'); var vm = _interopRequireWildcard(_nodevm);
var _nodefs = require('node:fs'); var fs = _interopRequireWildcard(_nodefs);
var _nodepath = require('node:path'); var path = _interopRequireWildcard(_nodepath);
var _nodecrypto = require('node:crypto');
var _nodeworker_threads = require('node:worker_threads');
var _nodeurl = require('node:url');
const CALL_WASM_AB_PROPS_JSON = _nullishCoalesce(process.env.CALL_WASM_AB_PROPS_JSON, () => ( ""));
const PTHREAD_POOL_SIZE = 20;
const VOIP_READY_TIMEOUT_MS = 15000;
const parseJsonObjectEnv = (raw) => {
    if (!raw)
        return {};
    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
            return parsed;
    }
    catch (e2) { }
    return {};
};
const toByteArray = (input) => {
    if (!input)
        return new Uint8Array(0);
    if (input instanceof Uint8Array)
        return input;
    if (typeof input === "string")
        return new TextEncoder().encode(input);
    if (ArrayBuffer.isView(input))
        return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    if (input instanceof ArrayBuffer)
        return new Uint8Array(input);
    if (typeof input === "object" && typeof input.length === "number") {
        const arr = new Uint8Array(input.length);
        for (let i = 0; i < input.length; i += 1)
            arr[i] = _nullishCoalesce(input[i], () => ( 0));
        return arr;
    }
    return new Uint8Array(0);
};
const filterWorkerStderr = (chunk) => {
    const line = chunk.toString().trim();
    if (line && !line.startsWith("voip:") && !line.startsWith("still waiting")) {
        process.stderr.write(chunk);
    }
};
const resolveWorkerScriptPath = () => {
    const compiled = path.join(__dirname, "worker-bootstrap.js");
    return fs.existsSync(compiled) ? compiled : path.join(__dirname, "worker-bootstrap.mts");
};
class NodeWorkerMessagePort {
    #listeners = new Map();
    #worker;
    
    
    __init() {this.workerID = 0}
    __init2() {this.pthread_ptr = 0}
    constructor(worker, name = "WAWebVoipWebWasmWorker") {;NodeWorkerMessagePort.prototype.__init.call(this);NodeWorkerMessagePort.prototype.__init2.call(this);NodeWorkerMessagePort.prototype.__init3.call(this);NodeWorkerMessagePort.prototype.__init4.call(this);NodeWorkerMessagePort.prototype.__init5.call(this);NodeWorkerMessagePort.prototype.__init6.call(this);NodeWorkerMessagePort.prototype.__init7.call(this);NodeWorkerMessagePort.prototype.__init8.call(this);NodeWorkerMessagePort.prototype.__init9.call(this);NodeWorkerMessagePort.prototype.__init10.call(this);
        this.#worker = worker;
        this.name = name;
        this.fullyConnected = new Promise((resolve) => {
            const loadedHandler = (msg) => {
                if (msg && msg.cmd === "loaded") {
                    this.workerID = _nullishCoalesce(msg.workerID, () => ( 0));
                    resolve(this);
                }
            };
            this.addMessageListener("cmd", loadedHandler);
        });
        if (typeof worker.on === "function") {
            worker.on("message", (data) => this.#handleMessage(data));
            worker.on("error", () => { });
        }
        else if (typeof worker.addEventListener === "function") {
            worker.addEventListener("message", (ev) => this.#handleMessage(_nullishCoalesce(_optionalChain([ev, 'optionalAccess', _11 => _11.data]), () => ( ev))));
        }
    }
    __init3() {this.postMessage = (msg, transferList) => {
        const out = msg && typeof msg === "object" && msg.cmd && !msg.type ? { ...msg, type: "cmd" } : msg;
        this.#worker.postMessage(out, transferList);
    }}
    __init4() {this.addMessageListener = (type, handler) => {
        let set = this.#listeners.get(type);
        if (!set) {
            set = new Set();
            this.#listeners.set(type, set);
        }
        set.add(handler);
        return handler;
    }}
    __init5() {this.removeMessageListener = (type, handler) => _nullishCoalesce(_optionalChain([this, 'access', _12 => _12.#listeners, 'access', _13 => _13.get, 'call', _14 => _14(type), 'optionalAccess', _15 => _15.delete, 'call', _16 => _16(handler)]), () => ( false))}
    __init6() {this.removeAllMessageListeners = (type) => {
        if (type)
            _optionalChain([this, 'access', _17 => _17.#listeners, 'access', _18 => _18.get, 'call', _19 => _19(type), 'optionalAccess', _20 => _20.clear, 'call', _21 => _21()]);
        else
            this.#listeners.clear();
    }}
    __init7() {this.terminate = () => { this.#worker.terminate(); }}
    __init8() {this.close = () => { }}
    __init9() {this.isWrappingVirtualMessagePort = () => false}
    __init10() {this.getWorker = () => this.#worker}
    #handleMessage = (data) => {
        if (!data || typeof data !== "object")
            return;
        if (data.type === "callback" || data.type === "waWasmWorkerCompatibleCallback") {
            let callbackName;
            let callbackArgs;
            if (data.__name) {
                callbackName = data.__name;
                callbackArgs = {};
                for (const key in data) {
                    if (key !== "type" && key !== "__name" && key !== "prototype" && key !== "args" && !key.startsWith("__")) {
                        callbackArgs[key] = data[key];
                    }
                }
            }
            else if (data.name) {
                callbackName = data.name;
                callbackArgs = _nullishCoalesce(data.args, () => ( {}));
            }
            else if (_optionalChain([data, 'access', _22 => _22.payload, 'optionalAccess', _23 => _23.name])) {
                callbackName = data.payload.name;
                callbackArgs = _nullishCoalesce(data.payload.args, () => ( {}));
            }
            else {
                return;
            }
            if (callbackName === "onSignalingXmpp" &&
                (!callbackArgs || Object.keys(callbackArgs).length === 0)) {
                callbackArgs = {
                    peerJid: data.peerJid, callId: data.callId, xmlPayload: data.xmlPayload,
                };
            }
            let listenerData = callbackArgs;
            if (!callbackArgs || Object.keys(callbackArgs).length === 0 ||
                (Object.keys(callbackArgs).length === 1 && callbackArgs.prototype)) {
                listenerData = {};
                for (const key in data) {
                    if (key !== "type" && key !== "__name" && key !== "prototype" && key !== "args" && !key.startsWith("__")) {
                        listenerData[key] = data[key];
                    }
                }
            }
            else if (callbackName === "sendDataToRelay") {
                listenerData = { ...callbackArgs };
                if (data.data !== undefined)
                    listenerData.data = data.data;
                if (data.len !== undefined)
                    listenerData.len = data.len;
                if (data.ip !== undefined)
                    listenerData.ip = data.ip;
                if (data.port !== undefined)
                    listenerData.port = data.port;
            }
            else if (callbackName === "onCallEvent") {
                listenerData = { ...callbackArgs };
                if (data.eventType !== undefined)
                    listenerData.eventType = data.eventType;
                if (data.userData !== undefined)
                    listenerData.userData = data.userData;
                if (data.eventDataJson !== undefined)
                    listenerData.eventDataJson = data.eventDataJson;
            }
            WasmEngine.notifyGlobalCallbackListeners(callbackName, listenerData);
            return;
        }
        const dispatch = (key) => {
            if (!key)
                return;
            for (const handler of _nullishCoalesce(this.#listeners.get(key), () => ( []))) {
                try {
                    handler(data);
                }
                catch (e3) { }
            }
        };
        dispatch(data.type);
        if (data.cmd !== data.type)
            dispatch(data.cmd);
    };
}
 class WasmEngine {
    static #globalCallbackListeners = new Map();
    static #globalCallbacksRegistered = false;
    static __initStatic() {this.registerGlobalCallbackListener = (callbackName, handler) => {
        const key = `callback:${callbackName}`;
        let set = _a.#globalCallbackListeners.get(key);
        if (!set) {
            set = new Set();
            _a.#globalCallbackListeners.set(key, set);
        }
        set.add(handler);
    }}
    static __initStatic2() {this.notifyGlobalCallbackListeners = (callbackName, data) => {
        const set = _a.#globalCallbackListeners.get(`callback:${callbackName}`);
        if (!set)
            return;
        for (const handler of set) {
            try {
                handler(data);
            }
            catch (e10) { }
        }
    }}
    #config;
    #instance = null;
    #initialized = false;
    #moduleRegistry = new Map();
    #vmContext = null;
    #unusedWorkers = [];
    #runningWorkers = [];
    #pthreads = {};
    #nextWorkerID = 1;
    #wasmModule = null;
    #wasmMemory = null;
    #removeRunDependencyCallback = null;
    #workersLoadedCount = 0;
    #audioPlaybackLoopInterval = null;
    #audioPlaybackBuffer = null;
    #isPlaybackActive = false;
    #voipStackInitialized = false;
    #voipStackInitPromise = null;
    #voipReadyResolver = null;
    #voipReadyPromise = null;
    #workerModulesCode = "";
    #loaderCode = "";
    constructor(config = {}) {;WasmEngine.prototype.__init11.call(this);WasmEngine.prototype.__init12.call(this);WasmEngine.prototype.__init13.call(this);WasmEngine.prototype.__init14.call(this);WasmEngine.prototype.__init15.call(this);WasmEngine.prototype.__init16.call(this);WasmEngine.prototype.__init17.call(this);WasmEngine.prototype.__init18.call(this);WasmEngine.prototype.__init19.call(this);WasmEngine.prototype.__init20.call(this);WasmEngine.prototype.__init21.call(this);WasmEngine.prototype.__init22.call(this);WasmEngine.prototype.__init23.call(this);WasmEngine.prototype.__init24.call(this);WasmEngine.prototype.__init25.call(this);WasmEngine.prototype.__init26.call(this);WasmEngine.prototype.__init27.call(this);WasmEngine.prototype.__init28.call(this);WasmEngine.prototype.__init29.call(this);
        const basePath = config.resourcesPath
            ? (path.isAbsolute(config.resourcesPath) ? config.resourcesPath : path.resolve(process.cwd(), config.resourcesPath))
            : path.resolve(__dirname, "..");
        const wasmPath = config.wasmPath
            ? (path.isAbsolute(config.wasmPath) ? config.wasmPath : path.resolve(process.cwd(), config.wasmPath))
            : path.join(basePath, "assets", "wasm", "whatsapp.wasm");
        this.#config = {
            ...config,
            wasmPath,
            resourcesPath: basePath,
            enableLogs: _nullishCoalesce(config.enableLogs, () => ( true)),
            options: {
                heartbeatInterval: 30,
                lobbyTimeout: 1,
                maxParticipantsScreenShare: 32,
                maxGroupSizeLongRingtone: 32,
                ...config.options,
            },
        };
    }
    __init11() {this.initialize = async () => {
        if (this.#initialized)
            throw new Error("WasmEngine already initialized");
        const voipStorageDir = "/tmp/voip";
        try {
            if (!fs.existsSync(voipStorageDir))
                fs.mkdirSync(voipStorageDir, { recursive: true });
        }
        catch (e11) { }
        const loaderFile = path.join(this.#config.resourcesPath, "assets", "wasm", "loader.js");
        const workerFile = path.join(this.#config.resourcesPath, "assets", "wasm", "worker-modules.js");
        if (!this.#config.wasmBinary && !fs.existsSync(this.#config.wasmPath)) {
            throw new Error(`WASM file not found: ${this.#config.wasmPath}`);
        }
        const wasmBuffer = this.#config.wasmBinary
            ? Buffer.from(this.#config.wasmBinary)
            : fs.readFileSync(this.#config.wasmPath);
        const diskWorkerCode = fs.existsSync(workerFile) ? fs.readFileSync(workerFile, "utf8") : "";
        this.#workerModulesCode = _nullishCoalesce(this.#config.workerModulesCode, () => ( diskWorkerCode));
        const workerBundleHasLoader = typeof this.#workerModulesCode === "string" && /WAWebVoipWebWasmLoader/.test(this.#workerModulesCode);
         
         
         
        this.#loaderCode = _nullishCoalesce(this.#config.loaderCode, () => (
            (workerBundleHasLoader ? "" : fs.existsSync(loaderFile) ? fs.readFileSync(loaderFile, "utf8") : "")));
        if (!this.#loaderCode && !this.#workerModulesCode) {
            throw new Error("No loader/worker code available to initialize VoIP");
        }
        const memory = new WebAssembly.Memory({ initial: 256, maximum: 32768, shared: true });
        this.#wasmMemory = memory;
        this.#wasmModule = await WebAssembly.compile(wasmBuffer);
        this.#vmContext = this.#createVMContext(memory);
        const runModuleCode = (code) => { if (code)
            vm.runInContext(code, this.#vmContext); };
        runModuleCode(this.#workerModulesCode);
        runModuleCode(this.#loaderCode);
        this.#vmContext.WAWebVoipWebWasmWorkerResource = this.#requireModule("WAWebVoipWebWasmWorkerResource");
        const loaderModuleNames = [
            this.#config.loaderModuleName,
            "WAWebVoipWebWasmLoader",
            "WAWebVoipWebWasmLoader.worker",
            "WAWebVoipWebWasmLoader_ProdLab_internal.worker",
            "WAWebVoipWebWasmLoader_ProdLabvideo_internal.worker",
        ].filter((v, i, a) => !!v && a.indexOf(v) === i);
        let wasmLoader = null;
        for (const moduleName of loaderModuleNames) {
            const candidate = this.#requireModule(moduleName);
            if (typeof candidate === "function") {
                wasmLoader = candidate;
                break;
            }
            if (typeof _optionalChain([candidate, 'optionalAccess', _58 => _58.default]) === "function") {
                wasmLoader = candidate.default;
                break;
            }
        }
        if (typeof wasmLoader !== "function") {
            throw new Error(`No compatible WASM loader found. Tried: ${loaderModuleNames.join(", ")}`);
        }
        if (!_a.#globalCallbacksRegistered)
            this.#registerGlobalCallbacks();
        await this.#initPThreadPool();
        const workersLoadingPromise = this.#loadWasmModuleToAllWorkers();
        const readyPromise = wasmLoader({
            wasmBinary: wasmBuffer,
            wasmMemory: memory,
            locateFile: () => this.#config.wasmPath,
            onRuntimeInitialized: () => { },
        });
        const [instance] = await Promise.all([readyPromise, workersLoadingPromise]);
        this.#instance = instance;
        this.#initialized = true;
    }}
    __init12() {this.isInitialized = () => this.#initialized}
    __init13() {this.destroy = () => {
        this.#stopAudioPlaybackLoop();
        if (this.#instance && typeof this.#instance.endCall === "function") {
            try {
                this.#instance.endCall(0, false);
            }
            catch (e12) { }
        }
        for (const worker of [...this.#runningWorkers, ...this.#unusedWorkers]) {
            try {
                worker.terminate();
            }
            catch (e13) { }
        }
        this.#runningWorkers = [];
        this.#unusedWorkers = [];
        this.#instance = null;
        this.#vmContext = null;
        this.#moduleRegistry.clear();
        this.#wasmModule = null;
        this.#wasmMemory = null;
        this.#initialized = false;
    }}
    __init14() {this.initVoipStack = (selfJid, meUserJid, selfLid) => {
        this.#ensureInitialized();
        if (this.#voipStackInitialized || this.#voipStackInitPromise)
            return;
        this.#voipStackInitPromise = new Promise((resolveInit) => {
            this.#voipReadyPromise = new Promise((readyResolve) => {
                this.#voipReadyResolver = () => {
                    this.#voipStackInitialized = true;
                    this.#voipReadyResolver = null;
                    this.#voipReadyPromise = null;
                    readyResolve();
                };
            });
            try {
                this.#applyDefaultAbProps();
                try {
                    this.#instance.initVoipStack(selfJid, meUserJid, selfLid);
                }
                catch (modernErr) {
                    if (_optionalChain([modernErr, 'optionalAccess', _59 => _59.name]) === "BindingError" &&
                        (String(_nullishCoalesce(_optionalChain([modernErr, 'optionalAccess', _60 => _60.message]), () => ( ""))).includes("expected 8 args") ||
                            String(_nullishCoalesce(_optionalChain([modernErr, 'optionalAccess', _61 => _61.message]), () => ( ""))).includes("takes 8"))) {
                        this.#instance.initVoipStack(selfJid, meUserJid, selfLid, true, 5, 0, 8, 16);
                    }
                    else {
                        throw modernErr;
                    }
                }
                Promise.race([
                    this.#voipReadyPromise,
                    new Promise((r) => setTimeout(() => {
                        this.#voipStackInitialized = true;
                        r();
                    }, VOIP_READY_TIMEOUT_MS)),
                ]).finally(() => {
                    this.#voipStackInitPromise = null;
                    resolveInit();
                });
            }
            catch (e14) {
                this.#voipReadyResolver = null;
                this.#voipReadyPromise = null;
                this.#voipStackInitPromise = null;
                resolveInit();
            }
        });
    }}
    __init15() {this.waitForVoipStackReady = async () => {
        if (this.#voipStackInitialized)
            return;
        if (this.#voipStackInitPromise) {
            await this.#voipStackInitPromise;
        }
        else {
            await new Promise((r) => setTimeout(r, 100));
        }
    }}
    __init16() {this.isVoipStackReady = () => this.#voipStackInitialized}
    __init17() {this.startCall = (options) => {
        this.#ensureInitialized();
        const peers = this.#makeStringList(_nullishCoalesce(options.peerList, () => ( [options.peerJid])));
        const tcToken = this.#createUint8List(options.extraData);
        const isLidCall = _nullishCoalesce(options.isLidCall, () => ( options.peerJid.includes("@lid")));
        const isFromDialer = _nullishCoalesce(options.isFromDialer, () => ( false));
        const peerJid = String(options.peerJid);
        try {
            try {
                return this.#instance.startVoipCall(peerJid, peers, options.callId, options.isVideo, options.peerPn, isLidCall, isFromDialer, tcToken);
            }
            catch (error) {
                if (_optionalChain([error, 'optionalAccess', _62 => _62.name]) !== "BindingError")
                    throw error;
                return this.#instance.startVoipCall(peerJid, peers, options.callId, options.isVideo, options.peerPn, isFromDialer, tcToken);
            }
        }
        finally {
            _optionalChain([peers, 'optionalAccess', _63 => _63.delete, 'optionalCall', _64 => _64()]);
            _optionalChain([tcToken, 'optionalAccess', _65 => _65.delete, 'optionalCall', _66 => _66()]);
        }
    }}
    __init18() {this.endCall = (reason = 0, sendTerminate = true) => {
        this.#ensureInitialized();
        this.#instance.endCall(reason, sendTerminate);
    }}
    __init19() {this.setMute = (muted) => {
        this.#ensureInitialized();
        return this.#instance.setCallMute(muted);
    }}
    __init20() {this.updateNetworkMedium = (networkMedium, networkMtu = 0) => {
        this.#ensureInitialized();
        _optionalChain([this, 'access', _67 => _67.#instance, 'access', _68 => _68.updateNetworkMedium, 'optionalCall', _69 => _69(networkMedium, networkMtu)]);
    }}
    __init21() {this.handleSignalingOffer = (msg) => {
        this.#ensureInitialized();
        const tcTokenList = this.#createUint8List(msg.tcToken);
        try {
            this.#instance.handleIncomingSignalingOffer(msg.payload, String(_nullishCoalesce(msg.peerPlatform, () => ( 0))), String(_nullishCoalesce(msg.peerAppVersion, () => ( "0"))), String(_nullishCoalesce(msg.epochId, () => ( "0"))), String(_nullishCoalesce(msg.timestamp, () => ( "0"))), _nullishCoalesce(msg.isOffline, () => ( false)), _nullishCoalesce(msg.isOfferNotContact, () => ( false)), String(msg.peerJid), tcTokenList);
        }
        finally {
            _optionalChain([tcTokenList, 'optionalAccess', _70 => _70.delete, 'optionalCall', _71 => _71()]);
        }
    }}
    __init22() {this.handleSignalingMessage = (msg) => {
        this.#ensureInitialized();
        const tcTokenList = this.#createUint8List(msg.tcToken);
        try {
            this.#instance.handleIncomingSignalingMessage(msg.payload, String(_nullishCoalesce(msg.peerPlatform, () => ( "0"))), String(_nullishCoalesce(msg.peerAppVersion, () => ( "0"))), String(_nullishCoalesce(msg.epochId, () => ( "0"))), String(_nullishCoalesce(msg.timestamp, () => ( "0"))), _nullishCoalesce(msg.isOffline, () => ( false)), String(msg.peerJid), tcTokenList);
        }
        finally {
            _optionalChain([tcTokenList, 'optionalAccess', _72 => _72.delete, 'optionalCall', _73 => _73()]);
        }
    }}
    __init23() {this.handleSignalingAck = (msg) => {
        this.#ensureInitialized();
        const options = this.#createUint8List(msg.extraData);
        try {
            this.#instance.handleIncomingSignalingAck(msg.payload, String(_nullishCoalesce(msg.ackError, () => ( "0"))), String(_nullishCoalesce(msg.msgType, () => ( ""))), _nullishCoalesce(msg.peerJid, () => ( "")), options);
        }
        finally {
            _optionalChain([options, 'optionalAccess', _74 => _74.delete, 'optionalCall', _75 => _75()]);
        }
    }}
    __init24() {this.handleSignalingReceipt = (msg) => {
        this.#ensureInitialized();
        const tcTokenList = this.#createUint8List(msg.tcToken);
        try {
            _optionalChain([this, 'access', _76 => _76.#instance, 'access', _77 => _77.handleIncomingSignalingReceipt, 'optionalCall', _78 => _78(msg.payload, msg.peerJid, tcTokenList)]);
        }
        finally {
            _optionalChain([tcTokenList, 'optionalAccess', _79 => _79.delete, 'optionalCall', _80 => _80()]);
        }
    }}
    __init25() {this.handleOnTransportMessage = (data, ip, port) => {
        this.#ensureInitialized();
        if (typeof this.#instance.handleOnMessageFromHeap === "function") {
            const ptr = this.malloc(data.byteLength);
            if (!ptr)
                return;
            try {
                const heapU8 = _nullishCoalesce(_optionalChain([this, 'access', _81 => _81.#instance, 'access', _82 => _82.GROWABLE_HEAP_U8, 'optionalCall', _83 => _83()]), () => ( this.#instance.HEAPU8));
                if (!heapU8)
                    return;
                heapU8.set(data, ptr);
                this.#instance.handleOnMessageFromHeap(ptr, data.byteLength, ip, port);
            }
            finally {
                this.free(ptr);
            }
            return;
        }
        if (typeof this.#instance.handleOnMessage !== "function")
            return;
        const dataList = this.#createUint8List(data);
        try {
            this.#instance.handleOnMessage(dataList, ip, port);
        }
        finally {
            _optionalChain([dataList, 'optionalAccess', _84 => _84.delete, 'optionalCall', _85 => _85()]);
        }
    }}
    __init26() {this.updateIceRtt = (rttMs, relayIp, relayPort) => {
        this.#ensureInitialized();
        _optionalChain([this, 'access', _86 => _86.#instance, 'access', _87 => _87.updateIceRtt, 'optionalCall', _88 => _88(rttMs, relayIp, relayPort)]);
    }}
    __init27() {this.sendAudioData = (data, ptr) => {
        this.#ensureInitialized();
        if (!data || data.length === 0 || !ptr)
            return;
        if (typeof this.#instance.onAudioDataFromJs !== "function")
            return;
        try {
            const heapF32 = _nullishCoalesce(_optionalChain([this, 'access', _89 => _89.#instance, 'access', _90 => _90.GROWABLE_HEAP_F32, 'optionalCall', _91 => _91()]), () => ( this.#instance.HEAPF32));
            if (!heapF32)
                return;
            const index = Math.floor(ptr / 4);
            if (index < 0 || index + data.length > heapF32.length)
                return;
            heapF32.set(data, index);
            this.#instance.onAudioDataFromJs(ptr, data.length);
        }
        catch (e15) { }
    }}
    __init28() {this.malloc = (size) => {
        this.#ensureInitialized();
        return this.#instance._malloc(size);
    }}
    __init29() {this.free = (ptr) => {
        this.#ensureInitialized();
        this.#instance._free(ptr);
    }}
     
    #ensureInitialized = () => {
        if (!this.#initialized || !this.#instance) {
            throw new Error("WasmEngine not initialized. Call initialize() first.");
        }
    };
    #makeStringList = (arr) => {
        const list = new this.#instance.StringList();
        for (const v of arr)
            list.push_back(v);
        return list;
    };
    #createUint8List = (data) => {
        if (!_optionalChain([this, 'access', _92 => _92.#instance, 'optionalAccess', _93 => _93.Uint8List]))
            return null;
        const list = new this.#instance.Uint8List();
        if (data)
            data.forEach((byte) => list.push_back(byte));
        return list;
    };
    #startAudioPlaybackLoop = () => {
        if (this.#audioPlaybackLoopInterval)
            return;
        this.#ensureInitialized();
        this.#isPlaybackActive = true;
        if (typeof this.#instance.requestAudioDataFromWasmVoip !== "function")
            return;
        const framesPerChunk = 320;
        const bufferSize = framesPerChunk * 4;
        try {
            const _malloc = _nullishCoalesce(this.#instance._malloc, () => ( this.#instance.malloc));
            if (!_malloc)
                return;
            this.#audioPlaybackBuffer = _malloc(bufferSize);
        }
        catch (e16) {
            return;
        }
        if (!this.#audioPlaybackBuffer || this.#audioPlaybackBuffer <= 0)
            return;
        this.#audioPlaybackLoopInterval = setInterval(() => {
            if (!this.#isPlaybackActive || !this.#instance || !this.#initialized) {
                this.#stopAudioPlaybackLoop();
                return;
            }
            try {
                this.#instance.requestAudioDataFromWasmVoip(this.#audioPlaybackBuffer, bufferSize);
                const heapF32 = _optionalChain([this, 'access', _94 => _94.#instance, 'access', _95 => _95.GROWABLE_HEAP_F32, 'optionalCall', _96 => _96()]);
                if (!heapF32)
                    return;
                const index = Math.floor(this.#audioPlaybackBuffer / 4);
                const numFloats = Math.floor(bufferSize / 4);
                if (index < 0 || index + numFloats > heapF32.length)
                    return;
                const audioData = new Float32Array(heapF32.buffer, heapF32.byteOffset + index * 4, numFloats);
                const hasNonZero = audioData.some((s) => Math.abs(s) > 0.0001);
                if (hasNonZero)
                    _optionalChain([this, 'access', _97 => _97.#config, 'access', _98 => _98.callbacks, 'optionalAccess', _99 => _99.onAudioPlaybackData, 'optionalCall', _100 => _100(audioData)]);
            }
            catch (e17) { }
        }, 16);
    };
    #stopAudioPlaybackLoop = () => {
        this.#isPlaybackActive = false;
        if (this.#audioPlaybackLoopInterval) {
            clearInterval(this.#audioPlaybackLoopInterval);
            this.#audioPlaybackLoopInterval = null;
        }
        if (this.#audioPlaybackBuffer && this.#audioPlaybackBuffer > 0) {
            try {
                _optionalChain([this, 'access', _101 => _101.#instance, 'optionalAccess', _102 => _102._free, 'optionalCall', _103 => _103(this.#audioPlaybackBuffer)]);
            }
            catch (e18) { }
            this.#audioPlaybackBuffer = null;
        }
    };
    #applyDefaultAbProps = () => {
        if (!this.#instance)
            return;
        const setInt = typeof this.#instance.setABPropInt === "function"
            ? (k, v) => { this.#instance.setABPropInt(k, v); }
            : null;
        const setBool = typeof this.#instance.setABPropBool === "function"
            ? (k, v) => { this.#instance.setABPropBool(k, v); }
            : null;
        const setString = typeof this.#instance.setABPropString === "function"
            ? (k, v) => { this.#instance.setABPropString(k, v); }
            : null;
        if (!setInt && !setBool && !setString)
            return;
        const opts = _nullishCoalesce(this.#config.options, () => ( {}));
        const intProps = {
            heartbeat_interval_s: _nullishCoalesce(opts.heartbeatInterval, () => ( 30)),
            lobby_timeout_min: _nullishCoalesce(opts.lobbyTimeout, () => ( 1)),
            max_num_participants_for_ss: _nullishCoalesce(opts.maxParticipantsScreenShare, () => ( 32)),
            max_group_size_for_long_ringtone: _nullishCoalesce(opts.maxGroupSizeLongRingtone, () => ( 32)),
            app_exit_reason_version: 1,
            log_level: _nullishCoalesce(opts.logLevel, () => ( 3)),
            calling_rust_migration_bitmap: 0,
            calling_rust_migration_incoming_stanza_bitmap: 0,
            default_endpoint_thread_poll_timeout: 0,
            aigc_version: 0,
            call_admin_version: 0,
            vid_stream_pause_resume_jb_reset_threshold_ms: 0,
             
             
            opus_max_bandwidth: 1103,  
        };
        const boolProps = {
            enable_av_downgrade: false,
            enable_new_user_action_stanza_for_raise_hand_sender: false,
            enable_webcodec_video_encode: false,
            enable_init_bwe_for_group_call: false,
            enable_ring_for_gc_on_offer_expire: false,
            allow_reporting_call_replayer_id: false,
            enable_offer_v2_upgrade: false,
            enable_silent_offer: false,
            voice_ai_conversation_starter_latency_tracking: false,
            enable_waiting_room_logging: false,
            attach_transport_rtx: false,
            ignore_joinable_terminate_on_expired_offer: false,
            enable_passthrough_video_decoder: false,
        };
        for (const [key, value] of Object.entries(intProps)) {
            if (setInt && Number.isFinite(value))
                try {
                    setInt(key, value);
                }
                catch (e19) { }
        }
        for (const [key, value] of Object.entries(boolProps)) {
            if (setBool)
                try {
                    setBool(key, value);
                }
                catch (e20) { }
        }
        const overrideProps = parseJsonObjectEnv(CALL_WASM_AB_PROPS_JSON);
        for (const [key, value] of Object.entries(overrideProps)) {
            try {
                if (typeof value === "boolean" && setBool)
                    setBool(key, value);
                else if (typeof value === "number" && setInt)
                    setInt(key, value);
                else if (typeof value === "string" && setString)
                    setString(key, value);
            }
            catch (e21) { }
        }
    };
    #allocateUnusedWorker = () => {
        const workerScriptPath = resolveWorkerScriptPath();
        if (!fs.existsSync(workerScriptPath))
            return;
        try {
            const worker = new (0, _nodeworker_threads.Worker)(workerScriptPath, {
                stdout: true, stderr: true,
                workerData: {
                    wasmPath: this.#config.wasmPath,
                    wasmBinary: this.#config.wasmBinary,
                    workerModulesCode: this.#workerModulesCode,
                    loaderCode: this.#loaderCode,
                    loaderModuleName: this.#config.loaderModuleName,
                    resourcesPath: this.#config.resourcesPath,
                    enableLogs: this.#config.enableLogs,
                },
            });
            const port = new NodeWorkerMessagePort(worker, "WAWebVoipWebWasmWorker");
            _optionalChain([worker, 'access', _104 => _104.stdout, 'optionalAccess', _105 => _105.on, 'call', _106 => _106("data", () => { })]);  
            _optionalChain([worker, 'access', _107 => _107.stderr, 'optionalAccess', _108 => _108.on, 'call', _109 => _109("data", filterWorkerStderr)]);
            this.#unusedWorkers.push(port);
        }
        catch (e22) { }
    };
    #initPThreadPool = async () => {
        for (let i = 0; i < PTHREAD_POOL_SIZE; i += 1)
            this.#allocateUnusedWorker();
    };
    #loadWasmModuleToWorker = (worker) => new Promise((resolve) => {
        const loadedHandler = (msg) => {
            if (msg && msg.cmd === "loaded") {
                worker.removeMessageListener("cmd", loadedHandler);
                this.#workersLoadedCount += 1;
                if (this.#workersLoadedCount >= PTHREAD_POOL_SIZE && this.#removeRunDependencyCallback) {
                    this.#removeRunDependencyCallback("loading-workers");
                }
                resolve();
            }
        };
        worker.addMessageListener("cmd", loadedHandler);
        worker.workerID = this.#nextWorkerID++;
        worker.postMessage({
            cmd: "load", type: "cmd",
            wasmMemory: this.#wasmMemory,
            wasmModule: this.#wasmModule,
            workerID: worker.workerID,
            handlers: [],
        });
    });
    #loadWasmModuleToAllWorkers = async () => {
        this.#workersLoadedCount = 0;
        await Promise.all(this.#unusedWorkers.map((w) => this.#loadWasmModuleToWorker(w)));
    };
    #registerGlobalCallbacks = () => {
        const callbacks = _nullishCoalesce(this.#config.callbacks, () => ( {}));
        _a.registerGlobalCallbackListener("loggingCallback", (data) => {
            if (!this.#config.enableLogs)
                return;
            const level = _optionalChain([data, 'optionalAccess', _110 => _110.level]);
            const msg = _nullishCoalesce(_optionalChain([data, 'optionalAccess', _111 => _111.message]), () => ( ""));
            const mapped = level === 1 ? "error" : level === 2 ? "warn" : level === 3 ? "log" : "debug";
            _optionalChain([callbacks, 'access', _112 => _112.onLog, 'optionalCall', _113 => _113(mapped, msg)]);
        });
        if (callbacks.onAudioCaptureInit) {
            _a.registerGlobalCallbackListener("initCaptureDriverJS", (data) => {
                callbacks.onAudioCaptureInit({
                    sampleRate: _nullishCoalesce(_optionalChain([data, 'optionalAccess', _114 => _114.sample_rate]), () => ( _optionalChain([data, 'optionalAccess', _115 => _115.sampleRate]))),
                    channels: _optionalChain([data, 'optionalAccess', _116 => _116.channels]),
                    bitsPerSample: _nullishCoalesce(_optionalChain([data, 'optionalAccess', _117 => _117.bits_per_sample]), () => ( _optionalChain([data, 'optionalAccess', _118 => _118.bitsPerSample]))),
                    framesPerChunk: _nullishCoalesce(_optionalChain([data, 'optionalAccess', _119 => _119.frames_per_chunk]), () => ( _optionalChain([data, 'optionalAccess', _120 => _120.framesPerChunk]))),
                });
            });
        }
        _a.registerGlobalCallbackListener("startCaptureJS", () => _optionalChain([callbacks, 'access', _121 => _121.onAudioCaptureStart, 'optionalCall', _122 => _122()]));
        _a.registerGlobalCallbackListener("stopCaptureJS", () => _optionalChain([callbacks, 'access', _123 => _123.onAudioCaptureStop, 'optionalCall', _124 => _124()]));
        if (callbacks.onAudioPlaybackInit) {
            _a.registerGlobalCallbackListener("initPlaybackDriverJS", (data) => {
                callbacks.onAudioPlaybackInit({
                    sampleRate: _nullishCoalesce(_optionalChain([data, 'optionalAccess', _125 => _125.sample_rate]), () => ( _optionalChain([data, 'optionalAccess', _126 => _126.sampleRate]))),
                    channels: _optionalChain([data, 'optionalAccess', _127 => _127.channels]),
                    bitsPerSample: _nullishCoalesce(_optionalChain([data, 'optionalAccess', _128 => _128.bits_per_sample]), () => ( _optionalChain([data, 'optionalAccess', _129 => _129.bitsPerSample]))),
                    framesPerChunk: _nullishCoalesce(_optionalChain([data, 'optionalAccess', _130 => _130.frames_per_chunk]), () => ( _optionalChain([data, 'optionalAccess', _131 => _131.framesPerChunk]))),
                });
            });
        }
        _a.registerGlobalCallbackListener("startPlaybackJS", () => {
            _optionalChain([callbacks, 'access', _132 => _132.onAudioPlaybackStart, 'optionalCall', _133 => _133()]);
            this.#startAudioPlaybackLoop();
        });
        _a.registerGlobalCallbackListener("stopPlaybackJS", () => {
            this.#stopAudioPlaybackLoop();
            _optionalChain([callbacks, 'access', _134 => _134.onAudioPlaybackStop, 'optionalCall', _135 => _135()]);
        });
        if (callbacks.onSignalingXmpp) {
            _a.registerGlobalCallbackListener("onSignalingXmpp", (data) => {
                const peerJid = _nullishCoalesce(data.peerJid, () => ( _optionalChain([data, 'access', _136 => _136.args, 'optionalAccess', _137 => _137.peerJid])));
                const callId = _nullishCoalesce(data.callId, () => ( _optionalChain([data, 'access', _138 => _138.args, 'optionalAccess', _139 => _139.callId])));
                let xmlPayload = _nullishCoalesce(data.xmlPayload, () => ( _optionalChain([data, 'access', _140 => _140.args, 'optionalAccess', _141 => _141.xmlPayload])));
                if (Array.isArray(xmlPayload))
                    xmlPayload = new Uint8Array(xmlPayload);
                else if (xmlPayload && typeof xmlPayload === "object" &&
                    !(xmlPayload instanceof Uint8Array) && !Buffer.isBuffer(xmlPayload)) {
                    xmlPayload = new Uint8Array(xmlPayload);
                }
                callbacks.onSignalingXmpp(peerJid, callId, xmlPayload);
            });
        }
        if (callbacks.onCallEvent) {
            _a.registerGlobalCallbackListener("onCallEvent", (data) => {
                callbacks.onCallEvent(data.eventType, data.eventDataJson);
            });
        }
        if (callbacks.sendDataToRelay) {
            _a.registerGlobalCallbackListener("sendDataToRelay", (data) => {
                let relayData = _nullishCoalesce(data.data, () => ( _optionalChain([data, 'access', _142 => _142.args, 'optionalAccess', _143 => _143.data])));
                const ip = _nullishCoalesce(data.ip, () => ( _optionalChain([data, 'access', _144 => _144.args, 'optionalAccess', _145 => _145.ip])));
                const portNum = _nullishCoalesce(data.port, () => ( _optionalChain([data, 'access', _146 => _146.args, 'optionalAccess', _147 => _147.port])));
                if (relayData instanceof Uint8Array) {   }
                else if (Array.isArray(relayData))
                    relayData = new Uint8Array(relayData);
                else if (Buffer.isBuffer(relayData))
                    relayData = new Uint8Array(relayData);
                else if (relayData && typeof relayData === "object" && relayData.buffer) {
                    relayData = new Uint8Array(relayData.buffer, _nullishCoalesce(relayData.byteOffset, () => ( 0)), _nullishCoalesce(relayData.byteLength, () => ( relayData.length)));
                }
                else if (relayData instanceof ArrayBuffer)
                    relayData = new Uint8Array(relayData);
                else
                    return 0;
                if (!ip || !portNum)
                    return 0;
                callbacks.sendDataToRelay(relayData, ip, portNum);
                return relayData.byteLength;
            });
        }
        _a.#globalCallbacksRegistered = true;
    };
    #requireModule = (name) => {
        const preDefinedModules = {
            Promise,
            WAWebVoipWebWasmWorkerResource: {
                resourcePath: resolveWorkerScriptPath(),
                name: "WAWebVoipWebWasmWorker",
            },
            WorkerBundleResource: {
                createDedicatedWebWorker: (resource) => {
                    const scriptPath = _optionalChain([resource, 'optionalAccess', _148 => _148.resourcePath]) && fs.existsSync(resource.resourcePath)
                        ? resource.resourcePath
                        : resolveWorkerScriptPath();
                    const worker = new (0, _nodeworker_threads.Worker)(scriptPath, {
                        stdout: true, stderr: true,
                        workerData: {
                            wasmPath: this.#config.wasmPath,
                            wasmBinary: this.#config.wasmBinary,
                            workerModulesCode: this.#workerModulesCode,
                            loaderCode: this.#loaderCode,
                            loaderModuleName: this.#config.loaderModuleName,
                            resourcesPath: this.#config.resourcesPath,
                            enableLogs: this.#config.enableLogs,
                        },
                    });
                    _optionalChain([worker, 'access', _149 => _149.stdout, 'optionalAccess', _150 => _150.on, 'call', _151 => _151("data", () => { })]);
                    _optionalChain([worker, 'access', _152 => _152.stderr, 'optionalAccess', _153 => _153.on, 'call', _154 => _154("data", filterWorkerStderr)]);
                    return worker;
                },
            },
            WorkerClient: { init: () => { } },
            WorkerMessagePort: {
                WorkerMessagePort: NodeWorkerMessagePort,
                CastWorkerMessagePort: (w) => w,
                WorkerSyncedMessagePort: NodeWorkerMessagePort,
            },
            bx: Object.assign((id) => String(id), { getURL: () => "" }),
            HasteSupportData: { handle: () => { } },
            ServiceWorkerDynamicModules: { handle: () => { } },
            WhatsAppWebServiceWorker: { default: true },
            WAWebLogger: { initializeWAWebLogger: () => { } },
            WAWebSw: { initHandlers: () => { } },
            WAWebWamRuntimeProvider: { setWamRuntime: () => { } },
            WAWebWamWorkerInterface: { commit: () => { }, set: () => { } },
            ServerJSDefine: { handleDefine: () => { } },
            ix: { add: () => { } },
            MetaConfigMap: { add: () => { } },
            QPLHasteSupportDataStorage: { default: { add: () => { }, get: () => null } },
            getFalcoLogPolicy_DO_NOT_USE: { add: () => { } },
            gkx: { add: () => { } },
            justknobx: { add: () => { } },
            qex: { add: () => { } },
        };
        if (preDefinedModules[name])
            return preDefinedModules[name];
        const mod = this.#moduleRegistry.get(name);
        if (!mod)
            return {};
        if (mod.exports !== undefined)
            return mod.exports;
        const requireFn = this.#requireModule;
        const normalizeModuleResult = (value) => {
            if (value && typeof value === "object" && "exports" in value && Object.keys(value).length === 1) {
                return value.exports;
            }
            return value;
        };
        const importDefaultFn = (dep) => {
            const v = requireFn(dep);
            return v && v.__esModule ? v.default : v;
        };
        const importAllFn = (dep) => {
            const v = requireFn(dep);
            if (v == null)
                return { default: v };
            if (v.__esModule)
                return v;
            if (typeof v !== "object" && typeof v !== "function")
                return { default: v };
            const ns = {};
            for (const key of Object.keys(v))
                ns[key] = v[key];
            ns.default = v;
            return ns;
        };
        const tryMetro = () => {
            const module = { exports: {} };
            mod.factory(_nullishCoalesce(this.#vmContext, () => ( globalThis)), requireFn, importDefaultFn, importAllFn, null, module, module.exports);
            return normalizeModuleResult(module.exports);
        };
        const tryLegacy = () => {
            const exports = {};
            const module = { exports };
            const resolvedDeps = mod.deps.map((dep) => requireFn(dep));
            mod.factory(_nullishCoalesce(this.#vmContext, () => ( globalThis)), requireFn, requireFn, requireFn, module, exports, ...resolvedDeps);
            return normalizeModuleResult(module.exports);
        };
        let result = {};
        let metroError = null;
        try {
            result = tryMetro();
        }
        catch (e) {
            metroError = e;
        }
        if (metroError != null || (result && typeof result === "object" && Object.keys(result).length === 0)) {
            try {
                const legacyResult = tryLegacy();
                if (typeof legacyResult === "function" || (legacyResult && Object.keys(legacyResult).length > 0)) {
                    result = legacyResult;
                }
            }
            catch (e23) { }
        }
        mod.exports = result;
        return result;
    };
    #createVMContext = (memory) => {
        const callbacks = _nullishCoalesce(this.#config.callbacks, () => ( {}));
        const wasmCallbacks = {
            onVoipReady: () => {
                _optionalChain([this, 'access', _155 => _155.#voipReadyResolver, 'optionalCall', _156 => _156()]);
                _optionalChain([callbacks, 'access', _157 => _157.onVoipReady, 'optionalCall', _158 => _158()]);
            },
            onSignalingXmpp: (data) => _optionalChain([callbacks, 'access', _159 => _159.onSignalingXmpp, 'optionalCall', _160 => _160(_optionalChain([data, 'optionalAccess', _161 => _161.peerJid]), _optionalChain([data, 'optionalAccess', _162 => _162.callId]), _optionalChain([data, 'optionalAccess', _163 => _163.xmlPayload]))]),
            onCallEvent: (data) => _optionalChain([callbacks, 'access', _164 => _164.onCallEvent, 'optionalCall', _165 => _165(_optionalChain([data, 'optionalAccess', _166 => _166.eventType]), _optionalChain([data, 'optionalAccess', _167 => _167.eventDataJson]))]),
            sendDataToRelay: (data) => _optionalChain([callbacks, 'access', _168 => _168.sendDataToRelay, 'optionalCall', _169 => _169(_optionalChain([data, 'optionalAccess', _170 => _170.data]), _optionalChain([data, 'optionalAccess', _171 => _171.ip]), _optionalChain([data, 'optionalAccess', _172 => _172.port]))]),
            loggingCallback: (data) => {
                if (!this.#config.enableLogs)
                    return;
                const level = _optionalChain([data, 'optionalAccess', _173 => _173.level]);
                const msg = _nullishCoalesce(_optionalChain([data, 'optionalAccess', _174 => _174.message]), () => ( ""));
                const mapped = level === 1 ? "error" : level === 2 ? "warn" : level === 3 ? "log" : "debug";
                _optionalChain([callbacks, 'access', _175 => _175.onLog, 'optionalCall', _176 => _176(mapped, msg)]);
            },
            initCaptureDriverJS: (data) => {
                _optionalChain([callbacks, 'access', _177 => _177.onAudioCaptureInit, 'optionalCall', _178 => _178({
                    sampleRate: _optionalChain([data, 'optionalAccess', _179 => _179.sample_rate]), channels: _optionalChain([data, 'optionalAccess', _180 => _180.channels]),
                    bitsPerSample: _optionalChain([data, 'optionalAccess', _181 => _181.bits_per_sample]), framesPerChunk: _optionalChain([data, 'optionalAccess', _182 => _182.frames_per_chunk]),
                })]);
                return 0;
            },
            startCaptureJS: () => { _optionalChain([callbacks, 'access', _183 => _183.onAudioCaptureStart, 'optionalCall', _184 => _184()]); return 0; },
            stopCaptureJS: () => { _optionalChain([callbacks, 'access', _185 => _185.onAudioCaptureStop, 'optionalCall', _186 => _186()]); return 0; },
            initPlaybackDriverJS: (data) => {
                _optionalChain([callbacks, 'access', _187 => _187.onAudioPlaybackInit, 'optionalCall', _188 => _188({
                    sampleRate: _optionalChain([data, 'optionalAccess', _189 => _189.sample_rate]), channels: _optionalChain([data, 'optionalAccess', _190 => _190.channels]),
                    bitsPerSample: _optionalChain([data, 'optionalAccess', _191 => _191.bits_per_sample]), framesPerChunk: _optionalChain([data, 'optionalAccess', _192 => _192.frames_per_chunk]),
                })]);
                return 0;
            },
            startPlaybackJS: () => {
                _optionalChain([callbacks, 'access', _193 => _193.onAudioPlaybackStart, 'optionalCall', _194 => _194()]);
                this.#startAudioPlaybackLoop();
                return 0;
            },
            stopPlaybackJS: () => {
                this.#stopAudioPlaybackLoop();
                _optionalChain([callbacks, 'access', _195 => _195.onAudioPlaybackStop, 'optionalCall', _196 => _196()]);
                return 0;
            },
            startVideoCaptureJS: () => 0,
            stopVideoCaptureJS: () => 0,
            startDesktopCaptureJS: () => 0,
            stopDesktopCaptureJS: () => 0,
            dataChannelStateCallback: () => 0,
            getBrowserAudioProcessingStatus: () => 7,
            getBweModelPath: () => null,
            videoFrameConsumed: () => 0,
            cryptoHkdfExtractWithSaltAndExpand: (data) => {
                const key = toByteArray(_optionalChain([data, 'optionalAccess', _197 => _197.key_]));
                const salt = _optionalChain([data, 'optionalAccess', _198 => _198.salt_]) ? toByteArray(data.salt_) : new Uint8Array(0);
                const info = toByteArray(_optionalChain([data, 'optionalAccess', _199 => _199.info_]));
                const length = _nullishCoalesce(_optionalChain([data, 'optionalAccess', _200 => _200.length]), () => ( 32));
                return _nullishCoalesce(_optionalChain([callbacks, 'access', _201 => _201.cryptoHkdf, 'optionalCall', _202 => _202(key, salt, info, length)]), () => ( new Uint8Array(length)));
            },
            hmacSha256KeyGenerator: (data) => {
                const hmacData = new Uint8Array(_nullishCoalesce(_optionalChain([data, 'optionalAccess', _203 => _203.data_]), () => ( [])));
                const hmacKey = new Uint8Array(_nullishCoalesce(_optionalChain([data, 'optionalAccess', _204 => _204.key_]), () => ( [])));
                return _nullishCoalesce(_optionalChain([callbacks, 'access', _205 => _205.hmacSha256, 'optionalCall', _206 => _206(hmacData, hmacKey)]), () => ( new Uint8Array(32)));
            },
            isParticipantKnownContact: () => true,
            getPersistentDirectoryPath: () => {
                const dir = "/tmp/voip";
                try {
                    if (!fs.existsSync(dir))
                        fs.mkdirSync(dir, { recursive: true });
                }
                catch (e24) { }
                return dir;
            },
        };
        const __d = (name, deps, factory) => {
            this.#moduleRegistry.set(name, { deps, factory, exports: undefined });
        };
        const babelHelpers = {
            extends: Object.assign,
            inheritsLoose: (sub, sup) => {
                sub.prototype = Object.create(sup.prototype);
                sub.prototype.constructor = sub;
                sub.__proto__ = sup;
            },
            objectWithoutPropertiesLoose: (source, excluded) => {
                if (source == null)
                    return {};
                const target = {};
                for (const key of Object.keys(source)) {
                    if (excluded.indexOf(key) >= 0)
                        continue;
                    target[key] = source[key];
                }
                return target;
            },
            taggedTemplateLiteralLoose: (strings, raw) => {
                if (!raw)
                    raw = strings.slice(0);
                strings.raw = raw;
                return strings;
            },
            wrapNativeSuper: (Class) => Class,
        };
        const addRunDependency = (dep) => {
            if (dep === "loading-workers" && this.#workersLoadedCount >= PTHREAD_POOL_SIZE) {
                setImmediate(() => _optionalChain([this, 'access', _207 => _207.#removeRunDependencyCallback, 'optionalCall', _208 => _208(dep)]));
            }
        };
        const removeRunDependency = (_dep) => { };
        this.#removeRunDependencyCallback = removeRunDependency;
        const webCrypto = {
            getRandomValues: (arr) => {
                if (!arr || !ArrayBuffer.isView(arr)) {
                    throw new TypeError("crypto.getRandomValues expects a TypedArray");
                }
                const bytes = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
                _nodecrypto.randomFillSync.call(void 0, bytes);
                return arr;
            },
        };
        const selfObj = {
            __swData: { dynamic_data: { hsdp: {}, dynamic_modules: [] } },
            WhatsAppVoipWasmCallbacks: wasmCallbacks,
            WhatsAppVoipWasmWorkerCompatibleCallbacks: wasmCallbacks,
            crypto: webCrypto,
        };
        selfObj.self = selfObj;
        selfObj.window = selfObj;
        selfObj.globalThis = selfObj;
        if (typeof global !== "undefined") {
            global.WhatsAppVoipWasmCallbacks = wasmCallbacks;
            global.WhatsAppVoipWasmWorkerCompatibleCallbacks = wasmCallbacks;
        }
        const context = vm.createContext({
            self: selfObj, globalThis: selfObj, global: selfObj, window: selfObj,
            console, setTimeout, setInterval, clearTimeout, clearInterval,
            queueMicrotask, performance, babelHelpers, __d,
            require: this.#requireModule,
            addRunDependency, removeRunDependency,
            WebAssembly, SharedArrayBuffer,
            Atomics: this.#createAtomicsWrapper(memory),
            Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array,
            Float32Array, Float64Array, BigInt64Array, BigUint64Array,
            ArrayBuffer, DataView, Error, TypeError, RangeError, Promise,
            Map, Set, WeakMap, WeakSet, Symbol, Object, Array, String, Number,
            Boolean, Math, Date, JSON, RegExp, Function, Proxy, Reflect,
            crypto: webCrypto,
            WhatsAppVoipWasmCallbacks: wasmCallbacks,
            WhatsAppVoipWasmWorkerCompatibleCallbacks: wasmCallbacks,
            navigator: {
                userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                hardwareConcurrency: 4,
            },
            process: undefined,
            document: { currentScript: null },
            location: { href: "file:///wasm" },
            Worker: class {
                constructor() { }
                postMessage() { }
                terminate() { }
                addEventListener() { }
            },
            fetch: async () => { throw new Error("fetch not supported"); },
            XMLHttpRequest: class {
                open() { }
                send() { }
                setRequestHeader() { }
            },
            Blob: class {
                constructor() { }
            },
            URL: { createObjectURL: () => "blob:fake", revokeObjectURL: () => { } },
            Image: (_class = class {constructor() { _class.prototype.__init30.call(this);_class.prototype.__init31.call(this);_class.prototype.__init32.call(this); }
                __init30() {this.src = ""}
                __init31() {this.onload = null}
                __init32() {this.onerror = null}
            }, _class),
            Audio: (_class2 = class {constructor() { _class2.prototype.__init33.call(this); }
                __init33() {this.src = ""}
                addEventListener() { }
            }, _class2),
            __NODE_PTHREAD: {
                getUnusedWorker: () => {
                    if (this.#unusedWorkers.length === 0)
                        return null;
                    const worker = this.#unusedWorkers.pop();
                    this.#runningWorkers.push(worker);
                    return worker;
                },
                returnWorkerToPool: (worker) => {
                    const idx = this.#runningWorkers.indexOf(worker);
                    if (idx >= 0) {
                        this.#runningWorkers.splice(idx, 1);
                        this.#unusedWorkers.push(worker);
                    }
                },
                spawnThread: (params) => {
                    const worker = this.#unusedWorkers.pop();
                    if (!worker)
                        return 6;
                    this.#runningWorkers.push(worker);
                    this.#pthreads[params.pthread_ptr] = worker;
                    worker.pthread_ptr = params.pthread_ptr;
                    const pthreadTable = _optionalChain([this, 'access', _209 => _209.#instance, 'optionalAccess', _210 => _210.PThread, 'optionalAccess', _211 => _211.pthreads]);
                    if (pthreadTable)
                        pthreadTable[params.pthread_ptr] = worker;
                    worker.postMessage({
                        cmd: "run",
                        start_routine: params.startRoutine,
                        arg: params.arg,
                        pthread_ptr: params.pthread_ptr,
                    });
                    return 0;
                },
                unusedWorkersCount: () => this.#unusedWorkers.length,
                runningWorkersCount: () => this.#runningWorkers.length,
            },
            __IS_NODE_PTHREAD_ENV: true,
        });
        context.self = context;
        context.globalThis = context;
        context.global = context;
        context.window = context;
        return context;
    };
    #createAtomicsWrapper = (_memory) => {
        const atomicsWrapper = {
            add: Atomics.add.bind(Atomics),
            and: Atomics.and.bind(Atomics),
            compareExchange: Atomics.compareExchange.bind(Atomics),
            exchange: Atomics.exchange.bind(Atomics),
            isLockFree: Atomics.isLockFree.bind(Atomics),
            load: Atomics.load.bind(Atomics),
            or: Atomics.or.bind(Atomics),
            store: Atomics.store.bind(Atomics),
            sub: Atomics.sub.bind(Atomics),
            xor: Atomics.xor.bind(Atomics),
            notify: (typedArray, index, count) => {
                try {
                    return Atomics.notify(typedArray, index, count);
                }
                catch (e) {
                    if (_optionalChain([e, 'optionalAccess', _212 => _212.message, 'optionalAccess', _213 => _213.includes, 'call', _214 => _214("futex_wake")]) || _optionalChain([e, 'optionalAccess', _215 => _215.message, 'optionalAccess', _216 => _216.includes, 'call', _217 => _217("main_browser_thread")]))
                        return 0;
                    throw e;
                }
            },
            waitAsync: Atomics.waitAsync
                ? Atomics.waitAsync.bind(Atomics)
                : () => ({ async: true, value: Promise.resolve("ok") }),
            wait: (typedArray, index, value, timeout) => {
                const currentValue = Atomics.load(typedArray, index);
                if (currentValue !== value)
                    return "not-equal";
                if (timeout !== undefined && timeout <= 0)
                    return "timed-out";
                return "timed-out";
            },
            [Symbol.toStringTag]: "Atomics",
        };
        return atomicsWrapper;
    };
} WasmEngine.__initStatic(); WasmEngine.__initStatic2(); exports.WasmEngine = WasmEngine;
_a = WasmEngine;
exports. default = WasmEngine;

 
const __kageModule108 = (() => {
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
exports.WasmEngine = void 0;
var _a;
 








const vm = __importStar(require("node:vm"));
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const node_crypto_1 = require("node:crypto");
const node_worker_threads_1 = require("node:worker_threads");
const node_url_1 = require("node:url");
const CALL_WASM_AB_PROPS_JSON = process.env.CALL_WASM_AB_PROPS_JSON ?? "";
const PTHREAD_POOL_SIZE = 20;
const VOIP_READY_TIMEOUT_MS = 15_000;
const parseJsonObjectEnv = (raw) => {
    if (!raw)
        return {};
    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
            return parsed;
    }
    catch { }
    return {};
};
const toByteArray = (input) => {
    if (!input)
        return new Uint8Array(0);
    if (input instanceof Uint8Array)
        return input;
    if (typeof input === "string")
        return new TextEncoder().encode(input);
    if (ArrayBuffer.isView(input))
        return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    if (input instanceof ArrayBuffer)
        return new Uint8Array(input);
    if (typeof input === "object" && typeof input.length === "number") {
        const arr = new Uint8Array(input.length);
        for (let i = 0; i < input.length; i += 1)
            arr[i] = input[i] ?? 0;
        return arr;
    }
    return new Uint8Array(0);
};
const filterWorkerStderr = (chunk) => {
    const line = chunk.toString().trim();
    if (line && !line.startsWith("voip:") && !line.startsWith("still waiting")) {
        process.stderr.write(chunk);
    }
};
const resolveWorkerScriptPath = () => {
    const compiled = path.join(__dirname, "worker-bootstrap.js");
    return fs.existsSync(compiled) ? compiled : path.join(__dirname, "worker-bootstrap.mts");
};
class NodeWorkerMessagePort {
    #listeners = new Map();
    #worker;
    fullyConnected;
    name;
    workerID = 0;
    pthread_ptr = 0;
    constructor(worker, name = "WAWebVoipWebWasmWorker") {
        this.#worker = worker;
        this.name = name;
        this.fullyConnected = new Promise((resolve) => {
            const loadedHandler = (msg) => {
                if (msg && msg.cmd === "loaded") {
                    this.workerID = msg.workerID ?? 0;
                    resolve(this);
                }
            };
            this.addMessageListener("cmd", loadedHandler);
        });
        if (typeof worker.on === "function") {
            worker.on("message", (data) => this.#handleMessage(data));
            worker.on("error", () => { });
        }
        else if (typeof worker.addEventListener === "function") {
            worker.addEventListener("message", (ev) => this.#handleMessage(ev?.data ?? ev));
        }
    }
    postMessage = (msg, transferList) => {
        const out = msg && typeof msg === "object" && msg.cmd && !msg.type ? { ...msg, type: "cmd" } : msg;
        this.#worker.postMessage(out, transferList);
    };
    addMessageListener = (type, handler) => {
        let set = this.#listeners.get(type);
        if (!set) {
            set = new Set();
            this.#listeners.set(type, set);
        }
        set.add(handler);
        return handler;
    };
    removeMessageListener = (type, handler) => this.#listeners.get(type)?.delete(handler) ?? false;
    removeAllMessageListeners = (type) => {
        if (type)
            this.#listeners.get(type)?.clear();
        else
            this.#listeners.clear();
    };
    terminate = () => { this.#worker.terminate(); };
    close = () => { };
    isWrappingVirtualMessagePort = () => false;
    getWorker = () => this.#worker;
    #handleMessage = (data) => {
        if (!data || typeof data !== "object")
            return;
        if (data.type === "callback" || data.type === "waWasmWorkerCompatibleCallback") {
            let callbackName;
            let callbackArgs;
            if (data.__name) {
                callbackName = data.__name;
                callbackArgs = {};
                for (const key in data) {
                    if (key !== "type" && key !== "__name" && key !== "prototype" && key !== "args" && !key.startsWith("__")) {
                        callbackArgs[key] = data[key];
                    }
                }
            }
            else if (data.name) {
                callbackName = data.name;
                callbackArgs = data.args ?? {};
            }
            else if (data.payload?.name) {
                callbackName = data.payload.name;
                callbackArgs = data.payload.args ?? {};
            }
            else {
                return;
            }
            if (callbackName === "onSignalingXmpp" &&
                (!callbackArgs || Object.keys(callbackArgs).length === 0)) {
                callbackArgs = {
                    peerJid: data.peerJid, callId: data.callId, xmlPayload: data.xmlPayload,
                };
            }
            let listenerData = callbackArgs;
            if (!callbackArgs || Object.keys(callbackArgs).length === 0 ||
                (Object.keys(callbackArgs).length === 1 && callbackArgs.prototype)) {
                listenerData = {};
                for (const key in data) {
                    if (key !== "type" && key !== "__name" && key !== "prototype" && key !== "args" && !key.startsWith("__")) {
                        listenerData[key] = data[key];
                    }
                }
            }
            else if (callbackName === "sendDataToRelay") {
                listenerData = { ...callbackArgs };
                if (data.data !== undefined)
                    listenerData.data = data.data;
                if (data.len !== undefined)
                    listenerData.len = data.len;
                if (data.ip !== undefined)
                    listenerData.ip = data.ip;
                if (data.port !== undefined)
                    listenerData.port = data.port;
            }
            else if (callbackName === "onCallEvent") {
                listenerData = { ...callbackArgs };
                if (data.eventType !== undefined)
                    listenerData.eventType = data.eventType;
                if (data.userData !== undefined)
                    listenerData.userData = data.userData;
                if (data.eventDataJson !== undefined)
                    listenerData.eventDataJson = data.eventDataJson;
            }
            WasmEngine.notifyGlobalCallbackListeners(callbackName, listenerData);
            return;
        }
        const dispatch = (key) => {
            if (!key)
                return;
            for (const handler of this.#listeners.get(key) ?? []) {
                try {
                    handler(data);
                }
                catch { }
            }
        };
        dispatch(data.type);
        if (data.cmd !== data.type)
            dispatch(data.cmd);
    };
}
class WasmEngine {
    static #globalCallbackListeners = new Map();
    static #globalCallbacksRegistered = false;
    static registerGlobalCallbackListener = (callbackName, handler) => {
        const key = `callback:${callbackName}`;
        let set = _a.#globalCallbackListeners.get(key);
        if (!set) {
            set = new Set();
            _a.#globalCallbackListeners.set(key, set);
        }
        set.add(handler);
    };
    static notifyGlobalCallbackListeners = (callbackName, data) => {
        const set = _a.#globalCallbackListeners.get(`callback:${callbackName}`);
        if (!set)
            return;
        for (const handler of set) {
            try {
                handler(data);
            }
            catch { }
        }
    };
    #config;
    #instance = null;
    #initialized = false;
    #moduleRegistry = new Map();
    #vmContext = null;
    #unusedWorkers = [];
    #runningWorkers = [];
    #pthreads = {};
    #nextWorkerID = 1;
    #wasmModule = null;
    #wasmMemory = null;
    #removeRunDependencyCallback = null;
    #workersLoadedCount = 0;
    #audioPlaybackLoopInterval = null;
    #audioPlaybackBuffer = null;
    #isPlaybackActive = false;
    #voipStackInitialized = false;
    #voipStackInitPromise = null;
    #voipReadyResolver = null;
    #voipReadyPromise = null;
    #workerModulesCode = "";
    #loaderCode = "";
    constructor(config = {}) {
        const basePath = config.resourcesPath
            ? (path.isAbsolute(config.resourcesPath) ? config.resourcesPath : path.resolve(process.cwd(), config.resourcesPath))
            : path.resolve(__dirname, "..");
        const wasmPath = config.wasmPath
            ? (path.isAbsolute(config.wasmPath) ? config.wasmPath : path.resolve(process.cwd(), config.wasmPath))
            : path.join(basePath, "assets", "wasm", "whatsapp.wasm");
        this.#config = {
            ...config,
            wasmPath,
            resourcesPath: basePath,
            enableLogs: config.enableLogs ?? true,
            options: {
                heartbeatInterval: 30,
                lobbyTimeout: 1,
                maxParticipantsScreenShare: 32,
                maxGroupSizeLongRingtone: 32,
                ...config.options,
            },
        };
    }
    initialize = async () => {
        if (this.#initialized)
            throw new Error("WasmEngine already initialized");
        const voipStorageDir = "/tmp/voip";
        try {
            if (!fs.existsSync(voipStorageDir))
                fs.mkdirSync(voipStorageDir, { recursive: true });
        }
        catch { }
        const loaderFile = path.join(this.#config.resourcesPath, "assets", "wasm", "loader.js");
        const workerFile = path.join(this.#config.resourcesPath, "assets", "wasm", "worker-modules.js");
        if (!this.#config.wasmBinary && !fs.existsSync(this.#config.wasmPath)) {
            throw new Error(`WASM file not found: ${this.#config.wasmPath}`);
        }
        const wasmBuffer = this.#config.wasmBinary
            ? Buffer.from(this.#config.wasmBinary)
            : fs.readFileSync(this.#config.wasmPath);
        const diskWorkerCode = fs.existsSync(workerFile) ? fs.readFileSync(workerFile, "utf8") : "";
        this.#workerModulesCode = this.#config.workerModulesCode ?? diskWorkerCode;
        const workerBundleHasLoader = typeof this.#workerModulesCode === "string" && /WAWebVoipWebWasmLoader/.test(this.#workerModulesCode);
         
         
         
        this.#loaderCode = this.#config.loaderCode ??
            (workerBundleHasLoader ? "" : fs.existsSync(loaderFile) ? fs.readFileSync(loaderFile, "utf8") : "");
        if (!this.#loaderCode && !this.#workerModulesCode) {
            throw new Error("No loader/worker code available to initialize VoIP");
        }
        const memory = new WebAssembly.Memory({ initial: 256, maximum: 32768, shared: true });
        this.#wasmMemory = memory;
        this.#wasmModule = await WebAssembly.compile(wasmBuffer);
        this.#vmContext = this.#createVMContext(memory);
        const runModuleCode = (code) => {
            if (code)
                vm.runInContext(code, this.#vmContext);
        };
        runModuleCode(this.#workerModulesCode);
        runModuleCode(this.#loaderCode);
        this.#vmContext.WAWebVoipWebWasmWorkerResource = this.#requireModule("WAWebVoipWebWasmWorkerResource");
        const loaderModuleNames = [
            this.#config.loaderModuleName,
            "WAWebVoipWebWasmLoader",
            "WAWebVoipWebWasmLoader.worker",
            "WAWebVoipWebWasmLoader_ProdLab_internal.worker",
            "WAWebVoipWebWasmLoader_ProdLabvideo_internal.worker",
        ].filter((v, i, a) => !!v && a.indexOf(v) === i);
        let wasmLoader = null;
        for (const moduleName of loaderModuleNames) {
            const candidate = this.#requireModule(moduleName);
            if (typeof candidate === "function") {
                wasmLoader = candidate;
                break;
            }
            if (typeof candidate?.default === "function") {
                wasmLoader = candidate.default;
                break;
            }
        }
        if (typeof wasmLoader !== "function") {
            throw new Error(`No compatible WASM loader found. Tried: ${loaderModuleNames.join(", ")}`);
        }
        if (!_a.#globalCallbacksRegistered)
            this.#registerGlobalCallbacks();
        await this.#initPThreadPool();
        const workersLoadingPromise = this.#loadWasmModuleToAllWorkers();
        const readyPromise = wasmLoader({
            wasmBinary: wasmBuffer,
            wasmMemory: memory,
            locateFile: () => this.#config.wasmPath,
            onRuntimeInitialized: () => { },
        });
        const [instance] = await Promise.all([readyPromise, workersLoadingPromise]);
        this.#instance = instance;
        this.#initialized = true;
    };
    isInitialized = () => this.#initialized;
    destroy = () => {
        this.#stopAudioPlaybackLoop();
        if (this.#instance && typeof this.#instance.endCall === "function") {
            try {
                this.#instance.endCall(0, false);
            }
            catch { }
        }
        for (const worker of [...this.#runningWorkers, ...this.#unusedWorkers]) {
            try {
                worker.terminate();
            }
            catch { }
        }
        this.#runningWorkers = [];
        this.#unusedWorkers = [];
        this.#instance = null;
        this.#vmContext = null;
        this.#moduleRegistry.clear();
        this.#wasmModule = null;
        this.#wasmMemory = null;
        this.#initialized = false;
    };
    initVoipStack = (selfJid, meUserJid, selfLid) => {
        this.#ensureInitialized();
        if (this.#voipStackInitialized || this.#voipStackInitPromise)
            return;
        this.#voipStackInitPromise = new Promise((resolveInit) => {
            this.#voipReadyPromise = new Promise((readyResolve) => {
                this.#voipReadyResolver = () => {
                    this.#voipStackInitialized = true;
                    this.#voipReadyResolver = null;
                    this.#voipReadyPromise = null;
                    readyResolve();
                };
            });
            try {
                this.#applyDefaultAbProps();
                try {
                    this.#instance.initVoipStack(selfJid, meUserJid, selfLid);
                }
                catch (modernErr) {
                    if (modernErr?.name === "BindingError" &&
                        (String(modernErr?.message ?? "").includes("expected 8 args") ||
                            String(modernErr?.message ?? "").includes("takes 8"))) {
                        this.#instance.initVoipStack(selfJid, meUserJid, selfLid, true, 5, 0, 8, 16);
                    }
                    else {
                        throw modernErr;
                    }
                }
                Promise.race([
                    this.#voipReadyPromise,
                    new Promise((r) => setTimeout(() => {
                        this.#voipStackInitialized = true;
                        r();
                    }, VOIP_READY_TIMEOUT_MS)),
                ]).finally(() => {
                    this.#voipStackInitPromise = null;
                    resolveInit();
                });
            }
            catch {
                this.#voipReadyResolver = null;
                this.#voipReadyPromise = null;
                this.#voipStackInitPromise = null;
                resolveInit();
            }
        });
    };
    waitForVoipStackReady = async () => {
        if (this.#voipStackInitialized)
            return;
        if (this.#voipStackInitPromise) {
            await this.#voipStackInitPromise;
        }
        else {
            await new Promise((r) => setTimeout(r, 100));
        }
    };
    isVoipStackReady = () => this.#voipStackInitialized;
    startCall = (options) => {
        this.#ensureInitialized();
        const peers = this.#makeStringList(options.peerList ?? [options.peerJid]);
        const tcToken = this.#createUint8List(options.extraData);
        const isLidCall = options.isLidCall ?? options.peerJid.includes("@lid");
        const isFromDialer = options.isFromDialer ?? false;
        const peerJid = String(options.peerJid);
        try {
            try {
                return this.#instance.startVoipCall(peerJid, peers, options.callId, options.isVideo, options.peerPn, isLidCall, isFromDialer, tcToken);
            }
            catch (error) {
                if (error?.name !== "BindingError")
                    throw error;
                return this.#instance.startVoipCall(peerJid, peers, options.callId, options.isVideo, options.peerPn, isFromDialer, tcToken);
            }
        }
        finally {
            peers?.delete?.();
            tcToken?.delete?.();
        }
    };
    endCall = (reason = 0, sendTerminate = true) => {
        this.#ensureInitialized();
        this.#instance.endCall(reason, sendTerminate);
    };
    setMute = (muted) => {
        this.#ensureInitialized();
        return this.#instance.setCallMute(muted);
    };
    updateNetworkMedium = (networkMedium, networkMtu = 0) => {
        this.#ensureInitialized();
        this.#instance.updateNetworkMedium?.(networkMedium, networkMtu);
    };
    handleSignalingOffer = (msg) => {
        this.#ensureInitialized();
        const tcTokenList = this.#createUint8List(msg.tcToken);
        try {
            this.#instance.handleIncomingSignalingOffer(msg.payload, String(msg.peerPlatform ?? 0), String(msg.peerAppVersion ?? "0"), String(msg.epochId ?? "0"), String(msg.timestamp ?? "0"), msg.isOffline ?? false, msg.isOfferNotContact ?? false, String(msg.peerJid), tcTokenList);
        }
        finally {
            tcTokenList?.delete?.();
        }
    };
    handleSignalingMessage = (msg) => {
        this.#ensureInitialized();
        const tcTokenList = this.#createUint8List(msg.tcToken);
        try {
            this.#instance.handleIncomingSignalingMessage(msg.payload, String(msg.peerPlatform ?? "0"), String(msg.peerAppVersion ?? "0"), String(msg.epochId ?? "0"), String(msg.timestamp ?? "0"), msg.isOffline ?? false, String(msg.peerJid), tcTokenList);
        }
        finally {
            tcTokenList?.delete?.();
        }
    };
    handleSignalingAck = (msg) => {
        this.#ensureInitialized();
        const options = this.#createUint8List(msg.extraData);
        try {
            this.#instance.handleIncomingSignalingAck(msg.payload, String(msg.ackError ?? "0"), String(msg.msgType ?? ""), msg.peerJid ?? "", options);
        }
        finally {
            options?.delete?.();
        }
    };
    handleSignalingReceipt = (msg) => {
        this.#ensureInitialized();
        const tcTokenList = this.#createUint8List(msg.tcToken);
        try {
            this.#instance.handleIncomingSignalingReceipt?.(msg.payload, msg.peerJid, tcTokenList);
        }
        finally {
            tcTokenList?.delete?.();
        }
    };
    handleOnTransportMessage = (data, ip, port) => {
        this.#ensureInitialized();
        if (typeof this.#instance.handleOnMessageFromHeap === "function") {
            const ptr = this.malloc(data.byteLength);
            if (!ptr)
                return;
            try {
                const heapU8 = this.#instance.GROWABLE_HEAP_U8?.() ?? this.#instance.HEAPU8;
                if (!heapU8)
                    return;
                heapU8.set(data, ptr);
                this.#instance.handleOnMessageFromHeap(ptr, data.byteLength, ip, port);
            }
            finally {
                this.free(ptr);
            }
            return;
        }
        if (typeof this.#instance.handleOnMessage !== "function")
            return;
        const dataList = this.#createUint8List(data);
        try {
            this.#instance.handleOnMessage(dataList, ip, port);
        }
        finally {
            dataList?.delete?.();
        }
    };
    updateIceRtt = (rttMs, relayIp, relayPort) => {
        this.#ensureInitialized();
        this.#instance.updateIceRtt?.(rttMs, relayIp, relayPort);
    };
    sendAudioData = (data, ptr) => {
        this.#ensureInitialized();
        if (!data || data.length === 0 || !ptr)
            return;
        if (typeof this.#instance.onAudioDataFromJs !== "function")
            return;
        try {
            const heapF32 = this.#instance.GROWABLE_HEAP_F32?.() ?? this.#instance.HEAPF32;
            if (!heapF32)
                return;
            const index = Math.floor(ptr / 4);
            if (index < 0 || index + data.length > heapF32.length)
                return;
            heapF32.set(data, index);
            this.#instance.onAudioDataFromJs(ptr, data.length);
        }
        catch { }
    };
    malloc = (size) => {
        this.#ensureInitialized();
        return this.#instance._malloc(size);
    };
    free = (ptr) => {
        this.#ensureInitialized();
        this.#instance._free(ptr);
    };
     
    #ensureInitialized = () => {
        if (!this.#initialized || !this.#instance) {
            throw new Error("WasmEngine not initialized. Call initialize() first.");
        }
    };
    #makeStringList = (arr) => {
        const list = new this.#instance.StringList();
        for (const v of arr)
            list.push_back(v);
        return list;
    };
    #createUint8List = (data) => {
        if (!this.#instance?.Uint8List)
            return null;
        const list = new this.#instance.Uint8List();
        if (data)
            data.forEach((byte) => list.push_back(byte));
        return list;
    };
    #startAudioPlaybackLoop = () => {
        if (this.#audioPlaybackLoopInterval)
            return;
        this.#ensureInitialized();
        this.#isPlaybackActive = true;
        if (typeof this.#instance.requestAudioDataFromWasmVoip !== "function")
            return;
        const framesPerChunk = 320;
        const bufferSize = framesPerChunk * 4;
        try {
            const _malloc = this.#instance._malloc ?? this.#instance.malloc;
            if (!_malloc)
                return;
            this.#audioPlaybackBuffer = _malloc(bufferSize);
        }
        catch {
            return;
        }
        if (!this.#audioPlaybackBuffer || this.#audioPlaybackBuffer <= 0)
            return;
        this.#audioPlaybackLoopInterval = setInterval(() => {
            if (!this.#isPlaybackActive || !this.#instance || !this.#initialized) {
                this.#stopAudioPlaybackLoop();
                return;
            }
            try {
                this.#instance.requestAudioDataFromWasmVoip(this.#audioPlaybackBuffer, bufferSize);
                const heapF32 = this.#instance.GROWABLE_HEAP_F32?.();
                if (!heapF32)
                    return;
                const index = Math.floor(this.#audioPlaybackBuffer / 4);
                const numFloats = Math.floor(bufferSize / 4);
                if (index < 0 || index + numFloats > heapF32.length)
                    return;
                const audioData = new Float32Array(heapF32.buffer, heapF32.byteOffset + index * 4, numFloats);
                const hasNonZero = audioData.some((s) => Math.abs(s) > 0.0001);
                if (hasNonZero)
                    this.#config.callbacks?.onAudioPlaybackData?.(audioData);
            }
            catch { }
        }, 16);
    };
    #stopAudioPlaybackLoop = () => {
        this.#isPlaybackActive = false;
        if (this.#audioPlaybackLoopInterval) {
            clearInterval(this.#audioPlaybackLoopInterval);
            this.#audioPlaybackLoopInterval = null;
        }
        if (this.#audioPlaybackBuffer && this.#audioPlaybackBuffer > 0) {
            try {
                this.#instance?._free?.(this.#audioPlaybackBuffer);
            }
            catch { }
            this.#audioPlaybackBuffer = null;
        }
    };
    #applyDefaultAbProps = () => {
        if (!this.#instance)
            return;
        const setInt = typeof this.#instance.setABPropInt === "function"
            ? (k, v) => { this.#instance.setABPropInt(k, v); }
            : null;
        const setBool = typeof this.#instance.setABPropBool === "function"
            ? (k, v) => { this.#instance.setABPropBool(k, v); }
            : null;
        const setString = typeof this.#instance.setABPropString === "function"
            ? (k, v) => { this.#instance.setABPropString(k, v); }
            : null;
        if (!setInt && !setBool && !setString)
            return;
        const opts = this.#config.options ?? {};
        const intProps = {
            heartbeat_interval_s: opts.heartbeatInterval ?? 30,
            lobby_timeout_min: opts.lobbyTimeout ?? 1,
            max_num_participants_for_ss: opts.maxParticipantsScreenShare ?? 32,
            max_group_size_for_long_ringtone: opts.maxGroupSizeLongRingtone ?? 32,
            app_exit_reason_version: 1,
            log_level: opts.logLevel ?? 3,
            calling_rust_migration_bitmap: 0,
            calling_rust_migration_incoming_stanza_bitmap: 0,
            default_endpoint_thread_poll_timeout: 0,
            aigc_version: 0,
            call_admin_version: 0,
            vid_stream_pause_resume_jb_reset_threshold_ms: 0,
             
             
            opus_max_bandwidth: 1103,  
        };
        const boolProps = {
            enable_av_downgrade: false,
            enable_new_user_action_stanza_for_raise_hand_sender: false,
            enable_webcodec_video_encode: false,
            enable_init_bwe_for_group_call: false,
            enable_ring_for_gc_on_offer_expire: false,
            allow_reporting_call_replayer_id: false,
            enable_offer_v2_upgrade: false,
            enable_silent_offer: false,
            voice_ai_conversation_starter_latency_tracking: false,
            enable_waiting_room_logging: false,
            attach_transport_rtx: false,
            ignore_joinable_terminate_on_expired_offer: false,
            enable_passthrough_video_decoder: false,
        };
        for (const [key, value] of Object.entries(intProps)) {
            if (setInt && Number.isFinite(value))
                try {
                    setInt(key, value);
                }
                catch { }
        }
        for (const [key, value] of Object.entries(boolProps)) {
            if (setBool)
                try {
                    setBool(key, value);
                }
                catch { }
        }
        const overrideProps = parseJsonObjectEnv(CALL_WASM_AB_PROPS_JSON);
        for (const [key, value] of Object.entries(overrideProps)) {
            try {
                if (typeof value === "boolean" && setBool)
                    setBool(key, value);
                else if (typeof value === "number" && setInt)
                    setInt(key, value);
                else if (typeof value === "string" && setString)
                    setString(key, value);
            }
            catch { }
        }
    };
    #allocateUnusedWorker = () => {
        const workerScriptPath = resolveWorkerScriptPath();
        if (!fs.existsSync(workerScriptPath))
            return;
        try {
            const worker = new node_worker_threads_1.Worker(workerScriptPath, {
                stdout: true, stderr: true,
                workerData: {
                    wasmPath: this.#config.wasmPath,
                    wasmBinary: this.#config.wasmBinary,
                    workerModulesCode: this.#workerModulesCode,
                    loaderCode: this.#loaderCode,
                    loaderModuleName: this.#config.loaderModuleName,
                    resourcesPath: this.#config.resourcesPath,
                    enableLogs: this.#config.enableLogs,
                },
            });
            const port = new NodeWorkerMessagePort(worker, "WAWebVoipWebWasmWorker");
            worker.stdout?.on("data", () => { });  
            worker.stderr?.on("data", filterWorkerStderr);
            this.#unusedWorkers.push(port);
        }
        catch { }
    };
    #initPThreadPool = async () => {
        for (let i = 0; i < PTHREAD_POOL_SIZE; i += 1)
            this.#allocateUnusedWorker();
    };
    #loadWasmModuleToWorker = (worker) => new Promise((resolve) => {
        const loadedHandler = (msg) => {
            if (msg && msg.cmd === "loaded") {
                worker.removeMessageListener("cmd", loadedHandler);
                this.#workersLoadedCount += 1;
                if (this.#workersLoadedCount >= PTHREAD_POOL_SIZE && this.#removeRunDependencyCallback) {
                    this.#removeRunDependencyCallback("loading-workers");
                }
                resolve();
            }
        };
        worker.addMessageListener("cmd", loadedHandler);
        worker.workerID = this.#nextWorkerID++;
        worker.postMessage({
            cmd: "load", type: "cmd",
            wasmMemory: this.#wasmMemory,
            wasmModule: this.#wasmModule,
            workerID: worker.workerID,
            handlers: [],
        });
    });
    #loadWasmModuleToAllWorkers = async () => {
        this.#workersLoadedCount = 0;
        await Promise.all(this.#unusedWorkers.map((w) => this.#loadWasmModuleToWorker(w)));
    };
    #registerGlobalCallbacks = () => {
        const callbacks = this.#config.callbacks ?? {};
        _a.registerGlobalCallbackListener("loggingCallback", (data) => {
            if (!this.#config.enableLogs)
                return;
            const level = data?.level;
            const msg = data?.message ?? "";
            const mapped = level === 1 ? "error" : level === 2 ? "warn" : level === 3 ? "log" : "debug";
            callbacks.onLog?.(mapped, msg);
        });
        if (callbacks.onAudioCaptureInit) {
            _a.registerGlobalCallbackListener("initCaptureDriverJS", (data) => {
                callbacks.onAudioCaptureInit({
                    sampleRate: data?.sample_rate ?? data?.sampleRate,
                    channels: data?.channels,
                    bitsPerSample: data?.bits_per_sample ?? data?.bitsPerSample,
                    framesPerChunk: data?.frames_per_chunk ?? data?.framesPerChunk,
                });
            });
        }
        _a.registerGlobalCallbackListener("startCaptureJS", () => callbacks.onAudioCaptureStart?.());
        _a.registerGlobalCallbackListener("stopCaptureJS", () => callbacks.onAudioCaptureStop?.());
        if (callbacks.onAudioPlaybackInit) {
            _a.registerGlobalCallbackListener("initPlaybackDriverJS", (data) => {
                callbacks.onAudioPlaybackInit({
                    sampleRate: data?.sample_rate ?? data?.sampleRate,
                    channels: data?.channels,
                    bitsPerSample: data?.bits_per_sample ?? data?.bitsPerSample,
                    framesPerChunk: data?.frames_per_chunk ?? data?.framesPerChunk,
                });
            });
        }
        _a.registerGlobalCallbackListener("startPlaybackJS", () => {
            callbacks.onAudioPlaybackStart?.();
            this.#startAudioPlaybackLoop();
        });
        _a.registerGlobalCallbackListener("stopPlaybackJS", () => {
            this.#stopAudioPlaybackLoop();
            callbacks.onAudioPlaybackStop?.();
        });
        if (callbacks.onSignalingXmpp) {
            _a.registerGlobalCallbackListener("onSignalingXmpp", (data) => {
                const peerJid = data.peerJid ?? data.args?.peerJid;
                const callId = data.callId ?? data.args?.callId;
                let xmlPayload = data.xmlPayload ?? data.args?.xmlPayload;
                if (Array.isArray(xmlPayload))
                    xmlPayload = new Uint8Array(xmlPayload);
                else if (xmlPayload && typeof xmlPayload === "object" &&
                    !(xmlPayload instanceof Uint8Array) && !Buffer.isBuffer(xmlPayload)) {
                    xmlPayload = new Uint8Array(xmlPayload);
                }
                callbacks.onSignalingXmpp(peerJid, callId, xmlPayload);
            });
        }
        if (callbacks.onCallEvent) {
            _a.registerGlobalCallbackListener("onCallEvent", (data) => {
                callbacks.onCallEvent(data.eventType, data.eventDataJson);
            });
        }
        if (callbacks.sendDataToRelay) {
            _a.registerGlobalCallbackListener("sendDataToRelay", (data) => {
                let relayData = data.data ?? data.args?.data;
                const ip = data.ip ?? data.args?.ip;
                const portNum = data.port ?? data.args?.port;
                if (relayData instanceof Uint8Array) {   }
                else if (Array.isArray(relayData))
                    relayData = new Uint8Array(relayData);
                else if (Buffer.isBuffer(relayData))
                    relayData = new Uint8Array(relayData);
                else if (relayData && typeof relayData === "object" && relayData.buffer) {
                    relayData = new Uint8Array(relayData.buffer, relayData.byteOffset ?? 0, relayData.byteLength ?? relayData.length);
                }
                else if (relayData instanceof ArrayBuffer)
                    relayData = new Uint8Array(relayData);
                else
                    return 0;
                if (!ip || !portNum)
                    return 0;
                callbacks.sendDataToRelay(relayData, ip, portNum);
                return relayData.byteLength;
            });
        }
        _a.#globalCallbacksRegistered = true;
    };
    #requireModule = (name) => {
        const preDefinedModules = {
            Promise,
            WAWebVoipWebWasmWorkerResource: {
                resourcePath: resolveWorkerScriptPath(),
                name: "WAWebVoipWebWasmWorker",
            },
            WorkerBundleResource: {
                createDedicatedWebWorker: (resource) => {
                    const scriptPath = resource?.resourcePath && fs.existsSync(resource.resourcePath)
                        ? resource.resourcePath
                        : resolveWorkerScriptPath();
                    const worker = new node_worker_threads_1.Worker(scriptPath, {
                        stdout: true, stderr: true,
                        workerData: {
                            wasmPath: this.#config.wasmPath,
                            wasmBinary: this.#config.wasmBinary,
                            workerModulesCode: this.#workerModulesCode,
                            loaderCode: this.#loaderCode,
                            loaderModuleName: this.#config.loaderModuleName,
                            resourcesPath: this.#config.resourcesPath,
                            enableLogs: this.#config.enableLogs,
                        },
                    });
                    worker.stdout?.on("data", () => { });
                    worker.stderr?.on("data", filterWorkerStderr);
                    return worker;
                },
            },
            WorkerClient: { init: () => { } },
            WorkerMessagePort: {
                WorkerMessagePort: NodeWorkerMessagePort,
                CastWorkerMessagePort: (w) => w,
                WorkerSyncedMessagePort: NodeWorkerMessagePort,
            },
            bx: Object.assign((id) => String(id), { getURL: () => "" }),
            HasteSupportData: { handle: () => { } },
            ServiceWorkerDynamicModules: { handle: () => { } },
            WhatsAppWebServiceWorker: { default: true },
            WAWebLogger: { initializeWAWebLogger: () => { } },
            WAWebSw: { initHandlers: () => { } },
            WAWebWamRuntimeProvider: { setWamRuntime: () => { } },
            WAWebWamWorkerInterface: { commit: () => { }, set: () => { } },
            ServerJSDefine: { handleDefine: () => { } },
            ix: { add: () => { } },
            MetaConfigMap: { add: () => { } },
            QPLHasteSupportDataStorage: { default: { add: () => { }, get: () => null } },
            getFalcoLogPolicy_DO_NOT_USE: { add: () => { } },
            gkx: { add: () => { } },
            justknobx: { add: () => { } },
            qex: { add: () => { } },
        };
        if (preDefinedModules[name])
            return preDefinedModules[name];
        const mod = this.#moduleRegistry.get(name);
        if (!mod)
            return {};
        if (mod.exports !== undefined)
            return mod.exports;
        const requireFn = this.#requireModule;
        const normalizeModuleResult = (value) => {
            if (value && typeof value === "object" && "exports" in value && Object.keys(value).length === 1) {
                return value.exports;
            }
            return value;
        };
        const importDefaultFn = (dep) => {
            const v = requireFn(dep);
            return v && v.__esModule ? v.default : v;
        };
        const importAllFn = (dep) => {
            const v = requireFn(dep);
            if (v == null)
                return { default: v };
            if (v.__esModule)
                return v;
            if (typeof v !== "object" && typeof v !== "function")
                return { default: v };
            const ns = {};
            for (const key of Object.keys(v))
                ns[key] = v[key];
            ns.default = v;
            return ns;
        };
        const tryMetro = () => {
            const module = { exports: {} };
            mod.factory(this.#vmContext ?? globalThis, requireFn, importDefaultFn, importAllFn, null, module, module.exports);
            return normalizeModuleResult(module.exports);
        };
        const tryLegacy = () => {
            const exports = {};
            const module = { exports };
            const resolvedDeps = mod.deps.map((dep) => requireFn(dep));
            mod.factory(this.#vmContext ?? globalThis, requireFn, requireFn, requireFn, module, exports, ...resolvedDeps);
            return normalizeModuleResult(module.exports);
        };
        let result = {};
        let metroError = null;
        try {
            result = tryMetro();
        }
        catch (e) {
            metroError = e;
        }
        if (metroError != null || (result && typeof result === "object" && Object.keys(result).length === 0)) {
            try {
                const legacyResult = tryLegacy();
                if (typeof legacyResult === "function" || (legacyResult && Object.keys(legacyResult).length > 0)) {
                    result = legacyResult;
                }
            }
            catch { }
        }
        mod.exports = result;
        return result;
    };
    #createVMContext = (memory) => {
        const callbacks = this.#config.callbacks ?? {};
        const wasmCallbacks = {
            onVoipReady: () => {
                this.#voipReadyResolver?.();
                callbacks.onVoipReady?.();
            },
            onSignalingXmpp: (data) => callbacks.onSignalingXmpp?.(data?.peerJid, data?.callId, data?.xmlPayload),
            onCallEvent: (data) => callbacks.onCallEvent?.(data?.eventType, data?.eventDataJson),
            sendDataToRelay: (data) => callbacks.sendDataToRelay?.(data?.data, data?.ip, data?.port),
            loggingCallback: (data) => {
                if (!this.#config.enableLogs)
                    return;
                const level = data?.level;
                const msg = data?.message ?? "";
                const mapped = level === 1 ? "error" : level === 2 ? "warn" : level === 3 ? "log" : "debug";
                callbacks.onLog?.(mapped, msg);
            },
            initCaptureDriverJS: (data) => {
                callbacks.onAudioCaptureInit?.({
                    sampleRate: data?.sample_rate, channels: data?.channels,
                    bitsPerSample: data?.bits_per_sample, framesPerChunk: data?.frames_per_chunk,
                });
                return 0;
            },
            startCaptureJS: () => { callbacks.onAudioCaptureStart?.(); return 0; },
            stopCaptureJS: () => { callbacks.onAudioCaptureStop?.(); return 0; },
            initPlaybackDriverJS: (data) => {
                callbacks.onAudioPlaybackInit?.({
                    sampleRate: data?.sample_rate, channels: data?.channels,
                    bitsPerSample: data?.bits_per_sample, framesPerChunk: data?.frames_per_chunk,
                });
                return 0;
            },
            startPlaybackJS: () => {
                callbacks.onAudioPlaybackStart?.();
                this.#startAudioPlaybackLoop();
                return 0;
            },
            stopPlaybackJS: () => {
                this.#stopAudioPlaybackLoop();
                callbacks.onAudioPlaybackStop?.();
                return 0;
            },
            startVideoCaptureJS: () => 0,
            stopVideoCaptureJS: () => 0,
            startDesktopCaptureJS: () => 0,
            stopDesktopCaptureJS: () => 0,
            dataChannelStateCallback: () => 0,
            getBrowserAudioProcessingStatus: () => 7,
            getBweModelPath: () => null,
            videoFrameConsumed: () => 0,
            cryptoHkdfExtractWithSaltAndExpand: (data) => {
                const key = toByteArray(data?.key_);
                const salt = data?.salt_ ? toByteArray(data.salt_) : new Uint8Array(0);
                const info = toByteArray(data?.info_);
                const length = data?.length ?? 32;
                return callbacks.cryptoHkdf?.(key, salt, info, length) ?? new Uint8Array(length);
            },
            hmacSha256KeyGenerator: (data) => {
                const hmacData = new Uint8Array(data?.data_ ?? []);
                const hmacKey = new Uint8Array(data?.key_ ?? []);
                return callbacks.hmacSha256?.(hmacData, hmacKey) ?? new Uint8Array(32);
            },
            isParticipantKnownContact: () => true,
            getPersistentDirectoryPath: () => {
                const dir = "/tmp/voip";
                try {
                    if (!fs.existsSync(dir))
                        fs.mkdirSync(dir, { recursive: true });
                }
                catch { }
                return dir;
            },
        };
        const __d = (name, deps, factory) => {
            this.#moduleRegistry.set(name, { deps, factory, exports: undefined });
        };
        const babelHelpers = {
            extends: Object.assign,
            inheritsLoose: (sub, sup) => {
                sub.prototype = Object.create(sup.prototype);
                sub.prototype.constructor = sub;
                sub.__proto__ = sup;
            },
            objectWithoutPropertiesLoose: (source, excluded) => {
                if (source == null)
                    return {};
                const target = {};
                for (const key of Object.keys(source)) {
                    if (excluded.indexOf(key) >= 0)
                        continue;
                    target[key] = source[key];
                }
                return target;
            },
            taggedTemplateLiteralLoose: (strings, raw) => {
                if (!raw)
                    raw = strings.slice(0);
                strings.raw = raw;
                return strings;
            },
            wrapNativeSuper: (Class) => Class,
        };
        const addRunDependency = (dep) => {
            if (dep === "loading-workers" && this.#workersLoadedCount >= PTHREAD_POOL_SIZE) {
                setImmediate(() => this.#removeRunDependencyCallback?.(dep));
            }
        };
        const removeRunDependency = (_dep) => { };
        this.#removeRunDependencyCallback = removeRunDependency;
        const webCrypto = {
            getRandomValues: (arr) => {
                if (!arr || !ArrayBuffer.isView(arr)) {
                    throw new TypeError("crypto.getRandomValues expects a TypedArray");
                }
                const bytes = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
                (0, node_crypto_1.randomFillSync)(bytes);
                return arr;
            },
        };
        const selfObj = {
            __swData: { dynamic_data: { hsdp: {}, dynamic_modules: [] } },
            WhatsAppVoipWasmCallbacks: wasmCallbacks,
            WhatsAppVoipWasmWorkerCompatibleCallbacks: wasmCallbacks,
            crypto: webCrypto,
        };
        selfObj.self = selfObj;
        selfObj.window = selfObj;
        selfObj.globalThis = selfObj;
        if (typeof global !== "undefined") {
            global.WhatsAppVoipWasmCallbacks = wasmCallbacks;
            global.WhatsAppVoipWasmWorkerCompatibleCallbacks = wasmCallbacks;
        }
        const context = vm.createContext({
            self: selfObj, globalThis: selfObj, global: selfObj, window: selfObj,
            console, setTimeout, setInterval, clearTimeout, clearInterval,
            queueMicrotask, performance, babelHelpers, __d,
            require: this.#requireModule,
            addRunDependency, removeRunDependency,
            WebAssembly, SharedArrayBuffer,
            Atomics: this.#createAtomicsWrapper(memory),
            Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array,
            Float32Array, Float64Array, BigInt64Array, BigUint64Array,
            ArrayBuffer, DataView, Error, TypeError, RangeError, Promise,
            Map, Set, WeakMap, WeakSet, Symbol, Object, Array, String, Number,
            Boolean, Math, Date, JSON, RegExp, Function, Proxy, Reflect,
            crypto: webCrypto,
            WhatsAppVoipWasmCallbacks: wasmCallbacks,
            WhatsAppVoipWasmWorkerCompatibleCallbacks: wasmCallbacks,
            navigator: {
                userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                hardwareConcurrency: 4,
            },
            process: undefined,
            document: { currentScript: null },
            location: { href: "file:///wasm" },
            Worker: class {
                constructor() { }
                postMessage() { }
                terminate() { }
                addEventListener() { }
            },
            fetch: async () => { throw new Error("fetch not supported"); },
            XMLHttpRequest: class {
                open() { }
                send() { }
                setRequestHeader() { }
            },
            Blob: class {
                constructor() { }
            },
            URL: { createObjectURL: () => "blob:fake", revokeObjectURL: () => { } },
            Image: class {
                src = "";
                onload = null;
                onerror = null;
            },
            Audio: class {
                src = "";
                addEventListener() { }
            },
            __NODE_PTHREAD: {
                getUnusedWorker: () => {
                    if (this.#unusedWorkers.length === 0)
                        return null;
                    const worker = this.#unusedWorkers.pop();
                    this.#runningWorkers.push(worker);
                    return worker;
                },
                returnWorkerToPool: (worker) => {
                    const idx = this.#runningWorkers.indexOf(worker);
                    if (idx >= 0) {
                        this.#runningWorkers.splice(idx, 1);
                        this.#unusedWorkers.push(worker);
                    }
                },
                spawnThread: (params) => {
                    const worker = this.#unusedWorkers.pop();
                    if (!worker)
                        return 6;
                    this.#runningWorkers.push(worker);
                    this.#pthreads[params.pthread_ptr] = worker;
                    worker.pthread_ptr = params.pthread_ptr;
                    const pthreadTable = this.#instance?.PThread?.pthreads;
                    if (pthreadTable)
                        pthreadTable[params.pthread_ptr] = worker;
                    worker.postMessage({
                        cmd: "run",
                        start_routine: params.startRoutine,
                        arg: params.arg,
                        pthread_ptr: params.pthread_ptr,
                    });
                    return 0;
                },
                unusedWorkersCount: () => this.#unusedWorkers.length,
                runningWorkersCount: () => this.#runningWorkers.length,
            },
            __IS_NODE_PTHREAD_ENV: true,
        });
        context.self = context;
        context.globalThis = context;
        context.global = context;
        context.window = context;
        return context;
    };
    #createAtomicsWrapper = (_memory) => {
        const atomicsWrapper = {
            add: Atomics.add.bind(Atomics),
            and: Atomics.and.bind(Atomics),
            compareExchange: Atomics.compareExchange.bind(Atomics),
            exchange: Atomics.exchange.bind(Atomics),
            isLockFree: Atomics.isLockFree.bind(Atomics),
            load: Atomics.load.bind(Atomics),
            or: Atomics.or.bind(Atomics),
            store: Atomics.store.bind(Atomics),
            sub: Atomics.sub.bind(Atomics),
            xor: Atomics.xor.bind(Atomics),
            notify: (typedArray, index, count) => {
                try {
                    return Atomics.notify(typedArray, index, count);
                }
                catch (e) {
                    if (e?.message?.includes("futex_wake") || e?.message?.includes("main_browser_thread"))
                        return 0;
                    throw e;
                }
            },
            waitAsync: Atomics.waitAsync
                ? Atomics.waitAsync.bind(Atomics)
                : () => ({ async: true, value: Promise.resolve("ok") }),
            wait: (typedArray, index, value, timeout) => {
                const currentValue = Atomics.load(typedArray, index);
                if (currentValue !== value)
                    return "not-equal";
                if (timeout !== undefined && timeout <= 0)
                    return "timed-out";
                return "timed-out";
            },
            [Symbol.toStringTag]: "Atomics",
        };
        return atomicsWrapper;
    };
}
exports.WasmEngine = WasmEngine;
_a = WasmEngine;
exports.default = WasmEngine;

return module.exports;
})();
for (const key of Object.keys(__kageModule108)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule108[key]});
}
