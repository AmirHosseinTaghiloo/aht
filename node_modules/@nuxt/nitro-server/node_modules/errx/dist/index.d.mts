//#region src/index.d.ts
export interface ParsedTrace {
  column?: number;
  function?: string;
  line?: number;
  source: string;
  /** Set when the frame is an `await` resumption point (`at async fn (...)`). */
  isAsync?: boolean;
  /** Set when the frame is a constructor call (`at new Foo (...)`). */
  isConstructor?: boolean;
  /** Set when the frame is inside evaluated code (`at eval (eval at fn (...), <anonymous>:1:1)`). */
  isEval?: boolean;
  /** Set when the frame has no resolvable source, such as `<anonymous>`, `native` or `unknown`. */
  isNative?: boolean;
  /** The original stack trace line, useful for rendering frames whose shape cannot be parsed. */
  raw?: string;
}
export declare function captureRawStackTrace(): string | undefined;
export declare function captureStackTrace(): ParsedTrace[];
/**
 * Parses the stack trace of an existing error, returning an empty array for errors
 * without a (string) stack.
 */
export declare function parseError(error: unknown): ParsedTrace[];
/**
 * Parses a stack trace produced by V8 (Node, Deno, Chromium) or JSC (Bun) into structured
 * frames.
 *
 * Lines that are recognisably frames but cannot be parsed further are returned with an
 * empty `source`, so that a consumer can still render their `raw` text.
 */
export declare function parseRawStackTrace(stacktrace: string): ParsedTrace[];
//#endregion