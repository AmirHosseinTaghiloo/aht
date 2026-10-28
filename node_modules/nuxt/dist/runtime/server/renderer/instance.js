import { createBuildFiles } from "./build-files.js";
//#region src/runtime/server/renderer/instance.ts
/**
* Create the renderer state for a set of options.
*
* Called by `createNuxtRenderer()`; call it directly only to render against the same
* artifacts as a renderer created elsewhere (an island handler sharing the server bundle
* loaded for page renders), and pass the result to `createNuxtRenderer()`.
*/
function createRendererInstance(options) {
	return {
		options,
		...createBuildFiles(options)
	};
}
//#endregion
export { createRendererInstance };
