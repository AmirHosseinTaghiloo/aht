import { Nuxt } from "@nuxt/schema";
//#region src/index.d.ts
/**
 * Experimental server builder implemented with Vite alone.
 *
 * It builds the client and emits a document for it: with `ssr: false` that is a complete
 * static SPA. With SSR enabled it also builds a server from the Nuxt SSR renderer, whose
 * entry exports a web-standard `{ fetch }` and, on node, serves the static output in
 * front of it.
 *
 * `nuxt generate` crawls that server at the end of the build, leaving the public directory
 * as the whole deployable.
 *
 * Features that need a server runtime are unsupported: server routes and middleware,
 * route rules an HTTP layer answers (caching, proxying, CORS), and composables that need more of a request than the
 * platform provides. Modules work to the extent that they do not require one:
 * `useNitro()` throws and the `nitro:config` / `nitro:init` hooks never fire.
 */
export declare function bundle(nuxt: Nuxt): Promise<void>;
//#endregion