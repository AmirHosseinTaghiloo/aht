import { n as Endpoint, r as WildcardParam, t as DynamicParam } from "./tree-DzkQwPKe.mjs";
//#region src/compiler.ts
/**
* Route keys, method names and metadata fields all come from user input, so every lookup table built
* from them has a null prototype; otherwise a route segment or method named `toString` or
* `constructor` would resolve to an inherited value.
*/
function dict() {
	return Object.create(null);
}
const identifier = /^[$a-z_][\w$]*$/i;
/** reserved words, and the words reserved in strict mode, as the emitted module is a module */
const reserved = /* @__PURE__ */ new Set([
	"await",
	"break",
	"case",
	"catch",
	"class",
	"const",
	"continue",
	"debugger",
	"default",
	"delete",
	"do",
	"else",
	"enum",
	"export",
	"extends",
	"false",
	"finally",
	"for",
	"function",
	"if",
	"implements",
	"import",
	"in",
	"instanceof",
	"interface",
	"let",
	"new",
	"null",
	"package",
	"private",
	"protected",
	"public",
	"return",
	"static",
	"super",
	"switch",
	"this",
	"throw",
	"true",
	"try",
	"typeof",
	"var",
	"void",
	"while",
	"with",
	"yield"
]);
/** the names the emitted module declares itself, which an interface it resolves against cannot take */
const emitted = /* @__PURE__ */ new Set([
	"Exact",
	"Path",
	"ValidInput",
	"Response",
	"Methods",
	"ResponseHeaders",
	"ErrorBody",
	"RequestBody",
	"RequestQuery",
	"RequestHeaders",
	"Requires"
]);
/** Escapes a segment interpolated into an emitted template literal type. */
function templatePart(value) {
	return value.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}
