import { h as kUnusedVariants, m as kServerApi, r as findPackageMissingSubpath, x as installModules } from "../dependency-BOcSbIUw.mjs";
import { Nuxt, NuxtBuildOutputs, NuxtOptions } from "@nuxt/schema";
import { NuxtServerBuild } from "@nuxt/schema/internal";
//#region src/diagnostics/build.d.ts
/**
 * B1xxx
 * Build / compilation diagnostics.
 *
 * @internal
 */
export declare const buildDiagnostics: import("nostics").Diagnostics<{
  readonly NUXT_B1001: {
    readonly why: (p: {
      filename: string;
    }) => string;
    readonly fix: (p: {
      src?: string;
    }) => string;
    readonly docs: false;
  };
  readonly NUXT_B1002: {
    readonly why: (p: {
      src: string;
    }) => string;
    readonly fix: "Check that the template `src` path exists and is readable.";
    readonly docs: false;
  };
  readonly NUXT_B1003: {
    readonly why: "Invalid template. Templates must have either `src` or `getContents`.";
    readonly fix: "Add a `getContents` function or a `src` path to the `addTemplate()` call.";
    readonly docs: false;
  };
  readonly NUXT_B1004: {
    readonly why: "Failed to install dependencies.";
    readonly fix: (p: {
      installCommand: string;
    }) => string;
    readonly docs: false;
  };
  readonly NUXT_B1005: {
    readonly why: (p: {
      plugin: string;
      file: string;
    }) => string;
    readonly fix: "Check the file for syntax errors, or report this issue to the plugin author.";
    readonly docs: false;
  };
  readonly NUXT_B1006: {
    readonly why: (p: {
      file: string;
    }) => string;
    readonly fix: "Check that the file exists and has correct permissions.";
    readonly docs: false;
  };
  readonly NUXT_B1007: {
    readonly why: (p: {
      plugin: string;
    }) => string;
    readonly fix: "Check the plugin implementation or report this issue to the plugin author.";
    readonly docs: false;
  };
  readonly NUXT_B1008: {
    readonly why: (p: {
      function: string;
      file: string;
    }) => string;
    readonly fix: "Please report this issue at https://github.com/nuxt/nuxt/issues with the file contents.";
    readonly docs: false;
  };
  readonly NUXT_B1009: {
    readonly why: (p: {
      functionName: string;
      name?: string;
      source?: string;
    }) => string;
    readonly fix: "Ensure each keyed function has a unique name, or use a different source to distinguish them.";
    readonly docs: false;
  };
  readonly NUXT_B1010: {
    readonly why: (p: {
      file: string;
    }) => string;
    readonly fix: "The file was modified while being read, usually by a concurrent process writing to it. Try restarting the build.";
    readonly docs: false;
  };
  readonly NUXT_B1011: {
    readonly why: (p: {
      file: string;
    }) => string;
    readonly fix: "Check that the file exists and is readable, or try clearing the build cache with `nuxt clean`.";
    readonly docs: false;
  };
  readonly NUXT_B1012: {
    readonly why: (p: {
      path: string;
    }) => string;
    readonly fix: "Delete the cache with `nuxt clean` and rebuild.";
    readonly docs: false;
  };
  readonly NUXT_B1013: {
    readonly why: (p: {
      file: string;
    }) => string;
    readonly fix: "Try clearing the build cache with `nuxt clean` and rebuilding from scratch.";
    readonly docs: false;
  };
  readonly NUXT_B1014: {
    readonly why: "Problem checking for external configuration files.";
    readonly fix: "This is likely a transient file system error. If it persists, check file permissions in your project root.";
    readonly docs: false;
  };
  readonly NUXT_B1015: {
    readonly why: "Falling back to `chokidar-granular` as `@parcel/watcher` cannot be resolved in your project.";
    readonly fix: (p: {
      installCommand: string;
    }) => string;
    readonly docs: false;
  };
  readonly NUXT_B1016: {
    readonly why: "Failed to set up the `@parcel/watcher` file watcher.";
    readonly fix: "This is likely an environment or file system issue. Watching for file changes may not work; restart the dev server and, if the problem persists, report it.";
    readonly docs: false;
  };
  readonly NUXT_B1017: {
    readonly why: (p: {
      builder: string;
    }) => string;
    readonly fix: (p: {
      installCommand: string;
    }) => string;
    readonly docs: false;
  };
  readonly NUXT_B1018: {
    readonly why: (p: {
      builder: string;
    }) => string;
    readonly fix: (p: {
      installCommand: string;
    }) => string;
    readonly docs: false;
  };
  readonly NUXT_B1019: {
    readonly why: (p: {
      mode: string;
    }) => string;
    readonly fix: "If you are a module author, ensure the component `mode` is set to `client`, `server`, or `all`. Otherwise, please report this issue.";
    readonly docs: false;
  };
  readonly NUXT_B1020: {
    readonly why: "`experimental.watcher: \"builder\"` is set but the active builder does not implement `setupWatcher`. Falling back to the default file watcher.";
    readonly fix: "Remove `experimental.watcher` from your `nuxt.config`, or use a builder that supports its own watcher.";
    readonly docs: false;
  };
  readonly NUXT_B1021: {
    readonly why: (p: {
      export: string;
    }) => string;
    readonly fix: "If you are a module author, ensure the `export` you register for a component is a valid identifier. Otherwise, please report this issue.";
    readonly docs: false;
  };
  readonly NUXT_B1022: {
    readonly why: (p: {
      count: number;
      templates: string;
    }) => string;
    readonly fix: "A `getContents` function returned a promise that never settles. Resolve it before the bundler starts (for example from `pages:resolved` or `nitro:init`), rather than waiting on something that happens during or after bundling.";
    readonly docs: false;
  };
}, readonly [import("nostics").DiagnosticReporter<{
  method?: import("nostics").ConsoleMethod;
}, any>], never>;
//#endregion
//#region src/diagnostics/plugins.d.ts
/**
 * B2xxx
 * Plugin diagnostics (`addPlugin`, plugin metadata, plugin ordering).
 *
 * @internal
 */
