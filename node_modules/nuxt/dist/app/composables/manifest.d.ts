import { AppRouteRules, NuxtRequestEvent } from "@nuxt/schema";
//#region src/app/composables/manifest.d.ts
export interface NuxtAppManifestMeta {
  id: string;
  timestamp: number;
}
export interface NuxtAppManifest extends NuxtAppManifestMeta {
  prerendered: string[];
}
/** @since 3.7.4 */
export declare function getAppManifest(): Promise<NuxtAppManifest>;
/** @since 3.7.4 */
export declare function getRouteRules(event: NuxtRequestEvent): AppRouteRules;
export declare function getRouteRules(options: {
  path: string;
}): Record<string, any>;
/** @deprecated use `getRouteRules({ path })` instead */
export declare function getRouteRules(url: string): Record<string, any>;
//#endregion