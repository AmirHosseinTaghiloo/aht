//#region src/runtime/server/renderer/runtime.ts
/** The event to pass to application code and to the render hooks. */
function appEvent(event) {
	return event["~app"] ?? event;
}
function getRequestState(event) {
	return event.context.nuxt;
}
/**
* Ask the server runtime to prerender `paths` alongside the route being rendered. What the
* runtime does with them is its own concern; a runtime that does not prerender ignores them.
*/
function addPrerenderRoutes(event, ...paths) {
	const context = event.context;
	const state = context.nuxt ||= {};
	state.prerenderRoutes ||= [];
	state.prerenderRoutes.push(...paths);
}
//#endregion
export { addPrerenderRoutes, appEvent, getRequestState };
