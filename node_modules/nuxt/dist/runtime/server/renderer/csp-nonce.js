//#region src/runtime/server/renderer/csp-nonce.ts
const SCRIPT_NONCE_RE = /<script(?=[\s>])[^>]*?\snonce="([\w+/\-=]*)"/;
function extractCspNonce(headTags) {
	return SCRIPT_NONCE_RE.exec(headTags)?.[1] || void 0;
}
//#endregion
export { extractCspNonce };
