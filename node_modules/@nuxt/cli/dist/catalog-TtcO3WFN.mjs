import { dirname, join, resolve } from "pathe";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { parseYAML } from "confbox/yaml";
//#region src/utils/catalog.ts
const CATALOG_SPECIFIER_RE = /^catalog:(.*)$/;
const DEFAULT_CATALOG = "default";
/**
* The catalog a `catalog:` / `catalog:name` specifier refers to, or `undefined`
* for any other specifier.
*/
function parseCatalogSpecifier(specifier) {
	const match = specifier?.match(CATALOG_SPECIFIER_RE);
	if (!match) return;
	return match[1] || DEFAULT_CATALOG;
}
/** Nearest `pnpm-workspace.yaml` at or above `cwd`. */
function findPnpmWorkspaceYaml(cwd) {
	for (let dir = resolve(cwd);; dir = dirname(dir)) {
		const filePath = join(dir, "pnpm-workspace.yaml");
		if (existsSync(filePath)) return filePath;
		if (dir === dirname(dir)) return;
	}
}
const configCache = /* @__PURE__ */ new Map();
/** Discard memoised catalog configuration, so a later read sees changes on disk. */
function clearCatalogCache() {
	configCache.clear();
}
/**
* Catalogs declared in the nearest `pnpm-workspace.yaml`, keyed by catalog name.
* The top-level `catalog` key is exposed as {@link DEFAULT_CATALOG}.
*
* Results are memoised per workspace file, as commands such as `nuxi info` query
* dozens of dependencies in a row.
*/
function readCatalogConfig(cwd) {
	const filePath = findPnpmWorkspaceYaml(cwd);
	if (!filePath) return;
	if (configCache.has(filePath)) return configCache.get(filePath);
	const config = parseCatalogConfig(filePath);
	configCache.set(filePath, config);
	return config;
}
function parseCatalogConfig(filePath) {
	let json;
	try {
		json = parseYAML(readFileSync(filePath, "utf-8")) || {};
	} catch {
		return;
	}
	const catalogs = { ...json.catalogs };
	if (json.catalog) catalogs[DEFAULT_CATALOG] = json.catalog;
	return Object.keys(catalogs).length > 0 ? catalogs : void 0;
}
/**
* Resolve the specifier `pkg` is declared with in `pkgJson` through the project's
* catalogs. Returns `undefined` when the dependency is absent or not
* catalog-managed, so a caller can fall back to the declared specifier.
*/
function resolveCatalogEntry(cwd, pkgJson, pkg) {
	const catalog = parseCatalogSpecifier(pkgJson?.dependencies?.[pkg] || pkgJson?.devDependencies?.[pkg]);
	if (!catalog) return;
	return {
		catalog,
		specifier: readCatalogConfig(cwd)?.[catalog]?.[pkg]
	};
}
/**
* Point catalog entries at new specifiers in a single read/write of
* `pnpm-workspace.yaml`, preserving its comments, anchors and aliases.
*/
function updateCatalogEntries(cwd, updates) {
	const filePath = findPnpmWorkspaceYaml(cwd);
	if (!filePath) return "failed";
	let source;
	try {
		source = readFileSync(filePath, "utf-8");
		parseYAML(source);
	} catch {
		return "failed";
	}
	const lines = source.split("\n");
	let changed = false;
	for (const { catalog, pkg, specifier } of updates) {
		const result = setCatalogEntry(lines, catalog, pkg, specifier);
		if (result === "failed") return "failed";
		changed ||= result === "updated";
	}
	if (!changed) return "unchanged";
	try {
		writeFileSync(filePath, lines.join("\n"), "utf-8");
	} catch {
		return "failed";
	}
	configCache.delete(filePath);
	return "updated";
}
/**
* A `key:` line, split into its indentation, raw (possibly quoted) key and the
* inline value that follows. Blank lines, comments and sequence items do not match.
*/
const KEY_LINE_RE = /^(\s*)(?:(?<quote>["'])(?<quoted>(?:\\.|(?!\k<quote>).)*)\k<quote>\s*|(?<plain>[^#\s"'][^:]*)):(?<rest>.*)$/;
function parseKeyLine(line) {
	const match = line.match(KEY_LINE_RE);
	if (!match?.groups) return;
	const { quote, quoted, plain, rest } = match.groups;
	if (rest !== "" && !rest.startsWith(" ")) return;
	const key = quote ? quoted : plain.trimEnd();
	return {
		indent: match[1].length,
		key: quote ? unescapeYAMLString(key, quote) : key,
		raw: quote ? `${quote}${quoted}${quote}` : key,
		value: rest.trimStart()
	};
}
function unescapeYAMLString(value, quote) {
	return quote === "'" ? value.replaceAll("''", "'") : JSON.parse(`"${value}"`);
}
function isBlankOrComment(line) {
	const trimmed = line.trim();
	return trimmed === "" || trimmed.startsWith("#");
}
/** Split an inline value into the scalar itself and any trailing comment. */
function splitTrailingComment(value) {
	if (value.startsWith("#")) return ["", value];
	const match = value.match(/\s+#.*$/);
	if (!match) return [value, ""];
	return [value.slice(0, match.index), match[0]];
}
/**
* Rewrite (or add) `pkg: specifier` inside `catalog`, editing only the line that
* declares it so surrounding comments, anchors and formatting survive.
*/
function setCatalogEntry(lines, catalog, pkg, specifier) {
	const block = findBlock(lines, catalogPath(catalog));
	if (block === "failed") return "failed";
	if (!block) return insertCatalogBlock(lines, catalog, pkg, specifier);
	const { start, end, indent } = block;
	let entryIndent;
	let lastEntry = start;
	for (let index = start + 1; index < end; index++) {
		const line = lines[index];
		if (isBlankOrComment(line)) continue;
		const entry = parseKeyLine(line);
		if (!entry || entry.indent <= indent) return "failed";
		entryIndent ??= entry.indent;
		if (entry.indent !== entryIndent) continue;
		lastEntry = index;
		if (entry.key !== pkg) continue;
		const [scalar, comment] = splitTrailingComment(entry.value);
		const anchor = scalar.match(/^&\S+\s+/)?.[0] ?? "";
		const current = scalar.slice(anchor.length);
		if (current.startsWith("*")) return "failed";
		if (current === specifier || current === `"${specifier}"` || current === `'${specifier}'`) return "unchanged";
		lines[index] = `${" ".repeat(entry.indent)}${entry.raw}: ${anchor}${quoteYAMLScalar(specifier)}${comment}`;
		return "updated";
	}
	lines.splice(lastEntry + 1, 0, `${" ".repeat(entryIndent ?? indent + 2)}${quoteYAMLKey(pkg)}: ${quoteYAMLScalar(specifier)}`);
	return "updated";
}
function catalogPath(catalog) {
	return catalog === DEFAULT_CATALOG ? ["catalog"] : ["catalogs", catalog];
}
function findBlock(lines, path) {
	let start = -1;
	let indent = 0;
	let end = lines.length;
	for (const [depth, segment] of path.entries()) {
		const from = start + 1;
		const parentIndent = indent;
		let childIndent;
		start = -1;
		for (let index = from; index < end; index++) {
			const line = lines[index];
			if (isBlankOrComment(line)) continue;
			const key = parseKeyLine(line);
			if (!key) continue;
			if (depth === 0) {
				if (key.indent !== 0) continue;
			} else {
				if (key.indent <= parentIndent) break;
				childIndent ??= key.indent;
				if (key.indent !== childIndent) continue;
			}
			if (key.key !== segment) continue;
			if (splitTrailingComment(key.value)[0] !== "") return "failed";
			start = index;
			indent = key.indent;
			end = findBlockEnd(lines, index, indent);
			break;
		}
		if (start === -1) return;
	}
	return {
		start,
		end,
		indent
	};
}
function findBlockEnd(lines, start, indent) {
	let end = start + 1;
	for (let index = start + 1; index < lines.length; index++) {
		const line = lines[index];
		if (isBlankOrComment(line)) continue;
		if (line.search(/\S/) <= indent) break;
		end = index + 1;
	}
	return end;
}
function insertCatalogBlock(lines, catalog, pkg, specifier) {
	const entry = `${quoteYAMLKey(pkg)}: ${quoteYAMLScalar(specifier)}`;
	if (catalog === DEFAULT_CATALOG) return appendLines(lines, ["catalog:", `  ${entry}`]);
	const catalogs = findBlock(lines, ["catalogs"]);
	if (catalogs === "failed") return "failed";
	if (!catalogs) return appendLines(lines, [
		"catalogs:",
		`  ${catalog}:`,
		`    ${entry}`
	]);
	lines.splice(catalogs.end, 0, `${" ".repeat(catalogs.indent + 2)}${catalog}:`, `${" ".repeat(catalogs.indent + 4)}${entry}`);
	return "updated";
}
function appendLines(lines, toAppend) {
	while (lines.length > 0 && lines.at(-1).trim() === "") lines.pop();
	lines.push(...toAppend, "");
	return "updated";
}
const PLAIN_KEY_RE = /^[\w.][\w.\-/]*$/;
function quoteYAMLKey(key) {
	return PLAIN_KEY_RE.test(key) ? key : JSON.stringify(key);
}
function quoteYAMLScalar(value) {
	return value === "" || /^[-?:,[\]{}#&*!|>'"%@`]/.test(value) || /:\s|\s#|[\n\t]/.test(value) || value.trim() !== value ? JSON.stringify(value) : value;
}
//#endregion
export { clearCatalogCache, findPnpmWorkspaceYaml, parseCatalogSpecifier, readCatalogConfig, resolveCatalogEntry, updateCatalogEntries };
