import process from "node:process";
import { consola } from "consola";
import { pathToFileURL } from "node:url";
import { resolveModulePath } from "exsolve";
import { join } from "pathe";
//#region src/utils/nuxt-config.ts
const MODULE_NOT_FOUND_CODES = /* @__PURE__ */ new Set(["ERR_MODULE_NOT_FOUND", "MODULE_NOT_FOUND"]);
/** Extensions a `nuxt.config` can have, in resolution order. */
const CONFIG_EXTENSIONS = [
	".js",
	".ts",
	".mjs",
	".cjs",
	".mts",
	".cts"
];
/**
* Errors that mean the config needs a loader rather than that it is broken:
* unresolvable specifiers (`~`/`@` aliases), TypeScript that cannot be stripped
* (`enum`, `namespace`, parameter properties), and Node versions predating
* built-in type stripping.
*/
const LOADER_REQUIRED_CODES = /* @__PURE__ */ new Set([
	"ERR_MODULE_NOT_FOUND",
	"ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX",
	"ERR_UNKNOWN_FILE_EXTENSION"
]);
async function getNuxtConfig(rootDir) {
	const configFile = resolveModulePath("./nuxt.config", {
		try: true,
		from: pathToFileURL(join(rootDir, "/")).href,
		extensions: CONFIG_EXTENSIONS
	});
	if (!configFile) return {};
	globalThis.defineNuxtConfig = (c) => c;
	try {
		try {
			return await importWithoutTypelessWarning(pathToFileURL(configFile).href);
		} catch (error) {
			if (!LOADER_REQUIRED_CODES.has(error.code)) throw error;
			return await importConfigWithJiti(rootDir, error);
		}
	} catch (error) {
		consola.warn(`Failed to load \`${configFile}\`: ${error instanceof Error ? error.message : String(error)}`);
		return {};
	} finally {
		delete globalThis.defineNuxtConfig;
	}
}
/**
* Node warns when it has to reparse a `.ts` file as ESM because the nearest
* `package.json` has no `type`. Reading the config is an internal detail of
* `nuxt info` and the warning describes our loader rather than the user's
* project, so it is dropped for the duration of the import.
*/
async function importWithoutTypelessWarning(href) {
	const emitWarning = process.emitWarning;
	process.emitWarning = (warning, ...args) => {
		if ((args.find((arg) => typeof arg === "object" && arg)?.code ?? args[1]) !== "MODULE_TYPELESS_PACKAGE_JSON") emitWarning(warning, ...args);
	};
	try {
		return await import(href).then((m) => m.default);
	} finally {
		process.emitWarning = emitWarning;
	}
}
/**
* `jiti` is an optional peer dependency, so the plain import is the normal
* path when the CLI is installed in a project. When the CLI runs from outside
* the project (`npx nuxi`), it is instead resolved from the user's project,
* where Nuxt provides it.
*/
async function importConfigWithJiti(rootDir, cause) {
	const { createJiti } = await import("jiti").catch(async (error) => {
		const code = error.code;
		if (code && !MODULE_NOT_FOUND_CODES.has(code)) throw error;
		const jitiPath = resolveModulePath("jiti", {
			try: true,
			from: pathToFileURL(join(rootDir, "/")).href
		});
		if (!jitiPath) throw new Error(`${cause?.message}. Hint: install \`jiti\` for compatibility.`, { cause });
		return await import(pathToFileURL(jitiPath).href);
	});
	return await createJiti(rootDir, {
		interopDefault: true,
		alias: {
			"~": rootDir,
			"@": rootDir
		}
	}).import("./nuxt.config", { default: true });
}
//#endregion
export { getNuxtConfig as n, CONFIG_EXTENSIONS as t };
