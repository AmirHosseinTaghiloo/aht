import { s as logLevelArgs, t as cwdArgs } from "./_shared-YyGADOl7.mjs";
import { u as logger } from "./startup-clock-DXZlxuSA.mjs";
import { r as relativeToProcess } from "./paths-DlXZaaIg.mjs";
import { t as fetchJson } from "./fetch-g4bhLuz9.mjs";
import { styleText } from "node:util";
import { confirm, isCancel } from "@clack/prompts";
import { satisfies } from "verkit";
//#region src/commands/module/_utils.ts
const MODULES_API_URL = "https://api.nuxt.com/modules?version=all";
async function fetchModules() {
	const { modules } = await fetchJson(MODULES_API_URL);
	return modules;
}
function checkNuxtCompatibility(module, nuxtVersion) {
	if (!module.compatibility?.nuxt) return true;
	return satisfies(nuxtVersion, module.compatibility.nuxt, { includePrerelease: true });
}
const MODULE_SPEC_RE = /^(?<name>(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*)(?:@(?<earlyVersion>[^@/]+))?(?<subpath>(?:\/[^@/]+)*)(?:@(?<version>[^@]+))?$/;
/** Parse a user-provided module spec such as `@maz-ui/nuxt@1.2.3` or `maz-ui/nuxt`. */
function parseModuleSpec(input) {
	const groups = input.match(MODULE_SPEC_RE)?.groups;
	if (!groups?.name) return;
	const version = groups.version || groups.earlyVersion;
	const subpath = groups.subpath?.replace(/^\//, "");
	return {
		pkgName: groups.name,
		pkgVersion: version || void 0,
		subpath: subpath || void 0
	};
}
/** The npm package name a config entry such as `maz-ui/nuxt` belongs to. */
function basePackageName(specifier) {
	const parts = specifier.split("/");
	return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}
const NUXT_CONFIG_ENTRY_RE = /(?:^|\/)nuxt\.config\.[cm]?[jt]s$/;
const MODULE_SUBPATHS = ["nuxt", "module"];
function resolveExportTarget(entry) {
	if (typeof entry === "string") return entry;
	if (Array.isArray(entry)) {
		for (const item of entry) {
			const resolved = resolveExportTarget(item);
			if (resolved) return resolved;
		}
		return;
	}
	if (entry && typeof entry === "object") {
		for (const key of [
			"nuxt",
			"import",
			"module",
			"require",
			"default"
		]) if (key in entry) {
			const resolved = resolveExportTarget(entry[key]);
			if (resolved) return resolved;
		}
	}
}
/**
* Work out how a package should be referenced from `nuxt.config`, mirroring the
* subpath suffixes Nuxt itself tries when resolving a module specifier, so that
* packages exposing their module at `<pkg>/nuxt` and layers whose entrypoint is a
* `nuxt.config` file both end up in the right place.
*/
function resolveModuleEntry(pkg) {
	const exports = pkg.exports && typeof pkg.exports === "object" && !Array.isArray(pkg.exports) ? pkg.exports : void 0;
	const hasSubpathExports = exports && Object.keys(exports).some((key) => key.startsWith("."));
	if (hasSubpathExports) {
		for (const subpath of MODULE_SUBPATHS) if (exports[`./${subpath}`]) return {
			subpath,
			isLayer: false
		};
	}
	const rootEntry = (hasSubpathExports ? resolveExportTarget(exports["."]) : resolveExportTarget(pkg.exports)) ?? pkg.module ?? pkg.main;
	return { isLayer: rootEntry ? NUXT_CONFIG_ENTRY_RE.test(rootEntry) : Boolean(pkg.files?.some((file) => NUXT_CONFIG_ENTRY_RE.test(file))) };
}
function getProjectDependencies(projectPkg) {
	return /* @__PURE__ */ new Set([...Object.keys(projectPkg.dependencies || {}), ...Object.keys(projectPkg.devDependencies || {})]);
}
/**
* Warn and prompt to continue when the project has no `nuxt` dependency.
* Returns `false` if the user declines or cancels.
*/
async function ensureNuxtDependency(cwd, projectPkg) {
	if (projectPkg.dependencies?.nuxt || projectPkg.devDependencies?.nuxt) return true;
	logger.warn(`No ${styleText("cyan", "nuxt")} dependency detected in ${styleText("cyan", relativeToProcess(cwd))}.`);
	const shouldContinue = await confirm({
		message: `Do you want to continue anyway?`,
		initialValue: false
	});
	return !isCancel(shouldContinue) && shouldContinue === true;
}
/** Forward `cwd` and log-level args to a chained command invocation. */
function forwardCommandArgs(args) {
	return Object.entries(args).filter(([k]) => k in cwdArgs || k in logLevelArgs).map(([k, v]) => `--${k}=${v}`);
}
//#endregion
export { fetchModules as a, parseModuleSpec as c, ensureNuxtDependency as i, resolveModuleEntry as l, basePackageName as n, forwardCommandArgs as o, checkNuxtCompatibility as r, getProjectDependencies as s, MODULES_API_URL as t };
