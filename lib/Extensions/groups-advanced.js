"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractGroupMetadata = exports.attachAdvanced = void 0;
const index_js_1 = require("../../WAProto/index.js");
const index_js_2 = require("../Addon/index.js");
const index_js_3 = require("../Types/index.js");
const index_js_4 = require("../Utils/index.js");
const index_js_5 = require("../WABinary/index.js");
const attachAdvanced = (base, config) => {
    const sock = base;
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
        // TODO: properly parse LID / PN DATA
        sock.ev.emit('groups.update', Object.values(data));
        return data;
    };
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
        /**
         * revoke a v4 invite for someone
         * @param groupJid group jid
         * @param invitedJid jid of person you invited
         * @returns true if successful
         */
        groupRevokeInviteV4: async (groupJid, invitedJid) => {
            const result = await groupQuery(groupJid, 'set', [
                { tag: 'revoke', attrs: {}, content: [{ tag: 'participant', attrs: { jid: invitedJid } }] }
            ]);
            return !!result;
        },
        /**
         * accept a GroupInviteMessage
         * @param key the key of the invite message, or optionally only provide the jid of the person who sent the invite
         * @param inviteMessage the message to accept
         */
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
            // if we have the full message key
            // update the invite message to be expired
            if (key.id) {
                // create new invite message that is expired
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
            // generate the group add message
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
exports.attachAdvanced = attachAdvanced;
const extractGroupMetadata = (result) => {
    const group = (0, index_js_5.getBinaryNodeChild)(result, 'group');
    if (!group) {
        // Mirror WAWeb: surface server/client errors with their code+text instead of crashing.
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
            // TODO: Store LID MAPPINGS
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
