import { t as __exportAll } from "./rolldown-runtime-D7D4PA-g.mjs";
import process from "node:process";
import { execFile } from "node:child_process";
import { LOCKS } from "package-manager-detector/constants";
import { detect } from "package-manager-detector/detect";
//#region src/utils/package-managers.ts
var package_managers_exports = /* @__PURE__ */ __exportAll({
	defaultPackageManager: () => defaultPackageManager,
	detectPackageManager: () => detectPackageManager,
	getLockFiles: () => getLockFiles,
	getPackageManagerVersion: () => getPackageManagerVersion,
	isPackageManagerName: () => isPackageManagerName,
	packageManagerNames: () => packageManagerNames
});
const preferredOrder = [
	"npm",
	"pnpm",
	"yarn",
	"bun",
	"deno"
];
function rank(name) {
	const index = preferredOrder.indexOf(name);
	return index === -1 ? preferredOrder.length : index;
}
/** Supported package managers, in the order they are offered to the user. */
const packageManagerNames = [...new Set(Object.values(LOCKS))].sort((a, b) => rank(a) - rank(b));
/** Used when no package manager can be detected. */
const defaultPackageManager = {
	name: "npm",
	agent: "npm"
};
function isPackageManagerName(name) {
	return packageManagerNames.includes(name);
}
/** Lockfiles written by `name`, excluding workspace manifests. */
function getLockFiles(name) {
	return Object.keys(LOCKS).filter((file) => LOCKS[file] === name && !file.includes("workspace"));
}
/** Detect the nearest project's package manager, checking only `cwd` when `includeParentDirs` is `false`. */
async function detectPackageManager(cwd, { includeParentDirs = true } = {}) {
	return await detect({
		cwd,
		stopDir: includeParentDirs ? void 0 : cwd
	}).catch(() => null) ?? void 0;
}
function getPackageManagerVersion(command) {
	const isWindows = process.platform === "win32";
	return new Promise((resolve) => {
		execFile(isWindows ? `"${command}"` : command, ["--version"], { shell: isWindows }, (error, stdout) => {
			resolve(error ? "unknown" : stdout.trim());
		}).stdin?.end();
	});
}
//#endregion
export { isPackageManagerName as a, getPackageManagerVersion as i, detectPackageManager as n, packageManagerNames as o, getLockFiles as r, package_managers_exports as s, defaultPackageManager as t };
