import { getFetchedRequestContext } from "../utils/event.mjs";
import { isJsonRequest } from "../utils/error.mjs";
import { applyPrerenderHints } from "../utils/prerender.mjs";
import { appendResponseHeader, getResponseHeader, isError, send, setResponseHeader, setResponseHeaders, setResponseStatus } from "h3";
import { useNitroApp, useRuntimeConfig } from "nitropack/runtime";
import { joinURL, withQuery, withoutBase } from "ufo";
import { NUXT_INLINE_ERROR_RENDERING } from "nuxt/internal/renderer-config";
//#region src/runtime/handlers/error.ts
var error_default = async function errorhandler(error, event, { defaultHandler }) {
	if (event.handled) return;
	const isRenderingError = !!(event.context.nuxt?.["~rendering-error"] || getFetchedRequestContext(event)?.["~rendering-error"]);
	let devError;
	let errorCause;
	if (import.meta.dev) {
		const errorChannel = await import("#internal/nuxt/error-channel");
		const isHTTPError = isError(error);
		const isExpected = !error.unhandled && isHTTPError && (error.statusCode || 500) < 500 && !(THROWN_VALUE in error);
		devError = await errorChannel.observeDevError(error, event, {
			expected: isExpected,
			publish: !isRenderingError && !import.meta.test,
			print: !isRenderingError && (error.unhandled ?? !isHTTPError)
		});
		errorCause = errorChannel.serializeErrorCause(error.cause);
	}
	const stacks = import.meta.dev ? snapshotStacks(error) : void 0;
	if (NUXT_INLINE_ERROR_RENDERING || isJsonRequest(event)) {
		if (!devError && !NUXT_INLINE_ERROR_RENDERING) return;
		const { headers, status, statusText, body } = await defaultHandler(error, event, {
			json: true,
			silent: !!devError
		});
		stacks?.restore();
		setResponseHeaders(event, headers);
		if (!NUXT_INLINE_ERROR_RENDERING) appendVary(event, "accept, sec-fetch-mode");
		setResponseStatus(event, status, statusText);
		return send(event, typeof body === "string" ? body : JSON.stringify(body, null, 2));
	}
	const defaultRes = await defaultHandler(error, event, {
		json: true,
		silent: import.meta.dev && !!devError
	});
	stacks?.restore();
	if (import.meta.prerender) applyPrerenderHints(event);
	if ((error.status || error.statusCode || 500) === 404 && defaultRes.status === 302) {
		setResponseHeaders(event, defaultRes.headers);
		appendVary(event, "accept, sec-fetch-mode");
		setResponseStatus(event, defaultRes.status, defaultRes.statusText);
		return send(event, JSON.stringify(defaultRes.body, null, 2));
	}
	if (import.meta.dev && typeof defaultRes.body !== "string" && Array.isArray(defaultRes.body.stack)) defaultRes.body.stack = defaultRes.body.stack.join("\n");
	const errorObject = defaultRes.body;
	const url = new URL(errorObject.url);
	errorObject.url = withoutBase(url.pathname, useRuntimeConfig(event).app.baseURL) + url.search + url.hash;
	errorObject.message = error.unhandled ? errorObject.message || "Server Error" : error.message || errorObject.message || "Server Error";
	if (!error.unhandled) errorObject.data ||= error.data;
	errorObject.statusText ||= error.statusText || error.statusMessage;
	delete defaultRes.headers["content-type"];
	delete defaultRes.headers["content-security-policy"];
	setResponseHeaders(event, defaultRes.headers);
	appendVary(event, "accept, sec-fetch-mode");
	if (!isRenderingError) event.context.nuxt = {
		...event.context.nuxt,
		"~rendering-error": true
	};
	const res = isRenderingError ? null : await useNitroApp().localFetch(withQuery(joinURL(useRuntimeConfig(event).app.baseURL, "/__nuxt_error"), {
		...errorObject,
		...errorCause !== void 0 && { cause: JSON.stringify(errorCause) }
	}), {
		headers: event.headers,
		redirect: "manual",
		context: { nuxt: { "~rendering-error": true } }
	}).catch(() => null);
	if (event.handled) return;
	if (!res) {
		setResponseHeader(event, "Content-Type", "text/html;charset=UTF-8");
		if (import.meta.dev && isRenderingError) setResponseHeader(event, ERROR_PAGE_HEADER, "1");
		else if (import.meta.dev && devError) {
			const body = await devError.page().catch(() => void 0);
			if (body) return send(event, body);
		}
		const { template } = await import("nuxt/internal/renderer/error-template");
		if (import.meta.dev) errorObject.description = errorObject.message;
		return send(event, template(errorObject));
	}
	let html = await res.text();
	for (const [header, value] of res.headers.entries()) {
		if (header === ERROR_PAGE_HEADER) continue;
		if (header === "set-cookie" || header === "x-nitro-prerender") {
			appendResponseHeader(event, header, value);
			continue;
		}
		setResponseHeader(event, header, value);
	}
	setResponseStatus(event, res.status && res.status !== 200 ? res.status : defaultRes.status, res.statusText || defaultRes.statusText);
	if (import.meta.dev && !import.meta.test && devError && typeof html === "string") try {
		html = res.headers.has(ERROR_PAGE_HEADER) ? await devError.page() : await devError.overlay(html);
	} catch {}
	return send(event, html);
};
/** The stacks of an error and its causes as raised, before Nitro rewrites them. */
function snapshotStacks(error) {
	const stacks = [];
	const seen = /* @__PURE__ */ new Set();
	for (let current = error; current instanceof Error && !seen.has(current); current = current.cause) {
		seen.add(current);
		stacks.push([current, current.stack]);
	}
	return { restore() {
		for (const [target, stack] of stacks) if (target.stack !== stack) try {
			Object.defineProperty(target, "stack", {
				value: stack,
				writable: true,
				configurable: true
			});
		} catch {}
	} };
}
/** Set on an error created from a thrown value that was not an `Error`. */
const THROWN_VALUE = Symbol.for("nuxt:dev:thrown");
/** Set when the app's own error page could not render. */
const ERROR_PAGE_HEADER = "x-nuxt-error-page";
/**
* Add `value`'s tokens to the response `vary` header, keeping any already
* present. `*` absorbs everything else, since it means the response varies on
* all headers.
*/
function appendVary(event, value) {
	const incoming = parseVary(value);
	if (!incoming.length) return;
	const existing = parseVary(getResponseHeader(event, "vary"));
	if (existing.includes("*")) return;
	if (incoming.includes("*")) {
		setResponseHeader(event, "vary", "*");
		return;
	}
	const merged = existing.slice();
	for (const token of incoming) if (!merged.includes(token)) merged.push(token);
	setResponseHeader(event, "vary", merged.join(", "));
}
function parseVary(value) {
	return (Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : []).map((token) => token.trim().toLowerCase()).filter(Boolean);
}
//#endregion
export { error_default as default };