export declare const pluginDiagnostics: import("nostics").Diagnostics<{
  readonly NUXT_B2001: {
    readonly why: (p: {
      type: string;
      name: string;
    }) => string;
    readonly fix: "Pass an object literal as the second argument, e.g. `defineNuxtPlugin(() => {}, { name: 'my-plugin' })`.";
    readonly docs: false;
  };
  readonly NUXT_B2002: {
    readonly why: "Plugin options contain spread elements or computed keys, which are not supported.";
    readonly fix: "Use static properties instead.";
    readonly docs: false;
  };
  readonly NUXT_B2003: {
    readonly why: "`dependsOn` is not an array of string literals.";
    readonly fix: "Use string literals in the `dependsOn` array, e.g. `dependsOn: ['my-plugin']`.";
    readonly docs: false;
  };
  readonly NUXT_B2004: {
    readonly why: (p: {
      src: string;
    }) => string;
    readonly fix: "Add content to the plugin file, or remove it from the `plugins/` directory.";
    readonly docs: false;
  };
  readonly NUXT_B2005: {
    readonly why: (p: {
      src: string;
    }) => string;
    readonly fix: "Add `export default defineNuxtPlugin(() => {})` to your plugin.";
    readonly docs: false;
  };
  readonly NUXT_B2006: {
    readonly why: (p: {
      src: string;
    }) => string;
    readonly fix: "Check the plugin file for syntax errors.";
    readonly docs: false;
  };
  readonly NUXT_B2007: {
    readonly why: (p: {
      src: string;
    }) => string;
    readonly fix: "Wrap your plugin with `defineNuxtPlugin`. This may enable enhancements in future.";
    readonly docs: false;
  };
  readonly NUXT_B2008: {
    readonly why: (p: {
      name: string;
      missing: string;
    }) => string;
    readonly fix: "Register the missing dependency plugins, or remove them from the `dependsOn` array.";
    readonly docs: false;
  };
  readonly NUXT_B2009: {
    readonly why: (p: {
      cycle: string;
    }) => string;
    readonly fix: "Restructure the plugin `dependsOn` declarations to break the cycle.";
    readonly docs: false;
  };
  readonly NUXT_B2010: {
    readonly why: (p: {
      src: string;
    }) => string;
    readonly fix: "Use an object literal with static values as the second argument to `defineNuxtPlugin()`, and check the plugin file for syntax errors or unsupported constructs in the metadata.";
    readonly docs: false;
  };
  readonly NUXT_B2011: {
    readonly why: (p: {
      src: string;
    }) => string;
    readonly fix: "Pass a string path, or an object with a `src` property, to `addPlugin()`.";
    readonly docs: false;
  };
  readonly NUXT_B2012: {
    readonly why: (p: {
      name: string;
      dependencies: string[];
      mode: "client" | "server";
    }) => string;
    readonly fix: "Do not depend on plugins that are unavailable in the same build environment; remove them from the `dependsOn` array.";
    readonly docs: false;
  };
}, readonly [import("nostics").DiagnosticReporter<{
  method?: import("nostics").ConsoleMethod;
}, any>], never>;
//#endregion
//#region src/diagnostics/components.d.ts
/**
 * B3xxx
 * Component diagnostics.
 *
 * @internal
 */
