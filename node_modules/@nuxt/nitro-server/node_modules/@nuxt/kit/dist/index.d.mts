import { C as normalizeModuleTranspilePath, S as loadNuxtModuleInstance, _ as tryUseNitro, a as ServerImportInput, b as installModule, c as addPrerenderRoutes, d as addServerImportsDir, f as addServerPlugin, g as resolveServerVariant, i as getAddDependencyCommand, l as addServerHandler, n as ensureDependencyInstalled, o as addDevServerHandler, p as addServerScanDir, s as addNitroPlugin, t as EnsureDependencyInstalledOptions, u as addServerImports, v as useNitro, w as resolveModuleWithOptions, y as getDirectory } from "./dependency-BOcSbIUw.mjs";
import "exsolve";
import { Component, ComponentsDir, ModuleDefinition, ModuleOptions, NitroInstance, NitroInstanceOptions, Nuxt, NuxtAppConfig, NuxtBuildOutputs, NuxtCompatibility, NuxtCompatibilityIssues, NuxtConfig, NuxtConfigLayer, NuxtConfigLayerMeta, NuxtDotenvOptions, NuxtHooks, NuxtImport, NuxtImportPresetSource, NuxtMiddleware, NuxtModule, NuxtOptions, NuxtPlugin, NuxtPluginTemplate, NuxtServerTemplate, NuxtTemplate, NuxtTypeTemplate, ResolvedNuxtTemplate, SchemaDefinition, ViteConfig, VitePlugin, WebpackConfig, WebpackPluginInstance } from "@nuxt/schema";
//#region src/module/define.d.ts
/**
 * Define a Nuxt module, automatically merging defaults with user provided options, installing
 * any hooks that are provided, and calling an optional setup function for full control.
 */
export declare function defineNuxtModule<TOptions extends ModuleOptions>(definition: ModuleDefinition<TOptions, Partial<TOptions>, false> | NuxtModule<TOptions, Partial<TOptions>, false>): NuxtModule<TOptions, TOptions, false>;
export declare function defineNuxtModule<TOptions extends ModuleOptions>(): {
  with: <TOptionsDefaults extends Partial<TOptions>>(definition: ModuleDefinition<TOptions, TOptionsDefaults, true> | NuxtModule<TOptions, TOptionsDefaults, true>) => NuxtModule<TOptions, TOptionsDefaults, true>;
};
//#endregion
//#region src/module/compatibility.d.ts
/**
 * Check if a Nuxt module is installed by name.
 *
 * This will check both the installed modules and the modules to be installed. Note
 * that it cannot detect if a module is _going to be_ installed programmatically by another module.
 */
export declare function hasNuxtModule(moduleName: string, nuxt?: Nuxt): boolean;
/**
 * Checks if a Nuxt module is compatible with a given semver version.
 */
export declare function hasNuxtModuleCompatibility(module: string | NuxtModule, semverVersion: string, nuxt?: Nuxt): Promise<boolean>;
/**
 * Get the version of a Nuxt module.
 *
 * Scans installed modules for the version, if it's not found it will attempt to load the module instance and get the version from there.
 */
export declare function getNuxtModuleVersion(module: string | NuxtModule, nuxt?: Nuxt | any): Promise<string | false>;
//#endregion
//#region src/loader/config.d.ts
/**
 * Context handed to `onConfigResolved` after configuration has loaded successfully.
 */
