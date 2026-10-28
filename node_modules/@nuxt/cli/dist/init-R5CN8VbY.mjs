import { h as defineCommand } from "./_shared-YyGADOl7.mjs";
import { u as logger } from "./startup-clock-DXZlxuSA.mjs";
import process from "node:process";
import { styleText } from "node:util";
import "std-env";
import "pathe";
import "node:fs";
import "node:child_process";
//#region src/utils/headless.ts
const createCommands = {
	npm: "npm create nuxt@latest",
	pnpm: "pnpm create nuxt@latest",
	yarn: "yarn create nuxt@latest",
	bun: "bun create nuxt@latest",
	deno: "deno run -A npm:create-nuxt@latest"
};
function currentPackageManager(userAgent) {
	const name = userAgent?.split("/")[0];
	return name && name in createCommands ? name : void 0;
}
/** How to scaffold a project with the latest release, in the user's package manager. */
function getCreateCommand(userAgent = process.env.npm_config_user_agent) {
	return createCommands[currentPackageManager(userAgent) ?? "npm"];
}
//#endregion
//#region src/commands/init.ts
var init_default = defineCommand({
	meta: {
		name: "init",
		description: "Scaffold a fresh project (moved to create-nuxt)",
		hidden: true
	},
	run(ctx) {
		const command = [getCreateCommand(), ...ctx.rawArgs].join(" ");
		logger.info(`Project scaffolding now lives in ${styleText("cyan", "create-nuxt")}.`);
		logger.info(`Run ${styleText("cyan", command)} instead.`);
		process.exit(1);
	}
});
//#endregion
export { init_default as default };
