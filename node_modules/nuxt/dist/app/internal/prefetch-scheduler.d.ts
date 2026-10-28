import { PrefetchScheduler } from "./prefetch.js";
import { NuxtApp } from "../nuxt.js";
//#region src/app/internal/prefetch-scheduler.d.ts
/**
 * The single scheduler every client-side prefetch mechanism queues work on.
 * @internal
 */
export declare function usePrefetchScheduler(nuxtApp?: NuxtApp): PrefetchScheduler;
//#endregion