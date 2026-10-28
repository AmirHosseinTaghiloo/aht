import { h as defineCommand, i as extendsArgs, l as rootDirArgs, n as dotEnvArgs, r as envNameArgs, s as logLevelArgs } from "./_shared-YyGADOl7.mjs";
import { S as ActionableError, d as outro$1, u as logger } from "./startup-clock-DXZlxuSA.mjs";
import { r as withPrependedPath } from "./path-env-D9Xd_BAN.mjs";
import { n as resolveDotenvFileNames } from "./args-DGaOocsH.mjs";
import { t as loadKit } from "./kit-CbhDo9Zs.mjs";
import { p as updateLock, t as acquireLock, u as previewLockDir } from "./lockfile-BZHfAuKg.mjs";
import { t as resolveServerBuild } from "./server-build-Cga7EB-K.mjs";
import { s as parsePort, u as resolvePort } from "./listen-BjyzPJ2X.mjs";
import { i as resolveRootDir, r as relativeToProcess } from "./paths-DlXZaaIg.mjs";
import { n as takeOverServer, t as formatTakeoverRefusal } from "./takeover-4jL0B_PO.mjs";
import { dirname } from "node:path";
import process from "node:process";
import { styleText } from "node:util";
import { box } from "@clack/prompts";
import { join as join$1, resolve as resolve$1 } from "pathe";
import { existsSync, promises } from "node:fs";
import { readFile } from "node:fs/promises";
import { checkPort } from "get-port-please";
import { x } from "tinyexec";
import { serve } from "srvx";
import { tokenizeArgs } from "args-tokenizer";
import { staticMiddleware } from "srvx/static";
//#region src/utils/static-preview.ts
/** Files a client-only build uses as its entry, most specific first. */
const SPA_FALLBACKS = ["200.html", "index.html"];
/** Whether a directory looks like the static output of a client-only build. */
function findStaticEntry(dir) {
	return SPA_FALLBACKS.map((name) => join$1(dir, name)).find((path) => existsSync(path));
}
/** Addresses a browser cannot be pointed at, and what to show instead. */
const WILDCARD_HOSTS = {
	"[::]": "localhost",
	"0.0.0.0": "localhost"
};
/** The origin to print for a running server, with no wildcard host and no trailing slash. */
function formatServerURL(url) {
	if (!url) return "";
	const parsed = new URL(url);
	parsed.hostname = WILDCARD_HOSTS[parsed.hostname] ?? parsed.hostname;
	return parsed.href.replace(/\/$/, "");
}
/**
* Serve a build that has no server runtime: static files from disk, with every
* unmatched path answered by the client entry so client-side routing works.
*/
async function previewStaticOutput(options) {
	return await serve({
		port: options.port,
		hostname: options.hostname,
		middleware: [staticMiddleware({ dir: options.dir })],
		async fetch() {
			return new Response(await readFile(options.entry), { headers: { "content-type": "text/html;charset=utf-8" } });
		}
	}).ready();
}
//#endregion
//#region src/commands/preview.ts
const PORT_AWARE_RUNTIMES = /* @__PURE__ */ new Set([
	"node",
	"bun",
	"deno"
]);
const DEFAULT_PORT = 3e3;
const command = defineCommand({
	meta: {
		name: "preview",
		description: "Launches Nitro server for local testing after `nuxt build`."
	},
	args: {
		...rootDirArgs,
		...logLevelArgs,
		...envNameArgs,
		...extendsArgs,
		port: {
			type: "string",
			description: "Port to listen on (default: `NUXT_PORT || NITRO_PORT || PORT`)",
			valueHint: "port",
			alias: ["p"]
		},
		host: {
			type: "string",
			description: "Host to listen on (default: `NUXT_HOST || NITRO_HOST || HOST`)",
			valueHint: "host",
			alias: ["h"]
		},
		takeover: {
			type: "boolean",
			description: "Stop a preview server already running on this project and take its place",
			negativeDescription: "Never stop a preview server already running on this project"
		},
		strictPort: {
			type: "boolean",
			description: "Exit if the requested port is unavailable instead of using another one",
			default: false
		},
		...dotEnvArgs
	},
	async run(ctx) {
		process.env.NODE_ENV = process.env.NODE_ENV || "production";
		const cwd = resolveRootDir(ctx.args);
		let envLoaded = false;
		/** `nitro.json` location, for Nuxt versions with no build descriptor. */
		let legacyNitroJSON;
		/** What Nuxt says about the build it would produce, when it says anything. */
		let declared;
		try {
			const kit = await loadKit(cwd);
			const nuxt = await kit.loadNuxt({
				cwd,
				dotenv: {
					cwd,
					fileName: resolveDotenvFileNames(ctx.args.dotenv)
				},
				envName: ctx.args.envName,
				ready: true,
				overrides: {
					...ctx.args.extends.length > 0 && { extends: ctx.args.extends },
					modules: [function(_, nuxt) {
						envLoaded = true;
						nuxt.hook("nitro:init", (nitro) => {
							legacyNitroJSON = resolve$1(nuxt.options.srcDir || cwd, nitro.options.output.dir || ".output", "nitro.json");
						});
					}]
				}
			});
			const build = resolveServerBuild(kit, nuxt);
			if (build.declared) declared = {
				label: build.label,
				target: build.target,
				targetLabel: build.targetLabel,
				dir: build.dir,
				previewCommand: build.previewCommand,
				staticDir: build.previewStaticDir
			};
			await nuxt.close();
		} catch {}
		const port = ctx.args.port || process.env.NUXT_PORT || process.env.NITRO_PORT || process.env.PORT;
		const host = ctx.args.host || process.env.NUXT_HOST || process.env.NITRO_HOST || process.env.HOST;
		async function claimPort() {
			const requestedPort = parsePort(port);
			const takeover = await takeOverServer(previewLockDir(cwd), {
				command: "preview",
				requestedPort,
				takeover: ctx.args.takeover
			});
			if (takeover.action === "refused") {
				logger.error(formatTakeoverRefusal(takeover.existing, takeover.reason));
				process.exit(1);
			}
			if (takeover.action === "taken") return takeover.port;
			const listenPort = requestedPort ?? DEFAULT_PORT;
			if (!ctx.args.strictPort) return resolvePort(listenPort, host || "");
			if (listenPort !== 0 && await checkPort(listenPort, host || void 0) === false) throw new ActionableError(`Port ${listenPort} is already in use (\`--strictPort\` is enabled).`);
			return listenPort;
		}
		let previewCommand;
		let outputPath;
		let target;
		const searchPaths = [];
		const staticDirs = [];
		if (declared) {
			searchPaths.push(declared.dir);
			if (existsSync(declared.dir)) {
				previewCommand = declared.previewCommand;
				outputPath = declared.dir;
				if (declared.target) target = [`${declared.label} ${declared.targetLabel}:`, declared.target];
			}
			if (declared.staticDir) staticDirs.push(declared.staticDir);
		} else {
			const nitroJSONPaths = [...new Set([legacyNitroJSON, resolve$1(cwd, ".output", "nitro.json")].filter((path) => !!path))];
			searchPaths.push(...nitroJSONPaths);
			const nitroJSONPath = nitroJSONPaths.find((path) => existsSync(path));
			if (nitroJSONPath) {
				const nitroJSON = JSON.parse(await promises.readFile(nitroJSONPath, "utf-8"));
				previewCommand = nitroJSON.commands?.preview;
				outputPath = dirname(nitroJSONPath);
				if (nitroJSON.preset) target = ["Nitro preset:", nitroJSON.preset];
			}
		}
		staticDirs.push(resolve$1(cwd, ".output", "public"));
		if (typeof previewCommand !== "string" || !previewCommand.trim()) {
			for (const dir of staticDirs) {
				const entry = findStaticEntry(dir);
				if (entry) {
					logger.info(`This build has no server, so ${styleText("cyan", relativeToProcess(dir))} is being served statically.`);
					const listenPort = await claimPort();
					const server = await previewStaticOutput({
						dir,
						entry,
						port: String(listenPort),
						hostname: host
					});
					recordPreview(cwd, listenPort, host);
					outro$1(`Previewing ${styleText("cyan", relativeToProcess(dir))} at ${styleText("cyan", formatServerURL(server.url))}`);
					return;
				}
			}
			if (outputPath) logger.error("Preview is not supported for this build.");
			else logger.error(`Cannot find a build to preview${declared ? ` for the ${styleText("cyan", declared.label)} server builder` : ""}. Did you run ${styleText("cyan", "nuxt build")} first? Search path:\n${[.../* @__PURE__ */ new Set([...searchPaths, ...staticDirs])].join("\n")}`);
			process.exit(1);
		}
		const previewDir = outputPath;
		const [command, ...commandArgs] = tokenizeArgs(previewCommand);
		const listenPort = PORT_AWARE_RUNTIMES.has(command) ? await claimPort() : void 0;
		const serverPort = listenPort === void 0 ? port : String(listenPort);
		const info = [
			["Node.js:", `v${process.versions.node}`],
			...target ? [target] : [],
			["Working directory:", relativeToProcess(previewDir)]
		];
		const _infoKeyLen = Math.max(...info.map(([label]) => label.length));
		logger.message("");
		box([
			"",
			"You are previewing a Nuxt app. In production, do not use this CLI. ",
			`Instead, run ${styleText("cyan", previewCommand)} directly.`,
			"",
			...info.map(([label, value]) => `${label.padEnd(_infoKeyLen, " ")} ${styleText("cyan", value)}`),
			""
		].join("\n"), styleText("yellow", " Previewing Nuxt app "), {
			contentAlign: "left",
			titleAlign: "left",
			width: "auto",
			titlePadding: 2,
			contentPadding: 2,
			rounded: true,
			withGuide: true,
			formatBorder: (text) => styleText("yellow", text)
		});
		const envFileNames = resolveDotenvFileNames(ctx.args.dotenv) ?? [".env"];
		const existing = envFileNames.filter((fileName) => existsSync(resolve$1(cwd, fileName)));
		const missing = envFileNames.filter((fileName) => !existing.includes(fileName));
		if (existing.length > 0) {
			const list = existing.map((fileName) => styleText("cyan", fileName)).join(", ");
			if (envLoaded) logger.info(`Loaded ${list}. This will not be loaded when running the server in production.`);
			else logger.warn(`Could not load Nuxt, so ${list} may not be fully applied to the preview server.`);
		}
		if (ctx.args.dotenv.length > 0 && missing.length > 0) logger.error(`Cannot find ${missing.map((fileName) => styleText("cyan", fileName)).join(", ")}.`);
		outro$1(`Running ${styleText("cyan", previewCommand)} in ${styleText("cyan", relativeToProcess(previewDir))}`);
		const previewLock = listenPort === void 0 ? void 0 : recordPreview(cwd, listenPort, host);
		try {
			const server = x(command, commandArgs, {
				throwOnError: true,
				nodeOptions: {
					stdio: "inherit",
					cwd: previewDir,
					env: {
						...withPrependedPath(process.env, [resolve$1(previewDir, "node_modules/.bin"), resolve$1(cwd, "node_modules/.bin")]),
						NUXT_PORT: serverPort,
						NITRO_PORT: serverPort,
						NUXT_HOST: host,
						NITRO_HOST: host
					}
				}
			});
			if (server.pid) previewLock?.update(server.pid);
			await server;
		} finally {
			previewLock?.release();
		}
	}
});
function recordPreview(rootDir, port, hostname) {
	if (port === 0) return;
	const lockDir = previewLockDir(rootDir);
	const host = hostname || "localhost";
	const info = {
		command: "preview",
		cwd: rootDir,
		port,
		hostname,
		url: `http://${host.includes(":") && !host.startsWith("[") ? `[${host}]` : host}:${port}`
	};
	const { release } = acquireLock(lockDir, info);
	if (!release) return;
	return {
		release,
		update: (serverPid) => updateLock(lockDir, {
			...info,
			serverPid
		})
	};
}
//#endregion
export { command as default };
