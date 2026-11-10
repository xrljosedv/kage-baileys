import {
  prepareWAMessageMedia,
  createKageNativeFlowButton as button,
  createKageCarouselMessage,
  sendKageInteractiveMessage,
  validateKageInteractiveMessage
} from '@whiskeysockets/baileys'

 
 
 
 
const handler = async (m, { conn, args = [] }) => {
  try {
    const mode = args[0] || 'basico'
    const media = await prepareWAMessageMedia(
      { image: { url: 'https://iili.io/K030s44.jpg' } },
      { upload: conn.waUploadToServer }
    )
    const catalog = mode === 'catalogo'
    const cards = [
      {
        header: catalog ? {
          hasMediaAttachment: true,
          productMessage: {
            product: {
              productImage: media.imageMessage,
              productId: '25697885489797403',
              title: 'Producto',
              description: 'Descripción',
              currencyCode: 'PEN',
              priceAmount1000: '1000',
              retailerId: '001',
              productImageCount: 1
            },
            businessOwnerJid: '51900373696@s.whatsapp.net'
          }
        } : { hasMediaAttachment: true, imageMessage: media.imageMessage },
        body: { text: catalog ? 'Producto' : 'Texto' },
        footer: { text: 'Footer' },
        nativeFlowMessage: {
          messageVersion: 1,
          buttons: catalog ? [button('cta_catalog', { business_phone_number: '51900373696' })] : [
            button('quick_reply', { display_text: 'Responder', id: 'your_id' }),
            button('cta_call', { display_text: 'Llamar', phone_number: '51900373696' }),
            button('single_select', {
              title: 'Lista',
              sections: [{ title: 'Opciones', rows: [{ title: 'Opción 1', id: 'opcion_1' }] }]
            })
          ]
        }
      },
      {
        header: { hasMediaAttachment: true, imageMessage: media.imageMessage },
        body: { text: 'Texto' },
        footer: { text: 'Footer' },
        nativeFlowMessage: {
          messageVersion: 1,
          buttons: [
            button('quick_reply', { display_text: 'Responder', id: 'your_id_2' }),
            button('cta_url', {
              display_text: 'Ir al Canal',
              url: 'https://whatsapp.com/channel/0029Va4K0PZ5a245NkngBA2M',
              merchant_url: 'https://whatsapp.com/channel/0029Va4K0PZ5a245NkngBA2M'
            }),
            button('cta_copy', { display_text: 'Copiar', copy_code: 'texto' })
          ]
        }
      }
    ]
    if (mode === 'experimental') {
      if (!Array.isArray(conn.kageExperimentalButtons) || !conn.kageExperimentalButtons.length) {
        return m.reply('Define conn.kageExperimentalButtons con tus botones y recursos reales. Los flujos, recordatorios y pagos no se habilitan añadiendo únicamente su nombre.')
      }
      cards[1].nativeFlowMessage.buttons.push(...conn.kageExperimentalButtons)
    }
    const content = createKageCarouselMessage(cards, { text: 'Selecciona una opción' })
    const diagnosis = validateKageInteractiveMessage(content)
    for (const warning of diagnosis.warnings) console.warn('[scarr]', warning)
    await sendKageInteractiveMessage(conn, m.chat, content, { quoted: m })
     
    try { await m.react?.('✅') } catch (error) { console.warn('[scarr reacción]', error.message) }
  } catch (error) {
    console.error('[scarr]', error)
    await m.reply('Error al enviar el carrusel: ' + error.message)
  }
}
handler.command = ['scarr']
export default handler
