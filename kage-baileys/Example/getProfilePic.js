import { generarAvatar } from './avatarGenerator.js'

const TAMANO_MAXIMO = 5 * 1024 * 1024

function normalizarJid(jid) {
  return String(jid || 'desconocido@s.whatsapp.net').trim() || 'desconocido@s.whatsapp.net'
}

/**
 * Obtiene la foto real o genera un avatar cuando no existe/no es accesible.
 * @param {object} sock Socket de Baileys.
 * @param {string} jid JID del usuario o grupo.
 * @param {'image'|'preview'} tipo Resolución solicitada a Baileys.
 * @returns {Promise<string|Buffer>} URL real o Buffer PNG generado.
 */
export async function obtenerFotoPerfil(sock, jid, tipo = 'image') {
  const id = normalizarJid(jid)
  const formato = tipo === 'preview' ? 'preview' : 'image'
  const esGrupo = id.endsWith('@g.us')

  try {
    if (typeof sock?.profilePictureUrl !== 'function') {
      throw new TypeError('El socket no implementa profilePictureUrl()')
    }
    const url = await sock.profilePictureUrl(id, formato)
    if (typeof url === 'string' && url.trim()) return url.trim()
  } catch {
    // Una foto ausente, privada o inaccesible usa el mismo respaldo local.
  }

  return generarAvatar(id, esGrupo)
}

/** Adapta el resultado al campo image de sock.sendMessage(). */
export function comoImagen(foto) {
  if (Buffer.isBuffer(foto)) return foto
  if (foto instanceof Uint8Array) return Buffer.from(foto)
  if (typeof foto === 'string' && foto.trim()) return { url: foto.trim() }
  throw new TypeError('La imagen debe ser una URL o un Buffer')
}

/** Convierte un avatar generado a data URL para APIs que exigen una URL. */
export function comoUrlFoto(foto) {
  if (Buffer.isBuffer(foto)) return `data:image/png;base64,${foto.toString('base64')}`
  if (foto instanceof Uint8Array) return `data:image/png;base64,${Buffer.from(foto).toString('base64')}`
  if (typeof foto === 'string' && foto.trim()) return foto.trim()
  throw new TypeError('La foto debe ser una URL o un Buffer')
}

/**
 * Variante para plugins que necesitan bytes (bienvenidas, miniaturas, etc.).
 * También genera el avatar si la URL real no se puede descargar.
 */
export async function obtenerFotoPerfilBuffer(sock, jid, tipo = 'image') {
  const id = normalizarJid(jid)
  const foto = await obtenerFotoPerfil(sock, id, tipo)
  if (Buffer.isBuffer(foto)) return foto

  try {
    const response = await fetch(foto, { signal: AbortSignal.timeout(5000) })
    const contentType = response.headers.get('content-type') || ''
    const declarado = Number(response.headers.get('content-length')) || 0
    if (!response.ok || !contentType.startsWith('image/') || declarado > TAMANO_MAXIMO) {
      throw new Error('La foto de perfil no es una imagen válida')
    }
    const buffer = Buffer.from(await response.arrayBuffer())
    if (!buffer.length || buffer.length > TAMANO_MAXIMO) {
      throw new Error('La foto de perfil está vacía o supera el límite')
    }
    return buffer
  } catch {
    return generarAvatar(id, id.endsWith('@g.us'))
  }
}

export default obtenerFotoPerfil
