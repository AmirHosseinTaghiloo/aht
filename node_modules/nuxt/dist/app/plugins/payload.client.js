import { defineNuxtPlugin } from "../nuxt.js";
import { useRouter } from "../composables/router.js";
import { injectHead } from "../../head/runtime/composables.js";
import "../composables/head.js";
import { onNuxtReady } from "../composables/ready.js";
import { stateDiagnostics } from "../diagnostics/state.js";
import { canPrefetch, prefetchGroup } from "../internal/prefetch-util.js";
import { getAppManifest } from "../composables/manifest.js";
import { isCachedPayloadRoute, loadPayload } from "../composables/payload.js";
import { usePrefetchScheduler } from "../internal/prefetch-scheduler.js";
import { appManifest, prefetchPreloadTags, purgeCachedData } from "#build/nuxt.config.mjs";
import { withoutFragment } from "ufo";
//#region src/app/plugins/payload.client.ts
const forwardedHintEntries = /* @__PURE__ */ new Set();
const forwardedHintHrefs = /* @__PURE__ */ new Set();
const MAX_HINTS_PER_ROUTE = 2;
const FORWARDED_HINT_TIMEOUT_MS = 3e4;
function disposeHint(entry) {
	if (forwardedHintEntries.delete(entry)) entry.dispose();
}
function documentHrefs() {
	const hrefs = /* @__PURE__ */ new Set();
	for (const link of document.head.querySelectorAll("link[href]")) hrefs.add(link.href);
	return hrefs;
}
function selectHints(prefetchLinks) {
	const existingHrefs = documentHrefs();
	const selected = [];
	for (const link of prefetchLinks) {
		if (selected.length >= MAX_HINTS_PER_ROUTE) break;
		if (typeof link.href !== "string") continue;
		const href = new URL(link.href, window.location.href).href;
		if (existingHrefs.has(href) || forwardedHintHrefs.has(href)) continue;
		forwardedHintHrefs.add(href);
		if (link.as === "image") {
			const { fetchpriority: _fetchpriority, ...rest } = link;
			selected.push({
				href,
				link: rest
			});
		} else {
			const { rel: _rel, ...rest } = link;
			selected.push({
				href,
				link: {
					...rest,
					rel: "prefetch"
				}
			});
		}
	}
	return selected;
}
const plugin = /* @__PURE__ */ defineNuxtPlugin({
	name: "nuxt:payload",
	setup(nuxtApp) {
		const staticKeysToRemove = /* @__PURE__ */ new Set();
		const router = useRouter();
		const { schedule } = usePrefetchScheduler(nuxtApp);
		if (prefetchPreloadTags) router.afterEach(() => {
			for (const entry of [...forwardedHintEntries]) disposeHint(entry);
			forwardedHintHrefs.clear();
		});
		router.beforeResolve(async (to, from) => {
			const queryAware = isCachedPayloadRoute(to.path);
			const toURL = queryAware ? withoutFragment(to.fullPath) : to.path;
			if (toURL === (queryAware ? withoutFragment(from.fullPath) : from.path)) return;
			const payload = await loadPayload(toURL);
			if (!payload) return;
			if (purgeCachedData) for (const key of staticKeysToRemove) delete nuxtApp.static.data[key];
			for (const key in payload.data) {
				if (purgeCachedData) {
					if (!(key in nuxtApp.static.data)) staticKeysToRemove.add(key);
				}
				nuxtApp.static.data[key] = payload.data[key];
			}
		});
		const head = prefetchPreloadTags ? injectHead(nuxtApp) : null;
		const forwardHint = (link) => (signal) => new Promise((resolve) => {
			if (signal.aborted) return resolve();
			const hint = {};
			const complete = (dispose) => {
				clearTimeout(hint.timeout);
				signal.removeEventListener("abort", onAbort);
				if (dispose && hint.entry) disposeHint(hint.entry);
				resolve();
			};
			const onAbort = () => complete(true);
			signal.addEventListener("abort", onAbort);
			hint.entry = head.push({ link: [{
				...link,
				onerror: () => complete(true),
				onload: () => complete(false)
			}] });
			forwardedHintEntries.add(hint.entry);
			hint.timeout = setTimeout(() => complete(true), FORWARDED_HINT_TIMEOUT_MS);
		});
		nuxtApp.hooks.hook("link:prefetch", (url) => {
			onNuxtReady(() => {
				const { hostname } = new URL(url, window.location.href);
				if (hostname !== window.location.hostname) return;
				const group = prefetchGroup(url);
				schedule({
					key: `payload:${url}`,
					priority: "payload",
					scope: "navigation",
					group,
					run: async (signal, promoted) => {
						if (signal.aborted) return;
						const payload = await loadPayload(url, {
							signal,
							promoted
						}).catch(() => {
							stateDiagnostics.NUXT_E7003({ url });
						});
						if (signal.aborted || !head || !payload?.prefetchLinks?.length || group === prefetchGroup(router.currentRoute.value.fullPath)) return;
						schedule(selectHints(payload.prefetchLinks).map(({ href, link }) => ({
							key: `hint:${href}`,
							priority: "hint",
							scope: "navigation",
							group,
							run: forwardHint(link)
						})));
					}
				});
			});
		});
		onNuxtReady(() => {
			if (appManifest && canPrefetch()) setTimeout(getAppManifest, 1e3);
		});
	}
});
//#endregion
export { plugin as default };
