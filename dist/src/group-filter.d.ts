/**
 * Smart group chat reply filter.
 *
 * In group chats, only respond when the message looks like a real
 * question, request, or direct address — avoids spamming.
 */
/**
 * Determine whether the bot should respond to a group message.
 *
 * @param text - Message text (after stripping @mention placeholders)
 * @param mentions - Array of mention objects from the Feishu event
 * @param botNames - Custom bot name list for address detection
 */
export declare function shouldRespondInGroup(text: string, mentions: unknown[], botNames?: string[]): boolean;
//# sourceMappingURL=group-filter.d.ts.map