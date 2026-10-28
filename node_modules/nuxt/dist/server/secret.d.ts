//#region src/server/secret.d.ts
/**
 * A secret for one purpose, derived from `appSecret` with HKDF-SHA256: 32 bytes,
 * hex-encoded. Stable while `appSecret` is unchanged; distinct for every purpose.
 * Namespace the purpose to what owns it, such as a module name.
 *
 * @example
 * ```ts
 * const password = await deriveSecret('nuxt-auth-utils:session')
 * ```
 *
 * @throws a `500` when `appSecret` is unset or shorter than 32 characters.
 * @since 4.6.0
 */
export declare function deriveSecret(purpose: string): Promise<string>;
//#endregion