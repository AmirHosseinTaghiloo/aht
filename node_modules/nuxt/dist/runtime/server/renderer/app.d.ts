import { NuxtRendererOptions, RenderedResponse, RendererEvent } from "./runtime.js";
import { NuxtPayload, NuxtSSRContext } from "#app/types";
//#region src/runtime/server/renderer/app.d.ts
export declare function createSSRContext(options: NuxtRendererOptions, event: RendererEvent): NuxtSSRContext;
/**
 * Turn the response the renderer assembled into a web-standard `Response`, carrying the
 * headers queued on the event alongside the ones the response names for itself.
 */
export declare function returnRenderResponse(options: NuxtRendererOptions, event: RendererEvent, response: RenderedResponse): Response;
export declare function setSSRError(ssrContext: NuxtSSRContext, error: NuxtPayload['error'] & {
  url: string;
}): void;
//#endregion