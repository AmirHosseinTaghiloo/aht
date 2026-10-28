import { NuxtServerError } from "./renderer.mjs";
import { AsyncLocalStorage } from "node:async_hooks";
//#region src/runtime/prerender.ts
/**
* The capabilities the renderer only has while prerendering. Everything is held in memory:
* the crawler drives the handler in-process, so nothing outlives the build.
*/
function createPrerenderOptions(options = {}) {
	const payloads = /* @__PURE__ */ new Map();
	return {
		payloadCache: {
			hasItem: (key) => payloads.has(key),
			getItem: (key) => payloads.get(key),
			setItem: (key, value) => void payloads.set(key, value)
		},
		sharedDataCache: options.sharedData === false ? void 0 : createSharedDataCache(),
		wrapRender: (event, render) => {
			const renderingURL = event.url.pathname + event.url.search;
			const stack = renderingURLs.getStore();
			if (stack?.includes(renderingURL)) {
				const chain = [...stack, renderingURL].filter((url) => !url.startsWith("/__nuxt_error")).map((url) => `"${url}"`).join(" -> ");
				throw new NuxtServerError({
					status: 508,
					statusText: `Loop detected while prerendering "${renderingURL}" (${chain}). Check for \`useFetch\`/\`$fetch\` calls targeting a URL that is currently being rendered.`
				});
			}
			return renderingURLs.run([...stack || [], renderingURL], render);
		}
	};
}
/** URLs rendering in the active async context, oldest first. A repeat entry is a cycle. */
const renderingURLs = new AsyncLocalStorage();
function createSharedDataCache() {
	const resolved = /* @__PURE__ */ new Map();
	const pending = /* @__PURE__ */ new Map();
	const chains = /* @__PURE__ */ new Map();
	return {
		get(key) {
			const chain = renderingURLs.getStore();
			const setChain = chains.get(key);
			if (chain?.length && setChain?.length && setChain.some((url) => chain.includes(url))) return;
			return pending.get(key) ?? resolved.get(key);
		},
		async set(key, value) {
			pending.set(key, value);
			const chain = renderingURLs.getStore();
			if (chain?.length) chains.set(key, chain);
			try {
				resolved.set(key, Promise.resolve(await value));
			} catch {} finally {
				pending.delete(key);
				chains.delete(key);
			}
		}
	};
}
//#endregion
export { createPrerenderOptions };
