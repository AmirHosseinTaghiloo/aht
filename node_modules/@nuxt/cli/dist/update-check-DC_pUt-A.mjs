import { p as writeNotice, s as debug, y as trackOutputSpacing } from "./startup-clock-DXZlxuSA.mjs";
import { a as terminalLink } from "./formatting-Co5DEjad.mjs";
import { t as fetchJson } from "./fetch-g4bhLuz9.mjs";
import { t as releaseNotesUrl } from "./release-notes-BQieF1F4.mjs";
import { n as detectNpmRegistry } from "./registry-B7GzM18R.mjs";
import process from "node:process";
import { styleText } from "node:util";
import { isCI, isTest, provider } from "std-env";
import { isGreaterThan, tryParse } from "verkit";
import { readUser, updateUser } from "rc9";
//#region src/utils/update-check.ts
const RC_FILE = ".nuxtrc";
const CACHE_KEY = "updateCheck";
const CACHE_TTL = 864e5;
const FETCH_TIMEOUT = 3e3;
/**
* Patch releases within the same minor are only worth interrupting for once the
* user is meaningfully behind; a single patch is noise for anyone who upgrades
* regularly.
*/
const MIN_PATCH_DISTANCE = 5;
function readCache() {
	try {
		return readUser(RC_FILE)[CACHE_KEY] || {};
	} catch (error) {
		debug("Failed to read update check cache:", error);
		return {};
	}
}
function writeCache(cache) {
	try {
		updateUser({ [CACHE_KEY]: cache }, RC_FILE);
	} catch (error) {
		debug("Failed to persist update check cache:", error);
	}
}
/**
* `NUXT_IGNORE_UPDATE_CHECK=1` (or the cross-tool `NO_UPDATE_NOTIFIER`) opts out
* for a single run and `updateCheck.enabled=false` in the user `.nuxtrc` opts
* out permanently. We also stay quiet where the nudge cannot be acted on
* interactively (CI, tests, StackBlitz, no TTY).
*/
function isUpdateCheckEnabled() {
	if (process.env.NUXT_IGNORE_UPDATE_CHECK || process.env.NO_UPDATE_NOTIFIER) return false;
	if (readCache().enabled === false) return false;
	return !isCI && !isTest && provider !== "stackblitz" && Boolean(process.stdout.isTTY);
}
async function resolveLatestVersion(name) {
	const cache = readCache();
	const entry = name === "nuxt" ? cache : cache.packages?.[name] || {};
	if (entry.checkedAt && Date.now() - Number(entry.checkedAt) < CACHE_TTL) return entry.latest;
	let latest;
	try {
		const { registry, authorization } = await detectNpmRegistry(null, null);
		latest = (await fetchJson(`${registry}/-/package/${name}/dist-tags`, {
			headers: authorization ? { Authorization: authorization } : void 0,
			timeout: FETCH_TIMEOUT,
			retry: 0
		})).latest;
	} catch (error) {
		debug(`Failed to resolve the latest ${name} version:`, error);
	}
	const checked = {
		latest,
		checkedAt: Date.now()
	};
	writeCache(name === "nuxt" ? checked : { packages: { [name]: checked } });
	return latest;
}
/**
* Compare an installed version against the registry's `latest`, returning
* nothing when there is no nudge worth showing.
*/
async function checkForUpdate(name, current) {
	const latest = await resolveLatestVersion(name);
	if (!current || !latest) return;
	const installed = tryParse(current);
	const published = tryParse(latest);
	if (!installed || !published) return;
	if (installed.prerelease) return;
	if (!isGreaterThan(latest, current)) return;
	if (published.major === installed.major && published.minor === installed.minor && published.patch - installed.patch < MIN_PATCH_DISTANCE) return;
	return {
		current,
		latest
	};
}
function describeUpdate({ current, latest }, name, pkg) {
	const notes = releaseNotesUrl(pkg, latest);
	const version = styleText("green", latest);
	return `a new version of ${name} is available: ${notes ? terminalLink(version, notes) : version} ${styleText("gray", `(you are on ${current})`)}`;
}
function renderUpdateNudge(update, options = {}) {
	const { name = "Nuxt", command = "nuxt upgrade", pkg = "nuxt" } = options;
	writeNotice(describeUpdate(update, name, pkg), `run ${styleText("cyan", command)} to update`);
}
function deferNudge(update, options, render = renderUpdateNudge) {
	trackOutputSpacing();
	process.once("exit", () => {
		try {
			render(update, options);
		} catch (error) {
			debug("Failed to render update nudge:", error);
		}
	});
}
//#endregion
export { checkForUpdate, deferNudge, isUpdateCheckEnabled };
