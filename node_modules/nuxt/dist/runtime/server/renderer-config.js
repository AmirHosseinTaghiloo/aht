//#region src/runtime/server/renderer-config.ts
/**
* Build-time configuration for the SSR renderer, provided by the configured
* `server.builder`, which replaces this module in its server bundle. Values are
* inlined so a build folds away the branches it does not use; anything only known
* at runtime is passed to `createNuxtRenderer()` instead.
*
* The defaults below describe a build with every optional feature disabled.
*/
/** Whether `ssr: false` is set for the whole app. */
const NUXT_NO_SSR = false;
/** Status codes whose error pages (`404.html` and so on) are server-rendered at build time. */
const NUXT_PRERENDER_ERROR_PAGES = [];
/** Prerendered routes written out as an empty SPA shell. */
const NUXT_PRERENDER_NO_SSR_ROUTES = [];
/** Whether to send `103 Early Hints`. */
const NUXT_EARLY_HINTS = false;
/** Whether every route is served without scripts. */
const NUXT_NO_SCRIPTS = false;
/** Whether any route rule serves its route without scripts. */
const NUXT_HAS_NO_SCRIPTS_ROUTES = false;
/** Whether scripts will be stripped in production only (dev-only diagnostics). */
const NUXT_NO_SCRIPTS_PROD = false;
/** Whether CSS is inlined into the document. */
const NUXT_INLINE_STYLES = false;
/** Whether cross-document view transitions are enabled. */
const NUXT_VIEW_TRANSITIONS = false;
/** `href_matches` patterns for routes served without scripts. */
const NUXT_NO_SCRIPTS_PATTERNS = [];
/** `href_matches` patterns for every page route. */
const NUXT_PAGE_PATTERNS = [];
/** Whether unmatched page paths 404 before the app is loaded. */
const NUXT_EARLY_404 = false;
/** Matcher compiled from every page route, present when {@link NUXT_EARLY_404} is set. */
const NUXT_PAGE_MATCHER = void 0;
/** Whether payloads are rendered as JSON rather than as inline JavaScript. */
const NUXT_JSON_PAYLOADS = true;
/** Whether the renderer renders the error page itself, rather than the server runtime doing it. */
const NUXT_INLINE_ERROR_RENDERING = false;
/** Whether `error.data` reaches the error page stringified. */
const PARSE_ERROR_DATA = true;
/** Whether payloads are extracted into `_payload.json` when prerendering. */
const NUXT_PAYLOAD_EXTRACTION = false;
/** Whether the full payload is inlined into the document. */
const NUXT_PAYLOAD_INLINE = true;
/** Whether payloads are extracted at runtime for cached routes. */
const NUXT_RUNTIME_PAYLOAD_EXTRACTION = false;
/** Whether SSR streaming is enabled. */
const NUXT_SSR_STREAMING = false;
/** User agents that are served a buffered response even when streaming is enabled. */
const NUXT_SSR_STREAMING_BOT_RE = /^$/;
/** Head entries configured in `app.head`. */
const appHead = {};
const appRootTag = "div";
const appRootAttrs = { id: "__nuxt" };
const appTeleportTag = "div";
const appTeleportAttrs = { id: "teleports" };
const appSpaLoaderTag = "div";
const appSpaLoaderAttrs = { id: "__nuxt-loader" };
const spaLoadingTemplateOutside = false;
/** Markup rendered inside the app root while a client-only app boots. */
const spaTemplate = "";
const appId = "nuxt-app";
const multiApp = false;
/** Whether island rendering is compiled into the build. */
const componentIslands = false;
/** Whether the app actually renders islands (server components or server pages). */
const componentIslandsActive = false;
/** Whether Nuxt-owned `diagnostics_channel` tracing is enabled. */
const tracingChannelNuxt = false;
/** Options `unhead` is created with for each request. */
const unheadOptions = {};
/** Options applied when rendering head tags. */
const renderSSRHeadOptions = {};
/** File name of the streaming bootstrap chunk, when SSR streaming is enabled. */
const iifeChunkFileName = void 0;
//#endregion
export { NUXT_EARLY_404, NUXT_EARLY_HINTS, NUXT_HAS_NO_SCRIPTS_ROUTES, NUXT_INLINE_ERROR_RENDERING, NUXT_INLINE_STYLES, NUXT_JSON_PAYLOADS, NUXT_NO_SCRIPTS, NUXT_NO_SCRIPTS_PATTERNS, NUXT_NO_SCRIPTS_PROD, NUXT_NO_SSR, NUXT_PAGE_MATCHER, NUXT_PAGE_PATTERNS, NUXT_PAYLOAD_EXTRACTION, NUXT_PAYLOAD_INLINE, NUXT_PRERENDER_ERROR_PAGES, NUXT_PRERENDER_NO_SSR_ROUTES, NUXT_RUNTIME_PAYLOAD_EXTRACTION, NUXT_SSR_STREAMING, NUXT_SSR_STREAMING_BOT_RE, NUXT_VIEW_TRANSITIONS, PARSE_ERROR_DATA, appHead, appId, appRootAttrs, appRootTag, appSpaLoaderAttrs, appSpaLoaderTag, appTeleportAttrs, appTeleportTag, componentIslands, componentIslandsActive, iifeChunkFileName, multiApp, renderSSRHeadOptions, spaLoadingTemplateOutside, spaTemplate, tracingChannelNuxt, unheadOptions };
