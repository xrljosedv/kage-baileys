import type { USyncUserData } from '../Types/native-tools';
export declare class USyncUser implements USyncUserData {
    id?: string; lid?: string; phone?: string; username?: string; usernameKey?: string; type?: string; personaId?: string;
    withId(id: string): this;
    withLid(lid: string): this;
    withPhone(phone: string): this;
    withUsername(username: string): this;
    withUsernameKey(key: string): this;
    withType(type: string): this;
    withPersonaId(id: string): this;
}
