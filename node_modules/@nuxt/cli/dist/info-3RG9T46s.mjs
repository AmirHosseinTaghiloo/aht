import { h as defineCommand, l as rootDirArgs, m as version } from "./_shared-YyGADOl7.mjs";
import { u as logger } from "./startup-clock-DXZlxuSA.mjs";
import { t as tryResolveNuxt } from "./resolve-nuxt-VKCDOC-A.mjs";
import { i as printJson } from "./console-BgmzEcbV.mjs";
import { r as formatInfoBox } from "./formatting-Co5DEjad.mjs";
import { i as resolveNitroVersion, t as getBuilder } from "./banner-lMLtjrKS.mjs";
import { i as resolveRootDir } from "./paths-DlXZaaIg.mjs";
import { i as getPackageManagerVersion, n as detectPackageManager } from "./package-managers-B9HZ9pY9.mjs";
import { t as readDependencyPackageJson } from "./package-json-DACIqDr_.mjs";
import { n as getNuxtConfig } from "./nuxt-config-zyufWWwx.mjs";
import process from "node:process";
import { styleText } from "node:util";
import { isBun, isDeno, isMinimal } from "std-env";
import { box } from "@clack/prompts";
import os from "node:os";
import { readPackageJSON } from "pkg-types";
import { writeText } from "tinyclip";
//#region src/commands/info.ts
const LEADING_SLASH_RE = /^\//;
/** JSON key for each display label, so `--json` output stays stable if a label is reworded. */
const JSON_KEYS = {
	"Operating system": "operatingSystem",
	"CPU": "cpu",
	"Bun version": "bunVersion",
	"Deno version": "denoVersion",
	"Node.js version": "nodeVersion",
	"nuxt/cli version": "cliVersion",
	"Package manager": "packageManager",
	"Nuxt version": "nuxtVersion",
	"Nitro version": "nitroVersion",
	"Builder": "builder",
	"Config": "config",
	"Modules": "modules"
};
var info_default = defineCommand({
	meta: {
		name: "info",
		description: "Get information about Nuxt project"
	},
	args: {
		...rootDirArgs,
		json: {
			type: "boolean",
			description: "Print project info as JSON"
		}
	},
	async run(ctx) {
		const cwd = resolveRootDir(ctx.args);
		const packageManagerPromise = detectPackageManager(cwd).then(async (detected) => detected ? `${detected.name}@${await getPackageManagerVersion(detected.name)}` : "unknown");
		const [nuxtConfig, projectPkg] = await Promise.all([getNuxtConfig(cwd), readPackageJSON(cwd).catch(() => ({}))]);
		const { dependencies = {}, devDependencies = {} } = projectPkg;
		const nuxtPath = tryResolveNuxt(cwd);
		const versions = /* @__PURE__ */ new Map();
		const getDepVersion = (name) => {
			let version = versions.get(name);
			if (!version) {
				version = resolveDependencyVersion(name, [cwd, nuxtPath], cwd, projectPkg, dependencies, devDependencies);
				versions.set(name, version);
			}
			return version;
		};
		const modulesPromise = Promise.all((nuxtConfig.modules || []).map(async (module) => {
			const name = normalizeConfigModule(module, cwd);
			if (!name) return null;
			const specifier = Array.isArray(module) ? module[0] : module;
			const packageName = typeof specifier === "string" && getPackageName(specifier);
			const version = packageName && await getDepVersion(packageName);
			return version ? `${name}@${version}` : name;
		}));
		const [modules, nuxtVersion = "-", nitroVersion, packageManager] = await Promise.all([
			modulesPromise,
			getDepVersion("nuxt").then((version) => version || getDepVersion("nuxt-nightly")),
			resolveNitroVersion(cwd, getDepVersion),
			packageManagerPromise
		]);
		const configKeys = Object.keys(nuxtConfig).sort();
		const moduleNames = modules.filter((module) => module !== null);
		const builder = nuxtConfig.builder || "vite";
		const osType = os.type();
		const cpus = os.cpus();
		const builderInfo = typeof builder === "string" && [
			"vite",
			"@nuxt/vite-builder",
			"webpack",
			"@nuxt/webpack-builder",
			"rspack",
			"@nuxt/rspack-builder"
		].includes(builder) ? getBuilder(cwd, builder) : {
			name: "custom",
			version: "0.0.0"
		};
		const infoObj = {
			"Operating system": osType === "Darwin" ? `macOS ${os.release()}` : osType === "Windows_NT" ? `Windows ${os.release()}` : `${osType} ${os.release()}`,
			"CPU": `${cpus[0]?.model || "unknown"} (${cpus.length} cores)`,
			...isBun ? { "Bun version": Bun?.version } : isDeno ? { "Deno version": Deno?.version.deno } : { "Node.js version": process.version },
			"nuxt/cli version": version,
			"Package manager": packageManager,
			"Nuxt version": nuxtVersion,
			"Nitro version": nitroVersion,
			"Builder": builderInfo.name === "custom" ? "custom" : `${builderInfo.name.toLowerCase()}@${builderInfo.version}`,
			"Config": configKeys.map((key) => `\`${key}\``).join(", "),
			"Modules": moduleNames.map((name) => `\`${name}\``).join(", ")
		};
		if (ctx.args.json) {
			const lists = {
				config: configKeys,
				modules: moduleNames
			};
			await printJson({
				rootDir: nuxtConfig.rootDir || cwd,
				...Object.fromEntries(Object.entries(infoObj).map(([label, value]) => {
					const key = JSON_KEYS[label];
					return [key, lists[key] ?? (value?.replaceAll("`", "") || null)];
				}))
			});
			return;
		}
		logger.info(`Nuxt root directory: ${styleText("cyan", nuxtConfig.rootDir || cwd)}\n`);
		const boxStr = formatInfoBox(infoObj);
		const copyStr = formatMarkdownTable(infoObj);
		if (!isMinimal && await writeText(copyStr).then(() => true).catch(() => false)) box(`\n${boxStr}`, ` Nuxt project info ${styleText("gray", "(copied to clipboard) ")}`, {
			contentAlign: "left",
			titleAlign: "left",
			width: "auto",
			titlePadding: 2,
			contentPadding: 2,
			rounded: true
		});
		else logger.info(`Nuxt project info:\n${copyStr}`, { withGuide: false });
		logger.info(`👉 Read documentation: ${styleText("cyan", "https://nuxt.com")}`);
		logger.info(`👉 Report an issue: ${styleText("cyan", "https://github.com/nuxt/nuxt/issues/new?template=bug-report.yml")}`, { spacing: 0 });
		logger.info(`👉 Suggest an improvement: ${styleText("cyan", "https://github.com/nuxt/nuxt/discussions/new")}`, { spacing: 0 });
	}
});
async function resolveDependencyVersion(name, roots, cwd, projectPkg, dependencies, devDependencies) {
	for (const root of roots) {
		if (!root) continue;
		const pkg = await readDependencyPackageJson(name, root);
		if (pkg?.version) return pkg.version;
	}
	const { resolveCatalogEntry } = await import("./catalog-TtcO3WFN.mjs");
	return resolveCatalogEntry(cwd, projectPkg, name)?.specifier ?? dependencies[name] ?? devDependencies[name];
}
/** Render `nuxt info --json` output as the Markdown table `nuxt info` copies. */
function formatJsonAsMarkdownTable(json) {
	const labels = Object.fromEntries(Object.entries(JSON_KEYS).map(([label, key]) => [key, label]));
	const info = {};
	for (const [key, value] of Object.entries(json)) if (labels[key]) info[labels[key]] = Array.isArray(value) ? value.map((item) => `\`${item}\``).join(", ") : value ?? void 0;
	return formatMarkdownTable(info);
}
function formatMarkdownTable(info) {
	const entries = Object.entries(info).map(([label, value]) => [label, value || "-"]);
	const labelWidth = Math.max(...entries.map(([label]) => label.length + 4));
	const valueWidth = Math.max(...entries.map(([, value]) => value.length + (value.includes("`") ? 0 : 2)));
	const rows = entries.map(([label, value]) => {
		const formattedValue = value.includes("`") ? value : `\`${value}\``;
		return `| ${`**${label}**`.padEnd(labelWidth)} | ${formattedValue.padEnd(valueWidth)} |`;
	});
	return [
		`| ${" ".repeat(labelWidth)} | ${" ".repeat(valueWidth)} |`,
		`| ${"-".repeat(labelWidth)} | ${"-".repeat(valueWidth)} |`,
		...rows,
		""
	].join("\n");
}
function getPackageName(name) {
	if (name.startsWith(".") || name.startsWith("/") || /^[a-z]:[\\/]/i.test(name) || name.endsWith("()")) return;
	const parts = name.split("/");
	return name.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}
function normalizeConfigModule(module, rootDir) {
	if (!module) return null;
	if (typeof module === "string") {
		const normalized = module.replaceAll("\\", "/");
		const normalizedRoot = rootDir.replaceAll("\\", "/").replace(/\/$/, "");
		const nodeModulesIndex = normalized.lastIndexOf("/node_modules/");
		if (nodeModulesIndex !== -1) return normalized.slice(nodeModulesIndex + 14);
		return normalized.startsWith(`${normalizedRoot}/`) ? normalized.slice(normalizedRoot.length + 1) : normalized.replace(LEADING_SLASH_RE, "");
	}
	if (typeof module === "function") return `${module.name}()`;
	if (Array.isArray(module)) return normalizeConfigModule(module[0], rootDir);
	return null;
}
//#endregion
export { info_default as default, formatJsonAsMarkdownTable, formatMarkdownTable, getPackageName, normalizeConfigModule };
