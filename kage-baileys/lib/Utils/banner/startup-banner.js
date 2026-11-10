'use strict';

/**
 * Banner de arranque de Kage Baileys.
 * Se muestra una sola vez por proceso al crear el primer socket.
 * Desactivar: KAGE_NO_BANNER=1  o  makeWASocket({ silentBanner: true })
 */

let alreadyShown = false;

function safeRequire(name) {
  try { return require(name); } catch { return null; }
}

function printBanner(options = {}) {
  if (alreadyShown && !options.force) return;
  alreadyShown = true;

  if (process.env.KAGE_NO_BANNER === '1' || process.env.KAGE_SILENT === '1') return;
  if (options.silent) return;

  const chalk = safeRequire('chalk');
  const cfonts = safeRequire('cfonts');
  const gradient = safeRequire('gradient-string');

  const line = (chalk?.gray || ((s) => s))('─'.repeat(58));
  const mag = chalk?.magentaBright || ((s) => s);
  const cyan = chalk?.cyanBright || ((s) => s);
  const white = chalk?.whiteBright || ((s) => s);
  const green = chalk?.greenBright || ((s) => s);
  const yellow = chalk?.yellowBright || ((s) => s);
  const dim = chalk?.dim || ((s) => s);
  const bold = chalk?.bold || ((s) => s);

  console.log(mag('\n[SISTEMA] Encendiendo motores... 🚀\n'));

  let logoOk = false;
  if (cfonts && typeof cfonts.say === 'function') {
    try {
      cfonts.say('KAGE BAILEYS', {
        font: 'simple',
        align: 'center',
        gradient: ['red', 'magenta'],
        letterSpacing: 1,
        space: false
      });
      logoOk = true;
    } catch (_) {}
  }
  if (!logoOk && gradient) {
    try {
      console.log(gradient(['#ff0055', '#c200ff', '#00d4ff'])('              K A G E   B A I L E Y S'));
      console.log('');
      logoOk = true;
    } catch (_) {}
  }
  if (!logoOk) {
    console.log(mag('              K A G E   B A I L E Y S\n'));
  }

  const title = gradient
    ? gradient(['#ff0055', '#c200ff', '#00d4ff'])('  ★  La mejor Baileys de 2026  ★')
    : mag('  ★  La mejor Baileys de 2026  ★');

  console.log(line);
  console.log(title);
  console.log(white('  API de WhatsApp Web completa · Multi-Device'));
  console.log(cyan('  Portada · Avatares · Botones · Native Flows · VoIP'));
  console.log(cyan('  Canales · Comunidades · Meta AI · Mapeo LID'));
  console.log(line);
  console.log(green('  Creador') + dim('  ·  ') + bold(white('José')) + dim('  ·  ') + white('xrljosedv'));
  console.log(line);
  console.log(yellow('  Sígueme / contacto profesional'));
  console.log(dim('  Instagram') + '   ' + white('@xrljose'));
  console.log(dim('  GitHub') + '      ' + white('github.com/xrljosedv'));
  console.log(dim('  WhatsApp') + '    ' + white('xrljosedv') + dim('  ·  ') + white('+51 928 619 211'));
  console.log(dim('  Telegram') + '    ' + white('@xrljosedv17'));
  console.log(line);
  console.log(dim('  Panel listo · docs en español · Node ≥ 22.12'));
  console.log(mag('[SISTEMA] Motores en línea. ¡Listo para conectar!\n'));
}

module.exports = { printBanner, showStartupBanner: printBanner };
