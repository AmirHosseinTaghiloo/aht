import { h as defineCommand } from "./_shared-YyGADOl7.mjs";
import command from "./preview-BAt7B1q5.mjs";
//#region src/commands/start.ts
var start_default = defineCommand({
	...command,
	meta: {
		name: "start",
		description: "Launches Nitro server for local testing after `nuxt build`.",
		hidden: true
	}
});
//#endregion
export { start_default as default };
