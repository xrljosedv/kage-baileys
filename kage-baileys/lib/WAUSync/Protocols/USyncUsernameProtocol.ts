const { assertNodeErrorFree } = require('../../WABinary/index.js') as { assertNodeErrorFree(node: BinaryNode): void };
import type { BinaryNode, USyncUserData } from '../../Types/native-tools.js';

export class USyncUsernameProtocol {
    readonly name = 'username';
    getQueryElement(): BinaryNode { return { tag: 'username', attrs: {} }; }
    getUserElement(_user: USyncUserData): null { return null; }
    parser(node: BinaryNode): string | null {
        if (node?.tag !== 'username') return null;
        assertNodeErrorFree(node);
        const raw = node.attrs?.username ?? node.attrs?.value ?? node.content;
        const text = typeof raw === 'string' ? raw : raw instanceof Uint8Array
            ? Buffer.from(raw).toString('utf8') : null;
        if (text === null) return null;
        const value = text.trim().replace(/^@/, '');
        return value && value.length <= 128 && !/[\s/@\u0000-\u001f\u007f]/u.test(value) ? value : null;
    }
}
