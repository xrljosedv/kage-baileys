"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useSingleFileAuthState = void 0;
const promises_1 = require("node:fs/promises");
const index_js_1 = require("../Defaults/index.js");
const index_js_2 = require("../../WAProto/index.js");
const index_js_3 = require("../Addon/index.js");
const auth_utils_js_1 = require("./auth-utils.js");
const generics_js_1 = require("./generics.js");
 
const FLUSH_TIMEOUT_MS = 3000;
 
const useSingleFileAuthState = async (fileName) => {
    const cache = (0, index_js_3.createCache)({
        max: 20000,
        ttl: index_js_1.DEFAULT_CACHE_TTLS.SIGNAL_STORE
    });
     
    const mutex = (0, index_js_3.createMutex)();
    let fileData = {};
    let isLoaded = false;
    let flushTimeout = null;
    const loadKey = async () => {
        return await mutex.runExclusive(async () => {
            if (isLoaded)
                return;
            try {
                const data = JSON.parse(await (0, promises_1.readFile)(fileName, 'utf-8'), generics_js_1.BufferJSON.reviver);
                fileData = data || {};
                for (const [keyName, value] of Object.entries(fileData)) {
                    cache.set(keyName, value);
                }
            }
            catch {
                fileData = {};
            }
            isLoaded = true;
        });
    };
    const flushKey = () => {
        if (flushTimeout)
            return;
        flushTimeout = setTimeout(async () => {
            flushTimeout = null;
            await mutex.runExclusive(async () => {
                try {
                    const tempFile = fileName + '.temp';
                    await (0, promises_1.writeFile)(tempFile, JSON.stringify(fileData, generics_js_1.BufferJSON.replacer));
                    await (0, promises_1.rename)(tempFile, fileName);
                }
                catch { }
            });
        }, FLUSH_TIMEOUT_MS);
    };
    const writeKey = (keyName, value) => {
        cache.set(keyName, value);
        fileData[keyName] = value;
        flushKey();
    };
    const removeKey = (keyName) => {
        cache.delete(keyName);
        delete fileData[keyName];
        flushKey();
    };
    const fileInfo = await (0, promises_1.stat)(fileName).catch(() => null);
    if (!fileInfo) {
        await (0, promises_1.writeFile)(fileName, '{}');
    }
    else if (!fileInfo.isFile()) {
        throw new Error(`found something that is not a file at ${fileName}, either delete it or specify a different location`);
    }
    await loadKey();
    const creds = fileData['creds'] || (0, auth_utils_js_1.initAuthCreds)();
    return {
        state: {
            creds,
            keys: {
                get: (type, ids) => {
                    const data = {};
                    for (const id of ids) {
                        const keyName = type + id;
                        let value = cache.get(keyName);
                        if (value === undefined && fileData[keyName] !== undefined) {
                            value = fileData[keyName];
                            cache.set(keyName, value);
                        }
                        if (type === 'app-state-sync-key' && value) {
                            value = index_js_2.proto.Message.AppStateSyncKeyData.fromObject(value);
                        }
                        data[id] = value;
                    }
                    return data;
                },
                set: (data) => {
                    for (const category in data) {
                        for (const id in data[category]) {
                            const keyName = category + id;
                            const value = data[category][id];
                            value ? writeKey(keyName, value) : removeKey(keyName);
                        }
                    }
                }
            }
        },
        saveCreds: () => writeKey('creds', creds)
    };
};
exports.useSingleFileAuthState = useSingleFileAuthState;
