import { installUsernameTools } from '../Utils/username.js';
import type { BinaryNode } from '../Types/native-tools.js';
import type { USyncQuery } from '../WAUSync/USyncQuery.js';

interface USyncBaseSocket {
    generateMessageTag(): string;
    query(node: BinaryNode, timeoutMs?: number): Promise<BinaryNode>;
    [method: string]: unknown;
}
const { makeSocket } = require('./socket') as { makeSocket(config: unknown): USyncBaseSocket };
const { Boom } = require('@hapi/boom') as { Boom: new (message: string) => Error };

export function makeUSyncSocket(config: unknown) {
    const socket = makeSocket(config);
    const { generateMessageTag, query } = socket;
    const executeUSyncQuery = async (usyncQuery: USyncQuery, timeoutMs?: number) => {
        if (!usyncQuery.protocols.length) throw new Boom('USyncQuery must have at least one protocol');
        const users: BinaryNode[] = usyncQuery.users.map(user => ({
            tag: 'user', attrs: user.phone ? {} : { jid: user.id },
            content: usyncQuery.protocols.map(protocol => protocol.getUserElement(user))
                .filter((node): node is BinaryNode => node !== null)
        }));
        const iq: BinaryNode = {
            tag: 'iq', attrs: { to: 's.whatsapp.net', type: 'get', xmlns: 'usync' },
            content: [{
                tag: 'usync', attrs: {
                    mode: usyncQuery.mode, context: usyncQuery.context,
                    sid: generateMessageTag(), last: 'true', index: '0'
                },
                content: [
                    { tag: 'query', attrs: {}, content: usyncQuery.protocols.map(protocol => protocol.getQueryElement()) },
                    { tag: 'list', attrs: {}, content: users }
                ]
            }]
        };
        return usyncQuery.parseUSyncQueryResult(await query(iq, timeoutMs));
    };
    return installUsernameTools({ ...socket, executeUSyncQuery });
}
