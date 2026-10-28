import { getCurrentInstance } from "vue";
//#region src/app/composables/server-prefetch.ts
/** Client-side `onServerPrefetch`, which only keeps the component a `useId()` async boundary. */
function onServerPrefetch(target = getCurrentInstance()) {
	const instance = target;
	if (instance && !instance.sp) instance.sp = [];
}
//#endregion
export { onServerPrefetch };
