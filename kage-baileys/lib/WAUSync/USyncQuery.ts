const { getBinaryNodeChild, assertNodeErrorFree } = require('../WABinary/index.js') as {
    getBinaryNodeChild(node: BinaryNode, tag: string): BinaryNode | undefined;
    assertNodeErrorFree(node: BinaryNode): void;
};
const { USyncDeviceProtocol, USyncContactProtocol, USyncStatusProtocol,
    USyncDisappearingModeProtocol, USyncBotProfileProtocol, USyncLIDProtocol } = require('./Protocols/index.js') as Record<
    'USyncDeviceProtocol' | 'USyncContactProtocol' | 'USyncStatusProtocol' |
    'USyncDisappearingModeProtocol' | 'USyncBotProfileProtocol' | 'USyncLIDProtocol', new () => USyncProtocol>; 
import { USyncUsernameProtocol } from './Protocols/USyncUsernameProtocol.js';
import type { BinaryNode, USyncProtocol, USyncResult } from '../Types/native-tools.js';
import type { USyncUser } from './USyncUser.js';

export class USyncQuery {
    protocols: USyncProtocol[] = [];
    users: USyncUser[] = [];
    context = 'interactive';
    mode = 'query';
    withMode(mode: string): this { this.mode = mode; return this; }
    withContext(context: string): this { this.context = context; return this; }
    withUser(user: USyncUser): this { this.users.push(user); return this; }
    private add(protocol: USyncProtocol): this {
        if (!this.protocols.some(item => item.name === protocol.name)) this.protocols.push(protocol);
        return this;
    }
    withUsernameProtocol(): this { return this.add(new USyncUsernameProtocol()); }
    withDeviceProtocol(): this { return this.add(new USyncDeviceProtocol()); }
    withContactProtocol(): this { return this.add(new USyncContactProtocol()); }
    withStatusProtocol(): this { return this.add(new USyncStatusProtocol()); }
    withDisappearingModeProtocol(): this { return this.add(new USyncDisappearingModeProtocol()); }
    withBotProfileProtocol(): this { return this.add(new USyncBotProfileProtocol()); }
    withLIDProtocol(): this { return this.add(new USyncLIDProtocol()); }
    parseUSyncQueryResult(result: BinaryNode): USyncResult | undefined {
        if (!result || result.attrs?.type !== 'result') return undefined;
        assertNodeErrorFree(result);
        const usync = getBinaryNodeChild(result, 'usync');
        const parse = (tag: string): USyncResult['list'] => {
            const node = usync && getBinaryNodeChild(usync, tag);
            if (!node || !Array.isArray(node.content)) return [];
            return node.content.filter((user: BinaryNode) => user.tag === 'user' && !!user.attrs?.jid)
                .map((user: BinaryNode) => {
                    const row: USyncResult['list'][number] = { id: user.attrs.jid! };
                    for (const child of Array.isArray(user.content) ? user.content : []) {
                        const protocol = this.protocols.find(item => item.name === child.tag);
                        if (!protocol) continue;
                        const value = protocol.parser(child);
                        if (value !== null && value !== undefined) row[protocol.name] = value;
                    }
                    return row;
                });
        };
        return { list: parse('list'), sideList: parse('side_list') };
    }
}