export declare const componentDiagnostics: import("nostics").Diagnostics<{
  readonly NUXT_B3001: {
    readonly why: (p: {
      dirPath: string;
    }) => string;
    readonly fix: "If this is intentional, remove it from `components.dirs` in your `nuxt.config`.";
    readonly docs: false;
  };
  readonly NUXT_B3002: {
    readonly why: (p: {
      component: string;
    }) => string;
    readonly fix: "Set `experimental.componentIslands` to `true` in your `nuxt.config`, or convert the component to a client component.";
    readonly docs: false;
  };
  readonly NUXT_B3003: {
    readonly why: (p: {
      component: string;
    }) => string;
    readonly fix: "Set `experimental.componentIslands` to `true` in your `nuxt.config`.";
    readonly docs: false;
  };
  readonly NUXT_B3004: {
    readonly why: (p: {
      file: string;
      component: string;
      requiredModule: string;
    }) => string;
    readonly fix: (p: {
      requiredModule: string;
    }) => string;
    readonly docs: false;
  };
  readonly NUXT_B3005: {
    readonly why: (p: {
      component: string;
      file: string;
    }) => string;
    readonly fix: "Use only one hydration strategy attribute (e.g. `hydrate-on-visible` or `hydrate-on-idle`) per component.";
    readonly docs: false;
  };
  readonly NUXT_B3006: {
    readonly why: (p: {
      component: string;
      file: string;
    }) => string;
    readonly fix: (p: {
      lazyName: string;
    }) => string;
    readonly docs: false;
  };
  readonly NUXT_B3007: {
    readonly why: (p: {
      file: string;
    }) => string;
    readonly fix: "Set `experimental.componentIslands.selectiveClient` to `true` in your `nuxt.config`.";
    readonly docs: false;
  };
  readonly NUXT_B3008: {
    readonly why: (p: {
      scannedPath: string;
    }) => string;
    readonly fix: (p: {
      scannedPath: string;
      expectedPath: string;
    }) => string;
    readonly docs: false;
  };
  readonly NUXT_B3009: {
    readonly why: (p: {
      component: string;
      filePath: string;
    }) => string;
    readonly fix: "Rename the component to avoid the `Lazy` prefix.";
    readonly docs: false;
  };
  readonly NUXT_B3010: {
    readonly why: (p: {
      filePath: string;
    }) => string;
    readonly fix: "Rename the component file to something other than `index` (e.g. `MyComponent.vue`).";
    readonly docs: false;
  };
  readonly NUXT_B3011: {
    readonly why: (p: {
      component: string;
      filePath: string;
      duplicatePath: string;
    }) => string;
    readonly fix: "Rename one of the files or adjust the `components.dirs` prefix settings in your `nuxt.config`.";
    readonly docs: false;
  };
  readonly NUXT_B3012: {
    readonly why: (p: {
      name: string;
    }) => string;
    readonly fix: "Specify a `priority` option when calling `addComponent` to avoid this warning.";
    readonly docs: false;
  };
  readonly NUXT_B3013: {
    readonly why: (p: {
      file: string;
    }) => string;
    readonly fix: "Switch to the Vite builder with `builder: 'vite'` in your `nuxt.config`.";
    readonly docs: false;
  };
}, readonly [import("nostics").DiagnosticReporter<{
  method?: import("nostics").ConsoleMethod;
}, any>], never>;
//#endregion
//#region src/diagnostics/pages.d.ts
/**
 * B4xxx
 * Pages / routing diagnostics.
 *
 * @internal
 */
export declare const pageDiagnostics: import("nostics").Diagnostics<{
  readonly NUXT_B4001: {
    readonly why: (p: {
      pathname: string;
    }) => string;
    readonly fix: "Add a `<template>` block to the page file, or remove the empty file from the `pages/` directory.";
    readonly docs: false;
  };
  readonly NUXT_B4002: {
    readonly why: "An `await` expression is used in a variable referenced by `definePageMeta`, which runs synchronously.";
    readonly fix: (p: {
      codeSnippet: string;
      offset: number;
    }) => string;
    readonly docs: false;
  };
  readonly NUXT_B4003: {
    readonly why: (p: {
      callCount: number;
      file: string;
    }) => string;
    readonly fix: "Merge all `definePageMeta()` calls into a single call.";
    readonly docs: false;
  };
  readonly NUXT_B4004: {
    readonly why: (p: {
      file: string;
      existingFile: string;
    }) => string;
    readonly fix: "Set a custom name using `definePageMeta` within one of the page files.";
    readonly docs: false;
  };
  readonly NUXT_B4005: {
    readonly why: (p: {
      fnName: string;
      file: string;
      receivedType: string;
    }) => string;
    readonly fix: (p: {
      fnName: string;
    }) => string;
    readonly docs: false;
  };
  readonly NUXT_B4006: {
    readonly why: (p: {
      fnName: string;
      file: string;
    }) => string;
    readonly fix: "Use only JSON-serializable values (strings, numbers, booleans, arrays, plain objects) in `defineRouteRules()`.";
    readonly docs: false;
  };
  readonly NUXT_B4007: {
    readonly why: (p: {
      fnName: string;
      file: string;
    }) => string;
    readonly fix: (p: {
      fnName: string;
    }) => string;
    readonly docs: false;
  };
  readonly NUXT_B4008: {
    readonly why: "Server pages with `ssr: false` are not supported while component islands are auto-detected.";
    readonly fix: "Set `experimental.componentIslands` to `true`.";
    readonly docs: false;
  };
  readonly NUXT_B4009: {
    readonly why: (p: {
      file: string;
    }) => string;
    readonly fix: "Rename the layout file to something other than `index` (e.g. `layouts/default.vue`).";
    readonly docs: false;
  };
  readonly NUXT_B4010: {
    readonly why: (p: {
      file: string;
    }) => string;
    readonly fix: "Rename the middleware file to something other than `index` (e.g. `middleware/auth.ts`).";
    readonly docs: false;
  };
  readonly NUXT_B4011: {
    readonly why: (p: {
      message: string;
    }) => string;
    readonly fix: "Check the page file naming and directory structure for issues.";
    readonly docs: false;
  };
  readonly NUXT_B4012: {
    readonly why: (p: {
      event: string;
      path: string;
    }) => string;
    readonly fix: "This is usually harmless: the full rebuild will recover. If it happens repeatedly, check for unusual file naming in `pages/`.";
    readonly docs: false;
  };
  readonly NUXT_B4013: {
    readonly why: (p: {
      name: string;
      foundPath: string;
    }) => string;
    readonly fix: "Set `override: true` to replace it.";
    readonly docs: false;
  };
  readonly NUXT_B4014: {
    readonly why: (p: {
      layoutName: string;
      existingPath: string;
      newPath: string;
    }) => string;
    readonly fix: "Rename one of the layouts, or remove the duplicate layout registration.";
    readonly docs: false;
  };
  readonly NUXT_B4015: {
    readonly why: (p: {
      asset: string;
      route: string;
      page?: string;
    }) => string;
    readonly fix: "Rename or move the public asset, change its public asset base URL, or remove the conflicting page.";
    readonly docs: false;
  };
  readonly NUXT_B4016: {
    readonly why: (p: {
      path: string;
      detail: string;
    }) => string;
    readonly fix: "Define the affected route rules explicitly in `nitro.routeRules`.";
    readonly docs: false;
  };
  readonly NUXT_B4017: {
    readonly why: (p: {
      path: string;
      pattern: string;
    }) => string;
    readonly fix: "The later inline route rules override the earlier ones. Use distinct routes, or define the rules explicitly in `nitro.routeRules`.";
    readonly docs: false;
  };
  readonly NUXT_B4018: {
    readonly why: (p: {
      paths: string[];
    }) => string;
    readonly fix: "Simplify the affected page paths, or disable `experimental.early404`.";
    readonly docs: false;
  };
  readonly NUXT_B4019: {
    readonly why: "A root-level catch-all page matches every path, so `experimental.early404` has no effect and has been disabled.";
    readonly fix: "Remove the root-level catch-all page, or disable `experimental.early404`.";
    readonly docs: false;
  };
  readonly NUXT_B4020: {
    readonly why: (p: {
      file: string;
    }) => string;
    readonly fix: "Avoid modifying `routes` in `router.options`, or disable `experimental.early404`.";
    readonly docs: false;
  };
  readonly NUXT_B4021: {
    readonly why: (p: {
      paths: string;
    }) => string;
    readonly fix: "Remove one of the two rules.";
    readonly docs: false;
  };
}, readonly [import("nostics").DiagnosticReporter<{
  method?: import("nostics").ConsoleMethod;
}, any>], never>;
//#endregion
//#region src/diagnostics/config.d.ts
/**
 * B5xxx
 * Configuration diagnostics.
 *
 * @internal
 */
