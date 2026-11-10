'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const pbjs = require('protobufjs-cli/pbjs');
const pbts = require('protobufjs-cli/pbts');
const js = path.join(root, 'WAProto/index.js');
const dts = path.join(root, 'WAProto/index.d.ts');
pbjs.main(['-t', 'static-module', '-w', 'commonjs', '--keep-case', '-o', js, path.join(root, 'WAProto/WAProto.proto')], (error) => {
    if (error) throw error;
     
    let source = fs.readFileSync(js, 'utf8');
     
     
     
    const kageBase64Fix = fs.readFileSync(path.join(__dirname, 'kage-base64-fix.cjs'), 'utf8');
    source = source.replace('var $protobuf = require("protobufjs/minimal");', 'var $protobuf = require("protobufjs/minimal");\n\n' + kageBase64Fix.trim());
    source = source.replace(/\$util\.Long\.prototype\.toString\.call\((message\.[\w]+)\)/g, 'kageLongString($1)');
    source = source.replace(/new \$util\.LongBits\((message\.[\w]+)\.low >>> 0, \1\.high >>> 0\)\.toNumber\((true)?\)/g, (_, value, unsigned) => `kageLongNumber(${value}, ${!!unsigned})`);
    source = source.replace(/\$util\.Long\.fromBits\((message\.[\w]+)\.low >>> 0, \1\.high >>> 0, (true|false)\)\.toBigInt\(\)/g, (_, value, unsigned) => `BigInt(kageLongString(${value}, ${unsigned}))`);
    source += `\nfunction kageLongString(value, unsigned) {\n    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') return String(value);\n    const long = $util.Long.fromValue(value);\n    return (unsigned === true ? long.toUnsigned() : long).toString();\n}\nfunction kageLongNumber(value, unsigned) {\n    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') return Number(value);\n    const long = $util.Long.fromValue(value);\n    return (unsigned ? long.toUnsigned() : long.toSigned()).toNumber();\n}\nrequire('./compat.cjs')(module.exports.proto);\n`;   
    fs.writeFileSync(js, source);
    pbts.main(['-o', dts, js], error => {
        if (error) throw error;
        fs.appendFileSync(dts, '\nexport namespace proto { namespace Message { interface IMessageHistoryMetadata { oldestMessageTimestamp?: (number|Long|null); } interface MessageHistoryMetadata { oldestMessageTimestamp: (number|Long); } } }\n');
        const check = spawnSync(process.execPath, ['--check', js], { stdio: 'inherit' });
        if (check.status) process.exit(check.status);
        console.log('WAProto/index.js + index.d.ts regenerated from the single canonical schema.');
    });
});
