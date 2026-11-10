"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SenderKeyName = void 0;
function isNull(str) {
    return str === null || str === '';
}
function intValue(num) {
    const MAX_VALUE = 0x7fffffff;
    const MIN_VALUE = -0x80000000;
    if (num > MAX_VALUE || num < MIN_VALUE) {
        return num & 0xffffffff;
    }
    return num;
}
function hashCode(strKey) {
    let hash = 0;
    if (!isNull(strKey)) {
        for (let i = 0; i < strKey.length; i++) {
            hash = hash * 31 + strKey.charCodeAt(i);
            hash = intValue(hash);
        }
    }
    return hash;
}
class SenderKeyName {
    constructor(groupId, sender) {
        this.groupId = groupId;
        this.sender = sender;
    }
    getGroupId() {
        return this.groupId;
    }
    getSender() {
        return this.sender;
    }
    serialize() {
        return `${this.groupId}::${this.sender.id}::${this.sender.deviceId}`;
    }
    toString() {
        return this.serialize();
    }
    equals(other) {
        if (other === null)
            return false;
        return this.groupId === other.groupId && this.sender.toString() === other.sender.toString();
    }
    hashCode() {
        return hashCode(this.groupId) ^ hashCode(this.sender.toString());
    }
}
exports.SenderKeyName = SenderKeyName;

// Kage: compatibilidad de API.
const __kageModule15 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

function isNull(str) {
    return str === null || str === ''
}

function intValue(num) {
    const MAX_VALUE = 0x7fffffff
    const MIN_VALUE = -0x80000000
    if (num > MAX_VALUE || num < MIN_VALUE) {
        return num & 0xffffffff
    }
   
 return num
}

function hashCode(strKey) {
    let hash = 0
    if (!isNull(strKey)) {
        for (let i = 0; i < strKey.length; i++) {
            hash = hash * 31 + strKey.charCodeAt(i)
            hash = intValue(hash)
        }
    }
    return hash
}

class SenderKeyName {
    constructor(groupId, sender) {
        this.groupId = groupId
        this.sender = sender
    }
    getGroupId() {
        return this.groupId
    }
    getSender() {
        return this.sender
    }
    serialize() {
        return `${this.groupId}::${this.sender.id}::${this.sender.deviceId}`
    }
    toString() {
        return this.serialize()
    }
    equals(other) {
        if (other === null)
            return false
        return this.groupId === other.groupId && this.sender.toString() === other.sender.toString()
    }
    hashCode() {
        return hashCode(this.groupId) ^ hashCode(this.sender.toString())
    }
}

module.exports = {
  SenderKeyName
}
return module.exports;
})();
for (const key of Object.keys(__kageModule15)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule15[key]});
}

// Kage: funciones avanzadas.
const __kageModule121 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SenderKeyName = void 0;
function isNull(str) {
    return str === null || str === '';
}
function intValue(num) {
    const MAX_VALUE = 0x7fffffff;
    const MIN_VALUE = -0x80000000;
    if (num > MAX_VALUE || num < MIN_VALUE) {
        return num & 0xffffffff;
    }
    return num;
}
function hashCode(strKey) {
    let hash = 0;
    if (!isNull(strKey)) {
        for (let i = 0; i < strKey.length; i++) {
            hash = hash * 31 + strKey.charCodeAt(i);
            hash = intValue(hash);
        }
    }
    return hash;
}
class SenderKeyName {
    constructor(groupId, sender) {
        this.groupId = groupId;
        this.sender = sender;
    }
    getGroupId() {
        return this.groupId;
    }
    getSender() {
        return this.sender;
    }
    serialize() {
        return `${this.groupId}::${this.sender.id}::${this.sender.deviceId}`;
    }
    toString() {
        return this.serialize();
    }
    equals(other) {
        if (other === null)
            return false;
        return this.groupId === other.groupId && this.sender.toString() === other.sender.toString();
    }
    hashCode() {
        return hashCode(this.groupId) ^ hashCode(this.sender.toString());
    }
}
exports.SenderKeyName = SenderKeyName;

return module.exports;
})();
for (const key of Object.keys(__kageModule121)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule121[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule121, configurable:true});
