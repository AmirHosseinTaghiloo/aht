import { _ as runCommand, a as globalCwdArgs } from "./_shared-YyGADOl7.mjs";
import { S as ActionableError, s as debug } from "./startup-clock-DXZlxuSA.mjs";
import process from "node:process";
import { resolveModulePath } from "exsolve";
import { dirname, extname, join, normalize } from "pathe";
import { mkdir, readFile, writeFile } from "node:fs/promises";
//#region src/commands/_utils.ts
const nuxiCommands = [
	"add",
	"add-template",
	"analyze",
	"build",
	"cleanup",
	"_dev",
	"dev",
	"devtools",
	"docs",
	"generate",
	"info",
	"init",
	"module",
	"prepare",
	"preview",
	"start",
	"test",
	"typecheck",
	"upgrade"
];
function isNuxiCommand(command) {
	return nuxiCommands.includes(command);
}
//#endregion
//#region src/run-command.ts
async function runCommandDef(command, argv = process.argv.slice(2), data = {}) {
	if (command.meta && "name" in command.meta && typeof command.meta.name === "string") {
		const name = command.meta.name;
		if (!isNuxiCommand(name)) throw new Error(`Invalid command ${name}`);
	} else throw new Error(`Invalid command, must be named`);
	return await runCommand(command, {
		rawArgs: [...argv],
		inheritedArgs: globalCwdArgs,
		data: { overrides: data.overrides || {} }
	});
}
//#endregion
//#region src/utils/config-parse.ts
/**
* Parsers this module can read an AST from, in preference order. Both are
* declared as optional peer dependencies, so a bare import resolves whichever
* version the installed `nuxt` pinned.
*/
const PARSER_CANDIDATES = [{
	specifier: "rolldown/utils",
	export: "parseSync"
}, {
	specifier: "oxc-parser",
	export: "parseSync"
}];
/** Config keys holding a list of specifiers this module can edit. */
const CONFIG_KEYS = ["modules", "extends"];
/** Keys Nuxt also accepts as a bare string rather than an array. */
const SINGLE_VALUE_KEYS = /* @__PURE__ */ new Set(["extends"]);
function allElements(keys) {
	return CONFIG_KEYS.flatMap((key) => keys[key].elements);
}
const parserCache = /* @__PURE__ */ new Map();
const SELF = Symbol("self");
/**
* Places a parser may be reachable from, closest first.
*
* A project rarely depends on a parser directly, so most installs are found via
* the project's `nuxt`. `SELF` means a bare import, which covers the optional
* peer dependency: under pnpm that is the only way a parser is reachable from
* `@nuxt/cli`, since peers are linked from `nuxt`'s dependencies and the project's
* own `node_modules` does not expose them. `nuxi` and `npx nuxt` have no peers
* installed and rely on the two roots before it.
*/
function resolutionRoots(cwd) {
	const from = join(cwd, "/");
	const nuxt = resolveModulePath("nuxt", {
		from,
		try: true
	});
	return nuxt ? [
		from,
		nuxt,
		SELF
	] : [from, SELF];
}
async function loadParser(cwd) {
	if (process.env.NUXT_CLI_PARSER === "scanner") return;
	const roots = resolutionRoots(cwd);
	for (const from of roots) for (const candidate of PARSER_CANDIDATES) {
		const path = from === SELF ? candidate.specifier : resolveModulePath(candidate.specifier, {
			from,
			try: true
		});
		if (!path) continue;
		try {
			const module = await import(path);
			const parseSync = module[candidate.export] ?? module.default?.[candidate.export];
			if (typeof parseSync === "function") return parseSync;
		} catch (error) {
			debug(`Failed to load \`${candidate.specifier}\` from \`${from === SELF ? "self" : from}\`:`, error);
		}
	}
}
/**
* Find the exported config object and the arrays this module can edit.
*
* Uses an oxc parser resolved from the project, falling back to a bracket scan
* when the project has none. The scan understands strings, comments and nesting,
* but not conditional or computed keys.
*/
async function locateConfig(source, filename, cwd) {
	let parserPromise = parserCache.get(cwd);
	if (!parserPromise) {
		parserPromise = loadParser(cwd);
		parserCache.set(cwd, parserPromise);
	}
	const parseSync = await parserPromise;
	if (parseSync) try {
		return locateWithParser(parseSync, source, filename);
	} catch (error) {
		if (error instanceof ConfigShapeError) throw error;
		debug("Falling back to scanning the config after a parser failure:", error);
	}
	return locateWithScan(source);
}
/** Thrown for a config we understand but cannot edit, so it is never retried by the scanner. */
var ConfigShapeError = class extends Error {};
/**
* Thrown when the resolved parser produced something other than the ESTree shape
* this module knows how to read, so that the scanner is used instead.
*
* Misreading an AST is worse than not reading it: an unrecognised `modules`
* property looks like an absent one, which would add a second `modules` key and
* silently shadow the real list.
*/
var UnknownAstError = class extends Error {};
const ESTREE_PROPERTY_TYPES = /* @__PURE__ */ new Set(["Property", "SpreadElement"]);
const LITERAL_SUFFIX_RE = /Literal$/;
function locateWithParser(parseSync, source, filename) {
	const { program, errors } = parseSync(filename, source);
	if (errors.length) throw new Error(`Failed to parse ${filename}`);
	if (!Array.isArray(program?.body)) throw new UnknownAstError("the parser did not return an ESTree program");
	const exported = program.body.find((node) => node.type === "ExportDefaultDeclaration");
	if (!exported) throw new ConfigShapeError("Default export is missing in the config file!");
	const called = unwrap(exported.declaration);
	const object = unwrap(called.type === "CallExpression" ? called.arguments[0] : called);
	if (object?.type !== "ObjectExpression") throw new ConfigShapeError("Could not find a config object in the default export.");
	if (!Array.isArray(object.properties) || object.properties.some((property) => !ESTREE_PROPERTY_TYPES.has(property?.type))) throw new UnknownAstError("the config object does not hold ESTree properties");
	const dynamic = object.properties.some((property) => property.type === "SpreadElement" || property.computed === true);
	const propertyStarts = object.properties.map((property) => property.start);
	const keys = {};
	for (const key of CONFIG_KEYS) {
		const property = object.properties.find((candidate) => candidate.type === "Property" && (candidate.key?.name ?? candidate.key?.value) === key);
		keys[key] = property ? readArrayValue(property.value, key) : { elements: [] };
	}
	return {
		objectStart: object.start,
		propertyStarts,
		keys,
		dynamic,
		quote: detectQuote(source, allElements(keys))
	};
}
function readArrayValue(value, key) {
	if (value?.type === "ArrayExpression") {
		if (value.elements.some((element) => element?.type !== "Literal" && LITERAL_SUFFIX_RE.test(element?.type ?? ""))) throw new UnknownAstError(`the \`${key}\` array does not hold ESTree literals`);
		return {
			array: {
				start: value.start,
				end: value.end
			},
			elements: value.elements.map((element) => ({
				start: element.start,
				end: element.end,
				name: readName(element)
			}))
		};
	}
	if (value?.type !== "Literal" && LITERAL_SUFFIX_RE.test(value?.type ?? "")) throw new UnknownAstError(`the \`${key}\` entry is not an ESTree literal`);
	if (SINGLE_VALUE_KEYS.has(key) && value?.type === "Literal" && typeof value.value === "string") {
		const single = {
			start: value.start,
			end: value.end
		};
		return {
			single,
			elements: [{
				...single,
				name: value.value
			}]
		};
	}
	throw new ConfigShapeError(`The \`${key}\` entry in the config file is not an array.`);
}
const TRANSPARENT_WRAPPERS = /* @__PURE__ */ new Set([
	"TSAsExpression",
	"TSSatisfiesExpression",
	"TSNonNullExpression",
	"TSInstantiationExpression",
	"ParenthesizedExpression"
]);
/** Strip type assertions and parentheses that do not change the value. */
function unwrap(node) {
	let current = node;
	while (current && TRANSPARENT_WRAPPERS.has(current.type)) current = current.expression;
	return current;
}
function readName(element) {
	if (element?.type === "Literal" && typeof element.value === "string") return element.value;
	if (element?.type === "ArrayExpression") return readName(element.elements[0]);
	return null;
}
/**
* Pick the quote character a new entry should use.
*
* An entry already in the array is the most reliable signal. Failing that, string
* literals elsewhere are counted, skipping comments so that an apostrophe in prose
* does not decide the file's style.
*/
function detectQuote(source, elements) {
	for (const element of elements) {
		const char = source[element.start];
		if (char === "\"" || char === "'") return char;
	}
	let single = 0;
	let double = 0;
	let at = 0;
	while (at < source.length) {
		const next = skipTrivia(source, at);
		if (next !== at) {
			at = next;
			continue;
		}
		const char = source[at];
		if (char === "'" || char === "\"" || char === "`") {
			const end = findStringEnd(source, at);
			if (end === void 0) break;
			if (char === "'") single++;
			else if (char === "\"") double++;
			at = end + 1;
			continue;
		}
		at++;
	}
	return double > single ? "\"" : "'";
}
/**
* Locate the editable arrays by scanning, for projects with no oxc parser on disk.
*
* Only the shapes the CLI writes itself are supported: a key holding an array
* literal (or, for `extends`, a single string), inside the object of a default
* export.
*/
function locateWithScan(source) {
	const objectStart = findDefaultExportObject(source);
	if (objectStart === void 0) throw new ConfigShapeError("Default export is missing in the config file!");
	const { properties, complete } = scanProperties(source, objectStart);
	const keys = {};
	for (const key of CONFIG_KEYS) {
		const property = properties.find((candidate) => candidate.key === key);
		keys[key] = property ? scanArrayValue(source, property.valueStart, key) : { elements: [] };
	}
	return {
		objectStart,
		propertyStarts: properties.map((property) => property.start),
		keys,
		dynamic: !complete,
		quote: detectQuote(source, allElements(keys))
	};
}
function scanArrayValue(source, valueStart, key) {
	const start = skipTrivia(source, valueStart);
	if (source[start] === "[") {
		const end = matchBracket(source, start);
		if (end === void 0) throw new ConfigShapeError(`The \`${key}\` array in the config file is not terminated.`);
		return {
			array: {
				start,
				end: end + 1
			},
			elements: scanElements(source, start, end)
		};
	}
	if (SINGLE_VALUE_KEYS.has(key) && (source[start] === "'" || source[start] === "\"")) {
		const end = findStringEnd(source, start);
		if (end === void 0) throw new ConfigShapeError(`The \`${key}\` entry in the config file is not terminated.`);
		const single = {
			start,
			end: end + 1
		};
		return {
			single,
			elements: [{
				...single,
				name: readScannedName(source.slice(start, end + 1))
			}]
		};
	}
	throw new ConfigShapeError(`The \`${key}\` entry in the config file is not an array.`);
}
const DEFAULT_EXPORT_RE = /\bexport\s+default\s+/g;
function findDefaultExportObject(source) {
	DEFAULT_EXPORT_RE.lastIndex = 0;
	let match = DEFAULT_EXPORT_RE.exec(source);
	while (match) {
		let at = skipTrivia(source, match.index + match[0].length);
		while (at < source.length && /[\w$.]/.test(source[at])) {
			while (at < source.length && /[\w$.]/.test(source[at])) at++;
			at = skipTrivia(source, at);
			if (source[at] !== "(") break;
			at = skipTrivia(source, at + 1);
		}
		if (source[at] === "{") return at;
		match = DEFAULT_EXPORT_RE.exec(source);
	}
}
function scanProperties(source, objectStart) {
	const objectEnd = matchBracket(source, objectStart);
	if (objectEnd === void 0) throw new ConfigShapeError("The config object is not terminated.");
	const properties = [];
	let complete = true;
	let at = skipTrivia(source, objectStart + 1);
	while (at < objectEnd) {
		const start = at;
		const key = readKey(source, at);
		if (!key) {
			complete = false;
			break;
		}
		at = skipTrivia(source, key.end);
		if (source[at] !== ":") {
			complete = false;
			break;
		}
		const valueStart = at + 1;
		properties.push({
			key: key.value,
			start,
			valueStart
		});
		const valueEnd = skipValue(source, valueStart, objectEnd);
		if (valueEnd === void 0) {
			complete = false;
			break;
		}
		at = skipTrivia(source, valueEnd);
		if (source[at] === ",") at = skipTrivia(source, at + 1);
	}
	return {
		properties,
		complete
	};
}
function readKey(source, at) {
	const quote = source[at];
	if (quote === "'" || quote === "\"") {
		const end = findStringEnd(source, at);
		return end === void 0 ? void 0 : {
			value: source.slice(at + 1, end),
			end: end + 1
		};
	}
	let end = at;
	while (end < source.length && /[\w$]/.test(source[end])) end++;
	return end === at ? void 0 : {
		value: source.slice(at, end),
		end
	};
}
/** Advance past one property value, stopping at the `,` or `}` that ends it. */
function skipValue(source, from, limit) {
	let at = skipTrivia(source, from);
	while (at < limit) {
		const char = source[at];
		if (char === "," || char === "}") return at;
		if (char === "'" || char === "\"" || char === "`") {
			const end = findStringEnd(source, at);
			if (end === void 0) return;
			at = end + 1;
			continue;
		}
		if (char === "[" || char === "{" || char === "(") {
			const end = matchBracket(source, at);
			if (end === void 0) return;
			at = end + 1;
			continue;
		}
		at = skipTrivia(source, at + 1);
	}
	return at;
}
function scanElements(source, arrayStart, arrayEnd) {
	const elements = [];
	let at = skipTrivia(source, arrayStart + 1);
	while (at < arrayEnd) {
		const start = at;
		const end = skipValue(source, at, arrayEnd);
		if (end === void 0) break;
		const valueEnd = trimTrivia(source, start, end);
		if (valueEnd === start) break;
		elements.push({
			start,
			end: valueEnd,
			name: readScannedName(source.slice(start, valueEnd))
		});
		at = skipTrivia(source, end);
		if (source[at] === ",") at = skipTrivia(source, at + 1);
		else break;
	}
	return elements;
}
const LEADING_STRING_RE = /^(['"])((?:[^\\]|\\.)*?)\1/;
function readScannedName(text) {
	const inner = text.startsWith("[") ? text.slice(1).trimStart() : text;
	const match = LEADING_STRING_RE.exec(inner);
	return match ? match[2].replace(/\\(.)/g, "$1") : null;
}
/**
* End of the last token between `from` and `to`, excluding trailing whitespace
* and comments.
*
* An entry's bounds must stop at its value: a trailing comment counted as part of
* the entry would take a separator inserted after it, commenting out the comma.
*/
function trimTrivia(source, from, to) {
	let cursor = from;
	let end = from;
	while (cursor < to) {
		const skipped = skipTrivia(source, cursor);
		if (skipped !== cursor) {
			cursor = Math.min(skipped, to);
			continue;
		}
		const char = source[cursor];
		if (char === "'" || char === "\"" || char === "`") {
			const stringEnd = findStringEnd(source, cursor);
			if (stringEnd === void 0 || stringEnd >= to) break;
			cursor = stringEnd + 1;
		} else if (char === "[" || char === "{" || char === "(") {
			const bracketEnd = matchBracket(source, cursor);
			if (bracketEnd === void 0 || bracketEnd >= to) break;
			cursor = bracketEnd + 1;
		} else cursor++;
		end = cursor;
	}
	return end;
}
const CLOSING = {
	"[": "]",
	"{": "}",
	"(": ")"
};
function matchBracket(source, at) {
	const open = source[at];
	const close = CLOSING[open];
	let depth = 0;
	let cursor = at;
	while (cursor < source.length) {
		const char = source[cursor];
		if (char === "'" || char === "\"" || char === "`") {
			const end = findStringEnd(source, cursor);
			if (end === void 0) return;
			cursor = end + 1;
			continue;
		}
		const skipped = skipTrivia(source, cursor);
		if (skipped !== cursor) {
			cursor = skipped;
			continue;
		}
		if (char === open) depth++;
		else if (char === close) {
			depth--;
			if (depth === 0) return cursor;
		}
		cursor++;
	}
}
function findStringEnd(source, at) {
	const quote = source[at];
	let cursor = at + 1;
	while (cursor < source.length) {
		const char = source[cursor];
		if (char === "\\") {
			cursor += 2;
			continue;
		}
		if (char === quote) return cursor;
		cursor++;
	}
}
/** Advance past whitespace and comments. */
function skipTrivia(source, at) {
	let cursor = at;
	while (cursor < source.length) {
		const char = source[cursor];
		if (char === " " || char === "	" || char === "\n" || char === "\r") {
			cursor++;
			continue;
		}
		if (char === "/" && source[cursor + 1] === "/") {
			const newline = source.indexOf("\n", cursor);
			cursor = newline === -1 ? source.length : newline;
			continue;
		}
		if (char === "/" && source[cursor + 1] === "*") {
			const end = source.indexOf("*/", cursor);
			cursor = end === -1 ? source.length : end + 2;
			continue;
		}
		return cursor;
	}
	return cursor;
}
//#endregion
//#region src/utils/config.ts
const RESOLVE_EXTENSIONS = [
	".js",
	".ts",
	".mjs",
	".cjs",
	".mts",
	".cts",
	".json",
	".jsonc",
	".json5",
	".yaml",
	".yml",
	".toml"
];
const EDITABLE_EXTENSIONS = [
	".js",
	".ts",
	".mjs",
	".cjs",
	".mts",
	".cts"
];
const LEADING_INDENT_RE = /^[ \t]*/;
const OWN_LINE_RE = /\n[ \t]*$/;
const LEADING_COMMA_RE = /^\s*,/;
const TRAILING_COMMA_RE = /,\s*$/;
const TRAILING_SPACE_RE = /\s$/;
/** Reuse the file's own line ending so a CRLF config does not gain stray LFs. */
function detectEol(source) {
	return source.includes("\r\n") ? "\r\n" : "\n";
}
/** Indentation of the line `index` sits on. */
function lineIndent(source, index) {
	const lineStart = source.lastIndexOf("\n", index) + 1;
	return LEADING_INDENT_RE.exec(source.slice(lineStart, index))[0];
}
/** Whether every key in the config object is quoted, so a new one should be too. */
function isQuotedKeys(source, location) {
	return location.propertyStarts.length > 0 && location.propertyStarts.every((start) => source[start] === "\"" || source[start] === "'");
}
/** Resolve the project's `nuxt.config` and read the modules it lists. */
async function readNuxtConfig(cwd) {
	const file = tryResolve("./nuxt.config", cwd) || tryResolve("./.config/nuxt.config", cwd) || tryResolve("./.config/nuxt", cwd);
	if (!file) return;
	const ext = extname(file);
	if (!EDITABLE_EXTENSIONS.includes(ext)) throw new ActionableError(`Unsupported config file extension: ${ext} (${file}) (supported: ${EDITABLE_EXTENSIONS.join(", ")})`);
	return toConfigFile(file, cwd, await locateConfig(await readFile(file, "utf8"), file, cwd));
}
/** Write a new `nuxt.config.ts` containing `contents`. */
async function createNuxtConfig(cwd, contents) {
	const file = join(cwd, "nuxt.config.ts");
	await mkdir(dirname(file), { recursive: true });
	await writeFile(file, contents, "utf8");
	return toConfigFile(file, cwd, await locateConfig(contents, file, cwd));
}
/**
* Append entries to the config's `modules` and `extends` arrays, creating an array
* if the config has no such key. Entries already listed are ignored.
*
* Each array is edited as a text splice, so formatting, comments and quote style
* elsewhere in the file survive untouched.
*/
async function addNuxtConfigEntries(config, entries) {
	const source = await readFile(config.file, "utf8");
	const location = await locateConfig(source, config.file, config.cwd);
	const edits = [];
	const created = [];
	for (const key of CONFIG_KEYS) {
		const array = location.keys[key];
		const listed = new Set(array.elements.map((element) => element.name));
		const names = (entries[key] ?? []).filter((name) => !listed.has(name));
		if (!names.length) continue;
		if (array.array || array.single) edits.push(buildInsert(source, location, array, names));
		else {
			if (location.dynamic) throw new ActionableError(`Could not add \`${key}\` to ${config.file}: the config spreads or computes keys, so a new \`${key}\` could be silently overridden. Add ${names.map((name) => `\`${name}\``).join(", ")} to \`${key}\` by hand.`);
			created.push(buildProperty(source, location, key, names));
		}
	}
	if (created.length) edits.push(buildPropertyInsert(source, location, created));
	if (!edits.length) return;
	await writeFile(config.file, applyEdits(source, edits), "utf8");
}
/** Remove entries from the config's `modules` and `extends` arrays. Absent entries are ignored. */
async function removeNuxtConfigEntries(config, entries) {
	const source = await readFile(config.file, "utf8");
	const location = await locateConfig(source, config.file, config.cwd);
	const edits = [];
	for (const key of CONFIG_KEYS) {
		const array = location.keys[key];
		const toRemove = new Set(entries[key] ?? []);
		const doomed = array.elements.filter((element) => element.name !== null && toRemove.has(element.name));
		if (!doomed.length || !array.array) continue;
		if (doomed.length === array.elements.length) {
			edits.push({
				start: array.array.start,
				end: array.array.end,
				text: "[]"
			});
			continue;
		}
		const removals = doomed.map((element) => buildRemoval(source, array, element, doomed));
		const orphanedComma = findOrphanedComma(source, array, doomed);
		if (orphanedComma !== void 0) removals.push({
			start: orphanedComma,
			end: orphanedComma + 1,
			text: ""
		});
		edits.push(...mergeRemovals(removals));
	}
	if (!edits.length) return;
	await writeFile(config.file, applyEdits(source, edits), "utf8");
}
/**
* Combine deletions that overlap into one range.
*
* Removing consecutive entries produces ranges that reach over each other,
* because each entry takes the separator that attached it to the one before.
* Applied separately they would delete text twice over.
*/
function mergeRemovals(removals) {
	const sorted = [...removals].sort((a, b) => a.start - b.start);
	const merged = [];
	for (const removal of sorted) {
		const previous = merged.at(-1);
		if (previous && removal.start <= previous.end) {
			previous.end = Math.max(previous.end, removal.end);
			continue;
		}
		merged.push({ ...removal });
	}
	return merged;
}
/**
* Offset of a separator that would be left dangling after a removal.
*
* Dropping the final entry of an array written without a trailing comma promotes
* the entry before it, which must then shed the comma it no longer needs.
*/
function findOrphanedComma(source, location, doomed) {
	const lastEntry = location.elements.at(-1);
	if (!doomed.includes(lastEntry) || LEADING_COMMA_RE.test(source.slice(lastEntry.end, location.array.end - 1))) return;
	if (!OWN_LINE_RE.test(source.slice(0, lastEntry.start))) return;
	const survivor = location.elements.filter((element) => !doomed.includes(element)).at(-1);
	if (!survivor) return;
	let at = survivor.end;
	while (source[at] === " " || source[at] === "	") at++;
	return source[at] === "," ? at : void 0;
}
function toConfigFile(file, cwd, location) {
	return {
		file,
		cwd,
		modules: readNames(location, "modules"),
		extends: readNames(location, "extends")
	};
}
function readNames(location, key) {
	return location.keys[key].elements.map((element) => element.name).filter((name) => name !== null);
}
/**
* Splice edits into `source`, working backwards so earlier offsets stay valid.
*
* An edit reaching into one that has already been applied is clipped rather than
* left to consume the text that moved into its range, which would corrupt the
* file rather than simply misplacing a separator.
*/
function applyEdits(source, edits) {
	let result = source;
	let applied = source.length;
	for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
		const end = Math.max(edit.start, Math.min(edit.end, applied));
		result = result.slice(0, edit.start) + edit.text + result.slice(end);
		applied = edit.start;
	}
	return result;
}
/** Render a `key: [...]` property for a config that has no such key yet. */
function buildProperty(source, location, key, names) {
	return `${isQuotedKeys(source, location) ? `${location.quote}${key}${location.quote}` : key}: [${quoteAll(location, names).join(", ")}]`;
}
function buildPropertyInsert(source, location, properties) {
	const at = location.objectStart + 1;
	const eol = detectEol(source);
	const firstProperty = location.propertyStarts[0];
	if (firstProperty !== void 0 && source.lastIndexOf("\n", firstProperty) > location.objectStart) {
		const indent = lineIndent(source, firstProperty);
		return {
			start: at,
			end: at,
			text: properties.map((property) => `${eol}${indent}${property},`).join("")
		};
	}
	const separator = location.propertyStarts.length ? "," : " ";
	return {
		start: at,
		end: at,
		text: ` ${properties.join(", ")}${separator}`
	};
}
function quoteAll(location, names) {
	return names.map((name) => `${location.quote}${name}${location.quote}`);
}
function buildInsert(source, location, array, names) {
	const entries = quoteAll(location, names);
	const eol = detectEol(source);
	if (array.single) {
		const existing = source.slice(array.single.start, array.single.end);
		return {
			start: array.single.start,
			end: array.single.end,
			text: `[${[existing, ...entries].join(", ")}]`
		};
	}
	const close = array.array.end - 1;
	const closeLineStart = source.lastIndexOf("\n", close) + 1;
	const last = array.elements.at(-1);
	const ownLine = closeLineStart > (last?.end ?? array.array.start);
	if (!last) {
		if (!ownLine) {
			const at = array.array.start + 1;
			return {
				start: at,
				end: at,
				text: entries.join(", ")
			};
		}
		const closeIndent = source.slice(closeLineStart, close);
		const indent = closeIndent + (closeIndent.includes("	") ? "	" : "  ");
		return {
			start: closeLineStart,
			end: closeLineStart,
			text: entries.map((entry) => `${indent}${entry},${eol}`).join("")
		};
	}
	if (ownLine) {
		const region = source.slice(last.end, closeLineStart);
		const trailingComma = LEADING_COMMA_RE.test(region);
		const indent = lineIndent(source, last.start);
		const lines = entries.map((entry, index) => {
			const comma = trailingComma || index < entries.length - 1 ? "," : "";
			return `${indent}${entry}${comma}${eol}`;
		});
		return {
			start: last.end,
			end: closeLineStart,
			text: (trailingComma ? "" : ",") + region + lines.join("")
		};
	}
	const region = source.slice(last.end, close);
	return {
		start: close,
		end: close,
		text: (TRAILING_COMMA_RE.test(region) ? TRAILING_SPACE_RE.test(region) ? "" : " " : ", ") + entries.join(", ")
	};
}
function buildRemoval(source, location, element, doomed) {
	let start = element.start;
	let end = element.end;
	if (source[end] === ",") end++;
	if (OWN_LINE_RE.test(source.slice(0, element.start))) {
		start = source.lastIndexOf("\n", element.start - 1) + 1;
		const newline = source.indexOf("\n", end);
		return {
			start,
			end: newline === -1 ? source.length : newline + 1,
			text: ""
		};
	}
	while (source[end] === " ") end++;
	if (source[end] === "]") {
		const index = location.elements.indexOf(element);
		start = location.elements.slice(0, index).filter((candidate) => !doomed.includes(candidate)).at(-1)?.end ?? start;
	} else if (source[end] === "\n" || source[end] === "\r") while (start > 0 && (source[start - 1] === " " || source[start - 1] === "	")) start--;
	return {
		start,
		end,
		text: ""
	};
}
function tryResolve(path, cwd) {
	const resolved = resolveModulePath(path, {
		try: true,
		from: join(cwd, "/"),
		extensions: RESOLVE_EXTENSIONS,
		suffixes: ["", "/index"],
		cache: false
	});
	return resolved ? normalize(resolved) : void 0;
}
//#endregion
export { CONFIG_KEYS as a, removeNuxtConfigEntries as i, createNuxtConfig as n, runCommandDef as o, readNuxtConfig as r, addNuxtConfigEntries as t };
