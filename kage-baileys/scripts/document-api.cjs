'use strict';
 
const fs = require('node:fs');
const path = require('node:path');
const api = require('../lib');
const root = path.resolve(__dirname, '..');
const sock = api.makeWASocket({ auth: { creds: api.initAuthCreds(), keys: { get: async () => ({}), set: async () => {} } }, logger: require('pino')({ level: 'silent' }), waWebSocketUrl: 'wss://127.0.0.1:1', connectTimeoutMs: 1000, fireInitQueries: false, kageTools: { banner: false } });
try {
    const publicExports = Object.keys(api).sort().map(name => ({ name, type: typeof api[name] }));
    const socketMethods = Object.keys(sock).filter(name => typeof sock[name] === 'function').sort();
    const original = fs.readFileSync(path.join(root, 'docs/README-original.md'), 'utf8');
    const references = [...new Set([...original.matchAll(/\b(?:sock|conn|socket)\.([A-Za-z_$][\w$]*)\s*\(/g)].map(m => m[1]))].sort();
    const unresolved = references.filter(name => typeof sock[name] !== 'function');
    const report = { scope: 'Presencia de API, no validación de operaciones contra WhatsApp.', publicExports, socketMethods, historicalReadme: { methodsReferenced: references.length, unresolved } };
    fs.writeFileSync(path.join(root, 'maintenance/current-api.json'), JSON.stringify(report, null, 2) + '\n');
    const body = '# API disponible en esta entrega\n\nInventario generado por `node scripts/document-api.cjs`. La presencia de un método no demuestra que WhatsApp lo autorice para tu cuenta.\n\n## Métodos del socket\n\n' + socketMethods.map(n => '- `' + n + '`').join('\n') + '\n\n## Exportaciones públicas\n\n| Exportación | Tipo |\n| --- | --- |\n' + publicExports.map(e => '| `' + e.name + '` | ' + e.type + ' |').join('\n') + '\n\n## Nombres del README histórico no presentes en el socket\n\n' + (unresolved.length ? unresolved.map(n => '- `' + n + '` — no usar como método del socket de esta distribución. Puede ser un helper de ejemplo o una API no incluida.').join('\n') : 'Ninguno en las llamadas detectadas.') + '\n';
    fs.writeFileSync(path.join(root, 'docs/API.md'), body);
    console.log(JSON.stringify({ publicExports: publicExports.length, socketMethods: socketMethods.length, unresolvedHistorical: unresolved }, null, 2));
} finally { sock.end(); }
