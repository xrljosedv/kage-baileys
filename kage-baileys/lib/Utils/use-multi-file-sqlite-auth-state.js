import { Mutex } from 'async-mutex';
import { mkdir, stat, unlink } from 'fs/promises';
import { join } from 'path';
import { proto } from '../../WAProto/index.js';
import { initAuthCreds } from './auth-utils.js';
import { BufferJSON } from './generics.js';
import { getBetterSqlite3, SINGLE_ROW_SCHEMA } from './sqlite-auth-utils.js';
const fileLocks = new Map();
const getFileLock = (path) => {
    let mutex = fileLocks.get(path);
    if (!mutex) {
        mutex = new Mutex();
        fileLocks.set(path, mutex);
    }
    return mutex;
};
/**
 * stores the full authentication state in a folder, like useMultiFileAuthState,
 * but each key is its own native SQLite (better-sqlite3) database file instead
 * of a plain JSON file. Writes are synchronous SQLite transactions, which avoids
 * the "JSON.stringify + full file rewrite" cost per key on frequent updates —
 * at the cost of a native build dependency (needs a working native toolchain
 * on install, unlike the WASM-based sql.js variant).
 *
 * Requires the optional `better-sqlite3` package (`npm install better-sqlite3`).
 * */
export const useMultiFileSQLiteAuthState = async (folder) => {
    const Database = await getBetterSqlite3();
    const fixFileName = (file) => file?.replace(/\//g, '__')?.replace(/:/g, '-');
    const dbPath = (file) => join(folder, `${fixFileName(file)}.db`);
    const writeData = async (data, file) => {
        const filePath = dbPath(file);
        const mutex = getFileLock(filePath);
        return mutex.acquire().then((release) => {
            try {
                const db = new Database(filePath);
                try {
                    db.exec(SINGLE_ROW_SCHEMA);
                    db.prepare('INSERT INTO auth (id, value) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET value = excluded.value').run(JSON.stringify(data, BufferJSON.replacer));
                }
                finally {
                    db.close();
                }
            }
            finally {
                release();
            }
        });
    };
    const readData = async (file) => {
        const filePath = dbPath(file);
        const mutex = getFileLock(filePath);
        return mutex.acquire().then((release) => {
            try {
                const db = new Database(filePath, { fileMustExist: true });
                try {
                    db.exec(SINGLE_ROW_SCHEMA);
                    const row = db.prepare('SELECT value FROM auth WHERE id = 1').get();
                    return row?.value ? JSON.parse(row.value, BufferJSON.reviver) : null;
                }
                finally {
                    db.close();
                }
            }
            catch {
                return null;
            }
            finally {
                release();
            }
        });
    };
    const removeData = async (file) => {
        const filePath = dbPath(file);
        const mutex = getFileLock(filePath);
        return mutex.acquire().then(async (release) => {
            try {
                await unlink(filePath);
            }
            catch { }
            finally {
                release();
            }
        }).catch(() => { });
    };
    const folderInfo = await stat(folder).catch(() => { });
    if (folderInfo) {
        if (!folderInfo.isDirectory()) {
            throw new Error(`found something that is not a directory at ${folder}, either delete it or specify a different location`);
        }
    }
    else {
        await mkdir(folder, { recursive: true });
    }
    const creds = (await readData('creds')) || initAuthCreds();
    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async (id) => {
                        let value = await readData(`${type}-${id}`);
                        if (type === 'app-state-sync-key' && value) {
                            value = proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        data[id] = value;
                    }));
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const file = `${category}-${id}`;
                            tasks.push(value ? writeData(value, file) : removeData(file));
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: async () => {
            return writeData(creds, 'creds');
        }
    };
};
