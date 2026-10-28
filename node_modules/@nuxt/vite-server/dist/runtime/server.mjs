import { joinURL } from "ufo";
import { resolveServerFetchInit } from "nuxt/internal/server-default";
//#region src/runtime/server.ts
/** The `nuxt/server` helpers backed by the build's route rules and app handler. */
function createServerHelpers(match, loadFetch, baseURL) {
	return {
		getRouteRules: (event) => match(event.url.pathname),
		matchRouteRules: (path, _method) => match(joinURL(baseURL, path)),
		serverFetch: async (event, path, init) => {
			return (await loadFetch())(new Request(new URL(joinURL(baseURL, path), event.req.url), resolveServerFetchInit(event, init)));
		}
	};
}
//#endregion
export { createServerHelpers };
