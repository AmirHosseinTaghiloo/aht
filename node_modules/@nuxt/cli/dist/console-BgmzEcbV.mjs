import { t as __exportAll } from "./rolldown-runtime-D7D4PA-g.mjs";
import { T as isRemotePeerError, g as isInteractiveSession, o as useTerminalHost, r as withStartupClockPaused, s as debug, y as trackOutputSpacing } from "./startup-clock-DXZlxuSA.mjs";
import { t as tryResolveNuxt } from "./resolve-nuxt-VKCDOC-A.mjs";
import process from "node:process";
import { consola } from "consola";
import { pathToFileURL } from "node:url";
import { resolveModulePath } from "exsolve";
//#region src/utils/console.ts
var console_exports = /* @__PURE__ */ __exportAll({
	configureProjectConsola: () => configureProjectConsola,
	guardReplayedInput: () => guardReplayedInput,
	interceptPrompts: () => interceptPrompts,
	printJson: () => printJson,
	releaseStdin: () => releaseStdin,
	restoreRawMode: () => restoreRawMode,
	setupGlobalConsole: () => setupGlobalConsole,
	withDirectStdout: () => withDirectStdout
});
function wrapReporter(reporter) {
	return { log(logObj, ctx) {
		if (!logObj.args || !logObj.args.length) return;
		const msg = logObj.args[0];
		if (typeof msg === "string" && !process.env.DEBUG) {
			if (msg.startsWith("Sourcemap") && msg.includes("node_modules")) return;
		}
		return reporter.log(logObj, ctx);
	} };
}
async function configureProjectConsola(rootDir) {
	try {
		const path = resolveModulePath("consola", {
			from: tryResolveNuxt(rootDir) || rootDir,
			try: true
		});
		if (!path) return;
		const mod = await import(pathToFileURL(path).href);
		const projectConsola = mod.consola ?? mod.default;
		if (projectConsola) {
			projectConsola.options.formatOptions.date = false;
			interceptPrompts(projectConsola);
			if (projectConsola !== consola) projectConsola.setReporters([{ log(logObj, ctx) {
				for (const reporter of consola.options.reporters) reporter.log(logObj, ctx);
			} }]);
		}
	} catch (error) {
		debug("Could not configure the project consola:", error);
	}
}
function setupGlobalConsole(opts = {}) {
	consola.options.formatOptions.date = false;
	consola.options.reporters = consola.options.reporters.map(wrapReporter);
	if (opts.dev) {
		trackOutputSpacing();
		consola.wrapAll();
		interceptPrompts(consola);
	} else consola.wrapConsole();
	process.on("unhandledRejection", (err) => report("[unhandledRejection]", err));
	process.on("uncaughtException", (err) => report("[uncaughtException]", err));
}
/**
* Take `process.stdin` out of raw mode if something left it there.
*
* `@clack/core` skips restoring raw mode on Windows when a spinner or progress
* bar stops (https://github.com/bombshell-dev/clack/blob/main/packages/core/src/utils/index.ts).
* While stdin is raw the console no longer turns Ctrl-C into `SIGINT`, and
* `Enter` arrives as a bare `\r`, which `readline` never treats as end of line,
* so a long-lived command such as `nuxt dev` is left with dead Ctrl-C and dead
* keyboard shortcuts.
*/
function restoreRawMode() {
	if (!process.stdin.isTTY) return;
	if (process.stdin.isPaused()) process.stdin.resume();
	if (process.stdin.isRaw) process.stdin.setRawMode(false);
}
/**
* Guard a newly attached stdin reader against input it did not see typed: a
* terminal buffers keystrokes while nothing is reading and hands the whole run
* over in the first read once a reader resumes stdin. Anything arriving in a
* later read was typed while the reader was listening.
*
* Returns whether the input being handled is part of that replay.
*/
function guardReplayedInput() {
	let replaying = true;
	setImmediate(() => {
		replaying = false;
	}).unref?.();
	return () => replaying;
}
/**
* Give up `process.stdin` after a prompt in a command that is about to finish.
*
* A resumed stdin is an active handle, so a one-shot command would otherwise sit
* there with nothing left to do until the terminal closes.
*/
function releaseStdin() {
	restoreRawMode();
	if (!process.stdin.isTTY) return;
	process.stdin.pause();
	process.stdin.unref();
}
/**
* Run `fn` with `process.stdout` and `process.stderr` writing straight to the
* terminal again.
*
* `consola.wrapAll()` swaps `stream.write` for a call that trims each chunk and
* logs it as a line of its own. That is fine for stray `console.log`s, but it
* breaks anything that positions the cursor itself: clack redraws a frame with
* several small writes (a cursor move, an erase, the new lines) and every one of
* them would come back with a newline attached, so each keypress pushes the
* prompt further down the screen.
*/
async function withDirectStdout(fn) {
	const wrapped = process.stdout;
	if (!wrapped.__write || wrapped.write === wrapped.__write) return fn();
	consola.restoreStd();
	try {
		return await fn();
	} finally {
		consola.wrapStd();
	}
}
function printJson(value) {
	return withDirectStdout(() => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`));
}
/** Resolves once the prompt currently on screen, if any, has been answered. */
let promptQueue = Promise.resolve();
const wrappedPrompts = /* @__PURE__ */ new WeakSet();
/**
* Ask `instance`'s questions on a terminal they can be read and answered on.
*
* A question raised from inside the dev server, such as a module asking to
* install itself, arrives long after the CLI's own prompts are done with the
* terminal: the interactive UI is folding output away into its log view and
* holding stdin for its shortcuts, so the question would be filed away as a
* log and the keystroke meant for it taken as a shortcut. When a terminal
* host is published the question is asked inside its `withTerminal`, and
* through {@link withDirectStdout} like the CLI's own prompts either way.
*
* Prompts are serialised, since two of them redrawing over each other can be
* neither read nor answered.
*/
function interceptPrompts(instance) {
	const prompt = instance.options.prompt;
	if (!prompt || wrappedPrompts.has(prompt)) return;
	const wrapped = ((message, opts = {}) => {
		if (!isInteractiveSession()) {
			debug(`Not asking, with no terminal to answer on: ${message}`);
			return Promise.resolve(declinedAnswer(opts));
		}
		const answer = promptQueue.then(() => withStartupClockPaused(() => {
			const ask = () => withDirectStdout(() => prompt(message, opts));
			const host = useTerminalHost();
			return host ? host.withTerminal(ask) : ask();
		}));
		promptQueue = answer.catch(() => {});
		return answer;
	});
	wrappedPrompts.add(wrapped);
	instance.options.prompt = wrapped;
}
/** What a question that could not be asked answers: whatever changes nothing. */
function declinedAnswer(opts = {}) {
	return opts.type === "confirm" ? false : void 0;
}
function report(label, error) {
	if (isRemotePeerError(error)) {
		debug(`${label} ignoring remote peer error:`, error);
		return;
	}
	consola.error(label, error);
}
//#endregion
export { releaseStdin as a, withDirectStdout as c, printJson as i, console_exports as n, restoreRawMode as o, guardReplayedInput as r, setupGlobalConsole as s, configureProjectConsola as t };
