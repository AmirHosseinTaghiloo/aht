//#region src/runtime/server/renderer/headers.d.ts
/**
 * Layer `overlay` onto `base`, appending `set-cookie` values `base` lacks.
 *
 * @internal
 */
export declare function mergeHeaders(base: Headers, overlay: Headers): Headers;
//#endregion