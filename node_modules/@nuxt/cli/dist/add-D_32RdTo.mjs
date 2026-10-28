import { h as defineCommand, s as logLevelArgs, t as cwdArgs } from "./_shared-YyGADOl7.mjs";
import { u as logger } from "./startup-clock-DXZlxuSA.mjs";
import { i as logNetworkError } from "./path-env-D9Xd_BAN.mjs";
import { n as createNuxtConfig, o as runCommandDef, r as readNuxtConfig, t as addNuxtConfigEntries } from "./config-DZKgZUPv.mjs";
import { t as fetchJson } from "./fetch-g4bhLuz9.mjs";
import { a as isPackageManagerName, n as detectPackageManager, o as packageManagerNames, t as defaultPackageManager } from "./package-managers-B9HZ9pY9.mjs";
import { a as runInstall, o as takeUnreportedIgnoredBuilds, r as isVerboseInstall, t as createInstallLog } from "./install-DSVDREZm.mjs";
import { t as createSpinner } from "./spinner-Cj-5sQW4.mjs";
import { n as getNuxtVersion } from "./versions-BA3DmZ0X.mjs";
import { t as prepare_default } from "./prepare-BV1iEjgA.mjs";
import { a as fetchModules, c as parseModuleSpec, i as ensureNuxtDependency, l as resolveModuleEntry, n as basePackageName, o as forwardCommandArgs, r as checkNuxtCompatibility, s as getProjectDependencies, t as MODULES_API_URL } from "./_utils-B2jBlm2m.mjs";
import process from "node:process";
import { styleText } from "node:util";
import { hasTTY } from "std-env";
import { autocompleteMultiselect, cancel, confirm, isCancel, select } from "@clack/prompts";
import { resolve } from "pathe";
import { readPackageJSON } from "pkg-types";
import { findMaxSatisfying, satisfies } from "verkit";
import fuzzysort from "fuzzysort";
//#region src/commands/module/_autocomplete.ts
const TRAILING_DOT_RE = /\.$/;
/**
* Clack wraps each row at the terminal width less its `│  ` guide, and the row
* itself opens with `◻ `; the last two columns are the gap this file puts
* between the name and the description.
*/
const ROW_PREFIX_WIDTH = 7;
/** Below this there is no room left for a description worth reading. */
const MIN_DESCRIPTION_WIDTH = 24;
async function selectModulesAutocomplete(options) {
	const { modules, message = "Search and select modules:" } = options;
	if (!hasTTY) {
		logger.warn("Interactive module selection requires a TTY. Skipping.");
		return {
			selected: [],
			cancelled: false
		};
	}
	const sortedModules = modules.toSorted((a, b) => {
		if (a.type === "official" && b.type !== "official") return -1;
		if (a.type !== "official" && b.type === "official") return 1;
		return a.npm.localeCompare(b.npm);
	});
	const targets = sortedModules.map((m) => ({
		value: m.npm,
		npm: fuzzysort.prepare(m.npm),
		name: fuzzysort.prepare(m.name),
		category: fuzzysort.prepare(m.category)
	}));
	/**
	* Clack only renders `hint` for the focused row, so the description lives in
	* the label instead and every row keeps it. Widths are measured on the plain
	* text: clack hard-wraps each row, and a label that overflows the terminal
	* costs a second line and half the visible list.
	*/
	function buildOptions(search) {
		const room = (process.stdout.columns || 80) - ROW_PREFIX_WIDTH;
		return sortedModules.map((m) => {
			const match = search ? fuzzysort.single(search, m.npm) : void 0;
			const name = match ? match.highlight((part) => styleText("underline", part)).join("") : m.npm;
			const description = m.description.replace(TRAILING_DOT_RE, "");
			const available = room - m.npm.length;
			if (!description || available < MIN_DESCRIPTION_WIDTH) return {
				value: m.npm,
				label: name
			};
			const truncated = description.length > available ? `${description.slice(0, available - 1).trimEnd()}…` : description;
			return {
				value: m.npm,
				label: `${name}  ${styleText("dim", truncated)}`
			};
		});
	}
	/**
	* `userInput` carries the text typed so far but is not on clack's public
	* prompt type, so a missing or renamed field degrades to unhighlighted rows
	* rather than throwing.
	*/
	function currentSearch(prompt) {
		const input = prompt.userInput;
		return typeof input === "string" ? input : "";
	}
	const matches = /* @__PURE__ */ new Map();
	const filter = (search, option) => {
		if (!search) return true;
		let results = matches.get(search);
		if (!results) {
			results = new Set(fuzzysort.go(search, targets, {
				keys: [
					"npm",
					"name",
					"category"
				],
				threshold: 0,
				limit: 0
			}).map((r) => r.obj.value));
			matches.set(search, results);
		}
		return results.has(option.value);
	};
	const result = await autocompleteMultiselect({
		message,
		options() {
			return buildOptions(currentSearch(this));
		},
		filter,
		required: false
	});
	return isCancel(result) ? {
		selected: [],
		cancelled: true
	} : {
		selected: result,
		cancelled: false
	};
}
//#endregion
//#region src/commands/module/add.ts
const WHITESPACE_RE = /\s/;
/**
* `layers` only affects help text: `nuxt add` is documented as accepting layers as
* well as modules, whereas the `nuxt module` namespace documents modules alone.
*/
function defineAddCommand({ layers = false } = {}) {
	return defineCommand({
		meta: {
			name: "add",
			description: layers ? "Add Nuxt modules and layers" : "Add Nuxt modules"
		},
		args: {
			...cwdArgs,
			...logLevelArgs,
			moduleName: {
				type: "positional",
				description: `Specify one or more modules${layers ? " or layers" : ""} to install by name, separated by spaces`,
				multiple: true
			},
			skipInstall: {
				type: "boolean",
				description: "Skip npm install"
			},
			skipConfig: {
				type: "boolean",
				description: "Skip nuxt.config.ts update"
			},
			dev: {
				type: "boolean",
				description: "Install modules as dev dependencies"
			},
			packageManager: {
				type: "string",
				description: "Package manager to install with",
				valueHint: packageManagerNames.join("|")
			}
		},
		async setup(ctx) {
			const cwd = resolve(ctx.args.cwd);
			let modules = ctx.args.moduleName.map((e) => e.trim()).filter(Boolean);
			const projectPkg = await readPackageJSON(cwd).catch(() => ({}));
			if (!await ensureNuxtDependency(cwd, projectPkg)) process.exit(1);
			let modulesDB;
			if (modules.length === 0) {
				const modulesSpinner = createSpinner();
				modulesSpinner.start("Fetching available modules");
				const [allModules, nuxtVersion] = await Promise.all([fetchModules().catch((err) => {
					modulesSpinner.error("Failed to fetch available modules");
					logNetworkError(err, { url: MODULES_API_URL });
					process.exit(1);
				}), getNuxtVersion(cwd)]);
				modulesDB = allModules;
				const compatibleModules = modulesDB.filter((m) => !m.compatibility.nuxt || checkNuxtCompatibility(m, nuxtVersion));
				modulesSpinner.stop("Modules loaded");
				modules = (await selectModulesAutocomplete({
					modules: compatibleModules,
					message: "Search modules to add (Esc to finish):"
				})).selected;
				if (modules.length === 0) {
					cancel("No modules selected.");
					process.exit(0);
				}
			} else modulesDB = await fetchModules().catch((err) => {
				logNetworkError(err, {
					url: MODULES_API_URL,
					level: "warn",
					prefix: "Cannot search in the Nuxt Modules database."
				});
				return [];
			});
			let nuxtVersionPromise;
			const getProjectNuxtVersion = () => nuxtVersionPromise ||= getNuxtVersion(cwd);
			const resolvedModules = [];
			for (const moduleName of new Set(modules)) {
				const resolvedModule = await resolveModule(moduleName, cwd, modulesDB, getProjectNuxtVersion);
				if (resolvedModule) resolvedModules.push(resolvedModule);
			}
			if (resolvedModules.length === 0) {
				cancel("No modules to add.");
				process.exit(1);
			}
			logger.info(`Resolved ${resolvedModules.map((x) => styleText("cyan", x.specifier)).join(", ")}, adding ${describeModules(resolvedModules)}...`);
			if (!await addModules(resolvedModules, {
				...ctx.args,
				cwd
			}, projectPkg)) process.exit(1);
			if (!ctx.args.skipInstall) await runCommandDef(prepare_default, forwardCommandArgs(ctx.args));
		}
	});
}
var add_default = defineAddCommand();
async function addModules(modules, { skipInstall = false, skipConfig = false, cwd, dev = false, packageManager: packageManagerName, logLevel }, projectPkg) {
	if (!skipInstall) {
		const dependencies = getProjectDependencies(projectPkg);
		const installedModules = modules.filter((module) => dependencies.has(module.pkgName));
		const notInstalledModules = modules.filter((module) => !dependencies.has(module.pkgName));
		if (installedModules.length > 0) {
			const installedModulesList = installedModules.map((module) => styleText("cyan", module.pkgName)).join(", ");
			const are = installedModules.length > 1 ? "are" : "is";
			logger.info(`${installedModulesList} ${are} already installed`);
		}
		if (notInstalledModules.length > 0) {
			const isDev = Boolean(projectPkg.devDependencies?.nuxt) || dev;
			const notInstalledModulesList = notInstalledModules.map((module) => styleText("cyan", module.pkg)).join(", ");
			const dependency = notInstalledModules.length > 1 ? "dependencies" : "dependency";
			const a = notInstalledModules.length > 1 ? "" : " a";
			logger.info(`Installing ${notInstalledModulesList} as${a}${isDev ? " development" : ""} ${dependency}`);
			const packageManager = await selectPackageManager(cwd, packageManagerName);
			const peers = resolveRequiredPeerDependencies(notInstalledModules, dependencies);
			if (peers.length > 0) logger.info(`Also installing required peer ${peers.length > 1 ? "dependencies" : "dependency"} ${peers.map((peer) => styleText("cyan", peer)).join(", ")}`);
			const installController = new AbortController();
			const installLog = createInstallLog({ verbose: isVerboseInstall(logLevel) });
			const installSpinner = createSpinner({
				indicator: "timer",
				onCancel: () => installController.abort()
			});
			installSpinner.start(`Installing with ${styleText("cyan", packageManager.name)}`);
			const result = await runInstall({
				cwd,
				packageManager,
				dependencies: [...notInstalledModules.map((module) => module.pkg), ...peers],
				dev: isDev,
				onOutput: installLog.onOutput,
				onStatus: (message) => installSpinner.message(message),
				signal: installController.signal
			});
			if (!result.success) {
				installSpinner.error(result.error ?? "Install failed");
				installLog.finish(result);
				logger.info(`${styleText("cyan", "nuxt.config")} was left unchanged. Resolve the install error and try again.`);
				return false;
			}
			installSpinner.stop("Dependencies installed");
			installLog.finish(result);
			const ignoredBuilds = takeUnreportedIgnoredBuilds(result.ignoredBuilds);
			if (ignoredBuilds.length > 0 && packageManager.name === "pnpm") logger.warn(`${styleText("cyan", "pnpm")} did not run build scripts for ${ignoredBuilds.map((name) => styleText("cyan", name)).join(", ")}. Run ${styleText("cyan", "pnpm approve-builds")} if your project needs them.`);
		}
	}
	if (!skipConfig) try {
		let config = await readNuxtConfig(cwd);
		if (!config) {
			logger.info(`Creating ${styleText("cyan", "nuxt.config.ts")}`);
			config = await createNuxtConfig(cwd, getDefaultNuxtConfig());
		}
		const toAdd = {};
		for (const resolved of modules) {
			const key = resolved.isLayer ? "extends" : "modules";
			if (config[key].includes(resolved.specifier)) {
				logger.info(`${styleText("cyan", resolved.specifier)} is already in the ${styleText("cyan", key)}`);
				continue;
			}
			logger.info(`Adding ${styleText("cyan", resolved.specifier)} to the ${styleText("cyan", key)}`);
			toAdd[key] = [...toAdd[key] ?? [], resolved.specifier];
		}
		await addNuxtConfigEntries(config, toAdd);
	} catch (error) {
		logger.error(`Failed to update ${styleText("cyan", "nuxt.config")}: ${error.message}`);
		logger.error(`Please manually add ${styleText("cyan", modules.map((module) => module.specifier).join(", "))} to ${styleText("cyan", "nuxt.config.ts")}`);
		return false;
	}
	return true;
}
/**
* Resolve the package manager to install with, preferring an explicit choice
* (e.g. the one selected during `nuxt init`) and otherwise detecting one from
* the project.
*/
async function selectPackageManager(cwd, name) {
	const requested = isPackageManagerName(name) ? name : void 0;
	if (name && !requested) logger.warn(`Unknown package manager ${styleText("cyan", name)}, detecting one instead.`);
	const detected = await detectPackageManager(cwd);
	if (!requested) return detected ?? defaultPackageManager;
	return detected?.name === requested ? detected : {
		name: requested,
		agent: requested
	};
}
/**
* Required (non-optional) peer dependencies of the modules being added that the
* project does not already depend on, so a module such as `@pinia/nuxt` does not
* end up installed without `pinia`.
*/
function resolveRequiredPeerDependencies(modules, dependencies) {
	const peers = /* @__PURE__ */ new Map();
	const moduleNames = new Set(modules.map((module) => module.pkgName));
	for (const module of modules) for (const [name, version] of Object.entries(module.peerDependencies || {})) {
		if (dependencies.has(name) || moduleNames.has(name) || peers.has(name)) continue;
		if (module.optionalPeerDependencies?.includes(name)) continue;
		const usable = version && version !== "*" && !WHITESPACE_RE.test(version);
		peers.set(name, usable ? `${name}@${version}` : name);
	}
	return [...peers.values()];
}
/** `module`, `layers`, `modules and layers`, and so on. */
function describeModules(modules) {
	const layers = modules.filter((module) => module.isLayer).length;
	const plain = modules.length - layers;
	const parts = [];
	if (plain > 0) parts.push(plain > 1 ? "modules" : "module");
	if (layers > 0) parts.push(layers > 1 ? "layers" : "layer");
	return parts.join(" and ");
}
function getDefaultNuxtConfig() {
	return `
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: []
})`;
}
async function resolveModule(moduleName, cwd, modulesDB, getProjectNuxtVersion) {
	const spec = parseModuleSpec(moduleName);
	if (!spec) {
		logger.error(`Invalid package name ${styleText("cyan", moduleName)}.`);
		return false;
	}
	let { pkgName, pkgVersion } = spec;
	let subpath = spec.subpath;
	const bareName = subpath ? `${pkgName}/${subpath}` : pkgName;
	const matchedModule = modulesDB.find((module) => module.name === moduleName || module.name === bareName || module.npm === bareName || module.npm === pkgName || module.aliases?.includes(bareName) || module.aliases?.includes(pkgName));
	if (matchedModule?.npm) {
		pkgName = basePackageName(matchedModule.npm);
		subpath = matchedModule.npm.slice(pkgName.length + 1) || subpath;
	}
	if (matchedModule && matchedModule.compatibility.nuxt) {
		const nuxtVersion = await getProjectNuxtVersion();
		if (!checkNuxtCompatibility(matchedModule, nuxtVersion)) {
			logger.warn(`The module ${styleText("cyan", pkgName)} is not compatible with Nuxt ${styleText("cyan", nuxtVersion)} (requires ${styleText("cyan", matchedModule.compatibility.nuxt)})`);
			const shouldContinue = await confirm({
				message: "Do you want to continue installing incompatible version?",
				initialValue: false
			});
			if (isCancel(shouldContinue) || !shouldContinue) return false;
		}
		const versionMap = matchedModule.compatibility.versionMap;
		if (versionMap) {
			for (const [_nuxtVersion, _moduleVersion] of Object.entries(versionMap)) if (satisfies(nuxtVersion, _nuxtVersion)) {
				if (!pkgVersion) pkgVersion = _moduleVersion;
				else {
					logger.warn(`Recommended version of ${styleText("cyan", pkgName)} for Nuxt ${styleText("cyan", nuxtVersion)} is ${styleText("cyan", _moduleVersion)} but you have requested ${styleText("cyan", pkgVersion)}.`);
					const result = await select({
						message: "Choose a version:",
						options: [{
							value: _moduleVersion,
							label: _moduleVersion
						}, {
							value: pkgVersion,
							label: pkgVersion
						}]
					});
					if (isCancel(result)) return false;
					pkgVersion = result;
				}
				break;
			}
		}
	}
	let version = pkgVersion || "latest";
	const pkgScope = pkgName.startsWith("@") ? pkgName.split("/")[0] : null;
	const { detectNpmRegistry } = await import("./registry-B7GzM18R.mjs").then((n) => n.r);
	const meta = await detectNpmRegistry(pkgScope, cwd);
	const headers = meta.authorization ? { Authorization: meta.authorization } : {};
	const pkgUrl = `${meta.registry}/${pkgName}`;
	const pkgDetails = await fetchJson(pkgUrl, { headers }).catch((err) => {
		logNetworkError(err, {
			url: pkgUrl,
			prefix: `Failed to fetch package details for ${styleText("cyan", pkgName)}.`
		});
		return null;
	});
	if (!pkgDetails) return false;
	if (pkgDetails["dist-tags"]?.[version]) version = pkgDetails["dist-tags"][version];
	else version = findMaxSatisfying(Object.keys(pkgDetails.versions || {}), version) || version;
	const pkg = pkgDetails.versions[version] || {};
	const entry = resolveModuleEntry(pkg);
	if (!subpath && entry.subpath) subpath = entry.subpath;
	if (entry.isLayer) logger.info(`${styleText("cyan", pkgName)} is a Nuxt layer, and will be added to ${styleText("cyan", "extends")}.`);
	const pkgDependencies = {
		...pkg.dependencies,
		...pkg.devDependencies,
		...pkg.peerDependencies
	};
	if (!entry.isLayer && !subpath && !pkgDependencies.nuxt && !pkgDependencies["@nuxt/kit"]) {
		logger.warn(`It seems that ${styleText("cyan", pkgName)} is not a Nuxt module.`);
		const shouldContinue = await confirm({
			message: `Do you want to continue installing ${styleText("cyan", pkgName)} anyway?`,
			initialValue: false
		});
		if (isCancel(shouldContinue) || !shouldContinue) return false;
	}
	return {
		pkg: `${pkgName}@${version}`,
		pkgName,
		specifier: subpath ? `${pkgName}/${subpath}` : pkgName,
		isLayer: entry.isLayer,
		peerDependencies: pkg.peerDependencies,
		optionalPeerDependencies: Object.entries(pkg.peerDependenciesMeta || {}).filter(([, meta]) => meta?.optional).map(([name]) => name)
	};
}
//#endregion
export { add_default as default, defineAddCommand, describeModules, resolveRequiredPeerDependencies };
