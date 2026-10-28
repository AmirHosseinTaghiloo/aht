import { t as __exportAll } from "./rolldown-runtime-D7D4PA-g.mjs";
import { u as logger } from "./startup-clock-DXZlxuSA.mjs";
import { relative } from "node:path";
import process from "node:process";
import { resolve as resolve$1 } from "pathe";
import { existsSync, statSync } from "node:fs";
import { link } from "clickable-path";
//#region src/utils/paths.ts
var paths_exports = /* @__PURE__ */ __exportAll({
	relativeTo: () => relativeTo,
	relativeToProcess: () => relativeToProcess,
	resolveProjectDir: () => resolveProjectDir,
	resolveRootDir: () => resolveRootDir
});
const cwd = process.cwd();
/**
* Resolve the root directory a command should operate in from its `rootDir` positional
* and optional `--cwd` override, warning when the two disagree.
*/
function resolveRootDir(args) {
	const rootDir = args.rootDir?.startsWith("-") ? void 0 : args.rootDir;
	if (!args.cwd) return resolve$1(rootDir || ".");
	const resolved = resolve$1(args.cwd);
	if (rootDir && resolve$1(rootDir) !== resolved) logger.warn(`Both \`--cwd\` and \`ROOTDIR\` were provided; using \`${relativeToProcess(resolved)}\`.`);
	return resolved;
}
/**
* The directory whose Nuxt version a command will actually use, given the root
* command's arguments. Commands taking a ROOTDIR positional (`nuxt dev
* playground`) run against it rather than against `--cwd`, and a version read
* from the wrong directory is worse than no version at all. Positionals that
* are not directories belong to some other command shape (`nuxt add page foo`).
*
* `args` are the root command's, so `_[0]` is the subcommand and `_[1]` is the
* first argument to it.
*/
function resolveProjectDir(args) {
	const [, rootDir] = args._;
	if ((args.cwd ?? ".") === "." && rootDir && !rootDir.startsWith("-")) {
		const candidate = resolve$1(rootDir);
		if (existsSync(candidate) && statSync(candidate).isDirectory()) return candidate;
	}
	return resolve$1(args.cwd ?? ".");
}
function relativeToProcess(path) {
	return relativeTo(cwd, path);
}
/** Format `path` relative to `dir`, optionally as a clickable terminal link. */
function relativeTo(dir, path, options = {}) {
	if (options.link === false) return relative(dir, resolve$1(dir, path)) || path;
	return link(path, {
		cwd: dir,
		formatter: (absolute) => relative(dir, absolute) || absolute
	});
}
//#endregion
export { resolveRootDir as i, relativeTo as n, relativeToProcess as r, paths_exports as t };
