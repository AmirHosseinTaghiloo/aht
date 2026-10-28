//#region src/runtime/server/server-runtime-config.ts
/**
* Runtime configuration, the one thing the portable `nuxt/server`
* implementations cannot resolve for themselves. The configured
* `server.builder` replaces this module with a re-export of
* `serverBuild.runtime.runtimeConfig`.
*
* The body below describes a bundle that did not replace it.
*/
function useRuntimeConfig() {
	return {
		app: {},
		public: {}
	};
}
//#endregion
export { useRuntimeConfig };
