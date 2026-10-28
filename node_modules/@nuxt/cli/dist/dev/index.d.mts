import { AddressInfo } from "node:net";
import EventEmitter from "node:events";
import { Buffer } from "node:buffer";
import { debounce } from "perfect-debounce";
import { Server } from "node:http";
import { NuxtConfig } from "@nuxt/schema";
import "my-bad";
import "my-bad/channel";
//#region src/dev/cert.d.ts
interface HTTPSOptions {
  cert?: string;
  key?: string;
  pfx?: string;
  passphrase?: string;
  validityDays?: number;
  domains?: string[];
}
interface ResolvedCertificate {
  cert?: string;
  key?: string;
  pfx?: Buffer;
  /** Path the `pfx` buffer was read from, for reporting back to `devServer.https`. */
  pfxPath?: string;
  passphrase?: string;
  /**
   * Directory holding the local certificate authority `mkcert` issued the
   * certificate from. Node does not read the system trust store, so a client
   * running under Node needs this root passed explicitly.
   */
  caRoot?: string;
}
//#endregion
//#region src/dev/listen.d.ts
interface ListenOptions {
  port?: string | number;
  /** Fail instead of falling back to another port when `port` is unavailable. */
  strictPort?: boolean;
  /** Bind with `SO_REUSEPORT` so a successor can bind the same port before this one is released. */
  reusePort?: boolean;
  /**
   * Bind `port` as given, without checking whether it is free. Used together with
   * `reusePort` when taking over from a process that still holds the port.
   */
  handover?: boolean;
  hostname?: string;
  baseURL?: string;
  showURL?: boolean;
  open?: boolean;
  /** Path (resolved against the dev server URL) or absolute URL to open. */
  openURL?: string;
  clipboard?: boolean;
  qr?: boolean;
  tunnel?: boolean;
  public?: boolean;
  publicURL?: string;
  https?: boolean | HTTPSOptions;
}
interface ListenURL {
  url: string;
  type: "local" | "network" | "tunnel" | "public";
}
/**
 * CLI-provided listen options. `httpsEnabled` mirrors the presence of `--https`
 * so `nuxt.config` can supply the default when the flag is absent.
 */
interface DevListenOverrides extends ListenOptions {
  httpsEnabled?: boolean;
}
interface Listener {
  url: string;
  /** Explicit public URL, or the tunnel or portless URL when there is one. */
  publicURL?: string;
  /** URL the startup QR code was (or would have been) rendered for. */
  qrURL?: string;
  address: AddressInfo;
  server: Server;
  https: false | ResolvedCertificate;
  close: () => Promise<void>;
  getURLs: () => ListenURL[];
  /** Reprint the URL block, optionally flagging which URL a QR code refers to. */
  showURLs: (options?: {
    qr?: boolean;
  }) => void;
}
//#endregion
//#region src/utils/progress-snapshot.d.ts
/**
 * What a command reports about its own progress. Shared by `nuxt dev`, whose
 * loading page and TUI panel render it, and `nuxt build`, which only shows the
 * phase line, so a snapshot carries fields a given command never sets.
 */
type ProgressStatus = "loading" | "ready" | "error";
interface PendingRender {
  /** How the request reads to a user, e.g. `GET /about`. */
  label: string;
  /** When it arrived, so a consumer can tick the elapsed time itself. */
  startedAt: number;
}
interface PhaseTiming {
  phase: string;
  message: string;
  duration: number;
}
interface ProgressSnapshot {
  status: ProgressStatus;
  phase: string;
  message: string;
  index: number;
  total: number;
  progress: number;
  elapsed: number;
  /**
   * How long the current phase has been running. A phase can hold a command for
   * most of its run, so this is what tells a UI that a still label is still
   * making progress rather than stuck.
   */
  phaseElapsed: number;
  reload: boolean;
  /**
   * Whether a request has actually been answered. `status` is `ready` from the
   * moment the server is listening, so this is what tells a UI whether the app
   * can be used yet. Always true for a command that only builds.
   */
  serving: boolean;
  /**
   * The request the server is busy with, once it has been busy long enough to
   * be worth reporting. This is the only thing that happens between `ready` and
   * the first page appearing, and on a cold start it is the longest wait of the
   * whole load. Never set by a command that only builds.
   */
  pending?: PendingRender;
  timings: PhaseTiming[];
  error?: {
    name: string;
    message: string;
  };
}
//#endregion
//#region src/dev/reason.d.ts
/** Structured cause of a dev server reload or restart. */
type DevRestartReason = {
  type: "config";
  files: string[];
  keys?: string[];
} | {
  type: "dist-removed";
} | {
  type: "hook";
} | {
  type: "shortcut";
} | {
  type: "error";
  message: string;
};
//#endregion
//#region src/dev/error-channel.d.ts
/**
 * A report as it crosses to the supervisor: the rendering to show it with, plus
 * enough to summarise it on a status line. The report itself stays in the
 * channel, which serves it from `/history/<id>`.
 */
