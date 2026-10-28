/* @ts-self-types="./index.d.ts" */
import { base64ToUint8Array, uint8ArrayToBase64, uint8ArrayToHex } from "uint8array-extras";
function losslessJsonStringify(data) {
	try {
		if (isJson(data)) {
			let stringified = JSON.stringify(data);
			if (stringified) return stringified;
		}
	} catch {}
	throw Error("Data is not JSON serializable");
}
function jsonParse(string) {
	try {
		return JSON.parse(string);
	} catch (err) {
		throw Error("Failed parsing sealed object JSON: " + err.message);
	}
}
function isJson(val) {
	let stack = [], seen = /* @__PURE__ */ new WeakSet(), check = (val$1) => val$1 === null || typeof val$1 == "string" || typeof val$1 == "boolean" ? !0 : typeof val$1 == "number" ? Number.isFinite(val$1) : typeof val$1 == "object" ? seen.has(val$1) ? !0 : (seen.add(val$1), stack.push(val$1), !0) : !1;
	if (!check(val)) return !1;
	for (; stack.length;) {
		let obj = stack.pop();
		if (Array.isArray(obj)) {
			let i$1 = obj.length;
			for (; i$1--;) if (!check(obj[i$1])) return !1;
			continue;
		}
		let proto = Reflect.getPrototypeOf(obj);
		if (proto !== null && proto !== Object.prototype) return !1;
		let keys = Reflect.ownKeys(obj), i = keys.length;
		for (; i--;) {
			let key = keys[i];
			if (typeof key != "string" || Reflect.getOwnPropertyDescriptor(obj, key)?.enumerable === !1) return !1;
			let val$1 = obj[key];
			if (val$1 !== void 0 && !check(val$1)) return !1;
		}
	}
	return !0;
}
const enc = /* @__PURE__ */ new TextEncoder(), dec = /* @__PURE__ */ new TextDecoder(), jsBase64Enabled = /* @__PURE__ */ (() => typeof Uint8Array.fromBase64 == "function" && typeof Uint8Array.prototype.toBase64 == "function" && typeof Uint8Array.prototype.toHex == "function")();
function b64ToU8(str) {
	return jsBase64Enabled ? Uint8Array.fromBase64(str, { alphabet: "base64url" }) : base64ToUint8Array(str);
}
function u8ToB64(arr) {
	return arr = arr instanceof ArrayBuffer ? new Uint8Array(arr) : arr, jsBase64Enabled ? arr.toBase64({
		alphabet: "base64url",
		omitPadding: !0
	}) : uint8ArrayToBase64(arr, { urlSafe: !0 });
}
function u8ToHex(arr) {
	return arr = arr instanceof ArrayBuffer ? new Uint8Array(arr) : arr, jsBase64Enabled ? arr.toHex() : uint8ArrayToHex(arr);
}
const defaults = /* @__PURE__ */ Object.freeze({
	encryption: /* @__PURE__ */ Object.freeze({
		algorithm: "aes-256-cbc",
		saltBits: 256,
		iterations: 1,
		minPasswordlength: 32
	}),
	integrity: /* @__PURE__ */ Object.freeze({
		algorithm: "sha256",
		saltBits: 256,
		iterations: 1,
		minPasswordlength: 32
	}),
	ttl: 0,
	timestampSkewSec: 60,
	localtimeOffsetMsec: 0
});
function clone(options) {
	return {
		...options,
		encryption: { ...options.encryption },
		integrity: { ...options.integrity }
	};
}
const algorithms = /* @__PURE__ */ Object.freeze({
	"aes-128-ctr": /* @__PURE__ */ Object.freeze({
		keyBits: 128,
		ivBits: 128,
		name: "AES-CTR"
	}),
	"aes-256-cbc": /* @__PURE__ */ Object.freeze({
		keyBits: 256,
		ivBits: 128,
		name: "AES-CBC"
	}),
	sha256: /* @__PURE__ */ Object.freeze({
		keyBits: 256,
		ivBits: void 0,
		name: "SHA-256"
	})
}), macFormatVersion = "2", macPrefix = "Fe26.2";
function randomBits(bits) {
	return crypto.getRandomValues(new Uint8Array(bits / 8));
}
async function generateKey(password, options) {
	if (!password || !password.length) throw Error("Empty password");
	if (!options || typeof options != "object") throw Error("Bad options");
	let algorithm = algorithms[options.algorithm];
	if (!algorithm) throw Error("Unknown algorithm: " + options.algorithm);
	let isHmac = algorithm.name === "SHA-256", id = isHmac ? {
		name: "HMAC",
		hash: algorithm.name,
		length: algorithm.keyBits
	} : {
		name: algorithm.name,
		length: algorithm.keyBits
	}, usages = isHmac ? ["sign", "verify"] : ["encrypt", "decrypt"], iv = options.iv || (algorithm.ivBits ? randomBits(algorithm.ivBits) : void 0);
	if (typeof password == "string") {
		if (password.length < options.minPasswordlength) throw Error("Password string too short (min " + options.minPasswordlength + " characters required)");
		let salt = options.salt;
		if (!salt) {
			if (!options.saltBits) throw Error("Missing salt and saltBits options");
			salt = u8ToHex(randomBits(options.saltBits));
		}
		let baseKey = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", !1, ["deriveKey"]), algorithm$1 = {
			name: "PBKDF2",
			salt: enc.encode(salt),
			iterations: options.iterations,
			hash: "SHA-1"
		};
		return {
			key: await crypto.subtle.deriveKey(algorithm$1, baseKey, id, !1, usages),
			iv,
			salt
		};
	}
	if (password.length < algorithm.keyBits / 8) throw Error("Key buffer (password) too small");
	return {
		key: await crypto.subtle.importKey("raw", password.slice(), id, !1, usages),
		iv,
		salt: ""
	};
}
function getEncryptParams(algorithm, key, data) {
	return [
		algorithm === "aes-128-ctr" ? {
			name: "AES-CTR",
			counter: key.iv,
			length: 128
		} : {
			name: "AES-CBC",
			iv: key.iv
		},
		key.key,
		typeof data == "string" ? enc.encode(data) : data.slice()
	];
}
async function encrypt(password, options, data) {
	let key = await generateKey(password, options), encrypted = await crypto.subtle.encrypt(...getEncryptParams(options.algorithm, key, data));
	return {
		encrypted: new Uint8Array(encrypted),
		key
	};
}
async function decrypt(password, options, data) {
	let key = await generateKey(password, options), decrypted = await crypto.subtle.decrypt(...getEncryptParams(options.algorithm, key, data));
	return dec.decode(decrypted);
}
async function hmacWithPassword(password, options, data) {
	let key = await generateKey(password, options);
	return {
		digest: u8ToB64(await crypto.subtle.sign("HMAC", key.key, enc.encode(data))),
		salt: key.salt
	};
}
function normalizePassword(password) {
	let normalized = typeof password == "string" || password instanceof Uint8Array ? {
		encryption: password,
		integrity: password
	} : password && typeof password == "object" ? "secret" in password ? {
		id: password.id,
		encryption: password.secret,
		integrity: password.secret
	} : {
		id: password.id,
		encryption: password.encryption,
		integrity: password.integrity
	} : void 0;
	if (!normalized || !normalized.encryption || normalized.encryption.length === 0 || !normalized.integrity || normalized.integrity.length === 0) throw Error("Empty password");
	return normalized;
}
async function seal(object, password, options) {
	let now = Date.now() + (options.localtimeOffsetMsec || 0), { id = "", encryption, integrity } = normalizePassword(password);
	if (id && !/^\w+$/.test(id)) throw Error("Invalid password id");
	let { encrypted, key } = await encrypt(encryption, options.encryption, (options.encode || losslessJsonStringify)(object)), expiration = options.ttl ? now + options.ttl : "", macBaseString = macPrefix + "*" + id + "*" + key.salt + "*" + u8ToB64(key.iv) + "*" + u8ToB64(encrypted) + "*" + expiration, mac = await hmacWithPassword(integrity, options.integrity, macBaseString);
	return macBaseString + "*" + mac.salt + "*" + mac.digest;
}
async function unseal(sealed, password, options) {
	let now = Date.now() + (options.localtimeOffsetMsec || 0), parts = sealed.split("*");
	if (parts.length !== 8) throw Error("Incorrect number of sealed components");
	let [prefix, passwordId, encryptionSalt, ivB64, encryptedB64, expiration, hmacSalt, hmacDigestB64] = parts;
	if (prefix !== macPrefix) throw Error("Wrong mac prefix");
	if (expiration) {
		if (!/^[1-9]\d*$/.test(expiration)) throw Error("Invalid expiration");
		if (Number.parseInt(expiration, 10) <= now - options.timestampSkewSec * 1e3) throw Error("Expired seal");
	}
	let pass;
	if (typeof password == "string" || password instanceof Uint8Array) pass = password;
	else if (typeof password == "object" && password) {
		let passwordIdKey = passwordId || "default";
		if (pass = password[passwordIdKey], !pass) throw Error("Cannot find password: " + passwordIdKey);
	}
	pass = normalizePassword(pass);
	let key = await generateKey(pass.integrity, {
		...options.integrity,
		salt: hmacSalt
	}), macBaseString = prefix + "*" + passwordId + "*" + encryptionSalt + "*" + ivB64 + "*" + encryptedB64 + "*" + expiration;
	if (!await crypto.subtle.verify("HMAC", key.key, b64ToU8(hmacDigestB64), enc.encode(macBaseString))) throw Error("Bad hmac value");
	let decryptedString = await decrypt(pass.encryption, {
		...options.encryption,
		salt: encryptionSalt,
		iv: b64ToU8(ivB64)
	}, b64ToU8(encryptedB64));
	return (options.decode || jsonParse)(decryptedString);
}
export { algorithms, clone, decrypt, defaults, encrypt, generateKey, hmacWithPassword, macFormatVersion, macPrefix, randomBits, seal, unseal };
