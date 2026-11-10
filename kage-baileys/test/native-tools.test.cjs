'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const root = path.join(__dirname, '..');
const nativeRequire = require;
const cache = new Map();
const binary = {
    ...require('../lib/WABinary/jid-utils'),
    getBinaryNodeChild: (node, tag) => Array.isArray(node?.content) ? node.content.find(child => child.tag === tag) : undefined,
    assertNodeErrorFree: node => {
        if (node?.attrs?.type === 'error' || node?.attrs?.code || binary.getBinaryNodeChild(node, 'error')) throw new Error('Server error');
    }
};
const proto = { Message: { fromObject: value => structuredClone(value) } };
const generated = [];
const generateWAMessageFromContent = (jid, message, options) => {
    generated.push({jid,message,options});
    return {key:{id:options.messageId || 'generated-id',remoteJid:jid},message};
};
const protocols = Object.fromEntries(['Device','Contact','Status','DisappearingMode','BotProfile','LID'].map(name => [
    'USync'+name+'Protocol', class {
        constructor(){this.name=name.toLowerCase();}
        getQueryElement(){return {tag:this.name,attrs:{}};}
        getUserElement(){return null;}
        parser(node){return node.content;}
    }
]));
function load(relative, overrides = {}, timers = {}) {
    const filename = path.join(root, relative);
    if (!Object.keys(overrides).length && !Object.keys(timers).length && cache.has(filename)) return cache.get(filename);
    const module = {exports:{}};
    const localRequire = spec => {
        if (Object.hasOwn(overrides,spec)) return overrides[spec];
        if (spec.includes('WABinary')) return binary;
        if (spec === '../../WAProto/index.js') return {proto};
        if (spec === './messages.js') return {generateWAMessageFromContent};
        if (/\/Protocols(?:\/index\.js)?$/.test(spec)) return protocols;
        if (spec === '../WAUSync') return {...load('lib/WAUSync/USyncQuery.js'),...load('lib/WAUSync/USyncUser.js')};
        if (spec === './init-queries') return {queryErrorSummary:error=>({message:error.message})};
        if (spec.startsWith('.')) {
            let file = path.resolve(path.dirname(filename),spec);
            if (!path.extname(file)) file += '.js';
            return load(path.relative(root,file));
        }
        return nativeRequire(spec);
    };
    const context = {module,exports:module.exports,require:localRequire,Buffer,Uint8Array,URL,console,
        setTimeout,clearTimeout,setInterval,clearInterval,structuredClone,...timers};
    vm.runInNewContext(fs.readFileSync(filename,'utf8'), context, {filename});
    if (!Object.keys(overrides).length && !Object.keys(timers).length) cache.set(filename,module.exports);
    return module.exports;
}
const {USyncQuery} = load('lib/WAUSync/USyncQuery.js');
const {USyncUser} = load('lib/WAUSync/USyncUser.js');
const {USyncUsernameProtocol} = load('lib/WAUSync/Protocols/USyncUsernameProtocol.js');
const {MessageBuilder} = load('lib/Utils/message-builder.js');
const {installUsernameTools,queryUsernames,normalizeUserJid} = load('lib/Utils/username.js');
const row = (id,username) => ({tag:'user',attrs:{jid:id},content:[{tag:'username',attrs:{},content:username}]});
const response = (...users) => ({tag:'iq',attrs:{type:'result'},content:[{tag:'usync',attrs:{},content:[{tag:'list',attrs:{},content:users}]}]});

