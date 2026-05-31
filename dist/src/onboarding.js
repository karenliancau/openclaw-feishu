/**
 * Feishu onboarding wizard adapter.
 */
import { addWildcardAllowFrom, DEFAULT_ACCOUNT_ID, normalizeAccountId, } from "openclaw/plugin-sdk";
import { listFeishuAccountIds, resolveDefaultFeishuAccountId, resolveFeishuAccount, } from "./accounts.js";
import { FEISHU_CHANNEL_ID } from "./types.js";
function setFeishuDmPolicy(cfg, dmPolicy) {
    const feishuCfg = cfg.channels?.[FEISHU_CHANNEL_ID] ?? {};
    const existingAllowFrom = Array.isArray(feishuCfg.allowFrom) ? feishuCfg.allowFrom : [];
    const allowFrom = dmPolicy === "open" ? addWildcardAllowFrom(existingAllowFrom) : undefined;
    return {
        ...cfg,
        channels: {
            ...(cfg.channels ?? {}),
            [FEISHU_CHANNEL_ID]: {
                ...feishuCfg,
                dmPolicy,
                ...(allowFrom ? { allowFrom } : {}),
            },
        },
    };
}
async function noteFeishuSetupHelp(prompter) {
    await prompter.note([
        "1) Go to https://open.feishu.cn/app → Create self-built app",
        "2) Add Bot capability to the app",
        '3) Enable permissions: im:message, im:message.group_at_msg, im:message.p2p_msg',
        '4) Events: add im.message.receive_v1, set delivery to "WebSocket long-connection"',
        "5) Publish the app (create version → request approval)",
        "6) Note the App ID (cli_xxx) and App Secret",
        "",
        "Docs: https://open.feishu.cn/document/home/index",
    ].join("\n"), "Feishu Bot Setup");
}
async function promptFeishuAllowFrom(params) {
    const { cfg, prompter, accountId } = params;
    const resolved = resolveFeishuAccount({ cfg, accountId });
    const existingAllowFrom = resolved.config.allowFrom ?? [];
    const entry = await prompter.text({
        message: "Feishu allowFrom (open_id or union_id)",
        placeholder: "ou_xxxxxxxxxx",
        initialValue: existingAllowFrom[0] ? String(existingAllowFrom[0]) : undefined,
        validate: (value) => {
            const raw = String(value ?? "").trim();
            if (!raw)
                return "Required";
            return undefined;
        },
    });
    const normalized = String(entry).trim();
    const merged = [
        ...existingAllowFrom.map((item) => String(item).trim()).filter(Boolean),
        normalized,
    ];
    const unique = [...new Set(merged)];
    const feishuCfg = (cfg.channels?.[FEISHU_CHANNEL_ID] ?? {});
    const accounts = (feishuCfg.accounts ?? {});
    if (accountId === DEFAULT_ACCOUNT_ID) {
        return {
            ...cfg,
            channels: {
                ...(cfg.channels ?? {}),
                [FEISHU_CHANNEL_ID]: {
                    ...feishuCfg,
                    enabled: true,
                    dmPolicy: "allowlist",
                    allowFrom: unique,
                },
            },
        };
    }
    const accountCfg = (accounts[accountId] ?? {});
    return {
        ...cfg,
        channels: {
            ...(cfg.channels ?? {}),
            [FEISHU_CHANNEL_ID]: {
                ...feishuCfg,
                enabled: true,
                accounts: {
                    ...accounts,
                    [accountId]: {
                        ...accountCfg,
                        enabled: accountCfg.enabled ?? true,
                        dmPolicy: "allowlist",
                        allowFrom: unique,
                    },
                },
            },
        },
    };
}
/** Feishu onboarding adapter for the channel. */
export const feishuOnboardingAdapter = {
    /** Check if Feishu channel is configured. */
    configuredCheck: (cfg) => {
        return listFeishuAccountIds(cfg).some((accountId) => Boolean(resolveFeishuAccount({ cfg, accountId }).appId));
    },
    /** Set the DM policy. */
    setDmPolicy: (cfg, policy) => {
        return setFeishuDmPolicy(cfg, policy);
    },
    /** Prompt user for allowFrom configuration. */
    promptAllowFrom: async (params) => {
        return promptFeishuAllowFrom(params);
    },
    /** Show setup help notes. */
    noteSetupHelp: async (prompter) => {
        return noteFeishuSetupHelp(prompter);
    },
    /** Run the full setup wizard. */
    runSetupWizard: async (params) => {
        const { cfg, prompter, accountOverrides, shouldPromptAccountIds, forceAllowFrom } = params;
        const feishuOverride = accountOverrides?.[FEISHU_CHANNEL_ID]?.trim();
        const defaultAccountId = resolveDefaultFeishuAccountId(cfg);
        let feishuAccountId = feishuOverride
            ? normalizeAccountId(feishuOverride)
            : defaultAccountId;
        if (shouldPromptAccountIds && !feishuOverride) {
            const accountIds = listFeishuAccountIds(cfg);
            const options = accountIds.map((id) => ({ value: id, label: id }));
            feishuAccountId = await prompter.select({
                message: "Select Feishu account",
                options,
                initialValue: feishuAccountId,
            });
        }
        let next = cfg;
        const resolvedAccount = resolveFeishuAccount({ cfg: next, accountId: feishuAccountId });
        const accountConfigured = Boolean(resolvedAccount.appId);
        if (!accountConfigured) {
            await noteFeishuSetupHelp(prompter);
        }
        const hasConfigCredentials = Boolean(resolvedAccount.config.appId && resolvedAccount.config.appSecret);
        let appId = null;
        let appSecret = null;
        if (hasConfigCredentials && prompter.confirm) {
            const keep = await prompter.confirm({
                message: "Feishu credentials already configured. Keep them?",
                initialValue: true,
            });
            if (!keep) {
                appId = String(await prompter.text({
                    message: "Enter Feishu App ID (cli_xxx)",
                    validate: (value) => (String(value ?? "").trim() ? undefined : "Required"),
                })).trim();
                appSecret = String(await prompter.text({
                    message: "Enter Feishu App Secret",
                    validate: (value) => (String(value ?? "").trim() ? undefined : "Required"),
                })).trim();
            }
        }
        else if (!hasConfigCredentials) {
            appId = String(await prompter.text({
                message: "Enter Feishu App ID (cli_xxx)",
                validate: (value) => (String(value ?? "").trim() ? undefined : "Required"),
            })).trim();
            appSecret = String(await prompter.text({
                message: "Enter Feishu App Secret",
                validate: (value) => (String(value ?? "").trim() ? undefined : "Required"),
            })).trim();
        }
        const feishuCfg2 = (next.channels?.[FEISHU_CHANNEL_ID] ?? {});
        const accounts2 = (feishuCfg2.accounts ?? {});
        if (appId && appSecret) {
            if (feishuAccountId === DEFAULT_ACCOUNT_ID) {
                next = {
                    ...next,
                    channels: {
                        ...(next.channels ?? {}),
                        [FEISHU_CHANNEL_ID]: {
                            ...feishuCfg2,
                            enabled: true,
                            appId,
                            appSecret,
                        },
                    },
                };
            }
            else {
                const accountCfg2 = (accounts2[feishuAccountId] ?? {});
                next = {
                    ...next,
                    channels: {
                        ...(next.channels ?? {}),
                        [FEISHU_CHANNEL_ID]: {
                            ...feishuCfg2,
                            enabled: true,
                            accounts: {
                                ...accounts2,
                                [feishuAccountId]: {
                                    ...accountCfg2,
                                    enabled: true,
                                    appId,
                                    appSecret,
                                },
                            },
                        },
                    },
                };
            }
        }
        if (forceAllowFrom) {
            next = await promptFeishuAllowFrom({
                cfg: next,
                prompter,
                accountId: feishuAccountId,
            });
        }
        return next;
    },
};
//# sourceMappingURL=onboarding.js.map