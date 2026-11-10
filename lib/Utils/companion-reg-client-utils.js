"use strict";Object.defineProperty(exports, "__esModule", {value: true}); exports.CompanionWebClientType;
(function (CompanionWebClientType) {
    CompanionWebClientType[CompanionWebClientType["UNKNOWN"] = 0] = "UNKNOWN";
    CompanionWebClientType[CompanionWebClientType["CHROME"] = 1] = "CHROME";
    CompanionWebClientType[CompanionWebClientType["EDGE"] = 2] = "EDGE";
    CompanionWebClientType[CompanionWebClientType["FIREFOX"] = 3] = "FIREFOX";
    CompanionWebClientType[CompanionWebClientType["IE"] = 4] = "IE";
    CompanionWebClientType[CompanionWebClientType["OPERA"] = 5] = "OPERA";
    CompanionWebClientType[CompanionWebClientType["SAFARI"] = 6] = "SAFARI";
    CompanionWebClientType[CompanionWebClientType["ELECTRON"] = 7] = "ELECTRON";
    CompanionWebClientType[CompanionWebClientType["UWP"] = 8] = "UWP";
    CompanionWebClientType[CompanionWebClientType["OTHER_WEB_CLIENT"] = 9] = "OTHER_WEB_CLIENT";
})(exports.CompanionWebClientType || (exports.CompanionWebClientType = {}));
const BROWSER_TO_COMPANION_WEB_CLIENT = {
    Chrome: exports.CompanionWebClientType.CHROME,
    Edge: exports.CompanionWebClientType.EDGE,
    Firefox: exports.CompanionWebClientType.FIREFOX,
    IE: exports.CompanionWebClientType.IE,
    Opera: exports.CompanionWebClientType.OPERA,
    Safari: exports.CompanionWebClientType.SAFARI
};
 const getCompanionWebClientType = ([os, browserName]) => {
    if (browserName === 'Desktop') {
        return os === 'Windows' ? exports.CompanionWebClientType.UWP : exports.CompanionWebClientType.ELECTRON;
    }
    return BROWSER_TO_COMPANION_WEB_CLIENT[browserName] || exports.CompanionWebClientType.OTHER_WEB_CLIENT;
}; exports.getCompanionWebClientType = getCompanionWebClientType;
 const getCompanionPlatformId = (browser) => {
    return exports.getCompanionWebClientType.call(void 0, browser).toString();
}; exports.getCompanionPlatformId = getCompanionPlatformId;
 const buildPairingQRData = (ref, noiseKeyB64, identityKeyB64, advB64, browser) => {
    return ('https://wa.me/settings/linked_devices#' +
        [ref, noiseKeyB64, identityKeyB64, advB64, exports.getCompanionPlatformId.call(void 0, browser)].join(','));
}; exports.buildPairingQRData = buildPairingQRData;
//# 
// Kage: funciones avanzadas.
const __kageModule165 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPairingQRData = exports.getCompanionPlatformId = exports.getCompanionWebClientType = exports.CompanionWebClientType = void 0;
(function (CompanionWebClientType) {
    CompanionWebClientType[CompanionWebClientType["UNKNOWN"] = 0] = "UNKNOWN";
    CompanionWebClientType[CompanionWebClientType["CHROME"] = 1] = "CHROME";
    CompanionWebClientType[CompanionWebClientType["EDGE"] = 2] = "EDGE";
    CompanionWebClientType[CompanionWebClientType["FIREFOX"] = 3] = "FIREFOX";
    CompanionWebClientType[CompanionWebClientType["IE"] = 4] = "IE";
    CompanionWebClientType[CompanionWebClientType["OPERA"] = 5] = "OPERA";
    CompanionWebClientType[CompanionWebClientType["SAFARI"] = 6] = "SAFARI";
    CompanionWebClientType[CompanionWebClientType["ELECTRON"] = 7] = "ELECTRON";
    CompanionWebClientType[CompanionWebClientType["UWP"] = 8] = "UWP";
    CompanionWebClientType[CompanionWebClientType["OTHER_WEB_CLIENT"] = 9] = "OTHER_WEB_CLIENT";
})(exports.CompanionWebClientType || (exports.CompanionWebClientType = {}));
const BROWSER_TO_COMPANION_WEB_CLIENT = {
    Chrome: exports.CompanionWebClientType.CHROME,
    Edge: exports.CompanionWebClientType.EDGE,
    Firefox: exports.CompanionWebClientType.FIREFOX,
    IE: exports.CompanionWebClientType.IE,
    Opera: exports.CompanionWebClientType.OPERA,
    Safari: exports.CompanionWebClientType.SAFARI
};
const getCompanionWebClientType = ([os, browserName]) => {
    if (browserName === 'Desktop') {
        return os === 'Windows' ? exports.CompanionWebClientType.UWP : exports.CompanionWebClientType.ELECTRON;
    }
    return BROWSER_TO_COMPANION_WEB_CLIENT[browserName] || exports.CompanionWebClientType.OTHER_WEB_CLIENT;
};
exports.getCompanionWebClientType = getCompanionWebClientType;
const getCompanionPlatformId = (browser) => {
    return (0, exports.getCompanionWebClientType)(browser).toString();
};
exports.getCompanionPlatformId = getCompanionPlatformId;
const buildPairingQRData = (ref, noiseKeyB64, identityKeyB64, advB64, browser) => {
    return 'https://wa.me/settings/linked_devices#' + [
        ref,
        noiseKeyB64,
        identityKeyB64,
        advB64,
        (0, exports.getCompanionPlatformId)(browser)
    ].join(',');
};
exports.buildPairingQRData = buildPairingQRData;

return module.exports;
})();
for (const key of Object.keys(__kageModule165)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule165[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule165, configurable:true});
