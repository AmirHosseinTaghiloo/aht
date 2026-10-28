import { o as HistoryEntry, r as ErrorReport } from "./types-D1lJMV_Y.mjs";
import { n as Theme } from "./state-BKNiU79r.mjs";
//#region src/render/html/index.d.ts
/**
 * The client script and stylesheet that `renderPage` and `renderOverlay` inline
 * by default, for serving them yourself and passing the URLs as `assets`.
 */
declare const clientAssets: {
  script: string;
  styles: string;
};
interface ClientAssets {
  /** URL serving `clientAssets.script`. */
  script?: string;
  /** URL serving `clientAssets.styles`. */
  styles?: string;
}
interface RenderHtmlOptions {
  /** Where the error occurred, e.g. `Server` or `Client`. */
  environment?: string;
  cwd?: string;
  /**
   * Load the client script and stylesheet from these URLs instead of inlining
   * them, which keeps ~60kB out of every rendered page. Serve the contents of
   * `clientAssets` at the URLs you pass.
   */
  assets?: ClientAssets;
  /** Base path of the live channel, e.g. `/__my-bad`. */
  channel?: string;
  history?: HistoryEntry[];
  theme?: Theme;
  /** URL scheme for opening files when no `open` action is available. Default `vscode`. */
  editor?: string;
  /**
   * Embed `rawStack` in the page state. Nothing in the rendered UI reads it, and
   * it stays available over the channel at `GET {channel}/history/{id}`.
   * Default `false`.
   */
  rawStack?: boolean;
  /** Characters of the message shown before a "show full message" button. Default `1000`. */
  maxMessageLength?: number;
  /**
   * Correlation id of the request this page was rendered for. The channel then
   * only sends it errors from that request, and errors from no request at all.
   * Without it the page's path is matched against the request instead.
   */
  requestId?: string;
}
interface RenderPageOptions extends RenderHtmlOptions {
  /** Document title. Defaults to the error name and message. */
  title?: string;
  /** Raw HTML appended before `</body>`. */
  inject?: string;
  /** Extra `<head>` markup. */
  head?: string;
}
interface RenderOverlayOptions extends RenderHtmlOptions {
  /** Mount minimised regardless of the user's remembered preference, which can otherwise only mount minimised, never expanded. */
  startMinimized?: boolean;
  /** Custom element tag name. Default `my-bad-overlay`. */
  tag?: string;
}
/** Render a complete HTML document for the report. */
declare function renderPage(report: ErrorReport, options?: RenderPageOptions): string;
/**
 * Render a self-contained overlay to inject into an existing page (before `</body>`).
 * The overlay renders inside a shadow root, so host styles cannot leak in.
 */
declare function renderOverlay(report: ErrorReport, options?: RenderOverlayOptions): string;
/** Insert the overlay before `</body>`, or append it. Avoids `String.replace`, whose `$` patterns would corrupt the inlined script. */
declare function injectOverlay(html: string, report: ErrorReport, options?: RenderOverlayOptions): string;
//#endregion
export { injectOverlay as a, clientAssets as i, RenderOverlayOptions as n, renderOverlay as o, RenderPageOptions as r, renderPage as s, ClientAssets as t };