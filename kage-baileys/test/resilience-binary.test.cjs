'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { deflateSync } = require('node:zlib');
const { randomBytes } = require('node:crypto');
const { decodeBinaryNode, decodeDecompressedBinaryNode, decompressingIfRequired } = require('../lib/WABinary/decode');
const { encodeBinaryNode } = require('../lib/WABinary/encode');
const constants = require('../lib/WABinary/constants');
const { inspectMessage } = require('../lib/Utils/message-inspector');
const { TAGS } = constants;

test('round trip de Unicode y contenido binario sin alteración', async () => {
  const node = { tag:'message', attrs:{ id:'日本語-😺', to:'51900000001@s.whatsapp.net' }, content:[{tag:'body',attrs:{},content:Buffer.from([0,255,128,1,2])}] };
  const decoded = await decodeBinaryNode(encodeBinaryNode(node));
  assert.deepEqual(decoded,node);
});
test('paquetes vacíos, corruptos y truncados se rechazan', async () => {
  await assert.rejects(decodeBinaryNode(Buffer.alloc(0)),/BINARY_SIZE_LIMIT/);
  await assert.rejects(decodeBinaryNode(Buffer.from([2,255,0,13])));
  const buffer = encodeBinaryNode({ tag:'message',attrs:{id:'test'},content:Buffer.from('test') });
  for (let i=1;i<buffer.length;i++) await assert.rejects(decodeBinaryNode(buffer.subarray(0,i)));
});
test('inflado tiene límite contra paquetes comprimidos desproporcionados', async () => {
  const compressed = deflateSync(Buffer.alloc(33*1024*1024));
  await assert.rejects(decompressingIfRequired(Buffer.concat([Buffer.from([2]),compressed])), /larger|limit|length|buffer/i);
});
test('BINARY_32 no acepta longitudes negativas por desbordamiento de signo', () => {
  const head = [TAGS.LIST_8,2,TAGS.BINARY_8,1,120,TAGS.BINARY_32,255,255,255,255];
  assert.throws(() => decodeDecompressedBinaryNode(Buffer.from(head),constants),/end of stream/);
});
test('árbol binario profundo se detiene antes de agotar la pila', async () => {
  const parts = [Buffer.from([0])];
  for(let i=0;i<80;i++) parts.push(Buffer.from([TAGS.LIST_8,2,TAGS.BINARY_8,1,120,TAGS.LIST_8,1]));
  parts.push(Buffer.from([TAGS.LIST_8,1,TAGS.BINARY_8,1,120]));
  await assert.rejects(decodeBinaryNode(Buffer.concat(parts)),/BINARY_COMPLEXITY_LIMIT/);
});
test('pares JID recursivos se detienen antes de agotar la pila', async () => {
  const parts = [Buffer.from([0,TAGS.LIST_8,1])];
  for(let i=0;i<80;i++) parts.push(Buffer.from([TAGS.JID_PAIR]));
  parts.push(Buffer.from([TAGS.BINARY_8,1,120]));
  await assert.rejects(decodeBinaryNode(Buffer.concat(parts)),/BINARY_STRING_DEPTH_LIMIT/);
});
test('claves especiales de atributos no modifican el prototipo', async () => {
  const attrs = JSON.parse('{"__proto__":"literal","id":"test"}');
  const decoded = await decodeBinaryNode(encodeBinaryNode({ tag:'message',attrs }));
  assert.equal(Object.hasOwn(decoded.attrs,'__proto__'),true);
  assert.equal(decoded.attrs.__proto__,'literal'); assert.equal({}.polluted,undefined);
});
test('1000 entradas binarias aleatorias terminan sin bloquear', async () => {
  let rejected = 0;
  for(let i=0;i<1000;i++) {
    const raw = Buffer.concat([Buffer.from([0]),randomBytes(1+(i%256))]);
    try { await decodeBinaryNode(raw) } catch { rejected++ }
  }
  assert.ok(rejected>900);
});
test('inspector tolera null, menciones inválidas y valores numéricos corruptos', () => {
  assert.equal(inspectMessage(null).type,'unknown');
  const info = inspectMessage({ key:{remoteJid:'51900000001@s.whatsapp.net',id:'x'}, messageTimestamp:{toNumber(){throw new Error('bad')}},message:{extendedTextMessage:{text:'😺',contextInfo:{mentionedJid:33}}} });
  assert.equal(info.timestamp,0); assert.deepEqual(info.mentions,[]); assert.equal(info.type,'extendedTextMessage');
});
test('envolturas circulares o nulas no producen recursión ilimitada', () => {
  const raw = { message:{} }; raw.message.ephemeralMessage = {message:raw.message};
  assert.equal(inspectMessage(raw).type,'unknown'); assert.equal(inspectMessage({message:{imageMessage:null}}).type,'unknown');
});
test('inspector limita menciones sin exponer bytes de medios', () => {
  const info = inspectMessage({message:{imageMessage:{mediaKey:Buffer.from('private-key'),contextInfo:{mentionedJid:Array.from({length:300},(_,i)=>`${i}@lid`)}}}});
  assert.equal(info.mentions.length,100); assert.equal(JSON.stringify(info).includes('private-key'),false);
});
