import { _ as SourceLoader, a as FrameType, b as Tokenizer, c as ReportContext, d as ReportPlugin, f as ReportPreset, g as SnippetContinuation, h as Snippet, i as Frame, l as ReportKind, m as Section, n as CompiledMarker, o as HistoryEntry, p as ResolvedReportOptions, r as ErrorReport, s as Location, t as CompileErrorInput, u as ReportOptions, v as Token, x as TraceEntry, y as TokenType } from "./types-D1lJMV_Y.mjs";
import { n as Theme, t as PageState } from "./state-BKNiU79r.mjs";
import { a as injectOverlay, i as clientAssets, n as RenderOverlayOptions, o as renderOverlay, r as RenderPageOptions, s as renderPage, t as ClientAssets } from "./index-DXkgrFS3.mjs";
//#region src/loaders/decode.d.ts
interface SourceMapEntry {
  generatedLine: number;
  generatedColumn: number;
  originalSource?: string;
  originalLine?: number;
  originalColumn?: number;
}
/** `findEntry` takes 0-based positions and returns the nearest preceding segment. */
interface SourceMapLookup {
  findEntry: (line: number, column: number) => SourceMapEntry | Record<string, never>;
  /** Contents the map embeds for a source, as named by `originalSource`. */
  sourceContent?: (source: string) => string | undefined;
  /** Whether the map, or the section that names the source, lists it as ignored. */
  ignoredSource?: (source: string) => boolean;
}
//#endregion
//#region src/loaders/sourcemap.d.ts
interface RawSourceMap {
  version?: number;
  mappings: string;
  sources: (string | null)[];
  /** Original contents per entry of `sources`, used for snippets in place of reading the file. */
  sourcesContent?: (string | null)[];
  sourceRoot?: string;
  names?: string[];
  file?: string;
  /** Indices into `sources` that tooling marks as third-party or generated. */
  x_google_ignoreList?: number[];
  ignoreList?: number[];
}
/** A map made of sections, each mapping the generated code from `offset` on. */
interface RawIndexSourceMap {
  version?: number;
  file?: string;
  sections: Array<{
    offset: {
      line: number;
      column: number;
    };
    map: RawSourceMap;
  }>;
}
interface SourceMapLoaderOptions {
  /**
   * Return the raw sourcemap for a generated file, or a falsy value when the
   * file is unknown. Used to map frames from in-memory transforms (module
   * runners, `vm` evaluation) where no map is reachable from disk.
   */
  getSourceMap: (file: string) => RawSourceMap | RawIndexSourceMap | undefined | null | Promise<RawSourceMap | RawIndexSourceMap | undefined | null>;
  /** Return the generated code for a file, so the compiled snippet can be shown. */
  getCode?: (file: string) => string | undefined | null | Promise<string | undefined | null>;
  /** Read original sources from disk for snippets. Default `true`. */
  fs?: boolean;
  /**
   * Use the map's `sourcesContent` for snippets, without reading the source.
   * Pass a function to decide per resolved source path. Default `true`.
   */
  sourcesContent?: boolean | ((file: string) => boolean);
  /** Directory relative sources in the map resolve against. Defaults to the generated file's directory. */
  base?: (file: string) => string;
  /**
   * Return a token that changes when the map for `file` changes, such as mtime
   * and size for a map on disk. Maps are cached while the token is unchanged;
   * without this option `getSourceMap` is consulted on every lookup.
   */
  getVersion?: (file: string) => string | undefined | Promise<string | undefined>;
}
interface MappedPosition {
  file: string;
  line: number;
  column: number;
  /** The map flags this source as third-party or generated code. */
  ignored?: boolean;
}
/** Resolve a 1-based generated position through a map to an original file position. */
export declare function mapPosition(map: SourceMapLookup, raw: Pick<RawSourceMap, "sourceRoot" | "sources" | "x_google_ignoreList" | "ignoreList">, base: string, line: number, column: number | undefined): MappedPosition | undefined;
/**
 * Maps frames with sourcemaps supplied by the caller. Snippets come from the
 * map's `sourcesContent` where it has them, otherwise from disk.
 */
