"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUrlInfo = void 0;
const messages_1 = require("./messages");
const messages_media_1 = require("./messages-media");
const THUMBNAIL_WIDTH_PX = 192;
/** Fetches an image and generates a thumbnail for it */
const getCompressedJpegThumbnail = async (url, { thumbnailWidth, fetchOpts }) => {
    const stream = await (0, messages_media_1.getHttpStream)(url, fetchOpts);
    const result = await (0, messages_media_1.extractImageThumb)(stream, thumbnailWidth);
    return result;
};
/**
 * Given a piece of text, checks for any URL present, generates link preview for the same and returns it
 * Return undefined if the fetch failed or no URL was found
 * @param text first matched URL in text
 * @returns the URL info required to generate link preview
 */
const getUrlInfo = async (text, opts = {
    thumbnailWidth: THUMBNAIL_WIDTH_PX,
    fetchOpts: { timeout: 3000 }
}) => {
    var _a;
    try {
        // retries
        let retries = 0;
        const maxRetry = 5;
        const { getLinkPreview } = await import('link-preview-js');
        let previewLink = text;
        if (!text.startsWith('https://') && !text.startsWith('http://')) {
            previewLink = 'https://' + previewLink;
        }
        const info = await getLinkPreview(previewLink, {
            ...opts.fetchOpts,
            followRedirects: 'follow',
            handleRedirects: (baseURL, forwardedURL) => {
                const urlObj = new URL(baseURL);
                const forwardedURLObj = new URL(forwardedURL);
                if (retries >= maxRetry) {
                    return false;
                }
                if (forwardedURLObj.hostname === urlObj.hostname
                    || forwardedURLObj.hostname === 'www.' + urlObj.hostname
                    || 'www.' + forwardedURLObj.hostname === urlObj.hostname) {
                    retries += 1;
                    return true;
                }
                else {
                    return false;
                }
            },
            headers: opts.fetchOpts?.headers
        });
        if (info && 'title' in info && info.title) {
            const [image] = info.images;
            const urlInfo = {
                'canonical-url': info.url,
                'matched-text': text,
                title: info.title,
                description: info.description,
                originalThumbnailUrl: image
            };
            if (opts.uploadImage) {
                const { imageMessage } = await (0, messages_1.prepareWAMessageMedia)({ image: { url: image } }, {
                    upload: opts.uploadImage,
                    mediaTypeOverride: 'thumbnail-link',
                    options: opts.fetchOpts
                });
                urlInfo.jpegThumbnail = (imageMessage === null || imageMessage === void 0 ? void 0 : imageMessage.jpegThumbnail)
                    ? Buffer.from(imageMessage.jpegThumbnail)
                    : undefined;
                urlInfo.highQualityThumbnail = imageMessage || undefined;
            }
            else {
                try {
                    urlInfo.jpegThumbnail = image
                        ? (await getCompressedJpegThumbnail(image, opts)).buffer
                        : undefined;
                }
                catch (error) {
                    (_a = opts.logger) === null || _a === void 0 ? void 0 : _a.debug({ err: error.stack, url: previewLink }, 'error in generating thumbnail');
                }
            }
            return urlInfo;
        }
    }
    catch (error) {
        if (!error.message.includes('receive a valid')) {
            throw error;
        }
    }
};
exports.getUrlInfo = getUrlInfo;

// Kage: compatibilidad de API.
const __kageModule68 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { unfurl } = require('unfurl.js')
const { prepareWAMessageMedia } = require("./messages")
const {
  getHttpStream, 
  extractImageThumb
} = require("./messages-media")
const THUMBNAIL_WIDTH_PX = 192

/** Fetches an image and generates a thumbnail for it */
const getCompressedJpegThumbnail = async (url, { thumbnailWidth, fetchOpts }) => {
    const stream = await getHttpStream(url, fetchOpts)
    const result = await extractImageThumb(stream, thumbnailWidth)
    return result
}

/**
 * Given a piece of text, checks for any URL present, generates link preview for the same and returns it
 * Return undefined if the fetch failed or no URL was found
 * @param text first matched URL in text
 * @returns the URL info required to generate link preview
 */
