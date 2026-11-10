"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; } function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }var _indexjs = require('../../WAProto/index.js');
var _indexjs3 = require('../Types/index.js');
var _indexjs5 = require('../Utils/index.js');
var _loggerjs = require('../Utils/logger.js'); var _loggerjs2 = _interopRequireDefault(_loggerjs);
var _indexjs7 = require('../WABinary/index.js');
var _businessjs = require('./business.js');
 const makeCommunitiesSocket = (config) => {
    const sock = _businessjs.makeBusinessSocket.call(void 0, config);
    const { authState, ev, query, upsertMessage } = sock;
    const communityQuery = async (jid, type, content) => query({
        tag: 'iq',
        attrs: {
            type,
            xmlns: 'w:g2',
            to: jid
        },
        content
    });
    const communityMetadata = async (jid) => {
        const result = await communityQuery(jid, 'get', [{ tag: 'query', attrs: { request: 'interactive' } }]);
        return exports.extractCommunityMetadata.call(void 0, result);
    };
    const communityFetchAllParticipating = async () => {
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
        const communitiesChild = _indexjs7.getBinaryNodeChild.call(void 0, result, 'communities');
        if (communitiesChild) {
            const communities = _indexjs7.getBinaryNodeChildren.call(void 0, communitiesChild, 'community');
            for (const communityNode of communities) {
                const meta = exports.extractCommunityMetadata.call(void 0, {
                    tag: 'result',
                    attrs: {},
                    content: [communityNode]
                });
                data[meta.id] = meta;
            }
        }
        sock.ev.emit('groups.update', Object.values(data));
        return data;
    };
    async function parseGroupResult(node) {
        _loggerjs2.default.info({ node }, 'parseGroupResult');
        const groupNode = _indexjs7.getBinaryNodeChild.call(void 0, node, 'group');
        if (groupNode) {
            try {
                _loggerjs2.default.info({ groupNode }, 'groupNode');
                const metadata = await sock.groupMetadata(`${groupNode.attrs.id}@g.us`);
                return metadata ? metadata : Optional.empty();
            }
            catch (error) {
                console.error('Error parsing group metadata:', error);
                return Optional.empty();
            }
        }
        return Optional.empty();
    }
    const Optional = {
        empty: () => null,
        of: (value) => (value !== null ? { value } : null)
    };
    sock.ws.on('CB:ib,,dirty', async (node) => {
        const { attrs } = _indexjs7.getBinaryNodeChild.call(void 0, node, 'dirty');
        if (attrs.type !== 'communities') {
            return;
        }
        await communityFetchAllParticipating();
        await sock.cleanDirtyBits('groups');
    });
    return {
        ...sock,
        communityMetadata,
        communityCreate: async (subject, body) => {
            const descriptionId = _indexjs5.generateMessageID.call(void 0, ).substring(0, 12);
            const result = await communityQuery('@g.us', 'set', [
                {
                    tag: 'create',
                    attrs: { subject },
                    content: [
                        {
                            tag: 'description',
                            attrs: { id: descriptionId },
                            content: [
                                {
                                    tag: 'body',
                                    attrs: {},
                                    content: Buffer.from(body || '', 'utf-8')
                                }
                            ]
                        },
                        {
                            tag: 'parent',
                            attrs: { default_membership_approval_mode: 'request_required' }
                        },
                        {
                            tag: 'allow_non_admin_sub_group_creation',
                            attrs: {}
                        },
                        {
                            tag: 'create_general_chat',
                            attrs: {}
                        }
                    ]
                }
            ]);
            return await parseGroupResult(result);
        },
        communityCreateGroup: async (subject, participants, parentCommunityJid) => {
            const key = _indexjs5.generateMessageIDV2.call(void 0, );
            const result = await communityQuery('@g.us', 'set', [
                {
                    tag: 'create',
                    attrs: {
                        subject,
                        key
                    },
                    content: [
                        ...participants.map(jid => ({
                            tag: 'participant',
                            attrs: { jid }
                        })),
                        { tag: 'linked_parent', attrs: { jid: parentCommunityJid } }
                    ]
                }
            ]);
            return await parseGroupResult(result);
        },
        communityLeave: async (id) => {
            await communityQuery('@g.us', 'set', [
                {
                    tag: 'leave',
                    attrs: {},
                    content: [{ tag: 'community', attrs: { id } }]
                }
            ]);
        },
        communityUpdateSubject: async (jid, subject) => {
            await communityQuery(jid, 'set', [
                {
                    tag: 'subject',
                    attrs: {},
                    content: Buffer.from(subject, 'utf-8')
                }
            ]);
        },
        communityLinkGroup: async (groupJid, parentCommunityJid) => {
            await communityQuery(parentCommunityJid, 'set', [
                {
                    tag: 'links',
                    attrs: {},
                    content: [
                        {
                            tag: 'link',
                            attrs: { link_type: 'sub_group' },
                            content: [{ tag: 'group', attrs: { jid: groupJid } }]
                        }
                    ]
                }
            ]);
        },
        communityUnlinkGroup: async (groupJid, parentCommunityJid) => {
            await communityQuery(parentCommunityJid, 'set', [
                {
                    tag: 'unlink',
                    attrs: { unlink_type: 'sub_group' },
                    content: [{ tag: 'group', attrs: { jid: groupJid } }]
                }
            ]);
        },
        communityFetchLinkedGroups: async (jid) => {
            let communityJid = jid;
            let isCommunity = false;
             
            const metadata = await sock.groupMetadata(jid);
            if (metadata.linkedParent) {
                 
                communityJid = metadata.linkedParent;
            }
            else {
                 
                isCommunity = true;
            }
             
            const result = await communityQuery(communityJid, 'get', [{ tag: 'sub_groups', attrs: {} }]);
            const linkedGroupsData = [];
            const subGroupsNode = _indexjs7.getBinaryNodeChild.call(void 0, result, 'sub_groups');
            if (subGroupsNode) {
                const groupNodes = _indexjs7.getBinaryNodeChildren.call(void 0, subGroupsNode, 'group');
                for (const groupNode of groupNodes) {
                    linkedGroupsData.push({
                        id: groupNode.attrs.id ? _indexjs7.jidEncode.call(void 0, groupNode.attrs.id, 'g.us') : undefined,
                        subject: groupNode.attrs.subject || '',
                        creation: groupNode.attrs.creation ? Number(groupNode.attrs.creation) : undefined,
                        owner: groupNode.attrs.creator ? _indexjs7.jidNormalizedUser.call(void 0, groupNode.attrs.creator) : undefined,
                        size: groupNode.attrs.size ? Number(groupNode.attrs.size) : undefined
                    });
                }
            }
            return {
                communityJid,
                isCommunity,
                linkedGroups: linkedGroupsData
            };
        },
        communityRequestParticipantsList: async (jid) => {
            const result = await communityQuery(jid, 'get', [
                {
                    tag: 'membership_approval_requests',
                    attrs: {}
                }
            ]);
            const node = _indexjs7.getBinaryNodeChild.call(void 0, result, 'membership_approval_requests');
            const participants = _indexjs7.getBinaryNodeChildren.call(void 0, node, 'membership_approval_request');
            return participants.map(v => v.attrs);
        },
        communityRequestParticipantsUpdate: async (jid, participants, action) => {
            const result = await communityQuery(jid, 'set', [
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
            const node = _indexjs7.getBinaryNodeChild.call(void 0, result, 'membership_requests_action');
            const nodeAction = _indexjs7.getBinaryNodeChild.call(void 0, node, action);
            const participantsAffected = _indexjs7.getBinaryNodeChildren.call(void 0, nodeAction, 'participant');
            return participantsAffected.map(p => {
                return { status: p.attrs.error || '200', jid: p.attrs.jid };
            });
        },
        communityParticipantsUpdate: async (jid, participants, action) => {
            const result = await communityQuery(jid, 'set', [
                {
                    tag: action,
                    attrs: action === 'remove' ? { linked_groups: 'true' } : {},
                    content: participants.map(jid => ({
                        tag: 'participant',
                        attrs: { jid }
                    }))
                }
            ]);
            const node = _indexjs7.getBinaryNodeChild.call(void 0, result, action);
            const participantsAffected = _indexjs7.getBinaryNodeChildren.call(void 0, node, 'participant');
            return participantsAffected.map(p => {
                return { status: p.attrs.error || '200', jid: p.attrs.jid, content: p };
            });
        },
        communityUpdateDescription: async (jid, description) => {
            const metadata = await communityMetadata(jid);
            const prev = _nullishCoalesce(metadata.descId, () => ( null));
            await communityQuery(jid, 'set', [
                {
                    tag: 'description',
                    attrs: {
                        ...(description ? { id: _indexjs5.generateMessageID.call(void 0, ) } : { delete: 'true' }),
                        ...(prev ? { prev } : {})
                    },
                    content: description ? [{ tag: 'body', attrs: {}, content: Buffer.from(description, 'utf-8') }] : undefined
                }
            ]);
        },
        communityInviteCode: async (jid) => {
            const result = await communityQuery(jid, 'get', [{ tag: 'invite', attrs: {} }]);
            const inviteNode = _indexjs7.getBinaryNodeChild.call(void 0, result, 'invite');
            return _optionalChain([inviteNode, 'optionalAccess', _ => _.attrs, 'access', _2 => _2.code]);
        },
        communityRevokeInvite: async (jid) => {
            const result = await communityQuery(jid, 'set', [{ tag: 'invite', attrs: {} }]);
            const inviteNode = _indexjs7.getBinaryNodeChild.call(void 0, result, 'invite');
            return _optionalChain([inviteNode, 'optionalAccess', _3 => _3.attrs, 'access', _4 => _4.code]);
        },
        communityAcceptInvite: async (code) => {
            const results = await communityQuery('@g.us', 'set', [{ tag: 'invite', attrs: { code } }]);
            const result = _indexjs7.getBinaryNodeChild.call(void 0, results, 'community');
            return _optionalChain([result, 'optionalAccess', _5 => _5.attrs, 'access', _6 => _6.jid]);
        },
         





        communityRevokeInviteV4: async (communityJid, invitedJid) => {
            const result = await communityQuery(communityJid, 'set', [
                { tag: 'revoke', attrs: {}, content: [{ tag: 'participant', attrs: { jid: invitedJid } }] }
            ]);
            return !!result;
        },
         




        communityAcceptInviteV4: ev.createBufferedFunction(async (key, inviteMessage) => {
            key = typeof key === 'string' ? { remoteJid: key } : key;
            const results = await communityQuery(inviteMessage.groupJid, 'set', [
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
                 
                inviteMessage = _indexjs.proto.Message.GroupInviteMessage.fromObject(inviteMessage);
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
                    id: _indexjs5.generateMessageIDV2.call(void 0, _optionalChain([sock, 'access', _7 => _7.user, 'optionalAccess', _8 => _8.id])),
                    fromMe: false,
                    participant: key.remoteJid  
                },
                messageStubType: _indexjs3.WAMessageStubType.GROUP_PARTICIPANT_ADD,
                messageStubParameters: [JSON.stringify(authState.creds.me)],
                participant: key.remoteJid,
                messageTimestamp: _indexjs5.unixTimestampSeconds.call(void 0, )
            }, 'notify');
            return results.attrs.from;
        }),
        communityGetInviteInfo: async (code) => {
            const results = await communityQuery('@g.us', 'get', [{ tag: 'invite', attrs: { code } }]);
            return exports.extractCommunityMetadata.call(void 0, results);
        },
        communityToggleEphemeral: async (jid, ephemeralExpiration) => {
            const content = ephemeralExpiration
                ? { tag: 'ephemeral', attrs: { expiration: ephemeralExpiration.toString() } }
                : { tag: 'not_ephemeral', attrs: {} };
            await communityQuery(jid, 'set', [content]);
        },
        communitySettingUpdate: async (jid, setting) => {
            await communityQuery(jid, 'set', [{ tag: setting, attrs: {} }]);
        },
        communityMemberAddMode: async (jid, mode) => {
            await communityQuery(jid, 'set', [{ tag: 'member_add_mode', attrs: {}, content: mode }]);
        },
        communityJoinApprovalMode: async (jid, mode) => {
            await communityQuery(jid, 'set', [
                { tag: 'membership_approval_mode', attrs: {}, content: [{ tag: 'community_join', attrs: { state: mode } }] }
            ]);
        },
        communityFetchAllParticipating
    };
}; exports.makeCommunitiesSocket = makeCommunitiesSocket;
 const extractCommunityMetadata = (result) => {
    const community = _indexjs7.getBinaryNodeChild.call(void 0, result, 'community');
    const descChild = _indexjs7.getBinaryNodeChild.call(void 0, community, 'description');
    let desc;
    let descId;
    if (descChild) {
        desc = _indexjs7.getBinaryNodeChildString.call(void 0, descChild, 'body');
        descId = descChild.attrs.id;
    }
    const communityId = _optionalChain([community, 'access', _9 => _9.attrs, 'access', _10 => _10.id, 'optionalAccess', _11 => _11.includes, 'call', _12 => _12('@')])
        ? community.attrs.id
        : _indexjs7.jidEncode.call(void 0, community.attrs.id || '', 'g.us');
    const eph = _optionalChain([_indexjs7.getBinaryNodeChild.call(void 0, community, 'ephemeral'), 'optionalAccess', _13 => _13.attrs, 'access', _14 => _14.expiration]);
    const memberAddMode = _indexjs7.getBinaryNodeChildString.call(void 0, community, 'member_add_mode') === 'all_member_add';
    const metadata = {
        id: communityId,
        subject: community.attrs.subject || '',
        subjectOwner: community.attrs.s_o,
        subjectTime: Number(community.attrs.s_t || 0),
        size: _indexjs7.getBinaryNodeChildren.call(void 0, community, 'participant').length,
        creation: Number(community.attrs.creation || 0),
        owner: community.attrs.creator ? _indexjs7.jidNormalizedUser.call(void 0, community.attrs.creator) : undefined,
        desc,
        descId,
        linkedParent: _optionalChain([_indexjs7.getBinaryNodeChild.call(void 0, community, 'linked_parent'), 'optionalAccess', _15 => _15.attrs, 'access', _16 => _16.jid]) || undefined,
        restrict: !!_indexjs7.getBinaryNodeChild.call(void 0, community, 'locked'),
        announce: !!_indexjs7.getBinaryNodeChild.call(void 0, community, 'announcement'),
        isCommunity: !!_indexjs7.getBinaryNodeChild.call(void 0, community, 'parent'),
        isCommunityAnnounce: !!_indexjs7.getBinaryNodeChild.call(void 0, community, 'default_sub_community'),
        joinApprovalMode: !!_indexjs7.getBinaryNodeChild.call(void 0, community, 'membership_approval_mode'),
        memberAddMode,
        participants: _indexjs7.getBinaryNodeChildren.call(void 0, community, 'participant').map(({ attrs }) => {
            return {
                 
                id: attrs.jid,
                admin: (attrs.type || null)
            };
        }),
        ephemeralDuration: eph ? +eph : undefined,
        addressingMode: _indexjs7.getBinaryNodeChildString.call(void 0, community, 'addressing_mode')
    };
    return metadata;
}; exports.extractCommunityMetadata = extractCommunityMetadata;
 
 
const __kageModule132 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractCommunityMetadata = exports.makeCommunitiesSocket = void 0;
const index_js_1 = require("../../WAProto/index.js");
const index_js_2 = require("../Types/index.js");
const index_js_3 = require("../Utils/index.js");
const logger_js_1 = __importDefault(require("../Utils/logger.js"));
const index_js_4 = require("../WABinary/index.js");
const business_js_1 = require("./business.js");
const makeCommunitiesSocket = (config) => {
    const sock = (0, business_js_1.makeBusinessSocket)(config);
    const { authState, ev, query, upsertMessage } = sock;
    const communityQuery = async (jid, type, content) => query({
        tag: 'iq',
        attrs: {
            type,
            xmlns: 'w:g2',
            to: jid
        },
        content
    });
    const communityMetadata = async (jid) => {
        const result = await communityQuery(jid, 'get', [{ tag: 'query', attrs: { request: 'interactive' } }]);
        return (0, exports.extractCommunityMetadata)(result);
    };
    const communityFetchAllParticipating = async () => {
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
        const communitiesChild = (0, index_js_4.getBinaryNodeChild)(result, 'communities');
        if (communitiesChild) {
            const communities = (0, index_js_4.getBinaryNodeChildren)(communitiesChild, 'community');
            for (const communityNode of communities) {
                const meta = (0, exports.extractCommunityMetadata)({
                    tag: 'result',
                    attrs: {},
                    content: [communityNode]
                });
                data[meta.id] = meta;
            }
        }
        sock.ev.emit('groups.update', Object.values(data));
        return data;
    };
    async function parseGroupResult(node) {
        logger_js_1.default.info({ node }, 'parseGroupResult');
        const groupNode = (0, index_js_4.getBinaryNodeChild)(node, 'group');
        if (groupNode) {
            try {
                logger_js_1.default.info({ groupNode }, 'groupNode');
                const metadata = await sock.groupMetadata(`${groupNode.attrs.id}@g.us`);
                return metadata ? metadata : Optional.empty();
            }
            catch (error) {
                console.error('Error parsing group metadata:', error);
                return Optional.empty();
            }
        }
        return Optional.empty();
    }
    const Optional = {
        empty: () => null,
        of: (value) => (value !== null ? { value } : null)
    };
    sock.ws.on('CB:ib,,dirty', async (node) => {
        const { attrs } = (0, index_js_4.getBinaryNodeChild)(node, 'dirty');
        if (attrs.type !== 'communities') {
            return;
        }
        await communityFetchAllParticipating();
        await sock.cleanDirtyBits('groups');
    });
    return {
        ...sock,
        communityQuery,
        communityMetadata,
        communityCreate: async (subject, body) => {
            const descriptionId = (0, index_js_3.generateMessageID)().substring(0, 12);
            const result = await communityQuery('@g.us', 'set', [
                {
                    tag: 'create',
                    attrs: { subject },
                    content: [
                        {
                            tag: 'description',
                            attrs: { id: descriptionId },
                            content: [
                                {
                                    tag: 'body',
                                    attrs: {},
                                    content: Buffer.from(body || '', 'utf-8')
                                }
                            ]
                        },
                        {
                            tag: 'parent',
                            attrs: { default_membership_approval_mode: 'request_required' }
                        },
                        {
                            tag: 'allow_non_admin_sub_group_creation',
                            attrs: {}
                        },
                        {
                            tag: 'create_general_chat',
                            attrs: {}
                        }
                    ]
                }
            ]);
            return await parseGroupResult(result);
        },
        communityCreateGroup: async (subject, participants, parentCommunityJid) => {
            const key = (0, index_js_3.generateMessageIDV2)();
            const result = await communityQuery('@g.us', 'set', [
                {
                    tag: 'create',
                    attrs: {
                        subject,
                        key
                    },
                    content: [
                        ...participants.map(jid => ({
                            tag: 'participant',
                            attrs: { jid }
                        })),
                        { tag: 'linked_parent', attrs: { jid: parentCommunityJid } }
                    ]
                }
            ]);
            return await parseGroupResult(result);
        },
        communityLeave: async (id) => {
            await communityQuery('@g.us', 'set', [
                {
                    tag: 'leave',
                    attrs: {},
                    content: [{ tag: 'community', attrs: { id } }]
                }
            ]);
        },
        communityUpdateSubject: async (jid, subject) => {
            await communityQuery(jid, 'set', [
                {
                    tag: 'subject',
                    attrs: {},
                    content: Buffer.from(subject, 'utf-8')
                }
            ]);
        },
        communityLinkGroup: async (groupJid, parentCommunityJid) => {
            await communityQuery(parentCommunityJid, 'set', [
                {
                    tag: 'links',
                    attrs: {},
                    content: [
                        {
                            tag: 'link',
                            attrs: { link_type: 'sub_group' },
                            content: [{ tag: 'group', attrs: { jid: groupJid } }]
                        }
                    ]
                }
            ]);
        },
        communityUnlinkGroup: async (groupJid, parentCommunityJid) => {
            await communityQuery(parentCommunityJid, 'set', [
                {
                    tag: 'unlink',
                    attrs: { unlink_type: 'sub_group' },
                    content: [{ tag: 'group', attrs: { jid: groupJid } }]
                }
            ]);
        },
        communityFetchLinkedGroups: async (jid) => {
            let communityJid = jid;
            let isCommunity = false;
             
            const metadata = await sock.groupMetadata(jid);
            if (metadata.linkedParent) {
                 
                communityJid = metadata.linkedParent;
            }
            else {
                 
                isCommunity = true;
            }
             
            const result = await communityQuery(communityJid, 'get', [{ tag: 'sub_groups', attrs: {} }]);
            const linkedGroupsData = [];
            const subGroupsNode = (0, index_js_4.getBinaryNodeChild)(result, 'sub_groups');
            if (subGroupsNode) {
                const groupNodes = (0, index_js_4.getBinaryNodeChildren)(subGroupsNode, 'group');
                for (const groupNode of groupNodes) {
                    linkedGroupsData.push({
                        id: groupNode.attrs.id ? (0, index_js_4.jidEncode)(groupNode.attrs.id, 'g.us') : undefined,
                        subject: groupNode.attrs.subject || '',
                        creation: groupNode.attrs.creation ? Number(groupNode.attrs.creation) : undefined,
                        owner: groupNode.attrs.creator ? (0, index_js_4.jidNormalizedUser)(groupNode.attrs.creator) : undefined,
                        size: groupNode.attrs.size ? Number(groupNode.attrs.size) : undefined
                    });
                }
            }
            return {
                communityJid,
                isCommunity,
                linkedGroups: linkedGroupsData
            };
        },
        communityRequestParticipantsList: async (jid) => {
            const result = await communityQuery(jid, 'get', [
                {
                    tag: 'membership_approval_requests',
                    attrs: {}
                }
            ]);
            const node = (0, index_js_4.getBinaryNodeChild)(result, 'membership_approval_requests');
            const participants = (0, index_js_4.getBinaryNodeChildren)(node, 'membership_approval_request');
            return participants.map(v => v.attrs);
        },
        communityRequestParticipantsUpdate: async (jid, participants, action) => {
            const result = await communityQuery(jid, 'set', [
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
            const node = (0, index_js_4.getBinaryNodeChild)(result, 'membership_requests_action');
            const nodeAction = (0, index_js_4.getBinaryNodeChild)(node, action);
            const participantsAffected = (0, index_js_4.getBinaryNodeChildren)(nodeAction, 'participant');
            return participantsAffected.map(p => {
                return { status: p.attrs.error || '200', jid: p.attrs.jid };
            });
        },
        communityParticipantsUpdate: async (jid, participants, action) => {
            const result = await communityQuery(jid, 'set', [
                {
                    tag: action,
                    attrs: action === 'remove' ? { linked_groups: 'true' } : {},
                    content: participants.map(jid => ({
                        tag: 'participant',
                        attrs: { jid }
                    }))
                }
            ]);
            const node = (0, index_js_4.getBinaryNodeChild)(result, action);
            const participantsAffected = (0, index_js_4.getBinaryNodeChildren)(node, 'participant');
            return participantsAffected.map(p => {
                return { status: p.attrs.error || '200', jid: p.attrs.jid, content: p };
            });
        },
        communityUpdateDescription: async (jid, description) => {
            const metadata = await communityMetadata(jid);
            const prev = metadata.descId ?? null;
            await communityQuery(jid, 'set', [
                {
                    tag: 'description',
                    attrs: {
                        ...(description ? { id: (0, index_js_3.generateMessageID)() } : { delete: 'true' }),
                        ...(prev ? { prev } : {})
                    },
                    content: description ? [{ tag: 'body', attrs: {}, content: Buffer.from(description, 'utf-8') }] : undefined
                }
            ]);
        },
        communityInviteCode: async (jid) => {
            const result = await communityQuery(jid, 'get', [{ tag: 'invite', attrs: {} }]);
            const inviteNode = (0, index_js_4.getBinaryNodeChild)(result, 'invite');
            return inviteNode?.attrs.code;
        },
        communityRevokeInvite: async (jid) => {
            const result = await communityQuery(jid, 'set', [{ tag: 'invite', attrs: {} }]);
            const inviteNode = (0, index_js_4.getBinaryNodeChild)(result, 'invite');
            return inviteNode?.attrs.code;
        },
        communityAcceptInvite: async (code) => {
            const results = await communityQuery('@g.us', 'set', [{ tag: 'invite', attrs: { code } }]);
            const result = (0, index_js_4.getBinaryNodeChild)(results, 'community');
            return result?.attrs.jid;
        },
         





        communityRevokeInviteV4: async (communityJid, invitedJid) => {
            const result = await communityQuery(communityJid, 'set', [
                { tag: 'revoke', attrs: {}, content: [{ tag: 'participant', attrs: { jid: invitedJid } }] }
            ]);
            return !!result;
        },
         




        communityAcceptInviteV4: ev.createBufferedFunction(async (key, inviteMessage) => {
            key = typeof key === 'string' ? { remoteJid: key } : key;
            const results = await communityQuery(inviteMessage.groupJid, 'set', [
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
                    id: (0, index_js_3.generateMessageIDV2)(sock.user?.id),
                    fromMe: false,
                    participant: key.remoteJid  
                },
                messageStubType: index_js_2.WAMessageStubType.GROUP_PARTICIPANT_ADD,
                messageStubParameters: [JSON.stringify(authState.creds.me)],
                participant: key.remoteJid,
                messageTimestamp: (0, index_js_3.unixTimestampSeconds)()
            }, 'notify');
            return results.attrs.from;
        }),
        communityGetInviteInfo: async (code) => {
            const results = await communityQuery('@g.us', 'get', [{ tag: 'invite', attrs: { code } }]);
            return (0, exports.extractCommunityMetadata)(results);
        },
        communityToggleEphemeral: async (jid, ephemeralExpiration) => {
            const content = ephemeralExpiration
                ? { tag: 'ephemeral', attrs: { expiration: ephemeralExpiration.toString() } }
                : { tag: 'not_ephemeral', attrs: {} };
            await communityQuery(jid, 'set', [content]);
        },
        communitySettingUpdate: async (jid, setting) => {
            await communityQuery(jid, 'set', [{ tag: setting, attrs: {} }]);
        },
        communityMemberAddMode: async (jid, mode) => {
            await communityQuery(jid, 'set', [{ tag: 'member_add_mode', attrs: {}, content: mode }]);
        },
        communityJoinApprovalMode: async (jid, mode) => {
            await communityQuery(jid, 'set', [
                { tag: 'membership_approval_mode', attrs: {}, content: [{ tag: 'community_join', attrs: { state: mode } }] }
            ]);
        },
        communityFetchAllParticipating
    };
};
exports.makeCommunitiesSocket = makeCommunitiesSocket;
const extractCommunityMetadata = (result) => {
    const community = (0, index_js_4.getBinaryNodeChild)(result, 'community');
    const descChild = (0, index_js_4.getBinaryNodeChild)(community, 'description');
    let desc;
    let descId;
    if (descChild) {
        desc = (0, index_js_4.getBinaryNodeChildString)(descChild, 'body');
        descId = descChild.attrs.id;
    }
    const communityId = community.attrs.id?.includes('@')
        ? community.attrs.id
        : (0, index_js_4.jidEncode)(community.attrs.id || '', 'g.us');
    const eph = (0, index_js_4.getBinaryNodeChild)(community, 'ephemeral')?.attrs.expiration;
    const memberAddMode = (0, index_js_4.getBinaryNodeChildString)(community, 'member_add_mode') === 'all_member_add';
    const metadata = {
        id: communityId,
        subject: community.attrs.subject || '',
        subjectOwner: community.attrs.s_o,
        subjectTime: Number(community.attrs.s_t || 0),
        size: (0, index_js_4.getBinaryNodeChildren)(community, 'participant').length,
        creation: Number(community.attrs.creation || 0),
        owner: community.attrs.creator ? (0, index_js_4.jidNormalizedUser)(community.attrs.creator) : undefined,
        desc,
        descId,
        linkedParent: (0, index_js_4.getBinaryNodeChild)(community, 'linked_parent')?.attrs.jid || undefined,
        restrict: !!(0, index_js_4.getBinaryNodeChild)(community, 'locked'),
        announce: !!(0, index_js_4.getBinaryNodeChild)(community, 'announcement'),
        isCommunity: !!(0, index_js_4.getBinaryNodeChild)(community, 'parent'),
        isCommunityAnnounce: !!(0, index_js_4.getBinaryNodeChild)(community, 'default_sub_community'),
        joinApprovalMode: !!(0, index_js_4.getBinaryNodeChild)(community, 'membership_approval_mode'),
        memberAddMode,
        participants: (0, index_js_4.getBinaryNodeChildren)(community, 'participant').map(({ attrs }) => {
            return {
                 
                id: attrs.jid,
                admin: (attrs.type || null)
            };
        }),
        ephemeralDuration: eph ? +eph : undefined,
        addressingMode: (0, index_js_4.getBinaryNodeChildString)(community, 'addressing_mode')
    };
    return metadata;
};
exports.extractCommunityMetadata = extractCommunityMetadata;

return module.exports;
})();
for (const key of Object.keys(__kageModule132)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule132[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule132, configurable:true});
