import {
  prepareWAMessageMedia,
  createKageNativeFlowButton,
  createKageOrderDetails,
  createKageInteractiveMessage,
  sendKageInteractiveMessage
} from '@whiskeysockets/baileys'

 
 
const handler = async (m, { conn, args = [] }) => {
  try {
    const native = args[0] === 'nativo'
    let paymentButton
    if (native) {
      if (!conn.kagePaymentOrder) {
        return m.reply('Falta conn.kagePaymentOrder con una orden y un método de pago habilitados para tu negocio. Usa unico6 sin argumentos para enviar el enlace PayPal.')
      }
       
      paymentButton = createKageOrderDetails(conn.kagePaymentOrder)
    } else {
      paymentButton = createKageNativeFlowButton('cta_url', {
        display_text: 'Abrir PayPal',
        url: 'https://paypal.me/CarlosFiden410/12',
        merchant_url: 'https://paypal.me/CarlosFiden410/12'
      })
    }
    let header = { title: 'texto1', subtitle: 'Pago', hasMediaAttachment: false }
    try {
      const media = await prepareWAMessageMedia(
        { image: { url: 'https://iili.io/K030s44.jpg' } },
        { upload: conn.waUploadToServer }
      )
      header = { ...header, imageMessage: media.imageMessage, hasMediaAttachment: true }
    } catch (error) {
      console.warn('[unico6] No se pudo preparar la imagen; se envía sin imagen:', error.message)
    }
    const content = createKageInteractiveMessage({
      header,
      body: { text: native ? 'Revisa los detalles de tu pedido.' : 'Abre el enlace para consultar el importe y realizar el pago en PayPal.' },
      footer: { text: 'texto3' },
      nativeFlowMessage: { buttons: [paymentButton], messageVersion: 1 }
    })
    const sent = await sendKageInteractiveMessage(conn, m.chat, content, { quoted: m })
    console.info('[unico6] Enviado al transporte:', sent.key.id, native ? 'order_details' : 'cta_url')
  } catch (error) {
    console.error('[unico6]', error)
    await m.reply('Error al enviar el pago: ' + error.message)
  }
}
handler.command = ['unico6', '2take1']
export default handler
