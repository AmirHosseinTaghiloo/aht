//#region src/runtime/server/dev/peer.ts
/**
* Peer checks shared by the dev-only endpoints that disclose local state.
*
* @module nuxt/internal/dev/peer
*/
/**
* Whether the connected peer is a loopback address.
*
* This inspects the TCP peer address rather than request metadata, so a
* non-browser client cannot make itself look local by choosing its `Host`,
* `Origin`, `Referer` or `Sec-Fetch-*` headers. `x-forwarded-for` is ignored on
* purpose: only the address of the socket we are actually talking to counts.
*/
function isLoopbackAddress(address) {
	if (!address) return false;
	let normalized = address.trim().toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
	const zoneIndex = normalized.indexOf("%");
	if (zoneIndex !== -1) normalized = normalized.slice(0, zoneIndex);
	if (normalized.startsWith("::ffff:")) normalized = normalized.slice(7);
	if (normalized === "::1") return true;
	return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(normalized);
}
//#endregion
export { isLoopbackAddress };
