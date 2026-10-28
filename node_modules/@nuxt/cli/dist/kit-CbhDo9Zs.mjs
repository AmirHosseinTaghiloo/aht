import { S as ActionableError } from "./startup-clock-DXZlxuSA.mjs";
import { t as tryResolveNuxt } from "./resolve-nuxt-VKCDOC-A.mjs";
import { pathToFileURL } from "node:url";
import { resolveModulePath } from "exsolve";
//#region src/utils/kit.ts
const KIT_NOT_FOUND_RE = /Cannot (?:find|resolve) module ['"]@nuxt\/kit['"]/;
async function loadKit(rootDir) {
	try {
		const kitPath = resolveModulePath("@nuxt/kit", { from: tryResolveNuxt(rootDir) || rootDir });
		return await import(pathToFileURL(kitPath).href);
	} catch (e) {
		if (KIT_NOT_FOUND_RE.test(String(e))) throw new ActionableError("nuxi requires `@nuxt/kit` to be installed in your project. Try installing `nuxt` v3+ first.");
		throw e;
	}
}
//#endregion
export { loadKit as t };
