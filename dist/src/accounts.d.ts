/**
 * Feishu account resolution — multi-account support.
 */
import type { ClawdbotConfig } from "openclaw/plugin-sdk";
import type { ResolvedFeishuAccount } from "./types.js";
/** List all configured Feishu account IDs (falls back to ["default"]). */
export declare function listFeishuAccountIds(cfg: ClawdbotConfig): string[];
/** Resolve the default account ID. */
export declare function resolveDefaultFeishuAccountId(cfg: ClawdbotConfig): string;
/** Fully resolve a Feishu account. */
export declare function resolveFeishuAccount(params: {
    cfg: ClawdbotConfig;
    accountId?: string | null;
}): ResolvedFeishuAccount;
/** List all enabled Feishu accounts. */
export declare function listEnabledFeishuAccounts(cfg: ClawdbotConfig): ResolvedFeishuAccount[];
//# sourceMappingURL=accounts.d.ts.map