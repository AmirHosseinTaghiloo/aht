import { t as __exportAll } from "./rolldown-runtime-D7D4PA-g.mjs";
import { o as useTerminalHost, u as logger } from "./startup-clock-DXZlxuSA.mjs";
import { c as withDirectStdout, o as restoreRawMode } from "./console-BgmzEcbV.mjs";
import process from "node:process";
import { isCI } from "std-env";
import { spinner } from "@clack/prompts";
//#region src/utils/spinner.ts
var spinner_exports = /* @__PURE__ */ __exportAll({
	createSpinner: () => createSpinner,
	withSpinner: () => withSpinner
});
/**
* Run `fn` with a spinner it can relabel as it goes, so work that takes a while
* says what it is doing. Stopped with `options.done`, or silently, once `fn`
* settles.
*
* Without a TTY or in CI, each message is logged once as a plain line.
*/
async function withSpinner(message, fn, options = {}) {
	let done = options.done;
	const setDone = (text) => {
		done = text;
	};
	const indicator = createSpinner();
	const run = async () => {
		indicator.start(message);
		try {
			const result = await fn({
				update: (text) => indicator.message(text),
				done: setDone
			});
			indicator.stop(done);
			return result;
		} catch (error) {
			indicator.error();
			throw error;
		} finally {
			restoreRawMode();
		}
	};
	return useTerminalHost() ? run() : withDirectStdout(run);
}
/**
* A clack spinner, unless something else owns the terminal.
*
* `module add` also runs inside `nuxt dev` (a module asking to install itself
* imports the project's `@nuxt/cli` and runs it in-process), where a spinner
* animating frames into the stream would be captured into the dev UI's log
* history one frame at a time. With a terminal host published, the work is
* reported as a task on the host's own status line instead.
*
* Without a TTY or in CI, each distinct message is logged once as a plain line.
*
* A host implies an interactive terminal, so cancellation stays with its key
* handling: `onCancel` only fires on the clack path.
*/
function createSpinner(options = {}) {
	const host = useTerminalHost();
	if (!host) {
		if (!process.stdout.isTTY || isCI) return createPlainSpinner();
		return spinner(options);
	}
	let task;
	return {
		start: (message) => task ??= host.startTask(message),
		message: (text) => task?.update(text),
		stop: (message) => {
			task?.stop(message, "success");
			task = void 0;
		},
		error: (message) => {
			task?.stop(message, "failure");
			task = void 0;
		}
	};
}
function createPlainSpinner() {
	let last;
	const log = (text) => {
		if (text !== last) {
			last = text;
			logger.info(`${text}...`);
		}
	};
	const finish = (report) => (message) => {
		if (message) report(message);
		last = void 0;
	};
	return {
		start: log,
		message: log,
		stop: finish((message) => logger.success(message)),
		error: finish((message) => logger.error(message))
	};
}
//#endregion
export { spinner_exports as n, withSpinner as r, createSpinner as t };
