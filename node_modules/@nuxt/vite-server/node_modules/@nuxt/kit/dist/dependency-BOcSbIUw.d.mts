import { DevServerHandlerInput, ModuleMeta, ModuleOptions, NitroInstance, Nuxt, NuxtConfig, NuxtImport, NuxtModule, ServerApi, ServerApiVariants, ServerHandlerInput, ServerPluginInput } from "@nuxt/schema";
//#region src/module/install.d.ts
type ModuleToInstall = string | NuxtModule<ModuleOptions, Partial<ModuleOptions>, false>;
/**
 * Installs a set of modules on a Nuxt instance.
 * @internal
 */
declare function installModules(modulesToInstall: Map<ModuleToInstall, Record<string, any>>, resolvedModulePaths: Set<string>, nuxt?: Nuxt): Promise<void>;
/**
 * Installs a module on a Nuxt instance.
 * @deprecated Use module dependencies.
 */
declare function installModule<T extends string | NuxtModule, Config extends Extract<NonNullable<NuxtConfig['modules']>[number], [T, any]>>(moduleToInstall: T, inlineOptions?: [Config] extends [never] ? any : Config[1], nuxt?: Nuxt): Promise<void>;
declare function resolveModuleWithOptions(definition: NuxtModule<any> | string | false | undefined | null | [(NuxtModule | string)?, Record<string, any>?], nuxt: Nuxt): {
  resolvedPath?: string;
  module: string | NuxtModule<any>;
  options: Record<string, any>;
} | undefined;
declare function loadNuxtModuleInstance(nuxtModule: string | NuxtModule, nuxt?: Nuxt): Promise<{
  nuxtModule: NuxtModule<any>;
  buildTimeModuleMeta: ModuleMeta;
  resolvedModulePath?: string;
}>;
declare function getDirectory(p: string): string;
declare const normalizeModuleTranspilePath: (p: string) => string;
//#endregion
//#region src/nitro.d.ts
/**
 * Returns the variant the configured server prefers, or `undefined` (with a warning)
 * when it runs none of them.
 *
 * @example
 * ```ts
 * const server = resolveServerVariant({
 *   nuxt: resolver.resolve('./runtime/server'),
 *   nitro2: resolver.resolve('./runtime/server.legacy'),
 * })
 * ```
 */
declare function resolveServerVariant<T>(variants: Partial<Record<ServerApi, T>>): T | undefined;
/**
 * The server API a registration was resolved for, and the variants the host does not run.
 *
 * Symbol-keyed and non-enumerable, so that an entry is exactly what a server builder
 * expects to find in `serverHandlers`, including one that hands it straight to nitro.
 * @internal
 */
declare const kServerApi: unique symbol;
/** @internal */
declare const kUnusedVariants: unique symbol;
/**
 * Adds a server handler.
 *
 * `handler` is a path, or one path per server API for a module shipping an implementation
 * for each while it migrates: the host runs the one it prefers, and the registration is
 * skipped if it can run none of them.
 *
 * @example
 * ```ts
 * addServerHandler({
 *   route: '/api/test',
 *   handler: {
 *     nuxt: resolver.resolve('./runtime/test'),
 *     nitro2: resolver.resolve('./runtime/test.v2'),
 *   },
 * })
 * ```
 */
declare function addServerHandler(handler: ServerHandlerInput): void;
/**
 * Adds a server handler for development only.
 *
 * Variants per server API are resolved as for {@link addServerHandler}.
 */
declare function addDevServerHandler(handler: DevServerHandlerInput): void;
/**
 * Adds a nitro plugin, which runs once when the server starts.
 *
 * `plugin` is a path, or one path per nitro major, resolved as for
 * {@link addServerHandler}. There is no portable variant: `nuxt/server` has no plugin
 * surface, so a plugin is written against nitro.
 */
declare function addNitroPlugin(plugin: ServerPluginInput): void;
/** @deprecated Use {@link addNitroPlugin}: a startup plugin is nitro's, not a portable server API. */
declare function addServerPlugin(plugin: ServerPluginInput): void;
/**
 * Adds routes to be prerendered
 */
