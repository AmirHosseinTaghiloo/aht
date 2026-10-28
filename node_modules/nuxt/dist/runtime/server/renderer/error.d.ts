//#region src/runtime/server/renderer/error.d.ts
/** An error normalised into what the response and the error page need from it. */
export interface DescribedError {
  status: number;
  statusText: string;
  message: string;
  /** The error's `data`, present only where it is safe to expose. */
  data: unknown;
  headers: Headers;
  /** Whether the error named an HTTP status itself, rather than being given 500. */
  isHTTPError: boolean;
}
/**
 * Read the status, reason phrase and headers to answer a caught error with. An error naming no
 * status is the server's own, whose message is only exposed in development.
 *
 * @internal
 */
export declare function describeError(error: unknown): DescribedError;
/**
 * Whether the error is the app working as intended: a 404 or a failed validation it raised
 * deliberately.
 *
 * @internal
 */
export declare function isExpectedError(error: unknown, described: DescribedError): boolean;
/**
 * Add `value`'s tokens to the `vary` header, keeping any already present. `*` absorbs
 * everything else, since it means the response varies on all headers.
 *
 * @internal
 */
export declare function appendVary(headers: Headers, value: string): void;
/**
 * Stringify `error.data` the way it reaches the error page as a query parameter, for an error
 * rendered in process under `experimental.parseErrorData: false`.
 *
 * @internal
 */
export declare function stringifyErrorData(data: unknown): unknown;
/**
 * Whether the client asked for JSON rather than a page, so an error must be answered with a
 * JSON body. An explicit request for HTML wins over every other signal.
 *
 * @internal
 */
export declare function isJsonRequest(request: Request, pathname: string): boolean;
//#endregion