import { NuxtErrorJSON } from "../app/types.js";
import { NuxtError, NuxtErrorDetails, createError } from "../app/error.js";
import { CookieSerializeOptions } from "../app/types/cookie.js";
import { NuxtServerRendererHooks, ServerHookResult, ServerHookable, useServerHooks } from "./hooks.js";
import { Session, SessionConfig, SessionData, SessionEvent, SessionManager, SessionPassword, SessionUpdate, clearSession, getSession, updateSession, useSession } from "./session.js";
import { deriveSecret } from "./secret.js";
import { ServerFetchInit, serverFetch } from "./fetch.js";
import { CorsOptions, handleCors } from "./cors.js";
import { ValidateResult, getValidatedQuery, readValidatedBody } from "./validate.js";
import { AppRouteRules, AppRouteRules as AppRouteRules$1, NuxtRequestEvent, NuxtServerHooks, RequestEvent, RequestEvent as RequestEvent$1, RequestEventContext, RuntimeConfig, ServerRoutes, SharedAppConfig } from "nuxt/schema";
//#region src/server/index.d.ts
/**
 * A request handler, as {@link defineEventHandler} returns it.
 *
 * @since 4.6.0
 */
export type EventHandler<Result = unknown> = (event: RequestEvent$1) => Result;
/**
 * Define a request handler.
 *
 * The return type is preserved exactly, and is what types `$fetch` and
 * `useFetch` calls to the route, so annotate the returned value rather than
 * the handler.
 *
 * @example
 * ```ts
 * // server/api/hello.ts
 * import { defineEventHandler, getQuery } from 'nuxt/server'
 *
 * export default defineEventHandler((event) => {
 *   const { name } = getQuery<{ name?: string }>(event)
 *   return { message: `Hello, ${name ?? 'world'}!` }
 * })
 * ```
 *
 * @since 4.6.0
 */
export declare function defineEventHandler<Result>(handler: EventHandler<Result>): EventHandler<Result>;
type EventWithRequest = Pick<RequestEvent$1, 'req'>;
/** `url` is optional because a runtime need not parse it up front; the request always carries it. */
type EventWithURL = EventWithRequest & {
  url?: URL;
};
type EventWithResponse = Pick<RequestEvent$1, 'res'>;
/**
 * The shape shared by every HTTP error reachable in server code: the ones
 * {@link createError} constructs, and the ones the server runtime throws for
 * itself, which are not `NuxtError`s.
 *
 * @since 4.6.0
 */
export type NuxtErrorLike<DataT = unknown> = Error & {
  status: number;
} & Partial<Pick<NuxtError<DataT>, 'statusText' | 'data' | 'unhandled'>>;
/**
 * Whether a caught value is an HTTP error carrying a status.
 *
 * The check is structural, because the error may have been constructed by the
 * server runtime rather than by {@link createError}: h3 v1 marks its own errors on their
 * constructor, and h3 v2 names them `HTTPError`.
 *
 * @example
 * ```ts
 * try {
 *   await load()
 * } catch (error) {
 *   if (isNuxtError(error) && error.status === 404) {
 *     return null
 *   }
 *   throw error
 * }
 * ```
 *
 * @since 4.6.0
 */
export declare function isNuxtError<DataT = unknown>(error: unknown): error is NuxtErrorLike<DataT>;
/**
 * Forwarded headers to trust. Enable only behind a proxy that overwrites them.
 *
 * @since 4.6.0
 */
export interface ForwardedOptions {
  /** Read the host from the first entry of `X-Forwarded-Host`. */
  xForwardedHost?: boolean;
  /** Read the protocol from the first entry of `X-Forwarded-Proto`, when it is `http` or `https`. */
  xForwardedProto?: boolean;
}
/**
 * The URL of the incoming request, as a new `URL` each call.
 *
 * @example
 * ```ts
 * const origin = getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).origin
 * ```
 *
 * @since 4.6.0
 */
export declare function getRequestURL(event: EventWithURL, options?: ForwardedOptions): URL;
/**
 * The `Host` of the request, or an empty string.
 *
 * @since 4.6.0
 */
export declare function getRequestHost(event: EventWithRequest, options?: Pick<ForwardedOptions, 'xForwardedHost'>): string;
/**
 * The protocol of the request, without the trailing colon.
 *
 * @since 4.6.0
 */
export declare function getRequestProtocol(event: EventWithURL, options?: Pick<ForwardedOptions, 'xForwardedProto'>): string;
/**
 * Read one request header, or `undefined` when it was not sent.
 *
 * Header names are case-insensitive.
 *
 * @since 4.6.0
 */
export declare function getRequestHeader(event: EventWithRequest, name: string): string | undefined;
/**
 * Read every request header, keyed by lowercased name.
 *
 * @since 4.6.0
 */
export declare function getRequestHeaders(event: EventWithRequest): Record<string, string>;
/**
 * The dynamic segments matched for the request, as they appear in the URL:
 * percent-encoded, as `URLPattern` reports them. Set `decode` to decode them,
 * apart from encoded path separators (`%2F`, `%5C`), so a segment cannot be
 * read as a path it did not match.
 *
 * @example
 * ```ts
 * // server/api/users/[id].ts
 * export default defineEventHandler((event) => {
 *   const { id } = getRouterParams(event, { decode: true })
 *   return { id }
 * })
 * ```
 *
 * @since 4.6.0
 */
