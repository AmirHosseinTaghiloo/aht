import { useErrorChannel } from "../utils/error-channel.mjs";
import { defineEventHandler, getRequestIP, toWebRequest } from "h3";
import { isLoopbackAddress } from "nuxt/internal/dev/peer";
//#region src/runtime/handlers/error-channel.ts
/**
* Serves the live error channel: the SSE stream, report lookups and "open in editor".
*
* Trust follows the socket, since a request's origin headers are forgeable over a direct
* connection.
*/
var error_channel_default = defineEventHandler(async (event) => {
	const channel = await useErrorChannel();
	const trusted = isLoopbackAddress(getRequestIP(event));
	return await channel.fetchHandler(toWebRequest(event), { trusted }) ?? new Response("Not Found", { status: 404 });
});
//#endregion
export { error_channel_default as default };
