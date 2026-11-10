import { proto } from '../../WAProto';
export interface ListRow { id: string; title: string; description?: string; }
export interface ListSection { title: string; rows: ListRow[]; }
export interface BuilderSocket {
    user?: { id?: string; jid?: string };
    relayMessage(jid: string, message: proto.Message.$Properties, options: Record<string, unknown>): Promise<unknown>;
}
export interface BuilderSendOptions {
    quoted?: proto.WebMessageInfo;
    messageId?: string;
    additionalNodes?: Array<{ tag: string; attrs: Record<string, string>; content?: unknown }>;
    [key: string]: unknown;
}
export declare class MessageBuilder {
    static VERSION: string;
    static Button: any; static ButtonV2: any; static Carousel: any;
    static AIRich: any; static ORich: any; static Toolkit: any;
    static bind(socket: BuilderSocket): Record<string, any>;
    constructor(socket?: BuilderSocket);
    text(text: string): this;
    setBody(text: string): this;
    title(text: string): this;
    setTitle(text: string): this;
    footer(text: string): this;
    setFooter(text: string): this;
    viewOnce(enabled?: boolean): this;
    setContextInfo(value: proto.ContextInfo.$Properties): this;
    quickReply(label: string, id: string): this;
    addReply(label: string, id: string): this;
    url(label: string, value: string): this;
    addUrl(label: string, value: string): this;
    list(label: string, sections: ListSection[]): this;
    build(): proto.Message;
    send(jid: string, options?: BuilderSendOptions): Promise<proto.WebMessageInfo>;
}
