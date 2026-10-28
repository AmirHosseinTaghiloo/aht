import { c as isProcessAlive, d as readActiveLock, f as readLock } from "./lockfile-BZHfAuKg.mjs";
import { n as getNuxtConfig } from "./nuxt-config-zyufWWwx.mjs";
import { styleText } from "node:util";
import { join, resolve } from "pathe";
import { existsSync, readFileSync } from "node:fs";
import { isIP } from "node:net";
import { networkInterfaces } from "node:os";
//#region src/utils/dev-server.ts
const TRAILING_SLASH_RE = /\/$/;
/** Loopback address to dial for each wildcard a listener can be bound to. */
const LOOPBACK_FOR_WILDCARD = {
	"0.0.0.0": "127.0.0.1",
	"[::]": "[::1]"
};
/**
* Directory a project's `nuxt.lock` lives in.
*
* `.nuxt` answers this for nearly every project, so `nuxt.config` is only
* evaluated when that directory is absent: resolving `buildDir` properly means
* executing the user's config, and `nuxt dev` does not otherwise do that in the
* process that decides whether to take a running server over. A project that
* moved its `buildDir` but kept a stale `.nuxt` therefore reads as the default,
* which loses the takeover but never claims a directory that is in use.
*/
async function resolveLockDir(cwd) {
	const defaultDir = resolve(cwd, ".nuxt");
	if (readLock(defaultDir) || existsSync(defaultDir)) return defaultDir;
	return await configuredBuildDir(cwd) || defaultDir;
}
/**
* Locate a live `nuxt dev` server for a project, using the metadata its dev
* server records in `nuxt.lock` inside the build directory.
*
* `buildDir` may be passed when it is already known.
*/
async function findDevServer(cwd, buildDir) {
	const dir = buildDir ? resolve(cwd, buildDir) : await resolveLockDir(cwd);
	const lock = readActiveLock(dir);
	if (lock?.command === "dev" && lock.url && isOwnAddress(lock.url)) return {
		url: toLoopback(lock.url),
		pid: lock.pid,
		cwd: lock.cwd
	};
}
/**
* Whether `url` names this machine. A dev server records the address it bound,
* which is always local, but the lock file it is read from lives in the project
* and so may have been written by someone else. Requests carrying the user's
* headers and payloads are only sent to an origin this machine could have bound.
*/
function isOwnAddress(url) {
	let hostname;
	try {
		hostname = new URL(url).hostname;
	} catch {
		return false;
	}
	if (isLocalHost(hostname)) return true;
	const address = hostname.startsWith("[") ? hostname.slice(1, -1) : hostname;
	if (!isIP(address)) return false;
	return Object.values(networkInterfaces()).flat().some((info) => info?.address === address);
}
/**
* A dev server bound to every interface records the wildcard it was given, but
* that is not an address to connect to: Windows refuses `0.0.0.0` outright, and
* Nitro only serves its dev-only routes (the task runner, the VFS viewer) to
* requests arriving on the loopback interface.
*/
function toLoopback(url) {
	let parsed;
	try {
		parsed = new URL(url);
	} catch {
		return url.replace(TRAILING_SLASH_RE, "");
	}
	const loopback = LOOPBACK_FOR_WILDCARD[parsed.hostname];
	if (loopback) parsed.hostname = loopback;
	return parsed.href.replace(TRAILING_SLASH_RE, "");
}
/**
* Locate the Nitro dev worker behind a dev server, from the build info Nitro
* writes for its own task runner.
*
* The worker answers the dev-only routes directly, so reaching it needs neither
* the public listener nor the dev proxy in front of it. Nitro 2 records this in
* `<buildDir>/nitro.json` and Nitro 3 in `node_modules/.nitro/nitro.dev.json`;
* both are internal to Nitro, so everything here is best-effort.
*/
async function findNitroDevWorker(cwd, buildDir) {
	const dir = buildDir ? resolve(cwd, buildDir) : await resolveLockDir(cwd);
	for (const path of [join(dir, "nitro.json"), join(cwd, "node_modules/.nitro/nitro.dev.json")]) {
		const dev = readBuildInfo(path)?.dev;
		if (!dev?.pid || !dev.workerAddress || !isProcessAlive(dev.pid)) continue;
		const { socketPath, host, port } = dev.workerAddress;
		if (typeof socketPath === "string" && socketPath) return {
			pid: dev.pid,
			socketPath
		};
		if (typeof port === "number" && Number.isInteger(port) && port > 0 && port <= 65535 && isLocalHost(host)) return {
			pid: dev.pid,
			url: `http://${host || "localhost"}:${port}`
		};
	}
}
const LOCAL_HOSTS = /* @__PURE__ */ new Set([
	"",
	"localhost",
	"127.0.0.1",
	"::1",
	"[::1]",
	"0.0.0.0",
	"::",
	"[::]"
]);
/**
* Whether an address recorded by Nitro belongs to this machine. The worker is
* always local, and the file naming it lives in the project, so an address
* pointing anywhere else is not one we should send task payloads to.
*/
function isLocalHost(host) {
	return LOCAL_HOSTS.has(host ?? "");
}
function noDevServerMessage(what) {
	return `No running Nuxt dev server found. Start one with ${styleText("cyan", "nuxt dev")}, or pass an absolute URL to ${styleText("cyan", what)}.`;
}
function readBuildInfo(path) {
	try {
		return JSON.parse(readFileSync(path, "utf-8"));
	} catch {
		return;
	}
}
async function configuredBuildDir(cwd) {
	try {
		const config = await getNuxtConfig(cwd);
		return config.buildDir ? resolve(cwd, config.buildDir) : void 0;
	} catch {
		return;
	}
}
//#endregion
export { toLoopback as a, resolveLockDir as i, findNitroDevWorker as n, noDevServerMessage as r, findDevServer as t };
