import { existsSync } from "node:fs";
import { AsyncLocalStorage } from "node:async_hooks";
import { tracingChannel } from "node:diagnostics_channel";
//#region src/dev/compile-timing.ts
const STARTED = Symbol("nuxt:cli:compile:started");
const NESTED = Symbol("nuxt:cli:compile:nested");
/** Where Vite publishes, and where Nuxt publishes for a Vite that does not. */
const MODULE_CHANNELS = ["vite.module", "nuxt.bundler.module"];
const PLUGIN_CHANNELS = ["vite.plugin", "nuxt.bundler.plugin"];
function ignore() {}
const UNUSED = {
	end: ignore,
	asyncStart: ignore,
	error: ignore
};
/**
* Report the modules Vite compiles for requests, and each Vite plugin's share of
* them, from the `vite.module` and `vite.plugin` tracing channels, or their
* `nuxt.bundler.*` counterparts. A module traced on both is reported once.
*
* A module compiled while serving a request, such as one the browser asked
* for, is charged to that request. A server module is requested by the app's
* runner over a message channel instead, so no request context reaches Vite;
* every app request in flight is charged, and a module compiled for several is
* marked `shared`.
*
* Returns a function that unsubscribes.
*/
function subscribeCompileTiming(options) {
	const storage = new AsyncLocalStorage();
	const modules = MODULE_CHANNELS.map((name) => tracingChannel(name));
	const plugins = PLUGIN_CHANNELS.map((name) => tracingChannel(name));
	const openModule = (context) => {
		const outer = storage.getStore();
		if (outer) {
			context[NESTED] = true;
			return outer;
		}
		return {
			plugins: /* @__PURE__ */ new Map(),
			nested: 0
		};
	};
	const openPlugin = () => {
		const parent = storage.getStore();
		return parent && {
			plugins: parent.plugins,
			nested: 0,
			parent
		};
	};
	const moduleHandlers = {
		...UNUSED,
		start(context) {
			const frame = storage.getStore();
			if (context[NESTED]) return;
			const current = options.current();
			const requests = current ? [{
				id: current.id,
				internal: false
			}] : options.inflight().filter((request) => !request.internal);
			if (frame && requests.length) context[STARTED] = {
				frame,
				start: performance.now(),
				requests
			};
		},
		asyncEnd(context) {
			const started = context[STARTED];
			if (!started?.requests) return;
			context[STARTED] = void 0;
			const duration = performance.now() - started.start;
			const timings = Object.fromEntries([...started.frame.plugins].map(([plugin, time]) => [plugin, Math.round(time * 100) / 100]));
			for (const request of started.requests) options.report({
				requestId: request.id,
				kind: "compile",
				name: shortenModuleId(String(context.url ?? context.id ?? ""), options.rootDir()),
				start: performance.timeOrigin + started.start,
				duration,
				...context.environment ? { environment: context.environment } : {},
				plugins: timings,
				...started.requests.length > 1 ? { shared: true } : {}
			});
		}
	};
	const pluginHandlers = {
		...UNUSED,
		start(context) {
			const frame = storage.getStore();
			if (frame?.parent) context[STARTED] = {
				frame,
				start: performance.now()
			};
		},
		asyncEnd(context) {
			const started = context[STARTED];
			if (!started) return;
			context[STARTED] = void 0;
			const { frame } = started;
			const duration = performance.now() - started.start;
			const name = context.plugin || "anonymous";
			frame.plugins.set(name, (frame.plugins.get(name) ?? 0) + Math.max(0, duration - frame.nested));
			frame.parent.nested += duration;
		}
	};
	for (const channel of modules) {
		channel.start.bindStore(storage, openModule);
		channel.subscribe(moduleHandlers);
	}
	for (const channel of plugins) {
		channel.start.bindStore(storage, openPlugin);
		channel.subscribe(pluginHandlers);
	}
	return () => {
		for (const channel of modules) {
			channel.unsubscribe(moduleHandlers);
			channel.start.unbindStore(storage);
		}
		for (const channel of plugins) {
			channel.unsubscribe(pluginHandlers);
			channel.start.unbindStore(storage);
		}
	};
}
/**
* A module URL as a reader would name it: from its package, or from the
* project. Vite URLs are relative to the project root unless they name a file
* outside it.
*/
function shortenModuleId(url, rootDir) {
	if (/^\/?@id\//.test(url)) return url.replace(/^\/?@id\/(?:__x00__)?/, "");
	const file = url.replace(/^\/@fs(?=\/)/, "").replace(/\?.*$/, "");
	const packaged = file.lastIndexOf("/node_modules/");
	if (packaged !== -1) return file.slice(packaged + 14);
	const root = `${rootDir.replace(/\/$/, "")}/`;
	if (file.startsWith(root)) return file.slice(root.length);
	return file.startsWith("/") && !url.startsWith("/@fs/") && !existsSync(file) ? file.slice(1) : file;
}
//#endregion
export { subscribeCompileTiming };
