import { c as profileArgs, h as defineCommand, i as extendsArgs, l as rootDirArgs, n as dotEnvArgs, r as envNameArgs, s as logLevelArgs, u as targetArgs } from "./_shared-YyGADOl7.mjs";
import build_default from "./build-BToGXWIU.mjs";
//#region src/commands/generate.ts
var generate_default = defineCommand({
	meta: {
		name: "generate",
		description: "Build Nuxt and prerender all routes"
	},
	args: {
		...rootDirArgs,
		...logLevelArgs,
		...targetArgs,
		...dotEnvArgs,
		...envNameArgs,
		...extendsArgs,
		...profileArgs
	},
	async run(ctx) {
		ctx.args.prerender = true;
		await build_default.run(ctx);
	}
});
//#endregion
export { generate_default as default };
