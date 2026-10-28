import { t as __exportAll } from "./rolldown-runtime-D7D4PA-g.mjs";
import { join } from "node:path";
import process from "node:process";
import * as fs from "node:fs";
import { Buffer } from "node:buffer";
import { homedir } from "node:os";
import { parseINI } from "confbox/ini";
//#region src/utils/registry.ts
var registry_exports = /* @__PURE__ */ __exportAll({
	PUBLIC_REGISTRY: () => PUBLIC_REGISTRY,
	detectNpmRegistry: () => detectNpmRegistry
});
const TRAILING_SLASH_RE = /\/$/;
const ENV_REFERENCE_RE = /\$\{([^}]+)\}/g;
/** The registry every public package can be read from, whatever else is configured. */
const PUBLIC_REGISTRY = "https://registry.npmjs.org";
function registryFromConfig(config, scope) {
	return scope && config[`${scope}:registry`]?.trim() || config.registry?.trim() || null;
}
/** Parsed `.npmrc` files, most specific first; only the user file without a `cwd`. */
async function readNpmrcs(cwd) {
	const paths = cwd ? [join(cwd, ".npmrc"), join(homedir(), ".npmrc")] : [join(homedir(), ".npmrc")];
	return (await Promise.all(paths.map(async (npmrcPath) => {
		let fd;
		try {
			fd = await fs.promises.open(npmrcPath, "r");
			if (await fd.stat().then((r) => r.isFile())) return parseINI(await fd.readFile("utf-8"));
		} catch {} finally {
			await fd?.close();
		}
	}))).filter((c) => !!c);
}
/**
* `npm` credentials apply to a registry URL prefix, not just a host, so a registry
* served from a path (`https://host/npm/`) is configured as
* `//host/npm/:_authToken`. Each prefix is tried from the most specific down to
* the bare host, as `npm` does.
*/
function authKeyPrefixes(registry) {
	let url;
	try {
		url = new URL(registry);
	} catch {
		return [];
	}
	const segments = url.pathname.split("/").filter(Boolean);
	const prefixes = [];
	for (let depth = segments.length; depth >= 0; depth--) prefixes.push(`//${url.host}${segments.slice(0, depth).map((segment) => `/${segment}`).join("")}/`);
	return prefixes;
}
/** `npm` expands `${VAR}` in `.npmrc` values from the environment. */
function expand(value) {
	return value.trim().replace(ENV_REFERENCE_RE, (match, name) => process.env[name] ?? match);
}
function readCredentials(config, registry) {
	for (const prefix of authKeyPrefixes(registry)) {
		const token = config[`${prefix}:_authToken`];
		if (token) {
			const authToken = expand(token);
			return {
				authToken,
				authorization: `Bearer ${authToken}`
			};
		}
		const auth = config[`${prefix}:_auth`];
		if (auth) return {
			authToken: null,
			authorization: `Basic ${expand(auth)}`
		};
		const username = config[`${prefix}:username`];
		const password = config[`${prefix}:_password`];
		if (username && password) {
			const decoded = Buffer.from(expand(password), "base64").toString("utf8");
			return {
				authToken: null,
				authorization: `Basic ${Buffer.from(`${expand(username)}:${decoded}`).toString("base64")}`
			};
		}
	}
}
/**
* Registry and credentials for `scope`, from the project's `.npmrc` in `cwd`
* (defaulting to the working directory) and then the user's. Pass `null` as
* `cwd` to ignore project configuration entirely: a project `.npmrc` may name any
* host and, as in `npm`, reference environment variables in its credentials, so
* a request the user did not ask for should not be steered by it.
*/
async function detectNpmRegistry(scope, cwd = process.cwd()) {
	const configs = await readNpmrcs(cwd ?? void 0);
	const registry = (process.env.COREPACK_NPM_REGISTRY || configs.map((config) => registryFromConfig(config, scope)).find(Boolean) || "https://registry.npmjs.org").replace(TRAILING_SLASH_RE, "");
	for (const config of configs) {
		const credentials = readCredentials(config, registry);
		if (credentials) return {
			registry,
			...credentials
		};
	}
	return {
		registry,
		authToken: null,
		authorization: null
	};
}
//#endregion
export { detectNpmRegistry as n, registry_exports as r, PUBLIC_REGISTRY as t };
