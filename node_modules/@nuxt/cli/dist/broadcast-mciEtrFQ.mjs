import { s as debug } from "./startup-clock-DXZlxuSA.mjs";
import { BroadcastChannel } from "node:worker_threads";
//#region src/dev/broadcast.ts
/** Listen on the channel called `name`, or return nothing where the runtime cannot open one. */
function openBroadcast(name, onMessage) {
	try {
		const channel = new BroadcastChannel(name);
		channel.unref();
		channel.onmessage = (event) => onMessage(event.data);
		return channel;
	} catch (error) {
		debug(`Could not open the \`${name}\` channel:`, error);
	}
}
//#endregion
export { openBroadcast as t };
