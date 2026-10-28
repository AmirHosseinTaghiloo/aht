import { hashKey } from "../utils/hash.js";
import { defineKeyedFunctionFactory } from "../../compiler/runtime/index.js";
import { dataDiagnostics } from "../diagnostics/data.js";
import { applyUseFetchAddons } from "./addons.js";
import { useAsyncData } from "./asyncData.js";
import { useRequestFetch } from "./ssr.js";
import { computed, reactive, toValue, watch } from "vue";
import { alwaysRunFetchOnKeyChange, fetchDefaults, routeTypedFetch } from "#build/nuxt.config.mjs";
import { $fetch } from "#build/fetch";
import { isPlainObject } from "@vue/shared";
//#region src/app/composables/fetch.ts
const $fetch$1 = $fetch;
const MAYBE_REF_OR_GETTER_OPTION_KEYS = [
	"method",
	"baseURL",
	"query",
	"params",
	"body",
	"headers"
];
function generateOptionSegments(opts) {
	const segments = [toValue(opts.method)?.toUpperCase() || "GET", toValue(opts.baseURL)];
	for (const _obj of [opts.query || opts.params]) {
		const obj = toValue(_obj);
		if (!obj) continue;
		const unwrapped = {};
		for (const [key, value] of Object.entries(obj)) unwrapped[toValue(key)] = toValue(value);
		segments.push(unwrapped);
	}
	if (opts.body) {
		const value = toValue(opts.body);
		if (!value) segments.push(hashKey(value));
		else if (value instanceof ArrayBuffer) segments.push(hashKey(Object.fromEntries([...new Uint8Array(value).entries()].map(([k, v]) => [k, v.toString()]))));
		else if (value instanceof FormData) {
			const entries = [];
			for (const entry of value.entries()) {
				const [key, val] = entry;
				entries.push([key, val instanceof File ? `${val.name}:${val.size}:${val.lastModified}` : val]);
			}
			segments.push(hashKey(entries));
		} else if (isPlainObject(value)) segments.push(hashKey(reactive(value)));
		else try {
			segments.push(hashKey(value));
		} catch {
			dataDiagnostics.NUXT_E3002({ cause: value });
		}
	}
	return segments;
}
/**
* A factory function to create a custom `useFetch` composable with pre-defined default options.
* @since 4.4.0
*/
const createUseFetch = /* @__PURE__ */ defineKeyedFunctionFactory({
	name: "createUseFetch",
	factory: ((options = {}) => {
		if (typeof options !== "function" && options.addons?.length) return applyUseFetchAddons(_createUseFetch, options);
		return _createUseFetch(options);
	})
});
/** @internal */
function _createUseFetch(options = {}) {
	{
		function useFetch(request, arg1, arg2) {
			const [opts = {}, autoKey] = typeof arg1 === "string" ? [{}, arg1] : [arg1, arg2];
			const factoryOptions = typeof options === "function" ? options(opts) : options;
			const { server, lazy, default: defaultFn, transform, pick, watch: watchSources, immediate, getCachedData, deep, dedupe, timeout, enabled, serialize, middleware, _keySegments: keySegments, ...fetchOptions } = {
				...typeof options === "function" ? {} : factoryOptions,
				...opts,
				...typeof options === "function" ? factoryOptions : {}
			};
			if (routeTypedFetch && "params" in fetchOptions) {
				delete fetchOptions.params;
				if (import.meta.dev) dataDiagnostics.NUXT_E3010();
			}
			const _request = computed(() => toValue(request));
			const key = computed(() => toValue(fetchOptions.key) || "$f" + hashKey([
				autoKey,
				typeof _request.value === "string" ? _request.value : "",
				...generateOptionSegments(fetchOptions),
				...keySegments ? keySegments.map((segment) => toValue(segment)) : []
			]));
			if (!fetchOptions.baseURL && typeof _request.value === "string" && _request.value[0] === "/" && _request.value[1] === "/") throw dataDiagnostics.NUXT_E3001({ url: _request.value });
			const _fetchOptions = reactive({
				...fetchDefaults,
				...fetchOptions,
				cache: typeof fetchOptions.cache === "boolean" ? void 0 : fetchOptions.cache
			});
			const _asyncDataOptions = {
				server,
				lazy,
				default: defaultFn,
				transform,
				pick,
				immediate,
				getCachedData,
				deep,
				dedupe,
				timeout,
				enabled,
				serialize,
				middleware,
				watch: watchSources === false ? [] : [...watchSources || [], _fetchOptions]
			};
			if (import.meta.dev) _asyncDataOptions._functionName ||= factoryOptions._functionName || "useFetch";
			if (watchSources === false) _asyncDataOptions._keyTriggersExecute = false;
			if (alwaysRunFetchOnKeyChange && !immediate) {
				function setImmediate() {
					_asyncDataOptions.immediate = true;
				}
				watch(key, setImmediate, {
					flush: "sync",
					once: true
				});
				watch([...watchSources || [], _fetchOptions], setImmediate, {
					flush: "sync",
					once: true
				});
			}
			return useAsyncData(key, (_, { signal }) => {
				let _$fetch = fetchOptions.$fetch || $fetch$1;
				if (import.meta.server && !fetchOptions.$fetch) {
					if (typeof _request.value === "string" && _request.value[0] === "/" && (!toValue(fetchOptions.baseURL) || toValue(fetchOptions.baseURL)[0] === "/")) _$fetch = useRequestFetch();
				}
				const resolvedOptions = {
					signal,
					..._fetchOptions
				};
				for (const key of MAYBE_REF_OR_GETTER_OPTION_KEYS) if (typeof resolvedOptions[key] === "function") resolvedOptions[key] = toValue(resolvedOptions[key]);
				return _$fetch(_request.value, resolvedOptions);
			}, _asyncDataOptions);
		}
		return useFetch;
	}
}
const useFetch = _createUseFetch();
const useLazyFetch = _createUseFetch({
	lazy: true,
	_functionName: "useLazyFetch"
});
//#endregion
export { _createUseFetch, createUseFetch, useFetch, useLazyFetch };