declare function addPrerenderRoutes(routes: string | string[]): void;
/**
 * Access to the Nitro instance
 *
 * **Note:** You can call `useNitro()` only after `ready` hook.
 *
 * **Note:** Changes to the Nitro instance configuration are not applied.
 * @example
 *
 * ```ts
 * nuxt.hook('ready', () => {
 *   console.log(useNitro())
 * })
 * ```
 */
declare function useNitro(): NitroInstance;
/**
 * Access to the Nitro instance, if there is one.
 *
 * Returns `undefined` before the `ready` hook has run, and for the lifetime of the
 * build when the configured `server.builder` is not backed by Nitro (such as the
 * static SPA builder). Prefer this over {@link useNitro} for anything that should
 * still work without a server runtime.
 */
declare function tryUseNitro(): NitroInstance | undefined;
/** A server import whose `from` may be one module per server API. */
type ServerImportInput = Omit<NuxtImport, 'from'> & {
  from: ServerApiVariants<string>;
};
/**
 * Add server imports to be auto-imported in the server program.
 */
declare function addServerImports(imports: ServerImportInput | ServerImportInput[]): void;
/**
 * Add directories to be scanned for auto-imports in the server program.
 */
declare function addServerImportsDir(dirs: string | string[], opts?: {
  prepend?: boolean;
}): void;
/**
 * Add directories to be scanned by Nitro. It will check for subdirectories,
 * which will be registered just like the `~~/server` folder is.
 */
declare function addServerScanDir(dirs: string | string[], opts?: {
  prepend?: boolean;
}): void;
//#endregion
//#region src/dependency.d.ts
interface EnsureDependencyInstalledOptions {
  rootDir?: string;
  searchPaths?: string[];
  /**
   * Additional URL or path to resolve packages from (e.g. `import.meta.url`).
   * Useful when the calling package ships optional deps as peer dependencies.
   */
  from?: string;
  /**
   * Whether to prompt the user to install the dependency.
   *
   * - `true`: always prompt
   * - `false`: never prompt (install automatically on StackBlitz)
   * - `undefined`: prompt unless on StackBlitz
   */
  prompt?: boolean;
}
/**
 * Ensure one or more dependencies are installed, prompting the user to install any that are missing.
 *
 * When called with a single package name (string), returns `true` if available, `false` if not.
 *
 * When called with an array, returns `true` if all are available, or an array of
 * package names that are still missing (user declined, install failed, or CI).
 *
 * @param names - One or more package names to check and potentially install
 * @param options - Configuration options
 */
declare function ensureDependencyInstalled(names: string, options?: EnsureDependencyInstalledOptions): Promise<boolean>;
declare function ensureDependencyInstalled(names: string[], options?: EnsureDependencyInstalledOptions): Promise<true | string[]>;
/**
 * The installed package that `specifier` is a missing subpath of, such as `tailwindcss` for
 * `tailwindcss/nesting` when `tailwindcss` is installed but does not provide `nesting`.
 *
 * @internal
 */
declare function findPackageMissingSubpath(specifier: string, searchPaths: string[]): string | undefined;
/**
 * Get the command a user should run to add dependencies to their project, using the
 * package manager detected from `cwd` (falling back to `npm`).
 *
 * Module specifiers with a subpath are installed as the package they belong to.
 *
 * @param names - One or more package names to install
 * @param cwd - Directory to detect the package manager from
 * @param options - Options for the install command
 * @param options.dev - Whether the command should install as a dev dependency
 */
declare function getAddDependencyCommand(names: string | string[], cwd: string, options?: {
  dev?: boolean;
}): Promise<string>;
//#endregion
export { normalizeModuleTranspilePath as C, loadNuxtModuleInstance as S, tryUseNitro as _, ServerImportInput as a, installModule as b, addPrerenderRoutes as c, addServerImportsDir as d, addServerPlugin as f, resolveServerVariant as g, kUnusedVariants as h, getAddDependencyCommand as i, addServerHandler as l, kServerApi as m, ensureDependencyInstalled as n, addDevServerHandler as o, addServerScanDir as p, findPackageMissingSubpath as r, addNitroPlugin as s, EnsureDependencyInstalledOptions as t, addServerImports as u, useNitro as v, resolveModuleWithOptions as w, installModules as x, getDirectory as y };