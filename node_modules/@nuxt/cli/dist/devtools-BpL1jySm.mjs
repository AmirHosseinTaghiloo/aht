import { h as defineCommand, l as rootDirArgs } from "./_shared-YyGADOl7.mjs";
import { S as ActionableError } from "./startup-clock-DXZlxuSA.mjs";
import { i as resolveRootDir } from "./paths-DlXZaaIg.mjs";
import { x } from "tinyexec";
//#region src/commands/devtools.ts
var devtools_default = defineCommand({
	meta: {
		name: "devtools",
		description: "Enable or disable devtools in a Nuxt project"
	},
	args: {
		command: {
			type: "positional",
			description: "Command to run",
			valueHint: "enable|disable"
		},
		...rootDirArgs
	},
	async run(ctx) {
		const cwd = resolveRootDir(ctx.args);
		const command = ctx.args.command;
		if (command !== "enable" && command !== "disable") throw new ActionableError(`Unknown devtools command \`${command}\`. Expected \`enable\` or \`disable\`.`);
		await x("npx", [
			"--yes",
			"@nuxt/devtools-wizard@latest",
			command
		], {
			throwOnError: true,
			nodeOptions: {
				stdio: "inherit",
				cwd
			}
		});
	}
});
//#endregion
export { devtools_default as default };
