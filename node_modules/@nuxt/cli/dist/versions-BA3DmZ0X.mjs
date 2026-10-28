import { t as __exportAll } from "./rolldown-runtime-D7D4PA-g.mjs";
import { s as debug } from "./startup-clock-DXZlxuSA.mjs";
import { t as NUXT_PACKAGES } from "./nuxt-packages-2vh2Ybse.mjs";
import { t as fetchJson } from "./fetch-g4bhLuz9.mjs";
import { t as readDependencyPackageJson } from "./package-json-DACIqDr_.mjs";
import { readPackageJSON } from "pkg-types";
import { coerce, findMaxSatisfying, normalize } from "verkit";
//#region src/utils/versions.ts
var versions_exports = /* @__PURE__ */ __exportAll({
	DEFAULT_NUXT_VERSION: () => DEFAULT_NUXT_VERSION,
	getNuxtVersion: () => getNuxtVersion,
	resolveRegistryVersion: () => resolveRegistryVersion
});
/** How long to wait on the registry before giving up on a version lookup. */
const FETCH_TIMEOUT = 1e4;
/**
* Names a resolved `nuxt` dependency can legitimately have, so that a
* `package.json` reached by walking up from a resolved entry point (which happens
* when the package exposes no `./package.json` export) is not mistaken for Nuxt's
* own.
*/
const NUXT_PACKAGE_NAMES = new Set(NUXT_PACKAGES);
/** Assumed Nuxt version when the project declares no resolvable one. */
const DEFAULT_NUXT_VERSION = "3.0.0";
async function getNuxtVersion(cwd) {
	const nuxtPkg = await readDependencyPackageJson("nuxt", cwd).catch(() => null);
	if (nuxtPkg?.version && NUXT_PACKAGE_NAMES.has(nuxtPkg.name)) return nuxtPkg.version;
	const [pkg, { resolveCatalogEntry }] = await Promise.all([readPackageJSON(cwd), import("./catalog-TtcO3WFN.mjs")]);
	const pkgDep = resolveCatalogEntry(cwd, pkg, "nuxt")?.specifier ?? (pkg?.dependencies?.nuxt || pkg?.devDependencies?.nuxt);
	const coerced = pkgDep && coerce(pkgDep);
	return coerced && normalize(coerced) || "3.0.0";
}
/**
* The highest published version of `pkg` matching `range`, which may be a
* dist-tag (`latest`) or a semver range (`4`). Returns `undefined` when the
* range matches nothing or the registry cannot be reached.
*/
async function resolveRegistryVersion(pkg, range) {
	const scope = pkg.startsWith("@") ? pkg.split("/")[0] : null;
	const { detectNpmRegistry, PUBLIC_REGISTRY } = await import("./registry-B7GzM18R.mjs").then((n) => n.r);
	const { registry, authorization } = await detectNpmRegistry(scope);
	const packument = await fetchPackument(pkg, registry, authorization) ?? (registry === PUBLIC_REGISTRY ? void 0 : await fetchPackument(pkg, PUBLIC_REGISTRY, null));
	if (!packument) {
		debug(`Failed to resolve a version of ${pkg} matching ${range}.`);
		return;
	}
	return packument["dist-tags"]?.[range] ?? findMaxSatisfying(Object.keys(packument.versions ?? {}), range) ?? void 0;
}
async function fetchPackument(pkg, registry, authorization) {
	try {
		return await fetchJson(`${registry}/${pkg}`, {
			headers: {
				Accept: "application/vnd.npm.install-v1+json",
				...authorization ? { Authorization: authorization } : {}
			},
			timeout: FETCH_TIMEOUT,
			retry: 0
		});
	} catch (error) {
		debug(`Failed to read ${pkg} from ${registry}:`, error);
		return;
	}
}
//#endregion
export { versions_exports as i, getNuxtVersion as n, resolveRegistryVersion as r, DEFAULT_NUXT_VERSION as t };
