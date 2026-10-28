//#region src/dev/tui/controller.ts
/** What the plain fallback answers to everything the UI would have shown. */
const NOOP_CONTROLLER = {
	interactive: false,
	setStatus: () => {},
	settleRestart: () => {},
	pushServerLog: () => {},
	pushRequests: () => {},
	pushSpans: () => {},
	pushReport: () => {},
	clearReport: () => {},
	setRoutes: () => {},
	setRendering: () => {}
};
/**
* Take the terminal, if this one can host the UI.
*
* Nothing behind this module is loaded until a panel is actually going to be
* painted: `nuxt dev --help` never gets that far, and a plain session has no
* use for the panel, the views, the update check or the version lookup.
*/
async function beginDevUI(options = {}) {
	const { resolveDevUISupport } = await import("./support-Dvae58g8.mjs").then((n) => n.n);
	if (options.enabled === false || !resolveDevUISupport(options).enabled) return;
	const { beginDevUI } = await import("./session-DCdLW1mF.mjs");
	return beginDevUI(options);
}
/** Give the terminal back, so something else can report on a clean screen. */
async function teardownDevUI() {
	const { teardownDevUI } = await import("./session-DCdLW1mF.mjs");
	teardownDevUI();
}
/** The interactive controller, or the line-based shortcuts and a no-op. */
async function setupDevUI(context, options = {}) {
	if (options.enabled === false) {
		const { setupShortcuts } = await import("./shortcuts-Dh7e3ttO.mjs");
		setupShortcuts(context);
		return NOOP_CONTROLLER;
	}
	const { setupDevUI } = await import("./tui-BXjHuiqA.mjs");
	return setupDevUI(context, options);
}
//#endregion
export { NOOP_CONTROLLER, beginDevUI, setupDevUI, teardownDevUI };
