import { h as defineCommand, o as jsonArgs, t as cwdArgs } from "./_shared-YyGADOl7.mjs";
import { u as logger } from "./startup-clock-DXZlxuSA.mjs";
import { i as printJson } from "./console-BgmzEcbV.mjs";
import { i as logNetworkError } from "./path-env-D9Xd_BAN.mjs";
import { r as formatInfoBox } from "./formatting-Co5DEjad.mjs";
import { n as getNuxtVersion, t as DEFAULT_NUXT_VERSION } from "./versions-BA3DmZ0X.mjs";
import { a as fetchModules, r as checkNuxtCompatibility, t as MODULES_API_URL } from "./_utils-B2jBlm2m.mjs";
import process from "node:process";
import { styleText } from "node:util";
import { box } from "@clack/prompts";
import { kebabCase, upperFirst } from "scule";
import fuzzysort from "fuzzysort";
//#region src/commands/module/search.ts
const DASH_RE = /-/g;
/**
* Every result is rendered as its own box, so a query that happens to be a
* subsequence of half the registry (`stripe` matches 178 of 316 modules at any
* score) must not turn into a screenful of boxes. The score cut removes the
* incidental matches and the limit caps what is left.
*/
const SCORE_THRESHOLD = .5;
const RESULT_LIMIT = 20;
const { format: formatNumber } = new Intl.NumberFormat("en-GB", {
	notation: "compact",
	maximumFractionDigits: 1
});
var search_default = defineCommand({
	meta: {
		name: "search",
		description: "Search in Nuxt modules"
	},
	args: {
		...cwdArgs,
		query: {
			type: "positional",
			description: "keywords to search for",
			required: true
		},
		nuxtVersion: {
			type: "string",
			description: "Filter by Nuxt version and list compatible modules only (auto detected by default)",
			required: false,
			valueHint: "3|4|4.2.0"
		},
		...jsonArgs
	},
	async setup(ctx) {
		const nuxtVersion = ctx.args.nuxtVersion ? normalizeNuxtVersion(ctx.args.nuxtVersion) : await getNuxtVersion(ctx.args.cwd).catch(() => DEFAULT_NUXT_VERSION);
		return findModuleByKeywords(ctx.args._.join(" "), nuxtVersion, ctx.args.json);
	}
});
function normalizeNuxtVersion(version) {
	return /^\d+$/.test(version) ? `${version}.0.0` : /^\d+\.\d+$/.test(version) ? `${version}.0` : version;
}
async function findModuleByKeywords(query, nuxtVersion, json) {
	const targets = (await fetchModules().catch((err) => {
		logNetworkError(err, { url: MODULES_API_URL });
		process.exit(1);
	})).filter((m) => checkNuxtCompatibility(m, nuxtVersion)).map((item) => ({
		item,
		name: fuzzysort.prepare(item.name),
		npm: fuzzysort.prepare(item.npm),
		rest: fuzzysort.prepare([
			item.repo,
			item.tags?.join(" "),
			item.category,
			item.description,
			item.maintainers.map((maintainer) => `${maintainer.name} ${maintainer.github}`).join(" ")
		].filter(Boolean).join(" "))
	}));
	const matches = fuzzysort.go(query, targets, {
		keys: [
			"name",
			"npm",
			"rest"
		],
		threshold: SCORE_THRESHOLD,
		limit: RESULT_LIMIT
	}).map(({ obj: { item } }) => item);
	if (json) {
		await printJson({
			query,
			nuxtVersion,
			modules: matches.map((item) => ({
				name: item.name,
				package: item.npm,
				description: item.description,
				homepage: item.website,
				repository: item.github,
				compatibility: item.compatibility?.nuxt || "*",
				stars: item.stats.stars,
				monthlyDownloads: item.stats.downloads,
				install: `npx nuxt add ${item.name}`
			}))
		});
		return;
	}
	const results = matches.map((item) => {
		const res = {
			name: item.name,
			package: item.npm,
			homepage: styleText("cyan", item.website),
			compatibility: `nuxt: ${item.compatibility?.nuxt || "*"}`,
			repository: item.github,
			description: item.description,
			install: `npx nuxt add ${item.name}`,
			stars: styleText("yellow", formatNumber(item.stats.stars)),
			monthlyDownloads: styleText("yellow", formatNumber(item.stats.downloads))
		};
		if (item.github === item.website) delete res.homepage;
		if (item.name === item.npm) delete res.package;
		return res;
	});
	if (!results.length) {
		logger.info(`No Nuxt modules found matching query ${styleText("magenta", query)} for Nuxt ${styleText("cyan", nuxtVersion)}`);
		return;
	}
	logger.success(`Found ${results.length} Nuxt ${results.length > 1 ? "modules" : "module"} matching ${styleText("cyan", query)} ${nuxtVersion ? `for Nuxt ${styleText("cyan", nuxtVersion)}` : ""}:\n`);
	for (const foundModule of results) {
		const formattedModule = {};
		for (const [key, val] of Object.entries(foundModule)) {
			const label = upperFirst(kebabCase(key)).replace(DASH_RE, " ");
			formattedModule[label] = val;
		}
		const title = formattedModule.Name || formattedModule.Package;
		delete formattedModule.Name;
		const boxContent = formatInfoBox(formattedModule);
		box(`\n${boxContent}`, ` ${title} `, {
			contentAlign: "left",
			titleAlign: "left",
			width: "auto",
			titlePadding: 2,
			contentPadding: 2,
			rounded: true
		});
	}
}
//#endregion
export { search_default as default, normalizeNuxtVersion };