interface ResolvedNuxtConfigContext {
  /**
   * User configuration merged across all layers, with no schema defaults applied and with
   * `overrides`, `defaults` and `defaultConfig` from the load options excluded, so repeated
   * loads of an unchanged project produce an unchanged snapshot. Two snapshots from separate
   * `loadNuxtConfig` calls can be compared with `diffNuxtConfig`.
   */
  rawConfig: NuxtConfig;
  /** Resolved config layers, highest priority first. */
  layers: NuxtConfigLayer[];
  /** Absolute path of the root `nuxt.config` file, if one was found. */
  configFile?: string;
  /** Directory the configuration was loaded from. */
  cwd: string;
}
/** A layer produced by a custom {@link LoadNuxtConfigOptions.resolve} implementation. */
interface ResolvedNuxtLayer {
  /** The layer's configuration. Return an empty object to contribute nothing to the merge. */
  config: NuxtConfig;
  /** Absolute path of the directory the layer was loaded from. */
  cwd?: string;
  /** Absolute path of the layer's config file, if it has one. */
  configFile?: string;
  /** The `extends` entry this layer was resolved from. */
  source?: string;
  /** Metadata to attach to the layer. */
  meta?: NuxtConfigLayerMeta;
}
/** Context passed to a custom {@link LoadNuxtConfigOptions.resolve} implementation. */
interface NuxtLayerResolverContext {
  /** Directory the layer source should be resolved relative to. */
  cwd?: string;
  /**
   * The importer in use for the current load, if one has been established. Pass it to any
   * nested load so a layer is not loaded through a second, differently configured importer.
   */
  import?: (id: string) => Promise<unknown>;
}
interface LoadNuxtConfigOptions {
  /** Directory to load `nuxt.config` from. @default process.cwd() */
  cwd?: string;
  /**
   * Name of the config file to load, without an extension.
   * @default 'nuxt.config'
   */
  configFile?: string;
  /**
   * Name of the `.rc` file to load alongside the config file, or `false` to load none.
   * @default '.nuxtrc'
   */
  rcFile?: string | false;
  /**
   * Also load the user-level and workspace-level `.nuxtrc` files.
   * @default true
   */
  globalRc?: boolean;
  /**
   * Configuration applied above every layer, including the root project's own `nuxt.config`.
   * Excluded from the `rawConfig` snapshot passed to `onConfigResolved`.
   */
  overrides?: NuxtConfig;
  /**
   * Configuration applied below every layer, before schema defaults. Excluded from the
   * `rawConfig` snapshot passed to `onConfigResolved`.
   */
  defaults?: NuxtConfig;
  /**
   * Load `.env` files into `process.env` before resolving configuration. Set to `false` when
   * the environment has already been populated.
   * @default true
   */
  dotenv?: boolean | NuxtDotenvOptions;
  /**
   * Environment name used to select `$env.*` configuration overrides. Takes precedence over
   * `envName` set in `nuxt.config`.
   */
  envName?: string | false;
  /**
   * Resolve an `extends` entry to a layer yourself. Return a nullish value to fall back to the
   * default resolution for that source.
   */
  resolve?: (source: string, context: NuxtLayerResolverContext) => ResolvedNuxtLayer | null | undefined | Promise<ResolvedNuxtLayer | null | undefined>;
  /**
   * Import config files with a custom loader rather than the default one. Supply this to load
   * TypeScript config without Nuxt reaching for `jiti`.
   */
  import?: (id: string) => Promise<unknown>;
  /**
   * Called once, awaited, after configuration has loaded successfully. Callers watching config
   * files themselves can keep the previous `rawConfig` and pass both snapshots to
   * `diffNuxtConfig` to find out which keys changed. Not called if loading throws.
   */
  onConfigResolved?: (context: ResolvedNuxtConfigContext) => void | Promise<void>;
}
interface NuxtConfigDiffLocation {
  /**
   * Property path of the changed value, with array indices as numbers: `['modules']`,
   * `['runtimeConfig', 'public', 'foo']`, `['modules', 0]`. Prefer this over {@link label} when
   * reading the value back out of a config object.
   */
  path: Array<string | number>;
  /**
   * {@link path} written as a property accessor, for display and for matching against a known
   * key: `ssr`, `runtimeConfig.public.foo`, `modules[0]`, `nitro.routeRules["/index.html"].ssr`.
   */
  label: string;
}
/** A single difference between two resolved Nuxt configurations. */
type NuxtConfigDiffEntry = (NuxtConfigDiffLocation & {
  type: 'added';
  newValue: unknown;
}) | (NuxtConfigDiffLocation & {
  type: 'removed';
  oldValue: unknown;
}) | (NuxtConfigDiffLocation & {
  type: 'changed';
  newValue: unknown;
  oldValue: unknown;
});
/**
 * Compare two `rawConfig` snapshots (as provided to `onConfigResolved`) and return the
 * differences between them.
 */
export declare function diffNuxtConfig(oldConfig: NuxtConfig, newConfig: NuxtConfig): NuxtConfigDiffEntry[];
export declare function loadNuxtConfig(opts: LoadNuxtConfigOptions): Promise<NuxtOptions>;
//#endregion
//#region src/loader/schema.d.ts
export declare function extendNuxtSchema(def: SchemaDefinition | (() => SchemaDefinition)): void;
//#endregion
//#region src/loader/nuxt.d.ts
interface LoadNuxtOptions extends LoadNuxtConfigOptions {
  /** Load nuxt with development mode */
  dev?: boolean;
  /** Use lazy initialization of nuxt if set to false */
  ready?: boolean;
}
export declare function loadNuxt(opts: LoadNuxtOptions): Promise<Nuxt>;
export declare function buildNuxt(nuxt: Nuxt): Promise<any>;
//#endregion
//#region src/layers.d.ts
interface LayerDirectories {
  /** Nuxt rootDir (`/` by default) */
  readonly root: string;
  /** Server source directory (`/server` by default) */
  readonly server: string;
  /** Local modules directory (`/modules` by default) */
  readonly modules: string;
  /** Shared directory (`/shared` by default) */
  readonly shared: string;
  /** Public directory (`/public` by default) */
  readonly public: string;
  /** Nuxt srcDir (`/app/` by default) */
  readonly app: string;
  /** Layouts directory (`/app/layouts` by default) */
  readonly appLayouts: string;
  /** Middleware directory (`/app/middleware` by default) */
  readonly appMiddleware: string;
  /** Pages directory (`/app/pages` by default) */
  readonly appPages: string;
  /** Plugins directory (`/app/plugins` by default) */
  readonly appPlugins: string;
}
/**
 * Get the resolved directory paths for all layers in a Nuxt application.
 *
 * Returns an array of LayerDirectories objects, ordered by layer priority:
 * - The first layer is the user/project layer (highest priority)
 * - Earlier layers override later layers in the array
 * - Base layers appear last in the array (lowest priority)
 *
 * @param nuxt - The Nuxt instance to get layers from. Defaults to the current Nuxt context.
 * @returns Array of LayerDirectories objects, ordered by priority (user layer first)
 */
export declare function getLayerDirectories(nuxt?: Nuxt): LayerDirectories[];
//#endregion
//#region src/head.d.ts
export declare function setGlobalHead(head: NuxtAppConfig['head']): void;
//#endregion
//#region src/imports.d.ts
export declare function addImports(imports: NuxtImport | NuxtImport[]): void;
export declare function addImportsDir(dirs: string | string[], opts?: {
  prepend?: boolean;
}): void;
export declare function addImportsSources(presets: NuxtImportPresetSource | NuxtImportPresetSource[]): void;
//#endregion
//#region src/app-config.d.ts
/**
 * Update Nuxt app configuration.
 * @since 4.5.0
 */