const getUrlInfo = async (text, opts = { thumbnailWidth: THUMBNAIL_WIDTH_PX, fetchOpts: { timeout: 3000 } }) => {
    try {
        let previewLink = text
        
        if (!text.startsWith('https://') && !text.startsWith('http://')) {
            previewLink = 'https://' + previewLink
        }
        
        const { open_graph: info } = await unfurl(previewLink, {
            ...opts.fetchOpts,
            oembed: false, 
            compress: true, 
            size: 0,
            follow: 50
        }) 
        
        if (info && 'title' in info && info.title) {
            const image = info.images?.[0]?.url
            const urlInfo = {
                'canonical-url': info.url,
                'matched-text': text,
                title: info.title,
                description: info.description,
                originalThumbnailUrl: image
            }
            
            if (opts.uploadImage) {
                const { imageMessage } = await prepareWAMessageMedia({ image: { url: image } }, {
                    upload: opts.uploadImage,
                    mediaTypeOverride: 'thumbnail-link',
                    options: opts.fetchOpts
                })
                
                urlInfo.jpegThumbnail = imageMessage?.jpegThumbnail ? Buffer.from(imageMessage.jpegThumbnail) : undefined
                urlInfo.highQualityThumbnail = imageMessage || undefined
            }
            else {
                try {
                    urlInfo.jpegThumbnail = image ? (await getCompressedJpegThumbnail(image, opts)).buffer : undefined
                }
                catch (error) {
                    opts.logger?.debug({ err: error.stack, url: previewLink }, 'error in generating thumbnail')
                }
            }
            return urlInfo
        }
    }
    catch (error) {
        if (!error.message.includes('receive a valid')) {
            throw error
        }
    }
}

module.exports = {
  getUrlInfo
}
return module.exports;
})();
for (const key of Object.keys(__kageModule68)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule68[key]});
}

// Kage: funciones avanzadas.
const __kageModule173 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUrlInfo = void 0;
const index_js_1 = require("../Addon/index.js");
const messages_js_1 = require("./messages.js");
const messages_media_js_1 = require("./messages-media.js");
const URL_PROTOCOL_REGEX = /^https?:\/\//;
const THUMBNAIL_WIDTH_PX = 192;
/** Fetches an image and generates a thumbnail for it */
const getCompressedJpegThumbnail = async (url, { thumbnailWidth, fetchOpts }) => {
    const stream = await (0, messages_media_js_1.getHttpStream)(url, fetchOpts);
    const result = await (0, messages_media_js_1.extractImageThumb)(stream, thumbnailWidth);
    return result;
};
/**
 * Given a piece of text, checks for any URL present, generates link preview for the same and returns it
 * Return undefined if the fetch failed or no URL was found
 * @param text first matched URL in text
 * @returns the URL info required to generate link preview
 */
const getUrlInfo = async (text, opts = {
    thumbnailWidth: THUMBNAIL_WIDTH_PX,
    fetchOpts: { timeout: 3000 }
}) => {
    try {
        const previewLink = URL_PROTOCOL_REGEX.test(text) ? text : 'https://' + text;
        const info = await (0, index_js_1.getLinkPreview)(previewLink, opts.fetchOpts.timeout);
        if (info?.title) {
            const urlInfo = {
                'canonical-url': info.url,
                'matched-text': text,
                title: info.title,
                description: info.description,
                originalThumbnailUrl: info.image,
                'preview-type': info.video ? 1 : 0
            };
            if (opts.uploadImage) {
                await Promise.all([
                    (async () => {
                        const { imageMessage } = await (0, messages_js_1.prepareWAMessageMedia)({ image: { url: info.image } }, {
                            upload: opts.uploadImage,
                            mediaTypeOverride: 'thumbnail-link',
                            options: opts.fetchOpts
                        });
                        urlInfo.jpegThumbnail = imageMessage?.jpegThumbnail ? Buffer.from(imageMessage.jpegThumbnail) : undefined;
                        urlInfo.highQualityThumbnail = imageMessage;
                    })(),
                    info.favicon
                        ? (async () => {
                            const { imageMessage } = await (0, messages_js_1.prepareWAMessageMedia)({ image: { url: info.favicon } }, {
                                upload: opts.uploadImage,
                                mediaTypeOverride: 'thumbnail-link',
                                options: opts.fetchOpts
                            });
                            urlInfo.favicon = imageMessage;
                        })()
                        : Promise.resolve()
                ]);
            }
            else {
                try {
                    urlInfo.jpegThumbnail = info.image ? (await getCompressedJpegThumbnail(info.image, opts)).buffer : undefined;
                }
                catch (error) {
                    opts.logger?.debug({ err: error.stack, url: previewLink }, 'error in generating thumbnail');
                }
            }
            return urlInfo;
        }
    }
    catch (error) {
        if (!error.message.includes('receive a valid')) {
            throw error;
        }
    }
};
exports.getUrlInfo = getUrlInfo;

return module.exports;
})();
for (const key of Object.keys(__kageModule173)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule173[key]});
}
Object.defineProperty(exports, Symbol.for('kage.advanced'), {value:__kageModule173, configurable:true});
