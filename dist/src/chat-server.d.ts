/**
 * OpenClaw HTTP bridge — exposes OpenClaw's brain as a local HTTP endpoint.
 *
 * POST /query  body: {prompt, sessionId}
 * Response: application/x-ndjson stream ending with {"type":"result",...}
 * GET  /health → 200 ok
 *
 * feishu-event calls this instead of claude-bridge.mjs, so the same Python
 * FeishuAgent code path (cardkit streaming, memory, compression) works
 * regardless of which brain is behind it.
 */
import http from "node:http";
import type { ClawdbotConfig } from "openclaw/plugin-sdk";
type Logger = {
    info: (m: string) => void;
    error: (m: string) => void;
};
export declare function startChatServer(cfg: ClawdbotConfig, accountId: string, log: Logger): http.Server;
export {};
//# sourceMappingURL=chat-server.d.ts.map