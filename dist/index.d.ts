/**
 * Feishu (Lark) channel plugin for Openclaw.
 *
 * Connects Feishu bots via WebSocket long-connection (no public server required).
 */
import type { ClawdbotPluginApi } from "openclaw/plugin-sdk";
declare const plugin: {
    id: string;
    name: string;
    description: string;
    configSchema: {
        toJSONSchema: () => {
            type: string;
            properties: {
                appId: {
                    type: string;
                    description: string;
                };
                appSecret: {
                    type: string;
                    description: string;
                };
            };
            additionalProperties: boolean;
        };
    };
    register(api: ClawdbotPluginApi): void;
};
export default plugin;
//# sourceMappingURL=index.d.ts.map