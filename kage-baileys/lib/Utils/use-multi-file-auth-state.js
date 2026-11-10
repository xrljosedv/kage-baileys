'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { proto } = require('../../WAProto');
const { initAuthCreds } = require('./auth-utils');
const { BufferJSON } = require('./generics');
const queues = new Map();
function serialized(filename, job) {
 const previous = queues.get(filename) || Promise.resolve();
 const run = previous.catch(() => {}).then(job);
 const tail = run.then(() => {}, () => {});
 queues.set(filename, tail);
 tail.then(() => { if (queues.get(filename) === tail) queues.delete(filename); });
 return run;
}
async function atomicWrite(filename, text) {
 const temporary = `${filename}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`;
 let handle;
 try {
  handle = await fs.open(temporary, 'wx', 0o600);
  await handle.writeFile(text, 'utf8');
  await handle.sync();
  await handle.close();
  handle = null;
  await fs.rename(temporary, filename);
 } finally {
  await handle?.close().catch(() => {});
  await fs.unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; });
 }
}
async function useMultiFileAuthState(folder) {
 folder = path.resolve(folder);
 await fs.mkdir(folder, { recursive: true, mode: 0o700 });
 if (!(await fs.stat(folder)).isDirectory()) throw new Error('Authentication path is not a directory');
 const pending = new Set();
 const track = promise => {
  pending.add(promise);
  promise.then(() => pending.delete(promise), () => pending.delete(promise));
  return promise;
 };
 const filenameFor = file => {
  if (typeof file !== 'string' || !file || file.includes('..') || file.includes('\\') || file.includes('\0')) throw new Error('Invalid authentication filename');
  return path.join(folder, file.replace(/\//g, '__').replace(/:/g, '-'));
 };
 const readData = file => track(serialized(filenameFor(file), async () => {
  const filename = filenameFor(file);
  try {
   return JSON.parse(await fs.readFile(filename, 'utf8'), BufferJSON.reviver);
  } catch (error) {
   if (error.code === 'ENOENT') return null;
   if (error instanceof SyntaxError) { error.code = 'AUTH_STATE_CORRUPT'; error.message = `Authentication JSON is corrupt: ${path.basename(filename)}. Restore a consistent session backup or relink the account.`; throw error; }
   throw error;
  }
 }));
 const writeData = (data, file) => {
  const filename = filenameFor(file);
  const text = JSON.stringify(data, BufferJSON.replacer);
  return track(serialized(filename, () => atomicWrite(filename, text)));
 };
 const removeData = file => {
  const filename = filenameFor(file);
  return track(serialized(filename, () => fs.unlink(filename).catch(error => { if (error.code !== 'ENOENT') throw error; })));
 };
 const stored = await readData('creds.json');
 const creds = stored || initAuthCreds();
 if (stored && (!stored.signedIdentityKey?.private || !stored.signedIdentityKey?.public || !stored.signedPreKey?.keyPair)) throw Object.assign(new Error('Authentication credentials are incomplete. Restore a consistent backup or relink the account.'), { code: 'AUTH_STATE_CORRUPT' });
 return {
  state: {
   creds,
   keys: {
    get: async (type, ids) => {
     const data = {};
     await Promise.all(ids.map(async id => {
      let value = await readData(`${type}-${id}.json`);
      if (type === 'app-state-sync-key' && value) value = proto.Message.AppStateSyncKeyData.fromObject(value);
      data[id] = value;
     }));
     return data;
    },
    set: async data => {
     const tasks = [];
     for (const [type, entries] of Object.entries(data)) {
      for (const [id, value] of Object.entries(entries)) tasks.push(value == null ? removeData(`${type}-${id}.json`) : writeData(value, `${type}-${id}.json`));
     }
     await Promise.all(tasks);
    }
   }
  },
  saveCreds: () => writeData(creds, 'creds.json'),
  flush: async () => { while (pending.size) await Promise.all([...pending]); }
 };
}
exports.useMultiFileAuthState = useMultiFileAuthState;
Object.defineProperty(exports, Symbol.for('kage.advanced'), { value: { useMultiFileAuthState }, configurable: true });
