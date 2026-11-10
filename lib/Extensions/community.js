"use strict"
Object.defineProperty(exports, "__esModule", { value: true })
const { proto } = require("../../WAProto")
const { default: logger } = require("../Utils/logger")
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
const { makeBusinessSocket } = require("../Socket/business")
const extractCommunityMetadata = (result) => {
    const community = getBinaryNodeChild(result, 'group')
    const descChild = getBinaryNodeChild(community, 'description')
    
    let desc
    let descId
    
    if (descChild) {
        desc = getBinaryNodeChildString(descChild, 'body')
        descId = descChild.attrs.id
    }
    
    const mode = community.attrs.addressing_mode
    const communityId = community.attrs.id.includes('@') ? community.attrs.id : jidEncode(community.attrs.id, 'g.us')
    const eph = getBinaryNodeChild(community, 'ephemeral')?.attrs.expiration
    const memberAddMode = getBinaryNodeChildString(community, 'member_add_mode') === 'all_member_add'
    
    const metadata = {
        id: communityId,
        subject: community.attrs.subject,
        subjectOwner: community.attrs.s_o,
        subjectOwnerAlt: community.attrs?.s_o_pn ? community.attrs.s_o_pn : community.attrs.s_o, 
        subjectTime: Number(community.attrs.s_t || 0),
        size: Number(community.attrs?.size ? community.attrs.size : getBinaryNodeChildren(community, 'participant').length),
        creation: Number(community.attrs.creation || 0),
        owner: community.attrs.creator ? jidNormalizedUser(community.attrs.creator) : undefined,
        ownerAlt: community.attrs.creator ? jidNormalizedUser(community.attrs?.creator_pn ? community.attrs.creator_pn : community.attrs.creator) : undefined, 
        ownerCountry: community.attrs.creator_country_code, 
        desc,
        descId,
        linkedParent: getBinaryNodeChild(community, 'linked_parent')?.attrs.jid || undefined,
        restrict: !!getBinaryNodeChild(community, 'locked'),
        announce: !!getBinaryNodeChild(community, 'announcement'),
        isCommunity: !!getBinaryNodeChild(community, 'parent'),
        isCommunityAnnounce: !!getBinaryNodeChild(community, 'default_sub_group'),
        joinApprovalMode: !!getBinaryNodeChild(community, 'membership_approval_mode'),
        memberAddMode,
        participants: getBinaryNodeChildren(community, 'participant').map(({ attrs }) => {
            return {
                id: mode === WAMessageAddressingMode.LID ? community.phone_number : attrs.jid,
                lid: mode === WAMessageAddressingMode.LID ? community.jid : attrs.lid, 
                admin: (attrs.type || null),
            }
        }),
        ephemeralDuration: eph ? Number(eph) : undefined, 
        addressingMode: mode
    }
    
    return metadata
}

exports.attach = function(base, config) {
const suki = base
const { 
		authState, 
		ev, 
		query, 
		groupMetadata, 
		upsertMessage, 
		cleanDirtyBits
	} = suki
const communityQuery = (base["communityQuery"] !== undefined ? base["communityQuery"] : (async (jid, type, content) => (query({
        tag: 'iq',
        attrs: {
            type,
            xmlns: 'w:g2',
            to: jid,
        },
        content
    }))))
return {
communityQuery
};
};
