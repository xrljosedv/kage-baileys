'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const { fetchLatestBaileysVersion, fetchLatestKageVersion } = require('../lib/Utils/generics');
const fallback = require('../lib/Defaults/wileys-version.json').version;
async function mocked(get, fn) {
 const old = axios.get;
 axios.get = get;
 try { await fn(); } finally { axios.get = old; }
}
test('connection version is WhatsApp WEB revision, not npm library semver', async () => {
 await mocked(async (url, options) => {
  assert.equal(url,'https://web.whatsapp.com/sw.js');
  assert.equal(options.responseType,'text');
  assert.equal(options.timeout,15000);
  return {data:'self.config={"client_revision":1043857761}'};
 }, async () => {
  assert.deepEqual(await fetchLatestBaileysVersion(),{version:[2,3000,1043857761],isLatest:true});
 });
});
test('network failure retains the included WhatsApp protocol version and original error', async () => {
 const error = new Error('offline test');
 await mocked(async () => {throw error}, async () => {
  const result = await fetchLatestBaileysVersion();
  assert.deepEqual(result.version,fallback);assert.equal(result.isLatest,false);assert.equal(result.error,error);
 });
});
test('malformed version response cannot pass an undefined or npm version to socket', async () => {
 await mocked(async () => ({data:'<html>service unavailable</html>'}), async () => {
  const result = await fetchLatestBaileysVersion();assert.deepEqual(result.version,fallback);assert.equal(result.isLatest,false);
 });
});
test('package update helper requests a real npm version document', async () => {
 await mocked(async url => {assert.equal(url,'https://registry.npmjs.org/kage-baileys/latest');return {data:{version:'2.0.1'}}},async()=>{
  const result=await fetchLatestKageVersion();assert.deepEqual(result.version,[2,0,1]);assert.equal(result.isLatest,true);
 });
});
test('package fallback is the installed library version, not a WhatsApp version', async () => {
 await mocked(async()=>{throw new Error('offline')},async()=>{
  const result=await fetchLatestKageVersion();assert.deepEqual(result.version,require('../package.json').version.split('-')[0].split('.').map(Number));assert.equal(result.isLatest,false);
 });
});
