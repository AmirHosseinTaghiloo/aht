import { createError } from "../app/error.js";
import { seal, unseal } from "./iron.js";
import { deriveSecret } from "./secret.js";
import { getCookie, setCookie } from "./index.js";
import { serialize } from "cookie-es";
//#region src/server/session.ts
const DEFAULT_NAME = "nuxt-session";
/** Browsers reject a cookie whose serialised form exceeds this. */
const MAX_COOKIE_BYTES = 4096;
const sessionCache = /* @__PURE__ */ new WeakMap();
/** Tags a sealed payload as a Nuxt session, so values sealed by other libraries with the same password are rejected. */
const PAYLOAD_VERSION = 1;
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
async function useSession(event, config = {}) {
	await getSession(event, config);
	const name = config.name ?? DEFAULT_NAME;
	const current = () => sessionsOf(event).get(name).session;
	const manager = {
		get id() {
			return current().id;
		},
		get data() {
			return current().data;
		},
		async update(update) {
			await updateSession(event, config, update);
			return manager;
		},
		async clear() {
			await clearSession(event, config);
			return manager;
		}
	};
	return manager;
}
/**
* The session for the request: unsealed from its cookie, or created empty and
* sealed into the response when there is no cookie or it cannot be unsealed.
* Unsealed once per request.
*
* @since 4.6.0
*/
function getSession(event, config = {}) {
	const name = config.name ?? DEFAULT_NAME;
	const sessions = sessionsOf(event);
	let entry = sessions.get(name);
	if (!entry) {
		const loading = loadSession(event, config);
		entry = { loading };
		sessions.set(name, entry);
		loading.then((session) => {
			entry.session = session;
		}, () => sessions.delete(name));
	}
	return entry.loading;
}
async function loadSession(event, config) {
	const sealed = getCookie(event, config.name ?? DEFAULT_NAME);
	const unsealed = sealed ? await unsealSession(sealed, config) : void 0;
	if (unsealed) return unsealed;
	const session = {
		id: globalThis.crypto.randomUUID(),
		data: Object.create(null)
	};
	await sealSession(event, config, session);
	return session;
}
/**
* Merge data into the session and reseal it.
*
* @since 4.6.0
*/
async function updateSession(event, config = {}, update) {
	const session = await getSession(event, config);
	const patch = typeof update === "function" ? update(session.data) : update;
	if (patch) Object.assign(session.data, patch);
	await sealSession(event, config, session);
	return session;
}
/**
* Discard the session and expire its cookie.
*
* @since 4.6.0
*/
function clearSession(event, config = {}) {
	const name = config.name ?? DEFAULT_NAME;
	const session = {
		id: globalThis.crypto.randomUUID(),
		data: Object.create(null)
	};
	sessionsOf(event).set(name, {
		loading: Promise.resolve(session),
		session
	});
	setSessionCookie(event, name, "", {
		...cookieOptions(config),
		maxAge: 0
	});
	return Promise.resolve();
}
function sessionsOf(event) {
	let sessions = sessionCache.get(event);
	if (!sessions) {
		sessions = /* @__PURE__ */ new Map();
		sessionCache.set(event, sessions);
	}
	return sessions;
}
async function unsealSession(sealed, config) {
	const password = await resolvePassword(config);
	const unsealed = await unseal(sealed, password, { ttl: config.maxAge ? config.maxAge * 1e3 : 0 }).catch(() => void 0);
	if (unsealed?.nuxt === PAYLOAD_VERSION && typeof unsealed.id === "string" && unsealed.data) return {
		id: unsealed.id,
		data: unsealed.data
	};
}
async function sealSession(event, config, session) {
	const name = config.name ?? DEFAULT_NAME;
	const payload = {
		nuxt: PAYLOAD_VERSION,
		id: session.id,
		data: session.data
	};
	const sealed = await seal(payload, await resolvePassword(config), { ttl: config.maxAge ? config.maxAge * 1e3 : 0 });
	const options = cookieOptions(config);
	const size = serialize(name, sealed, options).length;
	if (size > MAX_COOKIE_BYTES) throw createError({
		status: 500,
		message: `Session cookie \`${name}\` is ${size} bytes, over the ${MAX_COOKIE_BYTES} byte limit browsers accept. Store less in the session, or keep the data server-side and reference it by id.`
	});
	setSessionCookie(event, name, sealed, options);
}
/** One `Set-Cookie` per session name, however often it is written in a request. */
function setSessionCookie(event, name, value, options) {
	const prefix = `${name}=`;
	const others = event.res.headers.getSetCookie().filter((cookie) => !cookie.startsWith(prefix));
	event.res.headers.delete("set-cookie");
	for (const cookie of others) event.res.headers.append("set-cookie", cookie);
	setCookie(event, name, value, options);
}
function resolvePassword(config) {
	return config.password === void 0 ? deriveSecret(`nuxt-session:${config.name ?? DEFAULT_NAME}`) : Promise.resolve(config.password);
}
function cookieOptions(config) {
	return {
		httpOnly: true,
		secure: true,
		sameSite: "lax",
		path: "/",
		...config.maxAge ? { maxAge: config.maxAge } : {},
		...config.cookie
	};
}
//#endregion
export { clearSession, getSession, updateSession, useSession };
