/**
 * Feishu WebSocket message receive handler.
 *
 * Connects to Feishu via the SDK's WSClient, dispatches incoming
 * messages to Openclaw's channel reply infrastructure.
 */
import type { ClawdbotConfig } from "openclaw/plugin-sdk";
import type { ResolvedFeishuAccount } from "./types.js";
/** Options for the Feishu provider. */
export type FeishuProviderOptions = {
    account: ResolvedFeishuAccount;
    config: ClawdbotConfig;
    log: {
        info: (msg: string) => void;
        error: (msg: string) => void;
        debug?: (msg: string) => void;
    };
    abortSignal?: AbortSignal;
    statusSink?: (patch: Record<string, unknown>) => void;
};
/** Start the Feishu WebSocket provider. Returns a stop function. */
export declare function startFeishuProvider(options: FeishuProviderOptions): {
    stop: () => void;
};
//# sourceMappingURL=receive.d.ts.map