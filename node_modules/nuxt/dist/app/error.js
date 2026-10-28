import { createError as createError$1 } from "@nuxt/nitro-server/h3";
//#region src/app/error.ts
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
/**
* Wrap whatever the app threw, remembering in development the thrown value and where the
* app was, for the error report. Outside development this is {@link createError}, so the
* wrapper leaves no trace in a production bundle.
*
* @internal
*/
const createErrorFromThrown = import.meta.dev ? function createErrorFromThrown(thrown, context) {
	const error = createError(thrown);
	if (error !== thrown && !(thrown instanceof Error)) Object.defineProperty(error, THROWN_VALUE, {
		value: thrown,
		configurable: true
	});
	if (context && (context.instance || context.route) && !(THROWN_CONTEXT in error)) Object.defineProperty(error, THROWN_CONTEXT, {
		value: context,
		configurable: true
	});
	return error;
} : createError;
//#endregion
export { NUXT_ERROR_SIGNATURE, THROWN_CONTEXT, THROWN_VALUE, createError, createErrorFromThrown, isNuxtError };
