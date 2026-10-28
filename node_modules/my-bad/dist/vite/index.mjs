import { c as resolvePath, d as withoutQuery, i as isFilePath, o as normalizeSlashes, t as dirname, u as toPath } from "../path-BUhlDN52.mjs";
import { a as renderOverlay, b as decodeSourceMap, g as findOriginal, h as parseInlineSourceMap, m as fsLoader, o as renderPage, r as clientAssets, t as createReport, y as withEmbeddedSource } from "../create-BctpUY7p.mjs";
import { t as createChannel } from "../channel-BHtpGpGR.mjs";
import { readFile } from "node:fs/promises";
import { fnv1a64Base36 } from "fnv1a-64";
import { fileURLToPath } from "node:url";
//#region src/vite/loader.ts
function graphs(server) {
	const environments = server.environments;
	if (environments) return Object.values(environments).map((env) => env.moduleGraph);
	return [server.moduleGraph];
}
function findModule(server, file) {
	const normalized = normalizeSlashes(file);
	for (const graph of graphs(server)) {
		const byFile = graph.getModulesByFile(normalized);
		if (byFile?.size) return [...byFile].find((mod) => mod.ssrTransformResult ?? mod.transformResult) ?? [...byFile][0];
		const byId = graph.getModuleById(normalized) ?? graph.getModuleById(`\0${normalized}`);
		if (byId) return byId;
	}
}
/**
* Decoded maps by transform result, shared by every loader instance. The module
* runner rewrites `code` in place to append its inline map, so an entry is only
* reused while `code` and `map` are the ones it was decoded from.
*/
const decoded = /* @__PURE__ */ new WeakMap();
/**
* The map embedded in the transformed code accounts for the module runner's
* wrapper lines, so it matches runtime stack positions where `transformResult.map`
* does not. Prefer it when present.
*/
function decode(result) {
	const entry = {
		code: result.code,
		map: result.map,
		lookup: void 0,
		root: ""
	};
	const raw = parseInlineSourceMap(result.code) ?? result.map;
	if (!raw?.mappings && !(Array.isArray(raw?.sections) && raw.sections.length)) return entry;
	try {
		entry.lookup = decodeSourceMap(raw);
		entry.root = typeof raw.sourceRoot === "string" && raw.sourceRoot ? raw.sourceRoot.replace(/\/?$/, "/") : "";
	} catch {}
	return entry;
}
function mapOf(mod) {
	const result = mod.ssrTransformResult ?? mod.transformResult;
	if (!result) return;
	let entry = decoded.get(result);
	if (!entry || entry.code !== result.code || entry.map !== result.map) {
		entry = decode(result);
		decoded.set(result, entry);
	}
	return entry.lookup && {
		map: entry.lookup,
		root: entry.root,
		base: dirname(mod.file ?? mod.id ?? "/")
	};
}
/**
* Maps frames through Vite's module graph (SSR or client transforms). Snippets
* come from the map's `sourcesContent`, then from disk or, for virtual modules,
* from the transformed code.
*/
function viteLoader(server, options = {}) {
	return {
		name: "vite",
		map(frame) {
			if (!frame.file || frame.line === void 0) return;
			const mod = findModule(server, frame.file);
			if (!mod) return;
			const loaded = mapOf(mod);
			if (!loaded) return;
			const original = findOriginal(loaded.map, frame.line, frame.column);
			if (!original) return;
			const { source, line, column } = original;
			const named = `${loaded.root}${source}`;
			const file = isFilePath(named) || named.startsWith("file:") ? toPath(named) : named.startsWith("/@fs/") ? named.slice(4) : /^[^./]/.test(named) && !named.includes(":") ? mod.file ?? frame.file : resolvePath(loaded.base, named);
			const content = loaded.map.sourceContent?.(source);
			if (withoutQuery(file) === withoutQuery(frame.file) && line === frame.line && column === frame.column) {
				withEmbeddedSource(frame, content);
				return;
			}
			return withEmbeddedSource({
				...frame,
				file,
				line,
				column,
				compiled: frame.compiled ?? {
					file: frame.file,
					line: frame.line,
					column: frame.column
				}
			}, content);
		},
		readCompiled(file) {
			const mod = findModule(server, file);
			return (mod?.ssrTransformResult ?? mod?.transformResult)?.code ?? void 0;
		},
		async read(file) {
			const mod = findModule(server, file);
			if (mod && !mod.file) return (mod.ssrTransformResult ?? mod.transformResult)?.code ?? void 0;
			if (options.fs === false || !isFilePath(file)) return;
			return readFile(withoutQuery(file), "utf8").catch(() => void 0);
		}
	};
}
//#endregion
//#region src/vite/index.ts
const contexts = /* @__PURE__ */ new WeakMap();
/** Access the my-bad context for a dev server once the plugin has configured it. */
function useMyBad(server) {
	return contexts.get(server.config);
}
const CLIENT_ID = "virtual:my-bad/client";
const RESOLVED_CLIENT_ID = `\0${CLIENT_ID}`;
/** Browser URL for the virtual module, following Vite's `\0` encoding. */
const CLIENT_URL = `/@id/__x00__${CLIENT_ID}`;
/** Content-hashed URLs so the served client can be cached indefinitely. */
function assetUrls(base) {
	return {
		script: `${base}/client.js?v=${fnv1a64Base36(clientAssets.script)}`,
		styles: `${base}/client.css?v=${fnv1a64Base36(clientAssets.styles)}`
	};
}
/** Import the client that ships next to this module by absolute path, so the project never resolves `my-bad` itself. */
function clientSource() {
	const file = fileURLToPath(new URL(import.meta.url.endsWith(".ts") ? "./client.ts" : "./client.mjs", import.meta.url));
	return `import { installMyBadClient } from ${JSON.stringify(`/@fs/${file.replace(/^\//, "")}`)}\ninstallMyBadClient(import.meta.hot)\n`;
}
function myBad(options = {}) {
	const base = (options.base ?? "/__my-bad").replace(/\/$/, "");
	const live = options.channel !== false;
	let server;
	let ctx;
	return {
		name: "my-bad",
		apply: "serve",
		config() {
			if (live && options.replaceOverlay !== false) return { server: { hmr: { overlay: false } } };
		},
		configureServer(devServer) {
			server = devServer;
			const channel = createChannel({
				root: devServer.config.server.fs.allow,
				allowedHosts: devServer.config.server.allowedHosts,
				...typeof options.channel === "object" ? options.channel : { open: true }
			});
			const cwd = options.report?.cwd ?? devServer.config.root;
			const loaders = [viteLoader(devServer), fsLoader()];
			const presets = options.presets ?? [];
			const assets = options.inlineClient ? void 0 : assetUrls(base);
			const hots = () => {
				const environments = devServer.environments;
				return environments ? Object.values(environments).map((env) => env.hot) : [devServer.ws];
			};
			/** An error raised while the page loads predates the HMR socket, so replay the latest overlay to each new client. */
			let pending;
			const broadcast = (payload) => {
				for (const hot of hots()) hot.send?.(payload);
			};
			for (const hot of hots()) hot.on?.("connection", () => {
				if (pending) hot.send?.(pending);
			});
			ctx = {
				channel,
				base,
				loaders,
				report: (error, reportOptions) => createReport(error, {
					cwd,
					loaders,
					presets,
					...options.report,
					...reportOptions
				}),
				page: (report, pageOptions) => renderPage(report, {
					cwd,
					channel: live ? base : void 0,
					history: channel.history,
					assets,
					...pageOptions
				}),
				overlay: (report, overlayOptions) => renderOverlay(report, {
					cwd,
					channel: live ? base : void 0,
					history: channel.history,
					assets,
					...options.overlay,
					...overlayOptions
				}),
				async emit(error, reportOptions) {
					const report = await ctx.report(error, reportOptions);
					channel.setError(report);
					if (live) {
						pending = {
							type: "custom",
							event: "my-bad:error",
							data: {
								id: report.id,
								html: ctx.overlay(report)
							}
						};
						broadcast(pending);
					}
					return report;
				},
				clear(id) {
					channel.clearError(id);
					pending = void 0;
					if (live) broadcast({
						type: "custom",
						event: "my-bad:clear",
						data: { id }
					});
				}
			};
			contexts.set(devServer.config, ctx);
			if (assets) devServer.middlewares.use((req, res, next) => {
				const path = req.url?.split("?")[0];
				const asset = path === `${base}/client.js` ? {
					type: "text/javascript",
					body: clientAssets.script
				} : path === `${base}/client.css` ? {
					type: "text/css",
					body: clientAssets.styles
				} : void 0;
				if (!asset) {
					next();
					return;
				}
				res.setHeader("content-type", `${asset.type}; charset=utf-8`);
				res.setHeader("cache-control", "public, max-age=31536000, immutable");
				res.end(asset.body);
			});
			if (!live) return;
			devServer.middlewares.use(base, (req, res, next) => {
				req.url = `${base}${req.url ?? ""}`;
				channel.handler(req, res).then((handled) => handled || next()).catch(next);
			});
			let erroredIds = /* @__PURE__ */ new Set();
			for (const hot of hots()) {
				if (!hot.send) continue;
				const send = hot.send.bind(hot);
				hot.send = ((payload, ...rest) => {
					const message = payload;
					if (message?.type === "error" && message.err) {
						if (message.err.id) erroredIds.add(message.err.id);
						ctx.emit(message.err, { kind: "compile" });
					} else if ((message?.type === "update" || message?.type === "full-reload") && channel.current) {
						erroredIds = /* @__PURE__ */ new Set();
						ctx.clear();
					}
					return send(payload, ...rest);
				});
			}
		},
		resolveId(id) {
			if (id === CLIENT_ID) return RESOLVED_CLIENT_ID;
		},
		async load(id) {
			if (id === RESOLVED_CLIENT_ID) return clientSource();
		},
		transformIndexHtml() {
			if (!live || !server) return;
			return [{
				tag: "script",
				attrs: {
					type: "module",
					src: CLIENT_URL
				},
				injectTo: "head"
			}];
		}
	};
}
//#endregion
export { myBad, useMyBad, viteLoader };