export declare function getRouterParams(event: Pick<RequestEvent$1, 'context'>, options?: {
  decode?: boolean;
}): Record<string, string | undefined>;
/**
 * One dynamic segment matched for the request, or `undefined` when the route
 * has none of that name. See {@link getRouterParams}.
 *
 * @since 4.6.0
 */
export declare function getRouterParam(event: Pick<RequestEvent$1, 'context'>, name: string, options?: {
  decode?: boolean;
}): string | undefined;
/**
 * The IP address of the client, or `undefined` when it cannot be determined.
 *
 * By default no forwarded header is trusted: the address is the one the
 * server runtime reports for the connection, and a runtime that reports none
 * resolves `undefined`. Set `xForwardedFor` to read the first entry of the
 * `X-Forwarded-For` header instead, only behind a proxy you control that
 * overwrites that header; one that appends to it leaves a client-sent value
 * first.
 *
 * @since 4.6.0
 */
export declare function getRequestIP(event: EventWithRequest, options?: {
  xForwardedFor?: boolean;
}): string | undefined;
/**
 * Set the status, and optionally the reason phrase, of the response.
 *
 * @since 4.6.0
 */
export declare function setResponseStatus(event: EventWithResponse, status: number, statusText?: string): void;
/**
 * Read the query string of the request. A repeated parameter resolves to an
 * array, so a type parameter should account for that.
 *
 * @since 4.6.0
 */
export declare function getQuery<T extends Record<string, unknown> = Record<string, string | string[]>>(event: EventWithURL): T;
/**
 * Read and parse the request body, once per request.
 *
 * A URL-encoded body is parsed into an object of its fields, with a repeated
 * field collected into an array. Anything else is parsed as JSON, and a body
 * that is not valid JSON is a `400`. An empty body reads as `undefined`.
 *
 * The type parameter is an assertion: validate the result with a schema when
 * it comes from a client.
 *
 * @since 4.6.0
 */
export declare function readBody<T = unknown>(event: EventWithRequest): Promise<T>;
/**
 * Read every cookie sent with the request, keyed by name.
 *
 * @since 4.6.0
 */
export declare function parseCookies(event: EventWithRequest): Record<string, string>;
/**
 * Read one cookie sent with the request, or `undefined` when it was not sent.
 *
 * @since 4.6.0
 */
export declare function getCookie(event: EventWithRequest, name: string): string | undefined;
/**
 * Set a cookie on the response. Each call appends its own `Set-Cookie`
 * header, so several cookies may be set for one response.
 *
 * @since 4.6.0
 */
export declare function setCookie(event: EventWithResponse, name: string, value: string, options?: CookieSerializeOptions): void;
/**
 * Expire a cookie on the response. The `path` and `domain` must match those
 * it was set with, or the original cookie survives alongside the expired one.
 *
 * @since 4.6.0
 */
export declare function deleteCookie(event: EventWithResponse, name: string, options?: CookieSerializeOptions): void;
/**
 * Redirect the request, returning the body to respond with: a
 * `<meta http-equiv="refresh">`, so a client that ignores the status still
 * follows the redirect.
 *
 * @example
 * ```ts
 * export default defineEventHandler(event => sendRedirect(event, '/login', 302))
 * ```
 *
 * @since 4.6.0
 */
export declare function sendRedirect(event: EventWithResponse, location: string, status?: number): string;
/**
 * The route rules matched for the request. A server builder without a
 * route-rule matcher resolves none, so treat every rule as optional.
 *
 * @since 4.6.0
 */
export declare function getRouteRules(_event: Pick<RequestEvent$1, 'context'>): AppRouteRules$1;
/**
 * The route rules for a path relative to the app base URL.
 *
 * @since 4.6.0
 */
export declare function matchRouteRules(_path: string, _method?: string): AppRouteRules$1;
/**
 * The runtime configuration, including the keys only the server can read.
 *
 * @since 4.6.0
 */
export declare function useRuntimeConfig(): RuntimeConfig;
/**
 * The app config, as `app.config.ts` and the layers define it.
 *
 * Called with the event, it returns a copy for that request, which changes
 * made while handling it do not leak out of. Called without, it returns a
 * frozen copy shared by every request.
 *
 * @since 4.6.0
 */
export declare function useAppConfig(event?: Pick<RequestEvent$1, 'context'>): SharedAppConfig;
//#endregion
export { type AppRouteRules, type CorsOptions, type NuxtError, type NuxtErrorDetails, type NuxtErrorJSON, type NuxtRequestEvent, type NuxtServerHooks, type NuxtServerRendererHooks, type RequestEvent, type RequestEventContext, type ServerFetchInit, type ServerHookResult, type ServerHookable, type ServerRoutes, type Session, type SessionConfig, type SessionData, type SessionEvent, type SessionManager, type SessionPassword, type SessionUpdate, type ValidateResult, clearSession, createError, deriveSecret, getSession, getValidatedQuery, handleCors, readValidatedBody, serverFetch, updateSession, useServerHooks, useSession };