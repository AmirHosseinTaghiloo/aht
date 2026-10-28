import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
//#region src/supports.ts
function parseVersion(value) {
	const packed = value && /^\d{3,4}$/.test(value) ? /(\d{1,2})(\d{2})/.exec(value) : void 0;
	if (packed) return {
		major: 0,
		minor: Number(packed[1])
	};
	const [major, minor] = (value ?? "").split(".").map((part) => Number.parseInt(part, 10));
	return {
		major: major || 0,
		minor: minor || 0
	};
}
function atLeast(version, major, minor) {
	return version.major > major || version.major === major && version.minor >= minor;
}
function truthy(value) {
	return value !== void 0 && value !== "" && value !== "0" && value !== "false";
}
/**
* Whether hyperlinks should be emitted for `stream` (defaulting to `process.stdout`).
*
* Evaluated on every call: environment and TTY state can both change during the
* lifetime of a long-running process.
*/
function supportsHyperlinks(stream = process.stdout) {
	const env = process.env;
	if (env.FORCE_HYPERLINK !== void 0) return truthy(env.FORCE_HYPERLINK);
	if (truthy(env.NETLIFY)) return true;
	if (env.NO_COLOR !== void 0 && env.NO_COLOR !== "") return false;
	if (truthy(env.NO_HYPERLINK) || truthy(env.NO_HYPERLINKS)) return false;
	if (stream && stream.isTTY !== true) return false;
	if (env.WT_SESSION) return true;
	if (process.platform === "win32") return false;
	if (truthy(env.CI) || env.TEAMCITY_VERSION) return false;
	const termProgram = env.TERM_PROGRAM;
	const termProgramVersion = env.TERM_PROGRAM_VERSION;
	if (termProgram) {
		const version = parseVersion(termProgramVersion);
		switch (termProgram) {
			case "iTerm.app": return atLeast(version, 3, 1);
			case "WezTerm": {
				const unstable = /^0-unstable-(\d{4}-\d{2}-\d{2})$/.exec(termProgramVersion ?? "");
				if (unstable?.[1]) return unstable[1] >= "2020-06-20";
				return version.major >= 20200620;
			}
			case "tmux": return atLeast(version, 3, 4);
			case "vscode": return env.CURSOR_TRACE_ID ? true : atLeast(version, 1, 72);
			case "ghostty":
			case "zed":
			case "rio":
			case "Tabby":
			case "WarpTerminal":
			case "Orca": return true;
			case "Apple_Terminal": return false;
		}
	}
	if (env.VTE_VERSION) {
		if (env.VTE_VERSION === "0.50.0") return false;
		return atLeast(parseVersion(env.VTE_VERSION), 0, 50);
	}
	switch (env.TERM) {
		case "xterm-kitty":
		case "xterm-ghostty":
		case "alacritty": return true;
	}
	return false;
}
//#endregion
//#region src/index.ts
const OSC = "\x1B]";
const BEL = "\x07";
/** Windows drive-letter or UNC path, in either separator style. */
const WINDOWS_PATH_RE = /^(?:[a-z]:|[\\/]{2}[^\\/])/i;
/**
* Resolve `target` against `cwd` in whichever separator style they are written
* in, so a CLI can link paths it received from elsewhere (logs, config, a
* Windows machine's output) regardless of the platform it is running on.
*/
function resolve(target, cwd) {
	const windows = WINDOWS_PATH_RE.test(target) || WINDOWS_PATH_RE.test(cwd);
	const { resolve, relative } = windows ? path.win32 : path.posix;
	const absolute = resolve(cwd, target);
	return {
		absolute,
		relative: relative(cwd, absolute) || ".",
		url: pathToFileURL(absolute, { windows }).href.replace(/:\/\/$/, ":/")
	};
}
/**
* The `:12:3` label suffix and the `#L12,3` URL fragment for a line and column.
*
* The fragment is an editor jump-to-line hint; terminals that do not understand
* it just open the file. The comma is what VS Code's `extractSelection` parses
* (`/^L?(\d+)(?:,(\d+))?/`), and a colon there silently drops the column.
*/
function position({ line, column }) {
	if (line === void 0) return ["", ""];
	return column === void 0 ? [`:${line}`, `#L${line}`] : [`:${line}:${column}`, `#L${line},${column}`];
}
/**
* Wrap `target` in an OSC 8 hyperlink pointing at it on disk, labelled by
* `options.formatter` or, by default, with its `cwd`-relative path and a
* `:<line>:<column>` suffix.
*
* The label is emitted byte-for-byte; only invisible escapes are added. When the
* terminal does not support hyperlinks the label is returned on its own.
*/
function link(target, options = {}) {
	const { absolute, relative, url } = resolve(target, options.cwd ?? process.cwd());
	const [suffix, fragment] = position(options);
	return hyperlink(options.formatter?.(absolute, options.line, options.column) ?? relative + suffix, url + fragment, options);
}
/**
* Wrap `label` in an OSC 8 hyperlink pointing at `url`, which is used as the
* link target verbatim: no path resolution and no `file://` conversion.
*
* The label is emitted byte-for-byte, so a label that already contains colour
* escapes is passed through untouched. When the terminal does not support
* hyperlinks the label is returned on its own.
*/
function hyperlink(label, url, options = {}) {
	if (!(options.enabled ?? supportsHyperlinks(options.stream))) return label;
	const params = options.id === void 0 ? "" : `id=${options.id}`;
	return `${OSC}8;${params};${url}${BEL}${label}${OSC}8;;${BEL}`;
}
/**
* Create a `link` with `defaults` pre-applied, so a CLI can configure its own
* aliasing (`~/nuxt.config.ts`) and cwd once rather than at every call site.
*/
function createLinker(defaults = {}) {
	return { link: (target, options = {}) => link(target, {
		...defaults,
		...options
	}) };
}
//#endregion
export { createLinker, hyperlink, link, supportsHyperlinks };
