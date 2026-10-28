import { i as withUserAttention, s as debug, u as logger } from "./startup-clock-DXZlxuSA.mjs";
import { c as withDirectStdout, o as restoreRawMode } from "./console-BgmzEcbV.mjs";
import { i as logNetworkError, t as findInPath } from "./path-env-D9Xd_BAN.mjs";
import { t as getCacheDir } from "./cache-CKYx3gns.mjs";
import process from "node:process";
import { confirm, isCancel, progress, spinner } from "@clack/prompts";
import { basename, dirname, join } from "pathe";
import { chmodSync, existsSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { execFileSync } from "node:child_process";
import { readUser, updateUser } from "rc9";
//#region src/dev/binaries.ts
/**
* Resolve a third-party tool binary: from `PATH`, then the download cache,
* then (with the user's consent) by downloading it.
*
* `cacheName` overrides the cached filename, so version-pinned tools can key
* their cache entry by version without affecting the `PATH` lookup.
*/
function resolveTool(name, options) {
	return withDirectStdout(() => locateTool(name, options));
}
async function locateTool(name, options) {
	const existing = findInPath(name);
	if (existing) return existing;
	const cacheName = options.cacheName || name;
	const cacheDir = getCacheDir("bin");
	const destination = join(cacheDir, process.platform === "win32" ? `${cacheName}.exe` : cacheName);
	if (dirname(destination) !== cacheDir) {
		debug(`Refusing to cache \`${name}\` outside ${cacheDir}.`);
		return;
	}
	if (existsSync(destination)) return destination;
	const { url } = options;
	if (!url) return;
	return withUserAttention(async () => {
		if (!await confirmToolInstall(options.consent)) return;
		return downloadBinary(url, destination, {
			archive: options.archive,
			name,
			sha256: options.sha256
		});
	});
}
/**
* Ask the user to accept a third-party tool's terms before downloading it, and
* remember their answer in the user-level `.nuxtrc` so we only ever ask once.
*/
async function confirmToolInstall(options) {
	try {
		if (readUser(".nuxtrc").tools?.[options.key]?.termsAccepted) return true;
	} catch (error) {
		debug("Failed to read user .nuxtrc:", error);
	}
	if (!process.stdout.isTTY) {
		logger.warn(options.nonInteractiveWarning);
		return false;
	}
	logger.message(options.notice.join("\n"));
	const agreed = await confirm({ message: options.message });
	restoreRawMode();
	if (isCancel(agreed) || agreed !== true) return false;
	try {
		updateUser({ tools: { [options.key]: { termsAccepted: true } } }, ".nuxtrc");
	} catch (error) {
		debug("Failed to update user .nuxtrc:", error);
	}
	return true;
}
const RESPONSE_TIMEOUT_MS = 3e4;
async function downloadBinary(url, destination, options = {}) {
	const label = options.name || url;
	try {
		const controller = new AbortController();
		const deadline = setTimeout(() => controller.abort(), RESPONSE_TIMEOUT_MS);
		let response;
		try {
			response = await fetch(url, { signal: controller.signal });
		} finally {
			clearTimeout(deadline);
		}
		if (!response.ok) throw new Error(`Unexpected response: ${response.status}`);
		const data = await readWithProgress(response, label);
		if (options.sha256) {
			const digest = createHash("sha256").update(data).digest("hex");
			if (digest !== options.sha256.toLowerCase()) throw new Error(`SHA-256 mismatch for \`${label}\`: expected ${options.sha256}, got ${digest}. The download was discarded.`);
		}
		const stagingDir = mkdtempSync(join(dirname(destination), ".staging-"));
		try {
			const staged = join(stagingDir, basename(destination));
			if (options.archive) {
				const archivePath = join(stagingDir, "archive.tgz");
				writeFileSync(archivePath, data);
				execFileSync("tar", [
					"-xzf",
					archivePath,
					"-C",
					stagingDir
				], { stdio: "ignore" });
				rmSync(archivePath);
				const extracted = join(stagingDir, options.name || basename(destination));
				if (extracted !== staged && existsSync(extracted)) renameSync(extracted, staged);
			} else writeFileSync(staged, data);
			if (!existsSync(staged)) throw new Error(`Archive did not contain \`${basename(destination)}\``);
			chmodSync(staged, 493);
			renameSync(staged, destination);
			return destination;
		} finally {
			rmSync(stagingDir, {
				recursive: true,
				force: true
			});
		}
	} catch (error) {
		debug(`Failed to download \`${url}\`:`, error);
		logNetworkError(error, {
			url,
			level: "warn",
			prefix: `Failed to download \`${label}\`.`
		});
		return;
	}
}
/**
* Read a response body into a buffer, reporting a progress bar when the server
* declares a `content-length` and an indeterminate spinner otherwise.
*/
async function readWithProgress(response, label) {
	const total = Number(response.headers.get("content-length")) || 0;
	const message = `Downloading \`${label}\``;
	if (!response.body || !process.stdout.isTTY) {
		logger.info(message);
		return Buffer.from(await response.arrayBuffer());
	}
	const indicator = total ? progress({
		style: "heavy",
		max: total
	}) : spinner();
	indicator.start(message);
	const chunks = [];
	let downloaded = 0;
	try {
		for await (const chunk of response.body) {
			chunks.push(Buffer.from(chunk));
			downloaded += chunk.byteLength;
			if (total) indicator.advance(chunk.byteLength);
			else indicator.message(`${message} (${formatSize(downloaded)})`);
		}
	} catch (error) {
		indicator.error(`Failed to download \`${label}\``);
		restoreRawMode();
		throw error;
	}
	indicator.stop(`Downloaded \`${label}\` (${formatSize(downloaded)})`);
	restoreRawMode();
	return Buffer.concat(chunks);
}
function formatSize(bytes) {
	return bytes < 1048576 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
//#endregion
export { resolveTool as t };
