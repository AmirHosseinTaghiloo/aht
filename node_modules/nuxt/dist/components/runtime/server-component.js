import { defineComponent, getCurrentInstance, h, ref } from "vue";
import { payloadExtraction } from "#build/nuxt.config.mjs";
import { $fetch } from "#build/fetch";
import { useNuxtApp } from "#app/nuxt";
import NuxtIsland from "#app/components/nuxt-island";
import { useRoute } from "#app/composables/router";
import { isPrerendered, shouldLoadPayload } from "#app/composables/payload";
import { createError, showError } from "#app/composables/error";
import { usePrefetchScheduler } from "#app/internal/prefetch-scheduler";
import { getIslandHash } from "#app/island-hash";
//#region src/components/runtime/server-component.ts
const createServerComponent = /* @__NO_SIDE_EFFECTS__ */ (name) => {
	return defineComponent({
		name,
		inheritAttrs: false,
		props: { lazy: Boolean },
		emits: ["error"],
		setup(props, { attrs, slots, expose, emit }) {
			const vm = getCurrentInstance();
			const islandRef = ref(null);
			expose({ refresh: () => islandRef.value?.refresh() });
			return () => {
				return h(NuxtIsland, {
					name,
					lazy: props.lazy,
					props: attrs,
					scopeId: vm?.vnode.scopeId,
					ref: islandRef,
					onError: (err) => {
						emit("error", err);
					}
				}, slots);
			};
		}
	});
};
const createIslandPage = /* @__NO_SIDE_EFFECTS__ */ (name, islandKey) => {
	const component = defineComponent({
		name,
		inheritAttrs: false,
		props: { lazy: Boolean },
		async setup(props, { slots, expose }) {
			const islandRef = ref(null);
			expose({ refresh: () => islandRef.value?.refresh() });
			const nuxtApp = useNuxtApp();
			const route = useRoute();
			const path = import.meta.client && await isPrerendered(route.path) ? route.path : route.fullPath.replace(/#.*$/, "");
			return () => {
				return h("div", [h(NuxtIsland, {
					name: `page_${name}`,
					lazy: props.lazy,
					ref: islandRef,
					context: { url: path },
					onError: (e) => {
						if (e instanceof Error && e.cause && e.cause instanceof Response) throw createError({
							statusText: e.cause.statusText,
							status: e.cause.status
						});
						nuxtApp.runWithContext(() => showError(e));
					}
				}, slots)]);
			};
		}
	});
	if (import.meta.server && islandKey) component.__nuxt_island = islandKey;
	if (import.meta.client) component.__nuxt_prefetch = (nuxtApp, route) => prefetchIslandPage(nuxtApp, name, route);
	return component;
};
async function prefetchIslandPage(nuxtApp, name, route) {
	const [prerendered, willLoadPayload] = await nuxtApp.runWithContext(() => Promise.all([isPrerendered(route.path), payloadExtraction ? shouldLoadPayload(route.path) : false]));
	if (willLoadPayload) return;
	const url = prerendered ? route.path : route.fullPath.replace(/#.*$/, "");
	const islandName = `page_${name}`;
	const key = `${islandName}_${getIslandHash({
		name: islandName,
		props: "{}",
		context: { url }
	})}`;
	if (nuxtApp.payload.data[key]) return;
	usePrefetchScheduler(nuxtApp).schedule({
		key: `island:${key}`,
		priority: "island",
		scope: "app",
		run: async (signal) => {
			try {
				const result = await $fetch(`/__nuxt_island/${key}.json`, {
					query: { url },
					responseType: "json",
					signal
				});
				nuxtApp.payload.data[key] ||= result;
			} catch {}
		}
	});
}
//#endregion
export { createIslandPage, createServerComponent };
