import { rendererDiagnostics } from "./diagnostics.js";
import { stringify, uneval } from "devalue";
import { NUXT_JSON_PAYLOADS, NUXT_NO_SSR, appId, multiApp } from "nuxt/internal/renderer-config";
import devalue from "@nuxt/devalue";
//#region src/runtime/server/renderer/payload.ts
function renderPayloadResponse(ssrContext, event) {
	return {
		body: NUXT_JSON_PAYLOADS ? encodeForwardSlashes(stringify(splitPayload(ssrContext).payload, ssrContext["~payloadReducers"])) : `export default ${devalue(splitPayload(ssrContext).payload)}`,
		statusCode: event.res.status,
		statusMessage: event.res.statusText,
		headers: {
			"content-type": NUXT_JSON_PAYLOADS ? "application/json;charset=utf-8" : "text/javascript;charset=utf-8",
			"x-powered-by": "Nuxt"
		}
	};
}
function renderPayloadJsonScript(opts) {
	const contents = opts.data ? encodeForwardSlashes(stringify(opts.data, opts.ssrContext["~payloadReducers"])) : "";
	if (import.meta.dev) warnOnLargePayload(opts.ssrContext, opts.data, contents.length);
	const payload = {
		"type": "application/json",
		"innerHTML": contents,
		"data-nuxt-data": appId,
		"data-ssr": !(NUXT_NO_SSR || opts.ssrContext.noSSR)
	};
	if (!multiApp) payload.id = "__NUXT_DATA__";
	if (opts.src) payload["data-src"] = opts.src;
	const config = uneval(opts.ssrContext.config);
	return [payload, { innerHTML: multiApp ? `window.__NUXT__=window.__NUXT__||{};window.__NUXT__[${JSON.stringify(appId)}]={config:${config}}` : `window.__NUXT__={};window.__NUXT__.config=${config}` }];
}
/**
* Encode forward slashes as unicode escape sequences to prevent
* Google from treating them as internal links and trying to crawl them.
* @see https://github.com/nuxt/nuxt/issues/24175
*/
function encodeForwardSlashes(str) {
	return str.replaceAll("/", "\\u002F");
}
/**
* Escape a string for safe interpolation inside a double-quoted JavaScript string literal.
* Prevents XSS when user-controlled URLs are embedded in inline `<script>` tags.
*/
function escapeJsString(str) {
	return str.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"").replaceAll("\n", "\\n").replaceAll("\r", "\\r").replaceAll("/", "\\u002F").replaceAll("<", "\\u003C");
}
function renderPayloadScript(opts) {
	opts.data.config = opts.ssrContext.config;
	const nuxtData = devalue(opts.data);
	if (opts.src) {
		const escapedSrc = escapeJsString(opts.src);
		const singleAppPayload = `import p from "${escapedSrc}";window.__NUXT__={...p,...(${nuxtData})}`;
		const multiAppPayload = `import p from "${escapedSrc}";window.__NUXT__=window.__NUXT__||{};window.__NUXT__[${JSON.stringify(appId)}]={...p,...(${nuxtData})}`;
		return [{
			type: "module",
			innerHTML: multiApp ? multiAppPayload : singleAppPayload
		}];
	}
	const singleAppPayload = `window.__NUXT__=${nuxtData}`;
	const multiAppPayload = `window.__NUXT__=window.__NUXT__||{};window.__NUXT__[${JSON.stringify(appId)}]=${nuxtData}`;
	return [{ innerHTML: multiApp ? multiAppPayload : singleAppPayload }];
}
const PAYLOAD_SIZE_WARNING_BYTES = 102400;
const warnedPayloadURLs = /* @__PURE__ */ new Set();
function formatPayloadSize(bytes) {
	return `${(bytes / 1024).toFixed(1)} kB`;
}
function getPayloadKeySizes(data, reducers) {
	const sizes = [];
	for (const key in data) try {
		sizes.push([key, stringify(data[key], reducers).length]);
	} catch {}
	return sizes.sort((a, b) => b[1] - a[1]);
}
function warnOnLargePayload(ssrContext, data, size) {
	if (size <= PAYLOAD_SIZE_WARNING_BYTES || warnedPayloadURLs.has(ssrContext.url)) return;
	warnedPayloadURLs.add(ssrContext.url);
	const keys = getPayloadKeySizes(data?.data, ssrContext["~payloadReducers"]).slice(0, 5).map(([key, keySize]) => `\`${key}\` (${formatPayloadSize(keySize)})`).join("\n  - ");
	rendererDiagnostics.NUXT_E8006({
		path: ssrContext.url,
		size: formatPayloadSize(size),
		keys: keys || void 0
	});
}
function splitPayload(ssrContext) {
	const { data, prerenderedAt, prefetchLinks, ...initial } = ssrContext.payload;
	const payload = {
		data,
		prerenderedAt
	};
	if (prefetchLinks?.length) payload.prefetchLinks = prefetchLinks;
	return {
		initial: {
			...initial,
			prerenderedAt
		},
		payload
	};
}
//#endregion
export { getPayloadKeySizes, renderPayloadJsonScript, renderPayloadResponse, renderPayloadScript, splitPayload };
