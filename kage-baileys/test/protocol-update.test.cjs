'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { EventEmitter } = require('node:events');
const api = require('../lib');
const { createInitQueryRunner, isRetryableQueryError } = require('../lib/Utils/init-queries');
const { installProfileTools, parseAboutNode } = require('../lib/Utils/profile-tools');
const MB = require('../lib/Modded/message_builder');
const compat = require('../lib/Utils/interactive-compat');
const tick = () => new Promise(resolve => setImmediate(resolve));
const timeout = () => Object.assign(new Error('Timed Out'), { output: { statusCode: 408 } });
function mock() {
 const entries = [], endHandlers = [], ev = new EventEmitter();
 const logger = Object.fromEntries(['debug','warn','error','info'].map(level => [level,(...data) => entries.push({level,data})]));
 const socket = {ev,registerSocketEndHandler:fn => endHandlers.push(fn)};
 const config = {logger,initQueryRetry:{maxAttempts:3,baseDelayMs:0,random:()=>0,sleep:async()=>{}}};
 return {socket,config,entries,close:()=>endHandlers.forEach(fn=>fn())};
}
test('408 retries only failed initial reads, preserving successful reads',async()=>{
 const {socket,config,entries}=mock(); let props=0,privacy=0;
 const run=createInitQueryRunner(socket,config,{props:async()=>{if(++props<3)throw timeout()},privacy:async()=>{privacy++}});
 const result=await run();assert.equal(result.status,'complete');assert.equal(props,3);assert.equal(privacy,1);assert.equal(entries.some(e=>e.level==='error'),false);
});
test('persistent timeout remains observable without raw error stacks',async()=>{
 const {socket,config,entries}=mock();let count=0;
 const run=createInitQueryRunner(socket,config,{props:async()=>{count++;throw timeout()}});
 const result=await run();assert.equal(count,3);assert.equal(result.status,'partial');assert.equal(result.tasks[0].error.code,408);
 assert.equal(entries.some(e=>e.level==='error'||e.level==='warn'),false);assert.equal('stack' in result.tasks[0].error,false);
 const snapshot=run.getState();snapshot.tasks.length=0;assert.equal(run.getState().tasks.length,1);
});
test('real authentication errors are neither swallowed nor retried',async()=>{
 const {socket,config,entries}=mock();let calls=0;
 const result=await createInitQueryRunner(socket,config,{read:async()=>{calls++;throw Object.assign(new Error('Forbidden'),{statusCode:403})}})();
 assert.equal(result.status,'partial');assert.equal(calls,1);assert.equal(entries.filter(e=>e.level==='error').length,1);
});
test('concurrent initial read requests share one promise',async()=>{
 const {socket,config}=mock();let release,calls=0;
 const run=createInitQueryRunner(socket,config,{read:()=>{calls++;return new Promise(r=>release=r)}});
 const a=run(),b=run();assert.equal(a,b);release();await a;assert.equal(calls,1);
});
test('closing cancels retries and removes lifecycle listeners on end',async()=>{
 const {socket,config,close}=mock();let calls=0;
 config.initQueryRetry.baseDelayMs=1000;delete config.initQueryRetry.sleep;
 const run=createInitQueryRunner(socket,config,{read:async()=>{calls++;throw timeout()}});
 const result=run();await tick();socket.ev.emit('connection.update',{connection:'close'});assert.equal((await result).status,'cancelled');assert.equal(calls,1);assert.equal(run.getState().status,'cancelled');
 close();assert.equal(socket.ev.listenerCount('connection.update'),0);assert.equal((await run()).status,'cancelled');
});
test('an old connection cannot overwrite the newer initialization result',async()=>{
 const {socket,config}=mock();let release,calls=0;
 const run=createInitQueryRunner(socket,config,{read:()=>++calls===1?new Promise(r=>release=r):Promise.resolve()});
 const old=run();socket.ev.emit('connection.update',{connection:'close'});const next=run();assert.equal((await next).status,'complete');release();assert.equal((await old).status,'cancelled');assert.equal(run.getState().status,'complete');
});
test('retry classification does not retry writes or invalid authentication by accident',()=>{
 for(const code of [408,429,502,503,504,'ETIMEDOUT','EAI_AGAIN'])assert.equal(isRetryableQueryError({code}),true);
 for(const code of [400,401,403,404,409,440,463,500])assert.equal(isRetryableQueryError({code}),false);
});
test('active chats initialization recovers from the screenshot error',async()=>{
 const {socket,config,entries,close}=mock();let props=0;
 const ev=api.makeEventBuffer(config.logger);socket.ev=ev;socket.ws=new EventEmitter();
 socket.authState={creds:{me:{id:'1@s.whatsapp.net',name:'Kage'}},keys:{get:async()=>({}),set:async()=>{}}};
 socket.generateMessageTag=()=> 'test';socket.sendNode=async()=>{};socket.onUnexpectedError=error=>assert.fail(error.message);
 socket.query=async node=>{if(node.attrs.xmlns==='w'&&++props===1)throw timeout();return {tag:'iq',attrs:{type:'result'},content:[{tag:'privacy',attrs:{},content:[]}]}};
 const filename=require.resolve('../lib/Socket/chats');const native=createRequire(filename);
 const sandbox={exports:{},require:name=>name==='./usync'?{makeUSyncSocket:()=>socket}:native(name),Buffer,console,setTimeout,clearTimeout,setInterval,clearInterval,process};
 vm.runInNewContext(fs.readFileSync(filename,'utf8'),sandbox,{filename});
 const conn=sandbox.exports.makeChatsSocket({...api.DEFAULT_CONNECTION_CONFIG,...config,markOnlineOnConnect:false});
 ev.emit('connection.update',{connection:'open'});const result=await conn.retryInitialQueries();
 assert.equal(result.status,'complete');assert.equal(props,2);assert.equal(entries.some(e=>e.level==='error'),false);
 ev.emit('connection.update',{connection:'close'});close();
});
test('username parser accepts text and binary UTF-8',()=>{
 const p=new api.USyncUsernameProtocol();for(const content of ['Techxzxy0',Buffer.from('Techxzxy0'),new Uint8Array(Buffer.from('Techxzxy0'))])assert.equal(p.parser({tag:'username',attrs:{},content}),'Techxzxy0');
 assert.equal(p.parser({tag:'username',attrs:{}}),null);
});
function profileSocket(){
 const {socket,close}=mock();let requested;
 socket.executeUSyncQuery=async q=>{requested=q;return {list:q.users.map(u=>({id:u.id,username:'Techxzxy0'}))}};
 socket.fetchStatus=async id=>[{id,status:{status:'Hola',setAt:new Date(0)}}];
 socket.getBusinessProfile=async()=>({website:['https://example.com','https://example.org','https://example.com']});
 socket.updateProfileStatus=async value=>value;
 installProfileTools(socket);return {socket,close,getRequested:()=>requested};
}
test('username lookup uses the real username USync protocol for PN and LID',async()=>{
 const {socket,getRequested,close}=profileSocket();const result=await socket.fetchUsernames('1@s.whatsapp.net','2@lid');
 assert.equal(result.length,2);assert.equal(result[0].username,'Techxzxy0');assert.equal(getRequested().protocols[0].name,'username');assert.equal(getRequested().users[1].id,'2@lid');close();
});
test('unavailable usernames stay unknown, never fabricated from the LID',async()=>{
 const {socket,close}=profileSocket();socket.executeUSyncQuery=async()=>({list:[]});const [row]=await socket.fetchUsernames('193016602046489@lid');assert.equal(row.username,null);assert.equal(row.returnedByServer,false);close();
});
test('username resolution only uses actual known contact metadata',async()=>{
 const {socket,close}=profileSocket();await assert.rejects(socket.resolveUsername('@nobody'),{code:'USERNAME_NOT_RESOLVED'});
 socket.ev.emit('contacts.update',[{id:'2@lid',username:'Known'}]);assert.equal((await socket.resolveUsername('@known')).jid,'2@lid');close();assert.equal(socket.ev.listenerCount('contacts.update'),0);
});
test('malformed username and non-user JIDs are rejected before sending',async()=>{
 const {socket,close}=profileSocket();assert.equal(await socket.fetchUsername('@Techxzxy0'),null);assert.equal(await socket.fetchUsername('1@g.us'),null);await assert.rejects(socket.fetchUsernames('@Techxzxy0'),TypeError);await assert.rejects(socket.resolveUsername('@has space'),TypeError);close();
});
test('combined profile retains all business links without duplicates',async()=>{
 const {socket,close}=profileSocket();const p=await socket.fetchUserProfile('2@lid');assert.equal(p.username,'Techxzxy0');assert.equal(p.about.status,'Hola');assert.deepEqual(p.links,['https://example.com','https://example.org']);assert.equal(p.complete,true);close();
});
test('profile access failures are explicitly partial, not treated as no data',async()=>{
 const {socket,close}=profileSocket();socket.getBusinessProfile=async()=>{throw timeout()};const p=await socket.fetchUserProfile('2@lid');assert.equal(p.complete,false);assert.equal(p.errors.business.code,408);assert.equal(p.username,'Techxzxy0');close();
});
test('About text updates remain supported but unverified schedule/audience writes fail safely',async()=>{
 const {socket,close}=profileSocket();assert.equal(await socket.updateAbout('Hola'),'Hola');await assert.rejects(socket.updateAbout('Hola',{expiresAt:Date.now()}),{code:'ABOUT_OPTIONS_UNSUPPORTED'});assert.equal(socket.getProfileCapabilities().temporaryAboutWrite,false);close();
});
test('About parser preserves server metadata without inventing missing attributes',()=>{
 const p=parseAboutNode({tag:'status',attrs:{t:'100',expiration:'200',emoji:'❤️',audience:'contacts'},content:Buffer.from('Hola')});assert.equal(+p.setAt,100000);assert.equal(+p.expiresAt,200000);assert.equal(p.rawAttributes.audience,'contacts');
 const empty=parseAboutNode({tag:'status',attrs:{code:'401'}});assert.equal(empty.status,'');assert.equal(empty.expiresAt,undefined);
});
test('native Button builds offline and serializes, fixing the undefined variable',async()=>{
 const raw=await new MB.Button().header('Menú').text('Hola').button('Sí','yes').footer('Kage').build();assert.equal(raw.interactiveMessage.body.text,'Hola');assert.equal(api.proto.Message.verify(raw),null);assert.ok(api.proto.Message.encode(raw).finish().length);
});
test('native Button builds recipient envelope and sends exactly once',async()=>{
 const sent=[];const socket={relayMessage:async(...args)=>sent.push(args)};const B=MB.bind(socket);const msg=await new B.Button().text('Hola').button('Sí','yes').send('2@s.whatsapp.net');assert.equal(sent.length,1);assert.equal(sent[0][2].messageId,msg.key.id);
});
test('native row callbacks create real native-flow buttons',async()=>{
 const raw=await new MB.Button().text('Opciones').row(r=>r.button('A','a').button('B','b')).build();assert.equal(raw.interactiveMessage.nativeFlowMessage.buttons.length,2);
});
test('legacy ButtonV2 builds offline and keeps response IDs',async()=>{
 const raw=await new MB.ButtonV2().text('Menú').row(r=>r.button('A','a')).build();assert.equal(raw.buttonsMessage.buttons[0].buttonId,'a');assert.equal(api.proto.Message.verify(raw),null);
});
test('carousel callback cards are neither dropped nor duplicated on repeat builds',async()=>{
 const builder=new MB.Carousel().text('Tarjetas').card(c=>c.title('Uno').text('Texto').button('Ver','one'));
 for(let i=0;i<2;i++){const raw=await builder.build();assert.equal(raw.interactiveMessage.carouselMessage.cards.length,1);assert.equal(raw.interactiveMessage.carouselMessage.cards[0].body.text,'Texto');}
});
test('carousel requires at least one card and media needs an upload socket',async()=>{
 await assert.rejects(new MB.Carousel().build(),/at least/);await assert.rejects(new MB.Button().text('Imagen').image(Buffer.from('x')).button('Ver','id').build(),/upload requires/);
});
test('viewOnce wraps a built payload and does not corrupt its protobuf',async()=>{
 const raw=await new MB.Button().text('Hola').button('Sí','yes').viewOnce().build();assert.ok(raw.viewOnceMessage.message.interactiveMessage);assert.equal(api.proto.Message.verify(raw),null);
});
test('AIRich preserves text, link, code and table builders offline',async()=>{
 const raw=await new MB.AIRich().text('Visita [Ejemplo](https://example.com)').addCode('javascript','const n = 1').addTable([['Título'],['Valor']]).build();
 assert.ok(raw.botForwardedMessage.message.richResponseMessage);assert.equal(raw.botForwardedMessage.message.richResponseMessage.submessages[1].codeMetadata.codeLanguage,'javascript');const encoded=api.proto.Message.encode(api.proto.Message.fromObject(raw)).finish();assert.ok(encoded.length);
 const unparsed=await new MB.AIRich().hyperlink(false).citation(false).latex(false).extract(false).text('[Ejemplo](https://example.com)').build();assert.equal(unparsed.botForwardedMessage.message.richResponseMessage.submessages[0].messageText,'[Ejemplo](https://example.com)');
});
test('legacy button payloads modernize with the same response IDs',()=>{
 const raw=compat.modernizeInteractiveMessage({buttonsMessage:{contentText:'Hola',buttons:[{buttonId:'yes',buttonText:{displayText:'Sí'},type:1}]}});
 const flow=compat.unwrapKageMessage(raw).interactiveMessage.nativeFlowMessage;assert.equal(JSON.parse(flow.buttons[0].buttonParamsJson).id,'yes');assert.equal(compat.validateKageInteractiveMessage(raw).valid,true);
});
test('historical lists preserve sections and selected row identifiers',()=>{
 const raw=compat.modernizeInteractiveMessage({listMessage:{description:'Hola',buttonText:'Abrir',sections:[{title:'Uno',rows:[{rowId:'x',title:'X'}]}]}});const b=compat.unwrapKageMessage(raw).interactiveMessage.nativeFlowMessage.buttons[0];assert.equal(JSON.parse(b.buttonParamsJson).sections[0].rows[0].id,'x');
});
test('historical URL templates convert to validated URL native flow',()=>{
 const raw=compat.modernizeInteractiveMessage({templateMessage:{hydratedTemplate:{hydratedContentText:'Hola',hydratedButtons:[{urlButton:{displayText:'Web',url:'https://example.com'}}]}}});assert.equal(compat.validateKageInteractiveMessage(raw).valid,true);
});
test('historical conversion fails clearly for malformed buttons and URLs',()=>{
 assert.throws(()=>compat.modernizeInteractiveMessage({buttons:[{}]}),/requires/);assert.throws(()=>compat.modernizeInteractiveMessage({buttons:[]}),/No convertible/);
 assert.throws(()=>compat.modernizeInteractiveMessage({templateMessage:{hydratedTemplate:{hydratedButtons:[{urlButton:{displayText:'Web',url:'javascript:bad'}}]}}}),/HTTP/);
});
test('all established interactive reply types yield the original response ID',()=>{
 const inputs=[{buttonsResponseMessage:{selectedButtonId:'a'}},{listResponseMessage:{singleSelectReply:{selectedRowId:'a'}}},{templateButtonReplyMessage:{selectedId:'a'}},{interactiveResponseMessage:{nativeFlowResponseMessage:{name:'quick_reply',paramsJson:'{"id":"a"}'}}}];
 for(const message of inputs)assert.equal(compat.parseInteractiveResponse({message}).id,'a');
});
test('malformed native responses do not throw or misrepresent a selected ID',()=>{
 assert.equal(compat.parseInteractiveResponse({interactiveResponseMessage:{nativeFlowResponseMessage:{paramsJson:'{bad'}}}).error,'INVALID_RESPONSE_JSON');assert.equal(compat.parseInteractiveResponse({conversation:'Hola'}),null);
});
test('native conversion sends exactly once, never automatically retries a mutation',async()=>{
 let calls=0;const conn={relayMessage:async()=>{calls++;throw timeout()}};
 await assert.rejects(compat.sendCompatibleButtons(conn,'2@s.whatsapp.net',{buttons:[{buttonId:'a',buttonText:{displayText:'A'}}]}),/Timed Out/);assert.equal(calls,1);
});
test('official poll snapshot uses field 114 on the wire',()=>{
 const message=api.proto.Message.fromObject({pollResultSnapshotMessageV3:{}});const bytes=api.proto.Message.encode(message).finish();const pb=require('protobufjs/minimal');const reader=pb.Reader.create(bytes);assert.equal(reader.uint32()>>>3,114);
});
test('historical poll field 115 stays decodable',()=>{
 const message=api.proto.Message.fromObject({pollResultSnapshotMessageV3Legacy:{}});const bytes=api.proto.Message.encode(message).finish();const pb=require('protobufjs/minimal');const reader=pb.Reader.create(bytes);assert.equal(reader.uint32()>>>3,115);assert.ok(api.proto.Message.decode(bytes).pollResultSnapshotMessageV3Legacy);
});
test('new exports are identical in ESM and CommonJS',async()=>{
 const esm=await import('../lib/index.mjs');for(const name of ['MessageBuilder','bind','createInitQueryRunner','installProfileTools','modernizeInteractiveMessage','parseInteractiveResponse','sendCompatibleButtons'])assert.equal(esm[name],api[name],name);
});
test('package has one Signal dependency and no secondary Baileys installation',()=>{
 const p=require('../package.json');assert.equal(p.dependencies.libsignal,'^6.0.0');assert.equal(Object.keys(p.dependencies).some(n=>/baileys/i.test(n)),false);assert.equal(Object.keys(p.dependencies).some(n=>n.startsWith('@')&&n.includes('libsignal')),false);
});
