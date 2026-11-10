'use strict';
const cooldowns=new WeakMap();
async function refreshReceivedStatuses(conn, options={}) {
  const status=require('./status-tools');
  const capture=options.capture || (raw=>status.captureStatus(raw,conn));
  const list=options.list || (()=>status.listStatuses(conn));
  let state=cooldowns.get(conn);if(!state){state={last:0,keys:new Map(),job:null};cooldowns.set(conn,state);}
  if(state.job)return state.job;
  if(Date.now()-state.last<10000)return {received:list().length,imported:0,requested:0,errors:[],throttled:true};
  state.last=Date.now();
  state.job=(async()=>{
    let imported=0,requested=0;const errors=[];
    const sources=[options.messages,conn.chats?.['status@broadcast']?.messages,options.store?.messages?.['status@broadcast']];
    if(options.capture) sources.push(status.listStatuses(conn).map(entry=>entry.raw).filter(Boolean));
    for(const source of sources){
      const items=Array.isArray(source)?source:source instanceof Map?[...source.values()]:source?.array||[];
      for(const raw of items.slice(-500))if(raw?.key?.remoteJid==='status@broadcast'&&capture(raw))imported++;
    }
    const entries=list();
    // There is no arbitrary status-list query here. Request only known message keys delivered to us.
    const missing=entries.filter(entry=>!entry.type&&entry.sourceKey?.id&&!['expired','deleted'].includes(entry.availability)&&entry.expiresAt>Date.now());
    for(const entry of missing.slice(0,5)){
      const key=JSON.stringify([entry.author,entry.sourceKey.id]);
      if(Date.now()-(state.keys.get(key)||0)<60000)continue;
      if(typeof conn.requestPlaceholderResend!=='function')break;
      state.keys.set(key,Date.now()); requested++;
      let timer;
      try { await Promise.race([conn.requestPlaceholderResend(entry.sourceKey),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('STATUS_REFRESH_PENDING')),4000);})]); }
      catch(error){errors.push({id:entry.id,error:String(error.message||error).slice(0,200)});}
      finally{clearTimeout(timer);}
    }
    for(const [key,time]of state.keys)if(Date.now()-time>86400000)state.keys.delete(key);
    return {received:list().length,imported,requested,errors,throttled:false};
  })();
  try{return await state.job;}finally{state.job=null;}
}
exports.refreshReceivedStatuses=refreshReceivedStatuses;
