'use strict';
const {MessageBuilder, parseInteractiveResponse} = require('../lib');

async function readProfile(socket, jid) {
    return socket.fetchUserProfile(jid, {business:true, picture:false});
}

// Call explicitly from your existing bot command; nothing is sent merely by importing this file.
async function sendMenu(socket, jid) {
    const MB = MessageBuilder.bind(socket);
    return new MB.Button().header('Chiaki').text('Selecciona una opción')
        .button('Perfil', 'perfil').button('Ayuda', 'ayuda').footer('Kage Baileys').send(jid);
}

async function sendHistoricalMenuAsNative(socket, jid) {
    return socket.sendCompatibleButtons(jid, {buttonsMessage:{
        contentText:'Opciones', footerText:'Chiaki',
        buttons:[{buttonId:'perfil',buttonText:{displayText:'Ver perfil'},type:1}]
    }});
}

function readSelection(message) { return parseInteractiveResponse(message); }
function watchInitialReads(socket, listener) {
    socket.ev.on('init.queries.update', listener);
    return () => socket.ev.off('init.queries.update', listener);
}
module.exports = {readProfile, sendMenu, sendHistoricalMenuAsNative, readSelection, watchInitialReads};
