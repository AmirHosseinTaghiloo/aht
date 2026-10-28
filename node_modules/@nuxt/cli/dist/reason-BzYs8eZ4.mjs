import { s as debug, u as logger } from "./startup-clock-DXZlxuSA.mjs";
import { n as relativeTo } from "./paths-DlXZaaIg.mjs";
import process from "node:process";
import { styleText } from "node:util";
//#region src/dev/inspect.ts
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 9229;
const INSPECT_ENV = "__NUXT_DEV_INSPECT__";
const INSPECT_ARG_RE = /^--inspect(-brk|-wait|-port)?(?:=(.*))?$/;
/**
* Resolve Node inspector options from CLI/exec arguments, following Node's own
* `--inspect[=[host:]port]` parsing rules.
*
* Returns `undefined` when the inspector was not requested. `--inspect-port` on
* its own does not enable the inspector, it only sets the address to use.
*/
function parseInspectArgs(args) {
	let enabled = false;
	let wait = false;
	let host = DEFAULT_HOST;
	let port = DEFAULT_PORT;
	for (const arg of args) {
		const match = INSPECT_ARG_RE.exec(arg);
		if (!match) continue;
		const [, modifier, value] = match;
		if (modifier !== "-port") {
			enabled = true;
			wait ||= modifier === "-brk" || modifier === "-wait";
		}
		const target = parseTarget(value);
		if (target.host !== void 0) host = target.host;
		if (target.port !== void 0) port = target.port;
	}
	return enabled ? {
		host,
		port,
		wait
	} : void 0;
}
function parseTarget(value) {
	if (!value) return {};
	if (value.startsWith("[")) {
		const end = value.indexOf("]");
		if (end === -1) return {};
		const host = value.slice(1, end);
		const rest = value.slice(end + 1);
		return rest.startsWith(":") ? {
			host,
			port: toPort(rest.slice(1))
		} : { host };
	}
	const separator = value.lastIndexOf(":");
	if (separator !== -1) return {
		host: value.slice(0, separator) || DEFAULT_HOST,
		port: toPort(value.slice(separator + 1))
	};
	if (/^\d+$/.test(value)) return { port: toPort(value) };
	return { host: value };
}
function toPort(value) {
	if (!/^\d+$/.test(value)) return;
	const port = Number(value);
	return port >= 0 && port <= 65535 ? port : void 0;
}
/**
* Open the inspector for the nitro dev server worker on the requested address,
* and the inspector for this process on the next port. Node's own inspector
* from `execArgv` is moved there too.
*/
async function openInspector(inspectOptions) {
	const inspector = await import("node:inspector");
	const options = resolveProcessInspectOptions(inspectOptions);
	try {
		if (inspector.url()) inspector.close();
		inspector.open(options.port, options.host, options.wait);
	} catch (error) {
		logger.warn(`Could not start the inspector on ${styleText("cyan", `${options.host}:${options.port}`)}: ${error instanceof Error ? error.message : error}`);
	}
	process.env[INSPECT_ENV] = JSON.stringify({
		host: inspectOptions.host,
		port: inspectOptions.port
	});
}
/**
* Inspector address for the CLI process itself, which loads `nuxt.config` and
* modules. Server code runs in a nitro worker thread on the requested port.
*/
function resolveProcessInspectOptions(options) {
	return {
		...options,
		port: options.port === 0 ? 0 : options.port + 1
	};
}
/** Release the inspector port so another process (a fork) can bind to it. */
async function closeInspector() {
	try {
		const inspector = await import("node:inspector");
		if (inspector.url()) inspector.close();
	} catch (error) {
		debug(`Could not close the inspector: ${error}`);
	}
}
/** Node exec arguments are inspected too, so `node --inspect nuxt dev` behaves like `nuxt dev --inspect`. */
function resolveInspectOptions(rawArgs) {
	return parseInspectArgs([...process.execArgv, ...rawArgs]);
}
//#endregion
//#region src/dev/reason.ts
/**
* Combine a queued reason with a newer one, so a debounced reload can report
* every file that changed within the window.
*/
function mergeRestartReasons(previous, next) {
	if (previous?.type !== "config" || next.type !== "config") return next;
	return {
		type: "config",
		files: [.../* @__PURE__ */ new Set([...previous.files, ...next.files])],
		keys: previous.keys || next.keys ? [.../* @__PURE__ */ new Set([...previous.keys || [], ...next.keys || []])] : void 0
	};
}
/**
* Record which `nuxt.config` keys changed on a config-triggered reload. Keys are
* sorted so the printed line does not reorder when config keys are moved around.
*/
function withConfigKeys(reason, keys) {
	if (reason?.type !== "config" || !keys?.length) return reason;
	return {
		...reason,
		keys: [...keys].sort()
	};
}
/** Describe what caused a reload or restart, without saying what happens next. */
function formatRestartCause(reason, options) {
	switch (reason.type) {
		case "config": return `${formatFileList(reason.files, options)} changed`;
		case "dist-removed": return "Build output was removed";
		case "hook": return "Nuxt requested a restart";
		case "shortcut": return "Restart requested";
		case "error": return `Unhandled error: ${reason.message}`;
	}
}
/** One line saying a config file was written without changing the resolved config. */
function formatSkippedReload(reason, options) {
	return `${formatFileList(reason.files, options)} saved without changing config.`;
}
/** Follow-up line naming the config keys a reload picked up. */
function formatChangedKeys(keys) {
	if (!keys.length) return;
	return `${formatTruncatedList(keys.map((key) => `\`${key}\``), "key")} updated`;
}
/** One line saying what caused a reload or restart and what is happening as a result. */
function formatRestartReason(reason, options) {
	const action = options.hard ? "Restarting Nuxt in a new process" : "Reloading Nuxt";
	if (!reason) return `${action}...`;
	return `${formatRestartCause(reason, options)}. ${action}...`;
}
const MAX_LISTED_ITEMS = 2;
function formatFileList(files, options) {
	const names = files.map((file) => options.link === false ? relativeTo(options.rootDir, file, { link: false }) : relativeTo(options.rootDir, file));
	if (names.length === 0) return "A file";
	return formatTruncatedList(names, "file");
}
function formatTruncatedList(items, noun) {
	if (items.length <= MAX_LISTED_ITEMS) return items.join(" and ");
	const remaining = items.length - MAX_LISTED_ITEMS;
	return `${items.slice(0, MAX_LISTED_ITEMS).join(", ")} and ${remaining} other ${noun}${remaining === 1 ? "" : "s"}`;
}
//#endregion
export { withConfigKeys as a, openInspector as c, mergeRestartReasons as i, resolveInspectOptions as l, formatRestartReason as n, INSPECT_ENV as o, formatSkippedReload as r, closeInspector as s, formatChangedKeys as t };
