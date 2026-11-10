"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }var _decodejs = require('../WABinary/decode.js');
var _encodejs = require('../WABinary/encode.js');
var _genericutilsjs = require('../WABinary/generic-utils.js');
var _jidutilsjs = require('../WABinary/jid-utils.js');
var _genericsjs = require('../Utils/generics.js');
var _signaljs = require('../Utils/signal.js');
var _validateconnectionjs = require('../Utils/validate-connection.js');
var _indexjs = require('../../WAProto/index.js');

const S_WHATSAPP_NET = "@s.whatsapp.net";
const TC_TOKEN_REQUEST_TIMEOUT_MS = 3500;
const SESSION_CACHE_TTL_MS = 5 * 60000;
const ACK_TIMEOUT_MS = 15000;

const getNodeChildren = (node) =>
  Array.isArray(node.content) ? node.content : [];

const setNodeChildren = (node, children) => {
  node.content = children.length ? children : undefined;
};

const replaceNodeChild = (node, tag, nextChild) => {
  const children = getNodeChildren(node);
  const index = children.findIndex((c) => c.tag === tag);
  if (index >= 0) children[index] = nextChild;
  else children.push(nextChild);
  setNodeChildren(node, children);
};

const removeNodeChildrenByTag = (node, tag) => {
  setNodeChildren(node, getNodeChildren(node).filter((c) => c.tag !== tag));
};

