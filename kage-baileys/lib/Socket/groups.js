"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractGroupMetadata = exports.makeGroupsSocket = void 0;
const WAProto_1 = require("../../WAProto");
const Types_1 = require("../Types");
const Utils_1 = require("../Utils");
const WABinary_1 = require("../WABinary");
const chats_1 = require("./chats");
const makeGroupsSocket = (config) => {
    const sock = (0, chats_1.makeChatsSocket)(config);
    const { authState, ev, query, upsertMessage } = sock;
    const groupQuery = async (jid, type, content) => (query({
        tag: 'iq',
        attrs: {
            type,
            xmlns: 'w:g2',
            to: jid,
        },
        content
    }));
    const groupMetadata = async (jid) => {
        const result = await groupQuery(jid, 'get', [{ tag: 'query', attrs: { request: 'interactive' } }]);
        return (0, exports.extractGroupMetadata)(result);
    };
    const groupFetchAllParticipating = async () => {
        const result = await query({
            tag: 'iq',
            attrs: {
                to: '@g.us',
                xmlns: 'w:g2',
                type: 'get',
            },
            content: [
                {
                    tag: 'participating',
                    attrs: {},
                    content: [
                        { tag: 'participants', attrs: {} },
                        { tag: 'description', attrs: {} }
                    ]
                }
            ]
        });
        const data = {};
        const groupsChild = (0, WABinary_1.getBinaryNodeChild)(result, 'groups');
        if (groupsChild) {
            const groups = (0, WABinary_1.getBinaryNodeChildren)(groupsChild, 'group');
            for (const groupNode of groups) {
                const meta = (0, exports.extractGroupMetadata)({
                    tag: 'result',
                    attrs: {},
                    content: [groupNode]
                });
                data[meta.id] = meta;
            }
        }
        sock.ev.emit('groups.update', Object.values(data));
        return data;
    };
    sock.ws.on('CB:ib,,dirty', async (node) => {
        const { attrs } = (0, WABinary_1.getBinaryNodeChild)(node, 'dirty');
        if (attrs.type !== 'groups') {
            return;
        }
        await groupFetchAllParticipating();
        await sock.cleanDirtyBits('groups');
    });
    return {
        ...sock,
        groupQuery,
        groupMetadata,
        groupCreate: async (subject, participants) => {
            const key = (0, Utils_1.generateMessageIDV2)();
            const result = await groupQuery('@g.us', 'set', [
                {
                    tag: 'create',
                    attrs: {
                        subject,
                        key
                    },
                    content: participants.map(jid => ({
                        tag: 'participant',
                        attrs: { jid }
                    }))
                }
            ]);
            return (0, exports.extractGroupMetadata)(result);
        },
        groupLeave: async (id) => {
            await groupQuery('@g.us', 'set', [
                {
                    tag: 'leave',
                    attrs: {},
                    content: [
                        { tag: 'group', attrs: { id } }
                    ]
                }
            ]);
        },
        groupUpdateSubject: async (jid, subject) => {
            await groupQuery(jid, 'set', [
                {
                    tag: 'subject',
                    attrs: {},
                    content: Buffer.from(subject, 'utf-8')
                }
            ]);
        },
        groupRequestParticipantsList: async (jid) => {
            const result = await groupQuery(jid, 'get', [
                {
                    tag: 'membership_approval_requests',
                    attrs: {}
                }
            ]);
            const node = (0, WABinary_1.getBinaryNodeChild)(result, 'membership_approval_requests');
            const participants = (0, WABinary_1.getBinaryNodeChildren)(node, 'membership_approval_request');
            return participants.map(v => v.attrs);
        },
        groupRequestParticipantsUpdate: async (jid, participants, action) => {
            const result = await groupQuery(jid, 'set', [{
                    tag: 'membership_requests_action',
                    attrs: {},
                    content: [
                        {
                            tag: action,
                            attrs: {},
                            content: participants.map(jid => ({
                                tag: 'participant',
                                attrs: { jid }
                            }))
                        }
                    ]
                }]);
            const node = (0, WABinary_1.getBinaryNodeChild)(result, 'membership_requests_action');
            const nodeAction = (0, WABinary_1.getBinaryNodeChild)(node, action);
            const participantsAffected = (0, WABinary_1.getBinaryNodeChildren)(nodeAction, 'participant');
            return participantsAffected.map(p => {
                return { status: p.attrs.error || '200', jid: p.attrs.jid };
            });
        },
        groupParticipantsUpdate: async (jid, participants, action) => {
            const result = await groupQuery(jid, 'set', [
                {
                    tag: action,
                    attrs: {},
                    content: participants.map(jid => ({
                        tag: 'participant',
                        attrs: { jid }
                    }))
                }
            ]);
            const node = (0, WABinary_1.getBinaryNodeChild)(result, action);
            const participantsAffected = (0, WABinary_1.getBinaryNodeChildren)(node, 'participant');
            return participantsAffected.map(p => {
                return { status: p.attrs.error || '200', jid: p.attrs.jid, content: p };
            });
        },
        groupUpdateDescription: async (jid, description) => {
            var _a;
            const metadata = await groupMetadata(jid);
            const prev = (_a = metadata.descId) !== null && _a !== void 0 ? _a : null;
            await groupQuery(jid, 'set', [
                {
                    tag: 'description',
                    attrs: {
                        ...(description ? { id: (0, Utils_1.generateMessageIDV2)() } : { delete: 'true' }),
                        ...(prev ? { prev } : {})
                    },
                    content: description ? [
                        { tag: 'body', attrs: {}, content: Buffer.from(description, 'utf-8') }
                    ] : undefined
                }
            ]);
        },
        groupInviteCode: async (jid) => {
            const result = await groupQuery(jid, 'get', [{ tag: 'invite', attrs: {} }]);
            const inviteNode = (0, WABinary_1.getBinaryNodeChild)(result, 'invite');
            return inviteNode === null || inviteNode === void 0 ? void 0 : inviteNode.attrs.code;
        },
        groupRevokeInvite: async (jid) => {
            const result = await groupQuery(jid, 'set', [{ tag: 'invite', attrs: {} }]);
            const inviteNode = (0, WABinary_1.getBinaryNodeChild)(result, 'invite');
            return inviteNode === null || inviteNode === void 0 ? void 0 : inviteNode.attrs.code;
        },
        groupAcceptInvite: async (code) => {
            const results = await groupQuery('@g.us', 'set', [{ tag: 'invite', attrs: { code } }]);
            const result = (0, WABinary_1.getBinaryNodeChild)(results, 'group');
            return result === null || result === void 0 ? void 0 : result.attrs.jid;
        },
         





        groupRevokeInviteV4: async (groupJid, invitedJid) => {
            const result = await groupQuery(groupJid, 'set', [{ tag: 'revoke', attrs: {}, content: [{ tag: 'participant', attrs: { jid: invitedJid } }] }]);
            return !!result;
        },
         




        groupAcceptInviteV4: ev.createBufferedFunction(async (key, inviteMessage) => {
            var _a;
            key = typeof key === 'string' ? { remoteJid: key } : key;
            const results = await groupQuery(inviteMessage.groupJid, 'set', [{
                    tag: 'accept',
                    attrs: {
                        code: inviteMessage.inviteCode,
                        expiration: inviteMessage.inviteExpiration.toString(),
                        admin: key.remoteJid
                    }
                }]);
             
             
            if (key.id) {
                 
                inviteMessage = WAProto_1.proto.Message.GroupInviteMessage.fromObject(inviteMessage);
                inviteMessage.inviteExpiration = 0;
                inviteMessage.inviteCode = '';
                ev.emit('messages.update', [
                    {
                        key,
                        update: {
                            message: {
                                groupInviteMessage: inviteMessage
                            }
                        }
                    }
                ]);
            }
             
            await upsertMessage({
                key: {
                    remoteJid: inviteMessage.groupJid,
                    id: (0, Utils_1.generateMessageIDV2)((_a = sock.user) === null || _a === void 0 ? void 0 : _a.id),
                    fromMe: false,
                    participant: key.remoteJid,
                },
                messageStubType: Types_1.WAMessageStubType.GROUP_PARTICIPANT_ADD,
                messageStubParameters: [
                    authState.creds.me.id
                ],
                participant: key.remoteJid,
                messageTimestamp: (0, Utils_1.unixTimestampSeconds)()
            }, 'notify');
            return results.attrs.from;
        }),
        groupGetInviteInfo: async (code) => {
            const results = await groupQuery('@g.us', 'get', [{ tag: 'invite', attrs: { code } }]);
            return (0, exports.extractGroupMetadata)(results);
        },
        groupToggleEphemeral: async (jid, ephemeralExpiration) => {
            const content = ephemeralExpiration ?
                { tag: 'ephemeral', attrs: { expiration: ephemeralExpiration.toString() } } :
                { tag: 'not_ephemeral', attrs: {} };
            await groupQuery(jid, 'set', [content]);
        },
        groupSettingUpdate: async (jid, setting) => {
            await groupQuery(jid, 'set', [{ tag: setting, attrs: {} }]);
        },
        groupMemberAddMode: async (jid, mode) => {
            await groupQuery(jid, 'set', [{ tag: 'member_add_mode', attrs: {}, content: mode }]);
        },
        groupJoinApprovalMode: async (jid, mode) => {
            await groupQuery(jid, 'set', [{ tag: 'membership_approval_mode', attrs: {}, content: [{ tag: 'group_join', attrs: { state: mode } }] }]);
        },
        groupFetchAllParticipating
    };
};
exports.makeGroupsSocket = makeGroupsSocket;
const extractGroupMetadata = (result) => {
    var _a, _b;
    const group = (0, WABinary_1.getBinaryNodeChild)(result, 'group');
    const descChild = (0, WABinary_1.getBinaryNodeChild)(group, 'description');
    let desc;
    let descId;
    let descOwner;
    let descOwnerLid;
    let descTime;
    if (descChild) {
        desc = (0, WABinary_1.getBinaryNodeChildString)(descChild, 'body');
        descOwner = (0, WABinary_1.jidNormalizedUser)(descChild.attrs.participant_pn || descChild.attrs.participant);
        if (group.attrs.addressing_mode === 'lid') {
            descOwnerLid = (0, WABinary_1.jidNormalizedUser)(descChild.attrs.participant);
        }
        descId = descChild.attrs.id;
        descTime = descChild.attrs.t ? +descChild.attrs.t : undefined;
    }
    const groupSize = group.attrs.size ? Number(group.attrs.size) : undefined;
    const groupId = group.attrs.id.includes('@') ? group.attrs.id : (0, WABinary_1.jidEncode)(group.attrs.id, 'g.us');
    const eph = (_a = (0, WABinary_1.getBinaryNodeChild)(group, 'ephemeral')) === null || _a === void 0 ? void 0 : _a.attrs.expiration;
    const memberAddMode = (0, WABinary_1.getBinaryNodeChildString)(group, 'member_add_mode') === 'all_member_add';
    const metadata = {
        id: groupId,
        addressingMode: group.attrs.addressing_mode,
        subject: group.attrs.subject,
        subjectOwner: (0, WABinary_1.jidNormalizedUser)(group.attrs.s_o_pn || group.attrs.s_o),
        ...(group.attrs.addressing_mode === 'lid' ? { subjectOwnerLid: (0, WABinary_1.jidNormalizedUser)(group.attrs.s_o) } : {}),
        subjectTime: group.attrs.s_t ? +group.attrs.s_t : undefined,
        size: groupSize || (0, WABinary_1.getBinaryNodeChildren)(group, 'participant').length,
        creation: group.attrs.creation ? +group.attrs.creation : undefined,
        owner: (0, WABinary_1.jidNormalizedUser)(group.attrs.creator_pn || group.attrs.creator),
        ...(group.attrs.addressing_mode === 'lid' ? { ownerLid: (0, WABinary_1.jidNormalizedUser)(group.attrs.creator) } : {}),
        desc,
        descId,
        descOwner,
        descOwnerLid,
        descTime,
        linkedParent: ((_b = (0, WABinary_1.getBinaryNodeChild)(group, 'linked_parent')) === null || _b === void 0 ? void 0 : _b.attrs.jid) || undefined,
        restrict: !!(0, WABinary_1.getBinaryNodeChild)(group, 'locked'),
        announce: !!(0, WABinary_1.getBinaryNodeChild)(group, 'announcement'),
        isCommunity: !!(0, WABinary_1.getBinaryNodeChild)(group, 'parent'),
        isCommunityAnnounce: !!(0, WABinary_1.getBinaryNodeChild)(group, 'default_sub_group'),
        joinApprovalMode: !!(0, WABinary_1.getBinaryNodeChild)(group, 'membership_approval_mode'),
        memberAddMode,
        participants: (0, WABinary_1.getBinaryNodeChildren)(group, 'participant').map(({ attrs }) => {
            return {
                id: attrs.jid,
                jid: attrs.phone_number || attrs.jid,
                lid: attrs.lid || attrs.jid,
                admin: (attrs.type || null),
            };
        }),
        ephemeralDuration: eph ? +eph : undefined
    };
    return metadata;
};
exports.extractGroupMetadata = extractGroupMetadata;

 
const __kageModule27 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"
Object.defineProperty(exports, "__esModule", { value: true })

