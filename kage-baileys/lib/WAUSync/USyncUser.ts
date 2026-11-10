import type { USyncUserData } from '../Types/native-tools.js';

export class USyncUser implements USyncUserData {
    id?: string;
    lid?: string;
    phone?: string;
    username?: string;
    usernameKey?: string;
    type?: string;
    personaId?: string;
    withId(id: string): this { this.id = id; return this; }
    withLid(lid: string): this { this.lid = lid; return this; }
    withPhone(phone: string): this { this.phone = phone; return this; }
    withUsername(username: string): this { this.username = username; return this; }
    withUsernameKey(key: string): this { this.usernameKey = key; return this; }
    withType(type: string): this { this.type = type; return this; }
    withPersonaId(id: string): this { this.personaId = id; return this; }
}
