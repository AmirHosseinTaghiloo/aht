import { REMOTE_DEV_ERROR_CLEAR_EVENT, REMOTE_DEV_ERROR_EVENT, REMOTE_DEV_ERROR_REPORT_EVENT } from "./remote-dev-error.mjs";
import { ERROR_CHANNEL_ENV, clearErrorReport as clearErrorReport$1, createDevErrorReporter, createErrorReport, serializeErrorCause, setErrorChannelForwarding, useErrorChannel } from "nuxt/internal/dev-error";
import { isLoopbackAddress } from "nuxt/internal/dev/peer";
//#region src/runtime/dev-error.ts
let context;
const env = () => globalThis.process?.env ?? {};
/** Whether a dev server in front owns the channel. */
const forwarding = () => !!env()[ERROR_CHANNEL_ENV];
const hot = import.meta.hot;
setErrorChannelForwarding(forwarding);
/** Install the dev server the app renders from. */
function setDevErrorContext(next) {
	context = next;
	useErrorChannel().catch(() => {});
}
/** Whether `pathname` is a live channel route this process serves. */
function isErrorChannelRequest(pathname) {
	if (!context || forwarding()) return false;
	const base = context.channel.replace(/\/$/, "");
	return pathname === base || pathname.startsWith(`${base}/`);
}
/**
* Serve the live error channel: the SSE stream, report lookups and "open in editor".
*
* Trust follows the socket, since a request's origin headers are forgeable over a direct
* connection.
*/
async function fetchErrorChannel(request) {
	return await (await useErrorChannel()).fetchHandler(request, { trusted: isLoopbackAddress(request.ip) }) ?? new Response("Not Found", { status: 404 });
}
/**
* Build a report from the stack as raised, publish it, then rewrite the stack in place so
* every later consumer sees source positions.
*/
function observeDevError(error, request, observe) {
	if (context) return reporter(error, request, observe);
	if (hot && !observe?.expected) return requestRemoteReport(error, request).catch(() => void 0);
	return Promise.resolve(void 0);
}
/** Retire the current report, dismissing overlays showing it. */
function clearErrorReport() {
	if (context || !hot) return clearErrorReport$1();
	hot.send(REMOTE_DEV_ERROR_CLEAR_EVENT);
	return Promise.resolve();
}
const reporter = createDevErrorReporter({
	get cwd() {
		return context.cwd;
	},
	channel: channelPath,
	createReport: (error, request) => buildReport(error, request),
	requestInfo: (request) => ({
		method: request.method,
		url: new URL(request.url),
		headers: request.headers
	}),
	mapStack: (error) => fixStacktraces(error, context.server)
});
/** Ask the dev server to build, publish and render the report, as only it can read the sources. */
function requestRemoteReport(error, request) {
	const id = crypto.randomUUID();
	return new Promise((resolve, reject) => {
		const settle = (reply) => {
			clearTimeout(timer);
			hot.off(REMOTE_DEV_ERROR_REPORT_EVENT, listener);
			const { report, overlay = "", page = "" } = reply ?? {};
			if (!report) return reject(/* @__PURE__ */ new Error("The dev server did not report the error."));
			resolve({
				report,
				overlay: (html) => {
					const index = html.lastIndexOf("</body>");
					return Promise.resolve(index === -1 ? html + overlay : html.slice(0, index) + overlay + html.slice(index));
				},
				page: () => Promise.resolve(page)
			});
		};
		const listener = (reply) => reply.id === id && settle(reply);
		const timer = setTimeout(settle, 1e4);
		hot.on(REMOTE_DEV_ERROR_REPORT_EVENT, listener);
		hot.send(REMOTE_DEV_ERROR_EVENT, {
			id,
			error: serializeErrorCause(error),
			status: error?.status,
			request: request && {
				method: request.method,
				url: request.url,
				headers: [...request.headers]
			}
		});
	});
}
async function buildReport(error, request) {
	const { viteLoader } = await import("my-bad/vite");
	return createErrorReport(error, {
		cwd: context.cwd,
		loaders: [viteLoader(ssrOnly(context.server), { fs: false })],
		context: { request }
	});
}
/**
* The dev server with only its SSR environment visible, since `viteLoader` maps through
* the first environment holding the file and an SSR frame belongs to the SSR transform.
*/
function ssrOnly(server) {
	return Object.create(server, { environments: { value: { ssr: server.environments.ssr } } });
}
/**
* Ask Vite to map the stacks of an error and its causes. It maps in place and appends to
* `message` on a stack it has already rewritten, so each one is mapped on a carrier.
*/
function fixStacktraces(error, server, seen = /* @__PURE__ */ new Set()) {
	if (!(error instanceof Error) || seen.has(error)) return;
	seen.add(error);
	if (typeof error.stack === "string") {
		const carrier = { stack: error.stack };
		server.ssrFixStacktrace(carrier);
		if (carrier.stack) try {
			Object.defineProperty(error, "stack", {
				value: carrier.stack,
				writable: true,
				configurable: true
			});
		} catch {}
	}
	fixStacktraces(error.cause, server, seen);
}
/** The error's `cause` chain, as the error page receives it in the payload. */
function errorCause(error) {
	return serializeErrorCause(error?.cause);
}
function channelPath() {
	return env()[ERROR_CHANNEL_ENV] || context.channel;
}
//#endregion
export { clearErrorReport, errorCause, fetchErrorChannel, isErrorChannelRequest, observeDevError, setDevErrorContext };
