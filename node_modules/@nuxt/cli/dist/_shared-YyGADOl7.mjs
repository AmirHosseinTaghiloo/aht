import { parseArgs } from "node:util";
//#region ../../node_modules/.pnpm/citty@0.2.2_patch_hash=24c57c383378e5de0f0b955a987077b0d3ab2cc2f1d3919c5193e801c7afadac/node_modules/citty/dist/_chunks/libs/scule.mjs
const NUMBER_CHAR_RE = /\d/;
const STR_SPLITTERS = [
	"-",
	"_",
	"/",
	"."
];
function isUppercase(char = "") {
	if (NUMBER_CHAR_RE.test(char)) return;
	return char !== char.toLowerCase();
}
function splitByCase(str, separators) {
	const splitters = separators ?? STR_SPLITTERS;
	const parts = [];
	if (!str || typeof str !== "string") return parts;
	let buff = "";
	let previousUpper;
	let previousSplitter;
	for (const char of str) {
		const isSplitter = splitters.includes(char);
		if (isSplitter === true) {
			parts.push(buff);
			buff = "";
			previousUpper = void 0;
			continue;
		}
		const isUpper = isUppercase(char);
		if (previousSplitter === false) {
			if (previousUpper === false && isUpper === true) {
				parts.push(buff);
				buff = char;
				previousUpper = isUpper;
				continue;
			}
			if (previousUpper === true && isUpper === false && buff.length > 1) {
				const lastChar = buff.at(-1);
				parts.push(buff.slice(0, Math.max(0, buff.length - 1)));
				buff = lastChar + char;
				previousUpper = isUpper;
				continue;
			}
		}
		buff += char;
		previousUpper = isUpper;
		previousSplitter = isSplitter;
	}
	parts.push(buff);
	return parts;
}
function upperFirst(str) {
	return str ? str[0].toUpperCase() + str.slice(1) : "";
}
function lowerFirst(str) {
	return str ? str[0].toLowerCase() + str.slice(1) : "";
}
function pascalCase(str, opts) {
	return str ? (Array.isArray(str) ? str : splitByCase(str)).map((p) => upperFirst(opts?.normalize ? p.toLowerCase() : p)).join("") : "";
}
function camelCase(str, opts) {
	return lowerFirst(pascalCase(str || "", opts));
}
function kebabCase(str, joiner) {
	return str ? (Array.isArray(str) ? str : splitByCase(str)).map((p) => p.toLowerCase()).join(joiner ?? "-") : "";
}
function snakeCase(str) {
	return kebabCase(str || "", "_");
}
//#endregion
//#region ../../node_modules/.pnpm/citty@0.2.2_patch_hash=24c57c383378e5de0f0b955a987077b0d3ab2cc2f1d3919c5193e801c7afadac/node_modules/citty/dist/index.mjs
function toArray(val) {
	if (Array.isArray(val)) return val;
	return val === void 0 ? [] : [val];
}
function formatLineColumns(lines, linePrefix = "") {
	const maxLength = [];
	for (const line of lines) for (const [i, element] of line.entries()) maxLength[i] = Math.max(maxLength[i] || 0, element.length);
	return lines.map((l) => l.map((c, i) => linePrefix + c[i === 0 ? "padStart" : "padEnd"](maxLength[i])).join("  ")).join("\n");
}
function resolveValue(input) {
	return typeof input === "function" ? input() : input;
}
var CLIError = class extends Error {
	code;
	constructor(message, code) {
		super(message);
		this.name = "CLIError";
		this.code = code;
	}
};
function parseRawArgs(args = [], opts = {}) {
	const booleans = new Set(opts.boolean || []);
	const strings = new Set(opts.string || []);
	const multiples = new Set(opts.multiple || []);
	const aliasMap = opts.alias || {};
	const defaults = opts.default || {};
	const aliasToMain = /* @__PURE__ */ new Map();
	const mainToAliases = /* @__PURE__ */ new Map();
	for (const [key, value] of Object.entries(aliasMap)) {
		const targets = value;
		for (const target of targets) {
			aliasToMain.set(key, target);
			if (!mainToAliases.has(target)) mainToAliases.set(target, []);
			mainToAliases.get(target).push(key);
			aliasToMain.set(target, key);
			if (!mainToAliases.has(key)) mainToAliases.set(key, []);
			mainToAliases.get(key).push(target);
		}
	}
	const options = {};
	function isInSet(name, set) {
		if (set.has(name)) return true;
		const aliases = mainToAliases.get(name) || [];
		for (const alias of aliases) if (set.has(alias)) return true;
		return false;
	}
	function getType(name) {
		return isInSet(name, booleans) ? "boolean" : "string";
	}
	function isStringType(name) {
		return isInSet(name, strings);
	}
	function isMultiple(name) {
		return isInSet(name, multiples);
	}
	const allOptions = /* @__PURE__ */ new Set([
		...booleans,
		...strings,
		...Object.keys(aliasMap),
		...Object.values(aliasMap).flat(),
		...Object.keys(defaults)
	]);
	for (const name of allOptions) if (!options[name]) options[name] = {
		type: getType(name),
		default: defaults[name],
		multiple: isMultiple(name)
	};
	for (const [alias, main] of aliasToMain.entries()) if (alias.length === 1 && options[main] && !options[main].short) options[main].short = alias;
	const processedArgs = [];
	const negatedFlags = {};
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "--") {
			processedArgs.push(...args.slice(i));
			break;
		}
		if (arg.startsWith("--no-")) {
			const flagName = arg.slice(5);
			negatedFlags[flagName] = true;
			continue;
		}
		processedArgs.push(arg);
	}
	let parsed;
	try {
		parsed = parseArgs({
			args: processedArgs,
			options: Object.keys(options).length > 0 ? options : void 0,
			allowPositionals: true,
			strict: false
		});
	} catch {
		parsed = {
			values: {},
			positionals: processedArgs
		};
	}
	const out = { _: [] };
	out._ = parsed.positionals;
	function coerceValue(key, value) {
		if (Array.isArray(value)) return value.map((item) => coerceValue(key, item));
		if (getType(key) === "boolean" && typeof value === "string") return value !== "false";
		if (isStringType(key) && typeof value === "boolean") return "";
		return value;
	}
	for (const [key, value] of Object.entries(parsed.values)) out[key] = coerceValue(key, value);
	for (const [name] of Object.entries(negatedFlags)) {
		out[name] = false;
		const mainName = aliasToMain.get(name);
		if (mainName) out[mainName] = false;
		const aliases = mainToAliases.get(name);
		if (aliases) for (const alias of aliases) out[alias] = false;
	}
	for (const [alias, main] of aliasToMain.entries()) {
		if (out[alias] !== void 0 && out[main] === void 0) out[main] = out[alias];
		if (out[main] !== void 0 && out[alias] === void 0) out[alias] = out[main];
		if (out[alias] !== out[main] && defaults[main] === out[main]) out[main] = out[alias];
	}
	return out;
}
const noColor = /* @__PURE__ */ (() => {
	const env = globalThis.process?.env ?? {};
	return env.NO_COLOR === "1" || env.TERM === "dumb" || env.TEST || env.CI;
})();
const _c = (c, r = 39) => (t) => noColor ? t : `\u001B[${c}m${t}\u001B[${r}m`;
const bold = /* @__PURE__ */ _c(1, 22);
const cyan = /* @__PURE__ */ _c(36);
const gray = /* @__PURE__ */ _c(90);
const underline = /* @__PURE__ */ _c(4, 24);
function assertEnumValue(arg, value) {
	if (arg.type !== "enum" || value === void 0) return;
	const options = arg.options || [];
	if (options.length > 0 && !options.includes(value)) throw new CLIError(`Invalid value for argument: ${cyan(`--${arg.name}`)} (${cyan(value)}). Expected one of: ${options.map((o) => cyan(o)).join(", ")}.`, "EARG");
}
function parseArgs$1(rawArgs, argsDef) {
	const parseOptions = {
		boolean: [],
		string: [],
		multiple: [],
		alias: {},
		default: {}
	};
	const args = resolveArgs(argsDef);
	const positionals = args.filter(({ type }) => type === "positional");
	for (const [index, positional] of positionals.entries()) if (positional.multiple && index < positionals.length - 1) throw new CLIError(`A "multiple" positional argument must be the last positional argument, but "${positional.name}" is not.`, "EARG");
	for (const arg of args) {
		if (arg.type === "positional") continue;
		if (arg.type === "string" || arg.type === "enum") parseOptions.string.push(arg.name);
		else if (arg.type === "boolean") parseOptions.boolean.push(arg.name);
		if (arg.multiple) parseOptions.multiple.push(arg.name);
		if (arg.default !== void 0 && !arg.multiple) parseOptions.default[arg.name] = arg.default;
		if (arg.alias) parseOptions.alias[arg.name] = arg.alias;
		const camelName = camelCase(arg.name);
		const kebabName = kebabCase(arg.name);
		if (camelName !== arg.name || kebabName !== arg.name) {
			const existingAliases = toArray(parseOptions.alias[arg.name] || []);
			if (camelName !== arg.name && !existingAliases.includes(camelName)) existingAliases.push(camelName);
			if (kebabName !== arg.name && !existingAliases.includes(kebabName)) existingAliases.push(kebabName);
			if (existingAliases.length > 0) parseOptions.alias[arg.name] = existingAliases;
		}
	}
	const parsed = parseRawArgs(rawArgs, parseOptions);
	const [ ...positionalArguments] = parsed._;
	const parsedArgsProxy = new Proxy(parsed, { get(target, prop) {
		return target[prop] ?? target[camelCase(prop)] ?? target[kebabCase(prop)];
	} });
	for (const [, arg] of args.entries()) if (arg.type === "positional" && arg.multiple) {
		if (positionalArguments.length === 0 && arg.required !== false) throw new CLIError(`Missing required positional argument: ${arg.name.toUpperCase()}`, "EARG");
		parsedArgsProxy[arg.name] = positionalArguments;
	} else if (arg.type === "positional") {
		const nextPositionalArgument = positionalArguments.shift();
		if (nextPositionalArgument !== void 0) parsedArgsProxy[arg.name] = nextPositionalArgument;
		else if (arg.default === void 0 && arg.required !== false) throw new CLIError(`Missing required positional argument: ${arg.name.toUpperCase()}`, "EARG");
		else parsedArgsProxy[arg.name] = arg.default;
	} else if (arg.multiple) {
		const values = parsedArgsProxy[arg.name] ?? [];
		for (const value of values) assertEnumValue(arg, value);
		if (arg.required && values.length === 0) throw new CLIError(`Missing required argument: --${arg.name}`, "EARG");
		parsedArgsProxy[arg.name] = values;
	} else if (arg.type === "enum") assertEnumValue(arg, parsedArgsProxy[arg.name]);
	else if (arg.required && parsedArgsProxy[arg.name] === void 0) throw new CLIError(`Missing required argument: --${arg.name}`, "EARG");
	return parsedArgsProxy;
}
function resolveArgs(argsDef) {
	const args = [];
	for (const [name, argDef] of Object.entries(argsDef || {})) args.push({
		...argDef,
		name,
		alias: toArray(argDef.alias)
	});
	return args;
}
async function resolvePlugins(plugins) {
	return Promise.all(plugins.map((p) => resolveValue(p)));
}
function defineCommand(def) {
	return def;
}
async function runCommand(cmd, opts) {
	const cmdArgs = {
		...opts.inheritedArgs,
		...await resolveValue(cmd.args || {})
	};
	const parsedArgs = parseArgs$1(opts.rawArgs, cmdArgs);
	const context = {
		rawArgs: opts.rawArgs,
		args: parsedArgs,
		data: opts.data,
		cmd
	};
	const plugins = await resolvePlugins(cmd.plugins ?? []);
	let result;
	let runError;
	try {
		for (const plugin of plugins) await plugin.setup?.(context);
		if (typeof cmd.setup === "function") await cmd.setup(context);
		const subCommands = await resolveValue(cmd.subCommands);
		if (subCommands && Object.keys(subCommands).length > 0) {
			const subCommandArgIndex = findSubCommandIndex(opts.rawArgs, cmdArgs);
			const explicitName = opts.rawArgs[subCommandArgIndex];
			if (explicitName) {
				const subCommand = await _findSubCommand(subCommands, explicitName);
				if (!subCommand) throw new CLIError(`Unknown command ${cyan(explicitName)}`, "E_UNKNOWN_COMMAND");
				const inheritedArgs = _inheritedArgs(cmdArgs);
				await runCommand(subCommand, {
					rawArgs: [..._collectInheritedRawArgs(opts.rawArgs.slice(0, subCommandArgIndex), cmdArgs, inheritedArgs), ...opts.rawArgs.slice(subCommandArgIndex + 1)],
					inheritedArgs
				});
			} else {
				const defaultSubCommand = await resolveValue(cmd.default);
				if (defaultSubCommand) {
					if (cmd.run) throw new CLIError(`Cannot specify both 'run' and 'default' on the same command.`, "E_DEFAULT_CONFLICT");
					const subCommand = await _findSubCommand(subCommands, defaultSubCommand);
					if (!subCommand) throw new CLIError(`Default sub command ${cyan(defaultSubCommand)} not found in subCommands.`, "E_UNKNOWN_COMMAND");
					await runCommand(subCommand, {
						rawArgs: opts.rawArgs,
						inheritedArgs: _inheritedArgs(cmdArgs)
					});
				} else if (!cmd.run) throw new CLIError(`No command specified.`, "E_NO_COMMAND");
			}
		}
		if (typeof cmd.run === "function") result = await cmd.run(context);
	} catch (error) {
		runError = error;
	}
	const cleanupErrors = [];
	if (typeof cmd.cleanup === "function") try {
		await cmd.cleanup(context);
	} catch (error) {
		cleanupErrors.push(error);
	}
	for (const plugin of [...plugins].reverse()) try {
		await plugin.cleanup?.(context);
	} catch (error) {
		cleanupErrors.push(error);
	}
	if (runError) throw runError;
	if (cleanupErrors.length === 1) throw cleanupErrors[0];
	if (cleanupErrors.length > 1) throw new Error("Multiple cleanup errors", { cause: cleanupErrors });
	return { result };
}
async function resolveSubCommand(cmd, rawArgs, parent) {
	const subCommands = await resolveValue(cmd.subCommands);
	if (subCommands && Object.keys(subCommands).length > 0) {
		const subCommandArgIndex = findSubCommandIndex(rawArgs, await resolveValue(cmd.args || {}));
		const subCommandName = rawArgs[subCommandArgIndex];
		const subCommand = await _findSubCommand(subCommands, subCommandName);
		if (subCommand) return resolveSubCommand(subCommand, rawArgs.slice(subCommandArgIndex + 1), cmd);
	}
	return [cmd, parent];
}
async function _findSubCommand(subCommands, name) {
	if (name in subCommands) return resolveValue(subCommands[name]);
	for (const sub of Object.values(subCommands)) {
		const resolved = await resolveValue(sub);
		const meta = await resolveValue(resolved?.meta);
		if (meta?.alias) {
			if (toArray(meta.alias).includes(name)) return resolved;
		}
	}
}
function findSubCommandIndex(rawArgs, argsDef) {
	for (let i = 0; i < rawArgs.length; i++) {
		const arg = rawArgs[i];
		if (arg === "--") return -1;
		if (arg.startsWith("-")) {
			if (!arg.includes("=") && _isValueFlag(arg, argsDef)) i++;
			continue;
		}
		return i;
	}
	return -1;
}
function _isValueFlag(flag, argsDef) {
	return _matchArg(flag, argsDef, (def) => def.type === "string" || def.type === "enum") !== void 0;
}
function _matchArg(flag, argsDef, filter) {
	const name = flag.replace(/^-{1,2}/, "");
	const direct = _findArg(name, argsDef, filter);
	if (direct || !name.startsWith("no-")) return direct;
	return _findArg(name.slice(3), argsDef, (def) => def.type === "boolean" && filter(def));
}
function _findArg(name, argsDef, filter) {
	const normalized = camelCase(name);
	for (const [key, def] of Object.entries(argsDef)) {
		if (!filter(def)) continue;
		if (normalized === camelCase(key)) return def;
		if (toArray(def.alias).includes(name)) return def;
	}
}
function _inheritedArgs(argsDef) {
	const inherited = {};
	for (const [name, def] of Object.entries(argsDef)) if (def.type !== "positional" && def.inherit) inherited[name] = def;
	return inherited;
}
function _collectInheritedRawArgs(rawArgs, argsDef, inherited) {
	if (Object.keys(inherited).length === 0) return [];
	const collected = [];
	for (let i = 0; i < rawArgs.length; i++) {
		const arg = rawArgs[i];
		if (!arg.startsWith("-")) continue;
		const [flag] = arg.split("=", 1);
		const takesValue = !arg.includes("=") && _isValueFlag(flag, argsDef);
		if (_matchArg(flag, inherited, () => true)) {
			collected.push(arg);
			if (takesValue && i + 1 < rawArgs.length) collected.push(rawArgs[i + 1]);
		}
		if (takesValue) i++;
	}
	return collected;
}
async function showUsage(cmd, parent) {
	try {
		console.log(await renderUsage(cmd, parent) + "\n");
	} catch (error) {
		console.error(error);
	}
}
const negativePrefixRe = /^no[-A-Z]/;
async function renderUsage(cmd, parent) {
	const cmdMeta = await resolveValue(cmd.meta || {});
	const cmdArgs = resolveArgs(await resolveValue(cmd.args || {}));
	const parentMeta = await resolveValue(parent?.meta || {});
	const commandName = `${parentMeta.name ? `${parentMeta.name} ` : ""}` + (cmdMeta.name || process.argv[1]);
	const argLines = [];
	const posLines = [];
	const commandsLines = [];
	const usageLine = [];
	for (const arg of cmdArgs) if (arg.type === "positional") {
		const name = arg.name.toUpperCase() + (arg.multiple ? "..." : "");
		const isRequired = arg.required !== false && arg.default === void 0;
		posLines.push([cyan(name + renderValueHint(arg)), renderDescription(arg, isRequired)]);
		usageLine.push(isRequired ? `<${name}>` : `[${name}]`);
	} else {
		if (arg.hidden) continue;
		const isRequired = arg.required === true && arg.default === void 0;
		const argStr = [...(arg.alias || []).map((a) => `-${a}`), `--${arg.name}`].join(", ") + renderValueHint(arg);
		argLines.push([cyan(argStr), renderDescription(arg, isRequired)]);
		/**
		* print negative boolean arg variant usage when
		* - enabled by default or has `negativeDescription`
		* - not prefixed with `no-` or `no[A-Z]`
		*/
		if (arg.type === "boolean" && (arg.default === true || arg.negativeDescription) && !negativePrefixRe.test(arg.name)) {
			const negativeArgStr = [...(arg.alias || []).map((a) => `--no-${a}`), `--no-${arg.name}`].join(", ");
			argLines.push([cyan(negativeArgStr), [arg.negativeDescription, isRequired ? gray("(Required)") : ""].filter(Boolean).join(" ")]);
		}
		if (isRequired) usageLine.push(`--${arg.name}` + renderValueHint(arg));
	}
	if (cmd.subCommands) {
		const commandNames = [];
		const subCommands = await resolveValue(cmd.subCommands);
		for (const [name, sub] of Object.entries(subCommands)) {
			const meta = await resolveValue((await resolveValue(sub))?.meta);
			if (meta?.hidden) continue;
			const aliases = toArray(meta?.alias);
			const label = [name, ...aliases].join(", ");
			commandsLines.push([cyan(label), meta?.description || ""]);
			commandNames.push(name, ...aliases);
		}
		usageLine.push(commandNames.join("|"));
	}
	const usageLines = [];
	const version = cmdMeta.version || parentMeta.version;
	usageLines.push(gray(`${cmdMeta.description} (${commandName + (version ? ` v${version}` : "")})`), "");
	const hasOptions = argLines.length > 0 || posLines.length > 0;
	usageLines.push(`${underline(bold("USAGE"))} ${cyan(`${commandName}${hasOptions ? " [OPTIONS]" : ""} ${usageLine.join(" ")}`)}`, "");
	if (posLines.length > 0) {
		usageLines.push(underline(bold("ARGUMENTS")), "");
		usageLines.push(formatLineColumns(posLines, "  "));
		usageLines.push("");
	}
	if (argLines.length > 0) {
		usageLines.push(underline(bold("OPTIONS")), "");
		usageLines.push(formatLineColumns(argLines, "  "));
		usageLines.push("");
	}
	if (commandsLines.length > 0) {
		usageLines.push(underline(bold("COMMANDS")), "");
		usageLines.push(formatLineColumns(commandsLines, "  "));
		usageLines.push("", `Use ${cyan(`${commandName} <command> --help`)} for more information about a command.`);
	}
	return usageLines.filter((l) => typeof l === "string").join("\n");
}
function renderValueHint(arg) {
	const valueHint = arg.valueHint ? `=<${arg.valueHint}>` : "";
	const fallbackValueHint = valueHint || `=<${snakeCase(arg.name)}>`;
	const repeat = arg.multiple ? "..." : "";
	if (!arg.type || arg.type === "positional" || arg.type === "boolean") return valueHint;
	if (arg.type === "enum" && arg.options?.length) return `=<${arg.options.join("|")}>${repeat}`;
	return fallbackValueHint + repeat;
}
function renderDescription(arg, required) {
	const requiredHint = required ? gray("(Required)") : "";
	const defaultHint = arg.default === void 0 ? "" : gray(`(Default: ${arg.default})`);
	return [
		arg.description,
		requiredHint,
		defaultHint
	].filter(Boolean).join(" ");
}
async function runMain(cmd, opts = {}) {
	const rawArgs = opts.rawArgs || process.argv.slice(2);
	const showUsage$1 = opts.showUsage || showUsage;
	try {
		const builtinFlags = await _resolveBuiltinFlags(cmd);
		if (builtinFlags.help.length > 0 && rawArgs.some((arg) => builtinFlags.help.includes(arg))) {
			await showUsage$1(...await resolveSubCommand(cmd, rawArgs));
			process.exit(0);
		} else if (rawArgs.length === 1 && builtinFlags.version.includes(rawArgs[0])) {
			const meta = typeof cmd.meta === "function" ? await cmd.meta() : await cmd.meta;
			if (!meta?.version) throw new CLIError("No version specified", "E_NO_VERSION");
			console.log(meta.version);
		} else await runCommand(cmd, { rawArgs });
	} catch (error) {
		if (error instanceof CLIError) {
			await showUsage$1(...await resolveSubCommand(cmd, rawArgs));
			console.error(error.message);
		} else console.error(error, "\n");
		process.exit(1);
	}
}
async function _resolveBuiltinFlags(cmd) {
	const argsDef = await resolveValue(cmd.args || {});
	const userNames = /* @__PURE__ */ new Set();
	const userAliases = /* @__PURE__ */ new Set();
	for (const [name, def] of Object.entries(argsDef)) {
		userNames.add(name);
		for (const alias of toArray(def.alias)) userAliases.add(alias);
	}
	return {
		help: _getBuiltinFlags("help", "h", userNames, userAliases),
		version: _getBuiltinFlags("version", "v", userNames, userAliases)
	};
}
function _getBuiltinFlags(long, short, userNames, userAliases) {
	if (userNames.has(long) || userAliases.has(long)) return [];
	if (userNames.has(short) || userAliases.has(short)) return [`--${long}`];
	return [`--${long}`, `-${short}`];
}
//#endregion
//#region package.json
var name = "@nuxt/cli";
var version = "4.0.1";
var description = "Nuxt CLI";
var engines = { "node": "^22.21.0 || ^24.11.0 || >=26.0.0" };
//#endregion
//#region src/commands/_shared.ts
const cwdArgs = { cwd: {
	type: "string",
	description: "Specify the root directory of your Nuxt project",
	valueHint: "directory",
	default: "."
} };
/**
* The root command's `--cwd`, forwarded to every subcommand so it can be passed
* before the command name.
*
* No default, unlike {@link cwdArgs}: commands taking a ROOTDIR positional treat an
* explicit `--cwd` as an override of it, and cannot tell the two apart if it is
* always set.
*/
const globalCwdArgs = { cwd: {
	...cwdArgs.cwd,
	default: void 0,
	inherit: true
} };
const logLevelArgs = { logLevel: {
	type: "string",
	description: "Specify build-time log level",
	valueHint: "silent|info|verbose"
} };
const envNameArgs = { envName: {
	type: "string",
	description: "The environment to use when resolving configuration overrides (default is `production` when building, and `development` when running the dev server)",
	valueHint: "environment"
} };
const dotEnvArgs = { dotenv: {
	type: "string",
	description: "Path to `.env` file to load, relative to the root directory. Can be repeated, with later files taking precedence.",
	valueHint: "path",
	multiple: true
} };
const extendsArgs = { extends: {
	type: "string",
	description: "Extend from a Nuxt layer",
	valueHint: "layer-name",
	alias: ["e"],
	multiple: true
} };
/**
* The deploy target within the configured server builder.
*
* `--preset` names the same thing for Nitro, the only builder with a target axis
* today, and keeps working for the many deployment guides that use it. It is a
* hidden option rather than an alias because citty renders a multi-character
* alias as `-preset` in help output.
*/
const targetArgs = {
	target: {
		type: "string",
		description: "Deploy target for the configured server builder (e.g. `node-server`, `vercel`, `netlify`)",
		valueHint: "target"
	},
	preset: {
		type: "string",
		description: "Alias for `--target`",
		valueHint: "target",
		hidden: true
	}
};
const profileArgs = { profile: {
	type: "string",
	description: "Profile performance, writing a V8 CPU profile and a JSON report on exit. Use `--profile=verbose` for a full console report.",
	default: void 0,
	valueHint: "verbose"
} };
/**
* `--cwd` is deliberately not declared here: commands taking a ROOTDIR positional
* inherit it from the root command (see {@link globalCwdArgs}) rather than listing
* it twice in their own help.
*/
const rootDirArgs = { rootDir: {
	type: "positional",
	description: "The root directory of your Nuxt project (default: .)",
	required: false,
	default: void 0
} };
const jsonArgs = { json: {
	type: "boolean",
	description: "Print output as JSON"
} };
//#endregion
export { runCommand as _, globalCwdArgs as a, profileArgs as c, description as d, engines as f, renderUsage as g, defineCommand as h, extendsArgs as i, rootDirArgs as l, version as m, dotEnvArgs as n, jsonArgs as o, name as p, envNameArgs as r, logLevelArgs as s, cwdArgs as t, targetArgs as u, runMain as v };
