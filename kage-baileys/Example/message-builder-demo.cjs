'use strict';
/**
 * Demo de MessageBuilder integrado en Kage (sin npm install extra).
 *
 * Ejecutar después de tener un sock conectado, o adaptar a tu bot.
 */

// Desde el paquete completo:
// const { MessageBuilder, Button, ButtonV2, Carousel, AIRich, bind } = require('kage-baileys');
// Desde ruta local del repo:
const {
  Button,
  ButtonV2,
  Carousel,
  AIRich,
  bind,
  MessageBuilder
} = require('../lib/Modded/message_builder.js');

// También disponible como:
// const MB = require('../lib/MessageBuilder');

/**
 * @param {import('../lib').WASocket} sock
 * @param {string} jid
 */
async function demoButtons(sock, jid) {
  const MB = bind(sock);

  // Botón simple (native flow / quick_reply)
  await new MB.Button()
    .text('Selecciona una opción')
    .button('Perfil', 'perfil')
    .button('Ayuda', 'ayuda')
    .footer('Kage Baileys')
    .send(jid);

  // Multi-fila
  await new MB.ButtonV2()
    .text('Menú')
    .row(r => r.button('A', 'a').button('B', 'b'))
    .row(r => r.button('C', 'c'))
    .send(jid);

  // Carousel (si el cliente lo soporta)
  await new MB.Carousel()
    .card(c => c.title('Card 1').text('Descripción 1').button('Ver', 'c1'))
    .card(c => c.title('Card 2').text('Descripción 2').button('Ver', 'c2'))
    .send(jid);
}

/**
 * También puedes construir sin enviar (offline) y luego relayMessage.
 */
function buildOnly() {
  const msg = new Button()
    .text('Hola')
    .button('OK', 'ok1')
    .footer('Kage')
    .build();
  return msg; // { key, message } listo para sock.relayMessage(jid, msg.message, { messageId: msg.key.id })
}

module.exports = { demoButtons, buildOnly, Button, ButtonV2, Carousel, AIRich, bind, MessageBuilder };
