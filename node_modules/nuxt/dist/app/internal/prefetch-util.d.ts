//#region src/app/internal/prefetch-util.d.ts
/**
 * Whether the connection can afford speculative work.
 * https://developer.mozilla.org/en-US/docs/Web/API/Navigator/connection
 * @internal
 */
export declare function canPrefetch(): boolean;
/**
 * The destination a piece of prefetch work belongs to. The hash does not affect what is fetched.
 * @internal
 */
export declare function prefetchGroup(url: string): string;
//#endregion