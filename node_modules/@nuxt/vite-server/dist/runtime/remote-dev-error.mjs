//#region src/runtime/remote-dev-error.ts
const REMOTE_DEV_ERROR_EVENT = "nuxt:vite-server:dev-error";
const REMOTE_DEV_ERROR_REPORT_EVENT = "nuxt:vite-server:dev-error:report";
const REMOTE_DEV_ERROR_CLEAR_EVENT = "nuxt:vite-server:dev-error:clear";
function deserializeError(serialized) {
	if (!serialized || typeof serialized !== "object") return serialized;
	const { cause, ...properties } = serialized;
	return Object.assign(new Error(serialized.message, cause === void 0 ? void 0 : { cause: deserializeError(cause) }), properties);
}
//#endregion
export { REMOTE_DEV_ERROR_CLEAR_EVENT, REMOTE_DEV_ERROR_EVENT, REMOTE_DEV_ERROR_REPORT_EVENT, deserializeError };
