import { ViteNodeRunner } from "vite-node/client";
import { SourcePosition } from "nuxt/internal/dev-error/sourcemap";
//#region src/vite-node-runner.d.ts
declare const runner: ViteNodeRunner;
/** Transformed code of a module as it was evaluated, if the runner still holds it. */
declare function getCode(file: string): string | undefined;
/** Source position a position in the transformed code came from, 1-based as in a stack. */
declare function getOriginalPosition(file: string, line: number, column: number): SourcePosition | undefined;
/** Position in the transformed code a source position was mapped from, 1-based as in a stack. */
declare function getCompiledPosition(file: string, line: number, column?: number): SourcePosition | undefined;
/**
 * Formats a stack as V8 does, with the position of each frame in a transformed module
 * replaced by the source position its current map gives it.
 */
declare function prepareStackTrace(error: Error, callSites: NodeJS.CallSite[]): string;
interface ViteNodeErrorLocation {
  file?: string;
  line?: number;
  column?: number;
}
interface ViteNodeErrorData {
  code?: string;
  /** The compiler's own error name, when it has one. */
  name?: string;
  id?: string;
  message?: string;
  stack?: string;
  frame?: string;
  loc?: ViteNodeErrorLocation;
  plugin?: string;
  pluginCode?: string;
}
/** Error thrown when Vite fails to transform an SSR module. */
interface ViteNodeError extends Error {
  code?: string;
  frame?: string;
  id?: string;
  loc?: ViteNodeErrorLocation;
  plugin?: string;
  pluginCode?: string;
}
declare function buildViteError(errorData: ViteNodeErrorData, id: string): ViteNodeError;
//#endregion
export { getCode as a, prepareStackTrace as c, buildViteError as i, runner as l, ViteNodeErrorData as n, getCompiledPosition as o, ViteNodeErrorLocation as r, getOriginalPosition as s, ViteNodeError as t };