"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachAdvanced = void 0;
const index_js_1 = require("../../WAProto/index.js");
const index_js_2 = require("../Types/index.js");
const messages_media_js_1 = require("../Utils/messages-media.js");
const index_js_3 = require("../WABinary/index.js");
const mex_js_1 = require("../Socket/mex.js");
const parseNewsletterCreateResponse = (response) => {
    const { id, thread_metadata: thread, viewer_metadata: viewer } = response;
    return {
        id: id,
        owner: undefined,
        name: thread.name.text,
        creation_time: parseInt(thread.creation_time, 10),
        description: thread.description.text,
        invite: thread.invite,
        subscribers: parseInt(thread.subscribers_count, 10),
        verification: thread.verification,
        picture: {
            id: thread.picture?.id,
            directPath: thread.picture?.direct_path
        },
        mute_state: viewer.mute
    };
};
const parseNewsletterMetadata = (result) => {
    if (typeof result !== 'object' || result === null) {
        return null;
    }
    if ('id' in result && typeof result.id === 'string') {
        return result;
    }
    if ('result' in result && typeof result.result === 'object' && result.result !== null && 'id' in result.result) {
        return result.result;
    }
    return null;
};
const attachAdvanced = (base, config) => {
    const sock = base;
    const { query, generateMessageTag } = sock;
    const executeWMexQuery = (variables, queryId, dataPath) => {
        return (0, mex_js_1.executeWMexQuery)(variables, queryId, dataPath, query, generateMessageTag);
    };
    const newsletterUpdate = async (jid, updates) => {
        const variables = {
            newsletter_id: jid,
            updates: {
                ...updates,
                settings: null
            }
        };
        return executeWMexQuery(variables, index_js_2.QueryIds.UPDATE_METADATA, 'xwa2_newsletter_update');
    };
    return {
        ...sock,
        executeWMexQuery,
        newsletterCreate: async (name, description) => {
            const variables = {
                input: {
                    name,
                    description: description ?? null
                }
            };
            const rawResponse = await executeWMexQuery(variables, index_js_2.QueryIds.CREATE, index_js_2.XWAPaths.xwa2_newsletter_create);
            return parseNewsletterCreateResponse(rawResponse);
        },
        newsletterUpdate,
        newsletterSubscribers: async (jid) => {
            return executeWMexQuery({ newsletter_id: jid }, index_js_2.QueryIds.SUBSCRIBERS, index_js_2.XWAPaths.xwa2_newsletter_subscribers);
        },
         
        newsletterSubscribed: async () => {
            return executeWMexQuery({}, index_js_2.QueryIds.SUBSCRIBED, index_js_2.XWAPaths.xwa2_newsletter_subscribed);
        },
        newsletterMetadata: async (type, key) => {
            const variables = {
                fetch_creation_time: true,
                fetch_full_image: true,
                fetch_viewer_metadata: true,
                input: {
                    key,
                    type: type.toUpperCase()
                }
            };
            const result = await executeWMexQuery(variables, index_js_2.QueryIds.METADATA, index_js_2.XWAPaths.xwa2_newsletter_metadata);
            return parseNewsletterMetadata(result);
        },
        newsletterFollow: (jid) => {
            return executeWMexQuery({ newsletter_id: jid }, index_js_2.QueryIds.FOLLOW, index_js_2.XWAPaths.xwa2_newsletter_join_v2);
        },
        newsletterUnfollow: (jid) => {
            return executeWMexQuery({ newsletter_id: jid }, index_js_2.QueryIds.UNFOLLOW, index_js_2.XWAPaths.xwa2_newsletter_leave_v2);
        },
        newsletterMute: (jid) => {
            return executeWMexQuery({ newsletter_id: jid }, index_js_2.QueryIds.MUTE, index_js_2.XWAPaths.xwa2_newsletter_mute_v2);
        },
        newsletterUnmute: (jid) => {
            return executeWMexQuery({ newsletter_id: jid }, index_js_2.QueryIds.UNMUTE, index_js_2.XWAPaths.xwa2_newsletter_unmute_v2);
        },
        newsletterUpdateName: async (jid, name) => {
            return await newsletterUpdate(jid, { name });
        },
        newsletterUpdateDescription: async (jid, description) => {
            return await newsletterUpdate(jid, { description });
        },
        newsletterUpdatePicture: async (jid, content) => {
            const { img } = await (0, messages_media_js_1.generateProfilePicture)(content);
            return await newsletterUpdate(jid, { picture: img.toString('base64') });
        },
        newsletterRemovePicture: async (jid) => {
            return await newsletterUpdate(jid, { picture: '' });
        },
        newsletterReactMessage: async (jid, serverId, reaction) => {
            await query({
                tag: 'message',
                attrs: {
                    to: jid,
                    ...(reaction ? {} : { edit: '7' }),
                    type: 'reaction',
                    server_id: serverId,
                    id: generateMessageTag()
                },
                content: [
                    {
                        tag: 'reaction',
                        attrs: reaction ? { code: reaction } : {}
                    }
                ]
            });
        },
        newsletterFetchMessages: async (type, key, count, after, before) => {
             
             
            const messagesAttrs = {
                count: count.toString(),
                type,
                [type === 'jid' ? 'jid' : 'key']: key
            };
            if (after) {
                messagesAttrs.after = after.toString();
            }
            if (before) {
                messagesAttrs.before = before.toString();
            }
            const result = await query({
                tag: 'iq',
                attrs: {
                    id: generateMessageTag(),
                    type: 'get',
                    xmlns: 'newsletter',
                    to: index_js_3.S_WHATSAPP_NET
                },
                content: [
                    {
                        tag: 'messages',
                        attrs: messagesAttrs
                    }
                ]
            });
             
            const messagesNode = (0, index_js_3.getBinaryNodeChild)(result, 'messages');
            if (!messagesNode) {
                return [];
            }
             
            const newsletterJid = messagesNode.attrs.jid || (type === 'jid' ? key : undefined);
            const messages = [];
             
            for (const child of (0, index_js_3.getBinaryNodeChildren)(messagesNode, 'message')) {
                const plaintextNode = (0, index_js_3.getBinaryNodeChild)(child, 'plaintext');
                if (!plaintextNode?.content) {
                    continue;
                }
                try {
                    const contentBuf = typeof plaintextNode.content === 'string'
                        ? Buffer.from(plaintextNode.content, 'binary')
                        : Buffer.from(plaintextNode.content);
                    const messageProto = index_js_1.proto.Message.decode(contentBuf).toJSON();
                    const fullMessage = index_js_1.proto.WebMessageInfo.fromObject({
                        key: {
                            remoteJid: newsletterJid,
                            id: child.attrs.id || child.attrs.server_id,
                            server_id: child.attrs.server_id,
                            fromMe: false
                        },
                        message: messageProto,
                        messageTimestamp: child.attrs.t ? +child.attrs.t : undefined
                    }).toJSON();
                    messages.push(fullMessage);
                }
                catch (error) {
                    logger.error({ error }, 'Failed to decode newsletter message');
                }
            }
            return messages;
        },
        subscribeNewsletterUpdates: async (jid) => {
            const result = await query({
                tag: 'iq',
                attrs: {
                    id: generateMessageTag(),
                    type: 'set',
                    xmlns: 'newsletter',
                    to: jid
                },
                content: [{ tag: 'live_updates', attrs: {}, content: [] }]
            });
            const liveUpdatesNode = (0, index_js_3.getBinaryNodeChild)(result, 'live_updates');
            const duration = liveUpdatesNode?.attrs?.duration;
            return duration ? { duration: duration } : null;
        },
        newsletterAdminCount: async (jid) => {
            const response = await executeWMexQuery({ newsletter_id: jid }, index_js_2.QueryIds.ADMIN_COUNT, index_js_2.XWAPaths.xwa2_newsletter_admin_count);
            return response.admin_count;
        },
        newsletterChangeOwner: async (jid, newOwnerJid) => {
            await executeWMexQuery({ newsletter_id: jid, user_id: newOwnerJid }, index_js_2.QueryIds.CHANGE_OWNER, index_js_2.XWAPaths.xwa2_newsletter_change_owner);
        },
        newsletterDemote: async (jid, userJid) => {
            await executeWMexQuery({ newsletter_id: jid, user_id: userJid }, index_js_2.QueryIds.DEMOTE, index_js_2.XWAPaths.xwa2_newsletter_demote);
        },
        newsletterDelete: async (jid) => {
            await executeWMexQuery({ newsletter_id: jid }, index_js_2.QueryIds.DELETE, index_js_2.XWAPaths.xwa2_newsletter_delete_v2);
        }
    };
};
exports.attachAdvanced = attachAdvanced;
