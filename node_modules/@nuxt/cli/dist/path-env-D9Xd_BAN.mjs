import { u as logger } from "./startup-clock-DXZlxuSA.mjs";
import process from "node:process";
import { styleText } from "node:util";
import { isWindows } from "std-env";
import { basename, delimiter, join, resolve } from "pathe";
import { existsSync } from "node:fs";
//#region src/utils/shell-quote.ts
const NEEDS_QUOTING_RE = /[\s"'$`\\]/;
const SINGLE_QUOTE_RE = /'/g;
const BACKSLASHES_BEFORE_QUOTE_RE = /(\\*)"/g;
const TRAILING_BACKSLASHES_RE = /(\\*)$/;
/**
* Quote `value` for the shell: single quotes on POSIX (where `$` expands inside
* double quotes), double quotes on Windows with backslashes doubled before a quote.
*/
function quoteArgument(value, windows) {
	if (!NEEDS_QUOTING_RE.test(value)) return value;
	if (!windows) return `'${value.replace(SINGLE_QUOTE_RE, `'\\''`)}'`;
	return `"${value.replace(BACKSLASHES_BEFORE_QUOTE_RE, "$1$1\\\"").replace(TRAILING_BACKSLASHES_RE, "$1$1")}"`;
}
//#endregion
//#region src/utils/network.ts
const PROXY_ENV_VARS = [
	"HTTP_PROXY",
	"http_proxy",
	"HTTPS_PROXY",
	"https_proxy",
	"ALL_PROXY",
	"all_proxy"
];
function hasProxyEnv(env = process.env) {
	return PROXY_ENV_VARS.some((key) => !!env[key]);
}
const USE_ENV_PROXY_RE = /(?:^|\s)--use-env-proxy(?:$|[\s=])/;
/**
* Whether the current process routes requests through the proxy environment
* variables. Node.js resolves this during bootstrap, so it cannot be turned on
* from within the process.
*/
function isEnvProxyActive(env = process.env, execArgv = process.execArgv) {
	return env.NODE_USE_ENV_PROXY === "1" || execArgv.includes("--use-env-proxy") || USE_ENV_PROXY_RE.test(env.NODE_OPTIONS || "");
}
function getGlobalProxySetter() {
	return process.getBuiltinModule("node:http").setGlobalProxyFromEnv ?? null;
}
let envProxyActive;
let proxyHintShown = false;
/**
* Route requests from this process and its children through the proxy
* environment variables, and record whether this process is proxy-aware.
*/
function setupProxySupport(env = process.env, enableGlobalProxy) {
	proxyHintShown = false;
	if (!hasProxyEnv(env)) {
		envProxyActive = void 0;
		return "unused";
	}
	envProxyActive = isEnvProxyActive(env);
	if (!envProxyActive && env.NODE_USE_ENV_PROXY !== "0") {
		const enable = enableGlobalProxy === void 0 ? getGlobalProxySetter() : enableGlobalProxy;
		if (enable) {
			enable(env);
			envProxyActive = true;
		}
	}
	env.NODE_USE_ENV_PROXY ||= "1";
	return envProxyActive ? "active" : "children-only";
}
const BIN_NAMES = /* @__PURE__ */ new Set([
	"nuxi",
	"nuxi-ng",
	"nuxt",
	"nuxt-cli"
]);
const BIN_EXTENSION_RE = /\.[cm]?js$/;
/**
* The command the user typed, if it can be reconstructed. Returns `undefined`
* when the CLI was reached indirectly (`npm create nuxt`, `npx`, programmatic
* usage), where echoing `argv` back would suggest a command that does not exist.
*/
function getCurrentCommand(argv, windows) {
	const entry = argv[1];
	if (!entry || !BIN_NAMES.has(basename(entry).replace(BIN_EXTENSION_RE, ""))) return;
	return ["nuxt", ...argv.slice(2).map((arg) => quoteArgument(arg, windows))].join(" ");
}
/**
* A copy-pasteable command that re-runs the current invocation with extra
* environment variables, in the syntax of the shell the user is most likely in.
* Falls back to just the assignment when the invocation is not reconstructable.
*/
function formatRetryCommand(vars, ctx = {}) {
	const { argv = process.argv, env = process.env, windows = isWindows } = ctx;
	const command = getCurrentCommand(argv, windows);
	const entries = Object.entries(vars);
	if (windows) {
		const isPowerShell = !!env.PSModulePath;
		const assignments = entries.map(([key, value]) => isPowerShell ? `$env:${key}="${value}"` : `set ${key}=${value}`);
		const separator = isPowerShell ? "; " : " && ";
		return [...assignments, ...command ? [command] : []].join(separator);
	}
	const assignments = entries.map(([key, value]) => `${key}=${value}`);
	return command ? [...assignments, command].join(" ") : `export ${assignments.join(" ")}`;
}
const ERROR_CODE_RE = /\b(E(?:NOTFOUND|AI_AGAIN|CONNREFUSED|CONNRESET|TIMEDOUT|PIPE|PROTO)|UND_ERR_[A-Z_]+|ERR_(?:SSL|TLS)_[A-Z_]+|(?:CERT|DEPTH_ZERO|SELF_SIGNED|UNABLE_TO)[A-Z_]*)\b/;
function getErrorCode(err) {
	let current = err;
	for (let depth = 0; current && typeof current === "object" && depth < 5; depth++) {
		const code = current.code;
		if (typeof code === "string") return code;
		const message = current.message;
		if (typeof message === "string") {
			const match = message.match(ERROR_CODE_RE);
			if (match) return match[1];
		}
		current = current.cause;
	}
}
function getErrorName(err) {
	let current = err;
	for (let depth = 0; current && typeof current === "object" && depth < 5; depth++) {
		const name = current.name;
		if (typeof name === "string" && name !== "Error" && name !== "TypeError" && name !== "FetchError") return name;
		current = current.cause;
	}
}
function getStatus(err) {
	const status = err;
	for (const value of [
		status?.status,
		status?.statusCode,
		status?.response?.status
	]) if (typeof value === "number") return value;
}
function getHost(url) {
	if (!url) return;
	try {
		return new URL(url).host;
	} catch {
		return;
	}
}
function classifyNetworkError(err) {
	const code = getErrorCode(err);
	const status = getStatus(err);
	if (status) return {
		kind: status === 407 ? "proxy-auth" : "http",
		status,
		code
	};
	switch (code) {
		case "ENOTFOUND":
		case "EAI_AGAIN": return {
			kind: "dns",
			code
		};
		case "ECONNREFUSED": return {
			kind: "refused",
			code
		};
		case "ECONNRESET":
		case "EPIPE": return {
			kind: "reset",
			code
		};
		case "ETIMEDOUT":
		case "UND_ERR_CONNECT_TIMEOUT":
		case "UND_ERR_HEADERS_TIMEOUT":
		case "UND_ERR_BODY_TIMEOUT": return {
			kind: "timeout",
			code
		};
		case "CERT_HAS_EXPIRED":
		case "DEPTH_ZERO_SELF_SIGNED_CERT":
		case "SELF_SIGNED_CERT_IN_CHAIN":
		case "UNABLE_TO_GET_ISSUER_CERT_LOCALLY":
		case "UNABLE_TO_VERIFY_LEAF_SIGNATURE":
		case "EPROTO": return {
			kind: "tls",
			code
		};
	}
	if (code?.startsWith("ERR_SSL_") || code?.startsWith("ERR_TLS_")) return {
		kind: "tls",
		code
	};
	if (code === "ABORT_ERR" || getErrorName(err) === "AbortError" || getErrorName(err) === "TimeoutError") return {
		kind: "timeout",
		code
	};
	return {
		kind: "unknown",
		code
	};
}
/** A single-line, human-readable explanation of a failed network request. */
function describeNetworkError(err, url) {
	const host = getHost(url);
	const target = host ? styleText("cyan", host) : "the network";
	const { kind, code, status } = classifyNetworkError(err);
	switch (kind) {
		case "proxy-auth": return `Proxy rejected the request to ${target} with status ${styleText("yellow", "407")} (proxy authentication required).`;
		case "http": return `Request to ${target} failed with status ${styleText("yellow", String(status))}.`;
		case "dns": return code === "EAI_AGAIN" ? `DNS lookup for ${target} timed out.` : `Could not resolve ${target} (DNS lookup failed).`;
		case "refused": return `Connection to ${target} was refused.`;
		case "reset": return `Connection to ${target} was reset before the response completed.`;
		case "timeout": return `Connection to ${target} timed out.`;
		case "tls": return `TLS connection to ${target} could not be verified (${code}).`;
	}
	const message = err instanceof Error ? err.message : String(err);
	if (message.includes("fetch failed")) return `Could not reach ${target}.`;
	return `Could not reach ${target}: ${message}`;
}
/**
* Advice for failures a proxy could explain, naming the command to re-run.
* Returns `undefined` when the proxy is already in use or cannot be at fault.
*/
function getProxyHint(kind = "unknown", ctx = {}) {
	const env = ctx.env ?? process.env;
	const proxyInUse = () => envProxyActive ?? isEnvProxyActive(env);
	if (kind === "http" && (!hasProxyEnv(env) || proxyInUse())) return;
	if (kind === "tls") return `This usually means a proxy is re-signing TLS traffic. Retry with your organisation's root certificate: ${styleText("cyan", formatRetryCommand({ NODE_EXTRA_CA_CERTS: "/path/to/corporate-ca.pem" }, ctx))}`;
	if (kind === "proxy-auth") return `Include credentials in your proxy URL, e.g. ${styleText("cyan", "HTTPS_PROXY=http://user:password@proxy.example.com:8080")}.`;
	if (!hasProxyEnv(env)) return `If you are behind a proxy, set ${styleText("cyan", "HTTPS_PROXY")} and ${styleText("cyan", "NODE_USE_ENV_PROXY=1")} (plus ${styleText("cyan", "NO_PROXY")} for internal hosts).`;
	if (!proxyInUse()) return `A proxy is configured but Node.js only reads it at startup. Retry with ${styleText("cyan", formatRetryCommand({ NODE_USE_ENV_PROXY: "1" }, ctx))}`;
	if (kind === "reset") return `The proxy may be re-signing TLS traffic. Retry with your organisation's root certificate: ${styleText("cyan", formatRetryCommand({ NODE_EXTRA_CA_CERTS: "/path/to/corporate-ca.pem" }, ctx))}`;
}
/**
* Log a failed network request together with at most one line of advice. The
* proxy hint is shown once per process: several requests usually fail for the
* same reason, and repeating the retry command for each one is noise.
*/
function logNetworkError(err, options = {}) {
	const description = describeNetworkError(err, options.url);
	const message = options.prefix ? `${options.prefix} ${description}` : description;
	logger[options.level === "warn" ? "warn" : "error"](message);
	const proxyHint = proxyHintShown ? void 0 : getProxyHint(classifyNetworkError(err).kind);
	proxyHintShown ||= !!proxyHint;
	const hints = [...options.hints || [], proxyHint].filter(Boolean);
	if (hints.length > 0) logger.info(hints.join(" "));
}
//#endregion
//#region src/utils/path-env.ts
/**
* Return a copy of `env` with `dirs` prepended to its `PATH`.
*
* On Windows the variable may be named `Path`, and adding a second `PATH` key
* would leave the child with two conflicting entries, so the existing key is
* reused when present.
*/
function withPrependedPath(env, dirs) {
	const result = { ...env };
	const key = pathKey(result);
	const current = result[key];
	result[key] = [...dirs, ...current ? [current] : []].join(delimiter);
	return result;
}
function withLocalBinPath(cwd, env = process.env) {
	return withPrependedPath(env, [resolve(cwd, "node_modules/.bin")]);
}
function pathKey(env) {
	return Object.keys(env).find((name) => name.toLowerCase() === "path") ?? "PATH";
}
/**
* The path `name` resolves to on `env`'s `PATH`, or `undefined` if it is not there.
*
* Callers cannot rely on a failed spawn to tell them a command is missing: on
* Windows a bare name is run through `cmd.exe`, which reports its own "not
* recognized" error rather than `ENOENT`. Which extensions make a file executable
* is a Windows concept, so `PATHEXT` is consulted there and nowhere else.
*/
function findInPath(name, env = process.env) {
	const extensions = process.platform === "win32" ? (env.PATHEXT || ".EXE;.CMD;.BAT;.COM").split(";").filter(Boolean) : [""];
	for (const dir of (env[pathKey(env)] || "").split(delimiter)) {
		if (!dir) continue;
		for (const extension of extensions) {
			const candidate = join(dir, name + extension);
			if (existsSync(candidate)) return candidate;
		}
	}
}
//#endregion
export { setupProxySupport as a, logNetworkError as i, withLocalBinPath as n, withPrependedPath as r, findInPath as t };
