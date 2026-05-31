/**
 * Message deduplication — Feishu may deliver the same event more than once.
 */
const SEEN_TTL_MS = 10 * 60 * 1000; // 10 minutes
const seen = new Map();
/** Garbage-collect expired entries and check for duplicates. */
export function isDuplicate(messageId) {
    const now = Date.now();
    // GC old entries
    for (const [k, ts] of seen) {
        if (now - ts > SEEN_TTL_MS)
            seen.delete(k);
    }
    if (!messageId)
        return false;
    if (seen.has(messageId))
        return true;
    seen.set(messageId, now);
    return false;
}
/** Clear all dedup state (for testing). */
export function clearDedup() {
    seen.clear();
}
//# sourceMappingURL=dedup.js.map