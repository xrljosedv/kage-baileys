'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { stripTypeScriptTypes } = require('node:module');
const files = [
    'Types/native-tools', 'WAUSync/USyncUser', 'WAUSync/Protocols/USyncUsernameProtocol',
    'WAUSync/USyncQuery', 'Utils/username', 'Utils/message-builder', 'Socket/usync'
];
if (typeof stripTypeScriptTypes !== 'function') {
    if (files.every(file => fs.existsSync(path.join(__dirname, '../lib', file + '.js')))) {
        console.log('Using distributed precompiled modules; regeneration requires Node >=22.13.0.');
        process.exit(0);
    }
    throw new Error('Regeneration requires Node >=22.13.0');
}
for (const file of files) {
    const stem = path.join(__dirname, '../lib', file);
    let code = stripTypeScriptTypes(fs.readFileSync(stem + '.ts', 'utf8'), { mode: 'strip' });
    const names = [...code.matchAll(/export (?:async )?(?:class|function|const) (\w+)/g)].map(match => match[1]);
    code = code.replace(/import\s*\{([^}]+)\}\s*from\s*(['"][^'"]+['"]);/g, 'const {$1} = require($2);')
        .replace(/export (?=(?:async )?(?:class|function|const) )/g, '')
        .replace(/export\s*\{\s*\};?/g, '');
    if (/^\s*(?:import|export) /m.test(code)) throw new Error('Unsupported module syntax in ' + file);
    fs.writeFileSync(stem + '.js', '"use strict";\n' + code + '\nObject.assign(exports, { ' + names.join(', ') + ' });\n');
}
console.log('Native TypeScript modules rebuilt without installing dependencies.');
