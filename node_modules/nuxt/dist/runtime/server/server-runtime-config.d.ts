import { RuntimeConfig } from "nuxt/schema";
//#region src/runtime/server/server-runtime-config.d.ts
/**
 * Runtime configuration, the one thing the portable `nuxt/server`
 * implementations cannot resolve for themselves. The configured
 * `server.builder` replaces this module with a re-export of
 * `serverBuild.runtime.runtimeConfig`.
 *
 * The body below describes a bundle that did not replace it.
 */
export declare function useRuntimeConfig(): RuntimeConfig;
//#endregion