export declare const configDiagnostics: import("nostics").Diagnostics<{
  readonly NUXT_B5001: {
    readonly why: (p: {
      fallback: string;
    }) => string;
    readonly fix: (p: {
      latest: string;
    }) => string;
  };
  readonly NUXT_B5002: {
    readonly why: (p: {
      rootDir: string;
    }) => string;
    readonly fix: (p: {
      installCommand: string;
    }) => string;
    readonly docs: false;
  };
  readonly NUXT_B5003: {
    readonly why: (p: {
      key: string;
    }) => string;
    readonly fix: "Move the key to `runtimeConfig.public` or a custom namespace.";
  };
  readonly NUXT_B5004: {
    readonly why: (p: {
      files: string;
    }) => string;
    readonly fix: "Move these configurations into `nuxt.config.ts` and delete the external config files.";
  };
  readonly NUXT_B5005: {
    readonly why: (p: {
      filePath: string;
    }) => string;
    readonly fix: "Ensure the file exports a valid object with `defineNuxtSchema()` or as a plain object.";
    readonly docs: false;
  };
  readonly NUXT_B5006: {
    readonly why: (p: {
      option: string;
    }) => string;
    readonly fix: "Remove the hash option from your webpack config.";
    readonly docs: false;
  };
  readonly NUXT_B5007: {
    readonly why: "The webpack server config `target` is not set to \"node\".";
    readonly fix: "Set `target: \"node\"` in your webpack server configuration.";
    readonly docs: false;
  };
  readonly NUXT_B5009: {
    readonly why: "`@parcel/watcher` cannot be resolved in your project, so `chokidar` is being used instead.";
    readonly fix: (p: {
      installCommand: string;
    }) => string;
    readonly docs: false;
  };
  readonly NUXT_B5010: {
    readonly why: (p: {
      names: string;
    }) => string;
    readonly fix: (p: {
      installCommand: string;
    }) => string;
    readonly docs: false;
  };
  readonly NUXT_B5011: {
    readonly why: (p: {
      name: string;
    }) => string;
    readonly fix: (p: {
      name: string;
    }) => string;
    readonly docs: false;
  };
  readonly NUXT_B5017: {
    readonly why: (p: {
      filePath: string;
      error: string;
    }) => string;
    readonly fix: (p: {
      installCommand: string;
    }) => string;
    readonly docs: false;
  };
  readonly NUXT_B5018: {
    readonly why: (p: {
      source: string;
    }) => string;
    readonly fix: (p: {
      source: string;
      installCommand: string;
    }) => string;
    readonly docs: false;
  };
  readonly NUXT_B5019: {
    readonly why: (p: {
      filePath: string;
    }) => string;
    readonly fix: (p: {
      installCommand: string;
    }) => string;
    readonly docs: false;
  };
  readonly NUXT_B5021: {
    readonly why: (p: {
      filePath: string;
      error: string;
    }) => string;
    readonly fix: (p: {
      installCommand: string;
    }) => string;
    readonly docs: false;
  };
  readonly NUXT_B5022: {
    readonly why: "A `nuxt.config` in yaml, toml, jsonc or json5 is parsed by the `confbox` package, which is not installed.";
    readonly fix: (p: {
      installCommand: string;
    }) => string;
    readonly docs: false;
  };
  readonly NUXT_B5023: {
    readonly why: (p: {
      filePath: string;
      error: string;
    }) => string;
    readonly fix: "Loading it natively is faster, as jiti has to transform the file first. Relative imports need an explicit file extension, and `import.meta.dirname` replaces `__dirname`.";
    readonly docs: false;
  };
  readonly NUXT_B5024: {
    readonly why: "`vue.vapor` requires vue `3.6.0` or later, so vapor mode has been disabled.";
    readonly fix: "Upgrade to vue `3.6.0` or later, or remove `vue.vapor` from your `nuxt.config`.";
    readonly docs: false;
  };
  readonly NUXT_B5025: {
    readonly why: (p: {
      entry: string;
    }) => string;
    readonly fix: (p: {
      replacement: string;
    }) => string;
    readonly docs: false;
  };
  readonly NUXT_B5026: {
    readonly why: (p: {
      entry: string;
      resolved?: string;
    }) => string;
    readonly fix: "Ensure the file exists, or remove the entry from `css` in your `nuxt.config`.";
    readonly docs: false;
  };
  readonly NUXT_B5028: {
    readonly why: "A generated development secret is being used because `runtimeConfig.appSecret` is unset.";
    readonly fix: "Set `NUXT_APP_SECRET` in your `.env` to the output of `openssl rand -base64 32`. Builds do not generate a secret.";
    readonly docs: false;
  };
}, readonly [import("nostics").DiagnosticReporter<{
  method?: import("nostics").ConsoleMethod;
}, any>], never>;
//#endregion
//#region src/diagnostics/head.d.ts
/**
 * B6xxx
 * Head / auto-import diagnostics.
 *
 * @internal
 */
