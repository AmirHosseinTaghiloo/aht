import { t as __exportAll } from "./rolldown-runtime-D7D4PA-g.mjs";
import { h as defineCommand, i as extendsArgs, l as rootDirArgs, n as dotEnvArgs, r as envNameArgs, s as logLevelArgs } from "./_shared-YyGADOl7.mjs";
import { u as logger } from "./startup-clock-DXZlxuSA.mjs";
import { n as resolveDotenvFileNames } from "./args-DGaOocsH.mjs";
import { t as clearBuildDir } from "./fs-CSqg02ri.mjs";
import { t as loadKit } from "./kit-CbhDo9Zs.mjs";
import { d as readActiveLock } from "./lockfile-BZHfAuKg.mjs";
import { i as resolveRootDir, r as relativeToProcess } from "./paths-DlXZaaIg.mjs";
import process from "node:process";
import { styleText } from "node:util";
//#region src/commands/prepare.ts
var prepare_exports = /* @__PURE__ */ __exportAll({ default: () => prepare_default });
var prepare_default = defineCommand({
	meta: {
		name: "prepare",
		description: "Prepare Nuxt for development/build"
	},
	args: {
		...rootDirArgs,
		...dotEnvArgs,
		...logLevelArgs,
		...envNameArgs,
		...extendsArgs
	},
	async run(ctx) {
		process.env.NODE_ENV = process.env.NODE_ENV || "production";
		const cwd = resolveRootDir(ctx.args);
		const { loadNuxt, buildNuxt, writeTypes } = await loadKit(cwd);
		const nuxt = await loadNuxt({
			cwd,
			dotenv: {
				cwd,
				fileName: resolveDotenvFileNames(ctx.args.dotenv)
			},
			envName: ctx.args.envName,
			overrides: {
				_prepare: true,
				logLevel: ctx.args.logLevel,
				...ctx.args.extends.length > 0 && { extends: ctx.args.extends },
				...ctx.data?.overrides
			}
		});
		const owner = readActiveLock(nuxt.options.buildDir);
		if (owner) {
			const label = owner.command === "dev" ? "dev server" : "build";
			logger.info(`A ${label} (PID ${owner.pid}) is using ${styleText("cyan", relativeToProcess(nuxt.options.buildDir))}; refreshing templates in place without clearing it.`);
		} else await clearBuildDir(nuxt.options.buildDir);
		await buildNuxt(nuxt);
		await writeTypes(nuxt);
		logger.success(`Types generated in ${styleText("cyan", relativeToProcess(nuxt.options.buildDir))}.`);
	}
});
//#endregion
export { prepare_exports as n, prepare_default as t };
