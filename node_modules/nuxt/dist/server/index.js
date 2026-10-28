import { createError } from "../app/error.js";
import { handleCors } from "./cors.js";
import { serverFetch } from "./fetch.js";
import { useServerHooks } from "./hooks.js";
import { deriveSecret } from "./secret.js";
import { clearSession, getSession, updateSession, useSession } from "./session.js";
import { getValidatedQuery, readValidatedBody } from "./validate.js";
import { klona } from "klona";
import { parseQuery } from "ufo";
import { parse, serialize } from "cookie-es";
import { useRuntimeConfig as useRuntimeConfig$1 } from "nuxt/internal/server-runtime-config";
import _appConfig from "nuxt/internal/server-app-config";
//#region src/server/index.ts
/**
* The portable server surface: helpers typed against {@link RequestEvent}, the
* web-standard part of the event every server runtime provides. Code written
* against them runs on any Nuxt server builder.
*
* Anything not exported here comes from the server runtime itself (`h3`,
* `nitropack`), and pins the code to it.
*
* @module nuxt/server
*/
/**
* Define a request handler.
*
* The return type is preserved exactly, and is what types `$fetch` and
* `useFetch` calls to the route, so annotate the returned value rather than
* the handler.
*
* @example
* ```ts
* // server/api/hello.ts
* import { defineEventHandler, getQuery } from 'nuxt/server'
*
* export default defineEventHandler((event) => {
*   const { name } = getQuery<{ name?: string }>(event)
*   return { message: `Hello, ${name ?? 'world'}!` }
* })
* ```
*
* @since 4.6.0
*/
function defineEventHandler(handler) {
	return handler;
}
/**
* Whether a caught value is an HTTP error carrying a status.
*
* The check is structural, because the error may have been constructed by the
* server runtime rather than by {@link createError}: h3 v1 marks its own errors on their
* constructor, and h3 v2 names them `HTTPError`.
*
* @example
* ```ts
* try {
*   await load()
* } catch (error) {
*   if (isNuxtError(error) && error.status === 404) {
*     return null
*   }
*   throw error
* }
* ```
*
* @since 4.6.0
*/
function isNuxtError(error) {
	const candidate = error;
	if (!(error instanceof Error) || typeof candidate?.status !== "number") return false;
	return candidate["__nuxt_error"] === true || candidate.constructor?.__h3_error__ === true || error.name === "HTTPError";
}
/**
* The URL of the incoming request, as a new `URL` each call.
*
* @example
* ```ts
* const origin = getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).origin
* ```
*
* @since 4.6.0
*/
function getRequestURL(event, options = {}) {
	const url = new URL(event.url ?? event.req.url);
	url.protocol = getRequestProtocol(event, options);
	if (options.xForwardedHost) {
		const host = getRequestHost(event, options);
		if (host) applyForwardedHost(url, host);
	}
	return url;
}
/**
* The `Host` of the request, or an empty string.
*
* @since 4.6.0
*/
function getRequestHost(event, options = {}) {
	if (options.xForwardedHost) {
		const forwarded = event.req.headers.get("x-forwarded-host")?.split(",")[0].trim();
		if (forwarded) return forwarded;
	}
	return event.req.headers.get("host") || "";
}
/**
* The protocol of the request, without the trailing colon.
*
* @since 4.6.0
*/
function getRequestProtocol(event, options = {}) {
	if (options.xForwardedProto) {
		const forwarded = event.req.headers.get("x-forwarded-proto")?.split(",")[0].trim();
		if (forwarded === "https" || forwarded === "http") return forwarded;
	}
	return (event.url ?? new URL(event.req.url)).protocol.slice(0, -1);
}
const PORT_RE = /^\d{1,5}$/;
function applyForwardedHost(url, host) {
	const separator = host.lastIndexOf(":");
	const hasPort = separator > host.lastIndexOf("]");
	const hostname = hasPort ? host.slice(0, separator) : host;
	const previous = url.hostname;
	url.hostname = hostname;
	if (url.hostname === previous && hostname.toLowerCase() !== previous) return;
	const port = hasPort ? host.slice(separator + 1) : "";
	url.port = PORT_RE.test(port) && +port < 65536 ? port : "";
}
/**
* Read one request header, or `undefined` when it was not sent.
*
* Header names are case-insensitive.
*
* @since 4.6.0
*/
function getRequestHeader(event, name) {
	return event.req.headers.get(name) ?? void 0;
}
/**
* Read every request header, keyed by lowercased name.
*
* @since 4.6.0
*/
function getRequestHeaders(event) {
	return Object.fromEntries(event.req.headers);
}
/**
* The dynamic segments matched for the request, as they appear in the URL:
* percent-encoded, as `URLPattern` reports them. Set `decode` to decode them,
* apart from encoded path separators (`%2F`, `%5C`), so a segment cannot be
* read as a path it did not match.
*
* @example
* ```ts
* // server/api/users/[id].ts
* export default defineEventHandler((event) => {
*   const { id } = getRouterParams(event, { decode: true })
*   return { id }
* })
* ```
*
* @since 4.6.0
*/
function getRouterParams(event, options = {}) {
	const params = event.context.params || {};
	if (!options.decode) return params;
	const decoded = {};
	for (const key in params) {
		const value = params[key];
		decoded[key] = value === void 0 ? value : decodePreservingSeparators(value);
	}
	return decoded;
}
/**
* One dynamic segment matched for the request, or `undefined` when the route
* has none of that name. See {@link getRouterParams}.
*
* @since 4.6.0
*/
function getRouterParam(event, name, options) {
	return getRouterParams(event, options)[name];
}
const ENCODED_SEPARATOR_RE = /%(?:25)*(?:2f|5c)/gi;
function decodePreservingSeparators(value) {
	if (!value.includes("%")) return value;
	let result = "";
	let lastIndex = 0;
	for (const match of value.matchAll(ENCODED_SEPARATOR_RE)) {
		result += decodeURIComponent(value.slice(lastIndex, match.index)) + match[0];
		lastIndex = match.index + match[0].length;
	}
	return result + decodeURIComponent(value.slice(lastIndex));
}
/**
* The IP address of the client, or `undefined` when it cannot be determined.
*
* By default no forwarded header is trusted: the address is the one the
* server runtime reports for the connection, and a runtime that reports none
* resolves `undefined`. Set `xForwardedFor` to read the first entry of the
* `X-Forwarded-For` header instead, only behind a proxy you control that
* overwrites that header; one that appends to it leaves a client-sent value
* first.
*
* @since 4.6.0
*/
function getRequestIP(event, options = {}) {
	if (options.xForwardedFor) {
		const forwarded = event.req.headers.get("x-forwarded-for")?.split(",")[0].trim();
		if (forwarded) return forwarded;
	}
	const request = event.req;
	return request.context?.clientAddress || request.ip || void 0;
}
/**
* Set the status, and optionally the reason phrase, of the response.
*
* @since 4.6.0
*/
function setResponseStatus(event, status, statusText) {
	const res = event.res;
	res.status = status;
	if (statusText !== void 0) res.statusText = statusText;
}
/**
* Read the query string of the request. A repeated parameter resolves to an
* array, so a type parameter should account for that.
*
* @since 4.6.0
*/
function getQuery(event) {
	return parseQuery(getRequestURL(event).search);
}
/**
* Read and parse the request body, once per request.
*
* A URL-encoded body is parsed into an object of its fields, with a repeated
* field collected into an array. Anything else is parsed as JSON, and a body
* that is not valid JSON is a `400`. An empty body reads as `undefined`.
*
* The type parameter is an assertion: validate the result with a schema when
* it comes from a client.
*
* @since 4.6.0
*/
async function readBody(event) {
	const request = event.req;
	const contentType = request.headers.get("content-type") || "";
	const text = await request.text();
	if (!text) return;
	if (contentType.startsWith("application/x-www-form-urlencoded")) return collectEntries(new URLSearchParams(text).entries());
	try {
		return JSON.parse(text);
	} catch {
		throw createError({
			status: 400,
			statusText: "Bad Request",
			message: "Invalid JSON body"
		});
	}
}
/** Collect repeated keys into an array, as a form body's fields are read. */
function collectEntries(entries) {
	const parsed = Object.create(null);
	for (const [key, value] of entries) {
		const existing = parsed[key];
		if (existing === void 0) parsed[key] = value;
		else if (Array.isArray(existing)) existing.push(value);
		else parsed[key] = [existing, value];
	}
	return parsed;
}
/**
* Read every cookie sent with the request, keyed by name.
*
* @since 4.6.0
*/
function parseCookies(event) {
	const header = event.req.headers.get("cookie");
	return header ? parse(header) : {};
}
/**
* Read one cookie sent with the request, or `undefined` when it was not sent.
*
* @since 4.6.0
*/
function getCookie(event, name) {
	const header = event.req.headers.get("cookie");
	return header ? parse(header)[name] : void 0;
}
/**
* Set a cookie on the response. Each call appends its own `Set-Cookie`
* header, so several cookies may be set for one response.
*
* @since 4.6.0
*/
function setCookie(event, name, value, options) {
	event.res.headers.append("set-cookie", serialize(name, value, {
		path: "/",
		...options
	}));
}
/**
* Expire a cookie on the response. The `path` and `domain` must match those
* it was set with, or the original cookie survives alongside the expired one.
*
* @since 4.6.0
*/
function deleteCookie(event, name, options) {
	setCookie(event, name, "", {
		...options,
		maxAge: 0
	});
}
/**
* Redirect the request, returning the body to respond with: a
* `<meta http-equiv="refresh">`, so a client that ignores the status still
* follows the redirect.
*
* @example
* ```ts
* export default defineEventHandler(event => sendRedirect(event, '/login', 302))
* ```
*
* @since 4.6.0
*/
function sendRedirect(event, location, status = 302) {
	setResponseStatus(event, status);
	event.res.headers.set("location", location);
	event.res.headers.set("content-type", "text/html");
	return `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=${location.replace(REDIRECT_UNSAFE_RE, (char) => REDIRECT_ESCAPES[char])}"></head></html>`;
}
const REDIRECT_ESCAPES = {
	"\"": "%22",
	"'": "%27",
	"<": "%3C",
	">": "%3E",
	"&": "%26"
};
const REDIRECT_UNSAFE_RE = /["'<>&]/g;
/**
* The route rules matched for the request. A server builder without a
* route-rule matcher resolves none, so treat every rule as optional.
*
* @since 4.6.0
*/
function getRouteRules(_event) {
	return {};
}
/**
* The route rules for a path relative to the app base URL.
*
* @since 4.6.0
*/
function matchRouteRules(_path, _method = "GET") {
	return {};
}
/**
* The runtime configuration, including the keys only the server can read.
*
* @since 4.6.0
*/
function useRuntimeConfig() {
	return useRuntimeConfig$1();
}
let sharedAppConfig;
/**
* The app config, as `app.config.ts` and the layers define it.
*
* Called with the event, it returns a copy for that request, which changes
* made while handling it do not leak out of. Called without, it returns a
* frozen copy shared by every request.
*
* @since 4.6.0
*/
function useAppConfig(event) {
	if (!event) return sharedAppConfig ||= deepFreeze(klona(_appConfig));
	const state = event.context.nuxt ||= {};
	return state.appConfig ||= klona(_appConfig);
}
function deepFreeze(object) {
	for (const value of Object.values(object)) if (value && typeof value === "object") deepFreeze(value);
	return Object.freeze(object);
}
//#endregion
export { clearSession, createError, defineEventHandler, deleteCookie, deriveSecret, getCookie, getQuery, getRequestHeader, getRequestHeaders, getRequestHost, getRequestIP, getRequestProtocol, getRequestURL, getRouteRules, getRouterParam, getRouterParams, getSession, getValidatedQuery, handleCors, isNuxtError, matchRouteRules, parseCookies, readBody, readValidatedBody, sendRedirect, serverFetch, setCookie, setResponseStatus, updateSession, useAppConfig, useRuntimeConfig, useServerHooks, useSession };
