"use strict";
const { installUsernameTools } = require('../Utils/username.js');
                                                           
                                                           

                           
                                 
                                                                     
                              
 
const { makeSocket } = require('./socket')                                                    ;
const { Boom } = require('@hapi/boom')                                            ;

function makeUSyncSocket(config         ) {
    const socket = makeSocket(config);
    const { generateMessageTag, query } = socket;
    const executeUSyncQuery = async (usyncQuery            , timeoutMs         ) => {
        if (!usyncQuery.protocols.length) throw new Boom('USyncQuery must have at least one protocol');
        const users               = usyncQuery.users.map(user => ({
            tag: 'user', attrs: user.phone ? {} : { jid: user.id },
            content: usyncQuery.protocols.map(protocol => protocol.getUserElement(user))
                .filter((node)                     => node !== null)
        }));
        const iq             = {
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

Object.assign(exports, { makeUSyncSocket });
