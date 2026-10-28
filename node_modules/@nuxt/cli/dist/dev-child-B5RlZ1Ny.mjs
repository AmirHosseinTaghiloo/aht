import { h as defineCommand, l as rootDirArgs, n as dotEnvArgs, r as envNameArgs, s as logLevelArgs } from "./_shared-YyGADOl7.mjs";
import { i as resolveRootDir } from "./paths-DlXZaaIg.mjs";
import process from "node:process";
//#region src/commands/dev-child.ts
var dev_child_default = defineCommand({
	meta: {
		name: "_dev",
		description: "Run Nuxt development server (internal command to start child process)",
		hidden: true
	},
	args: {
		...rootDirArgs,
		...logLevelArgs,
		...envNameArgs,
		...dotEnvArgs,
		clear: {
			type: "boolean",
			description: "Clear console on restart",
			negativeDescription: "Disable clear console on restart"
		}
	},
	async run(ctx) {
		const cwd = resolveRootDir(ctx.args);
		const listenOverrides = process.env._PORT ? {
			port: process.env._PORT,
			hostname: "127.0.0.1",
			showURL: false,
			strictPort: true
		} : void 0;
		const { initialize } = await import("./dev/index.mjs");
		await initialize({
			cwd,
			args: ctx.args
		}, {
			data: ctx.data,
			listenOverrides
		});
	}
});
//#endregion
export { dev_child_default as default };
