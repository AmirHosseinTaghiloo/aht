//#region src/server/cors.ts
function isOriginAllowed(origin, option) {
	if (!origin) return false;
	if (!option || option === "*") return true;
	if (typeof option === "function") return option(origin);
	if (Array.isArray(option)) return option.some((allowed) => allowed instanceof RegExp ? allowed.test(origin) : allowed === origin);
	return option === origin;
}
function originHeaders(request, options) {
	if (!options.origin || options.origin === "*") return { "access-control-allow-origin": "*" };
	const origin = request.headers.get("origin");
	return isOriginAllowed(origin, options.origin) ? {
		"access-control-allow-origin": origin,
		"vary": "origin"
	} : { vary: "origin" };
}
function methodsHeaders(request, { methods, credentials }) {
	if (!methods) return {};
	if (methods === "*") {
		if (!credentials) return { "access-control-allow-methods": "*" };
		const requested = request.headers.get("access-control-request-method");
		return requested ? {
			"access-control-allow-methods": requested,
			"vary": "access-control-request-method"
		} : {};
	}
	return methods.length > 0 ? { "access-control-allow-methods": methods.join(",") } : {};
}
function allowHeadersHeaders(request, { allowHeaders }) {
	if (!allowHeaders || allowHeaders === "*" || allowHeaders.length === 0) {
		const requested = request.headers.get("access-control-request-headers");
		return requested ? {
			"access-control-allow-headers": requested,
			"vary": "access-control-request-headers"
		} : { vary: "access-control-request-headers" };
	}
	return {
		"access-control-allow-headers": allowHeaders.join(","),
		"vary": "access-control-request-headers"
	};
}
function exposeHeadersHeaders({ exposeHeaders, credentials }) {
	if (!exposeHeaders) return {};
	if (exposeHeaders === "*") return credentials ? {} : { "access-control-expose-headers": "*" };
	return { "access-control-expose-headers": exposeHeaders.join(",") };
}
function applyHeaders(event, headers) {
	for (const name in headers) if (name === "vary") event.res.headers.append(name, headers[name]);
	else event.res.headers.set(name, headers[name]);
}
/**
* Apply CORS headers to the response. A preflight request is answered: the
* returned `Response` is the handler's result, with the headers set on the
* event's response. Any other request resolves `false` and continues.
*
* @example
* ```ts
* export default defineEventHandler((event) => {
*   const preflight = handleCors(event, { origin: ['https://nuxt.com'], credentials: true })
*   if (preflight) {
*     return preflight
*   }
*   return { ok: true }
* })
* ```
*
* @since 4.6.0
*/
function handleCors(event, options = {}) {
	const resolved = {
		origin: "*",
		methods: "*",
		allowHeaders: "*",
		exposeHeaders: "*",
		credentials: false,
		maxAge: false,
		...options
	};
	const request = event.req;
	const credentials = resolved.credentials ? { "access-control-allow-credentials": "true" } : {};
	if (request.method === "OPTIONS" && request.headers.get("origin") && request.headers.get("access-control-request-method")) {
		const groups = [
			originHeaders(request, resolved),
			credentials,
			methodsHeaders(request, resolved),
			allowHeadersHeaders(request, resolved),
			resolved.maxAge ? { "access-control-max-age": resolved.maxAge } : {}
		];
		const headers = Object.assign({}, ...groups);
		const vary = groups.map((group) => group.vary).filter(Boolean);
		if (vary.length > 0) headers.vary = vary.join(", ");
		applyHeaders(event, headers);
		return new Response(null, { status: resolved.preflight?.statusCode ?? 204 });
	}
	applyHeaders(event, {
		...originHeaders(request, resolved),
		...credentials,
		...exposeHeadersHeaders(resolved)
	});
	return false;
}
//#endregion
export { handleCors };
