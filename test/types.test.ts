import makeWASocket, {proto, say, generateWAMessageContent, useMultiFileAuthState} from 'kage-baileys';
const message: proto.Message.$Properties = {conversation:'Prueba'};
const encoded: Uint8Array = proto.Message.encode(message).finish();
void encoded; void makeWASocket; void useMultiFileAuthState; void generateWAMessageContent;
say('kage baileys',{font:'simple',gradient:['red','magenta']});
