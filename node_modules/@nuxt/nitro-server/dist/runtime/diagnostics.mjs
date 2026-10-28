import { createConsoleReporter, defineDiagnostics } from "nostics";
import { ansiFormatter } from "nostics/formatters/ansi";
//#region src/runtime/diagnostics.ts
const ansi = (open, close) => (s) => `\x1B[${open}m${s}\x1B[${close}m`;
const colors = {
	red: ansi(31, 39),
	yellow: ansi(33, 39),
	cyan: ansi(36, 39),
	gray: ansi(90, 39),
	bold: ansi(1, 22),
	dim: ansi(2, 22)
};
/**
* E8xxx
* Nitro server runtime (dev server) diagnostics, sharing the range with the
* SSR renderer.
*/
const docsBase = (code) => `https://nuxt.com/docs/4.x/errors/${code.replace("NUXT_", "").toLowerCase()}`;
const serverDiagnostics = /* #__PURE__ */ defineDiagnostics({
	docsBase,
	reporters: [/* @__PURE__ */ createConsoleReporter(import.meta.dev && process.env.NODE_ENV !== "test" ? { formatter: ansiFormatter(colors) } : void 0)],
	codes: {
		NUXT_E8003: {
			why: (p) => `Failed to stringify dev server logs.${p.error ? ` Received \`${p.error}\`.` : ""}`,
			fix: "You can define your own reducer/reviver for rich types following the instructions in `https://nuxt.com/docs/4.x/api/composables/use-nuxt-app#payload`.",
			docs: false
		},
		NUXT_E8005: {
			why: "Island props cannot contain a `template` key, which the Vue runtime compiler would compile and execute.",
			fix: "Rename the prop (e.g. `templateName`), or disable `vue.runtimeCompiler` if you do not need runtime template compilation.",
			docs: false
		},
		NUXT_E8012: {
			why: (p) => `\`${p.helper}\` from \`nuxt/server\` was called with an h3 event. The handler was defined with h3's \`defineEventHandler\` (auto-imported), which passes a different event.`,
			fix: "Import `defineEventHandler` from `nuxt/server` alongside the helpers. See `https://nuxt.com/docs/4.x/getting-started/upgrade#moving-to-nuxtserver`.",
			docs: false
		}
	}
});
//#endregion
export { serverDiagnostics };
