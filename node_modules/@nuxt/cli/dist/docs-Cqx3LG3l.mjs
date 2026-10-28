import { h as defineCommand, t as cwdArgs } from "./_shared-YyGADOl7.mjs";
import { h as isInteractive, u as logger } from "./startup-clock-DXZlxuSA.mjs";
import { a as releaseStdin, c as withDirectStdout } from "./console-BgmzEcbV.mjs";
import { o as openBrowser } from "./listen-BjyzPJ2X.mjs";
import { i as resolveRootDir } from "./paths-DlXZaaIg.mjs";
import { r as withSpinner } from "./spinner-Cj-5sQW4.mjs";
import process from "node:process";
import { styleText } from "node:util";
import { cancel, isCancel, select } from "@clack/prompts";
//#region src/commands/docs.ts
const MAX_RESULTS = 8;
var docs_default = defineCommand({
	meta: {
		name: "docs",
		description: "Search or open the Nuxt documentation"
	},
	args: {
		query: {
			type: "positional",
			description: "Words to search the documentation for",
			required: false
		},
		...cwdArgs,
		open: {
			type: "boolean",
			description: "Open the best match in a browser",
			negativeDescription: "Print the matching pages without opening a browser",
			default: true
		}
	},
	async run(ctx) {
		const { DOCS_BASE_URL, DOCS_PATH, resolveDocsIndex } = await import("./docs-index-BIRwN9tz.mjs");
		const query = ctx.args._.join(" ").trim();
		if (!query) return visit(DOCS_BASE_URL + DOCS_PATH, ctx.args.open);
		const found = await withSpinner(`Searching the Nuxt documentation for ${styleText("cyan", query)}`, async (spinner) => {
			const index = await resolveDocsIndex(resolveRootDir(ctx.args), {
				onDownload: (version) => spinner.update(`Downloading the Nuxt ${version} documentation`),
				onIndex: (version) => spinner.update(`Indexing the Nuxt ${version} documentation`)
			});
			if (!index) return;
			spinner.update(`Searching the Nuxt ${index.version} documentation for ${styleText("cyan", query)}`);
			const results = await search(index, query);
			spinner.done(`Searched ${index.entries.length} pages of the Nuxt ${index.version} documentation`);
			return {
				index,
				results
			};
		});
		if (!found) {
			logger.warn(`Could not read the Nuxt documentation for this project. Run again with ${styleText("cyan", "DEBUG=nuxi*")} to see why.`);
			return visit(DOCS_BASE_URL + DOCS_PATH, ctx.args.open);
		}
		const { index, results } = found;
		if (results.length === 0) {
			logger.warn(`Nothing in the Nuxt ${index.version} documentation matches ${styleText("cyan", query)}.`);
			return visit(DOCS_BASE_URL + DOCS_PATH, ctx.args.open);
		}
		if (results.length > 1 && ctx.args.open && isInteractive()) {
			const choice = await withDirectStdout(() => select({
				message: `Which page would you like to open?`,
				initialValue: results[0].path,
				options: results.map(({ title, description, path }) => ({
					value: path,
					label: title,
					hint: description || path
				}))
			}));
			releaseStdin();
			if (isCancel(choice)) {
				cancel(`Nuxt documentation: ${DOCS_BASE_URL}${index.base}${results[0].path}`);
				return;
			}
			return visit(DOCS_BASE_URL + index.base + choice, true);
		}
		const width = Math.max(...results.map((entry) => entry.title.length));
		const lines = results.map(({ title, description, path }, position) => {
			return `${`  ${position === 0 ? styleText("green", ">") : " "} ${styleText("bold", title.padEnd(width))}`}  ${styleText("gray", description || path)}`;
		});
		process.stdout.write(`${lines.join("\n")}\n`);
		return visit(DOCS_BASE_URL + index.base + results[0].path, ctx.args.open);
	}
});
function visit(url, open) {
	logger.info(`${open ? "Opening" : "Nuxt documentation:"} ${styleText("cyan", url)}`);
	if (open) openBrowser(url);
}
/**
* Rank pages by title first, then by their section headings, then by description.
* A page whose heading names the query is usually a better answer than one that
* merely mentions it in prose, so headings are scored rather than full text.
*/
async function search(index, query) {
	const { default: fuzzysort } = await import("fuzzysort");
	return index.entries.map((entry) => {
		const title = fuzzysort.single(query, entry.title)?.score ?? 0;
		const heading = Math.max(0, ...entry.headings.map((value) => fuzzysort.single(query, value)?.score ?? 0));
		const description = fuzzysort.single(query, entry.description || "")?.score ?? 0;
		const path = fuzzysort.single(query, entry.path)?.score ?? 0;
		return {
			entry,
			score: Math.max(title, heading * .9, path * .8, description * .6)
		};
	}).filter((result) => result.score > .3).sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS).map((result) => result.entry);
}
//#endregion
export { docs_default as default };
