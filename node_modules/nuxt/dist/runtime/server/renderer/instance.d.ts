import { NuxtRendererOptions } from "./runtime.js";
import { BuildFiles } from "./build-files.js";
//#region src/runtime/server/renderer/instance.d.ts
/**
 * A renderer created for one set of {@link NuxtRendererOptions}, owning every piece of
 * state a render reads. Nothing is held at module scope, so several renderers can coexist
 * in one bundle.
 */
export interface NuxtRendererInstance extends BuildFiles {
  /** The capabilities the surrounding server runtime provided. */
  readonly options: NuxtRendererOptions;
}
/**
 * Create the renderer state for a set of options.
 *
 * Called by `createNuxtRenderer()`; call it directly only to render against the same
 * artifacts as a renderer created elsewhere (an island handler sharing the server bundle
 * loaded for page renders), and pass the result to `createNuxtRenderer()`.
 */
export declare function createRendererInstance(options: NuxtRendererOptions): NuxtRendererInstance;
//#endregion