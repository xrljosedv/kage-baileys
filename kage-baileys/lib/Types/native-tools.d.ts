export interface BinaryNode {
    tag: string;
    attrs: Record<string, string | undefined>;
    content?: BinaryNode[] | string | Uint8Array;
}
export interface USyncProtocol {
    name: string;
    getQueryElement(): BinaryNode;
    getUserElement(user: USyncUserData): BinaryNode | null;
    parser(node: BinaryNode): unknown;
}
export interface USyncUserData {
    id?: string;
    lid?: string;
    phone?: string;
    username?: string;
    usernameKey?: string;
    type?: string;
    personaId?: string;
}
export interface USyncResult {
    list: Array<{ id: string; username?: string | null; [protocol: string]: unknown }>;
    sideList: Array<{ id: string; [protocol: string]: unknown }>;
}
