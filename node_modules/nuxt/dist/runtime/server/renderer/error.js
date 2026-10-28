//#region src/runtime/server/renderer/error.ts
/**
* Whether the error is one the app raised deliberately, as h3 recognises its own: by the brand
* h3 v1 puts on its constructor (or the name h3 v2 gives it) and by status, rather than by shape.
* Anything else reached the response by accident, so its message, data and headers are the
* server's own and are not exposed.
*/
function isRaisedByApp(error) {
	const candidate = error;
	const status = candidate?.status ?? candidate?.statusCode;
	return error instanceof Error && (candidate.constructor?.__h3_error__ === true || candidate.name === "HTTPError") && typeof status === "number" && status > 99 && !candidate.unhandled;
}
/** Reduce `data` to what JSON carries; a value the payload cannot serialise takes the error page down with it. */
function jsonSafeData(data) {
	if (data === void 0) return;
	try {
		return JSON.parse(JSON.stringify(data));
	} catch {
		return;
	}
}
const INVALID_REASON_PHRASE_RE = /[^\t\x20-\x7E\x80-\xFF]/g;
/**
* Read the status, reason phrase and headers to answer a caught error with. An error naming no
* status is the server's own, whose message is only exposed in development.
*
* @internal
*/
function describeError(error) {
	const { status, statusCode, statusText, statusMessage, message, headers, data } = error || {};
	const named = status ?? statusCode;
	const isHTTPError = typeof named === "number" && named >= 400 && named <= 599;
	const exposed = import.meta.dev || isHTTPError && isRaisedByApp(error);
	const reason = isHTTPError && (statusText || statusMessage) || exposed && message || (isHTTPError ? "Request failed" : "Internal Server Error");
	return {
		status: isHTTPError ? named : 500,
		statusText: reason.replace(INVALID_REASON_PHRASE_RE, "") || "Error",
		message: exposed && message || reason,
		data: exposed ? jsonSafeData(data) : void 0,
		headers: new Headers(exposed ? headers ?? void 0 : void 0),
		isHTTPError
	};
}
/** Set when the app threw a bare value, which was given its status on the way out. */
const THROWN_VALUE = Symbol.for("nuxt:dev:thrown");
/**
* Whether the error is the app working as intended: a 404 or a failed validation it raised
* deliberately.
*
* @internal
*/
function isExpectedError(error, described) {
	return isRaisedByApp(error) && described.isHTTPError && described.status < 500 && !(typeof error === "object" && error !== null && THROWN_VALUE in error);
}
/**
* Add `value`'s tokens to the `vary` header, keeping any already present. `*` absorbs
* everything else, since it means the response varies on all headers.
*
* @internal
*/
function appendVary(headers, value) {
	const incoming = parseVary(value);
	if (!incoming.length) return;
	const existing = parseVary(headers.get("vary"));
	if (existing.includes("*")) return;
	if (incoming.includes("*")) {
		headers.set("vary", "*");
		return;
	}
	const merged = existing.slice();
	for (const token of incoming) if (!merged.includes(token)) merged.push(token);
	headers.set("vary", merged.join(", "));
}
function parseVary(value) {
	return value ? value.split(",").map((token) => token.trim().toLowerCase()).filter(Boolean) : [];
}
/**
* Stringify `error.data` the way it reaches the error page as a query parameter, for an error
* rendered in process under `experimental.parseErrorData: false`.
*
* @internal
*/
function stringifyErrorData(data) {
	return data === void 0 || typeof data === "string" ? data : JSON.stringify(data);
}
/**
* Whether the client asked for JSON rather than a page, so an error must be answered with a
* JSON body. An explicit request for HTML wins over every other signal.
*
* @internal
*/
function isJsonRequest(request, pathname) {
	if (request.headers.get("accept")?.includes("text/html")) return false;
	return hasHeader(request, "accept", "application/json") || hasHeader(request, "user-agent", "curl/") || hasHeader(request, "user-agent", "httpie/") || hasHeader(request, "sec-fetch-mode", "cors") || pathname.startsWith("/api/") || pathname.endsWith(".json");
}
function hasHeader(request, name, includes) {
	const value = request.headers.get(name);
	return !!(value && value.toLowerCase().includes(includes));
}
//#endregion
export { appendVary, describeError, isExpectedError, isJsonRequest, stringifyErrorData };
