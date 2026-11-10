import type { BinaryNode, USyncProtocol, USyncResult } from '../Types/native-tools';
import type { USyncUser } from './USyncUser';
export declare class USyncQuery {
    protocols: USyncProtocol[]; users: USyncUser[]; context: string; mode: string;
    withMode(mode: string): this;
    withContext(context: string): this;
    withUser(user: USyncUser): this;
    withUsernameProtocol(): this;
    withDeviceProtocol(): this;
    withContactProtocol(): this;
    withStatusProtocol(): this;
    withDisappearingModeProtocol(): this;
    withBotProfileProtocol(): this;
    withLIDProtocol(): this;
    parseUSyncQueryResult(result: BinaryNode): USyncResult | undefined;
}