const { proto } = require("../../WAProto")
const {
  WAMessageStubType, 
  WAMessageAddressingMode
} = require("../Types")
const {
  generateMessageID, 
  unixTimestampSeconds
} = require("../Utils")
const {
  getBinaryNodeChild, 
  getBinaryNodeChildren,
  getBinaryNodeChildString, 
  jidEncode,
  jidNormalizedUser
} = require("../WABinary")
const { makeChatsSocket } = require("./chats")

const makeGroupsSocket = (config) => {
    const suki = makeChatsSocket(config)
    const { 
        authState, 
        ev, 
        query, 
        cleanDirtyBits, 
        upsertMessage 
    } = suki
    
    const groupQuery = async (jid, type, content) => (query({
        tag: 'iq',
        attrs: {
            type,
            xmlns: 'w:g2',
            to: jid,
        },
        content
    }))
    
    const groupMetadata = async (jid) => {
        const result = await groupQuery(jid, 'get', [{ tag: 'query', attrs: { request: 'interactive' } }])
        return extractGroupMetadata(result)
    }
    
    const groupFetchAllParticipating = async () => {
        const result = await query({
            tag: 'iq',
            attrs: {
                to: '@g.us',
                xmlns: 'w:g2',
                type: 'get',
            },
            content: [
                {
                    tag: 'participating',
                    attrs: {},
                    content: [
                        { tag: 'participants', attrs: {} },
                        { tag: 'description', attrs: {} }
                    ]
                }
            ]
        })
        
        const data = {}
        const groupsChild = getBinaryNodeChild(result, 'groups')
        
        if (groupsChild) {
            const groups = getBinaryNodeChildren(groupsChild, 'group')
            for (const groupNode of groups) {
                const meta = extractGroupMetadata({
                    tag: 'result',
                    attrs: {},
                    content: [groupNode]
                })
                data[meta.id] = meta
            }
        }
        
        suki.ev.emit('groups.update', Object.values(data))
        return data
    }
    
    suki.ws.on('CB:ib,,dirty', async (node) => {
        const { attrs } = getBinaryNodeChild(node, 'dirty')
        if (attrs.type !== 'groups') {
            return
        }
                
        await groupFetchAllParticipating()
        await cleanDirtyBits('groups')
    })
    
    return {
        ...suki,
        groupQuery, 
        groupMetadata,
        groupCreate: async (subject, participants) => {
            const key = generateMessageID()
            
            const result = await groupQuery('@g.us', 'set', [
                {
                    tag: 'create',
                    attrs: {
                        subject,
                        key
                    },
                    content: participants.map(jid => ({
                        tag: 'participant',
                        attrs: { jid }
                    }))
                }
            ])
            
            return extractGroupMetadata(result)
        },
        groupLeave: async (id) => {
            await groupQuery('@g.us', 'set', [
                {
                    tag: 'leave',
                    attrs: {},
                    content: [
                        { tag: 'group', attrs: { id } }
                    ]
                }
            ])
        },
        groupUpdateSubject: async (jid, subject) => {
            await groupQuery(jid, 'set', [
                {
                    tag: 'subject',
                    attrs: {},
                    content: Buffer.from(subject, 'utf-8')
                }
            ])
        },
        groupRequestParticipantsList: async (jid) => {
            const result = await groupQuery(jid, 'get', [
                {
                    tag: 'membership_approval_requests',
                    attrs: {}
                }
            ])
            
            const node = getBinaryNodeChild(result, 'membership_approval_requests')
            const participants = getBinaryNodeChildren(node, 'membership_approval_request')
            
            return participants.map(v => v.attrs)
        },
        groupRequestParticipantsUpdate: async (jid, participants, action) => {
            const result = await groupQuery(jid, 'set', [{
                    tag: 'membership_requests_action',
                    attrs: {},
                    content: [
                        {
                            tag: action,
                            attrs: {},
                            content: participants.map(jid => ({
                                tag: 'participant',
                                attrs: { jid }
                            }))
                        }
                    ]
                }])
                
            const node = getBinaryNodeChild(result, 'membership_requests_action')
            const nodeAction = getBinaryNodeChild(node, action)
            const participantsAffected = getBinaryNodeChildren(nodeAction, 'participant')
            
            return participantsAffected.map(p => {
                return { status: p.attrs.error || '200', jid: p.attrs.jid }
            })
        },
        groupParticipantsUpdate: async (jid, participants, action) => {
            const result = await groupQuery(jid, 'set', [
                {
                    tag: action,
                    attrs: {},
                    content: participants.map(jid => ({
                        tag: 'participant',
                        attrs: { jid }
                    }))
                }
            ])
            const node = getBinaryNodeChild(result, action)
            const participantsAffected = getBinaryNodeChildren(node, 'participant')
            
            return participantsAffected.map(p => {
                return { status: p.attrs.error || '200', jid: p.attrs.jid, content: p }
            })
        },
        groupUpdateDescription: async (jid, description) => {
            const metadata = await groupMetadata(jid)
            const prev = metadata.descId ? metadata.descId : null
            
            await groupQuery(jid, 'set', [
                {
                    tag: 'description',
                    attrs: {
                        ...(description ? { id: generateMessageID() } : { delete: 'true' }),
                        ...(prev ? { prev } : {})
                    },
                    content: description ? [
                        { tag: 'body', attrs: {}, content: Buffer.from(description, 'utf-8') }
                    ] : undefined
                }
            ])
        },
        groupInviteCode: async (jid) => {
            const result = await groupQuery(jid, 'get', [{ tag: 'invite', attrs: {} }])
            const inviteNode = getBinaryNodeChild(result, 'invite')
            
            return inviteNode?.attrs?.code
        },
        groupRevokeInvite: async (jid) => {
            const result = await groupQuery(jid, 'set', [{ tag: 'invite', attrs: {} }])
            const inviteNode = getBinaryNodeChild(result, 'invite')
            
            return inviteNode?.attrs?.code
        },
        groupAcceptInvite: async (code) => {
            const results = await groupQuery('@g.us', 'set', [{ tag: 'invite', attrs: { code } }])
            const result = getBinaryNodeChild(results, 'group')
            
            return result?.attrs?.jid
        },
         





        groupRevokeInviteV4: async (groupJid, invitedJid) => {
            const result = await groupQuery(groupJid, 'set', [{ tag: 'revoke', attrs: {}, content: [{ tag: 'participant', attrs: { jid: invitedJid } }] }])
            
            return !!result
        },
         




        groupAcceptInviteV4: ev.createBufferedFunction(async (key, inviteMessage) => {
            key = typeof key === 'string' ? { remoteJid: key } : key
            const results = await groupQuery(inviteMessage.groupJid, 'set', [{
                    tag: 'accept',
                    attrs: {
                        code: inviteMessage.inviteCode,
                        expiration: inviteMessage.inviteExpiration.toString(),
                        admin: key.remoteJid
                    }
                }])
                
             
             
            if (key.id) {
                 
                inviteMessage = proto.Message.GroupInviteMessage.fromObject(inviteMessage)
                inviteMessage.inviteExpiration = 0
                inviteMessage.inviteCode = ''
                ev.emit('messages.update', [
                    {
                        key,
                        update: {
                            message: {
                                groupInviteMessage: inviteMessage
                            }
                        }
                    }
                ])
            }
            
             
            await upsertMessage({
                key: {
                    remoteJid: inviteMessage.groupJid,
                    id: generateMessageID(suki.user?.id),
                    fromMe: false,
                    participant: key.remoteJid
                },
                messageStubType: WAMessageStubType.GROUP_PARTICIPANT_ADD,
                messageStubParameters: [JSON.stringify(authState.creds.me)],
                participant: key.remoteJid,
                messageTimestamp: unixTimestampSeconds()
            }, 'notify')
            
            return results.attrs.from
        }),
        groupGetInviteInfo: async (code) => {
            const results = await groupQuery('@g.us', 'get', [{ tag: 'invite', attrs: { code } }])
            
            return extractGroupMetadata(results)
        },
        groupToggleEphemeral: async (jid, ephemeralExpiration) => {
            const content = ephemeralExpiration ?
                { tag: 'ephemeral', attrs: { expiration: ephemeralExpiration.toString() } } :
                { tag: 'not_ephemeral', attrs: {} }
            await groupQuery(jid, 'set', [content])
        },
        groupSettingUpdate: async (jid, setting) => {
            await groupQuery(jid, 'set', [{ tag: setting, attrs: {} }])
        },
        groupMemberAddMode: async (jid, mode) => {
            await groupQuery(jid, 'set', [{ tag: 'member_add_mode', attrs: {}, content: mode }])
        },
        groupJoinApprovalMode: async (jid, mode) => {
            await groupQuery(jid, 'set', [{ tag: 'membership_approval_mode', attrs: {}, content: [{ tag: 'group_join', attrs: { state: mode } }] }])
        },
        groupFetchAllParticipating
    }
}

