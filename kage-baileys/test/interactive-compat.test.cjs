'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {createRequire} = require('node:module');
const {EventEmitter} = require('node:events');
const api = require('../lib');
const compat = require('../lib/Utils/interactive-compat');
const button = (name='quick_reply', params={display_text:'Responder',id:'your_id'}) => compat.createKageNativeFlowButton(name,params);
const interactive = buttons => ({interactiveMessage:{body:{text:'Texto'},nativeFlowMessage:{buttons}}});
const card = () => ({body:{text:'Texto'},nativeFlowMessage:{buttons:[button()]}});
function order() {
   
  return {currency:'USD',type:'digital-goods',reference_id:'PRUEBA-LOCAL',total_amount:{value:137,offset:100},order:{status:'payment_requested',subtotal:{value:137,offset:100},items:[{name:'nodejs',retailer_id:'000000',amount:{value:137,offset:100},quantity:1}]},payment_configuration:'CONFIGURACION-SIMULADA'};
}
function transport() {
  const nodes = [];
  const logger = require('pino')({level:'silent'});
  const ev = new EventEmitter();
  const sock = {ev, user:{id:'51900000000@s.whatsapp.net'}, authState:{creds:{me:{id:'51900000000@s.whatsapp.net'}},keys:{get:async(type,ids)=>Object.fromEntries(ids.map(id=>[id,{}])),set:async()=>{},transaction:async fn=>fn()}},signalRepository:{jidToSignalProtocolAddress:jid=>jid,encryptMessage:async()=>({type:'msg',ciphertext:Buffer.from('cifrado-simulado')})},sendNode:async n=>nodes.push(n),query:async()=>{throw new Error('No se permite red en esta prueba')}};
  const file = require.resolve('../lib/Socket/messages-send');
  const nativeRequire = createRequire(file);
  const sandbox={exports:{},Buffer,console,require(name){if(name==='./newsletter')return {makeNewsletterSocket:()=>sock};return nativeRequire(name)}};
  vm.runInNewContext(fs.readFileSync(file,'utf8'),sandbox,{filename:file});
  return {conn:sandbox.exports.makeMessagesSocket({...api.DEFAULT_CONNECTION_CONFIG,logger}),nodes};
}
test('API nueva se publica tanto en CJS como en ESM',async()=>{
  const esm = await import('../lib/index.mjs');
  for(const key of Object.keys(compat)) assert.equal(esm[key],api[key],key);
});
for(const wrapper of ['viewOnceMessage','viewOnceMessageV2','viewOnceMessageV2Extension','ephemeralMessage','documentWithCaptionMessage']) test('ruta nativa desenvuelta: '+wrapper,()=>{
  const raw = interactive([button('cta_catalog',{business_phone_number:'51900373696'})]);
  assert.equal(compat.buildKageInteractiveBizNode({[wrapper]:{message:raw}}).content[0].content[0].attrs.name,'cta_catalog');
});
test('desenvuelve capas anidadas y rechaza referencias circulares',()=>{
  const raw=interactive([button()]);assert.equal(compat.unwrapKageMessage({ephemeralMessage:{message:{viewOnceMessage:{message:raw}}}}),raw);
  const x={};x.viewOnceMessage={message:x};assert.throws(()=>compat.unwrapKageMessage(x),/circular/);
});
test('review_and_pay añade order_details; payment_info conserva su nombre',()=>{
  assert.deepEqual(compat.buildKageInteractiveBizNode(interactive([button('review_and_pay',{})])).attrs,{native_flow_name:'order_details'});
  assert.equal(compat.buildKageInteractiveBizNode(interactive([button('payment_info',{})])).attrs.native_flow_name,'payment_info');
});
test('botones heterogéneos no heredan ruta especializada del primero',()=>{
  const biz=compat.buildKageInteractiveBizNode(interactive([button('cta_catalog',{}),button()]));
  assert.equal(biz.content[0].content[0].attrs.name,'mixed');
});
test('carrusel se trata como contenedor mixto',()=>{
  const content=compat.createKageCarouselMessage([card(),card()]);
  const biz=compat.buildKageInteractiveBizNode(content);
  assert.equal(biz.content[0].content[0].attrs.name,'mixed');
});
test('fusión elimina biz duplicado sin perder cifrado, tokens ni atributos explícitos',()=>{
  const enc={tag:'participants',attrs:{},content:[{tag:'to',attrs:{jid:'51900373696@s.whatsapp.net'}}]};
  const token={tag:'tctoken',attrs:{},content:Buffer.from([1,2,3])};
  const explicit={tag:'biz',attrs:{native_flow_name:'order_details',custom:'si'},content:[{tag:'quality_control',attrs:{source_type:'preservado'}}]};
  const input=[explicit];const before=JSON.stringify(input);
  const stanza={tag:'message',attrs:{},content:[enc,explicit,{tag:'biz',attrs:{},content:[{tag:'interactive',attrs:{type:'native_flow'}}]},token]};
  compat.applyKageInteractiveNodes(stanza,interactive([button('review_and_pay',{})]),input);
  const biz=stanza.content.filter(n=>n.tag==='biz');assert.equal(biz.length,1);assert.equal(biz[0].attrs.custom,'si');assert.equal(biz[0].attrs.native_flow_name,'order_details');
  assert.ok(stanza.content.includes(enc));assert.ok(stanza.content.includes(token));assert.equal(JSON.stringify(input),before);
  assert.equal(biz[0].content.filter(n=>n.tag==='quality_control').length,1);
});
test('aplicar nodos dos veces es idempotente',()=>{
  const stanza={content:[]};const raw=interactive([button()]);compat.applyKageInteractiveNodes(stanza,raw);const before=JSON.stringify(stanza);compat.applyKageInteractiveNodes(stanza,raw);assert.equal(JSON.stringify(stanza),before);
});
test('mensajes de texto y canales no cambian',()=>{
  const stanza={attrs:{},content:[]};const content=stanza.content;compat.applyKageInteractiveNodes(stanza,{conversation:'Hola'});assert.equal(stanza.content,content);
  const channel={attrs:{to:'123@newsletter'},content:[]};compat.applyKageInteractiveNodes(channel,interactive([button()]));assert.deepEqual(channel.content,[]);
});
test('JSON malformado se informa y nombres experimentales no se eliminan',()=>{
  assert.equal(compat.validateKageInteractiveMessage(interactive([{name:'quick_reply',buttonParamsJson:'{'}])).valid,false);
  const custom=interactive([button('galaxy_message',{flow_id:'1307913409923914'})]);const v=compat.validateKageInteractiveMessage(custom);assert.equal(v.valid,true);assert.match(v.warnings[0],/depende/);
});
test('lista requiere ids reales y header respeta media oneof',()=>{
  const list=button('single_select',{title:'Lista',sections:[{rows:[{title:'Opción 1',id:''}]}]});assert.equal(compat.validateKageInteractiveMessage(interactive([list])).valid,false);
  assert.throws(()=>compat.createKageInteractiveMessage({header:{imageMessage:{},productMessage:{}},nativeFlowMessage:{buttons:[button()]}}),/oneof/);
});
test('protobuf conserva dos tarjetas y datos del producto original',()=>{
  const first={header:{hasMediaAttachment:true,productMessage:{product:{productImage:{mimetype:'image/jpeg'},productId:'25697885489797403',title:'Producto',currencyCode:'PEN',priceAmount1000:'1000'},businessOwnerJid:'51900373696@s.whatsapp.net'}},body:{text:'Texto'},nativeFlowMessage:{buttons:[button('cta_catalog',{business_phone_number:'51900373696'})]}};
  const content=compat.createKageCarouselMessage([first,card()]);
  const decoded=api.proto.Message.decode(api.proto.Message.encode(api.proto.Message.fromObject(content)).finish());
  const cards=decoded.viewOnceMessage.message.interactiveMessage.carouselMessage.cards;
  assert.equal(cards.length,2);assert.equal(cards[0].header.productMessage.product.priceAmount1000.toString(),'1000');assert.equal(cards[0].header.productMessage.product.productId,'25697885489797403');
});
test('orden local válida conserva importes, no inventa configuración',()=>{
  const input=order(),before=JSON.stringify(input);const btn=compat.createKageOrderDetails(input);assert.equal(btn.name,'review_and_pay');assert.equal(btn.buttonParamsJson,before);
});
test('el error original de usar una URL como type se rechaza',()=>{
  const p=order();p.type='https://paypal.me/CarlosFiden410/12';assert.throws(()=>compat.createKageOrderDetails(p),/no una URL/);
});
test('offsets inconsistentes, subtotales y totales erróneos se rechazan',()=>{
  let p=order();p.order.tax={value:1,offset:1000};assert.throws(()=>compat.createKageOrderDetails(p),/offset común/);
  p=order();p.order.subtotal.value=140;assert.throws(()=>compat.createKageOrderDetails(p),/subtotal/);
  p=order();p.total_amount.value=138;assert.throws(()=>compat.createKageOrderDetails(p),/total no coincide/);
});
test('no se anuncia orden nativa sin método de pago configurado',()=>{
  const p=order();delete p.payment_configuration;p.native_payment_methods=[];assert.throws(()=>compat.createKageOrderDetails(p),/configuración de pago real/);
});
test('relayMessage real genera un único biz para el código de pago original',async()=>{
  const {conn,nodes}=transport();
  const raw={viewOnceMessage:{message:interactive([button('review_and_pay',{})])}};
  const id=await conn.relayMessage('51900373696@s.whatsapp.net',raw,{messageId:'PRUEBA-PAGO',participant:{jid:'51900373696@s.whatsapp.net'},additionalNodes:[{tag:'biz',attrs:{native_flow_name:'order_details'}}]});
  assert.equal(id,'PRUEBA-PAGO');const biz=nodes[0].content.filter(n=>n.tag==='biz');assert.equal(biz.length,1);assert.equal(biz[0].attrs.native_flow_name,'order_details');assert.equal(biz[0].content,undefined);
});
test('relayMessage real conserva cifrado y ruta mixta del carrusel',async()=>{
  const {conn,nodes}=transport();
  await conn.relayMessage('51900373696@s.whatsapp.net',compat.createKageCarouselMessage([card(),card()]),{messageId:'PRUEBA-CARRUSEL',participant:{jid:'51900373696@s.whatsapp.net'}});
  assert.equal(nodes[0].attrs.id,'PRUEBA-CARRUSEL');assert.ok(nodes[0].content.some(n=>n.tag==='participants'));const biz=nodes[0].content.filter(n=>n.tag==='biz');assert.equal(biz.length,1);assert.equal(biz[0].content[0].content[0].attrs.name,'mixed');
});
function plugin(filename,options={}) {
  const code=fs.readFileSync(require('node:path').join(__dirname,'../Example/plugins',filename),'utf8').replace(/import\s*\{([\s\S]*?)\}\s*from\s*'@whiskeysockets\/baileys'/,'const {$1} = api').replace('createKageNativeFlowButton as button','createKageNativeFlowButton: button').replace('export default handler','return handler');
  return new Function('api',code)({...api,prepareWAMessageMedia:async()=>{if(options.noImage)throw new Error('imagen no disponible');return {imageMessage:{mimetype:'image/jpeg',url:'https://iili.io/K030s44.jpg'}}}});
}
function pluginContext() {
  const messages=[],replies=[];const conn={user:{id:'51900000000@s.whatsapp.net'},waUploadToServer:async()=>{},relayMessage:async(jid,message,opts)=>messages.push({jid,message:api.proto.Message.decode(api.proto.Message.encode(message).finish()),opts})};
  const m={chat:'51900373696@s.whatsapp.net',key:{id:'CITA',remoteJid:'51900373696@s.whatsapp.net',fromMe:false},message:{conversation:'comando'},reply:async text=>replies.push(text),react:async()=>{}};
  return {conn,m,messages,replies};
}
for(const mode of ['basico','catalogo'])test('plugin scarr '+mode+' ejecutado con medios y transporte simulados',async()=>{
  const ctx=pluginContext();await plugin('scarr.mjs')(ctx.m,{conn:ctx.conn,args:[mode]});assert.deepEqual(ctx.replies,[]);assert.equal(ctx.messages.length,1);assert.equal(ctx.messages[0].message.viewOnceMessage.message.interactiveMessage.carouselMessage.cards.length,2);assert.equal(ctx.messages[0].opts.messageId.length>0,true);
});
test('plugin unico6 usa URL PayPal real proporcionada, sin orden ficticia',async()=>{
  const ctx=pluginContext();await plugin('unico6.mjs')(ctx.m,{conn:ctx.conn,args:[]});assert.deepEqual(ctx.replies,[]);const b=ctx.messages[0].message.viewOnceMessage.message.interactiveMessage.nativeFlowMessage.buttons[0];assert.equal(b.name,'cta_url');assert.equal(JSON.parse(b.buttonParamsJson).url,'https://paypal.me/CarlosFiden410/12');
});
test('plugin unico6 nativo exige configuración y no envía mensajes incompletos',async()=>{
  const ctx=pluginContext();await plugin('unico6.mjs')(ctx.m,{conn:ctx.conn,args:['nativo']});assert.equal(ctx.messages.length,0);assert.match(ctx.replies[0],/Falta conn.kagePaymentOrder/);
});
test('plugin unico6 nativo serializa orden suministrada',async()=>{
  const ctx=pluginContext();ctx.conn.kagePaymentOrder=order();await plugin('unico6.mjs')(ctx.m,{conn:ctx.conn,args:['nativo']});assert.deepEqual(ctx.replies,[]);assert.equal(ctx.messages[0].message.viewOnceMessage.message.interactiveMessage.nativeFlowMessage.buttons[0].name,'review_and_pay');
});
test('plugin unico6 puede enviarse aunque la imagen falle',async()=>{
  const ctx=pluginContext();await plugin('unico6.mjs',{noImage:true})(ctx.m,{conn:ctx.conn,args:[]});assert.deepEqual(ctx.replies,[]);assert.equal(ctx.messages.length,1);assert.equal(ctx.messages[0].message.viewOnceMessage.message.interactiveMessage.header.hasMediaAttachment,false);
});
