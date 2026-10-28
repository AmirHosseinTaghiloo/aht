import { tryUseNuxtApp, useNuxtApp } from "../nuxt.js";
import { toArray } from "../utils.js";
import { useRouter } from "./router.js";
import { renderDiagnostics } from "../diagnostics/render.js";
import { prefetchGroup } from "../internal/prefetch-util.js";
//#region src/app/composables/preload.ts
/**
* Preload a component or components that have been globally registered.
* @param components Pascal-cased name or names of components to prefetch
* @since 3.0.0
*/
const preloadComponents = async (components) => {
	if (import.meta.server) return;
	const nuxtApp = useNuxtApp();
	components = toArray(components);
	await Promise.all(components.map((name) => {
		const component = nuxtApp.vueApp._context.components[name];
		if (component) return _loadAsyncComponent(component);
		if (import.meta.dev) renderDiagnostics.NUXT_E4023({ name });
	}));
};
/**
* Prefetch a component or components that have been globally registered.
* @param components Pascal-cased name or names of components to prefetch
* @since 3.0.0
*/
const prefetchComponents = (components) => {
	if (import.meta.server) return;
	return preloadComponents(components);
};
function _loadAsyncComponent(component) {
	if (component?.__asyncLoader && !component.__asyncResolved) return component.__asyncLoader();
}
function loadRouteComponents(matched) {
	return Promise.all(matched.map((route) => {
		const component = route.components?.default;
		return typeof component === "function" ? Promise.resolve(component()).catch(() => {}) : void 0;
	}));
}
/** @since 3.0.0 */
async function preloadRouteComponents(to, router = useRouter()) {
	if (import.meta.server) return;
	const { matched } = router.resolve(to);
	if (matched.length) await loadRouteComponents(matched);
}
/**
* Queued form of `preloadRouteComponents`, throttled and promoted with the destination's other work.
* @internal
*/
function prefetchRouteComponents(to, router) {
	const { fullPath, path, matched } = router.resolve(to);
	if (!matched.length) return;
	const scheduler = tryUseNuxtApp()?._prefetch;
	if (!scheduler) {
		loadRouteComponents(matched);
		return;
	}
	scheduler.schedule({
		key: `route:${path}`,
		priority: "route",
		scope: "navigation",
		group: prefetchGroup(fullPath),
		run: (signal) => signal.aborted ? void 0 : loadRouteComponents(matched)
	});
}
//#endregion
export { _loadAsyncComponent, prefetchComponents, prefetchRouteComponents, preloadComponents, preloadRouteComponents };
