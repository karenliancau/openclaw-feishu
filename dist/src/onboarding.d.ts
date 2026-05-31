/**
 * Feishu onboarding wizard adapter.
 */
import type { ClawdbotConfig } from "openclaw/plugin-sdk";
/** WizardPrompter interface for onboarding. */
interface WizardPrompter {
    note(message: string, title?: string): Promise<void>;
    text(opts: {
        message: string;
        placeholder?: string;
        initialValue?: string;
        validate?: (value: unknown) => string | undefined;
    }): Promise<string>;
    select<T>(opts: {
        message: string;
        options: Array<{
            value: T;
            label: string;
        }>;
        initialValue?: T;
    }): Promise<T>;
    confirm?(opts: {
        message: string;
        initialValue?: boolean;
    }): Promise<boolean>;
}
/** Feishu onboarding adapter for the channel. */
export declare const feishuOnboardingAdapter: {
    /** Check if Feishu channel is configured. */
    configuredCheck: (cfg: ClawdbotConfig) => boolean;
    /** Set the DM policy. */
    setDmPolicy: (cfg: ClawdbotConfig, policy: "pairing" | "allowlist" | "open" | "disabled") => ClawdbotConfig;
    /** Prompt user for allowFrom configuration. */
    promptAllowFrom: (params: {
        cfg: ClawdbotConfig;
        prompter: WizardPrompter;
        accountId: string;
    }) => Promise<ClawdbotConfig>;
    /** Show setup help notes. */
    noteSetupHelp: (prompter: WizardPrompter) => Promise<void>;
    /** Run the full setup wizard. */
    runSetupWizard: (params: {
        cfg: ClawdbotConfig;
        prompter: WizardPrompter;
        accountOverrides?: Record<string, string | undefined>;
        shouldPromptAccountIds?: boolean;
        forceAllowFrom?: boolean;
    }) => Promise<ClawdbotConfig>;
};
export {};
//# sourceMappingURL=onboarding.d.ts.map