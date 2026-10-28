import { t as dirname } from "../path-BUhlDN52.mjs";
import { appendFile, mkdir } from "node:fs/promises";
//#region src/sinks/index.ts
/**
* Append channel events as JSON lines to a file, e.g. `.nuxt/my-bad.jsonl`,
* so agents and other tools can tail the dev server's errors.
*/
function fileSink(path, options = {}) {
	const types = options.types ? new Set(options.types) : void 0;
	let queue;
	return (event) => {
		if (types ? !types.has(event.type) : event.type === "build") return;
		const line = `${JSON.stringify({
			timestamp: Date.now(),
			...event
		})}\n`;
		queue ??= mkdir(dirname(path), { recursive: true }).catch(() => {});
		queue = queue.then(() => appendFile(path, line)).catch(() => {});
		return queue;
	};
}
/** Fan out to several sinks. */
function combineSinks(...sinks) {
	return async (event) => {
		await Promise.all(sinks.map((sink) => Promise.resolve(sink(event)).catch(() => {})));
	};
}
//#endregion
export { combineSinks, fileSink };
