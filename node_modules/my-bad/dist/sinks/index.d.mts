import { a as Sink } from "../index-DK5Gr1FD.mjs";
//#region src/sinks/index.d.ts
export interface FileSinkOptions {
  /** Event types to record. Default: everything except `build`. */
  types?: string[];
}
/**
 * Append channel events as JSON lines to a file, e.g. `.nuxt/my-bad.jsonl`,
 * so agents and other tools can tail the dev server's errors.
 */
export declare function fileSink(path: string, options?: FileSinkOptions): Sink;
/** Fan out to several sinks. */
export declare function combineSinks(...sinks: Sink[]): Sink;
//#endregion