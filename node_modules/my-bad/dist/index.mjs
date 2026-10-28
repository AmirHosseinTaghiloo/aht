import { i as isFilePath, n as displayPath, s as relativeToCwd } from "./path-BUhlDN52.mjs";
import { _ as mapPosition, a as renderOverlay, c as groupFrames, d as stringifyValue, h as parseInlineSourceMap, i as injectOverlay, l as groupSummary, m as fsLoader, n as resolveOptions, o as renderPage, p as clampMessage, r as clientAssets, s as stripAnsi, t as createReport, u as snippetTokens, v as sourceMapLoader } from "./create-BctpUY7p.mjs";
import process from "node:process";
import { hyperlink, link, supportsHyperlinks } from "clickable-path";
import { styleText } from "node:util";
//#region src/loaders/index.ts
/** Reads sources from disk without mapping, for processes started with `--enable-source-maps`. */
function passthroughLoader() {
	return {
		...fsLoader({
			sidecar: false,
			inline: false
		}),
		name: "passthrough"
	};
}
//#endregion
//#region src/render/ansi/style.ts
function detectAnsiEnv(stream = process.stderr) {
	const env = process.env;
	let colors;
	if (env.NO_COLOR !== void 0 && env.NO_COLOR !== "") colors = false;
	else if (env.FORCE_COLOR !== void 0) colors = env.FORCE_COLOR !== "0" && env.FORCE_COLOR !== "false";
	else colors = !!stream.isTTY && env.TERM !== "dumb";
	return {
		colors,
		hyperlinks: colors && supportsHyperlinks(stream)
	};
}
const STYLES = [
	"red",
	"yellow",
	"green",
	"cyan",
	"blue",
	"magenta",
	"dim",
	"bold",
	"underline"
];
const identity = (text) => text;
function createPalette(env) {
	const palette = {};
	for (const style of STYLES) palette[style] = env.colors ? (text) => styleText(style, text, { validateStream: false }) : identity;
	return palette;
}
function visibleWidth(text) {
	return stripAnsi(text).length;
}
/** Truncate the middle of a string to fit within `max` visible characters. */
function truncateMiddle(text, max) {
	if (text.length <= max || max < 5) return text;
	const keep = max - 1;
	const head = Math.ceil(keep / 2);
	const tail = Math.floor(keep / 2);
	return `${text.slice(0, head)}…${text.slice(text.length - tail)}`;
}
function wrap(text, width, indent = "") {
	const out = [];
	for (const paragraph of text.split("\n")) {
		let line = "";
		for (const word of paragraph.split(" ")) if (line && visibleWidth(line) + 1 + word.length > width) {
			out.push(line);
			line = indent + word;
		} else line = line ? `${line} ${word}` : word;
		out.push(line);
	}
	return out;
}
//#endregion
//#region src/render/ansi/index.ts
function renderAnsi(report, options = {}) {
	const env = detectAnsiEnv();
	const hyperlinks = options.hyperlinks ?? env.hyperlinks;
	return renderReport(report, {
		p: createPalette({
			colors: options.colors ?? env.colors,
			hyperlinks
		}),
		hyperlinks,
		cwd: options.cwd ?? process.cwd(),
		width: Math.max(40, options.width ?? process.stderr.columns ?? 80),
		verbose: options.verbose ?? false,
		snippetContext: options.snippetContext ?? 2,
		icon: options.icon ?? true,
		maxMessageLength: options.maxMessageLength ?? 1e3
	}, 0).join("\n");
}
function renderReport(report, ctx, depth) {
	const { p } = ctx;
	const out = [];
	const indent = "  ".repeat(depth);
	const width = ctx.width - indent.length;
	const icon = report.kind === "warning" ? p.yellow("⚠") : p.red("✖");
	const name = report.kind === "warning" ? p.yellow(p.bold(report.name)) : p.red(p.bold(report.name));
	const meta = [report.code !== report.name && report.code && p.dim(`[${report.code}]`), report.status && p.dim(`(${report.status})`)].filter(Boolean).join(" ");
	const title = `${depth === 0 ? ctx.icon ? `${icon} ${name}` : name : `${p.dim("Caused by:")} ${name}`}${meta ? ` ${meta}` : ""}${p.dim(":")} `;
	const { head, rest } = clampMessage(report.message, ctx.maxMessageLength);
	const messageLines = wrap(rest ? `${head}…` : head, width - 2, "");
	out.push(`${indent}${title}${p.bold(messageLines[0] ?? "")}`);
	for (const line of messageLines.slice(1)) out.push(`${indent}  ${p.bold(line)}`);
	if (rest) out.push(`${indent}  ${p.dim(`${rest.length} more characters`)}`);
	if (report.hint) {
		out.push("");
		for (const [index, line] of wrap(report.hint, width - 4).entries()) out.push(`${indent}  ${index === 0 ? p.cyan("ℹ") : " "} ${line}`);
	}
	if (report.docsUrl) out.push(`${indent}  ${p.dim("→")} ${hyperlink(p.underline(p.cyan(report.docsUrl)), report.docsUrl, { enabled: ctx.hyperlinks })}`);
	if (report.trace?.length) {
		out.push("");
		const crumbs = report.trace.map((entry) => entry.label).join(p.dim(" › "));
		out.push(`${indent}  ${truncateMiddle(crumbs, width - 2)}`);
	}
	const topApp = report.frames.find((frame) => frame.type === "app" && frame.snippet);
	if (topApp?.snippet && topApp.line !== void 0) {
		out.push("");
		out.push(...renderSnippet(topApp.snippet, topApp.line, topApp.column, ctx, `${indent}  `));
	} else {
		const generated = report.frames.find((frame) => frame.type === "app" && frame.compiled?.snippet && frame.compiled.line !== void 0)?.compiled;
		if (generated?.snippet && generated.line !== void 0) {
			out.push("", `${indent}  ${p.dim("generated code:")}`);
			out.push(...renderSnippet(generated.snippet, generated.line, generated.column, ctx, `${indent}  `));
		}
	}
	if (report.frames.length) {
		out.push("");
		out.push(...renderFrames(report.frames, ctx, `${indent}  `));
	}
	if (ctx.verbose && report.sections.length) for (const section of report.sections) {
		out.push("", `${indent}  ${p.bold(section.title)}`);
		if (typeof section.content === "string") for (const line of section.content.split("\n")) out.push(`${indent}    ${line}`);
		else for (const [key, value] of Object.entries(section.content)) out.push(`${indent}    ${p.dim(key)} ${stringifyValue(value)}`);
	}
	for (const cause of visibleCauses(report)) {
		out.push("");
		out.push(...renderReport(cause, ctx, depth + 1));
	}
	if (report.errors?.length) for (const [index, nested] of report.errors.entries()) {
		out.push("", `${indent}  ${p.dim(`[${index + 1}/${report.errors.length}]`)}`);
		out.push(...renderReport(nested, ctx, depth + 1));
	}
	if (report.omittedErrors) out.push("", `${indent}  ${p.dim(`… and ${report.omittedErrors} more`)}`);
	return out;
}
/** Skip a cause that only repeats its parent's message, keeping whatever it wraps. */
function visibleCauses(report) {
	return report.causes.flatMap((cause) => cause.message === report.message && !cause.errors?.length && !cause.omittedErrors ? visibleCauses(cause) : [cause]);
}
function renderFrames(frames, ctx, indent) {
	const { p } = ctx;
	const out = [];
	for (const entry of groupFrames(frames)) if ("app" in entry) out.push(renderFrame(entry.app, ctx, indent, false));
	else if (ctx.verbose) out.push(...entry.group.map(({ frame }) => renderFrame(frame, ctx, indent, true)));
	else out.push(`${indent}${p.dim(`… ${groupSummary(entry.group.map(({ frame }) => frame))}`)}`);
	return out;
}
function renderFrame(frame, ctx, indent, dim) {
	const { p } = ctx;
	const prefix = [frame.isAsync && "async", frame.isConstructor && "new"].filter(Boolean).join(" ");
	const fn = frame.function ?? (frame.isEval ? "eval" : "<anonymous>");
	const generated = frame.line === void 0 && frame.compiled?.line !== void 0 ? frame.compiled : void 0;
	const location = frame.file ? `${displayPath(frame, ctx.cwd)}${frame.line !== void 0 ? `:${frame.line}${frame.column !== void 0 ? `:${frame.column}` : ""}` : ""}` : frame.raw?.trim().replace(/^at\s+/, "") ?? "";
	const available = ctx.width - indent.length - 4 - fn.length - (prefix ? prefix.length + 1 : 0);
	const shown = truncateMiddle(location, Math.max(20, available));
	const linked = frame.file && isFilePath(frame.file) ? link(frame.file, {
		cwd: ctx.cwd,
		line: frame.line,
		column: frame.column,
		enabled: ctx.hyperlinks,
		formatter: () => shown
	}) : shown;
	const note = generated ? ` ${p.dim(`(generated ${generated.line}${generated.column !== void 0 ? `:${generated.column}` : ""})`)}` : "";
	const text = `${p.dim("at")} ${prefix ? `${p.dim(prefix)} ` : ""}${dim ? fn : p.bold(fn)} ${dim ? linked : p.cyan(linked)}${note}`;
	return `${indent}${dim ? p.dim(text) : text}`;
}
function renderSnippet(snippet, line, column, ctx, indent) {
	const { p } = ctx;
	const out = [];
	const first = Math.max(snippet.start, line - ctx.snippetContext);
	const last = Math.min(snippet.start + snippet.lines.length - 1, line + ctx.snippetContext);
	const gutter = String(last).length;
	const codeWidth = ctx.width - indent.length - gutter - 5;
	for (let n = first; n <= last; n++) {
		const raw = snippet.lines[n - snippet.start] ?? "";
		const code = raw.length > codeWidth ? `${raw.slice(0, codeWidth - 1)}…` : n === line ? colorTokens(snippet, n - snippet.start, p) : raw;
		const number = String(n).padStart(gutter);
		if (n === line) {
			out.push(`${indent}${p.red("›")} ${p.red(p.bold(number))} ${p.dim("│")} ${code}`);
			const shown = column === void 0 ? void 0 : column - (snippet.offset ?? 0);
			if (shown !== void 0 && shown > 0 && shown <= codeWidth) out.push(`${indent}  ${" ".repeat(gutter)} ${p.dim("│")} ${" ".repeat(shown - 1)}${p.red("^")}`);
		} else out.push(`${indent}  ${p.dim(number)} ${p.dim("│")} ${p.dim(code)}`);
	}
	return out;
}
function colorTokens(snippet, index, p) {
	return snippetTokens(snippet, index).map((token) => {
		switch (token.type) {
			case "keyword": return p.magenta(token.text);
			case "string": return p.green(token.text);
			case "number":
			case "attribute": return p.yellow(token.text);
			case "comment": return p.dim(token.text);
			case "function":
			case "variable": return p.blue(token.text);
			case "type": return p.yellow(token.text);
			case "tag": return p.red(token.text);
			default: return token.text;
		}
	}).join("");
}
//#endregion
//#region src/report/markdown.ts
/** Render a report as Markdown suitable for a GitHub issue or an agent prompt. */
function toMarkdown(report, options = {}) {
	return render(report, options, 2).join("\n");
}
function render(report, options, level) {
	const h = "#".repeat(Math.min(level, 6));
	const out = [];
	const label = report.kind === "warning" ? "Warning" : report.kind === "compile" ? "Compile error" : "Error";
	out.push(`${h} ${label}: ${report.name}${report.code && report.code !== report.name ? ` [${report.code}]` : ""}`, "");
	out.push("```", report.message, "```", "");
	if (report.hint) out.push(`> ${report.hint}`, "");
	if (report.docsUrl) out.push(`Docs: ${report.docsUrl}`, "");
	if (report.trace?.length) out.push(`Component trace: ${report.trace.map((entry) => `\`${entry.label}\``).join(" › ")}`, "");
	const top = report.frames.find((frame) => frame.type === "app" && frame.snippet);
	if (top?.snippet && top.file) {
		out.push(`\`${loc(top, options)}\``, "");
		out.push(...snippetBlock(top.snippet, top.line));
	} else {
		const generated = report.frames.find((frame) => frame.type === "app" && frame.compiled?.snippet)?.compiled;
		if (generated?.snippet) {
			out.push(`Generated code \`${loc(generated, options)}\``, "");
			out.push(...snippetBlock(generated.snippet, generated.line));
		}
	}
	if (report.frames.length) {
		out.push("```");
		let hidden = 0;
		for (const frame of report.frames) {
			if (frame.type !== "app" && !options.allFrames) {
				hidden++;
				continue;
			}
			if (hidden) {
				out.push(`    ... ${hidden} more`);
				hidden = 0;
			}
			out.push(`    at ${[
				frame.isAsync && "async",
				frame.isConstructor && "new",
				frame.function ?? "<anonymous>"
			].filter(Boolean).join(" ")} (${loc(frame, options)})`);
		}
		if (hidden) out.push(`    ... ${hidden} more`);
		out.push("```", "");
	}
	for (const section of report.sections) {
		if (section.id === "headers") continue;
		out.push(`**${section.title}**`, "");
		if (typeof section.content === "string") out.push("```", section.content, "```", "");
		else {
			for (const [key, value] of Object.entries(section.content)) out.push(`- ${key}: \`${stringifyValue(value)}\``);
			out.push("");
		}
	}
	for (const cause of report.causes) out.push(...render({
		...cause,
		name: `Caused by ${cause.name}`
	}, options, level + 1));
	for (const nested of report.errors ?? []) out.push(...render(nested, options, level + 1));
	return out;
}
function snippetBlock(snippet, line) {
	const out = [`\`\`\`${snippet.lang ?? ""}`];
	for (const [index, text] of snippet.lines.entries()) {
		const n = snippet.start + index;
		out.push(`${n === line ? ">" : " "} ${String(n).padStart(String(snippet.start + snippet.lines.length).length)} | ${text}`);
	}
	out.push("```", "");
	return out;
}
function loc(frame, options) {
	return `${frame.file ? options.cwd ? relativeToCwd(frame.file, options.cwd) : frame.file : frame.raw?.trim() ?? "<anonymous>"}${frame.line !== void 0 ? `:${frame.line}` : ""}${frame.column !== void 0 ? `:${frame.column}` : ""}`;
}
//#endregion
//#region src/report/serialize.ts
/** Produce a copy of the report with paths relative to `cwd`, suitable for JSON responses. */
function serializeReport(report, options = {}) {
	const { cwd, snippets = true } = options;
	const frame = (f) => ({
		...f,
		...cwd && f.file && { file: relativeToCwd(f.file, cwd) },
		...cwd && f.compiled && { compiled: {
			...f.compiled,
			file: relativeToCwd(f.compiled.file, cwd)
		} },
		...!snippets && { snippet: void 0 }
	});
	return {
		...report,
		frames: report.frames.map(frame),
		causes: report.causes.map((cause) => serializeReport(cause, options)),
		...report.errors && { errors: report.errors.map((error) => serializeReport(error, options)) },
		...report.trace && cwd && { trace: report.trace.map((entry) => entry.file ? {
			...entry,
			file: relativeToCwd(entry.file, cwd)
		} : entry) }
	};
}
//#endregion
export { clientAssets, createReport, fsLoader, injectOverlay, mapPosition, parseInlineSourceMap, passthroughLoader, renderAnsi, renderOverlay, renderPage, resolveOptions, serializeReport, sourceMapLoader, toMarkdown };
