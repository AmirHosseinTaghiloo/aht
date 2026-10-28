import { h as defineCommand } from "./_shared-YyGADOl7.mjs";
//#region src/commands/task/index.ts
var task_default = defineCommand({
	meta: {
		name: "task",
		description: "List and run Nitro tasks on your dev server"
	},
	args: {},
	subCommands: {
		list: () => import("./list-q-oIKGib.mjs").then((r) => r.default || r),
		run: () => import("./run-DhMS8zjT.mjs").then((r) => r.default || r)
	}
});
//#endregion
export { task_default as default };
