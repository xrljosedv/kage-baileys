"use strict";
const { getBinaryNodeChild, assertNodeErrorFree } = require('../WABinary/index.js')     
                                                                              
                                                
 ;
const { USyncDeviceProtocol, USyncContactProtocol, USyncStatusProtocol,
    USyncDisappearingModeProtocol, USyncBotProfileProtocol, USyncLIDProtocol } = require('./Protocols/index.js')           
                                                                            
                                                                                                              ; 
const { USyncUsernameProtocol } = require('./Protocols/USyncUsernameProtocol.js');
                                                                                       
                                                

class USyncQuery {
    protocols                  = [];
    users              = [];
    context = 'interactive';
    mode = 'query';
    withMode(mode        )       { this.mode = mode; return this; }
    withContext(context        )       { this.context = context; return this; }
    withUser(user           )       { this.users.push(user); return this; }
            add(protocol               )       {
        if (!this.protocols.some(item => item.name === protocol.name)) this.protocols.push(protocol);
        return this;
    }
    withUsernameProtocol()       { return this.add(new USyncUsernameProtocol()); }
    withDeviceProtocol()       { return this.add(new USyncDeviceProtocol()); }
    withContactProtocol()       { return this.add(new USyncContactProtocol()); }
    withStatusProtocol()       { return this.add(new USyncStatusProtocol()); }
    withDisappearingModeProtocol()       { return this.add(new USyncDisappearingModeProtocol()); }
    withBotProfileProtocol()       { return this.add(new USyncBotProfileProtocol()); }
    withLIDProtocol()       { return this.add(new USyncLIDProtocol()); }
    parseUSyncQueryResult(result            )                          {
        if (!result || result.attrs?.type !== 'result') return undefined;
        assertNodeErrorFree(result);
        const usync = getBinaryNodeChild(result, 'usync');
        const parse = (tag        )                      => {
            const node = usync && getBinaryNodeChild(usync, tag);
            if (!node || !Array.isArray(node.content)) return [];
            return node.content.filter((user            ) => user.tag === 'user' && !!user.attrs?.jid)
                .map((user            ) => {
                    const row                              = { id: user.attrs.jid  };
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

Object.assign(exports, { USyncQuery });
