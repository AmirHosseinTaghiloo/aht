import { resolve } from "pathe";
//#region src/utils/server-build.ts
/** Default output locations Nuxt uses when no server builder declares its own. */
const DEFAULT_OUTPUT_DIR = ".output";
const DEFAULT_PUBLIC_DIR = ".output/public";
/** What a deploy target is called when the builder does not say. */
const DEFAULT_TARGET_LABEL = "preset";
/**
* The Nitro instance for this build, or `undefined` when the configured server
* builder did not create one.
*
* `tryUseNitro` is only present in newer `@nuxt/kit`; on older versions
* `useNitro` throwing means the same thing.
*/
function tryUseNitro(kit) {
	if (typeof kit.tryUseNitro === "function") return kit.tryUseNitro();
	try {
		return kit.useNitro();
	} catch {
		return;
	}
}
/**
* The display name of the configured server builder.
*
* Nuxt describes it on `nuxt.serverBuild`; older versions are read from the
* `server.builder` option, where a module specifier such as `@nuxt/vite-server`
* reads as `vite`.
*/
function getServerBuilderName(nuxt, hasServer) {
	const declared = nuxt.serverBuild;
	const name = declared ? declared.label || normalizeBuilderName(declared.name) : inferBuilderName(nuxt);
	if (name === "nitro") return "Nitro";
	if (name) return name;
	return hasServer === false ? "unknown" : "Nitro";
}
/**
* The server builder named by the `server.builder` option, for Nuxt versions
* that do not describe the build themselves.
*/
function inferBuilderName(nuxt) {
	const builder = nuxt.options.server?.builder;
	if (typeof builder === "string" && builder) return normalizeBuilderName(builder);
	return builder ? "custom" : void 0;
}
/** A module specifier such as `@nuxt/vite-server` read as a builder name. */
function normalizeBuilderName(specifier) {
	return specifier.replace(/^@nuxt\//, "").replace(/-server$/, "");
}
/**
* Describe a loaded Nuxt instance's build in builder-agnostic terms.
*
* `nuxt.serverBuild` answers all of this where it exists; otherwise it is
* reconstructed from the Nitro instance and Nuxt's defaults, so the CLI keeps
* working against Nuxt versions that predate the descriptor.
*/
function resolveServerBuild(kit, nuxt) {
	const declared = nuxt.serverBuild;
	const getNitro = () => declared?.capabilities.server === false ? void 0 : tryUseNitro(kit);
	return {
		targetLabel: declared?.targetLabel ?? DEFAULT_TARGET_LABEL,
		declared: !!declared,
		hasDevServer: declared?.capabilities.dev ?? true,
		get label() {
			return getServerBuilderName(nuxt, !!getNitro());
		},
		get target() {
			return declared?.target?.() ?? getNitro()?.options.preset;
		},
		get dir() {
			return resolve(declared?.output.dir() ?? getNitro()?.options.output?.dir ?? resolve(nuxt.options.rootDir, nuxt.options.nitro?.output?.dir || DEFAULT_OUTPUT_DIR));
		},
		get publicDir() {
			return resolve(declared?.output.publicDir() ?? getNitro()?.options.output?.publicDir ?? resolve(nuxt.options.rootDir, nuxt.options.nitro?.output?.publicDir || DEFAULT_PUBLIC_DIR));
		},
		get previewCommand() {
			return declared?.preview?.command?.() ?? getNitro()?.options.commands?.preview;
		},
		get previewStaticDir() {
			const dir = declared?.preview?.staticDir?.();
			return dir ? resolve(dir) : void 0;
		}
	};
}
//#endregion
export { resolveServerBuild as t };