const extractGroupMetadata = (result) => {
    const group = getBinaryNodeChild(result, 'group')
    const descChild = getBinaryNodeChild(group, 'description')
    const mode = group.attrs.addressing_mode === WAMessageAddressingMode.LID ? WAMessageAddressingMode.LID : WAMessageAddressingMode.PN
    
    let desc
    let descId
    let descOwner
    let descOwnerAlt
    
    if (descChild) {
        desc = getBinaryNodeChildString(descChild, 'body')
        descId = descChild.attrs.id
        descOwner = mode === WAMessageAddressingMode.LID ? jidNormalizedUser(descChild.attrs.participant_pn) : jidNormalizedUser(descChild.attrs.participant) 
        descOwnerAlt = mode === WAMessageAddressingMode.LID ? jidNormalizedUser(descChild.attrs.participant) : undefined
    }
    
    const groupId = group.attrs.id.includes('@') ? group.attrs.id : jidEncode(group.attrs.id, 'g.us')
    const eph = getBinaryNodeChild(group, 'ephemeral')?.attrs.expiration
    const memberAddMode = getBinaryNodeChildString(group, 'member_add_mode') === 'all_member_add'
    
    const metadata = {
        id: groupId,
        subject: group.attrs.subject,
        subjectOwner: group.attrs.s_o,
        subjectOwnerAlt: group.attrs?.s_o_pn ? group.attrs.s_o_pn : group.attrs.s_o, 
        subjectTime: Number(group.attrs.s_t),
        size: Number(group.attrs?.size ? group.attrs.size : getBinaryNodeChildren(group, 'participant').length),
        creation: Number(group.attrs.creation), 
        owner: group.attrs.creator ? jidNormalizedUser(group.attrs.creator) : undefined,
        ownerAlt: group.attrs.creator ? jidNormalizedUser(group.attrs?.creator_pn ? group.attrs.creator_pn : group.attrs.creator_pn) : undefined, 
        ownerCountry: group.attrs.creator_country_code, 
        desc,
        descId,
        descOwner, 
        descOwnerAlt, 
        linkedParent: getBinaryNodeChild(group, 'linked_parent')?.attrs.jid || undefined,
        restrict: !!getBinaryNodeChild(group, 'locked'),
        announce: !!getBinaryNodeChild(group, 'announcement'),
        isCommunity: !!getBinaryNodeChild(group, 'parent'),
        isCommunityAnnounce: !!getBinaryNodeChild(group, 'default_sub_group'),
        joinApprovalMode: !!getBinaryNodeChild(group, 'membership_approval_mode'),
        memberAddMode,
        participants: getBinaryNodeChildren(group, 'participant').map(({ attrs }) => {
            return {
                id: mode === WAMessageAddressingMode.LID ? attrs.phone_number : attrs.jid,
                lid: mode === WAMessageAddressingMode.LID ? attrs.jid : attrs.lid, 
                admin: (attrs.type || null)
            }
        }),
        ephemeralDuration: eph ? Number(eph) : undefined, 
        addressingMode: mode
    }
    
    return metadata
}

