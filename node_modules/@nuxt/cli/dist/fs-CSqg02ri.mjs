import { join } from "pathe";
import { existsSync, promises } from "node:fs";
//#region src/utils/fs.ts
async function clearDir(path, exclude) {
	if (!exclude) await promises.rm(path, {
		recursive: true,
		force: true
	});
	else if (existsSync(path)) {
		const files = await promises.readdir(path);
		await Promise.all(files.map(async (name) => {
			if (!exclude.includes(name)) await promises.rm(join(path, name), {
				recursive: true,
				force: true
			});
		}));
	}
	await promises.mkdir(path, { recursive: true });
}
function clearBuildDir(path) {
	return clearDir(path, [
		"cache",
		"analyze",
		"nuxt.json",
		"nuxt.lock"
	]);
}
//#endregion
export { clearDir as n, clearBuildDir as t };
