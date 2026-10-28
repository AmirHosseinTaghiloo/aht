import { u as toPath } from "../path-BUhlDN52.mjs";
import process from "node:process";
//#region src/presets/env.ts
/** Adds a collapsed `Environment` section with runtime and package versions. */
function envPreset(options = {}) {
	return { plugins: [{
		name: "env",
		transform(report) {
			if (report.sections.some((section) => section.id === "env")) return;
			const content = {
				"runtime": typeof Bun !== "undefined" ? `bun ${Bun.version}` : typeof Deno !== "undefined" ? `deno ${Deno.version.deno}` : `node ${process.versions?.node ?? "unknown"}`,
				"my-bad": "0.2.11"
			};
			for (const [name, value] of Object.entries(options.versions ?? {})) if (value) content[name] = value;
			report.sections.push({
				id: "env",
				title: "Environment",
				content,
				collapsed: true
			});
		}
	}] };
}
//#endregion
//#region src/presets/h3.ts
const DEFAULT_REDACT = [
	"cookie",
	"set-cookie",
	"authorization",
	"proxy-authorization",
	"x-api-key"
];
function headerEntries(headers) {
	if (!headers) return [];
	if (typeof headers.forEach === "function" && typeof headers.get === "function") {
		const out = [];
		headers.forEach((value, key) => out.push([key, value]));
		return out;
	}
	if (Symbol.iterator in new Object(headers)) return [...headers];
	return Object.entries(headers).filter((entry) => entry[1] !== void 0).map(([key, value]) => [key, Array.isArray(value) ? value.join(", ") : value]);
}
/** Extract a request-like object from an h3 v1/v2 event, a Fetch `Request`, or a Node `IncomingMessage`. */
function requestFromContext(context) {
	const event = context.event;
	const direct = context.request ?? context.req;
	if (direct) return direct;
	if (event?.req && (event.req.headers || event.req.url)) return event.req;
	if (event?.node?.req) return event.node.req;
	if (event?.path) return {
		method: event.method,
		url: event.path
	};
}
/** Adds `Request` and `Headers` sections from `context.event`, `context.request` or `context.req`. */
function requestPreset(options = {}) {
	const redact = /* @__PURE__ */ new Set([...DEFAULT_REDACT, ...(options.redact ?? []).map((name) => name.toLowerCase())]);
	return { plugins: [{
		name: "request",
		transform(report, ctx) {
			if (report.sections.some((section) => section.id === "request")) return;
			const request = requestFromContext(ctx.options.context);
			if (!request) return;
			const url = request.url ? request.url.startsWith("/") ? request.url : safeUrl(request.url) : void 0;
			const summary = {};
			if (request.method) summary.method = request.method;
			if (url) summary.url = url;
			if (report.status) summary.status = report.status;
			const sections = [{
				id: "request",
				title: "Request",
				content: summary
			}];
			if (options.headers !== false) {
				const headers = {};
				for (const [key, value] of headerEntries(request.headers)) headers[key.toLowerCase()] = redact.has(key.toLowerCase()) ? "[redacted]" : value;
				if (Object.keys(headers).length) sections.push({
					id: "headers",
					title: "Headers",
					content: headers,
					collapsed: true
				});
			}
			report.sections.unshift(...sections);
		}
	}] };
}
function safeUrl(url) {
	try {
		const parsed = new URL(url);
		return `${parsed.pathname}${parsed.search}`;
	} catch {
		return url;
	}
}
/** Alias of `requestPreset` with Nitro/h3 runtime frames marked internal. */
function nitroPreset(options = {}) {
	return {
		...requestPreset(options),
		internal: [
			/\/node_modules\/(?:nitro|nitropack|h3|nitro-server|@nitro)\//,
			/^(?:nitro|nitropack|h3|nitro-server|@nitro\/[^/]+)$/,
			/\/\.output\/server\/(?:chunks\/(?:nitro|_)|index\.mjs)/,
			/\/\.nitro\//
		]
	};
}
//#endregion
//#region src/presets/vue.ts
const TRACE_LINE_RE = /^\s*at\s+<([^\s>]+)(?:\s[^>]*)?>\s*$/;
/** Parse the `trace` string Vue passes to `app.config.warnHandler`. */
function parseVueTrace(trace) {
	const entries = [];
	for (const line of trace.split("\n")) {
		const name = TRACE_LINE_RE.exec(line)?.[1];
		if (name) entries.push({ label: `<${name}>` });
	}
	return entries.reverse();
}
/** Build a component trace from a Vue component instance (`getCurrentInstance()` or the `instance` argument of `errorHandler`). */
function traceFromInstance(instance) {
	const entries = [];
	let current = instance?.$ ?? instance;
	let guard = 0;
	while (current && guard++ < 100) {
		const type = current.type;
		const file = type?.__file ? toPath(type.__file) : void 0;
		const name = type?.__name ?? type?.name ?? (file ? file.split(/[\\/]/).pop().replace(/\.\w+$/, "") : "Anonymous");
		entries.push({
			label: `<${name}>`,
			...file && { file }
		});
		current = current.parent;
	}
	return entries.reverse();
}
/**
* Vue support: component traces from `context.instance` or `context.trace`,
* Vue runtime frames marked as internal.
*/
function vuePreset(options = {}) {
	return {
		internal: [
			/\/node_modules\/(?:@vue|vue)\//,
			/^(?:vue|@vue\/[^/]+)$/,
			/\/@vue\/(?:runtime|reactivity|shared|server-renderer|compiler)/,
			...options.internal ?? []
		],
		plugins: [{
			name: "vue",
			transform(report, ctx) {
				if (report.trace?.length) return;
				const { instance, trace } = ctx.options.context;
				const inputTrace = ctx.input?.vueTrace;
				if (instance) report.trace = traceFromInstance(instance);
				else if (typeof trace === "string" || typeof inputTrace === "string") report.trace = parseVueTrace(trace ?? inputTrace);
				if (report.trace && !report.trace.length) delete report.trace;
			}
		}]
	};
}
//#endregion
//#region src/presets/nuxt.ts
const NUXT_CODE_RE = /^(?:NUXT_)?(?<code>[BE]\d{4})$/i;
/**
* Nuxt support: error codes linked to docs, Nuxt/Nitro/Vue internals collapsed,
* request and route sections, and Vue component traces.
*/
function nuxtPreset(options = {}) {
	const docsBase = (options.docsBase ?? "https://nuxt.com/docs/errors/").replace(/\/?$/, "/");
	const parts = [
		vuePreset(),
		nitroPreset({ redact: options.redact }),
		envPreset({ versions: options.versions })
	];
	return {
		internal: [
			/\/node_modules\/(?:nuxt|@nuxt|nuxt-nightly|@nuxt\/[^/]+|unctx|hookable|ofetch|vue-router)\//,
			/^(?:nuxt|nuxt-nightly|unctx|hookable|ofetch|vue-router|@nuxt\/[^/]+)$/,
			/\/\.nuxt\/(?:dev\/|dist\/server\/)/,
			/#app\//,
			/^(?:callWithNuxt|applyPlugin|applyPlugins|executeAsync|runWithContext|callAsync|createError|showError)$/,
			...parts.flatMap((part) => part.internal ?? [])
		],
		plugins: [...parts.flatMap((part) => part.plugins ?? []), {
			name: "nuxt",
			transform(report, ctx) {
				const visit = (node) => {
					const code = node.code && !node.docsUrl && !node.diagnostic ? NUXT_CODE_RE.exec(node.code)?.groups?.code : void 0;
					if (code) node.docsUrl = `${docsBase}${code.toLowerCase()}`;
					node.causes.forEach(visit);
					node.errors?.forEach(visit);
				};
				visit(report);
				const route = ctx.options.context.route;
				if (route && !report.sections.some((section) => section.id === "route")) {
					const content = {};
					if (route.fullPath ?? route.path) content.path = route.fullPath ?? route.path;
					if (route.name) content.name = String(route.name);
					if (route.matched?.length) content.matched = route.matched.map((record) => String(record.name ?? record.path)).join(" › ");
					const layout = route.meta?.layout;
					if (layout) content.layout = String(layout);
					const middleware = route.meta?.middleware;
					if (Array.isArray(middleware) && middleware.length) content.middleware = middleware.map((item) => typeof item === "string" ? item : item.name ?? "[fn]").join(", ");
					const index = report.sections.findIndex((section) => section.id === "headers" || section.id === "env");
					report.sections.splice(index === -1 ? report.sections.length : index, 0, {
						id: "route",
						title: "Route",
						content
					});
				}
			}
		}]
	};
}
const NUXT_LIGHT = [`:root[data-theme='light']`, `:host([data-theme='light'])`];
const inLight = (selector) => NUXT_LIGHT.map((scheme) => `${scheme} ${selector}`).join(",");
/**
* Nuxt brand for `renderPage` / `renderOverlay`, following https://nuxt.com/design.md:
* green accent on neutral surfaces, Outfit headings and Inter body when installed, and
* the icon lockup in the header.
*/
const nuxtTheme = {
	name: "Nuxt",
	url: "https://nuxt.com",
	accent: "#00dc82",
	vars: {
		"--mb-bg": "#0a0a0a",
		"--mb-fg": "#ffffff",
		"--mb-font-sans": `'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
		"--mb-font-display": `'Outfit', var(--mb-font-sans)`
	},
	css: [
		`.mb-brand svg{color:var(--mb-accent)}`,
		`.mb-message{font-weight:500}`,
		`${NUXT_LIGHT.join(",")}{--mb-fg:#171717;--mb-accent-ink:#007f45;--mb-shadow:0 24px 64px -24px rgb(0 0 0 / 0.2), 0 0 0 1px var(--mb-line)}`,
		`${inLight(".mb-progress-bar")},${inLight(`.mb-framework[aria-checked='true'] .mb-switch-track`)},${inLight(".mb-live[data-connected]::before")}{background:#00c16a}`
	].join("\n"),
	logo: "<svg viewBox=\"0 0 48 32\" aria-hidden=\"true\"><path d=\"M26.88 32H44.64C45.2068 32.0001 45.7492 31.8009 46.24 31.52C46.7308 31.2391 47.2367 30.8865 47.52 30.4C47.8033 29.9135 48.0002 29.3615 48 28.7998C47.9998 28.2381 47.8037 27.6864 47.52 27.2001L35.52 6.56C35.2368 6.0736 34.8907 5.72084 34.4 5.44C33.9093 5.15916 33.2066 4.96 32.64 4.96C32.0734 4.96 31.5307 5.15916 31.04 5.44C30.5493 5.72084 30.2032 6.0736 29.92 6.56L26.88 11.84L20.8 1.59962C20.5165 1.11326 20.1708 0.600786 19.68 0.32C19.1892 0.0392139 18.6467 0 18.08 0C17.5133 0 16.9708 0.0392139 16.48 0.32C15.9892 0.600786 15.4835 1.11326 15.2 1.59962L0.32 27.2001C0.0363166 27.6864 0.000246899 28.2381 3.05588e-07 28.7998C-0.000246288 29.3615 0.0367437 29.9134 0.32 30.3999C0.603256 30.8864 1.10919 31.2391 1.6 31.52C2.09081 31.8009 2.63324 32.0001 3.2 32H14.4C18.8379 32 22.068 30.0092 24.32 26.24L29.76 16.8L32.64 11.84L41.44 26.88H29.76L26.88 32ZM14.24 26.88H6.4L18.08 6.72L24 16.8L20.0786 23.636C18.5831 26.0816 16.878 26.88 14.24 26.88Z\"/></svg>"
};
//#endregion
export { envPreset, requestPreset as h3Preset, requestPreset, nitroPreset, nuxtPreset, nuxtTheme, parseVueTrace, requestFromContext, traceFromInstance, vuePreset };
