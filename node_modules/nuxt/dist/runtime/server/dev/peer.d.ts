//#region src/runtime/server/dev/peer.d.ts
/**
 * Peer checks shared by the dev-only endpoints that disclose local state.
 *
 * @module nuxt/internal/dev/peer
 */
/**
 * Whether the connected peer is a loopback address.
 *
 * This inspects the TCP peer address rather than request metadata, so a
 * non-browser client cannot make itself look local by choosing its `Host`,
 * `Origin`, `Referer` or `Sec-Fetch-*` headers. `x-forwarded-for` is ignored on
 * purpose: only the address of the socket we are actually talking to counts.
 */
export declare function isLoopbackAddress(address: string | undefined | null): boolean;
//#endregion