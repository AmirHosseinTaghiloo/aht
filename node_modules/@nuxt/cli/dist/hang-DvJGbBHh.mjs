import { u as logger } from "./startup-clock-DXZlxuSA.mjs";
import process from "node:process";
//#region src/utils/hang.ts
/** Handles that are present in every process (stdio, signal listeners) and never the reason a command hangs. */
const IGNORED_RESOURCES = /* @__PURE__ */ new Set([
	"TTYWrap",
	"PipeWrap",
	"FileHandle",
	"SignalWrap"
]);
const RESOURCE_LABELS = {
	ChildProcess: "child process",
	FSEventWrap: "file watcher",
	FSReqCallback: "file system operation",
	FSReqPromise: "file system operation",
	Immediate: "timer",
	MessagePort: "worker thread",
	Process: "child process",
	StatWatcher: "file watcher",
	TCPServerWrap: "server",
	TCPSocketWrap: "open connection",
	TCPWrap: "open connection",
	Timeout: "timer",
	TLSWrap: "open connection",
	UDPWrap: "open connection",
	Worker: "worker thread"
};
/**
* Describe what is currently keeping the event loop alive, as a human-readable list
* such as `2 timers, 1 file watcher`. Returns `undefined` when nothing but the
* process's own stdio is left, which points at an unsettled promise instead.
*/
function summariseActiveResources(resources = process.getActiveResourcesInfo()) {
	const counts = /* @__PURE__ */ new Map();
	for (const resource of resources) {
		if (IGNORED_RESOURCES.has(resource)) continue;
		const label = RESOURCE_LABELS[resource] || resource;
		counts.set(label, (counts.get(label) ?? 0) + 1);
	}
	if (counts.size === 0) return;
	return [...counts].map(([label, count]) => count === 1 ? `1 ${label}` : `${count} ${label}s`).join(", ");
}
/**
* Warn if the process is still running some time after its work is done.
*
* The timer is unref'd, so it only ever fires when something else is holding the
* event loop open, and it never delays an exit that would otherwise happen.
* Returns a function to disarm it.
*/
function warnOnHang(options = {}) {
	const { timeout = 5e3, action = "command", warn = (message) => logger.warn(message) } = options;
	const timer = setTimeout(() => {
		const summary = summariseActiveResources();
		warn([`The ${action} is complete but the process is still running${summary ? `: ${summary}` : ""}.`, summary ? "A module, plugin or dependency is likely holding these open. Nuxt will exit once they are closed." : "Nothing is registered on the event loop, so a pending promise is likely never settling."].join("\n"));
	}, timeout);
	timer.unref?.();
	return () => clearTimeout(timer);
}
//#endregion
export { warnOnHang as n, summariseActiveResources as t };
