'use strict';
 
const wrappers = ['viewOnceMessage','viewOnceMessageV2','viewOnceMessageV2Extension','ephemeralMessage','documentWithCaptionMessage'];
function unwrapKageMessage(message) {
    const seen = new Set();
    while (message && typeof message === 'object') {
        if (seen.has(message)) throw new TypeError('Envoltura de mensaje circular');
        seen.add(message);
        const key = wrappers.find(k => message[k]?.message);
        if (!key) return message;
        message = message[key].message;
    }
    return message;
}
const special = new Set(['mpm','cta_catalog','send_location','call_permission_request','wa_payment_transaction_details','automated_greeting_message_view_catalog']);
function buildKageInteractiveBizNode(message) {
    const inner = unwrapKageMessage(message);
    const interactive = inner?.interactiveMessage;
    if (!interactive) return undefined;
     
    const flow = interactive.nativeFlowMessage;
    if (!interactive.carouselMessage && !flow) return undefined;
    const buttons = flow?.buttons || [];
    const name = buttons[0]?.name;
    const uniform = buttons.length > 0 && buttons.every(b => b.name === name);
    if (!interactive.carouselMessage && uniform && (name === 'review_and_pay' || name === 'payment_info')) {
        return { tag:'biz', attrs:{ native_flow_name:name === 'review_and_pay' ? 'order_details' : name } };
    }
    const specialized = !interactive.carouselMessage && uniform && special.has(name);
    return { tag:'biz', attrs:{}, content:[{
        tag:'interactive', attrs:{ type:'native_flow', v:'1' }, content:[{
            tag:'native_flow', attrs:{ v:specialized ? '2' : '9', name:specialized ? name : 'mixed' }
        }]
    }] };
}
function mergeNode(base, extra) {
    const out = { ...base, ...extra, attrs:{ ...base.attrs, ...extra.attrs } };
    if (Array.isArray(base.content) && Array.isArray(extra.content)) {
        out.content = base.content.map(n => ({...n}));
        for (const node of extra.content) {
            const index = out.content.findIndex(n => n.tag === node.tag);
            if (index < 0) out.content.push(node);
            else out.content[index] = mergeNode(out.content[index], node);
        }
    }
    return out;
}
function applyKageInteractiveNodes(stanza, message, additionalNodes = []) {
     
    if (stanza.attrs?.to?.endsWith('@newsletter')) return stanza;
    const generated = buildKageInteractiveBizNode(message);
    if (!generated) return stanza;
    if (!Array.isArray(stanza.content)) throw new TypeError('El nodo de envío no tiene contenido');
     
    const existing = stanza.content.filter(n => n?.tag === 'biz');
    const explicit = (additionalNodes || []).filter(n => n?.tag === 'biz');
    let merged = generated;
    for (const node of existing) {
         
        const rest = Array.isArray(node.content) ? node.content.filter(n => n.tag !== 'interactive') : undefined;
        merged = mergeNode(merged, {tag:'biz', attrs:{...node.attrs}, ...(rest?.length ? {content:rest} : {})});
    }
     
    merged = mergeNode(merged, generated);
     
    for (const node of explicit) merged = mergeNode(merged, node);
    const first = stanza.content.findIndex(n => n?.tag === 'biz');
    const remaining = stanza.content.filter(n => n?.tag !== 'biz');
    remaining.splice(first < 0 ? remaining.length : first, 0, merged);
    stanza.content = remaining;
    return stanza;
}
function jsonObject(value, label) {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new TypeError(label + ' debe ser un objeto JSON');
    return parsed;
}
function createKageNativeFlowButton(name, parameters = {}) {
    if (typeof name !== 'string' || !name.trim()) throw new TypeError('Nombre de botón vacío');
    return { name, buttonParamsJson:JSON.stringify(jsonObject(parameters, 'Parámetros del botón')) };
}
function validateKageInteractiveMessage(message) {
    const errors = [], warnings = [];
    const interactive = unwrapKageMessage(message)?.interactiveMessage;
    if (!interactive) return {valid:false, errors:['No hay interactiveMessage'], warnings};
    const cards = interactive.carouselMessage?.cards;
    if (cards && cards.length === 0) errors.push('El carrusel está vacío');
    if (cards && interactive.nativeFlowMessage) errors.push('carouselMessage y nativeFlowMessage pertenecen al mismo oneof');
    const stable = new Set(['quick_reply','cta_url','cta_copy','cta_call','single_select']);
    for (const [i, item] of (cards || [interactive]).entries()) {
        const prefix = 'Tarjeta ' + (i+1) + ': ';
        const header = item.header;
        if (header) {
            const media = ['imageMessage','videoMessage','documentMessage','locationMessage','productMessage','jpegThumbnail'].filter(k => header[k] != null);
            if (media.length > 1) errors.push(prefix + 'el encabezado tiene varios campos media oneof');
            if (header.hasMediaAttachment && !media.length) errors.push(prefix + 'falta el medio del encabezado');
        }
        const buttons = item.nativeFlowMessage?.buttons || [];
        if (buttons.length > 3) warnings.push(prefix + 'muchos botones; prueba menos o sepáralos para diagnosticar el cliente');
        for (const [j, b] of buttons.entries()) {
            try {
                const p = jsonObject(b.buttonParamsJson, 'buttonParamsJson');
                if (!b.name) errors.push(prefix + 'botón sin nombre');
                if (b.name === 'quick_reply' && (!p.id || !p.display_text)) errors.push(prefix + 'quick_reply requiere id y display_text');
                if (b.name === 'cta_url' && !/^https?:\/\//.test(p.url || '')) errors.push(prefix + 'cta_url requiere URL HTTP(S)');
                if (b.name === 'single_select' && !(p.sections || []).some(s => s.rows?.length)) errors.push(prefix + 'lista sin filas');
                if (b.name === 'single_select' && (p.sections || []).some(s => (s.rows || []).some(r => !r.id))) errors.push(prefix + 'las filas necesitan id');
                if (!stable.has(b.name)) warnings.push(prefix + b.name + ': depende del cliente, permisos o recursos comerciales reales');
            } catch (e) { errors.push(prefix + 'botón ' + (j+1) + ': ' + e.message); }
        }
    }
    return {valid:errors.length === 0, errors, warnings};
}
function createKageInteractiveMessage(interactive, options = {}) {
    const {proto} = require('../../WAProto');
    const raw = {interactiveMessage:interactive};
    const result = validateKageInteractiveMessage(raw);
    if (!result.valid) throw new TypeError(result.errors.join('; '));
    const message = proto.Message.fromObject(raw);
    const error = proto.Message.verify(message);
    if (error) throw new TypeError(error);
    return options.viewOnce === false ? message : {viewOnceMessage:{message}};
}
function createKageCarouselMessage(cards, options = {}) {
    if (!Array.isArray(cards) || !cards.length) throw new TypeError('Se necesita al menos una tarjeta');
    return createKageInteractiveMessage({
        body:{text:options.text ?? ''},
        ...(options.footer ? {footer:{text:options.footer}} : {}),
        carouselMessage:{cards, messageVersion:1}
    }, options);
}
function createKageOrderDetails(parameters) {
    const p = jsonObject(parameters, 'order_details');
    if (!['digital-goods','physical-goods'].includes(p.type)) throw new TypeError('type debe ser digital-goods o physical-goods, no una URL');
    if (!p.reference_id || !/^[A-Z]{3}$/.test(p.currency || '')) throw new TypeError('Faltan reference_id o currency');
    const offset = p.total_amount?.offset;
    if (!Number.isSafeInteger(offset) || offset <= 0 || !Number.isInteger(Math.log10(offset))) throw new TypeError('offset debe ser una potencia de 10');
    function amount(a, label) {
        if (!a || !Number.isSafeInteger(a.value) || a.value < 0 || a.offset !== offset) throw new TypeError(label + ': importe entero no negativo y offset común requerido');
        return BigInt(a.value);
    }
    const total = amount(p.total_amount,'total_amount');
    if (total <= 0n) throw new TypeError('El total debe ser positivo');
    if (!p.order || !Array.isArray(p.order.items) || !p.order.items.length) throw new TypeError('Faltan productos de la orden');
    let sum = 0n;
    for (const item of p.order.items) {
        if (!item.name || !Number.isSafeInteger(item.quantity) || item.quantity < 1) throw new TypeError('Producto o cantidad inválidos');
        sum += amount(item.amount,'item.amount') * BigInt(item.quantity);
    }
    const subtotal = amount(p.order.subtotal,'order.subtotal');
    if (sum !== subtotal) throw new TypeError('El subtotal no coincide con los productos');
    const tax = p.order.tax ? amount(p.order.tax,'tax') : 0n;
    const shipping = p.order.shipping ? amount(p.order.shipping,'shipping') : 0n;
    const discount = p.order.discount ? amount(p.order.discount,'discount') : 0n;
    if (subtotal + tax + shipping - discount !== total) throw new TypeError('El total no coincide con subtotal + impuestos + envío - descuento');
    if (!p.payment_settings?.length && !p.native_payment_methods?.length && !p.payment_configuration) throw new TypeError('Falta una configuración de pago real; usa cta_url para enlaces externos');
    return createKageNativeFlowButton('review_and_pay', p);
}
async function sendKageInteractiveMessage(conn, jid, content, options = {}) {
    if (!conn?.relayMessage) throw new TypeError('Se necesita una conexión Baileys');
    const check = validateKageInteractiveMessage(content);
    if (!check.valid) throw new TypeError(check.errors.join('; '));
    const {generateWAMessageFromContent} = require('./messages');
    const msg = generateWAMessageFromContent(jid, content, {userJid:conn.user?.id, ...options});
    await conn.relayMessage(jid, msg.message, {...options, messageId:msg.key.id});
    return msg;
}
function installKageInteractiveTools(conn) {
    if (!conn.sendCompatibleButtons) conn.sendCompatibleButtons = (jid, content, options) => sendCompatibleButtons(conn, jid, content, options);
    if (!conn.sendKageInteractiveMessage) conn.sendKageInteractiveMessage = (jid, content, options) => sendKageInteractiveMessage(conn,jid,content,options);
    if (!conn.sendKageCarousel) conn.sendKageCarousel = (jid, cards, options = {}) => sendKageInteractiveMessage(conn,jid,createKageCarouselMessage(cards,options),options);
    return conn;
}
module.exports = {unwrapKageMessage,buildKageInteractiveBizNode,applyKageInteractiveNodes,createKageNativeFlowButton,validateKageInteractiveMessage,createKageInteractiveMessage,createKageCarouselMessage,createKageOrderDetails,sendKageInteractiveMessage,installKageInteractiveTools};

/** Translate supported historical button/list payloads before one explicit send. */
function modernizeInteractiveMessage(input, options = {}) {
    const original = unwrapKageMessage(input);
    if (!original || typeof original !== 'object') throw new TypeError('Message object required');
    if (original.interactiveMessage) return createKageInteractiveMessage(original.interactiveMessage, options);
    const legacy = original.buttonsMessage || original;
    const template = original.templateMessage?.hydratedTemplate || original.templateMessage?.hydratedFourRowTemplate;
    const list = original.listMessage || (original.sections ? original : null);
    const buttons = [];
    let text = legacy.contentText ?? legacy.text ?? '', footer = legacy.footerText ?? legacy.footer ?? '', title = legacy.title;
    if (template) {
        text = template.hydratedContentText || ''; footer = template.hydratedFooterText || '';
        for (const item of template.hydratedButtons || []) {
            if (item.quickReplyButton) buttons.push(createKageNativeFlowButton('quick_reply',{display_text:item.quickReplyButton.displayText,id:item.quickReplyButton.id}));
            else if (item.urlButton) buttons.push(createKageNativeFlowButton('cta_url',{display_text:item.urlButton.displayText,url:item.urlButton.url}));
            else if (item.callButton) buttons.push(createKageNativeFlowButton('cta_call',{display_text:item.callButton.displayText,phone_number:item.callButton.phoneNumber}));
            else throw new TypeError('Unsupported historical template button');
        }
    } else if (list) {
        text = list.description ?? list.text ?? ''; footer = list.footerText ?? list.footer ?? ''; title = list.title;
        const sections = (list.sections || []).map(section => ({title:section.title || '',rows:(section.rows || []).map(row => ({id:row.rowId ?? row.id,title:row.title || '',description:row.description || ''}))}));
        buttons.push(createKageNativeFlowButton('single_select',{title:list.buttonText || 'Opciones',sections}));
    } else {
        for (const item of legacy.buttons || []) {
            if (item.nativeFlowInfo) buttons.push(createKageNativeFlowButton(item.nativeFlowInfo.name,item.nativeFlowInfo.paramsJson || '{}'));
            else if (item.name && item.buttonParamsJson) buttons.push(createKageNativeFlowButton(item.name,item.buttonParamsJson));
            else if (item.buttonId && item.buttonText?.displayText) buttons.push(createKageNativeFlowButton('quick_reply',{display_text:item.buttonText.displayText,id:item.buttonId}));
            else throw new TypeError('Historical button requires buttonId and displayText');
        }
    }
    if (!buttons.length) throw new TypeError('No convertible buttons or list sections');
    const header = {hasMediaAttachment:false,...(title ? {title} : {})};
    for (const key of ['imageMessage','videoMessage','documentMessage','locationMessage']) if (legacy[key]) {header[key]=legacy[key];header.hasMediaAttachment=true;}
    return createKageInteractiveMessage({header,body:{text},...(footer ? {footer:{text:footer}} : {}),
        ...(legacy.contextInfo ? {contextInfo:legacy.contextInfo} : {}),nativeFlowMessage:{buttons,messageParamsJson:'{}'}},options);
}
function parseInteractiveResponse(input) {
    const message = unwrapKageMessage(input?.message || input);
    const button = message?.buttonsResponseMessage;
    if (button) return {kind:'button',id:button.selectedButtonId ?? null,title:button.selectedDisplayText ?? null};
    const template = message?.templateButtonReplyMessage;
    if (template) return {kind:'template',id:template.selectedId ?? null,title:template.selectedDisplayText ?? null};
    const list = message?.listResponseMessage;
    if (list) return {kind:'list',id:list.singleSelectReply?.selectedRowId ?? null,title:list.title ?? null};
    const native = message?.interactiveResponseMessage?.nativeFlowResponseMessage;
    if (!native) return null;
    if (typeof native.paramsJson !== 'string' || native.paramsJson.length > 65536) return {kind:'native',name:native.name,id:null,error:'INVALID_RESPONSE_JSON'};
    try {
        const parameters = jsonObject(native.paramsJson,'paramsJson');
        return {kind:'native',name:native.name,id:parameters.id ?? parameters.selected_row_id ?? null,
            title:parameters.display_text ?? message.interactiveResponseMessage.body?.text ?? null,parameters};
    } catch { return {kind:'native',name:native.name,id:null,error:'INVALID_RESPONSE_JSON'}; }
}
async function sendCompatibleButtons(conn, jid, content, options = {}) {
    const {mode = 'native', ...sendOptions} = options;
    if (!['native','legacy'].includes(mode)) throw new TypeError('mode must be native or legacy');
    if (mode === 'native') return sendKageInteractiveMessage(conn,jid,modernizeInteractiveMessage(content,sendOptions),sendOptions);
    const raw = unwrapKageMessage(content);
    if (!raw?.buttonsMessage && !raw?.templateMessage && !raw?.listMessage) throw new TypeError('Legacy mode requires an explicit protobuf buttonsMessage, templateMessage or listMessage');
    const {generateWAMessageFromContent} = require('./messages');
    const msg = generateWAMessageFromContent(jid,raw,{userJid:conn.user?.id,...sendOptions});
    await conn.relayMessage(jid,msg.message,{...sendOptions,messageId:msg.key.id});
    return msg;
}
module.exports.modernizeInteractiveMessage = modernizeInteractiveMessage;
module.exports.parseInteractiveResponse = parseInteractiveResponse;
module.exports.sendCompatibleButtons = sendCompatibleButtons;
