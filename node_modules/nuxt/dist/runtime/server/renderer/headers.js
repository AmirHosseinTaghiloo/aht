//#region src/runtime/server/renderer/headers.ts
/**
* Layer `overlay` onto `base`, appending `set-cookie` values `base` lacks.
*
* @internal
*/
function mergeHeaders(base, overlay) {
	for (const [name, value] of overlay) {
		if (name === "set-cookie") continue;
		base.set(name, value);
	}
	const cookies = overlay.getSetCookie();
	if (cookies.length) {
		const existing = new Set(base.getSetCookie());
		for (const cookie of cookies) if (!existing.has(cookie)) base.append("set-cookie", cookie);
	}
	return base;
}
//#endregion
export { mergeHeaders };
