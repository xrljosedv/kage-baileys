'use strict';
 
const { AsyncLocalStorage } = require('node:async_hooks');
const context = new AsyncLocalStorage();
class SocketScope {
  constructor() { this.current = null; this.generation = 0; this.bindings = new Map(); }
  set(socket) {
    if (!socket?.ev || typeof socket.ev.on !== 'function') throw new TypeError('SOCKET_INVALID');
    if (socket === this.current) return socket;
    this.clearBindings(); this.current = socket; this.generation++; return socket;
  }
  get() { const socket = context.getStore()?.socket || this.current; if (!socket) throw new Error('SOCKET_UNAVAILABLE'); return socket; }
  run(socket, task) { return context.run({ socket }, task); }
  bind(key, event, listener) {
    const socket = this.get(), old = this.bindings.get(key);
    if (old) old.socket.ev.off(old.event, old.listener);
    const bound = (...args) => Promise.resolve().then(() => this.run(socket, () => listener(...args))).catch(error => socket.logger?.error?.({ error: error.message, event }, 'runtime listener'));
    socket.ev.on(event, bound); this.bindings.set(key, { socket, event, listener: bound }); return bound;
  }
  clearBindings() { for (const b of this.bindings.values()) b.socket.ev.off(b.event,b.listener); this.bindings.clear(); }
  close() { this.clearBindings(); this.current = null; }
  installLegacyAccessors(target) {
    for (const name of ['conn','sock','client','socket']) {
      const descriptor = Object.getOwnPropertyDescriptor(target,name);
      if (descriptor && !descriptor.configurable) throw new Error('SOCKET_ALIAS_LOCKED: '+name);
      Object.defineProperty(target,name,{configurable:true,enumerable:false,get:()=>context.getStore()?.socket || this.current,set:()=>{throw new Error('SOCKET_READ_ONLY: use SocketScope.set()');}});
    }
  }
}
function matches(spec, command) {
  if (Array.isArray(spec)) return spec.some(s=>matches(s,command));
  if (spec instanceof RegExp) { const flags=spec.flags.replace(/[gy]/g,''); return new RegExp(spec.source,flags).test(command); }
  return typeof spec==='string' && spec.toLowerCase()===command.toLowerCase();
}
function aliasesOf(plugin) {
  const values=[];
  function collect(spec){if(Array.isArray(spec))spec.forEach(collect);else if(typeof spec==='string')values.push(spec.toLowerCase());}
  collect(plugin.command);
  for(const help of plugin.help||[]){const word=String(help).split(/[\s<\[]/)[0].toLowerCase();if(matches(plugin.command,word))values.push(word);}
  return [...new Set(values)].filter(x=>/^[\p{L}\p{N}_-]+$/u.test(x));
}
function completeness(p) { return (typeof p==='function'?Function.prototype.toString.call(p).length:0)+(p.help?.length||0)*40+(p.description?.length||0)+['before','after','all'].reduce((s,k)=>s+(typeof p[k]==='function'?100:0),0); }
class CommandRegistry {
  constructor(plugins={}, options={}) {this.options=options;this.conflicts=new Map();this.rebuild(plugins);}
  rebuild(plugins) {
    this.plugins=plugins;this.entries=Object.entries(plugins).filter(([,p])=>p&&!p.disabled&&typeof p==='function'&&p.command&&!p.customPrefix);
    this.hookDuplicates=[];this.prefixConflicts=[];const hooks=new Map(),patterns=new Map();
    for(const [file,p] of Object.entries(plugins)){ if(!p)continue;
      for(const phase of ['before','all','after'])if(typeof p[phase]==='function'){const fn=p[phase];if(!hooks.has(fn))hooks.set(fn,{file,phase});else this.hookDuplicates.push({file,phase,first:hooks.get(fn)});}
      if(p.customPrefix){const key=String(p.customPrefix);if(patterns.has(key))this.prefixConflicts.push({pattern:key,files:[patterns.get(key),file],reason:'same custom prefix; original first-handler semantics retained'});else patterns.set(key,file);}
    }
    this.conflicts.clear();this.owners=new Map();this.qualified=new Map();const refs=new Map();this.duplicatePlugins=[];
    for(const [file,p] of this.entries){if(refs.has(p))this.duplicatePlugins.push({file,first:refs.get(p)});else refs.set(p,file);
      for(const alias of aliasesOf(p)){const key=file.replace(/\.[cm]?js$/,'')+':'+alias;this.qualified.set(key,{file,command:alias});}}
    for(const [,p] of this.entries)for(const alias of aliasesOf(p))this.owner(alias);
    return this;
  }
  owner(command) {
    command=String(command).toLowerCase();if(this.owners.has(command))return this.owners.get(command);
    const candidates=this.entries.filter(([,p])=>matches(p.command,command));
    const preferred=this.options.prefer?.[command];
    candidates.sort(([a,p],[b,q])=>(a===preferred?-1:b===preferred?1:0)||completeness(q)-completeness(p)||a.localeCompare(b,'en'));
    const winner=candidates[0]?.[0];if(winner)this.owners.set(command,winner);
    if(candidates.length>1)this.conflicts.set(command,{command,winner,candidates:candidates.map(([file,p])=>({file,score:completeness(p)})),reason:preferred?'explicit preference':'implementation length + documented capabilities; review recommended',alternatives:candidates.map(([file])=>file.replace(/\.[cm]?js$/,'')+':'+command)});
    return winner;
  }
  resolve(text, options={}) {
    if(typeof text!=='string')return null;let input=text.trim();if(!input)return null;
    let prefix='';const sources=Array.isArray(options.prefix)?options.prefix:[options.prefix??/^[#!./-]/];
    for(const p of sources){if(p instanceof RegExp){const hit=new RegExp(p.source,p.flags.replace(/[gy]/g,'')).exec(input);if(hit?.index===0&&hit[0]){prefix=hit[0];break;}}else if(typeof p==='string'&&p&&input.startsWith(p)){prefix=p;break;}}
    if(prefix)input=input.slice(prefix.length).trim();else if(options.noPrefix===false)return null;
    const [token,...args]=input.split(/\s+/);const command=token.toLowerCase();
    const qualified=this.qualified.get(command);const file=qualified?.file||this.owner(command);if(!file)return null;
     
    if(!prefix&&!qualified&&!this.entries.some(([f,p])=>f===file&&aliasesOf(p).includes(command)))return null;
    return {file,command:qualified?.command||command,args,text:args.join(' '),usedPrefix:prefix,noPrefix:input,qualified:!!qualified};
  }
  report(){return {commands:this.owners.size,plugins:this.entries.length,conflicts:[...this.conflicts.values()],duplicatePlugins:this.duplicatePlugins,duplicateHooks:this.hookDuplicates,customPrefixConflicts:this.prefixConflicts};}
}
class BoundedDedup {
  constructor({max=5000,ttl=300000,clock=Date.now}={}){this.max=max;this.ttl=ttl;this.clock=clock;this.seen=new Map();}
  accept(key){if(!key)return true;const now=this.clock();for(const [k,t]of this.seen)if(now-t>this.ttl)this.seen.delete(k);if(this.seen.has(key))return false;this.seen.set(key,now);while(this.seen.size>this.max)this.seen.delete(this.seen.keys().next().value);return true;}
}
class ReconnectPlan {
  constructor({max=8,base=2000,cap=60000,random=Math.random}={}){Object.assign(this,{max,base,cap,random});this.attempts=0;}
  next(code){if([401,403,405,411,419,440,500].includes(code)||this.attempts>=this.max)return null;const delay=code===515?1000:Math.min(this.cap,this.base*2**this.attempts)+Math.floor(this.random()*1000);this.attempts++;return delay;}
  reset(){this.attempts=0;}
}
module.exports={SocketScope,CommandRegistry,BoundedDedup,ReconnectPlan,matches,aliasesOf};
