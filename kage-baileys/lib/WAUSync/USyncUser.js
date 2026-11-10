"use strict";
                                                              

class USyncUser                          {
    id         ;
    lid         ;
    phone         ;
    username         ;
    usernameKey         ;
    type         ;
    personaId         ;
    withId(id        )       { this.id = id; return this; }
    withLid(lid        )       { this.lid = lid; return this; }
    withPhone(phone        )       { this.phone = phone; return this; }
    withUsername(username        )       { this.username = username; return this; }
    withUsernameKey(key        )       { this.usernameKey = key; return this; }
    withType(type        )       { this.type = type; return this; }
    withPersonaId(id        )       { this.personaId = id; return this; }
}

Object.assign(exports, { USyncUser });
