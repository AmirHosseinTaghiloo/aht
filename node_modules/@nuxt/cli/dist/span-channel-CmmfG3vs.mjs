import { t as openBroadcast } from "./broadcast-mciEtrFQ.mjs";
//#region src/dev/span-channel.ts
/** Where `runtime/dev-request-context.mjs` sends the spans it times. */
const DEV_SPAN_CHANNEL = "nuxt:dev:span";
/** Receive the app's spans until the returned function is called. */
function openDevSpanChannel(sink) {
	const channel = openBroadcast(DEV_SPAN_CHANNEL, sink);
	return () => channel?.close();
}
//#endregion
export { openDevSpanChannel };
