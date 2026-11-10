"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractNewsletterMetadata = exports.makeNewsletterSocket = void 0;
const Types_1 = require("../Types");
const Utils_1 = require("../Utils");
const WABinary_1 = require("../WABinary");
const groups_1 = require("./groups");
var QueryIds;
(function (QueryIds) {
    QueryIds["JOB_MUTATION"] = "7150902998257522";
    QueryIds["METADATA"] = "6620195908089573";
    QueryIds["UNFOLLOW"] = "7238632346214362";
    QueryIds["FOLLOW"] = "7871414976211147";
    QueryIds["UNMUTE"] = "7337137176362961";
    QueryIds["MUTE"] = "25151904754424642";
    QueryIds["CREATE"] = "6996806640408138";
    QueryIds["ADMIN_COUNT"] = "7130823597031706";
    QueryIds["CHANGE_OWNER"] = "7341777602580933";
    QueryIds["DELETE"] = "8316537688363079";
    QueryIds["DEMOTE"] = "6551828931592903";
})(QueryIds || (QueryIds = {}));
const makeNewsletterSocket = (config) => {
    const sock = (0, groups_1.makeGroupsSocket)(config);
    const { authState, signalRepository, query, generateMessageTag } = sock;
    const encoder = new TextEncoder();
    const newsletterQuery = async (jid, type, content) => (query({
        tag: 'iq',
        attrs: {
            id: generateMessageTag(),
            type,
            xmlns: 'newsletter',
            to: jid,
        },
        content
    }));
    const newsletterWMexQuery = async (jid, query_id, content) => (query({
        tag: 'iq',
        attrs: {
            id: generateMessageTag(),
            type: 'get',
            xmlns: 'w:mex',
            to: WABinary_1.S_WHATSAPP_NET,
        },
        content: [
            {
                tag: 'query',
                attrs: { query_id },
                content: encoder.encode(JSON.stringify({
                    variables: {
                        'newsletter_id': jid,
                        ...content
                    }
                }))
            }
        ]
    }));
    const parseFetchedUpdates = async (node, type) => {
        let child;
        if (type === 'messages')
            child = (0, WABinary_1.getBinaryNodeChild)(node, 'messages');
        else {
            const parent = (0, WABinary_1.getBinaryNodeChild)(node, 'message_updates');
            child = (0, WABinary_1.getBinaryNodeChild)(parent, 'messages');
        }
        return await Promise.all((0, WABinary_1.getAllBinaryNodeChildren)(child).map(async (messageNode) => {
            var _a, _b;
            messageNode.attrs.from = child === null || child === void 0 ? void 0 : child.attrs.jid;
            const views = parseInt(((_b = (_a = (0, WABinary_1.getBinaryNodeChild)(messageNode, 'views_count')) === null || _a === void 0 ? void 0 : _a.attrs) === null || _b === void 0 ? void 0 : _b.count) || '0');
            const reactionNode = (0, WABinary_1.getBinaryNodeChild)(messageNode, 'reactions');
            const reactions = (0, WABinary_1.getBinaryNodeChildren)(reactionNode, 'reaction')
                .map(({ attrs }) => ({ count: +attrs.count, code: attrs.code }));
            const data = {
                'server_id': messageNode.attrs.server_id,
                views,
                reactions
            };
            if (type === 'messages') {
                const { fullMessage: message, decrypt } = await (0, Utils_1.decryptMessageNode)(messageNode, authState.creds.me.id, authState.creds.me.lid || '', signalRepository, config.logger);
                await decrypt();
                data.message = message;
            }
            return data;
        }));
    };
    return {
        ...sock,
        subscribeNewsletterUpdates: async (jid) => {
            var _a;
            const result = await newsletterQuery(jid, 'set', [{ tag: 'live_updates', attrs: {}, content: [] }]);
            return (_a = (0, WABinary_1.getBinaryNodeChild)(result, 'live_updates')) === null || _a === void 0 ? void 0 : _a.attrs;
        },
        newsletterReactionMode: async (jid, mode) => {
            await newsletterWMexQuery(jid, QueryIds.JOB_MUTATION, {
                updates: { settings: { reaction_codes: { value: mode } } }
            });
        },
        newsletterUpdateDescription: async (jid, description) => {
            await newsletterWMexQuery(jid, QueryIds.JOB_MUTATION, {
                updates: { description: description || '', settings: null }
            });
        },
        newsletterUpdateName: async (jid, name) => {
            await newsletterWMexQuery(jid, QueryIds.JOB_MUTATION, {
                updates: { name, settings: null }
            });
        },
        newsletterUpdatePicture: async (jid, content) => {
            const { img } = await (0, Utils_1.generateProfilePicture)(content);
            await newsletterWMexQuery(jid, QueryIds.JOB_MUTATION, {
                updates: { picture: img.toString('base64'), settings: null }
            });
        },
        newsletterRemovePicture: async (jid) => {
            await newsletterWMexQuery(jid, QueryIds.JOB_MUTATION, {
                updates: { picture: '', settings: null }
            });
        },
        newsletterUnfollow: async (jid) => {
            await newsletterWMexQuery(jid, QueryIds.UNFOLLOW);
        },
        newsletterFollow: async (jid) => {
            await newsletterWMexQuery(jid, QueryIds.FOLLOW);
        },
        newsletterUnmute: async (jid) => {
            await newsletterWMexQuery(jid, QueryIds.UNMUTE);
        },
        newsletterMute: async (jid) => {
            await newsletterWMexQuery(jid, QueryIds.MUTE);
        },
        newsletterCreate: async (name, description, picture) => {
            await query({
                tag: 'iq',
                attrs: {
                    to: WABinary_1.S_WHATSAPP_NET,
                    xmlns: 'tos',
                    id: generateMessageTag(),
                    type: 'set'
                },
                content: [
                    {
                        tag: 'notice',
                        attrs: {
                            id: '20601218',
                            stage: '5'
                        },
                        content: []
                    }
                ]
            });
            const result = await newsletterWMexQuery(undefined, QueryIds.CREATE, {
                input: {
                    name,
                    description: description !== null && description !== void 0 ? description : null,
                    picture: picture ? (await (0, Utils_1.generateProfilePicture)(picture)).img.toString('base64') : null,
                    settings: null
                }
            });
            return (0, exports.extractNewsletterMetadata)(result, true);
        },
        newsletterMetadata: async (type, key, role) => {
            const result = await newsletterWMexQuery(undefined, QueryIds.METADATA, {
                input: {
                    key,
                    type: type.toUpperCase(),
                    view_role: role || 'GUEST'
                },
                fetch_viewer_metadata: true,
                fetch_full_image: true,
                fetch_creation_time: true
            });
            return (0, exports.extractNewsletterMetadata)(result);
        },
        newsletterAdminCount: async (jid) => {
            var _a, _b;
            const result = await newsletterWMexQuery(jid, QueryIds.ADMIN_COUNT);
            const buff = (_b = (_a = (0, WABinary_1.getBinaryNodeChild)(result, 'result')) === null || _a === void 0 ? void 0 : _a.content) === null || _b === void 0 ? void 0 : _b.toString();
            return JSON.parse(buff).data[Types_1.XWAPaths.ADMIN_COUNT].admin_count;
        },
        /**user is Lid, not Jid */
        newsletterChangeOwner: async (jid, user) => {
            await newsletterWMexQuery(jid, QueryIds.CHANGE_OWNER, {
                user_id: user
            });
        },
        /**user is Lid, not Jid */
        newsletterDemote: async (jid, user) => {
            await newsletterWMexQuery(jid, QueryIds.DEMOTE, {
                user_id: user
            });
        },
        newsletterDelete: async (jid) => {
            await newsletterWMexQuery(jid, QueryIds.DELETE);
        },
        /**if code wasn't passed, the reaction will be removed (if is reacted) */
        newsletterReactMessage: async (jid, server_id, code) => {
            await query({
                tag: 'message',
                attrs: { to: jid, ...(!code ? { edit: '7' } : {}), type: 'reaction', server_id, id: (0, Utils_1.generateMessageID)() },
                content: [{
                        tag: 'reaction',
                        attrs: code ? { code } : {}
                    }]
            });
        },
        newsletterFetchMessages: async (type, key, count, after) => {
            const afterStr = after === null || after === void 0 ? void 0 : after.toString();
            const result = await newsletterQuery(WABinary_1.S_WHATSAPP_NET, 'get', [
                {
                    tag: 'messages',
                    attrs: { type, ...(type === 'invite' ? { key } : { jid: key }), count: count.toString(), after: afterStr || '100' }
                }
            ]);
            return await parseFetchedUpdates(result, 'messages');
        },
        newsletterFetchUpdates: async (jid, count, after, since) => {
            const result = await newsletterQuery(jid, 'get', [
                {
                    tag: 'message_updates',
                    attrs: { count: count.toString(), after: (after === null || after === void 0 ? void 0 : after.toString()) || '100', since: (since === null || since === void 0 ? void 0 : since.toString()) || '0' }
                }
            ]);
            return await parseFetchedUpdates(result, 'updates');
        }
    };
};
exports.makeNewsletterSocket = makeNewsletterSocket;
const extractNewsletterMetadata = (node, isCreate) => {
    var _a, _b, _c, _d;
    const result = (_b = (_a = (0, WABinary_1.getBinaryNodeChild)(node, 'result')) === null || _a === void 0 ? void 0 : _a.content) === null || _b === void 0 ? void 0 : _b.toString();
    const metadataPath = JSON.parse(result).data[isCreate ? Types_1.XWAPaths.CREATE : Types_1.XWAPaths.NEWSLETTER];
    const metadata = {
        id: metadataPath.id,
        state: metadataPath.state.type,
        creation_time: +metadataPath.thread_metadata.creation_time,
        name: metadataPath.thread_metadata.name.text,
        nameTime: +metadataPath.thread_metadata.name.update_time,
        description: metadataPath.thread_metadata.description.text,
        descriptionTime: +metadataPath.thread_metadata.description.update_time,
        invite: metadataPath.thread_metadata.invite,
        handle: metadataPath.thread_metadata.handle,
        picture: ((_c = metadataPath.thread_metadata.picture) === null || _c === void 0 ? void 0 : _c.direct_path) || null,
        preview: ((_d = metadataPath.thread_metadata.preview) === null || _d === void 0 ? void 0 : _d.direct_path) || null,
        reaction_codes: metadataPath.thread_metadata.settings.reaction_codes.value,
        subscribers: +metadataPath.thread_metadata.subscribers_count,
        verification: metadataPath.thread_metadata.verification,
        viewer_metadata: metadataPath.viewer_metadata
    };
    return metadata;
};
exports.extractNewsletterMetadata = extractNewsletterMetadata;