export declare function updateAppConfig(appConfig: Record<string, unknown>): void;
//#endregion
//#region src/runtime-config.d.ts
/**
 * Access 'resolved' Nuxt runtime configuration, with values updated from environment.
 *
 * This mirrors the runtime behavior of Nitro.
 */
export declare function useRuntimeConfig(): Record<string, any>;
/**
 * Update Nuxt runtime configuration.
 */
export declare function updateRuntimeConfig(runtimeConfig: Record<string, unknown>): void | Promise<void>;
//#endregion
//#region src/build.d.ts
type Arrayable<T> = T | T[];
type Thenable<T> = T | Promise<T>;
type RspackCompatiblePluginInstance = {
  apply: (...args: any[]) => void;
  [k: string]: any;
};
interface ExtendConfigOptions {
  /**
   * Install plugin on dev
   * @default true
   */
  dev?: boolean;
  /**
   * Install plugin on build
   * @default true
   */
  build?: boolean;
  /**
   * Install plugin on server side
   * @default true
   */
  server?: boolean;
  /**
   * Install plugin on client side
   * @default true
   */
  client?: boolean;
  /**
   * Prepends the plugin to the array with `unshift()` instead of `push()`.
   */
  prepend?: boolean;
}
interface ExtendWebpackConfigOptions extends ExtendConfigOptions {}
interface ExtendViteConfigOptions extends Omit<ExtendConfigOptions, 'server' | 'client'> {
  /**
   * Extend server Vite configuration
   * @default true
   * @deprecated calling \`extendViteConfig\` with only server/client environment is deprecated.
   * Nuxt 5+ uses the Vite Environment API which shares a configuration between environments.
   * You can likely use a Vite plugin to achieve the same result.
   */
  server?: boolean;
  /**
   * Extend client Vite configuration
   * @default true
   * @deprecated calling \`extendViteConfig\` with only server/client environment is deprecated.
   * Nuxt 5+ uses the Vite Environment API which shares a configuration between environments.
   * You can likely use a Vite plugin to achieve the same result.
   */
  client?: boolean;
}
type ExtendWebpacklikeConfig = (fn: (config: WebpackConfig) => void, options?: ExtendWebpackConfigOptions) => void;
/**
 * Extend webpack config
 *
 * The fallback function might be called multiple times
 * when applying to both client and server builds.
 */
export declare const extendWebpackConfig: ExtendWebpacklikeConfig;
/**
 * Extend rspack config
 *
 * The fallback function might be called multiple times
 * when applying to both client and server builds.
 */
export declare const extendRspackConfig: ExtendWebpacklikeConfig;
/**
 * Extend Vite config
 */
export declare function extendViteConfig(fn: ((config: ViteConfig) => Thenable<void>), options?: ExtendViteConfigOptions): (() => void) | undefined;
/**
 * Append webpack plugin to the config.
 */
export declare function addWebpackPlugin(pluginOrGetter: Arrayable<WebpackPluginInstance> | (() => Thenable<Arrayable<WebpackPluginInstance>>), options?: ExtendWebpackConfigOptions): void;
/**
 * Append rspack plugin to the config.
 */
export declare function addRspackPlugin(pluginOrGetter: Arrayable<RspackCompatiblePluginInstance> | (() => Thenable<Arrayable<RspackCompatiblePluginInstance>>), options?: ExtendWebpackConfigOptions): void;
/**
 * Append Vite plugin to the config.
 */
export declare function addVitePlugin(pluginOrGetter: Arrayable<VitePlugin> | (() => Thenable<Arrayable<VitePlugin>>), options?: ExtendConfigOptions): void;
interface AddBuildPluginFactory {
  vite?: () => Thenable<Arrayable<VitePlugin>>;
  webpack?: () => Thenable<Arrayable<WebpackPluginInstance>>;
  rspack?: () => Thenable<Arrayable<RspackCompatiblePluginInstance>>;
}
export declare function addBuildPlugin(pluginFactory: AddBuildPluginFactory, options?: ExtendConfigOptions): void;
/**
 * Set the build output for the given key. See {@link NuxtBuildOutputs}.
 */
export declare function setBuildOutput<K extends keyof NuxtBuildOutputs>(key: K, provider: NuxtBuildOutputs[K], nuxt?: Nuxt): void;
//#endregion
//#region src/compatibility.d.ts
export declare function normalizeSemanticVersion(version: string): string;
/**
 * Check version constraints and return incompatibility issues as an array
 */
export declare function checkNuxtCompatibility(constraints: NuxtCompatibility, nuxt?: Nuxt): Promise<NuxtCompatibilityIssues>;
/**
 * Check version constraints and throw a detailed error if has any, otherwise returns true
 */
export declare function assertNuxtCompatibility(constraints: NuxtCompatibility, nuxt?: Nuxt): Promise<true>;
/**
 * Check version constraints and return true if passed, otherwise returns false
 */
export declare function hasNuxtCompatibility(constraints: NuxtCompatibility, nuxt?: Nuxt): Promise<boolean>;
type NuxtMajorVersion = 2 | 3 | 4;
/**
 * Check if current Nuxt instance is of specified major version
 */
