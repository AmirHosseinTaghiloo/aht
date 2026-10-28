import { dirname, join, resolve } from "node:path";
import crypto from "node:crypto";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import flru from "flru";
import { defineDriver } from "unstorage";
import fsDriver from "unstorage/drivers/fs-lite";
//#region src/runtime/utils/cache-driver.mjs
/**
* @param {string} item
*/
function normalizeFsKey(item) {
	return `${item.replace(/[^\w.-]/g, "_").slice(0, 20)}-${crypto.createHash("sha256").update(item).digest("hex")}`;
}
/**
* Write `value` to `path` atomically so a concurrent reader never observes a
* truncated file: the payload is written to a unique sibling and renamed over
* the destination, which is a single filesystem operation.
* @param {string} path
* @param {string} value
*/
async function atomicWrite(path, value) {
	await mkdir(dirname(path), { recursive: true });
	const tmp = `${path}.${crypto.randomBytes(8).toString("hex")}.tmp`;
	try {
		await writeFile(tmp, value, "utf8");
		await rename(tmp, path);
	} catch (error) {
		await unlink(tmp).catch(() => {});
		throw error;
	}
}
var cache_driver_default = defineDriver(
	/**
	* @param {{ base?: string }} opts
	*/
	(opts) => {
		const fs = fsDriver({ base: opts.base });
		/** flru keeps an active and a stale half, so up to 2x `max` entries are retained. */
		const lru = flru(500);
		const base = resolve(opts.base || ".");
		return {
			...fs,
			async setItem(key, value) {
				await atomicWrite(join(base, normalizeFsKey(key)), value);
				lru.set(key, value);
			},
			async hasItem(key, opts) {
				return lru.has(key) || await fs.hasItem(normalizeFsKey(key), opts);
			},
			async getItem(key, opts) {
				return lru.get(key) || await fs.getItem(normalizeFsKey(key), opts);
			}
		};
	}
);
//#endregion
export { cache_driver_default as default };