export declare const headDiagnostics: import("nostics").Diagnostics<{
  readonly NUXT_B6001: {
    readonly why: (p: {
      module: string;
      file: string;
    }) => string;
    readonly fix: "Import from `#imports` instead.";
    readonly docs: false;
  };
  readonly NUXT_B6002: {
    readonly why: (p: {
      name: string;
    }) => string;
    readonly fix: (p: {
      name: string;
      file: string;
    }) => string;
    readonly docs: false;
  };
  readonly NUXT_B6003: {
    readonly why: "`unhead.legacy` is deprecated and will be removed.";
    readonly fix: "Remove deprecated head patterns (`hid`, `vmid`, `children`, `body: true`) and resolve promise values before passing them to `useHead`.";
    readonly docs: false;
  };
  readonly NUXT_B6004: {
    readonly why: "`experimental.headNext` is deprecated. CAPO sorting is now the default.";
    readonly fix: "Remove `experimental.headNext` from your `nuxt.config`, or set `unhead.legacy: true` to opt out temporarily.";
    readonly docs: false;
  };
  readonly NUXT_B6005: {
    readonly why: (p: {
      name: string;
      from: string;
    }) => string;
    readonly fix: "Check the `from` path in `imports.presets` (or the module that registered this import). Auto-imports from an unresolvable module are silently skipped and can surface as unrelated type errors elsewhere.";
    readonly docs: false;
  };
}, readonly [import("nostics").DiagnosticReporter<{
  method?: import("nostics").ConsoleMethod;
}, any>], never>;
//#endregion
//#region src/diagnostics/bundler.d.ts
/**
 * B7xxx
 * Bundler (Vite / webpack / Nitro) diagnostics.
 *
 * @internal
 */
