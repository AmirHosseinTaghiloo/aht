import { u as logger } from "./startup-clock-DXZlxuSA.mjs";
import { t as summariseActiveResources } from "./hang-DvJGbBHh.mjs";
import process from "node:process";
//#region src/dev/shutdown.ts
/**
* How long a dev server process is given to run its `close` hooks. Nitro plugins
* use these to close database connections and the like, so anything that signals
* a dev server has to allow for them before escalating.
*/
const DEV_SHUTDOWN_TIMEOUT_MS = 1e4;
/**
* How long the process supervising a dev server waits for it to go away. Longer
* than the budget above, since the fork spends that budget before exiting.
*/
const SUPERVISOR_SHUTDOWN_TIMEOUT_MS = 15e3;
/** How long a signalled process has to disappear before we give up on it. */
const FORCE_KILL_TIMEOUT_MS = 2e3;
let adopted = false;
/** Whether the dev command has taken interrupts over from the panel's stop-gap. */
function isShutdownAdopted() {
	return adopted;
}
/**
* Hand interrupts to the command's own handlers.
*
* The panel is on screen long before the command can shut a dev server down,
* and listening for `SIGINT` at all suppresses the default exit, so until this
* is called the session ends the process itself.
*/
function adoptShutdown() {
	adopted = true;
}
const SHUTDOWN_NOTICE_MS = 1500;
/**
* Shut the dev server down on `SIGINT`/`SIGTERM`, which any listener (dev UI,
* profiler) otherwise stops from exiting. A second Ctrl-C skips the graceful wait.
*/
function handleShutdownSignals(close) {
	adoptShutdown();
	let closing = false;
	for (const signal of [
		"SIGINT",
		"SIGTERM",
		"SIGQUIT"
	]) process.on(signal, () => {
		if (closing) process.exit(130);
		closing = true;
		const deadline = setTimeout(() => {
			const summary = summariseActiveResources();
			logger.warn(`The dev server did not shut down within ${SUPERVISOR_SHUTDOWN_TIMEOUT_MS / 1e3}s${summary ? `: ${summary}` : ""}. Exiting anyway.`);
			process.exit();
		}, SUPERVISOR_SHUTDOWN_TIMEOUT_MS);
		import("./spinner-Cj-5sQW4.mjs").then((n) => n.n).then(({ withSpinner }) => withSpinner("Cleaning up", async (indicator) => {
			const notice = setTimeout(() => {
				indicator.update("Cleaning up... press Ctrl-C again to exit immediately");
			}, SHUTDOWN_NOTICE_MS);
			notice.unref?.();
			try {
				await close();
			} catch (error) {
				console.error(error);
				process.exitCode = 1;
			} finally {
				clearTimeout(notice);
				clearTimeout(deadline);
			}
		}, { done: "Stopped the dev server" })).finally(() => {
			process.exit();
		});
	});
}
//#endregion
export { isShutdownAdopted as i, FORCE_KILL_TIMEOUT_MS as n, handleShutdownSignals as r, DEV_SHUTDOWN_TIMEOUT_MS as t };
