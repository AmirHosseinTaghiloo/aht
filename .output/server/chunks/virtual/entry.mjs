import { createApp, provide, onErrorCaptured, onServerPrefetch, unref, createVNode, resolveDynamicComponent, shallowReactive, reactive, effectScope, hasInjectionContext, getCurrentInstance, inject, defineAsyncComponent, mergeProps, defineComponent, ref, getCurrentScope, toRef, computed, h, isReadonly, useSSRContext, isRef, isShallow, isReactive, toRaw, watchEffect, onScopeDispose, toValue } from 'vue';
import { h as createError, $ as $fetch, E as isEqual, F as stringifyParsedURL, G as stringifyQuery, y as joinURL, H as parseQuery, I as withQuery, J as sanitizeStatusCode, K as parseURL, L as decodePath, M as isScriptProtocol } from '../_/nitro.mjs';
import { p as publicAssetsURL, b as baseURL } from '../routes/renderer.mjs';
import { ssrRenderSuspense, ssrRenderComponent, ssrRenderVNode, ssrRenderAttrs, ssrInterpolate, ssrRenderStyle, ssrRenderAttr, ssrRenderList } from 'vue/server-renderer';

//#region src/formatters/plain.ts
/**
* Renders a diagnostic into a multi-line, unicode-decorated string suitable
* for terminal output. The first line is `[<name>] <message>`; optional
* details (`fix`, `sources`, `docs`) follow with `├▶`/`╰▶` connectors.
*/
const captureStackTrace = Error.captureStackTrace;
var Diagnostic = class Diagnostic extends Error {
	name;
	/**
	* The diagnostic code, e.g. `MATH_E001`.
	* Also appears as the `name` property.
	*/
	code;
	/**
	* URL to extended documentation for this diagnostic code.
	* Auto-generated from {@link DefineDiagnosticsOptions.docsBase}.
	*/
	docs;
	/**
	* Optional actionable instructions on how to resolve the problem.
	*/
	fix;
	/**
	* Locations in user code that contributed to this diagnostic, in
	* `file:line:column` format. Relevant when the stack trace doesn't reflect
	* the user's source (e.g. compilers, bundlers), otherwise redundant with the
	* stack and should be omitted.
	*/
	sources;
	/**
	* Structured information associated with this diagnostic code.
	*/
	data;
	/**
	* Alias for {@link Error.message}: the reason this diagnostic was raised.
	*/
	get why() {
		return this.message;
	}
	/**
	* @param init        structured initializer; `why` is required
	* @param captureFrom V8 stack-cutoff frame. Defaults to {@link Diagnostic}
	* so the top of the trace is the `new Diagnostic(...)` call site.
	* `defineDiagnostics` passes its action method to strip its own frames too.
	* Ignored on engines without `Error.captureStackTrace`.
	*/
	constructor(init, captureFrom = Diagnostic) {
		super(init.why, { cause: init.cause });
		this.code = this.name = init.code;
		this.fix = init.fix;
		this.docs = init.docs;
		this.sources = init.sources;
		this.data = init.data;
		captureStackTrace?.(this, captureFrom);
	}
	/**
	* Converts the diagnostic into a serializable structured object.
	*/
	toJSON() {
		return {
			name: this.name,
			why: this.why,
			fix: this.fix,
			docs: this.docs,
			sources: this.sources,
			cause: this.cause,
			data: this.data,
			stack: this.stack
		};
	}
};
/**
* Resolves the docs URL for a code from a `docsBase` (string template or
* resolver function). Shared by {@link defineDiagnostics} and
* {@link defineProdDiagnostics}. Per-code `docs` overrides are handled by the
* caller; this only covers the `docsBase`-derived case.
*
* @internal
*/
function deriveDocs(docsBase, code) {
	return typeof docsBase === "string" ? `${docsBase}/${code.toLowerCase()}` : docsBase?.(code);
}
//#endregion
//#region src/prod-diagnostics.ts
/**
* Production counterpart to {@link defineDiagnostics}. Returns a `Proxy` that
* builds a minimal {@link Diagnostic} for any accessed code: the code becomes
* the instance `name`, `docs` is derived from `docsBase`, and `why` points to
* the docs URL when one exists (empty otherwise, so the thrown header is just
* the code). It carries no catalog text or data, so it stays tiny in a bundle.
*
* The strip plugin (`@nostics/unplugin`) can rewrite a `defineDiagnostics()`
* call into a `"production" === 'production'` ternary that selects this
* factory in production, dropping every `why`/`fix` string from the bundle.
*
* @example
* ```ts
* const diagnostics = defineProdDiagnostics({ docsBase: 'https://docs.example.com' })
* throw diagnostics.NUXT_B2011() // NUXT_B2011: https://docs.example.com/nuxt_b2011
* ```
*/
/* @__NO_SIDE_EFFECTS__ */
function defineProdDiagnostics(options = {}) {
	const { docsBase, reporters = [] } = options;
	return new Proxy({}, { get(_target, code) {
		if (typeof code !== "string") return void 0;
		const handle = (params = {}, reporterOptions = {}) => {
			const docs = deriveDocs(docsBase, code);
			const diagnostic = new Diagnostic({
				code,
				why: docs ?? "",
				docs,
				cause: params.cause,
				sources: params.sources
			}, handle);
			for (const reporter of reporters) reporter(diagnostic, reporterOptions);
			return diagnostic;
		};
		return handle;
	} });
}

function _getAsyncLocalStorage() {
	return globalThis.AsyncLocalStorage || globalThis.process?.getBuiltinModule?.("node:async_hooks")?.AsyncLocalStorage;
}
const _WeakRef = globalThis.WeakRef || class StrongRef {
	#value;
	constructor(value) {
		this.#value = value;
	}
	deref() {
		return this.#value;
	}
};
function createContext(opts = {}) {
	let currentInstance;
	let isSingleton = false;
	const checkConflict = (instance) => {
		if (currentInstance && currentInstance !== instance) throw new Error("Context conflict");
	};
	let als;
	if (opts.asyncContext) {
		const _AsyncLocalStorage = opts.AsyncLocalStorage || _getAsyncLocalStorage();
		if (_AsyncLocalStorage) als = new _AsyncLocalStorage();
		else console.warn("[unctx] `AsyncLocalStorage` is not provided.");
	}
	const _wrapInstance = (instance) => als && instance !== null && typeof instance === "object" ? { __unctx_weak: new _WeakRef(instance) } : instance;
	const _unwrapInstance = (store) => store && store.__unctx_weak ? store.__unctx_weak.deref() : store;
	const _getCurrentInstance = () => {
		if (als) {
			const store = als.getStore();
			if (store !== void 0) return _unwrapInstance(store);
		}
		return currentInstance;
	};
	return {
		use: () => {
			const _instance = _getCurrentInstance();
			if (_instance === void 0) throw new Error("Context is not available");
			return _instance;
		},
		tryUse: () => {
			return _getCurrentInstance() ?? null;
		},
		set: (instance, replace) => {
			if (!replace) checkConflict(instance);
			currentInstance = instance;
			isSingleton = true;
		},
		unset: () => {
			currentInstance = void 0;
			isSingleton = false;
		},
		call: (instance, callback) => {
			checkConflict(instance);
			currentInstance = instance;
			try {
				return als ? als.run(_wrapInstance(instance), callback) : callback();
			} finally {
				if (!isSingleton) currentInstance = void 0;
			}
		},
		async callAsync(instance, callback) {
			currentInstance = instance;
			const onRestore = () => {
				currentInstance = instance;
			};
			const onLeave = () => currentInstance === instance ? onRestore : void 0;
			asyncHandlers.add(onLeave);
			try {
				const r = als ? als.run(_wrapInstance(instance), callback) : callback();
				if (!isSingleton) currentInstance = void 0;
				return await r;
			} finally {
				asyncHandlers.delete(onLeave);
			}
		}
	};
}
function createNamespace(defaultOpts = {}) {
	const contexts = {};
	return { get(key, opts = {}) {
		if (!contexts[key]) contexts[key] = createContext({
			...defaultOpts,
			...opts
		});
		return contexts[key];
	} };
}
const _globalThis = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof global !== "undefined" ? global : {};
const globalKey = "__unctx__";
const defaultNamespace = _globalThis[globalKey] || (_globalThis[globalKey] = createNamespace());
const getContext = (key, opts = {}) => defaultNamespace.get(key, opts);
const asyncHandlersKey = "__unctx_async_handlers__";
const asyncHandlers = _globalThis[asyncHandlersKey] || (_globalThis[asyncHandlersKey] = /* @__PURE__ */ new Set());

