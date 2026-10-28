//#region src/runtime/server/styles.ts
var styles_default = {};
/**
* For each emitted CSS file whose `<link>` may be dropped at render time, the
* groups of module IDs that inline its contents. The link can be dropped for a
* request when every group has at least one module in `ssrContext.modules`.
*/
const inlinedCSS = {};
//#endregion
export { styles_default as default, inlinedCSS };
