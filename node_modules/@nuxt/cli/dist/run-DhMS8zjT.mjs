import { h as defineCommand, l as rootDirArgs } from "./_shared-YyGADOl7.mjs";
import { u as logger } from "./startup-clock-DXZlxuSA.mjs";
import { i as resolveRootDir } from "./paths-DlXZaaIg.mjs";
import { a as reportTaskError, c as runTask, l as taskArgs, o as reportUnknownTask, r as format, s as resolveTaskServer } from "./_utils-Cojb-kuS.mjs";
import process from "node:process";
import { styleText } from "node:util";
//#region src/commands/task/run.ts
const PAYLOAD_PREFIX = "payload.";
var run_default = defineCommand({
	meta: {
		name: "run",
		description: "Run a task on a Nuxt server and print its result"
	},
	args: {
		name: {
			type: "positional",
			description: "Name of the task to run",
			valueHint: "name"
		},
		...rootDirArgs,
		...taskArgs,
		payload: {
			type: "string",
			description: "Task payload, either as a JSON object or as `--payload.key=value` pairs",
			valueHint: "json"
		}
	},
	async run(ctx) {
		const name = ctx.args.name;
		if (!name) {
			logger.error(`Missing task name. Try ${styleText("cyan", "nuxt task list")} to see what is available.`);
			process.exit(1);
		}
		const payload = resolvePayload(ctx.args);
		const server = await resolveTaskServer(ctx.args);
		const response = await runTask(server, name, payload);
		if (!response.ok) {
			reportTaskError(response);
			if (response.status === 404) await reportUnknownTask(server, resolveRootDir(ctx.args));
			process.exit(1);
		}
		const result = unwrapResult(response.data);
		if (result !== void 0) process.stdout.write(`${format(result)}\n`);
	}
});
/**
* Nitro answers a task run with `{ result }`. Printing the result on its own is
* what `nitro task run` shows and what a caller can pipe into `jq`, so the
* envelope is dropped when that is all the response holds.
*/
function unwrapResult(data) {
	if (typeof data !== "object" || data === null || Array.isArray(data)) return data;
	const keys = Object.keys(data);
	return keys.length === 1 && keys[0] === "result" ? data.result : data;
}
function resolvePayload(args) {
	const payload = {};
	if (typeof args.payload === "string" && args.payload.trim()) {
		let parsed;
		try {
			parsed = JSON.parse(args.payload);
		} catch {
			logger.error(`Could not parse ${styleText("cyan", "--payload")} as JSON. Pass a JSON object, or use ${styleText("cyan", "--payload.key=value")}.`);
			process.exit(1);
		}
		if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
			logger.error(`${styleText("cyan", "--payload")} must be a JSON object.`);
			process.exit(1);
		}
		Object.assign(payload, parsed);
	}
	for (const [key, value] of Object.entries(args)) if (key.startsWith(PAYLOAD_PREFIX)) assign(payload, key.slice(8).split("."), value);
	return payload;
}
const UNSAFE_KEYS = /* @__PURE__ */ new Set([
	"__proto__",
	"constructor",
	"prototype"
]);
function assign(target, path, value) {
	const key = path[0];
	if (UNSAFE_KEYS.has(key)) return;
	if (path.length === 1) {
		target[key] = value;
		return;
	}
	const existing = target[key];
	const child = typeof existing === "object" && existing !== null && !Array.isArray(existing) ? existing : {};
	target[key] = child;
	assign(child, path.slice(1), value);
}
//#endregion
export { run_default as default };
