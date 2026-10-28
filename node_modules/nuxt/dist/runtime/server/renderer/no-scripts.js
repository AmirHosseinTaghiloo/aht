import { rendererDiagnostics } from "./diagnostics.js";
//#region src/runtime/server/renderer/no-scripts.ts
const SSR_CLIENT_TELEPORT_RE = /^uid=[^;]*;client=/;
function detectClientScriptReliance(ssrContext) {
	const reasons = [];
	if (ssrContext["~lazyHydratedModules"]?.size) reasons.push("it uses lazy hydration strategies, which require client-side JavaScript to hydrate");
	if (ssrContext.teleports) {
		for (const key in ssrContext.teleports) if (SSR_CLIENT_TELEPORT_RE.test(key)) {
			reasons.push("it renders a server component with a `nuxt-client` child, which requires client-side JavaScript to hydrate");
			break;
		}
	}
	return reasons;
}
const warnedPaths = /* @__PURE__ */ new Set();
function warnNoScriptsClientReliance(ssrContext, path) {
	if (warnedPaths.has(path)) return;
	const reasons = detectClientScriptReliance(ssrContext);
	if (!reasons.length) return;
	warnedPaths.add(path);
	rendererDiagnostics.NUXT_E8007({
		path,
		reasons: reasons.join("\n  - ")
	});
}
//#endregion
export { detectClientScriptReliance, warnNoScriptsClientReliance };
