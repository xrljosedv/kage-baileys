'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
let checked = 0;
function scan(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) scan(file);
        else if (/\.(?:js|cjs|mjs)$/.test(file)) {
            const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
            if (result.status !== 0) { console.error(result.stderr); process.exit(1); }
            checked++;
        }
    }
}
for (const dir of ['lib', 'WAProto', 'scripts', 'test', 'Example']) if (fs.existsSync(path.join(root, dir))) scan(path.join(root, dir));
console.log(`SYNTAX_OK: ${checked} JavaScript files`);
