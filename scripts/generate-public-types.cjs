'use strict';
const fs = require('fs');
const path = require('path');
// The source archive shipped a types entrypoint without its file.
// Core surfaces are typed; inherited JavaScript extras intentionally retain any.
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
const typed = new Set(['default', '__esModule', 'proto', 'WAProto', 'makeWASocket', 'normalizeEventMessage', 'prepareEventMessage', 'Browsers']);
for (const name of Object.keys(api).sort()) {
    if (!typed.has(name) && /^[A-Za-z_$][\w$]*$/.test(name)) declaration += `export declare const ${name}: any;\n`;
}
fs.writeFileSync(path.resolve(__dirname, '../lib/index.d.ts'), declaration);
console.log('Public core types and JavaScript-extra declarations generated.');

const names = Object.keys(api).filter(name => name !== 'default' && name !== '__esModule' && /^[A-Za-z_$][\w$]*$/.test(name));
const esm = "import api from './index.js';\nexport default api.default;\n" + names.map(name => `export const ${name} = api.${name};`).join('\n') + '\n';
fs.writeFileSync(path.resolve(__dirname, '../lib/index.mjs'), esm);