export declare const bundlerDiagnostics: import("nostics").Diagnostics<{
  readonly NUXT_B7001: {
    readonly why: "`rollup-plugin-visualizer` is not installed, so bundle analysis cannot run.";
    readonly fix: (p: {
      installCommand: string;
    }) => string;
    readonly docs: false;
  };
  readonly NUXT_B7002: {
    readonly why: (p: {
      deps: string;
    }) => string;
    readonly fix: "Remove or correct these entries in the `vite.optimizeDeps.include` array of your `nuxt.config.ts`. Report entries added by a Nuxt module to the module author.";
    readonly docs: false;
  };
  readonly NUXT_B7003: {
    readonly why: "The server-side bundle produced more than one JS entry file.";
    readonly fix: "Avoid using `optimization.splitChunks` in the server config.";
    readonly docs: false;
  };
  readonly NUXT_B7004: {
    readonly why: (p: {
      entryName: string;
    }) => string;
    readonly fix: (p: {
      entryName: string;
    }) => string;
    readonly docs: false;
  };
  readonly NUXT_B7005: {
    readonly why: (p: {
      input: string;
    }) => string;
    readonly fix: "Set `vite.build.rollupOptions.input` to a string or an object with an `entry` key in your `nuxt.config`.";
    readonly docs: false;
  };
  readonly NUXT_B7006: {
    readonly why: (p: {
      input: string;
    }) => string;
    readonly fix: "Set `vite.build.rollupOptions.input` to a string or an object with a `server` key in your `nuxt.config`.";
    readonly docs: false;
  };
  readonly NUXT_B7007: {
    readonly why: (p: {
      pluginName: string;
    }) => string;
    readonly fix: (p: {
      installCommand: string;
    }) => string;
    readonly docs: false;
  };
  readonly NUXT_B7008: {
    readonly why: "`@vitejs/plugin-vue-jsx` is not installed, so JSX support is unavailable.";
    readonly fix: (p: {
      installCommand: string;
    }) => string;
    readonly docs: false;
  };
  readonly NUXT_B7009: {
    readonly why: (p: {
      deps: string;
    }) => string;
    readonly fix: (p: {
      installCommand: string;
    }) => string;
    readonly docs: false;
  };
  readonly NUXT_B7011: {
    readonly why: (p: {
      pluginName: string;
    }) => string;
    readonly fix: (p: {
      installCommand: string;
    }) => string;
    readonly docs: false;
  };
  readonly NUXT_B7012: {
    readonly why: (p: {
      requiredSize: number;
      maxSize: number;
    }) => string;
    readonly fix: "Reduce the payload size sent through the ViteNode socket.";
    readonly docs: false;
  };
  readonly NUXT_B7013: {
    readonly why: "The ViteNode socket server was started without a configured socket path.";
    readonly fix: "This is likely an internal Nuxt bug. Please report it at https://github.com/nuxt/nuxt/issues.";
    readonly docs: false;
  };
  readonly NUXT_B7014: {
    readonly why: (p: {
      name: string;
    }) => string;
    readonly fix: "Fix the build errors listed above. If the errors are unclear, try running `nuxt cleanup` and rebuilding.";
    readonly docs: false;
  };
  readonly NUXT_B7015: {
    readonly why: "Payload extraction is disabled, which is suboptimal for full-static output.";
    readonly fix: "Set `experimental.payloadExtraction` to `true` or `'client'`.";
    readonly docs: false;
  };
  readonly NUXT_B7016: {
    readonly why: (p: {
      path: string;
    }) => string;
    readonly fix: "Point `spaLoadingTemplate` in `nuxt.config` at an existing HTML file, or set it to `true` to use the default template.";
    readonly docs: false;
  };
  readonly NUXT_B7017: {
    readonly why: "Could not find the Nuxt dev server to attach Rspack HMR to; hot module replacement will be disabled.";
    readonly fix: "This is likely an internal Nuxt bug. Please report it with a reproduction.";
    readonly docs: false;
  };
  readonly NUXT_B7018: {
    readonly why: "Failed to restrict vite-node socket permissions; closing the socket.";
    readonly fix: "Check that the temporary directory used for the vite-node socket is writable and supports `chmod`.";
    readonly docs: false;
  };
  readonly NUXT_B7019: {
    readonly why: "The server webpack build does not externalize dependencies.";
    readonly fix: "Externalize dependencies in the server build (`externals`) for better build performance.";
    readonly docs: false;
  };
  readonly NUXT_B7020: {
    readonly why: "The client build manifest is disabled, but Nuxt requires it to render the correct assets for each route.";
    readonly fix: "Remove any `build.manifest: false` override from your `nuxt.config` `vite` options or from a Vite plugin `config`/`configEnvironment` hook.";
    readonly docs: false;
  };
  readonly NUXT_B7021: {
    readonly why: (p: {
      manifestFile: string;
    }) => string;
    readonly fix: "Check that no Vite plugin removes or renames the client build manifest in a `generateBundle`/`writeBundle` hook. If this happens with no such plugin, please report it at https://github.com/nuxt/nuxt/issues.";
    readonly docs: false;
  };
  readonly NUXT_B7022: {
    readonly why: (p: {
      existing: string;
      route: string;
    }) => string;
    readonly fix: (p: {
      canFold: boolean;
    }) => string;
    readonly docs: false;
  };
  readonly NUXT_B7023: {
    readonly why: (p: {
      dir: string;
      baseURL: string;
    }) => string;
    readonly fix: (p: {
      resolvedFrom: string;
    }) => string;
    readonly docs: false;
  };
  readonly NUXT_B7024: {
    readonly why: (p: {
      outDir: string;
      publicDir: string;
    }) => string;
    readonly fix: "Remove the `vite.$client.build.outDir` override from your `nuxt.config`, and set `nitro.output.publicDir` to move the whole public output instead.";
    readonly docs: false;
  };
  readonly NUXT_B7025: {
    readonly why: (p: {
      input: string;
    }) => string;
    readonly fix: "Pass an object to `vite.$client.build.rolldownOptions.input` if you need additional inputs, or add an `index.html` at the root of your app directory to take over the document itself.";
    readonly docs: false;
  };
  readonly NUXT_B7026: {
    readonly why: (p: {
      route: string;
    }) => string;
    readonly fix: "Rename it to `redirect.status`. Nuxt has applied it as `status` for now.";
    readonly docs: false;
  };
  readonly NUXT_B7027: {
    readonly why: (p: {
      pluginName: string;
      packageName: string;
    }) => string;
    readonly fix: (p: {
      pluginName: string;
      packageName: string;
    }) => string;
    readonly docs: false;
  };
}, readonly [import("nostics").DiagnosticReporter<{
  method?: import("nostics").ConsoleMethod;
}, any>], never>;
//#endregion
//#region src/internal/pending-templates.d.ts
/** @internal */
export declare function reportPendingTemplates(): boolean;
/**
 * Nothing else keeps the event loop alive during a build, so a template whose contents never
 * resolve would otherwise let the process drain and exit 0 with no output.
 *
 * @internal
 */
