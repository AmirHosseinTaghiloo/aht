import { createHooks } from "hookable";
//#region src/server/hooks.ts
let hooks;
/**
* The server runtime hooks: renderer hooks and those declared on {@link NuxtServerHooks}.
*
* @example
* ```ts
* // server/plugins/robots.ts
* useServerHooks().hook('render:html', (html, { event }) => {
*   html.head.push('<meta name="robots" content="noindex">')
* })
* ```
*
* @since 4.6.0
*/
function useServerHooks() {
	return hooks ||= createHooks();
}
//#endregion
export { useServerHooks };
