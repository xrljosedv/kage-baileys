"use strict"
Object.defineProperty(exports, "__esModule", { value: true })
const {
  QueryIds, 
  XWAPaths
} = require("../Types")
const { generateProfilePicture } = require("../Utils")
const { getBinaryNodeChild } = require("../WABinary")
const { makeGroupsSocket } = require("../Socket/groups")
const { executeWMexQuery: genericExecuteWMexQuery } = require("../Socket/mex")
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

exports.attach = function(base, config) {
const suki = base
const { 
        query, 
        generateMessageTag 
    } = suki
const executeWMexQuery = (base["executeWMexQuery"] !== undefined ? base["executeWMexQuery"] : ((variables, queryId, dataPath) => {
        return genericExecuteWMexQuery(variables, queryId, dataPath, query, generateMessageTag)
    }))
const newsletterUpdate = (base["newsletterUpdate"] !== undefined ? base["newsletterUpdate"] : (async (jid, updates) => {
        const variables = {
            newsletter_id: jid,
            updates: {
                ...updates,
                settings: null
            }
        }
        
        return executeWMexQuery(variables, QueryIds.UPDATE_METADATA, XWAPaths.UPDATE)
    }))
return {
executeWMexQuery,
newsletterUpdate,
newsletterSubscribers: async (jid) => {
            return executeWMexQuery({ newsletter_id: jid }, QueryIds.SUBSCRIBERS, XWAPaths.SUBSCRIBERS)
        }
};
};
