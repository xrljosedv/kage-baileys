import { Mutex } from 'async-mutex';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname } from 'path';
import { proto } from '../../WAProto/index.js';
import { initAuthCreds } from './auth-utils.js';
import { BufferJSON } from './generics.js';
import { getSqlJs, KV_SCHEMA } from './sqlite-auth-utils.js';
const keyName = (type, id) => `${type}:${id}`;
const getValue = (db, key) => {
    const stmt = db.prepare('SELECT value FROM auth WHERE key = :key');
    stmt.bind({ ':key': key });
    let value = null;
    if (stmt.step()) {
        value = stmt.getAsObject().value ?? null;
    }
    stmt.free();
    return value;
};
/**
 * stores the full authentication state (creds + all signal keys) in a single
 * WASM SQLite (sql.js) database file. Same one-file-for-everything shape as
 * useSingleFileAuthState, but backed by SQLite (one row per key) instead of a
 * single giant JSON blob — cheaper per-write since only the changed row(s) are
 * touched, no native build dependency required.
 *
 * Requires the optional `sql.js` package (`npm install sql.js`).
 * */
export const useSingleFileSQLJsAuthState = async (filePath) => {
    const SQL = await getSqlJs();
    const mutex = new Mutex();
    let buffer;
    try {
        buffer = await readFile(filePath);
    }
    catch {
        buffer = undefined;
    }
    const db = new SQL.Database(buffer);
    db.run(KV_SCHEMA);
    const persist = async () => {
        return mutex.acquire().then(async (release) => {
            try {
                await mkdir(dirname(filePath), { recursive: true });
                await writeFile(filePath, Buffer.from(db.export()));
            }
            finally {
                release();
            }
        });
    };
    const setValue = async (key, value) => {
        db.run('INSERT INTO auth (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
        await persist();
    };
    const deleteValue = async (key) => {
        db.run('DELETE FROM auth WHERE key = ?', [key]);
        await persist();
    };
    const existingCreds = getValue(db, 'creds');
    const creds = existingCreds ? JSON.parse(existingCreds, BufferJSON.reviver) : initAuthCreds();
    if (!existingCreds) {
        await setValue('creds', JSON.stringify(creds, BufferJSON.replacer));
    }
    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    for (const id of ids) {
                        const raw = getValue(db, keyName(type, id));
                        let value = raw ? JSON.parse(raw, BufferJSON.reviver) : undefined;
                        if (type === 'app-state-sync-key' && value) {
                            value = proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        data[id] = value;
                    }
                    return data;
                },
                set: async (data) => {
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const key = keyName(category, id);
                            if (value) {
                                await setValue(key, JSON.stringify(value, BufferJSON.replacer));
                            }
                            else {
                                await deleteValue(key);
                            }
                        }
                    }
                }
            }
        },
        saveCreds: async () => {
            await setValue('creds', JSON.stringify(creds, BufferJSON.replacer));
        }
    };
};