function flatHooks(configHooks, hooks = {}, parentName) {
	for (const key in configHooks) {
		const subHook = configHooks[key];
		const name = parentName ? `${parentName}:${key}` : key;
		if (typeof subHook === "object" && subHook !== null) flatHooks(subHook, hooks, name);
		else if (typeof subHook === "function") hooks[name] = subHook;
	}
	return hooks;
}
const createTask = /* @__PURE__ */ (() => {
	if (console.createTask) return console.createTask;
	const defaultTask = { run: (fn) => fn() };
	return () => defaultTask;
})();
function callHooks(hooks, args, startIndex, task) {
	for (let i = startIndex; i < hooks.length; i += 1) try {
		const result = task ? task.run(() => hooks[i](...args)) : hooks[i](...args);
		if (result && typeof result.then === "function") return Promise.resolve(result).then(() => callHooks(hooks, args, i + 1, task));
	} catch (error) {
		return Promise.reject(error);
	}
}
function serialTaskCaller(hooks, args, name) {
	if (hooks.length > 0) return callHooks(hooks, args, 0, createTask(name));
}
function parallelTaskCaller(hooks, args, name) {
	if (hooks.length > 0) {
		const task = createTask(name);
		return Promise.all(hooks.map((hook) => task.run(() => hook(...args))));
	}
}
function callEachWith(callbacks, arg0) {
	for (const callback of [...callbacks]) callback(arg0);
}
var Hookable = class {
	_hooks;
	_before;
	_after;
	_deprecatedHooks;
	_deprecatedMessages;
	constructor() {
		this._hooks = {};
		this._before = void 0;
		this._after = void 0;
		this._deprecatedMessages = void 0;
		this._deprecatedHooks = {};
		this.hook = this.hook.bind(this);
		this.callHook = this.callHook.bind(this);
		this.callHookWith = this.callHookWith.bind(this);
	}
	hook(name, function_, options = {}) {
		if (!name || typeof function_ !== "function") return () => {};
		const originalName = name;
		let dep;
		while (this._deprecatedHooks[name]) {
			dep = this._deprecatedHooks[name];
			name = dep.to;
		}
		if (dep && !options.allowDeprecated) {
			let message = dep.message;
			if (!message) message = `${originalName} hook has been deprecated` + (dep.to ? `, please use ${dep.to}` : "");
			if (!this._deprecatedMessages) this._deprecatedMessages = /* @__PURE__ */ new Set();
			if (!this._deprecatedMessages.has(message)) {
				console.warn(message);
				this._deprecatedMessages.add(message);
			}
		}
		if (!function_.name) try {
			Object.defineProperty(function_, "name", {
				get: () => "_" + name.replace(/\W+/g, "_") + "_hook_cb",
				configurable: true
			});
		} catch {}
		this._hooks[name] = this._hooks[name] || [];
		this._hooks[name].push(function_);
		return () => {
			if (function_) {
				this.removeHook(name, function_);
				function_ = void 0;
			}
		};
	}
	hookOnce(name, function_) {
		let _unreg;
		let _function = (...arguments_) => {
			if (typeof _unreg === "function") _unreg();
			_unreg = void 0;
			_function = void 0;
			return function_(...arguments_);
		};
		_unreg = this.hook(name, _function);
		return _unreg;
	}
	removeHook(name, function_) {
		const hooks = this._hooks[name];
		if (hooks) {
			const index = hooks.indexOf(function_);
			if (index !== -1) hooks.splice(index, 1);
			if (hooks.length === 0) this._hooks[name] = void 0;
		}
	}
	clearHook(name) {
		this._hooks[name] = void 0;
	}
	deprecateHook(name, deprecated) {
		this._deprecatedHooks[name] = typeof deprecated === "string" ? { to: deprecated } : deprecated;
		const _hooks = this._hooks[name] || [];
		this._hooks[name] = void 0;
		for (const hook of _hooks) this.hook(name, hook);
	}
	deprecateHooks(deprecatedHooks) {
		for (const name in deprecatedHooks) this.deprecateHook(name, deprecatedHooks[name]);
	}
	addHooks(configHooks) {
		const hooks = flatHooks(configHooks);
		const removeFns = Object.keys(hooks).map((key) => this.hook(key, hooks[key]));
		return () => {
			for (const unreg of removeFns) unreg();
			removeFns.length = 0;
		};
	}
	removeHooks(configHooks) {
		const hooks = flatHooks(configHooks);
		for (const key in hooks) this.removeHook(key, hooks[key]);
	}
	removeAllHooks() {
		this._hooks = {};
	}
	callHook(name, ...args) {
		return this.callHookWith(serialTaskCaller, name, args);
	}
	callHookParallel(name, ...args) {
		return this.callHookWith(parallelTaskCaller, name, args);
	}
	callHookWith(caller, name, args) {
		const event = this._before || this._after ? {
			name,
			args,
			context: {}
		} : void 0;
		if (this._before) callEachWith(this._before, event);
		const result = caller(this._hooks[name] ? [...this._hooks[name]] : [], args, name);
		if (result instanceof Promise) return result.finally(() => {
			if (this._after && event) callEachWith(this._after, event);
		});
		if (this._after && event) callEachWith(this._after, event);
		return result;
	}
	beforeEach(function_) {
		this._before = this._before || [];
		this._before.push(function_);
		return () => {
			if (this._before !== void 0) {
				const index = this._before.indexOf(function_);
				if (index !== -1) this._before.splice(index, 1);
			}
		};
	}
	afterEach(function_) {
		this._after = this._after || [];
		this._after.push(function_);
		return () => {
			if (this._after !== void 0) {
				const index = this._after.indexOf(function_);
				if (index !== -1) this._after.splice(index, 1);
			}
		};
	}
};
function createHooks() {
	return new Hookable();
}

// @__NO_SIDE_EFFECTS__
function isUnsafeKey(key) {
  return key === "__proto__" || key === "constructor" || key === "prototype";
}

function walkResolver(val, resolve, key) {
  if (key === "_resolver")
    return val;
  if (typeof val === "function" && (!key || key !== "titleTemplate" && !key.startsWith("on")))
    val = val();
  const v = resolve ? resolve(key, val) : val;
  if (Array.isArray(v)) {
    let out;
    for (let i = 0; i < v.length; i++) {
      const r = walkResolver(v[i], resolve);
      if (out) {
        out[i] = r;
      } else if (r !== v[i]) {
        out = v.slice(0, i);
        out[i] = r;
      }
    }
    return out || v;
  }
  if (v?.constructor === Object) {
    let next;
    for (const k in v) {
      const unsafe = isUnsafeKey(k);
      const r = unsafe ? void 0 : walkResolver(v[k], resolve, k);
      if (!next && (unsafe || r !== v[k])) {
        next = {};
        for (const pk in v) {
          if (pk === k)
            break;
          next[pk] = v[pk];
        }
      }
      if (next && !unsafe)
        next[k] = r;
    }
    return next || v;
  }
  return v;
}

//#region node_modules/nuxt/dist/app/diagnostics/_shared.js
/**
* Shared configuration for the runtime (E<N>xxx) diagnostics catalogs.
*
* Catalogs are split by domain and imported directly where used (no barrel),
* so the browser bundle only pulls in the codes a module references. Pair the
* pure-call annotations on each `defineDiagnostics()` with dev-guarded,
* statement-level report calls so report-only diagnostics strip from production.
*
* Codes are stable, fully-qualified `NUXT_E<NNNN>` identifiers. Codes with a
* dedicated docs page resolve a `see:` URL via {@link docsBase}; the rest opt
* out with `docs: false`.
*/
function docsBase(code) {
	return `https://nuxt.com/docs/4.x/errors/${code.replace("NUXT_", "").toLowerCase()}`;
}
var prodReporter = (diagnostic) => {
	console.error(`[${diagnostic.name}]`);
};
var prodReporters = [prodReporter];
//#endregion
//#region node_modules/nuxt/dist/app/diagnostics/core.js
/**
* E1xxx
* Core / Nuxt-instance / lifecycle runtime diagnostics.
*/
var appDiagnostics = /* #__PURE__ */ defineProdDiagnostics({
	docsBase,
	reporters: prodReporters
});
//#endregion
//#region node_modules/nuxt/dist/app/internal/context.js
globalThis.__nuxt_app_ctx__ ||= {};
function getContext$1(key, opts) {
	return getContext(key, opts);
}
//#endregion
//#region virtual:nuxt:node_modules%2F.cache%2Fnuxt%2F.nuxt%2Fnuxt.config.mjs
var nuxtLinkDefaults = {
	"componentName": "NuxtLink"};
