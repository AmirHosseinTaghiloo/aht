import { _ as SourceLoader, f as ReportPreset, r as ErrorReport, u as ReportOptions } from "../types-D1lJMV_Y.mjs";
import { n as Channel, r as ChannelOptions } from "../index-DK5Gr1FD.mjs";
import { n as RenderOverlayOptions, r as RenderPageOptions } from "../index-DXkgrFS3.mjs";
import { Plugin, ViteDevServer } from "vite";
//#region src/vite/loader.d.ts
interface ViteLoaderOptions {
  /** Fall back to reading files from disk. Default `true`. */
  fs?: boolean;
}
/**
 * Maps frames through Vite's module graph (SSR or client transforms). Snippets
 * come from the map's `sourcesContent`, then from disk or, for virtual modules,
 * from the transformed code.
 */
export declare function viteLoader(server: ViteDevServer, options?: ViteLoaderOptions): SourceLoader;
//#endregion
//#region src/vite/index.d.ts
export interface MyBadViteOptions {
  /** Mount the live channel and inject the overlay client. Default `true`. */
  channel?: boolean | ChannelOptions;
  /** Base path for the channel middleware. Default `/__my-bad`. */
  base?: string;
  presets?: ReportPreset[];
  report?: Omit<ReportOptions, "loaders" | "presets">;
  overlay?: Omit<RenderOverlayOptions, "channel" | "cwd">;
  /**
   * Inline the client script and stylesheet into every rendered page instead of
   * serving them as two cacheable files under `base`. Default `false`.
   */
  inlineClient?: boolean;
  /** Replace Vite's built-in error overlay for compile errors. Default `true`. */
  replaceOverlay?: boolean;
}
export interface MyBadContext {
  channel: Channel;
  base: string;
  loaders: SourceLoader[];
  /** Build a report using the Vite module graph for sourcemaps. */
  report: (error: unknown, options?: ReportOptions) => Promise<ErrorReport>;
  /** Render a full error page wired to the channel. */
  page: (report: ErrorReport, options?: RenderPageOptions) => string;
  /** Render an overlay wired to the channel. */
  overlay: (report: ErrorReport, options?: RenderOverlayOptions) => string;
  /** Report an error: stores it, notifies connected pages and in-app clients. */
  emit: (error: unknown, options?: ReportOptions) => Promise<ErrorReport>;
  clear: (id?: string) => void;
}
/** Access the my-bad context for a dev server once the plugin has configured it. */
export declare function useMyBad(server: ViteDevServer): MyBadContext | undefined;
export declare function myBad(options?: MyBadViteOptions): Plugin;
//#endregion
export type { ViteLoaderOptions };