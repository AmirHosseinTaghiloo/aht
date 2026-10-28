import { lazyCachedFunction } from "./cache.js";
import { rendererDiagnostics } from "./diagnostics.js";
import { renderToString } from "vue/server-renderer";
import { propsToString } from "@unhead/vue/server";
import { NUXT_NO_SSR, appRootAttrs, appRootTag, appSpaLoaderAttrs, appSpaLoaderTag, spaLoadingTemplateOutside, spaTemplate } from "nuxt/internal/renderer-config";
import { createRenderer } from "vue-bundle-renderer/runtime";
//#region src/runtime/server/renderer/build-files.ts
const APP_ROOT_OPEN_TAG = `<${appRootTag}${propsToString(appRootAttrs)}>`;
const APP_ROOT_CLOSE_TAG = `</${appRootTag}>`;
const getServerEntry = () => import("nuxt/internal/entry").then((r) => r.default || r);
const getClientManifest = () => import("nuxt/internal/manifest").then((r) => r.default || r).then((r) => typeof r === "function" ? r() : r);
const getPrecomputedDependencies = () => import("nuxt/internal/precomputed").then((r) => "default" in r ? r.default : r).then((r) => typeof r === "function" ? r() : r);
/** Load the build artifacts for a set of renderer options, caching each of them on the returned object. */
function createBuildFiles(options) {
	const buildAssetsURL = (...path) => options.buildAssetsURL(...path);
	const getSSRRenderer = lazyCachedFunction(async () => {
		const createSSRApp = await getServerEntry();
		if (!createSSRApp) throw rendererDiagnostics.NUXT_E8004();
		const precomputed = import.meta.dev ? void 0 : await getPrecomputedDependencies();
		const renderer = createRenderer(createSSRApp, {
			precomputed,
			manifest: import.meta.dev ? await getClientManifest() : void 0,
			renderToString: renderToString$1,
			buildAssetsURL
		});
		async function renderToString$1(input, context) {
			const html = await renderToString(input, context);
			if (import.meta.dev && process.env.NUXT_VITE_NODE_OPTIONS) renderer.rendererContext.updateManifest(await getClientManifest());
			return APP_ROOT_OPEN_TAG + html + APP_ROOT_CLOSE_TAG;
		}
		return renderer;
	});
	const getSPARenderer = lazyCachedFunction(async () => {
		const precomputed = import.meta.dev ? void 0 : await getPrecomputedDependencies();
		const template = renderSPATemplate();
		const renderer = createRenderer(() => () => {}, {
			precomputed,
			manifest: import.meta.dev ? await getClientManifest() : void 0,
			renderToString: () => template,
			buildAssetsURL
		});
		const result = await renderer.renderToString({});
		const renderToString = (ssrContext) => {
			const config = ssrContext.runtimeConfig;
			ssrContext.modules ||= /* @__PURE__ */ new Set();
			ssrContext.payload.serverRendered = false;
			ssrContext.config = {
				public: config.public,
				app: config.app
			};
			return Promise.resolve(result);
		};
		return {
			rendererContext: renderer.rendererContext,
			renderToString
		};
	});
	return {
		getRenderer: (ssrContext) => NUXT_NO_SSR || ssrContext.noSSR ? getSPARenderer() : getSSRRenderer(),
		getSSRRenderer,
		getServerApp: lazyCachedFunction(getServerEntry)
	};
}
function renderSPATemplate() {
	if (spaLoadingTemplateOutside) {
		const APP_SPA_LOADER_OPEN_TAG = `<${appSpaLoaderTag}${propsToString(appSpaLoaderAttrs)}>`;
		const APP_SPA_LOADER_CLOSE_TAG = `</${appSpaLoaderTag}>`;
		return APP_ROOT_OPEN_TAG + APP_ROOT_CLOSE_TAG + (spaTemplate ? APP_SPA_LOADER_OPEN_TAG + spaTemplate + APP_SPA_LOADER_CLOSE_TAG : "");
	}
	return APP_ROOT_OPEN_TAG + spaTemplate + APP_ROOT_CLOSE_TAG;
}
const getSSRStyles = lazyCachedFunction(() => import("nuxt/internal/styles").then((r) => r.default || r));
const getInlinedCSS = lazyCachedFunction(() => import("nuxt/internal/styles").then((r) => r.inlinedCSS || {}));
//#endregion
export { APP_ROOT_CLOSE_TAG, APP_ROOT_OPEN_TAG, createBuildFiles, getInlinedCSS, getSSRStyles };
