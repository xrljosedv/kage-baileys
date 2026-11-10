"use strict";
const { jidDecode } = require('../WABinary/index.js')     
                                                                         
 ;
const { USyncQuery } = require('../WAUSync/USyncQuery.js');
const { USyncUser } = require('../WAUSync/USyncUser.js');
                                                            

const USERNAME_TIMEOUT_MS = 10_000;
                                 
                                                                                               
 
                                 
                
                            
                    
                              
 
function normalizeUserJid(value        )         {
    if (typeof value !== 'string' || !/^\d+(?::\d+)?@(s\.whatsapp\.net|c\.us|lid)$/.test(value)) {
        throw new TypeError('A numeric user JID is required, not an @username, group or phone guess');
    }
    const decoded = jidDecode(value);
    if (!decoded) throw new TypeError('Invalid user JID');
    return `${decoded.user}@${decoded.server === 'c.us' ? 's.whatsapp.net' : decoded.server}`;
}
async function queryUsernames(socket                , jids          )                            {
    if (jids.length > 100) throw new RangeError('Maximum 100 users per username request');
    const ids = [...new Set(jids.map(normalizeUserJid))];
    if (!ids.length) return [];
    const query = new USyncQuery().withUsernameProtocol();
    ids.forEach(id => query.withUser(new USyncUser().withId(id)));
    let timer                                           ;
    let result                         ;
    try {
        result = await Promise.race([
            socket.executeUSyncQuery(query, USERNAME_TIMEOUT_MS),
            new Promise           (resolve => { timer = setTimeout(resolve, USERNAME_TIMEOUT_MS); })
        ]);
    } catch {
        result = undefined;
    } finally {
        if (timer !== undefined) clearTimeout(timer);
    }
    return ids.map(jid => {
        const match = result?.list.find(row => {
            try { return normalizeUserJid(row.id) === jid; } catch { return false; }
        });
        const username = typeof match?.username === 'string' && match.username ? match.username : null;
        return { jid, username, source: 'usync', returnedByServer: username !== null };
    });
}
function installUsernameTools                          (socket   )       
                                                       
                                                                 
  {
    return Object.assign(socket, {
        fetchUsernames: (...jids          ) => queryUsernames(socket, jids),
        fetchUsername: async (jid        )                         => {
            try { return (await queryUsernames(socket, [jid]))[0]?.username ?? null; }
            catch { return null; }
        }
    });
}

Object.assign(exports, { USERNAME_TIMEOUT_MS, normalizeUserJid, queryUsernames, installUsernameTools });
