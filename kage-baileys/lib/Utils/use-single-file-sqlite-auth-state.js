import { Mutex } from 'async-mutex';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import { proto } from '../../WAProto/index.js';
import { initAuthCreds } from './auth-utils.js';
import { BufferJSON } from './generics.js';
import { getBetterSqlite3, KV_SCHEMA } from './sqlite-auth-utils.js';
const keyName = (type, id) => `${type}:${id}`;
/**
 * stores the full authentication state (creds + all signal keys) in a single
 * native SQLite (better-sqlite3) database file. Same one-file-for-everything
 * shape as useSingleFileAuthState, but backed by SQLite (one row per key,
 * synchronous transactional writes) instead of a single giant JSON blob —
 * the cheapest single-file option of the bunch, at the cost of a native
 * build dependency.
 *
 * Requires the optional `better-sqlite3` package (`npm install better-sqlite3`).
 * */
export const useSingleFileSQLiteAuthState = async (filePath) => {
    const Database = await getBetterSqlite3();
    await mkdir(dirname(filePath), { recursive: true });
    const db = new Database(filePath);
    db.exec(KV_SCHEMA);
    const mutex = new Mutex();
    const getStmt = db.prepare('SELECT value FROM auth WHERE key = ?');
    const setStmt = db.prepare('INSERT INTO auth (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    const delStmt = db.prepare('DELETE FROM auth WHERE key = ?');
    const setValue = async (key, value) => {
        return mutex.acquire().then((release) => {
            try {
                setStmt.run(key, value);
            }
            finally {
                release();
            }
        });
    };
    const deleteValue = async (key) => {
        return mutex.acquire().then((release) => {
            try {
                delStmt.run(key);
            }
            finally {
                release();
            }
        });
    };
    const existingCreds = getStmt.get('creds')?.value;
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
                        const raw = getStmt.get(keyName(type, id))?.value;
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
