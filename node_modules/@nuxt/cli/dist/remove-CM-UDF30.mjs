import { h as defineCommand, s as logLevelArgs, t as cwdArgs } from "./_shared-YyGADOl7.mjs";
import { u as logger } from "./startup-clock-DXZlxuSA.mjs";
import { i as logNetworkError } from "./path-env-D9Xd_BAN.mjs";
import { r as relativeToProcess } from "./paths-DlXZaaIg.mjs";
import { a as CONFIG_KEYS, i as removeNuxtConfigEntries, o as runCommandDef, r as readNuxtConfig } from "./config-DZKgZUPv.mjs";
import { n as detectPackageManager, t as defaultPackageManager } from "./package-managers-B9HZ9pY9.mjs";
import { a as runInstall, t as createInstallLog } from "./install-DSVDREZm.mjs";
import { t as readDependencyPackageJson } from "./package-json-DACIqDr_.mjs";
import { t as prepare_default } from "./prepare-BV1iEjgA.mjs";
import { a as fetchModules, i as ensureNuxtDependency, n as basePackageName, o as forwardCommandArgs, s as getProjectDependencies, t as MODULES_API_URL } from "./_utils-B2jBlm2m.mjs";
import process from "node:process";
import { styleText } from "node:util";
import { cancel, confirm, isCancel, multiselect } from "@clack/prompts";
import { resolve } from "pathe";
import { readPackageJSON } from "pkg-types";
//#region src/commands/module/remove.ts
var remove_default = defineCommand({
	meta: {
		name: "remove",
		description: "Remove Nuxt modules"
	},
	args: {
		...cwdArgs,
		...logLevelArgs,
		moduleName: {
			type: "positional",
			description: "Specify one or more modules to remove by name, separated by spaces",
			required: false,
			multiple: true
		},
		skipInstall: {
			type: "boolean",
			description: "Skip dependency uninstall"
		},
		skipConfig: {
			type: "boolean",
			description: "Skip nuxt.config.ts update"
		}
	},
	async setup(ctx) {
		const cwd = resolve(ctx.args.cwd);
		const modules = ctx.args.moduleName.map((e) => e.trim()).filter(Boolean);
		const projectPkg = await readPackageJSON(cwd).catch(() => ({}));
		if (!await ensureNuxtDependency(cwd, projectPkg)) process.exit(1);
		if (ctx.args.skipConfig && modules.length === 0) {
			cancel(`Specify one or more modules to remove when ${styleText("cyan", "--skipConfig")} is set.`);
			process.exit(1);
		}
		const installedNames = getProjectDependencies(projectPkg);
		const modulesDB = modules.some((m) => !installedNames.has(m) && !installedNames.has(basePackageName(m))) ? await fetchModules().catch((err) => {
			logNetworkError(err, {
				url: MODULES_API_URL,
				level: "warn",
				prefix: "Cannot search in the Nuxt Modules database."
			});
			return [];
		}) : [];
		const resolvedModules = modules.map((m) => resolveModuleName(m, modulesDB, installedNames));
		if (resolvedModules.length > 0) logger.info(`Resolved ${resolvedModules.map((x) => styleText("cyan", x)).join(", ")}, removing...`);
		const proceed = await removeModules(resolvedModules, {
			...ctx.args,
			cwd
		}, projectPkg);
		if (proceed !== true) process.exit(proceed === false ? 1 : 0);
		if (!ctx.args.skipInstall) await runCommandDef(prepare_default, forwardCommandArgs(ctx.args));
	}
});
async function removeModules(modules, { skipInstall = false, skipConfig = false, cwd }, projectPkg) {
	const removedFromConfig = [];
	const dependencies = getProjectDependencies(projectPkg);
	if (!skipConfig) {
		const config = await readNuxtConfig(cwd).catch((error) => {
			logger.error(`Failed to read ${styleText("cyan", "nuxt.config")}: ${error.message}`);
		});
		const present = config ? CONFIG_KEYS.flatMap((key) => config[key]) : [];
		let toRemove = new Set(modules);
		if (config && modules.length === 0 && present.length > 0) {
			const picked = await multiselect({
				message: "Select modules to remove:",
				options: present.map((m) => ({
					value: m,
					label: m
				})),
				required: true
			});
			if (isCancel(picked)) {
				cancel("No modules selected.");
				return;
			}
			toRemove = new Set(picked);
		}
		if (config) {
			const doomed = {};
			for (const key of CONFIG_KEYS) {
				const names = config[key].filter((name) => toRemove.has(name) || toRemove.has(basePackageName(name)));
				if (!names.length) continue;
				for (const name of names) logger.info(`Removing ${styleText("cyan", name)} from the ${styleText("cyan", key)}`);
				doomed[key] = names;
				removedFromConfig.push(...names);
			}
			try {
				await removeNuxtConfigEntries(config, doomed);
			} catch (error) {
				logger.error(`Failed to update ${styleText("cyan", "nuxt.config")}: ${error.message}`);
				logger.error(`Please manually remove ${styleText("cyan", [...toRemove].join(", ") || "the relevant modules")} from ${styleText("cyan", "nuxt.config.ts")}`);
				return false;
			}
		}
		if (modules.length === 0 && removedFromConfig.length === 0) {
			cancel(config ? `No modules configured in ${styleText("cyan", "nuxt.config")}.` : `No ${styleText("cyan", "nuxt.config")} found in ${styleText("cyan", relativeToProcess(cwd))}.`);
			return;
		}
	}
	if (!skipInstall) {
		const targets = Array.from(/* @__PURE__ */ new Set([...modules, ...removedFromConfig.map(basePackageName).filter((name) => dependencies.has(name))]));
		const installedModules = targets.filter((module) => dependencies.has(module));
		const notInstalledModules = targets.filter((module) => !dependencies.has(module));
		if (notInstalledModules.length > 0) {
			const notInstalledList = notInstalledModules.map((m) => styleText("cyan", m)).join(", ");
			const are = notInstalledModules.length > 1 ? "are" : "is";
			logger.info(`${notInstalledList} ${are} not installed as a dependency`);
		}
		if (installedModules.length === 0) return true;
		const toRemove = [...installedModules];
		const orphanedPeers = await findOrphanedPeers(installedModules, projectPkg, cwd);
		if (orphanedPeers.length > 0) {
			const peersList = orphanedPeers.map(({ peer, source }) => `${styleText("cyan", peer)} (peer of ${styleText("cyan", source)})`).join(", ");
			const peerDep = orphanedPeers.length > 1 ? "dependencies" : "dependency";
			const them = orphanedPeers.length > 1 ? "them" : "it";
			logger.info(`The following peer ${peerDep} ${orphanedPeers.length > 1 ? "are" : "is"} no longer used by any other dependency: ${peersList}`);
			const alsoRemove = await confirm({
				message: `Do you also want to remove ${them}?`,
				initialValue: false
			});
			if (isCancel(alsoRemove)) {
				cancel("Aborted.");
				return;
			}
			if (alsoRemove) toRemove.push(...orphanedPeers.map((o) => o.peer));
		}
		const removeList = toRemove.map((m) => styleText("cyan", m)).join(", ");
		const dependency = toRemove.length > 1 ? "dependencies" : "dependency";
		logger.info(`Uninstalling ${removeList} ${dependency}`);
		const packageManager = await detectPackageManager(cwd) ?? defaultPackageManager;
		const installLog = createInstallLog();
		const result = await runInstall({
			cwd,
			packageManager,
			dependencies: toRemove,
			uninstall: true,
			onOutput: installLog.onOutput
		});
		installLog.finish(result);
		if (!result.success) {
			logger.error(result.error ?? `Failed to uninstall ${removeList}`);
			return false;
		}
	}
	return true;
}
function resolveModuleName(input, modulesDB, installed) {
	if (installed.has(input)) return input;
	const base = basePackageName(input);
	if (installed.has(base)) return base;
	const matched = modulesDB.find((m) => m.name === input || m.npm === input || m.aliases?.includes(input));
	return matched?.npm ? basePackageName(matched.npm) : input;
}
async function findOrphanedPeers(removing, projectPkg, cwd) {
	const projectDeps = getProjectDependencies(projectPkg);
	const removingSet = new Set(removing);
	const candidates = /* @__PURE__ */ new Map();
	for (const m of removing) {
		const pkg = await readDependencyPackageJson(m, cwd);
		if (!pkg?.peerDependencies) continue;
		for (const peer of Object.keys(pkg.peerDependencies)) {
			if (pkg.peerDependenciesMeta?.[peer]?.optional || !projectDeps.has(peer) || removingSet.has(peer) || candidates.has(peer)) continue;
			candidates.set(peer, m);
		}
	}
	if (candidates.size === 0) return [];
	const stillNeeded = /* @__PURE__ */ new Set();
	const retained = [...projectDeps].filter((dep) => !removingSet.has(dep) && !candidates.has(dep));
	const packages = await Promise.all(retained.map((dep) => readDependencyPackageJson(dep, cwd)));
	for (const depPkg of packages) {
		if (!depPkg) continue;
		const depDeps = /* @__PURE__ */ new Set([...Object.keys(depPkg.dependencies || {}), ...Object.keys(depPkg.peerDependencies || {})]);
		for (const peer of candidates.keys()) if (depDeps.has(peer)) stillNeeded.add(peer);
	}
	return [...candidates].filter(([peer]) => !stillNeeded.has(peer)).map(([peer, source]) => ({
		peer,
		source
	}));
}
//#endregion
export { remove_default as default };
