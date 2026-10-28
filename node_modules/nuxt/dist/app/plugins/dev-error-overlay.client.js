import { defineNuxtPlugin } from "../nuxt.js";
import { THROWN_VALUE, isNuxtError } from "../error.js";
import "../composables/error.js";
//#region src/app/plugins/dev-error-overlay.client.ts
/** Shows the development error overlay on a page that is already open. */
var dev_error_overlay_client_default = /* @__PURE__ */ defineNuxtPlugin({
	name: "nuxt:dev-error-overlay",
	setup(nuxtApp) {
		const hot = import.meta.hot;
		if (!hot || import.meta.test) return;
		let reloadOnClear = false;
		const hasOverlay = () => !!document.querySelector("[data-nuxt-dev-error], nuxt-error-overlay");
		const remove = () => {
			for (const node of document.querySelectorAll("[data-nuxt-dev-error]")) node.remove();
		};
		hot.on("nuxt:dev:error", ({ url, reloadOnClear: reload }) => {
			reloadOnClear = !!reload;
			if (hasOverlay()) return;
			mount(url).catch(() => {});
		});
		hot.on("nuxt:dev:error:clear", () => {
			remove();
			if (reloadOnClear || nuxtApp.payload.error) {
				reloadOnClear = false;
				window.location.reload();
			}
		});
		hot.send("nuxt:dev:error:ready");
		const reportedObjects = /* @__PURE__ */ new WeakSet();
		const reportedValues = /* @__PURE__ */ new Set();
		let mounted = false;
		nuxtApp.hook("app:mounted", () => {
			mounted = true;
		});
		const report = (error, fatal) => {
			if (isExpected(error)) return;
			const raw = unwrap(error);
			const reported = typeof raw === "object" && raw !== null ? reportedObjects : reportedValues;
			if (raw === void 0 || reported.has(raw)) return;
			reported.add(raw);
			hot.send("nuxt:dev:client-error", {
				...raw instanceof Error ? {
					name: raw.name,
					message: raw.message,
					stack: raw.stack
				} : {
					name: "Error",
					message: `Thrown value: ${describe(raw)}`
				},
				fatal: fatal || !mounted
			});
		};
		nuxtApp.hook("vue:error", (error) => report(error, isNuxtError(error) && !!(error.fatal || error.unhandled)));
		nuxtApp.hook("app:error", (error) => report(error, true));
		window.addEventListener("error", (event) => {
			if (event.error === null && !event.lineno) return;
			report(event.error, false);
		});
		window.addEventListener("unhandledrejection", (event) => report(event.reason, false));
		if (nuxtApp.payload.error) hot.send("nuxt:dev:error:shown", { since: performance.timeOrigin });
		nuxtApp.hook("page:finish", () => {
			if (!nuxtApp.payload.error) {
				reloadOnClear = false;
				remove();
			}
		});
		async function mount(url) {
			const html = await fetch(url).then((res) => res.ok ? res.text() : void 0);
			if (!html || hasOverlay()) return;
			const template = document.createElement("template");
			template.innerHTML = html;
			for (const node of [...template.content.children]) {
				const mounted = node.tagName === "SCRIPT" ? document.createElement("script") : node;
				if (mounted !== node) {
					for (const attribute of node.attributes) mounted.setAttribute(attribute.name, attribute.value);
					mounted.textContent = node.textContent;
				}
				mounted.setAttribute("data-nuxt-dev-error", "");
				document.body.append(mounted);
			}
		}
	}
});
function describe(value) {
	try {
		return typeof value === "string" ? value : JSON.stringify(value) ?? String(value);
	} catch {
		return String(value);
	}
}
/** A handled client error (a 404, a failed validation) is the app working as intended. */
function isExpected(error) {
	return isNuxtError(error) && !error.unhandled && (error.status || 500) < 500 && !(THROWN_VALUE in error);
}
/** The error as it was thrown: a `NuxtError` wrapper carries the wrapping code's stack. */
function unwrap(error) {
	if (isNuxtError(error)) return error.cause instanceof Error ? error.cause : THROWN_VALUE in error ? error[THROWN_VALUE] : error;
	return error;
}
//#endregion
export { dev_error_overlay_client_default as default };
