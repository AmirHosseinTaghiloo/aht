//#region src/app/internal/prefetch-util.ts
const IS_2G_RE = /2g/;
/**
* Whether the connection can afford speculative work.
* https://developer.mozilla.org/en-US/docs/Web/API/Navigator/connection
* @internal
*/
function canPrefetch() {
	if (import.meta.server) return false;
	const connection = navigator.connection;
	if (!connection) return true;
	return !connection.saveData && !IS_2G_RE.test(connection.effectiveType || "");
}
/**
* The destination a piece of prefetch work belongs to. The hash does not affect what is fetched.
* @internal
*/
function prefetchGroup(url) {
	const { pathname, search } = new URL(url, window.location.href);
	return pathname + search;
}
//#endregion
export { canPrefetch, prefetchGroup };
