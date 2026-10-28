import { c as profileArgs, h as defineCommand, i as extendsArgs, l as rootDirArgs, n as dotEnvArgs, r as envNameArgs, s as logLevelArgs, u as targetArgs } from "./_shared-YyGADOl7.mjs";
import { S as ActionableError, c as intro, d as outro, u as logger } from "./startup-clock-DXZlxuSA.mjs";
import { n as resolveDotenvFileNames } from "./args-DGaOocsH.mjs";
import { t as overrideEnv } from "./env-BkMPEX1D.mjs";
import { i as stopCpuProfile, n as formatPhaseBreakdown, r as startCpuProfile, t as createPhaseReporter } from "./phase-reporter-xcVDefHV.mjs";
import { t as PhaseTimeline } from "./progress-snapshot-BsUn_089.mjs";
import { n as formatDuration } from "./formatting-Co5DEjad.mjs";
import { r as showBanner } from "./banner-lMLtjrKS.mjs";
import { t as clearBuildDir } from "./fs-CSqg02ri.mjs";
import { t as loadKit } from "./kit-CbhDo9Zs.mjs";
import { a as formatLockError, n as acquireOutputLock, t as acquireLock } from "./lockfile-BZHfAuKg.mjs";
import { t as resolveServerBuild } from "./server-build-Cga7EB-K.mjs";
import { i as resolveRootDir } from "./paths-DlXZaaIg.mjs";
import process from "node:process";
import { styleText } from "node:util";
import { relative } from "pathe";
//#region src/utils/build-progress.ts
/**
* Build phases, in the order they are reached. A phase is never re-entered, so
* the index only ever moves forward and the breakdown printed at the end lists
* each phase once.
*/
const BUILD_PHASES = [
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
		id: "client",
		message: "Bundling client"
	},
	{
		id: "server",
		message: "Bundling server"
	},
	{
		id: "nitro",
		message: "Building Nitro server"
	}
];
const HOOK_PHASES = {
	"modules:before": "modules",
	"builder:generateApp": "app",
	"prepare:types": "types",
	"build:before": "client",
	"nitro:build:before": "nitro"
};
/** Nitro builds on its own hooks, which Nuxt's never see. */
const NITRO_INIT_HOOK = "nitro:init";
/**
* Nitro's own hooks, relabelled. Without these the Nitro phase says nothing
* between the bundle starting and the output being written, which on a large
* project is the longest silence of the build.
*/
const NITRO_MESSAGES = {
	"rollup:before": "Bundling Nitro server",
	"prerender:routes": "Prerendering routes"
};
const PRERENDER_HOOK = "prerender:generate";
/**
* Tracks how far a production build has got, so the same transient phase line
* `nuxt dev` shows can report `nuxt build`, and the completion summary can list
* where the time went.
*/
var BuildProgress = class extends PhaseTimeline {
	#message = BUILD_PHASES[0].message;
	#finished = false;
	/**
	* With the Vite environment API a single build covers both environments, so
	* the client and server configs resolve up front and cannot mark the boundary
	* between them.
	*/
	#splitBundles = true;
	constructor() {
		super(BUILD_PHASES);
	}
	get snapshot() {
		return {
			...super.snapshot,
			message: this.#message
		};
	}
	onUpdate(listener) {
		const off = super.onUpdate(listener);
		listener(this.snapshot);
		return off;
	}
	setPhase(id, message) {
		if (this.#finished || this.enter(id) === void 0) return;
		this.setMessage(message || BUILD_PHASES[this.index].message);
	}
	setMessage(message) {
		if (this.#finished || message === this.#message) return;
		this.#message = message;
		this.emit();
	}
	/**
	* Close the phase in flight and stop accepting updates, so its duration makes
	* it into the breakdown. Nothing is emitted: whoever reports the build owns
	* what is said about it finishing.
	*/
	finish() {
		if (!this.#finished) {
			this.closePhase();
			this.#finished = true;
		}
	}
	/**
	* Derive phases from the hooks Nuxt and Nitro call, so the timeline follows
	* the project's own build rather than a schedule guessed by the CLI.
	*/
	attachNuxt(nuxt) {
		this.#splitBundles = !nuxt.options?.experimental?.viteEnvironmentApi;
		nuxt.hooks?.beforeEach?.(({ name, args }) => {
			const phase = HOOK_PHASES[name];
			if (phase) {
				this.setPhase(phase, phase === "client" && !this.#splitBundles ? "Bundling app" : void 0);
				return;
			}
			if (name === "vite:configResolved" && this.#splitBundles) {
				const ctx = args?.[1];
				this.setPhase(ctx?.isServer ? "server" : "client");
			} else if (name === "webpack:compile") {
				const ctx = args?.[0];
				this.setPhase(ctx?.name === "server" ? "server" : "client");
			} else if (name === NITRO_INIT_HOOK) this.#attachNitro((args?.[0])?.hooks);
		});
	}
	#attachNitro(hooks) {
		hooks?.beforeEach?.(({ name, args }) => {
			if (BUILD_PHASES[this.index].id !== "nitro") return;
			const message = NITRO_MESSAGES[name];
			if (message) this.setMessage(message);
			else if (name === PRERENDER_HOOK) {
				const route = (args?.[0])?.route;
				if (route) this.setMessage(`Prerendering ${route}`);
			}
		});
	}
};
//#endregion
//#region src/commands/build.ts
/** How often a phase repeats itself where there is no animated line. */
const HEARTBEAT_INTERVAL = 5e3;
var build_default = defineCommand({
	meta: {
		name: "build",
		description: "Build Nuxt for production deployment"
	},
	args: {
		...rootDirArgs,
		...logLevelArgs,
		prerender: {
			type: "boolean",
			description: "Build Nuxt and prerender static routes"
		},
		...targetArgs,
		...dotEnvArgs,
		...envNameArgs,
		...extendsArgs,
		...profileArgs
	},
	async run(ctx) {
		overrideEnv("production");
		const start = Date.now();
		const cwd = resolveRootDir(ctx.args);
		const profileArg = ctx.args.profile;
		const profiling = profileArg !== void 0;
		const perfValue = profileArg === "verbose" ? true : profiling ? "quiet" : void 0;
		if (profiling) await startCpuProfile();
		const releaseLocks = [];
		const progress = new BuildProgress();
		let stopReporting = () => {};
		try {
			intro(styleText("cyan", "Building Nuxt for production..."));
			if (ctx.args.logLevel !== "silent") {
				const reporter = createPhaseReporter({ heartbeat: HEARTBEAT_INTERVAL });
				let unsubscribe;
				stopReporting = () => {
					unsubscribe?.();
					reporter.stop();
				};
				unsubscribe = progress.onUpdate(reporter.update);
			}
			const kit = await loadKit(cwd);
			const nuxt = await kit.loadNuxt({
				cwd,
				ready: false,
				dotenv: {
					cwd,
					fileName: resolveDotenvFileNames(ctx.args.dotenv)
				},
				envName: ctx.args.envName,
				overrides: {
					logLevel: ctx.args.logLevel,
					_generate: ctx.args.prerender,
					nitro: {
						static: ctx.args.prerender,
						preset: ctx.args.target || ctx.args.preset || process.env.NITRO_PRESET || process.env.SERVER_PRESET
					},
					...ctx.args.extends.length > 0 && { extends: ctx.args.extends },
					...ctx.data?.overrides,
					...(perfValue || ctx.data?.overrides?.debug) && { debug: {
						...ctx.data?.overrides?.debug,
						...perfValue && { perf: perfValue }
					} }
				}
			});
			progress.attachNuxt(nuxt);
			showBanner(nuxt);
			await nuxt.ready();
			const lock = acquireLock(nuxt.options.buildDir, {
				command: "build",
				cwd
			});
			if (lock.existing) throw new ActionableError(formatLockError(lock.existing));
			releaseLocks.push(lock.release);
			const serverBuild = resolveServerBuild(kit, nuxt);
			const target = serverBuild.target;
			if (target) logger.info(`${serverBuild.label} ${serverBuild.targetLabel}: ${styleText("cyan", target)}`);
			const outputDir = serverBuild.dir;
			const outputLock = acquireOutputLock(nuxt.options.rootDir, outputDir, {
				command: "build",
				cwd
			});
			if (outputLock.existing) throw new ActionableError(formatLockError(outputLock.existing, { outputDir: relative(process.cwd(), outputDir) }));
			releaseLocks.push(outputLock.release);
			await clearBuildDir(nuxt.options.buildDir);
			await kit.writeTypes(nuxt);
			await kit.buildNuxt(nuxt);
			stopReporting();
			progress.finish();
			const breakdown = formatPhaseBreakdown(progress.timings);
			if (breakdown) logger.message(styleText("dim", breakdown));
			if (ctx.args.prerender) {
				if (!nuxt.options.ssr) {
					logger.warn(`HTML content not prerendered because ${styleText("cyan", "ssr: false")} was set.`);
					logger.info(`You can read more in ${styleText("cyan", "https://nuxt.com/docs/getting-started/deployment#static-hosting")}.`);
				}
				const dir = serverBuild.publicDir;
				const publicDir = dir ? relative(process.cwd(), dir) : ".output/public";
				outro(`✨ You can now deploy ${styleText("cyan", publicDir)} to any static hosting! ${styleText("gray", `(${formatDuration(Date.now() - start)})`)}`);
			} else outro(`✨ Build complete in ${styleText("cyan", formatDuration(Date.now() - start))}!`);
		} finally {
			stopReporting();
			for (const release of releaseLocks.reverse()) release();
			if (profiling) await stopCpuProfile(cwd, "build");
		}
	}
});
//#endregion
export { build_default as default };
