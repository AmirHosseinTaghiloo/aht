import { defaults, seal as seal$1, unseal as unseal$1 } from "iron-webcrypto";
//#region src/server/iron.ts
/**
* The one module that names the sealing primitive.
*
* TODO: move to `iron-webcrypto/gcm` (AES-256-GCM + HKDF) once published; see
* https://github.com/brc-dd/iron-webcrypto.
*
* @internal
*/
function seal(value, password, options) {
	return seal$1(value, password, {
		...defaults,
		ttl: options?.ttl ?? 0
	});
}
function unseal(sealed, password, options) {
	return unseal$1(sealed, password, {
		...defaults,
		ttl: options?.ttl ?? 0
	});
}
//#endregion
export { seal, unseal };
