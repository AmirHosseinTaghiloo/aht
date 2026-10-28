import { NuxtErrorJSON } from "./types.js";
//#region src/app/error.d.ts
export declare const NUXT_ERROR_SIGNATURE: "__nuxt_error";
/**
 * The members are declared here rather than inherited from h3's `H3Error`, but
 * must stay structurally compatible with it: that is what h3 and Nitro read off
 * errors thrown during SSR.
 */
export interface NuxtError<DataT = unknown> extends Error {
  readonly __nuxt_error?: true;
  error?: true;
  /** Whether the error is fatal. */
  fatal: boolean;
  /** Whether the error was not handled by the application. */
  unhandled: boolean;
  /** Additional data attached to the error JSON body under `data`. */
  data?: DataT;
  status?: number;
  statusText?: string;
  /** @deprecated Use `status` */
  statusCode?: number;
  /** @deprecated Use `statusText` */
  statusMessage?: string;
  toJSON(): NuxtErrorJSON<DataT>;
}
/**
 * Details accepted when constructing a {@link NuxtError}, as `createError()` reads them.
 *
 * @since 4.6.0
 */
export type NuxtErrorDetails<DataT = unknown> = Partial<NuxtError<DataT>>;
/** @since 3.0.0 */
export declare const isNuxtError: <DataT = unknown>(error: unknown) => error is NuxtError<DataT>;
/** @since 3.0.0 */
export declare const createError: <DataT = unknown>(error: string | Error | Partial<NuxtError<DataT>>) => NuxtError<DataT>;
/** Set in development on an error created from a thrown value that was not an `Error`. */
export declare const THROWN_VALUE: unique symbol;
/** Set in development to where the app was when it threw. */
export declare const THROWN_CONTEXT: unique symbol;
/** Where the app was when it threw. */
export interface ThrownContext {
  /** The component instance that raised or captured the error. */
  instance?: unknown;
  /** The route being rendered. */
  route?: unknown;
}
/**
 * Wrap whatever the app threw, remembering in development the thrown value and where the
 * app was, for the error report. Outside development this is {@link createError}, so the
 * wrapper leaves no trace in a production bundle.
 *
 * @internal
 */
export declare const createErrorFromThrown: (thrown: unknown, context?: ThrownContext) => NuxtError;
//#endregion