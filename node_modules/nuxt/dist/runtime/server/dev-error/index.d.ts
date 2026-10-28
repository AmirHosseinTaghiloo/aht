import { BuildProgress, Channel, LogEntry } from "my-bad/channel";
import { ErrorReport, SourceLoader } from "my-bad";
import { SerializedErrorCause, SerializedErrorCause as SerializedErrorCause$1 } from "#app/types";
//#region src/runtime/server/dev-error/index.d.ts
/** Base path the dev server owning the channel serves it at. */
export declare const ERROR_CHANNEL_ENV = "NUXT_DEV_ERROR_CHANNEL";
/** `BroadcastChannel` name reports are forwarded on. */
export declare const ERROR_CHANNEL_BROADCAST = "nuxt:dev:error";
/** Pairs a report with the request it came from. */
export declare const REQUEST_ID_HEADER = "x-nuxt-dev-request-id";
export type ErrorChannelMessage = {
  type: 'nuxt:dev:error:report';
  report: ErrorReport;
  requestId?: string;
  /** The request that failed, as `METHOD /path`. */
  request?: string;
} | {
  type: 'nuxt:dev:error:clear';
  id?: string;
} |
/** Asks reporters to repeat their current report. */
{
  type: 'nuxt:dev:error:sync';
} | {
  type: 'nuxt:dev:error:log';
  entry: LogEntry;
} | {
  type: 'nuxt:dev:error:warning';
  report: ErrorReport;
} | {
  type: 'nuxt:dev:error:progress';
  progress: BuildProgress;
};
/**
 * Whether reports are forwarded to a dev server in front rather than served from here.
 * Read when the channel is first used, not when this module loads.
 */
export declare function setErrorChannelForwarding(forward: () => boolean): void;
/** The live error channel, forwarding to the dev server in front when there is one. */
export declare function useErrorChannel(): Promise<Channel>;
type ErrorBroadcast = Pick<BroadcastChannel, 'onmessage' | 'postMessage' | 'close'>;
/** The `BroadcastChannel` reports travel between threads on, which must not hold the process open. It drops every message where none can be opened. */
export declare function openErrorBroadcast(): ErrorBroadcast;
/** The request a report is about. */
export interface ErrorRequestInfo {
  method: string;
  url: URL;
  headers: Headers;
}
/** Publish a report as the current error, paired with the request it came from. */
export declare function publishErrorReport(report: ErrorReport, request?: ErrorRequestInfo): Promise<void>;
/** Retire the current report, dismissing overlays showing it. */
export declare function clearErrorReport(): Promise<void>;
/** Stream a log entry to connected error pages and overlays. */
export declare function publishDevLog(entry: Omit<LogEntry, 'timestamp'> & {
  timestamp?: number;
}): Promise<void>;
/** Report build progress. A `percent` of 100 retires the progress bar. */
export declare function publishDevProgress(progress: BuildProgress): Promise<void>;
/** The component instance and route the app recorded on `error` when it threw. */
export declare function thrownContext(error: unknown): {
  instance?: unknown;
  route?: unknown;
};
export interface ErrorReportOptions {
  /** Project root, which report paths are relative to. */
  cwd: string;
  /** Loaders resolving a frame to its source. A filesystem fallback is added last. */
  loaders?: SourceLoader[];
  /** Context the report's presets read. */
  context?: Record<string, unknown>;
}
/**
 * Build a report for an error raised while rendering. Must run before anything rewrites
 * `error.stack`, as frames are mapped by the loaders rather than read off the stack.
 */
export declare function createErrorReport(error: unknown, options: ErrorReportOptions): Promise<ErrorReport>;
/** What the builder provides so errors raised while it serves the app can be reported. */
export interface DevErrorReporterOptions<E> {
  /** Project root, which report paths are relative to. */
  cwd: string;
  /** Base path the live channel is reachable at, read per report. */
  channel: () => string;
  /** Build a report for an error, mapping frames through the builder's sourcemaps. */
  createReport: (error: unknown, event?: E) => Promise<ErrorReport>;
  /** The request a report is about, as read from the builder's own event. */
  requestInfo: (event: E) => ErrorRequestInfo;
  /** Rewrite the error's stack in place with source positions, once the report is built. */
  mapStack?: (error: unknown) => void;
}
export interface DevErrorObserveOptions {
  /** The error is the app working as intended, so no report is built for it. */
  expected?: boolean;
  /** Defaults to `true`. */
  publish?: boolean;
  /** Defaults to `true`, and never prints when a dev server in front owns the channel. */
  print?: boolean;
}
export interface DevErrorReport {
  report: ErrorReport;
  /** Add the report to a page the app rendered, a click away. */
  overlay: (html: string) => Promise<string>;
  /** Render the report as a standalone page, for when the app cannot render its own. */
  page: () => Promise<string>;
}
/**
 * Build the reporter a builder hands the renderer as `onDevError`. The report is built on the
 * stack as raised, so this must run before anything rewrites it.
 */
export declare function createDevErrorReporter<E>(options: DevErrorReporterOptions<E>): (error: unknown, event?: E, observe?: DevErrorObserveOptions) => Promise<DevErrorReport | undefined>;
/**
 * Rewrite the module ids a transform failure names, and those of its causes, with
 * `resolve`. A bundler names the module it was serving, which is not always a path.
 */
export declare function resolveErrorPaths(error: unknown, resolve: (path: string) => string, seen?: Set<unknown>): void;
/** Flatten an error's `cause` chain into something the payload can carry. */
export declare function serializeErrorCause(cause: unknown, depth?: number, seen?: WeakSet<Error>): SerializedErrorCause$1 | undefined;
//#endregion
export type { SerializedErrorCause };