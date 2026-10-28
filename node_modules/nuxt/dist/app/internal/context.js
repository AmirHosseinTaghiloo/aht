import { getContext as getContext$1 } from "unctx";
//#region src/app/internal/context.ts
const clientContexts = globalThis.__nuxt_app_ctx__ ||= {};
/** Singleton stand-in for `unctx` in the browser, which has no `AsyncLocalStorage`. */
function getClientContext(key) {
	return clientContexts[key] ||= (() => {
		let instance;
		return {
			use: () => {
				if (instance === void 0) throw new Error("Context is not available");
				return instance;
			},
			tryUse: () => instance ?? null,
			set: (newInstance) => {
				instance = newInstance;
			},
			unset: () => {
				instance = void 0;
			},
			call: (newInstance, callback) => {
				instance = newInstance;
				return callback();
			},
			callAsync: (newInstance, callback) => {
				instance = newInstance;
				return Promise.resolve(callback());
			}
		};
	})();
}
function getContext(key, opts) {
	if (import.meta.client) return getClientContext(key);
	return getContext$1(key, opts);
}
//#endregion
export { getContext };
