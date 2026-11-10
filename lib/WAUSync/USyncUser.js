"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.USyncUser = void 0;
class USyncUser {
    withId(id) {
        this.id = id;
        return this;
    }
    withLid(lid) {
        this.lid = lid;
        return this;
    }
    withUsername(username) { this.username = username; return this; }
    withUsernameKey(usernameKey) { this.usernameKey = usernameKey; return this; }
    withPhone(phone) {
        this.phone = phone;
        return this;
    }
    withType(type) {
        this.type = type;
        return this;
    }
    withPersonaId(personaId) {
        this.personaId = personaId;
        return this;
    }
}
exports.USyncUser = USyncUser;

// Kage: compatibilidad de API.
const __kageModule100 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

class USyncUser {
    withId(id) {
        this.id = id
        return this
    }
    withLid(lid) {
        this.lid = lid
        return this
    }
    withPhone(phone) {
        this.phone = phone
        return this
    }
    withType(type) {
        this.type = type
        return this
    }
    withPersonaId(personaId) {
    	this.personaId = personaId
        return this
    }
}

module.exports = {
  USyncUser
}
return module.exports;
})();
for (const key of Object.keys(__kageModule100)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule100[key]});
}

// Kage: funciones avanzadas.
const __kageModule208 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.USyncUser = void 0;
class USyncUser {
    withId(id) {
        this.id = id;
        return this;
    }
    withLid(lid) {
        this.lid = lid;
        return this;
    }
    withPhone(phone) {
        this.phone = phone;
        return this;
    }
    withUsername(username) {
        this.username = username;
        return this;
    }
    withUsernameKey(usernameKey) {
        this.usernameKey = usernameKey;
        return this;
    }
    withType(type) {
        this.type = type;
        return this;
    }
    withPersonaId(personaId) {
        this.personaId = personaId;
        return this;
    }
}
exports.USyncUser = USyncUser;

return module.exports;
})();
for (const key of Object.keys(__kageModule208)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule208[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule208, configurable:true});
