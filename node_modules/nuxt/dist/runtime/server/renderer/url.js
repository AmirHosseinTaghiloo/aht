//#region src/runtime/server/renderer/url.ts
/**
* The fragment of a request URL, avoiding the lazy URL parse that reading `hash` triggers when
* there is none. A fragment is never sent over the wire, so it can only appear on a URL the
* server constructed itself.
*/
function urlHash(url) {
	return url.href.includes("#") ? url.hash : "";
}
const PAYLOAD_BUILD_ID_PARAM = "_b";
/** Parse a request path without treating a leading `//` as an authority. */
function parseRequestPath(path) {
	return new URL("http://localhost" + path);
}
/** The page route a `_payload.json` (or `_payload.js`) request renders, without the build id param. */
function payloadRequestToRoute(path, filename = "_payload.json") {
	const payloadURL = parseRequestPath(path);
	const url = payloadURL.pathname.slice(0, -`/${filename}`.length) || "/";
	payloadURL.searchParams.delete(PAYLOAD_BUILD_ID_PARAM);
	return url + payloadURL.search;
}
const LEADING_SLASHES_RE = /^\/+/;
const TRAILING_SLASHES_RE = /\/*$/;
/** The same-origin `_payload.json` (or `_payload.js`) URL for a page route, tagged with the build id. */
function routeToPayloadURL(baseURL, path, buildId, filename = "_payload.json") {
	const request = parseRequestPath(path);
	const base = new URL(baseURL.replace(TRAILING_SLASHES_RE, "/"), "http://localhost");
	const route = request.pathname.replace(LEADING_SLASHES_RE, "").replace(TRAILING_SLASHES_RE, "/");
	const url = new URL("./" + (route === "/" ? "" : route) + filename, base);
	url.search = request.search;
	url.searchParams.set(PAYLOAD_BUILD_ID_PARAM, buildId);
	return URL.canParse(baseURL) ? url.href : url.pathname + url.search;
}
/** `url` with its path and query replaced by those of the request path `path`, keeping its origin. */
function withRequestPath(url, path) {
	const request = parseRequestPath(path);
	const target = new URL(url);
	target.pathname = request.pathname;
	target.search = request.search;
	return target;
}
//#endregion
export { parseRequestPath, payloadRequestToRoute, routeToPayloadURL, urlHash, withRequestPath };
