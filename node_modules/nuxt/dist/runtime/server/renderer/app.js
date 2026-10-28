import { appEvent, getRequestState } from "./runtime.js";
import { urlHash } from "./url.js";
import { createHead } from "@unhead/vue/server";
import { createStreamableHead } from "@unhead/vue/stream/server";
import { NUXT_NO_SSR, NUXT_PRERENDER_NO_SSR_ROUTES, NUXT_SSR_STREAMING, unheadOptions } from "nuxt/internal/renderer-config";
//#region src/runtime/server/renderer/app.ts
const PRERENDER_NO_SSR_ROUTES = new Set(NUXT_PRERENDER_NO_SSR_ROUTES);
function createServerHead() {
	if (!NUXT_SSR_STREAMING) return createHead(unheadOptions);
	const { head } = createStreamableHead({
		...unheadOptions,
		writesBodyTags: true
	});
	return head;
}
function createSSRContext(options, event) {
	const url = event.url.pathname + event.url.search + urlHash(event.url);
	const ssrContext = {
		url,
		event: appEvent(event),
		runtimeConfig: options.runtimeConfig(event),
		noSSR: !!NUXT_NO_SSR || getRequestState(event)?.noSSR || (import.meta.prerender ? PRERENDER_NO_SSR_ROUTES.has(url) : false),
		head: createServerHead(),
		error: false,
		nuxt: void 0,
		payload: {},
		["~payloadReducers"]: Object.create(null),
		modules: /* @__PURE__ */ new Set()
	};
	if (import.meta.prerender) {
		const sharedDataCache = options.prerender?.sharedDataCache;
		if (sharedDataCache) ssrContext["~sharedPrerenderCache"] = sharedDataCache;
		ssrContext.payload.prerenderedAt = Date.now();
	}
	return ssrContext;
}
/**
* Turn the response the renderer assembled into a web-standard `Response`, carrying the
* headers queued on the event alongside the ones the response names for itself.
*/
function returnRenderResponse(options, event, response) {
	const headers = new Headers(event.res.headers);
	for (const name in response.headers) headers.set(name, response.headers[name]);
	return options.createResponse(response.body ?? null, {
		status: response.statusCode ?? event.res.status,
		statusText: response.statusMessage ?? event.res.statusText,
		headers
	});
}
function setSSRError(ssrContext, error) {
	ssrContext.error = true;
	ssrContext.payload = { error };
	ssrContext.url = error.url;
}
//#endregion
export { createSSRContext, returnRenderResponse, setSSRError };
