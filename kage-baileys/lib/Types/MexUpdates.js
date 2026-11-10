"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const MexUpdatesOperations = {
  OWNER_COMMUNITY: "NotificationCommunityOwnerUpdate", 
  GROUP_MEMBER_LINK: "NotificationGroupMemberLinkPropertyUpdate", 
  GROUP_LIMIT_SHARING: "NotificationGroupLimitSharingPropertyUpdate"
}

const XWAPathsMexUpdates = {
  GROUP_SHARING_CHANGE: "xwa2_notify_group_on_prop_change", 
  COMMUNITY_OWNER_CHANGE: "xwa2_notify_group_on_participants_roles_change"
}

module.exports = {
  MexUpdatesOperations,
  XWAPathsMexUpdates
}
 
const __kageModule49 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const MexUpdatesOperations = {
  OWNER_COMMUNITY: "NotificationCommunityOwnerUpdate", 
  GROUP_MEMBER_LINK: "NotificationGroupMemberLinkPropertyUpdate", 
  GROUP_LIMIT_SHARING: "NotificationGroupLimitSharingPropertyUpdate"
}

const XWAPathsMexUpdates = {
  GROUP_SHARING_CHANGE: "xwa2_notify_group_on_prop_change", 
  COMMUNITY_OWNER_CHANGE: "xwa2_notify_group_on_participants_roles_change"
}

module.exports = {
  MexUpdatesOperations,
  XWAPathsMexUpdates
}
return module.exports;
})();
for (const key of Object.keys(__kageModule49)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule49[key]});
}