export declare function trackPendingTemplate<T>(filename: string, getContents: () => T | Promise<T>): Promise<T>;
//#endregion
//#region src/internal/jiti.d.ts
type JitiModule = typeof import('jiti');
interface LoadJitiOptions {
  /** Project root, used to look for a project-level `jiti` and to run the install in. */
  rootDir: string;
  /** Additional directories to look for a project-level `jiti` in, typically `modulesDir`. */
  searchPaths?: string[];
  /**
   * Offer to install `jiti` when it cannot be found. Set to `false` where a caller can carry on
   * without it.
   * @default true
   */
  install?: boolean;
}
/**
 * Load the `jiti` module, or return `undefined` when it is unavailable.
 *
 * `jiti` is an optional peer dependency, needed only where the runtime cannot load a file itself.
 * It is looked for in three places, in order, so that a project which already has `jiti` never
 * sees a prompt:
 *
 * 1. Resolvable from `@nuxt/kit` — the optional peer dependency, and how a package manager
 *    satisfies it when the project (or `nuxt` itself, on v3 and v4) depends on `jiti`.
 * 2. Resolvable from the project, or from `nuxt` itself. A project depends on `nuxt` rather than
 *    on what `nuxt` depends on, so under an isolated `node_modules` the `jiti` that Nuxt 3 and 4
 *    install is reachable only by hopping through `nuxt`.
 * 3. Installed on request, if `install` is not disabled.
 *
 * A successful load is cached for the lifetime of the process; a failure is not, so a later call
 * with different search paths can still succeed. The in-flight promise is shared so that
 * concurrent callers cannot each trigger an install prompt.
 */
export declare function loadJiti(options: LoadJitiOptions): Promise<JitiModule | undefined>;
//#endregion
//#region src/internal/node-module.d.ts
interface ParsedNodeModulePath {
  dir?: string;
  name?: string;
  subpath?: string;
}
/**
 * Split a path within `node_modules` into the containing `node_modules` directory,
 * the package name and the subpath within the package.
 */
export declare function parseNodeModulePath(path: string | URL): ParsedNodeModulePath;
//#endregion
//#region src/internal/subpath-imports.d.ts
/**
 * Whether `id` belongs to a package installed in `node_modules` or outside `rootDir` that maps
 * `specifier` through its own `imports` field.
 */
export declare function hasOwnSubpathImport(id: string, specifier: string, rootDir: string): Promise<boolean>;
//#endregion
//#region src/internal/exports.d.ts
interface ResolveModuleExportNamesOptions {
  extensions?: string[];
  /** File URL(s) to resolve `id` from. */
  url?: string | URL | Array<string | URL>;
}
/**
 * Resolve the names a module exports, following `export * from '...'` re-exports.
 *
 * Type-only exports are omitted; a default export is returned as `default`.
 *
 * @internal
 */
export declare function resolveModuleExportNames(id: string, options?: ResolveModuleExportNamesOptions): Promise<string[]>;
//#endregion
//#region src/constants.d.ts
/**
 * Default extensions for files that may contain JSX.
 * @internal
 */
export declare const DEFAULT_JSX_FILE_EXTENSIONS: string[];
/**
 * Default extensions for JavaScript/TypeScript files, in order of resolution priority.
 * @internal
 */
export declare const DEFAULT_JS_FILE_EXTENSIONS: string[];
//#endregion
//#region src/internal/server-build.d.ts
type PartialServerBuild = Partial<Omit<NuxtServerBuild, 'input' | 'output' | 'capabilities'>> & {
  input?: Partial<NuxtServerBuild['input']>;
  output?: Partial<NuxtServerBuild['output']>;
  capabilities?: Partial<NuxtServerBuild['capabilities']>;
};
/**
 * Describe the build the configured server builder produces. See {@link NuxtServerBuild}.
 *
 * Called by server builders, once they know their own output paths and target, and by app
 * builders for the `input` paths they emit; anything else should read the description with
 * {@link useServerBuild}.
 *
 * @internal
 */
export declare function setServerBuild(build: PartialServerBuild, nuxt?: Nuxt): void;
/**
 * A description of the build the configured server builder produces.
 *
 * Paths and the deploy target are resolved on access, so call them from a hook that runs
 * after the server builder has initialised.
 *
 * @internal
 */
export declare function useServerBuild(nuxt?: Nuxt): NuxtServerBuild;
/**
 * The description a Nitro-backed build has before any builder registers its own, and the
 * fallback for a partially constructed `Nuxt` (a test fixture, say). Every path is
 * resolved on access, so constructing this never touches the filesystem or requires a
 * fully resolved configuration.
 *
 * @internal
 */
