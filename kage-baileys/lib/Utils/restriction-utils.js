/**
 * Account-restriction detection.
 *
 * When an account is rate-limited or restricted from reaching out to people
 * who aren't already in a chat with it, WhatsApp doesn't drop the message
 * silently -- it comes back as an `<ack class="message" error="...">` node
 * (see handleBadAck in messages-recv.js) or, less commonly, as an `<error>`
 * child on a synchronous `<iq>` response (see assertNodeErrorFree in
 * WABinary/generic-utils.js, which surfaces it as `Boom(text, { data: code })`).
 *
 * Two known restriction shapes:
 *   - "Reachout Timelock" (error code 463): the account is temporarily locked
 *     out of messaging numbers it has no prior chat history with. This is the
 *     error most often reported as a mystery "account got banned" when the
 *     bot is actually just rate-limited, not disabled.
 *   - "New Chat Limit" (error code 471): a rolling-window cap on how many
 *     *new* 1:1 chats can be started in a period, independent of overall
 *     message volume.
 *
 * WhatsApp does not publish an official mapping of these codes, so
 * RESTRICTION_ERROR_CODES is intentionally exported/mutable -- if you observe
 * a different code for either condition on your account tier, patch the map
 * rather than the call sites.
 */
export const RESTRICTION_ERROR_CODES = {
    463: 'reachout_timelock',
    471: 'new_chat_limit'
};
/**
 * Given the attrs of a bad `<ack>` node (attrs.error holds the code as a
 * string), return structured restriction info, or null if this isn't a
 * known restriction code.
 */
export function getRestrictionFromAckAttrs(attrs) {
    if (!attrs?.error) {
        return null;
    }
    const code = +attrs.error;
    const type = RESTRICTION_ERROR_CODES[code];
    if (!type) {
        return null;
    }
    return {
        type,
        code,
        jid: attrs.from,
        messageId: attrs.id,
        raw: attrs
    };
}
/**
 * Given an error thrown by `query()` (a Boom with `.data` set to the numeric
 * error code by assertNodeErrorFree), return structured restriction info, or
 * null if this isn't a known restriction code.
 */
export function getRestrictionFromBoomError(err) {
    const code = err?.data ?? err?.output?.payload?.data;
    if (typeof code !== 'number') {
        return null;
    }
    const type = RESTRICTION_ERROR_CODES[code];
    if (!type) {
        return null;
    }
    return {
        type,
        code,
        message: err?.message,
        raw: err
    };
}
export function isRestrictionErrorCode(code) {
    return Object.prototype.hasOwnProperty.call(RESTRICTION_ERROR_CODES, code);
}
//# sourceMappingURL=restriction-utils.js.map
