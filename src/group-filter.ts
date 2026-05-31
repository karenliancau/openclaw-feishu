/**
 * Smart group chat reply filter.
 *
 * In group chats, only respond when the message looks like a real
 * question, request, or direct address — avoids spamming.
 */

/** Default bot name patterns for address detection. */
const DEFAULT_BOT_NAMES = ["openclaw", "bot", "助手", "智能体"];

/**
 * Determine whether the bot should respond to a group message.
 *
 * @param text - Message text (after stripping @mention placeholders)
 * @param mentions - Array of mention objects from the Feishu event
 * @param botNames - Custom bot name list for address detection
 */
export function shouldRespondInGroup(
  text: string,
  mentions: unknown[],
  botNames?: string[],
): boolean {
  // Only respond when directly @-mentioned.
  // (Actual @-target matching against the bot's own open_id is done in
  // receive.ts; here we just gate on the presence of any mention.)
  return mentions.length > 0;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
