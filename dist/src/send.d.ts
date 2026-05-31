/**
 * Send messages to Feishu — text and media.
 */
import type * as Lark from "@larksuiteoapi/node-sdk";
import type { FeishuSendResult } from "./types.js";
/**
 * Send a text message to a Feishu chat.
 */
export declare function sendTextMessage(client: InstanceType<typeof Lark.Client>, chatId: string, text: string, replyToId?: string): Promise<FeishuSendResult>;
/**
 * Send a media message (image, video, audio, or file) to a Feishu chat.
 * Falls back to text + URL on failure.
 */
export declare function sendMediaMessage(client: InstanceType<typeof Lark.Client>, chatId: string, mediaUrl: string, text?: string, replyToId?: string): Promise<FeishuSendResult>;
/**
 * Update an existing message (e.g., replace "Thinking…" placeholder).
 */
export declare function updateMessage(client: InstanceType<typeof Lark.Client>, messageId: string, text: string): Promise<FeishuSendResult>;
/**
 * Delete a message (e.g., remove "Thinking…" placeholder).
 */
export declare function deleteMessage(client: InstanceType<typeof Lark.Client>, messageId: string): Promise<void>;
//# sourceMappingURL=send.d.ts.map