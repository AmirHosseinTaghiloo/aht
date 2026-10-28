//#region src/runtime/event.ts
/**
* The request event the renderer reads, described in web standards only: a platform
* `Request`, its URL, a mutable response to influence, and a context the app layer stores
* per-request state in.
*/
function createRequestEvent(request) {
	return {
		req: request,
		url: new URL(request.url),
		res: { headers: new Headers() },
		context: {}
	};
}
//#endregion
export { createRequestEvent };
