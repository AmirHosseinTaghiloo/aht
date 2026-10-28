import process from "node:process";
import { consola } from "consola";
import { viteNodeFetch, viteNodeOptions } from "#vite-node";
import { ViteNodeRunner } from "vite-node/client";
import { parseInlineSourceMap } from "my-bad";
import { generatedPosition, originalPosition, resolveSource, traceMapFor } from "nuxt/internal/dev-error/sourcemap";
//#region src/vite-node-runner.ts
const runner = createRunner();
Error.prepareStackTrace = prepareStackTrace;
/** Transformed code of a module as it was evaluated, if the runner still holds it. */
function getCode(file) {
	return moduleCacheFor(file)?.code;
}
/** A path led by a drive letter, optionally root-absolute. */
const DRIVE_LETTER_RE = /^\/?[a-z]:\//i;
/** The runner's entry for `file`, without creating one for a file it never evaluated. */
function moduleCacheFor(file) {
	for (const id of moduleIds(file)) if (runner.moduleCache.has(id)) return runner.moduleCache.getByModuleId(id);
}
/**
* Ids the runner may hold `file` under. V8 names a module by the path the evaluator was
* given, which for a windows drive differs from the runner's own id in its leading slash
* and in the case of the drive letter.
*/
function* moduleIds(file) {
	const id = runner.moduleCache.normalizePath(file).replaceAll("\\", "/");
	yield id;
	if (!DRIVE_LETTER_RE.test(id)) return;
	const bare = id.startsWith("/") ? id.slice(1) : id;
	const drive = bare[0];
	const flipped = (drive === drive.toUpperCase() ? drive.toLowerCase() : drive.toUpperCase()) + bare.slice(1);
	for (const candidate of [
		bare,
		`/${bare}`,
		flipped,
		`/${flipped}`
	]) if (candidate !== id) yield candidate;
}
const parsedMaps = /* @__PURE__ */ new WeakMap();
/**
* The inline map of the code the runner holds for `file`. Vite inlines it without the
* charset `moduleCache.getSourceMap` expects, and a re-evaluated module keeps its entry.
*/
function sourceMapFor(file) {
	try {
		const cache = moduleCacheFor(file);
		if (!cache?.code) return;
		let parsed = parsedMaps.get(cache);
		if (parsed?.code !== cache.code) {
			parsed = {
				code: cache.code,
				map: parseInlineSourceMap(cache.code) ?? void 0
			};
			parsedMaps.set(cache, parsed);
		}
		return parsed.map;
	} catch {
		return;
	}
}
/** The map of `file` as the runner holds it now, so an edited module maps through its own map. */
function traceMapFor$1(file) {
	const map = sourceMapFor(file);
	return map ? traceMapFor(map, file) : void 0;
}
/** Source position a position in the transformed code came from, 1-based as in a stack. */
function getOriginalPosition(file, line, column) {
	const trace = traceMapFor$1(file);
	return trace && originalPosition(trace, line, column);
}
/** Position in the transformed code a source position was mapped from, 1-based as in a stack. */
function getCompiledPosition(file, line, column) {
	const trace = traceMapFor$1(file);
	const source = trace && resolveSource(trace, file);
	const position = source ? generatedPosition(trace, source, line, column) : void 0;
	return position && {
		file,
		...position
	};
}
/**
* Formats a stack as V8 does, with the position of each frame in a transformed module
* replaced by the source position its current map gives it.
*/
function prepareStackTrace(error, callSites) {
	const frames = callSites.map((callSite) => {
		const text = `    at ${callSite.toString()}`;
		const file = callSite.getFileName();
		const line = callSite.getLineNumber();
		const column = callSite.getColumnNumber();
		if (!file || line === null || column === null) return text;
		const mapped = getOriginalPosition(file, line, column);
		return mapped ? withLocation(text, line, column, mapped) : text;
	});
	return [headerOf(error), ...frames].join("\n");
}
/**
* `text` with the location of its frame replaced by `mapped`. The location is found by its
* `:line:column` suffix rather than by the file name, which a call site may spell
* differently from the name it reports.
*/
function withLocation(text, line, column, mapped) {
	const position = `:${line}:${column}`;
	const index = text.lastIndexOf(position);
	if (index === -1) return text;
	const open = text.lastIndexOf("(", index);
	const start = open === -1 ? text.indexOf(" at ") + 4 : open + 1;
	return start < index ? `${text.slice(0, start)}${mapped.file}:${mapped.line}:${mapped.column}${text.slice(index + position.length)}` : text;
}
function headerOf(error) {
	try {
		const name = error.name === void 0 ? "Error" : String(error.name);
		const message = error.message === void 0 ? "" : String(error.message);
		return !message ? name : !name ? message : `${name}: ${message}`;
	} catch {
		return "Error";
	}
}
function createRunner() {
	return new ViteNodeRunner({
		root: viteNodeOptions.root,
		base: viteNodeOptions.base,
		resolveId(id, importer) {
			return viteNodeFetch.resolveId(id, importer);
		},
		fetchModule(id) {
			id = id.replace(/\/\//g, "/");
			return viteNodeFetch.fetchModule(id).catch((err) => {
				const errorData = err?.data;
				if (!errorData) throw err;
				let built;
				try {
					built = buildViteError(errorData, id);
				} catch (buildErr) {
					consola.warn("Internal nuxt error while formatting vite-node error. Please report this!", buildErr);
					const message = `[vite-node] [TransformError] ${errorData?.message || "-"}`;
					consola.error(message, errorData);
					built = Object.assign(new Error(message), {
						statusText: "Vite Error",
						statusMessage: "Vite Error",
						stack: `${message}\nat ${id}\n` + (errorData?.stack || "")
					});
				}
				throw built;
			});
		}
	});
}
/** `[plugin]` or `[scope/plugin]`, as vite and its plugins prefix a message. */
const PLUGIN_PREFIX_RE = /^\[@?[\w.\-/:]+\]\s*/;
/** `path/to/file.vue:1:2 `, as a compiler repeats a position it also attaches to the error. */
const MESSAGE_PREFIX_POSITION_RE = /^\S+:\d+(?::\d+)?\s+/;
function buildViteError(errorData, id) {
	const file = (errorData.loc?.file || errorData.id || id || "").replace(process.cwd(), ".");
	const rawMessage = errorData.message || "";
	const [headRaw, ...frameTail] = rawMessage.split(/\r?\n\s*\n/);
	const head = ((headRaw || "").split(/\r?\n/)[0] ?? "").replace(PLUGIN_PREFIX_RE, "");
	const reason = (errorData.loc?.line === void 0 ? head : head.replace(MESSAGE_PREFIX_POSITION_RE, "")).trim();
	const messageFrame = frameTail.length ? frameTail.join("\n\n").trim() : "";
	const located = errorData.loc?.line !== void 0 || reason.includes(file);
	const message = reason ? located ? reason : `${reason} (${file})` : rawMessage || file;
	const error = Object.assign(new Error(message), {
		name: errorData.name || "ViteError",
		statusText: "Vite Error",
		statusMessage: "Vite Error",
		code: errorData.code,
		frame: errorData.frame || messageFrame || void 0,
		id: errorData.id || id,
		...errorData.loc && { loc: errorData.loc },
		...errorData.plugin && { plugin: errorData.plugin },
		...errorData.pluginCode && { pluginCode: errorData.pluginCode }
	});
	if (errorData.stack) error.stack = errorData.stack;
	return error;
}
//#endregion
export { buildViteError, runner as default, getCode, getCompiledPosition, getOriginalPosition, prepareStackTrace };
