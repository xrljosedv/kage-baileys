'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const sharp = require('sharp');
const api = require('../lib');
const root = path.resolve(__dirname, '..');
const fixture = () => sharp({ create: { width: 80, height: 40, channels: 4, background: '#ff0000' } }).png().toBuffer();
function child(source) {
    const result = spawnSync(process.execPath, ['-e', source], { cwd: root, encoding: 'utf8', timeout: 60000 });
    assert.equal(result.status, 0, result.stderr || result.stdout || result.error?.message);
    assert.doesNotMatch(result.stderr, /El módulo opcional sharp|Para procesar imágenes instale sharp/);
    return result.stdout;
}
test('package import has no sharp warning and does not load sharp eagerly', () => {
    child(`const assert=require('node:assert/strict'); require('./lib'); assert.equal(require.cache[require.resolve('sharp')], undefined);`);
});
test('sharp is installed as a real dependency, matching wasm version', () => {
    const p = require('../package.json');
    assert.equal(p.dependencies.sharp, '0.35.5');
    assert.equal(p.dependencies['@img/sharp-wasm32'], p.dependencies.sharp);
    assert.equal(p.peerDependencies.sharp, undefined);
});
for (const format of ['png', 'jpeg', 'webp']) {
    test('real ' + format + ' thumbnail decodes and retains original dimensions', async () => {
        const input = await sharp(await fixture())[format]().toBuffer();
        const out = await api.extractImageThumb(input, 20);
        assert.deepEqual(out.original, { width: 80, height: 40 });
        const meta = await sharp(out.buffer).metadata();
        assert.equal(meta.format, 'jpeg'); assert.equal(meta.width, 20); assert.equal(meta.height, 10);
    });
}
test('thumbnail accepts Readable and local file without mutating original', async () => {
    const png = await fixture(), copy = Buffer.from(png);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kage-image-'));
    try {
        const file = path.join(dir, 'input.png'); fs.writeFileSync(file, png);
        for (const input of [Readable.from([png]), file]) assert.equal((await api.extractImageThumb(input, 16)).original.width, 80);
        assert.deepEqual(png, copy);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('profile pictures decode with requested size', async () => {
    const out = await api.generateProfilePicture(await fixture(), { width: 96, height: 96 });
    const meta = await sharp(out.img).metadata();
    assert.equal(meta.width, 96); assert.equal(meta.height, 96); assert.equal(meta.format, 'jpeg');
});
for (const [fit, w, h] of [['cover',30,30],['contain',30,30],['fill',30,30],['inside',30,15],['outside',60,30]]) {
    test('Toolkit.resize supports ' + fit, async () => {
        const out = await api.Toolkit.resize(await fixture(), 30, 30, fit);
        const meta = await sharp(out).metadata();
        assert.equal(meta.format, 'png'); assert.equal(meta.width, w); assert.equal(meta.height, h);
    });
}
test('Toolkit rejects invalid geometry and corrupted input explicitly', async () => {
    const png = await fixture();
    for (const width of [0,-1,1.5,NaN,Infinity]) await assert.rejects(api.Toolkit.resize(png, width, 10), RangeError);
    await assert.rejects(api.Toolkit.resize(png, 10, 10, 'wrong'), RangeError);
    await assert.rejects(api.Toolkit.resize(Buffer.from('not an image'), 10, 10));
});
test('no native backends: Jimp resizes and public media functions work without warnings', () => {
    child(`const Module=require('node:module'),load=Module._load,assert=require('node:assert/strict');
    Module._load=function(id,...args){if(id==='sharp'||id==='@napi-rs/image')throw Object.assign(new Error('simulated missing native'),{code:'MODULE_NOT_FOUND'});return load.call(this,id,...args)};
    (async()=>{const api=require('./lib'),{Jimp}=require('jimp');
    const png=await new Jimp({width:80,height:40,color:0xff0000ff}).getBuffer('image/png');
    assert.ok((await api.getImageProcessingLibrary()).jimp);
    for(const [fit,w,h] of [['cover',30,30],['contain',30,30],['fill',30,30],['inside',30,15],['outside',60,30]]){
      const out=await Jimp.read(await api.Toolkit.resize(png,30,30,fit));assert.equal(out.width,w);assert.equal(out.height,h);
    }
    const thumb=await api.extractImageThumb(png,20);assert.equal((await Jimp.read(thumb.buffer)).width,20);
    const profile=await api.generateProfilePicture(png,{width:50,height:50});assert.equal((await Jimp.read(profile.img)).width,50);
    })().catch(e=>{console.error(e);process.exitCode=1});`);
});
test('sharp WebAssembly actually processes pixels when native binary is unavailable', () => {
    child(`const Module=require('node:module'),load=Module._load,assert=require('node:assert/strict');
    Module._load=function(id,...args){if(id.startsWith('@img/sharp-')&&id.endsWith('/sharp.node')&&!id.includes('wasm32'))throw new Error('simulate unsupported architecture');return load.call(this,id,...args)};
    (async()=>{const sharp=require('sharp');assert.ok(sharp.versions.emscripten);const png=await sharp({create:{width:20,height:10,channels:3,background:'red'}}).png().toBuffer();
    const api=require('./lib');const out=await api.Toolkit.resize(png,8,8);assert.equal((await sharp(out).metadata()).width,8);
    const thumb=await api.extractImageThumb(png,5);assert.equal((await sharp(thumb.buffer).metadata()).width,5);
    })().catch(e=>{console.error(e);process.exitCode=1});`);
});
test('all backends absent: import succeeds, image request has an actionable error', () => {
    child(`const Module=require('node:module'),load=Module._load,assert=require('node:assert/strict');
    Module._load=function(id,...args){if(['sharp','@napi-rs/image','jimp'].includes(id))throw new Error('simulated missing dependency');return load.call(this,id,...args)};
    const api=require('./lib');api.getImageProcessingLibrary().then(()=>{throw new Error('must fail')},e=>assert.equal(e.code,'KAGE_IMAGE_BACKEND_UNAVAILABLE')).catch(e=>{console.error(e);process.exitCode=1});`);
});
