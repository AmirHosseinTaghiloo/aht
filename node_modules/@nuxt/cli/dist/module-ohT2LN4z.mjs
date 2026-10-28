import { h as defineCommand } from "./_shared-YyGADOl7.mjs";
//#region src/commands/module/index.ts
var module_default = defineCommand({
	meta: {
		name: "module",
		description: "Manage Nuxt modules"
	},
	args: {},
	subCommands: {
		add: () => import("./add-D_32RdTo.mjs").then((r) => r.default || r),
		remove: () => import("./remove-CM-UDF30.mjs").then((r) => r.default || r),
		search: () => import("./search-6i5j2TeQ.mjs").then((r) => r.default || r)
	}
});
//#endregion
export { module_default as default };
