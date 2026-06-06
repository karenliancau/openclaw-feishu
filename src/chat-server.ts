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
import { getFeishuRuntime } from "./runtime.js";
import { FEISHU_CHANNEL_ID } from "./types.js";

const PORT = parseInt(process.env.OPENCLAW_BRIDGE_PORT ?? "3002", 10);

type Logger = { info: (m: string) => void; error: (m: string) => void };

export function startChatServer(
  cfg: ClawdbotConfig,
  accountId: string,
  log: Logger,
): http.Server {
  const server = http.createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
      return;
    }

    if (req.method === "POST" && req.url === "/query") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", async () => {
        res.writeHead(200, {
          "Content-Type": "application/x-ndjson",
          "Transfer-Encoding": "chunked",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        });

        const emit = (obj: unknown) => res.write(JSON.stringify(obj) + "\n");

        let input: { prompt?: string; sessionId?: string };
        try {
          input = JSON.parse(body);
        } catch {
          emit({ type: "error", message: "Invalid JSON" });
          emit({ type: "result", text: "", sessionId: null, usage: null });
          res.end();
          return;
        }

        const { prompt, sessionId } = input;
        if (!prompt) {
          emit({ type: "error", message: "Missing required field: prompt" });
          emit({ type: "result", text: "", sessionId: null, usage: null });
          res.end();
          return;
        }

        let runtime: ReturnType<typeof getFeishuRuntime>;
        try {
          runtime = getFeishuRuntime();
        } catch {
          emit({ type: "error", message: "OpenClaw runtime not initialized" });
          emit({ type: "result", text: "", sessionId: null, usage: null });
          res.end();
          return;
        }

        const channel = (runtime as Record<string, unknown>).channel as
          | { reply?: { dispatchReplyWithBufferedBlockDispatcher?: (opts: unknown) => Promise<unknown> } }
          | undefined;

        if (!channel?.reply?.dispatchReplyWithBufferedBlockDispatcher) {
          emit({ type: "error", message: "dispatchReplyWithBufferedBlockDispatcher not available" });
          emit({ type: "result", text: "", sessionId: null, usage: null });
          res.end();
          return;
        }

        // Tell feishu-event's heartbeat loop we're alive and thinking.
        emit({ type: "status", message: "thinking" });

        const sessionKey = sessionId ?? `bridge-${Date.now()}`;
        let replyText = "";

        const inboundCtx = {
          Body: prompt,
          RawBody: prompt,
          CommandBody: prompt,
          From: "feishu-bridge",
          To: sessionKey,
          SessionKey: sessionKey,
          AccountId: accountId,
          MessageSid: `bridge-${Date.now()}`,
          ChatType: "direct",
          ConversationLabel: sessionKey,
          SenderId: "feishu-bridge",
          CommandAuthorized: true,
          Provider: FEISHU_CHANNEL_ID,
          Surface: FEISHU_CHANNEL_ID,
          OriginatingChannel: FEISHU_CHANNEL_ID,
          OriginatingTo: sessionKey,
          DeliveryContext: {
            channel: FEISHU_CHANNEL_ID,
            to: sessionKey,
            accountId,
          },
        };

        try {
          await channel.reply.dispatchReplyWithBufferedBlockDispatcher({
            ctx: inboundCtx,
            cfg: (runtime as { config?: { loadConfig?: () => ClawdbotConfig } })
              .config?.loadConfig?.() ?? cfg,
            replyResolver: null,
            dispatcherOptions: {
              deliver: async (payload: unknown) => {
                const p = payload as
                  | string
                  | { text?: string; body?: string }
                  | null;
                replyText =
                  typeof p === "string"
                    ? p
                    : (p?.text ?? p?.body ?? "");
              },
              onError: (err: Error) => {
                log.error(`[openclaw-bridge] dispatch error: ${err.message}`);
              },
            },
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          log.error(`[openclaw-bridge] dispatch threw: ${msg}`);
          emit({ type: "error", message: msg });
        }

        emit({
          type: "result",
          text: replyText,
          sessionId: sessionKey,
          usage: null,
        });
        res.end();
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(PORT, "127.0.0.1", () => {
    log.info(`[openclaw-bridge] HTTP bridge listening on http://127.0.0.1:${PORT}`);
  });

  return server;
}
