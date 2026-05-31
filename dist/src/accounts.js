/**
 * Feishu account resolution — multi-account support.
 */
import { DEFAULT_ACCOUNT_ID, normalizeAccountId } from "openclaw/plugin-sdk";
import { FEISHU_CHANNEL_ID } from "./types.js";
function listConfiguredAccountIds(cfg) {
    const accounts = cfg.channels?.[FEISHU_CHANNEL_ID]?.accounts;
    if (!accounts || typeof accounts !== "object")
        return [];
    return Object.keys(accounts).filter(Boolean);
}
/** List all configured Feishu account IDs (falls back to ["default"]). */
export function listFeishuAccountIds(cfg) {
    const ids = listConfiguredAccountIds(cfg);
    if (ids.length === 0)
        return [DEFAULT_ACCOUNT_ID];
    return ids.sort((a, b) => a.localeCompare(b));
}
/** Resolve the default account ID. */
export function resolveDefaultFeishuAccountId(cfg) {
    const feishuConfig = cfg.channels?.[FEISHU_CHANNEL_ID];
    if (feishuConfig?.defaultAccount?.trim())
        return feishuConfig.defaultAccount.trim();
    const ids = listFeishuAccountIds(cfg);
    if (ids.includes(DEFAULT_ACCOUNT_ID))
        return DEFAULT_ACCOUNT_ID;
    return ids[0] ?? DEFAULT_ACCOUNT_ID;
}
function resolveAccountConfig(cfg, accountId) {
    const accounts = cfg.channels?.[FEISHU_CHANNEL_ID]?.accounts;
    if (!accounts || typeof accounts !== "object")
        return undefined;
    return accounts[accountId];
}
function mergeFeishuAccountConfig(cfg, accountId) {
    const raw = (cfg.channels?.[FEISHU_CHANNEL_ID] ?? {});
    const { accounts: _ignored, defaultAccount: _ignored2, ...base } = raw;
    const account = resolveAccountConfig(cfg, accountId) ?? {};
    return { ...base, ...account };
}
/**
 * Resolve appId + appSecret for an account.
 * Checks: account config → base config → plugin config.
 */
function resolveCredentials(cfg, merged) {
    // From channel config
    if (merged.appId?.trim() && merged.appSecret?.trim()) {
        return { appId: merged.appId.trim(), appSecret: merged.appSecret.trim(), source: "config" };
    }
    // From plugin config: plugins.entries.openclaw-feishu only (plugin id; do not use plugins.entries.feishu — causes "plugin not found: feishu")
    const pluginCfg = cfg.plugins;
    const feishuPluginEntry = pluginCfg?.entries?.["openclaw-feishu"];
    if (feishuPluginEntry?.appId?.trim() && feishuPluginEntry?.appSecret?.trim()) {
        return { appId: feishuPluginEntry.appId.trim(), appSecret: feishuPluginEntry.appSecret.trim(), source: "plugin" };
    }
    return { appId: "", appSecret: "", source: "none" };
}
/** Fully resolve a Feishu account. */
export function resolveFeishuAccount(params) {
    const accountId = normalizeAccountId(params.accountId);
    const baseEnabled = params.cfg.channels?.[FEISHU_CHANNEL_ID]?.enabled !== false;
    const merged = mergeFeishuAccountConfig(params.cfg, accountId);
    const accountEnabled = merged.enabled !== false;
    const enabled = baseEnabled && accountEnabled;
    const creds = resolveCredentials(params.cfg, merged);
    return {
        accountId,
        name: merged.name?.trim() || undefined,
        enabled,
        appId: creds.appId,
        appSecret: creds.appSecret,
        tokenSource: creds.source,
        config: merged,
    };
}
/** List all enabled Feishu accounts. */
export function listEnabledFeishuAccounts(cfg) {
    return listFeishuAccountIds(cfg)
        .map((accountId) => resolveFeishuAccount({ cfg, accountId }))
        .filter((account) => account.enabled);
}
//# sourceMappingURL=accounts.js.map