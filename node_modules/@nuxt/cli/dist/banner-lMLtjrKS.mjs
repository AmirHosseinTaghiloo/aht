import { u as logger } from "./startup-clock-DXZlxuSA.mjs";
import { t as NUXT_PACKAGES } from "./nuxt-packages-2vh2Ybse.mjs";
import { n as getPkgJSON, r as getPkgVersion, t as getNuxtPkgVersion } from "./pkg-CInP2k7X.mjs";
import { styleText } from "node:util";
//#region src/utils/nitro.ts
/**
* Names Nitro is installed under, newest naming first, so a manifest that
* declares more than one resolves to the current name.
*
* Nightly releases are aliased onto these names (for example
* `"nitropack": "npm:nitropack-nightly@latest"`), so they are not separate keys.
*/
const NITRO_PKGS = ["nitro", "nitropack"];
/**
* The package that declares Nitro in Nuxt versions where `nuxt` itself does
* not. Only consulted when the installed Nuxt declares it as a dependency, so
* a copy installed outside the Nuxt dependency chain cannot shadow the Nitro
* version Nuxt actually uses.
*/
const NITRO_SERVER_PKG = "@nuxt/nitro-server";
/**
* The Nitro packages to look for, the one the installed Nuxt depends on first.
*
* The plain names are kept as later candidates so Nitro is still found when no
* owning manifest can be read (`exports` withholding `package.json`, or Nitro
* installed without Nuxt).
*/
function getNitroCandidates(cwd) {
	const candidates = NITRO_PKGS.map((name) => ({ name }));
	const declared = getNuxtNitroDependency(cwd);
	return declared ? [declared, ...candidates] : candidates;
}
/**
* The Nitro package the installed Nuxt depends on, directly or through
* `@nuxt/nitro-server`, or `undefined` when no owning manifest can be read.
*/
function getNuxtNitroDependency(cwd) {
	const readManifest = (name, via) => getPkgJSON(cwd, name, {
		via,
		strict: true
	});
	for (const owner of NUXT_PACKAGES) {
		const manifest = readManifest(owner);
		if (!manifest) continue;
		const name = findNitroPkgName(manifest);
		if (name) return {
			name,
			via: [owner]
		};
		if (manifest.dependencies?.[NITRO_SERVER_PKG]) {
			const server = findNitroPkgName(readManifest(NITRO_SERVER_PKG, [owner]));
			if (server) return {
				name: server,
				via: [owner, NITRO_SERVER_PKG]
			};
		}
	}
}
/** The name of the Nitro package a manifest depends on. */
function findNitroPkgName(manifest) {
	const deps = manifest?.dependencies;
	return deps && NITRO_PKGS.find((name) => name in deps);
}
/** The version of the first candidate installed in the project. */
function getInstalledVersion(cwd, candidates) {
	for (const { name, via } of candidates) {
		const version = getPkgVersion(cwd, name, via && {
			via,
			strict: true
		});
		if (version) return version;
	}
	return "";
}
/** The version of Nitro the installed Nuxt depends on. */
function getNitroVersion(cwd) {
	return getInstalledVersion(cwd, getNitroCandidates(cwd));
}
/**
* The version of Nitro the installed Nuxt depends on, falling back to the
* version `getDepVersion` reports when no Nitro package can be resolved from
* the project (for example when it is only declared in a catalog).
*/
async function resolveNitroVersion(cwd, getDepVersion) {
	const candidates = getNitroCandidates(cwd);
	const version = getInstalledVersion(cwd, candidates);
	if (version) return version;
	for (const { name } of candidates) {
		const declared = await getDepVersion(name);
		if (declared) return declared;
	}
}
//#endregion
//#region src/utils/banner.ts
function getBuilder(cwd, builder) {
	switch (builder) {
		case "rspack":
		case "@nuxt/rspack-builder": return {
			name: "Rspack",
			version: getPkgVersion(cwd, "@rspack/core", { via: ["@nuxt/rspack-builder"] })
		};
		case "webpack":
		case "@nuxt/webpack-builder": return {
			name: "Webpack",
			version: getPkgVersion(cwd, "webpack", { via: ["@nuxt/webpack-builder"] })
		};
		default: {
			const pkgJSON = getPkgJSON(cwd, "vite", { via: ["nuxt", "@nuxt/vite-builder"] });
			const isRolldown = pkgJSON?.name.includes("rolldown");
			const isVitePlus = pkgJSON?.name === "@voidzero-dev/vite-plus-core";
			return {
				name: isRolldown ? "Rolldown-Vite" : "Vite",
				version: (isVitePlus ? pkgJSON?.bundledVersions?.vite : pkgJSON?.version) || "unknown",
				provider: isVitePlus ? {
					name: "Vite+",
					version: pkgJSON?.version || "unknown"
				} : void 0
			};
		}
	}
}
function showBanner(nuxt) {
	logger.info(describeStack(nuxt.options.rootDir, {
		nuxtVersion: nuxt._version,
		builder: nuxt.options.builder
	}));
}
/** The versions of the framework packages in use, for the banner and the dev UI. */
function resolveStackVersions(cwd, options = {}) {
	return {
		nuxt: options.nuxtVersion || getNuxtPkgVersion(cwd),
		nitro: getNitroVersion(cwd),
		builder: getBuilder(cwd, options.builder),
		vue: getPkgVersion(cwd, "vue", { via: ["nuxt"] }) || null
	};
}
/** The `Nuxt x (with Nitro y, Vite z and Vue w)` line shown at startup. */
function describeStack(cwd, options = {}) {
	const { nuxt: nuxtVersion, nitro: nitroVersion, builder, vue: vueVersion } = resolveStackVersions(cwd, options);
	const builderPart = `${builder.name} ${styleText("bold", builder.version)}${builder.provider ? ` via ${builder.provider.name} ${styleText("bold", builder.provider.version)}` : ""}`;
	const parts = [
		nitroVersion ? `Nitro ${styleText("bold", nitroVersion)}` : null,
		builderPart,
		vueVersion ? `Vue ${styleText("bold", vueVersion)}` : null
	].filter((part) => !!part);
	const detail = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0];
	return styleText("green", `Nuxt ${styleText("bold", nuxtVersion)}`) + styleText("gray", ` (with ${detail})`);
}
//#endregion
export { resolveNitroVersion as i, resolveStackVersions as n, showBanner as r, getBuilder as t };
