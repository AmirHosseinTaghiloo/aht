import { NuxtPayload } from "../types.js";
import { NUXT_ERROR_SIGNATURE, NuxtError, THROWN_CONTEXT, THROWN_VALUE, ThrownContext, createError, createErrorFromThrown, isNuxtError } from "../error.js";
import { NuxtApp } from "../nuxt.js";
import { Ref } from "vue";
//#region src/app/composables/error.d.ts
/** @since 3.0.0 */
export declare const useError: () => Ref<NuxtPayload["error"]>;
/** @since 3.0.0 */
export declare const showError: <DataT = unknown>(error: string | Error | (Partial<NuxtError<DataT>> & {
  status?: number;
  statusText?: string;
})) => NuxtError<DataT>;
/**
 * Notify the app of an error caught for a crawler without rendering the error
 * page, so the bot indexes the server-rendered HTML instead (#32137, #35338).
 *
 * @internal
 */
export declare const _notifyCrawlerError: (nuxtApp: NuxtApp, error: Error) => Promise<void> | void;
/**
 * Show the error page unless the current client is a crawler, in which case the
 * bot receives the already server-rendered HTML instead (#32137, #35338).
 *
 * @internal
 */
export declare const _showErrorUnlessCrawler: (nuxtApp: NuxtApp, error: Error) => Promise<void>;
/** @since 3.0.0 */
export declare const clearError: (options?: {
  redirect?: string;
}) => Promise<void>;
//#endregion
export { NUXT_ERROR_SIGNATURE, type NuxtError, THROWN_CONTEXT, THROWN_VALUE, type ThrownContext, createError, createErrorFromThrown, isNuxtError };