export declare function isNuxtMajorVersion(majorVersion: NuxtMajorVersion, nuxt?: Nuxt): boolean;
/**
 * @deprecated Use `isNuxtMajorVersion(2, nuxt)` instead. This may be removed in \@nuxt/kit v5 or a future major version.
 */
export declare function isNuxt2(nuxt?: Nuxt): boolean;
/**
 * @deprecated Use `isNuxtMajorVersion(3, nuxt)` instead. This may be removed in \@nuxt/kit v5 or a future major version.
 */
export declare function isNuxt3(nuxt?: Nuxt): boolean;
/**
 * Get the major version of nitro used by the current Nuxt instance.
 *
 * Resolution order:
 *
 * 1. `nuxt.options._nitroMajor`, stamped by the host before any module runs.
 * 2. `nuxt._nitro.meta.majorVersion` from the initialized nitro instance.
 * 3. Resolving the `nitro` / `nitropack` package from the project, which is correct on
 *    older hosts where the package is a direct dependency.
 *
 * Returns `undefined` when no nitro version can be determined; it never throws.
 */
export declare function getNitroVersion(nuxt?: Nuxt): number | undefined;
/**
 * Get nuxt version
 */
export declare function getNuxtVersion(nuxt?: Nuxt | any): string;
//#endregion
//#region src/components.d.ts
/**
 * Register a directory to be scanned for components and imported only when used.
 */
export declare function addComponentsDir(dir: ComponentsDir, opts?: {
  prepend?: boolean;
}): void;
type AddComponentOptions = {
  name: string;
  filePath: string;
} & Partial<Exclude<Component, 'shortPath' | 'async' | 'level' | 'import' | 'asyncImport'>>;
/**
 * This utility takes a file path or npm package that is scanned for named exports, which are get added automatically
 */
export declare function addComponentExports(opts: Omit<AddComponentOptions, 'name'> & {
  prefix?: string;
}): void;
/**
 * Register a component by its name and filePath.
 */
export declare function addComponent(opts: AddComponentOptions): void;
//#endregion
//#region src/context.d.ts
/**
 * A handle to the global Nuxt instance context.
 * @deprecated Use `getNuxtCtx` instead
 */
interface NuxtContext {
  /** Get the current Nuxt instance. Throws if none is set. */
  use: () => Nuxt;
  /** Get the current Nuxt instance, or `null` when none is set. */
  tryUse: () => Nuxt | null;
  /** Set the current Nuxt instance. */
  set: (instance?: Nuxt, replace?: boolean) => void;
  /** Clear the current Nuxt instance. */
  unset: () => void;
  /** Run a synchronous function with the provided Nuxt instance set. */
  call: <R>(instance: Nuxt, callback: () => R) => R;
  /** Run an asynchronous function with the provided Nuxt instance set. */
  callAsync: <R>(instance: Nuxt, callback: () => R | Promise<R>) => Promise<R>;
}
/**
 * Direct access to the Nuxt global context.
 * @deprecated Use `getNuxtCtx` instead
 */
export declare const nuxtCtx: NuxtContext;
/** Direct access to the Nuxt context with asyncLocalStorage - see https://github.com/unjs/unctx. */
export declare const getNuxtCtx: () => Nuxt | null;
/**
 * Get access to Nuxt instance.
 *
 * Throws an error if Nuxt instance is unavailable.
 * @example
 * ```js
 * const nuxt = useNuxt()
 * ```
 */
export declare function useNuxt(): Nuxt;
/**
 * Get access to Nuxt instance.
 *
 * Returns null if Nuxt instance is unavailable.
 * @example
 * ```js
 * const nuxt = tryUseNuxt()
 * if (nuxt) {
 *  // Do something
 * }
 * ```
 */
export declare function tryUseNuxt(): Nuxt | null;
export declare function runWithNuxtContext<T extends (...args: any[]) => any>(nuxt: Nuxt, fn: T): ReturnType<T>;
//#endregion
//#region src/ignore.d.ts
export declare function createIsIgnored(nuxt?: Nuxt | null | undefined): (pathname: string, stats?: unknown) => boolean;
/**
 * Return a filter function to filter an array of paths
 */
export declare function isIgnored(pathname: string, _stats?: unknown, nuxt?: Nuxt | null | undefined): boolean;
export declare function resolveIgnorePatterns(relativePath?: string): string[];
//#endregion
//#region src/layout.d.ts
export declare function addLayout(template: NuxtTemplate | string, name?: string): void;
//#endregion
//#region src/nitro-types.d.ts
/**
 * Minimal structural types for the route rules accepted by this package, covering the nitro
 * majors supported by Nuxt.
 *
 * These are inlined (rather than imported from `nitropack`/`nitro`) so that `@nuxt/kit` does not
 * depend on either package being installed. Server registrations are typed by `@nuxt/schema`,
 * which owns them, and normalised by the configured `server.builder`.
 */
/**
 * Route rules common to both nitro majors.
 *
 * Route rules are augmentable upstream and these types are inlined, so the index signature is
 * what lets a module set a rule neither nitro declares (`ssr`, `appMiddleware`, its own).
 */
