import { h as defineCommand, s as logLevelArgs, t as cwdArgs } from "./_shared-YyGADOl7.mjs";
import { c as intro, d as outro, u as logger } from "./startup-clock-DXZlxuSA.mjs";
import { t as templateNames } from "./names-BemXlTaX.mjs";
import { t as loadKit } from "./kit-CbhDo9Zs.mjs";
import { r as relativeToProcess } from "./paths-DlXZaaIg.mjs";
import process from "node:process";
import { styleText } from "node:util";
import { dirname, isAbsolute, relative, resolve } from "pathe";
import { promises } from "node:fs";
import { camelCase, pascalCase } from "scule";
//#region src/utils/templates/modifiers.ts
/** Suffixes accepted by `--mode`, and as shorthand flags of their own. */
const modes = ["client", "server"];
/**
* Suffixes accepted by `--method`, and as shorthand flags of their own.
*
* Order decides the order suffixes are concatenated in when more than one
* shorthand is passed, so it is kept rather than sorted.
*/
const httpMethods = [
	"connect",
	"delete",
	"get",
	"head",
	"options",
	"post",
	"put",
	"trace",
	"patch"
];
//#endregion
//#region src/utils/templates/api.ts
const api = ({ name, args, nuxtOptions }) => {
	return {
		path: resolve(nuxtOptions.srcDir, nuxtOptions.serverDir, `api/${name}${applySuffix(args, httpMethods, "method")}.ts`),
		contents: `
export default defineEventHandler(event => {
  return 'Hello ${name}'
})
`
	};
};
//#endregion
//#region src/utils/templates/app.ts
const app = ({ args, nuxtOptions }) => ({
	path: resolve(nuxtOptions.srcDir, "app.vue"),
	contents: args.pages ? `
<script setup lang="ts"><\/script>

<template>
  <div>
    <NuxtLayout>
      <NuxtPage/>
    </NuxtLayout>
  </div>
</template>

<style scoped></style>
` : `
<script setup lang="ts"><\/script>

<template>
  <div>
    <h1>Hello World!</h1>
  </div>
</template>

<style scoped></style>
`
});
//#endregion
//#region src/utils/templates/app-config.ts
const appConfig = ({ nuxtOptions }) => ({
	path: resolve(nuxtOptions.srcDir, "app.config.ts"),
	contents: `
export default defineAppConfig({})
`
});
//#endregion
//#region src/utils/templates/component.ts
const component = ({ name, args, nuxtOptions }) => ({
	path: resolve(nuxtOptions.srcDir, `components/${name}${applySuffix(args, modes, "mode")}.vue`),
	contents: `
<script setup lang="ts"><\/script>

<template>
  <div>
    Component: ${name}
  </div>
</template>

<style scoped></style>
`
});
//#endregion
//#region src/utils/templates/composable.ts
const USE_PREFIX_RE = /^use-?/;
const composable = ({ name, nuxtOptions }) => {
	const nameWithoutUsePrefix = name.replace(USE_PREFIX_RE, "");
	const nameWithUsePrefix = `use${pascalCase(nameWithoutUsePrefix)}`;
	return {
		path: resolve(nuxtOptions.srcDir, `composables/${name}.ts`),
		contents: `
export const ${nameWithUsePrefix} = () => {
  return ref()
}
    `
	};
};
//#endregion
//#region src/utils/templates/error.ts
const error = ({ nuxtOptions }) => ({
	path: resolve(nuxtOptions.srcDir, "error.vue"),
	contents: `
<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps({
  error: Object as () => NuxtError
})
<\/script>

<template>
  <div>
    <h1>{{ error.statusCode }}</h1>
    <NuxtLink to="/">Go back home</NuxtLink>
  </div>
</template>

<style scoped></style>
`
});
//#endregion
//#region src/utils/templates/layer.ts
const layer = ({ name, nuxtOptions }) => {
	return {
		path: resolve(nuxtOptions.rootDir, `layers/${name}/nuxt.config.ts`),
		contents: `
export default defineNuxtConfig({})
`
	};
};
//#endregion
//#region src/utils/templates/layout.ts
const layout = ({ name, nuxtOptions }) => ({
	path: resolve(nuxtOptions.srcDir, nuxtOptions.dir.layouts, `${name}.vue`),
	contents: `
<script setup lang="ts"><\/script>

<template>
  <div>
    Layout: ${name}
    <slot />
  </div>
</template>

<style scoped></style>
`
});
//#endregion
//#region src/utils/templates/middleware.ts
const middleware = ({ name, args, nuxtOptions }) => ({
	path: resolve(nuxtOptions.srcDir, nuxtOptions.dir.middleware, `${name}${applySuffix(args, ["global"])}.ts`),
	contents: `
export default defineNuxtRouteMiddleware((to, from) => {})
`
});
//#endregion
//#region src/utils/templates/module.ts
const module = ({ name, nuxtOptions }) => ({
	path: resolve(nuxtOptions.rootDir, "modules", `${name}.ts`),
	contents: `
import { defineNuxtModule } from 'nuxt/kit'

export default defineNuxtModule({
  meta: {
    name: '${name}'
  },
  setup () {}
})
`
});
//#endregion
//#region src/utils/templates/page.ts
const page = ({ name, nuxtOptions }) => ({
	path: resolve(nuxtOptions.srcDir, nuxtOptions.dir.pages, `${name}.vue`),
	contents: `
<script setup lang="ts"><\/script>

<template>
  <div>
    Page: ${name}
  </div>
</template>

<style scoped></style>
`
});
//#endregion
//#region src/utils/templates/plugin.ts
const plugin = ({ name, args, nuxtOptions }) => ({
	path: resolve(nuxtOptions.srcDir, nuxtOptions.dir.plugins, `${name}${applySuffix(args, modes, "mode")}.ts`),
	contents: `
export default defineNuxtPlugin(nuxtApp => {})
  `
});
//#endregion
//#region src/utils/templates/server-middleware.ts
const serverMiddleware = ({ name, nuxtOptions }) => ({
	path: resolve(nuxtOptions.srcDir, nuxtOptions.serverDir, "middleware", `${name}.ts`),
	contents: `
export default defineEventHandler(event => {})
`
});
//#endregion
//#region src/utils/templates/server-plugin.ts
const serverPlugin = ({ name, nuxtOptions }) => ({
	path: resolve(nuxtOptions.srcDir, nuxtOptions.serverDir, "plugins", `${name}.ts`),
	contents: `
export default defineNitroPlugin(nitroApp => {})
`
});
//#endregion
//#region src/utils/templates/server-route.ts
const serverRoute = ({ name, args, nuxtOptions }) => ({
	path: resolve(nuxtOptions.srcDir, nuxtOptions.serverDir, args.api ? "api" : "routes", `${name}.ts`),
	contents: `
export default defineEventHandler(event => {})
`
});
//#endregion
//#region src/utils/templates/server-util.ts
const serverUtil = ({ name, nuxtOptions }) => ({
	path: resolve(nuxtOptions.srcDir, nuxtOptions.serverDir, "utils", `${name}.ts`),
	contents: `
export function ${camelCase(name)}() {}
`
});
//#endregion
//#region src/utils/templates/index.ts
const templates = {
	"api": api,
	"app": app,
	"app-config": appConfig,
	"component": component,
	"composable": composable,
	"error": error,
	"layer": layer,
	"layout": layout,
	"middleware": middleware,
	"module": module,
	"page": page,
	"plugin": plugin,
	"server-middleware": serverMiddleware,
	"server-plugin": serverPlugin,
	"server-route": serverRoute,
	"server-util": serverUtil
};
function applySuffix(args, suffixes, unwrapFrom) {
	let suffix = "";
	for (const s of suffixes) if (args[s]) suffix += `.${s}`;
	if (unwrapFrom && args[unwrapFrom] && suffixes.includes(args[unwrapFrom])) suffix += `.${args[unwrapFrom]}`;
	return suffix;
}
//#endregion
//#region src/commands/add-template.ts
const modifierArgs = Object.fromEntries([...modes.map((mode) => [mode, `Shorthand for \`--mode ${mode}\``]), ...httpMethods.map((method) => [method, `Shorthand for \`--method ${method}\``])].map(([name, description]) => [name, {
	type: "boolean",
	description
}]));
var add_template_default = defineCommand({
	meta: {
		name: "add-template",
		description: "Create a new template file."
	},
	args: {
		...cwdArgs,
		...logLevelArgs,
		force: {
			type: "boolean",
			description: "Overwrite the file if it already exists",
			default: false
		},
		mode: {
			type: "string",
			valueHint: modes.join("|"),
			description: "Add a client or server suffix to a component or plugin"
		},
		method: {
			type: "string",
			valueHint: [...httpMethods].sort().join("|"),
			description: "Add an HTTP method suffix to an API route"
		},
		global: {
			type: "boolean",
			description: "Create global route middleware"
		},
		api: {
			type: "boolean",
			description: "Create a server route in the API directory"
		},
		pages: {
			type: "boolean",
			description: "Include NuxtPage and NuxtLayout in the app template"
		},
		template: {
			type: "positional",
			required: true,
			valueHint: templateNames.join("|"),
			description: `Specify which template to generate`
		},
		name: {
			type: "positional",
			required: true,
			description: "Specify name of the generated file"
		},
		...modifierArgs
	},
	async run(ctx) {
		const cwd = resolve(ctx.args.cwd);
		intro(styleText("cyan", "Adding template..."));
		const templateName = ctx.args.template;
		if (!templateNames.includes(templateName)) {
			const supported = templateNames.map((name) => styleText("cyan", name));
			const last = supported.pop();
			logger.error(`Template ${styleText("cyan", templateName)} is not supported.`);
			logger.info(`Possible values are ${supported.join(", ")} or ${last}.`);
			process.exit(1);
		}
		if (ctx.args.mode && !modes.includes(ctx.args.mode)) {
			logger.error(`Mode must be ${styleText("cyan", "client")} or ${styleText("cyan", "server")}.`);
			process.exit(1);
		}
		if (ctx.args.method && !httpMethods.includes(ctx.args.method)) {
			logger.error(`HTTP method ${styleText("cyan", ctx.args.method)} is not supported.`);
			process.exit(1);
		}
		const ext = [".vue", ".ts"].find((ext) => ctx.args.name.endsWith(ext));
		const name = ext ? ctx.args.name.slice(0, -ext.length) : ctx.args.name;
		if (!name) {
			logger.error("Template name must not be empty.");
			process.exit(1);
		}
		const config = await (await loadKit(cwd)).loadNuxtConfig({ cwd });
		const res = templates[templateName]({
			name,
			args: ctx.args,
			nuxtOptions: config
		});
		if (escapesRoot(cwd, res.path)) {
			logger.error(`Refusing to write outside ${styleText("cyan", cwd)}: ${styleText("cyan", res.path)}.`);
			logger.info("Pass a name relative to the project, without leading slashes or `..` segments.");
			process.exit(1);
		}
		const parentDir = dirname(res.path);
		if (await promises.mkdir(parentDir, { recursive: true })) {
			logger.step(`Created directory ${styleText("cyan", relativeToProcess(parentDir))}.`);
			if (templateName === "page") logger.info("This enables vue-router functionality!");
		}
		try {
			await promises.writeFile(res.path, `${res.contents.trim()}\n`, { flag: ctx.args.force ? "w" : "wx" });
		} catch (error) {
			if (!ctx.args.force && error.code === "EEXIST") {
				logger.error(`File exists at ${styleText("cyan", relativeToProcess(res.path))}.`);
				logger.info(`Use ${styleText("cyan", "--force")} to overwrite it or use a different name.`);
				process.exit(1);
			}
			throw error;
		}
		logger.success(`Created ${styleText("cyan", relativeToProcess(res.path))}.`);
		outro(`Generated a new ${styleText("cyan", templateName)}!`);
	}
});
function escapesRoot(root, path) {
	const rel = relative(resolve(root), resolve(path));
	return !rel || rel.startsWith("../") || rel === ".." || isAbsolute(rel);
}
//#endregion
export { add_template_default as default, escapesRoot };
