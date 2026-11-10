'use strict';
const states = new WeakMap();
const wrappers = ['deviceSentMessage', 'ephemeralMessage', 'viewOnceMessage', 'viewOnceMessageV2', 'viewOnceMessageV2Extension', 'documentWithCaptionMessage', 'editedMessage', 'statusMentionMessage', 'groupStatusMentionMessage', 'groupStatusMessage', 'groupStatusMessageV2'];
const labels = { conversation:'Texto', extendedTextMessage:'Texto', imageMessage:'Imagen', videoMessage:'Video', audioMessage:'Audio', documentMessage:'Documento', stickerMessage:'Sticker', reactionMessage:'Reacción', encReactionMessage:'Reacción cifrada', contactMessage:'Contacto', contactsArrayMessage:'Contactos', locationMessage:'Ubicación', liveLocationMessage:'Ubicación en vivo', pollCreationMessage:'Encuesta', pollCreationMessageV2:'Encuesta', pollCreationMessageV3:'Encuesta', pollUpdateMessage:'Voto de encuesta', protocolMessage:'Protocolo', interactiveMessage:'Interactivo', interactiveResponseMessage:'Respuesta interactiva', buttonsResponseMessage:'Respuesta de botón', listResponseMessage:'Respuesta de lista', eventMessage:'Evento programado', call:'Llamada', scheduledCallCreationMessage:'Llamada programada' };
const clean = jid => (typeof jid === 'string' ? jid.slice(0,256) : '').replace(/:\d+@/, '@');
const numeric = n => { try { const value = Number(n?.toNumber?.() ?? n ?? 0); return Number.isFinite(value) ? value : 0; } catch { return 0; } };
function inspectMessage(raw = {}) {
  raw = raw && typeof raw === 'object' ? raw : {};
  let message = raw.message || raw.fakeObj?.message || {};
  if (!message || typeof message !== 'object' || ArrayBuffer.isView(message)) message = {};
  const visited = new WeakSet();
  const layers = [];
  for (let i=0; i<16; i++) {
    if (!message || typeof message !== 'object' || visited.has(message)) { message = {}; break; }
    visited.add(message);
    const wrapper = wrappers.find(k => message[k]?.message);
    if (!wrapper) break;
    layers.push(wrapper); message = message[wrapper].message;
  }
  const keys = Object.keys(message).filter(k => message[k] != null && !['messageContextInfo','senderKeyDistributionMessage','fastRatchetKeySenderKeyDistributionMessage'].includes(k));
  const type = keys.find(k => labels[k]) || keys[0] || '';
  const value = typeof message[type] === 'object' ? message[type] : {};
  const context = value?.contextInfo || {};
  const key = raw.key || raw.fakeObj?.key || {};
  const chat = clean(key.remoteJid || raw.chat);
  const group = chat.endsWith('@g.us');
  const stubType = numeric(raw.messageStubType);
  const encrypted = stubType === 2 && !type;
  const viewOnce = layers.some(k=>k.startsWith('viewOnce')) || value?.viewOnce === true;
  const text = typeof message[type] === 'string' ? message[type] : value?.text || value?.caption || '';
  return {
    id: typeof (key.id || raw.id) === 'string' ? (key.id || raw.id).slice(0,256) : null, chat, chatAlt: clean(key.remoteJidAlt) || null,
    sender: clean(key.participant || raw.participant || raw.sender || (!key.fromMe && !group && chat !== 'status@broadcast' ? chat : '')) || null,
    senderAlt: clean(key.participantAlt) || null, fromMe: !!key.fromMe,
    route: chat === 'status@broadcast' ? 'estado' : group ? 'grupo' : chat.endsWith('@newsletter') ? 'canal' : /@(s\.whatsapp\.net|lid)$/.test(chat) ? 'privado' : 'sistema',
    type: type || (encrypted ? 'ciphertext' : stubType ? 'stub' : 'unknown'),
    label: encrypted ? 'Mensaje cifrado pendiente de descifrar' : labels[type] || (stubType ? 'Aviso del sistema' : type || 'Sin contenido'),
    wrappers: layers, viewOnce, ephemeral: layers.includes('ephemeralMessage') || numeric(context.expiration)>0,
    ptt: !!value?.ptt, gif: !!value?.gifPlayback, mime: typeof value?.mimetype === 'string' ? value.mimetype.slice(0,256) : null,
    bytes: numeric(value?.fileLength) || (typeof text === 'string' ? Buffer.byteLength(text) : 0),
    width: numeric(value?.width), height: numeric(value?.height), seconds: numeric(value?.seconds),
    timestamp: numeric(raw.messageTimestamp), stubType: stubType || null,
    quotedId: typeof context.stanzaId === 'string' ? context.stanzaId.slice(0,256) : null, mentions: (Array.isArray(context.mentionedJid) ? context.mentionedJid : []).slice(0,100).filter(j => typeof j === 'string'),
    forwarded: !!context.isForwarded, forwardingScore: numeric(context.forwardingScore),
    downloadable: !viewOnce && !!(value?.mediaKey && (value?.directPath || value?.url)), encrypted,
    receivedAt: Date.now()
  };
}
function stateFor(conn) {
  let state=states.get(conn);
  if(!state){state={events:[],messages:new Map(),counts:{},listeners:[],stopped:false};states.set(conn,state);}
  return state;
}
function rememberMessage(conn, raw) {
  const info=inspectMessage(raw); const state=stateFor(conn);
  if(info.id){
    const key=JSON.stringify([info.chat,info.sender,info.id,info.fromMe]);
    const previous=state.messages.get(key) || [...state.messages.values()].find(item=>item.chat===info.chat&&item.id===info.id&&item.fromMe===info.fromMe);
    if (!info.timestamp && previous) info.timestamp=previous.timestamp;
    if (!info.sender && previous) info.sender=previous.sender;
    state.messages.set(key,info);
  }
  for(const [key,info] of state.messages) if(Date.now()-info.receivedAt>86400000) state.messages.delete(key);
  while(state.messages.size>1000) state.messages.delete(state.messages.keys().next().value);
  return info;
}
function installMessageInspector(conn, options={}) {
  const state=stateFor(conn);
  if(state.stop && !state.stopped) return state.stop;
  state.stopped=false;
  const record=(kind,detail)=>{
    const event={kind,time:Date.now(),...detail};
    state.events.push(event); while(state.events.length>100) state.events.shift();
    state.counts[kind]=(state.counts[kind]||0)+1;
    conn.ev.emit('kage.event',event);
    if(typeof options.onEvent==='function') { try{options.onEvent(event);}catch(error){conn.logger?.warn?.({error:error.message},'event monitor callback');} }
  };
  const bind=(name,callback)=>{conn.ev.on(name,callback);state.listeners.push([name,callback]);};
  bind('messages.upsert',data=>{for(const raw of data?.messages||[]) record('message',rememberMessage(conn,raw));});
  bind('messaging-history.set',data=>{for(const raw of data?.messages||[]) rememberMessage(conn,raw);record('history',{count:data?.messages?.length||0});});
  bind('messages.update',items=>{for(const item of items||[]) {
    if(item.update?.message) record('message.updated',rememberMessage(conn,{...item.update,key:item.key}));
    else record('message.receipt',{id:item.key?.id,chat:clean(item.key?.remoteJid),status:item.update?.status ?? null,deleted:item.update?.message===null});
  }});
  bind('messages.delete',data=>record('message.deleted',{keys:(data?.keys||[]).slice(0,100).map(k=>({id:k.id,chat:clean(k.remoteJid)})),all:!!data?.all}));
  bind('messages.reaction',items=>{for(const item of items||[]) record('reaction',{id:item.key?.id,chat:clean(item.key?.remoteJid),emoji:item.reaction?.text||''});});
  bind('message-receipt.update',items=>{for(const item of items||[]) record('receipt',{id:item.key?.id,chat:clean(item.key?.remoteJid),user:clean(item.receipt?.userJid)});});
  bind('call',calls=>{for(const call of calls||[]) record('call',{id:call.id,chat:clean(call.chatId||call.from),from:clean(call.from),status:call.status,isVideo:!!call.isVideo,isGroup:!!call.isGroup});});
  bind('presence.update',data=>record('presence',{chat:clean(data?.id),users:Object.entries(data?.presences||{}).slice(0,30).map(([jid,p])=>({jid:clean(jid),state:p?.lastKnownPresence}))}));
  bind('group-participants.update',data=>record('group.participants',{chat:clean(data?.id),action:data?.action,participants:(data?.participants||[]).slice(0,100).map(p=>typeof p==='string'?p:p.id)}));
  bind('groups.update',items=>{for(const item of items||[])record('group.updated',{chat:clean(item.id),fields:Object.keys(item).filter(k=>k!=='id')});});
  bind('chats.upsert',items=>record('chats.upsert',{chats:(items||[]).map(item=>clean(item.id)).slice(0,100)}));
  bind('chats.update',items=>record('chats.update',{chats:(items||[]).map(item=>clean(item.id)).slice(0,100)}));
  bind('contacts.upsert',items=>record('contacts.upsert',{count:items?.length||0}));
  bind('contacts.update',items=>record('contacts.update',{count:items?.length||0}));
  bind('kage.automation',data=>record('automation.'+String(data.kind||'media'),{id:data.id,chat:clean(data.chat),outcome:data.outcome,error:data.error||null}));
  bind('kage.unsupported-message',data=>record('unsupported',{id:data?.id,chat:clean(data?.chat),encryption:data?.encryption,reason:data?.reason}));
  bind('connection.update',data=>{record('connection',{connection:data.connection||null,receivedPendingNotifications:data.receivedPendingNotifications??null});if(data.connection==='close')state.stop();});
  state.stop=()=>{if(state.stopped)return;state.stopped=true;for(const [name,fn]of state.listeners)conn.ev.off(name,fn);state.listeners=[];};
  return state.stop;
}
function getMessageDiagnostics(conn) {
  const state=stateFor(conn);
   
  return JSON.parse(JSON.stringify({active:!!state.stop&&!state.stopped,counts:state.counts,recent:state.events, messages:[...state.messages.values()]}));
}
exports.inspectMessage=inspectMessage;
exports.rememberMessage=rememberMessage;
exports.installMessageInspector=installMessageInspector;
exports.getMessageDiagnostics=getMessageDiagnostics;
