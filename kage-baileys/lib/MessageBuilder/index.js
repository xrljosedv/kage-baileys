'use strict';
/**
 * MessageBuilder integrado en Kage Baileys (sin instalación extra).
 *
 * Usa internamente lib/Modded/message_builder.js que ya está cableado a:
 *  - generateWAMessageFromContent / prepareWAMessageMedia de Kage
 *  - interactive-compat, image-processing
 *  - sharp y fluent-ffmpeg (dependencias de Kage, opcionales)
 *
 * Uso:
 *   const { MessageBuilder, Button, ButtonV2, Carousel, AIRich, bind } = require('kage-baileys');
 *   // o:
 *   const MB = require('./lib/MessageBuilder');
 *   const msg = new MB.Button().text('Hola').button('OK','ok').build();
 *   // Con socket:
 *   const Bound = MB.bind(sock);
 *   await new Bound.Button().text('Hola').button('OK','ok').send(jid);
 */

const modded = require('../Modded/message_builder.js');

module.exports = {
  VERSION: modded.VERSION,
  Button: modded.Button,
  ButtonV2: modded.ButtonV2,
  Carousel: modded.Carousel,
  AIRich: modded.AIRich,
  ORich: modded.ORich,
  Toolkit: modded.Toolkit,
  bind: modded.bind,
  MessageBuilder: modded.MessageBuilder,
  // alias cómodo
  default: modded.MessageBuilder
};
