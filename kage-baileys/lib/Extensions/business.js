"use strict"
Object.defineProperty(exports, "__esModule", { value: true })
const {
  toProductNode, 
  parseCatalogNode, 
  parseCollectionsNode, 
  parseOrderDetailsNode, 
  getRawMediaUploadData, 
  uploadingNecessaryImagesOfProduct
} = require("../Utils")
const {
  S_WHATSAPP_NET, 
  jidNormalizedUser, 
  getBinaryNodeChild
} = require("../WABinary")
const { makeMessagesRecvSocket } = require("../Socket/messages-recv")

exports.attach = function(base, config) {
const suki = base
const { 
        authState, 
        query, 
        waUploadToServer 
    } = suki
const updateBussinesProfile = (base["updateBussinesProfile"] !== undefined ? base["updateBussinesProfile"] : (async (args) => {
        const node = []
        const simpleFields = ['address', 'email', 'description']
        
        node.push(...simpleFields
            .filter(key => args[key])
            .map(key => ({
            tag: key,
            attrs: {},
            content: args[key]
        })))
        
        if (args.websites) {
        	
            node.push(...args.websites.map(website => ({
                tag: 'website',
                attrs: {},
                content: website
            })))
        }
        
        if (args.hours) {
        	
            node.push({
                tag: 'business_hours',
                attrs: { timezone: args.hours.timezone },
                content: args.hours.days.map(config => {
                    const base = {
                        tag: 'business_hours_config',
                        attrs: { day_of_week: config.day, mode: config.mode }
                    }
                    
                    if (config.mode === 'specific_hours') {
                        return {
                            ...base,
                            attrs: {
                                ...base.attrs,
                                open_time: config.openTimeInMinutes,
                                close_time: config.closeTimeInMinutes
                            }
                        }
                    }
                    
                    return base
                })
            })
        }
        
        const result = await query({
            tag: 'iq',
            attrs: {
                to: S_WHATSAPP_NET,
                type: 'set',
                xmlns: 'w:biz'
            },
            content: [
                {
                    tag: 'business_profile',
                    attrs: {
                        v: '3',
                        mutation_type: 'delta'
                    },
                    content: node
                }
            ]
        })
        
        return result
    }))
const updateCoverPhoto = (base["updateCoverPhoto"] !== undefined ? base["updateCoverPhoto"] : (async (photo) => {
        const { fileSha256, filePath } = await getRawMediaUploadData(photo, 'biz-cover-photo')
        const fileSha256B64 = fileSha256.toString('base64')
        
        const { meta_hmac, fbid, ts } = await waUploadToServer(filePath, {
            fileEncSha256B64: fileSha256B64,
            mediaType: 'biz-cover-photo'
        })
        
        await query({
            tag: 'iq',
            attrs: {
                to: S_WHATSAPP_NET,
                type: 'set',
                xmlns: 'w:biz'
            },
            content: [
                {
                    tag: 'business_profile',
                    attrs: {
                        v: '3',
                        mutation_type: 'delta'
                    },
                    content: [
                        {
                            tag: 'cover_photo',
                            attrs: { id: String(fbid), op: 'update', token: meta_hmac, ts: String(ts) }
                        }
                    ]
                }
            ]
        })
        
        return fbid
    }))
const removeCoverPhoto = (base["removeCoverPhoto"] !== undefined ? base["removeCoverPhoto"] : (async (id) => {
        return await query({
            tag: 'iq',
            attrs: {
                to: S_WHATSAPP_NET,
                type: 'set',
                xmlns: 'w:biz'
            },
            content: [
                {
                    tag: 'business_profile',
                    attrs: {
                        v: '3',
                        mutation_type: 'delta'
                    },
                    content: [
                        {
                            tag: 'cover_photo',
                            attrs: { op: 'delete', id }
                        }
                    ]
                }
            ]
        })
    }))
return {
updateBussinesProfile,
updateCoverPhoto,
removeCoverPhoto
};
};
