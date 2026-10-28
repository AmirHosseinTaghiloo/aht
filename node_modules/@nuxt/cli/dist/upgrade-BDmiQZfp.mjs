import { h as defineCommand, l as rootDirArgs, s as logLevelArgs } from "./_shared-YyGADOl7.mjs";
import { c as intro$1, d as outro$1, u as logger } from "./startup-clock-DXZlxuSA.mjs";
import { t as loadKit } from "./kit-CbhDo9Zs.mjs";
import { r as nuxtVersionToGitIdentifier, t as cleanupNuxtDirs } from "./nuxt-CCjsh7BJ.mjs";
import { i as resolveRootDir, r as relativeToProcess } from "./paths-DlXZaaIg.mjs";
import { i as getPackageManagerVersion, n as detectPackageManager, r as getLockFiles } from "./package-managers-B9HZ9pY9.mjs";
import { a as runInstall, i as runDedupe, o as takeUnreportedIgnoredBuilds, t as createInstallLog } from "./install-DSVDREZm.mjs";
import { t as createSpinner } from "./spinner-Cj-5sQW4.mjs";
import { n as getNuxtVersion, r as resolveRegistryVersion } from "./versions-BA3DmZ0X.mjs";
import process from "node:process";
import { styleText } from "node:util";
import { cancel, isCancel, note, select } from "@clack/prompts";
import { dirname, relative, resolve } from "pathe";
import { existsSync } from "node:fs";
import { findWorkspaceDir, readPackageJSON } from "pkg-types";
//#region src/commands/upgrade.ts
function checkNuxtDependencyType(pkg) {
	if (pkg.dependencies?.nuxt) return "dependencies";
	if (pkg.devDependencies?.nuxt) return "devDependencies";
	return "dependencies";
}
const ALIAS_SPEC_RE = /^npm:(.+)@([^@]+)$/;
/**
* Split an install argument such as `nuxt@latest` or
* `nuxt@npm:nuxt-nightly@latest` into the parts needed to resolve a concrete
* version for it.
*/
function parseInstallSpec(spec) {
	const separator = spec.lastIndexOf("@");
	if (separator < 1) return {
		name: spec,
		target: spec,
		range: "latest",
		aliased: false
	};
	const name = spec.slice(0, separator);
	const rest = spec.slice(separator + 1);
	const alias = spec.slice(spec.indexOf("@", 1) + 1).match(ALIAS_SPEC_RE);
	if (alias) return {
		name: spec.slice(0, spec.indexOf("@", 1)),
		target: alias[1],
		range: alias[2],
		aliased: true
	};
	return {
		name,
		target: name,
		range: rest,
		aliased: false
	};
}
const CATALOG_RANGE_RE = /^(?:npm:.+@)?([~^]?)\d+\.\d+\.\d+(?:[-+].+)?$/;
/**
* The range operator to keep when rewriting `specifier`, so an entry pinned to an
* exact version stays pinned. Anything that is not a plain version (a range such
* as `>=4.0.0`, or no entry at all) gets a caret, as `pnpm add` would write.
*/
function resolveRangePrefix(specifier) {
	return specifier?.match(CATALOG_RANGE_RE)?.[1] ?? "^";
}
/**
* The specifier a catalog entry should hold for `spec`. pnpm resolves dist-tags
* and ranges itself when it writes to `package.json`, but a catalog entry we
* write ourselves has to name a concrete version. `current` is the specifier the
* entry holds today, whose range operator is preserved.
*/
async function resolveCatalogSpecifier(spec, current) {
	const version = await resolveRegistryVersion(spec.target, spec.range);
	if (!version) return;
	const range = `${resolveRangePrefix(current)}${version}`;
	return spec.aliased ? `npm:${spec.target}@${range}` : range;
}
const nuxtVersionTags = {
	"3.x": "3x",
	"4.x": "latest"
};
function getNightlyDependency(dep, nuxtVersion) {
	return `${dep}@npm:${dep}-nightly@${nuxtVersionTags[nuxtVersion]}`;
}
async function getNightlyVersion(packageNames) {
	const nuxtVersion = await select({
		message: "Which nightly Nuxt release channel do you want to install?",
		options: [{
			value: "3.x",
			label: "3.x"
		}, {
			value: "4.x",
			label: "4.x"
		}],
		initialValue: "4.x"
	});
	if (isCancel(nuxtVersion)) {
		cancel("Operation cancelled.");
		process.exit(1);
	}
	return {
		npmPackages: packageNames.map((p) => getNightlyDependency(p, nuxtVersion)),
		nuxtVersion
	};
}
async function getRequiredNewVersion(packageNames, channel) {
	switch (channel) {
		case "nightly": return getNightlyVersion(packageNames);
		case "v3": return {
			npmPackages: packageNames.map((p) => `${p}@3`),
			nuxtVersion: "3.x"
		};
		case "v3-nightly": return {
			npmPackages: packageNames.map((p) => getNightlyDependency(p, "3.x")),
			nuxtVersion: "3.x"
		};
		case "v4": return {
			npmPackages: packageNames.map((p) => `${p}@4`),
			nuxtVersion: "4.x"
		};
		case "v4-nightly": return {
			npmPackages: packageNames.map((p) => getNightlyDependency(p, "4.x")),
			nuxtVersion: "4.x"
		};
		default: return {
			npmPackages: packageNames.map((p) => `${p}@latest`),
			nuxtVersion: "4.x"
		};
	}
}
var upgrade_default = defineCommand({
	meta: {
		name: "upgrade",
		description: "Upgrade Nuxt"
	},
	args: {
		...rootDirArgs,
		...logLevelArgs,
		dedupe: {
			type: "boolean",
			description: "Dedupe dependencies after upgrading"
		},
		force: {
			type: "boolean",
			alias: "f",
			description: "Force upgrade to recreate lockfile and node_modules"
		},
		channel: {
			type: "enum",
			alias: "ch",
			default: "stable",
			description: "Specify a channel to install from",
			options: [
				"stable",
				"nightly",
				"v3",
				"v4",
				"v4-nightly",
				"v3-nightly"
			]
		}
	},
	async run(ctx) {
		const cwd = resolveRootDir(ctx.args);
		intro$1(styleText("cyan", "Upgrading Nuxt ..."));
		const [packageManager, workspaceDir = cwd, { resolveCatalogEntry, updateCatalogEntries }] = await Promise.all([
			detectPackageManager(cwd),
			findWorkspaceDir(cwd, { try: true }),
			import("./catalog-TtcO3WFN.mjs")
		]);
		if (!packageManager) {
			logger.error(`Unable to determine the package manager used by this project.\n\nNo lock files found in ${styleText("cyan", relativeToProcess(cwd))}, and no ${styleText("cyan", "packageManager")} field specified in ${styleText("cyan", "package.json")}.`);
			logger.info(`Please either add the ${styleText("cyan", "packageManager")} field to ${styleText("cyan", "package.json")} or execute the installation command for your package manager. For example, you can use ${styleText("cyan", "pnpm i")}, ${styleText("cyan", "npm i")}, ${styleText("cyan", "bun i")}, or ${styleText("cyan", "yarn i")}, and then try again.`);
			process.exit(1);
		}
		const { name: packageManagerName } = packageManager;
		const packageManagerVersion = getPackageManagerVersion(packageManagerName);
		const currentVersionPromise = getNuxtVersion(cwd);
		currentVersionPromise.catch(() => {});
		const pkgPromise = readPackageJSON(cwd).catch(() => null);
		logger.step(`Package manager: ${styleText("cyan", packageManagerName)} ${await packageManagerVersion}`);
		const currentVersion = await currentVersionPromise || "[unknown]";
		logger.step(`Current Nuxt version: ${styleText("cyan", currentVersion)}`);
		const pkg = await pkgPromise;
		const nuxtDependencyType = pkg ? checkNuxtDependencyType(pkg) : "dependencies";
		const packageNames = ["nuxt", ...pkg ? [
			"@nuxt/kit",
			"@nuxt/schema",
			"@nuxt/vite-builder",
			"@nuxt/webpack-builder",
			"@nuxt/rspack-builder"
		].filter((p) => pkg.dependencies?.[p] || pkg.devDependencies?.[p]) : []];
		const { npmPackages, nuxtVersion } = await getRequiredNewVersion(packageNames, ctx.args.channel);
		const catalogUpdates = [];
		const directPackages = [];
		for (const [index, name] of packageNames.entries()) {
			const entry = packageManagerName === "pnpm" ? resolveCatalogEntry(cwd, pkg, name) : void 0;
			if (entry) catalogUpdates.push({
				catalog: entry.catalog,
				current: entry.specifier,
				spec: parseInstallSpec(npmPackages[index])
			});
			else directPackages.push(npmPackages[index]);
		}
		const toRemove = ["node_modules"];
		const lockFile = findLockFile(cwd, workspaceDir, getLockFiles(packageManagerName));
		if (lockFile) toRemove.push(lockFile);
		else logger.error(cwd === workspaceDir ? `Unable to find a ${packageManagerName} lock file in ${styleText("cyan", relativeToProcess(cwd))}.` : `Unable to find a ${packageManagerName} lock file in ${styleText("cyan", relativeToProcess(cwd))} or any directory up to ${styleText("cyan", relativeToProcess(workspaceDir))}.`);
		const forceRemovals = toRemove.map((p) => styleText("cyan", p)).join(" and ");
		let method = ctx.args.force ? "force" : ctx.args.dedupe ? "dedupe" : void 0;
		if (!method) {
			const result = await select({
				message: `Would you like to dedupe your lockfile, or recreate ${forceRemovals}? This can fix problems with hoisted dependency versions and ensure you have the most up-to-date dependencies.`,
				options: [
					{
						label: "dedupe lockfile",
						value: "dedupe",
						hint: "recommended"
					},
					{
						label: `recreate ${forceRemovals}`,
						value: "force"
					},
					{
						label: "skip",
						value: "skip"
					}
				],
				initialValue: "dedupe"
			});
			if (isCancel(result)) {
				cancel("Operation cancelled.");
				process.exit(1);
			}
			method = result;
		}
		const versionType = ctx.args.channel === "nightly" ? "nightly" : `latest ${ctx.args.channel}`;
		const verbose = ctx.args.logLevel === "verbose" || Boolean(process.env.DEBUG);
		let catalogResult = "skipped";
		if (catalogUpdates.length > 0) {
			const catalogSpinner = createSpinner();
			catalogSpinner.start("Updating catalog entries");
			const resolved = [];
			const unresolved = [];
			const specifiers = await Promise.all(catalogUpdates.map(({ current, spec }) => resolveCatalogSpecifier(spec, current)));
			for (const [index, specifier] of specifiers.entries()) {
				const { catalog, spec } = catalogUpdates[index];
				if (specifier) resolved.push({
					catalog,
					pkg: spec.name,
					specifier
				});
				else unresolved.push(spec.name);
			}
			if (resolved.length > 0) catalogResult = updateCatalogEntries(cwd, resolved);
			catalogSpinner.stop(catalogResult === "updated" ? `Catalog entries updated: ${resolved.map(({ pkg, specifier }) => `${pkg}@${specifier}`).join(", ")}` : "No catalog entries updated");
			if (unresolved.length > 0) {
				logger.warn(`Unable to resolve a ${versionType} version for ${unresolved.map((name) => styleText("cyan", name)).join(", ")} from the npm registry. Their catalog entries were left unchanged.`);
				logger.info(`Run with ${styleText("cyan", "DEBUG=nuxi")} to see why the lookup failed.`);
			}
			if (catalogResult === "failed") logger.warn(`Unable to update the catalog entries for ${resolved.map(({ pkg }) => styleText("cyan", pkg)).join(", ")}. Check ${styleText("cyan", "pnpm-workspace.yaml")} is readable and valid.`);
			if (catalogResult === "failed" ? resolved.some(({ pkg }) => pkg === "nuxt") : unresolved.includes("nuxt")) {
				logger.error(`Unable to upgrade ${styleText("cyan", "nuxt")} in ${styleText("cyan", "pnpm-workspace.yaml")}.`);
				outro$1("Upgrade cancelled.");
				process.exit(1);
			}
		}
		if (await withInstallSpinner(`Installing ${versionType} Nuxt ${nuxtVersion} release`, "Nuxt packages installed", { verbose }, (hooks) => runInstall({
			cwd,
			packageManager,
			dependencies: directPackages,
			dev: nuxtDependencyType === "devDependencies",
			...hooks
		}))) {
			if (catalogResult === "updated") logger.info(`Your ${styleText("cyan", "pnpm-workspace.yaml")} catalog entries were already updated, so review them before retrying.`);
			process.exit(1);
		}
		if (method === "force" || method === "dedupe") {
			const recreateLockfile = method === "force";
			if (await withInstallSpinner(recreateLockfile ? `Recreating ${forceRemovals}` : "Deduping dependencies", recreateLockfile ? "Lockfile recreated" : "Dependencies deduped", { verbose }, (hooks) => runDedupe({
				cwd,
				packageManager,
				recreateLockfile,
				lockFile,
				...hooks
			}))) process.exit(1);
		}
		const cleanupSpinner = createSpinner();
		cleanupSpinner.start("Cleaning up build directories");
		let buildDir = ".nuxt";
		try {
			const { loadNuxtConfig } = await loadKit(cwd);
			buildDir = (await loadNuxtConfig({ cwd })).buildDir;
		} catch {}
		try {
			await cleanupNuxtDirs(cwd, buildDir, { silent: true });
			cleanupSpinner.stop("Build directories cleaned");
		} catch (err) {
			cleanupSpinner.error("Could not clean build directories");
			logger.warn(`Nuxt was upgraded but build directories could not be removed: ${err instanceof Error ? err.message : err}`);
		}
		if (method === "force") logger.info(`If you encounter any issues, revert the changes and try with ${styleText("cyan", "--no-force")}`);
		const upgradedVersion = await getNuxtVersion(cwd) || "[unknown]";
		if (upgradedVersion === "[unknown]") return;
		if (upgradedVersion === currentVersion) outro$1(`You were already using the latest version of Nuxt (${styleText("green", currentVersion)})`);
		else {
			logger.success(`Successfully upgraded Nuxt from ${styleText("cyan", currentVersion)} to ${styleText("green", upgradedVersion)}`);
			if (currentVersion === "[unknown]") return;
			const commitA = nuxtVersionToGitIdentifier(currentVersion);
			const commitB = nuxtVersionToGitIdentifier(upgradedVersion);
			if (commitA && commitB) note(`https://github.com/nuxt/nuxt/compare/${commitA}...${commitB}`, "Changelog");
			outro$1("✨ Upgrade complete!");
		}
	}
});
/**
* Run a package manager step behind a spinner, surfacing its output only when it
* fails (or when running verbosely). Returns whether the step failed.
*/
async function withInstallSpinner(title, success, options, run) {
	const controller = new AbortController();
	const installLog = createInstallLog({ verbose: options.verbose });
	const spin = createSpinner({
		indicator: "timer",
		onCancel: () => controller.abort()
	});
	spin.start(title);
	const result = await run({
		onOutput: installLog.onOutput,
		onStatus: (message) => spin.message(message),
		signal: controller.signal
	});
	if (result.success) spin.stop(success);
	else spin.error(result.error ?? `${title} failed`);
	installLog.finish(result);
	const ignoredBuilds = takeUnreportedIgnoredBuilds(result.ignoredBuilds);
	if (ignoredBuilds.length > 0) logger.warn(`Build scripts were not run for ${ignoredBuilds.map((name) => styleText("cyan", name)).join(", ")}.`);
	return !result.success;
}
function findLockFile(cwd, workspaceDir, lockFiles) {
	const candidates = typeof lockFiles === "string" ? [lockFiles] : lockFiles;
	if (!candidates?.length) return;
	for (let dir = cwd;; dir = dirname(dir)) {
		for (const file of candidates) if (existsSync(resolve(dir, file))) return relative(cwd, resolve(dir, file));
		if (dir === workspaceDir || dir === dirname(dir)) return;
	}
}
//#endregion
export { upgrade_default as default, findLockFile, parseInstallSpec, resolveCatalogSpecifier, resolveRangePrefix };
