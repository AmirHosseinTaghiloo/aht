//#region src/runtime/server/dev-error/index.ts
/** Base path the dev server owning the channel serves it at. */
const ERROR_CHANNEL_ENV = "NUXT_DEV_ERROR_CHANNEL";
/** `BroadcastChannel` name reports are forwarded on. */
const ERROR_CHANNEL_BROADCAST = "nuxt:dev:error";
/** Pairs a report with the request it came from. */
const REQUEST_ID_HEADER = "x-nuxt-dev-request-id";
const CHANNEL_KEY = Symbol.for("nuxt:dev:error-channel");
let isForwarding = () => false;
/**
* Whether reports are forwarded to a dev server in front rather than served from here.
* Read when the channel is first used, not when this module loads.
*/
function setErrorChannelForwarding(forward) {
	isForwarding = forward;
}
/** The live error channel, forwarding to the dev server in front when there is one. */
function useErrorChannel() {
	const store = globalThis;
	store[CHANNEL_KEY] ||= isForwarding() ? Promise.resolve(createForwardingChannel()) : import("my-bad/channel").then(({ createChannel }) => createOwnedChannel(createChannel({ open: true })));
	return store[CHANNEL_KEY];
}
/** The `BroadcastChannel` reports travel between threads on, which must not hold the process open. It drops every message where none can be opened. */
function openErrorBroadcast() {
	try {
		const broadcast = new BroadcastChannel(ERROR_CHANNEL_BROADCAST);
		broadcast.unref?.();
		return broadcast;
	} catch {
		return {
			onmessage: null,
			postMessage() {},
			close() {}
		};
	}
}
function openBroadcast() {
	const broadcast = openErrorBroadcast();
	return {
		broadcast,
		post: (message) => broadcast.postMessage(message)
	};
}
/** A channel of this process, which also relays reports to and from other threads. */
function createOwnedChannel(channel) {
	const { broadcast, post } = openBroadcast();
	broadcast.onmessage = (event) => {
		const message = event.data;
		switch (message?.type) {
			case "nuxt:dev:error:report": return channel.setError(message.report);
			case "nuxt:dev:error:clear": return channel.clearError(message.id);
			case "nuxt:dev:error:log": return channel.log(message.entry);
			case "nuxt:dev:error:warning": return channel.warn(message.report);
			case "nuxt:dev:error:progress": return channel.progress(message.progress);
		}
	};
	post({ type: "nuxt:dev:error:sync" });
	return {
		...channel,
		setError(report, requestId, request) {
			channel.setError(report, requestId, request);
			post({
				type: "nuxt:dev:error:report",
				report,
				requestId,
				request
			});
		},
		clearError(id) {
			channel.clearError(id);
			post({
				type: "nuxt:dev:error:clear",
				id
			});
		},
		get current() {
			return channel.current;
		},
		get clients() {
			return channel.clients;
		},
		get history() {
			return channel.history;
		}
	};
}
function createForwardingChannel() {
	const { broadcast, post } = openBroadcast();
	let current;
	return {
		handler: () => Promise.resolve(false),
		fetchHandler: () => Promise.resolve(void 0),
		setError(report, requestId, request) {
			current = report;
			post({
				type: "nuxt:dev:error:report",
				report,
				requestId,
				request
			});
		},
		clearError(id) {
			current = void 0;
			post({
				type: "nuxt:dev:error:clear",
				id
			});
		},
		warn(report) {
			post({
				type: "nuxt:dev:error:warning",
				report
			});
		},
		log(entry) {
			post({
				type: "nuxt:dev:error:log",
				entry: {
					timestamp: Date.now(),
					...entry
				}
			});
		},
		progress(progress) {
			post({
				type: "nuxt:dev:error:progress",
				progress
			});
		},
		get current() {
			return current;
		},
		history: [],
		getReport: () => void 0,
		clients: 0,
		close() {
			broadcast.close();
		}
	};
}
/** Publish a report as the current error, paired with the request it came from. */
async function publishErrorReport(report, request) {
	const channel = await useErrorChannel();
	const description = request && `${request.method} ${request.url.pathname}${request.url.search}`;
	channel.setError(report, requestIdOf(request), description);
}
/** The id a dev server in front gave the request. */
function requestIdOf(request) {
	return request?.headers.get("x-nuxt-dev-request-id") ?? void 0;
}
/** Retire the current report, dismissing overlays showing it. */
async function clearErrorReport() {
	const channel = await useErrorChannel();
	if (channel.current) channel.clearError();
}
/** Stream a log entry to connected error pages and overlays. */
async function publishDevLog(entry) {
	(await useErrorChannel()).log(entry);
}
/** Report build progress. A `percent` of 100 retires the progress bar. */
async function publishDevProgress(progress) {
	(await useErrorChannel()).progress(progress);
}
const THROWN_CONTEXT = Symbol.for("nuxt:dev:context");
/** The component instance and route the app recorded on `error` when it threw. */
function thrownContext(error) {
	return (typeof error === "object" && error !== null && THROWN_CONTEXT in error ? error[THROWN_CONTEXT] : void 0) ?? {};
}
/**
* Build a report for an error raised while rendering. Must run before anything rewrites
* `error.stack`, as frames are mapped by the loaders rather than read off the stack.
*/
async function createErrorReport(error, options) {
	const [{ createReport, fsLoader }, { nuxtPreset }] = await Promise.all([import("my-bad"), import("my-bad/presets")]);
	return withoutEchoingCauses(await createReport(error, {
		cwd: options.cwd,
		loaders: [...options.loaders ?? [], fsLoader()],
		presets: [nuxtPreset()],
		context: {
			...thrownContext(error),
			...options.context
		}
	}));
}
/** Add the error overlay to an already-rendered page. */
async function withErrorOverlay(html, report, options) {
	const [{ injectOverlay }, { nuxtTheme }] = await Promise.all([import("my-bad"), import("my-bad/presets")]);
	return injectOverlay(html, report, {
		cwd: options.cwd,
		channel: options.channel,
		requestId: options.requestId,
		theme: nuxtTheme,
		tag: "nuxt-error-overlay",
		startMinimized: options.startMinimized
	});
}
/** Render a standalone error page, for when the app itself cannot render one. */
async function renderErrorPage(report, options) {
	const [{ renderPage }, { nuxtTheme }] = await Promise.all([import("my-bad"), import("my-bad/presets")]);
	return renderPage(report, {
		cwd: options.cwd,
		channel: options.channel,
		requestId: options.requestId,
		theme: nuxtTheme
	});
}
/** Render a report for the terminal. It carries its own icon and colours. */
async function renderErrorAnsi(report, options) {
	const { renderAnsi } = await import("my-bad");
	return renderAnsi(withoutEchoingCauses(report), { cwd: options.cwd });
}
/** Print a report to the terminal, falling back to the raw error when it cannot be rendered. */
async function printErrorReport(report, options) {
	const label = options.request ? ` [${options.request.method}] ${options.request.url.href}` : "";
	const rendered = await renderErrorAnsi(report, { cwd: options.cwd }).catch(() => void 0);
	if (rendered) console.log(`[request error]${label}\n\n${rendered}`);
	else console.error(`[request error]${label}\n\n`, options.error ?? report.message);
}
/**
* Build the reporter a builder hands the renderer as `onDevError`. The report is built on the
* stack as raised, so this must run before anything rewrites it.
*/
function createDevErrorReporter(options) {
	return async function observeDevError(error, event, observe = {}) {
		const request = event && options.requestInfo(event);
		const report = observe.expected ? void 0 : await options.createReport(error, event).catch(() => void 0);
		options.mapStack?.(error);
		if (!report) return;
		if (observe.publish !== false) await publishErrorReport(report, request).catch(() => {});
		if (observe.print !== false && !isForwarding()) await printErrorReport(report, {
			cwd: options.cwd,
			error,
			request
		});
		const requestId = requestIdOf(request);
		return {
			report,
			overlay: (html) => withErrorOverlay(html, report, {
				cwd: options.cwd,
				channel: options.channel(),
				requestId,
				startMinimized: true
			}),
			page: () => renderErrorPage(report, {
				cwd: options.cwd,
				channel: options.channel(),
				requestId
			})
		};
	};
}
/** A line of a code frame, as a compiler embeds one in a message. */
const FRAME_LINE_RE = /^[^\S\n]*(?:\d+[^\S\n]*[|:│]|[|│][^\S\n]*\^|\^)/m;
/**
* Drop causes that only repeat the report's own message, so the failure is read once. A
* wrapper is only dropped when all it adds is the code frame the report shows as a snippet.
*/
function withoutEchoingCauses(report) {
	const causes = report.causes.filter((cause) => !echoesMessage(cause.message, report.message)).map(withoutEchoingCauses);
	return causes.length === report.causes.length ? report : {
		...report,
		causes
	};
}
function echoesMessage(candidate, message) {
	if (candidate === message) return true;
	if (!candidate.startsWith(message)) return false;
	const remainder = candidate.slice(message.length);
	return remainder.trim() === "" || FRAME_LINE_RE.test(remainder);
}
/**
* Rewrite the module ids a transform failure names, and those of its causes, with
* `resolve`. A bundler names the module it was serving, which is not always a path.
*/
function resolveErrorPaths(error, resolve, seen = /* @__PURE__ */ new Set()) {
	if (typeof error !== "object" || error === null || seen.has(error)) return;
	seen.add(error);
	const candidate = error;
	if (typeof candidate.id === "string") candidate.id = resolve(candidate.id);
	if (candidate.loc && typeof candidate.loc.file === "string") candidate.loc.file = resolve(candidate.loc.file);
	resolveErrorPaths(candidate.cause, resolve, seen);
	if (Array.isArray(candidate.errors)) for (const nested of candidate.errors) resolveErrorPaths(nested, resolve, seen);
}
/** Flatten an error's `cause` chain into something the payload can carry. */
function serializeErrorCause(cause, depth = 0, seen = /* @__PURE__ */ new WeakSet()) {
	if (depth >= 10 || cause instanceof Error && seen.has(cause)) return;
	if (cause instanceof Error) {
		seen.add(cause);
		const nestedCause = serializeErrorCause(cause.cause, depth + 1, seen);
		return {
			name: cause.name,
			message: cause.message,
			...cause.stack && { stack: cause.stack },
			...nestedCause !== void 0 && { cause: nestedCause }
		};
	}
	if (cause === null || typeof cause === "string" || typeof cause === "number" || typeof cause === "boolean") return cause;
}
//#endregion
export { ERROR_CHANNEL_BROADCAST, ERROR_CHANNEL_ENV, REQUEST_ID_HEADER, clearErrorReport, createDevErrorReporter, createErrorReport, openErrorBroadcast, publishDevLog, publishDevProgress, publishErrorReport, resolveErrorPaths, serializeErrorCause, setErrorChannelForwarding, thrownContext, useErrorChannel };
