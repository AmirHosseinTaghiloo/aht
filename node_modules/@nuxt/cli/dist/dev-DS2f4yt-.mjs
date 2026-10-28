import { c as profileArgs, h as defineCommand, i as extendsArgs, l as rootDirArgs, n as dotEnvArgs, r as envNameArgs, s as logLevelArgs } from "./_shared-YyGADOl7.mjs";
import { S as ActionableError, h as isInteractive, i as withUserAttention, s as debug, t as startupElapsedMs, u as logger, x as writeDirectTo } from "./startup-clock-DXZlxuSA.mjs";
import { t as tryResolveNuxt } from "./resolve-nuxt-VKCDOC-A.mjs";
import { c as withDirectStdout, o as restoreRawMode } from "./console-BgmzEcbV.mjs";
import { t as replaceCwdArg } from "./args-DGaOocsH.mjs";
import { c as openInspector, l as resolveInspectOptions, n as formatRestartReason, s as closeInspector } from "./reason-BzYs8eZ4.mjs";
import { t as NUXT_PACKAGES } from "./nuxt-packages-2vh2Ybse.mjs";
import { i as isReusePortSupported, s as parsePort } from "./listen-BjyzPJ2X.mjs";
import { i as resolveRootDir, n as relativeTo } from "./paths-DlXZaaIg.mjs";
import { t as createSpinner } from "./spinner-Cj-5sQW4.mjs";
import { t as CONFIG_EXTENSIONS } from "./nuxt-config-zyufWWwx.mjs";
import { i as resolveLockDir } from "./dev-server-C7zAaNG-.mjs";
import { n as FORCE_KILL_TIMEOUT_MS, r as handleShutdownSignals } from "./shutdown-BavsC3O_.mjs";
import { devShortcutContext } from "./shortcut-context-B1rQszYJ.mjs";
import { n as takeOverServer, t as formatTakeoverRefusal } from "./takeover-4jL0B_PO.mjs";
import { beginDevUI, setupDevUI, teardownDevUI } from "./controller-jGDcJtoA.mjs";
import process from "node:process";
import { styleText } from "node:util";
import { isBun, isTest } from "std-env";
import { confirm, isCancel } from "@clack/prompts";
import { dirname, join } from "pathe";
import { accessSync, constants, existsSync, readFileSync, readdirSync } from "node:fs";
import { fork } from "node:child_process";
import { satisfies } from "verkit";
//#region src/dev/pool.ts
var ForkPool = class {
	forks = /* @__PURE__ */ new Set();
	/** Forks that are starting or ready and not yet handed out. */
	idle = [];
	poolSize;
	warming = false;
	options;
	constructor(options) {
		this.options = options;
		this.poolSize = options.poolSize ?? 1;
		if (options.pipeOutput) process.stdout.on("resize", () => {
			for (const fork of this.forks) if (fork.process.connected) fork.process.send({
				type: "nuxt:internal:dev:resize",
				columns: process.stdout.columns || 80
			}, () => {});
		});
		process.once("exit", () => this.killAll("SIGTERM"));
		process.once("SIGQUIT", () => this.killAll("SIGQUIT"));
	}
	startWarming() {
		if (!this.warming) {
			this.warming = true;
			this.fill();
		}
	}
	async getFork(context, options = {}) {
		this.warming = true;
		const fork = this.idle.find((f) => f.isReady) ?? this.idle[0] ?? this.createFork();
		this.idle = this.idle.filter((f) => f !== fork);
		await fork.ready;
		const serving = trackServing(fork.process);
		serving.catch(() => {});
		const onMessage = options.onMessage;
		if (onMessage) fork.process.on("message", (message) => {
			if (message.type !== "nuxt:internal:dev:fork-ready") onMessage(message);
		});
		fork.process.send({
			type: "nuxt:internal:dev:context",
			listenOverrides: {
				...this.options.listenOverrides,
				...options.listenOverrides
			},
			inspect: this.options.inspect,
			context
		});
		this.fill();
		return {
			pid: fork.process.pid,
			serving,
			promote: () => {
				fork.serving = true;
			},
			close: () => this.closeFork(fork)
		};
	}
	fill() {
		while (this.idle.length < this.poolSize) this.idle.push(this.createFork());
	}
	/** `ready` rejects if the fork exits before it reports readiness. */
	createFork() {
		const pipeOutput = this.options.pipeOutput;
		const childProc = fork(globalThis.__nuxt_cli__.devEntry, this.options.rawArgs, {
			execArgv: ["--enable-source-maps"],
			stdio: pipeOutput ? [
				"ignore",
				"pipe",
				"pipe",
				"ipc"
			] : void 0,
			env: {
				...withoutDotenvVars(process.env),
				__NUXT__FORK: "true",
				...pipeOutput ? {
					__NUXT_DEV_PIPED_TTY__: "1",
					__NUXT_DEV_COLUMNS__: String(process.stdout.columns || 80),
					...forcedColorEnv()
				} : {}
			}
		});
		if (pipeOutput) {
			childProc.stdout?.on("data", (chunk) => writeDirectTo(process.stdout, chunk));
			childProc.stderr?.on("data", (chunk) => writeDirectTo(process.stderr, chunk));
		}
		const pooledFork = {
			process: childProc,
			ready: new Promise((resolve, reject) => {
				childProc.on("message", (message) => {
					if (message.type === "nuxt:internal:dev:fork-ready") resolve();
				});
				childProc.on("error", reject);
				childProc.on("close", () => reject(/* @__PURE__ */ new Error("Dev server fork exited before it finished starting.")));
			}),
			isReady: false,
			closing: false,
			serving: false
		};
		pooledFork.ready.then(() => {
			pooledFork.isReady = true;
		}, () => {});
		this.forks.add(pooledFork);
		childProc.on("error", () => this.forget(pooledFork));
		childProc.on("close", (errorCode) => {
			if (pooledFork.serving && errorCode) {
				logger.error(`The dev server process (PID ${childProc.pid}) exited with code ${errorCode}.`);
				process.exit(errorCode);
			}
			this.forget(pooledFork);
		});
		return pooledFork;
	}
	/** Ask a fork to run its `close` hooks and exit, signalling it if that fails or takes too long. */
	async closeFork(fork) {
		const alive = !fork.closing && fork.process.exitCode === null;
		fork.closing = true;
		fork.serving = false;
		this.forget(fork);
		if (!alive) return;
		const exited = waitForExit(fork.process);
		if (fork.process.connected) {
			fork.process.send({ type: "nuxt:internal:dev:shutdown" }, (error) => {
				if (error) fork.process.kill("SIGTERM");
			});
			if (await settlesWithin(exited, 1e4)) return;
			debug(`Dev server fork ${fork.process.pid} did not shut down in time, terminating it`);
		}
		fork.process.kill("SIGTERM");
		if (await settlesWithin(exited, 2e3)) return;
		fork.process.kill("SIGKILL");
		await settlesWithin(exited, FORCE_KILL_TIMEOUT_MS);
	}
	forget(fork) {
		this.forks.delete(fork);
		this.idle = this.idle.filter((f) => f !== fork);
	}
	killAll(signal) {
		for (const fork of this.forks) {
			fork.serving = false;
			fork.process.kill(signal);
		}
		this.forks.clear();
		this.idle = [];
	}
};
/** Resolves when the fork is answering requests, including with an error page. */
function trackServing(child) {
	return new Promise((resolve, reject) => {
		function settle(finish) {
			child.off("message", onMessage);
			child.off("close", onExit);
			child.off("error", onExit);
			finish();
		}
		function onMessage(message) {
			if (message.type === "nuxt:internal:dev:ready" || message.type === "nuxt:internal:dev:loading:error") settle(resolve);
		}
		function onExit() {
			settle(() => reject(/* @__PURE__ */ new Error("Dev server fork exited before it was ready.")));
		}
		child.on("message", onMessage);
		child.once("close", onExit);
		child.once("error", onExit);
	});
}
function withoutDotenvVars(env) {
	const dotenvVars = globalThis.__c12_dotenv_vars__?.get(env);
	if (!dotenvVars?.size) return env;
	return Object.fromEntries(Object.entries(env).filter(([key]) => !dotenvVars.has(key)));
}
/** Colour settings for a piped fork, which cannot detect colour support itself. */
function forcedColorEnv() {
	if (process.env.NO_COLOR || process.env.FORCE_COLOR) return {};
	const depth = process.stdout.getColorDepth?.() ?? 1;
	if (depth <= 1) return {};
	return {
		FORCE_COLOR: depth >= 24 ? "3" : depth >= 8 ? "2" : "1",
		__NUXT_DEV_COLOR_DEPTH__: String(depth)
	};
}
function waitForExit(child) {
	return new Promise((resolve) => {
		child.once("exit", () => resolve());
		child.once("close", () => resolve());
	});
}
/** Resolves `true` if the promise settles before the timeout, `false` otherwise. */
function settlesWithin(promise, timeout) {
	return new Promise((resolve) => {
		const timer = setTimeout(resolve, timeout, false);
		timer.unref?.();
		promise.then(() => {
			clearTimeout(timer);
			resolve(true);
		});
	});
}
//#endregion
//#region src/dev/preflight.ts
/**
* Extensions `c12` accepts for a config it parses rather than imports. Reporting
* a project as missing is worse than looking in a few more places, so the whole
* set is checked here even though only the importable ones can be loaded.
*/
const DATA_CONFIG_EXTENSIONS = [
	".json",
	".jsonc",
	".json5",
	".yaml",
	".yml",
	".toml"
];
const ALL_CONFIG_EXTENSIONS = [...CONFIG_EXTENSIONS, ...DATA_CONFIG_EXTENSIONS];
const CONFIG_FILENAMES = new Set(ALL_CONFIG_EXTENSIONS.map((extension) => `nuxt.config${extension}`));
/** The same configs, under both names `c12` accepts inside `.config/`. */
const CONFIG_DIR_FILENAMES = /* @__PURE__ */ new Set([...CONFIG_FILENAMES, ...ALL_CONFIG_EXTENSIONS.map((extension) => `nuxt${extension}`)]);
function containsAny(dir, filenames) {
	try {
		return readdirSync(dir).some((entry) => filenames.has(entry));
	} catch {
		return false;
	}
}
/**
* Whether `dir` holds a Nuxt config in any of the places `c12` looks: alongside
* `package.json`, or in `.config/` as `nuxt.<ext>` or `nuxt.config.<ext>`.
*/
function isNuxtConfigPresent(dir) {
	return containsAny(dir, CONFIG_FILENAMES) || containsAny(join(dir, ".config"), CONFIG_DIR_FILENAMES);
}
function readPackageJson(dir) {
	try {
		return JSON.parse(readFileSync(join(dir, "package.json"), "utf-8"));
	} catch {
		return;
	}
}
function declaresNuxt(packageJson) {
	if (!packageJson) return false;
	const dependencies = {
		...packageJson.dependencies,
		...packageJson.devDependencies
	};
	return NUXT_PACKAGES.some((name) => name in dependencies);
}
/**
* Decide whether `dir` is a Nuxt project, and if not, whether one of its
* ancestors is: running `nuxt dev` one directory too deep otherwise silently
* boots an unrelated, empty app rooted at the subdirectory.
*
* An ancestor has to hold a config to count. A monorepo root commonly depends on
* `nuxt` for tooling without being an app, and offering to run it would be worse
* advice than none.
*/
function locateProject(dir) {
	if (isNuxtConfigPresent(dir) || declaresNuxt(readPackageJson(dir))) return { isProject: true };
	let current = dir;
	let parent = dirname(current);
	while (parent !== current) {
		if (isNuxtConfigPresent(parent)) return {
			isProject: false,
			ancestor: parent
		};
		current = parent;
		parent = dirname(parent);
	}
	return { isProject: false };
}
/**
* Check the things that stop `nuxt dev` from starting, before it starts.
*
* Problems that can be resolved without guessing are resolved (installing
* dependencies); the rest are reported as an error whose message contains the
* command to run. Everything interactive degrades to that error when there is
* no TTY.
*
* Returns the directory to start in, which is the one given unless the user
* asked to run in a project found above it.
*
* @throws {ActionableError} when the dev server cannot usefully be started.
*/
async function runDevPreflight(options) {
	const interactive = options.interactive ?? isInteractive();
	const cwd = await resolveProjectDirectory(options.cwd, interactive);
	checkWritableBuildDir(cwd);
	await checkDependencies(cwd, interactive);
	return cwd;
}
/**
* The project directory to start in. Running one directory too deep is a typo
* rather than an intent, so the project above is offered instead of refused.
*/
async function resolveProjectDirectory(cwd, interactive) {
	const location = locateProject(cwd);
	if (location.isProject) return cwd;
	if (location.ancestor) {
		const relative = relativeTo(cwd, location.ancestor, { link: false });
		if (interactive) {
			logger.warn(`${styleText("cyan", cwd)} is not a Nuxt project, but ${styleText("cyan", location.ancestor)} is.`);
			const answer = await withUserAttention(() => confirm({
				message: `Run there instead?`,
				initialValue: true
			}));
			restoreRawMode();
			if (!isCancel(answer) && answer) return location.ancestor;
		}
		throw new ActionableError([
			`${styleText("red", "No Nuxt project in")} ${styleText("cyan", cwd)}${styleText("red", ".")}`,
			"",
			`A Nuxt project was found in ${styleText("cyan", location.ancestor)}. Run it from there:`,
			`  ${styleText("cyan", `cd ${relative} && nuxt dev`)}`,
			`or point the CLI at it: ${styleText("cyan", `nuxt dev --cwd ${relative}`)}`
		].join("\n"));
	}
	throw new ActionableError([
		`${styleText("red", "No Nuxt project in")} ${styleText("cyan", cwd)}${styleText("red", ".")}`,
		"",
		`There is no ${styleText("cyan", "nuxt.config")} here and no ${styleText("cyan", "nuxt")} dependency in ${styleText("cyan", "package.json")}.`,
		`Create one with ${styleText("cyan", "nuxt init")}, or run ${styleText("cyan", "nuxt dev")} from an existing project.`
	].join("\n"));
}
/**
* A read-only `.nuxt` otherwise surfaces as an unhandled `EACCES` rejection
* from whichever write happens to get there first, long after the banner.
*
* Only the default build directory is checked; a configured one is not known
* until the config has been read. Write access is not enough on its own: a
* directory also has to be searchable for anything inside it to be opened.
* Neither bit reflects Windows ACLs or the privileges of a root user, so on
* those the check passes and the write still fails, as it did before.
*/
function checkWritableBuildDir(cwd) {
	const buildDir = join(cwd, ".nuxt");
	const target = existsSync(buildDir) ? buildDir : cwd;
	try {
		accessSync(target, constants.W_OK | constants.X_OK);
	} catch {
		throw new ActionableError([
			`${styleText("red", "Nuxt cannot write to")} ${styleText("cyan", target)}${styleText("red", ".")}`,
			"",
			`Grant write access with ${styleText("cyan", `chmod u+wx ${relativeTo(cwd, target, { link: false })}`)}, or remove the directory and try again.`
		].join("\n"));
	}
}
async function checkDependencies(cwd, interactive) {
	if (tryResolveNuxt(cwd)) return;
	const packageJson = readPackageJson(cwd);
	if (!packageJson) throw new ActionableError([
		`${styleText("red", "There is no readable")} ${styleText("cyan", "package.json")} ${styleText("red", "in")} ${styleText("cyan", cwd)}${styleText("red", ".")}`,
		"",
		`Create or repair it, then add ${styleText("cyan", "nuxt")} as a dependency.`
	].join("\n"));
	if (!declaresNuxt(packageJson)) {
		const { name } = await detectInstaller(cwd);
		throw new ActionableError([
			`${styleText("red", "`nuxt` is not a dependency of this project.")}`,
			"",
			`Add it with ${styleText("cyan", `${name} add nuxt`)}, or run ${styleText("cyan", "nuxt init")} to start a new project.`
		].join("\n"));
	}
	await withUserAttention(() => offerInstall(cwd, interactive));
}
async function detectInstaller(cwd) {
	const { defaultPackageManager, detectPackageManager } = await import("./package-managers-B9HZ9pY9.mjs").then((n) => n.s);
	return await detectPackageManager(cwd) ?? defaultPackageManager;
}
async function offerInstall(cwd, interactive) {
	const packageManager = await detectInstaller(cwd);
	const command = `${packageManager.name} install`;
	const reason = "Dependencies are not installed.";
	if (!interactive) throw new ActionableError(`${reason}\nRun ${styleText("cyan", command)} first.`);
	logger.warn(reason);
	const answer = await confirm({
		message: `Run ${styleText("cyan", command)} now?`,
		initialValue: true
	});
	restoreRawMode();
	if (isCancel(answer) || !answer) throw new ActionableError(`${styleText("red", "Cannot start the dev server without dependencies.")}\nRun ${styleText("cyan", command)} and try again.`);
	const { createInstallLog, runInstall } = await import("./install-DSVDREZm.mjs").then((n) => n.n);
	const controller = new AbortController();
	const installLog = createInstallLog();
	const installSpinner = createSpinner({
		indicator: "timer",
		onCancel: () => controller.abort()
	});
	installSpinner.start(`Installing with ${styleText("cyan", packageManager.name)}`);
	const result = await runInstall({
		cwd,
		packageManager,
		onOutput: installLog.onOutput,
		onStatus: (message) => installSpinner.message(message),
		signal: controller.signal
	});
	if (!result.success) {
		installSpinner.error(result.error ?? "Install failed");
		installLog.finish(result);
		throw new ActionableError(`${styleText("red", "Dependencies could not be installed.")}\nFix the error above, then run ${styleText("cyan", command)} and try again.`);
	}
	installSpinner.stop("Dependencies installed");
	installLog.finish(result);
}
/**
* Run preflight, letting its advice reach the user and swallowing anything else,
* and return the directory the dev server should start in.
*
* A bug in a check must never be the reason `nuxt dev` refuses to start, so only
* an {@link ActionableError} propagates.
*/
async function preflight(options) {
	try {
		return await withDirectStdout(() => runDevPreflight(options));
	} catch (error) {
		if (error instanceof ActionableError) throw error;
		debug("Preflight check failed:", error);
		return options.cwd;
	}
}
//#endregion
//#region src/commands/dev.ts
const startTime = Date.now();
const forkSupported = !isTest && (!isBun || isBunForkSupported());
const command = defineCommand({
	meta: {
		name: "dev",
		description: "Run Nuxt development server"
	},
	args: {
		...rootDirArgs,
		...logLevelArgs,
		...dotEnvArgs,
		...envNameArgs,
		...extendsArgs,
		"inspect": {
			type: "boolean",
			description: "Enable the Node.js inspector for server code (`--inspect=[host:]port`), and for the CLI process on the next port"
		},
		"inspect-brk": {
			type: "boolean",
			description: "Like `--inspect`, and wait for a debugger to attach to the CLI process before loading Nuxt (`--inspect-brk=[host:]port`)"
		},
		"tui": {
			type: "boolean",
			description: "Interactive terminal UI (pinned status panel, folded logs and single-key shortcuts)",
			negativeDescription: "Disable the interactive terminal UI and stream logs instead",
			default: true
		},
		"clear": {
			type: "boolean",
			description: "Clear console on restart",
			default: false
		},
		"fork": {
			type: "boolean",
			description: "Serve the app from a forked child process (on by default wherever the runtime supports it)",
			negativeDescription: "Disable forked mode",
			default: forkSupported,
			alias: ["f"]
		},
		"port": {
			type: "string",
			description: "Port to listen on (default: `NUXT_PORT || NITRO_PORT || PORT || nuxtOptions.devServer.port`)",
			valueHint: "port",
			alias: ["p"]
		},
		"takeover": {
			type: "boolean",
			description: "Stop a dev server already running on this project and take its place",
			negativeDescription: "Never stop a dev server already running on this project"
		},
		"strictPort": {
			type: "boolean",
			description: "Exit if the requested port is unavailable instead of using another one",
			default: false
		},
		"host": {
			type: "string",
			description: "Host to listen on (default: `NUXT_HOST || NITRO_HOST || HOST || nuxtOptions.devServer?.host`)",
			valueHint: "host",
			alias: ["h"]
		},
		"open": {
			type: "boolean",
			description: "Open the URL in the browser",
			alias: ["o"],
			default: false
		},
		"open.url": {
			type: "string",
			description: "Path or URL to open instead of the dev server root",
			valueHint: "url|path"
		},
		"clipboard": {
			type: "boolean",
			description: "Copy the URL to the clipboard",
			default: false
		},
		"qr": {
			type: "boolean",
			description: "Print a QR code for the public URL (enabled by default when one is available)"
		},
		"tunnel": {
			type: "boolean",
			description: "Expose the server via a Cloudflare quick tunnel"
		},
		"public": {
			type: "boolean",
			description: "Listen on all network interfaces and allow any host to connect"
		},
		"publicURL": {
			type: "string",
			description: "Public URL to display (used for QR code and clipboard)",
			valueHint: "url"
		},
		"https": {
			type: "boolean",
			description: "Enable HTTPS with a locally-trusted development certificate"
		},
		"https.cert": {
			type: "string",
			description: "Path to TLS certificate",
			valueHint: "path"
		},
		"https.key": {
			type: "string",
			description: "Path to TLS key",
			valueHint: "path"
		},
		"https.pfx": {
			type: "string",
			description: "Path to PKCS#12 (.p12/.pfx) keystore",
			valueHint: "path"
		},
		"https.passphrase": {
			type: "string",
			description: "Passphrase for the TLS key or keystore",
			valueHint: "passphrase"
		},
		"https.validityDays": {
			type: "string",
			description: "Validity in days for a generated self-signed certificate",
			valueHint: "days"
		},
		"https.domains": {
			type: "string",
			description: "Domain for a generated certificate. Can be repeated, or given as a comma-separated list.",
			valueHint: "domain",
			multiple: true
		},
		...profileArgs,
		"sslCert": {
			type: "string",
			description: "(DEPRECATED) Use `--https.cert` instead.",
			hidden: true
		},
		"sslKey": {
			type: "string",
			description: "(DEPRECATED) Use `--https.key` instead.",
			hidden: true
		}
	},
	async run(ctx) {
		const requestedCwd = resolveRootDir(ctx.args);
		const cwd = await beforeServing(() => preflight({ cwd: requestedCwd }));
		if (cwd !== requestedCwd) replaceCwdArg(ctx.rawArgs, cwd, requestedCwd);
		const listenOverrides = resolveListenOverrides(ctx.args);
		const buildDir = await beforeServing(() => resolveLockDir(cwd));
		const takeover = await beforeServing(() => takeOverServer(buildDir, {
			requestedPort: parsePort(listenOverrides.port),
			takeover: ctx.args.takeover
		}));
		if (takeover.action === "refused") {
			await teardownDevUI();
			logger.error(formatTakeoverRefusal(takeover.existing, takeover.reason));
			process.exit(1);
		}
		if (takeover.action === "start-anyway") process.env.NUXT_IGNORE_LOCK = "1";
		if (takeover.action === "taken") listenOverrides.port = takeover.port;
		const profiling = ctx.args.profile !== void 0;
		const reusePort = ctx.args.fork && !profiling && await isReusePortSupported();
		listenOverrides.reusePort = reusePort;
		const inspect = resolveInspectOptions(ctx.rawArgs);
		if (inspect) await openInspector(inspect);
		const clearCaches = async () => {
			const { clearDevCaches } = await import("./nuxt-CCjsh7BJ.mjs").then((n) => n.i);
			return clearDevCaches(cwd, buildDir);
		};
		const uiOptions = {
			flag: ctx.args.tui,
			inspect: !!inspect,
			cwd,
			startTime
		};
		const session = await beginDevUI(uiOptions);
		const ui = !!session;
		if (ui) listenOverrides.showURL = false;
		const { context: shortcutContext, attach: attachServer, provide } = devShortcutContext();
		provide({ clearCaches });
		const startingUI = ui ? await setupDevUI(shortcutContext, {
			...uiOptions,
			enabled: true
		}) : void 0;
		handleShutdownSignals(() => shortcutContext.close());
		await new Promise((resolve) => setImmediate(resolve));
		const { initialize } = await import("./dev/index.mjs");
		const { listener, close, reload, onRestart, onReady, onLoading, onEachReady, onLog, onRequests, onSpans, onRoutes, onBuilding, onReport, onReportClear, onFileChange } = await initialize({
			cwd,
			args: ctx.args,
			handoverFrom: takeover.action === "taken" ? takeover.pid : void 0
		}, {
			data: ctx.data,
			listenOverrides,
			showBanner: !ui,
			captureUIEvents: ui,
			onProgress: session && ((snapshot) => session.reportProgress(snapshot)),
			onListening: session && ((info) => session.reportListening(info))
		}).catch((error) => {
			session?.teardown();
			throw error;
		});
		/** Feed the dev UI from the server running in this process. */
		function attachDevUI(devUI) {
			onLoading((message) => devUI.setStatus("building", message));
			onEachReady(() => devUI.setStatus("ready"));
			onBuilding((building) => devUI.setStatus(building ? "building" : "ready"));
			onLog((log) => devUI.pushServerLog(log));
			onRequests((requests) => devUI.pushRequests(requests));
			onSpans((spans) => devUI.pushSpans(spans));
			onReport((report) => devUI.pushReport(report));
			onReportClear((id) => devUI.clearReport(id));
			onRoutes((payload) => devUI.setRoutes(payload));
			return devUI;
		}
		if (!ctx.args.fork || profiling) {
			attachServer({
				listener,
				close,
				onReady,
				restart: () => reload({ type: "shortcut" })
			});
			attachDevUI(startingUI ?? await setupDevUI(shortcutContext, {
				...uiOptions,
				enabled: ui
			}));
			return {
				listener,
				close
			};
		}
		const pool = new ForkPool({
			rawArgs: ctx.rawArgs,
			poolSize: resolveForkPoolSize(),
			listenOverrides: {
				...listenOverrides,
				open: false,
				openURL: void 0
			},
			inspect,
			pipeOutput: ui
		});
		onReady((_address) => {
			if (startTime) debug(`Dev server ready for connections in ${startupElapsedMs(startTime)}ms`);
		});
		onFileChange(() => {
			pool.startWarming();
		});
		attachServer({
			listener,
			close: () => closeAll(),
			onReady,
			restart: () => restart({ type: "shortcut" })
		});
		const devUI = attachDevUI(startingUI ?? await setupDevUI(shortcutContext, {
			...uiOptions,
			enabled: ui
		}));
		let closeCurrent = close;
		let currentPid = process.pid;
		let inFlight;
		let pendingReason;
		function restartWithFork(reason) {
			if (inFlight) {
				pendingReason = { reason };
				return inFlight;
			}
			inFlight = replaceWithFork(reason).finally(() => {
				inFlight = void 0;
				const pending = pendingReason;
				pendingReason = void 0;
				if (pending) restartWithFork(pending.reason);
			});
			return inFlight;
		}
		async function replaceWithFork(reason) {
			const explanation = formatRestartReason(reason, {
				rootDir: cwd,
				hard: true
			});
			logger.info(explanation);
			devUI.setStatus("restarting", explanation);
			devUI.setRendering(void 0);
			const handover = reusePort && !inspect;
			const context = {
				cwd,
				args: ctx.args,
				handoverFrom: handover ? currentPid : void 0
			};
			if (!handover) await Promise.all([closeCurrent(), inspect ? closeInspector() : void 0]);
			let serving = false;
			let fork;
			try {
				fork = await pool.getFork(context, {
					listenOverrides: handover ? {
						port: listener.address.port,
						handover: true
					} : void 0,
					onMessage: (message) => {
						if (message.type === "nuxt:internal:dev:log") devUI.pushServerLog(message);
						else if (message.type === "nuxt:internal:dev:requests") devUI.pushRequests(message.requests);
						else if (message.type === "nuxt:internal:dev:spans") devUI.pushSpans(message.spans);
						else if (message.type === "nuxt:internal:dev:report") devUI.pushReport(message.report);
						else if (message.type === "nuxt:internal:dev:report:clear") devUI.clearReport(message.id);
						else if (message.type === "nuxt:internal:dev:routes") devUI.setRoutes(message.payload);
						else if (message.type === "nuxt:internal:dev:building") devUI.setStatus(message.building ? "building" : "ready");
						else if (message.type === "nuxt:internal:dev:rendering") devUI.setRendering(message.pending, message.awaiting);
						else if (message.type === "nuxt:internal:dev:ready" || message.type === "nuxt:internal:dev:loading:error") {
							serving = true;
							if (message.type === "nuxt:internal:dev:ready" && startTime) debug(`Dev server ready for connections in ${startupElapsedMs(startTime)}ms`);
							if (message.type === "nuxt:internal:dev:ready") devUI.setStatus("ready");
						} else if (message.type === "nuxt:internal:dev:loading" && serving) devUI.setStatus("building");
						else if (!serving) {} else if (message.type === "nuxt:internal:dev:restart") restartWithFork(message.reason);
						else if (message.type === "nuxt:internal:dev:rejection") restartWithFork({
							type: "error",
							message: message.message
						});
					}
				});
				await fork.serving;
			} catch (error) {
				await fork?.close();
				const detail = error instanceof Error ? error.message : String(error);
				if (!handover) {
					logger.error(`Could not restart the dev server: ${detail}`);
					process.exit(1);
				}
				logger.error(`Could not restart the dev server, keeping the current one: ${detail}`);
				devUI.settleRestart();
				onRestart(restart);
				return;
			}
			serving = true;
			devUI.setStatus("ready");
			fork.promote();
			const closePrevious = handover ? closeCurrent : void 0;
			closeCurrent = fork.close;
			currentPid = fork.pid ?? currentPid;
			await closePrevious?.();
		}
		async function restart(reason) {
			await restartWithFork(reason);
		}
		onRestart(restart);
		async function closeAll() {
			if (closeCurrent !== close) await closeCurrent();
			await close();
		}
		return { close: closeAll };
	}
});
/** Run work that must succeed before there is a server, freeing the terminal if it does not. */
async function beforeServing(work) {
	try {
		return await work();
	} catch (error) {
		await teardownDevUI();
		throw error;
	}
}
function resolveForkPoolSize() {
	const raw = process.env.NUXT_DEV_FORK_POOL_SIZE;
	if (!raw) return;
	const parsed = Number(raw);
	if (!Number.isInteger(parsed) || parsed < 0) {
		logger.warn(`Ignoring invalid \`NUXT_DEV_FORK_POOL_SIZE=${raw}\`; expected a non-negative integer.`);
		return;
	}
	return parsed;
}
function parsePositiveInteger(value) {
	const parsed = Number(value);
	if (!value || !Number.isInteger(parsed) || parsed <= 0) {
		if (value) logger.warn(`Ignoring invalid \`--https.validityDays=${value}\`; expected a positive number of days.`);
		return;
	}
	return parsed;
}
function resolveListenOverrides(args) {
	const httpsOptions = {
		cert: args["https.cert"] || args.sslCert || process.env.NUXT_SSL_CERT || process.env.NITRO_SSL_CERT || void 0,
		key: args["https.key"] || args.sslKey || process.env.NUXT_SSL_KEY || process.env.NITRO_SSL_KEY || void 0,
		pfx: args["https.pfx"] || void 0,
		passphrase: args["https.passphrase"] || void 0,
		validityDays: parsePositiveInteger(args["https.validityDays"]),
		domains: args["https.domains"]?.flatMap((value) => value.split(",")).map((domain) => domain.trim()).filter(Boolean)
	};
	const host = args.host ?? (process.env.NUXT_HOST || process.env.NITRO_HOST || process.env.HOST);
	return {
		port: args.port || process.env.NUXT_PORT || process.env.NITRO_PORT || process.env.PORT || void 0,
		strictPort: args.strictPort,
		hostname: host === true || host === "" ? "" : host || void 0,
		open: args.open || !!args["open.url"],
		openURL: args["open.url"] || void 0,
		clipboard: args.clipboard,
		qr: args.qr,
		tunnel: args.tunnel,
		public: args.public,
		publicURL: args.publicURL,
		httpsEnabled: args.https,
		https: httpsOptions
	};
}
function isBunForkSupported() {
	const bunVersion = globalThis.Bun.version;
	return satisfies(bunVersion, ">=1.2");
}
//#endregion
export { command as default, parsePositiveInteger, resolveListenOverrides };
