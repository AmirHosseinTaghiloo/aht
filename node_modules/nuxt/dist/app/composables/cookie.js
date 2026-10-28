import { useNuxtApp } from "../nuxt.js";
import { stateDiagnostics } from "../diagnostics/state.js";
import { useRequestEvent } from "./ssr.js";
import { customRef, getCurrentScope, nextTick, onScopeDispose, ref, watch } from "vue";
import { klona } from "klona";
import { cookieStore } from "#build/nuxt.config.mjs";
import { deleteCookie, getCookie, getRequestHeader, getResponseHeader, setCookie, splitCookiesString } from "@nuxt/nitro-server/h3";
import { parse, parseSetCookie, serialize } from "cookie-es";
import { isEqual } from "ohash";
//#region src/app/composables/cookie.ts
function parseCookieValue(value) {
	if (value === "undefined") return;
	try {
		const parsed = JSON.parse(value);
		if (typeof parsed === "number" && String(parsed) !== value) return value;
		return parsed;
	} catch {
		return value;
	}
}
function resolveExpires(expires) {
	return typeof expires === "function" ? expires() : expires;
}
const CookieDefaults = {
	path: "/",
	watch: true,
	decode: (val) => val ? parseCookieValue(decodeURIComponent(val)) : val,
	encode: (val) => {
		if (typeof val !== "string" || val === "undefined") return encodeURIComponent(JSON.stringify(val));
		try {
			if (typeof JSON.parse(val) !== "string") return encodeURIComponent(JSON.stringify(val));
		} catch {}
		return encodeURIComponent(val);
	},
	refresh: false
};
const store = import.meta.client && cookieStore ? globalThis.cookieStore : void 0;
function useCookie(name, _opts) {
	const opts = {
		...CookieDefaults,
		..._opts
	};
	opts.filter ??= (key) => key === name;
	const nuxtApp = import.meta.server ? useNuxtApp() : void 0;
	const jar = import.meta.client ? readClientCookieJar() : readServerCookieJar(nuxtApp);
	const rawValue = opts.filter(name) ? jar[name] : void 0;
	const cookies = { [name]: rawValue === void 0 ? void 0 : opts.decode(rawValue) };
	let delay;
	if (opts.maxAge !== void 0) delay = opts.maxAge * 1e3;
	else if (opts.expires) {
		const expires = resolveExpires(opts.expires);
		if (expires) delay = expires.getTime() - Date.now();
	}
	const getDelay = () => {
		if (opts.maxAge !== void 0) return opts.maxAge * 1e3;
		if (!opts.expires) return;
		const expires = resolveExpires(opts.expires);
		return expires ? expires.getTime() - Date.now() : void 0;
	};
	const hasExpired = delay !== void 0 && delay <= 0;
	const cookieValueIsNullish = cookies[name] === void 0 || cookies[name] === null;
	const shouldSetInitialClientCookie = import.meta.client && !opts.readonly && (hasExpired || cookieValueIsNullish) && !(rawValue === void 0 && cookieValueIsNullish && opts.default === void 0);
	const cookieValue = klona(hasExpired ? void 0 : cookies[name] ?? opts.default?.());
	const cookie = import.meta.client && (typeof opts.expires === "function" || delay && !hasExpired) ? cookieRef(cookieValue, delay, getDelay, opts.watch && opts.watch !== "shallow") : import.meta.server ? cookieServerRef(name, cookieValue, opts, nuxtApp) : ref(cookieValue);
	if (import.meta.server && !opts.readonly && rawValue === void 0) {
		const initialValue = cookie.value;
		if (initialValue !== void 0 && initialValue !== null) updateServerCookieJar(nuxtApp, name, opts.encode(initialValue));
	}
	if (import.meta.dev && hasExpired) stateDiagnostics.NUXT_E7005({ name });
	if (import.meta.client) {
		let channel = null;
		try {
			if (!store && typeof BroadcastChannel !== "undefined") channel = new BroadcastChannel(`nuxt:cookies:${name}`);
		} catch {}
		const callback = (force = false) => {
			if (!force) {
				if (opts.readonly || isEqual(cookie.value, cookies[name])) return;
			}
			writeClientCookie(name, cookie.value === null || cookie.value === void 0 ? void 0 : opts.encode(cookie.value), opts);
			cookies[name] = klona(cookie.value);
			channel?.postMessage({ value: opts.encode(cookie.value) });
		};
		let cookieWatcher;
		const handleChange = (data) => {
			if (data.refresh) invalidateClientCookieJar();
			const raw = data.refresh ? opts.filter(name) ? readClientCookieJar()[name] : void 0 : data.value;
			const value = raw === void 0 && data.refresh ? void 0 : opts.decode(raw);
			cookieWatcher?.pause();
			cookie.value = value;
			cookies[name] = klona(value);
			nextTick(() => cookieWatcher?.resume());
		};
		const hasScope = !!getCurrentScope();
		if (hasScope) onScopeDispose(() => {
			cookieWatcher?.pause();
			callback();
			channel?.close();
		});
		if (store) {
			const changeHandler = (event) => {
				const changedCookie = event.changed.find((c) => c.name === name);
				const removedCookie = event.deleted.find((c) => c.name === name);
				if (changedCookie) handleChange({ value: changedCookie.value });
				if (removedCookie) handleChange({ value: null });
			};
			store.addEventListener("change", changeHandler);
			if (hasScope) onScopeDispose(() => store.removeEventListener("change", changeHandler));
		} else if (channel) channel.onmessage = ({ data }) => handleChange(data);
		if (opts.watch && !opts.readonly) cookieWatcher = watch(cookie, () => callback(opts.refresh), { deep: opts.watch !== "shallow" });
		if (shouldSetInitialClientCookie) callback(shouldSetInitialClientCookie);
	} else if (import.meta.server) {
		const writeFinalCookieValue = () => {
			const valueIsSame = isEqual(cookie.value, cookies[name]);
			if (opts.readonly || valueIsSame && !opts.refresh) return;
			nuxtApp._cookiesChanged ||= {};
			if (valueIsSame && opts.refresh && !nuxtApp._cookiesChanged[name]) return;
			nuxtApp._cookies ||= {};
			if (name in nuxtApp._cookies) {
				if (isEqual(cookie.value, nuxtApp._cookies[name])) return;
				if (import.meta.dev) stateDiagnostics.NUXT_E7006({
					name,
					previous: opts.encode(nuxtApp._cookies[name]),
					next: opts.encode(cookie.value)
				});
			}
			nuxtApp._cookies[name] = cookie.value;
			const encoded = cookie.value === null || cookie.value === void 0 ? void 0 : opts.encode(cookie.value);
			writeServerCookie(useRequestEvent(nuxtApp), name, encoded, opts);
		};
		const unhook = nuxtApp.hooks.hookOnce("app:rendered", writeFinalCookieValue);
		nuxtApp.hooks.hookOnce("app:error", () => {
			unhook();
			return writeFinalCookieValue();
		});
	}
	return cookie;
}
/** @since 3.10.0 */
function refreshCookie(name) {
	if (import.meta.server || store || typeof BroadcastChannel === "undefined") return;
	try {
		const channel = new BroadcastChannel(`nuxt:cookies:${name}`);
		channel.postMessage({ refresh: true });
		channel.close();
	} catch {}
}
/**
* Cache of the raw (undecoded) cookie jar, populated only on the client.
*
* The cache is dropped on the next microtask to keep it accurate.
*/
let clientCookieJar;
function invalidateClientCookieJar() {
	if (import.meta.client) clientCookieJar = void 0;
}
function readClientCookieJar() {
	if (import.meta.client && !clientCookieJar) {
		clientCookieJar = parse(document.cookie, { decode: identity });
		queueMicrotask(invalidateClientCookieJar);
	}
	return clientCookieJar || {};
}
/**
* Cookie attributes that mean the value we just wrote will not necessarily be
* readable back from `document.cookie` on the current document, either because
* the browser rejects the write or because it is scoped elsewhere.
*/
function isWriteVisibleToDocument(opts) {
	if (opts.domain || opts.httpOnly) return false;
	if (opts.secure && location.protocol !== "https:") return false;
	if (opts.sameSite === "none" && !opts.secure) return false;
	return opts.path === void 0 || isCurrentPath(opts.path);
}
function isCurrentPath(path) {
	const { pathname } = location;
	if (pathname === path) return true;
	if (!pathname.startsWith(path)) return false;
	return path.endsWith("/") || pathname[path.length] === "/";
}
/**
* A write with a non-positive `maxAge` or a past `expires` date deletes the
* cookie in the browser regardless of the value passed alongside it.
*/
function isExpiredWrite(opts) {
	if (opts.maxAge !== void 0) return opts.maxAge <= 0;
	const expires = resolveExpires(opts.expires);
	return expires !== void 0 && expires.getTime() <= Date.now();
}
function updateClientCookieJar(name, value, opts) {
	if (!clientCookieJar) return;
	if (!isWriteVisibleToDocument(opts)) return invalidateClientCookieJar();
	if (value === void 0 || isExpiredWrite(opts)) delete clientCookieJar[name];
	else clientCookieJar[name] = value;
}
/**
* Cookie jar for the current request, seeded from the incoming `cookie` header.
*
* @see https://github.com/nuxt/nuxt/issues/22631
*/
function readServerCookieJar(nuxtApp) {
	const event = useRequestEvent(nuxtApp);
	const jar = nuxtApp._cookieJar ??= parse(getRequestHeader(event, "cookie") || "", { decode: identity });
	const setCookies = readResponseSetCookies(event);
	for (let i = nuxtApp._appliedSetCookies || 0; i < setCookies.length; i++) {
		const cookie = parseSetCookie(setCookies[i], { decode: false });
		if (!cookie) continue;
		if (cookie.maxAge !== void 0 && cookie.maxAge <= 0 || cookie.expires && cookie.expires.getTime() <= Date.now()) delete jar[cookie.name];
		else jar[cookie.name] = cookie.value;
	}
	nuxtApp._appliedSetCookies = setCookies.length;
	return jar;
}
function updateServerCookieJar(nuxtApp, name, value) {
	const jar = readServerCookieJar(nuxtApp);
	if (value === void 0) delete jar[name];
	else jar[name] = value;
}
function readResponseSetCookies(event) {
	return splitCookiesString(getResponseHeader(event, "set-cookie") ?? []);
}
const identity = (val) => val;
function toSerializeOptions(opts) {
	const { encode: _encode, decode: _decode, expires, ...rest } = opts;
	return {
		...rest,
		expires: resolveExpires(expires),
		encode: identity
	};
}
function serializeCookie(name, value, opts = {}) {
	const serializeOpts = toSerializeOptions(opts);
	if (value === void 0) return serialize(name, "", {
		...serializeOpts,
		maxAge: -1
	});
	return serialize(name, value, serializeOpts);
}
function writeClientCookie(name, value, opts = {}) {
	if (import.meta.client) {
		document.cookie = serializeCookie(name, value, opts);
		updateClientCookieJar(name, value, opts);
	}
}
function writeServerCookie(event, name, value, opts = {}) {
	if (event) {
		const serializeOpts = toSerializeOptions(opts);
		if (value !== void 0) return setCookie(event, name, value, serializeOpts);
		if (getCookie(event, name) !== void 0 || responseSetsCookie(event, name)) return deleteCookie(event, name, serializeOpts);
	}
}
function responseSetsCookie(event, name) {
	for (const raw of readResponseSetCookies(event)) if (parseSetCookie(raw, { decode: false })?.name === name) return true;
	return false;
}
/**
* The maximum value allowed on a timeout delay.
*
* Reference: https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout#maximum_delay_value
*/
const MAX_TIMEOUT_DELAY = 2147483647;
function cookieRef(value, initialDelay, getDelay, shouldWatch) {
	let timeout;
	let unsubscribe;
	let elapsed = 0;
	let delay = initialDelay;
	const internalRef = shouldWatch ? ref(value) : { value };
	if (getCurrentScope()) onScopeDispose(() => {
		unsubscribe?.();
		clearTimeout(timeout);
	});
	return customRef((track, trigger) => {
		if (shouldWatch) unsubscribe = watch(internalRef, trigger);
		function scheduleTimeout() {
			const currentDelay = delay;
			if (currentDelay === void 0) return;
			const timeRemaining = currentDelay - elapsed;
			const timeoutLength = timeRemaining < MAX_TIMEOUT_DELAY ? timeRemaining : MAX_TIMEOUT_DELAY;
			timeout = setTimeout(() => {
				elapsed += timeoutLength;
				if (elapsed < currentDelay) return scheduleTimeout();
				internalRef.value = void 0;
				trigger();
			}, timeoutLength);
		}
		function createExpirationTimeout() {
			elapsed = 0;
			delay = getDelay();
			clearTimeout(timeout);
			scheduleTimeout();
		}
		return {
			get() {
				track();
				return internalRef.value;
			},
			set(newValue) {
				createExpirationTimeout();
				internalRef.value = newValue;
				trigger();
			}
		};
	});
}
/**
* Custom ref that tracks explicit cookie writes on the server.
*
* This is required for the `refresh` option to ensure the cookie is
* re-written on SSR even when the value remains unchanged.
*/
function cookieServerRef(name, value, opts, nuxtApp) {
	const internalRef = ref(value);
	return customRef((track, trigger) => {
		return {
			get() {
				track();
				return internalRef.value;
			},
			set(newValue) {
				nuxtApp._cookiesChanged ||= {};
				nuxtApp._cookiesChanged[name] = true;
				if (!opts.readonly) updateServerCookieJar(nuxtApp, name, newValue === null || newValue === void 0 ? void 0 : opts.encode(newValue));
				internalRef.value = newValue;
				trigger();
			}
		};
	});
}
//#endregion
export { refreshCookie, useCookie };
