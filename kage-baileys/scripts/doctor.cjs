'use strict';
const { spawnSync } = require('node:child_process');
async function main() {
    const pkg = require('../package.json');
    const api = require('../lib');
    const report = { package: pkg.name, version: pkg.version, node: process.version, platform: process.platform, arch: process.arch, checks: {}, scope: 'Diagnóstico local; no inicia sesión ni envía mensajes.' };
    const [major, minor] = process.versions.node.split('.').map(Number);
    report.checks.node = major > 22 || (major === 22 && minor >= 12);
    const lib = await api.getImageProcessingLibrary();
    report.imageBackend = lib.sharp ? (lib.sharp.default.versions.emscripten ? 'sharp-wasm' : 'sharp-native') : lib.image ? 'napi-rs-image' : 'jimp';
     
    const { Jimp } = require('jimp');
    const png = await new Jimp({ width: 32, height: 16, color: 0x2277ffff }).getBuffer('image/png');
    const thumb = await api.extractImageThumb(png, 8);
    const resized = await api.Toolkit.resize(png, 12, 12);
    const profile = await api.generateProfilePicture(png, { width: 24, height: 24 });
    report.checks.thumbnail = (await Jimp.read(thumb.buffer)).width === 8;
    report.checks.toolkit = (await Jimp.read(resized)).width === 12;
    report.checks.profile = (await Jimp.read(profile.img)).width === 24;
    const ffmpeg = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8', timeout: 10000 });
    report.ffmpeg = ffmpeg.status === 0 ? ffmpeg.stdout.split('\n')[0] : 'No disponible: instala ffmpeg para conversión de audio/vídeo.';
    report.ok = Object.values(report.checks).every(Boolean);
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exitCode = 1;
}
main().catch(error => { console.error(JSON.stringify({ ok: false, code: error.code, error: error.message }, null, 2)); process.exitCode = 1; });
