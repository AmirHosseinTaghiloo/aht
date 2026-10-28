import { traceAsync } from "../internal/tracing.js";
import { defineNuxtPlugin, useRuntimeConfig } from "../nuxt.js";
import { isAbsoluteHref, isRootedPath, sanitizeAnchorHref } from "../utils.js";
import { navigationDiagnostics } from "../diagnostics/navigation.js";
import { navigateTo } from "../composables/router.js";
import { clearError, showError } from "../composables/error.js";
import { getRouteRules } from "../composables/manifest.js";
import { computed, defineComponent, h, isReadonly, reactive } from "vue";
import { tracingChannelNuxt } from "#build/nuxt.config.mjs";
import { isEqual, joinURL, parseQuery, stringifyParsedURL, stringifyQuery, withoutBase } from "ufo";
import { createError } from "@nuxt/nitro-server/h3";
import { globalMiddleware } from "#build/middleware";
//#region src/app/plugins/router.ts
const LITERAL_PATH_RE = /^\/[\w\-./~!$&'()*+,;=:@]*$/;
/** Split a rooted path as the `URL` parser would, or `undefined` if it needs the parser. */
function splitLiteralPath(fullPath) {
	const hashIndex = fullPath.indexOf("#");
	const withoutHash = hashIndex === -1 ? fullPath : fullPath.slice(0, hashIndex);
	const searchIndex = withoutHash.indexOf("?");
	const path = searchIndex === -1 ? withoutHash : withoutHash.slice(0, searchIndex);
	if (path.includes("/.") || !LITERAL_PATH_RE.test(path)) return;
	return {
		path,
		search: searchIndex === -1 ? "" : withoutHash.slice(searchIndex),
		hash: hashIndex === -1 || hashIndex === fullPath.length - 1 ? "" : fullPath.slice(hashIndex)
	};
}
function getRouteFromPath(fullPath, baseURL = "/") {
	const route = fullPath && typeof fullPath === "object" ? fullPath : {};
	if (typeof fullPath === "object") fullPath = stringifyParsedURL({
		pathname: fullPath.path || "",
		search: stringifyQuery(fullPath.query || {}),
		hash: fullPath.hash || ""
	});
	const isRooted = isRootedPath(fullPath);
	let parts = isRooted ? splitLiteralPath(fullPath) : void 0;
	if (!parts) {
		const url = new URL(fullPath, import.meta.client ? window.location.href : "http://localhost");
		parts = {
			path: url.pathname,
			search: url.search,
			hash: url.hash
		};
	}
	return {
		path: parts.path,
		fullPath,
		query: parts.search ? parseQuery(parts.search) : {},
		hash: parts.hash,
		params: route.params || {},
		name: void 0,
		matched: route.matched || [],
		redirectedFrom: void 0,
		meta: route.meta || {},
		href: isRooted ? baseURL === "/" ? fullPath : joinURL(baseURL, fullPath) : sanitizeAnchorHref(fullPath)
	};
}
const plugin = /* @__PURE__ */ defineNuxtPlugin({
	name: "nuxt:router",
	enforce: "pre",
	setup(nuxtApp) {
		const initialURL = import.meta.client ? withoutBase(window.location.pathname, (/* @__PURE__ */ useRuntimeConfig()).app.baseURL) + window.location.search + window.location.hash : nuxtApp.ssrContext.url;
		const routes = [];
		const hooks = {
			"navigate:before": [],
			"resolve:before": [],
			"navigate:after": [],
			"error": []
		};
		const registerHook = (hook, guard) => {
			hooks[hook].push(guard);
			return () => {
				const index = hooks[hook].indexOf(guard);
				if (index !== -1) hooks[hook].splice(index, 1);
			};
		};
		const baseURL = (/* @__PURE__ */ useRuntimeConfig()).app.baseURL;
		const route = reactive(getRouteFromPath(initialURL, baseURL));
		let navigationCounter = 0;
		async function handleNavigation(url, replace) {
			const navigationId = ++navigationCounter;
			try {
				const to = getRouteFromPath(url, baseURL);
				for (const middleware of hooks["navigate:before"]) {
					const result = await middleware(to, route);
					if (navigationId !== navigationCounter) return;
					if (result === false || result instanceof Error) return;
					if (typeof result === "string" && result.length) return await handleNavigation(result, true);
				}
				for (const handler of hooks["resolve:before"]) {
					await handler(to, route);
					if (navigationId !== navigationCounter) return;
				}
				Object.assign(route, to);
				if (import.meta.client) {
					window.history[replace ? "replaceState" : "pushState"]({}, "", joinURL(baseURL, to.fullPath));
					if (!nuxtApp.isHydrating) await nuxtApp.runWithContext(clearError);
				}
				for (const middleware of hooks["navigate:after"]) await middleware(to, route);
			} catch (err) {
				if (import.meta.dev && !hooks.error.length) navigationDiagnostics.NUXT_E2009({ cause: err });
				for (const handler of hooks.error) await handler(err);
			} finally {
				if (navigationId === navigationCounter) {
					delete nuxtApp._processingMiddleware;
					if (import.meta.server) delete nuxtApp._middlewareTo;
				}
			}
		}
		const router = {
			currentRoute: computed(() => route),
			isReady: () => Promise.resolve(),
			options: {},
			install: () => Promise.resolve(),
			push: (url) => handleNavigation(url, false),
			replace: (url) => handleNavigation(url, true),
			back: () => window.history.go(-1),
			go: (delta) => window.history.go(delta),
			forward: () => window.history.go(1),
			beforeResolve: (guard) => registerHook("resolve:before", guard),
			beforeEach: (guard) => registerHook("navigate:before", guard),
			afterEach: (guard) => registerHook("navigate:after", guard),
			onError: (handler) => registerHook("error", handler),
			resolve: (url) => getRouteFromPath(url, baseURL),
			addRoute: (parentName, route) => {
				routes.push(route);
			},
			getRoutes: () => routes,
			hasRoute: (name) => routes.some((route) => route.name === name),
			removeRoute: (name) => {
				const index = routes.findIndex((route) => route.name === name);
				if (index !== -1) routes.splice(index, 1);
			}
		};
		nuxtApp.vueApp.component("RouterLink", defineComponent({
			functional: true,
			props: {
				to: {
					type: String,
					required: true
				},
				custom: Boolean,
				replace: Boolean,
				activeClass: String,
				exactActiveClass: String,
				ariaCurrentValue: String
			},
			setup: (props, { slots }) => {
				const navigate = () => handleNavigation(props.to, props.replace);
				const resolved = computed(() => router.resolve(props.to));
				const isExternal = computed(() => isAbsoluteHref(props.to));
				return () => {
					const href = resolved.value.href;
					if (props.custom) return slots.default?.({
						href,
						navigate,
						route: resolved.value
					});
					if (isExternal.value) return h("a", { href }, slots);
					return h("a", {
						href,
						onClick: (e) => {
							e.preventDefault();
							return navigate();
						}
					}, slots);
				};
			}
		}));
		if (import.meta.client) window.addEventListener("popstate", (event) => {
			const location = event.target.location;
			router.replace(withoutBase(location.pathname, baseURL) + location.search + location.hash);
		});
		nuxtApp._route = route;
		nuxtApp._middleware ||= {
			global: [],
			named: {}
		};
		const initialLayout = nuxtApp.payload.state._layout;
		const initialLayoutProps = nuxtApp.payload.state._layoutProps;
		nuxtApp.hooks.hookOnce("app:created", async () => {
			router.beforeEach(async (to, from) => {
				to.meta = reactive(to.meta || {});
				if (nuxtApp.isHydrating && initialLayout && !isReadonly(to.meta.layout)) {
					to.meta.layout = initialLayout;
					to.meta.layoutProps = initialLayoutProps;
				}
				nuxtApp._processingMiddleware = true;
				if (import.meta.server) nuxtApp._middlewareTo = to;
				if (import.meta.client || !nuxtApp.ssrContext?.islandContext) {
					const middlewareEntries = /* @__PURE__ */ new Set([...globalMiddleware, ...nuxtApp._middleware.global]);
					const routeRules = getRouteRules({ path: to.path });
					if (routeRules.appMiddleware) for (const key in routeRules.appMiddleware) {
						const guard = nuxtApp._middleware.named[key];
						if (!guard) continue;
						if (routeRules.appMiddleware[key]) middlewareEntries.add(guard);
						else middlewareEntries.delete(guard);
					}
					for (const middleware of middlewareEntries) {
						if (import.meta.dev) nuxtApp._processingMiddleware = middleware._path || true;
						const run = () => nuxtApp.runWithContext(() => middleware(to, from));
						const result = await (import.meta.server && tracingChannelNuxt ? traceAsync("nuxt.middleware", { middleware: {
							name: middleware._name || middleware.name || void 0,
							path: middleware._path,
							global: globalMiddleware.includes(middleware) || nuxtApp._middleware.global.includes(middleware)
						} }, run) : run());
						if (import.meta.server) {
							if (result === false || result instanceof Error) {
								const error = result || createError({
									status: 404,
									statusText: `Page Not Found: ${initialURL}`,
									data: { path: initialURL }
								});
								delete nuxtApp._processingMiddleware;
								delete nuxtApp._middlewareTo;
								return nuxtApp.runWithContext(() => showError(error));
							}
						}
						if (result === true) continue;
						if (result || result === false) return result;
					}
				}
			});
			router.afterEach(() => {
				delete nuxtApp._processingMiddleware;
				if (import.meta.server) delete nuxtApp._middlewareTo;
			});
			await router.replace(initialURL);
			if (!isEqual(route.fullPath, initialURL)) await nuxtApp.runWithContext(() => navigateTo(route.fullPath));
		});
		return { provide: {
			route,
			router
		} };
	}
});
//#endregion
export { plugin as default };
