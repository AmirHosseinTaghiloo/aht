import { getCode, getCompiledPosition } from "#vite-node-runner";
//#region src/ssr-sourcemap.ts
var ssr_sourcemap_default = (nitroApp) => {
	nitroApp.ssrSourceMaps = {
		getCode,
		getCompiledPosition
	};
};
//#endregion
export { ssr_sourcemap_default as default };
