'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');const api=require('../lib');const logger=require('pino')({level:'silent'});
const cases=[
 ['bloque de código',{code:'console.log(1)',language:'javascript'},'botForwardedMessage'],
 ['tabla',{table:[['Título'],['Valor']]},'botForwardedMessage'],
 ['enlaces',{links:[{text:'Ejemplo',title:'Ejemplo',url:'https://example.com'}]},'botForwardedMessage'],
 ['respuesta enriquecida',{richResponse:[{text:'Hola'}]},'botForwardedMessage'],
 ['flujo nativo',{text:'Opciones',nativeFlow:[{text:'Sí',id:'si'}]},'interactiveMessage'],
 ['pago',{paymentInviteServiceType:3},'paymentInviteMessage'],
 ['contenido oculto',{text:'Hola',spoiler:true},'spoilerMessage'],
 ['visualización única V2',{text:'Hola',viewOnceV2:true},'viewOnceMessageV2'],
 ['visualización única extendida',{text:'Hola',viewOnceV2Extension:true},'viewOnceMessageV2Extension'],
 ['estado de grupo',{text:'Hola',groupStatus:true},'groupStatusMessageV2'],
 ['contenido directo',{raw:true,conversation:'Hola'},'conversation']
];
for(const[name,content,key]of cases)test('formato avanzado: '+name,async()=>{
 const m=await api.generateWAMessageContent(content,{logger,userJid:'123@s.whatsapp.net'});const decoded=api.proto.Message.decode(api.proto.Message.encode(api.proto.Message.fromObject(m)).finish());assert.ok(decoded[key],key);
});
test('el contenido raw no modifica el objeto del consumidor',async()=>{const m={raw:true,conversation:'Prueba'};await api.generateWAMessageContent(m,{logger});assert.equal(m.raw,true)});
test('citas de canal conservan el contenido y el identificador',async()=>{const m=await api.generateWAMessage('123@newsletter',{text:'Respuesta'},{logger,userJid:'123@s.whatsapp.net',quoted:{key:{id:'ABC',remoteJid:'123@newsletter',fromMe:false},message:{conversation:'Original'}}});assert.equal(m.message.extendedTextMessage.contextInfo.stanzaId,'ABC')});
test('nombres alternativos del esquema conservan el mismo campo al codificar',()=>{const T=api.proto.Message.ExtendedTextMessage;const m=T.fromObject({faviconMmsMetadata:{thumbnailWidth:32}});const r=T.decode(T.encode(m).finish());assert.equal(r.faviconMmsMetadata.thumbnailWidth,32)});
test('todos los módulos declarados conservan sus exportaciones',()=>{for(const item of require('../maintenance/api-coverage.json')){const mod=require('../'+item.archivo);for(const k of item.exportaciones)assert.ok(k in mod,item.archivo+': '+k)}});
test('una sola raíz de paquete, sin módulos duplicados en carpetas privadas',()=>{assert.equal(fs.existsSync(path.join(__dirname,'../vendor')),false);assert.equal(fs.existsSync(path.join(__dirname,'../lib/KageExtra')),false)});
test('banner solicitado y colores en terminales compatibles',()=>{const output=[];api.say('kage baileys',{font:'simple',align:'center',gradient:['red','magenta'],stream:{columns:40,isTTY:false,write:x=>output.push(x)}});api.say('Creado por xrljosedv',{font:'console',align:'center',colors:['cyan','magenta','yellow'],stream:{columns:40,isTTY:false,write:x=>output.push(x)}});assert.match(output.join(''),/KAGE BAILEYS/);assert.match(output.join(''),/Creado por xrljosedv/);assert.ok(!output.join('').includes('\x1b['))});
