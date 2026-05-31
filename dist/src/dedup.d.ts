/**
 * Message deduplication — Feishu may deliver the same event more than once.
 */
/** Garbage-collect expired entries and check for duplicates. */
export declare function isDuplicate(messageId: string | undefined | null): boolean;
/** Clear all dedup state (for testing). */
export declare function clearDedup(): void;
//# sourceMappingURL=dedup.d.ts.map