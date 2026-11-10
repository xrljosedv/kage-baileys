import { Mutex } from 'async-mutex';
import { mkdir, readFile, stat, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { proto } from '../../WAProto/index.js';
import { initAuthCreds } from './auth-utils.js';
import { BufferJSON } from './generics.js';
import { getSqlJs, SINGLE_ROW_SCHEMA } from './sqlite-auth-utils.js';
const fileLocks = new Map();
const getFileLock = (path) => {
    let mutex = fileLocks.get(path);
    if (!mutex) {
        mutex = new Mutex();
        fileLocks.set(path, mutex);
    }
    return mutex;
};
const openDb = async (filePath, SQL) => {
    let buffer;
    try {
        buffer = await readFile(filePath);
    }
    catch {
        buffer = undefined;
    }
    const db = new SQL.Database(buffer);
    db.run(SINGLE_ROW_SCHEMA);
    return db;
};
const persistDb = async (filePath, db) => {
    await mkdir(join(filePath, '..'), { recursive: true });
    await writeFile(filePath, Buffer.from(db.export()));
};
const readRow = (db) => {
    const stmt = db.prepare('SELECT value FROM auth WHERE id = 1');
    let value = null;
    if (stmt.step()) {
        value = stmt.getAsObject().value ?? null;
    }
    stmt.free();
    return value;
};
/**
 * stores the full authentication state in a folder, like useMultiFileAuthState,
 * but each key is its own WASM SQLite (sql.js) database file instead of a plain
 * JSON file. Useful when you want the on-disk format to be SQLite (e.g. easier
 * to inspect/back up with SQLite tooling) without a native build dependency —
 * sql.js is pure WASM, so it works anywhere Node runs, no native compilation.
 *
 * Requires the optional `sql.js` package (`npm install sql.js`).
 * */
export const useMultiFileSQLJsAuthState = async (folder) => {
    const SQL = await getSqlJs();
    const fixFileName = (file) => file?.replace(/\//g, '__')?.replace(/:/g, '-');
    const dbPath = (file) => join(folder, `${fixFileName(file)}.db`);
    const writeData = async (data, file) => {
        const filePath = dbPath(file);
        const mutex = getFileLock(filePath);
        return mutex.acquire().then(async (release) => {
            try {
                const db = await openDb(filePath, SQL);
                try {
                    db.run('INSERT INTO auth (id, value) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET value = excluded.value', [JSON.stringify(data, BufferJSON.replacer)]);
                    await persistDb(filePath, db);
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
        return mutex.acquire().then(async (release) => {
            try {
                const exists = await stat(filePath).catch(() => null);
                if (!exists) {
                    return null;
                }
                const db = await openDb(filePath, SQL);
                try {
                    const raw = readRow(db);
                    return raw ? JSON.parse(raw, BufferJSON.reviver) : null;
                }
                finally {
                    db.close();
                }
            }
            finally {
                release();
            }
        }).catch(() => null);
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