export declare function createServerBuild(options: NuxtOptions): NuxtServerBuild;
//#endregion
//#region src/internal/renderer.d.ts
/** Names of the constants `nuxt/internal/renderer-config` inlines, which documents what each one means. */
type RendererConfigName = 'NUXT_NO_SSR' | 'NUXT_PRERENDER_ERROR_PAGES' | 'NUXT_PRERENDER_NO_SSR_ROUTES' | 'NUXT_EARLY_HINTS' | 'NUXT_NO_SCRIPTS' | 'NUXT_HAS_NO_SCRIPTS_ROUTES' | 'NUXT_NO_SCRIPTS_PROD' | 'NUXT_INLINE_STYLES' | 'NUXT_VIEW_TRANSITIONS' | 'NUXT_NO_SCRIPTS_PATTERNS' | 'NUXT_PAGE_PATTERNS' | 'NUXT_EARLY_404' | 'NUXT_PAGE_MATCHER' | 'NUXT_INLINE_ERROR_RENDERING' | 'PARSE_ERROR_DATA' | 'NUXT_JSON_PAYLOADS' | 'NUXT_PAYLOAD_EXTRACTION' | 'NUXT_PAYLOAD_INLINE' | 'NUXT_RUNTIME_PAYLOAD_EXTRACTION' | 'NUXT_SSR_STREAMING' | 'NUXT_SSR_STREAMING_BOT_RE' | 'appHead' | 'appRootTag' | 'appRootAttrs' | 'appTeleportTag' | 'appTeleportAttrs' | 'appSpaLoaderTag' | 'appSpaLoaderAttrs' | 'spaLoadingTemplateOutside' | 'spaTemplate' | 'appId' | 'multiApp' | 'componentIslands' | 'componentIslandsActive' | 'tracingChannelNuxt';
interface RendererConfigOptions {
  /** JS expressions replacing individual constants, for values a builder resolves itself. */
  overrides?: Partial<Record<RendererConfigName, string>>;
  /** Specifier the generated module re-exports unhead's `createHead` options from. */
  unheadOptions?: string;
  /** Specifier the generated module re-exports the head module's own render options from. */
  headConfig?: string;
  /** Statements prepended to the generated module, for an override that reads a value from an import. */
  prelude?: string;
}
/**
 * Version of the server runtime contract, bumped whenever a server builder has to do
 * something different with what {@link getServerRuntime} hands it. A builder compares it
 * against the version it was written for, so a mismatch is a build-time error rather than
 * a module that silently resolves to a stub.
 */
export declare const SERVER_RUNTIME_VERSION = 1;
/** A module the SSR renderer imports, whose body only the build knows. */
interface NuxtServerRuntimeModule {
  /**
   * The module body. Read lazily, and more than once, so a builder may register the module
   * before the value exists and still resolve the finalised one.
   */
  code: () => string | Promise<string>;
  /** The {@link NuxtBuildOutputs} key backing the module, absent for a module core generates itself. */
  output?: keyof NuxtBuildOutputs;
}
/** What core provides for a server builder to render with. See {@link getServerRuntime}. */
interface NuxtServerRuntime {
  /** See {@link SERVER_RUNTIME_VERSION}. */
  version: number;
  /**
   * Modules the renderer imports and the builder must resolve, keyed by specifier. A builder
   * registers each one however its bundler prefers (a virtual module, an alias, a file it
   * writes) without knowing what any of them mean.
   */
  modules: Record<string, NuxtServerRuntimeModule>;
  /**
   * Build-time replacements the renderer must be compiled with. A builder that does not
   * apply them ships both sides of every branch, and reaches the runtime with
   * `import.meta.prerender` undefined, which silently disables payload extraction.
   */
  defines: Record<string, string>;
  /** Specifier the builder imports `createNuxtRenderer` from in the module it makes its server entry. */
  entry: string;
}
interface ServerRuntimeOptions extends Omit<RendererConfigOptions, 'overrides'> {
  /** The phase the bundle renders in, which `import.meta.prerender` folds against. */
  phase?: 'server' | 'prerender';
  /**
   * JS expressions replacing individual renderer constants, for values a builder resolves
   * itself. A function is called each time the module body is read, so a value that is only
   * final after another part of the build has run can be provided as one.
   */
  overrides?: RendererConfigOptions['overrides'] | (() => RendererConfigOptions['overrides'] | Promise<RendererConfigOptions['overrides']>);
}
/**
 * Everything core provides for a server builder to stand up the SSR renderer with: the
 * modules the renderer imports, the defines it must be compiled with, and the specifier
 * its server entry creates the renderer from.
 *
 * Core owns the set of modules, so a builder that iterates them keeps working when the set
 * changes; {@link SERVER_RUNTIME_VERSION} is what tells it when it cannot.
 *
 * @internal
 */
export declare function getServerRuntime(options?: ServerRuntimeOptions, nuxt?: Nuxt): NuxtServerRuntime;
//#endregion
export { type NuxtServerRuntime, type NuxtServerRuntimeModule, type ParsedNodeModulePath, type RendererConfigName, type ResolveModuleExportNamesOptions, type ServerRuntimeOptions, findPackageMissingSubpath, installModules, kServerApi, kUnusedVariants };