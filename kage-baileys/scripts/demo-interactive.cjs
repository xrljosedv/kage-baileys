'use strict';
 
const {proto,createKageNativeFlowButton,createKageCarouselMessage,createKageInteractiveMessage,buildKageInteractiveBizNode,validateKageInteractiveMessage} = require('../lib');
const b = createKageNativeFlowButton;
const carrusel = createKageCarouselMessage([
  {body:{text:'Texto'},footer:{text:'Footer'},nativeFlowMessage:{buttons:[b('quick_reply',{display_text:'Responder',id:'your_id'})]}},
  {body:{text:'Texto'},footer:{text:'Footer'},nativeFlowMessage:{buttons:[b('cta_url',{display_text:'Ir al Canal',url:'https://whatsapp.com/channel/0029Va4K0PZ5a245NkngBA2M'}),b('cta_copy',{display_text:'Copiar',copy_code:'texto'})]}}
],{text:'Selecciona una opción'});
const paypal = createKageInteractiveMessage({body:{text:'Abre PayPal para consultar el importe y pagar.'},nativeFlowMessage:{buttons:[b('cta_url',{display_text:'Abrir PayPal',url:'https://paypal.me/CarlosFiden410/12'})]}});
function inspect(content) {
  const bytes = proto.Message.encode(proto.Message.fromObject(content)).finish();
  const decoded = proto.Message.decode(bytes);
  return {validacion:validateKageInteractiveMessage(content),bytes:bytes.length,biz:buildKageInteractiveBizNode(content),contenido:proto.Message.toObject(decoded,{longs:String,bytes:String,defaults:false})};
}
console.log(JSON.stringify({modo:'DEMOSTRACION_LOCAL_SIN_WHATSAPP',visualizacionEnTelefono:'NO_VERIFICADA',carrusel:inspect(carrusel),pagoPorEnlace:inspect(paypal)},null,2));