interface NitroRouteConfigBase {
  cache?: Record<string, any> | false;
  headers?: Record<string, string>;
  prerender?: boolean;
  isr?: number | boolean | Record<string, any>;
  swr?: boolean | number;
  static?: boolean | number;
  /** Additional route options, including framework-specific route rules. */
  [key: string]: any;
}
/** Route rule shape accepted by nitro v2 (`nitropack`). */
interface NitroRouteConfigV2 extends NitroRouteConfigBase {
  /** A plain string defaults to status `302`. */
  redirect?: string | {
    to: string;
    statusCode?: number;
  };
  proxy?: string | ({
    to: string;
  } & Record<string, any>);
  cors?: boolean;
}
/** Route rule shape accepted by nitro v3 (`nitro`). */
interface NitroRouteConfigV3 extends NitroRouteConfigBase {
  /** A plain string defaults to status `307`. */
  redirect?: string | {
    to: string;
    status?: number;
  } | false;
  /** `false` resets a rule inherited from a less specific pattern. */
  proxy?: string | ({
    to: string;
  } & Record<string, any>) | false;
  cors?: Record<string, any> | boolean;
}
/**
 * A route rule accepted by either supported nitro major.
 *
 * A union rather than one merged shape, so that a rule written as an object literal has to match
 * one major as a whole and excess property checking rejects a literal mixing the two. Anything
 * valid in either is accepted, since the host's nitro major is not visible here; name
 * {@link NitroRouteConfigV2} or {@link NitroRouteConfigV3} to be held to one.
 */
type NitroRouteConfig = NitroRouteConfigV2 | NitroRouteConfigV3;
//#endregion
//#region src/pages.d.ts
export declare function extendPages(cb: NuxtHooks['pages:extend']): void;
interface ExtendRouteRulesOptions {
  /**
   * Override route rule config
   * @default false
   */
  override?: boolean;
}
export declare function extendRouteRules(route: string, rule: NitroRouteConfig, options?: ExtendRouteRulesOptions): void;
interface AddRouteMiddlewareOptions {
  /**
   * Override existing middleware with the same name, if it exists
   * @default false
   */
  override?: boolean;
  /**
   * Prepend middleware to the list
   * @default false
   */
  prepend?: boolean;
}
export declare function addRouteMiddleware(input: NuxtMiddleware | NuxtMiddleware[], options?: AddRouteMiddlewareOptions): void;
//#endregion
//#region src/plugin.d.ts
export declare function normalizePlugin(plugin: NuxtPlugin | string): NuxtPlugin;
/**
 * Registers a nuxt plugin and to the plugins array.
 *
 * Note: You can use mode or .client and .server modifiers with fileName option
 * to use plugin only in client or server side.
 *
 * Note: By default plugin is prepended to the plugins array. You can use second argument to append (push) instead.
 * @example
 * ```js
 * import { createResolver } from '@nuxt/kit'
 * const resolver = createResolver(import.meta.url)
 *
 * addPlugin({
 *   src: resolver.resolve('templates/foo.js'),
 *   filename: 'foo.server.js' // [optional] only include in server bundle
 * })
 * ```
 */
interface AddPluginOptions {
  append?: boolean;
}
export declare function addPlugin(_plugin: NuxtPlugin | string, opts?: AddPluginOptions): NuxtPlugin;
/**
 * Adds a template and registers as a nuxt plugin.
 */
export declare function addPluginTemplate(plugin: NuxtPluginTemplate | string, opts?: AddPluginOptions): NuxtPlugin;
//#endregion
//#region src/resolve.d.ts
interface ResolvePathOptions {
  /** Base for resolving paths from. Default is Nuxt rootDir. */
  cwd?: string;
  /** An object of aliases. Default is Nuxt configured aliases. */
  alias?: Record<string, string>;
  /**
   * The file extensions to try.
   * Default is Nuxt configured extensions.
   *
   * Isn't considered when `type` is set to `'dir'`.
   */
  extensions?: string[];
  /**
   * Whether to resolve files that exist in the Nuxt VFS (for example, as a Nuxt template).
   * @default false
   */
  virtual?: boolean;
  /**
   * Whether to fallback to the original path if the resolved path does not exist instead of returning the normalized input path.
   * @default false
   */
  fallbackToOriginal?: boolean;
  /**
   * The type of the path to be resolved.
   * @default 'file'
   */
  type?: PathType;
}
/**
 * Resolve the full path to a file or a directory (based on the provided type), respecting Nuxt alias and extensions options.
 *
 * If a path cannot be resolved, normalized input will be returned unless the `fallbackToOriginal` option is set to `true`,
 * in which case the original input path will be returned.
 */
export declare function resolvePath(path: string, opts?: ResolvePathOptions): Promise<string>;
/**
 * Try to resolve first existing file in paths
 */
export declare function findPath(paths: string | string[], opts?: ResolvePathOptions, pathType?: PathType): Promise<string | null>;
/**
 * Resolve path aliases respecting Nuxt alias options
 */
export declare function resolveAlias(path: string, alias?: Record<string, string>): string;
interface Resolver {
  resolve(...path: string[]): string;
  resolvePath(path: string, opts?: ResolvePathOptions): Promise<string>;
}
/**
 * Create a relative resolver
 */
export declare function createResolver(base: string | URL): Resolver;
export declare function resolveNuxtModule(base: string, paths: string[]): Promise<string[]>;
type PathType = 'file' | 'dir';
/**
 * Resolve absolute file paths in the provided directory with respect to `.nuxtignore` and return them sorted.
 * @param path path to the directory to resolve files in
 * @param pattern glob pattern or an array of glob patterns to match files
 * @param opts options for globbing
 * @param opts.followSymbolicLinks whether to follow symbolic links, default is `true`
 * @param opts.ignore additional glob patterns to ignore
 * @returns sorted array of absolute file paths
 */