// Kage: compatibilidad de API.
const __kageModule32 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const {
  QueryIds, 
  XWAPaths
} = require("../Types")
const { generateProfilePicture } = require("../Utils")
const { getBinaryNodeChild } = require("../WABinary")
const { makeGroupsSocket } = require("./groups")
const { executeWMexQuery: genericExecuteWMexQuery } = require("./mex") 

const parseNewsletterCreateResponse = (response) => {
    const { id, thread_metadata: thread, viewer_metadata: viewer } = response
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
            id: thread.picture.id,
            directPath: thread.picture.direct_path
        },
        mute_state: viewer.mute
    }
}

const parseNewsletterMetadata = (result) => {
    if (typeof result !== 'object' || result === null) {
        return null
    }
    
    if ('id' in result && typeof result.id === 'string') {
        return result
    }
    
    if ('result' in result && typeof result.result === 'object' && result.result !== null && 'id' in result.result) {
        return result.result
    }
    
    return null
}

const makeNewsletterSocket = (config) => {
    const suki = makeGroupsSocket(config)
    const { 
        query, 
        generateMessageTag 
    } = suki
    
    const executeWMexQuery = (variables, queryId, dataPath) => {
        return genericExecuteWMexQuery(variables, queryId, dataPath, query, generateMessageTag)
    }
    
    const newsletterUpdate = async (jid, updates) => {
        const variables = {
            newsletter_id: jid,
            updates: {
                ...updates,
                settings: null
            }
        }
        
        return executeWMexQuery(variables, QueryIds.UPDATE_METADATA, XWAPaths.UPDATE)
    }
    
    return {
        ...suki,
        executeWMexQuery, 
        newsletterCreate: async (name, description) => {
            const variables = {
                input: {
                    name,
                    description: description ?? null
                }
            }
            
            const rawResponse = await executeWMexQuery(variables, QueryIds.CREATE, XWAPaths.CREATE)
            
            return parseNewsletterCreateResponse(rawResponse)
        },
        newsletterUpdate,
        newsletterSubscribers: async (jid) => {
            return executeWMexQuery({ newsletter_id: jid }, QueryIds.SUBSCRIBERS, XWAPaths.SUBSCRIBERS)
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
            }
            
            const result = await executeWMexQuery(variables, QueryIds.METADATA, XWAPaths.METADATA)
            
            return parseNewsletterMetadata(result)
        },
        newsletterFollow: (jid) => {
            return executeWMexQuery({ newsletter_id: jid }, QueryIds.FOLLOW, XWAPaths.FOLLOW)
        },
        newsletterUnfollow: (jid) => {
            return executeWMexQuery({ newsletter_id: jid }, QueryIds.UNFOLLOW, XWAPaths.UNFOLLOW)
        },
        newsletterMute: (jid) => {
            return executeWMexQuery({ newsletter_id: jid }, QueryIds.MUTE, XWAPaths.MUTE_V2)
        },
        newsletterUnmute: (jid) => {
            return executeWMexQuery({ newsletter_id: jid }, QueryIds.UNMUTE, XWAPaths.UNMUTE_V2)
        },
        newsletterUpdateName: async (jid, name) => {
            return await newsletterUpdate(jid, { name })
        },
        newsletterUpdateDescription: async (jid, description) => {
            return await newsletterUpdate(jid, { description })
        },
        newsletterUpdatePicture: async (jid, content) => {
            const { img } = await generateProfilePicture(content)
            return await newsletterUpdate(jid, { picture: img.toString('base64') })
        },
        newsletterRemovePicture: async (jid) => {
            return await newsletterUpdate(jid, { picture: '' })
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
            })
        },
        newsletterFetchMessages: async (jid, count, since, after) => {
            const messageUpdateAttrs = {
                count: count.toString()
            }
            
            if (typeof since === 'number') {
                messageUpdateAttrs.since = since.toString()
            }
            
            if (after) {
                messageUpdateAttrs.after = after.toString()
            }
            
            const result = await query({
                tag: 'iq',
                attrs: {
                    id: generateMessageTag(),
                    type: 'get',
                    xmlns: 'newsletter',
                    to: jid
                },
                content: [
                    {
                        tag: 'message_updates',
                        attrs: messageUpdateAttrs
                    }
                ]
            })
            
            return result
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
            })
            
            const liveUpdatesNode = getBinaryNodeChild(result, 'live_updates')
            const duration = liveUpdatesNode?.attrs?.duration
            
            return duration ? { duration: duration } : null
        },
        newsletterAdminCount: async (jid) => {
            const response = await executeWMexQuery({ newsletter_id: jid }, QueryIds.ADMIN_COUNT, XWAPaths.ADMIN_COUNT)
            return response.admin_count
        },
        newsletterChangeOwner: async (jid, newOwnerJid) => {
            await executeWMexQuery({ newsletter_id: jid, user_id: newOwnerJid }, QueryIds.CHANGE_OWNER, XWAPaths.CHANGE_OWNER)
        },
        newsletterDemote: async (jid, userJid) => {
            await executeWMexQuery({ newsletter_id: jid, user_id: userJid }, QueryIds.DEMOTE, XWAPaths.DEMOTE)
        },
        newsletterDelete: async (jid) => {
            await executeWMexQuery({ newsletter_id: jid }, QueryIds.DELETE, XWAPaths.DELETE_V2)
        }
    }
}

