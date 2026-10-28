//#region src/app/composables/asyncContext.d.ts
/** @since 3.8.0 */
export declare function withAsyncContext(fn: () => PromiseLike<unknown>): [unknown, () => void];
//#endregion