import { C as KEEPS_PROCESS_ALIVE, S as ActionableError, T as isRemotePeerError, b as writeDirect, m as blankLineBefore, p as writeNotice, s as debug, u as logger } from "../startup-clock-DXZlxuSA.mjs";
import { n as withNodePath } from "../resolve-nuxt-VKCDOC-A.mjs";
import { t as configureProjectConsola } from "../console-BgmzEcbV.mjs";
import { n as resolveDotenvFileNames } from "../args-DGaOocsH.mjs";
import { t as overrideEnv } from "../env-BkMPEX1D.mjs";
import { i as stopCpuProfile, r as startCpuProfile, t as createPhaseReporter } from "../phase-reporter-xcVDefHV.mjs";
import { a as withConfigKeys, c as openInspector, i as mergeRestartReasons, n as formatRestartReason, r as formatSkippedReload, t as formatChangedKeys } from "../reason-BzYs8eZ4.mjs";
import { t as openBroadcast } from "../broadcast-mciEtrFQ.mjs";
import { n as isLoopbackAddress, t as isAllowedHost } from "../host-check-DW342-PP.mjs";
import { n as READY_MESSAGE, t as PhaseTimeline } from "../progress-snapshot-BsUn_089.mjs";
import { n as currentRequest, r as runWithRequest, t as attachRequest } from "../serving-state-Cts7VBoa.mjs";
import { r as showBanner } from "../banner-lMLtjrKS.mjs";
import { t as clearBuildDir } from "../fs-CSqg02ri.mjs";
import { t as loadKit } from "../kit-CbhDo9Zs.mjs";
import { a as formatLockError, o as getTakeoverPid, p as updateLock, t as acquireLock } from "../lockfile-BZHfAuKg.mjs";
import { a as resolveNuxtManifest, n as loadNuxtManifest, o as writeNuxtManifest } from "../nuxt-CCjsh7BJ.mjs";
import { t as resolveServerBuild } from "../server-build-Cga7EB-K.mjs";
import { a as matchesBoundTarget, f as resolvePortlessURLs, l as resolveOpenURL, o as openBrowser, r as createListener, t as bindListener } from "../listen-BjyzPJ2X.mjs";
import process from "node:process";
import { formatWithOptions, styleText } from "node:util";
import { isCI, provider } from "std-env";
import { consola } from "consola";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolveModulePath } from "exsolve";
import { dirname, isAbsolute, join, relative, resolve } from "pathe";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, statSync, watch, writeFileSync } from "node:fs";
import defu from "defu";
import { hash } from "node:crypto";
import EventEmitter from "node:events";
import { mkdir } from "node:fs/promises";
import { Buffer as Buffer$1 } from "node:buffer";
import { debounce } from "perfect-debounce";
import { toNodeHandler } from "srvx/node";
//#region src/dev/force-tty.ts
/**
* Present a piped fork's stdio as a terminal.
*
* When the parent runs the interactive dev UI it pipes this fork's stdio so the
* panel can stay below all output. Everything that formats output (consola's
* fancy reporter, colour detection) reads `isTTY` at module load, so this must
* run first and must not import anything that loads `std-env` or `consola`.
*/
if (process.env.__NUXT_DEV_PIPED_TTY__) for (const stream of [process.stdout, process.stderr]) {
	if (stream.isTTY) continue;
	Object.defineProperty(stream, "isTTY", {
		value: true,
		configurable: true
	});
	Object.defineProperty(stream, "columns", {
		get: () => Number(process.env.__NUXT_DEV_COLUMNS__) || 80,
		configurable: true
	});
	const depth = Number(process.env.__NUXT_DEV_COLOR_DEPTH__) || forcedColorDepth();
	Object.defineProperty(stream, "getColorDepth", {
		value: () => depth,
		configurable: true
	});
	Object.defineProperty(stream, "hasColors", {
		value: (count) => depth >= 4 && (typeof count !== "number" || count <= 2 ** depth),
		configurable: true
	});
	for (const method of [
		"cursorTo",
		"moveCursor",
		"clearLine",
		"clearScreenDown"
	]) if (typeof stream[method] !== "function") Object.defineProperty(stream, method, {
		value: (...args) => {
			args.find((arg) => typeof arg === "function")?.();
			return true;
		},
		configurable: true
	});
}
/** The depth `FORCE_COLOR` asks for, read the way Node reads it. */
function forcedColorDepth() {
	switch (process.env.FORCE_COLOR?.trim().toLowerCase()) {
		case void 0:
		case "":
		case "0":
		case "false": return 1;
		case "1":
		case "true": return 4;
		case "3": return 24;
		default: return 8;
	}
}
//#endregion
//#region src/dev/progress.ts
/** Path prefix reserved for the CLI's own dev-time endpoints. */
const DEV_INTERNAL_PREFIX = "/__nuxt_dev__/";
const PROGRESS_PATH = `${DEV_INTERNAL_PREFIX}progress`;
const HEARTBEAT_INTERVAL = 15e3;
/**
* Startup phases, in the order they are reached. The index doubles as the
* progress fraction shown to clients, so the list is deliberately coarse and
* monotonic: a phase is never re-entered during a single load.
*/
const DEV_PHASES = [
	{
		id: "config",
		message: "Loading Nuxt config"
	},
	{
		id: "modules",
		message: "Setting up modules"
	},
	{
		id: "app",
		message: "Preparing app"
	},
	{
		id: "types",
		message: "Generating types"
	},
	{
		id: "bundle",
		message: "Bundling app"
	},
	{
		id: "server",
		message: "Building server"
	},
	{
		id: "ready",
		message: READY_MESSAGE
	}
];
/**
* Fraction reserved for the first render. `nuxt:ready` means the server can
* accept a request, not answer one, and compiling the first document is the
* longest single wait on a large project.
*/
const READY_PROGRESS = .95;
/** Shown between the server accepting requests and it answering one. */
const WARMUP_MESSAGE = "Compiling the first request";
/**
* How long a request has to be in flight before it is reported. A page a dev
* server has already compiled is answered in milliseconds, and a status line
* that appears and disappears within a frame is noise.
*/
const REQUEST_DWELL = 400;
const HOOK_PHASES = {
	"modules:before": "modules",
	"builder:generateApp": "app",
	"prepare:types": "types",
	"build:before": "bundle",
	"vite:serverCreated": "bundle",
	"webpack:compile": "bundle",
	"nitro:build:before": "server"
};
/** Index of the phase a module count belongs to. */
const MODULES_INDEX = DEV_PHASES.findIndex((phase) => phase.id === "modules");
/**
* Both carry a `name` that is always renderable. A Nuxt without them shows
* the phase label, as before.
*/
const MODULE_STARTED = "module:before";
const MODULE_FINISHED = "module:done";
/**
* Nitro builds the server on its own hooks, which Nuxt's never see, so this is
* the only way the server phase says anything. The prefix keeps a name like
* `rollup:before` from reading as if Nuxt were the one busy.
*/
const NITRO_HOOK = "nitro:init";
const NITRO_PREFIX = "nitro:";
/**
* How long a module has to stay busy before it is named. Most install in a few
* milliseconds, and a label flickering through dozens of names a second is
* worse than a still one, especially as a browser tab title.
*/
const MODULE_DWELL = 150;
/**
* How long any other hook has to run before it is named, set where a hook has
* stopped being a step of the build and started being the reason for the wait.
* Nuxt calls thousands of them, nearly all sub-millisecond.
*/
const HOOK_DWELL = 1e3;
/**
* How long a single phase has to run before the dwells above are dropped to
* {@link IMPATIENT_MODULE_DWELL} and {@link IMPATIENT_HOOK_DWELL}. A phase this
* far in has stopped being described by its own label, so anything concrete is
* better than a still one, flicker included.
*/
const PHASE_PATIENCE = 3e3;
const IMPATIENT_MODULE_DWELL = 50;
const IMPATIENT_HOOK_DWELL = 150;
/** How often the narration looks at what is currently running. */
const NARRATION_INTERVAL = 250;
/** Friendlier wording for hooks whose raw name would not explain the wait. */
const HOOK_LABELS = {
	"devtools:before": "Setting up Nuxt DevTools",
	"modules:done": "Finishing module setup",
	"app:resolve": "Resolving the app",
	"app:templates": "Collecting app templates",
	"app:templatesGenerated": "Writing app templates",
	"pages:extend": "Scanning pages",
	"pages:resolved": "Resolving pages",
	"components:dirs": "Scanning component directories",
	"components:extend": "Resolving components",
	"imports:extend": "Resolving auto-imports",
	"imports:sources": "Collecting auto-imports",
	"schema:extend": "Extending the config schema",
	"schema:resolved": "Resolving the config schema",
	"nitro:prepare:types": "Generating server types",
	"nitro:config": "Configuring the server",
	"nitro:init": "Starting the server build",
	"nitro:rollup:before": "Bundling the server",
	"nitro:compiled": "Finishing the server build",
	"nitro:dev:reload": "Reloading the server",
	"nitro:types:extend": "Generating server types",
	"vite:extendConfig": "Configuring Vite",
	"vite:configResolved": "Configuring Vite",
	"vite:serverCreated": "Starting Vite",
	"webpack:config": "Configuring webpack"
};
/**
* Hook namespaces owned by Nuxt, Nitro or a bundler. A name in one of these is
* an implementation detail: it is narrated only through {@link HOOK_LABELS},
* because the raw name describes the build's internals rather than the wait.
* Anything else was named by the project or one of its modules, and reads as
* something its author would recognise.
*/
const INTERNAL_HOOK_NAMESPACES = /* @__PURE__ */ new Set([
	"app",
	"build",
	"builder",
	"components",
	"devtools",
	"imports",
	"kit",
	"modules",
	"module",
	"nitro",
	"pages",
	"prepare",
	"schema",
	"vite",
	"webpack",
	"rspack"
]);
/**
* The label for a hook that has been running long enough to be the reason for
* the wait, or nothing where its name would say less than the phase it is in.
*/
function hookLabel(name) {
	const label = HOOK_LABELS[name];
	if (label) return label;
	return INTERNAL_HOOK_NAMESPACES.has(name.split(":")[0]) ? void 0 : `Running ${name}`;
}
/**
* Past this depth the stack is dropped rather than grown, so a hook that
* never settles cannot retain an entry for the rest of the load.
*/
const HOOK_STACK_LIMIT = 64;
/** Module names share their line with the status badge, and paths get long. */
const MODULE_NAME_LIMIT = 32;
/**
* Local modules keep only their basename; package specifiers, scope included,
* are left alone.
*/
function shortenModuleName(name) {
	const short = name.startsWith("@") || !/[\\/]/.test(name) ? name : name.split(/[\\/]/).pop().replace(/\.[cm]?[jt]sx?$/, "");
	return short.length > MODULE_NAME_LIMIT ? `${short.slice(0, 31)}\u2026` : short;
}
function moduleName(module) {
	const name = module?.name;
	return typeof name === "string" && name ? name : void 0;
}
/**
* Tracks how far a `nuxt dev` load has got and fans that out to the terminal
* reporter and to any loading pages connected over SSE.
*/
var DevProgress = class extends PhaseTimeline {
	#clients = /* @__PURE__ */ new Set();
	#heartbeat;
	#message = DEV_PHASES[0].message;
	#status = "loading";
	#error;
	#reload = false;
	#baseMessage = DEV_PHASES[0].message;
	#module;
	#hooks = [];
	#narrating = false;
	#serving = false;
	#inflight = /* @__PURE__ */ new Map();
	#pending;
	#dwell;
	#nextRequest = 0;
	#observing = false;
	#installedModules;
	#observed = /* @__PURE__ */ new WeakSet();
	#ticker;
	constructor() {
		super(DEV_PHASES);
	}
	get snapshot() {
		const snapshot = super.snapshot;
		return {
			...snapshot,
			status: this.#status,
			message: this.#message,
			progress: this.#status === "ready" ? this.#serving ? 1 : READY_PROGRESS : snapshot.progress,
			reload: this.#reload,
			serving: this.#serving,
			pending: this.#pending,
			error: this.#error && {
				name: this.#error.name,
				message: this.#error.message
			}
		};
	}
	start(message, reload = false) {
		this.#hooks = [];
		this.#module = void 0;
		this.#narrating = false;
		if (this.#observing) this.#startNarrating();
		this.restart();
		this.#status = "loading";
		this.#error = void 0;
		this.#reload = reload;
		this.#serving = false;
		this.#clearPending();
		this.#baseMessage = message || DEV_PHASES[0].message;
		this.#message = this.#baseMessage;
		this.#emit();
	}
	setMessage(message) {
		if (this.#status === "error") return;
		this.#message = message;
		this.#emit();
	}
	setPhase(id, message) {
		this.#advance(id, message, true);
	}
	setReady() {
		if (this.#status === "ready") return;
		this.#stopNarrating();
		this.#advance("ready", void 0, false);
		this.#status = "ready";
		this.#error = void 0;
		if (this.#clients.size > 0 || this.#pending || this.#inflight.size > 0) this.#message = WARMUP_MESSAGE;
		this.#emit();
	}
	/**
	* Record a request the app is now rendering, returning the handle to settle
	* it with. Reported only once it has been in flight for {@link REQUEST_DWELL},
	* so a page that is already compiled passes without comment.
	*/
	startRequest(label) {
		const id = ++this.#nextRequest;
		this.#inflight.set(id, {
			label,
			startedAt: Date.now()
		});
		this.#scheduleDwell();
		return id;
	}
	/** Settle the request {@link startRequest} handed back. */
	finishRequest(id) {
		const request = this.#inflight.get(id);
		if (!request) return;
		this.#inflight.delete(id);
		if (this.#pending !== request) return;
		this.#pending = this.#oldest(Date.now() - REQUEST_DWELL);
		this.#scheduleDwell();
		this.#emit();
	}
	/** The oldest request in flight since before `since`, if any. */
	#oldest(since) {
		let oldest;
		for (const request of this.#inflight.values()) if (request.startedAt <= since && (!oldest || request.startedAt < oldest.startedAt)) oldest = request;
		return oldest;
	}
	/** Report the oldest request in flight once it has dwelt long enough. */
	#scheduleDwell() {
		if (this.#dwell || this.#pending) return;
		let next;
		for (const { startedAt } of this.#inflight.values()) next = next === void 0 ? startedAt : Math.min(next, startedAt);
		if (next === void 0) return;
		this.#dwell = setTimeout(() => {
			this.#dwell = void 0;
			this.#pending = this.#oldest(Date.now() - REQUEST_DWELL);
			if (this.#pending) this.#emit();
			this.#scheduleDwell();
		}, Math.max(0, next + REQUEST_DWELL - Date.now()));
		this.#dwell.unref?.();
	}
	#clearPending() {
		clearTimeout(this.#dwell);
		this.#dwell = void 0;
		this.#pending = void 0;
		this.#inflight.clear();
	}
	/** The app has answered a request, so the wait is genuinely over. */
	setServing() {
		if (this.#serving || this.#status !== "ready") return;
		this.#serving = true;
		this.#message = READY_MESSAGE;
		this.#emit();
	}
	#advance(id, message, emit) {
		if (this.#status === "error") return;
		const advanced = this.enter(id);
		if (advanced === void 0) return;
		if (advanced) this.#module = void 0;
		const next = message || DEV_PHASES[this.index].message;
		if (!advanced && next === this.#baseMessage) return;
		this.#baseMessage = next;
		this.#message = next;
		this.#narrating = false;
		if (emit) this.#emit();
	}
	/**
	* Replace the phase label with whatever the load is actually waiting on, or
	* put the phase label back once it is waiting on nothing in particular. The
	* phase index is untouched, so the fraction clients render stays monotonic.
	*/
	#narrate() {
		if (this.#status !== "loading") return;
		const now = Date.now();
		const impatient = now - this.phaseStartedAt >= PHASE_PATIENCE;
		let text;
		if (this.#module && now - this.#module.at >= (impatient ? IMPATIENT_MODULE_DWELL : MODULE_DWELL)) text = `Setting up ${shortenModuleName(this.#module.name)}`;
		else for (let index = this.#hooks.length - 1; index >= 0; index--) {
			const hook = this.#hooks[index];
			if (hook.at < this.phaseStartedAt) break;
			if (now - hook.at < (impatient ? IMPATIENT_HOOK_DWELL : HOOK_DWELL)) continue;
			if (!HOOK_PHASES[hook.name]) text = hookLabel(hook.name);
			break;
		}
		if (!text && impatient && this.index === MODULES_INDEX) {
			const installed = this.#installedModules?.() ?? 0;
			if (installed) text = `${this.#baseMessage} \u00B7 ${installed} installed`;
		}
		if (!text && !this.#narrating) return;
		this.#narrating = !!text;
		const next = text ?? this.#baseMessage;
		if (next !== this.#message) {
			this.#message = next;
			this.#emit();
		}
	}
	#startNarrating() {
		if (this.#ticker) return;
		this.#ticker = setInterval(() => this.#narrate(), NARRATION_INTERVAL);
		this.#ticker.unref?.();
	}
	#stopNarrating() {
		clearInterval(this.#ticker);
		this.#ticker = void 0;
		this.#hooks = [];
		this.#module = void 0;
	}
	/**
	* Record a hook as running. Hooks nest, but they also run concurrently, so
	* this is a stack only by convention: a hook that finishes out of order is
	* removed from wherever it sits. An entry whose hook never completes would
	* otherwise sit at the bottom of the stack for the rest of the load, so the
	* oldest is dropped once the stack stops looking like one.
	*/
	#pushHook(name) {
		if (this.#hooks.length >= HOOK_STACK_LIMIT) this.#hooks.shift();
		this.#hooks.push({
			name,
			at: Date.now()
		});
	}
	#popHook(name) {
		const last = this.#hooks.length - 1;
		if (last >= 0 && this.#hooks[last].name === name) {
			this.#hooks.length = last;
			return;
		}
		for (let index = last; index >= 0; index--) if (this.#hooks[index].name === name) {
			this.#hooks.splice(index, 1);
			return;
		}
	}
	setError(error) {
		this.#stopNarrating();
		this.#error = error;
		this.#status = "error";
		this.#message = error.message || "Nuxt failed to start.";
		this.#emit();
	}
	/**
	* Derive phases from the hooks Nuxt calls, so the granularity follows the
	* project's own build rather than a schedule guessed by the CLI, and name
	* whatever is taking long enough that the phase alone stops explaining the
	* wait. Both the modules a project installs and the hooks its own code
	* registers are only visible from here.
	*/
	attachNuxt(hooks, options = {}) {
		this.#installedModules ||= options.installedModules;
		if (this.#observed.has(hooks)) return;
		const timed = !!(hooks.beforeEach && hooks.afterEach);
		hooks.beforeEach?.(({ name, args }) => {
			if (timed) this.#pushHook(name);
			const phase = HOOK_PHASES[name];
			if (phase) this.setPhase(phase);
			else if (name === MODULE_STARTED) {
				const module = moduleName(args?.[0]);
				if (module) this.#module = {
					name: module,
					at: Date.now()
				};
			} else if (name === MODULE_FINISHED && moduleName(args?.[0]) === this.#module?.name) this.#module = void 0;
			else if (name === NITRO_HOOK) this.#observe((args?.[0])?.hooks, NITRO_PREFIX);
		});
		this.#observe(hooks, "");
	}
	/**
	* Time the hooks of one system. Entries carry the prefix they were pushed
	* with, so a name shared by two systems cannot pop the other's entry, and the
	* innermost-wins rule still holds across both: Nitro builds inside a Nuxt
	* hook that is awaiting it.
	*/
	#observe(hooks, prefix) {
		if (!hooks?.beforeEach || !hooks.afterEach || this.#observed.has(hooks)) return;
		this.#observed.add(hooks);
		if (prefix) hooks.beforeEach(({ name }) => this.#pushHook(prefix + name));
		hooks.afterEach(({ name }) => this.#popHook(prefix + name));
		this.#observing = true;
		this.#startNarrating();
	}
	handleRequest(req, res) {
		if ((req.url || "").split("?")[0] !== PROGRESS_PATH) return false;
		this.#subscribe(res);
		return true;
	}
	#subscribe(res) {
		res.statusCode = 200;
		res.setHeader("Content-Type", "text/event-stream");
		res.setHeader("Cache-Control", "no-store");
		res.setHeader("Connection", "keep-alive");
		res.setHeader("X-Accel-Buffering", "no");
		res.flushHeaders?.();
		res.write("retry: 1000\n\n");
		this.#clients.add(res);
		res.once("close", () => {
			this.#clients.delete(res);
			if (this.#clients.size === 0) {
				clearInterval(this.#heartbeat);
				this.#heartbeat = void 0;
				this.setServing();
			}
		});
		if (!this.#heartbeat) {
			this.#heartbeat = setInterval(() => {
				for (const client of this.#clients) client.write(": ping\n\n");
			}, HEARTBEAT_INTERVAL);
			this.#heartbeat.unref?.();
		}
		this.#send(res, this.snapshot);
	}
	close() {
		this.#stopNarrating();
		this.#clearPending();
		clearInterval(this.#heartbeat);
		this.#heartbeat = void 0;
		for (const client of this.#clients) client.end();
		this.#clients.clear();
	}
	#emit() {
		const snapshot = this.emit();
		for (const client of this.#clients) this.#send(client, snapshot);
	}
	#send(res, snapshot) {
		if (res.writableEnded) return;
		res.write(`event: nuxt:${snapshot.status}\ndata: ${JSON.stringify(snapshot)}\n\n`);
	}
};
//#endregion
//#region src/dev/error-channel.ts
/** Base path of the live error channel, before `nuxt.config` is known. */
const DEFAULT_ERROR_CHANNEL = `${DEV_INTERNAL_PREFIX}error`;
/** Where the app reads the path the CLI mounted the channel on. */
const ERROR_CHANNEL_ENV = "NUXT_DEV_ERROR_CHANNEL";
/** Where the app forwards its reports when the CLI owns the channel. */
const ERROR_BROADCAST_CHANNEL = "nuxt:dev:error";
/** Asks whoever holds a current report to post it again. */
const SYNC_MESSAGE = { type: "nuxt:dev:error:sync" };
const THREAD_RUNNERS = /* @__PURE__ */ new Set(["node-worker"]);
/**
* Whether `runner` (unset means Nitro's default) evaluates the app in a thread
* of this process, and so can reach the bridge. Anywhere else the app serves
* the channel itself.
*/
function isThreadRunner(runner) {
	return !runner || THREAD_RUNNERS.has(runner);
}
let channel;
/**
* The live error channel, created on first use. Owned by the process that owns
* the listener, so it outlives the app being rebuilt, crashing or not having
* started.
*/
function useErrorChannel(options = {}) {
	if (!channel) {
		const pending = channel = import("my-bad/channel").then(async ({ createChannel }) => createChannel({
			open: true,
			root: options.cwd || process.cwd(),
			allowedHosts: true,
			sink: await resolveSink(options)
		}));
		pending.catch(() => {
			if (channel === pending) channel = void 0;
		});
	}
	return channel;
}
/** Record every channel event as JSON lines, when `NUXT_DEV_ERROR_LOG` asks for it. */
async function resolveSink(options) {
	const requested = process.env.NUXT_DEV_ERROR_LOG;
	if (!requested) return;
	const path = requested === "1" || requested === "true" ? join(options.buildDir || join(options.cwd || process.cwd(), ".nuxt"), "errors.jsonl") : requested;
	const { fileSink } = await import("my-bad/sinks");
	return fileSink(path);
}
/**
* The channel path a config asks for, or nothing when it cannot be served
* there: a bare or trailing slash would intercept the app's own routes.
*/
function resolveChannelPath(value) {
	if (typeof value !== "string") return;
	const path = value.replace(/\/+$/, "");
	return path.startsWith("/") && path.length > 1 ? path : void 0;
}
/** Whether `path` is served by the channel mounted at `base`. */
function isErrorChannelRequest(path, base) {
	return path === base || path.startsWith(`${base}/`);
}
/** Whether `req` came from this machine, by socket address since headers are forgeable. */
function isLocalPeer(req) {
	return isLoopbackAddress(req.socket?.remoteAddress);
}
async function handleErrorChannelRequest(req, res, options = {}) {
	if (await (await useErrorChannel(options)).handler(req, res, { trusted: isLocalPeer(req) })) return;
	res.statusCode = 404;
	res.setHeader("Content-Type", "application/json");
	res.setHeader("Cache-Control", "no-store");
	res.end("{}");
}
/**
* Build a report for something the CLI itself failed at: the config, a module's
* setup, a build. Frames are mapped from disk; the app holds the sourcemaps of
* its own bundle and maps its own.
*/
async function createCliReport(error, options = {}) {
	const [{ createReport, fsLoader }, { nuxtPreset }] = await Promise.all([import("my-bad"), import("my-bad/presets")]);
	return createReport(error, {
		cwd: options.cwd || process.cwd(),
		loaders: [fsLoader()],
		presets: [nuxtPreset()],
		context: options.req ? { req: options.req } : void 0
	});
}
/** Render `report` as a standalone page, subscribed to the live channel. */
async function renderErrorPage(report, options) {
	const [{ renderPage }, { nuxtTheme }] = await Promise.all([import("my-bad"), import("my-bad/presets")]);
	return renderPage(report, {
		cwd: options.cwd,
		channel: options.channel,
		history: options.history,
		environment: "Build",
		theme: nuxtTheme
	});
}
/** The CLI's own phase sequence, as the channel knows it apart from the app's. */
const CLI_PROGRESS_SOURCE = "cli";
/** Progress the app forwarded for work the CLI cannot see. */
const APP_PROGRESS_SOURCE = "app";
/** Progress for the bar an open error page draws; `100` retires it. */
function toBuildProgress(snapshot) {
	return {
		phase: snapshot.phase,
		percent: snapshot.status === "error" ? void 0 : Math.round(snapshot.progress * 100),
		message: snapshot.message,
		source: CLI_PROGRESS_SOURCE
	};
}
/** Publish the CLI's own progress, resolved against whatever the app is reporting. */
async function publishCliProgress(snapshot) {
	const progress = toBuildProgress(snapshot);
	await withErrorChannel((channel) => channel.progress(progress));
}
/** Publish to the channel if one exists, without creating it. */
async function withErrorChannel(run) {
	if (!channel) return;
	try {
		run(await channel);
	} catch (error) {
		debug("Could not publish to the error channel:", error);
	}
}
/** Whether `message` is a report forwarded by the app. */
function isDevErrorMessage(message) {
	const candidate = message;
	if (candidate?.request !== void 0 && typeof candidate.request !== "string") return false;
	const type = candidate?.type;
	if (type === "nuxt:dev:error:log") return isLogEntry(message.entry);
	if (type === "nuxt:dev:error:progress") return isBuildProgress(message.progress);
	return type === "nuxt:dev:error:report" || type === "nuxt:dev:error:clear" || type === "nuxt:dev:error:warning";
}
const LOG_LEVELS = /* @__PURE__ */ new Set([
	"trace",
	"debug",
	"info",
	"log",
	"warn",
	"error",
	"fatal"
]);
/** Whether `entry` is a log the channel's drawer can show. */
function isLogEntry(entry) {
	if (typeof entry !== "object" || entry === null) return false;
	const candidate = entry;
	return typeof candidate.text === "string" && typeof candidate.level === "string" && LOG_LEVELS.has(candidate.level);
}
/** Whether `progress` is an update the error page's bar can draw. */
function isBuildProgress(progress) {
	if (typeof progress !== "object" || progress === null) return false;
	const candidate = progress;
	if (typeof candidate.phase !== "string") return false;
	if (candidate.percent !== void 0 && (typeof candidate.percent !== "number" || !Number.isFinite(candidate.percent))) return false;
	return candidate.message === void 0 || typeof candidate.message === "string";
}
/** The compile error a report was caused by, when there is one. */
function findCompileReport(report) {
	if (report.kind === "compile") return report;
	for (const cause of report.causes) {
		const compile = findCompileReport(cause);
		if (compile) return compile;
	}
}
/** Everything the supervisor needs to present `report`, rendered for a terminal. */
async function summariseReport(report, context = {}, cwd = process.cwd()) {
	const { renderAnsi } = await import("my-bad");
	const named = findCompileReport(report) ?? report;
	const frames = named.frames.some((frame) => frame.file) ? named.frames : report.frames;
	const frame = frames.find((frame) => frame.type === "app" && frame.file) ?? frames.find((frame) => frame.file);
	return {
		id: report.id,
		name: named.name,
		message: named.message,
		file: frame?.file,
		line: frame?.line,
		location: frame?.file && formatLocation(frame.file, frame.line, frame.column, cwd),
		requestId: context.requestId,
		request: context.request,
		ansi: renderAnsi(report, { cwd })
	};
}
/** `file:line:column`, relative to the project where it sits inside it. */
function formatLocation(file, line, column, cwd) {
	const relativePath = relative(cwd, file);
	return [
		!relativePath || relativePath.startsWith("..") || isAbsolute(relativePath) ? file : `./${relativePath}`,
		line,
		column
	].filter((part) => part !== void 0).join(":");
}
/** The request that hit `report`, then its rendering. */
function formatReportForTerminal(report) {
	const body = report.ansi;
	if (!report.request) return body;
	const separator = report.request.indexOf(" ");
	return `[request error] [${separator === -1 ? report.request : report.request.slice(0, separator)}]${separator === -1 ? "" : ` ${report.request.slice(separator + 1)}`}\n\n  ${body.replaceAll("\n", "\n  ")}`;
}
/**
* Receive the reports the app forwards, publishing them on the CLI's channel,
* until the returned function is called.
*/
function openErrorBridge(handlers = {}, options = {}) {
	const broadcast = openBroadcast(ERROR_BROADCAST_CHANNEL, (message) => {
		if (!isDevErrorMessage(message)) return;
		useErrorChannel(options).then((instance) => {
			switch (message.type) {
				case "nuxt:dev:error:report":
					instance.setError(message.report, message.requestId, message.request);
					handlers.onReport?.(message.report, {
						requestId: message.requestId,
						request: message.request
					});
					break;
				case "nuxt:dev:error:log":
					instance.log(message.entry);
					break;
				case "nuxt:dev:error:progress":
					instance.progress({
						...message.progress,
						source: message.progress.source ?? APP_PROGRESS_SOURCE
					});
					break;
				case "nuxt:dev:error:warning":
					instance.warn(message.report);
					break;
				case "nuxt:dev:error:clear":
					instance.clearError(message.id);
					handlers.onClear?.(message.id);
			}
		}).catch((error) => debug("Could not handle a forwarded error report:", error));
	});
	broadcast?.postMessage(SYNC_MESSAGE);
	return () => broadcast?.close();
}
async function closeErrorChannel() {
	const instance = channel;
	channel = void 0;
	await instance?.then((open) => open.close()).catch(() => {});
}
//#endregion
//#region ../../node_modules/.pnpm/h3@1.15.11/node_modules/h3/dist/index.mjs
function hasProp(obj, prop) {
	try {
		return prop in obj;
	} catch {
		return false;
	}
}
var H3Error = class extends Error {
	static __h3_error__ = true;
	statusCode = 500;
	fatal = false;
	unhandled = false;
	statusMessage;
	data;
	cause;
	constructor(message, opts = {}) {
		super(message, opts);
		if (opts.cause && !this.cause) this.cause = opts.cause;
	}
	toJSON() {
		const obj = {
			message: this.message,
			statusCode: sanitizeStatusCode(this.statusCode, 500)
		};
		if (this.statusMessage) obj.statusMessage = sanitizeStatusMessage(this.statusMessage);
		if (this.data !== void 0) obj.data = this.data;
		return obj;
	}
};
function createError(input) {
	if (typeof input === "string") return new H3Error(input);
	if (isError(input)) return input;
	const err = new H3Error(input.message ?? input.statusMessage ?? "", { cause: input.cause || input });
	if (hasProp(input, "stack")) try {
		Object.defineProperty(err, "stack", { get() {
			return input.stack;
		} });
	} catch {
		try {
			err.stack = input.stack;
		} catch {}
	}
	if (input.data) err.data = input.data;
	if (input.statusCode) err.statusCode = sanitizeStatusCode(input.statusCode, err.statusCode);
	else if (input.status) err.statusCode = sanitizeStatusCode(input.status, err.statusCode);
	if (input.statusMessage) err.statusMessage = input.statusMessage;
	else if (input.statusText) err.statusMessage = input.statusText;
	if (err.statusMessage) {
		const originalMessage = err.statusMessage;
		if (sanitizeStatusMessage(err.statusMessage) !== originalMessage) console.warn("[h3] Please prefer using `message` for longer error messages instead of `statusMessage`. In the future, `statusMessage` will be sanitized by default.");
	}
	if (input.fatal !== void 0) err.fatal = input.fatal;
	if (input.unhandled !== void 0) err.unhandled = input.unhandled;
	return err;
}
function sendError(event, error, debug) {
	if (event.handled) return;
	const h3Error = isError(error) ? error : createError(error);
	const responseBody = {
		statusCode: h3Error.statusCode,
		statusMessage: h3Error.statusMessage,
		stack: [],
		data: h3Error.data
	};
	if (debug) responseBody.stack = (h3Error.stack || "").split("\n").map((l) => l.trim());
	if (event.handled) return;
	setResponseStatus(event, Number.parseInt(h3Error.statusCode), h3Error.statusMessage);
	event.node.res.setHeader("content-type", MIMES.json);
	event.node.res.end(JSON.stringify(responseBody, void 0, 2));
}
function isError(input) {
	return input?.constructor?.__h3_error__ === true;
}
const MIMES = {
	html: "text/html",
	json: "application/json"
};
const DISALLOWED_STATUS_CHARS = /[^\u0009\u0020-\u007E]/g;
function sanitizeStatusMessage(statusMessage = "") {
	return statusMessage.replace(DISALLOWED_STATUS_CHARS, "");
}
function sanitizeStatusCode(statusCode, defaultStatusCode = 200) {
	if (!statusCode) return defaultStatusCode;
	if (typeof statusCode === "string") statusCode = Number.parseInt(statusCode, 10);
	if (statusCode < 100 || statusCode > 999) return defaultStatusCode;
	return statusCode;
}
function splitCookiesString(cookiesString) {
	if (Array.isArray(cookiesString)) return cookiesString.flatMap((c) => splitCookiesString(c));
	if (typeof cookiesString !== "string") return [];
	const cookiesStrings = [];
	let pos = 0;
	let start;
	let ch;
	let lastComma;
	let nextStart;
	let cookiesSeparatorFound;
	const skipWhitespace = () => {
		while (pos < cookiesString.length && /\s/.test(cookiesString.charAt(pos))) pos += 1;
		return pos < cookiesString.length;
	};
	const notSpecialChar = () => {
		ch = cookiesString.charAt(pos);
		return ch !== "=" && ch !== ";" && ch !== ",";
	};
	while (pos < cookiesString.length) {
		start = pos;
		cookiesSeparatorFound = false;
		while (skipWhitespace()) {
			ch = cookiesString.charAt(pos);
			if (ch === ",") {
				lastComma = pos;
				pos += 1;
				skipWhitespace();
				nextStart = pos;
				while (pos < cookiesString.length && notSpecialChar()) pos += 1;
				if (pos < cookiesString.length && cookiesString.charAt(pos) === "=") {
					cookiesSeparatorFound = true;
					pos = nextStart;
					cookiesStrings.push(cookiesString.slice(start, lastComma));
					start = pos;
				} else pos = lastComma + 1;
			} else pos += 1;
		}
		if (!cookiesSeparatorFound || pos >= cookiesString.length) cookiesStrings.push(cookiesString.slice(start));
	}
	return cookiesStrings;
}
function setResponseStatus(event, code, text) {
	if (code) event.node.res.statusCode = sanitizeStatusCode(code, event.node.res.statusCode);
	if (text) event.node.res.statusMessage = sanitizeStatusMessage(text);
}
function sendStream(event, stream) {
	if (!stream || typeof stream !== "object") throw new Error("[h3] Invalid stream provided.");
	event.node.res._data = stream;
	if (!event.node.res.socket) {
		event._handled = true;
		return Promise.resolve();
	}
	if (hasProp(stream, "pipeTo") && typeof stream.pipeTo === "function") return stream.pipeTo(new WritableStream({ write(chunk) {
		event.node.res.write(chunk);
	} })).then(() => {
		event.node.res.end();
	});
	if (hasProp(stream, "pipe") && typeof stream.pipe === "function") return new Promise((resolve, reject) => {
		stream.pipe(event.node.res);
		if (stream.on) {
			stream.on("end", () => {
				event.node.res.end();
				resolve();
			});
			stream.on("error", (error) => {
				reject(error);
			});
		}
		event.node.res.on("close", () => {
			if (stream.abort) stream.abort();
		});
	});
	throw new Error("[h3] Invalid or incompatible stream provided.");
}
function sendWebResponse(event, response) {
	for (const [key, value] of response.headers) if (key === "set-cookie") event.node.res.appendHeader(key, splitCookiesString(value));
	else event.node.res.setHeader(key, value);
	if (response.status) event.node.res.statusCode = sanitizeStatusCode(response.status, event.node.res.statusCode);
	if (response.statusText) event.node.res.statusMessage = sanitizeStatusMessage(response.statusText);
	if (response.redirected) event.node.res.setHeader("location", response.url);
	if (!response.body) {
		event.node.res.end();
		return;
	}
	return sendStream(event, response.body);
}
var H3Event = class {
	"__is_event__" = true;
	node;
	web;
	context = {};
	_method;
	_path;
	_headers;
	_requestBody;
	_handled = false;
	_onBeforeResponseCalled;
	_onAfterResponseCalled;
	constructor(req, res) {
		this.node = {
			req,
			res
		};
	}
	get method() {
		if (!this._method) this._method = (this.node.req.method || "GET").toUpperCase();
		return this._method;
	}
	get path() {
		return this._path || this.node.req.url || "/";
	}
	get headers() {
		if (!this._headers) this._headers = _normalizeNodeHeaders(this.node.req.headers);
		return this._headers;
	}
	get handled() {
		return this._handled || this.node.res.writableEnded || this.node.res.headersSent;
	}
	respondWith(response) {
		return Promise.resolve(response).then((_response) => sendWebResponse(this, _response));
	}
	toString() {
		return `[${this.method}] ${this.path}`;
	}
	toJSON() {
		return this.toString();
	}
	/** @deprecated Please use `event.node.req` instead. */
	get req() {
		return this.node.req;
	}
	/** @deprecated Please use `event.node.res` instead. */
	get res() {
		return this.node.res;
	}
};
function createEvent(req, res) {
	return new H3Event(req, res);
}
function _normalizeNodeHeaders(nodeHeaders) {
	const headers = new Headers();
	for (const [name, value] of Object.entries(nodeHeaders)) if (Array.isArray(value)) for (const item of value) headers.append(name, item);
	else if (value) headers.set(name, value);
	return headers;
}
globalThis.Headers;
globalThis.Response;
function toNodeListener(app) {
	const toNodeHandle = async function(req, res) {
		const event = createEvent(req, res);
		try {
			await app.handler(event);
		} catch (_error) {
			const error = createError(_error);
			if (!isError(_error)) error.unhandled = true;
			setResponseStatus(event, error.statusCode, error.statusMessage);
			if (app.options.onError) await app.options.onError(error, event);
			if (event.handled) return;
			if (error.unhandled || error.fatal) console.error("[h3]", error.fatal ? "[fatal]" : "[unhandled]", error);
			if (app.options.onBeforeResponse && !event._onBeforeResponseCalled) await app.options.onBeforeResponse(event, { body: error });
			await sendError(event, error, !!app.options.debug);
			if (app.options.onAfterResponse && !event._onAfterResponseCalled) await app.options.onAfterResponse(event, { body: error });
		}
	};
	return toNodeHandle;
}
//#endregion
//#region src/utils/dev-hint.ts
function hintPath(cwd) {
	return join(cwd, "node_modules/.cache/nuxt/dev-server.json");
}
function loadDevServerHint(cwd) {
	try {
		const hint = JSON.parse(readFileSync(hintPath(cwd), "utf-8"));
		return typeof hint === "object" && hint ? hint : void 0;
	} catch {
		return;
	}
}
/** Persist the resolved address. Never throws: the hint is only an optimisation. */
function saveDevServerHint(cwd, hint) {
	const path = hintPath(cwd);
	if (!existsSync(join(cwd, "node_modules"))) return;
	try {
		if (JSON.stringify(loadDevServerHint(cwd)) === JSON.stringify(hint)) return;
		mkdirSync(dirname(path), { recursive: true });
		writeFileSync(path, JSON.stringify(hint), "utf-8");
	} catch (error) {
		debug("Could not persist dev server hint:", error);
	}
}
//#endregion
//#region src/dev/config-watcher.ts
const RESTART_RE = /^(?:nuxt\.config\.[a-z0-9]+|\.nuxtignore|\.nuxtrc|\.config\/nuxt(?:\.config)?\.[a-z0-9]+)$/;
/** Files above this size are tracked by mtime alone. */
const MAX_HASHED_FILE_SIZE = 262144;
function hashFileContents(path, size) {
	if (size > MAX_HASHED_FILE_SIZE) return;
	let fd;
	try {
		fd = openSync(path, "r");
		const buffer = Buffer$1.allocUnsafe(262145);
		let read = 0;
		while (read < buffer.length) {
			const bytes = readSync(fd, buffer, read, buffer.length - read, read);
			if (bytes === 0) break;
			read += bytes;
		}
		if (read > MAX_HASHED_FILE_SIZE) return;
		return hash("sha1", buffer.subarray(0, read), "hex");
	} catch {
		return;
	} finally {
		if (fd !== void 0) try {
			closeSync(fd);
		} catch {}
	}
}
function trackFile(path, stats) {
	if (stats.isDirectory()) return { mtimeMs: stats.mtimeMs };
	return {
		mtimeMs: stats.mtimeMs,
		contentHash: hashFileContents(path, stats.size)
	};
}
var FileChangeTracker = class {
	entries = /* @__PURE__ */ new Map();
	/** Whether `filePath` changed: by content for regular files, by mtime otherwise. */
	shouldEmitChange(filePath) {
		const resolved = resolve(filePath);
		try {
			const stats = statSync(resolved);
			const previous = this.entries.get(resolved);
			const current = trackFile(resolved, stats);
			this.entries.set(resolved, current);
			if (previous === void 0) return true;
			if (previous.contentHash !== void 0 && current.contentHash !== void 0) return previous.contentHash !== current.contentHash;
			return previous.mtimeMs !== current.mtimeMs;
		} catch {
			this.entries.delete(resolved);
			return true;
		}
	}
	prime(filePath, recursive = false) {
		const resolved = resolve(filePath);
		const stat = statSync(resolved);
		this.entries.set(resolved, trackFile(resolved, stat));
		if (stat.isDirectory()) {
			const entries = readdirSync(resolved);
			for (const entry of entries) {
				const fullPath = resolve(resolved, entry);
				try {
					const stats = statSync(fullPath);
					this.entries.set(fullPath, trackFile(fullPath, stats));
					if (recursive && stats.isDirectory()) this.prime(fullPath, recursive);
				} catch {}
			}
		}
	}
};
/** Local layer directories to watch, excluding the root and layers in `node_modules` or outside it. */
function getLocalLayerDirs(layers, cwd) {
	const root = resolve(cwd);
	const dirs = /* @__PURE__ */ new Set();
	for (const layer of layers) {
		const dir = layer.cwd || layer.config?.rootDir;
		const resolved = dir && resolve(dir);
		if (resolved && resolved !== root && resolved.startsWith(`${root}/`) && !resolved.includes("/node_modules/")) dirs.add(resolved);
	}
	return [...dirs];
}
function createConfigWatcher(cwd, dotenvFileName = ".env", onRestart, onReload, layerDirs = []) {
	const dotenvFileNames = new Set(Array.isArray(dotenvFileName) ? dotenvFileName : [dotenvFileName]);
	const closers = [watchConfigDir(cwd, onReload, (file, path) => dotenvFileNames.has(file) && onRestart(path)), ...layerDirs.map((dir) => watchConfigDir(dir, onReload))];
	return () => {
		for (const close of closers) close();
	};
}
/** Collapse the events of a single save into one call per file, so a half-written file is never evaluated. */
function perFile(handler, delay = 30) {
	const timers = /* @__PURE__ */ new Map();
	return {
		listener: (_event, file) => {
			if (!file) return;
			clearTimeout(timers.get(file));
			const timer = setTimeout(() => {
				timers.delete(file);
				handler(file);
			}, delay);
			timer.unref?.();
			timers.set(file, timer);
		},
		cancel: () => {
			for (const timer of timers.values()) clearTimeout(timer);
			timers.clear();
		}
	};
}
function watchConfigDir(dir, onReload, onFile) {
	const fileWatcher = new FileChangeTracker();
	fileWatcher.prime(dir);
	const watcher = watch(dir);
	let configDirWatcher = existsSync(join(dir, ".config")) ? createConfigDirWatcher(dir, onReload) : void 0;
	const { listener, cancel } = perFile((file) => {
		if (!fileWatcher.shouldEmitChange(resolve(dir, file))) return;
		onFile?.(file, resolve(dir, file));
		if (RESTART_RE.test(file)) onReload(resolve(dir, file));
		if (file === ".config") configDirWatcher ||= createConfigDirWatcher(dir, onReload);
	});
	watcher.on("change", listener);
	return () => {
		cancel();
		watcher.close();
		configDirWatcher?.();
	};
}
function createConfigDirWatcher(cwd, onReload) {
	const configDir = join(cwd, ".config");
	const fileWatcher = new FileChangeTracker();
	fileWatcher.prime(configDir);
	const configDirWatcher = watch(configDir);
	const { listener, cancel } = perFile((file) => {
		if (!fileWatcher.shouldEmitChange(resolve(configDir, file))) return;
		if (RESTART_RE.test(file)) onReload(resolve(configDir, file));
	});
	configDirWatcher.on("change", listener);
	return () => {
		cancel();
		configDirWatcher.close();
	};
}
//#endregion
//#region src/dev/error-response.ts
const ESCAPES = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	"\"": "&quot;",
	"'": "&#39;"
};
function escapeHtml(text) {
	return text.replace(/[&<>"']/g, (character) => ESCAPES[character]);
}
/**
* Answer a request with the little that can be said without a report: the
* message, and the stack where there is one.
*/
async function sendErrorResponse(req, res, error, options = {}) {
	if (res.headersSent) {
		if (!res.writableEnded) res.end();
		return;
	}
	const err = error;
	const useJSON = !req.headers.accept?.includes("text/html");
	res.statusCode = 500;
	res.setHeader("Content-Type", useJSON ? "application/json" : "text/html");
	res.setHeader("Cache-Control", "no-store");
	res.setHeader("X-Content-Type-Options", "nosniff");
	res.setHeader("X-Frame-Options", "DENY");
	res.setHeader("Referrer-Policy", "no-referrer");
	if (!options.inject) res.setHeader("Refresh", "3");
	if (useJSON) {
		res.end(JSON.stringify({
			error: true,
			url: req.url,
			status: 500,
			message: err?.message || "Unknown error",
			data: err?.data,
			stack: err?.stack?.split("\n").map((line) => line.trim())
		}, null, 2));
		return;
	}
	const message = escapeHtml(err?.message || "Unknown error");
	const stack = err?.stack ? `<pre>${escapeHtml(err.stack)}</pre>` : "";
	res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${message}</title></head><body><h1>${message}</h1>${stack}</body></html>${options.inject ?? ""}`);
}
//#endregion
//#region src/dev/loading-client.ts
function progressClient(options) {
	const caption = document.createElement("div");
	caption.id = options.captionId;
	document.body.append(caption);
	let start = Date.now() - options.elapsed;
	let label = "";
	function paint() {
		const seconds = `${((Date.now() - start) / 1e3).toFixed(1)}s`;
		caption.textContent = label ? `${label} \u00B7 ${seconds}` : seconds;
	}
	function apply(snapshot) {
		start = Date.now() - snapshot.elapsed;
		label = `${/^[A-Z][a-z]/.test(snapshot.message) ? snapshot.message[0].toLowerCase() + snapshot.message.slice(1) : snapshot.message} \u00B7 step ${snapshot.index + 1}/${snapshot.total + 1}`;
		const percent = Math.max(4, Math.round(snapshot.progress * 100));
		document.documentElement.style.setProperty(options.progressProperty, `${percent}%`);
		if (snapshot.message && !document.title.startsWith(snapshot.message)) document.title = snapshot.message;
		paint();
	}
	function read(event) {
		try {
			return JSON.parse(event.data);
		} catch {
			return;
		}
	}
	setInterval(paint, 100);
	const source = new EventSource(options.progressPath);
	let polling = false;
	source.addEventListener("nuxt:loading", (event) => {
		const snapshot = read(event);
		if (snapshot) apply(snapshot);
	});
	source.addEventListener("nuxt:error", () => {
		source.close();
		location.reload();
	});
	source.addEventListener("nuxt:ready", (event) => {
		if (polling) {
			if (read(event)?.reload) {
				source.close();
				location.reload();
			}
			return;
		}
		const snapshot = read(event);
		const message = snapshot && !snapshot.serving && snapshot.message ? snapshot.message : "Starting the app";
		label = message.charAt(0).toLowerCase() + message.slice(1);
		document.title = message;
		if (snapshot?.reload) {
			source.close();
			document.documentElement.style.setProperty(options.progressProperty, "100%");
			paint();
			location.reload();
			return;
		}
		const fraction = typeof snapshot?.progress === "number" && snapshot.progress > 0 ? Math.min(snapshot.progress, 1) : 1;
		document.documentElement.style.setProperty(options.progressProperty, `${Math.round(fraction * 100)}%`);
		paint();
		polling = true;
		const controller = new AbortController();
		let wait = options.pollInterval;
		const attempt = async () => {
			try {
				if (!(await (await fetch(location.href, {
					headers: { accept: "text/html" },
					signal: controller.signal
				})).text()).includes(options.captionId)) {
					controller.abort();
					source.close();
					location.reload();
					return;
				}
			} catch {}
			if (controller.signal.aborted) return;
			setTimeout(attempt, wait);
			wait = Math.min(Math.round(wait * 1.5), options.maxPollInterval);
		};
		attempt();
	});
}
/** Reloads the error page as soon as the next load starts or succeeds. */
function recoveryClient(options) {
	const source = new EventSource(options.progressPath);
	let reloading = false;
	const reload = () => {
		if (reloading) return;
		reloading = true;
		source.close();
		location.reload();
	};
	source.addEventListener("nuxt:ready", reload);
	source.addEventListener("nuxt:loading", reload);
}
/** Serialise a client function and its options into an inline `<script>`. */
function inlineScript(client, options) {
	return `<script>(${client.toString()})(${JSON.stringify(options)})<\/script>`;
}
//#endregion
//#region src/dev/loading-page.ts
const CAPTION_ID = "nuxt-dev-phase";
const PROGRESS_PROPERTY = "--nuxt-progress";
const POLL_INTERVAL_MS = 200;
const MAX_POLL_INTERVAL_MS = 1e3;
/**
* Turns the static bar Nuxt's own loading page draws into a determinate one, and
* styles the caption the client appends. A template with no loading bar of its
* own still renders; it just has nothing to make determinate.
*/
const STYLES = `.nuxt-loader-bar{right:auto!important;width:var(${PROGRESS_PROPERTY},4%);transition:width .3s ease}
#${CAPTION_ID}{position:fixed;left:0;right:0;bottom:14px;text-align:center;font:12px/1.5 ui-sans-serif,system-ui,-apple-system,sans-serif;opacity:.55;font-variant-numeric:tabular-nums}`;
function progressTags(snapshot) {
	return `<style>${STYLES}</style>${inlineScript(progressClient, {
		progressPath: PROGRESS_PATH,
		captionId: CAPTION_ID,
		progressProperty: PROGRESS_PROPERTY,
		elapsed: snapshot.elapsed,
		pollInterval: POLL_INTERVAL_MS,
		maxPollInterval: MAX_POLL_INTERVAL_MS
	})}`;
}
/**
* Add live progress to the loading page Nuxt itself would render.
*
* The page keeps its own markup, styling and version, and keeps polling as its
* own script already does, so a failed `EventSource` still recovers. What this
* adds is a determinate bar, a phase caption, the build error inline, and a
* reload driven by the server rather than by a poll interval.
*/
function withProgress(html, snapshot) {
	const tags = progressTags(snapshot);
	const index = html.lastIndexOf("</body>");
	return index === -1 ? html + tags : html.slice(0, index) + tags + html.slice(index);
}
/**
* Injected into the error page so a full-page build error recovers on its own
* once the next load succeeds.
*/
const RECOVERY_SCRIPT = inlineScript(recoveryClient, { progressPath: PROGRESS_PATH });
//#endregion
//#region src/dev/loading-template.ts
const cache = /* @__PURE__ */ new Map();
/**
* The loading page Nuxt itself would render, read from the project's own
* `@nuxt/schema` defaults so it matches the installed Nuxt version.
*
* Only needed before a Nuxt instance exists, or when a project has replaced
* `devServer.loadingTemplate` with something unusable.
*/
function resolveDefaultLoadingTemplate(cwd) {
	let template = cache.get(cwd);
	if (!template) {
		template = importDefaultLoadingTemplate(cwd);
		cache.set(cwd, template);
	}
	return template;
}
async function importDefaultLoadingTemplate(cwd) {
	try {
		const nuxtPath = resolveModulePath("nuxt", {
			from: withNodePath(cwd),
			try: true
		});
		const schemaPath = resolveModulePath("@nuxt/schema", {
			from: withNodePath(nuxtPath || cwd),
			try: true
		});
		if (!schemaPath) return;
		const { NuxtConfigSchema } = await import(pathToFileURL(schemaPath).href);
		const template = NuxtConfigSchema?.devServer?.loadingTemplate;
		return typeof template === "function" ? template : void 0;
	} catch (error) {
		debug("Could not resolve the default loading template:", error);
	}
}
//#endregion
//#region src/dev/request-kind.ts
/** Bundler module-graph URLs (`/@id/`, `/@fs/`, `virtual:`, SFC block queries, Nuxt VFS). */
const BUNDLER_URL_RE = /^\/(?:@|__|_nuxt\/|_vfs(?:\.json)?(?:$|[/?]))|\/node_modules\/|virtual:|[?&](?:vue&type=|import(?:&|=|$)|direct(?:&|=|$)|html-proxy|raw(?:&|=|$)|worker(?:&|=|$))/;
/** Whether a request is a bundler subresource rather than app traffic, by `sec-fetch-dest` or URL shape. */
function isBundlerRequest(url, fetchDest) {
	return fetchDest === "script" || fetchDest === "style" || BUNDLER_URL_RE.test(url);
}
/** Whether a request is for a rendered page. */
function isDocumentRequest(req) {
	if ((req.method || "GET") !== "GET") return false;
	if (!String(req.headers.accept || "").includes("text/html")) return false;
	return !isBundlerRequest(req.url || "/", String(req.headers["sec-fetch-dest"] || "") || void 0);
}
//#endregion
//#region src/dev/runtime-plugins.ts
/** Nitro plugin attributing app logs to their request. Resolved via package exports, as the caller may be in any chunk. */
function registerRequestContextPlugin(nitro, cwd) {
	try {
		const source = fileURLToPath(import.meta.resolve("@nuxt/cli/runtime/dev-request-context"));
		const id = join(nitro.buildDir || join(cwd, ".nuxt"), "dev-request-context.mjs");
		const consola = resolveConsola(cwd);
		nitro.virtual ||= {};
		nitro.virtual[id] = () => readFileSync(source, "utf8").replace("'consola'", JSON.stringify(consola));
		nitro.plugins ||= [];
		nitro.plugins.push(id);
	} catch (error) {
		debug("Could not resolve the request context plugin; app logs will not be attributed:", error);
	}
}
function registerRuntimePlugin(nitro, name) {
	try {
		nitro.plugins ||= [];
		nitro.plugins.push(fileURLToPath(import.meta.resolve(`@nuxt/cli/runtime/${name}`)));
	} catch (error) {
		debug(`Could not resolve the ${name} plugin:`, error);
	}
}
/** The `consola` instance `@nuxt/nitro-server` wraps `console` with, rather than the CLI.s own. */
function resolveConsola(cwd) {
	const from = [resolveModulePath("nuxt", {
		from: cwd,
		try: true
	}), cwd].filter(Boolean);
	return resolveModulePath("consola", {
		from,
		try: true
	}) ?? fileURLToPath(import.meta.resolve("consola"));
}
/** Add the CLI's runtime plugins to the Nitro dev server's config. */
function registerDevPlugins(nitro, cwd, attributeRequests) {
	registerRuntimePlugin(nitro, "dev-close-sockets");
	if (process.env["__NUXT_DEV_INSPECT__"]) registerRuntimePlugin(nitro, "dev-inspector");
	if (attributeRequests) registerRequestContextPlugin(nitro, cwd);
}
//#endregion
//#region src/dev/warmup-gate.ts
/**
* A safety valve rather than a tuning knob: longer than any first render
* measured on a large project, so a leader that never answers cannot hold a
* page open indefinitely.
*/
const DEFAULT_TIMEOUT_MS = 3e4;
/**
* Serialises the first page render, so a cold start pays for it once.
*
* The first render of any route compiles the module graph the whole app shares.
* Two at once compile it twice and contend, so two tabs on a cold start are
* slower than one; a second render afterwards costs tens of milliseconds.
*
* Not a cache: every request is still served by the app, so anything
* per-request behaves as it would without the gate. Global rather than
* per-URL, because what is being warmed is the graph and not the route.
*/
var WarmupGate = class {
	#warmed = false;
	#leader;
	#timeout;
	constructor(options = {}) {
		this.#timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
	}
	/** Whether a page has been rendered, after which the gate does nothing. */
	get warmed() {
		return this.#warmed;
	}
	/** Gate the next load again, because it will compile from cold once more. */
	rearm() {
		this.#warmed = false;
	}
	/**
	* Resolves when this request may be handed to the app: at once while nothing
	* is rendering, otherwise as soon as the render ahead of it has finished,
	* given up, or run out of time. Only page renders should be handed here.
	*/
	async admit(res) {
		if (this.#warmed) return;
		const deadline = Date.now() + this.#timeout;
		while (!this.#warmed && this.#leader) {
			const remaining = deadline - Date.now();
			if (remaining <= 0) return;
			let timer;
			await Promise.race([this.#leader, new Promise((resolve) => {
				timer = setTimeout(resolve, remaining);
				timer.unref?.();
			})]);
			clearTimeout(timer);
			if (res.destroyed || res.writableEnded) return;
		}
		if (this.#warmed) return;
		let release = () => {};
		this.#leader = new Promise((resolve) => {
			release = resolve;
		});
		let settled = false;
		let expiry;
		const finish = (warmed) => {
			if (settled) return;
			settled = true;
			clearTimeout(expiry);
			this.#warmed = warmed;
			this.#leader = void 0;
			release();
		};
		expiry = setTimeout(finish, this.#timeout, false);
		expiry.unref?.();
		res.once("close", () => finish(res.writableEnded && res.statusCode < 500));
	}
};
//#endregion
//#region src/dev/utils.ts
/**
* PID of the process supervising this one, when this is a dev fork. Recorded in
* the lock so a takeover stops the supervisor too, rather than leaving it
* running with nothing to serve.
*/
function devForkParentPid() {
	if (!process.env.__NUXT__FORK || !process.send) return;
	return process.ppid > 1 ? process.ppid : void 0;
}
const TRAILING_SLASH_RE = /\/$/;
/**
* `built` distinguishes a builder that declared it has no dev server from one
* that built without leaving a server behind.
*/
function noDevServerMessage(builder, built) {
	return `The ${styleText("cyan", builder)} server builder ${built ? "did not provide" : "does not provide"} a dev server.\n       A ${styleText("cyan", "server.builder")} must expose a \`handler\`, \`fetch\` or \`app\` on \`nuxt.server\` to be served by ${styleText("cyan", "nuxt dev")}.`;
}
/**
* Pin Vite's HMR websocket to the main dev server so no separate HMR port is allocated.
* vite >= 8.1 reads `server.ws`; older versions only read `server.hmr`.
* Returns the websocket path, which is set on both.
*/
function attachViteHmrServer(server, hmrServer) {
	const target = server;
	const path = target.ws?.path ?? target.hmr?.path;
	target.ws = {
		protocol: void 0,
		...target.ws,
		path,
		port: void 0,
		host: void 0,
		server: hmrServer
	};
	target.hmr = {
		protocol: void 0,
		...target.hmr,
		path,
		port: void 0,
		host: void 0,
		server: hmrServer
	};
	return path;
}
function resolveConfigDiffer(kit) {
	const differ = kit.diffNuxtConfig;
	return typeof differ === "function" ? differ : void 0;
}
var NuxtDevServer = class extends EventEmitter {
	#handler;
	/** Whether the app can reach this process, and so whether the CLI serves the channel. */
	#ownsChannel = isThreadRunner(process.env.NITRO_DEV_RUNNER);
	#errorChannel = DEFAULT_ERROR_CHANNEL;
	#closeErrorBridge;
	/** The load that failed, served in place of the app until the next one succeeds. */
	#loadingFailure;
	#distWatcher;
	#configWatcher;
	#currentNuxt;
	#loadingMessage;
	#fileChangeTracker = new FileChangeTracker();
	#cwd;
	#websocketConnections = /* @__PURE__ */ new Set();
	#inflightResponses = /* @__PURE__ */ new Set();
	/** Responses the CLI answered itself, kept out of the dev UI's request feed. */
	#internalResponses = /* @__PURE__ */ new Set();
	/** Requests being served, which the compile time Vite reports is charged to. */
	#inflight = /* @__PURE__ */ new Map();
	#unsubscribeCompileTiming;
	#lockCleanup;
	#lockedBuildDir;
	#pendingReason;
	#rawConfig;
	#changedConfigKeys;
	#bound;
	#allowedHosts = /* @__PURE__ */ new Set();
	#allowAnyHost = false;
	#openedEagerly = false;
	#progress = new DevProgress();
	#warmup = new WarmupGate();
	#closed = false;
	loadDebounced;
	handler;
	/** Live startup progress, streamed to the loading page and the terminal. */
	progress = this.#progress;
	listener;
	options;
	constructor(options) {
		super();
		this.options = options;
		this.loadDebounced = debounce(async () => {
			const reason = this.#pendingReason;
			this.#pendingReason = void 0;
			if (reason?.type === "config" && !this.#loadingFailure && await this.#isConfigUnchanged()) {
				console.info(formatSkippedReload(reason, { rootDir: this.#cwd }));
				return;
			}
			return this.load(true, reason);
		});
		this.#cwd = options.cwd;
		this.#announceErrorChannel();
		this.#progress.onUpdate((snapshot) => {
			publishCliProgress(snapshot);
		});
		this.handler = async (req, res) => {
			const path = (req.url || "").split("?")[0] || "/";
			if (path.startsWith("/__nuxt_dev__/")) {
				if (this.#rejectDisallowedHost(req, res)) return;
				if (this.#progress.handleRequest(req, res)) return;
			}
			if (this.#ownsChannel && (isErrorChannelRequest(path, this.#errorChannel) || isErrorChannelRequest(path, DEFAULT_ERROR_CHANNEL))) {
				if (this.#rejectDisallowedHost(req, res)) return;
				if (options.captureUIEvents) this.#internalResponses.add(res);
				await handleErrorChannelRequest(req, res, this.#errorChannelOptions()).catch((error) => {
					debug("Could not answer an error channel request:", error);
					if (!res.writableEnded) res.end();
				});
				return;
			}
			const request = attachRequest(req);
			if (!options.captureUIEvents) return this.#serve(req, res);
			const method = req.method || "GET";
			const url = req.url || "/";
			const start = performance.now();
			const fetchDest = String(req.headers["sec-fetch-dest"] || "") || void 0;
			this.#inflight.set(request.id, {
				id: request.id,
				internal: isBundlerRequest(url, fetchDest)
			});
			return runWithRequest(request, () => {
				res.once("close", () => {
					this.#inflight.delete(request.id);
					if (this.#internalResponses.delete(res)) return;
					this.emit("request", {
						id: request.id,
						method,
						url,
						status: res.statusCode,
						start: performance.timeOrigin + start,
						duration: Math.round(performance.now() - start),
						internal: isBundlerRequest(url, fetchDest) || void 0
					});
				});
				return this.#serve(req, res);
			});
		};
	}
	/**
	* Answer a request whose `Host` header does not name this server, so pages
	* loaded from a rebinding hostname cannot read the CLI's own endpoints.
	* Returns `true` when the request was rejected. Requests the app itself
	* serves are not gated here: Vite applies its own `allowedHosts` check.
	*/
	#rejectDisallowedHost(req, res) {
		if (this.#allowAnyHost || isAllowedHost(req.headers.host, this.#allowedHosts)) return false;
		if (this.options.captureUIEvents) this.#internalResponses.add(res);
		if (!res.headersSent) {
			res.statusCode = 403;
			res.setHeader("Content-Type", "text/plain");
		}
		res.end("Forbidden: this host is not allowed. Pass it to `--host`, or `--public` to allow any host.");
		return true;
	}
	/**
	* Record the hostnames this server answers on, for the `Host` check on the
	* CLI's own endpoints. `--public` opts out of the check entirely.
	*/
	#syncAllowedHosts(options) {
		this.#allowAnyHost = !!options.public;
		this.#allowedHosts.clear();
		if (this.#allowAnyHost) return;
		if (options.hostname) this.#allowedHosts.add(options.hostname.toLowerCase());
		for (const { url } of this.listener?.getURLs() ?? []) try {
			const hostname = new URL(url).hostname.toLowerCase();
			this.#allowedHosts.add(hostname.startsWith("[") ? hostname.slice(1, -1) : hostname);
		} catch {}
	}
	async #serve(req, res) {
		const failure = this.#loadingFailure;
		if (failure) {
			if (this.#rejectDisallowedHost(req, res)) return;
			if (failure.report && await this.#renderReport(req, res, failure.report)) return;
			await sendErrorResponse(req, res, failure.error, { inject: RECOVERY_SCRIPT });
			return;
		}
		if (!this.#handler) {
			if (this.#rejectDisallowedHost(req, res)) return;
			if (this.options.captureUIEvents) this.#internalResponses.add(res);
			await this.#renderLoadingScreen(req, res).catch((error) => {
				debug("Could not render the loading screen:", error);
				if (res.headersSent) {
					res.end();
					return;
				}
				res.statusCode = 503;
				res.end("Dev server is loading...");
			});
			return;
		}
		this.#inflightResponses.add(res);
		const document = isDocumentRequest(req);
		const pending = document ? this.#progress.startRequest(`${req.method || "GET"} ${req.url || "/"}`) : void 0;
		res.once("close", () => {
			this.#inflightResponses.delete(res);
			if (pending !== void 0) this.#progress.finishRequest(pending);
			if (document && res.statusCode < 500) this.#progress.setServing();
		});
		if (!this.#warmup.warmed && document) {
			await this.#warmup.admit(res);
			if (res.destroyed || res.writableEnded) return;
		}
		this.#handler(req, res);
	}
	/** Root the project's own paths are written relative to. */
	#rootDir() {
		return this.#currentNuxt?.options.rootDir || this.#cwd;
	}
	#errorChannelOptions() {
		return {
			cwd: this.#cwd,
			buildDir: this.#currentNuxt?.options.buildDir
		};
	}
	/**
	* Tell the app that the CLI owns the channel. The dev worker inherits this
	* process's environment as it is when the worker starts, so this runs before
	* Nuxt loads.
	*/
	#announceErrorChannel() {
		if (this.#ownsChannel) process.env[ERROR_CHANNEL_ENV] = this.#errorChannel;
	}
	/** Start receiving the reports the app forwards. */
	#openErrorBridge() {
		if (!this.#ownsChannel) return;
		this.#closeErrorBridge ??= openErrorBridge({
			onReport: (report, context) => {
				summariseReport(report, context, this.#rootDir()).then((summary) => this.emit("report", summary)).catch((error) => debug("Could not summarise a forwarded report:", error));
			},
			onClear: (id) => this.emit("report:clear", id)
		}, this.#errorChannelOptions());
	}
	/** Move the channel to the path the config asks for, before the app is built. */
	#resolveErrorChannel() {
		if (!this.#ownsChannel || !this.#currentNuxt) return;
		const devServer = this.#currentNuxt.options.devServer;
		const runner = (this.#currentNuxt.options.nitro?.devServer)?.runner;
		if (!isThreadRunner(typeof runner === "string" ? runner : void 0)) {
			this.#ownsChannel = false;
			delete process.env[ERROR_CHANNEL_ENV];
			return;
		}
		this.#errorChannel = resolveChannelPath(devServer.errorChannel) ?? DEFAULT_ERROR_CHANNEL;
		process.env[ERROR_CHANNEL_ENV] = this.#errorChannel;
	}
	/**
	* Serve `report` as a live error page, or `false` when it could not be
	* rendered. The page dismisses itself once the channel clears the error.
	* The report is build state broken for everyone, so any peer sees it; the
	* history spans other requests, so only a peer on this machine sees that.
	*/
	async #renderReport(req, res, report) {
		if (!String(req.headers.accept || "").includes("text/html")) return false;
		try {
			const channel = this.#ownsChannel ? await useErrorChannel(this.#errorChannelOptions()) : void 0;
			const html = await renderErrorPage(report, {
				cwd: this.#rootDir(),
				channel: channel && this.#errorChannel,
				history: isLocalPeer(req) ? channel?.history : void 0
			});
			res.statusCode = 500;
			res.setHeader("Content-Type", "text/html");
			res.setHeader("Cache-Control", "no-store");
			res.end(html);
			return true;
		} catch (error) {
			debug("Could not render the error page:", error);
			return false;
		}
	}
	async #renderLoadingScreen(req, res) {
		if (res.headersSent) {
			if (!res.writableEnded) res.end();
			return;
		}
		const snapshot = this.#progress.snapshot;
		res.statusCode = 503;
		res.setHeader("Cache-Control", "no-store");
		const accept = req.headers.accept;
		if (accept && !accept.includes("text/html") && !accept.includes("*/*")) {
			res.setHeader("Content-Type", "application/json");
			res.setHeader("Retry-After", "1");
			res.end(JSON.stringify({
				error: true,
				status: 503,
				message: this.#loadingMessage || "Dev server is loading...",
				phase: snapshot.phase,
				progress: Number(snapshot.progress.toFixed(2)),
				elapsed: snapshot.elapsed,
				hint: "Please retry once the dev server is ready."
			}, null, 2));
			return;
		}
		res.setHeader("Content-Type", "text/html");
		const message = this.#loadingMessage || "Loading...";
		const withMessage = {
			...snapshot,
			message
		};
		const template = this.options.loadingTemplate || this.#currentNuxt?.options.devServer.loadingTemplate || await resolveDefaultLoadingTemplate(this.#cwd);
		if (!template) {
			res.setHeader("Refresh", "3");
			res.end(message);
			return;
		}
		const html = template({ loading: message });
		if (!html.includes("__NUXT_LOADING__")) {
			res.setHeader("Refresh", "3");
			res.end(html);
			return;
		}
		res.end(withProgress(html, withMessage));
	}
	/**
	* Load Nuxt, bind the listener and serve the app.
	*
	* Rejects if the first load fails, because there is no server to hand back;
	* a later {@link load} instead catches, emits `loading:error` and serves the
	* error page, so a caller that only listens for the event will never hear
	* about a failed startup.
	*/
	async init() {
		const action = "Starting";
		this.#loadingMessage = `${action} Nuxt...`;
		this.#handler = void 0;
		this.#progress.start(this.#loadingMessage);
		this.emit("loading", this.#loadingMessage);
		this.#openErrorBridge();
		if (this.options.captureUIEvents && !this.#unsubscribeCompileTiming) {
			const { subscribeCompileTiming } = await import("../compile-timing-C-twwYy6.mjs");
			this.#unsubscribeCompileTiming = subscribeCompileTiming({
				rootDir: () => this.#rootDir(),
				current: currentRequest,
				inflight: () => [...this.#inflight.values()],
				report: (span) => this.emit("span", span)
			});
		}
		await this.#bindEagerListener();
		try {
			await this.#startNuxt();
		} catch (error) {
			if (!this.#bound || isCI || !isInteractive()) throw error;
			await this.#reportLoadFailure(error, false);
		}
		this.#watchConfig();
	}
	async #startNuxt() {
		await this.#loadNuxtInstance(this.#bound && this.listener.getURLs().map(({ url }) => url));
		this.#acquireDevLock(this.#currentNuxt.options.buildDir);
		if (this.options.showBanner) showBanner(this.#currentNuxt);
		await this.#createListener();
		await this.#initializeNuxt(false);
	}
	closeWatchers() {
		this.#distWatcher?.close();
		this.#configWatcher?.();
	}
	/** Stop watching and reloading for good. Reloads use `closeWatchers` instead. */
	shutdown() {
		this.#closed = true;
		this.loadDebounced.cancel();
		this.closeWatchers();
		this.#closeErrorBridge?.();
		this.#closeErrorBridge = void 0;
		this.#unsubscribeCompileTiming?.();
		this.#unsubscribeCompileTiming = void 0;
	}
	/**
	* Queue a debounced in-place reload, accumulating the reasons for every
	* change that arrives within the debounce window.
	*/
	scheduleReload(reason) {
		this.#pendingReason = mergeRestartReasons(this.#pendingReason, reason);
		this.loadDebounced();
	}
	async load(reload, reason) {
		if (this.#closed) return;
		try {
			this.closeWatchers();
			await this.#load(reload, reason);
			this.#loadingFailure = void 0;
		} catch (error) {
			await this.#reportLoadFailure(error, !!reload);
		}
		if (!this.#closed) this.#watchConfig();
	}
	/** Serve and report a load that failed, in place of the app it would have served. */
	async #reportLoadFailure(error, reload) {
		this.#handler = void 0;
		this.#loadingFailure = { error };
		this.#loadingMessage = "Error while loading Nuxt. Please check console and fix errors.";
		this.#progress.setError(error);
		const report = await this.#publishError(error);
		const summary = report && await summariseReport(report, {}, this.#rootDir()).catch((reportError) => void debug("Could not summarise the report:", reportError));
		if (summary) this.emit("report", summary);
		else console.error(`Cannot ${reload ? "restart" : "start"} nuxt: `, error?.stack ?? String(error));
		this.emit("loading:error", error);
	}
	#createLoadOptions(urls) {
		const captureUIEvents = this.options.captureUIEvents;
		const loadOptions = {
			cwd: this.options.cwd,
			dev: true,
			ready: false,
			envName: this.options.envName,
			dotenv: {
				cwd: this.options.cwd,
				fileName: this.options.dotenv.fileName
			},
			overrides: {
				logLevel: this.options.logLevel,
				...this.options.overrides,
				vite: {
					clearScreen: this.options.clear,
					...this.options.overrides.vite
				},
				hooks: {
					...this.options.overrides.hooks,
					"nitro:config": (nitro) => {
						registerDevPlugins(nitro, this.options.cwd, captureUIEvents);
						return this.options.overrides.hooks?.["nitro:config"]?.(nitro);
					}
				}
			}
		};
		if (urls) {
			const hostname = this.options.listenOverrides?.hostname;
			loadOptions.defaults = resolveDevServerDefaults({
				hostname,
				https: !!this.listener?.https
			}, urls);
		}
		if (captureUIEvents) loadOptions.defaults = {
			...loadOptions.defaults,
			tracingChannel: true
		};
		return loadOptions;
	}
	/**
	* Resolve the config without instantiating Nuxt, to find out which keys a watched
	* config file actually changed. Returns `undefined` when no comparison is possible
	* (no baseline, an older `@nuxt/kit`, or a config that failed to load), in which case
	* the caller should reload and let the normal path surface any error.
	*/
	async #resolveConfigChange(urls) {
		const previous = this.#rawConfig;
		if (!previous) return;
		const kit = await loadKit(this.options.cwd);
		const diffNuxtConfig = resolveConfigDiffer(kit);
		if (!diffNuxtConfig || typeof kit.loadNuxtConfig !== "function") return;
		let keys;
		const loadOptions = this.#createLoadOptions(urls);
		loadOptions.onConfigResolved = ({ rawConfig }) => {
			try {
				keys = diffNuxtConfig(previous, rawConfig).map((entry) => entry.key);
			} catch (error) {
				debug("Could not diff nuxt config:", error);
			}
		};
		try {
			await kit.loadNuxtConfig(loadOptions);
		} catch (error) {
			debug("Could not resolve nuxt config:", error);
			return;
		}
		return keys;
	}
	/**
	* Report a reload as a single console entry, so the changed keys stay attached to the
	* line they explain rather than being prefixed as a separate log message.
	*/
	#reportReload(reason) {
		const lines = [formatRestartReason(reason, { rootDir: this.#cwd })];
		const changedKeys = reason?.type === "config" && formatChangedKeys(reason.keys ?? []);
		if (changedKeys) lines.push(styleText("dim", `  ${changedKeys}`));
		console.info(lines.join("\n"));
	}
	async #isConfigUnchanged() {
		const urls = this.listener?.getURLs().map(({ url }) => url);
		return await this.#resolveConfigChange(urls).then((keys) => keys?.length === 0);
	}
	async #loadNuxtInstance(urls) {
		const kit = await loadKit(this.options.cwd);
		const loadOptions = this.#createLoadOptions(urls);
		const diffNuxtConfig = resolveConfigDiffer(kit);
		if (diffNuxtConfig) {
			this.#changedConfigKeys = void 0;
			loadOptions.onConfigResolved = ({ rawConfig }) => {
				const previous = this.#rawConfig;
				this.#rawConfig = rawConfig;
				if (previous) try {
					this.#changedConfigKeys = diffNuxtConfig(previous, rawConfig).map((entry) => entry.key);
				} catch (error) {
					debug("Could not diff nuxt config:", error);
				}
			};
		}
		this.#currentNuxt = await kit.loadNuxt(loadOptions);
		if (this.options.captureUIEvents) {
			this.#collectRoutes(this.#currentNuxt);
			this.#watchServerBuilds(this.#currentNuxt);
		}
	}
	/**
	* Report Nitro rebuilds, which happen on every server-side change and are
	* otherwise invisible: only full Nuxt reloads emit `loading`.
	*
	* In dev the rebuild is driven by rollup's watcher, which reports `dev:start`
	* rather than the `rollup:before` of a one-shot build.
	*/
	#watchServerBuilds(nuxt) {
		nuxt.hook("nitro:init", (nitro) => {
			for (const started of ["dev:start", "rollup:before"]) nitro.hooks.hook(started, () => {
				this.emit("building", true);
			});
			for (const finished of [
				"compiled",
				"dev:reload",
				"dev:error"
			]) nitro.hooks.hook(finished, () => {
				this.emit("building", false);
			});
		});
	}
	/**
	* Gather the app's routes.
	*
	* Every hook here is an optional capability: a project without the pages
	* module, or without a nitro server, simply contributes nothing.
	*/
	#collectRoutes(nuxt) {
		const routes = [];
		let errorComponent;
		const emit = () => this.emit("routes", {
			routes: [...routes],
			errorComponent
		});
		nuxt.hook("app:resolve", (app) => {
			const resolved = app;
			errorComponent = resolved.errorComponent ?? resolved.n ?? void 0;
			emit();
		});
		nuxt.hook("pages:extend", (pages) => {
			const flatten = (list, prefix = "") => {
				for (const page of list) {
					const path = page.path.startsWith("/") ? page.path : `${prefix}/${page.path}`.replace(/\/+/g, "/");
					routes.push({
						kind: "page",
						route: path,
						file: page.file
					});
					flatten(page.children ?? [], path);
				}
			};
			routes.splice(0, routes.length, ...routes.filter((route) => route.kind !== "page"));
			flatten(pages);
			emit();
		});
		nuxt.hook("nitro:build:before", (nitro) => {
			routes.splice(0, routes.length, ...routes.filter((route) => route.kind !== "server"));
			for (const handler of nitro.scannedHandlers ?? []) if (handler.route) routes.push({
				kind: "server",
				route: handler.route,
				method: handler.method,
				file: handler.handler
			});
			emit();
		});
	}
	/**
	* Bind a socket before the Nuxt config is known, so the port answers within
	* milliseconds of spawn and pre-ready requests get the loading screen instead
	* of hanging. The address is taken from the CLI/env, else from the address the
	* previous run resolved, else from the schema default.
	*
	* A guessed address is only a guess: `#createListener` rebinds if the resolved
	* config disagrees. Set `NUXT_DEV_EAGER_LISTEN=0` to bind after the config instead.
	*/
	async #bindEagerListener() {
		if (process.env.NUXT_DEV_EAGER_LISTEN === "0" || process.env.NUXT_DEV_EAGER_LISTEN === "false") return;
		const overrides = this.options.listenOverrides || {};
		const hint = loadDevServerHint(this.options.cwd);
		if (overrides.httpsEnabled === void 0 && hint?.https) return;
		const httpsEnabled = !!overrides.httpsEnabled;
		const hasExplicitPort = overrides.port !== void 0 && overrides.port !== "";
		const listenOptions = {
			...overrides,
			port: hasExplicitPort ? overrides.port : hint?.port,
			hostname: overrides.hostname ?? hint?.hostname,
			baseURL: hint?.baseURL,
			https: httpsEnabled ? overrides.https : void 0,
			showURL: false,
			open: false,
			clipboard: false,
			tunnel: false
		};
		try {
			this.#bound = await bindListener(this.handler, listenOptions);
		} catch (error) {
			if (hasExplicitPort) throw error;
			debug("Could not bind the dev server before loading Nuxt:", error);
			return;
		}
		this.listener = await createListener(this.#bound, listenOptions, { announce: false });
		this.#syncAllowedHosts(listenOptions);
		this.emit("listening", {
			url: this.listener.url,
			urls: this.listener.getURLs(),
			confirmed: false
		});
		const knowsScheme = overrides.httpsEnabled !== void 0 || hint?.https === false;
		if (overrides.open && knowsScheme && (hasExplicitPort || hint?.port === this.#bound.address.port)) {
			this.#openedEagerly = true;
			openBrowser(overrides.openURL ? resolveOpenURL(overrides.openURL, this.listener.url) : this.listener.url);
		}
	}
	async #createListener() {
		if (!this.#currentNuxt) throw new Error("Nuxt must be loaded before creating listener");
		const listenOptions = this.#resolveListenOptions();
		this.#persistDevServerHint(listenOptions.baseURL);
		if (this.#bound && !matchesBoundTarget(this.#bound, listenOptions)) {
			await this.listener.close();
			this.#bound = void 0;
			this.#openedEagerly = false;
		}
		this.#bound ??= await bindListener(this.handler, listenOptions);
		this.listener = await createListener(this.#bound, {
			...listenOptions,
			open: listenOptions.open && !this.#openedEagerly
		});
		this.#syncAllowedHosts(listenOptions);
		this.emit("listening", {
			url: this.listener.url,
			urls: this.listener.getURLs(),
			confirmed: true
		});
		if (listenOptions.public) {
			this.#currentNuxt.options.devServer.cors = { origin: "*" };
			if (this.#currentNuxt.options.vite?.server) this.#currentNuxt.options.vite.server.allowedHosts = true;
			return;
		}
		const urls = this.listener.getURLs().map(({ url }) => url);
		if (urls.length > 0) {
			this.#currentNuxt.options.vite = defu(this.#currentNuxt.options.vite, { server: { allowedHosts: urls.map((u) => new URL(u).hostname) } });
			const allowedHosts = this.#currentNuxt.options.vite.server?.allowedHosts;
			if (Array.isArray(allowedHosts)) this.#currentNuxt.options.vite.server.allowedHosts = dedupe(allowedHosts);
		}
	}
	/**
	* Record the address `nuxt.config` resolves to, so the next run can bind it
	* before loading the config. CLI and env overrides are deliberately excluded:
	* a one-off `--port` should not change where the next plain run binds.
	*/
	#persistDevServerHint(baseURL) {
		const devServer = this.#currentNuxt?.options.devServer;
		if (!devServer) return;
		saveDevServerHint(this.options.cwd, {
			port: Number(devServer.port) || void 0,
			hostname: devServer.host || void 0,
			https: !!devServer.https,
			baseURL
		});
	}
	#resolveListenOptions() {
		if (!this.#currentNuxt) throw new Error("Nuxt must be loaded before resolving listen options");
		const nuxtConfig = this.#currentNuxt.options;
		const { httpsEnabled, ...overrides } = this.options.listenOverrides || {};
		const port = overrides.port ?? nuxtConfig.devServer?.port;
		const hostname = overrides.hostname ?? nuxtConfig.devServer?.host;
		const isPublic = provider === "codesandbox" || overrides.public;
		const httpsFromConfig = typeof nuxtConfig.devServer?.https === "object" ? nuxtConfig.devServer.https : {};
		const https = (httpsEnabled ?? !!nuxtConfig.devServer?.https) && defu(typeof overrides.https === "object" ? overrides.https : {}, httpsFromConfig);
		const baseURL = nuxtConfig.app?.baseURL?.startsWith?.("./") ? nuxtConfig.app.baseURL.slice(1) : nuxtConfig.app?.baseURL;
		return {
			...overrides,
			port,
			hostname,
			public: isPublic,
			https: https || void 0,
			baseURL
		};
	}
	async #initializeNuxt(reload) {
		if (!this.#currentNuxt) throw new Error("Nuxt must be loaded before configuration");
		this.#resolveErrorChannel();
		this.#progress.attachNuxt(this.#currentNuxt.hooks, { installedModules: () => this.#currentNuxt?.options._installedModules?.length ?? 0 });
		this.#progress.setPhase("modules");
		this.#currentNuxt.hooks.hook("builder:watch", () => {
			this.emit("change");
		});
		let viteHmrPinned = false;
		let viteHmrAttached = false;
		if (!process.env.NUXI_DISABLE_VITE_HMR) {
			this.#currentNuxt.hooks.hook("vite:extend", ({ config }) => {
				if (config.server) {
					attachViteHmrServer(config.server, this.listener.server);
					viteHmrPinned = true;
				}
			});
			this.#currentNuxt.hooks.hook("vite:serverCreated", (_server, { isClient }) => {
				if (isClient && viteHmrPinned) viteHmrAttached = true;
			});
		}
		this.#currentNuxt.hooks.hookOnce("close", () => {
			this.listener.server.removeAllListeners("upgrade");
		});
		if (!reload) {
			const previousManifest = await loadNuxtManifest(this.#currentNuxt.options.buildDir);
			const newManifest = resolveNuxtManifest(this.#currentNuxt);
			const promise = writeNuxtManifest(this.#currentNuxt, newManifest);
			this.#currentNuxt.hooks.hookOnce("ready", async () => {
				await promise;
			});
			if (previousManifest && newManifest && previousManifest._hash !== newManifest._hash) {
				debug(`Clearing ${this.#currentNuxt.options.buildDir} (manifest hash ${previousManifest._hash} -> ${newManifest._hash}).`);
				await clearBuildDir(this.#currentNuxt.options.buildDir);
			}
		}
		await this.#currentNuxt.ready();
		this.#currentNuxt.hooks.hookOnce("restart", async (options) => {
			if (options?.hard) {
				this.emit("restart", { type: "hook" });
				return;
			}
			await this.load(true, { type: "hook" });
		});
		const nuxt = this.#currentNuxt;
		const buildAssetsPath = `${(nuxt.options.app.baseURL.startsWith("./") ? nuxt.options.app.baseURL.slice(1) : nuxt.options.app.baseURL).replace(/\/$/, "")}/${nuxt.options.app.buildAssetsDir.replace(/^\//, "")}`;
		const expectsViteHmr = !process.env.NUXI_DISABLE_VITE_HMR && (!nuxt.options.builder || String(nuxt.options.builder).includes("vite"));
		this.listener.server.on("upgrade", (req, socket, head) => {
			this.#websocketConnections.add(socket);
			socket.on("close", () => {
				this.#websocketConnections.delete(socket);
			});
			if (req.url?.startsWith(buildAssetsPath)) {
				const protocol = req.headers["sec-websocket-protocol"];
				if (expectsViteHmr && !viteHmrAttached && (protocol === "vite-hmr" || protocol === "vite-ping")) socket.destroy();
				return;
			}
			if (nuxt.server && "upgrade" in nuxt.server) nuxt.server.upgrade(req, socket, head);
		});
		await this.#currentNuxt.hooks.callHook("listen", this.listener.server, this.listener);
		const addr = this.listener.address;
		this.#currentNuxt.options.devServer.host = addr.address;
		this.#currentNuxt.options.devServer.port = addr.port;
		this.#currentNuxt.options.devServer.url = getAddressURL(addr, !!this.listener.https);
		this.#currentNuxt.options.devServer.https = resolveDevServerHTTPS(this.listener.https);
		if (this.listener.https && process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0" && !process.env.NODE_EXTRA_CA_CERTS) {
			const caRoot = this.listener.https.caRoot;
			logger.warn(caRoot ? `Node does not read your system trust store, so requests to this server from Node will not trust its certificate.\n       Set \`NODE_EXTRA_CA_CERTS=${join(caRoot, "rootCA.pem")}\` to fix that.` : "Node does not read your system trust store, so requests to this server from Node will not trust its certificate.\n       Set `NODE_EXTRA_CA_CERTS` to the certificate authority that issued it, or install `mkcert` for a locally-trusted certificate.");
		}
		const kit = await loadKit(this.options.cwd);
		const serverBuild = resolveServerBuild(kit, this.#currentNuxt);
		if (!serverBuild.hasDevServer) throw new ActionableError(noDevServerMessage(serverBuild.label, false));
		this.#progress.setPhase("types");
		const typesPromise = existsSync(join(this.#currentNuxt.options.buildDir, "tsconfig.json")) ? kit.writeTypes(this.#currentNuxt).catch(console.error) : await kit.writeTypes(this.#currentNuxt).catch(console.error);
		await Promise.all([typesPromise, kit.buildNuxt(this.#currentNuxt)]);
		if (!this.#currentNuxt.server) throw new ActionableError(noDevServerMessage(serverBuild.label, true));
		const distDir = join(this.#currentNuxt.options.buildDir, "dist");
		await mkdir(distDir, { recursive: true });
		this.#fileChangeTracker.prime(distDir);
		this.#distWatcher = watch(distDir);
		this.#distWatcher.on("change", (_event, file) => {
			if (existsSync(distDir)) return;
			if (!this.#fileChangeTracker.shouldEmitChange(resolve(distDir, file || ""))) return;
			this.scheduleReload({ type: "dist-removed" });
		});
		this.#warmup.rearm();
		if ("handler" in this.#currentNuxt.server) this.#handler = this.#currentNuxt.server.handler;
		else if ("fetch" in this.#currentNuxt.server) this.#handler = toNodeHandler(this.#currentNuxt.server.fetch);
		else this.#handler = toNodeListener(this.#currentNuxt.server.app);
		const serverUrl = getAddressURL(addr, !!this.listener.https).replace(TRAILING_SLASH_RE, "");
		const currentBuildDir = this.#currentNuxt.options.buildDir;
		if (this.#lockedBuildDir !== currentBuildDir) this.#acquireDevLock(currentBuildDir);
		updateLock(currentBuildDir, {
			command: "dev",
			cwd: this.options.cwd,
			parentPid: devForkParentPid(),
			port: addr.port,
			hostname: addr.address,
			url: serverUrl
		});
		this.#progress.setReady();
		withErrorChannel((channel) => channel.clearError());
		this.emit("ready", serverUrl);
	}
	async close() {
		this.#closeWebSocketConnections();
		if (this.#currentNuxt) await this.#currentNuxt.close();
	}
	/** Publish a startup or build failure to the channel. */
	async #publishError(error) {
		let report;
		try {
			report = await createCliReport(error, { cwd: this.#rootDir() });
		} catch (reportError) {
			debug("Could not build a report for the error:", reportError);
			return;
		}
		if (this.#loadingFailure) this.#loadingFailure.report = report;
		if (this.#ownsChannel) try {
			(await useErrorChannel(this.#errorChannelOptions())).setError(report);
		} catch (channelError) {
			debug("Could not publish the error to the channel:", channelError);
		}
		return report;
	}
	/** Release the lock file. Call only on final shutdown, not during reloads. */
	releaseLock() {
		const takenOverBy = this.#lockedBuildDir && getTakeoverPid(this.#lockedBuildDir);
		if (takenOverBy) writeNotice(`Handed over to another \`nuxt dev\` (PID ${takenOverBy}).`);
		this.#lockCleanup?.();
		this.#lockCleanup = void 0;
		this.#lockedBuildDir = void 0;
	}
	#acquireDevLock(buildDir) {
		const lock = acquireLock(buildDir, {
			command: "dev",
			cwd: this.options.cwd,
			parentPid: devForkParentPid()
		}, { takeoverFrom: this.options.handoverFrom });
		if (lock.existing) throw new ActionableError(formatLockError(lock.existing));
		const previousRelease = this.#lockCleanup;
		this.#lockCleanup = lock.release;
		this.#lockedBuildDir = buildDir;
		previousRelease?.();
	}
	/**
	* Requests handed to the outgoing Nitro handler are never answered once it is
	* torn down, so respond (or drop the socket) before swapping the handler out.
	*/
	#settleInflightResponses() {
		const responses = [...this.#inflightResponses];
		this.#inflightResponses.clear();
		for (const res of responses) {
			if (res.writableEnded || res.destroyed) continue;
			if (res.headersSent) {
				res.destroy();
				continue;
			}
			this.#renderLoadingScreen(res.req, res).catch(() => res.destroy());
		}
	}
	#closeWebSocketConnections() {
		for (const socket of this.#websocketConnections) socket.destroy();
		this.#websocketConnections.clear();
	}
	async #load(reload, reason) {
		this.#loadingMessage = reload ? formatRestartReason(reason, {
			rootDir: this.#cwd,
			link: false
		}) : "Starting Nuxt...";
		this.#handler = void 0;
		this.#progress.start(this.#loadingMessage, !!reload);
		this.#settleInflightResponses();
		this.emit("loading", this.#loadingMessage);
		await this.close();
		const urls = this.listener.getURLs().map(({ url }) => url);
		try {
			await this.#loadNuxtInstance(urls);
		} finally {
			if (reload) this.#reportReload(withConfigKeys(reason, this.#changedConfigKeys));
		}
		await this.#initializeNuxt(!!reload);
	}
	#watchConfig() {
		this.#configWatcher = createConfigWatcher(this.#cwd, this.options.dotenv.fileName, (file) => this.emit("restart", {
			type: "config",
			files: [file]
		}), (file) => {
			this.emit("change");
			this.scheduleReload({
				type: "config",
				files: [file]
			});
		}, getLocalLayerDirs(this.#currentNuxt?.options._layers ?? [], this.#cwd));
	}
};
/** Whether anyone is watching this terminal, directly or through the panel. */
function isInteractive() {
	return !!process.stdout.isTTY || !!process.env.__NUXT_DEV_PIPED_TTY__;
}
function getAddressURL(addr, https) {
	const proto = https ? "https" : "http";
	let host = addr.address.includes(":") ? `[${addr.address}]` : addr.address;
	if (host === "[::]") host = "localhost";
	const port = addr.port || 3e3;
	return `${proto}://${host}:${port}/`;
}
function resolveDevServerHTTPS(certificate) {
	if (!certificate) return false;
	if (certificate.pfxPath) return {
		pfx: certificate.pfxPath,
		passphrase: certificate.passphrase ?? ""
	};
	return {
		key: certificate.key,
		cert: certificate.cert
	};
}
function dedupe(values) {
	return [...new Set(values)];
}
/**
* Config the CLI injects on behalf of the live listener.
*
* Everything returned here is confined to `vite.server` and `devServer`, which
* Vite leaves out of its dependency optimiser hash. A port-derived or per-run
* value anywhere else would re-optimise dependencies on every start.
*/
function resolveDevServerDefaults(listenOptions, urls = []) {
	const defaultConfig = {};
	if (urls && urls.length > 0) defaultConfig.vite = { server: { allowedHosts: urls.map((u) => new URL(u).hostname) } };
	if (listenOptions.hostname) {
		defaultConfig.devServer = { cors: { origin: [`${listenOptions.https ? "https" : "http"}://${listenOptions.hostname}`, ...urls] } };
		defaultConfig.vite = defu(defaultConfig.vite, { server: { allowedHosts: [listenOptions.hostname] } });
	}
	const portlessOrigins = resolvePortlessURLs().all;
	if (portlessOrigins.length > 0) defaultConfig.devServer = defu(defaultConfig.devServer, { cors: { origin: portlessOrigins } });
	const allowedHosts = defaultConfig.vite?.server?.allowedHosts;
	if (Array.isArray(allowedHosts)) defaultConfig.vite.server.allowedHosts = dedupe(allowedHosts);
	const corsOrigin = defaultConfig.devServer?.cors?.origin;
	if (Array.isArray(corsOrigin)) defaultConfig.devServer.cors.origin = dedupe(corsOrigin);
	return defaultConfig;
}
//#endregion
//#region src/dev/index.ts
const start = Date.now();
const REQUEST_FLUSH_MS = 100;
const REQUEST_BATCH_LIMIT = 200;
/** A cold page load compiles hundreds of modules, each reported as a span. */
const SPAN_BATCH_LIMIT = 5e3;
const PENDING_REQUEST_BATCHES = 20;
const PENDING_LOG_LIMIT = 500;
const PENDING_REPORTS = 20;
/**
* How often a piped startup repeats the phase it is on, and the shortest gap
* between two narration lines within one phase. A single phase can hold a
* startup for tens of seconds, which is a long silence in a log file.
*/
const STARTUP_HEARTBEAT_MS = 2500;
/**
* A fan-out that replays to the first subscriber, keeping at most `limit`
* values.
*
* The server logs, serves and reports routes while it loads, which is before
* the caller of {@link initialize} has had a chance to subscribe.
*/
function createFeed(limit) {
	const callbacks = /* @__PURE__ */ new Set();
	const pending = [];
	return {
		emit(value) {
			if (!callbacks.size) {
				pending.push(value);
				pending.splice(0, Math.max(0, pending.length - limit));
				return;
			}
			for (const callback of callbacks) callback(value);
		},
		subscribe(callback) {
			callbacks.add(callback);
			for (const value of pending.splice(0)) callback(value);
		}
	};
}
function formatErrorMessage(error) {
	return error instanceof Error ? error.toString() : "Unhandled Rejection";
}
/**
* Hand an unhandled rejection to the parent process and stop this one, unless
* it is only a client that went away. That is traffic, not a crash, and the
* session has to survive it.
*/
function createRejectionHandler(report, stop) {
	return (reason) => {
		if (isRemotePeerError(reason)) {
			debug("Ignoring remote peer error:", reason);
			return;
		}
		report(formatErrorMessage(reason));
		stop();
	};
}
var IPC = class {
	enabled = !!process.send && !process.title?.includes("vitest") && process.env.__NUXT__FORK;
	#shutdown;
	#closing;
	constructor() {
		if (this.enabled) {
			for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => void this.close());
			process.once("disconnect", () => {
				if (!this.#closing) process.exit(0);
			});
			process.on("unhandledRejection", createRejectionHandler((message) => this.send({
				type: "nuxt:internal:dev:rejection",
				message
			}), () => process.exit()));
		}
		process.on("message", async (message) => {
			if (message.type === "nuxt:internal:dev:context") {
				if (message.inspect) await openInspector(message.inspect);
				await initialize(message.context, { listenOverrides: message.listenOverrides });
			} else if (message.type === "nuxt:internal:dev:shutdown") await this.close();
			else if (message.type === "nuxt:internal:dev:resize") process.env.__NUXT_DEV_COLUMNS__ = String(message.columns);
		});
		this.send({ type: "nuxt:internal:dev:fork-ready" });
	}
	/** Register the shutdown routine to run before this fork exits. */
	onShutdown(handler) {
		this.#shutdown = handler;
	}
	/**
	* Run the dev server's `close` hooks to completion before exiting, so user code
	* (nitro plugins, database connections) can tear itself down.
	*/
	close() {
		this.#closing ??= (async () => {
			try {
				await this.#shutdown?.();
			} catch (error) {
				debug("Could not shut the dev server down cleanly:", error);
			} finally {
				process.exit(0);
			}
		})();
		return this.#closing;
	}
	send(message) {
		if (this.enabled) process.send?.(message);
	}
};
const ipc = new IPC();
if (ipc.enabled && process.env.__NUXT_DEV_PIPED_TTY__) {
	consola.options.formatOptions.date = false;
	consola.wrapAll();
	consola.addReporter({ log(logObj) {
		const request = currentRequest();
		ipc.send({
			type: "nuxt:internal:dev:log",
			level: logObj.level,
			logType: logObj.type,
			tag: logObj.tag || void 0,
			message: formatWithOptions({ colors: false }, ...logObj.args),
			origin: request ? "runtime" : "build",
			request: request?.label,
			requestId: request?.id,
			raw: true
		});
	} });
}
async function initialize(devContext, ctx = {}) {
	overrideEnv("development");
	await configureProjectConsola(devContext.cwd);
	const profileArg = devContext.args.profile;
	const profiling = profileArg !== void 0;
	const perfValue = profileArg === "verbose" ? true : profiling ? "quiet" : void 0;
	const perfOverrides = perfValue ? { debug: { perf: perfValue } } : {};
	if (profiling) await startCpuProfile();
	const captureUIEvents = ipc.enabled ? !!process.env.__NUXT_DEV_PIPED_TTY__ : !!ctx.captureUIEvents;
	const devServer = new NuxtDevServer({
		cwd: devContext.cwd,
		overrides: defu(ctx.data?.overrides, { extends: devContext.args.extends }, perfOverrides),
		logLevel: devContext.args.logLevel,
		clear: devContext.args.clear,
		dotenv: {
			cwd: devContext.cwd,
			fileName: resolveDotenvFileNames(devContext.args.dotenv)
		},
		envName: devContext.args.envName,
		showBanner: ctx.showBanner !== false && !ipc.enabled,
		listenOverrides: ctx.listenOverrides,
		handoverFrom: devContext.handoverFrom,
		captureUIEvents
	});
	let address;
	if (ipc.enabled) {
		devServer.on("loading:error", (_error) => {
			ipc.send({
				type: "nuxt:internal:dev:loading:error",
				error: {
					message: _error.message,
					stack: _error.stack,
					name: _error.name,
					code: "code" in _error ? _error.code : void 0
				}
			});
		});
		devServer.on("loading", (message) => {
			ipc.send({
				type: "nuxt:internal:dev:loading",
				message
			});
		});
		devServer.on("restart", (reason) => {
			ipc.send({
				type: "nuxt:internal:dev:restart",
				reason
			});
		});
		devServer.on("ready", (payload) => {
			ipc.send({
				type: "nuxt:internal:dev:ready",
				address: payload
			});
		});
	} else devServer.on("ready", (payload) => {
		address = payload;
	});
	const logs = createFeed(PENDING_LOG_LIMIT);
	const requests = createFeed(PENDING_REQUEST_BATCHES);
	const spans = createFeed(PENDING_REQUEST_BATCHES);
	const routes = createFeed(1);
	const building = createFeed(0);
	const reports = createFeed(PENDING_REPORTS);
	const reportsCleared = createFeed(0);
	devServer.on("report", (report) => {
		if (ipc.enabled) ipc.send({
			type: "nuxt:internal:dev:report",
			report
		});
		else if (captureUIEvents) reports.emit(report);
		if (!captureUIEvents) writeDirect(`${blankLineBefore()}${formatReportForTerminal(report)}\n`);
	});
	devServer.on("report:clear", (id) => {
		if (ipc.enabled) ipc.send({
			type: "nuxt:internal:dev:report:clear",
			id
		});
		else if (captureUIEvents) reportsCleared.emit(id);
	});
	let closeLogChannel;
	let closeSpanChannel;
	if (captureUIEvents) {
		const { openDevLogChannel } = await import("../log-channel-DEjp4g0E.mjs");
		closeLogChannel = openDevLogChannel((log) => {
			if (ipc.enabled) {
				ipc.send({
					type: "nuxt:internal:dev:log",
					...log
				});
				return;
			}
			logs.emit(log);
		});
		const { openDevSpanChannel } = await import("../span-channel-CmmfG3vs.mjs");
		let spanBatch = [];
		let spanTimer;
		const pushSpan = (span) => {
			spanBatch.push(span);
			if (spanBatch.length > SPAN_BATCH_LIMIT) spanBatch.shift();
			spanTimer ??= setTimeout(() => {
				spanTimer = void 0;
				const flushed = spanBatch;
				spanBatch = [];
				if (ipc.enabled) {
					ipc.send({
						type: "nuxt:internal:dev:spans",
						spans: flushed
					});
					return;
				}
				spans.emit(flushed);
			}, REQUEST_FLUSH_MS);
			spanTimer.unref?.();
		};
		closeSpanChannel = openDevSpanChannel(pushSpan);
		devServer.on("span", pushSpan);
		devServer.on("building", (value) => {
			if (ipc.enabled) {
				ipc.send({
					type: "nuxt:internal:dev:building",
					building: value
				});
				return;
			}
			building.emit(value);
		});
		devServer.on("routes", (payload) => {
			if (ipc.enabled) {
				ipc.send({
					type: "nuxt:internal:dev:routes",
					payload
				});
				return;
			}
			routes.emit(payload);
		});
		if (ipc.enabled) {
			let reported;
			devServer.progress.onUpdate(({ status, pending, serving }) => {
				const rendering = status === "ready" ? pending : void 0;
				if (rendering?.label === reported) return;
				reported = rendering?.label;
				ipc.send({
					type: "nuxt:internal:dev:rendering",
					pending: rendering,
					awaiting: !serving
				});
			});
		}
		let batch = [];
		let flushTimer;
		devServer.on("request", (event) => {
			batch.push(event);
			if (batch.length > REQUEST_BATCH_LIMIT) batch.shift();
			flushTimer ??= setTimeout(() => {
				flushTimer = void 0;
				const flushed = batch;
				batch = [];
				if (!flushed.length) return;
				if (ipc.enabled) {
					ipc.send({
						type: "nuxt:internal:dev:requests",
						requests: flushed
					});
					return;
				}
				requests.emit(flushed);
			}, REQUEST_FLUSH_MS);
			flushTimer.unref?.();
		});
	}
	if (ctx.onProgress) devServer.progress.onUpdate(ctx.onProgress);
	if (ctx.onListening) devServer.on("listening", (info) => ctx.onListening(info));
	const reporter = devContext.args.logLevel === "silent" || ipc.enabled || ctx.captureUIEvents ? void 0 : createPhaseReporter({ heartbeat: STARTUP_HEARTBEAT_MS });
	const unsubscribeProgress = reporter && devServer.progress.onUpdate(reporter.update);
	if (reporter) devServer.on("listening", ({ url }) => reporter.setURL(url));
	const stopReporting = () => {
		unsubscribeProgress?.();
		reporter?.stop();
	};
	try {
		await devServer.init();
	} finally {
		const snapshot = devServer.progress.snapshot;
		if (!reporter || snapshot?.status !== "ready" || snapshot.serving) stopReporting();
		else {
			const unsubscribeServing = devServer.progress.onUpdate((snapshot) => {
				if (snapshot.serving || snapshot.status === "error") {
					unsubscribeServing();
					stopReporting();
				}
			});
		}
	}
	if (process.env.DEBUG) console.debug(`Dev server (internal) initialized in ${Date.now() - start}ms`);
	if (profiling) for (const signal of [
		"exit",
		"SIGTERM",
		"SIGINT",
		"SIGQUIT"
	]) process.once(signal, () => stopCpuProfile(devContext.cwd, "dev"));
	let closePromise;
	const armRestart = createRestartHook(devServer);
	const close = () => {
		closePromise ??= (async () => {
			closeLogChannel?.();
			closeSpanChannel?.();
			devServer.shutdown();
			try {
				await Promise.all([devServer.listener.close(), devServer.close()]);
			} finally {
				devServer.progress.close();
				await closeErrorChannel();
				devServer.releaseLock();
			}
		})();
		return closePromise;
	};
	ipc.onShutdown(close);
	return {
		listener: devServer.listener,
		reload: (reason) => devServer.load(true, reason),
		close,
		onReady: (callback) => {
			if (address) callback(address);
			else devServer.once("ready", (payload) => callback(payload));
		},
		onLoading: (callback) => {
			devServer.on("loading", callback);
		},
		onEachReady: (callback) => {
			devServer.on("ready", () => callback());
		},
		onLog: logs.subscribe,
		onRequests: requests.subscribe,
		onSpans: spans.subscribe,
		onBuilding: building.subscribe,
		onReport: reports.subscribe,
		onReportClear: reportsCleared.subscribe,
		onRoutes: routes.subscribe,
		onFileChange: (callback) => {
			devServer.once("change", callback);
		},
		onRestart: armRestart
	};
}
/**
* Connect the triggers for a hard restart (an explicit `restart` event, and
* errors that leave this process unable to serve) to a single callback, which
* fires at most once per arming. Re-arming after a restart that could not be
* completed swaps the callback in without stacking another set of listeners.
*/
function createRestartHook(source) {
	let callback;
	let fired = false;
	let armed = false;
	function restart(reason) {
		if (fired) return;
		fired = true;
		armed = false;
		source.off("restart", restart);
		process.off("uncaughtException", restartOnError);
		process.off("unhandledRejection", restartOnError);
		callback?.(reason);
	}
	function restartOnError(error) {
		if (isRemotePeerError(error)) {
			debug("Ignoring remote peer error:", error);
			return;
		}
		restart({
			type: "error",
			message: formatErrorMessage(error)
		});
	}
	restartOnError[KEEPS_PROCESS_ALIVE] = true;
	return (next) => {
		callback = next;
		fired = false;
		if (armed) return;
		armed = true;
		source.once("restart", restart);
		process.on("uncaughtException", restartOnError);
		process.on("unhandledRejection", restartOnError);
	};
}
//#endregion
export { createRejectionHandler, createRestartHook, initialize };
