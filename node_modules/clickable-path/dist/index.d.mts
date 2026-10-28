//#region src/supports.d.ts
interface StreamLike {
  isTTY?: boolean;
}
/**
 * Whether hyperlinks should be emitted for `stream` (defaulting to `process.stdout`).
 *
 * Evaluated on every call: environment and TTY state can both change during the
 * lifetime of a long-running process.
 */
declare function supportsHyperlinks(stream?: StreamLike | undefined): boolean;
//#endregion
//#region src/index.d.ts
interface HyperlinkOptions {
  /** Stream whose TTY state determines whether escapes are emitted. Defaults to `process.stdout`. */
  stream?: StreamLike;
  /** Force hyperlinks on or off, bypassing terminal detection. */
  enabled?: boolean;
  /**
   * OSC 8 `id` param, letting a terminal treat separate runs of cells as one
   * hyperlink, so a label wrapped across lines highlights as a whole on hover.
   * Must not contain `;`, `:` or `=`.
   */
  id?: string;
}
interface LinkOptions extends HyperlinkOptions {
  /**
   * Builds the visible label from the absolute target and any `line`/`column`,
   * e.g. as a CLI's own alias: `absolute => absolute.replace(rootDir, '~')`.
   *
   * Defaults to the `cwd`-relative path with a `:<line>:<column>` suffix. The
   * link target is unaffected, so a label need not resemble a path at all, and
   * a label that omits the position still links to it.
   */
  formatter?: (absolute: string, line?: number, column?: number) => string;
  /** Directory used to resolve relative paths. Defaults to `process.cwd()`, read at call time. */
  cwd?: string;
  /** 1-based line number, shown as `:<line>` in the default label and linked as `#L<line>`. */
  line?: number;
  /** 1-based column number, shown and linked after the line as `:<column>`. */
  column?: number;
}
interface Linker {
  /** Link `target`, with the linker's defaults applied. */
  link: typeof link;
}
/**
 * Wrap `target` in an OSC 8 hyperlink pointing at it on disk, labelled by
 * `options.formatter` or, by default, with its `cwd`-relative path and a
 * `:<line>:<column>` suffix.
 *
 * The label is emitted byte-for-byte; only invisible escapes are added. When the
 * terminal does not support hyperlinks the label is returned on its own.
 */
declare function link(target: string, options?: LinkOptions): string;
/**
 * Wrap `label` in an OSC 8 hyperlink pointing at `url`, which is used as the
 * link target verbatim: no path resolution and no `file://` conversion.
 *
 * The label is emitted byte-for-byte, so a label that already contains colour
 * escapes is passed through untouched. When the terminal does not support
 * hyperlinks the label is returned on its own.
 */
declare function hyperlink(label: string, url: string, options?: HyperlinkOptions): string;
/**
 * Create a `link` with `defaults` pre-applied, so a CLI can configure its own
 * aliasing (`~/nuxt.config.ts`) and cwd once rather than at every call site.
 */
declare function createLinker(defaults?: LinkOptions): Linker;
//#endregion
export { HyperlinkOptions, LinkOptions, Linker, type StreamLike, createLinker, hyperlink, link, supportsHyperlinks };