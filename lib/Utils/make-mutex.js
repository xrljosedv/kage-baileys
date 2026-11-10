"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeKeyedMutex = exports.makeMutex = void 0;
const makeMutex = () => {
    let task = Promise.resolve();
    let taskTimeout;
    return {
        mutex(code) {
            task = (async () => {
                // wait for the previous task to complete
                // if there is an error, we swallow so as to not block the queue
                try {
                    await task;
                }
                catch (_a) { }
                try {
                    // execute the current task
                    const result = await code();
                    return result;
                }
                finally {
                    clearTimeout(taskTimeout);
                }
            })();
            // we replace the existing task, appending the new piece of execution to it
            // so the next task will have to wait for this one to finish
            return task;
        },
    };
};
exports.makeMutex = makeMutex;
const makeKeyedMutex = () => {
    const map = {};
    return {
        mutex(key, task) {
            if (!map[key]) {
                map[key] = (0, exports.makeMutex)();
            }
            return map[key].mutex(task);
        }
    };
};
exports.makeKeyedMutex = makeKeyedMutex;

// Kage: compatibilidad de API.
const __kageModule71 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { Mutex: AsyncMutex } = require("async-mutex")

const makeMutex = () => {
    const mutex = new AsyncMutex()
    return {
        mutex(code) {
            return mutex.runExclusive(code)
        }
    }
}

const makeKeyedMutex = () => {
    const map = new Map()
    return {
        async mutex(key, task) {
            let entry = map.get(key)
            
            if (!entry) {
                entry = { mutex: new AsyncMutex(), refCount: 0 }
                map.set(key, entry)
            }
            
            entry.refCount++
            
            try {
                return await entry.mutex.runExclusive(task)
            }
            finally {
                entry.refCount--
                
                // only delete it if this is still the current entry
                if (entry.refCount === 0 && map.get(key) === entry) {
                    map.delete(key)
                }
            }
        }
    }
}

module.exports = {
  makeMutex, 
  makeKeyedMutex
}
return module.exports;
})();
for (const key of Object.keys(__kageModule71)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule71[key]});
}

// Kage: funciones avanzadas.
const __kageModule175 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeKeyedMutex = exports.makeMutex = void 0;
const index_js_1 = require("../Addon/index.js");
const makeMutex = () => {
    const mutex = (0, index_js_1.createMutex)();
    return {
        mutex(code) {
            return mutex.runExclusive(code);
        }
    };
};
exports.makeMutex = makeMutex;
const makeKeyedMutex = () => {
    const map = new Map();
    return {
        async mutex(key, task) {
            let entry = map.get(key);
            if (!entry) {
                entry = { mutex: (0, index_js_1.createMutex)(), refCount: 0 };
                map.set(key, entry);
            }
            entry.refCount++;
            try {
                return await entry.mutex.runExclusive(task);
            }
            finally {
                entry.refCount--;
                // only delete it if this is still the current entry
                if (entry.refCount === 0 && map.get(key) === entry) {
                    map.delete(key);
                }
            }
        }
    };
};
exports.makeKeyedMutex = makeKeyedMutex;

return module.exports;
})();
for (const key of Object.keys(__kageModule175)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule175[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule175, configurable:true});
