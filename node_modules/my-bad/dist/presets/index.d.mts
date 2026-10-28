import { f as ReportPreset, x as TraceEntry } from "../types-D1lJMV_Y.mjs";
import { n as Theme } from "../state-BKNiU79r.mjs";
//#region src/presets/env.d.ts
interface EnvPresetOptions {
  /** Extra versions to include, e.g. `{ nuxt: '4.0.0' }`. */
  versions?: Record<string, string | undefined>;
}
/** Adds a collapsed `Environment` section with runtime and package versions. */
export declare function envPreset(options?: EnvPresetOptions): ReportPreset;
//#endregion
//#region src/presets/h3.d.ts
interface RequestPresetOptions {
  /** Header names (lower-case) whose values are replaced with `[redacted]`. */
  redact?: string[];
  /** Include a collapsed `Headers` section. Default `true`. */
  headers?: boolean;
}
interface RequestLike {
  method?: string;
  url?: string;
  headers?: Headers | Record<string, string | string[] | undefined> | Iterable<[string, string]>;
}
/** Extract a request-like object from an h3 v1/v2 event, a Fetch `Request`, or a Node `IncomingMessage`. */
export declare function requestFromContext(context: Record<string, unknown>): RequestLike | undefined;
/** Adds `Request` and `Headers` sections from `context.event`, `context.request` or `context.req`. */
export declare function requestPreset(options?: RequestPresetOptions): ReportPreset;
/** Alias of `requestPreset` with Nitro/h3 runtime frames marked internal. */
export declare function nitroPreset(options?: RequestPresetOptions): ReportPreset;
//#endregion
//#region src/presets/nuxt.d.ts
interface NuxtPresetOptions {
  /** Versions for the environment section. */
  versions?: Record<string, string | undefined>;
  /** Base URL for error code documentation. Default `https://nuxt.com/docs/errors/`, which redirects to the current version. */
  docsBase?: string;
  redact?: string[];
}
/**
 * Nuxt support: error codes linked to docs, Nuxt/Nitro/Vue internals collapsed,
 * request and route sections, and Vue component traces.
 */
export declare function nuxtPreset(options?: NuxtPresetOptions): ReportPreset;
/**
 * Nuxt brand for `renderPage` / `renderOverlay`, following https://nuxt.com/design.md:
 * green accent on neutral surfaces, Outfit headings and Inter body when installed, and
 * the icon lockup in the header.
 */
export declare const nuxtTheme: Theme;
//#endregion
//#region src/presets/vue.d.ts
interface VueLikeInstance {
  type?: {
    __name?: string;
    name?: string;
    __file?: string;
  };
  parent?: VueLikeInstance | null;
  /** Internal instance, present when given a public instance proxy. */
  $?: VueLikeInstance;
}
/** Parse the `trace` string Vue passes to `app.config.warnHandler`. */
export declare function parseVueTrace(trace: string): TraceEntry[];
/** Build a component trace from a Vue component instance (`getCurrentInstance()` or the `instance` argument of `errorHandler`). */
export declare function traceFromInstance(instance: VueLikeInstance | null | undefined): TraceEntry[];
interface VuePresetOptions {
  /** Patterns marking frames as framework internals in addition to Vue's own. */
  internal?: (string | RegExp)[];
}
/**
 * Vue support: component traces from `context.instance` or `context.trace`,
 * Vue runtime frames marked as internal.
 */
export declare function vuePreset(options?: VuePresetOptions): ReportPreset;
//#endregion
export { type EnvPresetOptions, type NuxtPresetOptions, type RequestPresetOptions, type VuePresetOptions, requestPreset as h3Preset };