//#endregion
//#region node_modules/nuxt/dist/app/nuxt.js
function getNuxtAppCtx(id = "nuxt-app") {
	return getContext$1(id, { asyncContext: false });
}
var NuxtPluginIndicator = "__nuxt_plugin";
/** @since 3.0.0 */
function createNuxtApp(options) {
	let hydratingCount = 0;
	const nuxtApp = {
		_id: options.id || "nuxt-app",
		_scope: effectScope(),
		provide: void 0,
		versions: {
			get nuxt() {
				return "4.6.1";
			},
			get vue() {
				return nuxtApp.vueApp.version;
			}
		},
		payload: shallowReactive({
			...options.ssrContext?.payload || {},
			data: shallowReactive({}),
			state: reactive({}),
			once: /* @__PURE__ */ new Set(),
			_errors: shallowReactive({})
		}),
		static: { data: {} },
		runWithContext(fn) {
			if (nuxtApp._scope.active && !getCurrentScope()) return nuxtApp._scope.run(() => callWithNuxt(nuxtApp, fn));
			return callWithNuxt(nuxtApp, fn);
		},
		isHydrating: false,
		deferHydration() {
			if (!nuxtApp.isHydrating) return () => {};
			hydratingCount++;
			let called = false;
			return () => {
				if (called) return;
				called = true;
				hydratingCount--;
				if (hydratingCount === 0) {
					nuxtApp.isHydrating = false;
					return nuxtApp.callHook("app:suspense:resolve");
				}
			};
		},
		_asyncDataPromises: {},
		_asyncData: shallowReactive({}),
		_state: shallowReactive({}),
		_payloadRevivers: {},
		...options
	};
	nuxtApp.payload.serverRendered = true;
	if (nuxtApp.ssrContext) {
		nuxtApp.payload.path = nuxtApp.ssrContext.url;
		nuxtApp.ssrContext.nuxt = nuxtApp;
		nuxtApp.ssrContext.payload = nuxtApp.payload;
		nuxtApp.ssrContext.config = {
			public: nuxtApp.ssrContext.runtimeConfig.public,
			app: nuxtApp.ssrContext.runtimeConfig.app
		};
	}
	nuxtApp.hooks = createHooks();
	nuxtApp.hook = nuxtApp.hooks.hook;
	{
		const runHooks = async (hooks, args) => {
			for (const hook of hooks) await nuxtApp.runWithContext(() => hook(...args));
		};
		const contextCaller = runHooks;
		nuxtApp.hooks.callHook = (name, ...args) => nuxtApp.hooks.callHookWith(contextCaller, name, args);
	}
	nuxtApp.callHook = nuxtApp.hooks.callHook;
	nuxtApp.provide = (name, value) => {
		const $name = "$" + name;
		defineGetter(nuxtApp, $name, value);
		defineGetter(nuxtApp.vueApp.config.globalProperties, $name, value);
	};
	defineGetter(nuxtApp.vueApp, "$nuxt", nuxtApp);
	defineGetter(nuxtApp.vueApp.config.globalProperties, "$nuxt", nuxtApp);
	const runtimeConfig = options.ssrContext.runtimeConfig;
	nuxtApp.provide("config", runtimeConfig);
	return nuxtApp;
}
/** @since 3.0.0 */
async function applyPlugin(nuxtApp, plugin) {
	if (typeof plugin === "function") {
		const run = () => nuxtApp.runWithContext(() => plugin(nuxtApp));
		const { provide } = await run() || {};
		if (provide && typeof provide === "object") for (const key in provide) nuxtApp.provide(key, provide[key]);
	}
}
/** @since 3.0.0 */
async function applyPlugins(nuxtApp, plugins) {
	let error;
	for (const plugin of plugins) try {
		await applyPlugin(nuxtApp, plugin);
	} catch (e) {
		if (!nuxtApp.payload.error) throw e;
		error ||= e;
	}
	if (error) throw nuxtApp.payload.error || error;
}
/** @since 3.0.0 */
/* @__NO_SIDE_EFFECTS__ */
function defineNuxtPlugin(plugin) {
	if (typeof plugin === "function") return plugin;
	const _name = plugin._name || plugin.name;
	delete plugin.name;
	return Object.assign(plugin.setup || (() => {}), plugin, {
		[NuxtPluginIndicator]: true,
		_name
	});
}
/**
* Ensures that the setup function passed in has access to the Nuxt instance via `useNuxtApp`.
* @param nuxt A Nuxt instance
* @param setup The function to call
* @since 3.0.0
*/
function callWithNuxt(nuxt, setup, args) {
	const fn = () => setup();
	const nuxtAppCtx = getNuxtAppCtx(nuxt._id);
	return nuxt.vueApp.runWithContext(() => nuxtAppCtx.callAsync(nuxt, fn));
}
function tryUseNuxtApp(id) {
	let nuxtAppInstance;
	if (hasInjectionContext()) nuxtAppInstance = getCurrentInstance()?.appContext.app.$nuxt;
	nuxtAppInstance ||= getNuxtAppCtx(id).tryUse();
	return nuxtAppInstance || null;
}
function useNuxtApp(id) {
	const nuxtAppInstance = tryUseNuxtApp(id);
	if (!nuxtAppInstance) throw appDiagnostics.NUXT_E1001();
	return nuxtAppInstance;
}
/** @since 3.0.0 */
/* @__NO_SIDE_EFFECTS__ */
function useRuntimeConfig(_event) {
	return useNuxtApp().$config;
}
function defineGetter(obj, key, val) {
	Object.defineProperty(obj, key, { get: () => val });
}
//#endregion
//#region node_modules/nuxt/dist/app/error.js
var NUXT_ERROR_SIGNATURE = "__nuxt_error";
/** @since 3.0.0 */
var isNuxtError = (error) => !!error && typeof error === "object" && "__nuxt_error" in error;
/** @since 3.0.0 */
var createError$1 = (error) => {
	if (isNuxtError(error)) return error;
	if (typeof error !== "string" && error?.statusText) error.message ??= error.statusText;
	const nuxtError = createError(error ?? {});
	Object.defineProperty(nuxtError, NUXT_ERROR_SIGNATURE, {
		value: true,
		configurable: false,
		writable: false
	});
	Object.defineProperty(nuxtError, "status", {
		get: () => nuxtError.statusCode,
		configurable: true
	});
	Object.defineProperty(nuxtError, "statusText", {
		get: () => nuxtError.statusMessage,
		configurable: true
	});
	return nuxtError;
};
//#endregion
//#region node_modules/nuxt/dist/app/utils.js
var PROBE_BASE_A = "https://a.invalid/probe/";
var PROBE_BASE_B = "https://b.invalid/probe/";
function parseAnchorURL(value, base = PROBE_BASE_A) {
	try {
		return new URL(value, base);
	} catch {
		return null;
	}
}
/** Whether a URL string is a path rooted at the current origin, so carries no protocol. */
function isRootedPath(value) {
	return value[0] === "/" && value[1] !== "/" && value[1] !== "\\";
}
/** Whether a URL string carries its own protocol or authority. */
function isAbsoluteHref(value) {
	if (!value || isRootedPath(value)) return false;
	const resolved = parseAnchorURL(value);
	return !!resolved && resolved.href === parseAnchorURL(value, PROBE_BASE_B)?.href;
}
/** The script-capable protocol a URL string would navigate to, or `null` when it is safe. */
function getScriptProtocol(value) {
	if (!value || isRootedPath(value)) return null;
	let resolved = parseAnchorURL(value.replace(/[\u0000-\u001F\u007F\s]+/g, ""));
	while (resolved?.protocol === "view-source:") resolved = parseAnchorURL(resolved.pathname);
	if (!resolved) return "";
	return isScriptProtocol(resolved.protocol) ? resolved.protocol : null;
}
/** Returns the value unchanged when safe to use as an anchor `href`, or `null`. */
function sanitizeAnchorHref(value) {
	return getScriptProtocol(value) === null ? value : null;
}
//#endregion
//#region node_modules/nuxt/dist/app/components/injections.js
var PageRouteSymbol = Symbol("route");
//#endregion
//#region node_modules/nuxt/dist/app/diagnostics/navigation.js
/**
* E2xxx
* Navigation / routing / middleware runtime diagnostics.
*/
var navigationDiagnostics = /* #__PURE__ */ defineProdDiagnostics({
	docsBase,
	reporters: prodReporters
});
//#endregion
//#region node_modules/nuxt/dist/app/composables/router.js
/** @since 3.0.0 */
var useRouter = (() => {
	return useNuxtApp()?.$router;
});
/**
* Whether the current effect scope is (a descendant of) the component instance's scope.
* A detached scope (e.g. `createSharedComposable`) outlives the component, so the
* per-page route injected there would freeze after navigation (#18903).
*/
function getParentScope(scope) {
	const internal = scope;
	return internal.parent ?? internal.subs?.sub;
}
function isScopeWithinInstance(instance) {
	const instanceScope = instance.scope;
	let scope = getCurrentScope();
	while (scope) {
		if (scope === instanceScope) return true;
		scope = getParentScope(scope);
	}
	return false;
}
/** @since 3.0.0 */
var useRoute = (() => {
	if (hasInjectionContext()) {
		const instance = getCurrentInstance();
		if (!instance || isScopeWithinInstance(instance)) return inject(PageRouteSymbol, useNuxtApp()._route);
	}
	return useNuxtApp()._route;
});
/** @since 3.0.0 */
/* @__NO_SIDE_EFFECTS__ */
function defineNuxtRouteMiddleware(middleware) {
	return middleware;
}
/** @since 3.0.0 */
var isProcessingMiddleware = () => {
	try {
		if (useNuxtApp()._processingMiddleware) return true;
	} catch {
		return false;
	}
	return false;
};
var HTML_ATTR_UNSAFE_RE = /[&"'<>]/g;
var HTML_ATTR_ENCODE_MAP = {
	"&": "&amp;",
	"\"": "&quot;",
	"'": "&#x27;",
	"<": "&lt;",
	">": "&gt;"
};
function encodeForHtmlAttr(value) {
	return value.replace(HTML_ATTR_UNSAFE_RE, (c) => HTML_ATTR_ENCODE_MAP[c]);
}
/**
* A helper that aids in programmatic navigation within your Nuxt application.
*
* Can be called on the server and on the client, within pages, route middleware, plugins, and more.
* @param {RouteLocationRaw | undefined | null} [to] - The route to navigate to. Accepts a route object, string path, `undefined`, or `null`. Defaults to '/'.
* @param {NavigateToOptions} [options] - Optional customization for controlling the behavior of the navigation.
* @returns {Promise<void | NavigationFailure | false> | false | void | RouteLocationRaw} The navigation result, which varies depending on context and options.
* @see https://nuxt.com/docs/4.x/api/utils/navigate-to
* @since 3.0.0
*/
var navigateTo = (to, options) => {
	to ||= "/";
	const toPath = typeof to === "string" ? to : "path" in to ? resolveRouteObject(to) : useRouter().resolve(to).href;
	const isExternalHost = isAbsoluteHref(toPath);
	const isExternal = options?.external || isExternalHost;
	if (isExternal) {
		if (!options?.external) throw navigationDiagnostics.NUXT_E2001({ toPath });
		const protocol = getScriptProtocol(toPath);
		if (protocol !== null) throw navigationDiagnostics.NUXT_E2002({
			toPath,
			protocol
		});
	}
	const inMiddleware = isProcessingMiddleware();
	const router = useRouter();
	const nuxtApp = useNuxtApp();
	if (nuxtApp.ssrContext) {
		const fullPath = typeof to === "string" || isExternal ? toPath : router.resolve(to).fullPath || "/";
		const location = isExternal ? toPath : joinURL((/* @__PURE__ */ useRuntimeConfig()).app.baseURL, fullPath);
		const redirect = async function(response) {
			await nuxtApp.callHook("app:redirected");
			const encodedHeader = encodeURL(location, isExternalHost);
			const encodedLoc = encodeForHtmlAttr(encodedHeader);
			nuxtApp.ssrContext["~renderResponse"] = {
				statusCode: sanitizeStatusCode(options?.redirectCode || 302, 302),
				body: `<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=${encodedLoc}"></head></html>`,
				headers: { location: encodedHeader }
			};
			return response;
		};
		if (!isExternal && inMiddleware) {
			let expectedPath = fullPath;
			if (typeof to === "string" && toPath.includes("?")) {
				const target = router.resolve(to);
				expectedPath = router.resolve({
					path: target.path,
					query: target.query,
					hash: target.hash
				}).fullPath || "/";
			}
			router.afterEach((final) => final.fullPath === expectedPath ? redirect(false) : void 0);
			return to;
		}
		return redirect(!inMiddleware ? void 0 : false);
	}
	if (isExternal) {
		nuxtApp._scope.stop();
		if (options?.replace) (void 0).replace(toPath);
		else (void 0).href = toPath;
		if (inMiddleware) {
			if (!nuxtApp.isHydrating) return false;
			return new Promise(() => {});
		}
		return Promise.resolve();
	}
	const encodedTo = typeof to === "string" ? encodeRoutePath(to) : to;
	return options?.replace ? router.replace(encodedTo) : router.push(encodedTo);
};
/**
* @internal
*/
function resolveRouteObject(to) {
	return withQuery(to.path || "", to.query || {}) + (to.hash || "");
}
/**
* @internal
*/
function encodeURL(location, isExternalHost = false) {
	const url = new URL(location, "http://localhost");
	if (!isExternalHost) return url.pathname.replace(/^\/{2,}/, "/") + url.search + url.hash;
	if (location.startsWith("//")) return url.toString().replace(url.protocol, "");
	return url.toString();
}
/**
* Encode the pathname of a route location string. Ensures decoded paths like
* `/café` are percent-encoded to match vue-router's encoded route records.
* Already-encoded paths are not double-encoded.
* @internal
*/
function encodeRoutePath(url) {
	const parsed = parseURL(url);
	return encodeVueRouterPath(decodePath(parsed.pathname)) + parsed.search + parsed.hash;
}
var ENC_PIPE_RE = /%7C/g;
var ENC_BRACKET_OPEN_RE = /%5B/g;
var ENC_BRACKET_CLOSE_RE = /%5D/g;
var ENC_ENC_SLASH_RE = /%252F/gi;
var HASH_RE = /#/g;
var QUESTION_MARK_RE = /\?/g;
/**
* Apply vue-router's own path encoding, which leaves sub-delimiters like `&`
* and `+` literal. This must stay in sync with `encodeVueRouterPath` in
* `unrouting`, which encodes the route records we need to match against.
*/
function encodeVueRouterPath(value) {
	return encodeURI(value).replace(ENC_PIPE_RE, "|").replace(ENC_BRACKET_OPEN_RE, "[").replace(ENC_BRACKET_CLOSE_RE, "]").replace(HASH_RE, "%23").replace(QUESTION_MARK_RE, "%3F").replace(ENC_ENC_SLASH_RE, "%2F");
}
//#endregion
//#region node_modules/nuxt/dist/app/composables/error.js
/** @since 3.0.0 */
var useError = /* @__NO_SIDE_EFFECTS__ */ () => toRef(useNuxtApp().payload, "error");
/** @since 3.0.0 */
var showError = (error) => {
	const nuxtError = createError$1(error);
	try {
		const error = /* @__PURE__ */ useError();
		error.value ||= nuxtError;
	} catch {
		throw nuxtError;
	}
	return nuxtError;
};
//#endregion
//#region virtual:nuxt:node_modules%2F.cache%2Fnuxt%2F.nuxt%2Ffetch.mjs
if (!globalThis.$fetch) globalThis.$fetch = $fetch.create({ baseURL: baseURL() });
//#endregion
//#region virtual:nuxt:node_modules%2F.cache%2Fnuxt%2F.nuxt%2Fglobal-polyfills.mjs
if (!("global" in globalThis)) globalThis.global = globalThis;
//#endregion
//#region node_modules/nuxt/dist/head/runtime/island-head.js
/**
* No-op `head.push` until the returned `unfreeze` runs. Plugin/transformer
* augmentations on the same head are unaffected.
*/
function freezeHead(head) {
	const realPush = head.push;
	head.push = () => ({
		dispose: () => {},
		patch: () => {},
		_i: 0
	});
	return () => {
		head.push = realPush;
	};
}
//#endregion
//#region node_modules/nuxt/dist/head/runtime/plugins/unhead.server.js
var plugin$2 = /* @__PURE__ */ defineNuxtPlugin({
	name: "nuxt:head",
	enforce: "pre",
	setup(nuxtApp) {
		const head = nuxtApp.ssrContext.head;
		if (nuxtApp.ssrContext.islandContext) {
			const unfreeze = freezeHead(head);
			nuxtApp.hooks.hookOnce("app:created", unfreeze);
		}
		nuxtApp.vueApp.use(head);
	}
});
//#endregion
//#region node_modules/nuxt/dist/app/diagnostics/manifest.js
/**
* E5xxx
* App manifest / route-rules runtime diagnostics.
*/
var manifestDiagnostics = /* #__PURE__ */ defineProdDiagnostics({
	docsBase,
	reporters: prodReporters
});
//#endregion
//#region virtual:nuxt:node_modules%2F.cache%2Fnuxt%2F.nuxt%2Froute-rules.mjs
var virtual_nuxt_node_modules_2F_cache_2Fnuxt_2F_nuxt_2Froute_rules_default = () => ({});
//#endregion
//#region node_modules/nuxt/dist/app/composables/manifest.js
function routeRulesMatcher(path) {
	return virtual_nuxt_node_modules_2F_cache_2Fnuxt_2F_nuxt_2Froute_rules_default();
}
function getRouteRules(arg) {
	const path = typeof arg === "string" ? arg : arg.path;
	try {
		return routeRulesMatcher(path);
	} catch (e) {
		manifestDiagnostics.NUXT_E5003({
			path,
			cause: e
		});
		return {};
	}
}
//#endregion
//#region virtual:nuxt:node_modules%2F.cache%2Fnuxt%2F.nuxt%2Fmiddleware.mjs
var globalMiddleware = [/* @__PURE__ */ defineNuxtRouteMiddleware((to) => {})];
//#endregion
//#region node_modules/nuxt/dist/app/plugins/router.js
var LITERAL_PATH_RE = /^\/[\w\-./~!$&'()*+,;=:@]*$/;
/** Split a rooted path as the `URL` parser would, or `undefined` if it needs the parser. */
function splitLiteralPath(fullPath) {
	const hashIndex = fullPath.indexOf("#");
	const withoutHash = hashIndex === -1 ? fullPath : fullPath.slice(0, hashIndex);
	const searchIndex = withoutHash.indexOf("?");
	const path = searchIndex === -1 ? withoutHash : withoutHash.slice(0, searchIndex);
	if (path.includes("/.") || !LITERAL_PATH_RE.test(path)) return;
	return {
		path,
		search: searchIndex === -1 ? "" : withoutHash.slice(searchIndex),
		hash: hashIndex === -1 || hashIndex === fullPath.length - 1 ? "" : fullPath.slice(hashIndex)
	};
}
function getRouteFromPath(fullPath, baseURL = "/") {
	const route = fullPath && typeof fullPath === "object" ? fullPath : {};
	if (typeof fullPath === "object") fullPath = stringifyParsedURL({
		pathname: fullPath.path || "",
		search: stringifyQuery(fullPath.query || {}),
		hash: fullPath.hash || ""
	});
	const isRooted = isRootedPath(fullPath);
	let parts = isRooted ? splitLiteralPath(fullPath) : void 0;
	if (!parts) {
		const url = new URL(fullPath, "http://localhost");
		parts = {
			path: url.pathname,
			search: url.search,
			hash: url.hash
		};
	}
	return {
		path: parts.path,
		fullPath,
		query: parts.search ? parseQuery(parts.search) : {},
		hash: parts.hash,
		params: route.params || {},
		name: void 0,
		matched: route.matched || [],
		redirectedFrom: void 0,
		meta: route.meta || {},
		href: isRooted ? baseURL === "/" ? fullPath : joinURL(baseURL, fullPath) : sanitizeAnchorHref(fullPath)
	};
}
var plugin$1 = /* @__PURE__ */ defineNuxtPlugin({
	name: "nuxt:router",
	enforce: "pre",
	setup(nuxtApp) {
		const initialURL = nuxtApp.ssrContext.url;
		const routes = [];
		const hooks = {
			"navigate:before": [],
			"resolve:before": [],
			"navigate:after": [],
			"error": []
		};
		const registerHook = (hook, guard) => {
			hooks[hook].push(guard);
			return () => {
				const index = hooks[hook].indexOf(guard);
				if (index !== -1) hooks[hook].splice(index, 1);
			};
		};
		const baseURL = (/* @__PURE__ */ useRuntimeConfig()).app.baseURL;
		const route = reactive(getRouteFromPath(initialURL, baseURL));
		let navigationCounter = 0;
		async function handleNavigation(url, replace) {
			const navigationId = ++navigationCounter;
			try {
				const to = getRouteFromPath(url, baseURL);
				for (const middleware of hooks["navigate:before"]) {
					const result = await middleware(to, route);
					if (navigationId !== navigationCounter) return;
					if (result === false || result instanceof Error) return;
					if (typeof result === "string" && result.length) return await handleNavigation(result, true);
				}
				for (const handler of hooks["resolve:before"]) {
					await handler(to, route);
					if (navigationId !== navigationCounter) return;
				}
				Object.assign(route, to);
				for (const middleware of hooks["navigate:after"]) await middleware(to, route);
			} catch (err) {
				for (const handler of hooks.error) await handler(err);
			} finally {
				if (navigationId === navigationCounter) {
					delete nuxtApp._processingMiddleware;
					delete nuxtApp._middlewareTo;
				}
			}
		}
		const router = {
			currentRoute: computed(() => route),
			isReady: () => Promise.resolve(),
			options: {},
			install: () => Promise.resolve(),
			push: (url) => handleNavigation(url),
			replace: (url) => handleNavigation(url),
			back: () => (void 0).history.go(-1),
			go: (delta) => (void 0).history.go(delta),
			forward: () => (void 0).history.go(1),
			beforeResolve: (guard) => registerHook("resolve:before", guard),
			beforeEach: (guard) => registerHook("navigate:before", guard),
			afterEach: (guard) => registerHook("navigate:after", guard),
			onError: (handler) => registerHook("error", handler),
			resolve: (url) => getRouteFromPath(url, baseURL),
			addRoute: (parentName, route) => {
				routes.push(route);
			},
			getRoutes: () => routes,
			hasRoute: (name) => routes.some((route) => route.name === name),
			removeRoute: (name) => {
				const index = routes.findIndex((route) => route.name === name);
				if (index !== -1) routes.splice(index, 1);
			}
		};
		nuxtApp.vueApp.component("RouterLink", defineComponent({
			functional: true,
			props: {
				to: {
					type: String,
					required: true
				},
				custom: Boolean,
				replace: Boolean,
				activeClass: String,
				exactActiveClass: String,
				ariaCurrentValue: String
			},
			setup: (props, { slots }) => {
				const navigate = () => handleNavigation(props.to, props.replace);
				const resolved = computed(() => router.resolve(props.to));
				const isExternal = computed(() => isAbsoluteHref(props.to));
				return () => {
					const href = resolved.value.href;
					if (props.custom) return slots.default?.({
						href,
						navigate,
						route: resolved.value
					});
					if (isExternal.value) return h("a", { href }, slots);
					return h("a", {
						href,
						onClick: (e) => {
							e.preventDefault();
							return navigate();
						}
					}, slots);
				};
			}
		}));
		nuxtApp._route = route;
		nuxtApp._middleware ||= {
			global: [],
			named: {}
		};
		const initialLayout = nuxtApp.payload.state._layout;
		const initialLayoutProps = nuxtApp.payload.state._layoutProps;
		nuxtApp.hooks.hookOnce("app:created", async () => {
			router.beforeEach(async (to, from) => {
				to.meta = reactive(to.meta || {});
				if (nuxtApp.isHydrating && initialLayout && !isReadonly(to.meta.layout)) {
					to.meta.layout = initialLayout;
					to.meta.layoutProps = initialLayoutProps;
				}
				nuxtApp._processingMiddleware = true;
				nuxtApp._middlewareTo = to;
				if (!nuxtApp.ssrContext?.islandContext) {
					const middlewareEntries = /* @__PURE__ */ new Set([...globalMiddleware, ...nuxtApp._middleware.global]);
					const routeRules = getRouteRules({ path: to.path });
					if (routeRules.appMiddleware) for (const key in routeRules.appMiddleware) {
						const guard = nuxtApp._middleware.named[key];
						if (!guard) continue;
						if (routeRules.appMiddleware[key]) middlewareEntries.add(guard);
						else middlewareEntries.delete(guard);
					}
					for (const middleware of middlewareEntries) {
						const run = () => nuxtApp.runWithContext(() => middleware(to, from));
						const result = await run();
						if (result === false || result instanceof Error) {
							const error = result || createError({
								status: 404,
								statusText: `Page Not Found: ${initialURL}`,
								data: { path: initialURL }
							});
							delete nuxtApp._processingMiddleware;
							delete nuxtApp._middlewareTo;
							return nuxtApp.runWithContext(() => showError(error));
						}
						if (result === true) continue;
						if (result || result === false) return result;
					}
				}
			});
			router.afterEach(() => {
				delete nuxtApp._processingMiddleware;
				delete nuxtApp._middlewareTo;
			});
			await router.replace(initialURL);
			if (!isEqual(route.fullPath, initialURL)) await nuxtApp.runWithContext(() => navigateTo(route.fullPath));
		});
		return { provide: {
			route,
			router
		} };
	}
});
//#endregion
//#region node_modules/nuxt/dist/app/diagnostics/head.js
/**
* E6xxx
* Head / unhead runtime diagnostics.
*/
var unheadDiagnostics = /* #__PURE__ */ defineProdDiagnostics({
	docsBase,
	reporters: prodReporters
});
//#endregion
//#region node_modules/@unhead/vue/dist/shared/vue.DKb5ZKVl.mjs
var headSymbol = "usehead";
// @__NO_SIDE_EFFECTS__
function injectHead$1() {
	if (hasInjectionContext()) {
		const instance = inject(headSymbol);
		if (instance) return instance;
	}
	throw new Error("useHead() was called without provide context, ensure you call it through the setup() function.");
}
//#endregion
//#region node_modules/@unhead/vue/dist/shared/vue.D2XR8FqS.mjs
var VueResolver = /* @__PURE__ */ Object.assign((_, value) => isRef(value) ? toValue(value) : value, { _static: true });
//#endregion
//#region node_modules/@unhead/vue/dist/shared/vue.CXwiCT15.mjs
function useHead$1(input, options = {}) {
	const head = options.head || /* @__PURE__ */ injectHead$1();
	return head.ssr ? head.push(input || {}, options) : clientUseHead(head, input, options);
}
function clientUseHead(head, input, options = {}) {
	const scope = getCurrentScope();
	if (scope && !scope.active) return {
		patch() {},
		dispose() {},
		_i: -1
	};
	const deactivated = ref(false);
	if (options.onRendered && scope) {
		const _onRendered = options.onRendered;
		options = {
			...options,
			onRendered: (ctx) => scope.run(() => _onRendered(ctx))
		};
	}
	let entry;
	watchEffect(() => {
		const i = deactivated.value ? {} : walkResolver(input, VueResolver);
		if (entry) entry.patch(i);
		else entry = head.push(i, options);
	});
	if (getCurrentInstance()) ; else if (scope) onScopeDispose(() => entry.dispose());
	return entry;
}
//#endregion
//#region node_modules/nuxt/dist/head/runtime/composables.js
/**
* Injects the head client from the Nuxt context or Vue inject.
*/
function injectHead(nuxtApp) {
	const nuxt = nuxtApp || useNuxtApp();
	return nuxt.ssrContext?.head || nuxt.runWithContext(() => {
		if (hasInjectionContext()) {
			const head = inject("usehead");
			if (!head) throw unheadDiagnostics.NUXT_E6001();
			return head;
		}
	});
}
function useHead(input, options = {}) {
	return useHead$1(input, {
		head: options.head || injectHead(options.nuxt),
		...options
	});
}
//#endregion
//#region node_modules/nuxt/dist/app/composables/payload.js
/**
* This is an experimental function for configuring passing rich data from server -> client.
* @since 3.4.0
*/
function definePayloadReducer(name, reduce) {
	useNuxtApp().ssrContext["~payloadReducers"][name] = reduce;
}
//#endregion
//#region node_modules/nuxt/dist/app/plugins/revive-payload.server.js
var reducers = [
	["NuxtError", (data) => isNuxtError(data) && data.toJSON()],
	["EmptyShallowRef", (data) => isRef(data) && isShallow(data) && !data.value && (typeof data.value === "bigint" ? "0n" : JSON.stringify(data.value) || "_")],
	["EmptyRef", (data) => isRef(data) && !data.value && (typeof data.value === "bigint" ? "0n" : JSON.stringify(data.value) || "_")],
	["ShallowRef", (data) => isRef(data) && isShallow(data) && data.value],
	["ShallowReactive", (data) => isReactive(data) && isShallow(data) && toRaw(data)],
	["Ref", (data) => isRef(data) && data.value],
	["Reactive", (data) => isReactive(data) && toRaw(data)]
];
//#endregion
//#region virtual:nuxt:node_modules%2F.cache%2Fnuxt%2F.nuxt%2Fplugins.server.mjs
var virtual_nuxt_node_modules_2F_cache_2Fnuxt_2F_nuxt_2Fplugins_server_default = [
	plugin$2,
	plugin$1,
	/* @__PURE__ */ defineNuxtPlugin({
		name: "nuxt:revive-payload:server",
		setup() {
			for (const [reducer, fn] of reducers) definePayloadReducer(reducer, fn);
		}
	}),
	/* @__PURE__ */ defineNuxtPlugin({ name: "nuxt:global-components" })
];
//#endregion
//#region \0virtual:public?%2Fdemo-phone.png
var _virtual_public__2Fdemo_phone_default = publicAssetsURL("/demo-phone.png");
//#endregion
//#region \0virtual:public?%2Fdemo-headphones.png
var _virtual_public__2Fdemo_headphones_default = publicAssetsURL("/demo-headphones.png");
//#endregion
//#region \0virtual:public?%2Fdemo-pc.png
var _virtual_public__2Fdemo_pc_default = publicAssetsURL("/demo-pc.png");
//#endregion
//#region components/CosmosSections.vue?vue&type=script&setup=true&lang.ts
var CosmosSections_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "CosmosSections",
	__ssrInlineRender: true,
	setup(__props) {
		return (_ctx, _push, _parent, _attrs) => {
			_push(`<div${ssrRenderAttrs(_attrs)}><div class="scroll-progress" style="${ssrRenderStyle({ "transform": "scaleX(0)" })}" aria-hidden="true"></div><section id="experience" class="portal-journey"><div class="portal-sticky"><span class="portal-overline">AN INTERACTIVE JOURNEY / 01</span><div class="portal-glow"></div><div class="portal-torus"><div class="portal-torus-inner"></div><div class="portal-torus-planet"></div><span class="portal-torus-star star-one">✳</span><span class="portal-torus-star star-two">✦</span></div><div class="portal-title-wrap"><span class="portal-side-number">001 // ENTER THE ORBIT</span><h2 class="portal-title">BEYOND THE<br><span>ORDINARY.</span></h2><p>Scroll deeper. Discover the ideas, the craft and the interfaces behind every project.</p></div><span class="portal-bottom-label">DESIGN × CODE × INTERACTION</span><span class="portal-bottom-index">↓ KEEP EXPLORING</span></div></section><section id="about" class="about-section content-width section-space"><div class="chapter-heading" data-reveal><span class="chapter-index">01 / ABOUT ME</span><span class="chapter-dash"></span></div><div class="about-grid"><div class="about-copy" data-reveal><h2>I DON&#39;T JUST<br>BUILD <span class="warm-text">WEBSITES.</span><br>I BUILD <span class="serif-outline">FEELING.</span></h2><p>I&#39;m Amir, a frontend developer specializing in Vue.js and Nuxt.js. I love taking a complex idea and turning it into a clean, thoughtful and memorable digital experience — with the engineering to back it up.</p><a href="#projects" class="text-link" data-cursor="GO">Discover my work <span>↗</span></a></div><div class="about-art" aria-hidden="true"><div class="about-mini-planet"><div class="planet-land"></div></div><span class="orbit-tick orbit-tick-a">◈</span><span class="orbit-tick orbit-tick-b">✳</span><div class="quote-card glass-panel"><span>THE MISSION</span><p>Make the web feel a little more <em>alive.</em></p></div></div></div><div class="facts-strip" data-reveal><div><strong>03</strong><span>SELECTED WORKS</span></div><div><strong>VUE<span class="warm-text">/</span>NUXT</strong><span>PRIMARY FOCUS</span></div><div><strong>∞</strong><span>IDEAS TO BUILD</span></div><div class="facts-open"><span class="pulse-dot"></span><strong>OPEN</strong><span>TO OPPORTUNITIES</span></div></div></section><section id="skills" class="skills-section section-space"><div class="content-width"><div class="chapter-heading" data-reveal><span class="chapter-index">02 / MY TOOLKIT</span><span class="chapter-dash"></span></div><div class="skills-header" data-reveal><h2>THE STACK BEHIND<br><span class="warm-text">THE MAGIC.</span></h2><p>Building fast, scalable and accessible experiences with a modern frontend toolkit.</p></div><div class="skill-grid" data-reveal><div class="skill-tile" data-cursor="TECH"><span class="skill-icon" style="${ssrRenderStyle({ "color": "#44d5a0" })}">◇</span><span class="skill-name">Vue.js</span><span class="skill-tile-corner">↗</span></div><div class="skill-tile" data-cursor="TECH"><span class="skill-icon" style="${ssrRenderStyle({ "color": "#36dca1" })}">△</span><span class="skill-name">Nuxt.js</span><span class="skill-tile-corner">↗</span></div><div class="skill-tile" data-cursor="TECH"><span class="skill-icon" style="${ssrRenderStyle({ "color": "#63a7f1" })}">TS</span><span class="skill-name">TypeScript</span><span class="skill-tile-corner">↗</span></div><div class="skill-tile" data-cursor="TECH"><span class="skill-icon" style="${ssrRenderStyle({ "color": "#f6d66c" })}">JS</span><span class="skill-name">JavaScript</span><span class="skill-tile-corner">↗</span></div><div class="skill-tile" data-cursor="TECH"><span class="skill-icon" style="${ssrRenderStyle({ "color": "#65dbf4" })}">≋</span><span class="skill-name">Tailwind CSS</span><span class="skill-tile-corner">↗</span></div><div class="skill-tile" data-cursor="TECH"><span class="skill-icon" style="${ssrRenderStyle({ "color": "#ffc56b" })}">✳</span><span class="skill-name">Pinia</span><span class="skill-tile-corner">↗</span></div><div class="skill-tile" data-cursor="TECH"><span class="skill-icon" style="${ssrRenderStyle({ "color": "#fa845d" })}">⌘</span><span class="skill-name">Git / GitHub</span><span class="skill-tile-corner">↗</span></div><div class="skill-tile" data-cursor="TECH"><span class="skill-icon" style="${ssrRenderStyle({ "color": "#bf9dfa" })}">◎</span><span class="skill-name">SEO / SSR</span><span class="skill-tile-corner">↗</span></div></div><div class="marquee-line" aria-hidden="true"><div>DESIGN <span>✳</span> DEVELOP <span>✳</span> ANIMATE <span>✳</span> OPTIMIZE <span>✳</span> DESIGN <span>✳</span> DEVELOP <span>✳</span> ANIMATE <span>✳</span> OPTIMIZE <span>✳</span></div></div></div></section><section id="projects" class="projects-section"><div class="content-width"><div class="chapter-heading" data-reveal><span class="chapter-index">03 / SELECTED WORK</span><span class="chapter-dash"></span></div><div class="projects-intro" data-reveal><span class="overline">A LITTLE BIT OF EVERYTHING</span><h2>PROJECTS FROM<br>ANOTHER <span class="warm-text">ORBIT.</span></h2><p>Three digital experiences. Three different worlds. Scroll to explore.</p><div class="projects-count">( 001 — 003 )</div></div></div><div class="projects-stage"><article id="nexora" class="project-chapter content-width" style="${ssrRenderStyle({ "--project-accent": "#9f85ff" })}"><div class="chapter-back-number">01</div><div class="project-content" data-project-copy><div class="project-label"><span class="project-label-line"></span> E-COMMERCE / EXPERIENCE</div><span class="project-number">01 <i>/ 03</i></span><h3>NEXORA</h3><p class="project-description">A refined electronics shopping experience with considered product discovery and responsive interfaces.</p><div class="project-tech"><span>Nuxt</span><span>Vue</span><span>TypeScript</span><span>Pinia</span></div><a class="project-link" href="#nexora" data-modal="nexora" data-cursor="VIEW">EXPLORE PROJECT <span>↗</span></a></div><a href="#nexora" class="project-showcase-link" data-modal="nexora"><div class="project-visual" data-project-visual><div class="project-behind-glow"></div><div class="browser-frame browser-nexora" data-cursor="EXPLORE"><div class="browser-bar"><div class="browser-dots"><i></i><i></i><i></i></div><div class="browser-address">nexora / showcase</div><span class="browser-expand">↗</span></div><div class=""><div class=""></div><div class="demo-nexora-main"><img class=""${ssrRenderAttr("src", _virtual_public__2Fdemo_phone_default)} alt=""></div><div class=""></div></div></div></div></a><span class="">Ez</span></article><article id="asa-shop" class="project-chapter content-width project-reverse" style="${ssrRenderStyle({ "--project-accent": "#ffac6d" })}"><div class="chapter-back-number">02</div><div class="project-content" data-project-copy><div class="project-label"><span class="project-label-line"></span> DIGITAL STOREFRONT</div><span class="project-number">02 <i>/ 03</i></span><h3>ASA SHOP</h3><p class="project-description">A modern storefront concept focused on an intuitive journey from browsing to finding the right product.</p><div class="project-tech"><span>Nuxt</span><span>Tailwind CSS</span><span>Pinia</span><span>UI Components</span></div><a class="project-link" href="#asa-shop" data-modal="asa-shop" data-cursor="VIEW">EXPLORE PROJECT <span>↗</span></a></div><a href="#asa-shop" class="project-showcase-link" data-modal="asa-shop"><div class="project-visual" data-project-visual><div class="project-behind-glow"></div><div class="browser-frame browser-asa-shop" data-cursor="EXPLORE"><div class="browser-bar"><div class="browser-dots"><i></i><i></i><i></i></div><div class="browser-address">asa shop / showcase</div><span class="browser-expand">↗</span></div><div class="demo-site demo-asa"><div class="demo-site-nav"><strong></strong><div><span></span> <span></span></div><span></span></div><div class="demo-asa-main"><img${ssrRenderAttr("src", _virtual_public__2Fdemo_headphones_default)} alt=""></div><div class="demo-bottom"><span></span><span></span></div></div></div></div></a><span class="project-side-mark"></span></article><article id="computer-store" class="project-chapter content-width" style="${ssrRenderStyle({ "--project-accent": "#54baff" })}"><div class="chapter-back-number">03</div><div class="project-content" data-project-copy><div class="project-label"><span class="project-label-line"></span> PC / CUSTOM BUILDS</div><span class="project-number">03 <i>/ 03</i></span><h3>COMPUTER STORE</h3><p class="project-description">An immersive destination for PC components, custom builds and high-performance computer setups.</p><div class="project-tech"><span>Nuxt</span><span>TypeScript</span><span>Tailwind CSS</span><span>Pinia</span></div><a class="project-link" href="#computer-store" data-modal="computer-store" data-cursor="VIEW">EXPLORE PROJECT <span>↗</span></a></div><a href="#computer-store" class="project-showcase-link" data-modal="computer-store"><div class="project-visual" data-project-visual><div class="project-behind-glow"></div><div class="browser-frame browser-computer-store" data-cursor="EXPLORE"><div class="browser-bar"><div class="browser-dots"><i></i><i></i><i></i></div><div class="browser-address">computer store / showcase</div><span class="browser-expand">↗</span></div><div class=""><div class=""></div><div class=""><img class=""${ssrRenderAttr("src", _virtual_public__2Fdemo_pc_default)} alt=""></div><div class=""><span></span><span></span></div></div></div></div></a><span class=""></span></article></div></section><section id="contact" class="contact-section section-space"><div class="content-width"><div class="chapter-heading" data-reveal><span class="chapter-index">04 / SAY HELLO</span><span class="chapter-dash"></span></div><div class="contact-inner"><div data-reveal><div class="contact-kicker"><span class="pulse-dot"></span> HAVE SOMETHING IN MIND?</div><h2>LET&#39;S MAKE<br><span class="warm-text">SOMETHING</span><br><span class="contact-amazing">UNREAL.</span></h2><p>I&#39;m always interested in exciting projects, collaborations and frontend opportunities. Let&#39;s build something memorable.</p><a class="btn btn-orange contact-cta" href="mailto:a.1taghiloo82@gmail.com?subject=Let%27s%20work%20together" data-cursor="EMAIL">Start a conversation <span>↗</span></a></div><div class="contact-cards" data-reveal><a class="contact-card" href="mailto:a.1taghiloo82@gmail.com" data-cursor="MAIL"><span class="contact-icon">✉</span><div><small>EMAIL ME</small><strong>a.1taghiloo82@gmail.com</strong></div><span class="contact-arrow">↗</span></a><a class="contact-card" href="https://www.linkedin.com/in/amir-taghiloo-605928248/" target="_blank" data-cursor="OPEN"><span class="contact-icon linkedin-bg">in</span><div><small>LET&#39;S CONNECT</small><strong>LinkedIn</strong></div><span class="contact-arrow">↗</span></a><a class="contact-card" href="https://github.com/AmirHosseinTaghiloo" target="_blank" data-cursor="OPEN"><span class="contact-icon">⌘</span><div><small>SEE THE CODE</small><strong>GitHub</strong></div><span class="contact-arrow">↗</span></a></div></div></div></section><footer class="site-footer content-width"><a class="brand" href="#home"><span class="brand-orbit"><span></span></span><span>AMT<span class="brand-period">.</span></span></a><p>Code. Curiosity. A little cosmic energy.</p><span>© 2026 Amir Hossein Taghiloo</span><a href="#home" class="back-to-top">BACK TO TOP ↑</a></footer><div class="effects-control"><button type="button" id="effects-toggle">✦ <span>MOTION ON</span></button></div><div id="preview-dialog" role="dialog" aria-modal="true" aria-label="Project details" style="${ssrRenderStyle({
				"display": "none",
				"position": "fixed",
				"inset": "0",
				"z-index": "350",
				"background": "#030509e8",
				"place-items": "center",
				"padding": "20px"
			})}"><div style="${ssrRenderStyle({
				"width": "min(100%,670px)",
				"position": "relative",
				"background": "#111722",
				"border": "1px solid #ff98588a",
				"border-radius": "22px",
				"padding": "42px",
				"box-shadow": "0 35px 90px #000"
			})}"><button id="dialog-close" aria-label="Close" style="${ssrRenderStyle({
				"position": "absolute",
				"right": "20px",
				"top": "16px",
				"color": "#fff",
				"border": "1px solid #fff4",
				"border-radius": "50%",
				"height": "38px",
				"width": "38px",
				"background": "#202631",
				"cursor": "pointer"
			})}">×</button><small style="${ssrRenderStyle({
				"color": "#ff995a",
				"letter-spacing": ".2em"
			})}">PROJECT CASE STUDY</small><h2 id="dialog-title" style="${ssrRenderStyle({
				"font-size": "52px",
				"letter-spacing": "-.07em",
				"margin": "16px 0"
			})}"></h2><p id="dialog-desc" style="${ssrRenderStyle({
				"color": "#b3bbc8",
				"line-height": "1.9"
			})}"></p><a href="#projects" id="dialog-back" class="btn btn-orange">Back to projects ↗</a></div></div></div>`);
		};
	}
});
//#endregion
//#region components/CosmosSections.vue
var _sfc_setup$3 = CosmosSections_vue_vue_type_script_setup_true_lang_default.setup;
CosmosSections_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/CosmosSections.vue");
	return _sfc_setup$3 ? _sfc_setup$3(props, ctx) : void 0;
};
var CosmosSections_default = Object.assign(CosmosSections_vue_vue_type_script_setup_true_lang_default, { __name: "CosmosSections" });
//#endregion
//#region \0virtual:public?%2Fhero-portrait.png
var _virtual_public__2Fhero_portrait_default = publicAssetsURL("/hero-portrait.png");
//#endregion
//#region \0virtual:public?%2Fportrait-card.jpg
var _virtual_public__2Fportrait_card_default = publicAssetsURL("/portrait-card.jpg");
//#endregion
//#region app.vue?vue&type=script&setup=true&lang.ts
var app_vue_vue_type_script_setup_true_lang_default = /*@__PURE__*/ defineComponent({
	__name: "app",
	__ssrInlineRender: true,
	setup(__props) {
		const stats = [
			["3+", "Years Experience"],
			["10+", "Projects Completed"],
			["∞", "Cups of Coffee"]
		];
		ref();
		const label = ref("");
		const menu = ref(false);
		return (_ctx, _push, _parent, _attrs) => {
			const _component_CosmosSections = CosmosSections_default;
			_push(`<div${ssrRenderAttrs(_attrs)}><div class="cur-dot"></div><div class="cur-ring"><span>${ssrInterpolate(unref(label))}</span></div><canvas class="fixed inset-0 -z-10"></canvas><header class="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 md:px-12 py-5 backdrop-blur-sm"><b class="text-xl tracking-widest">◯ AHT</b><nav class="hidden md:flex gap-8 text-sm text-white/70"><a href="#home" data-cur="GO">Home</a><a href="#about" data-cur="GO">About</a><a href="#skills" data-cur="GO">Skills</a><a href="#projects" data-cur="GO">Projects</a><a href="#contact" data-cur="GO">Contact</a></nav><a href="/Amir-Hossein-Taghiloo-Resume.pdf" download data-cur="PDF" class="hidden md:block border border-accent text-accent rounded-full px-5 py-2 text-sm hover:bg-accent hover:text-black transition"><i></i> Download Resume</a><button class="md:hidden text-2xl" aria-label="Menu">${ssrInterpolate(unref(menu) ? "✕" : "☰")}</button>`);
			if (unref(menu)) _push(`<nav class="md:hidden absolute top-full inset-x-0 bg-black/90 backdrop-blur p-6 grid gap-4 text-lg"><a href="#about">About</a><a href="#skills">Skills</a><a href="#projects">Projects</a><a href="#contact">Contact</a><a href="/Amir-Hossein-Taghiloo-Resume.pdf" download class="text-accent">⬇ Download Resume</a></nav>`);
			else _push(`<!---->`);
			_push(`</header><section id="home" class="relative h-[300vh]"><div class="sticky top-0 h-screen overflow-hidden"><div class="pat-grid absolute inset-0" style="${ssrRenderStyle({ "opacity": "calc(.9 - var(--hero,0)*1.2)" })}"></div><div class="pat-rings absolute left-1/2 top-1/2" style="${ssrRenderStyle({
				"transform": "translate(-50%,-50%) scale(calc(1 + var(--hero,0)*2))",
				"opacity": "calc(1 - var(--hero,0)*1.5)"
			})}"><i class="r1"></i><i class="r2"></i><i class="r3"></i><i class="r4"></i><b class="d1"></b><b class="d2"></b><b class="d3"></b></div><div class="absolute left-1/2 top-1/2 w-[46vmin]" style="${ssrRenderStyle({
				"transform": "translate(10vmin,-42vmin) translateY(calc(var(--hero,0)*-30vh)) scale(calc(1 + var(--hero,0)*1.5))",
				"opacity": "calc(1 - var(--hero,0)*1.6)"
			})}"><div class="saturn"><span class="ring back"></span><span class="body"></span><span class="ring front"></span></div></div><div class="planet absolute rounded-full overflow-hidden left-1/2 top-1/2 w-[60vmin] h-[60vmin]" style="${ssrRenderStyle({
				"transform": "translate(-50%,-50%) scale(calc(1 + var(--hero,0)*5)) rotate(calc(var(--hero,0)*60deg))",
				"opacity": "calc(1 - var(--hero,0)*.7)"
			})}"></div><img${ssrRenderAttr("src", _virtual_public__2Fhero_portrait_default)} alt="Amir Hossein Taghiloo" class="absolute bottom-0 rounded-full left-1/2 h-[88vh] max-w-none drop-shadow-[0_0_60px_rgba(255,106,26,.5)]" style="${ssrRenderStyle({
				"transform": "translateX(-50%) translateY(calc(var(--hero,0)*40vh)) scale(calc(1 - var(--hero,0)*.25))",
				"opacity": "calc(1 - var(--hero,0)*1.3)"
			})}"><div class="absolute left-6 md:left-12 top-1/3 max-w-md" style="${ssrRenderStyle({
				"transform": "translateY(calc(var(--hero,0)*-60vh))",
				"opacity": "calc(1 - var(--hero,0)*2)"
			})}"><p class="text-accent text-xs tracking-[.3em] mb-3">● HELLO, I&#39;M</p><h1 class="text-5xl md:text-7xl font-bold leading-none bg-gradient-to-b from-white to-orange-300 bg-clip-text text-transparent">Amir Hossein Taghiloo</h1><p class="mt-4 text-lg">Frontend Developer • <span class="text-white/70">Vue / Nuxt</span></p><p class="mt-3 text-sm text-white/60">I transform creative ideas into fast, immersive web experiences. Precise code. Bold ideas. Remarkable details.</p><p class="mt-3 text-xs text-white/50"><i class="inline-block w-2 h-2 rounded-full bg-accent mr-2"></i>Available for new opportunities • Based in Tehran • Working worldwide</p><div class="mt-6 flex flex-wrap gap-3"><a href="/Amir-Hossein-Taghiloo-Resume.pdf" download data-cur="PDF" class="border border-accent text-accent rounded-full px-6 py-3 hover:bg-accent hover:text-black transition">⬇ Download Resume</a><a href="https://github.com/AmirHosseinTaghiloo" target="_blank" data-cur="GITHUB" class="btn-gh glass rounded-full px-6 py-3 flex items-center gap-2"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5a11.5 11.5 0 0 0-3.6 22.4c.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.200 1.8 1.200 1 1.800 2.800 1.300 3.400 1 .1-.8.4-1.300.8-1.600-2.600-.3-5.300-1.300-5.300-5.700 0-1.300.5-2.300 1.200-3.100-.1-.3-.5-1.500.1-3.100 0 0 1-.3 3.200 1.200a11 11 0 0 1 5.800 0c2.200-1.500 3.200-1.200 3.200-1.200.6 1.600.2 2.800.1 3.100.8.800 1.200 1.800 1.200 3.100 0 4.400-2.700 5.400-5.300 5.700.4.4.8 1.100.8 2.200v3.200c0 .3.2.7.8.6A11.500 11.500 0 0 0 12 .5z"></path></svg>GitHub</a><a href="https://www.linkedin.com/in/amir-taghiloo-605928248/" target="_blank" data-cur="LINKEDIN" class="btn-li glass rounded-full px-6 py-3 flex items-center gap-2"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9.5h4V21H3zM9.5 9.5h3.800v1.600h.1c.5-1 1.800-1.900 3.700-1.900 4 0 4.700 2.600 4.700 6V21h-4v-5.200c0-1.300 0-2.900-1.800-2.900s-2 1.400-2 2.800V21h-4z"></path></svg>LinkedIn</a></div></div><div class="absolute right-6 md:right-16 top-28 hidden md:block w-56 rounded-3xl overflow-hidden glass p-2" style="${ssrRenderStyle({
				"transform": "translateY(calc(var(--hero,0)*-30vh)) rotate(calc(var(--hero,0)*12deg))",
				"opacity": "calc(1 - var(--hero,0)*1.5)"
			})}"><img${ssrRenderAttr("src", _virtual_public__2Fportrait_card_default)} class="rounded-2xl" alt=""><p class="p-2 text-xs text-accent">◆ Creative Developer</p></div><p class="absolute bottom-6 right-8 text-[10px] tracking-[.3em] text-white/50 [writing-mode:vertical-rl]">SCROLL TO EXPLORE</p></div></section><section class="py-24 flex flex-wrap justify-center gap-16"><!--[-->`);
			ssrRenderList(stats, (s) => {
				_push(`<div class="reveal text-center"><div class="text-6xl font-bold text-accent">${ssrInterpolate(s[0])}</div><div class="text-white/60 mt-2">${ssrInterpolate(s[1])}</div></div>`);
			});
			_push(`<!--]--></section>`);
			_push(ssrRenderComponent(_component_CosmosSections, null, null, _parent));
			_push(`</div>`);
		};
	}
});
//#endregion
//#region app.vue
var _sfc_setup$2 = app_vue_vue_type_script_setup_true_lang_default.setup;
app_vue_vue_type_script_setup_true_lang_default.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("app.vue");
	return _sfc_setup$2 ? _sfc_setup$2(props, ctx) : void 0;
};
var app_default = app_vue_vue_type_script_setup_true_lang_default;
//#endregion
//#region node_modules/nuxt/dist/app/components/nuxt-error-page.vue
var _sfc_main$1 = {
	__name: "nuxt-error-page",
	__ssrInlineRender: true,
	props: { error: Object },
	setup(__props) {
		const _error = __props.error;
		const status = Number(_error.statusCode || 500);
		const is404 = status === 404;
		const statusText = _error.statusMessage ?? (is404 ? "Page Not Found" : "Internal Server Error");
		const description = _error.message || _error.toString();
		const stack = void 0;
		const _Error404 = defineAsyncComponent(() => import('../build/error-404-BEtlhzR_.mjs'));
		const _Error = defineAsyncComponent(() => import('../build/error-500-Ct9_BG78.mjs'));
		const ErrorTemplate = is404 ? _Error404 : _Error;
		return (_ctx, _push, _parent, _attrs) => {
			_push(ssrRenderComponent(unref(ErrorTemplate), mergeProps({
				status: unref(status),
				statusText: unref(statusText),
				statusCode: unref(status),
				statusMessage: unref(statusText),
				description: unref(description),
				stack: unref(stack)
			}, _attrs), null, _parent));
		};
	}
};
var _sfc_setup$1 = _sfc_main$1.setup;
_sfc_main$1.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("node_modules/nuxt/dist/app/components/nuxt-error-page.vue");
	return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};