export declare function resolveFiles(path: string, pattern: string | string[], opts?: {
  followSymbolicLinks?: boolean;
  ignore?: string | readonly string[];
}): Promise<string[]>;
//#endregion
//#region src/template.d.ts
/**
 * Renders given template during build into the virtual file system (and optionally to disk in the project `buildDir`)
 */
export declare function addTemplate<T>(_template: NuxtTemplate<T> | string): ResolvedNuxtTemplate<T>;
/**
 * Adds a virtual file that can be used within the server build.
 */
export declare function addServerTemplate(template: NuxtServerTemplate): NuxtServerTemplate;
/**
 * Renders given types during build to disk in the project `typesDir`
 * and register them as types.
 *
 * You can pass a second context object to specify in which context the type should be added.
 *
 * If no context object is passed, then it will only be added to the nuxt context.
 */
export declare function addTypeTemplate<T>(_template: NuxtTypeTemplate<T>, context?: {
  nitro?: boolean;
  nuxt?: boolean;
  node?: boolean;
  shared?: boolean;
}): ResolvedNuxtTemplate<T>;
/**
 * Normalize a nuxt template object
 */
export declare function normalizeTemplate<T>(template: NuxtTemplate<T> | string, buildDir?: string): ResolvedNuxtTemplate<T>;
/**
 * Trigger rebuilding Nuxt templates
 *
 * You can pass a filter within the options to selectively regenerate a subset of templates.
 */
export declare function updateTemplates(options?: {
  filter?: (template: ResolvedNuxtTemplate<any>) => boolean;
}): Promise<void>;
/**
 * Writes the generated `tsconfig` and declaration files to `typesDir`.
 *
 * When a production build uses a `buildDir` other than `typesDir`, existing files are left untouched.
 */
export declare function writeTypes(nuxt: Nuxt): Promise<void>;
//#endregion
//#region src/types.d.ts
/**
 * Rewrite a resolved module path to the declaration file TypeScript will load for it.
 *
 * A `.d.ts` / `.d.mts` / `.d.cts` or `.ts` / `.tsx` path is returned unchanged (or with
 * the extension stripped, where TypeScript's extensionless `paths` retry will find it).
 * A `.mjs` / `.cjs` / `.mts` / `.cts` runtime path is rewritten to an adjacent declaration
 * sibling when one exists; otherwise it is returned as-is for the caller to handle.
 */
export declare function resolveDeclarationPath(absolutePath: string): Promise<string>;
/** Extract the package name (including scope) from a (possibly subpath) module specifier. */
export declare function packageName(specifier: string): string;
interface ResolveTypePathsOptions {
  /**
   * Resolve a bare package to the file its entry resolves to, rather than to the package root.
   *
   * A `paths` substitution naming a directory is only followed under `bundler` resolution.
   * `nodenext`, which the `node` environment's tsconfig uses, requires it to name a file.
   */
  entry?: boolean;
}
/**
 * Resolve auto-import / `tsConfig.paths` entries to the path TypeScript should load types from.
 *
 * A bare package resolves to its package root, so TypeScript follows the package's own
 * `exports` / `types` (which may differ from the file its `.` export condition points at).
 * A subpath export resolves to its entry's declaration sibling when one exists, otherwise to
 * the resolved file itself.
 *
 * Returns `[specifier, absolutePath]` pairs, omitting any specifier that cannot be resolved.
 */
export declare function resolveTypePaths(packages: string[], searchPaths: string[], options?: ResolveTypePathsOptions): Promise<Array<[string, string]>>;
//#endregion
//#region src/watch.d.ts
/**
 * The subset of a chokidar `FSWatcher` this helper needs. Callers hold
 * different chokidar majors (Nuxt core watches with v5, Vite bundles v3), so
 * the parameter is structural rather than an import of either package.
 */
interface RecoverableWatcher {
  on: (event: any, listener: (...args: any[]) => void) => any;
  emit: (event: any, ...args: any[]) => any;
  options?: {
    cwd?: string | undefined;
  } | undefined;
}
/**
 * chokidar suppresses a `change` event that lands within 50ms of the previous
 * `change` for the same path, and never replays it. A save that follows a fast
 * HMR round trip is therefore silently lost until the file is touched again,
 * which looks exactly like broken HMR. This is true of every chokidar major
 * Nuxt uses.
 *
 * Raw fs events are not throttled, so once chokidar has reported a file at
 * least once we can use them to notice a modification that never surfaced as a
 * `change` event, and re-emit it after the throttle window has passed.
 *
 * @param watcher the chokidar watcher to patch
 * @returns a disposer releasing the recovery state; call it when the watcher closes
 */
