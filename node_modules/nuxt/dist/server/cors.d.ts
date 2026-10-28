import { RequestEvent } from "nuxt/schema";
//#region src/server/cors.d.ts
/**
 * Options for {@link handleCors}. Every option defaults to the most permissive
 * value, so pass the ones to restrict.
 *
 * @since 4.6.0
 */
export interface CorsOptions {
  /**
   * The origins allowed: `'*'` for any, a list of exact origins or patterns, or
   * a function deciding for each origin. Patterns are tested unanchored, so
   * anchor and escape them.
   * @default '*'
   */
  origin?: '*' | 'null' | (string | RegExp)[] | ((origin: string) => boolean);
  /**
   * The methods a preflight allows. With `credentials`, `'*'` reflects the
   * requested method.
   * @default '*'
   */
  methods?: '*' | string[];
  /**
   * The request headers a preflight allows. `'*'` reflects the requested headers.
   * @default '*'
   */
  allowHeaders?: '*' | string[];
  /**
   * The response headers exposed to the client. `'*'` has no effect with `credentials`.
   * @default '*'
   */
  exposeHeaders?: '*' | string[];
  /** Whether the response may be shared with credentials. Requires an origin other than `'*'`. */
  credentials?: boolean;
  /** How long, in seconds, a preflight may be cached, or `false` to leave it to the client. */
  maxAge?: string | false;
  /** The status of a preflight response. */
  preflight?: {
    statusCode?: number;
  };
}
/**
 * Apply CORS headers to the response. A preflight request is answered: the
 * returned `Response` is the handler's result, with the headers set on the
 * event's response. Any other request resolves `false` and continues.
 *
 * @example
 * ```ts
 * export default defineEventHandler((event) => {
 *   const preflight = handleCors(event, { origin: ['https://nuxt.com'], credentials: true })
 *   if (preflight) {
 *     return preflight
 *   }
 *   return { ok: true }
 * })
 * ```
 *
 * @since 4.6.0
 */
export declare function handleCors(event: Pick<RequestEvent, 'req' | 'res'>, options?: CorsOptions): Response | false;
//#endregion