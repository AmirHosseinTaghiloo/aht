import { NuxtAppLiterals } from "../types.js";
import { Component } from "vue";
import { RouteLocationRaw, Router } from "vue-router";
//#region src/app/composables/preload.d.ts
/**
 * Preload a component or components that have been globally registered.
 * @param components Pascal-cased name or names of components to prefetch
 * @since 3.0.0
 */
export declare const preloadComponents: (components: NuxtAppLiterals["componentName"] | Array<NuxtAppLiterals["componentName"]>) => Promise<void>;
/**
 * Prefetch a component or components that have been globally registered.
 * @param components Pascal-cased name or names of components to prefetch
 * @since 3.0.0
 */
export declare const prefetchComponents: (components: NuxtAppLiterals["componentName"] | Array<NuxtAppLiterals["componentName"]>) => Promise<void> | undefined;
export declare function _loadAsyncComponent(component: Component): unknown;
/** @since 3.0.0 */
export declare function preloadRouteComponents(to: RouteLocationRaw, router?: Router): Promise<void>;
/**
 * Queued form of `preloadRouteComponents`, throttled and promoted with the destination's other work.
 * @internal
 */
export declare function prefetchRouteComponents(to: RouteLocationRaw, router: Router): void;
//#endregion