export declare function recoverThrottledChanges(watcher: RecoverableWatcher): () => void;
//#endregion
//#region src/logger.d.ts
/** Numeric verbosity threshold: `0` (fatal/error) through `5` (trace). */
type NuxtLogLevel = 0 | 1 | 2 | 3 | 4 | 5 | (number & {});
/** The kind of message being logged, which determines how it is rendered. */
type NuxtLogType = 'silent' | 'fatal' | 'error' | 'warn' | 'log' | 'info' | 'success' | 'fail' | 'ready' | 'start' | 'box' | 'debug' | 'trace' | 'verbose';
/** A structured message, usable in place of a string when logging. */
interface NuxtLogInput {
  level?: NuxtLogLevel;
  tag?: string;
  type?: NuxtLogType;
  message?: string;
  additional?: string | string[];
  args?: unknown[];
  date?: Date;
}
/** A fully resolved log record, as passed to reporters. */
interface NuxtLogObject extends NuxtLogInput {
  level: NuxtLogLevel;
  type: NuxtLogType;
  tag: string;
  args: unknown[];
  date: Date;
  [key: string]: unknown;
}
interface NuxtLogReporter {
  /** Declared with method syntax so implementations may narrow the context type. */
  log(logObject: NuxtLogObject, ctx: {
    options: NuxtLoggerOptions;
  }): void;
}
interface NuxtLogFn {
  (message: NuxtLogInput | unknown, ...args: unknown[]): void;
  /** Log the arguments verbatim, bypassing formatting. */
  raw: (...args: unknown[]) => void;
}
interface NuxtLoggerOptions {
  level?: NuxtLogLevel;
  reporters?: NuxtLogReporter[];
  /** Default log fields applied to every message. */
  defaults?: NuxtLogInput;
  /** Per-type defaults, keyed by log type. */
  types?: Record<NuxtLogType, NuxtLogInput>;
  /** How many times an identical message may repeat before it is throttled. */
  throttle?: number;
  /** How long, in milliseconds, a throttled message is suppressed for. */
  throttleMin?: number;
  stdout?: NodeJS.WriteStream;
  stderr?: NodeJS.WriteStream;
  /** Replace each log method, for tests. */
  mockFn?: (type: NuxtLogType, defaults: NuxtLogInput) => (...args: any[]) => void;
  /** Replace the prompt implementation. */
  prompt?: (message: string, options?: any) => Promise<any>;
  formatOptions?: {
    columns?: number;
    date?: boolean;
    colors?: boolean;
    compact?: boolean | number;
    errorLevel?: number;
    [key: string]: unknown;
  };
}
interface NuxtPromptCommonOptions {
  name?: string;
  /** How a cancelled prompt (for example, Ctrl+C) resolves. */
  cancel?: 'default' | 'undefined' | 'null' | 'symbol' | 'reject';
}
type NuxtTextPromptOptions = NuxtPromptCommonOptions & {
  type?: 'text';
  default?: string;
  placeholder?: string;
  initial?: string;
};
type NuxtConfirmPromptOptions = NuxtPromptCommonOptions & {
  type: 'confirm';
  initial?: boolean;
};
type NuxtSelectPromptOptions = NuxtPromptCommonOptions & {
  type: 'select';
  initial?: string;
  options: (string | {
    label: string;
    value?: string;
    hint?: string;
  })[];
};
type NuxtMultiSelectPromptOptions = NuxtPromptCommonOptions & {
  type: 'multiselect';
  initial?: string[];
  options: (string | {
    label: string;
    value?: string;
    hint?: string;
  })[];
  required?: boolean;
};
type NuxtPromptOptions = NuxtTextPromptOptions | NuxtConfirmPromptOptions | NuxtSelectPromptOptions | NuxtMultiSelectPromptOptions;
/**
 * The logger interface exposed by Nuxt. Structurally satisfied by `consola`,
 * but Nuxt only guarantees the members declared here.
 */
interface NuxtLogger extends Record<NuxtLogType, NuxtLogFn> {
  /** Current verbosity threshold. Assignable to change what is emitted. */
  level: NuxtLogLevel;
  /** The options this logger was created with. */
  options: NuxtLoggerOptions;
  /** Create a derived logger with the given options. */
  create: (options: NuxtLoggerOptions) => NuxtLogger;
  /** Create a derived logger that prefixes every message with `tag`. */
  withTag: (tag: string) => NuxtLogger;
  /** Create a derived logger with default log fields applied. */
  withDefaults: (defaults: NuxtLogInput) => NuxtLogger;
  addReporter: (reporter: NuxtLogReporter) => unknown;
  removeReporter: (reporter: NuxtLogReporter) => unknown;
  setReporters: (reporters: NuxtLogReporter[]) => unknown;
  /** Route `console.*` calls through this logger. */
  wrapConsole: () => void;
  /** Undo `wrapConsole`. */
  restoreConsole: () => void;
  /** Route `console.*`, `process.stdout` and `process.stderr` through this logger. */
  wrapAll: () => void;
  /** Undo `wrapAll`. */
  restoreAll: () => void;
  /** Route `process.stdout` and `process.stderr` through this logger. */
  wrapStd: () => void;
  /** Undo `wrapStd`. */
  restoreStd: () => void;
  /** Buffer log output until `resumeLogs` is called. */
  pauseLogs: () => void;
  resumeLogs: () => void;
  /** Replace every log method, for tests. */
  mockTypes: (mockFn?: NuxtLoggerOptions['mockFn']) => void;
  /**
   * Prompt the user for input. The resolved value depends on `options.type`
   * (`text` -> `string`, `confirm` -> `boolean`, `select` -> the chosen option,
   * `multiselect` -> an array of chosen options), and on `options.cancel` when
   * the prompt is dismissed.
   *
   * Declared with method syntax so implementations may narrow the options type.
   */
  prompt(message: string, options?: NuxtPromptOptions): Promise<any>;
}
export declare const logger: NuxtLogger;
export declare function useLogger(tag?: string, options?: NuxtLoggerOptions): NuxtLogger;
//#endregion
//#region src/terminal.d.ts
/** A unit of long-running work, rendered on the host's status surface where available. */
interface NuxtTerminalTask {
  /** Change the label of the running task. */
  update: (label: string) => void;
  /** Finish the task, optionally with a closing message. Defaults to a successful outcome. */
  stop: (message?: string, outcome?: 'success' | 'failure') => void;
}
interface NuxtTerminalNotification {
  title?: string;
  message: string;
  level?: 'info' | 'warn';
}
interface NuxtTerminalNotice {
  /** Retract the notice. */
  dismiss: () => void;
  /** Settles once the notice is gone: acknowledged by the user or retracted. */
  dismissed: Promise<void>;
}
interface NuxtTerminal {
  /**
   * Whether an interactive host (such as the `nuxt dev` TUI) is present. `false` means the
   * primitives below fall back to plain logging on the current process streams.
   */
  readonly interactive: boolean;
  /**
   * Borrow the terminal for the duration of `work`: any host UI is suspended and stdin is
   * released, so `work` may read from stdin and write directly to the terminal.
   *
   * Concurrent callers are serialised by the host; a nested call from within a borrow runs
   * immediately.
   */
  withTerminal: <T>(work: () => Promise<T>) => Promise<T>;
  /** Ask the user a question, taking over the terminal for as long as the prompt is open. */
  prompt: (message: string, options?: NuxtPromptOptions) => Promise<any>;
  /** Start a task, to be finished with `task.stop()`. */
  startTask: (label: string) => NuxtTerminalTask;
  /** Show a message and hold it on screen until it is acknowledged or retracted. */
  notify: (notification: NuxtTerminalNotification) => NuxtTerminalNotice;
}
/**
 * Access the terminal, cooperating with the host UI (such as the `nuxt dev` TUI) when one is
 * running, and falling back to logging when it is not.
 *
 * Use this instead of writing to `process.stdout` or prompting directly, so that prompts are
 * answerable, tasks are rendered in one place, and nothing is lost to a captured stream.
 */
