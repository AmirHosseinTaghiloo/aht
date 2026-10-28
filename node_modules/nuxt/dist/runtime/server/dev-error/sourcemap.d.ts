import { TraceMap, TraceMap as TraceMap$1 } from "@jridgewell/trace-mapping";
//#region src/runtime/server/dev-error/sourcemap.d.ts
/** A position in a file, 1-based in both line and column as in a stack frame. */
export interface SourcePosition {
  file: string;
  line: number;
  column: number;
}
/**
 * The map of `id`, traced once and kept for as long as its owner holds the raw map.
 * `version` and `names` are filled in for producers that leave them off.
 */
export declare function traceMapFor(map: object, id: string): TraceMap$1;
/** Name of `file` among the map's sources, which are resolved against the module id. */
export declare function resolveSource(trace: TraceMap$1, file: string): string | undefined;
/** Source position a position in the generated code came from. */
export declare function originalPosition(trace: TraceMap$1, line: number, column: number): SourcePosition | undefined;
/**
 * Position in the generated code a source position was mapped from. The innermost mapping
 * at or before the column wins; without a column, the first mapping on the line does.
 */
export declare function generatedPosition(trace: TraceMap$1, source: string, line: number, column?: number): {
  line: number;
  column: number;
} | undefined;
//#endregion
export type { TraceMap };