/**
 * Feishu WebSocket message receive handler.
 *
 * Connects to Feishu via the SDK's WSClient, dispatches incoming
 * messages to Openclaw's channel reply infrastructure.
 */
import * as Lark from "@larksuiteoapi/node-sdk";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FEISHU_CHANNEL_ID } from "./types.js";
import { isDuplicate } from "./dedup.js";
import { sendTextMessage, updateMessage, deleteMessage } from "./send.js";
import { sendMediaMessage } from "./send.js";
import { getFeishuRuntime } from "./runtime.js";
/**
 * Start the Feishu WebSocket provider.
 *
 * Resolves the bot's own open_id (for group @-mention filtering), starts the
 * WSClient, then stays alive until the abort signal fires. Returns a stop
 * function once aborted.
 */
export async function startFeishuProvider(options) {
    const { account, config, log, statusSink } = options;
    const { appId, appSecret } = account;
    const thinkingThresholdMs = account.config.thinkingThresholdMs ?? 2500;
    const botNames = account.config.botNames;
    log.info(`[${FEISHU_CHANNEL_ID}:${account.accountId}] Starting WebSocket provider (appId=${appId})`);
    const sdkConfig = {
        appId,
        appSecret,
        domain: Lark.Domain.Feishu,
        appType: Lark.AppType.SelfBuild,
    };
    const client = new Lark.Client(sdkConfig);
    // Resolve bot's own open_id for mention filtering
    let botOpenId = "";
    try {
        const https = await import("node:https");
        // Get tenant token
        const tokenData = await new Promise((resolve, reject) => {
            const postData = JSON.stringify({ app_id: appId, app_secret: appSecret });
            const req = https.default.request("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(postData) },
            }, (res) => {
                let d = "";
                res.on("data", (c) => d += c);
                res.on("end", () => { try {
                    resolve(JSON.parse(d));
                }
                catch {
                    reject(new Error(d));
                } });
            });
            req.on("error", reject);
            req.write(postData);
            req.end();
        });
        const token = tokenData.tenant_access_token;
        // Get bot info
        const botData = await new Promise((resolve, reject) => {
            https.default.get("https://open.feishu.cn/open-apis/bot/v3/info/", {
                headers: { "Authorization": `Bearer ${token}` },
            }, (res) => {
                let d = "";
                res.on("data", (c) => d += c);
                res.on("end", () => { try {
                    resolve(JSON.parse(d));
                }
                catch {
                    reject(new Error(d));
                } });
            }).on("error", reject);
        });
        botOpenId = botData?.bot?.open_id ?? "";
        log.info(`[${FEISHU_CHANNEL_ID}:${account.accountId}] Bot open_id resolved: ${botOpenId}`);
    }
    catch (e) {
        log.error(`[${FEISHU_CHANNEL_ID}:${account.accountId}] Failed to resolve bot open_id: ${e instanceof Error ? e.message : String(e)}`);
    }
    const dispatcher = new Lark.EventDispatcher({}).register({
        "im.message.receive_v1": async (data) => {
            try {
                await handleIncomingMessage(data, {
                    client,
                    account,
                    config,
                    log,
                    thinkingThresholdMs,
                    botNames,
                    botOpenId,
                    statusSink,
                });
            }
            catch (err) {
                log.error(`[${FEISHU_CHANNEL_ID}:${account.accountId}] Message handler error: ${err instanceof Error ? err.message : String(err)}`);
            }
        },
    });
    const wsClient = new Lark.WSClient({
        ...sdkConfig,
        loggerLevel: Lark.LoggerLevel.info,
    });
    wsClient.start({ eventDispatcher: dispatcher });
    log.info(`[${FEISHU_CHANNEL_ID}:${account.accountId}] WebSocket client started`);
    statusSink?.({ running: true, lastStartAt: Date.now() });
    const stop = () => {
        log.info(`[${FEISHU_CHANNEL_ID}:${account.accountId}] Stopping WebSocket provider`);
        // Lark SDK WSClient doesn't expose a clean stop method;
        // rely on abort signal and GC.
        statusSink?.({ running: false, lastStopAt: Date.now() });
    };
    // Keep the channel alive until the abort signal fires.
    // Without this, the framework sees the function return immediately
    // and interprets it as "channel exited".
    const abortSignal = options.abortSignal;
    if (abortSignal) {
        await new Promise((resolve) => {
            if (abortSignal.aborted) {
                resolve();
                return;
            }
            abortSignal.addEventListener("abort", () => resolve(), { once: true });
        });
        stop();
    }
    return { stop };
}
/** Handle a single incoming Feishu message event. */
async function handleIncomingMessage(data, ctx) {
    const message = data.message;
    if (!message)
        return;
    const chatId = message.chat_id;
    if (!chatId)
        return;
    const messageId = message.message_id;
    if (isDuplicate(messageId))
        return;
    const messageType = message.message_type;
    // Debug: log ALL incoming message types
    ctx.log.info(`[${FEISHU_CHANNEL_ID}:${ctx.account.accountId}] Incoming message type=${messageType} id=${messageId} content=${(message.content ?? "").slice(0, 200)}`);
    const supportedTypes = ["text", "file", "post", "image"];
    if (!messageType || !supportedTypes.includes(messageType) || !message.content)
        return;
    let text;
    try {
        const parsed = JSON.parse(message.content);
        if (messageType === "text") {
            text = (parsed.text ?? "").trim();
        }
        else if (messageType === "file") {
            // File message: download and extract content
            const fileKey = parsed.file_key;
            const fileName = parsed.file_name ?? "unknown_file";
            if (!fileKey)
                return;
            ctx.log.info(`[${FEISHU_CHANNEL_ID}:${ctx.account.accountId}] Received file: ${fileName} (key=${fileKey})`);
            try {
                const fileContent = await downloadAndExtractFeishuFile(ctx.client, messageId, fileKey, fileName, ctx.log);
                text = fileContent;
            }
            catch (err) {
                ctx.log.error(`[${FEISHU_CHANNEL_ID}:${ctx.account.accountId}] File extraction failed: ${err instanceof Error ? err.message : String(err)}`);
                text = `[用户发送了文件: ${fileName}，但文件内容提取失败]`;
            }
        }
        else if (messageType === "image") {
            const imageKey = parsed.image_key;
            text = `[用户发送了一张图片 (image_key=${imageKey})]`;
        }
        else if (messageType === "post") {
            // Rich text: extract plain text from post structure
            text = extractTextFromPost(parsed);
        }
        else {
            return;
        }
    }
    catch {
        return;
    }
    if (!text)
        return;
    const chatType = message.chat_type;
    const sender = data.sender;
    const senderId = sender?.sender_id?.open_id ?? "";
    // Group chat: only respond when the bot itself is @-mentioned
    if (chatType === "group") {
        const mentions = Array.isArray(message.mentions) ? message.mentions : [];
        const botMentioned = mentions.some((m) => {
            if (ctx.botOpenId && m.id?.open_id === ctx.botOpenId)
                return true;
            return false;
        });
        ctx.log.info(`[${FEISHU_CHANNEL_ID}:${ctx.account.accountId}] Group filter: botOpenId=${ctx.botOpenId} mentions=${JSON.stringify(mentions.map((m) => m.id?.open_id))} botMentioned=${botMentioned}`);
        if (!botMentioned)
            return;
        text = text.replace(/@_user_\d+\s*/g, "").trim();
    }
    ctx.statusSink?.({ lastInboundAt: Date.now() });
    const sessionKey = `${FEISHU_CHANNEL_ID}:${chatType === "p2p" ? senderId : chatId}`;
    ctx.log.info(`[${FEISHU_CHANNEL_ID}:${ctx.account.accountId}] Received from ${senderId}: ${text.slice(0, 80)}`);
    // Dispatch via Openclaw runtime
    const runtime = getFeishuRuntime();
    const channel = runtime.channel;
    if (!channel?.reply?.dispatchReplyWithBufferedBlockDispatcher) {
        ctx.log.error(`[${FEISHU_CHANNEL_ID}:${ctx.account.accountId}] dispatchReplyWithBufferedBlockDispatcher not available`);
        return;
    }
    // Build inbound context
    const inboundCtx = {
        Body: text,
        RawBody: text,
        CommandBody: text,
        From: senderId,
        To: chatId,
        SessionKey: sessionKey,
        AccountId: ctx.account.accountId,
        MessageSid: messageId,
        ChatType: chatType === "p2p" ? "direct" : "group",
        ConversationLabel: chatId,
        SenderId: senderId,
        CommandAuthorized: true,
        Provider: FEISHU_CHANNEL_ID,
        Surface: FEISHU_CHANNEL_ID,
        OriginatingChannel: FEISHU_CHANNEL_ID,
        OriginatingTo: chatId,
        DeliveryContext: {
            channel: FEISHU_CHANNEL_ID,
            to: chatId,
            accountId: ctx.account.accountId,
        },
    };
    // "Thinking…" placeholder logic
    let placeholderId = "";
    let done = false;
    const timer = ctx.thinkingThresholdMs > 0
        ? setTimeout(async () => {
            if (done)
                return;
            try {
                const res = await ctx.client.im.message.create({
                    params: { receive_id_type: "chat_id" },
                    data: {
                        receive_id: chatId,
                        msg_type: "text",
                        content: JSON.stringify({ text: "正在思考…" }),
                    },
                });
                placeholderId = res?.data?.message_id ?? "";
            }
            catch {
                // Ignore placeholder failures
            }
        }, ctx.thinkingThresholdMs)
        : null;
    try {
        await channel.reply.dispatchReplyWithBufferedBlockDispatcher({
            ctx: inboundCtx,
            cfg: runtime.config?.loadConfig?.() ?? ctx.config,
            replyResolver: null,
            dispatcherOptions: {
                deliver: async (payload) => {
                    done = true;
                    if (timer)
                        clearTimeout(timer);
                    const p = payload;
                    const replyText = typeof p === "string" ? p : (p?.text ?? p?.body ?? "");
                    const mediaUrl = typeof p === "string" ? undefined : (p?.mediaUrl ?? p?.mediaUrls?.[0]);
                    // Skip empty / NO_REPLY
                    const trimmed = (replyText || "").trim();
                    if ((!trimmed || trimmed === "NO_REPLY" || trimmed.endsWith("NO_REPLY")) && !mediaUrl) {
                        if (placeholderId)
                            await deleteMessage(ctx.client, placeholderId);
                        return;
                    }
                    ctx.statusSink?.({ lastOutboundAt: Date.now() });
                    try {
                        if (mediaUrl) {
                            if (placeholderId) {
                                await deleteMessage(ctx.client, placeholderId);
                                placeholderId = "";
                            }
                            await sendMediaMessage(ctx.client, chatId, mediaUrl, replyText);
                        }
                        else if (placeholderId) {
                            // Update the "Thinking…" placeholder
                            await updateMessage(ctx.client, placeholderId, replyText);
                            placeholderId = "";
                        }
                        else {
                            await sendTextMessage(ctx.client, chatId, replyText);
                        }
                    }
                    catch (err) {
                        ctx.log.error(`[${FEISHU_CHANNEL_ID}:${ctx.account.accountId}] Failed to send reply: ${err instanceof Error ? err.message : String(err)}`);
                    }
                },
                onError: (err) => {
                    done = true;
                    if (timer)
                        clearTimeout(timer);
                    ctx.log.error(`[${FEISHU_CHANNEL_ID}:${ctx.account.accountId}] Dispatcher error: ${err.message}`);
                    // Clean up placeholder
                    if (placeholderId) {
                        deleteMessage(ctx.client, placeholderId).catch(() => { });
                    }
                },
            },
        });
    }
    catch (err) {
        done = true;
        if (timer)
            clearTimeout(timer);
        ctx.log.error(`[${FEISHU_CHANNEL_ID}:${ctx.account.accountId}] Dispatch error: ${err instanceof Error ? err.message : String(err)}`);
        if (placeholderId) {
            await deleteMessage(ctx.client, placeholderId);
        }
    }
}
/** Download a file from Feishu message and extract text content. */
async function downloadAndExtractFeishuFile(client, messageId, fileKey, fileName, log) {
    const ext = path.extname(fileName).toLowerCase();
    const tempDir = path.join(os.tmpdir(), "openclaw-feishu-files");
    if (!fs.existsSync(tempDir))
        fs.mkdirSync(tempDir, { recursive: true });
    const tempPath = path.join(tempDir, `${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._一-鿿-]/g, "_")}`);
    try {
        // Get tenant_access_token via the client's internal token
        let tenantToken = "";
        try {
            const tokenResp = await client.tokenManager.get({
                type: "tenant",
            });
            tenantToken = tokenResp || "";
        }
        catch {
            // Fallback: try to get token from internal API
            const https = await import("node:https");
            const tokenData = await new Promise((resolve, reject) => {
                const appId = client.appId || client.config?.appId;
                const appSecret = client.appSecret || client.config?.appSecret;
                const postData = JSON.stringify({ app_id: appId, app_secret: appSecret });
                const req = https.default.request("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
                    method: "POST",
                    headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(postData) },
                }, (res) => {
                    let d = "";
                    res.on("data", (c) => d += c);
                    res.on("end", () => { try {
                        resolve(JSON.parse(d));
                    }
                    catch {
                        reject(new Error(d));
                    } });
                });
                req.on("error", reject);
                req.write(postData);
                req.end();
            });
            tenantToken = tokenData.tenant_access_token || "";
        }
        if (!tenantToken)
            throw new Error("Failed to obtain tenant_access_token");
        // Download file via REST API directly
        const https = await import("node:https");
        const fileUrl = `https://open.feishu.cn/open-apis/im/v1/messages/${messageId}/resources/${fileKey}?type=file`;
        await new Promise((resolve, reject) => {
            const req = https.default.get(fileUrl, {
                headers: { "Authorization": `Bearer ${tenantToken}` },
            }, (res) => {
                if (res.statusCode === 301 || res.statusCode === 302) {
                    const location = res.headers.location;
                    if (!location) {
                        reject(new Error("Redirect without location"));
                        return;
                    }
                    https.default.get(location, (res2) => {
                        const ws = fs.createWriteStream(tempPath);
                        res2.pipe(ws);
                        ws.on("finish", () => { ws.close(); resolve(); });
                        ws.on("error", reject);
                    }).on("error", reject);
                    return;
                }
                if (res.statusCode !== 200) {
                    let body = "";
                    res.on("data", (c) => body += c);
                    res.on("end", () => reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`)));
                    return;
                }
                const ws = fs.createWriteStream(tempPath);
                res.pipe(ws);
                ws.on("finish", () => { ws.close(); resolve(); });
                ws.on("error", reject);
            });
            req.on("error", reject);
        });
        const fileSize = fs.statSync(tempPath).size;
        log.info(`[${FEISHU_CHANNEL_ID}] Downloaded file: ${fileName} (${(fileSize / 1024).toFixed(1)}KB) -> ${tempPath}`);
        // Extract content based on file type
        const textExtensions = [".txt", ".md", ".csv", ".json", ".xml", ".html", ".log", ".yml", ".yaml", ".toml", ".ini", ".conf", ".sh", ".py", ".js", ".ts", ".java", ".c", ".cpp", ".h", ".go", ".rs", ".sql"];
        if (textExtensions.includes(ext)) {
            const content = fs.readFileSync(tempPath, "utf-8");
            const truncated = content.length > 50000 ? content.slice(0, 50000) + "\n\n[... 文件内容过长，已截断 ...]" : content;
            return `[文件: ${fileName} (${(fileSize / 1024).toFixed(1)}KB)]\n\n${truncated}`;
        }
        if (ext === ".pdf") {
            try {
                const pdfModule = await import("pdf-parse");
                const pdfParse = pdfModule.PDFParse ?? pdfModule.default ?? pdfModule;
                if (typeof pdfParse !== "function")
                    throw new Error("pdf-parse module loaded but is not callable: " + typeof pdfParse + " keys=" + Object.keys(pdfModule).join(","));
                const dataBuffer = fs.readFileSync(tempPath);
                const pdfData = await pdfParse(dataBuffer);
                const pdfText = (pdfData.text ?? "").trim();
                if (!pdfText)
                    return `[PDF文件: ${fileName} (${(fileSize / 1024).toFixed(1)}KB)] — 无法提取文字内容（可能是扫描件）`;
                const truncated = pdfText.length > 50000 ? pdfText.slice(0, 50000) + "\n\n[... PDF内容过长，已截断 ...]" : pdfText;
                return `[PDF文件: ${fileName} (${pdfData.numpages}页, ${(fileSize / 1024).toFixed(1)}KB)]\n\n${truncated}`;
            }
            catch (pdfErr) {
                log.error(`[${FEISHU_CHANNEL_ID}] PDF parse failed for ${fileName}: ${pdfErr instanceof Error ? pdfErr.message : String(pdfErr)}`);
                return `[PDF文件: ${fileName} (${(fileSize / 1024).toFixed(1)}KB)] — PDF解析失败，已保存到: ${tempPath}`;
            }
        }
        // Unsupported file type — just note it
        return `[文件: ${fileName} (${(fileSize / 1024).toFixed(1)}KB, 类型: ${ext || "未知"})] — 文件已保存到: ${tempPath}`;
    }
    catch (err) {
        // Clean up on error
        try {
            if (fs.existsSync(tempPath))
                fs.unlinkSync(tempPath);
        }
        catch { }
        throw err;
    }
}
/** Extract plain text from Feishu post (rich text) message. */
function extractTextFromPost(parsed) {
    const parts = [];
    const title = parsed?.zh_cn?.title || parsed?.en_us?.title || "";
    if (title)
        parts.push(title);
    const content = parsed?.zh_cn?.content || parsed?.en_us?.content || parsed?.content || [];
    for (const paragraph of content) {
        if (!Array.isArray(paragraph))
            continue;
        for (const node of paragraph) {
            if (node?.tag === "text" && node.text)
                parts.push(node.text);
            else if (node?.tag === "a" && node.text)
                parts.push(node.text);
            else if (node?.tag === "at" && node.user_name)
                parts.push(`@${node.user_name}`);
        }
    }
    return parts.join("").trim();
}
//# sourceMappingURL=receive.js.map