module.exports = {
  makeGroupsSocket, 
  extractGroupMetadata
}
return module.exports;
})();
for (const key of Object.keys(__kageModule27)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule27[key]});
}

 
const __kageModule133 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractGroupMetadata = exports.makeGroupsSocket = void 0;
const index_js_1 = require("../../WAProto/index.js");
const index_js_2 = require("../Addon/index.js");
const index_js_3 = require("../Types/index.js");
const index_js_4 = require("../Utils/index.js");
const index_js_5 = require("../WABinary/index.js");
const chats_js_1 = require("./chats.js");
const makeGroupsSocket = (config) => {
    const sock = (0, chats_js_1.makeChatsSocket)(config);
    const { authState, ev, query, upsertMessage } = sock;
    const groupQuery = async (jid, type, content) => query({
        tag: 'iq',
        attrs: {
            type,
            xmlns: 'w:g2',
            to: jid
        },
        content
    });
    const groupMetadata = async (jid) => {
        const result = await groupQuery(jid, 'get', [{ tag: 'query', attrs: { request: 'interactive' } }]);
        return (0, exports.extractGroupMetadata)(result);
    };
    const groupFetchAllParticipating = async () => {
        const result = await query({
            tag: 'iq',
            attrs: {
                to: '@g.us',
                xmlns: 'w:g2',
                type: 'get'
            },
            content: [
                {
                    tag: 'participating',
                    attrs: {},
                    content: [
                        { tag: 'participants', attrs: {} },
                        { tag: 'description', attrs: {} }
                    ]
                }
            ]
        });
        const data = {};
        const groupsChild = (0, index_js_5.getBinaryNodeChild)(result, 'groups');
        if (groupsChild) {
            const groups = (0, index_js_5.getBinaryNodeChildren)(groupsChild, 'group');
            for (const groupNode of groups) {
                const meta = (0, exports.extractGroupMetadata)({
                    tag: 'result',
                    attrs: {},
                    content: [groupNode]
                });
                data[meta.id] = meta;
            }
        }
         
        sock.ev.emit('groups.update', Object.values(data));
        return data;
    };
    sock.ws.on('CB:ib,,dirty', async (node) => {
        const { attrs } = (0, index_js_5.getBinaryNodeChild)(node, 'dirty');
        if (attrs.type !== 'groups') {
            return;
        }
        await groupFetchAllParticipating();
        await sock.cleanDirtyBits('groups');
    });
    return {
        ...sock,
        groupQuery,
        groupMetadata,
        groupCreate: async (subject, participants) => {
            const key = (0, index_js_4.generateMessageIDV2)();
            const result = await groupQuery('@g.us', 'set', [
                {
                    tag: 'create',
                    attrs: {
                        subject,
                        key
                    },
                    content: participants.map(jid => ({
                        tag: 'participant',
                        attrs: { jid }
                    }))
                }
            ]);
            return (0, exports.extractGroupMetadata)(result);
        },
        groupLeave: async (id) => {
            await groupQuery('@g.us', 'set', [
                {
                    tag: 'leave',
                    attrs: {},
                    content: [{ tag: 'group', attrs: { id } }]
                }
            ]);
        },
        groupUpdateSubject: async (jid, subject) => {
            await groupQuery(jid, 'set', [
                {
                    tag: 'subject',
                    attrs: {},
                    content: Buffer.from(subject, 'utf-8')
                }
            ]);
        },
        groupRequestParticipantsList: async (jid) => {
            const result = await groupQuery(jid, 'get', [
                {
                    tag: 'membership_approval_requests',
                    attrs: {}
                }
            ]);
            const node = (0, index_js_5.getBinaryNodeChild)(result, 'membership_approval_requests');
            const participants = (0, index_js_5.getBinaryNodeChildren)(node, 'membership_approval_request');
            return participants.map(v => v.attrs);
        },
        groupRequestParticipantsUpdate: async (jid, participants, action) => {
            const result = await groupQuery(jid, 'set', [
                {
                    tag: 'membership_requests_action',
                    attrs: {},
                    content: [
                        {
                            tag: action,
                            attrs: {},
                            content: participants.map(jid => ({
                                tag: 'participant',
                                attrs: { jid }
                            }))
                        }
                    ]
                }
            ]);
            const node = (0, index_js_5.getBinaryNodeChild)(result, 'membership_requests_action');
            const nodeAction = (0, index_js_5.getBinaryNodeChild)(node, action);
            const participantsAffected = (0, index_js_5.getBinaryNodeChildren)(nodeAction, 'participant');
            return participantsAffected.map(p => {
                return { status: p.attrs.error || '200', jid: p.attrs.jid };
            });
        },
        groupParticipantsUpdate: async (jid, participants, action) => {
            const result = await groupQuery(jid, 'set', [
                {
                    tag: action,
                    attrs: {},
                    content: participants.map(jid => ({
                        tag: 'participant',
                        attrs: { jid }
                    }))
                }
            ]);
            const node = (0, index_js_5.getBinaryNodeChild)(result, action);
            const participantsAffected = (0, index_js_5.getBinaryNodeChildren)(node, 'participant');
            return participantsAffected.map(p => {
                return { status: p.attrs.error || '200', jid: p.attrs.jid, content: p };
            });
        },
        groupUpdateDescription: async (jid, description) => {
            const metadata = await groupMetadata(jid);
            const prev = metadata.descId ?? null;
            await groupQuery(jid, 'set', [
                {
                    tag: 'description',
                    attrs: {
                        ...(description ? { id: (0, index_js_4.generateMessageIDV2)() } : { delete: 'true' }),
                        ...(prev ? { prev } : {})
                    },
                    content: description ? [{ tag: 'body', attrs: {}, content: Buffer.from(description, 'utf-8') }] : undefined
                }
            ]);
        },
        groupInviteCode: async (jid) => {
            const result = await groupQuery(jid, 'get', [{ tag: 'invite', attrs: {} }]);
            const inviteNode = (0, index_js_5.getBinaryNodeChild)(result, 'invite');
            return inviteNode?.attrs.code;
        },
        groupRevokeInvite: async (jid) => {
            const result = await groupQuery(jid, 'set', [{ tag: 'invite', attrs: {} }]);
            const inviteNode = (0, index_js_5.getBinaryNodeChild)(result, 'invite');
            return inviteNode?.attrs.code;
        },
        groupAcceptInvite: async (code) => {
            const results = await groupQuery('@g.us', 'set', [{ tag: 'invite', attrs: { code } }]);
            const result = (0, index_js_5.getBinaryNodeChild)(results, 'group');
            return result?.attrs.jid;
        },
         





        groupRevokeInviteV4: async (groupJid, invitedJid) => {
            const result = await groupQuery(groupJid, 'set', [
                { tag: 'revoke', attrs: {}, content: [{ tag: 'participant', attrs: { jid: invitedJid } }] }
            ]);
            return !!result;
        },
         




        groupAcceptInviteV4: ev.createBufferedFunction(async (key, inviteMessage) => {
            key = typeof key === 'string' ? { remoteJid: key } : key;
            const results = await groupQuery(inviteMessage.groupJid, 'set', [
                {
                    tag: 'accept',
                    attrs: {
                        code: inviteMessage.inviteCode,
                        expiration: inviteMessage.inviteExpiration.toString(),
                        admin: key.remoteJid
                    }
                }
            ]);
             
             
            if (key.id) {
                 
                inviteMessage = index_js_1.proto.Message.GroupInviteMessage.fromObject(inviteMessage);
                inviteMessage.inviteExpiration = 0;
                inviteMessage.inviteCode = '';
                ev.emit('messages.update', [
                    {
                        key,
                        update: {
                            message: {
                                groupInviteMessage: inviteMessage
                            }
                        }
                    }
                ]);
            }
             
            await upsertMessage({
                key: {
                    remoteJid: inviteMessage.groupJid,
                    id: (0, index_js_4.generateMessageIDV2)(sock.user?.id),
                    fromMe: false,
                    participant: key.remoteJid
                },
                messageStubType: index_js_3.WAMessageStubType.GROUP_PARTICIPANT_ADD,
                messageStubParameters: [JSON.stringify(authState.creds.me)],
                participant: key.remoteJid,
                messageTimestamp: (0, index_js_4.unixTimestampSeconds)()
            }, 'notify');
            return results.attrs.from;
        }),
        groupGetInviteInfo: async (code) => {
            const results = await groupQuery('@g.us', 'get', [{ tag: 'invite', attrs: { code } }]);
            return (0, exports.extractGroupMetadata)(results);
        },
        groupToggleEphemeral: async (jid, ephemeralExpiration) => {
            const content = ephemeralExpiration
                ? { tag: 'ephemeral', attrs: { expiration: ephemeralExpiration.toString() } }
                : { tag: 'not_ephemeral', attrs: {} };
            await groupQuery(jid, 'set', [content]);
        },
        groupSettingUpdate: async (jid, setting) => {
            await groupQuery(jid, 'set', [{ tag: setting, attrs: {} }]);
        },
        groupMemberAddMode: async (jid, mode) => {
            await groupQuery(jid, 'set', [{ tag: 'member_add_mode', attrs: {}, content: mode }]);
        },
        groupJoinApprovalMode: async (jid, mode) => {
            await groupQuery(jid, 'set', [
                { tag: 'membership_approval_mode', attrs: {}, content: [{ tag: 'group_join', attrs: { state: mode } }] }
            ]);
        },
        groupFetchAllParticipating
    };
};
exports.makeGroupsSocket = makeGroupsSocket;
const extractGroupMetadata = (result) => {
    const group = (0, index_js_5.getBinaryNodeChild)(result, 'group');
    if (!group) {
         
        const errorNode = (0, index_js_5.getBinaryNodeChild)(result, 'error');
        if (errorNode) {
            const code = errorNode.attrs.code ? +errorNode.attrs.code : 500;
            const text = errorNode.attrs.text || 'group metadata query failed';
            throw new index_js_2.HttpError(text, { statusCode: code, data: errorNode });
        }
        throw new index_js_2.HttpError('Invalid group metadata response: missing <group> node', { data: result });
    }
    if (!group.attrs.id) {
        throw new index_js_2.HttpError('Invalid group metadata response: missing group id', { data: group });
    }
    const descChild = (0, index_js_5.getBinaryNodeChild)(group, 'description');
    let desc;
    let descId;
    let descOwner;
    let descOwnerPn;
    let descOwnerUsername;
    let descTime;
    if (descChild) {
        desc = (0, index_js_5.getBinaryNodeChildString)(descChild, 'body');
        descOwner = descChild.attrs.participant ? (0, index_js_5.jidNormalizedUser)(descChild.attrs.participant) : undefined;
        descOwnerPn = descChild.attrs.participant_pn ? (0, index_js_5.jidNormalizedUser)(descChild.attrs.participant_pn) : undefined;
        descOwnerUsername = descChild.attrs.participant_username || undefined;
        descTime = +descChild.attrs.t;
        descId = descChild.attrs.id;
    }
    const groupId = group.attrs.id.includes('@') ? group.attrs.id : (0, index_js_5.jidEncode)(group.attrs.id, 'g.us');
    const eph = (0, index_js_5.getBinaryNodeChild)(group, 'ephemeral')?.attrs.expiration;
    const memberAddMode = (0, index_js_5.getBinaryNodeChildString)(group, 'member_add_mode') === 'all_member_add';
    const metadata = {
        id: groupId,
        notify: group.attrs.notify,
        addressingMode: group.attrs.addressing_mode === 'lid' ? index_js_3.WAMessageAddressingMode.LID : index_js_3.WAMessageAddressingMode.PN,
        subject: group.attrs.subject,
        subjectOwner: group.attrs.s_o,
        subjectOwnerPn: group.attrs.s_o_pn,
        subjectOwnerUsername: group.attrs.s_o_username,
        subjectTime: +group.attrs.s_t,
        size: group.attrs.size ? +group.attrs.size : (0, index_js_5.getBinaryNodeChildren)(group, 'participant').length,
        creation: +group.attrs.creation,
        owner: group.attrs.creator ? (0, index_js_5.jidNormalizedUser)(group.attrs.creator) : undefined,
        ownerPn: group.attrs.creator_pn ? (0, index_js_5.jidNormalizedUser)(group.attrs.creator_pn) : undefined,
        ownerUsername: group.attrs.creator_username || undefined,
        owner_country_code: group.attrs.creator_country_code,
        desc,
        descId,
        descOwner,
        descOwnerPn,
        descOwnerUsername,
        descTime,
        linkedParent: (0, index_js_5.getBinaryNodeChild)(group, 'linked_parent')?.attrs.jid || undefined,
        restrict: !!(0, index_js_5.getBinaryNodeChild)(group, 'locked'),
        announce: !!(0, index_js_5.getBinaryNodeChild)(group, 'announcement'),
        isCommunity: !!(0, index_js_5.getBinaryNodeChild)(group, 'parent'),
        isCommunityAnnounce: !!(0, index_js_5.getBinaryNodeChild)(group, 'default_sub_group'),
        joinApprovalMode: !!(0, index_js_5.getBinaryNodeChild)(group, 'membership_approval_mode'),
        memberAddMode,
        participants: (0, index_js_5.getBinaryNodeChildren)(group, 'participant').map(({ attrs }) => {
             
            return {
                id: attrs.jid,
                phoneNumber: (0, index_js_5.isLidUser)(attrs.jid) && (0, index_js_5.isPnUser)(attrs.phone_number) ? attrs.phone_number : undefined,
                lid: (0, index_js_5.isPnUser)(attrs.jid) && (0, index_js_5.isLidUser)(attrs.lid) ? attrs.lid : undefined,
                username: attrs.participant_username || attrs.username || undefined,
                admin: (attrs.type || null)
            };
        }),
        ephemeralDuration: eph ? +eph : undefined
    };
    return metadata;
};
exports.extractGroupMetadata = extractGroupMetadata;

return module.exports;
})();
for (const key of Object.keys(__kageModule133)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule133[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule133, configurable:true});
