'use strict';
 
let selected;
let sharpChecked = false;
let sharpBackend;
let sharpError;
function loadSharp() {
    if (!sharpChecked) {
        sharpChecked = true;
        try {
            const mod = require('sharp');
            sharpBackend = typeof mod === 'function' ? mod : mod.default;
            if (typeof sharpBackend !== 'function') throw new TypeError('Invalid sharp export');
        } catch (error) {
            sharpBackend = undefined;
            sharpError = error;
        }
    }
    return sharpBackend;
}
async function getImageProcessingLibrary() {
    if (selected) return selected;
    const sharp = loadSharp();
    if (sharp) return (selected = { sharp: { default: sharp } });
    try {
        const mod = require('@napi-rs/image');
        const image = mod.Transformer ? mod : mod.default;
        if (typeof image?.Transformer === 'function') return (selected = { image });
    } catch {   }
    try {
        const jimp = require('jimp');
        if (typeof jimp.Jimp?.read === 'function') return (selected = { jimp });
    } catch {   }
    const error = new Error('No hay un motor de imágenes disponible. Ejecuta npm install --include=optional y npm run doctor.', { cause: sharpError });
    error.code = 'KAGE_IMAGE_BACKEND_UNAVAILABLE';
    throw error;
}
function dimension(value, name) {
    if (value == null) return undefined;
    if (!Number.isSafeInteger(value) || value <= 0) throw new RangeError(`${name} debe ser un entero positivo`);
    return value;
}
async function resizeImage(input, width, height, fit = 'cover') {
    width = dimension(width, 'width');
    height = dimension(height, 'height');
    if (!width && !height) throw new RangeError('Indica width o height');
    if (!['cover', 'contain', 'fill', 'inside', 'outside'].includes(fit)) throw new RangeError('Modo fit no admitido: ' + fit);
    const sharp = loadSharp();
    if (sharp) {
        return sharp(input).resize(width, height, { fit, position: 'center', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    }
     
    const { Jimp } = require('jimp');
    const image = await Jimp.read(input);
    const sourceW = image.bitmap.width, sourceH = image.bitmap.height;
    if (!width || !height) {
        image.resize(width ? { w: width } : { h: height });
    } else if (fit === 'fill') {
        image.resize({ w: width, h: height });
    } else if (fit === 'cover') {
        image.cover({ w: width, h: height });
    } else if (fit === 'contain') {
        image.contain({ w: width, h: height });
    } else {
        const ratio = (fit === 'inside' ? Math.min : Math.max)(width / sourceW, height / sourceH);
        image.resize({ w: Math.max(1, Math.round(sourceW * ratio)), h: Math.max(1, Math.round(sourceH * ratio)) });
    }
    return image.getBuffer('image/png');
}
async function imageInput(input) {
    if (Buffer.isBuffer(input)) return input;
    if (typeof input === 'string' && !/^https?:\/\//i.test(input)) return require('node:fs/promises').readFile(input);
    if (typeof input === 'string') input = { url: input };
    const stream = input instanceof require('node:stream').Readable ? input : (await require('./messages-media').getStream(input)).stream;
    const chunks = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
}
async function extractImageThumb(input, width = 32, quality = 50) {
    dimension(width, 'width');
    if (!Number.isInteger(quality) || quality < 1 || quality > 100) throw new RangeError('quality debe estar entre 1 y 100');
    const buffer = await imageInput(input);
    const lib = await getImageProcessingLibrary();
    if (lib.sharp) {
        const img = lib.sharp.default(buffer);
        const meta = await img.metadata();
        return { buffer: await img.resize(width).jpeg({ quality }).toBuffer(), original: { width: meta.width, height: meta.height } };
    }
    if (lib.image) {
        const img = new lib.image.Transformer(buffer);
        const meta = await img.metadata();
        return { buffer: await img.resize(width, undefined, 0).jpeg(quality), original: { width: meta.width, height: meta.height } };
    }
    const img = await lib.jimp.Jimp.read(buffer);
    const original = { width: img.width, height: img.height };
    return { buffer: await img.resize({ w: width }).getBuffer('image/jpeg', { quality }), original };
}
async function generateProfilePicture(input, dimensions) {
     
    const width = dimension(dimensions?.width ?? 640, 'width');
    const height = dimension(dimensions?.height ?? 640, 'height');
    const buffer = await imageInput(input);
    const lib = await getImageProcessingLibrary();
    if (lib.sharp) return { img: await lib.sharp.default(buffer).resize(width, height, { fit: 'cover', position: 'center' }).jpeg({ quality: 100 }).toBuffer() };
    if (lib.image) return { img: await new lib.image.Transformer(buffer).resize(width, height, 0).jpeg(100) };
    const img = await lib.jimp.Jimp.read(buffer);
    return { img: await img.cover({ w: width, h: height }).getBuffer('image/jpeg', { quality: 100 }) };
}
module.exports = { loadSharp, getImageProcessingLibrary, resizeImage, extractImageThumb, generateProfilePicture };
