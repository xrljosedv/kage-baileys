export type RestrictionType = 'reachout_timelock' | 'new_chat_limit';
export declare const RESTRICTION_ERROR_CODES: Record<number, RestrictionType>;
export type AckRestrictionInfo = {
    type: RestrictionType;
    code: number;
    jid?: string;
    messageId?: string;
    raw: Record<string, string | undefined>;
};
export type BoomRestrictionInfo = {
    type: RestrictionType;
    code: number;
    message?: string;
    raw: unknown;
};
export declare function getRestrictionFromAckAttrs(attrs: Record<string, string | undefined> | undefined): AckRestrictionInfo | null;
export declare function getRestrictionFromBoomError(err: any): BoomRestrictionInfo | null;
export declare function isRestrictionErrorCode(code: number): boolean;
//# sourceMappingURL=restriction-utils.d.ts.map
