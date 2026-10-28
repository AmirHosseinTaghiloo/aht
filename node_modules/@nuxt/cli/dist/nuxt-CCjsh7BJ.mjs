import { t as __exportAll } from "./rolldown-runtime-D7D4PA-g.mjs";
import { s as debug, u as logger } from "./startup-clock-DXZlxuSA.mjs";
import { dirname, relative, resolve } from "pathe";
import { promises } from "node:fs";
import { createHash } from "node:crypto";
//#region src/utils/nuxt.ts
var nuxt_exports = /* @__PURE__ */ __exportAll({
	cleanupNuxtDirs: () => cleanupNuxtDirs,
	clearDevCaches: () => clearDevCaches,
	loadNuxtManifest: () => loadNuxtManifest,
	nuxtVersionToGitIdentifier: () => nuxtVersionToGitIdentifier,
	resolveNuxtManifest: () => resolveNuxtManifest,
	writeNuxtManifest: () => writeNuxtManifest
});
const GIT_ID_RE = /\.([0-9a-f]{7,8})$/;
async function cleanupNuxtDirs(rootDir, buildDir, options = {}) {
	const root = resolve(rootDir);
	const build = resolve(root, buildDir);
	if (build === root || root.startsWith(build.endsWith("/") ? build : `${build}/`)) throw new Error("Cannot clean a build directory that contains the project root.");
	if (!options.silent) logger.info("Cleaning up generated Nuxt files and caches...");
	const paths = new Set([
		build,
		".output",
		"dist",
		"node_modules/.vite",
		"node_modules/.cache"
	].map((dir) => resolve(root, dir)));
	await Promise.all([...paths].map((path) => {
		debug(`Removing recursive path: ${path}`);
		return promises.rm(path, {
			recursive: true,
			force: true
		});
	}));
}
/**
* Remove the caches that make a dev server start cold, returning them as
* project-relative paths.
*
* The dev lock lives in the build directory, so removing it wholesale would let
* a second dev server start against the same project unnoticed. Build output
* (`.output`, `dist`) is left alone as it has no bearing on `dev`.
*/
async function clearDevCaches(rootDir, buildDir) {
	const root = resolve(rootDir);
	const paths = [
		resolve(root, buildDir, "cache"),
		resolve(root, "node_modules/.vite"),
		resolve(root, "node_modules/.cache")
	];
	await Promise.all(paths.map((path) => {
		debug(`Removing recursive path: ${path}`);
		return promises.rm(path, {
			recursive: true,
			force: true
		});
	}));
	return paths.map((path) => relative(root, path));
}
function nuxtVersionToGitIdentifier(version) {
	const id = GIT_ID_RE.exec(version);
	if (id?.[1]) return id[1];
	return `v${version}`;
}
function resolveNuxtManifest(nuxt) {
	const manifest = {
		_hash: null,
		project: { rootDir: nuxt.options.rootDir },
		versions: { nuxt: nuxt._version }
	};
	manifest._hash = createHash("sha256").update(JSON.stringify([manifest.project.rootDir, manifest.versions.nuxt])).digest("base64url").slice(0, 10);
	return manifest;
}
async function writeNuxtManifest(nuxt, manifest = resolveNuxtManifest(nuxt)) {
	const manifestPath = resolve(nuxt.options.buildDir, "nuxt.json");
	await promises.mkdir(dirname(manifestPath), { recursive: true });
	await promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
	return manifest;
}
async function loadNuxtManifest(buildDir) {
	const manifestPath = resolve(buildDir, "nuxt.json");
	return await promises.readFile(manifestPath, "utf-8").then((data) => JSON.parse(data)).catch(() => null);
}
//#endregion
export { resolveNuxtManifest as a, nuxt_exports as i, loadNuxtManifest as n, writeNuxtManifest as o, nuxtVersionToGitIdentifier as r, cleanupNuxtDirs as t };
