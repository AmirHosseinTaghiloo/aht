import { NuxtSSRContext } from "#app/types";
//#region src/runtime/server/renderer/no-scripts.d.ts
export declare function detectClientScriptReliance(ssrContext: NuxtSSRContext): string[];
export declare function warnNoScriptsClientReliance(ssrContext: NuxtSSRContext, path: string): void;
//#endregion