module.exports = {
  makeNewsletterSocket, 
  parseNewsletterMetadata
}
return module.exports;
})();
for (const key of Object.keys(__kageModule32)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule32[key]});
}

// Kage: funciones avanzadas.
const __kageModule138 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeNewsletterSocket = void 0;
const index_js_1 = require("../../WAProto/index.js");
const index_js_2 = require("../Types/index.js");
const messages_media_js_1 = require("../Utils/messages-media.js");
const index_js_3 = require("../WABinary/index.js");
const groups_js_1 = require("./groups.js");
const mex_js_1 = require("./mex.js");
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
const makeNewsletterSocket = (config) => {
    const sock = (0, groups_js_1.makeGroupsSocket)(config);
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
        // Kage: actualización de compatibilidad.
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
            // WA Web: GetNewsletterMessages endpoint
            // Request: iq(to=s.whatsapp.net) -> messages(count, type, jid|key, [after|before])
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
            // Response: iq -> messages(jid="newsletter_jid") -> message[]
            const messagesNode = (0, index_js_3.getBinaryNodeChild)(result, 'messages');
            if (!messagesNode) {
                return [];
            }
            // The response messages node carries the newsletter JID
            const newsletterJid = messagesNode.attrs.jid || (type === 'jid' ? key : undefined);
            const messages = [];
            // WA Web: mapChildrenWithTag(messages, "message", 0, 300, ...)
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
exports.makeNewsletterSocket = makeNewsletterSocket;

return module.exports;
})();
for (const key of Object.keys(__kageModule138)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule138[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule138, configurable:true});
