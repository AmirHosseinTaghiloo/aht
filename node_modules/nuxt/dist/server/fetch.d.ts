import { RequestEvent } from "nuxt/schema";
//#region src/server/fetch.d.ts
/**
 * Options for {@link serverFetch}.
 *
 * @since 4.6.0
 */
export interface ServerFetchInit extends RequestInit {
  /**
   * Headers to copy from the incoming request. `true` copies `cookie` and `authorization`.
   *
   * @default true
   */
  forwardHeaders?: boolean | string[];
}
/** @internal */
export declare function resolveServerFetchInit(event: Pick<RequestEvent, 'req'>, init?: ServerFetchInit): RequestInit;
/**
 * Fetch a route of this app in-process. The path is relative to the app base URL.
 *
 * @example
 * ```ts
 * const response = await serverFetch(event, '/api/robots-rules')
 * const rules = await response.json()
 * ```
 *
 * @throws a `500` when the server builder provides no in-process fetch.
 * @since 4.6.0
 */
export declare function serverFetch(_event: Pick<RequestEvent, 'req' | 'context'>, path: string, _init?: ServerFetchInit): Promise<Response>;
//#endregion