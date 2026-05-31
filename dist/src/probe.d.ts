/**
 * Feishu API connectivity probe.
 */
import type { FeishuProbeResult } from "./types.js";
/**
 * Probe the Feishu API by validating credentials via tenant_access_token/internal.
 * @larksuiteoapi/node-sdk does not expose bot.v3.botInfo; we use auth instead.
 */
export declare function probeFeishu(appId: string, appSecret: string, timeoutMs?: number): Promise<FeishuProbeResult>;
//# sourceMappingURL=probe.d.ts.map