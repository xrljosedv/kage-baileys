import { createCanvas } from '@napi-rs/canvas'

const TAMANO = 512
const COLORES = Object.freeze([
  '#00897B', '#1E88E5', '#8E24AA', '#D81B60', '#E53935',
  '#F57C00', '#43A047', '#0097A7', '#3949AB', '#7B1FA2',
  '#6D4C41', '#546E7A', '#AD1457', '#C2185B', '#5E35B1'
])

/** FNV-1a de 32 bits: el mismo ID siempre produce el mismo color. */
export function fnv1a(valor) {
  const texto = String(valor ?? '')
  let hash = 0x811c9dc5
  for (let i = 0; i < texto.length; i++) {
    hash ^= texto.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function trazarPersona(ctx) {
  ctx.beginPath()
  ctx.arc(0, -78, 66, 0, Math.PI * 2)
  ctx.closePath()

  ctx.moveTo(-146, 132)
  ctx.lineTo(146, 132)
  ctx.bezierCurveTo(158, 132, 164, 124, 164, 110)
  ctx.bezierCurveTo(164, 47, 91, 10, 0, 10)
  ctx.bezierCurveTo(-91, 10, -164, 47, -164, 110)
  ctx.bezierCurveTo(-164, 124, -158, 132, -146, 132)
  ctx.closePath()
}

function dibujarPersona(ctx, x, y, escala, colorFondo, separacion = 0) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(escala, escala)
  ctx.fillStyle = '#FFFFFF'
  ctx.strokeStyle = colorFondo
  ctx.lineWidth = separacion
  ctx.lineJoin = 'round'
  trazarPersona(ctx)
  ctx.fill()
  if (separacion) ctx.stroke()
  ctx.restore()
}

/**
 * Genera un avatar PNG inspirado en las siluetas genéricas de WhatsApp.
 * @param {string} id JID del usuario o grupo; determina el color.
 * @param {boolean} esGrupo Dibuja dos personas cuando es true.
 * @returns {Buffer} Imagen PNG de 512 × 512 píxeles.
 */
export function generarAvatar(id, esGrupo = false) {
  const identidad = String(id || 'desconocido').trim() || 'desconocido'
  const colorFondo = COLORES[fnv1a(identidad) % COLORES.length]
  const canvas = createCanvas(TAMANO, TAMANO)
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = colorFondo
  ctx.fillRect(0, 0, TAMANO, TAMANO)

  if (esGrupo) {
    // La persona posterior se dibuja primero; el contorno separa ambas siluetas.
    dibujarPersona(ctx, 330, 226, 0.84, colorFondo)
    dibujarPersona(ctx, 196, 288, 0.95, colorFondo, 12)
  } else {
    dibujarPersona(ctx, 256, 270, 1.1, colorFondo)
  }

  return Buffer.from(canvas.encodeSync('png'))
}

export const PALETA_AVATARES = COLORES
export default generarAvatar
