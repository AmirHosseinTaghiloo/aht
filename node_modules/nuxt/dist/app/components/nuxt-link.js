import { useNuxtApp, useRuntimeConfig } from "../nuxt.js";
import { isAbsoluteHref, isRootedPath, sanitizeAnchorHref } from "../utils.js";
import { navigationDiagnostics } from "../diagnostics/navigation.js";
import { encodeRoutePath, navigateTo, resolveRouteObject, useRouter } from "../composables/router.js";
import { renderDiagnostics } from "../diagnostics/render.js";
import { cancelIdleCallback, requestIdleCallback } from "../compat/idle-callback.js";
import { onNuxtReady } from "../composables/ready.js";
import { canPrefetch, prefetchGroup } from "../internal/prefetch-util.js";
import { prefetchRouteComponents } from "../composables/preload.js";
import { computed, defineComponent, h, inject, onBeforeUnmount, onMounted, provide, ref, resolveComponent, shallowRef, unref } from "vue";
import { componentIslands, nuxtLinkDefaults } from "#build/nuxt.config.mjs";
import { hasProtocol, joinURL, parseQuery, withTrailingSlash, withoutTrailingSlash } from "ufo";
import { hashMode } from "#build/router.options.mjs";
//#region src/app/components/nuxt-link.ts
const firstNonUndefined = (...args) => args.find((arg) => arg !== void 0);
const NuxtLinkDevKeySymbol = Symbol("nuxt-link-dev-key");
/* @__NO_SIDE_EFFECTS__ */
function defineNuxtLink(options) {
	const componentName = options.componentName || "NuxtLink";
	function checkPropConflicts(props, main, sub) {
		if (import.meta.dev && props[main] !== void 0 && props[sub] !== void 0) renderDiagnostics.NUXT_E4010({
			componentName,
			main,
			sub
		});
	}
	function isHashLinkWithoutHashMode(link) {
		return !hashMode && typeof link === "string" && link.startsWith("#");
	}
	function resolveTrailingSlashBehavior(to, resolve, trailingSlash) {
		const effectiveTrailingSlash = trailingSlash ?? options.trailingSlash;
		if (!to || effectiveTrailingSlash !== "append" && effectiveTrailingSlash !== "remove") return to;
		if (typeof to === "string") return applyTrailingSlashBehavior(to, effectiveTrailingSlash);
		const path = "path" in to && to.path !== void 0 ? to.path : resolve(to).path;
		return {
			...to,
			name: void 0,
			path: applyTrailingSlashBehavior(path, effectiveTrailingSlash)
		};
	}
	/**
	* The link state `<NuxtLink>` renders with. Kept separate from `useNuxtLink` so the component
	* does not resolve the `<RouterLink>` link state backing `route`/`isActive`/`isExactActive`,
	* which it never reads.
	*/
	function useLinkTarget(props) {
		const router = useRouter();
		const config = /* @__PURE__ */ useRuntimeConfig();
		const rootedHref = router.options?.history?.createHref ?? ((path) => joinURL(config.app.baseURL, path));
		const hasTarget = computed(() => !!unref(props.target) && unref(props.target) !== "_self");
		const isAbsoluteUrl = computed(() => {
			const path = unref(props.to) || unref(props.href) || "";
			return typeof path === "string" && isAbsoluteHref(path);
		});
		const isExternal = computed(() => {
			if (unref(props.external)) return true;
			const path = unref(props.to) || unref(props.href) || "";
			if (typeof path === "object") return false;
			return path === "" || isAbsoluteUrl.value;
		});
		const to = computed(() => {
			checkPropConflicts(props, "to", "href");
			const path = unref(props.to) || unref(props.href) || "";
			if (isExternal.value) return path;
			return resolveTrailingSlashBehavior(path, router.resolve, unref(props.trailingSlash));
		});
		const href = computed(() => {
			const effectiveTrailingSlash = unref(props.trailingSlash) ?? options.trailingSlash;
			if (!to.value || isAbsoluteUrl.value || isHashLinkWithoutHashMode(to.value)) {
				const raw = to.value;
				return typeof raw === "string" ? sanitizeAnchorHref(raw) : raw;
			}
			if (isExternal.value) {
				const path = typeof to.value === "object" && "path" in to.value ? resolveRouteObject(to.value) : to.value;
				const href = typeof path === "object" ? router.resolve(path).href : path;
				const safe = typeof href === "string" ? sanitizeAnchorHref(href) : href;
				return safe === null ? null : applyTrailingSlashBehavior(safe, effectiveTrailingSlash);
			}
			if (typeof to.value === "object") return router.resolve(to.value)?.href ?? null;
			return applyTrailingSlashBehavior(isRootedPath(to.value) ? rootedHref(to.value) : router.resolve(to.value).href, effectiveTrailingSlash);
		});
		return {
			to,
			hasTarget,
			isAbsoluteUrl,
			isExternal,
			href,
			async navigate(_e) {
				if (href.value === null) {
					if (import.meta.dev) navigationDiagnostics.NUXT_E2011({ componentName });
					return;
				}
				await navigateTo(href.value, {
					replace: unref(props.replace),
					external: isExternal.value || hasTarget.value
				});
			}
		};
	}
	function useNuxtLink(props) {
		const router = useRouter();
		const target = useLinkTarget(props);
		const builtinRouterLink = resolveComponent("RouterLink");
		const useBuiltinLink = builtinRouterLink && typeof builtinRouterLink !== "string" ? builtinRouterLink.useLink : void 0;
		const link = target.isExternal.value ? void 0 : useBuiltinLink?.({
			...props,
			to: target.to,
			viewTransition: unref(props.viewTransition)
		});
		return {
			...target,
			isActive: link?.isActive ?? computed(() => target.to.value === router.currentRoute.value.path),
			isExactActive: link?.isExactActive ?? computed(() => target.to.value === router.currentRoute.value.path),
			route: link?.route ?? computed(() => router.resolve(target.to.value))
		};
	}
	function checkNuxtLinkNesting() {
		if (inject(NuxtLinkDevKeySymbol, false)) renderDiagnostics.NUXT_E4009();
		else provide(NuxtLinkDevKeySymbol, true);
	}
	/**
	* Render an internal link as a plain anchor, matching the markup `<RouterLink>` produces
	* for the same location.
	*/
	function renderStaticInternalLink(props, slots, router, rawTo) {
		if (import.meta.dev) {
			checkPropConflicts(props, "to", "href");
			checkPropConflicts(props, "noRel", "rel");
		}
		const route = router.resolve(resolveTrailingSlashBehavior(rawTo, router.resolve, props.trailingSlash));
		const currentRoute = router.currentRoute.value;
		const index = activeRecordIndex(route, currentRoute);
		const isActive = index > -1 && includesParams(currentRoute.params, route.params);
		const isExactActive = index > -1 && index === currentRoute.matched.length - 1 && isSameRouteLocationParams(currentRoute.params, route.params);
		let dataInternal;
		if (componentIslands && useNuxtApp().ssrContext?.islandContext) {
			const flags = [];
			if (props.replace) flags.push("replace");
			if ((typeof props.prefetchOn === "string" ? props.prefetchOn === "visibility" : props.prefetchOn?.visibility ?? options.prefetchOn?.visibility) && (props.prefetch ?? options.prefetch) !== false && props.noPrefetch !== true) flags.push("prefetch");
			dataInternal = flags.join(" ");
		}
		const routerOptions = router.options;
		const href = sanitizeAnchorHref(route.href);
		return h("a", {
			"aria-current": isExactActive ? props.ariaCurrentValue ?? "page" : null,
			href,
			"class": {
				[getLinkClass(props.activeClass || options.activeClass, routerOptions.linkActiveClass, "router-link-active")]: isActive,
				[getLinkClass(props.exactActiveClass || options.exactActiveClass, routerOptions.linkExactActiveClass, "router-link-exact-active")]: isExactActive
			},
			"rel": props.rel || void 0,
			"data-internal": dataInternal
		}, slots.default?.({
			route,
			href,
			isActive,
			isExactActive,
			navigate: () => navigateTo(route.href, { replace: props.replace })
		}));
	}
	return defineComponent({
		name: componentName,
		props: {
			to: {
				type: [String, Object],
				required: false
			},
			href: {
				type: [String, Object],
				required: false
			},
			target: {
				type: String,
				required: false
			},
			rel: {
				type: String,
				required: false
			},
			noRel: {
				type: Boolean,
				default: void 0,
				required: false
			},
			prefetch: {
				type: Boolean,
				default: void 0,
				required: false
			},
			prefetchOn: {
				type: [String, Object],
				required: false
			},
			noPrefetch: {
				type: Boolean,
				default: void 0,
				required: false
			},
			activeClass: {
				type: String,
				required: false
			},
			exactActiveClass: {
				type: String,
				required: false
			},
			prefetchedClass: {
				type: String,
				required: false
			},
			replace: {
				type: Boolean,
				default: void 0,
				required: false
			},
			ariaCurrentValue: {
				type: String,
				required: false
			},
			external: {
				type: Boolean,
				default: void 0,
				required: false
			},
			custom: {
				type: Boolean,
				default: void 0,
				required: false
			},
			trailingSlash: {
				type: String,
				required: false
			}
		},
		useLink: useNuxtLink,
		setup(props, { slots }) {
			const router = useRouter();
			if (import.meta.server && !props.custom) {
				const rawTo = props.to || props.href || "";
				if (!(props.external || typeof rawTo === "string" && (rawTo === "" || isAbsoluteHref(rawTo))) && !isHashLinkWithoutHashMode(rawTo) && (!props.target || props.target === "_self")) {
					if (import.meta.dev) checkNuxtLinkNesting();
					return () => renderStaticInternalLink(props, slots, router, rawTo);
				}
			}
			const routerLinkComponent = resolveComponent("RouterLink");
			const { to, href, navigate, isExternal, hasTarget, isAbsoluteUrl } = useLinkTarget(props);
			const prefetched = shallowRef(false);
			const el = import.meta.server ? void 0 : ref(null);
			const elRef = import.meta.server ? void 0 : (ref) => {
				el.value = props.custom ? ref?.$el?.nextElementSibling : ref?.$el;
			};
			function prefetchOn(mode) {
				return typeof props.prefetchOn === "string" ? props.prefetchOn === mode : props.prefetchOn?.[mode] ?? options.prefetchOn?.[mode];
			}
			function prefetchAllowed() {
				return Boolean((props.prefetch ?? options.prefetch) !== false && props.noPrefetch !== true && props.target !== "_blank" && canPrefetch());
			}
			function shouldPrefetch(mode) {
				if (import.meta.server) return false;
				return Boolean(!prefetched.value && prefetchOn(mode) && prefetchAllowed());
			}
			function resolvedPath() {
				const path = typeof to.value === "string" ? to.value : isExternal.value ? resolveRouteObject(to.value) : router.resolve(to.value).fullPath;
				return isExternal.value ? new URL(path, window.location.href).href : path;
			}
			function escalate() {
				if (!prefetched.value) {
					if (prefetchOn("interaction")) prefetch();
					return;
				}
				if (!isExternal.value) useNuxtApp()._prefetch?.promote(prefetchGroup(resolvedPath()));
			}
			async function prefetch(nuxtApp = useNuxtApp()) {
				if (import.meta.server) return;
				if (prefetched.value) return;
				if (href.value === null) return;
				prefetched.value = true;
				const normalizedPath = resolvedPath();
				await Promise.all([nuxtApp.hooks.callHook("link:prefetch", normalizedPath)?.catch(() => {}), !import.meta.dev && !isExternal.value && !hasTarget.value && prefetchRouteComponents(to.value, router)]);
			}
			if (import.meta.client && !props.custom) {
				checkPropConflicts(props, "noPrefetch", "prefetch");
				if (shouldPrefetch("visibility")) {
					const nuxtApp = useNuxtApp();
					let idleId;
					let unobserve = null;
					onMounted(() => {
						const observer = useObserver();
						onNuxtReady(() => {
							idleId = requestIdleCallback(() => {
								if (el?.value?.tagName) unobserve = observer.observe(el.value, async () => {
									unobserve?.();
									unobserve = null;
									await prefetch(nuxtApp);
								});
							});
						});
					});
					onBeforeUnmount(() => {
						if (idleId) cancelIdleCallback(idleId);
						unobserve?.();
						unobserve = null;
					});
				}
			}
			if (import.meta.dev && import.meta.server && !props.custom) checkNuxtLinkNesting();
			return () => {
				const target = props.target || null;
				checkPropConflicts(props, "noRel", "rel");
				const rel = firstNonUndefined(props.noRel ? "" : props.rel, options.externalRelAttribute, isAbsoluteUrl.value || hasTarget.value ? "noopener noreferrer" : "") || null;
				const getCustomSlotProps = (routerLinkSlotProps) => ({
					navigate,
					get route() {
						if (!href.value) return;
						const url = new URL(href.value, import.meta.client ? window.location.href : "http://localhost");
						return {
							path: url.pathname,
							fullPath: url.pathname,
							get query() {
								return parseQuery(url.search);
							},
							hash: url.hash,
							params: {},
							name: void 0,
							matched: [],
							redirectedFrom: void 0,
							meta: {},
							href: href.value
						};
					},
					rel,
					target,
					isExternal: isExternal.value || hasTarget.value,
					isActive: false,
					isExactActive: false,
					...routerLinkSlotProps,
					href: typeof routerLinkSlotProps?.href === "string" ? sanitizeAnchorHref(routerLinkSlotProps.href) : href.value,
					prefetch,
					prefetched: prefetched.value,
					shouldPrefetch
				});
				if (!isExternal.value && !hasTarget.value && !isHashLinkWithoutHashMode(to.value)) {
					const routerLinkProps = {
						ref: elRef,
						to: to.value,
						activeClass: props.activeClass || options.activeClass,
						exactActiveClass: props.exactActiveClass || options.exactActiveClass,
						replace: props.replace,
						ariaCurrentValue: props.ariaCurrentValue,
						custom: props.custom
					};
					if (!props.custom) {
						if (import.meta.client) {
							if ((prefetchOn("interaction") || prefetched.value) && prefetchAllowed()) {
								routerLinkProps.onPointerenter = escalate;
								routerLinkProps.onFocus = escalate;
								routerLinkProps.onPointerdown = escalate;
							}
							if (prefetched.value) routerLinkProps.class = props.prefetchedClass || options.prefetchedClass;
						}
						routerLinkProps.rel = props.rel || void 0;
						if (import.meta.server && componentIslands && useNuxtApp().ssrContext?.islandContext) {
							const flags = [];
							if (props.replace) flags.push("replace");
							if ((typeof props.prefetchOn === "string" ? props.prefetchOn === "visibility" : props.prefetchOn?.visibility ?? options.prefetchOn?.visibility) && (props.prefetch ?? options.prefetch) !== false && props.noPrefetch !== true) flags.push("prefetch");
							routerLinkProps["data-internal"] = flags.join(" ");
						}
					}
					return h(routerLinkComponent, routerLinkProps, props.custom && slots.default ? { default: (slotProps) => slots.default(getCustomSlotProps(slotProps)) } : slots.default);
				}
				if (props.custom) {
					if (!slots.default) return null;
					return slots.default(getCustomSlotProps());
				}
				return h("a", {
					ref: el,
					href: href.value || null,
					rel,
					target,
					onClick: async (event) => {
						if (isExternal.value || hasTarget.value) return;
						event.preventDefault();
						try {
							const encodedHref = encodeRoutePath(href.value ?? "");
							return await (props.replace ? router.replace(encodedHref) : router.push(encodedHref));
						} finally {
							if (import.meta.client && isHashLinkWithoutHashMode(to.value)) {
								const rawHash = to.value.slice(1);
								let hash = rawHash;
								try {
									hash = decodeURIComponent(rawHash);
								} catch {}
								document.getElementById(hash)?.focus();
							}
						}
					}
				}, slots.default?.());
			};
		}
	});
}
const NuxtLink = /* @__PURE__ */ defineNuxtLink(nuxtLinkDefaults);
function isSameRouteRecord(a, b) {
	return (a.aliasOf || a) === (b.aliasOf || b);
}
function getOriginalPath(record) {
	return record ? record.aliasOf ? record.aliasOf.path : record.path : "";
}
function isEquivalentArray(a, b) {
	return Array.isArray(b) ? a.length === b.length && a.every((value, i) => value === b[i]) : a.length === 1 && a[0] === b;
}
function isSameParamValue(a, b) {
	return Array.isArray(a) ? isEquivalentArray(a, b) : Array.isArray(b) ? isEquivalentArray(b, a) : (a && a.valueOf()) === (b && b.valueOf());
}
function isSameRouteLocationParams(a, b) {
	if (Object.keys(a).length !== Object.keys(b).length) return false;
	for (const key in a) if (!isSameParamValue(a[key], b[key])) return false;
	return true;
}
function includesParams(outer, inner) {
	for (const key in inner) {
		const innerValue = inner[key];
		const outerValue = outer[key];
		if (typeof innerValue === "string") {
			if (innerValue !== outerValue) return false;
		} else if (!Array.isArray(outerValue) || outerValue.length !== innerValue.length || innerValue.some((value, i) => value.valueOf() !== outerValue[i].valueOf())) return false;
	}
	return true;
}
function activeRecordIndex(route, currentRoute) {
	const { matched } = route;
	const { length } = matched;
	const routeMatched = matched[length - 1];
	const currentMatched = currentRoute.matched;
	if (!routeMatched || !currentMatched.length) return -1;
	const index = currentMatched.findIndex(isSameRouteRecord.bind(null, routeMatched));
	if (index > -1) return index;
	const parentRecordPath = getOriginalPath(matched[length - 2]);
	return length > 1 && getOriginalPath(routeMatched) === parentRecordPath && currentMatched[currentMatched.length - 1].path !== parentRecordPath ? currentMatched.findIndex(isSameRouteRecord.bind(null, matched[length - 2])) : index;
}
/** Resolve an active-link class, falling back from the per-link value to the router-wide one. */
function getLinkClass(propClass, globalClass, defaultClass) {
	return propClass ?? globalClass ?? defaultClass;
}
function applyTrailingSlashBehavior(to, trailingSlash) {
	if (trailingSlash !== "append" && trailingSlash !== "remove") return to;
	const normalizeFn = trailingSlash === "append" ? withTrailingSlash : withoutTrailingSlash;
	if (hasProtocol(to) && !to.startsWith("http")) return to;
	return normalizeFn(to, true);
}
/** @internal */
function useObserver() {
	if (import.meta.server) return;
	const nuxtApp = useNuxtApp();
	if (nuxtApp._observer) return nuxtApp._observer;
	let observer = null;
	const callbacks = /* @__PURE__ */ new Map();
	const observe = (element, callback) => {
		observer ||= new IntersectionObserver((entries) => {
			for (const entry of entries) {
				const callback = callbacks.get(entry.target);
				if ((entry.isIntersecting || entry.intersectionRatio > 0) && callback) callback();
			}
		});
		callbacks.set(element, callback);
		observer.observe(element);
		return () => {
			callbacks.delete(element);
			observer?.unobserve(element);
			if (callbacks.size === 0) {
				observer?.disconnect();
				observer = null;
			}
		};
	};
	return nuxtApp._observer = { observe };
}
//#endregion
export { NuxtLink as default, defineNuxtLink, useObserver };
