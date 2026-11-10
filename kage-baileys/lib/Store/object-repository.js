"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObjectRepository = void 0;
class ObjectRepository {
    constructor(entities = {}) {
        this.entityMap = new Map(Object.entries(entities));
    }
    findById(id) {
        return this.entityMap.get(id);
    }
    findAll() {
        return Array.from(this.entityMap.values());
    }
    upsertById(id, entity) {
        return this.entityMap.set(id, { ...entity });
    }
    deleteById(id) {
        return this.entityMap.delete(id);
    }
    count() {
        return this.entityMap.size;
    }
    toJSON() {
        return this.findAll();
    }
}
exports.ObjectRepository = ObjectRepository;

 
const __kageModule38 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

class ObjectRepository {
    constructor(entities = {}) {
        this.entityMap = new Map(Object.entries(entities))
    }
    findById(id) {
        return this.entityMap.get(id)
    }
    findAll() {
        return Array.from(this.entityMap.values())
    }
    upsertById(id, entity) {
        return this.entityMap.set(id, { ...entity })
    }
    deleteById(id) {
        return this.entityMap.delete(id)
    }
    count() {
        return this.entityMap.size
    }
    toJSON() {
        return this.findAll()
    }
}

module.exports = {
  ObjectRepository
}
return module.exports;
})();
for (const key of Object.keys(__kageModule38)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule38[key]});
}

 
const __kageModule143 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObjectRepository = void 0;
class ObjectRepository {
    constructor(entities = {}) {
        this.entityMap = new Map(Object.entries(entities));
    }
    findById(id) {
        return this.entityMap.get(id);
    }
    findAll() {
        return Array.from(this.entityMap.values());
    }
    upsertById(id, entity) {
        return this.entityMap.set(id, { ...entity });
    }
    deleteById(id) {
        return this.entityMap.delete(id);
    }
    count() {
        return this.entityMap.size;
    }
    toJSON() {
        return this.findAll();
    }
}
exports.ObjectRepository = ObjectRepository;

return module.exports;
})();
for (const key of Object.keys(__kageModule143)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule143[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule143, configurable:true});
