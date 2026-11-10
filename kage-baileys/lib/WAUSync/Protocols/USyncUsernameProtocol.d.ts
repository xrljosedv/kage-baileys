import type { BinaryNode, USyncUserData } from '../../Types/native-tools';
export declare class USyncUsernameProtocol {
    readonly name = 'username';
    getQueryElement(): BinaryNode;
    getUserElement(user: USyncUserData): null;
    parser(node: BinaryNode): string | null;
}
