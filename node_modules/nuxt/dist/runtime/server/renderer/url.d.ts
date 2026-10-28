//#region src/runtime/server/renderer/url.d.ts
/**
 * The fragment of a request URL, avoiding the lazy URL parse that reading `hash` triggers when
 * there is none. A fragment is never sent over the wire, so it can only appear on a URL the
 * server constructed itself.
 */
export declare function urlHash(url: URL): string;
/** Parse a request path without treating a leading `//` as an authority. */
export declare function parseRequestPath(path: string): URL;
/** The page route a `_payload.json` (or `_payload.js`) request renders, without the build id param. */
export declare function payloadRequestToRoute(path: string, filename?: string): string;
/** The same-origin `_payload.json` (or `_payload.js`) URL for a page route, tagged with the build id. */
export declare function routeToPayloadURL(baseURL: string, path: string, buildId: string, filename?: string): string;
/** `url` with its path and query replaced by those of the request path `path`, keeping its origin. */
export declare function withRequestPath(url: URL, path: string): URL;
//#endregion