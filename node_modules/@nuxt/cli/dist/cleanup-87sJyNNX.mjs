import { h as defineCommand, l as rootDirArgs } from "./_shared-YyGADOl7.mjs";
import { u as logger } from "./startup-clock-DXZlxuSA.mjs";
import { t as loadKit } from "./kit-CbhDo9Zs.mjs";
import { t as cleanupNuxtDirs } from "./nuxt-CCjsh7BJ.mjs";
import { i as resolveRootDir } from "./paths-DlXZaaIg.mjs";
//#region src/commands/cleanup.ts
var cleanup_default = defineCommand({
	meta: {
		name: "cleanup",
		description: "Clean up generated Nuxt files and caches"
	},
	args: { ...rootDirArgs },
	async run(ctx) {
		const cwd = resolveRootDir(ctx.args);
		const { loadNuxtConfig } = await loadKit(cwd);
		const nuxtOptions = await loadNuxtConfig({
			cwd,
			overrides: { dev: true }
		});
		await cleanupNuxtDirs(nuxtOptions.rootDir, nuxtOptions.buildDir);
		logger.success("Cleanup complete!");
	}
});
//#endregion
export { cleanup_default as default };
