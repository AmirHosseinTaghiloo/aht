import { createError } from "../app/error.js";
import { getQuery, isNuxtError, readBody } from "./index.js";
//#region src/server/validate.ts
const VALIDATION_FAILED = "Validation failed";
async function validateData(data, validate, options) {
	if ("~standard" in validate) {
		const result = await validate["~standard"].validate(data);
		if (result.issues) throw createValidationError(options?.onError?.(result) || {
			message: VALIDATION_FAILED,
			issues: result.issues
		});
		return result.value;
	}
	try {
		const result = await validate(data);
		if (result === false) throw createValidationError(options?.onError?.({ issues: [{ message: VALIDATION_FAILED }] }) || { message: VALIDATION_FAILED });
		return result === true ? data : result ?? data;
	} catch (error) {
		throw createValidationError(error);
	}
}
function createValidationError(cause) {
	if (isNuxtError(cause)) return cause;
	const details = cause;
	return createError({
		cause,
		status: details?.status || 400,
		statusText: details?.statusText || VALIDATION_FAILED,
		message: details?.message || VALIDATION_FAILED,
		data: {
			issues: details?.issues,
			message: cause instanceof Error ? VALIDATION_FAILED : details?.message || VALIDATION_FAILED
		}
	});
}
function getValidatedQuery(event, validate, options) {
	return validateData(getQuery(event), validate, options);
}
async function readValidatedBody(event, validate, options) {
	return validateData(await readBody(event), validate, options);
}
//#endregion
export { getValidatedQuery, readValidatedBody };
