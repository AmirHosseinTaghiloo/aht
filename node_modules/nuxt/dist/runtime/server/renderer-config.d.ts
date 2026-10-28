import { CreateServerHeadOptions } from "@unhead/vue/server";
import { SerializableHead } from "@unhead/vue/types";
//#region src/runtime/server/renderer-config.d.ts
/**
 * Build-time configuration for the SSR renderer, provided by the configured
 * `server.builder`, which replaces this module in its server bundle. Values are
 * inlined so a build folds away the branches it does not use; anything only known
 * at runtime is passed to `createNuxtRenderer()` instead.
 *
 * The defaults below describe a build with every optional feature disabled.
 */
/** Whether `ssr: false` is set for the whole app. */
export declare const NUXT_NO_SSR: boolean;
/** Status codes whose error pages (`404.html` and so on) are server-rendered at build time. */
export declare const NUXT_PRERENDER_ERROR_PAGES: number[];
/** Prerendered routes written out as an empty SPA shell. */
export declare const NUXT_PRERENDER_NO_SSR_ROUTES: string[];
/** Whether to send `103 Early Hints`. */
export declare const NUXT_EARLY_HINTS: boolean;
/** Whether every route is served without scripts. */
export declare const NUXT_NO_SCRIPTS: boolean;
/** Whether any route rule serves its route without scripts. */
export declare const NUXT_HAS_NO_SCRIPTS_ROUTES: boolean;
/** Whether scripts will be stripped in production only (dev-only diagnostics). */
export declare const NUXT_NO_SCRIPTS_PROD: boolean;
/** Whether CSS is inlined into the document. */
export declare const NUXT_INLINE_STYLES: boolean;
/** Whether cross-document view transitions are enabled. */
export declare const NUXT_VIEW_TRANSITIONS: boolean;
/** `href_matches` patterns for routes served without scripts. */
export declare const NUXT_NO_SCRIPTS_PATTERNS: string[];
/** `href_matches` patterns for every page route. */
export declare const NUXT_PAGE_PATTERNS: string[];
/** Whether unmatched page paths 404 before the app is loaded. */
export declare const NUXT_EARLY_404: boolean;
/** Matcher compiled from every page route, present when {@link NUXT_EARLY_404} is set. */
export declare const NUXT_PAGE_MATCHER: ((method: string, path: string) => unknown) | undefined;
/** Whether payloads are rendered as JSON rather than as inline JavaScript. */
export declare const NUXT_JSON_PAYLOADS: boolean;
/** Whether the renderer renders the error page itself, rather than the server runtime doing it. */
export declare const NUXT_INLINE_ERROR_RENDERING: boolean;
/** Whether `error.data` reaches the error page stringified. */
export declare const PARSE_ERROR_DATA: boolean;
/** Whether payloads are extracted into `_payload.json` when prerendering. */
export declare const NUXT_PAYLOAD_EXTRACTION: boolean;
/** Whether the full payload is inlined into the document. */
export declare const NUXT_PAYLOAD_INLINE: boolean;
/** Whether payloads are extracted at runtime for cached routes. */
export declare const NUXT_RUNTIME_PAYLOAD_EXTRACTION: boolean;
/** Whether SSR streaming is enabled. */
export declare const NUXT_SSR_STREAMING: boolean;
/** User agents that are served a buffered response even when streaming is enabled. */
export declare const NUXT_SSR_STREAMING_BOT_RE: RegExp;
/** Head entries configured in `app.head`. */
export declare const appHead: SerializableHead;
export declare const appRootTag: string;
export declare const appRootAttrs: Record<string, string>;
export declare const appTeleportTag: string;
export declare const appTeleportAttrs: Record<string, string>;
export declare const appSpaLoaderTag: string;
export declare const appSpaLoaderAttrs: Record<string, string>;
export declare const spaLoadingTemplateOutside: boolean;
/** Markup rendered inside the app root while a client-only app boots. */
export declare const spaTemplate: string;
export declare const appId: string;
export declare const multiApp: boolean;
/** Whether island rendering is compiled into the build. */
export declare const componentIslands: boolean;
/** Whether the app actually renders islands (server components or server pages). */
export declare const componentIslandsActive: boolean;
/** Whether Nuxt-owned `diagnostics_channel` tracing is enabled. */
export declare const tracingChannelNuxt: boolean;
/** Options `unhead` is created with for each request. */
export declare const unheadOptions: CreateServerHeadOptions;
/** Options applied when rendering head tags. */
export declare const renderSSRHeadOptions: {
  omitLineBreaks?: boolean;
};
/** File name of the streaming bootstrap chunk, when SSR streaming is enabled. */
export declare const iifeChunkFileName: string | undefined;
//#endregion