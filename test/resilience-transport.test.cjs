'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
function noise() {
  const sandbox = { exports:{}, Buffer, Uint8Array, ArrayBuffer, DataView, require(name) {
    if(name==='@hapi/boom') return { Boom:Error };
    if(name==='../../WAProto') return { proto:{} };
    if(name==='../Defaults') return { NOISE_MODE:'test',WA_CERT_DETAILS:{SERIAL:0} };
    if(name==='../WABinary') return {};
    if(name==='./crypto') return { sha256:data=>crypto.createHash('sha256').update(data).digest() };
    return require(require('node:path').resolve(__dirname,'../lib/Utils',name));
  } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../lib/Utils/noise-handler'),'utf8'),sandbox);
  const logger = { child(){return this},trace(){} };
  return sandbox.exports.makeNoiseHandler({ keyPair:{ private:Buffer.alloc(32),public:Buffer.alloc(32) },NOISE_HEADER:Buffer.alloc(0),logger });
}
test('framing acepta fragmentación normal y múltiples frames', async()=>{
  const handler = noise(), received=[];
  await handler.decodeFrame(Buffer.from([0,0]),frame=>received.push(frame));
  await handler.decodeFrame(Buffer.from([3,97,98,99,0,0,1,100]),frame=>received.push(frame));
  assert.deepEqual(received.map(x=>x.toString()),['abc','d']);
});
test('framing rechaza tamaño cero y no deja bytes acumulándose', async()=>{
  const handler = noise(), received=[];
  await assert.rejects(handler.decodeFrame(Buffer.from([0,0,0]),()=>{}),/NOISE_EMPTY_FRAME/);
  await handler.decodeFrame(Buffer.from([0,0,1,97]),frame=>received.push(frame));
  assert.equal(received[0].toString(),'a');
});
test('framing rechaza acumulación superior al límite', async()=>{
  await assert.rejects(noise().decodeFrame(Buffer.alloc(33*1024*1024),()=>{}),/NOISE_BUFFER_LIMIT/);
});
