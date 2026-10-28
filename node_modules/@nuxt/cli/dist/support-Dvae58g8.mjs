import { t as __exportAll } from "./rolldown-runtime-D7D4PA-g.mjs";
import process from "node:process";
import { isCI, isTest } from "std-env";
//#region src/dev/tui/support.ts
var support_exports = /* @__PURE__ */ __exportAll({
	resolveDevUISupport: () => resolveDevUISupport,
	supportsUnicode: () => supportsUnicode
});
/** Narrower than this and the URL block cannot be laid out at all. */
const MIN_COLUMNS = 40;
/** The status line, the hint line and a row of context are the floor. */
const MIN_ROWS = 10;
const OFF = /* @__PURE__ */ new Set([
	"0",
	"false",
	"off",
	"no",
	"plain"
]);
const ON = /* @__PURE__ */ new Set([
	"1",
	"true",
	"on",
	"yes",
	"force"
]);
/**
* Whether the interactive dev UI should run, and why not when it should not.
*
* `NUXT_TUI=1` overrides the environment checks a user may reasonably disagree
* with (CI, terminal size) but never the ones that would corrupt output: a pipe
* or a redirect still gets plain text. `NUXT_TUI=plain` opts out for good.
*/
function resolveDevUISupport(options = {}) {
	const env = options.env ?? process.env;
	const stdout = options.stdout ?? process.stdout;
	const stdin = options.stdin ?? process.stdin;
	if (options.flag === false) return {
		enabled: false,
		reason: "flag"
	};
	const setting = env.NUXT_TUI?.trim().toLowerCase();
	if (setting && OFF.has(setting)) return {
		enabled: false,
		reason: "env"
	};
	const forced = !!setting && ON.has(setting);
	if (!stdout.isTTY) return {
		enabled: false,
		reason: "no-output-tty"
	};
	if (!stdin.isTTY) return {
		enabled: false,
		reason: "no-input-tty"
	};
	if (env.TERM === "dumb") return {
		enabled: false,
		reason: "dumb-terminal"
	};
	if (options.inspect && !forced) return {
		enabled: false,
		reason: "inspector"
	};
	if (forced) return { enabled: true };
	if (options.ci ?? isCI) return {
		enabled: false,
		reason: "ci"
	};
	if (options.test ?? isTest) return {
		enabled: false,
		reason: "test"
	};
	if ((stdout.columns ?? 0) < MIN_COLUMNS || (stdout.rows ?? 0) < MIN_ROWS) return {
		enabled: false,
		reason: "terminal-too-small"
	};
	return { enabled: true };
}
/** Whether this terminal can be trusted with the box-drawing and braille glyphs. */
function supportsUnicode(env = process.env, platform = process.platform) {
	if (platform !== "win32") {
		const locale = env.LC_ALL || env.LC_CTYPE || env.LANG;
		return !locale || /utf-?8/i.test(locale);
	}
	return !!env.WT_SESSION || !!env.TERMINUS_SUBLIME || env.ConEmuTask === "{cmd::Cmder}" || env.TERM_PROGRAM === "vscode";
}
//#endregion
export { support_exports as n, supportsUnicode as r, resolveDevUISupport as t };
