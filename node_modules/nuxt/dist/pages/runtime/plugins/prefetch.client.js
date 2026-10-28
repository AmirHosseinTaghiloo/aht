import { toArray } from "../utils.js";
import { componentIslands } from "#build/nuxt.config.mjs";
import { hasProtocol } from "ufo";
import { defineNuxtPlugin } from "#app/nuxt";
import layouts from "#build/layouts";
import { namedMiddleware } from "#build/middleware";
import { useRouter } from "#app/composables/router";
import { usePrefetchScheduler } from "#app/internal/prefetch-scheduler";
import { _loadAsyncComponent } from "#app/composables/preload";
import { prefetchGroup } from "#app/internal/prefetch-util";
//#region src/pages/runtime/plugins/prefetch.client.ts
const plugin = defineNuxtPlugin({
	name: "nuxt:prefetch",
	setup(nuxtApp) {
		const router = useRouter();
		nuxtApp.hooks.hook("app:mounted", () => {
			router.beforeEach(async (to) => {
				const layout = to?.meta?.layout;
				if (typeof layout === "string" && layout in layouts) await _loadAsyncComponent(layouts[layout]);
			});
		});
		const { schedule } = usePrefetchScheduler(nuxtApp);
		nuxtApp.hooks.hook("link:prefetch", async (url) => {
			if (hasProtocol(url)) return;
			const route = router.resolve(url);
			if (!route) return;
			const layout = route.meta.layout;
			const middleware = toArray(route.meta.middleware).filter((m) => typeof m === "string");
			schedule({
				key: `route:chunks:${url}`,
				priority: "route",
				scope: "navigation",
				group: prefetchGroup(url),
				run: (signal) => {
					if (signal.aborted) return;
					const loading = [];
					for (const name of middleware) {
						const handler = namedMiddleware[name];
						if (typeof handler === "function") loading.push(handler());
					}
					if (typeof layout === "string" && layout in layouts) loading.push(_loadAsyncComponent(layouts[layout]));
					return Promise.all(loading).catch(() => {});
				}
			});
			if (componentIslands) await Promise.all(route.matched.map((record) => {
				const component = record.components?.default;
				if (typeof component !== "function") return;
				return Promise.resolve(component()).then((c) => (c?.default || c)?.__nuxt_prefetch?.(nuxtApp, route)).catch(() => {});
			}));
		});
	}
});
//#endregion
export { plugin as default };
