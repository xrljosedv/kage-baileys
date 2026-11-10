import type { USyncQuery } from '../WAUSync/USyncQuery';
import type { USyncResult } from '../Types/native-tools';
export declare const USERNAME_TIMEOUT_MS = 10000;
export interface UsernameSocket { executeUSyncQuery(query: USyncQuery, timeoutMs?: number): Promise<USyncResult | undefined>; }
export interface UsernameResult { jid: string; username: string | null; source: 'usync'; returnedByServer: boolean; }
export declare function normalizeUserJid(value: string): string;
export declare function queryUsernames(socket: UsernameSocket, jids: string[]): Promise<UsernameResult[]>;
export declare function installUsernameTools<T extends UsernameSocket>(socket: T): T & {
    fetchUsername(jid: string): Promise<string | null>;
    fetchUsernames(...jids: string[]): Promise<UsernameResult[]>;
};
