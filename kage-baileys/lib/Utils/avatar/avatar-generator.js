'use strict';

/**
 * Generador de avatares por defecto estilo WhatsApp.
 * Misma paleta y siluetas (usuario / grupo / comunidad / canal) que el cliente oficial.
 * Sin dependencia de canvas: usa sharp (ya incluido en kage-baileys).
 */

const TAMANO = 512;

/** Paleta oficial-like de colores de avatar de WhatsApp (orden estable). */
const COLORES = Object.freeze([
  '#00897B', '#1E88E5', '#8E24AA', '#D81B60', '#E53935',
  '#F57C00', '#43A047', '#0097A7', '#3949AB', '#7B1FA2',
  '#6D4C41', '#546E7A', '#AD1457', '#C2185B', '#5E35B1'
]);

/** FNV-1a 32-bit: el mismo ID siempre produce el mismo color. */
function fnv1a(valor) {
  const texto = String(valor ?? '');
  let hash = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Silueta de una persona (cabeza + torso) en coordenadas centradas.
 * Path compatible con el estilo de WhatsApp.
 */
function pathPersona(cx, cy, scale) {
  // Cabeza
  const headR = 66 * scale;
  const headY = cy - 78 * scale;
  // Torso (bezier simplificado)
  const topY = cy + 10 * scale;
  const bottomY = cy + 132 * scale;
  const halfW = 146 * scale;
  const shoulder = 164 * scale;

  const head = `M ${cx} ${headY - headR}
    a ${headR} ${headR} 0 1 1 0 ${headR * 2}
    a ${headR} ${headR} 0 1 1 0 ${-headR * 2}`;

  const body = `M ${cx - halfW} ${bottomY}
    L ${cx + halfW} ${bottomY}
    C ${cx + shoulder} ${bottomY} ${cx + shoulder} ${bottomY - 8 * scale} ${cx + shoulder} ${bottomY - 22 * scale}
    C ${cx + shoulder} ${cy + 47 * scale} ${cx + 91 * scale} ${topY} ${cx} ${topY}
    C ${cx - 91 * scale} ${topY} ${cx - shoulder} ${cy + 47 * scale} ${cx - shoulder} ${bottomY - 22 * scale}
    C ${cx - shoulder} ${bottomY - 8 * scale} ${cx - shoulder} ${bottomY} ${cx - halfW} ${bottomY}
    Z`;

  return `${head} ${body}`;
}

/**
 * Genera SVG de avatar estilo WhatsApp.
 * @param {string} colorFondo
 * @param {boolean} esGrupo  true = dos siluetas
 */
function buildSvg(colorFondo, esGrupo) {
  const bg = colorFondo;
  let people = '';

  if (esGrupo) {
    // Persona de atrás (más pequeña, a la derecha)
    people += `<path fill="#FFFFFF" d="${pathPersona(330, 226, 0.84)}"/>`;
    // Persona delantera con contorno del color de fondo para separarla
    people += `<path fill="#FFFFFF" stroke="${bg}" stroke-width="12" stroke-linejoin="round" d="${pathPersona(196, 288, 0.95)}"/>`;
  } else {
    people += `<path fill="#FFFFFF" d="${pathPersona(256, 270, 1.1)}"/>`;
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${TAMANO}" height="${TAMANO}" viewBox="0 0 ${TAMANO} ${TAMANO}">
  <rect width="100%" height="100%" fill="${bg}"/>
  ${people}
</svg>`;
}

let _sharp = null;
async function getSharp() {
  if (_sharp) return _sharp;
  try {
    _sharp = require('sharp');
    return _sharp;
  } catch (e) {
    throw new Error('Se necesita sharp para generar avatares. Instala: npm i sharp');
  }
}

/**
 * Genera un avatar PNG inspirado en las siluetas genéricas de WhatsApp.
 * @param {string} id JID del usuario, grupo, canal o comunidad; determina el color.
 * @param {boolean} [esGrupo=false] Dibuja dos personas cuando es true.
 * @returns {Promise<Buffer>} Imagen PNG de 512 × 512 píxeles.
 */
async function generarAvatar(id, esGrupo = false) {
  const identidad = String(id || 'desconocido').trim() || 'desconocido';
  const colorFondo = COLORES[fnv1a(identidad) % COLORES.length];
  const svg = buildSvg(colorFondo, !!esGrupo);
  const sharp = await getSharp();
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Versión síncrona aproximada (usa encodeSync solo si sharp lo permite; preferir async).
 * En la práctica se usa la async.
 */
function generarAvatarSync(id, esGrupo = false) {
  // Fallback mínimo: devolvemos null y forzamos async en callers.
  throw new Error('Usa generarAvatar() (async). La versión síncrona no está disponible sin canvas.');
}

function colorParaId(id) {
  const identidad = String(id || 'desconocido').trim() || 'desconocido';
  return COLORES[fnv1a(identidad) % COLORES.length];
}

function esJidGrupoOComunidad(jid) {
  const s = String(jid || '');
  return s.endsWith('@g.us') || s.includes('@g.us') || /community/i.test(s);
}

module.exports = {
  generarAvatar,
  generarAvatarSync,
  fnv1a,
  colorParaId,
  esJidGrupoOComunidad,
  PALETA_AVATARES: COLORES,
  TAMANO
};
