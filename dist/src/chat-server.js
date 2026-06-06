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
import { getFeishuRuntime } from "./runtime.js";
import { FEISHU_CHANNEL_ID } from "./types.js";
const PORT = parseInt(process.env.OPENCLAW_BRIDGE_PORT ?? "3002", 10);
export function startChatServer(cfg, accountId, log) {
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
                const emit = (obj) => res.write(JSON.stringify(obj) + "\n");
                let input;
                try {
                    input = JSON.parse(body);
                }
                catch {
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
                let runtime;
                try {
                    runtime = getFeishuRuntime();
                }
                catch {
                    emit({ type: "error", message: "OpenClaw runtime not initialized" });
                    emit({ type: "result", text: "", sessionId: null, usage: null });
                    res.end();
                    return;
                }
                const channel = runtime.channel;
                if (!channel?.reply?.dispatchReplyWithBufferedBlockDispatcher) {
                    emit({ type: "error", message: "dispatchReplyWithBufferedBlockDispatcher not available" });
                    emit({ type: "result", text: "", sessionId: null, usage: null });
                    res.end();
                    return;
                }
                // Tell feishu-event's heartbeat loop we're alive and thinking.
                emit({ type: "status", message: "thinking" });
                // sessionKey 必须是「规范全限定」形态 agent:<id>:<channel>:<peer>。
                // 合成 ctx 走的派发路径不会像原生 receive.ts 那样被网关补 agent:<id>: 前缀，
                // 半限定的 openclaw-feishu:bridge-X 会被存成缺前缀的 key，web UI 按全限定
                // key 拉消息时找不到 → 选中也空 / 不更新。网关 canonicalizer 对已 agent:
                // 开头的 key 原样保留，故这里直接构造全限定形，与原生/dashboard session 同库。
                // Python round-trip 该 key，第二轮起原样透传、稳定不分裂。
                const agentId = process.env.OPENCLAW_AGENT_ID || "main";
                const rawId = (sessionId ?? `bridge-${Date.now()}`).trim();
                const sessionKey = /^agent:[^:]+:/.test(rawId)
                    ? rawId
                    : `agent:${agentId}:${FEISHU_CHANNEL_ID}:${rawId.replace(/^openclaw-feishu:/, "")}`;
                let replyText = "";
                // 真流式：累积已 emit 的文本，onPartialReply 只把「新增后缀」当 text_delta 推出去，
                // 与 claude-bridge.mjs 的事件契约对齐，Python 侧 StreamAccumulator 零改动即可消费。
                let streamed = "";
                const pushTextDelta = (full) => {
                    if (typeof full !== "string")
                        return;
                    if (full.length > streamed.length && full.startsWith(streamed)) {
                        emit({ type: "text_delta", text: full.slice(streamed.length) });
                        streamed = full;
                    }
                    else if (full && full !== streamed) {
                        // 非追加式更新(replace)，兜底整段重推一次（最终 result 仍以全文为准）
                        emit({ type: "text_delta", text: full });
                        streamed = full;
                    }
                };
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
                        cfg: runtime
                            .config?.loadConfig?.() ?? cfg,
                        replyResolver: null,
                        // 模型级流式回调：把增量文本/思考/工具事件实时 emit 成 NDJSON。
                        // 这些回调与 block 缓冲无关，在模型出 token 时就触发，故能真流式。
                        replyOptions: {
                            onPartialReply: (p) => {
                                if (p?.delta)
                                    pushTextDelta(streamed + p.delta);
                                else if (typeof p?.text === "string")
                                    pushTextDelta(p.text);
                            },
                            onReasoningStream: (p) => {
                                if (p?.text)
                                    emit({ type: "thinking_delta", text: p.text });
                            },
                            onToolStart: (p) => {
                                const input = p?.args ? JSON.stringify(p.args) : "";
                                emit({
                                    type: "tool_start",
                                    tool: p?.name ?? "tool",
                                    toolId: p?.toolCallId ?? "",
                                    input_preview: input.slice(0, 200),
                                    input,
                                });
                            },
                            onToolResult: (p) => {
                                // ReplyPayload 不带 toolCallId，这里收尾用空 id；Python 侧靠 tool_end 兜底清理
                                emit({ type: "tool_result", toolId: "", content: p?.text ?? "" });
                            },
                        },
                        dispatcherOptions: {
                            deliver: async (payload) => {
                                const p = payload;
                                const blockText = typeof p === "string"
                                    ? p
                                    : (p?.text ?? p?.body ?? "");
                                if (blockText) {
                                    replyText = replyText
                                        ? `${replyText}\n\n${blockText}`
                                        : blockText;
                                    // 每块落定：emit turn_end，Python 把该块并入 _turns 并清空实时预览
                                    emit({ type: "turn_end", text: blockText });
                                    streamed = "";
                                }
                            },
                            onError: (err) => {
                                log.error(`[openclaw-bridge] dispatch error: ${err.message}`);
                            },
                        },
                    });
                }
                catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    log.error(`[openclaw-bridge] dispatch threw: ${msg}`);
                    emit({ type: "error", message: msg });
                }
                emit({
                    type: "result",
                    text: replyText || streamed,
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
//# sourceMappingURL=chat-server.js.map