export declare function useTerminal(): NuxtTerminal;
//#endregion
//#region src/internal/esm.d.ts
interface ResolveModuleOptions {
  /** @deprecated use `url` with URLs pointing at a file - never a directory */
  paths?: string | string[];
  url?: URL | URL[];
  /** @default ['.mjs', '.js', '.cjs', '.mts', '.ts', '.cts', '.tsx', '.jsx'] */
  extensions?: string[];
}
export declare function directoryToURL(dir: string): URL;
/**
 * Resolve a module from a given root path using an algorithm patterned on
 * the upcoming `import.meta.resolve`. It returns a file URL
 */
export declare function tryResolveModule(id: string, url: URL | URL[]): Promise<string | undefined>;
/** @deprecated pass URLs pointing at files */
export declare function tryResolveModule(id: string, url: string | string[]): Promise<string | undefined>;
export declare function resolveModule(id: string, options?: ResolveModuleOptions): string;
interface ImportModuleOptions extends ResolveModuleOptions {
  /** Automatically de-default the result of requiring the module. */
  interopDefault?: boolean;
}
export declare function importModule<T = unknown>(id: string, opts?: ImportModuleOptions): Promise<T>;
export declare function tryImportModule<T = unknown>(id: string, opts?: ImportModuleOptions): Promise<T | undefined> | undefined;
/**
 * @deprecated Please use `importModule` instead.
 */
export declare function requireModule<T = unknown>(id: string, opts?: ImportModuleOptions): T;
/**
 * @deprecated Please use `tryImportModule` instead.
 */
export declare function tryRequireModule<T = unknown>(id: string, opts?: ImportModuleOptions): T | undefined;
//#endregion
//#region src/index.d.ts
/** @deprecated Internal. Import from `@nuxt/kit/internal` instead. */
export declare const DEFAULT_JS_FILE_EXTENSIONS: string[];
/** @deprecated Internal. Import from `@nuxt/kit/internal` instead. */
export declare const DEFAULT_JSX_FILE_EXTENSIONS: string[];
//#endregion
export { type AddComponentOptions, type AddPluginOptions, type AddRouteMiddlewareOptions, type EnsureDependencyInstalledOptions, type ExtendConfigOptions, type ExtendRouteRulesOptions, type ExtendViteConfigOptions, type ExtendWebpackConfigOptions, type ImportModuleOptions, type LayerDirectories, type LoadNuxtConfigOptions, type LoadNuxtOptions, type NitroInstance, type NitroInstanceOptions, type NitroRouteConfig, type NitroRouteConfigV2, type NitroRouteConfigV3, type NuxtConfigDiffEntry, type NuxtContext, type NuxtLogFn, type NuxtLogInput, type NuxtLogLevel, type NuxtLogObject, type NuxtLogReporter, type NuxtLogType, type NuxtLogger, type NuxtLoggerOptions, type NuxtMajorVersion, type NuxtPromptOptions, type NuxtTerminal, type NuxtTerminalNotice, type NuxtTerminalNotification, type NuxtTerminalTask, type RecoverableWatcher, type ResolveModuleOptions, type ResolvePathOptions, type ResolveTypePathsOptions, type ResolvedNuxtConfigContext, type Resolver, type ServerImportInput, addDevServerHandler, addNitroPlugin, addPrerenderRoutes, addServerHandler, addServerImports, addServerImportsDir, addServerPlugin, addServerScanDir, ensureDependencyInstalled, getAddDependencyCommand, getDirectory, installModule, loadNuxtModuleInstance, normalizeModuleTranspilePath, resolveModuleWithOptions, resolveServerVariant, tryUseNitro, useNitro };