//#endregion
//#region virtual:nuxt:node_modules%2F.cache%2Fnuxt%2F.nuxt%2Fisland-renderer.mjs
var IslandRenderer = () => null;
//#endregion
//#region node_modules/nuxt/dist/app/components/nuxt-root.vue
var _sfc_main = {
	__name: "nuxt-root",
	__ssrInlineRender: true,
	setup(__props) {
		const nuxtApp = useNuxtApp();
		nuxtApp.deferHydration();
		nuxtApp.ssrContext.url;
		const SingleRenderer = false;
		provide(PageRouteSymbol, useRoute());
		nuxtApp.hooks.callHookWith((hooks) => hooks.map((hook) => hook()), "vue:setup", []);
		const error = /* @__PURE__ */ useError();
		const abortRender = error.value && !nuxtApp.ssrContext.error;
		function invokeAppErrorHandler(err, target, info) {
			const errorHandler = nuxtApp.vueApp.config.errorHandler;
			if (errorHandler && !errorHandler.__nuxt_default) try {
				errorHandler(err, target, info);
			} catch (handlerError) {
				console.error("[nuxt] Error in `app.config.errorHandler`", handlerError);
			}
		}
		onErrorCaptured((err, target, info) => {
			nuxtApp.hooks.callHook("vue:error", err, target, info)?.catch((hookError) => console.error("[nuxt] Error in `vue:error` hook", hookError));
			{
				const p = nuxtApp.runWithContext(() => showError(err));
				onServerPrefetch(() => p);
				invokeAppErrorHandler(err, target, info);
				return false;
			}
		});
		const islandContext = nuxtApp.ssrContext.islandContext;
		return (_ctx, _push, _parent, _attrs) => {
			ssrRenderSuspense(_push, {
				default: () => {
					if (unref(abortRender)) _push(`<div></div>`);
					else if (unref(error)) _push(ssrRenderComponent(unref(_sfc_main$1), { error: unref(error) }, null, _parent));
					else if (unref(islandContext)) _push(ssrRenderComponent(unref(IslandRenderer), { context: unref(islandContext) }, null, _parent));
					else if (unref(SingleRenderer)) ssrRenderVNode(_push, createVNode(resolveDynamicComponent(unref(SingleRenderer)), null, null), _parent);
					else _push(ssrRenderComponent(unref(app_default), null, null, _parent));
				},
				_: 1
			});
		};
	}
};
var _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
	const ssrContext = useSSRContext();
	(ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("node_modules/nuxt/dist/app/components/nuxt-root.vue");
	return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};
