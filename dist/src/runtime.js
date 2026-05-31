/**
 * Global runtime reference for the Feishu plugin.
 */
let runtime = null;
export function setFeishuRuntime(next) {
    runtime = next;
}
export function getFeishuRuntime() {
    if (!runtime) {
        throw new Error("Feishu runtime not initialized");
    }
    return runtime;
}
//# sourceMappingURL=runtime.js.map