import { t as openBroadcast } from "./broadcast-mciEtrFQ.mjs";
//#region src/dev/log-channel.ts
/**
* Where `runtime/dev-request-context.mjs` sends the app's logs.
*
* Nitro runs the app in a worker thread, so the two sides share no object at
* all: not `globalThis`, not `process`, and no `AsyncLocalStorage`. A
* `BroadcastChannel` crosses that boundary without borrowing the channel Nitro
* uses to talk to its own worker.
*/
const DEV_LOG_CHANNEL = "nuxt:dev:log";
/** Receive the app's logs until the returned function is called. */
function openDevLogChannel(sink) {
	const channel = openBroadcast(DEV_LOG_CHANNEL, sink);
	return () => channel?.close();
}
//#endregion
export { openDevLogChannel };
