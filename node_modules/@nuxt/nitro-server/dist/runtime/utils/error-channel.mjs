import { getRequestURL } from "h3";
import { useNitroApp, useRuntimeConfig } from "nitropack/runtime";
import { joinURL } from "ufo";
import { isMainThread } from "node:worker_threads";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import { rootDir, srcDir } from "#internal/dev-server-logs-options";
import * as devError from "nuxt/internal/dev-error";
import { clearErrorReport, publishDevLog, publishDevProgress, serializeErrorCause } from "nuxt/internal/dev-error";
import { NUXT_ERROR_CHANNEL } from "#internal/nuxt/nitro-config.mjs";
//#region src/runtime/utils/error-channel.ts
const ERROR_CHANNEL_ENV = devError.ERROR_CHANNEL_ENV;
const ERROR_CHANNEL_BROADCAST = devError.ERROR_CHANNEL_BROADCAST;
/** Whether reports should be forwarded to the dev server that set {@link ERROR_CHANNEL_ENV}. */
function shouldForwardReports(env = process.env, mainThread = isMainThread) {
	return !!env[ERROR_CHANNEL_ENV] && !mainThread;
}
/** Base path pages should subscribe to. */
function getErrorChannelPath() {
	return process.env[ERROR_CHANNEL_ENV] || joinURL(useRuntimeConfig().app.baseURL, NUXT_ERROR_CHANNEL);
}
devError.setErrorChannelForwarding(() => shouldForwardReports());
/** The live error channel, forwarding to the dev server in front when there is one. */
function useErrorChannel() {
	return devError.useErrorChannel();
}
/** Publish a report as the current error, paired with the request it came from. */
function publishErrorReport(report, event) {
	return devError.publishErrorReport(report, event && {
		method: event.method,
		url: getRequestURL(event),
		headers: event.headers
	});
}
/**
* Build a report for an error raised while rendering. Must run on the stack as it was
* raised, since frames are mapped through the SSR bundle's sourcemaps.
*/
function createErrorReport(error, event) {
	devError.resolveErrorPaths(error, resolveTransformPath);
	const ssrSourceMaps = useNitroApp().ssrSourceMaps;
	return devError.createErrorReport(error, {
		cwd: rootDir,
		loaders: ssrSourceMaps ? [compiledPositionLoader(ssrSourceMaps)] : [],
		context: { event }
	});
}
/**
* Resolve a bundler module id such as `/app.vue`, which reads as an absolute path but is
* relative to the environment root, to a file the developer can open.
*/
function resolveTransformPath(path) {
	const query = path.indexOf("?");
	const file = query === -1 ? path : path.slice(0, query);
	if (!file.startsWith("/") || existsSync(file)) return path;
	for (const root of [srcDir, rootDir]) {
		const resolved = join(root, file);
		if (existsSync(resolved)) return query === -1 ? resolved : resolved + path.slice(query);
	}
	return path;
}
/**
* Recover the generated position of frames the runner has already mapped. A frame mapped
* to its module but not to a line in it points at generated code, so counts as a vendor frame.
*/
function compiledPositionLoader(ssrSourceMaps) {
	return {
		name: "nuxt-compiled-position",
		map(frame) {
			if (!frame.file || frame.line === void 0 || frame.compiled) return;
			const compiled = ssrSourceMaps.getCompiledPosition?.(frame.file, frame.line, frame.column);
			if (compiled) return {
				...frame,
				compiled
			};
			return ssrSourceMaps.getCode(frame.file) !== void 0 && frame.line > lineCount(frame.file) ? {
				...frame,
				type: "vendor"
			} : void 0;
		},
		readCompiled: (file) => ssrSourceMaps.getCode(file)
	};
}
function lineCount(file) {
	try {
		return readFileSync(file, "utf8").split("\n").length;
	} catch {
		return Number.POSITIVE_INFINITY;
	}
}
/** Report an error raised while serving a request. */
const observeDevError = devError.createDevErrorReporter({
	cwd: rootDir,
	channel: getErrorChannelPath,
	createReport: (error, event) => createErrorReport(error, event),
	requestInfo: (event) => ({
		method: event.method,
		url: getRequestURL(event),
		headers: event.headers
	})
});
//#endregion
export { ERROR_CHANNEL_BROADCAST, ERROR_CHANNEL_ENV, clearErrorReport, createErrorReport, getErrorChannelPath, observeDevError, publishDevLog, publishDevProgress, publishErrorReport, serializeErrorCause, shouldForwardReports, useErrorChannel };