const parseCountAttr = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

 class SignalingBridge {
  #sock;
  #voip = null;
  #observedTcTokens = new Map();
  #pendingTcTokenWaiters = new Map();
  #ensuredSignalSessions = new Map();
  #remoteDevicePeerByCallId = new Map();
  #remoteObfuscatedPeerByCallId = new Map();
  #remoteXmppRoutePeerByCallId = new Map();
  #incomingCallPeerById = new Map();
  #outgoingSignalingQueue = Promise.resolve(undefined);
  #incomingSignalingQueue = Promise.resolve(undefined);

  constructor(config) {;SignalingBridge.prototype.__init.call(this);SignalingBridge.prototype.__init2.call(this);SignalingBridge.prototype.__init3.call(this);SignalingBridge.prototype.__init4.call(this);SignalingBridge.prototype.__init5.call(this);SignalingBridge.prototype.__init6.call(this);SignalingBridge.prototype.__init7.call(this);SignalingBridge.prototype.__init8.call(this);SignalingBridge.prototype.__init9.call(this);SignalingBridge.prototype.__init10.call(this);SignalingBridge.prototype.__init11.call(this);SignalingBridge.prototype.__init12.call(this);
    this.#sock = config.sock;
  }

  __init() {this.attachEngine = (voip) => {
    this.#voip = voip;
  }}

  __init2() {this.init = async () => {
    const originalKeysSet = this.#sock.authState.keys.set.bind(this.#sock.authState.keys);
    this.#sock.authState.keys.set = async (data) => {
      const result = await originalKeysSet(data);
      for (const [jid, entry] of Object.entries(_nullishCoalesce(_optionalChain([data, 'optionalAccess', _11 => _11.tctoken]), () => ( {})))) {
        if (_optionalChain([entry, 'optionalAccess', _12 => _12.token]) instanceof Uint8Array && entry.token.length > 0) {
          this.#rememberTcToken(jid, entry.token, entry.timestamp);
        }
      }
      return result;
    };
  }}

  __init3() {this.sendSignaling = (peerJid, callId, xmlPayload) => {
    this.#outgoingSignalingQueue = this.#outgoingSignalingQueue
      .then(() => this.#doSendSignaling(peerJid, callId, xmlPayload))
      .catch(() => {});
  }}

  __init4() {this.processIncomingCall = (node, voip, activeCallId) => {
    this.#incomingSignalingQueue = this.#incomingSignalingQueue
      .then(() => this.#doProcessIncomingCall(node, voip, activeCallId))
      .catch(() => {});
  }}

  __init5() {this.processIncomingReceipt = (node, voip, activeCallId) => {
    this.#incomingSignalingQueue = this.#incomingSignalingQueue
      .then(() => this.#doProcessIncomingReceipt(node, voip, activeCallId))
      .catch(() => {});
  }}

  __init6() {this.requestTcToken = async (jid) => {
    const userJid = this.#toBareJid(jid);
    const cached = await this.#getTcToken(userJid);
    if (_optionalChain([cached, 'optionalAccess', _13 => _13.length])) return cached;

    try {
      const response = await this.#sock.getPrivacyTokens([userJid]);
      const tokensNode =
        _nullishCoalesce(_genericutilsjs.getBinaryNodeChild.call(void 0, response, "tokens"), () => (
        _genericutilsjs.getBinaryNodeChild.call(void 0, _genericutilsjs.getBinaryNodeChild.call(void 0, response, "iq"), "tokens")));
      const tokenNodes = tokensNode
        ? _genericutilsjs.getAllBinaryNodeChildren.call(void 0, tokensNode).filter((c) => c.tag === "token")
        : [];

      for (const tokenNode of tokenNodes) {
        const tokenJid = String(_nullishCoalesce(tokenNode.attrs.jid, () => ( "")));
        if (_jidutilsjs.jidNormalizedUser.call(void 0, tokenJid) !== _jidutilsjs.jidNormalizedUser.call(void 0, userJid)) continue;
        const content = tokenNode.content;
        if (content instanceof Uint8Array && content.length > 0) {
          const token = Buffer.from(content);
          await this.#sock.authState.keys.set({
            tctoken: { [userJid]: { token, timestamp: String(_nullishCoalesce(tokenNode.attrs.t, () => ( ""))) } },
          });
          return token;
        }
      }
    } catch (e4) {}

    return this.#getTcToken(userJid);
  }}

  __init7() {this.ensureTcToken = async (...jids) => {
    const uniqueJids = [
      ...new Set(jids.map((j) => this.#toBareJid(String(_nullishCoalesce(j, () => ( ""))).trim())).filter(Boolean)),
    ];
    for (const jid of uniqueJids) {
      const cached = await this.#getTcToken(jid);
      if (_optionalChain([cached, 'optionalAccess', _14 => _14.length])) return cached;
    }
    for (const jid of uniqueJids) {
      const fetched = await Promise.race([
        this.requestTcToken(jid),
        new Promise((r) => setTimeout(() => r(undefined), TC_TOKEN_REQUEST_TIMEOUT_MS)),
      ]);
      if (_optionalChain([fetched, 'optionalAccess', _15 => _15.length])) return fetched;
    }
    return undefined;
  }}

  __init8() {this.discoverPeerDevices = async (peerLidJid) => {
    const devices = await this.#sock.getUSyncDevices([peerLidJid], true, false);
    return this.#normalizeStartCallPeerList(devices.map((d) => d.jid).filter(Boolean));
  }}

  __init9() {this.ensureSessionsForPeers = async (jids) => {
    const targets = this.#expandSignalSessionTargets(jids);
    if (targets.length) await this.#ensureSignalSessions(targets, true);
  }}

  __init10() {this.resolveLid = async (pnJid) =>
    _optionalChain([this, 'access', _16 => _16.#sock, 'access', _17 => _17.signalRepository, 'access', _18 => _18.lidMapping, 'optionalAccess', _19 => _19.getLIDForPN, 'call', _20 => _20(pnJid)])}

  __init11() {this.issueTcToken = async (jid) => {
    const userJid = this.#toBareJid(jid);
    const issuedAt = Math.floor(Date.now() / 1000);
    try {
      await this.#sock.query({
        tag: "iq",
        attrs: {
          to: S_WHATSAPP_NET, type: "set", xmlns: "privacy",
          id: this.#sock.generateMessageTag(),
        },
        content: [{
          tag: "tokens", attrs: {},
          content: [{
            tag: "token",
            attrs: { jid: userJid, t: String(issuedAt), type: "trusted_contact" },
          }],
        }],
      });
      return true;
    } catch (e5) {
      return false;
    }
  }}

  __init12() {this.getRemoteDeviceJid = (callId) =>
    this.#remoteDevicePeerByCallId.get(callId)}

  #doSendSignaling = async (peerJid, callId, xmlPayload) => {
    const rawPayload = Buffer.from(xmlPayload);
    let voipNode;
    try {
      voipNode = await _decodejs.decodeBinaryNode.call(void 0, Buffer.concat([Buffer.from([0]), rawPayload]));
    } catch (e6) {
      voipNode = await _decodejs.decodeBinaryNode.call(void 0, rawPayload);
    }

    const signalingTag = String(voipNode.tag);
    const effectivePeerJid = this.#resolveOutboundPeerJid(callId, peerJid);

    if (signalingTag === "offer" && !voipNode.attrs["call-creator"]) {
      const selfLid = _optionalChain([this, 'access', _21 => _21.#sock, 'access', _22 => _22.authState, 'access', _23 => _23.creds, 'access', _24 => _24.me, 'optionalAccess', _25 => _25.lid]);
      if (selfLid) voipNode.attrs["call-creator"] = selfLid;
    }

    const destination = _genericutilsjs.getBinaryNodeChild.call(void 0, voipNode, "destination");
    if (destination) {
      const destinations = getNodeChildren(destination);
      const destinationJids = destinations
        .map((n) => String(_nullishCoalesce(n.attrs.jid, () => ( ""))).trim())
        .filter(Boolean);
      const sessionTargets = this.#expandSignalSessionTargets(destinationJids);
      if (sessionTargets.length) await this.#ensureSignalSessions(sessionTargets, signalingTag === "offer");

      const rootEnc = _genericutilsjs.getBinaryNodeChild.call(void 0, voipNode, "enc");
      const encCount = parseCountAttr(_optionalChain([rootEnc, 'optionalAccess', _26 => _26.attrs, 'access', _27 => _27.count]));
      let includeDeviceIdentity = false;

      for (const destNode of destinations) {
        const targetJid = String(_nullishCoalesce(destNode.attrs.jid, () => ( ""))).trim();
        const destEnc = _genericutilsjs.getBinaryNodeChild.call(void 0, destNode, "enc");
        if (!targetJid || !destEnc || !(destEnc.content instanceof Uint8Array)) continue;
        try {
          const encrypted = await this.#encryptCallKey(targetJid, destEnc.content, encCount);
          includeDeviceIdentity = includeDeviceIdentity || encrypted.shouldIncludeDeviceIdentity;
          setNodeChildren(destNode, [encrypted.encNode]);
        } catch (e7) {
          for (const d of destinations) removeNodeChildrenByTag(d, "enc");
          break;
        }
      }
      if (includeDeviceIdentity) this.#appendDeviceIdentity(voipNode);

      await this.#sendCallStanza(this.#toBareJid(peerJid), voipNode, signalingTag, effectivePeerJid, peerJid);
      return;
    }

    if (signalingTag === "offer" || signalingTag === "enc_rekey") {
      const enc = _genericutilsjs.getBinaryNodeChild.call(void 0, voipNode, "enc");
      if (enc && enc.content instanceof Uint8Array) {
        const targetJid = this.#toCallDeviceJid(effectivePeerJid);
        const encrypted = await this.#encryptCallKey(targetJid, enc.content, parseCountAttr(enc.attrs.count));
        replaceNodeChild(voipNode, "enc", encrypted.encNode);
        if (encrypted.shouldIncludeDeviceIdentity) this.#appendDeviceIdentity(voipNode);

        await this.#sendCallStanza(targetJid, voipNode, signalingTag, effectivePeerJid, peerJid);
        return;
      }
    }

    const routeTo = signalingTag !== "offer" && signalingTag !== "enc_rekey"
      ? this.#toBareJid(effectivePeerJid)
      : this.#toCallDeviceJid(effectivePeerJid);
    await this.#sendCallStanza(routeTo, voipNode, signalingTag, effectivePeerJid, peerJid);
  };

  #sendCallStanza = async (routeTo, voipNode, signalingTag, effectivePeerJid, callbackPeerJid) => {
    const stanzaId = this.#sock.generateMessageTag();
    await this.#sock.sendNode({
      tag: "call",
      attrs: { to: routeTo, id: stanzaId },
      content: [voipNode],
    });

    void (async () => {
      try {
        const ackNode = await this.#sock.waitForMessage(stanzaId, ACK_TIMEOUT_MS);
        if (!ackNode || !this.#voip) return;
        const ackPayload = Buffer.from(_encodejs.encodeBinaryNode.call(void 0, ackNode)).toString("base64");
        const tcToken = await this.ensureTcToken(effectivePeerJid, callbackPeerJid);
        try {
          this.#voip.handleSignalingAck({
            payload: ackPayload,
            ackError: _nullishCoalesce(_optionalChain([ackNode, 'access', _28 => _28.attrs, 'optionalAccess', _29 => _29.error]), () => ( "0")),
            msgType: _nullishCoalesce(_optionalChain([ackNode, 'access', _30 => _30.attrs, 'optionalAccess', _31 => _31.type]), () => ( signalingTag)),
            peerJid: effectivePeerJid,
            extraData: tcToken,
          });
        } catch (e8) {}
      } catch (e9) {}
    })();
  };

  #doProcessIncomingCall = async (node, voip, activeCallId) => {
    const voipChild = _genericutilsjs.getAllBinaryNodeChildren.call(void 0, node)[0];
    if (!voipChild) return;

    const incomingCallId = String(_nullishCoalesce(_nullishCoalesce(voipChild.attrs["call-id"], () => ( voipChild.attrs.call_id)), () => ( "")));
    const normalizedIncomingId = incomingCallId.toUpperCase();
    const normalizedActiveId = String(_nullishCoalesce(activeCallId, () => ( ""))).toUpperCase();
    const callIdForRouting = normalizedIncomingId || normalizedActiveId;
    if (normalizedActiveId && normalizedIncomingId && normalizedIncomingId !== normalizedActiveId) return;

    const senderDeviceJid =
      String(_nullishCoalesce(voipChild.attrs.participant, () => ( ""))) ||
      String(_nullishCoalesce(node.attrs.participant, () => ( ""))) ||
      String(_nullishCoalesce(node.attrs.from, () => ( ""))) ||
      String(_nullishCoalesce(voipChild.attrs["call-creator"], () => ( "")));
    const callbackPeerJid = String(_nullishCoalesce(node.attrs.from, () => ( ""))) || senderDeviceJid;
    const platform = _nullishCoalesce(_nullishCoalesce(voipChild.attrs.platform, () => ( node.attrs.platform)), () => ( ""));
    const appVersion = _nullishCoalesce(_nullishCoalesce(voipChild.attrs.version, () => ( node.attrs.version)), () => ( ""));
    const epochId = _nullishCoalesce(_nullishCoalesce(voipChild.attrs.e, () => ( node.attrs.e)), () => ( "0"));
    const timestamp = _nullishCoalesce(_nullishCoalesce(voipChild.attrs.t, () => ( node.attrs.t)), () => ( "0"));
    const offline = !!(_nullishCoalesce(voipChild.attrs.offline, () => ( node.attrs.offline)));

    let usableNode = voipChild;
    if (_genericutilsjs.getBinaryNodeChild.call(void 0, voipChild, "enc")) {
      usableNode = await this.#maybeDecryptEnc(voipChild, senderDeviceJid);
    }

    const b64 = Buffer.from(_encodejs.encodeBinaryNode.call(void 0, usableNode)).toString("base64");

    const storedPeerJid = callIdForRouting ? this.#incomingCallPeerById.get(callIdForRouting) : undefined;
    let mappedRemoteDeviceJid = callIdForRouting ? this.#remoteDevicePeerByCallId.get(callIdForRouting) : undefined;

    if (callIdForRouting && (callbackPeerJid || senderDeviceJid)) {
      this.#remoteXmppRoutePeerByCallId.set(callIdForRouting, callbackPeerJid || senderDeviceJid);
      const hinted = this.#pickConcreteRouteHint(senderDeviceJid, callbackPeerJid);
      if (hinted && hinted !== mappedRemoteDeviceJid) {
        mappedRemoteDeviceJid = hinted;
        this.#remoteDevicePeerByCallId.set(callIdForRouting, hinted);
      }
    }

    const routedPeerJid = usableNode.tag === "offer"
      ? this.#preferDeviceRouteJid(senderDeviceJid, callbackPeerJid, storedPeerJid)
      : this.#preferOrderedRouteJid(mappedRemoteDeviceJid, storedPeerJid, senderDeviceJid, callbackPeerJid);

    if (callIdForRouting && routedPeerJid) {
      this.#incomingCallPeerById.set(callIdForRouting, routedPeerJid);
    }

    const tcToken = await this.ensureTcToken(routedPeerJid, callbackPeerJid);

    switch (usableNode.tag) {
      case "offer":
        voip.handleSignalingOffer({
          payload: b64,
          peerPlatform: Number(platform || 0),
          peerAppVersion: appVersion,
          epochId, timestamp,
          isOffline: offline,
          isOfferNotContact: false,
          peerJid: routedPeerJid,
          tcToken,
        });
        break;
      case "ack":
        voip.handleSignalingAck({
          payload: b64,
          ackError: _nullishCoalesce(usableNode.attrs.error, () => ( "0")),
          msgType: _nullishCoalesce(usableNode.attrs.type, () => ( "")),
          peerJid: routedPeerJid,
          extraData: tcToken,
        });
        break;
      default:
        voip.handleSignalingMessage({
          payload: b64,
          peerPlatform: platform,
          peerAppVersion: appVersion,
          epochId, timestamp,
          isOffline: offline,
          peerJid: routedPeerJid,
          tcToken,
        });
        if (callIdForRouting && (usableNode.tag === "terminate" || usableNode.tag === "reject")) {
          this.#incomingCallPeerById.delete(callIdForRouting);
          this.#remoteDevicePeerByCallId.delete(callIdForRouting);
          this.#remoteObfuscatedPeerByCallId.delete(callIdForRouting);
          this.#remoteXmppRoutePeerByCallId.delete(callIdForRouting);
        }
        break;
    }
  };

  #doProcessIncomingReceipt = async (node, voip, activeCallId) => {
    const receiptChild = _genericutilsjs.getAllBinaryNodeChildren.call(void 0, node)[0];
    if (!receiptChild) return;

    const incomingCallId = String(_nullishCoalesce(_nullishCoalesce(receiptChild.attrs["call-id"], () => ( receiptChild.attrs.call_id)), () => ( "")));
    const normalizedIncomingId = incomingCallId.toUpperCase();
    const normalizedActiveId = String(_nullishCoalesce(activeCallId, () => ( ""))).toUpperCase();
    const callIdForRouting = normalizedIncomingId || normalizedActiveId;
    if (normalizedActiveId && normalizedIncomingId && normalizedIncomingId !== normalizedActiveId) return;

    const callbackPeerJid = String(_nullishCoalesce(_nullishCoalesce(node.attrs.from, () => ( receiptChild.attrs["call-creator"])), () => ( "")));
    const storedPeerJid = callIdForRouting ? this.#incomingCallPeerById.get(callIdForRouting) : undefined;
    const routedPeerJid = this.#preferOrderedRouteJid(storedPeerJid, callbackPeerJid);
    if (callIdForRouting && routedPeerJid) this.#incomingCallPeerById.set(callIdForRouting, routedPeerJid);

    const tcToken = await this.ensureTcToken(routedPeerJid, callbackPeerJid);
    voip.handleSignalingReceipt({
      payload: Buffer.from(_encodejs.encodeBinaryNode.call(void 0, node)).toString("base64"),
      peerJid: routedPeerJid,
      tcToken,
    });
  };

  #maybeDecryptEnc = async (voipNode, peerJid) => {
    const enc = _genericutilsjs.getBinaryNodeChild.call(void 0, voipNode, "enc");
    if (!enc || !(enc.content instanceof Uint8Array)) return voipNode;
    const type = enc.attrs.type;
    if (type !== "pkmsg" && type !== "msg") return voipNode;

    const candidates = [...new Set([
      peerJid,
      this.#toCallDeviceJid(peerJid),
    ].filter(Boolean))];

    let lastErr;
    for (const jid of candidates) {
      try {
        const decrypted = await this.#sock.signalRepository.decryptMessage({
          jid, type, ciphertext: enc.content,
        });
        const parsed = _indexjs.proto.Message.decode(_genericsjs.unpadRandomMax16.call(void 0, decrypted));
        const callKey = _optionalChain([parsed, 'access', _32 => _32.call, 'optionalAccess', _33 => _33.callKey]);
        if (!callKey || callKey.length === 0) {
          throw new Error("decrypted signaling has no call.callKey");
        }
        enc.content = callKey;
        return voipNode;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr;
  };

  #encryptCallKey = async (targetJid, rawCallKey, count) => {
    const primaryDeviceJid = this.#toPrimaryDeviceJid(targetJid);
    const sessionTargets = primaryDeviceJid && primaryDeviceJid !== targetJid
      ? [primaryDeviceJid, targetJid]
      : [targetJid];
    await this.#ensureSignalSessions(sessionTargets, false);

    const { type, ciphertext } = await this.#sock.signalRepository.encryptMessage({
      jid: targetJid,
      data: _genericsjs.encodeWAMessage.call(void 0, { call: { callKey: Buffer.from(rawCallKey) } }),
    });

    return {
      encNode: {
        tag: "enc",
        attrs: { v: "2", type, count: String(count) },
        content: Buffer.from(ciphertext),
      },
      shouldIncludeDeviceIdentity: type === "pkmsg",
    };
  };

  #ensureSignalSessions = async (jids, refresh) => {
    const missing = [];
    for (const jid of [...new Set(jids.filter(Boolean))]) {
      const signalId = this.#sock.signalRepository.jidToSignalProtocolAddress(jid);
      const cachedAt = this.#ensuredSignalSessions.get(signalId);
      if (!refresh && cachedAt && Date.now() - cachedAt < SESSION_CACHE_TTL_MS) continue;
      if (!refresh) {
        const validation = await this.#sock.signalRepository.validateSession(jid);
        if (validation.exists) {
          this.#ensuredSignalSessions.set(signalId, Date.now());
          continue;
        }
      }
      missing.push(jid);
    }
    if (!missing.length) return;

    const sessionNode = await this.#sock.query({
      tag: "iq",
      attrs: { xmlns: "encrypt", type: "get", to: S_WHATSAPP_NET },
      content: [{
        tag: "key", attrs: {},
        content: missing.map((jid) => ({ tag: "user", attrs: { jid } })),
      }],
    });
    await _signaljs.parseAndInjectE2ESessions.call(void 0, sessionNode, this.#sock.signalRepository);
    for (const jid of missing) {
      this.#ensuredSignalSessions.set(
        this.#sock.signalRepository.jidToSignalProtocolAddress(jid),
        Date.now(),
      );
    }
  };

  #appendDeviceIdentity = (voipNode) => {
    if (_genericutilsjs.getBinaryNodeChild.call(void 0, voipNode, "device-identity")) return;
    const account = this.#sock.authState.creds.account;
    if (!account) return;
    const children = getNodeChildren(voipNode);
    children.push({
      tag: "device-identity",
      attrs: {},
      content: _validateconnectionjs.encodeSignedDeviceIdentity.call(void 0, account, true),
    });
    setNodeChildren(voipNode, children);
  };

  #toBareJid = (jid) => {
    const decoded = _jidutilsjs.jidDecode.call(void 0, jid);
    if (!_optionalChain([decoded, 'optionalAccess', _34 => _34.user])) return jid;
    const server = jid.endsWith("@lid") ? "lid" : "s.whatsapp.net";
    return _jidutilsjs.jidEncode.call(void 0, decoded.user, server);
  };

  #toCallDeviceJid = (jid) => {
    const decoded = _jidutilsjs.jidDecode.call(void 0, jid);
    if (!_optionalChain([decoded, 'optionalAccess', _35 => _35.user])) return jid;
    const server = jid.endsWith("@lid") ? "lid" : "s.whatsapp.net";
    if (decoded.device == null) return _jidutilsjs.jidEncode.call(void 0, decoded.user, server);
    return `${decoded.user}:${decoded.device}@${server}`;
  };

  #toPrimaryDeviceJid = (jid) => {
    const decoded = _jidutilsjs.jidDecode.call(void 0, jid);
    if (!_optionalChain([decoded, 'optionalAccess', _36 => _36.user])) return undefined;
    const device = decoded.device;
    if (device == null || device === 0) return undefined;
    const server = jid.endsWith("@lid") ? "lid" : "s.whatsapp.net";
    return _jidutilsjs.jidEncode.call(void 0, decoded.user, server);
  };

  #hasConcreteDevice = (jid) => {
    const decoded = _jidutilsjs.jidDecode.call(void 0, jid);
    return !!_optionalChain([decoded, 'optionalAccess', _37 => _37.user]) && decoded.device != null;
  };

  #preferDeviceRouteJid = (...candidates) => {
    for (const c of candidates) {
      const jid = String(_nullishCoalesce(c, () => ( ""))).trim();
      if (jid && this.#hasConcreteDevice(jid)) return jid;
    }
    for (const c of candidates) {
      const jid = String(_nullishCoalesce(c, () => ( ""))).trim();
      if (jid) return this.#toCallDeviceJid(jid);
    }
    return "";
  };

  #preferOrderedRouteJid = (...candidates) => {
    for (const c of candidates) {
      const jid = String(_nullishCoalesce(c, () => ( ""))).trim();
      if (jid) return this.#toCallDeviceJid(jid);
    }
    return "";
  };

  #pickConcreteRouteHint = (...candidates) => {
    for (const c of candidates) {
      const jid = String(_nullishCoalesce(c, () => ( ""))).trim();
      if (jid && this.#hasConcreteDevice(jid)) return jid;
    }
    return "";
  };

  #resolveOutboundPeerJid = (callId, wasmPeerJid) => {
    const peerJid = String(_nullishCoalesce(wasmPeerJid, () => ( ""))).trim();
    if (!peerJid || !callId) return peerJid;
    const normalizedCallId = String(callId).toUpperCase();
    return _nullishCoalesce(_nullishCoalesce(this.#remoteDevicePeerByCallId.get(normalizedCallId), () => ( this.#remoteDevicePeerByCallId.get(callId))), () => ( peerJid));
  };

  #expandSignalSessionTargets = (jids) =>
    [...new Set(jids.flatMap((jid) => {
      const primary = this.#toPrimaryDeviceJid(jid);
      return primary && primary !== jid ? [primary, jid] : [jid];
    }))];

  #normalizeStartCallPeerList = (jids) => {
    const result = new Set();
    for (const jid of jids) {
      const decoded = _jidutilsjs.jidDecode.call(void 0, jid);
      if (!_optionalChain([decoded, 'optionalAccess', _38 => _38.user])) {
        result.add(jid);
        continue;
      }
      const server = jid.endsWith("@lid") ? "lid" : "s.whatsapp.net";
      result.add(_jidutilsjs.jidEncode.call(void 0, decoded.user, server));
      if (decoded.device != null) {
        result.add(`${decoded.user}:${decoded.device}@${server}`);
      }
    }
    return [...result].slice(0, 5);
  };

  #rememberTcToken = (jid, token, timestamp = "") => {
    const bareJid = this.#toBareJid(jid);
    if (!token.length) return;
    this.#observedTcTokens.set(bareJid, { token: Buffer.from(token), timestamp });
    const waiters = this.#pendingTcTokenWaiters.get(bareJid);
    if (_optionalChain([waiters, 'optionalAccess', _39 => _39.length])) {
      this.#pendingTcTokenWaiters.delete(bareJid);
      for (const w of waiters) w(Buffer.from(token));
    }
  };

  #getTcToken = async (jid) => {
    const userJid = this.#toBareJid(jid);
    const observed = _optionalChain([this, 'access', _40 => _40.#observedTcTokens, 'access', _41 => _41.get, 'call', _42 => _42(userJid), 'optionalAccess', _43 => _43.token]);
    if (_optionalChain([observed, 'optionalAccess', _44 => _44.length])) return Buffer.from(observed);
    try {
      const data = await this.#sock.authState.keys.get("tctoken", [userJid]);
      const token = _optionalChain([data, 'access', _45 => _45[userJid], 'optionalAccess', _46 => _46.token]);
      if (token && token.length > 0) {
        this.#rememberTcToken(userJid, token, _optionalChain([data, 'access', _47 => _47[userJid], 'optionalAccess', _48 => _48.timestamp]));
        return token;
      }
    } catch (e10) {}
    return undefined;
  };
} exports.SignalingBridge = SignalingBridge;

 
const __kageModule106 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignalingBridge = void 0;
const decode_js_1 = require("../WABinary/decode.js");
const encode_js_1 = require("../WABinary/encode.js");
const generic_utils_js_1 = require("../WABinary/generic-utils.js");
const jid_utils_js_1 = require("../WABinary/jid-utils.js");
const generics_js_1 = require("../Utils/generics.js");
const signal_js_1 = require("../Utils/signal.js");
const validate_connection_js_1 = require("../Utils/validate-connection.js");
const index_js_1 = require("../../WAProto/index.js");
const S_WHATSAPP_NET = "@s.whatsapp.net";
const TC_TOKEN_REQUEST_TIMEOUT_MS = 3500;
const SESSION_CACHE_TTL_MS = 5 * 60_000;
const ACK_TIMEOUT_MS = 15_000;
const getNodeChildren = (node) => Array.isArray(node.content) ? node.content : [];
const setNodeChildren = (node, children) => {
    node.content = children.length ? children : undefined;
};
const replaceNodeChild = (node, tag, nextChild) => {
    const children = getNodeChildren(node);
    const index = children.findIndex((c) => c.tag === tag);
    if (index >= 0)
        children[index] = nextChild;
    else
        children.push(nextChild);
    setNodeChildren(node, children);
};
const removeNodeChildrenByTag = (node, tag) => {
    setNodeChildren(node, getNodeChildren(node).filter((c) => c.tag !== tag));
};
const parseCountAttr = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};
class SignalingBridge {
    #sock;
    #voip = null;
    #observedTcTokens = new Map();
    #pendingTcTokenWaiters = new Map();
    #ensuredSignalSessions = new Map();
    #remoteDevicePeerByCallId = new Map();
    #remoteObfuscatedPeerByCallId = new Map();
    #remoteXmppRoutePeerByCallId = new Map();
    #incomingCallPeerById = new Map();
    #outgoingSignalingQueue = Promise.resolve(undefined);
    #incomingSignalingQueue = Promise.resolve(undefined);
    constructor(config) {
        this.#sock = config.sock;
    }
    attachEngine = (voip) => {
        this.#voip = voip;
    };
    init = async () => {
        const originalKeysSet = this.#sock.authState.keys.set.bind(this.#sock.authState.keys);
        this.#sock.authState.keys.set = async (data) => {
            const result = await originalKeysSet(data);
            for (const [jid, entry] of Object.entries(data?.tctoken ?? {})) {
                if (entry?.token instanceof Uint8Array && entry.token.length > 0) {
                    this.#rememberTcToken(jid, entry.token, entry.timestamp);
                }
            }
            return result;
        };
    };
    sendSignaling = (peerJid, callId, xmlPayload) => {
        this.#outgoingSignalingQueue = this.#outgoingSignalingQueue
            .then(() => this.#doSendSignaling(peerJid, callId, xmlPayload))
            .catch(() => { });
    };
    processIncomingCall = (node, voip, activeCallId) => {
        this.#incomingSignalingQueue = this.#incomingSignalingQueue
            .then(() => this.#doProcessIncomingCall(node, voip, activeCallId))
            .catch(() => { });
    };
    processIncomingReceipt = (node, voip, activeCallId) => {
        this.#incomingSignalingQueue = this.#incomingSignalingQueue
            .then(() => this.#doProcessIncomingReceipt(node, voip, activeCallId))
            .catch(() => { });
    };
    requestTcToken = async (jid) => {
        const userJid = this.#toBareJid(jid);
        const cached = await this.#getTcToken(userJid);
        if (cached?.length)
            return cached;
        try {
            const response = await this.#sock.getPrivacyTokens([userJid]);
            const tokensNode = (0, generic_utils_js_1.getBinaryNodeChild)(response, "tokens") ??
                (0, generic_utils_js_1.getBinaryNodeChild)((0, generic_utils_js_1.getBinaryNodeChild)(response, "iq"), "tokens");
            const tokenNodes = tokensNode
                ? (0, generic_utils_js_1.getAllBinaryNodeChildren)(tokensNode).filter((c) => c.tag === "token")
                : [];
            for (const tokenNode of tokenNodes) {
                const tokenJid = String(tokenNode.attrs.jid ?? "");
                if ((0, jid_utils_js_1.jidNormalizedUser)(tokenJid) !== (0, jid_utils_js_1.jidNormalizedUser)(userJid))
                    continue;
                const content = tokenNode.content;
                if (content instanceof Uint8Array && content.length > 0) {
                    const token = Buffer.from(content);
                    await this.#sock.authState.keys.set({
                        tctoken: { [userJid]: { token, timestamp: String(tokenNode.attrs.t ?? "") } },
                    });
                    return token;
                }
            }
        }
        catch { }
        return this.#getTcToken(userJid);
    };
    ensureTcToken = async (...jids) => {
        const uniqueJids = [
            ...new Set(jids.map((j) => this.#toBareJid(String(j ?? "").trim())).filter(Boolean)),
        ];
        for (const jid of uniqueJids) {
            const cached = await this.#getTcToken(jid);
            if (cached?.length)
                return cached;
        }
        for (const jid of uniqueJids) {
            const fetched = await Promise.race([
                this.requestTcToken(jid),
                new Promise((r) => setTimeout(() => r(undefined), TC_TOKEN_REQUEST_TIMEOUT_MS)),
            ]);
            if (fetched?.length)
                return fetched;
        }
        return undefined;
    };
    discoverPeerDevices = async (peerLidJid) => {
        const devices = await this.#sock.getUSyncDevices([peerLidJid], true, false);
        return this.#normalizeStartCallPeerList(devices.map((d) => d.jid).filter(Boolean));
    };
    ensureSessionsForPeers = async (jids) => {
        const targets = this.#expandSignalSessionTargets(jids);
        if (targets.length)
            await this.#ensureSignalSessions(targets, true);
    };
    resolveLid = async (pnJid) => this.#sock.signalRepository.lidMapping?.getLIDForPN(pnJid);
    issueTcToken = async (jid) => {
        const userJid = this.#toBareJid(jid);
        const issuedAt = Math.floor(Date.now() / 1000);
        try {
            await this.#sock.query({
                tag: "iq",
                attrs: {
                    to: S_WHATSAPP_NET, type: "set", xmlns: "privacy",
                    id: this.#sock.generateMessageTag(),
                },
                content: [{
                        tag: "tokens", attrs: {},
                        content: [{
                                tag: "token",
                                attrs: { jid: userJid, t: String(issuedAt), type: "trusted_contact" },
                            }],
                    }],
            });
            return true;
        }
        catch {
            return false;
        }
    };
    getRemoteDeviceJid = (callId) => this.#remoteDevicePeerByCallId.get(callId);
    #doSendSignaling = async (peerJid, callId, xmlPayload) => {
        const rawPayload = Buffer.from(xmlPayload);
        let voipNode;
        try {
            voipNode = await (0, decode_js_1.decodeBinaryNode)(Buffer.concat([Buffer.from([0]), rawPayload]));
        }
        catch {
            voipNode = await (0, decode_js_1.decodeBinaryNode)(rawPayload);
        }
        const signalingTag = String(voipNode.tag);
        const effectivePeerJid = this.#resolveOutboundPeerJid(callId, peerJid);
        if (signalingTag === "offer" && !voipNode.attrs["call-creator"]) {
            const selfLid = this.#sock.authState.creds.me?.lid;
            if (selfLid)
                voipNode.attrs["call-creator"] = selfLid;
        }
        const destination = (0, generic_utils_js_1.getBinaryNodeChild)(voipNode, "destination");
        if (destination) {
            const destinations = getNodeChildren(destination);
            const destinationJids = destinations
                .map((n) => String(n.attrs.jid ?? "").trim())
                .filter(Boolean);
            const sessionTargets = this.#expandSignalSessionTargets(destinationJids);
            if (sessionTargets.length)
                await this.#ensureSignalSessions(sessionTargets, signalingTag === "offer");
            const rootEnc = (0, generic_utils_js_1.getBinaryNodeChild)(voipNode, "enc");
            const encCount = parseCountAttr(rootEnc?.attrs.count);
            let includeDeviceIdentity = false;
            for (const destNode of destinations) {
                const targetJid = String(destNode.attrs.jid ?? "").trim();
                const destEnc = (0, generic_utils_js_1.getBinaryNodeChild)(destNode, "enc");
                if (!targetJid || !destEnc || !(destEnc.content instanceof Uint8Array))
                    continue;
                try {
                    const encrypted = await this.#encryptCallKey(targetJid, destEnc.content, encCount);
                    includeDeviceIdentity = includeDeviceIdentity || encrypted.shouldIncludeDeviceIdentity;
                    setNodeChildren(destNode, [encrypted.encNode]);
                }
                catch {
                    for (const d of destinations)
                        removeNodeChildrenByTag(d, "enc");
                    break;
                }
            }
            if (includeDeviceIdentity)
                this.#appendDeviceIdentity(voipNode);
            await this.#sendCallStanza(this.#toBareJid(peerJid), voipNode, signalingTag, effectivePeerJid, peerJid);
            return;
        }
        if (signalingTag === "offer" || signalingTag === "enc_rekey") {
            const enc = (0, generic_utils_js_1.getBinaryNodeChild)(voipNode, "enc");
            if (enc && enc.content instanceof Uint8Array) {
                const targetJid = this.#toCallDeviceJid(effectivePeerJid);
                const encrypted = await this.#encryptCallKey(targetJid, enc.content, parseCountAttr(enc.attrs.count));
                replaceNodeChild(voipNode, "enc", encrypted.encNode);
                if (encrypted.shouldIncludeDeviceIdentity)
                    this.#appendDeviceIdentity(voipNode);
                await this.#sendCallStanza(targetJid, voipNode, signalingTag, effectivePeerJid, peerJid);
                return;
            }
        }
        const routeTo = signalingTag !== "offer" && signalingTag !== "enc_rekey"
            ? this.#toBareJid(effectivePeerJid)
            : this.#toCallDeviceJid(effectivePeerJid);
        await this.#sendCallStanza(routeTo, voipNode, signalingTag, effectivePeerJid, peerJid);
    };
    #sendCallStanza = async (routeTo, voipNode, signalingTag, effectivePeerJid, callbackPeerJid) => {
        const stanzaId = this.#sock.generateMessageTag();
        await this.#sock.sendNode({
            tag: "call",
            attrs: { to: routeTo, id: stanzaId },
            content: [voipNode],
        });
        void (async () => {
            try {
                const ackNode = await this.#sock.waitForMessage(stanzaId, ACK_TIMEOUT_MS);
                if (!ackNode || !this.#voip)
                    return;
                const ackPayload = Buffer.from((0, encode_js_1.encodeBinaryNode)(ackNode)).toString("base64");
                const tcToken = await this.ensureTcToken(effectivePeerJid, callbackPeerJid);
                try {
                    this.#voip.handleSignalingAck({
                        payload: ackPayload,
                        ackError: ackNode.attrs?.error ?? "0",
                        msgType: ackNode.attrs?.type ?? signalingTag,
                        peerJid: effectivePeerJid,
                        extraData: tcToken,
                    });
                }
                catch { }
            }
            catch { }
        })();
    };
    #doProcessIncomingCall = async (node, voip, activeCallId) => {
        const voipChild = (0, generic_utils_js_1.getAllBinaryNodeChildren)(node)[0];
        if (!voipChild)
            return;
        const incomingCallId = String(voipChild.attrs["call-id"] ?? voipChild.attrs.call_id ?? "");
        const normalizedIncomingId = incomingCallId.toUpperCase();
        const normalizedActiveId = String(activeCallId ?? "").toUpperCase();
        const callIdForRouting = normalizedIncomingId || normalizedActiveId;
        if (normalizedActiveId && normalizedIncomingId && normalizedIncomingId !== normalizedActiveId)
            return;
        const senderDeviceJid = String(voipChild.attrs.participant ?? "") ||
            String(node.attrs.participant ?? "") ||
            String(node.attrs.from ?? "") ||
            String(voipChild.attrs["call-creator"] ?? "");
        const callbackPeerJid = String(node.attrs.from ?? "") || senderDeviceJid;
        const platform = voipChild.attrs.platform ?? node.attrs.platform ?? "";
        const appVersion = voipChild.attrs.version ?? node.attrs.version ?? "";
        const epochId = voipChild.attrs.e ?? node.attrs.e ?? "0";
        const timestamp = voipChild.attrs.t ?? node.attrs.t ?? "0";
        const offline = !!(voipChild.attrs.offline ?? node.attrs.offline);
        let usableNode = voipChild;
        if ((0, generic_utils_js_1.getBinaryNodeChild)(voipChild, "enc")) {
            usableNode = await this.#maybeDecryptEnc(voipChild, senderDeviceJid);
        }
        const b64 = Buffer.from((0, encode_js_1.encodeBinaryNode)(usableNode)).toString("base64");
        const storedPeerJid = callIdForRouting ? this.#incomingCallPeerById.get(callIdForRouting) : undefined;
        let mappedRemoteDeviceJid = callIdForRouting ? this.#remoteDevicePeerByCallId.get(callIdForRouting) : undefined;
        if (callIdForRouting && (callbackPeerJid || senderDeviceJid)) {
            this.#remoteXmppRoutePeerByCallId.set(callIdForRouting, callbackPeerJid || senderDeviceJid);
            const hinted = this.#pickConcreteRouteHint(senderDeviceJid, callbackPeerJid);
            if (hinted && hinted !== mappedRemoteDeviceJid) {
                mappedRemoteDeviceJid = hinted;
                this.#remoteDevicePeerByCallId.set(callIdForRouting, hinted);
            }
        }
        const routedPeerJid = usableNode.tag === "offer"
            ? this.#preferDeviceRouteJid(senderDeviceJid, callbackPeerJid, storedPeerJid)
            : this.#preferOrderedRouteJid(mappedRemoteDeviceJid, storedPeerJid, senderDeviceJid, callbackPeerJid);
        if (callIdForRouting && routedPeerJid) {
            this.#incomingCallPeerById.set(callIdForRouting, routedPeerJid);
        }
        const tcToken = await this.ensureTcToken(routedPeerJid, callbackPeerJid);
        switch (usableNode.tag) {
            case "offer":
                voip.handleSignalingOffer({
                    payload: b64,
                    peerPlatform: Number(platform || 0),
                    peerAppVersion: appVersion,
                    epochId, timestamp,
                    isOffline: offline,
                    isOfferNotContact: false,
                    peerJid: routedPeerJid,
                    tcToken,
                });
                break;
            case "ack":
                voip.handleSignalingAck({
                    payload: b64,
                    ackError: usableNode.attrs.error ?? "0",
                    msgType: usableNode.attrs.type ?? "",
                    peerJid: routedPeerJid,
                    extraData: tcToken,
                });
                break;
            default:
                voip.handleSignalingMessage({
                    payload: b64,
                    peerPlatform: platform,
                    peerAppVersion: appVersion,
                    epochId, timestamp,
                    isOffline: offline,
                    peerJid: routedPeerJid,
                    tcToken,
                });
                if (callIdForRouting && (usableNode.tag === "terminate" || usableNode.tag === "reject")) {
                    this.#incomingCallPeerById.delete(callIdForRouting);
                    this.#remoteDevicePeerByCallId.delete(callIdForRouting);
                    this.#remoteObfuscatedPeerByCallId.delete(callIdForRouting);
                    this.#remoteXmppRoutePeerByCallId.delete(callIdForRouting);
                }
                break;
        }
    };
    #doProcessIncomingReceipt = async (node, voip, activeCallId) => {
        const receiptChild = (0, generic_utils_js_1.getAllBinaryNodeChildren)(node)[0];
        if (!receiptChild)
            return;
        const incomingCallId = String(receiptChild.attrs["call-id"] ?? receiptChild.attrs.call_id ?? "");
        const normalizedIncomingId = incomingCallId.toUpperCase();
        const normalizedActiveId = String(activeCallId ?? "").toUpperCase();
        const callIdForRouting = normalizedIncomingId || normalizedActiveId;
        if (normalizedActiveId && normalizedIncomingId && normalizedIncomingId !== normalizedActiveId)
            return;
        const callbackPeerJid = String(node.attrs.from ?? receiptChild.attrs["call-creator"] ?? "");
        const storedPeerJid = callIdForRouting ? this.#incomingCallPeerById.get(callIdForRouting) : undefined;
        const routedPeerJid = this.#preferOrderedRouteJid(storedPeerJid, callbackPeerJid);
        if (callIdForRouting && routedPeerJid)
            this.#incomingCallPeerById.set(callIdForRouting, routedPeerJid);
        const tcToken = await this.ensureTcToken(routedPeerJid, callbackPeerJid);
        voip.handleSignalingReceipt({
            payload: Buffer.from((0, encode_js_1.encodeBinaryNode)(node)).toString("base64"),
            peerJid: routedPeerJid,
            tcToken,
        });
    };
    #maybeDecryptEnc = async (voipNode, peerJid) => {
        const enc = (0, generic_utils_js_1.getBinaryNodeChild)(voipNode, "enc");
        if (!enc || !(enc.content instanceof Uint8Array))
            return voipNode;
        const type = enc.attrs.type;
        if (type !== "pkmsg" && type !== "msg")
            return voipNode;
        const candidates = [...new Set([
                peerJid,
                this.#toCallDeviceJid(peerJid),
            ].filter(Boolean))];
        let lastErr;
        for (const jid of candidates) {
            try {
                const decrypted = await this.#sock.signalRepository.decryptMessage({
                    jid, type, ciphertext: enc.content,
                });
                const parsed = index_js_1.proto.Message.decode((0, generics_js_1.unpadRandomMax16)(decrypted));
                const callKey = parsed.call?.callKey;
                if (!callKey || callKey.length === 0) {
                    throw new Error("decrypted signaling has no call.callKey");
                }
                enc.content = callKey;
                return voipNode;
            }
            catch (err) {
                lastErr = err;
            }
        }
        throw lastErr;
    };
    #encryptCallKey = async (targetJid, rawCallKey, count) => {
        const primaryDeviceJid = this.#toPrimaryDeviceJid(targetJid);
        const sessionTargets = primaryDeviceJid && primaryDeviceJid !== targetJid
            ? [primaryDeviceJid, targetJid]
            : [targetJid];
        await this.#ensureSignalSessions(sessionTargets, false);
        const { type, ciphertext } = await this.#sock.signalRepository.encryptMessage({
            jid: targetJid,
            data: (0, generics_js_1.encodeWAMessage)({ call: { callKey: Buffer.from(rawCallKey) } }),
        });
        return {
            encNode: {
                tag: "enc",
                attrs: { v: "2", type, count: String(count) },
                content: Buffer.from(ciphertext),
            },
            shouldIncludeDeviceIdentity: type === "pkmsg",
        };
    };
    #ensureSignalSessions = async (jids, refresh) => {
        const missing = [];
        for (const jid of [...new Set(jids.filter(Boolean))]) {
            const signalId = this.#sock.signalRepository.jidToSignalProtocolAddress(jid);
            const cachedAt = this.#ensuredSignalSessions.get(signalId);
            if (!refresh && cachedAt && Date.now() - cachedAt < SESSION_CACHE_TTL_MS)
                continue;
            if (!refresh) {
                const validation = await this.#sock.signalRepository.validateSession(jid);
                if (validation.exists) {
                    this.#ensuredSignalSessions.set(signalId, Date.now());
                    continue;
                }
            }
            missing.push(jid);
        }
        if (!missing.length)
            return;
        const sessionNode = await this.#sock.query({
            tag: "iq",
            attrs: { xmlns: "encrypt", type: "get", to: S_WHATSAPP_NET },
            content: [{
                    tag: "key", attrs: {},
                    content: missing.map((jid) => ({ tag: "user", attrs: { jid } })),
                }],
        });
        await (0, signal_js_1.parseAndInjectE2ESessions)(sessionNode, this.#sock.signalRepository);
        for (const jid of missing) {
            this.#ensuredSignalSessions.set(this.#sock.signalRepository.jidToSignalProtocolAddress(jid), Date.now());
        }
    };
    #appendDeviceIdentity = (voipNode) => {
        if ((0, generic_utils_js_1.getBinaryNodeChild)(voipNode, "device-identity"))
            return;
        const account = this.#sock.authState.creds.account;
        if (!account)
            return;
        const children = getNodeChildren(voipNode);
        children.push({
            tag: "device-identity",
            attrs: {},
            content: (0, validate_connection_js_1.encodeSignedDeviceIdentity)(account, true),
        });
        setNodeChildren(voipNode, children);
    };
    #toBareJid = (jid) => {
        const decoded = (0, jid_utils_js_1.jidDecode)(jid);
        if (!decoded?.user)
            return jid;
        const server = jid.endsWith("@lid") ? "lid" : "s.whatsapp.net";
        return (0, jid_utils_js_1.jidEncode)(decoded.user, server);
    };
    #toCallDeviceJid = (jid) => {
        const decoded = (0, jid_utils_js_1.jidDecode)(jid);
        if (!decoded?.user)
            return jid;
        const server = jid.endsWith("@lid") ? "lid" : "s.whatsapp.net";
        if (decoded.device == null)
            return (0, jid_utils_js_1.jidEncode)(decoded.user, server);
        return `${decoded.user}:${decoded.device}@${server}`;
    };
    #toPrimaryDeviceJid = (jid) => {
        const decoded = (0, jid_utils_js_1.jidDecode)(jid);
        if (!decoded?.user)
            return undefined;
        const device = decoded.device;
        if (device == null || device === 0)
            return undefined;
        const server = jid.endsWith("@lid") ? "lid" : "s.whatsapp.net";
        return (0, jid_utils_js_1.jidEncode)(decoded.user, server);
    };
    #hasConcreteDevice = (jid) => {
        const decoded = (0, jid_utils_js_1.jidDecode)(jid);
        return !!decoded?.user && decoded.device != null;
    };
    #preferDeviceRouteJid = (...candidates) => {
        for (const c of candidates) {
            const jid = String(c ?? "").trim();
            if (jid && this.#hasConcreteDevice(jid))
                return jid;
        }
        for (const c of candidates) {
            const jid = String(c ?? "").trim();
            if (jid)
                return this.#toCallDeviceJid(jid);
        }
        return "";
    };
    #preferOrderedRouteJid = (...candidates) => {
        for (const c of candidates) {
            const jid = String(c ?? "").trim();
            if (jid)
                return this.#toCallDeviceJid(jid);
        }
        return "";
    };
    #pickConcreteRouteHint = (...candidates) => {
        for (const c of candidates) {
            const jid = String(c ?? "").trim();
            if (jid && this.#hasConcreteDevice(jid))
                return jid;
        }
        return "";
    };
    #resolveOutboundPeerJid = (callId, wasmPeerJid) => {
        const peerJid = String(wasmPeerJid ?? "").trim();
        if (!peerJid || !callId)
            return peerJid;
        const normalizedCallId = String(callId).toUpperCase();
        return this.#remoteDevicePeerByCallId.get(normalizedCallId) ?? this.#remoteDevicePeerByCallId.get(callId) ?? peerJid;
    };
    #expandSignalSessionTargets = (jids) => [...new Set(jids.flatMap((jid) => {
            const primary = this.#toPrimaryDeviceJid(jid);
            return primary && primary !== jid ? [primary, jid] : [jid];
        }))];
    #normalizeStartCallPeerList = (jids) => {
        const result = new Set();
        for (const jid of jids) {
            const decoded = (0, jid_utils_js_1.jidDecode)(jid);
            if (!decoded?.user) {
                result.add(jid);
                continue;
            }
            const server = jid.endsWith("@lid") ? "lid" : "s.whatsapp.net";
            result.add((0, jid_utils_js_1.jidEncode)(decoded.user, server));
            if (decoded.device != null) {
                result.add(`${decoded.user}:${decoded.device}@${server}`);
            }
        }
        return [...result].slice(0, 5);
    };
    #rememberTcToken = (jid, token, timestamp = "") => {
        const bareJid = this.#toBareJid(jid);
        if (!token.length)
            return;
        this.#observedTcTokens.set(bareJid, { token: Buffer.from(token), timestamp });
        const waiters = this.#pendingTcTokenWaiters.get(bareJid);
        if (waiters?.length) {
            this.#pendingTcTokenWaiters.delete(bareJid);
            for (const w of waiters)
                w(Buffer.from(token));
        }
    };
    #getTcToken = async (jid) => {
        const userJid = this.#toBareJid(jid);
        const observed = this.#observedTcTokens.get(userJid)?.token;
        if (observed?.length)
            return Buffer.from(observed);
        try {
            const data = await this.#sock.authState.keys.get("tctoken", [userJid]);
            const token = data[userJid]?.token;
            if (token && token.length > 0) {
                this.#rememberTcToken(userJid, token, data[userJid]?.timestamp);
                return token;
            }
        }
        catch { }
        return undefined;
    };
}
exports.SignalingBridge = SignalingBridge;

return module.exports;
})();
for (const key of Object.keys(__kageModule106)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule106[key]});
}