interface DevReportSummary {
  id: string;
  name: string;
  message: string;
  /** Where the topmost frame of the project's own code points, if anywhere. */
  file?: string;
  line?: number;
  /** That position as `file:line:column`, relative to the project. */
  location?: string;
  /** The request the report was raised for, shared with the logs attributed to it. */
  requestId?: string;
  /** That request as `METHOD /path`, when the app raised this while serving one. */
  request?: string;
  /** The report rendered for a terminal. */
  ansi: string;
}
//#endregion
//#region src/dev/log-channel.d.ts
interface ServerLogEvent {
  level: number;
  logType: string;
  tag?: string;
  message: string;
  /** Whether the app produced this while serving a request. */
  origin: "build" | "runtime";
  /** The request this was emitted for. */
  request?: string;
  requestId?: string;
  /** Caught on its way to the terminal rather than reported by the app. */
  raw?: boolean;
}
//#endregion
//#region src/dev/span-channel.d.ts
/** A timed piece of work the app did while serving a request. */
interface DevRequestSpan {
  requestId: string;
  /**
   * `route` and `middleware` for h3 handlers, `fetch` for an outgoing request,
   * `compile` for a module Vite compiled, and the rest for the Nuxt
   * channel of the same name.
   */
  kind: "route" | "middleware" | "fetch" | "hook" | "plugin" | "data" | "render" | "island" | "compile";
  /** What ran: a hook, plugin or data key, or `METHOD url` for a request. */
  name: string;
  /** Epoch milliseconds, fractional. */
  start: number;
  duration: number;
  status?: number;
  error?: boolean;
  /** For `compile`: the Vite environment the module was compiled for. */
  environment?: string;
  /** For `compile`: milliseconds each Vite plugin spent on the module, excluding nested calls. */
  plugins?: Record<string, number>;
  /** For `compile`: fetched while other app requests were also in flight. */
  shared?: boolean;
}
//#endregion
//#region src/dev/utils.d.ts
interface NuxtDevContext {
  cwd: string;
  /** PID of the dev server this process is taking over from, if any. */
  handoverFrom?: number;
  args: {
    clear?: boolean;
    logLevel?: string;
    dotenv?: string[];
    envName?: string;
    extends?: string[];
    profile?: string | boolean;
  };
}
/** The app's routes, plus the component that renders its errors. */
interface DevRoutes {
  routes: DevRoute[];
  /** Component rendering error responses, linked from failed requests. */
  errorComponent?: string;
}
/** A page or server route the app defines, as listed in the dev UI. */
interface DevRoute {
  kind: "page" | "server";
  route: string;
  method?: string;
  file?: string;
}
/** A request served by the dev server, as shown in the dev UI. */
interface DevRequestEvent {
  /** Identity shared with the logs attributed to this request. */
  id?: string;
  method: string;
  url: string;
  status: number;
  /** Epoch milliseconds at which the request was received, fractional. */
  start?: number;
  /** Milliseconds from receiving the request to the response closing. */
  duration: number;
  /** Served by the bundler (module graph, HMR plumbing) rather than the app. */
  internal?: boolean;
}
//#endregion
//#region src/dev/index.d.ts
/**
 * Hand an unhandled rejection to the parent process and stop this one, unless
 * it is only a client that went away. That is traffic, not a crash, and the
 * session has to survive it.
 */
export declare function createRejectionHandler(report: (message: string) => void, stop: () => void): (reason: unknown) => void;
interface InitializeOptions {
  data?: {
    overrides?: NuxtConfig;
  };
  listenOverrides?: DevListenOverrides;
  showBanner?: boolean;
  /** Feed logs and request events to the interactive dev UI. */
  captureUIEvents?: boolean;
  /**
   * Called with every startup progress snapshot, from before the first load
   * begins, so a UI can narrate startup as it happens rather than after.
   */
  onProgress?: (snapshot: ProgressSnapshot) => void;
  /**
   * Called as soon as a socket is bound, milliseconds into startup, and again
   * with `confirmed` once the resolved config has agreed with the address.
   */
  onListening?: (info: {
    url: string;
    urls: ListenURL[];
    confirmed: boolean;
  }) => void;
}
interface InitializeReturn {
  listener: Listener;
  close: () => Promise<void>;
  /** Reload Nuxt in place, keeping the current listener. */
  reload: (reason?: DevRestartReason) => Promise<void>;
  onReady: (callback: (address: string) => void) => void;
  /** Called whenever the server starts loading Nuxt (initial load and in-place reloads). */
  onLoading: (callback: (message: string) => void) => void;
  /** Called on every `ready`, unlike {@link onReady} which fires once. */
  onEachReady: (callback: () => void) => void;
  /** Called with structured logs captured from the project's consola. */
  onLog: (callback: (log: ServerLogEvent) => void) => void;
  /** Called with batches of served requests. */
  onRequests: (callback: (requests: DevRequestEvent[]) => void) => void;
  /** Called with batches of spans the app timed while serving requests. */
  onSpans: (callback: (spans: DevRequestSpan[]) => void) => void;
  /** Called with reports the app forwarded, rendered for a terminal. */
  onReport: (callback: (report: DevReportSummary) => void) => void;
  /** Called when the app reports that its error has gone. */
  onReportClear: (callback: (id?: string) => void) => void;
  /** Called when a server-side rebuild starts and finishes. */
  onBuilding: (callback: (building: boolean) => void) => void;
  /** Called whenever the app's routes are (re)discovered. */
  onRoutes: (callback: (routes: DevRoutes) => void) => void;
  /** Called the first time a watched file changes, before Nuxt reloads. */
  onFileChange: (callback: () => void) => void;
  onRestart: (callback: (reason?: DevRestartReason) => void) => void;
}
export declare function initialize(devContext: NuxtDevContext, ctx?: InitializeOptions): Promise<InitializeReturn>;
interface RestartSource {
  once: (event: "restart", handler: (reason?: DevRestartReason) => void) => void;
  off: (event: "restart", handler: (reason?: DevRestartReason) => void) => void;
}
/**
 * Connect the triggers for a hard restart (an explicit `restart` event, and
 * errors that leave this process unable to serve) to a single callback, which
 * fires at most once per arming. Re-arming after a restart that could not be
 * completed swaps the callback in without stacking another set of listeners.
 */
export declare function createRestartHook(source: RestartSource): (callback: (reason?: DevRestartReason) => void) => void;
//#endregion