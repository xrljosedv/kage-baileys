"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlatformId = exports.Browsers = void 0;

const os = require("os");
const { proto } = require("../../WAProto/index.js"); 

const PLATFORM_MAP = {
    'aix': 'AIX',
    'darwin': 'Mac OS',
    'win32': 'Windows',
    'android': 'Android',
    'freebsd': 'FreeBSD',
    'openbsd': 'OpenBSD',
    'sunos': 'Solaris',
    'linux': undefined,  // Default ke Ubuntu untuk Linux
    'haiku': undefined,
    'cygwin': undefined,
    'netbsd': undefined
};

// Fixed: Browsers sekarang fungsi yang return array [platform, browser, version]
// Ini kompatibel dengan pemanggilan Browsers('Chrome') di Defaults/index.js
exports.Browsers = (browser = 'Chrome') => {
    const osName = PLATFORM_MAP[os.platform()] || 'Ubuntu';  // Default Ubuntu kalau undefined
    const osRelease = os.release();  // Ambil versi OS real-time
    return [osName, browser, osRelease];
};

const getPlatformId = (browser) => {
    const platformType = proto.DeviceProps.PlatformType[String(browser || 'CHROME').toUpperCase()];
    return platformType != null ? platformType.toString() : '1'; // Default Chrome
};

exports.getPlatformId = getPlatformId;
Object.assign(exports.Browsers, {
    macOS: browser => ['Mac OS', browser || 'Desktop', '14.0.0'],
    windows: browser => ['Windows', browser || 'Desktop', '10.0.0'],
    ubuntu: browser => ['Ubuntu', browser || 'Chrome', '22.04.0'],
    appropriate: browser => exports.Browsers(browser || 'Chrome')
});

// Kage: compatibilidad de API.
const __kageModule59 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { 
  platform, 
  release 
} = require("os") 
const { proto } = require("../../WAProto")

const PLATFORM_MAP = {
    aix: 'AIX',
    darwin: 'Mac OS',
    win32: 'Windows',
    android: 'Android',
    freebsd: 'FreeBSD',
    openbsd: 'OpenBSD',
    sunos: 'Solaris',
    linux: undefined,
    haiku: undefined,
    cygwin: undefined,
    netbsd: undefined
}

const Browsers = {
    ubuntu: browser => ['Ubuntu', browser, '22.04.4'],
    macOS: browser => ['Mac OS', browser, '14.4.1'],
    baileys: browser => ['Baileys', browser, '6.5.0'],
    windows: browser => ['Windows', browser, '10.0.22631'],
    //android: browser => [browser, 'Android', ''],
    /** The appropriate browser based on your OS & release */
    appropriate: browser => [PLATFORM_MAP[platform()] || 'Ubuntu', browser, release()]
}

const getPlatformId = (browser) => {
    const platformType = proto.DeviceProps.PlatformType[browser.toUpperCase()]
    return platformType ? platformType.toString() : '1' //chrome
}

module.exports = {
  Browsers, 
  getPlatformId
}
return module.exports;
})();
for (const key of Object.keys(__kageModule59)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule59[key]});
}

// Kage: funciones avanzadas.
const __kageModule162 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlatformId = exports.Browsers = void 0;
const node_os_1 = require("node:os");
const index_js_1 = require("../../WAProto/index.js");
const PLATFORM_MAP = {
    aix: 'AIX',
    darwin: 'Mac OS',
    win32: 'Windows',
    android: 'Android',
    freebsd: 'FreeBSD',
    openbsd: 'OpenBSD',
    sunos: 'Solaris',
    linux: undefined,
    haiku: undefined,
    cygwin: undefined,
    netbsd: undefined
};
exports.Browsers = {
    ubuntu: browser => ['Ubuntu', browser, '22.04.4'],
    macOS: browser => ['Mac OS', browser, '14.4.1'],
    baileys: browser => ['Baileys', browser, '6.5.0'],
    windows: browser => ['Windows', browser, '10.0.22631'],
    android: browser => [browser, 'Android', ''],
    /** The appropriate browser based on your OS & release */
    appropriate: browser => [PLATFORM_MAP[(0, node_os_1.platform)()] || 'Ubuntu', browser, (0, node_os_1.release)()]
};
const getPlatformId = (browser) => {
    const platformType = index_js_1.proto.DeviceProps.PlatformType[browser.toUpperCase()];
    return platformType ? platformType.toString() : '1'; //chrome
};
exports.getPlatformId = getPlatformId;

return module.exports;
})();
for (const key of Object.keys(__kageModule162)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule162[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule162, configurable:true});
