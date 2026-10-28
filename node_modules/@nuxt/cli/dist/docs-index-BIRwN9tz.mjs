import { s as debug } from "./startup-clock-DXZlxuSA.mjs";
import { n as getNuxtVersion, r as resolveRegistryVersion } from "./versions-BA3DmZ0X.mjs";
import { t as getCacheDir } from "./cache-CKYx3gns.mjs";
import { n as detectNpmRegistry, t as PUBLIC_REGISTRY } from "./registry-B7GzM18R.mjs";
import { resolveModulePath } from "exsolve";
import { dirname, join, relative } from "pathe";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";
import { execFileSync } from "node:child_process";
import { parseYAML } from "confbox/yaml";
//#region src/utils/docs-index.ts
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;
const HEADING_RE = /^#{2,3} ([^\n]*)$/gm;
const ORDER_PREFIX_RE = /^\d+\./;
const MARKDOWN_EXTENSION_RE = /\.md$/;
const MAJOR_VERSION_RE = /^\d+$/;
const EXACT_VERSION_RE = /^\d+\.\d+\.\d+(?:-[\w.]+)?$/;
const MARKDOWN_SYNTAX_RE = /[`*_[\]]|\{[^}]*\}/g;
const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F-\u009F]/g;
const DOCS_BASE_URL = "https://nuxt.com";
const DOCS_PATH = "/docs";
/** The docs for a released Nuxt version never change, so a built index is kept for good. */
const CACHE_DIR = "docs";
const DOCS_PACKAGE = "@nuxt/docs";
const FETCH_TIMEOUT = 1e4;
const MAX_TARBALL_BYTES = 20971520;
const UNSAFE_KEY_RE = /[^\w.+-]/g;
/**
* The searchable index of the documentation for the Nuxt version `cwd` uses.
*
* `@nuxt/docs` is the `docs/` directory of `nuxt/nuxt` published as raw markdown
* and versioned in lockstep, so searching it answers against the docs for the
* version in use rather than whatever is currently on the site. A copy installed
* in the project is preferred; otherwise the matching tarball is fetched from the
* registry, which is why the first search can be slow, and why the index is
* cached in the user's cache home afterwards.
*
* Returns `undefined` when the docs can be neither read nor fetched, leaving the
* caller to fall back to the documentation site.
*/
async function resolveDocsIndex(cwd, options = {}) {
	const nuxtVersion = await getNuxtVersion(cwd).catch(() => void 0);
	const local = localDocs(cwd);
	if (local && (!nuxtVersion || sameMajor(local.version, nuxtVersion))) return indexLocal(local, options);
	const source = await detectNpmRegistry("@nuxt", cwd);
	const cached = readCache(nuxtVersion, source.registry);
	if (cached) return cached;
	const index = await fetchIndex(source, nuxtVersion, options);
	if (index) {
		writeCache(nuxtVersion, source.registry, index);
		return index;
	}
	return local ? indexLocal(local, options) : void 0;
}
function indexLocal(local, options) {
	options.onIndex?.(local.version);
	return buildIndex(local.root, local.version);
}
/** A copy of `@nuxt/docs` installed in the project, ignoring `NODE_PATH`. */
function localDocs(cwd) {
	const manifest = resolveModulePath(`${DOCS_PACKAGE}/package.json`, {
		from: join(cwd, "/"),
		try: true
	});
	if (!manifest) return;
	try {
		const version = JSON.parse(readFileSync(manifest, "utf8")).version;
		return version ? {
			root: dirname(manifest),
			version
		} : void 0;
	} catch (error) {
		debug("Could not read the installed documentation:", error);
		return;
	}
}
/**
* Download and index the docs for `nuxtVersion`.
*
* The tarball for that exact version is tried first, so the usual case costs a
* single request. Docs are published alongside Nuxt releases, but a version may
* predate the package or be a nightly, so the highest release sharing its major
* (then whatever is latest) is accepted as a stand-in.
*/
async function fetchIndex(source, nuxtVersion, options) {
	const attempted = /* @__PURE__ */ new Set();
	for await (const version of candidateVersions(nuxtVersion)) {
		if (attempted.has(version)) continue;
		attempted.add(version);
		const index = await downloadIndex(source, version, options);
		if (index) return index;
	}
	debug(`No published ${DOCS_PACKAGE} could be downloaded for Nuxt ${nuxtVersion || "latest"}.`);
}
async function* candidateVersions(nuxtVersion) {
	const major = nuxtVersion?.split(".")[0];
	if (nuxtVersion && EXACT_VERSION_RE.test(nuxtVersion)) yield nuxtVersion;
	for (const range of [major && MAJOR_VERSION_RE.test(major) ? `^${major}` : void 0, "latest"]) {
		const resolved = range && await resolveRegistryVersion(DOCS_PACKAGE, range);
		if (resolved) yield resolved;
	}
}
async function downloadIndex(source, version, options) {
	options.onDownload?.(version);
	const staging = mkdtempSync(join(getCacheDir(CACHE_DIR), ".staging-"));
	try {
		const tarball = await downloadTarball(source, version);
		if (!tarball) return;
		const archive = join(staging, "docs.tgz");
		writeFileSync(archive, tarball);
		assertSafeArchiveMembers(archive);
		execFileSync("tar", [
			"-xzf",
			archive,
			"-C",
			staging,
			"--strip-components=1"
		], { stdio: "ignore" });
		options.onIndex?.(version);
		return buildIndex(staging, version);
	} catch (error) {
		debug(`Could not read ${DOCS_PACKAGE}@${version}:`, error);
		return;
	} finally {
		rmSync(staging, {
			recursive: true,
			force: true
		});
	}
}
/**
* Refuse an archive whose member paths could escape the extraction directory:
* absolute paths, drive letters, or `..` segments. The registry tarball is
* still a download, and `tar`'s own handling of such members varies across
* the system implementations this relies on.
*/
function assertSafeArchiveMembers(archive) {
	const listing = execFileSync("tar", ["-tzf", archive], {
		encoding: "utf8",
		stdio: [
			"ignore",
			"pipe",
			"ignore"
		],
		maxBuffer: 16777216
	});
	for (const member of listing.split("\n")) {
		if (!member) continue;
		if (member.startsWith("/") || member.startsWith("\\") || /^[a-z]:/i.test(member) || member.split(/[\\/]/).includes("..")) throw new Error(`Refusing to extract unsafe archive member \`${member}\``);
	}
}
/**
* The `@nuxt/docs` tarball from the configured registry, falling back to npm
* itself: the docs are a public package, so a proxy that rejects this process is
* no reason to give up on them.
*/
async function downloadTarball({ registry, authorization }, version) {
	const sources = [[registry, authorization]];
	if (registry !== "https://registry.npmjs.org") sources.push([PUBLIC_REGISTRY, null]);
	for (const [source, credentials] of sources) try {
		const response = await fetch(`${source}/${DOCS_PACKAGE}/-/docs-${version}.tgz`, {
			headers: credentials ? { Authorization: credentials } : void 0,
			signal: AbortSignal.timeout(FETCH_TIMEOUT)
		});
		if (!response.ok) throw new Error(`Unexpected response: ${response.status}`);
		return await readCapped(response);
	} catch (error) {
		debug(`Could not download ${DOCS_PACKAGE}@${version} from ${source}:`, error);
	}
}
/**
* The response body, refusing anything larger than a plausible docs tarball (the
* real one is under half a megabyte) so a wrong or hostile URL cannot be streamed
* into memory unbounded. `Content-Length` is advisory, so the limit is enforced
* while reading.
*/
async function readCapped(response) {
	const chunks = [];
	let size = 0;
	for await (const chunk of response.body ?? []) {
		size += chunk.length;
		if (size > MAX_TARBALL_BYTES) throw new Error(`Response is larger than ${MAX_TARBALL_BYTES} bytes`);
		chunks.push(chunk);
	}
	return Buffer.concat(chunks);
}
function sameMajor(a, b) {
	return a.split(".")[0] === b.split(".")[0];
}
function buildIndex(root, version) {
	try {
		const entries = [];
		for (const file of markdownFiles(root)) {
			const entry = readEntry(root, file);
			if (entry) entries.push(entry);
		}
		if (entries.length === 0) return;
		const major = version.split(".")[0];
		return {
			version,
			base: MAJOR_VERSION_RE.test(major || "") ? `${DOCS_PATH}/${major}.x` : DOCS_PATH,
			entries
		};
	} catch (error) {
		debug("Could not read the documentation:", error);
		return;
	}
}
/**
* Keyed by the Nuxt version asked about rather than the docs version resolved for
* it, so a project on a Nuxt release with no docs of its own does not repeat the
* registry lookup that found the stand-in. The registry is part of the key too:
* a project can name its own in `.npmrc`, and what that serves should not be
* offered as the docs in projects that use a different one.
*/
function cacheFile(nuxtVersion, registry) {
	const key = (nuxtVersion || "latest").replace(UNSAFE_KEY_RE, "_");
	const suffix = registry === "https://registry.npmjs.org" ? "" : `-${createHash("sha256").update(registry).digest("hex").slice(0, 12)}`;
	return join(getCacheDir(CACHE_DIR), `index-${key}${suffix}.json`);
}
function readCache(nuxtVersion, registry) {
	try {
		const cached = JSON.parse(readFileSync(cacheFile(nuxtVersion, registry), "utf8"));
		return cached.entries?.length > 0 ? cached : void 0;
	} catch {
		return;
	}
}
function writeCache(nuxtVersion, registry, index) {
	try {
		writeFileSync(cacheFile(nuxtVersion, registry), JSON.stringify(index), "utf8");
	} catch (error) {
		debug("Could not cache the documentation index:", error);
	}
}
/**
* Only regular files and directories are considered: a symlink in the archive
* would otherwise be read through, reaching outside the extracted tree.
*/
function* markdownFiles(dir) {
	for (const item of readdirSync(dir, { withFileTypes: true })) {
		const path = join(dir, item.name);
		if (item.isDirectory()) yield* markdownFiles(path);
		else if (item.isFile() && item.name.endsWith(".md") && item.name !== "README.md") yield path;
	}
}
function readEntry(root, file) {
	const source = readFileSync(file, "utf8");
	const matter = FRONTMATTER_RE.exec(source);
	const data = matter ? parseFrontmatter(matter[1]) : {};
	if (data.redirect || data.navigation === false) return;
	const path = toSitePath(relative(root, file)).replace(CONTROL_CHARS_RE, "");
	return {
		title: data.title?.replace(CONTROL_CHARS_RE, "").trim() || path.split("/").pop() || path,
		description: data.description?.replace(CONTROL_CHARS_RE, "").trim(),
		path,
		headings: [...source.matchAll(HEADING_RE)].map((match) => clean(match[1]))
	};
}
function parseFrontmatter(block) {
	try {
		return parseYAML(block) || {};
	} catch {
		return {};
	}
}
/**
* `1.getting-started/02.installation.md` names `/getting-started/installation`.
* Ordering prefixes and `index` segments exist for the site's file-based routing
* and are not part of the URL.
*/
function toSitePath(file) {
	const segments = file.replace(MARKDOWN_EXTENSION_RE, "").split("/").map((segment) => segment.replace(ORDER_PREFIX_RE, ""));
	if (segments.at(-1) === "index") segments.pop();
	return segments.length > 0 ? `/${segments.join("/")}` : "";
}
function clean(heading) {
	return heading.replace(MARKDOWN_SYNTAX_RE, "").trim();
}
//#endregion
export { DOCS_BASE_URL, DOCS_PATH, resolveDocsIndex };
