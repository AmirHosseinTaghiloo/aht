//#region src/report/path.ts
const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i;
const WINDOWS_DRIVE_RE = /^\/?[a-z]:[\\/]/i;
/** Convert a `file:` URL to a filesystem path. Other inputs are returned unchanged. */
function toPath(source) {
	if (!source.startsWith("file:")) return source;
	let rest = source.slice(5).replace(/^\/\//, "");
	if (rest.startsWith("/")) {
		rest = safeDecode(rest);
		return WINDOWS_DRIVE_RE.test(rest) ? rest.slice(1) : rest;
	}
	return `//${safeDecode(rest)}`;
}
function safeDecode(value) {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}
function hasScheme(source) {
	return SCHEME_RE.test(source) && !WINDOWS_DRIVE_RE.test(`/${source}`);
}
function isFilePath(source) {
	return source.startsWith("/") || WINDOWS_DRIVE_RE.test(`/${source}`) || source.startsWith("\\\\");
}
/** Drop cache-busting query params but keep semantically meaningful ones. */
function stripCacheQuery(source) {
	const index = source.indexOf("?");
	if (index === -1) return source;
	const params = source.slice(index + 1).split("&").filter((param) => !/^(?:t|v|import)(?:=|$)/.test(param));
	return params.length ? `${source.slice(0, index)}?${params.join("&")}` : source.slice(0, index);
}
function withoutQuery(source) {
	const index = source.indexOf("?");
	return index === -1 ? source : source.slice(0, index);
}
function normalizeSlashes(path) {
	return path.replace(/\\/g, "/");
}
function relativeToCwd(file, cwd) {
	const normalizedCwd = normalizeSlashes(cwd).replace(/\/$/, "");
	const normalizedFile = normalizeSlashes(file);
	if (normalizedFile === normalizedCwd) return ".";
	if (normalizedFile.startsWith(`${normalizedCwd}/`)) return `./${normalizedFile.slice(normalizedCwd.length + 1)}`;
	return file;
}
/**
* Path as shown to the user: the `displayFile` resolved when the report was
* built, else relative to `cwd`, or the part after the last `node_modules/`.
*/
function displayPath(target, cwd) {
	if (typeof target !== "string") return target.displayFile ?? (target.file ? displayPath(target.file, cwd) : "");
	const file = target;
	const normalized = normalizeSlashes(file);
	const index = normalized.lastIndexOf("/node_modules/");
	if (index !== -1) return `…/${normalized.slice(index + 14)}`;
	return cwd ? relativeToCwd(file, cwd).replace(/^\.\//, "") : file;
}
function dirname(path) {
	const normalized = normalizeSlashes(path);
	const index = normalized.lastIndexOf("/");
	return index <= 0 ? index === 0 ? "/" : "." : normalized.slice(0, index);
}
function resolvePath(base, target) {
	if (hasScheme(target) || isFilePath(target)) return toPath(target);
	const segments = normalizeSlashes(base).split("/");
	for (const part of normalizeSlashes(target).split("/")) if (part === "..") segments.pop();
	else if (part !== "." && part !== "") segments.push(part);
	return segments.join("/");
}
function extname(path) {
	const base = withoutQuery(normalizeSlashes(path)).split("/").pop() || "";
	const index = base.lastIndexOf(".");
	return index > 0 ? base.slice(index + 1).toLowerCase() : "";
}
const LANGS = {
	ts: "ts",
	mts: "ts",
	cts: "ts",
	tsx: "tsx",
	js: "js",
	mjs: "js",
	cjs: "js",
	jsx: "jsx",
	vue: "vue",
	html: "html",
	css: "css",
	scss: "css",
	sass: "css",
	less: "css",
	json: "json",
	md: "md"
};
function langFromFile(file) {
	return LANGS[extname(file)];
}
//#endregion
export { langFromFile as a, resolvePath as c, withoutQuery as d, isFilePath as i, stripCacheQuery as l, displayPath as n, normalizeSlashes as o, hasScheme as r, relativeToCwd as s, dirname as t, toPath as u };
