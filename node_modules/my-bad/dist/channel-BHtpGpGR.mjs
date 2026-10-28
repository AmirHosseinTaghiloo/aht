import { realpath, stat } from "node:fs/promises";
import process from "node:process";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { json } from "node:stream/consumers";
import { spawn } from "node:child_process";
//#region src/channel/open.ts
const goto = (file, line, column) => [line === void 0 ? file : `${file}:${line}${column === void 0 ? "" : `:${column}`}`];
const gotoFlag = (...args) => ["-g", ...goto(...args)];
const lineFlag = (file, line) => line === void 0 ? [file] : [
	"--line",
	String(line),
	file
];
const linePlus = (file, line) => line === void 0 ? [file] : [`+${line}`, file];
function forEditors(names, args) {
	return Object.fromEntries(names.map((name) => [name, args]));
}
const EDITORS = {
	...forEditors([
		"code",
		"code-insiders",
		"codium",
		"cursor",
		"windsurf"
	], gotoFlag),
	...forEditors([
		"zed",
		"subl",
		"sublime_text",
		"atom"
	], goto),
	...forEditors([
		"idea",
		"webstorm",
		"phpstorm"
	], lineFlag),
	...forEditors([
		"emacs",
		"gvim",
		"mvim"
	], linePlus),
	emacsclient: (file, line) => line === void 0 ? [file] : [
		"-n",
		`+${line}`,
		file
	]
};
/** Editors that need a terminal; spawning them detached would open nothing visible. */
const TERMINAL_EDITORS = /* @__PURE__ */ new Set([
	"vi",
	"vim",
	"nvim",
	"nano",
	"pico",
	"micro",
	"hx",
	"helix",
	"kak",
	"joe",
	"ne",
	"emacs -nw",
	"ed"
]);
/**
* Open a file in the user's editor. Uses `LAUNCH_EDITOR`, `VISUAL` or `EDITOR`
* when set, passing the line and column for editors we know how to drive. Falls
* back to the OS default application (via `tiny-open` if installed, otherwise
* `open` / `rundll32` / `xdg-open`), which cannot jump to a line.
*/
async function openInEditor(request) {
	const configured = process.env.LAUNCH_EDITOR || process.env.VISUAL || process.env.EDITOR;
	if (configured) {
		const [bin = "", ...extra] = configured.trim().split(/\s+/);
		const name = bin.replace(/\.(?:exe|cmd|bat)$/i, "").split(/[\\/]/).pop().toLowerCase();
		if (!TERMINAL_EDITORS.has(name)) {
			const args = EDITORS[name] ?? goto;
			const shell = process.platform === "win32" && /\.(?:cmd|bat)$/i.test(bin);
			return run(bin, [...extra, ...args(request.file, request.line, request.column)], shell);
		}
	}
	const tinyOpen = await import("tiny-open").then((mod) => mod.default ?? mod).catch(() => void 0);
	if (typeof tinyOpen === "function") return tinyOpen(request.file).then(Boolean, () => false);
	if (process.platform === "darwin") return run("open", [request.file]);
	if (process.platform === "win32") return run("rundll32.exe", ["url.dll,FileProtocolHandler", request.file]);
	return run("xdg-open", [request.file]);
}
/**
* Quote an argument for `cmd.exe`, which `spawn` does not do itself when `shell`
* is set: it only joins the arguments with spaces.
*
* Metacharacters are caret-escaped twice because the only arguments that reach
* here are destined for a `.cmd` / `.bat` shim, and `cmd.exe` parses the line
* once for itself and once for the batch file, consuming one caret each time.
*/
function escapeCmdArg(arg) {
	let body = "";
	let slashes = 0;
	for (const char of arg) {
		if (char === "\\") {
			slashes++;
			continue;
		}
		body += "\\".repeat(char === "\"" ? slashes * 2 : slashes) + (char === "\"" ? "\\\"" : char);
		slashes = 0;
	}
	body += "\\".repeat(slashes * 2);
	return `"${body}"`.replace(/[()\][%!^"`<>&|;, *?]/g, "^^^$&");
}
function run(bin, args, shell = false) {
	return new Promise((resolve) => {
		try {
			const child = spawn(shell ? escapeCmdArg(bin) : bin, shell ? args.map(escapeCmdArg) : args, {
				stdio: "ignore",
				detached: true,
				shell
			});
			child.once("error", () => resolve(false));
			child.once("spawn", () => {
				child.unref();
				resolve(true);
			});
		} catch {
			resolve(false);
		}
	});
}
//#endregion
//#region src/channel/origin.ts
/**
* Whether a request may run channel actions, i.e. it was not made by a page on
* another origin. `Sec-Fetch-Site` decides it where the browser sends one; an
* `Origin` must otherwise name the host being addressed. Either way the host
* must be an IP literal or allowed, so a DNS-rebound hostname pointing at the
* machine cannot vouch for itself. Requests with neither header cannot come
* from a browser (`curl`, editor integrations) and pass.
*/
function isTrustedRequest(site, origin, host, options = {}) {
	if (!site && !origin) return true;
	if (!host || !isAllowedHost(host, options.allowedHosts)) return false;
	if (site) return site === "same-origin" || site === "none";
	return originHost(origin) === host.toLowerCase();
}
function isAllowedHost(host, allowedHosts = []) {
	if (allowedHosts === true) return true;
	const name = hostname(host);
	if (!name) return false;
	if (name === "localhost" || name.endsWith(".localhost") || isIpLiteral(name)) return true;
	return allowedHosts.some((allowed) => allowed.startsWith(".") ? name === allowed.slice(1) || name.endsWith(allowed) : name === allowed.toLowerCase());
}
const IPV4_RE = /^\d{1,3}(?:\.\d{1,3}){3}$/;
/** Any IP literal is accepted: DNS rebinding needs a hostname to re-point. */
function isIpLiteral(name) {
	return IPV4_RE.test(name) || name.includes(":");
}
/** Hostname without port; IPv6 literals lose their brackets. */
function hostname(host) {
	try {
		return new URL(`http://${host}`).hostname.replace(/^\[(.*)\]$/, "$1").toLowerCase() || null;
	} catch {
		return null;
	}
}
/** `null` for opaque origins (`Origin: null`), which are never trusted. */
function originHost(origin) {
	try {
		return new URL(origin).host.toLowerCase() || null;
	} catch {
		return null;
	}
}
function isTrustedNodeRequest(req, options) {
	return isTrustedRequest(header(req, "sec-fetch-site"), header(req, "origin"), header(req, "host"), options);
}
function header(req, name) {
	const value = req.headers[name];
	return Array.isArray(value) ? value[0] : value;
}
function isTrustedFetchRequest(request, options) {
	const headers = request.headers;
	return isTrustedRequest(headers.get("sec-fetch-site"), headers.get("origin"), headers.get("host") ?? hostOf(request.url), options);
}
function hostOf(url) {
	try {
		return new URL(url).host || null;
	} catch {
		return null;
	}
}
//#endregion
//#region src/channel/protocol.ts
function toHistoryEntry(report) {
	return {
		id: report.id,
		kind: report.kind,
		name: report.name,
		message: report.message,
		timestamp: report.timestamp
	};
}
//#endregion
//#region src/channel/scope.ts
function scopeFromQuery(params) {
	return {
		requestId: params.get("requestId") ?? void 0,
		path: params.get("path") ?? void 0
	};
}
/**
* Whether a report from `request` concerns a page. A report with no request (compile error, client error) concerns every page.
* Under `strict`, a report naming a request id is matched by that id alone, since a path is guessable and an id is not.
*/
function concernsClient(scope, request, strict = false) {
	if (!request.requestId && !request.request) return true;
	if (request.requestId && (scope.requestId || strict)) return request.requestId === scope.requestId;
	return request.request !== void 0 && scope.path !== void 0 && requestPath(request.request) === scope.path;
}
/** `GET /a?b=1` names the path `/a?b=1`. */
function requestPath(request) {
	return request.replace(/^\S+\s+/, "");
}
//#endregion
//#region src/channel/index.ts
/** A source with no `percent` has unknown work left, so it ranks below any number. */
function leastAdvanced(live) {
	let lowest;
	for (const progress of live.values()) if (!lowest || (progress.percent ?? -1) < (lowest.percent ?? -1)) lowest = progress;
	return lowest;
}
const PRIVILEGED = /* @__PURE__ */ new Set(["open"]);
const SSE_HEADERS = {
	"content-type": "text/event-stream",
	"cache-control": "no-store",
	"connection": "keep-alive",
	"x-accel-buffering": "no"
};
function createChannel(options = {}) {
	const max = options.history ?? 20;
	const reports = /* @__PURE__ */ new Map();
	const origins = /* @__PURE__ */ new Map();
	const live = /* @__PURE__ */ new Map();
	let current;
	let currentRequest = {};
	const clients = /* @__PURE__ */ new Set();
	const concerned = (client) => concernsClient(client.scope, currentRequest, !client.trusted);
	const actions = [];
	if (options.open) actions.push("open");
	const keepalive = setInterval(send, options.keepalive ?? 15e3, ": ping\n\n");
	keepalive.unref?.();
	const helloFrames = /* @__PURE__ */ new Map();
	function concernsViewer(id, viewer) {
		return concernsClient(viewer.scope, origins.get(id) ?? {}, !viewer.trusted);
	}
	function history(viewer) {
		const entries = [...reports.values()];
		return (viewer ? entries.filter((report) => concernsViewer(report.id, viewer)) : entries).map(toHistoryEntry);
	}
	function remember(report, request = {}) {
		reports.delete(report.id);
		reports.set(report.id, report);
		origins.set(report.id, request);
		while (reports.size > max) {
			const oldest = reports.keys().next().value;
			reports.delete(oldest);
			origins.delete(oldest);
		}
		helloFrames.clear();
	}
	function send(chunk, to = () => true) {
		for (const client of clients) {
			if (!to(client)) continue;
			try {
				client.send(chunk);
			} catch {
				clients.delete(client);
			}
		}
	}
	function broadcast(event, to) {
		send(encode(event), to);
		notify(event);
	}
	function notify(event) {
		if (options.sink) Promise.resolve(options.sink(event)).catch(() => {});
	}
	function sendScoped(build, to = () => true) {
		const shared = encode(build(history()));
		for (const client of clients) {
			if (!to(client)) continue;
			try {
				client.send(client.trusted ? shared : encode(build(history(client))));
			} catch {
				clients.delete(client);
			}
		}
	}
	/** The current error is only announced to the pages it concerns; the rest just learn it happened. */
	function hello(client) {
		const mine = current !== void 0 && concerned(client);
		if (!client.trusted) return encode({
			type: "hello",
			payload: {
				version: "0.2.11",
				actions: actions.filter((action) => !PRIVILEGED.has(action)),
				current: mine ? current : void 0,
				history: history(client)
			}
		});
		let frame = helloFrames.get(mine);
		if (!frame) {
			frame = encode({
				type: "hello",
				payload: {
					version: "0.2.11",
					actions,
					current: mine ? current : void 0,
					history: history()
				}
			});
			helloFrames.set(mine, frame);
		}
		return frame;
	}
	/** Roots are resolved through symlinks, so a project reached by a link still matches. */
	const roots = options.root === false ? void 0 : Promise.all((Array.isArray(options.root) ? options.root : [options.root ?? process.cwd()]).map((root) => realpath(root).catch(() => resolve(root))));
	function within(target, against) {
		return against.some((root) => {
			const path = relative(root, target);
			return path !== ".." && !path.startsWith(`..${sep}`) && !isAbsolute(path);
		});
	}
	async function open(request) {
		if (typeof options.open === "function") return await options.open(request) !== false;
		if (options.open === true) return openInEditor(request);
		return false;
	}
	function route(pathname) {
		if (pathname.endsWith("/events")) return "events";
		if (pathname.endsWith("/open")) return "open";
		const match = /\/history\/([^/]+)$/.exec(pathname);
		if (match) return { history: decodeURIComponent(match[1]) };
	}
	function encode(event) {
		return `event: ${event.type}\ndata: ${JSON.stringify(event.payload)}\n\n`;
	}
	function parseOpen(body) {
		if (typeof body !== "object" || body === null) return;
		const { file, line, column } = body;
		if (typeof file !== "string" || !file) return;
		return {
			file,
			line: typeof line === "number" ? line : void 0,
			column: typeof column === "number" ? column : void 0
		};
	}
	async function openStatus(contentType, body) {
		if (!/^application\/json\b/i.test(contentType ?? "")) return 415;
		const request = parseOpen(body);
		if (!request) return 400;
		const target = await realpath(resolve(request.file)).catch(() => void 0);
		if (!target || !await stat(target).then((stats) => stats.isFile(), () => false)) return 400;
		if (roots && !within(target, await roots)) return 403;
		request.file = target;
		return await open(request).catch(() => false) ? 204 : 400;
	}
	const trust = { allowedHosts: options.allowedHosts };
	/** 404 rather than 403, so the answer does not confirm the id exists. */
	function historyResponse(id, viewer) {
		const report = viewer.trusted || concernsViewer(id, viewer) ? reports.get(id) : void 0;
		return {
			status: report ? 200 : 404,
			body: report ? JSON.stringify(report) : "{}"
		};
	}
	const JSON_HEADERS = {
		"content-type": "application/json",
		"cache-control": "no-store"
	};
	return {
		async handler(req, res, caller) {
			const trusted = caller?.trusted ?? true;
			const url = new URL(req.url ?? "/", "http://localhost");
			const matched = route(url.pathname);
			if (!matched) return false;
			if (!isTrustedNodeRequest(req, trust)) {
				res.writeHead(403).end();
				return true;
			}
			if (matched === "events") {
				res.writeHead(200, SSE_HEADERS);
				res.flushHeaders?.();
				const client = {
					send: (chunk) => void res.write(chunk),
					close: () => res.end(),
					scope: scopeFromQuery(url.searchParams),
					trusted
				};
				clients.add(client);
				client.send(hello(client));
				req.on("close", () => clients.delete(client));
				return true;
			}
			if (matched === "open") {
				if (!trusted) {
					res.writeHead(403).end();
					return true;
				}
				if (req.method !== "POST") {
					res.writeHead(405).end();
					return true;
				}
				const body = await json(req).catch(() => void 0);
				res.writeHead(await openStatus(req.headers["content-type"], body)).end();
				return true;
			}
			const { status, body } = historyResponse(matched.history, {
				scope: scopeFromQuery(url.searchParams),
				trusted
			});
			res.writeHead(status, JSON_HEADERS);
			res.end(body);
			return true;
		},
		async fetchHandler(request, caller) {
			const trusted = caller?.trusted ?? true;
			const url = new URL(request.url);
			const matched = route(url.pathname);
			if (!matched) return;
			if (!isTrustedFetchRequest(request, trust)) return new Response(null, { status: 403 });
			if (matched === "events") {
				const encoder = new TextEncoder();
				let client;
				const stream = new ReadableStream({
					start(controller) {
						client = {
							send: (chunk) => controller.enqueue(encoder.encode(chunk)),
							close: () => controller.close(),
							scope: scopeFromQuery(url.searchParams),
							trusted
						};
						clients.add(client);
						client.send(hello(client));
					},
					cancel() {
						if (client) clients.delete(client);
					}
				});
				request.signal?.addEventListener("abort", () => {
					if (client) clients.delete(client);
				});
				return new Response(stream, { headers: SSE_HEADERS });
			}
			if (matched === "open") {
				if (!trusted) return new Response(null, { status: 403 });
				if (request.method !== "POST") return new Response(null, { status: 405 });
				return new Response(null, { status: await openStatus(request.headers.get("content-type"), await request.json().catch(() => void 0)) });
			}
			const { status, body } = historyResponse(matched.history, {
				scope: scopeFromQuery(url.searchParams),
				trusted
			});
			return new Response(body, {
				status,
				headers: JSON_HEADERS
			});
		},
		setError(report, requestId, request) {
			currentRequest = {
				...requestId && { requestId },
				...request && { request }
			};
			remember(report, currentRequest);
			current = report;
			const set = (entries) => ({
				type: "error:set",
				payload: {
					report,
					history: entries,
					...currentRequest
				}
			});
			sendScoped(set, concerned);
			notify(set(history()));
			sendScoped((entries) => ({
				type: "history",
				payload: { history: entries }
			}), (client) => !concerned(client));
		},
		clearError(id) {
			if (id && current?.id !== id) return;
			broadcast({
				type: "error:clear",
				payload: { id }
			}, concerned);
			current = void 0;
			currentRequest = {};
			helloFrames.clear();
		},
		warn(report) {
			const warning = {
				...report,
				kind: "warning"
			};
			remember(warning);
			const event = (entries) => ({
				type: "warning",
				payload: {
					report: warning,
					history: entries
				}
			});
			sendScoped(event);
			notify(event(history()));
		},
		log(entry, requestId, request) {
			const origin = {
				...requestId && { requestId },
				...request && { request }
			};
			const attributed = origin.requestId !== void 0 || origin.request !== void 0;
			broadcast({
				type: "log",
				payload: {
					timestamp: Date.now(),
					...entry,
					...origin
				}
			}, (client) => client.trusted || attributed && concernsClient(client.scope, origin, true));
		},
		progress(progress) {
			if (!progress.source) {
				broadcast({
					type: "build",
					payload: progress
				});
				return;
			}
			if (progress.percent !== void 0 && progress.percent >= 100) live.delete(progress.source);
			else live.set(progress.source, progress);
			broadcast({
				type: "build",
				payload: leastAdvanced(live) ?? progress
			});
		},
		get current() {
			return current;
		},
		get history() {
			return history();
		},
		getReport: (id) => reports.get(id),
		get clients() {
			return clients.size;
		},
		close() {
			clearInterval(keepalive);
			for (const client of clients) try {
				client.close();
			} catch {}
			clients.clear();
		}
	};
}
//#endregion
export { toHistoryEntry as n, openInEditor as r, createChannel as t };