//#endregion
//#region node_modules/nuxt/dist/app/entry.js
var entry$1 = async function createNuxtAppServer(ssrContext) {
	const vueApp = createApp(_sfc_main);
	const nuxt = createNuxtApp({
		vueApp,
		ssrContext
	});
	try {
		await applyPlugins(nuxt, virtual_nuxt_node_modules_2F_cache_2Fnuxt_2F_nuxt_2Fplugins_server_default);
		await nuxt.hooks.callHook("app:created", vueApp);
	} catch (error) {
		await nuxt.hooks.callHook("app:error", error);
		nuxt.payload.error ||= createError$1(error);
	}
	if (ssrContext && (ssrContext["~renderResponse"] || ssrContext._renderResponse)) throw new Error("skipping render");
	return vueApp;
};
var entry_default = ((ssrContext) => entry$1(ssrContext));

const entry = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
	__proto__: null,
	default: entry_default
}, Symbol.toStringTag, { value: 'Module' }));

export { useRouter as a, isRootedPath as b, useRuntimeConfig as c, useNuxtApp as d, encodeRoutePath as e, nuxtLinkDefaults as f, entry as g, isAbsoluteHref as i, navigateTo as n, resolveRouteObject as r, sanitizeAnchorHref as s, useHead as u };
//# sourceMappingURL=entry.mjs.map
