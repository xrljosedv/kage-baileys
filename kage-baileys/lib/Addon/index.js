'use strict';
const { Mutex } = require('async-mutex');
const NodeCache = require('@cacheable/node-cache').default;
const PQueue = require('p-queue').default;
const {zipSync}=require('fflate');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
exports.createMutex=()=>new Mutex();
exports.createQueue=(concurrency=1)=>new PQueue({concurrency});
exports.createCache=(options={})=>{
 const cache=new NodeCache({stdTTL:options.ttl||0,useClones:false,checkperiod:0,maxKeys:options.maxSize||-1});
 cache.delete=key=>cache.del(key);cache.clear=()=>cache.flushAll();cache.close=()=>cache.flushAll();
 return cache;
};
exports.createZip=async input=>{
 const entries={};
 if(Array.isArray(input))for(const item of input){const name=item.name||item.filename||item.path;if(!name)throw new TypeError('Cada archivo ZIP necesita un nombre');entries[name]=new Uint8Array(item.data||item.buffer||item.content);}
 else for(const [name,value]of Object.entries(input))entries[name]=new Uint8Array(value);
 return Buffer.from(zipSync(entries));
};
exports.getFile=async input=>{
 const file=path.join(os.tmpdir(),'kage-'+randomUUID());
 let data=input;
 if(typeof input==='string'){if(/^https?:/.test(input)){const res=await fetch(input);if(!res.ok)throw new Error('Error HTTP '+res.status);data=Buffer.from(await res.arrayBuffer());}else data=await fs.readFile(input);}
 await fs.writeFile(file,data,{mode:0o600});return file;
};
exports.detectMediaInfo=async input=>{const mm=await import('music-metadata');return typeof input==='string'?mm.parseFile(input):mm.parseBuffer(input);};
exports.encodeQR=(input,options)=>require('qrcode').toDataURL(input,options);
exports.getAudioWaveform=async input=>{const b=await fs.readFile(input);const media=require('../Utils/messages-media.js');return {waveform:await media.getAudioWaveform(b),seconds:await media.getAudioDuration(b)};};
Object.assign(exports,require('./http-error.js'),require('./keyed-db.js'),require('./link-preview.js'));
