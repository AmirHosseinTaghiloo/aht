//#region src/app/internal/prefetch.ts
/** drained in this order */
const PREFETCH_PRIORITIES = [
	"route",
	"payload",
	"island",
	"hint"
];
const DEFAULT_TOTAL_CONCURRENCY = 12;
const DEFAULT_CONCURRENCY = {
	route: 8,
	payload: 8,
	island: 4,
	hint: 8
};
function createPrefetchScheduler(options = {}) {
	const limits = {
		...DEFAULT_CONCURRENCY,
		...options.concurrency
	};
	const total = options.total ?? DEFAULT_TOTAL_CONCURRENCY;
	const canPrefetch = options.canPrefetch;
	const defer = options.defer;
	const queues = {
		route: [],
		payload: [],
		island: [],
		hint: []
	};
	const lists = PREFETCH_PRIORITIES.map((priority) => queues[priority]);
	const promoted = /* @__PURE__ */ new WeakSet();
	const keys = /* @__PURE__ */ new Map();
	const active = {
		route: 0,
		payload: 0,
		island: 0,
		hint: 0
	};
	let activeTotal = 0;
	const activeNavigationTasks = /* @__PURE__ */ new Map();
	const appController = new AbortController();
	const droppedController = new AbortController();
	droppedController.abort();
	function release(task) {
		if (keys.get(task.key) === task) keys.delete(task.key);
	}
	function drop(task) {
		release(task);
		Promise.resolve().then(() => task.run(droppedController.signal, false)).catch(() => {});
	}
	function drain() {
		if (canPrefetch && !canPrefetch()) return;
		while (activeTotal < total) {
			const priority = PREFETCH_PRIORITIES.find((priority) => queues[priority].length && active[priority] < limits[priority]);
			if (!priority) return;
			const task = queues[priority].shift();
			start(task, promoted.delete(task));
		}
	}
	function start(task, isPromoted) {
		const controller = task.scope === "app" ? appController : new AbortController();
		if (task.scope === "navigation") activeNavigationTasks.set(task, controller);
		active[task.priority]++;
		activeTotal++;
		let settled = false;
		const complete = () => {
			if (settled) return;
			settled = true;
			active[task.priority]--;
			activeTotal--;
			activeNavigationTasks.delete(task);
			release(task);
			drain();
		};
		controller.signal.addEventListener("abort", complete, { once: true });
		const run = () => Promise.resolve().then(() => task.run(controller.signal, isPromoted)).then(complete, complete);
		if (defer) defer(run, isPromoted, task.priority);
		else run();
	}
	const isRetained = (task, retainGroup) => retainGroup !== void 0 && task.group === retainGroup && task.priority !== "hint";
	const scheduler = {
		schedule(task) {
			const batch = [];
			for (const candidate of Array.isArray(task) ? task : [task]) {
				if (keys.has(candidate.key)) {
					drop(candidate);
					continue;
				}
				keys.set(candidate.key, candidate);
				batch.push(candidate);
			}
			for (let i = batch.length - 1; i >= 0; i--) queues[batch[i].priority].unshift(batch[i]);
			drain();
		},
		promote(group) {
			for (const list of lists) {
				const wanted = [];
				const rest = [];
				for (const task of list) {
					if (task.group === group) promoted.add(task);
					(task.group === group ? wanted : rest).push(task);
				}
				list.length = 0;
				list.push(...wanted, ...rest);
			}
			drain();
		},
		reset(retainGroup) {
			for (const list of lists) for (let i = list.length - 1; i >= 0; i--) {
				const task = list[i];
				if (task.scope === "navigation" && !isRetained(task, retainGroup)) {
					list.splice(i, 1);
					drop(task);
				}
			}
			for (const [task, controller] of [...activeNavigationTasks]) {
				if (isRetained(task, retainGroup)) continue;
				controller.abort();
			}
			drain();
		},
		resume: drain
	};
	if (import.meta.dev) scheduler.inspect = () => ({
		active: activeTotal,
		pending: lists.flatMap((list) => list.map((task) => task.key))
	});
	return scheduler;
}
//#endregion
export { createPrefetchScheduler };
