import { _ as runCommand$1, a as globalCwdArgs, d as description, g as renderUsage, h as defineCommand, m as version, p as name, t as cwdArgs, v as runMain$1 } from "./_shared-YyGADOl7.mjs";
import { s as debug, u as logger, w as asActionableError } from "./startup-clock-DXZlxuSA.mjs";
import { n as warnOnHang } from "./hang-DvJGbBHh.mjs";
import { s as setupGlobalConsole } from "./console-BgmzEcbV.mjs";
import { a as setupProxySupport, n as withLocalBinPath, t as findInPath } from "./path-env-D9Xd_BAN.mjs";
import { t as templateNames } from "./names-BemXlTaX.mjs";
import { resolve } from "node:path";
import process from "node:process";
import { stripVTControlCharacters, styleText } from "node:util";
import { provider } from "std-env";
import { consola } from "consola";
import { fileURLToPath } from "node:url";
//#region src/commands/index.ts
function resolve$1(value) {
	return typeof value === "function" ? value() : value;
}
/**
* Carry the boundary into a command's subcommands, keeping each one lazy so
* wrapping a parent never loads them.
*
* The map is itself resolvable, and enumerating a function or a promise yields
* no entries, so it is resolved before being walked and stays a resolver where
* it began as one.
*/
function withRemedies(subCommands) {
	const wrapEntries = (resolved) => Object.fromEntries(Object.entries(resolved).map(([name, subCommand]) => [name, async () => withRemedy(await resolve$1(subCommand))]));
	return typeof subCommands === "function" || subCommands instanceof Promise ? async () => wrapEntries(await resolve$1(subCommands)) : wrapEntries(subCommands);
}
/**
* One error boundary for every command.
*
* A tagged error can be raised from any of the kit entry points a command
* touches, so the remedy is applied where the command ends rather than at each
* of them.
*/
function withRemedy(command) {
	const { run, subCommands } = command;
	return {
		...command,
		...run && { async run(context) {
			try {
				return await run(context);
			} catch (error) {
				consola.wrapConsole();
				throw asActionableError(error);
			}
		} },
		...subCommands && { subCommands: withRemedies(subCommands) }
	};
}
const _rDefault = (r) => withRemedy(r.default || r);
const commands = Object.assign(Object.create(null), {
	"add": () => import("./add-DWqvGMpc.mjs").then(_rDefault),
	"add-template": () => import("./add-template-BdjP7WQy.mjs").then(_rDefault),
	"analyze": () => import("./analyze-Knd2li_M.mjs").then(_rDefault),
	"build": () => import("./build-BToGXWIU.mjs").then(_rDefault),
	"cleanup": () => import("./cleanup-87sJyNNX.mjs").then(_rDefault),
	"curl": () => import("./curl-Cd0SfqC3.mjs").then(_rDefault),
	"_dev": () => import("./dev-child-B5RlZ1Ny.mjs").then(_rDefault),
	"dev": () => import("./dev-DS2f4yt-.mjs").then(_rDefault),
	"devtools": () => import("./devtools-BpL1jySm.mjs").then(_rDefault),
	"docs": () => import("./docs-Cqx3LG3l.mjs").then(_rDefault),
	"generate": () => import("./generate-Duy1gNe_.mjs").then(_rDefault),
	"info": () => import("./info-3RG9T46s.mjs").then(_rDefault),
	"init": () => import("./init-R5CN8VbY.mjs").then(_rDefault),
	"module": () => import("./module-ohT2LN4z.mjs").then(_rDefault),
	"prepare": () => import("./prepare-BV1iEjgA.mjs").then((n) => n.n).then(_rDefault),
	"preview": () => import("./preview-BAt7B1q5.mjs").then(_rDefault),
	"start": () => import("./start-DzgEgRKN.mjs").then(_rDefault),
	"task": () => import("./task-BaqUBZeu.mjs").then(_rDefault),
	"test": () => import("./test-5BIdQQRv.mjs").then(_rDefault),
	"typecheck": () => import("./typecheck-Qjk2r1pX.mjs").then(_rDefault),
	"upgrade": () => import("./upgrade-BDmiQZfp.mjs").then(_rDefault)
});
//#endregion
//#region src/run.ts
globalThis.__nuxt_cli__ = globalThis.__nuxt_cli__ || {
	startTime: Date.now(),
	entry: fileURLToPath(new URL("../bin/nuxi.mjs", import.meta.url)),
	devEntry: fileURLToPath(new URL("../dev/index.mjs", import.meta.url))
};
const LONG_RUNNING_COMMANDS = /* @__PURE__ */ new Set([
	"dev",
	"_dev",
	"analyze",
	"test",
	"preview",
	"start"
]);
let currentCommand;
/** Record the command being run, so `runMain` knows whether the process is expected to exit. */
function setCurrentCommand(command) {
	currentCommand = command;
}
async function runMain() {
	if (process.argv[2] === "complete") {
		const { initCompletions } = await import("./completions-7gMzNyXU.mjs");
		await initCompletions(main);
	}
	await runMain$1(main, { showUsage });
	if (!currentCommand || !LONG_RUNNING_COMMANDS.has(currentCommand)) warnOnHang({ action: currentCommand ? `\`nuxt ${currentCommand}\`` : "command" });
}
async function runCommand(name, argv = process.argv.slice(2), data = {}) {
	if (!Object.hasOwn(commands, name)) throw new Error(`Invalid command ${name}`);
	return await runCommand$1(await commands[name](), {
		rawArgs: [...argv],
		inheritedArgs: globalCwdArgs,
		data: { overrides: data.overrides || {} }
	});
}
/** Print usage, unstyled when stdout lacks colour support. */
async function showUsage(cmd, parent) {
	const usage = await renderUsage(cmd, parent);
	const plain = process.env.NO_COLOR || !process.stdout.hasColors?.();
	process.stdout.write(`${plain ? stripVTControlCharacters(usage) : usage}\n\n`);
}
//#endregion
//#region src/utils/suggest.ts
/**
* A wrong command suggestion replaces the help output the user would otherwise
* have read, so it has to be right; a wrong flag suggestion sits next to the
* flag they typed, so a lower bar is worth the extra hits.
*/
const commandPolicy = {
	threshold: .6,
	margin: .1,
	tolerance: (input) => input.length <= 4 ? 1 : 2,
	prefix: true,
	requireUnique: true
};
const flagPolicy = {
	threshold: .3,
	tolerance: (input) => input.length <= 4 ? 1 : 2
};
function suggestCommand(input, commands) {
	return suggestClosest(input, commands, commandPolicy);
}
function suggestFlag(input, flags) {
	return suggestClosest(input, flags, flagPolicy);
}
/**
* Best guess at the candidate an input was meant to be, or `undefined` when
* nothing is close enough to be worth printing.
*
* `fuzzysort` matches prefixes and subsequences well but scores transpositions
* at zero (`biuld` against `build`, `dotnev` against `dotenv`), which is the
* most common typo of all, so edit distance covers what it rejects.
*/
async function suggestClosest(input, candidates, policy) {
	const query = input.toLowerCase();
	if (!query || candidates.includes(input)) return;
	const lowerCased = candidates.map((candidate) => candidate.toLowerCase());
	if (policy.prefix) {
		const prefixMatches = candidates.filter((_, index) => lowerCased[index].startsWith(query));
		if (prefixMatches.length === 1) return prefixMatches[0];
	}
	const { default: fuzzysort } = await import("fuzzysort");
	const [best, runnerUp] = fuzzysort.go(query, candidates, { threshold: policy.threshold });
	if (best && (!runnerUp || best.score - runnerUp.score >= (policy.margin ?? 0))) return best.target;
	const tolerance = policy.tolerance?.(query) ?? 0;
	if (tolerance <= 0) return;
	let closest;
	let closestDistance = Number.POSITIVE_INFINITY;
	let tied = false;
	for (const [index, candidate] of lowerCased.entries()) {
		const distance = editDistance(query, candidate);
		if (distance < closestDistance) {
			closestDistance = distance;
			closest = candidates[index];
			tied = false;
		} else if (distance === closestDistance) tied = true;
	}
	if (closestDistance > tolerance || tied && policy.requireUnique) return;
	return closest;
}
/** Damerau-Levenshtein distance, so a single transposition counts as one edit. */
function editDistance(a, b) {
	const rows = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
	for (let i = 0; i <= a.length; i++) rows[i][0] = i;
	for (let j = 0; j <= b.length; j++) rows[0][j] = j;
	for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
		const cost = a[i - 1] === b[j - 1] ? 0 : 1;
		rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
		if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + cost);
	}
	return rows[a.length][b.length];
}
//#endregion
//#region src/utils/unknown-args.ts
/** Always accepted by citty, so never reported as unknown. */
const BUILTIN_FLAGS = ["help", "version"];
const LEADING_DASHES_RE = /^--/;
const NEGATION_RE = /^no-/;
/**
* Long flags in `rawArgs` that `argsDef` does not declare.
*
* Only `--long` forms are considered. A bundle of short flags (`-abc`) cannot be
* told apart from a single misspelled one, and guessing wrong is worse than
* staying quiet.
*/
function findUnknownFlags(argsDef, rawArgs) {
	const known = new Set(BUILTIN_FLAGS);
	for (const [name, def] of Object.entries(argsDef)) {
		known.add(name);
		const alias = def.alias;
		for (const entry of Array.isArray(alias) ? alias : alias ? [alias] : []) known.add(entry);
	}
	const separator = rawArgs.indexOf("--");
	const argv = separator === -1 ? rawArgs : rawArgs.slice(0, separator);
	const flags = [];
	for (const arg of argv) {
		if (!arg.startsWith("--") || arg === "--") continue;
		const equals = arg.indexOf("=");
		const name = (equals === -1 ? arg : arg.slice(0, equals)).replace(LEADING_DASHES_RE, "");
		if (name && !isKnown(known, name) && !flags.includes(name)) flags.push(name);
	}
	return {
		flags,
		known: [...known]
	};
}
/**
* The declared flag each unknown flag was most likely meant to be. Resolved
* separately so the fuzzy matcher is only loaded once something is wrong.
*/
async function suggestFlags({ flags, known }) {
	return Promise.all(flags.map(async (flag) => {
		const match = await suggestFlag(flag.replace(NEGATION_RE, ""), known);
		return {
			flag: `--${flag}`,
			suggestion: match && `--${match}`
		};
	}));
}
/**
* Rewrite every use of `--flag` (bare or `=value`) to `replacement`, in place:
* citty re-reads the same array when it resolves the subcommand, so an in-place
* edit is what makes the correction reach the command that runs.
*/
function replaceFlag(rawArgs, flag, replacement) {
	const separator = rawArgs.indexOf("--");
	const end = separator === -1 ? rawArgs.length : separator;
	for (let i = 0; i < end; i++) if (rawArgs[i] === flag) rawArgs[i] = replacement;
	else if (rawArgs[i].startsWith(`${flag}=`)) rawArgs[i] = `${replacement}${rawArgs[i].slice(flag.length)}`;
}
/**
* Dotted flags are declared either whole (`https.cert`) or as the object that
* holds them (`https`), and a boolean may be negated with a `no-` prefix.
*/
function isKnown(known, name) {
	for (const candidate of /* @__PURE__ */ new Set([name, name.replace(NEGATION_RE, "")])) {
		if (known.has(candidate)) return true;
		for (let dot = candidate.lastIndexOf("."); dot !== -1; dot = candidate.lastIndexOf(".", dot - 1)) if (known.has(candidate.slice(0, dot))) return true;
	}
	return false;
}
//#endregion
//#region src/utils/update-lazy.ts
/**
* The update check pulls in `rc9`, `@clack/prompts`, `verkit` and the registry
* client, and then reads `.nuxtrc` and queries the registry. Its only output is
* rendered at process exit, so on a long-running command none of that needs to
* compete with startup.
*/
const STARTUP_GRACE_MS = 3e3;
function scheduleUpdateNudge(cwd, command) {
	return afterStartup(() => import("./update-X8ao_jua.mjs").then(({ scheduleUpdateNudge }) => scheduleUpdateNudge(cwd, command)));
}
function afterStartup(run) {
	return new Promise((resolve, reject) => {
		setTimeout(() => void run().then(resolve, reject), STARTUP_GRACE_MS).unref();
	});
}
//#endregion
//#region src/main.ts
setupProxySupport();
const _main = defineCommand({
	meta: {
		name: name.endsWith("nightly") ? name : "nuxt",
		version,
		description
	},
	args: {
		...globalCwdArgs,
		command: {
			type: "positional",
			required: false
		}
	},
	subCommands: commands,
	async setup(ctx) {
		const command = ctx.args._[0];
		setCurrentCommand(command);
		setupGlobalConsole({ dev: command === "dev" });
		if (command && command !== "_dev" && provider !== "stackblitz") {
			await import("./engines--EbIHKFZ.mjs").then(({ checkEngines }) => checkEngines()).catch((err) => logger.error(String(err)));
			import("./paths-DlXZaaIg.mjs").then((n) => n.t).then(({ resolveProjectDir }) => scheduleUpdateNudge(resolveProjectDir(ctx.args), command)).catch((err) => debug("Failed to check for updates:", err));
		}
		if (command === "add" && ctx.rawArgs[1] && templateNames.includes(ctx.rawArgs[1])) {
			logger.warn(`${styleText("yellow", "Deprecated:")} Using ${styleText("cyan", "nuxt add <template> <name>")} is deprecated.`);
			logger.info(`Please use ${styleText("cyan", "nuxt add-template <template> <name>")} instead.`);
			await runCommand("add-template", [...ctx.rawArgs.slice(1)]).catch((err) => {
				console.error(err.message);
				process.exit(1);
			});
			process.exit(0);
		}
		if (command && Object.hasOwn(commands, command)) await warnUnknownFlags(command, ctx.rawArgs);
		if (ctx.args.command && !Object.hasOwn(commands, ctx.args.command)) {
			const cwd = resolve(ctx.args.cwd || ".");
			const env = withLocalBinPath(cwd);
			const binary = findInPath(`nuxt-${ctx.args.command}`, env);
			if (!binary) return reportUnknownCommand(ctx.args.command, ctx.rawArgs);
			const { x } = await import("tinyexec");
			const result = await x(binary, ctx.rawArgs.slice(1), {
				nodeOptions: {
					stdio: "inherit",
					cwd,
					env
				},
				nodePath: false,
				throwOnError: false
			});
			process.exit(result.exitCode ?? 1);
		}
	}
});
/**
* Report long flags the resolved command does not declare *and* that look like
* a misspelling of one it does, so a typo does not look like a flag that simply
* had no effect.
*
* A flag with no close match is passed through in silence: projects read their
* own flags out of `process.argv` in `nuxt.config`, and there is no way to tell
* one of those from a typo nothing resembles.
*/
async function warnUnknownFlags(command, rawArgs) {
	let def;
	try {
		def = await commands[command]();
		const subCommands = await resolveLazy(def.subCommands);
		const subCommand = rawArgs.slice(1).find((arg) => !arg.startsWith("-"));
		if (subCommands && subCommand && Object.hasOwn(subCommands, subCommand)) def = await resolveLazy(subCommands[subCommand]);
	} catch (err) {
		debug("Could not check arguments:", err);
		return;
	}
	const unknown = findUnknownFlags({
		...cwdArgs,
		...await resolveLazy(def.args)
	}, rawArgs.slice(1));
	if (unknown.flags.length === 0) return;
	const suggestions = (await suggestFlags(unknown)).filter((entry) => {
		if (entry.suggestion) return true;
		debug(`Passing through unknown option ${entry.flag}.`);
		return false;
	});
	if (suggestions.length === 0) return;
	const { isInteractive } = await import("./startup-clock-DXZlxuSA.mjs").then((n) => n._);
	if (!isInteractive()) {
		for (const { flag, suggestion } of suggestions) logger.warn(`Unknown option ${styleText("cyan", flag)}. Did you mean ${styleText("cyan", suggestion)}?`);
		return;
	}
	const { cancel, confirm, isCancel } = await import("@clack/prompts");
	const { restoreRawMode, withDirectStdout } = await import("./console-BgmzEcbV.mjs").then((n) => n.n);
	const { withUserAttention } = await import("./startup-clock-DXZlxuSA.mjs").then((n) => n.n);
	for (const { flag, suggestion } of suggestions) {
		const replacement = flag.startsWith("--no-") && !suggestion.startsWith("--no-") ? `--no-${suggestion.slice(2)}` : suggestion;
		logger.warn(`Unknown option ${styleText("cyan", flag)}.`);
		const answer = await withUserAttention(() => withDirectStdout(() => confirm({
			message: `Use ${styleText("cyan", replacement)} instead?`,
			initialValue: true
		})));
		restoreRawMode();
		if (isCancel(answer)) {
			cancel("Aborted.");
			process.exit(130);
		}
		if (answer) replaceFlag(rawArgs, flag, replacement);
	}
}
function resolveLazy(value) {
	return Promise.resolve(typeof value === "function" ? value() : value);
}
/**
* Report a command that neither the CLI nor a local `nuxt-` binary provides.
*
* With a confident suggestion this is the whole error, since a full help dump
* buries the one line the user needs; interactively, the suggestion is offered
* to run directly. Otherwise nothing is printed and citty falls back to
* showing usage.
*/
async function reportUnknownCommand(command, rawArgs) {
	const suggestion = await suggestCommand(command, Object.keys(commands).filter((name) => !name.startsWith("_")));
	if (!suggestion) return;
	const { isInteractive } = await import("./startup-clock-DXZlxuSA.mjs").then((n) => n._);
	if (isInteractive()) {
		logger.warn(`Unknown command ${styleText("cyan", command)}.`);
		const { confirm, isCancel } = await import("@clack/prompts");
		const { restoreRawMode, withDirectStdout } = await import("./console-BgmzEcbV.mjs").then((n) => n.n);
		const { withUserAttention } = await import("./startup-clock-DXZlxuSA.mjs").then((n) => n.n);
		const answer = await withUserAttention(() => withDirectStdout(() => confirm({
			message: `Run ${styleText("cyan", `nuxt ${suggestion}`)} instead?`,
			initialValue: true
		})));
		restoreRawMode();
		if (isCancel(answer)) process.exit(130);
		if (answer) {
			const index = rawArgs.indexOf(command);
			const argv = index === -1 ? rawArgs : rawArgs.toSpliced(index, 1);
			setCurrentCommand(suggestion);
			await runCommand(suggestion, argv).catch((err) => {
				console.error(err.message);
				process.exit(1);
			});
			if (LONG_RUNNING_COMMANDS.has(suggestion)) await new Promise(() => {});
			process.exit(0);
		}
	}
	logger.error(`Unknown command ${styleText("cyan", command)}. Did you mean ${styleText("cyan", `nuxt ${suggestion}`)}?`);
	logger.info(`Run ${styleText("cyan", "nuxt --help")} to see all commands.`);
	process.exit(1);
}
const main = _main;
//#endregion
export { main, runCommand, runMain };
