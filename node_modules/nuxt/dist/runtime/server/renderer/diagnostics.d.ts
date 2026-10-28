//#region src/runtime/server/renderer/diagnostics.d.ts
export declare const rendererDiagnostics: import("nostics").Diagnostics<{
  readonly NUXT_E8001: {
    readonly why: (p: {
      path: string;
    }) => string;
    readonly fix: "Use the `render:html:close` hook instead.";
    readonly docs: false;
  };
  readonly NUXT_E8002: {
    readonly why: (p: {
      mutations: string;
      path: string;
    }) => string;
    readonly fix: (p: {
      path: string;
    }) => string;
    readonly docs: false;
  };
  readonly NUXT_E8004: {
    readonly why: "The server bundle is not available.";
    readonly fix: "Ensure the Nuxt build completed successfully and the server entry was emitted by your builder.";
    readonly docs: false;
  };
  readonly NUXT_E8006: {
    readonly why: (p: {
      path: string;
      size: string;
      keys?: string;
    }) => string;
    readonly fix: "Use the `pick` or `transform` options of `useAsyncData`/`useFetch` to strip out data the client does not need.";
    readonly docs: false;
  };
  readonly NUXT_E8007: {
    readonly why: (p: {
      path: string;
      reasons: string;
    }) => string;
    readonly fix: "Remove the client-side dependency from this route, or scope script stripping with the `noScripts` route rule instead of enabling it globally.";
  };
  readonly NUXT_E8009: {
    readonly why: (p: {
      path: string;
      what: string;
      cause: string;
    }) => string;
    readonly fix: "Fix the page error first. If it keeps happening, report the failure below - the browser will show a blank or partial page instead of the error page.";
  };
}, readonly [import("nostics").DiagnosticReporter<{
  method?: import("nostics").ConsoleMethod;
}, any>], never>;
//#endregion