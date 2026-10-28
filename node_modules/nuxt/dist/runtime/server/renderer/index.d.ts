import { CachedResponse, NuxtRendererOptions, NuxtRequestState, PayloadCache, RenderedResponse, RendererEvent, RendererHooks, RendererRouteRules, appEvent } from "./runtime.js";
import { NuxtRendererInstance, createRendererInstance } from "./instance.js";
//#region src/runtime/server/renderer/index.d.ts
/**
 * Create a Nuxt SSR renderer, returning a web-standard handler for the requests a Nuxt
 * app serves from its pages.
 *
 * Everything the renderer reads belongs to the renderer it was created for, so a bundle
 * may create as many as it needs. Pass an instance from `createRendererInstance()` to
 * render against the artifacts already loaded for another renderer.
 */
export declare function createNuxtRenderer(optionsOrInstance: NuxtRendererOptions | NuxtRendererInstance): {
  fetch: (event: RendererEvent) => Promise<Response>;
};
//#endregion
export { type CachedResponse, type NuxtRendererInstance, type NuxtRendererOptions, type NuxtRequestState, type PayloadCache, type RenderedResponse, type RendererEvent, type RendererHooks, type RendererRouteRules, appEvent, createRendererInstance };