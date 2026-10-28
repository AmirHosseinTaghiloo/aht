import { appendResponseHeader } from "h3";
//#region src/runtime/utils/prerender.ts
/** The header Nitro's prerenderer reads additional routes to crawl from. */
const NITRO_PRERENDER_HEADER = "x-nitro-prerender";
/** The header a Nuxt island response carries its own hints on, read by `<NuxtIsland>`. */
const NUXT_PRERENDER_HEADER = "x-nuxt-prerender";
function encodeHints(paths) {
	return paths.map((path) => encodeURIComponent(path)).join(", ");
}
/**
* Translate the routes collected on the event's Nuxt context into the header Nitro's
* prerenderer reads, so that `prerenderRoutes()` and the renderer's own hints reach the
* crawler without either of them naming a Nitro header.
*/
function applyPrerenderHints(event) {
	const paths = event.context.nuxt?.prerenderRoutes;
	if (!paths?.length) return;
	appendResponseHeader(event, NITRO_PRERENDER_HEADER, encodeHints(paths));
}
/**
* Emit the hints collected while rendering an island on the island response, which crosses
* HTTP back to the page that embedded it. Nitro only crawls the header of HTML routes, so the
* page forwards these onto its own context once it has read them.
*/
function applyIslandPrerenderHints(event) {
	const paths = event.context.nuxt?.prerenderRoutes;
	if (!paths?.length) return;
	appendResponseHeader(event, NUXT_PRERENDER_HEADER, encodeHints(paths));
	appendResponseHeader(event, NITRO_PRERENDER_HEADER, encodeHints(paths));
}
//#endregion
export { applyIslandPrerenderHints, applyPrerenderHints };