/**
* Compile route sets into a module of types specialised to them.
*
* Every strategy emits the same names, so a consumer's signatures do not depend on which was chosen.
* A stale artefact fails to compile only where an imported name changed, so rename an emitted-surface
* type whenever its meaning changes.
*/
function compileRoutes(sets, options) {
	const name = options?.name ?? "Routes";
	if (!identifier.test(name) || reserved.has(name)) throw new TypeError(`Cannot compile routes as \`${name}\`, which is not a valid interface name.`);
	if (emitted.has(name)) throw new TypeError(`Cannot compile routes as \`${name}\`, which the emitted module declares itself.`);
	const target = options?.resolveAgainst ?? name;
	if (!identifier.test(target) || reserved.has(target)) throw new TypeError(`Cannot resolve paths against \`${target}\`, which is not a valid interface name.`);
	if (emitted.has(target)) throw new TypeError(`Cannot resolve paths against \`${target}\`, which the emitted module declares itself.`);
	const specifier = options?.moduleSpecifier ?? "fetchdts";
	if (typeof specifier !== "string" || /['"\\\n\r]/.test(specifier)) throw new TypeError(`Cannot import from ${JSON.stringify(specifier)}, which is not a valid module specifier.`);
	const imports = /* @__PURE__ */ new Set([
		"AnyHTTPMethod",
		"TypedFetchErrorBody",
		"TypedFetchMethods",
		"TypedFetchRequestBody",
		"TypedFetchRequestHeaders",
		"TypedFetchRequestQuery",
		"TypedFetchRequires",
		"TypedFetchResponseBody",
		"TypedFetchResponseHeaders",
		"ValidFetchInput"
	]);
	const tree = dict();
	const leaves = [];
	const seen = dict();
	for (const set of sets) for (const route of set.routes) {
		const keys = [];
		if (set.origin !== void 0) keys.push(...staticKeys(set.origin));
		let kind = "static";
		for (const segment of route.segments) for (const key of segmentKeys(segment)) {
			if (kind === "wildcard") throw new TypeError(`Cannot compile a route with a segment after a wildcard: ${JSON.stringify(route.segments.map((part) => typeof part === "symbol" ? part.description : part))}.`);
			if (key === DynamicParam) {
				kind = "dynamic";
				imports.add("DynamicParam");
			} else if (key === WildcardParam) {
				kind = "wildcard";
				imports.add("WildcardParam");
			}
			keys.push(key);
		}
		let node = tree;
		for (const key of keys) {
			if (!Object.hasOwn(node, key)) node[key] = dict();
			node = node[key];
		}
		const methods = Object.entries(route.metadata || {}).filter((entry) => typeof entry[1] === "object" && entry[1] !== null).map(([method, metadata]) => [method.toUpperCase(), metadata]);
		if (methods.length === 0) continue;
		imports.add("Endpoint");
		if (methods.some(([method]) => method === "ALL")) imports.add("HTTPMethod");
		const endpoints = node[Endpoint] = node[Endpoint] || dict();
		for (const [method, metadata] of methods) {
			const existing = endpoints[method] = Object.hasOwn(endpoints, method) ? endpoints[method] : dict();
			for (const [field, type] of Object.entries(metadata)) {
				if (typeof type !== "string") continue;
				const types = existing[field] = Object.hasOwn(existing, field) ? existing[field] : [];
				if (!types.includes(type)) types.push(type);
			}
		}
		const leaf = {
			keys,
			kind,
			path: kind === "static" ? keys.join("") || "/" : void 0
		};
		const id = `${kind}\u0000${keys.map((key) => typeof key === "symbol" ? key.description : key).join("\0")}`;
		if (!Object.hasOwn(seen, id)) {
			seen[id] = leaf;
			leaves.push(leaf);
		}
	}
	const stats = {
		routes: leaves.length,
		static: leaves.filter((leaf) => leaf.kind === "static").length,
		dynamic: leaves.filter((leaf) => leaf.kind === "dynamic").length,
		wildcard: leaves.filter((leaf) => leaf.kind === "wildcard").length
	};
	const strategy = options?.strategy ?? chooseStrategy(stats, options?.unionLimit ?? 200);
	const table = strategy.startsWith("table");
	const union = strategy.endsWith("union");
	if (!union) imports.add("AnyFetchPath");
	const body = stringifyRouteTree(tree).trimEnd();
	const code = [
		`// generated by fetchdts, strategy ${strategy}, ${stats.routes} route${stats.routes === 1 ? "" : "s"}`,
		`// (${stats.static} static, ${stats.dynamic} dynamic, ${stats.wildcard} wildcard)`,
		`import type { ${[...imports].sort().join(", ")} } from '${specifier}'`,
		...options?.imports ?? [],
		"",
		...body === "" ? [`export interface ${name} {}`] : [
			`export interface ${name} {`,
			body,
			"}"
		],
		"",
		...table ? [exact(name, leaves), ""] : [],
		...union ? [pathUnion(leaves), ""] : [`export type Path = AnyFetchPath`, ""],
		accessors(target, table)
	].join("\n");
	return {
		code,
		strategy,
		stats,
		imports: [...imports].sort(),
		toString: () => code
	};
}
/**
* A table is worth emitting for any static path, since it replaces a walk with a lookup; a union is
* worth emitting while the paths reached through a parameter are few enough for it to stay cheap.
*/
function chooseStrategy(stats, unionLimit) {
	const table = stats.static > 0;
	const union = stats.dynamic + stats.wildcard <= unionLimit;
	return `${table ? "table" : "tree"}${union ? "+union" : ""}`;
}
/** The exact-match table, pointing into the tree rather than repeating its metadata. */
function exact(name, leaves) {
	return [
		"/**",
		" * Every path whose every segment is known, mapped to the endpoints registered on it.",
		" *",
		" * A fast path rather than the authority: a lookup that misses falls through to the tree, which",
		" * costs nothing, since a path reached through a parameter has to walk either way.",
		" */",
		"export interface Exact {",
		...new Set(leaves.filter((leaf) => leaf.path !== void 0).map((leaf) => `  ${JSON.stringify(leaf.path)}: ${name}${leaf.keys.map((key) => `[${JSON.stringify(key)}]`).join("")}[typeof Endpoint]`)),
		"}"
	].join("\n");
}
/** Every path, as source, so the union is resolved once rather than at every call site. */
function pathUnion(leaves) {
	const members = /* @__PURE__ */ new Set();
	for (const leaf of leaves) for (const member of pathMembers(leaf)) members.add(member);
	if (members.size === 0) return "export type Path = never";
	return `export type Path =\n${[...members].map((member) => `  | ${member}`).join("\n")}`;
}
/** The forms one route takes as a path. A trailing wildcard contributes a second form without it. */
function pathMembers(leaf) {
	if (leaf.path !== void 0) return [JSON.stringify(leaf.path)];
	const parts = [];
	let wildcard = -1;
	for (const key of leaf.keys) if (key === DynamicParam) parts.push(null);
	else if (key === WildcardParam) {
		wildcard = parts.length;
		parts.push(null);
	} else parts.push(key);
	const members = [renderPath(parts)];
	if (wildcard !== -1) members.push(renderPath(parts.filter((_, index) => index !== wildcard)));
	return members;
}
/** a parameter, as a template literal placeholder taking at least one character */
const placeholder = "/${string}${string}";
function renderPath(parts) {
	if (parts.every((part) => part !== null)) return JSON.stringify(parts.join("") || "/");
	return `\`${parts.map((part) => part === null ? placeholder : templatePart(part)).join("")}\``;
}
/** The accessors a consumer builds its signatures from. */
function accessors(name, table) {
	const viaTable = (hit, miss) => table ? `Path_ extends keyof Exact\n    ? Uppercase<Method> extends keyof Exact[Path_]\n      ? ${hit}\n      : ${miss}\n    : ${miss}` : miss;
	return [
		"/**",
		" * Whether a path resolves, for use in parameter position: `input: T & ValidInput<T, M>`.",
		" *",
		" * Does not consult `Exact`: a lookup where the path is still a type parameter relates a `keyof`",
		" * of every static path once per program, so the table stays where the path is resolved.",
		" */",
		`export type ValidInput<Path_, Method extends AnyHTTPMethod = 'GET'>`,
		`  = ValidFetchInput<${name}, Path_, Method>`,
		"",
		`export type Response<Path_, Method extends AnyHTTPMethod = 'GET'>`,
		`  = ${viaTable(`'response' extends keyof Exact[Path_][Uppercase<Method>]\n        ? Exact[Path_][Uppercase<Method>]['response']\n        : unknown`, `TypedFetchResponseBody<${name}, Path_, Method>`)}`,
		"",
		`export type Methods<Path_> = TypedFetchMethods<${name}, Path_>`,
		"",
		`export type ResponseHeaders<Path_, Method extends AnyHTTPMethod = 'GET'> = TypedFetchResponseHeaders<${name}, Path_, Method>`,
		"",
		`export type ErrorBody<Path_, Method extends AnyHTTPMethod = 'GET'> = TypedFetchErrorBody<${name}, Path_, Method>`,
		"",
		`export type RequestBody<Path_, Method extends AnyHTTPMethod = 'GET', Fallback = BodyInit | null> = TypedFetchRequestBody<${name}, Path_, Method, Fallback>`,
		"",
		`export type RequestQuery<Path_, Method extends AnyHTTPMethod = 'GET', Fallback = Record<string, unknown>> = TypedFetchRequestQuery<${name}, Path_, Method, Fallback>`,
		"",
		`export type RequestHeaders<Path_, Method extends AnyHTTPMethod = 'GET', Fallback = HeadersInit> = TypedFetchRequestHeaders<${name}, Path_, Method, Fallback>`,
		"",
		`export type Requires<Path_, Method extends AnyHTTPMethod, Field extends 'body' | 'query' | 'headers'> = TypedFetchRequires<${name}, Path_, Method, Field>`
	].join("\n");
}
const symbols = [
	DynamicParam,
	WildcardParam,
	Endpoint
];
const symbolNames = Object.assign(dict(), {
	[DynamicParam]: "[DynamicParam]",
	[WildcardParam]: "[WildcardParam]",
	[Endpoint]: "[Endpoint]"
});
function stringifyRouteTree(tree, indent = 2, metadata = false) {
	let properties = "";
	const entries = [...Object.entries(tree), ...symbols.map((symbol) => [symbol, tree[symbol]])];
	for (const [_key, value] of entries) {
		if (!value) continue;
		const key = symbolNames[_key] || JSON.stringify(metadata ? _key.replace(/Type$/, "") : _key);
		if (_key === Endpoint) properties += `${" ".repeat(indent)}${key}: ${stringifyEndpoints(value, indent)}\n`;
		else if (Array.isArray(value)) {
			const type = value.length > 1 ? value.map((t) => `(${t})`).join(" | ") : value[0];
			properties += `${" ".repeat(indent)}${key}: ${type}\n`;
		} else if (typeof value === "string") properties += `${" ".repeat(indent)}${key}: ${value}\n`;
		else {
			const str = stringifyRouteTree(value, indent + 2, metadata);
			properties += `${" ".repeat(indent)}${key}: {\n${str}${" ".repeat(indent)}}\n`;
		}
	}
	return properties;
}
/**
* Stringifies the methods of one endpoint. An `ALL` entry becomes a `Record` over every method,
* with any specific method excluded from it and intersected on, so that the specific entry wins.
*/
function stringifyEndpoints(endpoints, indent) {
	const { ALL: all, ...methods } = endpoints;
	const named = Object.keys(methods);
	const specific = named.length > 0 ? `{\n${stringifyRouteTree(methods, indent + 2, true)}${" ".repeat(indent)}}` : void 0;
	if (!all) return specific || `{\n${" ".repeat(indent)}}`;
	const record = `Record<${named.length > 0 ? `Exclude<HTTPMethod, ${named.map((method) => JSON.stringify(method)).join(" | ")}>` : "HTTPMethod"}, {\n${stringifyRouteTree(all, indent + 2, true)}${" ".repeat(indent)}}>`;
	return specific ? `${record} & ${specific}` : record;
}
function segmentKeys(segment) {
	if (typeof segment === "string") return staticKeys(segment);
	if (typeof segment === "symbol") return [segment];
	switch (segment?.type) {
		case "dynamic": return [DynamicParam];
		case "wildcard": return [WildcardParam];
		case "static": return staticKeys(segment.value);
		default: throw new TypeError(`Unknown route segment: ${JSON.stringify(segment)}.`);
	}
}
/**
* A static segment as one key per path segment, which is what a path is resolved by. An origin is one
* key, including its scheme, as it is matched as a single leading key.
*/
function staticKeys(value) {
	if (typeof value !== "string") throw new TypeError(`Static route segments must be strings, received ${JSON.stringify(value)}.`);
	const origin = value.match(/^[a-z][a-z\d+\-.]*:\/\/[^/]*/i)?.[0];
	const segments = (origin ? value.slice(origin.length) : value).split("/").filter((segment) => segment !== "").map((segment) => `/${segment}`);
	return origin ? [origin, ...segments] : segments;
}
//#endregion
export { compileRoutes };
