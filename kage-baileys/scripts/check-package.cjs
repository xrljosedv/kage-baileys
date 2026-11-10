'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const pkg = require('../package.json');
const failures = [];
const entries = new Map();
function scan(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        const file = path.join(dir, entry.name);
        const relative = path.relative(root, file).replaceAll(path.sep, '/');
        const key = relative.toLowerCase();
        if (entries.has(key)) failures.push('Colisión de mayúsculas: ' + entries.get(key) + ' / ' + relative);
        entries.set(key, relative);
        if (entry.isDirectory()) scan(file);
    }
}
scan(root);
for (const entry of [pkg.main, pkg.types, pkg.exports['.'].import, 'WAProto/index.js', 'WAProto/index.d.ts', 'WAProto/WAProto.proto', 'licenses/upstream-MIT.txt', 'tsconfig.json']) {
    if (!entry || !fs.existsSync(path.resolve(root, entry))) failures.push('Falta un archivo distribuido: ' + entry);
}
for (const item of require('../maintenance/api-coverage.json')) {
    try {
        const mod = require(path.join(root, item.archivo));
        for (const name of item.exportaciones) if (!(name in mod)) failures.push('Exportación ausente: ' + item.archivo + ':' + name);
    } catch (error) { failures.push(item.archivo + ': ' + error.message); }
}
const protocols = path.join(root, 'lib/WAUSync/Protocols');
for (const name of ['USyncLIDProtocol', 'USyncBotProfileProtocol']) {
    try { createRequire(path.join(root, pkg.main)).resolve(path.join(protocols, name)); }
    catch (error) { failures.push(name + ': ' + error.message); }
}
if (failures.length) {
    console.error(failures.join('\n'));
    process.exitCode = 1;
} else {
    console.log('PACKAGE_OK: ' + pkg.name + '@' + pkg.version + '; sin colisiones; entradas CJS/ESM/tipos/protocolo presentes; API verificada.');
}
