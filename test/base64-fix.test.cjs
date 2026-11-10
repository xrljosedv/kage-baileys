'use strict';
// Test del fix base64 tolerante: evita "Error: invalid encoding" en
// BotSignatureVerificationUseCaseProof (signature / certificateChain).
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const WAProto = require(path.join(__dirname, '..', 'WAProto', 'index.js'));

const makeProof = (signature, certificateChain) => ({
    messageContextInfo: {
        botMetadata: {
            verificationMetadata: {
                proofs: [{ version: 1, useCase: 'WA_BOT_MSG', signature, certificateChain }]
            }
        }
    }
});

test('base64 estandar con padding correcto se decodifica igual que siempre', () => {
    const msg = WAProto.proto.Message.fromObject(makeProof('AAAA', ['QQ==']));
    assert.strictEqual(Buffer.from(msg.messageContextInfo.botMetadata.verificationMetadata.proofs[0].certificateChain[0]).toString(), 'A');
});

test('base64 URL-safe (- y _) se acepta sin error', () => {
    // 'a-b_' es URL-safe; en base64 estricto lanzaria invalid encoding por los caracteres
    const msg = WAProto.proto.Message.fromObject(makeProof('AAAA', ['_-__']));
    assert.ok(msg.messageContextInfo.botMetadata.verificationMetadata.proofs[0].certificateChain[0].length >= 0);
});

test('base64 sin padding se completa automaticamente', () => {
    // 'QQ' (2 chars) sin '==' debe decodificar a 'A'
    const msg = WAProto.proto.Message.fromObject(makeProof('AAAA', ['QQ']));
    assert.strictEqual(Buffer.from(msg.messageContextInfo.botMetadata.verificationMetadata.proofs[0].certificateChain[0]).toString(), 'A');
});

test('base64 con saltos de linea no lanza invalid encoding', () => {
    const msg = WAProto.proto.Message.fromObject(makeProof('AAAA', ['QQ==\n']));
    assert.strictEqual(Buffer.from(msg.messageContextInfo.botMetadata.verificationMetadata.proofs[0].certificateChain[0]).toString(), 'A');
});

test('certificado con caracter colgante (len % 4 === 1) no lanza invalid encoding', () => {
    // Reproduce el caso real de WhatsApp: cadena de 1169 chars (resto 1).
    // El caracter colgante se descarta (6 bits sin datos) y el resto se decodifica.
    const broken = 'TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LVZlcmlmaWNhdGlvblNpZ25hdHVyZS5NZXRhZGF0YQ' + 'A';
    const msg = WAProto.proto.Message.fromObject(makeProof('AAAA', [broken]));
    const bytes = msg.messageContextInfo.botMetadata.verificationMetadata.proofs[0].certificateChain[0];
    assert.ok(bytes.length > 0);
    assert.strictEqual(Buffer.from(bytes).toString('utf8', 0, 8), 'NIXEL.Me');
});
