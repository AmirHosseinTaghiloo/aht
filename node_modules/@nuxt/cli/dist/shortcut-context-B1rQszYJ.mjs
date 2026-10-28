//#region src/dev/shortcut-context.ts
/**
* A context for shortcuts bound before the dev server exists, so the keyboard
* answers from the first frame. {@link ShortcutContext.listener} is undefined
* until {@link DeferredShortcutContext.attach}, and ready callbacks registered
* before then are forwarded to the server when it arrives.
*/
function deferShortcutContext(options = {}) {
	let server;
	let closing;
	let clearCaches = options.clearCaches;
	const pendingReady = [];
	return {
		context: {
			get clearCaches() {
				return clearCaches;
			},
			get listener() {
				return server?.listener;
			},
			get restart() {
				return server?.restart;
			},
			close: () => closing ??= server?.close() ?? Promise.resolve(),
			onReady: (callback) => {
				if (server) server.onReady(callback);
				else pendingReady.push(callback);
			}
		},
		attach: (started) => {
			if (closing) {
				closing = closing.then(() => started.close());
				return;
			}
			server = started;
			for (const callback of pendingReady.splice(0)) started.onReady(callback);
		},
		provide: (next) => {
			clearCaches = next.clearCaches ?? clearCaches;
		}
	};
}
let shared;
/** The context this process's dev shortcuts act through, shared by the entry and the command. */
function devShortcutContext() {
	return shared ??= deferShortcutContext();
}
//#endregion
export { devShortcutContext };
