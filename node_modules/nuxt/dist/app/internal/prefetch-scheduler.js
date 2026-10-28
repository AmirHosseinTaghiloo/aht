import { useNuxtApp } from "../nuxt.js";
import { requestIdleCallback } from "../compat/idle-callback.js";
import { canPrefetch, prefetchGroup } from "./prefetch-util.js";
import { createPrefetchScheduler } from "./prefetch.js";
//#region src/app/internal/prefetch-scheduler.ts
const IDLE_START_TIMEOUT_MS = 1e3;
/**
* Speculative work yields to user input. Work the user has shown intent in does not, and
* neither do route chunks, whose start latency is what a navigation ends up waiting on.
* https://developer.mozilla.org/en-US/docs/Web/API/Prioritized_Task_Scheduling_API
*/
function defer(run, promoted, priority) {
	if (promoted || priority === "route") return run();
	const scheduler = globalThis.scheduler;
	if (scheduler?.postTask) scheduler.postTask(run, { priority: "background" }).catch(() => {});
	else requestIdleCallback(run, { timeout: IDLE_START_TIMEOUT_MS });
}
/**
* The single scheduler every client-side prefetch mechanism queues work on.
* @internal
*/
function usePrefetchScheduler(nuxtApp = useNuxtApp()) {
	if (nuxtApp._prefetch) return nuxtApp._prefetch;
	let navigating = false;
	const scheduler = createPrefetchScheduler({
		canPrefetch: () => canPrefetch() && !navigating && document.visibilityState !== "hidden",
		defer
	});
	nuxtApp._prefetch = scheduler;
	navigator.connection?.addEventListener?.("change", () => scheduler.resume());
	document.addEventListener("visibilitychange", () => scheduler.resume());
	const router = nuxtApp.$router;
	router.beforeEach(() => {
		navigating = true;
	});
	router.afterEach((to) => {
		navigating = false;
		scheduler.reset(prefetchGroup(to.fullPath));
	});
	router.onError(() => {
		navigating = false;
		scheduler.resume();
	});
	return scheduler;
}
//#endregion
export { usePrefetchScheduler };