test('username parser accepts strings, Buffer and Uint8Array',()=>{
    const parser=new USyncUsernameProtocol();
    for(const content of ['Techxzxy',Buffer.from('Techxzxy'),new Uint8Array(Buffer.from('Techxzxy'))])
        assert.equal(parser.parser({tag:'username',attrs:{},content}),'Techxzxy');
});
test('username parser accepts username/value attrs but not display names',()=>{
    const parser=new USyncUsernameProtocol();
    assert.equal(parser.parser({tag:'username',attrs:{username:'@OscarSaul12'}}),'OscarSaul12');
    assert.equal(parser.parser({tag:'username',attrs:{value:'Techxzxy'}}),'Techxzxy');
    assert.equal(parser.parser({tag:'username',attrs:{name:'Fake'}}),null);
});
test('username parser rejects wrong tags, empty and malformed values',()=>{
    const parser=new USyncUsernameProtocol();
    for(const content of ['', ' ', 'a b', 'a/b', 'a@b','a\u0000b']) assert.equal(parser.parser({tag:'username',attrs:{},content}),null);
    assert.equal(parser.parser({tag:'contact',attrs:{},content:'Fake'}),null);
    assert.equal(parser.parser({tag:'username',attrs:{}}),null);
});
test('USync query preserves fluent methods and prevents duplicate protocols',()=>{
    const q=new USyncQuery().withMode('query').withContext('interactive').withUsernameProtocol().withUsernameProtocol().withUser(new USyncUser().withId('123@lid'));
    assert.equal(q.protocols.length,1);assert.equal(q.users[0].id,'123@lid');
    for(const method of ['withDeviceProtocol','withContactProtocol','withStatusProtocol','withLIDProtocol','withDisappearingModeProtocol','withBotProfileProtocol'])assert.equal(q[method](),q);
});
test('USync user preserves username, usernameKey and persona fields',()=>{
    const user=new USyncUser().withId('1@lid').withLid('1@lid').withUsername('test').withUsernameKey('key').withPersonaId('persona').withType('user').withPhone('123');
    assert.equal(user.username,'test');assert.equal(user.usernameKey,'key');assert.equal(user.personaId,'persona');
});
test('USync parser extracts username from expected response nesting',()=>{
    const result=new USyncQuery().withUsernameProtocol().parseUSyncQueryResult(response(row('123@lid',Buffer.from('Techxzxy'))));
    assert.equal(result.list[0].username,'Techxzxy');assert.equal(result.list[0].id,'123@lid');
});
test('USync parser tolerates absent lists and filters non-user nodes',()=>{
    const q=new USyncQuery().withUsernameProtocol();
    assert.equal(q.parseUSyncQueryResult({tag:'iq',attrs:{type:'result'}}).list.length,0);
    assert.equal(q.parseUSyncQueryResult({tag:'iq',attrs:{type:'error'}}),undefined);
    assert.equal(q.parseUSyncQueryResult(response({tag:'error',attrs:{jid:'123@lid'}})).list.length,0);
});
test('JID normalization retains namespace and strips device',()=>{
    assert.equal(normalizeUserJid('123:4@lid'),'123@lid');
    assert.equal(normalizeUserJid('123:4@c.us'),'123@s.whatsapp.net');
    assert.notEqual(normalizeUserJid('123@lid'),normalizeUserJid('123@s.whatsapp.net'));
});
test('fetchUsername returns a string, not an array or object',async()=>{
    const socket=installUsernameTools({executeUSyncQuery:async(q,timeout)=>{
        assert.equal(timeout,10000);assert.equal(q.context,'interactive');assert.equal(q.mode,'query');
        return {list:[{id:q.users[0].id,username:'Techxzxy'}]};
    }});
    assert.equal(await socket.fetchUsername('123:4@lid'),'Techxzxy');
});
test('fetchUsernames supports batched, canonicalized and deduplicated targets',async()=>{
    const socket=installUsernameTools({executeUSyncQuery:async q=>({list:q.users.map(user=>({id:user.id,username:'test'}))})});
    const rows=await socket.fetchUsernames('123@lid','123:4@lid','456@s.whatsapp.net');
    assert.equal(rows.length,2);assert.equal(rows[1].jid,'456@s.whatsapp.net');assert.equal(rows[0].source,'usync');
});
test('fetchUsername returns null for missing or mismatched identity',async()=>{
    for(const list of [[],[{id:'456@lid',username:'wrong'}],[{id:'123@s.whatsapp.net',username:'wrong'}]]){
        assert.equal(await installUsernameTools({executeUSyncQuery:async()=>({list})}).fetchUsername('123@lid'),null);
    }
});
test('fetchUsername returns null on server rejection and invalid JIDs',async()=>{
    let calls=0;const socket=installUsernameTools({executeUSyncQuery:async()=>{calls++;throw new Error('Forbidden');}});
    assert.equal(await socket.fetchUsername('123@lid'),null);
    for(const jid of ['@Techxzxy','1@g.us','123','123@newsletter','123@lid@lid'])assert.equal(await socket.fetchUsername(jid),null);
    assert.equal(calls,1);
});
test('batch API rejects invalid IDs and too many targets before network',async()=>{
    const socket={executeUSyncQuery:async()=>assert.fail('Network should not run')};
    await assert.rejects(queryUsernames(socket,['1@g.us']),{name:'TypeError'});
    await assert.rejects(queryUsernames(socket,Array(101).fill('1@lid')),{name:'RangeError'});
    assert.equal((await queryUsernames(socket,[])).length,0);
});
test('hard deadline returns null and clears its timer with a hanging transport',async()=>{
    let callback,delay,cleared=0;
    const tools=load('lib/Utils/username.js',{}, {setTimeout:(fn,ms)=>{callback=fn;delay=ms;return 1;},clearTimeout:()=>cleared++});
    const socket=tools.installUsernameTools({executeUSyncQuery:()=>new Promise(()=>{})});
    const pending=socket.fetchUsername('123@lid');assert.equal(delay,10000);callback();
    assert.equal(await pending,null);assert.equal(cleared,1);
});
test('USync socket sends the exact IQ namespace, domain and query structure',async()=>{
    let sent,deadline;
    const transport={generateMessageTag:()=> 'session-id',query:async(node,ms)=>{sent=node;deadline=ms;return response(row('123@lid','Techxzxy'));}};
    const {makeUSyncSocket}=load('lib/Socket/usync.js',{'@hapi/boom':{Boom:Error},'./socket':{makeSocket:()=>transport}});
    const socket=makeUSyncSocket({});assert.equal(await socket.fetchUsername('123@lid'),'Techxzxy');
    assert.equal(sent.attrs.to,'s.whatsapp.net');assert.equal(sent.attrs.xmlns,'usync');assert.equal(sent.attrs.type,'get');assert.equal(deadline,10000);
    const usync=sent.content[0];assert.equal(usync.attrs.mode,'query');assert.equal(usync.attrs.context,'interactive');assert.equal(usync.attrs.sid,'session-id');
    assert.equal(usync.content[0].tag,'query');assert.equal(usync.content[0].content[0].tag,'username');assert.equal(usync.content[1].content[0].attrs.jid,'123@lid');
});
test('USync timeout option is optional for existing call sites',async()=>{
    let ms;
    const {makeUSyncSocket}=load('lib/Socket/usync.js',{'@hapi/boom':{Boom:Error},'./socket':{makeSocket:()=>({generateMessageTag:()=> 'id',query:async(_node,timeout)=>{ms=timeout;return response();}})}});
    const sock=makeUSyncSocket({});await sock.executeUSyncQuery(new USyncQuery().withUsernameProtocol());assert.equal(ms,undefined);
});
test('profile installer retains cache-based reverse resolution with new string API',async()=>{
    const {installProfileTools}=load('lib/Utils/profile-tools.js');
    const end=[];const socket={ev:new EventEmitter(),registerSocketEndHandler:fn=>end.push(fn),executeUSyncQuery:async q=>({list:q.users.map(u=>({id:u.id,username:'Techxzxy'}))})};
    installProfileTools(socket);assert.equal(await socket.fetchUsername('123@lid'),'Techxzxy');
    assert.equal((await socket.resolveUsername('@techxzxy')).jid,'123@lid');
    end.forEach(fn=>fn());assert.equal(socket.ev.listenerCount('contacts.update'),0);
});
test('fetchUserProfile consumes string username rather than legacy array',async()=>{
    const {installProfileTools}=load('lib/Utils/profile-tools.js');
    const socket={ev:new EventEmitter(),executeUSyncQuery:async()=>({list:[{id:'123@lid',username:'Techxzxy'}]}),fetchStatus:async()=>[{id:'123@lid',status:{status:'Hola'}}]};
    installProfileTools(socket);const result=await socket.fetchUserProfile('123@lid',{business:false});
    assert.equal(result.username,'Techxzxy');assert.equal(result.about.status,'Hola');
});
test('text-only build uses extendedTextMessage',()=>{
    const result=new MessageBuilder().title('Título').text('Hola').footer('Kage').build();
    assert.equal(result.extendedTextMessage.text,'Título\nHola\nKage');
});
test('native quick replies and URLs use current named flow payloads',()=>{
    const result=new MessageBuilder().text('Hola').quickReply('Ver','show').url('Web','https://example.com').build();
    const interactive=result.viewOnceMessage.message.interactiveMessage;
    assert.equal(interactive.nativeFlowMessage.buttons[0].name,'quick_reply');
    assert.equal(JSON.parse(interactive.nativeFlowMessage.buttons[0].buttonParamsJson).id,'show');
    const params=JSON.parse(interactive.nativeFlowMessage.buttons[1].buttonParamsJson);
    assert.equal(params.url,'https://example.com/');assert.equal(params.merchant_url,params.url);
});
test('lists use single_select with copied sections and rows',()=>{
    const sections=[{title:'Opciones',rows:[{id:'one',title:'Uno',description:'Detalle'}]}];
    const builder=new MessageBuilder().text('Menú').list('Elegir',sections).viewOnce(false);
    sections[0].rows[0].title='Changed';
    const button=builder.build().interactiveMessage.nativeFlowMessage.buttons[0];
    assert.equal(button.name,'single_select');assert.equal(JSON.parse(button.buttonParamsJson).sections[0].rows[0].title,'Uno');
});
test('empty messages, lists and duplicated IDs are rejected',()=>{
    assert.throws(()=>new MessageBuilder().build(),/empty/);
    assert.throws(()=>new MessageBuilder().list('Elegir',[]),/sections/);
    assert.throws(()=>new MessageBuilder().quickReply('Uno','1').quickReply('Dos','1'),/Duplicate/);
    assert.throws(()=>new MessageBuilder().quickReply('Uno','1').list('Elegir',[{title:'A',rows:[{id:'1',title:'Dos'}]}]),/Duplicate/);
});
test('builder prevents dangerous URLs and embedded credentials',()=>{
    for(const url of ['javascript:alert(1)','ftp://example.com','https://user:secret@example.com'])assert.throws(()=>new MessageBuilder().url('Web',url));
});
test('failed list validation leaves builder state unchanged',()=>{
    const builder=new MessageBuilder().text('Hola');
    assert.throws(()=>builder.list('Elegir',[{title:'A',rows:[{id:'one',title:'Uno'},{id:'two',title:''}]}]));
    assert.doesNotThrow(()=>builder.quickReply('Uno','one'));
});
test('build creates a fresh payload and keeps contextInfo',()=>{
    const builder=new MessageBuilder().text('Hola').quickReply('Ver','show').setContextInfo({mentionedJid:['123@lid']});
    const first=builder.build();first.viewOnceMessage.message.interactiveMessage.body.text='Changed';
    const second=builder.build();assert.equal(second.viewOnceMessage.message.interactiveMessage.body.text,'Hola');assert.equal(second.viewOnceMessage.message.interactiveMessage.contextInfo.mentionedJid[0],'123@lid');
});
test('send generates and relays exactly the same message ID with quoted options',async()=>{
    const sent=[];const socket={user:{id:'1@s.whatsapp.net'},relayMessage:async(...args)=>sent.push(args)};
    const quoted={key:{id:'quoted',remoteJid:'123@lid'}};
    const message=await new MessageBuilder(socket).text('Hola').quickReply('Ver','show').send('123@lid',{quoted,messageId:'custom-id'});
    assert.equal(message.key.id,'custom-id');assert.equal(sent[0][2].messageId,message.key.id);assert.equal(generated.at(-1).options.quoted,quoted);assert.equal(generated.at(-1).options.userJid,'1@s.whatsapp.net');
});
test('send rejects missing socket, missing session and unsupported targets',async()=>{
    await assert.rejects(new MessageBuilder().text('Hola').send('1@lid'),/socket/);
    await assert.rejects(new MessageBuilder({relayMessage:async()=>{}}).text('Hola').send('1@lid'),/authenticated/);
    await assert.rejects(new MessageBuilder({user:{id:'1@lid'},relayMessage:async()=>{}}).text('Hola').send('1@newsletter'),/destination/);
});
test('existing relay integration produces the native-flow biz node for new builder',()=>{
    const compat=require('../lib/Utils/interactive-compat');
    const message=new MessageBuilder().text('Hola').quickReply('Ver','show').build();
    const stanza={tag:'message',attrs:{to:'123@lid'},content:[]};
    compat.applyKageInteractiveNodes(stanza,message);
    const biz=stanza.content.find(node=>node.tag==='biz');assert.ok(biz);assert.equal(biz.content[0].content[0].attrs.name,'mixed');
});
test('TS sources and declarations are distributed and package dependencies are unchanged',()=>{
    const digest = value => require('node:crypto').createHash('sha256').update(JSON.stringify(value)).digest('hex');
    const current=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
    assert.equal(digest(current.dependencies),'4fadd5e9d6297466b62b024bb577afc75ee71230a29acc9e3f6da721ed327ee4');assert.equal(digest(current.devDependencies),'4263cba54aad0f5cea47486f69e7fa034cf45e2ec3cda74ad2e3957b8e40264f');
    for(const filename of ['lib/Utils/message-builder.ts','lib/Utils/message-builder.d.ts','lib/Utils/username.ts','lib/Utils/username.d.ts'])assert.ok(fs.statSync(path.join(root,filename)).size>0);
});
