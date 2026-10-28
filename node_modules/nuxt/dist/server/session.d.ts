import { CookieSerializeOptions } from "../app/types/cookie.js";
import { RequestEvent } from "nuxt/schema";
//#region src/server/session.d.ts
/**
 * The part of the event the session helpers use.
 *
 * @since 4.6.0
 */
export type SessionEvent = Pick<RequestEvent, 'req' | 'res'>;
/** @since 4.6.0 */
export type SessionData = Record<string, unknown>;
/** @since 4.6.0 */
export interface Session<T extends SessionData = SessionData> {
  /** Generated when the session is created; stable across updates. */
  id: string;
  data: T;
}
/**
 * 32 characters or more, or 32 bytes or more.
 *
 * @since 4.6.0
 */
export type SessionPassword = string | Uint8Array;
/** @since 4.6.0 */
export interface SessionConfig {
  /**
   * The secret to seal with. Defaults to one derived from `appSecret` for the
   * cookie name.
   */
  password?: SessionPassword;
  /** Cookie name. Defaults to `nuxt-session`. */
  name?: string;
  /** Lifetime in seconds of both the cookie and the sealed value. */
  maxAge?: number;
  /** Merged over `httpOnly`, `secure`, `sameSite: 'lax'` and `path: '/'`. */
  cookie?: CookieSerializeOptions;
}
/**
 * A session with the operations that write it back, as {@link useSession} returns it.
 *
 * @since 4.6.0
 */
export interface SessionManager<T extends SessionData = SessionData> {
  readonly id: string;
  readonly data: T;
  update: (update: SessionUpdate<T>) => Promise<SessionManager<T>>;
  clear: () => Promise<SessionManager<T>>;
}
/** @since 4.6.0 */
export type SessionUpdate<T extends SessionData = SessionData> = Partial<T> | ((data: T) => Partial<T> | undefined);
/**
 * The session for the request, with the operations that write it back.
 *
 * @example
 * ```ts
 * // server/api/visits.ts
 * import { defineEventHandler, useSession } from 'nuxt/server'
 *
 * export default defineEventHandler(async (event) => {
 *   const session = await useSession<{ visits: number }>(event)
 *   await session.update(data => ({ visits: (data.visits ?? 0) + 1 }))
 *   return { visits: session.data.visits }
 * })
 * ```
 *
 * @remarks The sealed cookie format may change in a minor release; existing sessions are read in the old format and resealed in the new one on their next write.
 *
 * @since 4.6.0
 */
export declare function useSession<T extends SessionData = SessionData>(event: SessionEvent, config?: SessionConfig): Promise<SessionManager<T>>;
/**
 * The session for the request: unsealed from its cookie, or created empty and
 * sealed into the response when there is no cookie or it cannot be unsealed.
 * Unsealed once per request.
 *
 * @since 4.6.0
 */
export declare function getSession<T extends SessionData = SessionData>(event: SessionEvent, config?: SessionConfig): Promise<Session<T>>;
/**
 * Merge data into the session and reseal it.
 *
 * @since 4.6.0
 */
export declare function updateSession<T extends SessionData = SessionData>(event: SessionEvent, config?: SessionConfig, update?: SessionUpdate<T>): Promise<Session<T>>;
/**
 * Discard the session and expire its cookie.
 *
 * @since 4.6.0
 */
export declare function clearSession(event: SessionEvent, config?: SessionConfig): Promise<void>;
//#endregion