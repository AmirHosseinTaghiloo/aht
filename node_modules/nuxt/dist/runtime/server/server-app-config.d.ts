import { SharedAppConfig } from "nuxt/schema";
//#region src/runtime/server/server-app-config.d.ts
/**
 * The app config, as the app build merges it. A server bundle replaces this
 * module with the build's own.
 *
 * The body below describes a bundle that did not replace it.
 */
declare const _default: SharedAppConfig;
//#endregion
export { _default as default };