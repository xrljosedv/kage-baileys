"use strict";
const layers = ['chats', 'newsletter', 'messages-send', 'business', 'community', 'socket'];
exports.installExtensions = (socket, config) => {
    for (const layer of layers) {
        const additions = require('./' + layer).attach(socket, config);
        for (const key of Object.keys(additions)) {
            if (!(key in socket)) socket[key] = additions[key];
        }
    }
    if(socket.signalRepository && !socket.signalRepository.lidMapping) socket.signalRepository.lidMapping=new (require('../Signal/lid-mapping').LIDMappingStore)(socket.authState.keys,config.logger);
    const advancedLayers=['chats','groups','newsletter','messages-send','business','communities'];
    for(const layer of advancedLayers){
      const file=require('node:path').join(__dirname,layer+'-advanced.js');
      if(!require('node:fs').existsSync(file))continue;
      const additions=require(file).attachAdvanced(socket,config);
      for(const [key,value]of Object.entries(additions))if(!(key in socket))socket[key]=value;
      if(layer==='messages-send'){
        const originalSend=socket.sendMessage.bind(socket);
        socket.sendMessage=(jid,content,options={})=>{
          const useAdvanced=require('../Utils/messages').hasAdvancedMessageOptions(content)||require('../WABinary').isJidNewsletter(jid)||Array.isArray(content?.album);
          return useAdvanced?additions.sendMessage(jid,content,options):originalSend(jid,content,options);
        };
      }
    }
    socket.registerSocketEndHandler?.(() => {
        socket.messageRetryManager?.clear?.();
        socket.signalRepository?.lidMapping?.close?.();
    });
    return socket;
};
