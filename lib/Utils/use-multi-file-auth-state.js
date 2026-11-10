"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useMultiFileAuthState = void 0;
const async_mutex_1 = require("async-mutex");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const WAProto_1 = require("../../WAProto");
const auth_utils_1 = require("./auth-utils");
const generics_1 = require("./generics");
// We need to lock files due to the fact that we are using async functions to read and write files
// https://github.com/WhiskeySockets/Kage/issues/794
// https://github.com/nodejs/node/issues/26338
// Use a Map to store mutexes for each file path
const fileLocks = new Map();
// Get or create a mutex for a specific file path
const getFileLock = (path) => {
    let mutex = fileLocks.get(path);
    if (!mutex) {
        mutex = new async_mutex_1.Mutex();
        fileLocks.set(path, mutex);
    }
    return mutex;
};
/**
 * stores the full authentication state in a single folder.
 * Far more efficient than singlefileauthstate
 *
 * Again, I wouldn't endorse this for any production level use other than perhaps a bot.
 * Would recommend writing an auth state for use with a proper SQL or No-SQL DB
 * */
const useMultiFileAuthState = async (folder) => {
    const writeData = async (data, file) => {
        const filePath = (0, path_1.join)(folder, fixFileName(file));
        const mutex = getFileLock(filePath);
        return mutex.acquire().then(async (release) => {
            try {
                const temporary = `${filePath}.${process.pid}.${require('crypto').randomBytes(6).toString('hex')}.tmp`;
                try {
                    await (0, promises_1.writeFile)(temporary, JSON.stringify(data, generics_1.BufferJSON.replacer), { mode: 0o600 });
                    await (0, promises_1.rename)(temporary, filePath);
                } finally {
                    await (0, promises_1.unlink)(temporary).catch(() => {});
                }
            }
            finally {
                release();
            }
        });
    };
    const readData = async (file) => {
        try {
            const filePath = (0, path_1.join)(folder, fixFileName(file));
            const mutex = getFileLock(filePath);
            return await mutex.acquire().then(async (release) => {
                try {
                    const data = await (0, promises_1.readFile)(filePath, { encoding: 'utf-8' });
                    return JSON.parse(data, generics_1.BufferJSON.reviver);
                }
                finally {
                    release();
                }
            });
        }
        catch (error) {
            if (error.code === 'ENOENT') return null;
            throw error;
        }
    };
    const removeData = async (file) => {
        try {
            const filePath = (0, path_1.join)(folder, fixFileName(file));
            const mutex = getFileLock(filePath);
            return mutex.acquire().then(async (release) => {
                try {
                    await (0, promises_1.unlink)(filePath);
                }
                catch (_a) {
                    if (_a.code !== 'ENOENT') throw _a;
                }
                finally {
                    release();
                }
            });
        }
        catch (_a) {
            throw _a;
        }
    };
    folder = (0, path_1.resolve)(folder);
    const folderInfo = await (0, promises_1.stat)(folder).catch(error => { if (error.code !== 'ENOENT') throw error; });
    if (folderInfo) {
        if (!folderInfo.isDirectory()) {
            throw new Error(`found something that is not a directory at ${folder}, either delete it or specify a different location`);
        }
    }
    else {
        await (0, promises_1.mkdir)(folder, { recursive: true, mode: 0o700 });
    }
    const fixFileName = (file) => { var _a; return (_a = file === null || file === void 0 ? void 0 : file.replace(/\//g, '__')) === null || _a === void 0 ? void 0 : _a.replace(/:/g, '-'); };
    const creds = await readData('creds.json') || (0, auth_utils_1.initAuthCreds)();
    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async (id) => {
                        let value = await readData(`${type}-${id}.json`);
                        if (type === 'app-state-sync-key' && value) {
                            value = WAProto_1.proto.Message.AppStateSyncKeyData.fromObject(value);
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
                            const file = `${category}-${id}.json`;
                            tasks.push(value ? writeData(value, file) : removeData(file));
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: async () => {
            return writeData(creds, 'creds.json');
        }
    };
};
exports.useMultiFileAuthState = useMultiFileAuthState;

// Kage: compatibilidad de API.
const __kageModule79 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { Mutex } = require("async-mutex")
const { promises } = require("fs")
const { join } = require("path")
const { proto } = require("../../WAProto")
const { initAuthCreds } = require("./auth-utils")
const { BufferJSON } = require("./generics")
// We need to lock files due to the fact that we are using async functions to read and write files
// https://github.com/WhiskeySockets/Baileys/issues/794
// https://github.com/nodejs/node/issues/26338
// Use a Map to store mutexes for each file path
const fileLocks = new Map()

// Get or create a mutex for a specific file path
const getFileLock = (path) => {
	let mutex = fileLocks.get(path)
	if (!mutex) {
		mutex = new Mutex() 
		fileLocks.set(path, mutex)
	}

	return mutex
}

/**
 * stores the full authentication state in a single folder.
 * Far more efficient than singlefileauthstate
 *
 * Again, I wouldn't endorse this for any production level use other than perhaps a bot.
 * Would recommend writing an auth state for use with a proper SQL or No-SQL DB
 * */
const useMultiFileAuthState = async (folder) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const writeData = async (data, file) => {
        const filePath = join(folder, fixFileName(file))
        const mutex = getFileLock(filePath)
        return mutex.acquire().then(async (release) => {
            try {
               await promises.writeFile(filePath, JSON.stringify(data, BufferJSON.replacer))
            } finally {
                release()
            }
        })
    }
    const readData = async (file) => {
        try {
            const filePath = join(folder, fixFileName(file))
            const mutex = getFileLock(filePath)
            const data = await mutex.acquire().then(async (release) => {
                try {
                    return await promises.readFile(filePath, { encoding: 'utf-8' })
                } finally {
                    release()
                }
            })

            return JSON.parse(data, BufferJSON.reviver)
        } catch (error) {
            return null
        }
    }
    const removeData = async (file) => {
        try {
            const filePath = join(folder, fixFileName(file))
            const mutex = getFileLock(filePath)
            await mutex.acquire().then(async (release) => {
               try {
                    await promises.unlink(filePath)
                } finally {
                    release()
                }
            })
        } catch {}
    }
    const folderInfo = await promises.stat(folder).catch(() => { })
    if (folderInfo) {
        if (!folderInfo.isDirectory()) {
            throw new Error(`found something that is not a directory at ${folder}, either delete it or specify a different location`)
        }
    }
    else {
        await promises.mkdir(folder, { recursive: true })
    }
    const fixFileName = (file) => { 
        return file?.replace(/\//g, '__')?.replace(/:/g, '-') 
    }
    const creds = await readData('creds.json') || initAuthCreds()
    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {}
                    await Promise.all(ids.map(async (id) => {
                        let value = await readData(`${type}-${id}.json`)
                        if (type === 'app-state-sync-key' && value) {
                            value = proto.Message.AppStateSyncKeyData.fromObject(value)
                        }
                        data[id] = value
                    }))
                    return data
                },
                set: async (data) => {
                    const tasks = []
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id]
                            const file = `${category}-${id}.json`
                            tasks.push(value ? writeData(value, file) : removeData(file))
                        }
                    }
                    await Promise.all(tasks)
                }
            }
        },
        saveCreds: async () => {
            return writeData(creds, 'creds.json')
        }
    }
}

