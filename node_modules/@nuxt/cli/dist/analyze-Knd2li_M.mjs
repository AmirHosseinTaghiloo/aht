import { h as defineCommand, i as extendsArgs, l as rootDirArgs, n as dotEnvArgs, s as logLevelArgs } from "./_shared-YyGADOl7.mjs";
import { S as ActionableError, c as intro$1, d as outro$1, u as logger } from "./startup-clock-DXZlxuSA.mjs";
import { n as resolveDotenvFileNames } from "./args-DGaOocsH.mjs";
import { t as overrideEnv } from "./env-BkMPEX1D.mjs";
import { t as isAllowedHost } from "./host-check-DW342-PP.mjs";
import { n as clearDir } from "./fs-CSqg02ri.mjs";
import { t as loadKit } from "./kit-CbhDo9Zs.mjs";
import { a as formatLockError, n as acquireOutputLock, t as acquireLock } from "./lockfile-BZHfAuKg.mjs";
import { t as resolveServerBuild } from "./server-build-Cga7EB-K.mjs";
import { i as resolveRootDir, r as relativeToProcess } from "./paths-DlXZaaIg.mjs";
import process from "node:process";
import { styleText } from "node:util";
import { note, taskLog } from "@clack/prompts";
import { join, relative } from "pathe";
import { promises } from "node:fs";
import { defu as defu$1 } from "defu";
import { serve } from "srvx";
//#region src/commands/analyze.ts
const NON_WORD_RE = /[^\w-]/g;
const indexHtml = `
<!DOCTYPE html>
  <html lang="en">
  <head>
  <meta charset="utf-8">
  <title>Nuxt Bundle Stats (experimental)</title>
  </head>
    <h1>Nuxt Bundle Stats (experimental)</h1>
    <ul>
      <li>
        <a href="/nitro">Nitro server bundle stats</a>
      </li>
      <li>
        <a href="/client">Client bundle stats</a>
      </li>
    </ul>
  </html>
`.trim();
var analyze_default = defineCommand({
	meta: {
		name: "analyze",
		description: "Build Nuxt and analyze production bundle (experimental)"
	},
	args: {
		...rootDirArgs,
		...logLevelArgs,
		...dotEnvArgs,
		...extendsArgs,
		name: {
			type: "string",
			description: "Name of the analysis",
			default: "default",
			valueHint: "name"
		},
		serve: {
			type: "boolean",
			description: "Serve the analysis results",
			negativeDescription: "Skip serving the analysis results",
			default: true
		},
		prerender: {
			type: "boolean",
			description: "Prerender routes while analyzing",
			default: false
		}
	},
	async run(ctx) {
		overrideEnv("production");
		const cwd = resolveRootDir(ctx.args);
		const name = ctx.args.name || "default";
		const slug = name.trim().replace(NON_WORD_RE, "_") || "default";
		intro$1(styleText("cyan", "Analyzing bundle size..."));
		const startTime = Date.now();
		const kit = await loadKit(cwd);
		const { loadNuxt, buildNuxt } = kit;
		const nuxt = await loadNuxt({
			cwd,
			ready: false,
			dotenv: {
				cwd,
				fileName: resolveDotenvFileNames(ctx.args.dotenv)
			},
			overrides: defu$1(ctx.data?.overrides, {
				...ctx.args.extends.length > 0 && { extends: ctx.args.extends },
				build: { analyze: { enabled: true } },
				vite: { build: { rollupOptions: { output: {
					chunkFileNames: "_nuxt/[name].js",
					entryFileNames: "_nuxt/[name].js"
				} } } },
				logLevel: ctx.args.logLevel,
				...!ctx.args.prerender && { nitro: { prerender: {
					routes: [],
					crawlLinks: false,
					ignore: [() => true]
				} } }
			})
		});
		let skippedPrerenderRoutes = 0;
		if (!ctx.args.prerender) nuxt.hook("nitro:init", (nitro) => {
			nitro.hooks.hook("prerender:routes", (routes) => {
				skippedPrerenderRoutes = routes.size;
				routes.clear();
			});
		});
		await nuxt.ready();
		const analyzeDir = nuxt.options.analyzeDir;
		const buildDir = nuxt.options.buildDir;
		const serverBuild = resolveServerBuild(kit, nuxt);
		const outDir = serverBuild.dir;
		nuxt.options.build.analyze = defu$1(nuxt.options.build.analyze, { filename: join(analyzeDir, "client.html") });
		const lockInfo = {
			command: "analyze",
			cwd
		};
		const lock = acquireLock(buildDir, lockInfo);
		if (lock.existing) throw new ActionableError(formatLockError(lock.existing));
		const outputLock = acquireOutputLock(nuxt.options.rootDir, outDir, lockInfo);
		if (outputLock.existing) {
			lock.release();
			throw new ActionableError(formatLockError(outputLock.existing, { outputDir: relative(process.cwd(), outDir) }));
		}
		try {
			const tasklog = taskLog({
				title: "Building Nuxt with analysis enabled",
				retainLog: false,
				limit: 1
			});
			tasklog.message("Clearing analyze directory...");
			await clearDir(analyzeDir);
			tasklog.message("Building Nuxt...");
			await buildNuxt(nuxt);
			tasklog.success("Build complete");
			if (skippedPrerenderRoutes > 0) logger.info(`Skipped prerendering ${skippedPrerenderRoutes} route${skippedPrerenderRoutes === 1 ? "" : "s"}. Pass ${styleText("cyan", "--prerender")} to include assets emitted while prerendering.`);
			const meta = {
				name,
				slug,
				startTime,
				endTime: Date.now(),
				analyzeDir,
				buildDir,
				outDir: serverBuild.dir
			};
			await nuxt.callHook("build:analyze:done", meta);
			await promises.writeFile(join(analyzeDir, "meta.json"), JSON.stringify(meta, null, 2), "utf-8");
		} finally {
			outputLock.release();
			lock.release();
		}
		note(`${relativeToProcess(analyzeDir)}\n\nDo not deploy analyze results! Use ${styleText("cyan", "nuxt build")} before deploying.`, "Build location");
		if (ctx.args.serve !== false && !process.env.CI) {
			const headers = { "content-type": "text/html" };
			const readReport = (name) => promises.readFile(join(analyzeDir, name), "utf8").catch(() => void 0);
			const reports = /* @__PURE__ */ new Map([["/client", await readReport("client.html")], ["/nitro", await readReport("nitro.html")]]);
			logger.step("Starting stats server...");
			const hostname = process.env.HOST || "localhost";
			const allowedHosts = /* @__PURE__ */ new Set([hostname.toLowerCase()]);
			await serve({
				hostname,
				fetch(request) {
					if (!isAllowedHost(request.headers.get("host") ?? void 0, allowedHosts)) return new Response("Forbidden: this host is not allowed.", {
						status: 403,
						headers: { "content-type": "text/plain" }
					});
					const pathname = new URL(request.url).pathname.replace(/\/$/, "");
					if (reports.has(pathname)) {
						const report = reports.get(pathname);
						return report === void 0 ? new Response("This report was not generated by the analyze build.", {
							status: 404,
							headers
						}) : new Response(report, { headers });
					}
					return new Response(indexHtml, { headers });
				}
			}).ready();
		} else outro$1("✨ Analysis build complete!");
	}
});
//#endregion
export { analyze_default as default };
