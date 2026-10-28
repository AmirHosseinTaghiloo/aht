import { o as HistoryEntry, r as ErrorReport } from "./types-D1lJMV_Y.mjs";
import { IncomingMessage, ServerResponse } from "node:http";
//#region src/channel/protocol.d.ts
type LogLevel = "trace" | "debug" | "info" | "log" | "warn" | "error" | "fatal";
interface LogEntry {
  level: LogLevel;
  text: string;
  timestamp: number;
}
interface BuildProgress {
  phase: string;
  percent?: number;
  message?: string;
  /**
   * Identifies the publisher of this update. The channel keeps the most recent
   * update per source and broadcasts the least advanced of them, so several
   * publishers can report independently without the bar jumping backwards.
   */
  source?: string;
}
/** The request a report came from, so a page can tell whether an error is about itself. */
interface ReportRequest {
  requestId?: string;
  /** `METHOD /path?query`. */
  request?: string;
}
type ChannelEvent = {
  type: "hello";
  payload: {
    version: string;
    actions: string[];
    current?: ErrorReport;
    history?: HistoryEntry[];
  };
} | {
  type: "error:set";
  payload: {
    report: ErrorReport;
    history: HistoryEntry[];
  } & ReportRequest;
} | {
  type: "history";
  payload: {
    history: HistoryEntry[];
  };
} | {
  type: "error:clear";
  payload: {
    id?: string;
  };
} | {
  type: "warning";
  payload: {
    report: ErrorReport;
    history: HistoryEntry[];
  };
} | {
  type: "log";
  payload: LogEntry & ReportRequest;
} | {
  type: "build";
  payload: BuildProgress;
};
declare function toHistoryEntry(report: ErrorReport): HistoryEntry;
//#endregion
//#region src/channel/open.d.ts
/**
 * Open a file in the user's editor. Uses `LAUNCH_EDITOR`, `VISUAL` or `EDITOR`
 * when set, passing the line and column for editors we know how to drive. Falls
 * back to the OS default application (via `tiny-open` if installed, otherwise
 * `open` / `rundll32` / `xdg-open`), which cannot jump to a line.
 */
declare function openInEditor(request: OpenRequest): Promise<boolean>;
//#endregion
//#region src/channel/index.d.ts
interface OpenRequest {
  file: string;
  line?: number;
  column?: number;
}
type Sink = (event: ChannelEvent) => void | Promise<void>;
interface CallerOptions {
  /**
   * Whether the caller may see reports for requests other than its own, and
   * use privileged actions such as `open`. Default `true`. An untrusted caller
   * is matched on its `/events` scope, strictly: a report naming a request id
   * needs that id, not its path.
   */
  trusted?: boolean;
}
interface ChannelOptions {
  /** Number of reports to keep. Default 20. */
  history?: number;
  /**
   * Handle "open in editor" requests. `true` uses the built-in `openInEditor`
   * (`LAUNCH_EDITOR` / `VISUAL` / `EDITOR`, falling back to the OS default app);
   * a function receives the location and may return `false` to refuse it.
   * Omit to disable the action.
   */
  open?: boolean | ((request: OpenRequest) => boolean | void | Promise<boolean | void>);
  /**
   * Directories that `open` requests are confined to. Defaults to
   * `process.cwd()`; pass `false` to accept any path, for example to open a
   * file in a dependency linked from outside the project.
   */
  root?: string | string[] | false;
  /**
   * Hosts a browser may address the channel through, besides `localhost`,
   * `*.localhost` and any IP literal. Entries starting with `.` also match
   * subdomains; `true` accepts any host. Guards against DNS rebinding.
   */
  allowedHosts?: string[] | true;
  /** Receives every event for logging, files, or agent integrations. */
  sink?: Sink;
  /** Keepalive interval in ms. Default 15000. */
  keepalive?: number;
}
interface Channel {
  /** Node-style handler. Mount at the channel base path; routes on the path suffix. */
  handler: (req: IncomingMessage, res: ServerResponse, options?: CallerOptions) => Promise<boolean>;
  /** Fetch-style handler returning `undefined` for unknown paths. */
  fetchHandler: (request: Request, options?: CallerOptions) => Promise<Response | undefined>;
  /** Publish the current error. Naming the request it came from (`requestId`, `METHOD /path?query`) sends it only to the pages that request concerns. */
  setError: (report: ErrorReport, requestId?: string, request?: string) => void;
  clearError: (id?: string) => void;
  warn: (report: ErrorReport) => void;
  /**
   * Publish a log entry. Naming the request it came from (`requestId`,
   * `METHOD /path?query`) sends it only to the pages that request concerns;
   * an unattributed entry reaches trusted callers only.
   */
  log: (entry: Omit<LogEntry, "timestamp"> & {
    timestamp?: number;
  }, requestId?: string, request?: string) => void;
  /** Publish build progress. Updates carrying a `source` are resolved against the other live sources; `percent: 100` retires one. */
  progress: (progress: BuildProgress) => void;
  readonly current: ErrorReport | undefined;
  readonly history: HistoryEntry[];
  getReport: (id: string) => ErrorReport | undefined;
  /** Number of connected clients. */
  readonly clients: number;
  close: () => void;
}
declare function createChannel(options?: ChannelOptions): Channel;
//#endregion
export { Sink as a, BuildProgress as c, LogLevel as d, ReportRequest as f, OpenRequest as i, ChannelEvent as l, Channel as n, createChannel as o, toHistoryEntry as p, ChannelOptions as r, openInEditor as s, CallerOptions as t, LogEntry as u };