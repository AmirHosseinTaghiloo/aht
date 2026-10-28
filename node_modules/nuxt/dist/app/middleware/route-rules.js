import { isAbsoluteHref } from "../utils.js";
import { defineNuxtRouteMiddleware } from "../composables/router.js";
import { getRouteRules } from "../composables/manifest.js";
//#region src/app/middleware/route-rules.ts
const middleware = /* @__PURE__ */ defineNuxtRouteMiddleware((to) => {
	if (import.meta.server || import.meta.test) return;
	const rules = getRouteRules({ path: to.path });
	if (rules.redirect) {
		const path = rules.redirect.includes("#") ? rules.redirect : rules.redirect + to.hash;
		if (isAbsoluteHref(path)) {
			window.location.href = path;
			return false;
		}
		return path;
	}
});
//#endregion
export { middleware as default };
