/**
 * Feishu config Zod schema for validation.
 */
import { z } from "zod";
export declare const FeishuConfigSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    enabled: z.ZodOptional<z.ZodBoolean>;
    appId: z.ZodOptional<z.ZodString>;
    appSecret: z.ZodOptional<z.ZodString>;
    dmPolicy: z.ZodOptional<z.ZodEnum<["pairing", "allowlist", "open", "disabled"]>>;
    allowFrom: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodNumber]>, "many">>;
    thinkingThresholdMs: z.ZodOptional<z.ZodNumber>;
    botNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    mediaMaxMb: z.ZodOptional<z.ZodNumber>;
} & {
    accounts: z.ZodOptional<z.ZodObject<{}, "strip", z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        enabled: z.ZodOptional<z.ZodBoolean>;
        appId: z.ZodOptional<z.ZodString>;
        appSecret: z.ZodOptional<z.ZodString>;
        dmPolicy: z.ZodOptional<z.ZodEnum<["pairing", "allowlist", "open", "disabled"]>>;
        allowFrom: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodNumber]>, "many">>;
        thinkingThresholdMs: z.ZodOptional<z.ZodNumber>;
        botNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        mediaMaxMb: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        name?: string;
        enabled?: boolean;
        appId?: string;
        appSecret?: string;
        dmPolicy?: "pairing" | "allowlist" | "open" | "disabled";
        allowFrom?: (string | number)[];
        thinkingThresholdMs?: number;
        botNames?: string[];
        mediaMaxMb?: number;
    }, {
        name?: string;
        enabled?: boolean;
        appId?: string;
        appSecret?: string;
        dmPolicy?: "pairing" | "allowlist" | "open" | "disabled";
        allowFrom?: (string | number)[];
        thinkingThresholdMs?: number;
        botNames?: string[];
        mediaMaxMb?: number;
    }>, z.objectOutputType<{}, z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        enabled: z.ZodOptional<z.ZodBoolean>;
        appId: z.ZodOptional<z.ZodString>;
        appSecret: z.ZodOptional<z.ZodString>;
        dmPolicy: z.ZodOptional<z.ZodEnum<["pairing", "allowlist", "open", "disabled"]>>;
        allowFrom: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodNumber]>, "many">>;
        thinkingThresholdMs: z.ZodOptional<z.ZodNumber>;
        botNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        mediaMaxMb: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        name?: string;
        enabled?: boolean;
        appId?: string;
        appSecret?: string;
        dmPolicy?: "pairing" | "allowlist" | "open" | "disabled";
        allowFrom?: (string | number)[];
        thinkingThresholdMs?: number;
        botNames?: string[];
        mediaMaxMb?: number;
    }, {
        name?: string;
        enabled?: boolean;
        appId?: string;
        appSecret?: string;
        dmPolicy?: "pairing" | "allowlist" | "open" | "disabled";
        allowFrom?: (string | number)[];
        thinkingThresholdMs?: number;
        botNames?: string[];
        mediaMaxMb?: number;
    }>, "strip">, z.objectInputType<{}, z.ZodObject<{
        name: z.ZodOptional<z.ZodString>;
        enabled: z.ZodOptional<z.ZodBoolean>;
        appId: z.ZodOptional<z.ZodString>;
        appSecret: z.ZodOptional<z.ZodString>;
        dmPolicy: z.ZodOptional<z.ZodEnum<["pairing", "allowlist", "open", "disabled"]>>;
        allowFrom: z.ZodOptional<z.ZodArray<z.ZodUnion<[z.ZodString, z.ZodNumber]>, "many">>;
        thinkingThresholdMs: z.ZodOptional<z.ZodNumber>;
        botNames: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        mediaMaxMb: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        name?: string;
        enabled?: boolean;
        appId?: string;
        appSecret?: string;
        dmPolicy?: "pairing" | "allowlist" | "open" | "disabled";
        allowFrom?: (string | number)[];
        thinkingThresholdMs?: number;
        botNames?: string[];
        mediaMaxMb?: number;
    }, {
        name?: string;
        enabled?: boolean;
        appId?: string;
        appSecret?: string;
        dmPolicy?: "pairing" | "allowlist" | "open" | "disabled";
        allowFrom?: (string | number)[];
        thinkingThresholdMs?: number;
        botNames?: string[];
        mediaMaxMb?: number;
    }>, "strip">>>;
    defaultAccount: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    accounts?: {} & {
        [k: string]: {
            name?: string;
            enabled?: boolean;
            appId?: string;
            appSecret?: string;
            dmPolicy?: "pairing" | "allowlist" | "open" | "disabled";
            allowFrom?: (string | number)[];
            thinkingThresholdMs?: number;
            botNames?: string[];
            mediaMaxMb?: number;
        };
    };
    defaultAccount?: string;
    name?: string;
    enabled?: boolean;
    appId?: string;
    appSecret?: string;
    dmPolicy?: "pairing" | "allowlist" | "open" | "disabled";
    allowFrom?: (string | number)[];
    thinkingThresholdMs?: number;
    botNames?: string[];
    mediaMaxMb?: number;
}, {
    accounts?: {} & {
        [k: string]: {
            name?: string;
            enabled?: boolean;
            appId?: string;
            appSecret?: string;
            dmPolicy?: "pairing" | "allowlist" | "open" | "disabled";
            allowFrom?: (string | number)[];
            thinkingThresholdMs?: number;
            botNames?: string[];
            mediaMaxMb?: number;
        };
    };
    defaultAccount?: string;
    name?: string;
    enabled?: boolean;
    appId?: string;
    appSecret?: string;
    dmPolicy?: "pairing" | "allowlist" | "open" | "disabled";
    allowFrom?: (string | number)[];
    thinkingThresholdMs?: number;
    botNames?: string[];
    mediaMaxMb?: number;
}>;
//# sourceMappingURL=config-schema.d.ts.map