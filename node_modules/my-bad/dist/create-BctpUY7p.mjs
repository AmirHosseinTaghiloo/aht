import { a as langFromFile, c as resolvePath, d as withoutQuery, i as isFilePath, l as stripCacheQuery, n as displayPath, o as normalizeSlashes, r as hasScheme, s as relativeToCwd, t as dirname, u as toPath } from "./path-BUhlDN52.mjs";
import { Buffer } from "node:buffer";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { parseRawStackTrace } from "errx";
import { fnv1a64Base36 } from "fnv1a-64";
//#region src/loaders/decode.ts
/**
* Sources of an index map's sections are named with the section's
* `sourceRoot`, which the top-level resolution never sees.
*/
function sectionRoot(map, parent) {
	return map.sourceRoot ? `${parent}${map.sourceRoot.replace(/\/?$/, "/")}` : parent;
}
const BASE64 = (/* @__PURE__ */ new Int8Array(128)).fill(-1);
for (const [i, c] of [..."ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"].entries()) BASE64[c.charCodeAt(0)] = i;
function decodeMappings(mappings, raw, root) {
	const entries = [];
	const state = [
		0,
		0,
		0,
		0,
		0
	];
	let line = 0;
	let i = 0;
	while (i < mappings.length) {
		const char = mappings[i];
		if (char === ";") {
			line++;
			state[0] = 0;
			i++;
			continue;
		}
		if (char === ",") {
			i++;
			continue;
		}
		let field = 0;
		const fields = [];
		while (i < mappings.length && mappings[i] !== "," && mappings[i] !== ";") {
			let value = 0;
			let shift = 0;
			let digit;
			do {
				digit = BASE64[mappings.charCodeAt(i++)] ?? -1;
				if (digit < 0) throw new SyntaxError("Invalid source map mappings");
				value += (digit & 31) << shift;
				shift += 5;
			} while (digit & 32);
			const next = (state[field] ?? 0) + (value & 1 ? -(value >>> 1) : value >>> 1);
			state[field] = next;
			fields.push(next);
			field++;
		}
		const entry = {
			generatedLine: line,
			generatedColumn: fields[0]
		};
		if (fields.length >= 4) {
			const source = raw.sources?.[fields[1]];
			entry.originalSource = typeof source === "string" ? root ? `${root}${source}` : source : void 0;
			entry.originalLine = fields[2];
			entry.originalColumn = fields[3];
		}
		entries.push(entry);
	}
	return entries;
}
function decodeEntries(raw, root = "") {
	if (!raw.sections) return decodeMappings(raw.mappings ?? "", raw, root);
	return raw.sections.flatMap(({ offset, map }) => decodeEntries(map, sectionRoot(map, root)).map((entry) => ({
		...entry,
		generatedLine: entry.generatedLine + offset.line,
		generatedColumn: entry.generatedColumn + (entry.generatedLine === 0 ? offset.column : 0)
	})));
}
function collectSources(raw, root, into) {
	if (raw.sections) {
		for (const { map } of raw.sections) collectSources(map, sectionRoot(map, root), into);
		return into;
	}
	const ignoreList = raw.ignoreList ?? raw.x_google_ignoreList;
	for (const [index, source] of (raw.sources ?? []).entries()) {
		if (typeof source !== "string") continue;
		const name = `${root}${source}`;
		const content = raw.sourcesContent?.[index];
		if (typeof content === "string" && content && !into.contents.has(name)) into.contents.set(name, content);
		if (ignoreList?.includes(index)) into.ignored.add(name);
	}
	return into;
}
function decodeSourceMap(raw) {
	const entries = decodeEntries(raw).sort((a, b) => a.generatedLine - b.generatedLine || a.generatedColumn - b.generatedColumn);
	let sources;
	const collected = () => sources ??= collectSources(raw, "", {
		contents: /* @__PURE__ */ new Map(),
		ignored: /* @__PURE__ */ new Set()
	});
	return {
		sourceContent: (source) => collected().contents.get(source),
		ignoredSource: (source) => collected().ignored.has(source),
		findEntry(line, column) {
			let lo = 0;
			let hi = entries.length - 1;
			let found;
			while (lo <= hi) {
				const mid = lo + hi >>> 1;
				const entry = entries[mid];
				if (entry.generatedLine < line || entry.generatedLine === line && entry.generatedColumn <= column) {
					found = entry;
					lo = mid + 1;
				} else hi = mid - 1;
			}
			return found ?? {};
		}
	};
}
//#endregion
//#region src/loaders/embedded.ts
/** Original source contents that a loader found embedded in the map it used for a frame, with the file they belong to. */
const embedded = /* @__PURE__ */ new WeakMap();
function withEmbeddedSource(frame, contents) {
	if (contents) embedded.set(frame, {
		file: frame.file,
		contents
	});
	return frame;
}
/** Only while the frame still names the file the contents were recorded for, in case a later loader rewrote it in place. */
function embeddedSource(frame) {
	const entry = embedded.get(frame);
	return entry && entry.file === frame.file ? entry.contents : void 0;
}
//#endregion
//#region src/loaders/sourcemap.ts
/**
* Look up a 1-based generated position in a map. Returns `undefined` unless the
* map has a segment on that exact generated line: `findEntry` falls
* back to the nearest preceding segment, which would map an already-original
* position a second time.
*/
function findOriginal(map, line, column) {
	const entry = map.findEntry(line - 1, column === void 0 ? 0 : Math.max(0, column - 1));
	if (!("originalSource" in entry) || entry.originalSource === void 0 || entry.originalLine === void 0 || entry.generatedLine !== line - 1) return;
	return {
		source: entry.originalSource,
		line: entry.originalLine + 1,
		column: (entry.originalColumn ?? 0) + 1
	};
}
/** Resolve a 1-based generated position through a map to an original file position. */
function mapPosition(map, raw, base, line, column) {
	return resolveOriginal(map, raw, base, line, column)?.position;
}
function resolveOriginal(map, raw, base, line, column) {
	const original = findOriginal(map, line, column);
	if (!original) return;
	const root = raw.sourceRoot ? raw.sourceRoot.replace(/\/?$/, "/") : "";
	const ignoreList = raw.ignoreList ?? raw.x_google_ignoreList;
	const index = raw.sources?.indexOf(original.source) ?? -1;
	const ignored = index >= 0 ? ignoreList?.includes(index) : map.ignoredSource?.(original.source);
	return {
		position: {
			file: resolvePath(base, toPath(`${root}${original.source}`)),
			line: original.line,
			column: original.column,
			...ignored && { ignored: true }
		},
		source: original.source,
		index
	};
}
/** The contents a map embeds for one of its sources, ignoring empty placeholders. */
function embeddedContent(map, raw, source, index) {
	const content = map.sourceContent ? map.sourceContent(source) : index >= 0 ? raw.sourcesContent?.[index] : void 0;
	return typeof content === "string" && content ? content : void 0;
}
/** Decoded maps by raw map object, shared by every loader instance since integrations commonly create loaders per request. */
const parsed$1 = /* @__PURE__ */ new WeakMap();
function parseMap(raw) {
	const existing = parsed$1.get(raw);
	if (existing !== void 0) return existing ?? void 0;
	try {
		const map = decodeSourceMap(raw);
		parsed$1.set(raw, map);
		return map;
	} catch {
		parsed$1.set(raw, null);
	}
}
/**
* Maps frames with sourcemaps supplied by the caller. Snippets come from the
* map's `sourcesContent` where it has them, otherwise from disk.
*/
function sourceMapLoader(options) {
	const embed = options.sourcesContent ?? true;
	const cache = /* @__PURE__ */ new Map();
	async function load(file) {
		const raw = await options.getSourceMap(file);
		if (!raw || ("sections" in raw ? !Array.isArray(raw.sections) || !raw.sections.length : !raw.mappings)) return;
		const map = parseMap(raw);
		if (!map) return;
		return {
			map,
			raw: "sections" in raw ? {} : raw,
			base: options.base?.(file) ?? dirname(file)
		};
	}
	async function loaded(file) {
		if (!options.getVersion) return load(file);
		const version = await options.getVersion(file);
		const entry = cache.get(file);
		if (entry && entry.version === version) return entry.value;
		const value = load(file);
		cache.set(file, {
			version,
			value
		});
		return value;
	}
	return {
		name: "sourcemap",
		async map(frame) {
			if (!frame.file || frame.line === void 0) return;
			const result = await loaded(withoutQuery(frame.file));
			if (!result) return;
			const resolved = resolveOriginal(result.map, result.raw, result.base, frame.line, frame.column);
			if (!resolved) return;
			const { ignored, ...position } = resolved.position;
			const mapped = {
				...frame,
				...position,
				...ignored && { type: "vendor" },
				compiled: frame.compiled ?? {
					file: frame.file,
					line: frame.line,
					column: frame.column
				}
			};
			return (typeof embed === "function" ? embed(position.file) : embed) ? withEmbeddedSource(mapped, embeddedContent(result.map, result.raw, resolved.source, resolved.index)) : mapped;
		},
		read(file) {
			const path = withoutQuery(file);
			if (options.fs === false || !isFilePath(path)) return;
			return readFile(path, "utf8").catch(() => void 0);
		},
		async readCompiled(file) {
			return await options.getCode?.(withoutQuery(file)) ?? void 0;
		}
	};
}
//#endregion
//#region src/loaders/fs.ts
const SOURCE_MAPPING_URL_MARKER = "sourceMappingURL=";
const SOURCE_MAPPING_URL_PREFIX_RE = /\/\/[#@][^\S\n]*$/;
/** Decode a `sourceMappingURL=data:` payload. */
function parseDataUrl(url) {
	if (!url.startsWith("data:")) return;
	const comma = url.indexOf(",");
	const meta = url.slice(5, comma);
	const data = url.slice(comma + 1);
	return meta.includes(";base64") ? Buffer.from(data, "base64").toString("utf8") : decodeURIComponent(data);
}
function sourceMappingURLIn(tail) {
	const at = tail.lastIndexOf(SOURCE_MAPPING_URL_MARKER);
	if (at < 0 || !SOURCE_MAPPING_URL_PREFIX_RE.test(tail.slice(0, at))) return;
	const url = tail.slice(at + 17).trimEnd();
	return url && !/\s/.test(url) ? url : void 0;
}
/**
* The comment is normally the final line, which for an inline map can be far
* longer than any fixed tail window, so that line is checked first.
*/
function lastSourceMappingURL(code) {
	let end = code.length;
	while (end > 0 && (code.charCodeAt(end - 1) === 10 || code.charCodeAt(end - 1) === 13)) end--;
	const start = code.lastIndexOf("\n", end - 1) + 1;
	return sourceMappingURLIn(code.slice(start, end)) ?? sourceMappingURLIn(code.slice(-8192));
}
/**
* Decode the `sourceMappingURL=data:` comment of a module's transformed code,
* for module runners that expose the code but not the parsed map.
*/
function parseInlineSourceMap(code) {
	const url = lastSourceMappingURL(code);
	const data = url ? parseDataUrl(url) : void 0;
	return data === void 0 ? void 0 : parse(data);
}
/**
* Contents keyed by size and mtime, shared by every loader instance: integrations
* commonly create loaders per request, and validation against `stat` keeps a
* shared cache correct after a rebuild.
*/
const files = /* @__PURE__ */ new Map();
const MAX_FILES = 64;
/** Lookups made in the same event-loop turn (the frames of one stack) share a single `stat`. */
let turn;
function read(path) {
	if (!turn) {
		turn = /* @__PURE__ */ new Map();
		setImmediate(() => {
			turn = void 0;
		});
	}
	let pending = turn.get(path);
	if (!pending) {
		pending = readFresh(path);
		turn.set(path, pending);
	}
	return pending;
}
async function readFresh(path) {
	const info = statOrUndefined(path);
	if (!info?.isFile()) {
		files.delete(path);
		return;
	}
	const cached = files.get(path);
	if (cached && cached.size === info.size && cached.mtimeMs === info.mtimeMs) return cached;
	const contents = await readFile(path, "utf8").catch(() => void 0);
	if (contents === void 0) {
		files.delete(path);
		return;
	}
	const entry = {
		size: info.size,
		mtimeMs: info.mtimeMs,
		contents
	};
	files.delete(path);
	if (files.size >= MAX_FILES) files.delete(files.keys().next().value);
	files.set(path, entry);
	return entry;
}
/**
* Maps frames through `.map` sidecars or `sourceMappingURL` comments and reads
* sources from disk. Node-only.
*/
function fsLoader(options = {}) {
	const { sidecar = true, inline = true, roots, canRead } = options;
	const linked = /* @__PURE__ */ new Map();
	const bounds = roots?.map((root) => canonicalPath(root).replace(/\/$/, ""));
	/** The canonical path to read, or `undefined` when it is out of bounds. */
	function allowed(path) {
		let target = path;
		if (bounds) {
			target = canonicalPath(path);
			if (!bounds.some((root) => target === root || target.startsWith(`${root}/`))) return;
		}
		return canRead && !canRead(path) ? void 0 : target;
	}
	const readAllowed = (path) => {
		const target = allowed(path);
		return target === void 0 ? Promise.resolve(void 0) : read(target);
	};
	async function getSourceMap(file) {
		linked.delete(file);
		if (allowed(file) === void 0) return;
		const sidecarFile = sidecar ? await readAllowed(`${file}.map`) : void 0;
		if (sidecarFile) return parsed(sidecarFile);
		if (!inline) return;
		const source = await readAllowed(file);
		if (!source) return;
		source.url ??= lastSourceMappingURL(source.contents) ?? null;
		const url = source.url;
		if (!url) return;
		if (url.startsWith("data:")) return parsed(source, url);
		const mapPath = resolvePath(dirname(file), url);
		const linkedFile = await readAllowed(mapPath);
		linked.set(file, mapPath);
		if (linkedFile) return parsed(linkedFile);
	}
	const loader = sourceMapLoader({
		getSourceMap,
		base: (file) => dirname(linked.get(file) ?? file),
		sourcesContent: bounds || canRead ? (file) => allowed(file) !== void 0 : true
	});
	const readContents = async (file) => {
		const path = withoutQuery(file);
		return isFilePath(path) ? (await readAllowed(path))?.contents : void 0;
	};
	return {
		...loader,
		name: "fs",
		read: readContents,
		readCompiled: readContents
	};
}
/** Lexical containment can be escaped through a symlink, so roots and candidates are compared as real paths. */
function canonicalPath(path) {
	try {
		return normalizePath(realpathSync(path));
	} catch {}
	const normalized = normalizePath(path);
	const parent = dirname(normalized);
	if (parent === normalized || parent === ".") return normalized;
	const base = canonicalPath(parent);
	return `${base === "/" ? "" : base}/${normalized.split("/").pop()}`;
}
function normalizePath(path) {
	const normalized = path.replace(/\\/g, "/");
	const segments = [];
	for (const part of normalized.split("/")) if (part === "..") segments.pop();
	else if (part !== "." && part !== "") segments.push(part);
	return `${normalized.startsWith("/") ? "/" : ""}${segments.join("/")}`;
}
/**
* A synchronous `stat` on the page cache costs a few microseconds, whereas the
* promise-based one materialises an exception for every missing sidecar.
*/
function statOrUndefined(path) {
	try {
		return statSync(path, { throwIfNoEntry: false });
	} catch {
		return;
	}
}
/** Decode a file's map once per version of its contents. */
function parsed(file, dataUrl) {
	if (file.map === void 0) {
		const data = dataUrl ? parseDataUrl(dataUrl) : file.contents;
		file.map = (data === void 0 ? void 0 : parse(data)) ?? null;
	}
	return file.map ?? void 0;
}
function parse(raw) {
	try {
		return JSON.parse(raw);
	} catch {
		return;
	}
}
//#endregion
//#region src/report/message.ts
const DEFAULT_DISPLAY_MESSAGE_LENGTH = 1e3;
/** Split a message into the part shown by default and the remainder. */
function clampMessage(message, max = DEFAULT_DISPLAY_MESSAGE_LENGTH) {
	return message.length <= max ? {
		head: message,
		rest: ""
	} : {
		head: message.slice(0, max),
		rest: message.slice(max)
	};
}
//#endregion
//#region src/report/stringify.ts
/** Render an arbitrary value as text, never throwing on circular or exotic input. */
function stringifyValue(value, indent) {
	if (typeof value === "string") return value;
	try {
		return JSON.stringify(value, null, indent) ?? String(value);
	} catch {
		return String(value);
	}
}
//#endregion
//#region src/report/tokenize.ts
const KEYWORDS = new Set("abstract as async await break case catch class const continue debugger default delete do else enum export extends false finally for from function if implements import in instanceof interface let new null of package private protected public return satisfies static super switch this throw true try type typeof undefined var void while with yield".split(" "));
/**
* Comments end at a line terminator (`\n`, `\r`, U+2028, U+2029) or, for block
* comments, at their closer; spelling that out as character classes instead of
* `.*$` and lazy `[\s\S]*?` keeps the match linear for any input.
*/
const TOKEN_RE = /(\/\/[^\n\r\u2028\u2029]*|\/\*(?:(?!\*\/)[^\n\r\u2028\u2029])*(?:\*\/)?|<!--(?:(?!--!?>)[^\n\r\u2028\u2029])*(?:--!?>)?)|("(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?|`(?:[^`\\]|\\.)*`?)|(\b\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?n?\b|\b0x[\da-f]+\b)|(<\/?[a-z][\w.-]*|\/?>)|([a-z_$][\w$-]*)|([{}()[\]])|([=!<>+\-*/%&|^~?:.,;]+)/giu;
const GROUPS = [
	"comment",
	"string",
	"number",
	"tag",
	"variable",
	"punctuation",
	"operator"
];
const HTML_COMMENT_CLOSE_RE = /--!?>/;
/** Offset just past the closer of an open construct, or `-1` when the line does not close it. */
function closeOf(line, state) {
	if (state === "comment") {
		const at = line.indexOf("*/");
		return at < 0 ? -1 : at + 2;
	}
	if (state === "html-comment") {
		const match = HTML_COMMENT_CLOSE_RE.exec(line);
		return match ? match.index + match[0].length : -1;
	}
	for (let i = 0; i < line.length; i++) {
		const code = line.charCodeAt(i);
		if (code === 92) i++;
		else if (code === 96) return i + 1;
	}
	return -1;
}
function isEscaped(text, index) {
	let slashes = 0;
	for (let i = index - 1; i >= 0 && text.charCodeAt(i) === 92; i--) slashes++;
	return slashes % 2 === 1;
}
/** The construct a comment or string token leaves open, if it is unterminated. */
function openedBy(text) {
	if (text.startsWith("/*")) return text.length >= 4 && text.endsWith("*/") ? void 0 : "comment";
	if (text.startsWith("<!--")) return text.length >= 7 && (text.endsWith("-->") || text.endsWith("--!>")) ? void 0 : "html-comment";
	if (text.startsWith("`")) return text.length >= 2 && text.endsWith("`") && !isEscaped(text, text.length - 1) ? void 0 : "template";
}
/**
* Tokenize one line, starting inside `state` when the previous line left a
* block comment, HTML comment or template literal open.
*/
function tokenizeFrom(line, lang, state) {
	if (!lang || lang === "md") return {
		tokens: [{
			type: "text",
			text: line
		}],
		state: void 0
	};
	const tokens = [];
	let last = 0;
	if (state) {
		const end = closeOf(line, state);
		const type = state === "template" ? "string" : "comment";
		if (end < 0) return {
			tokens: line ? [{
				type,
				text: line
			}] : [],
			state
		};
		tokens.push({
			type,
			text: line.slice(0, end)
		});
		last = end;
	}
	let inTag = false;
	let open;
	TOKEN_RE.lastIndex = last;
	for (let match = TOKEN_RE.exec(line); match; match = TOKEN_RE.exec(line)) {
		if (match.index > last) tokens.push({
			type: "text",
			text: line.slice(last, match.index)
		});
		let text = match[0];
		let group = 1;
		while (match[group] === void 0) group++;
		let type = GROUPS[group - 1];
		open = void 0;
		if (group <= 2) {
			open = openedBy(text);
			if (open === "template") text = line.slice(match.index);
			else if (open && match.index + text.length < line.length) open = void 0;
		} else if (type === "tag") inTag = !text.endsWith(">");
		else if (type === "variable") {
			if (inTag) type = "attribute";
			else if (lang === "css" && line[match.index + text.length] === ":") type = "attribute";
			else if (KEYWORDS.has(text)) type = "keyword";
			else if (isUpper(text.charCodeAt(0))) type = "type";
			else if (line[match.index + text.length] === "(") type = "function";
			else type = "text";
		}
		tokens.push({
			type,
			text
		});
		last = match.index + text.length;
		TOKEN_RE.lastIndex = last;
	}
	if (last < line.length) {
		tokens.push({
			type: "text",
			text: line.slice(last)
		});
		open = void 0;
	}
	return {
		tokens,
		state: open
	};
}
/** Small built-in tokenizer for JS/TS/Vue/HTML/CSS snippets. */
const defaultTokenizer = (line, lang) => tokenizeFrom(line, lang, void 0).tokens;
function isUpper(code) {
	return code >= 65 && code <= 90;
}
/** Lines of context before a snippet that are scanned for a construct it starts inside. */
const CONTEXT_LINES = 30;
const CONTEXT_CHARS = 2400;
const OPENER_RE = /\/\/|\/\*|<!--|[`'"]/g;
const HTML_CLOSE_RE = /--!?>/g;
const TEMPLATE_STOP_RE = /[`\\]/g;
const DOUBLE_STOP_RE = /["\\\n]/g;
const SINGLE_STOP_RE = /['\\\n]/g;
/** End of a construct opened just before `from`, found by jumping between `stop` characters, or `-1`. */
function closeAfter(text, from, stop) {
	stop.lastIndex = from;
	for (let match = stop.exec(text); match; match = stop.exec(text)) {
		if (match[0] !== "\\") return match.index + 1;
		stop.lastIndex = match.index + 2;
	}
	return -1;
}
/**
* The construct open at the end of `text`, judged with only the rules that
* decide it: comments, quoted strings and template literals.
*/
function scanState(text) {
	let at = 0;
	while (at < text.length) {
		OPENER_RE.lastIndex = at;
		const match = OPENER_RE.exec(text);
		if (!match) return;
		at = match.index + match[0].length;
		switch (match[0]) {
			case "//": {
				const newline = text.indexOf("\n", at);
				at = newline < 0 ? text.length : newline + 1;
				break;
			}
			case "/*": {
				const close = text.indexOf("*/", at);
				if (close < 0) return "comment";
				at = close + 2;
				break;
			}
			case "<!--": {
				HTML_CLOSE_RE.lastIndex = at;
				const close = HTML_CLOSE_RE.exec(text);
				if (!close) return "html-comment";
				at = close.index + close[0].length;
				break;
			}
			case "`":
				at = closeAfter(text, at, TEMPLATE_STOP_RE);
				if (at < 0) return "template";
				break;
			default: {
				const end = closeAfter(text, at, match[0] === "\"" ? DOUBLE_STOP_RE : SINGLE_STOP_RE);
				at = end < 0 ? text.length : end;
			}
		}
	}
}
/**
* The construct left open where the line starting at `end` begins, judged
* from at most `CONTEXT_LINES` lines and `CONTEXT_CHARS` characters before it.
*/
function continuationAt(contents, end, lang) {
	if (!lang || lang === "md" || end <= 0) return;
	let from = end;
	for (let n = 0; n < CONTEXT_LINES && from > 0 && end - from < CONTEXT_CHARS; n++) from = (from >= 2 ? contents.lastIndexOf("\n", from - 2) : -1) + 1;
	if (end - from > CONTEXT_CHARS) {
		const cut = contents.indexOf("\n", end - CONTEXT_CHARS);
		from = cut < 0 ? end : cut + 1;
	}
	if (from >= end) return;
	const context = contents.slice(from, end - 1);
	return context.includes("/*") || context.includes("<!--") || context.includes("`") ? scanState(context) : void 0;
}
/** Lines tokenized so far per snippet, extended only as far as a renderer asks. */
const lexed = /* @__PURE__ */ new WeakMap();
/**
* Built-in tokens for one line of a snippet. Cropped snippets are tokenized
* line by line, since the text cut from each line may open or close a construct.
*/
function lineTokens(snippet, index) {
	const line = snippet.lines[index] ?? "";
	if (snippet.offset !== void 0) return defaultTokenizer(line, snippet.lang) ?? [{
		type: "text",
		text: line
	}];
	let lexing = lexed.get(snippet);
	if (!lexing) {
		lexing = {
			lines: [],
			state: snippet.continues
		};
		lexed.set(snippet, lexing);
	}
	while (lexing.lines.length <= index && lexing.lines.length < snippet.lines.length) {
		const next = tokenizeFrom(snippet.lines[lexing.lines.length], snippet.lang, lexing.state);
		lexing.lines.push(next.tokens);
		lexing.state = next.state;
	}
	return lexing.lines[index] ?? [{
		type: "text",
		text: line
	}];
}
/** Tokens for a snippet line, preferring tokens stored on the report. */
function snippetTokens(snippet, index) {
	return snippet.tokens?.[index] ?? lineTokens(snippet, index);
}
/** Tokens for a snippet with a custom tokenizer, falling back to the built-in one for lines it declines. */
function tokenizeSnippet(snippet, tokenizer) {
	return snippet.lines.map((line, index) => tokenizer(line, snippet.lang) ?? lineTokens(snippet, index));
}
//#endregion
//#region src/render/frames.ts
/** Label a run of collapsed non-app frames, e.g. `3 dependency frames`. */
function groupSummary(frames) {
	const kinds = new Set(frames.map((frame) => frame.type));
	const label = kinds.size > 1 ? "dependency" : kinds.has("native") ? "runtime" : kinds.has("internal") ? "framework" : "dependency";
	return `${frames.length} ${label} frame${frames.length === 1 ? "" : "s"}`;
}
/**
* Split frames into app frames and the runs of collapsed frames between them,
* so each renderer only has to decide how to present a group.
*/
function groupFrames(frames) {
	const out = [];
	let group = [];
	for (const [index, frame] of frames.entries()) if (frame.type === "app") {
		if (group.length) {
			out.push({ group });
			group = [];
		}
		out.push({
			app: frame,
			index
		});
	} else group.push({
		frame,
		index
	});
	if (group.length) out.push({ group });
	return out;
}
//#endregion
//#region src/report/ansi.ts
/** OSC 8 payloads can contain commas, which `util.stripVTControlCharacters` mangles. */
const ANSI_RE = /\u001B\]8;;[^\u0007\u001B]*(?:\u0007|\u001B\\)|\u001B\[[0-9;:?]*[\u0020-\u002F]*[\u0040-\u007E]|\u001B[\u0040-\u005F]/g;
function stripAnsi(text) {
	return text.replace(ANSI_RE, "");
}
//#endregion
//#region \0virtual:my-bad-client
let script;
let styles;
const getClientScript = () => script ??= readFileSync(new URL("./client.js", import.meta.url), "utf8");
const getClientStyles = () => styles ??= readFileSync(new URL("./client.css", import.meta.url), "utf8");
//#endregion
//#region src/render/html/escape.ts
const ESCAPES = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	"\"": "&quot;",
	"'": "&#39;"
};
const UNSAFE_RE = /[&<>"']/;
const UNSAFE_GLOBAL_RE = /[&<>"']/g;
function escapeHtml(value) {
	const text = String(value);
	return UNSAFE_RE.test(text) ? text.replace(UNSAFE_GLOBAL_RE, (char) => ESCAPES[char]) : text;
}
/**
* Make JSON safe to embed inside a `<script>` element of a document with any
* charset. `<` and non-ASCII characters only occur inside JSON strings, where
* `\uXXXX` is an equivalent escape, so the result still parses.
*/
function escapeScript(json) {
	return json.replace(/[<\u007F-\uFFFF]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`);
}
/** Links are only rendered for schemes a browser cannot execute. Control characters are stripped first, since browsers ignore them when resolving the scheme. */
function safeUrl(value) {
	if (!value) return;
	const url = value.replace(/[\u0000-\u0020\u007F]/g, "");
	const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(url)?.[1]?.toLowerCase();
	return !scheme || scheme === "http" || scheme === "https" || scheme === "mailto" ? value : void 0;
}
function attr(name, value) {
	return value === void 0 || value === null || value === false ? "" : ` ${name}="${escapeHtml(value)}"`;
}
//#endregion
//#region src/render/html/state.ts
/** `localStorage` key holding the colour scheme the user picked. */
const THEME_STORAGE_KEY = "my-bad:theme";
//#endregion
//#region src/render/html/highlight.ts
function highlightLine(snippet, index) {
	let html = "";
	for (const token of snippetTokens(snippet, index)) html += token.type === "text" ? escapeHtml(token.text) : `<span class="tk-${token.type}">${escapeHtml(token.text)}</span>`;
	return html;
}
//#endregion
//#region src/render/html/view.ts
const ICONS = {
	file: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M14 2H6v20h12V6zM14 2v6h4M9 13h6m-6 4h6\"/></svg>",
	down: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"m6 9 6 6 6-6\"/></svg>",
	context: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"m8 8 4-4 4 4M12 4v6m-4 6 4 4 4-4m-4 4v-6M4 12h16\"/></svg>",
	history: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"6\" cy=\"5\" r=\"2\"/><circle cx=\"6\" cy=\"19\" r=\"2\"/><circle cx=\"18\" cy=\"5\" r=\"2\"/><path d=\"M6 7v10m12-10v3a4 4 0 0 1-4 4H6\"/></svg>",
	warning: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4M12 17h.01\"/></svg>",
	copy: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><rect width=\"14\" height=\"14\" x=\"8\" y=\"8\" rx=\"2\"/><path d=\"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2\"/></svg>",
	check: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M20 6 9 17l-5-5\"/></svg>",
	info: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16v-4M12 8h.01\"/></svg>",
	theme: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"4\"/><path d=\"M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5\"/></svg>",
	logs: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M4 17l6-6-6-6M12 19h8\"/></svg>",
	open: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6\"/></svg>",
	chevron: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"m9 18 6-6-6-6\"/></svg>",
	prev: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"m15 18-6-6 6-6\"/></svg>",
	next: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"m9 18 6-6-6-6\"/></svg>",
	close: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M18 6 6 18M6 6l12 12\"/></svg>",
	minimize: "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3\"/></svg>"
};
const KIND_LABEL = {
	error: "Error",
	warning: "Warning",
	compile: "Compile error"
};
function headerCount(report) {
	if (report.kind !== "error") return KIND_LABEL[report.kind];
	const count = reportEntries(report).filter((entry) => entry.related).length + 1;
	return `${count} error${count === 1 ? "" : "s"}`;
}
function renderView(state, selected = "r") {
	const { report } = state;
	const live = !!state.channel;
	const name = escapeHtml(state.theme?.name ?? "my-bad");
	const lockup = `${state.theme?.logo ?? ""}<span class="mb-brand-name${state.theme?.logo ? " mb-sr-only" : ""}">${name}</span>`;
	const home = safeUrl(state.theme?.url);
	return `<header class="mb-header mb-corners">
  <div class="mb-brand-group">${home ? `<a class="mb-brand" href="${escapeHtml(home)}" target="_blank" rel="noreferrer">${lockup}<span class="mb-sr-only"> (opens in a new tab)</span></a>` : `<p class="mb-brand">${lockup}</p>`}<span class="mb-header-count">${headerCount(report)}</span></div>
  <nav class="mb-tools" aria-label="Error page tools">
    <ul>
      ${renderPager(report, state.history)}
      <li><span class="mb-warning-count" data-warning-count hidden></span></li>

      <li><button class="mb-tool" type="button" data-action="theme" title="Toggle colour scheme" aria-label="Toggle colour scheme">${ICONS.theme}</button></li>
      ${state.mode === "overlay" ? `<li><button class="mb-tool" type="button" data-action="minimize" title="Minimise (show the page behind)" aria-label="Minimise overlay and show the page behind">${ICONS.minimize}</button></li>` : ""}
    </ul>
  </nav>
  ${live ? "<div class=\"mb-progress\" data-progress hidden role=\"progressbar\" aria-valuemin=\"0\" aria-valuemax=\"100\" aria-label=\"Build progress\"><div class=\"mb-progress-bar\"></div><span class=\"mb-progress-label\" data-progress-label></span></div>" : ""}
</header>
<div class="mb-sr-only" role="status" aria-live="polite" data-announce></div>
<main class="mb-main" data-report-id="${escapeHtml(report.id)}" tabindex="-1">
  ${renderReport(reportEntries(report).find((entry) => entry.path === selected)?.report ?? report, state, selected)}
  ${renderFallback(state, selected)}
  <div class="mb-secondary">${report.sections.length ? `<button class="mb-tool" type="button" data-action="info">${ICONS.info}Request &amp; environment</button>` : ""}${live ? `<button class="mb-tool mb-tool-logs" type="button" data-action="logs" aria-pressed="false" aria-controls="mb-logs" title="Server logs" aria-label="Server logs">${ICONS.logs}Logs<span class="mb-badge" data-log-count hidden></span></button>` : ""}${state.history?.length ? `<details class="mb-history"><summary>${ICONS.history}History</summary><ol>${state.history.map((entry, index) => `<li><button type="button" data-action="history" data-dir="${index - pagerIndex(report, state.history)}">${escapeHtml(entry.message)}</button></li>`).join("")}</ol></details>` : ""}</div>
</main>
${live ? renderLogDrawer() : ""}
${report.sections.length ? renderInfoDialog(report.sections) : ""}
<section class="mb-toasts" data-toasts aria-live="polite" aria-label="Warnings"></section>`;
}
/** Position of the shown report in the history, falling back to the first entry when the history has dropped it. */
function pagerIndex(report, history) {
	return Math.max(0, history.findIndex((entry) => entry.id === report.id));
}
function renderPager(report, history) {
	if (!history || history.length < 2) return `<li class="mb-pager" data-pager hidden></li>`;
	const index = pagerIndex(report, history);
	return `<li class="mb-pager" data-pager><span role="group" aria-label="Error history">
    <button class="mb-tool" type="button" data-action="history" data-dir="-1"${attr("disabled", index <= 0)} title="Previous error" aria-label="Previous error">${ICONS.prev}</button>
    <span data-pager-label>${index + 1} of ${history.length}</span>
    <button class="mb-tool" type="button" data-action="history" data-dir="1"${attr("disabled", index >= history.length - 1)} title="Next error" aria-label="Next error">${ICONS.next}</button>
  </span></li>`;
}
function reportEntries(report, path = "r", related = false) {
	return [
		{
			report,
			path,
			related,
			label: path === "r" ? "Reported error" : related ? "Related error" : report.causes.length ? "Wrapped error" : "Root cause"
		},
		...report.causes.flatMap((cause, index) => reportEntries(cause, `${path}c${index}`, related)),
		...(report.errors ?? []).flatMap((error, index) => reportEntries(error, `${path}e${index}`, true))
	];
}
function renderCauseNavigation(state, selected) {
	const entries = reportEntries(state.report);
	if (entries.length < 2) return "";
	const related = entries.some((entry) => entry.related);
	const chain = related ? entries : entries.reverse();
	const current = chain.findIndex((entry) => entry.path === selected);
	const entry = (index, text = chain[index].label) => `<button type="button" data-action="cause" data-path="${chain[index].path}" aria-current="${index === current}" title="${escapeHtml(chain[index].report.message)}">${escapeHtml(text)}</button>`;
	if (chain.length === 2 && !related) return `<nav class="mb-single-cause" aria-label="Error cause">${selected === "r" ? `Caused by ${entry(0, chain[0].report.message)}` : entry(1, `Back to: ${state.report.message}`)}</nav>`;
	return `<nav class="mb-causes" aria-label="${related ? "Related errors" : "Error cause chain"}"><div class="mb-cause-path">${entry(0, `1 ${chain[0].label}`)}<details class="mb-cause-picker"><summary>${current > 0 && current < chain.length - 1 ? `${current + 1} ${chain[current].label}` : related ? `${chain.length - 1} related errors` : "Wrapped errors"}${ICONS.down}</summary><ol>${chain.map((item, index) => `<li>${entry(index, `${index + 1} ${item.label}: ${item.report.message}`)}</li>`).join("")}</ol></details>${related ? "" : `${ICONS.chevron}${entry(chain.length - 1, `${chain.length} Reported error`)}`}</div><p>Inspecting ${chain[current]?.label.toLowerCase()} · ${current + 1} of ${chain.length}${selected !== "r" ? `<span>Reported as: ${escapeHtml(state.report.message)}</span>` : ""}</p></nav>`;
}
/** Causes and related errors in full, for when the picker's client script is unavailable. */
function renderFallback(state, selected) {
	const all = reportEntries(state.report);
	const rest = all.filter((entry) => entry.path !== selected);
	if (!rest.length) return "";
	const omitted = all.reduce((total, entry) => total + (entry.report.omittedErrors ?? 0), 0);
	const note = omitted ? `<p class="mb-fallback-label">and ${omitted} more related ${omitted === 1 ? "error" : "errors"} not shown</p>` : "";
	return `<details class="mb-disclosure mb-fallback" data-fallback><summary>${ICONS.chevron}${rest.length === 1 ? "Cause" : "Causes and related errors"} <span class="mb-count">${rest.length}</span></summary>${rest.map((entry) => `<section class="mb-fallback-entry"><p class="mb-fallback-label">${escapeHtml(entry.label)}</p>${renderReport(entry.report, state, entry.path, false)}</section>`).join("")}${note}</details>`;
}
function renderReport(report, state, path, chrome = true) {
	const id = escapeHtml(`mb-${path}-${report.id}`);
	const tag = chrome ? "h1" : "h2";
	const docs = safeUrl(report.docsUrl);
	const selfCoded = report.name === report.code;
	const code = report.code ? `<span class="mb-code" data-code>${docs ? `<a href="${escapeHtml(docs)}" target="_blank" rel="noreferrer" title="Documentation for ${escapeHtml(report.code)}">${escapeHtml(report.code)}${ICONS.open}<span class="mb-sr-only"> documentation (opens in a new tab)</span></a>` : escapeHtml(report.code)}</span>` : "";
	return `<article class="mb-report" data-kind="${escapeHtml(report.kind)}" aria-labelledby="${id}-name ${id}-message">
  <div class="mb-report-heading"><p class="mb-kicker">${report.kind === "error" ? "" : `<span class="mb-kind-icon" aria-hidden="true">${ICONS.warning}</span>`}<span class="mb-name" id="${id}-name" data-name>${escapeHtml(selfCoded ? KIND_LABEL[report.kind] : report.name)}</span>${selfCoded ? "" : `${report.kind === "error" ? "" : "<span aria-hidden=\"true\">·</span>"}<span data-kind-label${report.kind === "error" ? " class=\"mb-sr-only\"" : ""}>${KIND_LABEL[report.kind]}</span>`}${state.environment ? `<span>·</span><span>${escapeHtml(state.environment)}</span>` : ""}${code}${report.status ? `<span data-status>HTTP ${escapeHtml(report.status)}</span>` : ""}</p>${chrome ? `<div class="mb-menu mb-copy" data-menu><button class="mb-tool" type="button" data-action="copy" data-copy="markdown">${ICONS.copy}Copy error</button>
        <button class="mb-tool" type="button" data-action="copy-menu" aria-expanded="false" aria-controls="mb-copy-menu" title="More copy formats" aria-label="More copy formats">${ICONS.down}</button>
        <ul class="mb-menu-list" id="mb-copy-menu" data-menu-list hidden>
          <li><button type="button" data-action="copy" data-copy="markdown">${ICONS.copy}Copy as Markdown</button></li>
          <li><button type="button" data-action="copy" data-copy="prompt">${ICONS.logs}Copy prompt for an agent</button></li>
          <li><button type="button" data-action="copy" data-copy="json">${ICONS.file}Copy structured JSON</button></li>
        </ul>
      </div>` : ""}</div>
  ${renderMessage(report, state, tag, `${id}-message`)}
  ${report.hint ? `<p class="mb-hint" data-hint>${escapeHtml(report.hint)}${docs ? ` <a href="${escapeHtml(docs)}" target="_blank" rel="noreferrer">Learn more</a>` : ""}</p>` : ""}
  ${chrome ? renderCauseNavigation(state, path) : ""}
  ${renderFrames(report.frames, state, id)}
  ${report.trace?.length ? `<details class="mb-disclosure"><summary>${ICONS.chevron}Component trace <span class="mb-count">${report.trace.length}</span></summary>${renderTrace(report, state)}</details>` : ""}
</article>`;
}
function renderMessage(report, state, tag, id) {
	const { head, rest } = clampMessage(report.message || report.name, state.maxMessageLength);
	const more = rest ? `<span class="mb-message-rest" data-message-rest hidden>${escapeHtml(rest)}</span><button type="button" class="mb-message-more" data-action="expand-message">Show full message <span class="mb-count">${rest.length} more characters</span></button>` : "";
	return `<${tag} class="mb-message" id="${id}" data-message>${escapeHtml(head)}${more}</${tag}>`;
}
function renderTrace(report, state) {
	return `<ol class="mb-trace" data-trace aria-label="Component trace">${report.trace.map((entry) => {
		const inner = `<code>${escapeHtml(entry.label)}</code>`;
		return entry.file ? `<li><button type="button" class="mb-link mb-trace-link" data-action="open"${attr("data-file", entry.file)}${attr("data-line", entry.line)}${attr("data-column", entry.column)} title="Open ${escapeHtml(shortPath(entry.file, state))}">${inner}${ICONS.open}</button></li>` : `<li>${inner}</li>`;
	}).join("")}</ol>`;
}
function renderFrames(frames, state, parent) {
	if (!frames.length) return "<p class=\"mb-unavailable\">No stack trace was provided. The error message and request context are still available to copy.</p>";
	const origin = Math.max(0, frames.findIndex((frame) => frame.type === "app" && (frame.snippet || frame.compiled?.snippet)));
	const framework = frames.filter((frame) => frame.type !== "app").length;
	const frameRow = (frame, index) => index === origin ? index === 0 ? "" : `<li class="mb-frame-reference">${escapeHtml(frame.function ?? "<anonymous>")} · Shown above</li>` : `<li data-frame-type="${escapeHtml(frame.type)}">${renderSource(frame, state, true)}</li>`;
	const rows = groupFrames(frames).map((entry) => {
		if ("app" in entry) return frameRow(entry.app, entry.index);
		const group = entry.group.filter(({ index }) => index !== origin);
		if (!group.length) return "";
		const first = group[0].index + 1;
		const last = group.at(-1).index + 1;
		const missing = group.every(({ frame }) => !frame.snippet && !frame.compiled?.snippet);
		return `<li class="mb-framework-group"><div class="mb-group-caption"><span>${first === last ? first : `${first} – ${last}`}</span><span>${group.length} framework frame${group.length === 1 ? "" : "s"}<span class="mb-framework-hidden"> hidden</span></span>${missing ? "<span class=\"mb-missing\">Code not captured</span>" : ""}</div><ol class="mb-framework-frames">${group.map(({ frame, index }) => frameRow(frame, index)).join("")}</ol></li>`;
	}).join("");
	return `<div class="mb-ordered-stack">${renderSource(frames[origin], state)}${rows ? `<section class="mb-stack" data-stack><div class="mb-stack-heading"><button type="button" data-action="stack" class="mb-stack-toggle" aria-expanded="false" aria-controls="${parent}-stack">${ICONS.chevron}Call stack <span class="mb-count">${frames.length}</span></button>${framework ? `<button type="button" class="mb-framework" role="switch" data-action="framework" aria-checked="false"><span class="mb-switch-track" aria-hidden="true"></span>Show framework frames <span class="mb-count">(${framework})</span></button>` : ""}</div><ol class="mb-frames" id="${parent}-stack" hidden>${rows}</ol></section>` : ""}</div>`;
}
function renderSource(frame, state, supporting = false) {
	const source = !!frame.snippet && frame.line !== void 0;
	const generated = !!frame.compiled?.snippet && frame.compiled.line !== void 0;
	const location = (target) => {
		if (!target.file) return `<span class="mb-loc">${escapeHtml(frame.raw ?? "Source location unavailable")}</span>`;
		const original = frame.file ? frame : target;
		return `<button type="button" class="mb-loc" data-loc data-action="open"${attr("data-file", original.file)}${attr("data-line", original.line)}${attr("data-column", original.column)}${attr("title", target.file)}>${renderLocation(target, target.line, target.column, state)}</button>`;
	};
	const snippet = (compiled) => {
		const target = compiled ? frame.compiled : frame;
		return target.snippet && target.line !== void 0 ? renderSnippet(target.snippet, target.line, target.column, shortPath(target, state)) : "<p class=\"mb-unavailable\">Source is unavailable at this stack location.</p>";
	};
	const copy = renderCopyLocation(frame, generated);
	if (supporting && !source && !generated) return `<div class="mb-empty-frame"><span class="mb-function">${escapeHtml(frame.function ?? "<anonymous>")}</span>${location(frame)}${copy}</div>`;
	return `<section class="mb-source"${attr("data-supporting", supporting)} data-frame${attr("data-compiled", !source && generated)} aria-label="${supporting ? "Stack frame" : "Error source"}"><div class="mb-source-toolbar"><div class="mb-source-location">${frame.function ? `<span class="mb-function"${attr("title", frame.function)}>${escapeHtml(frame.function)}</span>` : ""}<span data-location-source>${location(frame)}</span>${generated ? `<span data-location-compiled>${location(frame.compiled)}</span>` : ""}</div><div class="mb-source-actions">${source && generated ? "<span class=\"mb-switch\" role=\"group\" aria-label=\"Code view\"><button type=\"button\" data-action=\"toggle-compiled\" data-switch=\"source\" aria-pressed=\"true\">Source</button><button type=\"button\" data-action=\"toggle-compiled\" data-switch=\"compiled\" aria-pressed=\"false\">Compiled</button></span>" : ""}<button type="button" class="mb-tool" data-action="context" aria-label="More context" title="More context" aria-expanded="false">${ICONS.context}</button>${copy}${frame.file ? `<button type="button" class="mb-tool" data-action="open"${attr("data-file", frame.file)}${attr("data-line", frame.line)}${attr("data-column", frame.column)} title="Open original source in your editor" aria-label="Open original source in your editor">${ICONS.open}</button>` : ""}</div></div>${generated ? `<p class="mb-compiled-note">Compiled JavaScript${frame.compiled.file === frame.file ? " (in memory)" : ""} · Editor opens the original source location.</p>` : ""}<div data-snippet-source${attr("hidden", !source && generated)}>${snippet(false)}</div>${generated ? `<div data-snippet-compiled${attr("hidden", source)}>${snippet(true)}</div>` : ""}</section>`;
}
function positionAttrs(prefix, target) {
	return target?.file ? `${attr(`${prefix}file`, target.file)}${attr(`${prefix}line`, target.line)}${attr(`${prefix}column`, target.column)}` : "";
}
function renderCopyLocation(frame, generated) {
	if (!frame.file && !(generated && frame.compiled?.file)) return "";
	return `<button type="button" class="mb-tool" data-action="copy-location"${positionAttrs("data-", frame)}${generated ? positionAttrs("data-compiled-", frame.compiled) : ""} title="Copy location" aria-label="Copy location">${ICONS.copy}</button>`;
}
function renderLocation(target, line, column, state) {
	return `${escapeHtml(shortPath(target, state))}${line !== void 0 ? `<span class="mb-pos">:${escapeHtml(line)}${column !== void 0 ? `:${escapeHtml(column)}` : ""}</span>` : ""}`;
}
function shortPath(target, state) {
	return displayPath(target, state.cwd);
}
function renderSnippet(snippet, line, column, label) {
	const more = line >= snippet.start && line < snippet.start + snippet.lines.length && (snippet.start < line - 3 || snippet.start + snippet.lines.length - 1 > line + 3);
	const gutter = String(snippet.start + snippet.lines.length - 1).length;
	let rows = "";
	for (const [index, text] of snippet.lines.entries()) {
		const n = snippet.start + index;
		const active = n === line;
		rows += `<span class="mb-line${active ? " mb-line-active" : ""}"${active ? " data-active aria-current=\"true\"" : ""}${more && Math.abs(n - line) > 3 ? " data-context=\"true\"" : ""}><span class="mb-ln" aria-hidden="true">${escapeHtml(String(n).padStart(gutter))}</span><span class="mb-src">${highlightLine(snippet, index) || " "}${active ? renderCaret(text, column === void 0 ? void 0 : column - (snippet.offset ?? 0)) : ""}</span></span>`;
	}
	const description = `Source${label ? ` of ${label}` : ""}, line ${line} highlighted`;
	return `<pre class="mb-snippet"${attr("data-more-context", more)} data-lang="${escapeHtml(snippet.lang ?? "")}" aria-label="${escapeHtml(description)}" tabindex="0"><code>${rows}</code></pre>`;
}
function renderCaret(text, column) {
	if (column === void 0 || !Number.isInteger(column)) return "";
	const firstToken = text.search(/\S/);
	return column > (firstToken < 0 ? text.length : firstToken) && column <= text.length + 1 ? `<span class="mb-caret" aria-hidden="true">${escapeHtml(text.slice(0, column - 1).replace(/[^\t]/g, " "))}^</span>` : "";
}
function renderLogDrawer() {
	return `<section class="mb-logs" id="mb-logs" data-logs hidden aria-labelledby="mb-logs-title">
  <div class="mb-logs-head">
    <h2 id="mb-logs-title">Server logs</h2><span class="mb-live" data-live role="status"><span data-live-text>Dev server: connecting</span></span>
    <label class="mb-filter">Level <select data-log-filter><option value="">all</option><option value="warn">warn+</option><option value="error">error</option></select></label>
    <button class="mb-tool" type="button" data-action="clear-logs" title="Clear logs" aria-label="Clear logs">Clear</button>
    <button class="mb-tool" type="button" data-action="logs" title="Close server logs" aria-label="Close server logs">${ICONS.close}</button>
  </div>
  <div class="mb-log-scroll" role="log" aria-live="off"><ol class="mb-log-list" data-log-list></ol><p class="mb-log-empty" data-log-empty>No logs received yet.</p></div>
</section>`;
}
function renderInfoDialog(sections) {
	return `<dialog class="mb-info" data-info closedby="any" aria-labelledby="mb-info-title">
  <div class="mb-info-head"><h2 id="mb-info-title">Info</h2><button class="mb-tool" type="button" data-action="close-info" title="Close" aria-label="Close info">${ICONS.close}</button></div>
  ${sections.map(renderSection).join("")}
</dialog>`;
}
function renderSection(section) {
	const body = typeof section.content === "string" ? `<pre class="mb-pre">${escapeHtml(section.content)}</pre>` : `<dl class="mb-kv">${Object.entries(section.content).map(([key, value]) => `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(stringifyValue(value, 2))}</dd>`).join("")}</dl>`;
	return `<details class="mb-section" data-section${attr("open", !section.collapsed)}><summary>${ICONS.chevron}${escapeHtml(section.title)}</summary>${body}</details>`;
}
//#endregion
//#region src/render/html/index.ts
/**
* The client script and stylesheet that `renderPage` and `renderOverlay` inline
* by default, for serving them yourself and passing the URLs as `assets`.
*/
const clientAssets = {
	get script() {
		return getClientScript();
	},
	get styles() {
		return getClientStyles();
	}
};
const CSS_VAR_RE = /^--[\w-]+$/;
/** Theme overrides, with custom property names and values validated. */
function themeStyles(theme, selector) {
	const vars = [];
	if (theme?.accent) vars.push(`--mb-accent:${cssValue(theme.accent)}`);
	for (const [name, value] of Object.entries(theme?.vars ?? {})) if (CSS_VAR_RE.test(name)) vars.push(`${name}:${cssValue(value)}`);
	return `${vars.length ? `${selector}{${vars.join(";")}}\n` : ""}${theme?.css ?? ""}`;
}
/** The built-in stylesheet, inlined unless it is served separately. */
function sheet(assets) {
	return assets?.styles ? "" : getClientStyles();
}
function cssValue(value) {
	return String(value).replace(/[;{}<]/g, "");
}
/** Applies the remembered or preferred colour scheme before first paint. */
const THEME_BOOTSTRAP = `<script>(function(){var t;try{t=localStorage.getItem(${escapeScript(JSON.stringify(THEME_STORAGE_KEY))})}catch(e){}try{if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.setAttribute("data-theme",t)}catch(e){}})()<\/script>\n`;
function stateScript(state, options) {
	const script = options.assets?.script ? `<script src="${escapeHtml(options.assets.script)}"><\/script>` : `<script>${getClientScript()}<\/script>`;
	return `<script type="application/json">${escapeScript(JSON.stringify(state, options.rawStack ? void 0 : (key, value) => key === "rawStack" ? void 0 : value))}<\/script>\n${script}`;
}
function baseState(report, options, mode) {
	return {
		mode,
		environment: options.environment,
		report,
		cwd: options.cwd,
		channel: options.channel,
		history: options.history,
		theme: options.theme,
		editor: options.editor,
		maxMessageLength: options.maxMessageLength,
		requestId: options.requestId,
		version: "0.2.11"
	};
}
/** Render a complete HTML document for the report. */
function renderPage(report, options = {}) {
	const state = baseState(report, options, "page");
	const title = options.title ?? `${report.name}: ${clampMessage(report.message.split("\n")[0] ?? "", options.maxMessageLength).head}`;
	const scheme = options.theme?.scheme;
	return `<!DOCTYPE html>
<html lang="en"${scheme ? ` data-theme="${escapeHtml(scheme)}"` : ""}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
${scheme ? "" : THEME_BOOTSTRAP}${options.assets?.styles ? `<link rel="stylesheet" href="${escapeHtml(options.assets.styles)}">\n` : ""}<style>html{background:var(--mb-bg)}html,body{margin:0;height:100%}${sheet(options.assets)}${themeStyles(options.theme, ":root")}</style>
${options.head ?? ""}
</head>
<body>
<div class="mb-root" data-my-bad-root>${renderView(state)}</div>
${stateScript(state, options)}
${options.inject ?? ""}
</body>
</html>`;
}
/**
* Render a self-contained overlay to inject into an existing page (before `</body>`).
* The overlay renders inside a shadow root, so host styles cannot leak in.
*/
function renderOverlay(report, options = {}) {
	const tag = options.tag ?? "my-bad-overlay";
	if (!/^[a-z][a-z0-9]*-[a-z0-9-]+$/.test(tag)) throw new Error(`Invalid custom element name: ${tag}`);
	return `<${tag}></${tag}>\n${stateScript({
		...baseState(report, options, "overlay"),
		startMinimized: options.startMinimized,
		tag,
		styles: `${sheet(options.assets)}${themeStyles(options.theme, ":host")}\n:host{all:initial;display:contents}`,
		stylesUrl: options.assets?.styles
	}, options)}`;
}
/** Insert the overlay before `</body>`, or append it. Avoids `String.replace`, whose `$` patterns would corrupt the inlined script. */
function injectOverlay(html, report, options = {}) {
	const overlay = renderOverlay(report, options);
	const index = html.lastIndexOf("</body>");
	return index === -1 ? html + overlay : `${html.slice(0, index)}${overlay}${html.slice(index)}`;
}
//#endregion
//#region src/report/classify.ts
const VENDOR_RE = /\/(?:node_modules|\.pnpm|\.yarn|\.bun)\//;
const NATIVE_RE = /^(?:node:|internal\/|<anonymous>|native$|wasm:|ext:|bun:|deno:)/;
function matchesPattern(value, pattern) {
	return typeof pattern === "string" ? value.includes(pattern) : pattern.test(value);
}
/**
* `pkg` is the name of the package the frame's file belongs to, when it is
* outside `cwd`; patterns are matched against it so framework frames are
* recognised wherever the package physically resolved from.
*/
function classifyFrame(frame, internal, pkg) {
	if (frame.isNative || !frame.file) return "native";
	const file = normalizeSlashes(frame.file);
	if (NATIVE_RE.test(file)) return "native";
	for (const pattern of internal) if (matchesPattern(file, pattern) || frame.function && matchesPattern(frame.function, pattern) || pkg && matchesPattern(pkg, pattern)) return "internal";
	if (VENDOR_RE.test(file)) return "vendor";
	return "app";
}
//#endregion
//#region src/report/package.ts
const cache = /* @__PURE__ */ new Map();
const ROOT_RE = /^(?:\/|\.|[a-z]:\/?)?$/i;
/** Nearest ancestor directory of `file` that contains a `package.json`, with that package's name. */
function resolvePackage(file) {
	let dir = dirname(normalizeSlashes(file));
	const pending = [];
	while (!ROOT_RE.test(dir)) {
		if (cache.has(dir)) {
			const cached = cache.get(dir);
			for (const key of pending) cache.set(key, cached);
			return cached;
		}
		const info = readPackage(dir);
		if (info) {
			cache.set(dir, info);
			for (const key of pending) cache.set(key, info);
			return info;
		}
		pending.push(dir);
		dir = dirname(dir);
	}
	for (const key of pending) cache.set(key, void 0);
}
function readPackage(dir) {
	const manifest = `${dir}/package.json`;
	try {
		if (!existsSync(manifest)) return;
		const name = JSON.parse(readFileSync(manifest, "utf8")).name;
		return {
			dir,
			name: typeof name === "string" && name ? name : dir.split("/").pop()
		};
	} catch {
		return existsSync(manifest) ? {
			dir,
			name: dir.split("/").pop()
		} : void 0;
	}
}
/**
* Resolve the package a file outside `cwd` belongs to, so linked workspace
* packages and `file:` dependencies render like `node_modules` paths instead of
* as absolute paths, and can be classified by package name.
*/
function externalPackage(file, cwd) {
	const normalized = normalizeSlashes(file);
	if (!isFilePath(normalized) || normalized.includes("/node_modules/") || relativeToCwd(normalized, cwd) !== normalized) return;
	const info = resolvePackage(normalized);
	if (!info || normalized.length <= info.dir.length + 1) return;
	return {
		...info,
		displayFile: `…/${info.name}/${normalized.slice(info.dir.length + 1)}`
	};
}
//#endregion
//#region src/report/snippet.ts
function extractSnippet(contents, line, context, file, bounds = {}) {
	if (line < 1) return;
	const start = Math.max(1, line - context);
	const ranges = rangesBetween(contents, start, line + context);
	if (ranges.length <= line - start) return;
	const lang = file ? langFromFile(file) : void 0;
	const max = bounds.maxLineLength ?? Infinity;
	if (ranges.some(([from, to]) => to - from > max)) {
		const offset = windowStart(bounds.column, max);
		return {
			start,
			lines: ranges.map(([from, to]) => cropRange(contents, from, to, offset, max)),
			lang,
			offset
		};
	}
	const continues = continuationAt(contents, ranges[0][0], lang);
	return {
		start,
		lines: ranges.map(([from, to]) => contents.slice(from, to)),
		lang,
		...continues && { continues }
	};
}
/** Crop the lines of a snippet that was not read from a file, such as a compiler's code frame. */
function cropSnippet(snippet, column, max) {
	if (snippet.offset !== void 0 || !snippet.lines.some((text) => text.length > max)) return snippet;
	const offset = windowStart(column, max);
	const { tokens: _, ...rest } = snippet;
	return {
		...rest,
		lines: snippet.lines.map((text) => cropRange(text, 0, text.length, offset, max)),
		offset
	};
}
/** Where a window of `max` characters starts so that `column` stays clear of its edges. */
function windowStart(column, max) {
	const index = column === void 0 || !Number.isFinite(column) ? 0 : Math.max(0, Math.floor(column) - 1);
	return index < max - Math.floor(max / 4) ? 0 : index - Math.floor(max / 2);
}
function isHighSurrogate(code) {
	return code >= 55296 && code <= 56319;
}
function isLowSurrogate(code) {
	return code >= 56320 && code <= 57343;
}
/**
* The window `[offset, offset + max)` of `text.slice(from, to)`. A cut end gives
* up its last character to `…`, so every character keeps its column, and a
* surrogate split by the cut becomes U+FFFD.
*/
function cropRange(text, from, to, offset, max) {
	const length = to - from;
	if (offset === 0 && length <= max) return text.slice(from, to);
	if (length <= offset) return length > 0 ? "…" : "";
	const end = Math.min(to, from + offset + max);
	let out = text.slice(from + offset, end);
	if (offset > 0) out = `…${isLowSurrogate(out.charCodeAt(1)) ? "�" : ""}${out.slice(isLowSurrogate(out.charCodeAt(1)) ? 2 : 1)}`;
	if (end < to) {
		const last = out.length - 2;
		out = `${out.slice(0, isHighSurrogate(out.charCodeAt(last)) ? last : last + 1)}${isHighSurrogate(out.charCodeAt(last)) ? "�" : ""}…`;
	}
	return out;
}
/** A single 1-based line, or `undefined` past the end of the file. */
function lineAt(contents, line) {
	if (line < 1) return;
	const range = rangesBetween(contents, line, line)[0];
	return range && contents.slice(range[0], range[1]);
}
/** Offsets of lines `from` to `to` (1-based, inclusive), without a trailing `\r` and without splitting the whole file. */
function rangesBetween(contents, from, to) {
	const ranges = [];
	let offset = 0;
	for (let n = 1; n <= to; n++) {
		const newline = contents.indexOf("\n", offset);
		const end = newline === -1 ? contents.length : newline;
		if (n >= from) ranges.push([offset, newline !== -1 && contents.charCodeAt(end - 1) === 13 ? end - 1 : end]);
		if (newline === -1) break;
		offset = newline + 1;
	}
	return ranges;
}
const FRAME_LINE_RE = /^(\s*(\d+)\s*\|\s{0,2})(.*)$/;
const CARET_LINE_RE = /^(\s*\|\s*)\^/;
/** Rolldown / oxc render frames as `NN:  code` with no gutter character. */
const COLON_LINE_RE = /^(\s*(\d+):\s?)(.*)$/;
const BARE_CARET_RE = /^(\s*)\^/;
/**
* `NN: code` lines are ambiguous with ordinary prose (`404: not found`), so they
* only count as a frame when a caret line or a second numbered line confirms it.
*/
function colonFrameStart(lines) {
	for (const [index, line] of lines.entries()) {
		if (!COLON_LINE_RE.test(line)) continue;
		const next = lines[index + 1];
		if (next !== void 0 && (COLON_LINE_RE.test(next) || BARE_CARET_RE.test(next) && !CARET_LINE_RE.test(next))) return index;
	}
}
/**
* Parse a code frame in the format produced by Vite / Rollup / the Vue compiler,
* where each line is `NN |  code` and the pointer line is `   |    ^`, or the
* rolldown / oxc variant where each line is `NN:  code` with a bare `^` pointer.
*/
function parseCodeFrame(frame) {
	const all = frame.split("\n");
	const lines = [];
	let start;
	for (const raw of all) {
		const match = FRAME_LINE_RE.exec(raw);
		if (match) {
			start ??= Number(match[2]);
			lines.push(match[3] ?? "");
		}
	}
	if (start !== void 0) return {
		start,
		lines
	};
	const from = colonFrameStart(all);
	if (from === void 0) return;
	for (const raw of all.slice(from)) {
		const match = COLON_LINE_RE.exec(raw);
		if (!match) continue;
		const line = Number(match[2]);
		if (start !== void 0 && line !== start + lines.length) break;
		start ??= line;
		lines.push(match[3] ?? "");
	}
	return start === void 0 ? void 0 : {
		start,
		lines
	};
}
/** Recover the error location from a code frame, for compile errors that ship a frame but no `loc`. */
function locFromCodeFrame(frame) {
	const all = frame.split("\n");
	let line;
	let prefix = 0;
	for (const raw of all) {
		const numbered = FRAME_LINE_RE.exec(raw);
		if (numbered) {
			line = Number(numbered[2]);
			prefix = numbered[1].length;
			continue;
		}
		const caret = CARET_LINE_RE.exec(raw);
		if (caret && line !== void 0) return {
			line,
			column: Math.max(1, caret[1].length - prefix + 1)
		};
	}
	const from = colonFrameStart(all);
	if (from === void 0) return;
	for (const raw of all.slice(from)) {
		const numbered = COLON_LINE_RE.exec(raw);
		if (numbered) {
			line = Number(numbered[2]);
			prefix = numbered[1].length;
			continue;
		}
		const caret = BARE_CARET_RE.exec(raw);
		if (caret && line !== void 0) return {
			line,
			column: Math.max(1, caret[1].length - prefix + 1)
		};
	}
}
const LABELLED_FRAME_RE = /[\u2500\u252C\u256D\u250C\-]\[[^\S\n]*([^[\]\s]+):(\d+):(\d+)[^\S\n]*\]/;
/** Position from an oxc / miette style frame header such as `╭─[ src/a.ts:2:24 ]`. */
function locFromLabelledFrame(text) {
	const match = LABELLED_FRAME_RE.exec(text);
	return match ? {
		file: match[1],
		line: Number(match[2]),
		column: Number(match[3])
	} : void 0;
}
/** Strip an embedded code frame (oxc / esbuild style) from a compiler message, keeping the prose. */
function stripEmbeddedFrame(message) {
	const lines = message.split("\n");
	const candidates = [lines.findIndex((line) => LABELLED_FRAME_RE.test(line) || /^\s*\d+\s*[│|]/.test(line)), colonFrameStart(lines) ?? -1].filter((index) => index > 0);
	const start = candidates.length ? Math.min(...candidates) : -1;
	if (start <= 0) return message;
	return lines.slice(0, start).join("\n").replace(/\s+$/, "");
}
//#endregion
//#region src/report/create.ts
const DEFAULT_LOADERS = [fsLoader()];
function resolveOptions(options = {}) {
	const presets = options.presets ?? [];
	return {
		cwd: options.cwd ?? (typeof process !== "undefined" && process.cwd ? process.cwd() : "/"),
		kind: options.kind,
		loaders: options.loaders ?? [...presets.flatMap((preset) => preset.loaders ?? []), ...DEFAULT_LOADERS],
		internal: [...presets.flatMap((preset) => preset.internal ?? []), ...options.internal ?? []],
		plugins: [...presets.flatMap((preset) => preset.plugins ?? []), ...options.plugins ?? []],
		maxCauses: options.maxCauses ?? 10,
		maxErrors: options.maxErrors ?? 20,
		maxMappedFrames: options.maxMappedFrames ?? 200,
		maxSectionLength: options.maxSectionLength ?? 5e4,
		maxMessageLength: options.maxMessageLength ?? 1e4,
		maxRawStackLength: options.maxRawStackLength ?? 5e4,
		snippetLines: options.snippetLines ?? 5,
		maxSnippets: snippetCount(options.maxSnippets),
		maxSnippetLineLength: lineLength(options.maxSnippetLineLength),
		snippets: options.snippets ?? true,
		context: options.context ?? {},
		tokenizer: options.tokenizer,
		compiled: options.compiled
	};
}
function snippetCount(value) {
	return value === void 0 || Number.isNaN(value) ? 100 : Math.max(0, Math.floor(value));
}
/** At least 2, which leaves a cut line one character and its `…`. */
function lineLength(value) {
	return value === void 0 || Number.isNaN(value) ? 500 : Math.max(2, Math.floor(value));
}
/** Build a serialisable report from an error, warning, or Vite-style compile error. */
async function createReport(input, options = {}) {
	const resolved = resolveOptions(options);
	const report = hoistCompileError(collapseDuplicateCauses(await buildReport(input, {
		options: resolved,
		seen: /* @__PURE__ */ new WeakSet(),
		sources: /* @__PURE__ */ new Map(),
		compiled: /* @__PURE__ */ new Map(),
		budget: {
			frames: resolved.maxMappedFrames,
			snippets: resolved.maxSnippets
		}
	}, 0)));
	for (const plugin of resolved.plugins) await plugin.transform(report, {
		input,
		options: resolved
	});
	return report;
}
/**
* Merge a wrapper that only repeats its cause's message (h3's `HTTPError`
* around a thrown `Error`) into that cause, so the page does not show the same
* text twice. The cause was thrown first, so its frames are the useful ones.
*/
function collapseDuplicateCauses(report) {
	const causes = report.causes.map(collapseDuplicateCauses);
	const errors = report.errors?.map(collapseDuplicateCauses);
	const duplicate = causes.find((cause) => cause.message === report.message && cause.kind === report.kind);
	if (!duplicate) return {
		...report,
		causes,
		...errors && { errors }
	};
	const hasApp = (frames) => frames.some((frame) => frame.type === "app");
	const frames = hasApp(duplicate.frames) || !report.frames.length ? duplicate.frames : report.frames;
	const generic = /^(?:Error|HTTPError|H3Error|FetchError)$/.test(report.name);
	return {
		...report,
		name: generic && duplicate.name !== "Error" ? duplicate.name : report.name,
		code: report.code ?? duplicate.code,
		...(report.diagnostic ?? duplicate.diagnostic) && { diagnostic: true },
		hint: report.hint ?? duplicate.hint,
		docsUrl: report.docsUrl ?? duplicate.docsUrl,
		status: report.status ?? duplicate.status,
		trace: report.trace ?? duplicate.trace,
		frames,
		rawStack: report.rawStack ?? duplicate.rawStack,
		sections: mergeSections(report.sections, duplicate.sections),
		causes: [...causes.filter((cause) => cause !== duplicate), ...duplicate.causes],
		...errors && { errors }
	};
}
/** Frameworks wrap compiler errors in generic HTTP errors; the compile error is what the developer needs first. */
function hoistCompileError(report) {
	if (report.kind !== "error" || report.frames.some((frame) => frame.type === "app")) return report;
	const index = report.causes.findIndex((cause) => cause.kind === "compile");
	if (index === -1) return report;
	const compile = report.causes[index];
	const wrapper = {
		...report,
		causes: report.causes.filter((_, i) => i !== index)
	};
	return {
		...compile,
		status: compile.status ?? report.status,
		sections: mergeSections(compile.sections, report.sections),
		causes: [...compile.causes, wrapper]
	};
}
function mergeSections(base, extra) {
	return [...base, ...extra.filter((section) => !base.some((existing) => existing.id === section.id))];
}
function truncate(text, max) {
	return text.length <= max ? text : `${text.slice(0, max)}… [truncated, ${text.length - max} more characters]`;
}
async function buildReport(input, ctx, depth) {
	const { options, seen } = ctx;
	const error = normalizeInput(input);
	const isObject = typeof input === "object" && input !== null;
	if (isObject) seen.add(input);
	const quoted = options.kind === void 0 && !isCompileInput(input) ? await compileInputFromMessage(error, ctx) : void 0;
	const kind = options.kind ?? (quoted || isCompileInput(input) ? "compile" : "error");
	const frames = await buildFrames(quoted ?? input, error, ctx, kind);
	const sources = await buildSourceFrames(error.sources, ctx);
	if (sources.frames.length) frames.unshift(...sources.frames);
	const sections = [];
	if (sources.unresolved.length) sections.push({
		id: "sources",
		title: "Sources",
		content: sources.unresolved.join("\n")
	});
	if (error.data !== void 0) sections.push({
		id: "data",
		title: "Data",
		content: toSectionContent(error.data, options.maxSectionLength)
	});
	const report = {
		id: "",
		kind,
		name: quoted?.name ?? error.name,
		message: truncate(quoted ? quoted.message : kind === "compile" ? stripEmbeddedFrame(error.message) : error.message, options.maxMessageLength),
		...error.code && { code: error.code },
		...error.diagnostic && { diagnostic: true },
		...error.hint && { hint: error.hint },
		...error.docsUrl && { docsUrl: error.docsUrl },
		...error.status && { status: error.status },
		frames,
		causes: [],
		sections,
		...error.stack && { rawStack: truncate(error.stack, options.maxRawStackLength) },
		timestamp: Date.now()
	};
	if (depth < options.maxCauses) {
		if (error.cause !== void 0 && !(typeof error.cause === "object" && error.cause !== null && seen.has(error.cause))) report.causes.push(await buildReport(error.cause, nestedContext(ctx), depth + 1));
		if (Array.isArray(error.errors)) {
			report.errors = [];
			const kept = error.errors.slice(0, Math.max(0, options.maxErrors));
			for (const child of kept) {
				if (typeof child === "object" && child !== null && seen.has(child)) continue;
				report.errors.push(await buildReport(child, nestedContext(ctx), depth + 1));
			}
			const omitted = error.errors.length - kept.length;
			if (omitted > 0) report.omittedErrors = omitted;
		}
	}
	if (isObject) seen.delete(input);
	const top = frames.find((frame) => frame.type === "app") ?? frames[0];
	report.id = fnv1a64Base36(`${report.name}\n${report.message}\n${top?.file ?? ""}:${top?.line ?? ""}`);
	return report;
}
function nestedContext(ctx) {
	return {
		...ctx,
		options: {
			...ctx.options,
			kind: void 0,
			compiled: void 0
		}
	};
}
function normalizeInput(input) {
	if (input instanceof Error || typeof input === "object" && input !== null && "message" in input) {
		const error = input;
		const status = error.statusCode ?? error.status;
		const code = typeof error.code === "string" ? error.code : void 0;
		return {
			name: typeof error.name === "string" && error.name ? error.name : "Error",
			message: stripAnsi(typeof error.message === "string" ? error.message : String(error.message)),
			stack: typeof error.stack === "string" ? error.stack : void 0,
			code,
			diagnostic: !!code && error.name === code,
			hint: typeof error.fix === "string" && error.fix ? stripAnsi(error.fix) : void 0,
			docsUrl: typeof error.docs === "string" && error.docs ? error.docs : void 0,
			sources: Array.isArray(error.sources) ? error.sources.filter((source) => typeof source === "string" && source) : void 0,
			status: typeof status === "number" ? status : void 0,
			data: error.data,
			cause: error.cause,
			errors: error.errors
		};
	}
	return {
		name: "Error",
		message: stripAnsi(stringifyValue(input, 2))
	};
}
const TRAILING_POSITION_RE = /^\s*(?<file>(?:[a-z]:)?[^\s:][^:]*):(?<line>\d+):(?<column>\d+)[\s)]*$/i;
const ERROR_NAME_RE = /^(?<name>[A-Z][A-Za-z]*(?:Error|Exception)): (?<message>[\s\S]*)$/;
/**
* Parsers and loaders (oxc, esbuild, rolldown, `jiti`, Vite's config loader)
* throw a plain `Error` whose stack points at the parser and quote the source
* position on the last line of the message. All three guards are needed: an
* ordinary message can end in colon-separated text.
*/
async function compileInputFromMessage(error, ctx) {
	const lines = error.message.split("\n");
	if (lines.length < 2) return;
	const groups = TRAILING_POSITION_RE.exec(lines.at(-1))?.groups;
	if (!groups) return;
	const file = normalizeSlashes(groups.file);
	if (!isFilePath(file) || await readSource(file, ctx) === void 0) return;
	const head = lines.slice(0, -1).join("\n").trimEnd();
	const named = error.name === "Error" ? ERROR_NAME_RE.exec(head)?.groups : void 0;
	return {
		message: named?.message ?? head,
		...named?.name && { name: named.name },
		id: file,
		loc: {
			file,
			line: Number(groups.line),
			column: Number(groups.column)
		}
	};
}
/**
* Locations a thrower collected itself (nostics' `sources`), as `file:line:column`.
* Only entries that parse and can be read become frames; the rest are listed verbatim
* so nothing the thrower reported is lost.
*/
async function buildSourceFrames(sources, ctx) {
	const frames = [];
	const unresolved = [];
	for (const source of sources ?? []) {
		const groups = TRAILING_POSITION_RE.exec(source)?.groups;
		const raw = groups ? normalizeSlashes(groups.file) : void 0;
		const file = raw ? resolveFile(raw, ctx.options.cwd) : void 0;
		if (!file || await readSource(file, ctx) === void 0) {
			unresolved.push(source);
			continue;
		}
		const frame = {
			file,
			line: Number(groups.line),
			column: Number(groups.column),
			type: "app"
		};
		if (ctx.options.snippets) setSnippet(frame, await loadSnippet(file, frame.line, frame.column, ctx));
		addDisplayPaths(frame, ctx.options.cwd);
		frames.push(frame);
	}
	return {
		frames,
		unresolved
	};
}
function isCompileInput(input) {
	if (typeof input !== "object" || input === null) return false;
	const candidate = input;
	return compileLoc(candidate) !== void 0 || typeof candidate.frame === "string";
}
/**
* A marker on the error is a statement by whoever threw it, so it beats both
* the option (which only ever applies to the top-level input) and detection.
*/
function compiledMarker(input, options) {
	const marker = input.compiled;
	if (typeof marker === "boolean") return marker;
	if (typeof marker === "object" && marker !== null) return { sourceLoc: marker.sourceLoc };
	return options.compiled;
}
function compileLoc(input) {
	const loc = input.loc;
	if (typeof loc !== "object" || loc === null) return;
	if ("start" in loc && typeof loc.start?.line === "number") return {
		file: loc.file,
		line: loc.start.line,
		column: loc.start.column
	};
	if ("line" in loc && typeof loc.line === "number") return loc;
}
/**
* The caret line of a parsed frame is the position that lines up with the snippet
* we display, so it takes precedence over a declared loc that points elsewhere.
* On the line the caret is already on, the declared column wins: bundlers count
* columns from zero when rendering a frame but compilers report them from one,
* so the caret is a character to the right of the position the compiler named.
* A declared column past the end of the caret line is an offset, not a column.
*/
function mergeFrameLoc(declared, frameLoc, caretLine) {
	if (declared && declared.line === frameLoc.line && typeof declared.column === "number" && (caretLine === void 0 || declared.column <= caretLine.length + 1)) return declared;
	return {
		...declared,
		...frameLoc
	};
}
async function buildFrames(input, error, ctx, kind) {
	const { options } = ctx;
	if (kind === "compile" && isCompileInput(input)) {
		const labelled = locFromLabelledFrame(`${input.frame ?? ""}\n${input.message}`);
		const snippet = typeof input.frame === "string" && input.frame ? parseCodeFrame(input.frame) : void 0;
		const frameLoc = typeof input.frame === "string" ? locFromCodeFrame(input.frame) : void 0;
		const declared = compileLoc(input);
		const loc = snippet && frameLoc ? mergeFrameLoc(declared, frameLoc, snippet.lines[frameLoc.line - snippet.start]) : declared ?? frameLoc ?? labelled;
		const rawFile = loc?.file ?? input.id ?? (labelled && resolvePath(options.cwd, labelled.file));
		const file = rawFile ? resolveFile(rawFile, options.cwd) : void 0;
		if (snippet && file) snippet.lang ??= langFromFile(file);
		const marker = compiledMarker(input, options);
		const explicit = marker === false || marker === void 0 ? void 0 : typeof marker === "object" ? marker : {};
		let generated = explicit !== void 0;
		if (!generated && marker !== false && snippet && frameLoc && file && options.snippets) {
			const contents = await readSource(file, ctx);
			generated = contents !== void 0 && caretLineMatchesSource(snippet, frameLoc.line, contents) === false;
		}
		if (generated) {
			const source = explicit?.sourceLoc;
			const sourceFile = source?.file ? resolveFile(source.file, options.cwd) : file;
			const frame = {
				...sourceFile && { file: sourceFile },
				...source && {
					line: source.line,
					...source.column !== void 0 && { column: source.column }
				},
				type: "app",
				...file && { compiled: {
					file,
					...loc && {
						line: loc.line,
						column: loc.column
					},
					...withSnippet(finishSnippet(snippet, loc?.column, ctx))
				} }
			};
			if (frame.file && frame.line !== void 0 && options.snippets) setSnippet(frame, await loadSnippet(frame.file, frame.line, frame.column, ctx));
			addDisplayPaths(frame, options.cwd);
			return [frame];
		}
		const frame = {
			...file && { file },
			...loc && {
				line: loc.line,
				column: loc.column
			},
			type: "app",
			...snippet && { snippet }
		};
		if (!frame.snippet && frame.file && frame.line !== void 0 && options.snippets) setSnippet(frame, await loadSnippet(frame.file, frame.line, frame.column, ctx));
		else if (frame.snippet) {
			const finished = finishSnippet(frame.snippet, frame.column, ctx);
			if (finished) frame.snippet = finished;
			else delete frame.snippet;
		}
		addDisplayPaths(frame, options.cwd);
		return [frame];
	}
	if (!error.stack) return [];
	const built = await Promise.all(parseRawStackTrace(error.stack).map((trace) => buildStackFrame(trace, ctx)));
	await attachSnippets(built, ctx);
	return built.map(({ frame }) => {
		addDisplayPaths(frame, options.cwd);
		return frame;
	});
}
/**
* Snippets are read in batches no larger than the remaining budget, each read
* concurrently and then cut in stack order. The budget goes to the topmost
* frames whatever order the reads finish in, and a later batch only runs when
* an earlier one had unreadable sources.
*/
async function attachSnippets(built, ctx) {
	if (!ctx.options.snippets) return;
	const requests = built.filter(({ frame, mapped }) => mapped && frame.type === "app" && frame.file && frame.line !== void 0).flatMap(({ frame, embedded }) => [{
		frame,
		compiled: false,
		embedded
	}, ...frame.compiled?.line !== void 0 ? [{
		frame,
		compiled: true
	}] : []]);
	for (let next = 0; next < requests.length && ctx.budget.snippets > 0;) {
		const batch = requests.slice(next, next + ctx.budget.snippets);
		next += batch.length;
		const contents = await Promise.all(batch.map(({ frame, compiled, embedded }) => compiled ? readCompiledSource(frame.compiled.file, ctx, frame.compiled.file !== frame.file) : embedded !== void 0 && lineAt(embedded, frame.line) !== void 0 ? embedded : readSource(frame.file, ctx)));
		for (const [index, { frame, compiled }] of batch.entries()) {
			if (!compiled) {
				setSnippet(frame, snippetFrom(contents[index], frame.file, frame.line, frame.column, ctx));
				continue;
			}
			const generated = snippetFrom(contents[index], frame.compiled.file, frame.compiled.line, frame.compiled.column, ctx);
			if (generated) frame.compiled = {
				...frame.compiled,
				snippet: generated
			};
		}
	}
}
async function buildStackFrame(trace, ctx) {
	const { options, budget } = ctx;
	let frame = {
		...trace.source && !trace.isNative && { file: stripCacheQuery(toPath(trace.source)) },
		...trace.line !== void 0 && { line: trace.line },
		...trace.column !== void 0 && { column: trace.column },
		...trace.function && { function: trace.function },
		type: "native",
		...trace.isAsync && { isAsync: true },
		...trace.isConstructor && { isConstructor: true },
		...trace.isEval && { isEval: true },
		..."raw" in trace && typeof trace.raw === "string" && { raw: trace.raw }
	};
	frame.type = classifyFrame({
		...frame,
		isNative: trace.isNative
	}, options.internal, packageName(frame.file, options.cwd));
	if (frame.type !== "native" && budget.frames > 0) {
		budget.frames--;
		const mapped = await mapFrame(frame, options);
		const forcedVendor = mapped !== frame && mapped.type === "vendor" && frame.type !== "vendor";
		frame = mapped;
		frame.type = forcedVendor ? "vendor" : classifyFrame(frame, options.internal, packageName(frame.file, options.cwd));
		return {
			frame,
			mapped: true,
			embedded: embeddedSource(frame)
		};
	}
	return {
		frame,
		mapped: false
	};
}
const LEADING_ELLIPSIS = /^\s*(?:…|\.\.\.)/;
const TRAILING_ELLIPSIS = /(?:…|\.\.\.)\s*$/;
/** Braces, brackets and separators are shared by every language; matching on them proves nothing. */
const UNINFORMATIVE = /^[\s{}()[\];,.]*$/;
/**
* Bundlers report a position inside the module they transformed while naming
* the source file, so a code frame whose text is not in the file on disk at the
* line it claims is generated code, not source.
*
* Only the caret line is compared, because it is the one line the frame asserts
* describes the reported position, and unlike its neighbours it is rarely a bare
* brace that any file would match by chance. Indentation is ignored, and a line
* the bundler truncated for width is matched on the part that survived.
* `undefined` when there is nothing worth comparing.
*/
function caretLineMatchesSource(snippet, caretLine, contents) {
	const expected = snippet.lines[caretLine - snippet.start]?.trim();
	if (!expected || UNINFORMATIVE.test(stripEllipsis(expected))) return;
	const actual = lineAt(contents, caretLine)?.trim();
	if (actual === void 0) return false;
	if (expected === actual) return true;
	const head = LEADING_ELLIPSIS.test(expected);
	const tail = TRAILING_ELLIPSIS.test(expected);
	if (!head && !tail) return false;
	const survived = stripEllipsis(expected);
	if (survived.length < 8) return;
	return head && tail ? actual.includes(survived) : head ? actual.endsWith(survived) : actual.startsWith(survived);
}
function stripEllipsis(line) {
	return line.replace(LEADING_ELLIPSIS, "").replace(TRAILING_ELLIPSIS, "").trim();
}
function resolveFile(file, cwd) {
	return stripCacheQuery(toPath(isFilePath(file) || hasScheme(file) ? file : resolvePath(cwd, file)));
}
function packageName(file, cwd) {
	return file ? externalPackage(file, cwd)?.name : void 0;
}
/**
* Resolve display paths while the filesystem is available: renderers, including
* the browser client, only ever see the resulting strings.
*/
function addDisplayPaths(frame, cwd) {
	const own = frame.file ? externalPackage(frame.file, cwd)?.displayFile : void 0;
	if (own) frame.displayFile = own;
	const compiled = frame.compiled ? externalPackage(frame.compiled.file, cwd)?.displayFile : void 0;
	if (compiled) frame.compiled = {
		...frame.compiled,
		displayFile: compiled
	};
}
async function mapFrame(frame, options) {
	for (const loader of options.loaders) {
		if (!loader.map) continue;
		try {
			const result = await loader.map(frame);
			if (result === false) return frame;
			if (result) return result;
		} catch {}
	}
	return frame;
}
function readSource(file, ctx) {
	let pending = ctx.sources.get(file);
	if (!pending) {
		pending = readSourceUncached(file, ctx.options);
		ctx.sources.set(file, pending);
	}
	return pending;
}
async function readSourceUncached(file, options) {
	for (const loader of options.loaders) {
		if (!loader.read) continue;
		try {
			const contents = await loader.read(file);
			if (contents !== void 0) return contents;
		} catch {}
	}
}
async function loadSnippet(file, line, column, ctx) {
	return ctx.budget.snippets > 0 ? snippetFrom(await readSource(file, ctx), file, line, column, ctx) : void 0;
}
/** Cut a snippet from file contents, counting it against the report's snippet budget. */
function snippetFrom(contents, file, line, column, ctx) {
	if (contents === void 0 || ctx.budget.snippets <= 0) return;
	const { options } = ctx;
	const snippet = extractSnippet(contents, line, options.snippetLines, file, {
		column,
		maxLineLength: options.maxSnippetLineLength
	});
	if (!snippet) return;
	ctx.budget.snippets--;
	return withTokens(snippet, options);
}
/** Bound and tokenize a snippet that came with the error, counting it against the snippet budget. */
function finishSnippet(snippet, column, ctx) {
	if (!snippet || ctx.budget.snippets <= 0) return;
	ctx.budget.snippets--;
	return withTokens(cropSnippet(snippet, column, ctx.options.maxSnippetLineLength), ctx.options);
}
function setSnippet(frame, snippet) {
	if (snippet) frame.snippet = snippet;
}
function withSnippet(snippet) {
	return snippet ? { snippet } : {};
}
/**
* Read generated code through `readCompiled`, falling back to `read` only when
* the compiled location is a separate file: when it shares the source path
* (module runners) the code lives in memory and only `readCompiled` has it.
*/
async function readCompiledSource(file, ctx, separateFile) {
	let pending = ctx.compiled.get(file);
	if (!pending) {
		pending = readCompiledUncached(file, ctx.options);
		ctx.compiled.set(file, pending);
	}
	const contents = await pending;
	return contents === void 0 && separateFile ? readSource(file, ctx) : contents;
}
async function readCompiledUncached(file, options) {
	for (const loader of options.loaders) try {
		const contents = await loader.readCompiled?.(file);
		if (contents !== void 0) return contents;
	} catch {}
}
function withTokens(snippet, options) {
	return options.tokenizer ? {
		...snippet,
		tokens: tokenizeSnippet(snippet, options.tokenizer)
	} : snippet;
}
function toSectionContent(data, max) {
	const text = stringifyValue(data, 2);
	if (text.length > max) return truncate(text, max);
	if (typeof data === "object" && data !== null && !Array.isArray(data)) return data;
	return text;
}
//#endregion
export { mapPosition as _, renderOverlay as a, decodeSourceMap as b, groupFrames as c, stringifyValue as d, DEFAULT_DISPLAY_MESSAGE_LENGTH as f, findOriginal as g, parseInlineSourceMap as h, injectOverlay as i, groupSummary as l, fsLoader as m, resolveOptions as n, renderPage as o, clampMessage as p, clientAssets as r, stripAnsi as s, createReport as t, snippetTokens as u, sourceMapLoader as v, withEmbeddedSource as y };
