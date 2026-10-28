import process from "node:process";
import { join } from "pathe";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
//#region src/utils/cache.ts
/**
* A directory under the user's cache home (`XDG_CACHE_HOME`, else `~/.cache`)
* for Nuxt to keep downloaded artefacts in, created if it does not exist.
*/
function getCacheDir(...segments) {
	const base = process.env.XDG_CACHE_HOME || join(homedir(), ".cache");
	const dir = join(base, "nuxt", ...segments);
	mkdirSync(dir, { recursive: true });
	return dir;
}
//#endregion
export { getCacheDir as t };
