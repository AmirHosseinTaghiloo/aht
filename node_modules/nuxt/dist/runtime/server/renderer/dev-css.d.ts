//#region src/runtime/server/renderer/dev-css.d.ts
/**
 * Whether a dev stylesheet belongs to one of the modules a render actually used.
 *
 * The dev CSS set is the builder's whole module graph, not a per-request subset, so
 * consumers that must not leak unrelated styles (islands) narrow it with the modules
 * Vue registered during their own render.
 */
export declare function isStyleOfModule(file: string, modules: Set<string> | string[]): boolean;
//#endregion