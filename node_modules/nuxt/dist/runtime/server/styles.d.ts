//#region src/runtime/server/styles.d.ts
declare const _default: Record<string, () => Promise<string[]>>;
/**
 * For each emitted CSS file whose `<link>` may be dropped at render time, the
 * groups of module IDs that inline its contents. The link can be dropped for a
 * request when every group has at least one module in `ssrContext.modules`.
 */
export declare const inlinedCSS: Record<string, string[][]>;
//#endregion
export { _default as default };