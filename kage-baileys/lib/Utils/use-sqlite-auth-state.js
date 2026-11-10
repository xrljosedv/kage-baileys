"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.useSqliteAuthState = useSqliteAuthState;
const index_js_1 = require("../../WAProto/index.js");
const auth_utils_js_1 = require("./auth-utils.js");
const generics_js_1 = require("./generics.js");
async function loadBetterSqlite3() {
    try {
         
        const mod = (await Promise.resolve().then(() => __importStar(require('better-sqlite3'))));
        return mod.default ?? mod;
    }
    catch (err) {
        const helpful = new Error('`better-sqlite3` is required for `useSqliteAuthState`. Install it as a peer dependency: `npm install better-sqlite3` (or `yarn add better-sqlite3`).');
         
        helpful.cause = err;
        throw helpful;
    }
}
const CREDS_ROW_KEY = '__creds__';
const CREATE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS creds (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS signal_keys (
  type TEXT NOT NULL,
  id TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (type, id)
);
CREATE INDEX IF NOT EXISTS signal_keys_type_idx ON signal_keys(type);
`;
async function useSqliteAuthState(opts) {
    let db;
    if (opts.database) {
        db = opts.database;
    }
    else {
        const Database = await loadBetterSqlite3();
        db = new Database(opts.dbPath);
    }
     
     
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.exec(CREATE_SCHEMA_SQL);
    const stmts = {
        credsSelect: db.prepare('SELECT value FROM creds WHERE key = ?'),
        credsUpsert: db.prepare('INSERT INTO creds (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'),
        keySelect: db.prepare('SELECT value FROM signal_keys WHERE type = ? AND id = ?'),
        keyUpsert: db.prepare('INSERT INTO signal_keys (type, id, value) VALUES (?, ?, ?) ON CONFLICT(type, id) DO UPDATE SET value = excluded.value'),
        keyDelete: db.prepare('DELETE FROM signal_keys WHERE type = ? AND id = ?'),
        keyListIds: db.prepare('SELECT id FROM signal_keys WHERE type = ?'),
        keyList: db.prepare('SELECT id, value FROM signal_keys WHERE type = ?'),
        clearKeys: db.prepare('DELETE FROM signal_keys')
    };
    const loadCreds = () => {
        const row = stmts.credsSelect.get(CREDS_ROW_KEY);
        if (!row)
            return (0, auth_utils_js_1.initAuthCreds)();
        return JSON.parse(row.value, generics_js_1.BufferJSON.reviver);
    };
    const persistCreds = (creds) => {
        stmts.credsUpsert.run(CREDS_ROW_KEY, JSON.stringify(creds, generics_js_1.BufferJSON.replacer));
    };
    const creds = loadCreds();
    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    for (const id of ids) {
                        const row = stmts.keySelect.get(type, id);
                        if (row) {
                            let value = JSON.parse(row.value, generics_js_1.BufferJSON.reviver);
                            if (type === 'app-state-sync-key' && value) {
                                value = index_js_1.proto.Message.AppStateSyncKeyData.fromObject(value);
                            }
                            data[id] = value;
                        }
                    }
                    return data;
                },
                set: async (data) => {
                    const writeTx = db.transaction(() => {
                        for (const category in data) {
                            for (const id in data[category]) {
                                const value = data[category][id];
                                if (value) {
                                    const stringified = JSON.stringify(value, generics_js_1.BufferJSON.replacer);
                                    stmts.keyUpsert.run(category, id, stringified);
                                }
                                else {
                                    stmts.keyDelete.run(category, id);
                                }
                            }
                        }
                    });
                    writeTx();
                }
            }
        },
        saveCreds: async () => {
            persistCreds(creds);
        }
    };
}