export declare function sourceMapLoader(options: SourceMapLoaderOptions): SourceLoader;
//#endregion
//#region src/loaders/fs.d.ts
interface FsLoaderOptions {
  /** Look for `<file>.map` sidecars. Default `true`. */
  sidecar?: boolean;
  /** Parse `sourceMappingURL` comments. Default `true`. */
  inline?: boolean;
  /**
   * Directories the loader may read from, maps included. Paths are canonicalised, so a symlink out of a root is denied. Unrestricted by default.
   * A map's `sourcesContent` is only shown for sources that `roots` and `canRead` allow.
   */
  roots?: string[];
  /** Further per-file check, applied after `roots`. */
  canRead?: (file: string) => boolean;
}
/**
 * Decode the `sourceMappingURL=data:` comment of a module's transformed code,
 * for module runners that expose the code but not the parsed map.
 */
export declare function parseInlineSourceMap(code: string): RawSourceMap | undefined;
/**
 * Maps frames through `.map` sidecars or `sourceMappingURL` comments and reads
 * sources from disk. Node-only.
 */
export declare function fsLoader(options?: FsLoaderOptions): SourceLoader;
//#endregion
//#region src/loaders/index.d.ts
/** Reads sources from disk without mapping, for processes started with `--enable-source-maps`. */
export declare function passthroughLoader(): SourceLoader;
//#endregion
//#region src/render/ansi/index.d.ts
interface RenderAnsiOptions {
  cwd?: string;
  /** Defaults to the terminal width, or 80. */
  width?: number;
  /** Override colour detection. */
  colors?: boolean;
  /** Override OSC 8 hyperlink detection. */
  hyperlinks?: boolean;
  /** Expand vendor/native frames and print sections. */
  verbose?: boolean;
  /** Lines of snippet context to show around the error line. Default 2. */
  snippetContext?: number;
  /** Leading `✖` / `⚠` glyph. Disable when a logger such as consola already prints a badge. Default `true`. */
  icon?: boolean;
  /** Characters of each message printed before the rest is summarised. Default `1000`. */
  maxMessageLength?: number;
}
export declare function renderAnsi(report: ErrorReport, options?: RenderAnsiOptions): string;
//#endregion
//#region src/report/create.d.ts
export declare function resolveOptions(options?: ReportOptions): ResolvedReportOptions;
/** Build a serialisable report from an error, warning, or Vite-style compile error. */
export declare function createReport(input: unknown, options?: ReportOptions): Promise<ErrorReport>;
//#endregion
//#region src/report/markdown.d.ts
interface MarkdownOptions {
  cwd?: string;
  /** Include collapsed vendor/native frames. Default `false`. */
  allFrames?: boolean;
}
/** Render a report as Markdown suitable for a GitHub issue or an agent prompt. */
export declare function toMarkdown(report: ErrorReport, options?: MarkdownOptions): string;
//#endregion
//#region src/report/serialize.d.ts
interface SerializeOptions {
  cwd?: string;
  /** Drop snippets to keep the payload small. Default `false`. */
  snippets?: boolean;
}
/** Produce a copy of the report with paths relative to `cwd`, suitable for JSON responses. */
export declare function serializeReport(report: ErrorReport, options?: SerializeOptions): ErrorReport;
//#endregion
export { type ClientAssets, CompileErrorInput, CompiledMarker, ErrorReport, Frame, FrameType, type FsLoaderOptions, HistoryEntry, Location, type MappedPosition, type MarkdownOptions, type PageState, type RawIndexSourceMap, type RawSourceMap, type RenderAnsiOptions, type RenderOverlayOptions, type RenderPageOptions, ReportContext, ReportKind, ReportOptions, ReportPlugin, ReportPreset, ResolvedReportOptions, Section, type SerializeOptions, Snippet, SnippetContinuation, SourceLoader, type SourceMapLoaderOptions, type Theme, Token, TokenType, Tokenizer, TraceEntry, clientAssets, injectOverlay, renderOverlay, renderPage };