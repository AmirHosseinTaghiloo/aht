import { NuxtRendererOptions, RendererEvent } from "./runtime.js";
//#region src/runtime/server/renderer/early-404.d.ts
/**
 * Throw a 404 error for paths that cannot match any page route, so the app
 * (and its plugins and middleware) is never loaded for them.
 *
 * When a `cache` route rule covers the path, its `maxAge` is advertised on
 * GET/HEAD misses too, so CDNs can absorb repeat probes for unknown paths.
 */
export declare function throwIfUnmatchedPagePath(options: NuxtRendererOptions, event: RendererEvent, routeOptions: {
  cache?: {
    maxAge?: number;
  } | false;
}): void;
//#endregion