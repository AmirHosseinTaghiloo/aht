import { t as tryResolveNuxt } from "./resolve-nuxt-VKCDOC-A.mjs";
import { t as NUXT_PACKAGES } from "./nuxt-packages-2vh2Ybse.mjs";
import { resolveModulePath } from "exsolve";
import { readFileSync } from "node:fs";
//#region src/utils/pkg.ts
function getPkgVersion(cwd, pkg, options) {
	return getPkgJSON(cwd, pkg, options)?.version ?? "";
}
/**
* Resolve a package.json, optionally walking a dependency chain.
*
* `via` is an array of `[startingPoint, ...intermediates]` describing
* the dependency path to walk before resolving `pkg`. For example:
*
*   // vite is a dep of @nuxt/vite-builder, which is a dep of nuxt
*   getPkgJSON(cwd, 'vite', { via: ['nuxt', '@nuxt/vite-builder'] })
*
*   // webpack is a dep of @nuxt/webpack-builder, which the user installs
*   getPkgJSON(cwd, 'webpack', { via: ['@nuxt/webpack-builder'] })
*
* Each entry is resolved from the location of the previous one,
* starting from cwd. Falls back to direct resolution from cwd/nuxt,
* unless `strict` is set, in which case only the chain is used.
*/
function getPkgJSON(cwd, pkg, options) {
	const roots = [];
	if (options?.via && options.via.length > 0) {
		let from = cwd;
		for (const step of options.via) {
			from = resolveModulePath(step, {
				from,
				try: true
			}) ?? void 0;
			if (!from) break;
		}
		if (from) roots.push(from);
	}
	if (!options?.strict || !options.via?.length) {
		roots.push(cwd);
		const nuxtPath = tryResolveNuxt(cwd);
		if (nuxtPath) roots.push(nuxtPath);
	}
	for (const root of roots) {
		const p = resolveModulePath(`${pkg}/package.json`, {
			from: root,
			try: true
		});
		if (p) return JSON.parse(readFileSync(p, "utf-8"));
	}
	return null;
}
/** The installed Nuxt version in `cwd`. */
function getNuxtPkgVersion(cwd) {
	for (const name of NUXT_PACKAGES) {
		const version = getPkgVersion(cwd, name);
		if (version) return version;
	}
	return "";
}
//#endregion
export { getPkgJSON as n, getPkgVersion as r, getNuxtPkgVersion as t };
