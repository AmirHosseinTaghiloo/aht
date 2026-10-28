//#region src/runtime/server/renderer/cache.d.ts
export declare function lazyCachedFunction<T>(fn: () => Promise<T>): () => Promise<T>;
//#endregion