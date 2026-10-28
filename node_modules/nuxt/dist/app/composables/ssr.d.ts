import { TypedFetch } from "../types/fetch.js";
import { NuxtApp } from "../nuxt.js";
import { NuxtRequestEvent, NuxtRequestEvent as NuxtRequestEvent$1 } from "@nuxt/schema";
//#region src/app/composables/ssr.d.ts
/** @since 3.0.0 */
export declare function useRequestEvent(nuxtApp?: NuxtApp): NuxtRequestEvent$1 | undefined;
/** @since 3.0.0 */
export declare function useRequestHeaders<K extends string = string>(include: K[]): { [key in Lowercase<K>]?: string; };
export declare function useRequestHeaders(): Readonly<Record<string, string>>;
/** @since 3.9.0 */
export declare function useRequestHeader(header: string): string | null | undefined;
/** @since 3.2.0 */
export declare function useRequestFetch(): TypedFetch;
/** @since 3.0.0 */
export declare function setResponseStatus(event: NuxtRequestEvent$1, code?: number, message?: string): void;
/** @deprecated Pass `event` as first option. */
export declare function setResponseStatus(code: number, message?: string): void;
/** @since 3.14.0 */
export declare function useResponseHeader(header: string): import('vue').WritableComputedRef<string | number | string[] | undefined> | import('vue').Ref<string | number | string[] | undefined>;
/** @since 3.8.0 */
export declare function prerenderRoutes(path: string | string[]): void;
/**
 * `onPrehydrate` is a composable lifecycle hook that allows you to run a callback on the client immediately before
 * Nuxt hydrates the page. This is an advanced feature.
 *
 * The callback will be stringified and inlined in the HTML so it should not have any external
 * dependencies (such as auto-imports) or refer to variables defined outside the callback.
 *
 * The callback will run before Nuxt runtime initializes so it should not rely on the Nuxt or Vue context.
 * @since 3.12.0
 */
export declare function onPrehydrate(callback: (el: HTMLElement) => void): void;
//#endregion
export type { NuxtRequestEvent };