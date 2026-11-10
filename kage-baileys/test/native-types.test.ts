import { MessageBuilder, USyncQuery, USyncUser, USyncUsernameProtocol, type WASocket, type UsernameResult } from '../lib/index.js';
declare const sock: WASocket;
const username: Promise<string | null> = sock.fetchUsername('123@lid');
const rows: Promise<UsernameResult[]> = sock.fetchUsernames('123@lid');
const builder: MessageBuilder = sock.createMessageBuilder();
const query = new USyncQuery().withUsernameProtocol().withUser(new USyncUser().withId('123@lid'));
const parser = new USyncUsernameProtocol();
const message = new MessageBuilder(sock).text('Hola').quickReply('Ver', 'show').url('Web', 'https://example.com').list('Elegir', [{title:'Menú', rows:[{id:'one',title:'Uno'}]}]).build();
void username; void rows; void builder; void query; void parser; void message;
