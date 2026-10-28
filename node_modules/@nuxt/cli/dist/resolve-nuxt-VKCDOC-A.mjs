import { delimiter } from "node:path";
import process from "node:process";
import { resolveModulePath } from "exsolve";
//#region src/utils/resolve-nuxt.ts
/** `path` first, then whatever `NODE_PATH` adds, as resolution roots. */
function withNodePath(path) {
	return [path, ...process.env.NODE_PATH?.split(delimiter) || []];
}
/** Where the project's `nuxt` lives, nightly first, or `null` if it has none. */
function tryResolveNuxt(rootDir) {
	for (const pkg of ["nuxt-nightly", "nuxt"]) {
		const path = resolveModulePath(pkg, {
			from: withNodePath(rootDir),
			try: true
		});
		if (path) return path;
	}
	return null;
}
//#endregion
export { withNodePath as n, tryResolveNuxt as t };
