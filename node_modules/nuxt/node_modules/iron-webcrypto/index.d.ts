//#region src/types.d.ts
/**
 * Algorithm used for encryption and decryption.
 */
type EncryptionAlgorithm = 'aes-128-ctr' | 'aes-256-cbc';
/**
 * Algorithm used for integrity verification.
 */
type IntegrityAlgorithm = 'sha256';
/**
 * @internal
 */
type _Algorithm = EncryptionAlgorithm | IntegrityAlgorithm;
/**
 * Configuration of each supported algorithm.
 */
type Algorithms = Readonly<{ [Algorithm in EncryptionAlgorithm | IntegrityAlgorithm]: Algorithm extends EncryptionAlgorithm ? Readonly<{
  keyBits: number;
  ivBits: number;
  name: string;
}> : Readonly<{
  keyBits: number;
  ivBits: undefined;
  name: string;
}> }>;
/**
 * seal() method options.
 */
type SealOptionsSub<Algorithm$1 extends _Algorithm = _Algorithm> = Readonly<{
  /**
   * The length of the salt (random buffer used to ensure that two identical objects will generate a different encrypted result). Defaults to 256.
   */
  saltBits: number;
  /**
   * The algorithm used. Defaults to 'aes-256-cbc' for encryption and 'sha256' for integrity.
   */
  algorithm: Algorithm$1;
  /**
   * The number of iterations used to derive a key from the password. Defaults to 1.
   */
  iterations: number;
  /**
   * Minimum password size. Defaults to 32.
   */
  minPasswordlength: number;
}>;
/**
 * Options for customizing the key derivation algorithm used to generate encryption and integrity verification keys as well as the algorithms and salt sizes used.
 */
type SealOptions = Readonly<{
  /**
   * Encryption step options.
   */
  encryption: SealOptionsSub<EncryptionAlgorithm>;
  /**
   * Integrity step options.
   */
  integrity: SealOptionsSub<IntegrityAlgorithm>;
  /**
   * Sealed object lifetime in milliseconds where 0 means forever. Defaults to 0.
   */
  ttl: number;
  /**
   * Number of seconds of permitted clock skew for incoming expirations. Defaults to 60 seconds.
   */
  timestampSkewSec: number;
  /**
   * Local clock time offset, expressed in number of milliseconds (positive or negative). Defaults to 0.
   */
  localtimeOffsetMsec: number;
  /**
   * Custom encoder for serializing data before encryption. Defaults to lossless JSON stringify. \
   * To revert to v1 behavior, use `JSON.stringify`. \
   * For complex data types, you can use cbor or msgpack encoders.
   */
  encode?: (data: unknown) => string;
  /**
   * Custom decoder for deserializing data after decryption. Defaults to `JSON.parse`. \
   * To align with `@hapi/iron`'s behavior, use `Bourne.parse`.
   */
  decode?: (data: string) => unknown;
}>;
/**
 * generateKey() method options.
 */
type GenerateKeyOptions<Algorithm$1 extends _Algorithm = _Algorithm> = Pick<SealOptionsSub<Algorithm$1>, 'algorithm' | 'iterations' | 'minPasswordlength'> & {
  saltBits?: number | undefined;
  salt?: string | undefined;
  iv?: Uint8Array<ArrayBuffer> | undefined;
};
/**
 * Generated internal key object.
 */
type Key<Algorithm$1 extends _Algorithm = _Algorithm> = Readonly<{
  key: CryptoKey;
  salt: string;
  iv: Algorithm$1 extends EncryptionAlgorithm ? Uint8Array<ArrayBuffer> : undefined;
}>;
/**
 * Generated HMAC internal results.
 */
type HmacResult = Readonly<{
  digest: string;
  salt: string;
}>;
/**
 * @deprecated Use {@link HmacResult} instead.
 */
type HMacResult = HmacResult;
/**
 * Password secret string or buffer.
 */
