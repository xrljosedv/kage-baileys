'use strict';
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 12)) {
 console.error('Kage Baileys necesita Node >=22.12.0 por interoperabilidad CommonJS/ESM. Selecciona Node 22 o 24 en el panel. No basta con borrar engines.');
 process.exitCode = 1;
}
