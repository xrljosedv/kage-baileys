import type { BinaryNode, USyncResult } from '../Types/native-tools';
import type { USyncQuery } from '../WAUSync/USyncQuery';
import type { UsernameResult } from '../Utils/username';
export declare function makeUSyncSocket(config: unknown): {
    generateMessageTag(): string;
    query(node: BinaryNode, timeoutMs?: number): Promise<BinaryNode>;
    executeUSyncQuery(query: USyncQuery, timeoutMs?: number): Promise<USyncResult | undefined>;
    fetchUsername(jid: string): Promise<string | null>;
    fetchUsernames(...jids: string[]): Promise<UsernameResult[]>;
    [method: string]: unknown;
};