type Password = Uint8Array | string;
declare namespace password {
  /**
   * Secret object with optional id.
   */
  type Secret = Readonly<{
    id?: string | undefined;
    secret: Password;
  }>;
  /**
   * Secret object with optional id and specified password for each encryption and integrity.
   */
  type Specific = Readonly<{
    id?: string | undefined;
    encryption: Password;
    integrity: Password;
  }>;
  /**
   * Key-value pairs hash of password id to value.
   */
  type Hash = Readonly<{
    [id: string]: Password | Secret | Specific;
  }>;
}
//#endregion
//#region src/index.d.ts
type Mutable<T> = { -readonly [K in keyof T]: T[K] };
/**
 * The default encryption and integrity settings.
 */
declare const defaults: SealOptions;
/**
 * Clones the options object.
 * @param options The options to clone.
 * @returns A mutable copy of the options.
 *
 * @internal
 */
declare function clone(options: SealOptions): Mutable<SealOptions> & {
  encryption: Mutable<SealOptions['encryption']>;
  integrity: Mutable<SealOptions['integrity']>;
};
/**
 * Configuration of each supported algorithm.
 */
declare const algorithms: Algorithms;
/**
 * MAC normalization format version.
 * Prevents comparison of MAC values generated with different normalized string formats.
 */
declare const macFormatVersion = "2";
/**
 * MAC normalization prefix.
 */
declare const macPrefix = "Fe26.2";
/**
 * Generates cryptographically strong pseudorandom bits.
 * @param bits Number of bits to generate (must be a positive multiple of 8).
 * @returns Uint8Array containing the random bits.
 *
 * @internal
 */
declare function randomBits(bits: number): Uint8Array<ArrayBuffer>;
/**
 * Generates a key from the password.
 * @param password The password string or buffer.
 * @param options Key generation options.
 * @returns The generated key and associated parameters.
 */
declare function generateKey(password: Password, options: GenerateKeyOptions<EncryptionAlgorithm>): Promise<Key<EncryptionAlgorithm>>;
declare function generateKey(password: Password, options: GenerateKeyOptions<IntegrityAlgorithm>): Promise<Key<IntegrityAlgorithm>>;
/**
 * Encrypts data.
 * @param password The password string or buffer.
 * @param options Key generation options.
 * @param data The data string to encrypt.
 * @returns The encrypted data and associated key information.
 */
declare function encrypt(password: Password, options: GenerateKeyOptions<EncryptionAlgorithm>, data: Uint8Array | string): Promise<{
  encrypted: Uint8Array<ArrayBuffer>;
  key: Key<EncryptionAlgorithm>;
}>;
/**
 * Decrypts data.
 * @param password The password string or buffer.
 * @param options Key generation options.
 * @param data The encrypted data to decrypt.
 * @returns The decrypted data string.
 */
declare function decrypt(password: Password, options: GenerateKeyOptions<EncryptionAlgorithm>, data: Uint8Array | string): Promise<string>;
/**
 * Calculates a HMAC digest.
 * @param password The password string or buffer.
 * @param options Key generation options.
 * @param data The data string to HMAC.
 * @returns The HMAC digest and associated key information.
 */
declare function hmacWithPassword(password: Password, options: GenerateKeyOptions<IntegrityAlgorithm>, data: string): Promise<HmacResult>;
/**
 * Serializes, encrypts, and signs an object into an iron protocol string.
 * @param object The object to seal.
 * @param password The password to use for sealing.
 * @param options The sealing options.
 * @returns The sealed string.
 */
declare function seal(object: unknown, password: password.Hash[string], options: SealOptions): Promise<string>;
/**
 * Verifies, decrypts, and reconstructs an object from an iron protocol string.
 * @param sealed The sealed string.
 * @param password The password to use for unsealing.
 * @param options The unsealing options.
 * @returns The unsealed object.
 */
declare function unseal(sealed: string, password: Password | password.Hash, options: SealOptions): Promise<unknown>;
//#endregion
export { Algorithms, EncryptionAlgorithm, GenerateKeyOptions, HMacResult, HmacResult, IntegrityAlgorithm, Key, Password, SealOptions, SealOptionsSub, _Algorithm, algorithms, clone, decrypt, defaults, encrypt, generateKey, hmacWithPassword, macFormatVersion, macPrefix, password, randomBits, seal, unseal };