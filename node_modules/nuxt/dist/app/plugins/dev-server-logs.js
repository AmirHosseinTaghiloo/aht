import { defineNuxtPlugin } from "../nuxt.js";
import { h } from "vue";
//#region src/app/plugins/dev-server-logs.ts
const devRevivers = import.meta.server ? {} : {
	VNode: (data) => h(data.type, data.props),
	URL: (data) => new URL(data),
	Symbol: (data) => Symbol.for(data)
};
const plugin = /* @__PURE__ */ defineNuxtPlugin(async (nuxtApp) => {
	if (import.meta.test) return;
	if (import.meta.server) {
		nuxtApp.ssrContext.event.context["~payloadReducers"] = nuxtApp.ssrContext["~payloadReducers"];
		return;
	}
	if (typeof window !== "undefined") {
		const content = document.querySelector(`[data-nuxt-logs="${nuxtApp._id}"]`)?.textContent;
		if (content) {
			const { parse } = await import("devalue");
			const logs = parse(content, {
				...devRevivers,
				...nuxtApp._payloadRevivers
			});
			await nuxtApp.hooks.callHook("dev:ssr-logs", logs);
		}
	}
});
//#endregion
export { plugin as default };
