"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XWAPaths = exports.MexOperations = void 0;
var MexOperations;
(function (MexOperations) {
    MexOperations["PROMOTE"] = "NotificationNewsletterAdminPromote";
    MexOperations["DEMOTE"] = "NotificationNewsletterAdminDemote";
    MexOperations["UPDATE"] = "NotificationNewsletterUpdate";
})(MexOperations || (exports.MexOperations = MexOperations = {}));
var XWAPaths;
(function (XWAPaths) {
    XWAPaths["PROMOTE"] = "xwa2_notify_newsletter_admin_promote";
    XWAPaths["DEMOTE"] = "xwa2_notify_newsletter_admin_demote";
    XWAPaths["ADMIN_COUNT"] = "xwa2_newsletter_admin";
    XWAPaths["CREATE"] = "xwa2_newsletter_create";
    XWAPaths["NEWSLETTER"] = "xwa2_newsletter";
    XWAPaths["METADATA_UPDATE"] = "xwa2_notify_newsletter_on_metadata_update";
})(XWAPaths || (exports.XWAPaths = XWAPaths = {}));

 
const __kageModule50 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })


const XWAPaths = {
    CREATE: 'xwa2_newsletter_create',
    SUBSCRIBERS: 'xwa2_newsletter_subscribers',
    VIEW: 'xwa2_newsletter_view',
    METADATA: 'xwa2_newsletter',
    UPDATE: 'xwa2_newsletter_update', 
    ADMIN_COUNT: 'xwa2_newsletter_admin',
    MUTE_V2: 'xwa2_newsletter_mute_v2',
    UNMUTE_V2: 'xwa2_newsletter_unmute_v2',
    FOLLOW: 'xwa2_newsletter_follow',
    UNFOLLOW: 'xwa2_newsletter_unfollow',
    CHANGE_OWNER: 'xwa2_newsletter_change_owner',
    DEMOTE: 'xwa2_newsletter_demote',
    DELETE_V2: 'xwa2_newsletter_delete_v2'
}

const QueryIds = {
    CREATE: '8823471724422422',
    UPDATE_METADATA: '24250201037901610',
    METADATA: '6563316087068696',
    SUBSCRIBERS: '9783111038412085',
    FOLLOW: '7871414976211147',
    UNFOLLOW: '7238632346214362',
    MUTE: '29766401636284406',
    UNMUTE: '9864994326891137',
    ADMIN_COUNT: '7130823597031706',
    CHANGE_OWNER: '7341777602580933',
    DEMOTE: '6551828931592903',
    DELETE: '30062808666639665'
}

 





module.exports = {
   
  XWAPaths,
  QueryIds
}
return module.exports;
})();
for (const key of Object.keys(__kageModule50)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule50[key]});
}