module.exports = {
  useMultiFileAuthState
}
return module.exports;
})();
for (const key of Object.keys(__kageModule79)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule79[key]});
}

// Kage: funciones avanzadas.
const __kageModule188 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useMultiFileAuthState = void 0;
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const index_js_1 = require("../../WAProto/index.js");
const index_js_2 = require("../Addon/index.js");
const auth_utils_js_1 = require("./auth-utils.js");
const generics_js_1 = require("./generics.js");
// We need to lock files due to the fact that we are using async functions to read and write files
// https://github.com/WhiskeySockets/Baileys/issues/794
// https://github.com/nodejs/node/issues/26338
// Use a Map to store mutexes for each file path
const fileLocks = new Map();
// Get or create a mutex for a specific file path
const getFileLock = (path) => {
    let mutex = fileLocks.get(path);
    if (!mutex) {
        mutex = (0, index_js_2.createMutex)();
        fileLocks.set(path, mutex);
    }
    return mutex;
};
/**
 * stores the full authentication state in a single folder.
 * Far more efficient than singlefileauthstate
 *
 * Again, I wouldn't endorse this for any production level use other than perhaps a bot.
 * Would recommend writing an auth state for use with a proper SQL or No-SQL DB
 * */
const useMultiFileAuthState = async (folder) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const writeData = async (data, file) => {
        const filePath = (0, node_path_1.join)(folder, fixFileName(file));
        const mutex = getFileLock(filePath);
        return mutex.acquire().then(async (release) => {
            try {
                await (0, promises_1.writeFile)(filePath, JSON.stringify(data, generics_js_1.BufferJSON.replacer));
            }
            finally {
                release();
            }
        });
    };
    const readData = async (file) => {
        try {
            const filePath = (0, node_path_1.join)(folder, fixFileName(file));
            const mutex = getFileLock(filePath);
            return await mutex.acquire().then(async (release) => {
                try {
                    const data = await (0, promises_1.readFile)(filePath, { encoding: 'utf-8' });
                    return JSON.parse(data, generics_js_1.BufferJSON.reviver);
                }
                finally {
                    release();
                }
            });
        }
        catch (error) {
            return null;
        }
    };
    const removeData = async (file) => {
        try {
            const filePath = (0, node_path_1.join)(folder, fixFileName(file));
            const mutex = getFileLock(filePath);
            return mutex.acquire().then(async (release) => {
                try {
                    await (0, promises_1.unlink)(filePath);
                }
                catch {
                }
                finally {
                    release();
                }
            });
        }
        catch { }
    };
    const folderInfo = await (0, promises_1.stat)(folder).catch(() => { });
    if (folderInfo) {
        if (!folderInfo.isDirectory()) {
            throw new Error(`found something that is not a directory at ${folder}, either delete it or specify a different location`);
        }
    }
    else {
        await (0, promises_1.mkdir)(folder, { recursive: true });
    }
    const fixFileName = (file) => file?.replace(/\//g, '__')?.replace(/:/g, '-');
    const creds = (await readData('creds.json')) || (0, auth_utils_js_1.initAuthCreds)();
    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async (id) => {
                        let value = await readData(`${type}-${id}.json`);
                        if (type === 'app-state-sync-key' && value) {
                            value = index_js_1.proto.Message.AppStateSyncKeyData.fromObject(value);
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
                            const file = `${category}-${id}.json`;
                            tasks.push(value ? writeData(value, file) : removeData(file));
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: async () => {
            return writeData(creds, 'creds.json');
        }
    };
};
exports.useMultiFileAuthState = useMultiFileAuthState;

return module.exports;
})();
for (const key of Object.keys(__kageModule188)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule188[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule188, configurable:true});
