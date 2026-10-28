import { createError as createError$1 } from "../../../nitro-server/src/h3.mjs";
//#region ../nuxt/src/app/error.ts
const NUXT_ERROR_SIGNATURE = "__nuxt_error";
/** @since 3.0.0 */
const isNuxtError = (error) => !!error && typeof error === "object" && "__nuxt_error" in error;
/** @since 3.0.0 */
const createError = (error) => {
	if (isNuxtError(error)) return error;
	if (typeof error !== "string" && error?.statusText) error.message ??= error.statusText;
	const nuxtError = createError$1(error ?? {});
	Object.defineProperty(nuxtError, NUXT_ERROR_SIGNATURE, {
		value: true,
		configurable: false,
		writable: false
	});
	Object.defineProperty(nuxtError, "status", {
		get: () => nuxtError.statusCode,
		configurable: true
	});
	Object.defineProperty(nuxtError, "statusText", {
		get: () => nuxtError.statusMessage,
		configurable: true
	});
	return nuxtError;
};
/** Set in development on an error created from a thrown value that was not an `Error`. */
const THROWN_VALUE = Symbol.for("nuxt:dev:thrown");
/** Set in development to where the app was when it threw. */
const THROWN_CONTEXT = Symbol.for("nuxt:dev:context");
import.meta.dev;
//#endregion
export { NUXT_ERROR_SIGNATURE, THROWN_CONTEXT, THROWN_VALUE, createError, isNuxtError };
