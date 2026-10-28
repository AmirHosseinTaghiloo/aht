import { toArray } from "../utils.js";
import { _isAutoKeyNeeded } from "./asyncData.js";
//#region src/app/composables/addons.ts
/**
* Define a reusable addon for composables created with `createUseFetch`.
* @since 4.6.0
*/
function defineUseFetchAddon(addon) {
	return addon;
}
/**
* Define a reusable addon for composables created with `createUseAsyncData`.
* @since 4.6.0
*/
function defineUseAsyncDataAddon(addon) {
	return addon;
}
const FETCH_HOOK_ARRAY_KEYS = [
	"onRequest",
	"onRequestError",
	"onResponse",
	"onResponseError"
];
const PROMISE_METHODS = [
	"then",
	"catch",
	"finally"
];
function runAddonSetups(addons, options, arrayHookKeys) {
	for (const key of arrayHookKeys) options[key] = options[key] === void 0 ? [] : [...toArray(options[key])];
	let setups;
	let keyed;
	for (const addon of new Set(addons)) {
		if (addon.key) (keyed ??= []).push(addon);
		const result = addon.setup(options);
		if (typeof result === "function") (setups ??= []).push(result);
	}
	return {
		setups,
		keyed
	};
}
var WrappedAsyncDataPromise = class extends Promise {};
function wrapPromiseMethod(base, wrappers) {
	let wrapped = base;
	for (let i = (wrappers?.length ?? 0) - 1; i >= 0; i--) {
		const wrapper = wrappers[i];
		const next = wrapped;
		wrapped = (...args) => wrapper(next, ...args);
	}
	return wrapped;
}
function attachAddonExtensions(setups, result) {
	let extensions;
	let wrappers;
	for (const setup of setups) {
		const extension = setup(result);
		if (extension && typeof extension === "object") {
			const { then, catch: _catch, finally: _finally, ...members } = extension;
			const methodWrappers = {
				then,
				catch: _catch,
				finally: _finally
			};
			for (const method of PROMISE_METHODS) if (typeof methodWrappers[method] === "function") ((wrappers ??= {})[method] ??= []).push(methodWrappers[method]);
			Object.assign(extensions ??= {}, members);
		}
	}
	if (extensions) {
		Object.assign(result, extensions);
		result.then((instance) => Object.assign(instance, extensions));
	}
	if (!wrappers) return result;
	const { then: _then, catch: _catch, finally: _finally, ...members } = result;
	const wrapped = WrappedAsyncDataPromise.resolve(result);
	Object.assign(wrapped, members);
	Object.defineProperties(wrapped, {
		then: {
			enumerable: true,
			value: wrapPromiseMethod(Promise.prototype.then.bind(wrapped), wrappers.then)
		},
		catch: {
			enumerable: true,
			value: wrapPromiseMethod(Promise.prototype.catch.bind(wrapped), wrappers.catch)
		},
		finally: {
			enumerable: true,
			value: wrapPromiseMethod(Promise.prototype.finally.bind(wrapped), wrappers.finally)
		}
	});
	return wrapped;
}
/** @internal */
function applyUseFetchAddons(create, { addons, ...factoryOptions }) {
	const useFetch = create(factoryOptions);
	return ((request, arg1, arg2) => {
		const [opts = {}, autoKey] = typeof arg1 === "string" ? [{}, arg1] : [arg1, arg2];
		const merged = {
			...factoryOptions,
			...opts
		};
		const { setups, keyed } = runAddonSetups(addons, merged, ["middleware", ...FETCH_HOOK_ARRAY_KEYS]);
		if (keyed) merged._keySegments = keyed.map((addon) => () => addon.key(merged));
		const result = useFetch(request, merged, autoKey);
		return setups ? attachAddonExtensions(setups, result) : result;
	});
}
/** @internal */
function applyUseAsyncDataAddons(create, { addons, ...factoryOptions }) {
	const useAsyncData = create(factoryOptions);
	return ((...args) => {
		const autoKey = typeof args[args.length - 1] === "string" ? args.pop() : void 0;
		if (_isAutoKeyNeeded(args[0], args[1])) args.unshift(autoKey);
		const [key, handler, opts = {}] = args;
		const merged = {
			...factoryOptions,
			...opts
		};
		const { setups } = runAddonSetups(addons, merged, ["middleware"]);
		const result = useAsyncData(key, handler, merged);
		return setups ? attachAddonExtensions(setups, result) : result;
	});
}
//#endregion
export { applyUseAsyncDataAddons, applyUseFetchAddons, defineUseAsyncDataAddon, defineUseFetchAddon };
