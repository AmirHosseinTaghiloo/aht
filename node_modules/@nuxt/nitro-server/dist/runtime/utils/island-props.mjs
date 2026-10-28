//#region src/runtime/utils/island-props.ts
/** @internal */
const MAX_ISLAND_BODY_BYTES = 65536;
/** @internal */
const MAX_ISLAND_PROP_DEPTH = 64;
/**
* Upper bound on an oversized body that is still read to completion before the 413 is sent.
* Replying while the upload is still in flight leaves the client (or a proxy in front of the
* server) with an unfinished request on the wire, which can stall and take down the keep-alive
* connection along with whatever is queued behind it. Above this size the body is refused
* without reading it.
*
* @internal
*/
const MAX_ISLAND_DRAIN_BYTES = 4194304;
/**
* Whether the bracket nesting of a JSON-ish string exceeds `maxDepth`, in a single linear
* pass. Brackets inside string values are ignored.
*
* @internal
*/
function exceedsMaxDepth(raw, maxDepth = 64) {
	let depth = 0;
	let inString = false;
	let escaped = false;
	for (let i = 0; i < raw.length; i++) {
		const ch = raw[i];
		if (inString) {
			if (escaped) escaped = false;
			else if (ch === "\\") escaped = true;
			else if (ch === "\"") inString = false;
			continue;
		}
		if (ch === "\"") inString = true;
		else if (ch === "{" || ch === "[") {
			if (++depth > maxDepth) return true;
		} else if (ch === "}" || ch === "]") {
			if (depth > 0) depth--;
		}
	}
	return false;
}
/** @internal */
function exceedsMaxBytes(raw, maxBytes = MAX_ISLAND_BODY_BYTES) {
	return Buffer.byteLength(raw, "utf8") > maxBytes;
}
//#endregion
export { MAX_ISLAND_BODY_BYTES, MAX_ISLAND_DRAIN_BYTES, MAX_ISLAND_PROP_DEPTH, exceedsMaxBytes, exceedsMaxDepth };
