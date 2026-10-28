import { traceAsync } from "../../../app/internal/tracing.js";
import { addPrerenderRoutes, appEvent, getRequestState } from "./runtime.js";
import { payloadRequestToRoute, routeToPayloadURL, urlHash, withRequestPath } from "./url.js";
import { createSSRContext, returnRenderResponse, setSSRError } from "./app.js";
import { rendererDiagnostics } from "./diagnostics.js";
import { APP_ROOT_CLOSE_TAG, APP_ROOT_OPEN_TAG } from "./build-files.js";
import { extractCspNonce } from "./csp-nonce.js";
import { throwIfUnmatchedPagePath } from "./early-404.js";
import { describeError, isExpectedError, stringifyErrorData } from "./error.js";
import { mergeHeaders } from "./headers.js";
import { renderPayloadJsonScript, renderPayloadResponse, renderPayloadScript, splitPayload } from "./payload.js";
import { renderInlineStyles } from "./inline-styles.js";
import { createInlinedCSSFilter } from "./inlined-css.js";
import { renderStreamedIslandTeleports, replaceIslandTeleports } from "./islands.js";
import { warnNoScriptsClientReliance } from "./no-scripts.js";
import { createRendererInstance } from "./instance.js";
import { getQuery, joinURL } from "ufo";
import { renderToWebStream } from "vue/server-renderer";
import { relative } from "pathe";
import { propsToString, renderSSRHead } from "@unhead/vue/server";
import { createBootstrapScript, renderSSRHeadSuspenseChunk, renderShell, renderStreamBodyTags } from "@unhead/vue/stream/server";
import { NUXT_EARLY_404, NUXT_EARLY_HINTS, NUXT_HAS_NO_SCRIPTS_ROUTES, NUXT_INLINE_ERROR_RENDERING, NUXT_INLINE_STYLES, NUXT_JSON_PAYLOADS, NUXT_NO_SCRIPTS, NUXT_NO_SCRIPTS_PATTERNS, NUXT_NO_SCRIPTS_PROD, NUXT_PAGE_PATTERNS, NUXT_PAYLOAD_EXTRACTION, NUXT_PAYLOAD_INLINE, NUXT_PRERENDER_ERROR_PAGES, NUXT_RUNTIME_PAYLOAD_EXTRACTION, NUXT_SSR_STREAMING, NUXT_SSR_STREAMING_BOT_RE, NUXT_VIEW_TRANSITIONS, PARSE_ERROR_DATA, appHead, appTeleportAttrs, appTeleportTag, componentIslands, componentIslandsActive, iifeChunkFileName, renderSSRHeadOptions, tracingChannelNuxt } from "nuxt/internal/renderer-config";
import { getPrefetchLinks, getPreloadLinks, getRequestDependencies, renderResourceHeaders } from "vue-bundle-renderer/runtime";
import { streamingIifeCode } from "@unhead/vue/stream/iife";
import destr from "destr";
import entryIds from "nuxt/internal/entry-ids";
import { entryFileName } from "nuxt/internal/entry-chunk";
//#region src/runtime/server/renderer/index.ts
const HAS_APP_TELEPORTS = !!(appTeleportTag && appTeleportAttrs.id);
const APP_TELEPORT_OPEN_TAG = HAS_APP_TELEPORTS ? `<${appTeleportTag}${propsToString(appTeleportAttrs)}>` : "";
const APP_TELEPORT_CLOSE_TAG = HAS_APP_TELEPORTS ? `</${appTeleportTag}>` : "";
const PAYLOAD_URL_RE = NUXT_JSON_PAYLOADS ? /^[^?]*\/_payload.json(?:\?.*)?$/ : /^[^?]*\/_payload.js(?:\?.*)?$/;
const PAYLOAD_FILENAME = NUXT_JSON_PAYLOADS ? "_payload.json" : "_payload.js";
const SSR_BOT_RE = NUXT_SSR_STREAMING_BOT_RE;
/**
* Create a Nuxt SSR renderer, returning a web-standard handler for the requests a Nuxt
* app serves from its pages.
*
* Everything the renderer reads belongs to the renderer it was created for, so a bundle
* may create as many as it needs. Pass an instance from `createRendererInstance()` to
* render against the artifacts already loaded for another renderer.
*/
function createNuxtRenderer(optionsOrInstance) {
	const instance = "getRenderer" in optionsOrInstance ? optionsOrInstance : createRendererInstance(optionsOrInstance);
	return { fetch: (event) => fetch(instance, event) };
}
function fetch(instance, event) {
	const runtime = instance.options;
	if (componentIslands && runtime.renderIsland && event.url.pathname.startsWith("/__nuxt_island/")) return Promise.resolve(runtime.renderIsland(event));
	const isErrorRoute = event.url.pathname.startsWith("/__nuxt_error");
	const inlineErrors = NUXT_INLINE_ERROR_RENDERING && !getRequestState(event)?.["~rendering-error"] && !PAYLOAD_URL_RE.test(event.url.pathname);
	if (isErrorRoute && !getRequestState(event)?.["~rendering-error"]) {
		if (inlineErrors) return renderErrorResponse(instance, event, runtime.createError({
			status: 404,
			statusText: "Page Not Found: /__nuxt_error"
		}));
		return Promise.reject(runtime.createError({
			status: 404,
			statusText: "Page Not Found: /__nuxt_error"
		}));
	}
	const ssrError = isErrorRoute ? getQuery(event.url.href) : import.meta.prerender ? getPrerenderedErrorPage(event) : null;
	const render = () => renderRoute(instance, event, ssrError).then((response) => returnRenderResponse(runtime, event, response));
	const wrapRender = import.meta.prerender ? runtime.prerender?.wrapRender : void 0;
	const rendering = wrapRender ? wrapRender(event, render) : render();
	return inlineErrors ? rendering.catch((error) => renderErrorResponse(instance, event, error)) : rendering;
}
/**
* Answer a failed render with the app's own error page, rendered on the same event so the
* headers and cookies the failed render wrote survive. There is one attempt: an error page
* that throws is answered with the static template, carrying the status the app failed with.
*/
async function renderErrorResponse(instance, event, error) {
	const runtime = instance.options;
	const described = describeError(error);
	await captureError(runtime, event, error);
	const devError = import.meta.dev ? await runtime.onDevError?.(error, event, { expected: isExpectedError(error, described) }).catch(() => void 0) : void 0;
	event.res.status = 200;
	event.res.statusText = "";
	let rendered;
	try {
		rendered = await renderRoute(instance, event, await toSSRError(described, error, event));
	} catch (nested) {
		await captureError(runtime, event, nested, ["error-page"]);
		return staticErrorResponse(runtime, event, described, devError);
	}
	const headers = new Headers(event.res.headers);
	for (const name in rendered.headers) headers.set(name, rendered.headers[name]);
	mergeHeaders(headers, described.headers);
	headers.set("content-type", "text/html;charset=utf-8");
	let body = rendered.body ?? null;
	if (import.meta.dev && devError && !import.meta.test) {
		const html = typeof body === "string" ? body : await new Response(body).text();
		body = await devError.overlay(html).catch(() => html);
	}
	const status = rendered.statusCode ?? event.res.status;
	return runtime.createResponse(body, {
		status: status && status !== 200 ? status : described.status,
		statusText: rendered.statusMessage || described.statusText,
		headers
	});
}
/** Hand the error to the server runtime's error sink, which must never replace the error. */
async function captureError(runtime, event, error, tags) {
	try {
		await runtime.captureError?.(error, {
			event,
			tags
		});
	} catch {}
}
/** The error page of last resort, for when the app's own error page cannot render either. */
async function staticErrorResponse(runtime, event, described, devError) {
	const headers = mergeHeaders(new Headers(event.res.headers), described.headers);
	headers.set("content-type", "text/html;charset=utf-8");
	const init = {
		status: described.status,
		statusText: described.statusText,
		headers
	};
	if (import.meta.dev && devError) {
		const page = await devError.page().catch(() => void 0);
		if (page) return runtime.createResponse(page, init);
	}
	const { template } = await import("./error-template.js");
	return runtime.createResponse(template({
		status: described.status,
		statusText: described.statusText,
		...import.meta.dev && { description: described.message }
	}), init);
}
/** The caught error in the shape `error.vue` receives through the payload. */
async function toSSRError(described, error, event) {
	const candidate = error || {};
	const ssrError = {
		status: described.status,
		statusText: described.statusText,
		statusMessage: described.statusText,
		message: described.message,
		data: PARSE_ERROR_DATA ? described.data : stringifyErrorData(described.data),
		fatal: candidate.fatal ?? false,
		unhandled: candidate.unhandled,
		url: event.url.pathname + event.url.search + urlHash(event.url),
		...import.meta.dev && { stack: candidate.stack }
	};
	if (import.meta.dev && candidate.cause !== void 0) {
		const { serializeErrorCause } = await import("nuxt/internal/dev-error");
		ssrError.cause = serializeErrorCause(candidate.cause);
	}
	return ssrError;
}
const ERROR_PAGE_RE = /^\/(\d{3})\.html$/;
const STATUS_TEXT = {
	400: "Bad Request",
	401: "Unauthorized",
	403: "Forbidden",
	404: "Page Not Found",
	410: "Gone",
	500: "Internal Server Error",
	503: "Service Unavailable"
};
function isPrerenderedErrorPage(pathname) {
	const status = Number(ERROR_PAGE_RE.exec(pathname)?.[1]);
	return status && NUXT_PRERENDER_ERROR_PAGES.includes(status) ? status : void 0;
}
/**
* Synthesise the error a static error page (`404.html` and friends) renders
* with, so the page is server-rendered at build time rather than written out as
* an empty SPA shell.
*/
function getPrerenderedErrorPage(event) {
	const pathname = event.url.pathname;
	const status = isPrerenderedErrorPage(pathname);
	if (!status) return null;
	const statusText = STATUS_TEXT[status] || "Error";
	return {
		status,
		statusText,
		message: statusText,
		fatal: false,
		url: pathname
	};
}
async function renderRoute(instance, event, ssrError) {
	const runtime = instance.options;
	const hooks = runtime.hooks();
	const hookEvent = appEvent(event);
	const payloadCache = runtime.prerender?.payloadCache;
	const ssrContext = createSSRContext(runtime, event);
	ssrContext.head.push(appHead);
	if (ssrError) {
		const status = ssrError.status || ssrError.statusCode;
		if (status) ssrError.status = ssrError.statusCode = Number.parseInt(status);
		if (PARSE_ERROR_DATA && typeof ssrError.data === "string") try {
			ssrError.data = destr(ssrError.data);
		} catch {}
		if (import.meta.dev && typeof ssrError.cause === "string") ssrError.cause = destr(ssrError.cause);
		setSSRError(ssrContext, ssrError);
	}
	const routeOptions = runtime.getRouteRules(event);
	const NO_SCRIPTS = NUXT_NO_SCRIPTS || !!routeOptions.noScripts;
	if (routeOptions.ssr === false && !(NUXT_INLINE_ERROR_RENDERING && ssrError)) ssrContext.noSSR = true;
	if (NUXT_EARLY_404 && !ssrError && !(import.meta.prerender && ssrContext.noSSR)) throwIfUnmatchedPagePath(runtime, event, routeOptions);
	const _PAYLOAD_EXTRACTION = !ssrContext.noSSR && !ssrError && !!(import.meta.prerender && NUXT_PAYLOAD_EXTRACTION || NUXT_RUNTIME_PAYLOAD_EXTRACTION && (routeOptions.isr || routeOptions.cache));
	const _PAYLOAD_INLINE = !_PAYLOAD_EXTRACTION || NUXT_PAYLOAD_INLINE;
	const isRenderingPayload = (_PAYLOAD_EXTRACTION || import.meta.dev && routeOptions.prerender) && PAYLOAD_URL_RE.test(ssrContext.url);
	if (isRenderingPayload) {
		ssrContext.url = payloadRequestToRoute(ssrContext.url, PAYLOAD_FILENAME);
		event.url = withRequestPath(event.url, ssrContext.url);
		const cacheKey = getPayloadCacheKey(ssrContext.url);
		if (import.meta.prerender && payloadCache && await payloadCache.hasItem(cacheKey)) return await payloadCache.getItem(cacheKey);
	}
	const payloadURL = _PAYLOAD_EXTRACTION ? buildPayloadURL(ssrContext) : void 0;
	const renderer = await instance.getRenderer(ssrContext);
	if (NUXT_EARLY_HINTS && !isRenderingPayload && !import.meta.prerender) {
		const { link } = renderResourceHeaders({}, renderer.rendererContext, { scripts: !NO_SCRIPTS });
		if (link) runtime.writeEarlyHints?.(event, { link });
	}
	if (NUXT_INLINE_STYLES) for (const id of entryIds) ssrContext.modules.add(id);
	const canStream = NUXT_SSR_STREAMING && !ssrContext.noSSR && !ssrError && !isRenderingPayload && !import.meta.prerender && !(NUXT_NO_SCRIPTS && componentIslandsActive) && !routeOptions.noScripts && !!routeOptions.streaming && !routeOptions.cache && !routeOptions.isr && !routeOptions.redirect;
	const renderRouteContext = {
		canStream,
		prefersStream: !!(NUXT_SSR_STREAMING && !SSR_BOT_RE.test(event.req.headers.get("user-agent") || ""))
	};
	await hooks.callHook("render:route", renderRouteContext, { event: hookEvent });
	if (NUXT_SSR_STREAMING && canStream && renderRouteContext.prefersStream) {
		const streamArgs = {
			instance,
			event,
			ssrContext,
			renderer,
			routeOptions,
			ssrError,
			_PAYLOAD_EXTRACTION,
			_PAYLOAD_INLINE,
			payloadURL
		};
		return tracingChannelNuxt ? traceAsync("nuxt.render", {
			event: hookEvent,
			ssrContext,
			streaming: true
		}, () => renderStreamedResponse(streamArgs)) : renderStreamedResponse(streamArgs);
	}
	const _rendered = await (tracingChannelNuxt ? traceAsync("nuxt.render", {
		event: hookEvent,
		ssrContext,
		streaming: false
	}, () => renderer.renderToString(ssrContext)) : renderer.renderToString(ssrContext)).catch(async (error) => {
		if ((ssrContext["~renderResponse"] || ssrContext._renderResponse) && error.message === "skipping render") return {};
		const _err = !ssrError && ssrContext.payload?.error || error;
		await ssrContext.nuxt?.hooks.callHook("app:error", _err);
		throw _err;
	});
	const inlinedStyles = (NUXT_INLINE_STYLES || (NUXT_NO_SCRIPTS || NUXT_HAS_NO_SCRIPTS_ROUTES) && NO_SCRIPTS) && !ssrContext["~renderResponse"] && !ssrContext._renderResponse && !isRenderingPayload ? await renderInlineStyles(ssrContext.modules ?? []) : [];
	if (import.meta.prerender && ssrError && isPrerenderedErrorPage(event.url.pathname)) {
		delete ssrContext.payload.path;
		if (ssrContext.payload.error) ssrContext.payload.error.url = void 0;
	}
	await ssrContext.nuxt?.hooks.callHook("app:rendered", {
		ssrContext,
		renderResult: _rendered
	});
	if (ssrContext["~renderResponse"] || ssrContext._renderResponse) return ssrContext["~renderResponse"] || ssrContext._renderResponse;
	if (ssrContext.payload?.error && !ssrError) throw ssrContext.payload.error;
	if (isRenderingPayload) {
		const response = renderPayloadResponse(ssrContext, event);
		if (import.meta.prerender && payloadCache) await payloadCache.setItem(getPayloadCacheKey(ssrContext.url), response);
		return response;
	}
	if (_PAYLOAD_EXTRACTION && import.meta.prerender) {
		addPrerenderRoutes(event, joinURL(ssrContext.url.replace(/\?.*$/, ""), PAYLOAD_FILENAME));
		if (payloadCache) await payloadCache.setItem(getPayloadCacheKey(ssrContext.url), renderPayloadResponse(ssrContext, event));
	}
	if (import.meta.dev && !ssrError && !ssrContext.error) runtime.onRenderSuccess?.(event);
	if (import.meta.dev && NUXT_NO_SCRIPTS_PROD && !NO_SCRIPTS && !ssrError) warnNoScriptsClientReliance(ssrContext, event.url.pathname);
	const { styles, scripts } = getRequestDependencies(ssrContext, renderer.rendererContext);
	pushNoScriptsHints(ssrContext, NO_SCRIPTS);
	if (entryFileName && !NO_SCRIPTS) {
		const path = entryImportMapPath(instance, event, ssrContext);
		ssrContext.head.push({ script: [{
			type: "importmap",
			innerHTML: { imports: { "#entry": path } }
		}] });
	}
	if (_PAYLOAD_EXTRACTION && !_PAYLOAD_INLINE && !NO_SCRIPTS) ssrContext.head.push({ link: [NUXT_JSON_PAYLOADS ? {
		rel: "preload",
		as: "fetch",
		crossorigin: "anonymous",
		href: payloadURL
	} : {
		rel: "modulepreload",
		crossorigin: "",
		href: payloadURL
	}] });
	if (inlinedStyles.length) ssrContext.head.push({ style: inlinedStyles });
	const link = [];
	const inlinedHrefs = [];
	const isCSSInlined = NUXT_INLINE_STYLES || (NUXT_NO_SCRIPTS || NUXT_HAS_NO_SCRIPTS_ROUTES) && NO_SCRIPTS ? await createInlinedCSSFilter(ssrContext.modules) : void 0;
	for (const resource of Object.values(styles)) {
		if (import.meta.dev && "inline" in getQuery(resource.file)) continue;
		if (isCSSInlined?.(resource.file)) {
			inlinedHrefs.push(renderer.rendererContext.buildAssetsURL(resource.file));
			continue;
		}
		link.push({
			rel: "stylesheet",
			href: renderer.rendererContext.buildAssetsURL(resource.file),
			crossorigin: ""
		});
	}
	if (link.length) ssrContext.head.push({ link });
	const dependencyOptions = {
		exclude: ssrContext["~lazyHydratedModules"]?.size ? ssrContext["~lazyHydratedModules"] : void 0,
		scripts: !NO_SCRIPTS
	};
	const excludeHrefs = new Set(link.map((l) => l.href));
	for (const href of inlinedHrefs) excludeHrefs.add(href);
	for (const id of ssrContext["~neverHydratedModules"] ?? []) {
		const file = renderer.rendererContext.manifest?.[id]?.file;
		if (file) excludeHrefs.add(renderer.rendererContext.buildAssetsURL(file));
	}
	const hints = [];
	for (const l of getPreloadLinks(ssrContext, renderer.rendererContext, dependencyOptions)) if (!excludeHrefs.has(l.href)) hints.push(l);
	for (const l of getPrefetchLinks(ssrContext, renderer.rendererContext, dependencyOptions)) if (!excludeHrefs.has(l.href)) hints.push(l);
	if (hints.length) ssrContext.head.push({ link: hints });
	if (!NO_SCRIPTS) ssrContext.head.push({ script: _PAYLOAD_INLINE ? NUXT_JSON_PAYLOADS ? renderPayloadJsonScript({
		ssrContext,
		data: stripInlineOnlyPayloadFields(ssrContext.payload)
	}) : renderPayloadScript({
		ssrContext,
		data: stripInlineOnlyPayloadFields(ssrContext.payload),
		routeOptions
	}) : NUXT_JSON_PAYLOADS ? renderPayloadJsonScript({
		ssrContext,
		data: splitPayload(ssrContext).initial,
		src: payloadURL
	}) : renderPayloadScript({
		ssrContext,
		data: splitPayload(ssrContext).initial,
		routeOptions,
		src: payloadURL
	}) }, {
		tagPosition: "bodyClose",
		tagPriority: "high"
	});
	if (!routeOptions.noScripts) {
		const tagPosition = _PAYLOAD_EXTRACTION && !_PAYLOAD_INLINE && !NUXT_JSON_PAYLOADS ? "bodyClose" : "head";
		ssrContext.head.push({ script: Object.values(scripts).map((resource) => ({
			type: resource.module ? "module" : null,
			src: renderer.rendererContext.buildAssetsURL(resource.file),
			defer: resource.module ? null : true,
			tagPosition,
			crossorigin: ""
		})) });
	}
	const { headTags, bodyTags, bodyTagsOpen, htmlAttrs, bodyAttrs } = renderSSRHead(ssrContext.head, renderSSRHeadOptions);
	const htmlContext = {
		htmlAttrs: htmlAttrs ? [htmlAttrs] : [],
		head: normalizeChunks([headTags]),
		bodyAttrs: bodyAttrs ? [bodyAttrs] : [],
		bodyPrepend: normalizeChunks([bodyTagsOpen, ssrContext.teleports?.body]),
		body: [componentIslands ? replaceIslandTeleports(ssrContext, _rendered.html) : _rendered.html, APP_TELEPORT_OPEN_TAG + (HAS_APP_TELEPORTS ? joinTags([ssrContext.teleports?.[`#${appTeleportAttrs.id}`]]) : "") + APP_TELEPORT_CLOSE_TAG],
		bodyAppend: [bodyTags]
	};
	await hooks.callHook("render:html", htmlContext, { event: hookEvent });
	return {
		body: renderHTMLDocument(htmlContext),
		statusCode: event.res.status,
		statusMessage: event.res.statusText,
		headers: {
			"content-type": "text/html;charset=utf-8",
			"x-powered-by": "Nuxt"
		}
	};
}
async function renderStreamedResponse(ctx) {
	const { instance, event, ssrContext, renderer, routeOptions, ssrError, _PAYLOAD_EXTRACTION, _PAYLOAD_INLINE, payloadURL } = ctx;
	const runtime = instance.options;
	const hooks = runtime.hooks();
	const hookEvent = appEvent(event);
	const NO_SCRIPTS = NUXT_NO_SCRIPTS || !!routeOptions?.noScripts;
	pushNoScriptsHints(ssrContext, NO_SCRIPTS);
	const { link: linkHeader } = renderResourceHeaders({}, renderer.rendererContext, { scripts: !NO_SCRIPTS });
	if (linkHeader) event.res.headers.append("link", linkHeader);
	const entryInlineStyles = NUXT_INLINE_STYLES ? await renderInlineStyles(new Set(entryIds)) : [];
	if (entryInlineStyles.length) ssrContext.head.push({ style: entryInlineStyles });
	const { styles: entryStyles, scripts: entryScripts } = getRequestDependencies({}, renderer.rendererContext);
	const shellLinks = [];
	for (const resource of Object.values(entryStyles)) {
		if (import.meta.dev && "inline" in getQuery(resource.file)) continue;
		shellLinks.push({
			rel: "stylesheet",
			href: renderer.rendererContext.buildAssetsURL(resource.file),
			crossorigin: ""
		});
	}
	if (shellLinks.length) ssrContext.head.push({ link: shellLinks });
	if (entryFileName && !NO_SCRIPTS) {
		const path = entryImportMapPath(instance, event, ssrContext);
		ssrContext.head.push({ script: [{
			tagPosition: "head",
			tagPriority: "critical",
			type: "importmap",
			innerHTML: { imports: { "#entry": path } }
		}] });
	}
	if (_PAYLOAD_EXTRACTION && !_PAYLOAD_INLINE && !NO_SCRIPTS) ssrContext.head.push({ link: [NUXT_JSON_PAYLOADS ? {
		rel: "preload",
		as: "fetch",
		crossorigin: "anonymous",
		href: payloadURL
	} : {
		rel: "modulepreload",
		crossorigin: "",
		href: payloadURL
	}] });
	const entryHints = [...getPreloadLinks({}, renderer.rendererContext, { scripts: !NO_SCRIPTS }), ...getPrefetchLinks({}, renderer.rendererContext, { scripts: !NO_SCRIPTS })];
	if (entryHints.length) ssrContext.head.push({ link: entryHints });
	if (!NO_SCRIPTS) ssrContext.head.push({ script: Object.values(entryScripts).map((resource) => ({
		type: resource.module ? "module" : null,
		src: renderer.rendererContext.buildAssetsURL(resource.file),
		defer: resource.module ? null : true,
		tagPosition: "head",
		crossorigin: ""
	})) });
	if (!NO_SCRIPTS && !import.meta.dev && iifeChunkFileName) ssrContext.head.push({ link: [{
		rel: "preload",
		as: "script",
		href: runtime.buildAssetsURL(iifeChunkFileName)
	}] });
	const createSSRApp = await instance.getServerApp();
	let vueApp;
	try {
		vueApp = await createSSRApp(ssrContext);
	} catch (error) {
		if ((ssrContext["~renderResponse"] || ssrContext._renderResponse) && error?.message === "skipping render") {
			event.res.headers.delete("link");
			return ssrContext["~renderResponse"] || ssrContext._renderResponse;
		}
		await ssrContext.nuxt?.hooks.callHook("app:error", error);
		throw error;
	}
	if (ssrContext["~renderResponse"] || ssrContext._renderResponse) {
		event.res.headers.delete("link");
		return ssrContext["~renderResponse"] || ssrContext._renderResponse;
	}
	const reader = renderToWebStream(vueApp, ssrContext).getReader();
	let firstChunk;
	try {
		const { done, value } = await reader.read();
		if (!done) firstChunk = value;
	} catch (error) {
		reader.releaseLock();
		event.res.headers.delete("link");
		if (ssrContext["~renderResponse"] || ssrContext._renderResponse) return ssrContext["~renderResponse"] || ssrContext._renderResponse;
		const _err = !ssrError && ssrContext.payload?.error || error;
		await ssrContext.nuxt?.hooks.callHook("app:error", _err);
		throw _err;
	}
	if (ssrContext["~renderResponse"] || ssrContext._renderResponse) {
		reader.cancel().catch(() => {});
		event.res.headers.delete("link");
		return ssrContext["~renderResponse"] || ssrContext._renderResponse;
	}
	if (ssrContext.payload?.error && !ssrError) {
		reader.cancel().catch(() => {});
		event.res.headers.delete("link");
		throw ssrContext.payload.error;
	}
	const { headTags, bodyTags, bodyTagsOpen, htmlAttrs, bodyAttrs } = renderShell(ssrContext.head);
	const cspNonce = extractCspNonce(headTags);
	const nonceAttr = cspNonce ? ` nonce="${cspNonce}"` : "";
	const bootstrapScript = NO_SCRIPTS ? "" : createBootstrapScript(void 0, cspNonce);
	let iifeScript = "";
	if (!NO_SCRIPTS) {
		if (!import.meta.dev && iifeChunkFileName) iifeScript = `<script async${nonceAttr} src="${runtime.buildAssetsURL(iifeChunkFileName)}"><\/script>`;
		else iifeScript = `<script${nonceAttr}>${streamingIifeCode}<\/script>`;
	}
	const shellContext = {
		htmlAttrs: htmlAttrs ? [htmlAttrs] : [],
		head: normalizeChunks([bootstrapScript, headTags]),
		bodyAttrs: bodyAttrs ? [bodyAttrs] : [],
		bodyPrepend: normalizeChunks([iifeScript, bodyTagsOpen]),
		body: [],
		bodyAppend: []
	};
	if (import.meta.dev) {
		const initialBodyLen = shellContext.body.length;
		const initialAppendLen = shellContext.bodyAppend.length;
		await hooks.callHook("render:html", shellContext, {
			event: hookEvent,
			streaming: true
		});
		if (shellContext.body.length !== initialBodyLen || shellContext.bodyAppend.length !== initialAppendLen) rendererDiagnostics.NUXT_E8001({ path: event.url.pathname });
	} else await hooks.callHook("render:html", shellContext, {
		event: hookEvent,
		streaming: true
	});
	const shellHtml = `<!DOCTYPE html><html${joinAttrs(shellContext.htmlAttrs)}><head>${joinTags(shellContext.head)}</head><body${joinAttrs(shellContext.bodyAttrs)}>` + joinTags(shellContext.bodyPrepend);
	const committedSnapshot = import.meta.dev ? {
		status: event.res.status,
		statusText: event.res.statusText,
		headers: snapshotResponseHeaders(event)
	} : null;
	const encoder = new TextEncoder();
	let chunkIndex = 0;
	const enqueueChunk = async (controller, chunk) => {
		const chunkContext = {
			chunk,
			index: chunkIndex++
		};
		await hooks.callHook("render:html:chunk", chunkContext, { event: hookEvent });
		controller.enqueue(chunkContext.chunk);
	};
	const emittedStyles = new Set(Object.values(entryStyles).map((r) => r.file));
	const inlinedCss = new Set(entryInlineStyles.map((s) => String(s.innerHTML)));
	const renderRouteStyles = async () => {
		let tags = "";
		if (NUXT_INLINE_STYLES || (NUXT_NO_SCRIPTS || NUXT_HAS_NO_SCRIPTS_ROUTES) && NO_SCRIPTS) {
			for (const style of await renderInlineStyles(ssrContext.modules ?? [])) {
				const css = String(style.innerHTML);
				if (!css || inlinedCss.has(css)) continue;
				inlinedCss.add(css);
				tags += `<style${nonceAttr}>${css}</style>`;
			}
			if (NUXT_INLINE_STYLES) return tags;
		}
		for (const resource of Object.values(getRequestDependencies(ssrContext, renderer.rendererContext).styles)) {
			if (emittedStyles.has(resource.file)) continue;
			if (import.meta.dev && "inline" in getQuery(resource.file)) continue;
			emittedStyles.add(resource.file);
			tags += `<link rel="stylesheet" crossorigin href="${renderer.rendererContext.buildAssetsURL(resource.file)}">`;
		}
		return tags;
	};
	const outputStream = new ReadableStream({
		async start(controller) {
			try {
				await enqueueChunk(controller, encoder.encode(shellHtml));
				await enqueueChunk(controller, encoder.encode(await renderRouteStyles() + APP_ROOT_OPEN_TAG));
				if (firstChunk) {
					await enqueueChunk(controller, firstChunk);
					const headChunk = renderSSRHeadSuspenseChunk(ssrContext.head);
					if (headChunk && !NO_SCRIPTS) await enqueueChunk(controller, encoder.encode(`<script${nonceAttr}>${headChunk};document.currentScript.remove()<\/script>`));
				}
				try {
					while (true) {
						const { done, value } = await reader.read();
						if (done) break;
						await enqueueChunk(controller, value);
						const headChunk = renderSSRHeadSuspenseChunk(ssrContext.head);
						if (headChunk && !NO_SCRIPTS) await enqueueChunk(controller, encoder.encode(`<script${nonceAttr}>${headChunk};document.currentScript.remove()<\/script>`));
					}
				} finally {
					reader.releaseLock();
				}
				if (!NO_SCRIPTS) {
					const finalHeadChunk = renderSSRHeadSuspenseChunk(ssrContext.head);
					if (finalHeadChunk) await enqueueChunk(controller, encoder.encode(`<script${nonceAttr}>${finalHeadChunk};document.currentScript.remove()<\/script>`));
				}
				await ssrContext.nuxt?.hooks.callHook("app:rendered", {
					ssrContext,
					renderResult: {}
				});
				if (ssrContext.payload?.error && !ssrError) await ssrContext.nuxt?.hooks.callHook("app:error", ssrContext.payload.error);
				if (!NO_SCRIPTS) ssrContext.head.push({ script: _PAYLOAD_INLINE ? NUXT_JSON_PAYLOADS ? renderPayloadJsonScript({
					ssrContext,
					data: ssrContext.payload
				}) : renderPayloadScript({
					ssrContext,
					data: ssrContext.payload,
					routeOptions
				}) : NUXT_JSON_PAYLOADS ? renderPayloadJsonScript({
					ssrContext,
					data: splitPayload(ssrContext).initial,
					src: payloadURL
				}) : renderPayloadScript({
					ssrContext,
					data: splitPayload(ssrContext).initial,
					routeOptions,
					src: payloadURL
				}) }, {
					tagPosition: "bodyClose",
					tagPriority: "high"
				});
				const streamBodyTags = renderStreamBodyTags(ssrContext.head);
				const closingHead = applyRenderOptions(ssrContext.head.render(), renderSSRHeadOptions);
				const closeContext = { bodyAppend: normalizeChunks([
					streamBodyTags,
					bodyTags,
					closingHead.bodyTags
				]) };
				await hooks.callHook("render:html:close", closeContext, { event: hookEvent });
				const teleportHtml = APP_TELEPORT_OPEN_TAG + (HAS_APP_TELEPORTS ? joinTags([ssrContext.teleports?.[`#${appTeleportAttrs.id}`]]) : "") + APP_TELEPORT_CLOSE_TAG;
				const islandTeleports = NO_SCRIPTS ? "" : renderStreamedIslandTeleports(ssrContext, nonceAttr);
				const closingHtml = APP_ROOT_CLOSE_TAG + await renderRouteStyles() + teleportHtml + (ssrContext.teleports?.body || "") + islandTeleports + joinTags(closeContext.bodyAppend) + "</body></html>";
				await enqueueChunk(controller, encoder.encode(closingHtml));
				controller.close();
				if (import.meta.dev && NUXT_NO_SCRIPTS_PROD && !NO_SCRIPTS && !ssrError) warnNoScriptsClientReliance(ssrContext, event.url.pathname);
				if (committedSnapshot) {
					const currentStatus = event.res.status;
					const currentStatusText = event.res.statusText;
					const currentHeaders = snapshotResponseHeaders(event);
					const lateMutations = [];
					if (currentStatus !== committedSnapshot.status) lateMutations.push(`response status changed from ${committedSnapshot.status || 200} to ${currentStatus} (e.g. \`setResponseStatus\`)`);
					if (currentStatusText !== committedSnapshot.statusText) lateMutations.push(`response statusText changed (e.g. \`setResponseStatus\`)`);
					if (currentHeaders !== committedSnapshot.headers) lateMutations.push(`response headers changed during render (e.g. \`useCookie\`, \`useResponseHeader\`, \`setHeader\`)`);
					if (lateMutations.length) rendererDiagnostics.NUXT_E8002({
						mutations: lateMutations.join("\n  - "),
						path: event.url.pathname
					});
				}
			} catch (error) {
				if (NUXT_INLINE_ERROR_RENDERING) await captureError(runtime, event, error, ["streaming"]);
				await Promise.resolve(ssrContext.nuxt?.hooks.callHook("app:error", error)).catch(() => {});
				ssrContext.payload ||= {};
				ssrContext.payload.error ||= error;
				try {
					if (!NO_SCRIPTS) ssrContext.head.push({ script: NUXT_JSON_PAYLOADS ? renderPayloadJsonScript({
						ssrContext,
						data: ssrContext.payload
					}) : renderPayloadScript({
						ssrContext,
						data: ssrContext.payload,
						routeOptions
					}) }, {
						tagPosition: "bodyClose",
						tagPriority: "high"
					});
					let headChunk;
					try {
						headChunk = renderSSRHeadSuspenseChunk(ssrContext.head);
					} catch (error) {
						rendererDiagnostics.NUXT_E8009({
							path: event.url.pathname,
							what: "flushing the head tags registered after the shell",
							cause: String(error)
						});
					}
					if (headChunk && !NO_SCRIPTS) controller.enqueue(encoder.encode(`<script${nonceAttr}>${headChunk};document.currentScript.remove()<\/script>`));
					const streamBodyTags = renderStreamBodyTags(ssrContext.head);
					const tail = applyRenderOptions(ssrContext.head.render(), renderSSRHeadOptions);
					controller.enqueue(encoder.encode(streamBodyTags + tail.bodyTags));
				} catch (error) {
					rendererDiagnostics.NUXT_E8009({
						path: event.url.pathname,
						what: "rendering the closing HTML that carries the page error",
						cause: String(error)
					});
				}
				controller.enqueue(encoder.encode(APP_ROOT_CLOSE_TAG + "</body></html>"));
				controller.close();
			}
		},
		cancel(reason) {
			reader.cancel(reason).catch(() => {});
		}
	});
	event.res.headers.set("content-type", "text/html;charset=utf-8");
	event.res.headers.set("x-powered-by", "Nuxt");
	return { body: outputStream };
}
function applyRenderOptions(payload, options) {
	if (!options.omitLineBreaks) return payload;
	return {
		headTags: payload.headTags.replaceAll("\n", ""),
		bodyTags: payload.bodyTags.replaceAll("\n", ""),
		bodyTagsOpen: payload.bodyTagsOpen.replaceAll("\n", ""),
		htmlAttrs: payload.htmlAttrs,
		bodyAttrs: payload.bodyAttrs
	};
}
function snapshotResponseHeaders(event) {
	return Array.from(event.res.headers.entries()).map(([k, v]) => `${k}: ${v}`).sort().join("\n");
}
function getPayloadCacheKey(url) {
	const { pathname, search } = new URL(url, "http://localhost");
	return (pathname === "/" ? "/" : pathname.replace(/\/$/, "")) + (search ? encodeURIComponent(search) : "") + ".json";
}
/**
* Routes served without scripts navigate with full-page loads. This emits the
* declarative navigation hints that speed those up, on both the pages served
* without scripts (a blanket rule over same-origin links) and scripted pages
* that may link to them (rules scoped to the `noScripts` route patterns):
*
* - speculation rules, so supporting browsers prefetch and prerender the
*   target ahead of the navigation;
* - when view transitions are enabled, an opt-in to same-origin cross-document
*   view transitions, animating the navigation without a client runtime (the
*   client-side `startViewTransition` plugin is not shipped).
*
* Both tags are declarative and execute no JavaScript.
*/
function pushNoScriptsHints(ssrContext, noScripts) {
	if (noScripts) pushSpeculationRulesScript(ssrContext, NUXT_PAGE_PATTERNS.length ? NUXT_PAGE_PATTERNS : ["/*"]);
	else if (NUXT_NO_SCRIPTS_PATTERNS.length) pushSpeculationRulesScript(ssrContext, NUXT_NO_SCRIPTS_PATTERNS);
	else return;
	if (NUXT_VIEW_TRANSITIONS) ssrContext.head.push({ style: [{
		tagPosition: "head",
		innerHTML: "@view-transition{navigation:auto}"
	}] });
}
const entryPaths = /* @__PURE__ */ new WeakMap();
/** URL of the hashed entry chunk, which `#entry` is pinned to so chunk hashes stay stable across it. */
function entryImportMapPath(instance, event, ssrContext) {
	const cached = entryPaths.get(instance);
	if (cached) return cached;
	const url = instance.options.buildAssetsURL(entryFileName);
	if (ssrContext.runtimeConfig.app.cdnURL || /^(?:\/|\.+\/)/.test(url)) {
		entryPaths.set(instance, url);
		return url;
	}
	const path = relative(event.url.pathname.replace(/\/[^/]+$/, "/"), joinURL("/", url));
	return /^(?:\/|\.+\/)/.test(path) ? path : `./${path}`;
}
function pushSpeculationRulesScript(ssrContext, patterns) {
	const rules = patterns.map((href_matches) => ({
		where: { href_matches },
		eagerness: "moderate"
	}));
	ssrContext.head.push({ script: [{
		tagPosition: "head",
		type: "speculationrules",
		innerHTML: {
			prefetch: rules,
			prerender: rules
		}
	}] });
}
function buildPayloadURL(ssrContext) {
	const baseURL = ssrContext.runtimeConfig.app.cdnURL || ssrContext.runtimeConfig.app.baseURL;
	return routeToPayloadURL(baseURL, ssrContext.url, ssrContext.runtimeConfig.app.buildId, PAYLOAD_FILENAME);
}
function normalizeChunks(chunks) {
	const result = [];
	for (const _chunk of chunks) {
		const chunk = _chunk?.trim();
		if (chunk) result.push(chunk);
	}
	return result;
}
function joinTags(tags) {
	return tags.join("");
}
function joinAttrs(chunks) {
	if (chunks.length === 0) return "";
	return " " + chunks.join(" ");
}
function renderHTMLDocument(html) {
	return `<!DOCTYPE html><html${joinAttrs(html.htmlAttrs)}><head>${joinTags(html.head)}</head><body${joinAttrs(html.bodyAttrs)}>${joinTags(html.bodyPrepend)}${joinTags(html.body)}${joinTags(html.bodyAppend)}</body></html>`;
}
function stripInlineOnlyPayloadFields(payload) {
	if (!payload.prefetchLinks) return payload;
	const { prefetchLinks: _, ...rest } = payload;
	return rest;
}
//#endregion
export { appEvent, createNuxtRenderer, createRendererInstance };
