'use strict';
const fs = require('fs');
const path = require('path');
 
 
const api = require('../lib');
let declaration = `import { proto } from '../WAProto';
import { EventEmitter } from 'events';
export { proto } from '../WAProto';
export { proto as WAProto } from '../WAProto';
export type WAMessage = proto.WebMessageInfo;
export type WAMessageKey = proto.MessageKey;
export type WAMessageContent = proto.Message.$Properties;
export type EventMessage = proto.Message.EventMessage.$Properties;
export interface SocketConfig {
    auth: any;
    logger?: any;
    browser?: [string, string, string];
    syncFullHistory?: boolean;
    initialSyncTimeoutMs?: number;
    markOnlineOnConnect?: boolean;
    shouldSyncHistoryMessage?: (notification: any) => boolean;
    getMessage?: (key: WAMessageKey) => Promise<WAMessageContent | undefined>;
    [option: string]: any;
}
export interface WASocket {
    ev: EventEmitter & { process(handler: (events: Record<string, any>) => any): () => void };
    user?: { id: string; name?: string; lid?: string };
    relayMessage(jid: string, message: WAMessageContent, options?: Record<string, any>): Promise<string>;
    sendMessage(jid: string, content: Record<string, any>, options?: Record<string, any>): Promise<WAMessage | undefined>;
    end(error?: Error): void;
    registerSocketEndHandler(handler: () => void | Promise<void>): () => void;
    updateServerTimeOffset(node: { attrs?: { t?: string | number } }): void;
    sendUnifiedSession(): Promise<void>;
    fetchAccountReachoutTimelock(): Promise<{ isActive: boolean; timeEnforcementEnds?: Date; enforcementType: string }>;
    fetchNewChatMessageCap(): Promise<any>;
    fetchUsername(jid: string): Promise<string | null>;
    fetchUsernames(...jids: string[]): Promise<import('./Utils/username').UsernameResult[]>;
    createMessageBuilder(): import('./Utils/message-builder').MessageBuilder;
    [method: string]: any;
}
export declare function makeWASocket(config: SocketConfig): WASocket;
export default makeWASocket;
export declare function normalizeEventMessage(event: EventMessage): proto.Message.EventMessage;
export declare function prepareEventMessage(message: WAMessageContent): WAMessageContent;
export interface BrowserPresets {
    (browser: string): [string, string, string];
    macOS(browser?: string): [string, string, string];
    windows(browser?: string): [string, string, string];
    ubuntu(browser?: string): [string, string, string];
    appropriate(browser?: string): [string, string, string];
}
export declare const Browsers: BrowserPresets;
`;
const typed = new Set(['default', '__esModule', 'proto', 'WAProto', 'makeWASocket', 'normalizeEventMessage', 'prepareEventMessage', 'Browsers', 'MessageBuilder', 'USERNAME_TIMEOUT_MS', 'normalizeUserJid', 'queryUsernames', 'installUsernameTools', 'USyncQuery', 'USyncUser', 'USyncUsernameProtocol', 'SocketScope', 'CommandRegistry', 'BoundedDedup', 'ReconnectPlan', ...Object.keys(require('../lib/Utils/interactive-compat'))]);
for (const name of Object.keys(api).sort()) {
    if (!typed.has(name) && /^[A-Za-z_$][\w$]*$/.test(name)) declaration += `export declare const ${name}: any;\n`;
}
fs.writeFileSync(path.resolve(__dirname, '../lib/index.d.ts'), declaration);
console.log('Public core types and JavaScript-extra declarations generated.');

const names = Object.keys(api).filter(name => name !== 'default' && name !== '__esModule' && /^[A-Za-z_$][\w$]*$/.test(name));
const esm = "import api from './index.js';\nexport default api.default;\n" + names.map(name => `export const ${name} = api.${name};`).join('\n') + '\n';
fs.writeFileSync(path.resolve(__dirname, '../lib/index.mjs'), esm);

fs.appendFileSync(path.join(__dirname, '../lib/index.d.ts'), "\nexport * from './Utils/interactive-compat';\n");

fs.appendFileSync(path.join(__dirname,'../lib/index.d.ts'), "\nexport { SocketScope, CommandRegistry, BoundedDedup, ReconnectPlan } from './Utils/project-runtime';\n");

const interactive = Object.keys(require('../lib/Utils/interactive-compat'));
fs.writeFileSync(path.join(__dirname,'../lib/Utils/interactive-compat.d.ts'), interactive.map(name => 'export declare const '+name+': any;').join('\n')+'\n');

fs.appendFileSync(path.join(__dirname, '../lib/index.d.ts'), "\nexport * from './Utils/message-builder';\nexport * from './Utils/username';\nexport { USyncQuery } from './WAUSync/USyncQuery';\nexport { USyncUser } from './WAUSync/USyncUser';\nexport { USyncUsernameProtocol } from './WAUSync/Protocols/USyncUsernameProtocol';\nexport type { BinaryNode, USyncProtocol, USyncResult } from './Types/native-tools';\n");
