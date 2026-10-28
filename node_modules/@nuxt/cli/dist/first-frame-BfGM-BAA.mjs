import { t as __exportAll } from "./rolldown-runtime-D7D4PA-g.mjs";
import { i as paint$1, n as MUTED, o as resolveBackground, r as colour, t as BRAND_GREEN } from "./terminal-theme-BUtyan0v.mjs";
import { a as terminalLink, n as formatDuration, o as truncate, s as visibleWidth, t as decapitalise } from "./formatting-Co5DEjad.mjs";
import { t as getNuxtPkgVersion } from "./pkg-CInP2k7X.mjs";
import { r as supportsUnicode, t as resolveDevUISupport } from "./support-Dvae58g8.mjs";
import process from "node:process";
import { styleText } from "node:util";
import { Buffer } from "node:buffer";
//#region src/dev/tui/logo.ts
/** The mark, as four independently coloured cells. */
const PIXELS = [
	"⣠",
	"⣦",
	"⣠",
	"⡀"
];
/** Clears 3:1 against either background, so it needs no light variant. */
const MAGENTA = [
	200,
	90,
	200
];
const BACKDROP = {
	dark: [
		0,
		0,
		0
	],
	light: [
		255,
		255,
		255
	]
};
/** How much of the colour is left in the cells the highlight is not on. */
const DIM = .35;
/**
* The Nuxt mark, drawn as four braille cells that double as status lights.
*
* The glyphs never change, so the mark cannot appear to resize; only their
* colours move.
*/
function renderLogo(state = {}) {
	const highlight = state.working ? Math.abs(state.frame ?? 0) % PIXELS.length : -1;
	const background = state.background ?? resolveBackground();
	return PIXELS.map((pixel, index) => {
		return paint(pixel, state.active && index === PIXELS.length - 1 ? "traffic" : "brand", highlight < 0 || index === highlight, background);
	}).join("");
}
function paint(glyph, tone, lit, background) {
	const known = background === "light" ? "light" : "dark";
	if (process.env.NO_COLOR) return glyph;
	const depth = process.stdout.getColorDepth?.() ?? 1;
	if (background === "unknown" || depth < 8) return styleText(lit ? named(tone) : [named(tone), "dim"], glyph);
	const exact = tone === "traffic" ? MAGENTA : BRAND_GREEN[known];
	const shade = lit ? exact : blend(exact, BACKDROP[known], DIM);
	return `${colour(shade, depth)}${glyph}\u001B[39m`;
}
function named(tone) {
	return tone === "traffic" ? "magenta" : "green";
}
/** Fade `colour` towards `backdrop`, which is what dimming means on either background. */
function blend(colour, backdrop, amount) {
	return colour.map((channel, index) => Math.round(backdrop[index] + (channel - backdrop[index]) * amount));
}
//#endregion
//#region src/dev/tui/panel.ts
const URL_STYLES = {
	local: "cyan",
	network: "magenta",
	tunnel: "cyan",
	public: "magenta"
};
const URL_LABELS = {
	local: "Local",
	network: "Network",
	tunnel: "Tunnel",
	public: "Public"
};
/** Listener URLs as panel entries, shared with the pre-ready pending block. */
function describeListenURLs(urls, options = {}) {
	return urls.map(({ type, url }) => ({
		label: URL_LABELS[type] ?? type,
		url,
		link: terminalLink(url, url),
		style: URL_STYLES[type],
		pending: options.pending
	}));
}
/**
* The hint line as it reads before the controller is attached, painted dimmed
* from the first frame so the panel never gains a line partway through
* startup. Replaced by the live set derived from the controller's shortcuts.
*/
const DEFAULT_HINTS = [
	{
		key: "r",
		label: "restart",
		priority: 80
	},
	{
		key: "o",
		label: "open",
		priority: 40
	},
	{
		key: "i",
		label: "info",
		priority: 50
	},
	{
		key: "l",
		label: "logs",
		priority: 70
	},
	{
		key: "n",
		label: "network",
		priority: 60
	},
	{
		key: "p",
		label: "routes",
		priority: 30
	},
	{
		key: "?",
		label: "help",
		priority: 100
	},
	{
		key: "q",
		label: "quit",
		priority: 90
	}
];
const BADGES = {
	starting: {
		label: "STARTING",
		style: [
			"bgYellow",
			"black",
			"bold"
		],
		note: "preparing your app"
	},
	building: {
		label: "BUILDING",
		style: [
			"bgYellow",
			"black",
			"bold"
		],
		note: "compiling changes"
	},
	restarting: {
		label: "RESTART",
		style: [
			"bgYellow",
			"black",
			"bold"
		],
		note: "reloading the dev server"
	},
	error: {
		label: "ERROR",
		style: [
			"bgRed",
			"white",
			"bold"
		],
		note: "an error was logged · press e to view it"
	},
	warming: {
		label: "WARMUP",
		style: [
			"bgYellow",
			"black",
			"bold"
		],
		note: "compiling the first request"
	},
	ready: {
		label: "READY",
		style: [
			"bgGreen",
			"black",
			"bold"
		],
		note: "watching for changes"
	}
};
const SEPARATOR = styleText(MUTED, " · ");
/** Blocks are dropped from the least important until the panel fits. */
const BLOCK_PRIORITY = [
	"hints",
	"status",
	"wordmark",
	"urls",
	"summary",
	"space"
];
/**
* The pinned dev server panel, as lines without a trailing newline.
*
* Pure, so it can be re-rendered on resize without touching terminal state.
* Content is assembled as blocks and the least important are dropped until the
* result fits `rows`, so the same layout serves a full screen and a split pane.
*/
function renderPanel(state, columns, rows = 24) {
	const width = Math.max(1, columns);
	const blocks = [
		{
			name: "wordmark",
			lines: [renderWordmark(state, width)]
		},
		{
			name: "space",
			lines: [""]
		},
		{
			name: "urls",
			lines: renderURLs(state, width)
		},
		{
			name: "space",
			lines: [""]
		},
		{
			name: "summary",
			lines: renderSummary(state, width)
		},
		{
			name: "space",
			lines: [""]
		},
		{
			name: "status",
			lines: [renderStatus(state, width)]
		},
		{
			name: "hints",
			lines: [renderHints(state, width)]
		}
	].filter((block) => block.lines.length > 0);
	const budget = Math.max(2, Math.min(rows - 1, 14));
	const dropped = /* @__PURE__ */ new Set();
	const layout = () => blocks.filter((block) => !dropped.has(block)).flatMap((block) => block.lines).filter((line, index, lines) => line !== "" || index > 0 && index < lines.length - 1 && lines[index - 1] !== "");
	for (const name of BLOCK_PRIORITY.toReversed()) {
		if (layout().length <= budget) break;
		for (const block of blocks) if (block.name === name) dropped.add(block);
	}
	return layout();
}
function renderWordmark(state, columns) {
	const mark = state.ascii ? styleText("green", ">") : renderLogo({
		working: state.status !== "ready" && state.status !== "error",
		frame: state.frame,
		active: state.active,
		background: state.background
	});
	const version = state.versionLink ?? state.version;
	const head = ` ${mark}  ${paint$1("brand", styleText("bold", "Nuxt"), state.background)}${version ? ` ${styleText(MUTED, version)}` : ""}${state.update ? paint$1("warning", `  ${state.updateLink ?? `\u2192 ${state.update}`}`, state.background) : ""}`;
	const settled = state.status === "ready" || state.status === "warming";
	const tail = state.readyMs === void 0 || !settled ? "" : styleText(MUTED, `ready in ${formatDuration(state.readyMs)} `);
	const gap = columns - visibleWidth(head) - visibleWidth(tail);
	return gap < 2 ? truncate(head, columns) : head + " ".repeat(gap) + tail;
}
/** The spinner shown next to a URL that is bound but not yet confirmed. */
const SPINNER_FRAMES = [
	"⠋",
	"⠙",
	"⠹",
	"⠸",
	"⠼",
	"⠴",
	"⠦",
	"⠧",
	"⠇",
	"⠏"
];
function renderURLs(state, columns) {
	const urls = state.urls?.filter((entry) => !!entry.url) ?? [];
	if (!urls.length) return [];
	const width = Math.max(...urls.map((entry) => entry.label.length));
	return urls.map(({ label, url, link, style, pending }) => {
		const spinner = pending ? ` ${paint$1("warning", state.ascii ? "~" : SPINNER_FRAMES[(state.frame ?? 0) % SPINNER_FRAMES.length], state.background)}` : "";
		return truncate(`   ${styleText(MUTED, label.padEnd(width))}   ${styleText(pending ? MUTED : style ?? "cyan", link ?? url)}${spinner}`, columns);
	});
}
const PROGRESS_BAR_WIDTH = 20;
const TASK_FRAMES = [
	"⠋",
	"⠙",
	"⠹",
	"⠸",
	"⠼",
	"⠴",
	"⠦",
	"⠧",
	"⠇",
	"⠏"
];
const TASK_FRAMES_ASCII = [
	"|",
	"/",
	"-",
	"\\"
];
/** How long a phase runs before its own elapsed time is worth a mention. */
const PHASE_ELAPSED_THRESHOLD = 2500;
/**
* How long a render runs before its own clock is worth showing. Lower than a
* phase's, because a render is only reported once it has already been in flight
* long enough to notice, and the clock is the only thing that moves.
*/
const RENDER_ELAPSED_THRESHOLD = 1e3;
function renderProgress(state, columns) {
	const fraction = Math.min(1, Math.max(0, state.progress ?? 0));
	const filled = Math.round(fraction * PROGRESS_BAR_WIDTH);
	const glyph = state.ascii ? "=" : "━";
	const bar = styleText("green", glyph.repeat(filled)) + styleText(MUTED, glyph.repeat(PROGRESS_BAR_WIDTH - filled));
	const elapsed = state.elapsedMs === void 0 ? "" : `${SEPARATOR}${styleText(MUTED, formatDuration(state.elapsedMs))}`;
	return truncate(`   ${bar} ${styleText(MUTED, `${Math.round(fraction * 100)}%`)}${elapsed}`, columns);
}
function renderSummary(state, columns) {
	const marks = state.ascii ? {
		ok: "+",
		warn: "!",
		fail: "x"
	} : {
		ok: "✔",
		warn: "⚠",
		fail: "✖"
	};
	if (state.status !== "ready" && state.status !== "error" && state.progress !== void 0) return [renderProgress(state, columns)];
	if (state.task) {
		const glyph = state.ascii ? TASK_FRAMES_ASCII : TASK_FRAMES;
		const mark = glyph[(state.frame ?? 0) % glyph.length];
		const elapsed = styleText(MUTED, formatDuration(Date.now() - state.task.startedAt));
		return [truncate(`   ${styleText("cyan", mark)} ${decapitalise(state.task.label)}${SEPARATOR}${elapsed}`, columns)];
	}
	const parts = [];
	if (state.requests) parts.push(styleText("green", `${marks.ok} ${state.requests} ${plural(state.requests, "request")}`));
	if (state.medianMs !== void 0 && state.requests) parts.push(styleText(MUTED, `${state.medianMs}ms median`));
	if (state.warnings) parts.push(paint$1("warning", `${marks.warn} ${state.warnings} ${plural(state.warnings, "warning")}`, state.background));
	if (state.errors) parts.push(styleText(["red", "bold"], `${marks.fail} ${state.errors} ${plural(state.errors, "error")}`));
	if (state.failures) parts.push(styleText(["red", "bold"], `${marks.fail} ${state.failures} failed ${plural(state.failures, "request")}`));
	if (!parts.length) return [truncate(`   ${styleText(MUTED, "waiting for requests")}`, columns)];
	return [truncate(`   ${parts.join(styleText(MUTED, "   "))}`, columns)];
}
/**
* Status notes read as small lowercase phrases, but several arrive as
* sentences ("Restarting Nuxt...", the progress phases). Only a leading
* capital followed by lowercase is folded, so acronyms survive.
*/
const NOTICE_TONES = {
	info: {
		mark: {
			unicode: "ℹ",
			ascii: "i"
		},
		paint: (glyph) => styleText("cyan", glyph)
	},
	warn: {
		mark: {
			unicode: "⚠",
			ascii: "!"
		},
		paint: (glyph, background) => paint$1("warning", glyph, background)
	},
	success: {
		mark: {
			unicode: "✔",
			ascii: "+"
		},
		paint: (glyph) => styleText("green", glyph)
	}
};
/** Passing feedback, in place of the badge's standing description. */
function renderNotice(state) {
	const tone = NOTICE_TONES[state.notice.tone];
	const glyph = state.ascii ? tone.mark.ascii : tone.mark.unicode;
	return `${tone.paint(glyph, state.background)} ${styleText(MUTED, decapitalise(state.notice.text))}`;
}
function renderStatus(state, columns) {
	if (state.notice?.label) return truncate(` ${styleText([
		"bgYellow",
		"black",
		"bold"
	], ` ${state.notice.label} `)}  ${styleText(MUTED, decapitalise(state.notice.text))}`, columns);
	const rendering = state.status === "ready" || state.status === "warming" ? state.rendering : void 0;
	const badge = rendering && state.awaitingFirstRender ? BADGES.warming : BADGES[state.status];
	const description = state.notice ? renderNotice(state) : rendering ? styleText(MUTED, `rendering ${rendering.label}${renderRenderElapsed(state)}`) : styleText(MUTED, decapitalise(state.note || badge.note) + renderPhaseElapsed(state));
	const head = ` ${styleText(badge.style, ` ${badge.label} `)}  ${description}`;
	return truncate(head + (rendering ? "" : renderTicker(state, columns - visibleWidth(head))), columns);
}
/**
* How long the render in flight has taken. The only thing that moves on a panel
* whose server is up and waiting on a page, so it is what says the wait is
* progressing rather than stuck.
*/
function renderRenderElapsed(state) {
	if (state.renderingMs === void 0 || state.renderingMs < RENDER_ELAPSED_THRESHOLD) return "";
	return ` \u00B7 ${formatDuration(state.renderingMs)}`;
}
/**
* How long the current phase has been running, appended to its own note. A
* phase can hold a startup for most of its length, and the number is what says
* the label is still making progress rather than stuck.
*/
function renderPhaseElapsed(state) {
	if (!state.note || state.phaseElapsedMs === void 0 || state.phaseElapsedMs < PHASE_ELAPSED_THRESHOLD) return "";
	return ` \u00B7 ${formatDuration(state.phaseElapsedMs)}`;
}
/**
* The most recent request, appended to the status line. Returns nothing until
* a request arrives, or when there is no room left on the line.
*/
function renderTicker(state, room) {
	const request = state.lastRequest;
	if (!request) return "";
	const head = `${SEPARATOR}${styleText("bold", request.method)} `;
	const tail = `${SEPARATOR}${paintStatus(request.status, void 0, state.background)}${SEPARATOR}${styleText(MUTED, formatDuration(request.duration))}`;
	const available = room - visibleWidth(head) - visibleWidth(tail);
	if (available < 8) return "";
	return `${head}${truncate(request.url, available)}${tail}`;
}
/**
* Join the hints into one line that never wraps.
*
* The least important are dropped until the line fits. Once nothing else can
* go, only help is left: the rest of the keys are listed there anyway.
*/
function renderHints(state, columns) {
	const remaining = [...state.errors ? [{
		key: "e",
		label: "last error",
		priority: Number.POSITIVE_INFINITY
	}] : [], ...state.hints ?? []];
	const render = (items) => ` ${items.map(({ key, label, armed }) => armed ? `${paint$1("brand", key, state.background)} ${paint$1("brand", label, state.background)}` : `${styleText(state.hintsDimmed ? MUTED : "bold", key)} ${styleText(MUTED, label)}`).join(SEPARATOR)}`;
	while (remaining.length > 1 && visibleWidth(render(remaining)) > columns) {
		const weakest = remaining.reduce((lowest, item) => item.priority < lowest.priority ? item : lowest);
		remaining.splice(remaining.indexOf(weakest), 1);
	}
	return truncate(render(remaining), columns);
}
/** A response status in its own colour, shared by the ticker and the traffic view. */
function paintStatus(status, text = String(status), background) {
	if (status >= 400 && status < 500) return paint$1("warning", text, background);
	return styleText(status >= 500 ? "red" : status >= 300 ? "cyan" : "green", text);
}
function plural(count, word) {
	return count === 1 ? word : `${word}s`;
}
//#endregion
//#region src/dev/tui/surface.ts
/** How long after the last resize event a drag is taken to be over. */
const RESIZE_SETTLE_MS = 120;
const PENDING_CHUNK_LIMIT = 2e3;
/**
* Keeps a block of lines pinned below normal terminal output.
*
* Scrollback stays native: whatever is allowed through is genuinely written to
* the main buffer. Before each chunk the panel is erased, and a coalesced
* repaint puts it back once the burst of writes settles.
*
* The two axes are independent, which is the shape OpenTUI (MIT) arrived at for
* the same problem in its `CliRenderer`: {@link screenMode} says who owns the
* terminal, {@link externalOutput} says where everyone else's output goes.
* https://github.com/anomalyco/opentui
*/
var PanelSurface = class {
	#lines = [];
	#painted = 0;
	/**
	* Whether the cursor sits at the start of a line, so the panel can attach
	* itself without a separator. An erase leaves it there; output that stops
	* mid-line does not.
	*/
	#atLineStart = true;
	#restore = [];
	#raw;
	#closed = false;
	#screen = "split-footer";
	#suspended = false;
	#externalOutput = "passthrough";
	#sink;
	#pending = [];
	#rowsWritten = 0;
	#rows = process.stdout.rows || 24;
	#columns = process.stdout.columns || 80;
	#onResize = () => {
		const rows = process.stdout.rows || 24;
		const columns = process.stdout.columns || 80;
		const grew = rows > this.#rows;
		const rewrapped = columns !== this.#columns;
		this.#rows = rows;
		this.#columns = columns;
		if (this.#screen === "alternate-screen") {
			this.#resizedWhileHidden = true;
			this.#rewrappedWhileHidden ||= rewrapped;
			this.#resized?.();
			return;
		}
		this.#erase();
		this.#resized?.();
		if (grew) this.padToBottom();
		if (rewrapped) this.#scheduleRecovery();
	};
	#resizedWhileHidden = false;
	#rewrappedWhileHidden = false;
	#recoverTimer;
	/** Paint against the last row rather than wherever the cursor is. */
	#reseat = false;
	#resized;
	constructor(options = {}) {
		this.#resized = options.onResize;
		const stdout = process.stdout;
		this.#raw = (stdout.__write ?? stdout.write).bind(stdout);
		for (const stream of [process.stdout, process.stderr]) this.#guard(stream);
		process.stdout.on("resize", this.#onResize);
		this.#restore.push(() => process.stdout.off("resize", this.#onResize));
	}
	/** Repaint through this callback whenever the terminal is resized. */
	onResize(listener) {
		this.#resized = listener;
	}
	/** Hand the terminal to a full-screen view, or take it back. */
	get screenMode() {
		return this.#screen;
	}
	set screenMode(mode) {
		if (mode === this.#screen || this.#closed) return;
		this.#screen = mode;
		if (mode === "alternate-screen") {
			this.#erase();
			return;
		}
		this.#flush();
		const resized = this.#resizedWhileHidden;
		const rewrapped = this.#rewrappedWhileHidden;
		this.#resizedWhileHidden = false;
		this.#rewrappedWhileHidden = false;
		if (rewrapped) this.#recover();
		else if (resized) this.padToBottom();
		else this.#paint();
	}
	/**
	* Where output the panel did not write goes: to the terminal above the panel,
	* or to the sink given to {@link onExternalOutput}, which is how the panel can
	* stand alone with the log stream folded away behind it.
	*/
	get externalOutput() {
		return this.#externalOutput;
	}
	set externalOutput(mode) {
		this.#externalOutput = mode;
	}
	/** Receive output instead of the terminal while capturing. */
	onExternalOutput(sink) {
		this.#sink = sink;
	}
	/**
	* Hand the terminal to something that draws its own frames, such as a
	* prompt, and take it back when the returned function is called.
	*
	* The panel is erased and painted no more until then: it redraws itself from
	* the bottom up, so a repaint between two of the frames a prompt writes would
	* land in the middle of the question. Output still goes to the terminal, in
	* the order it was written.
	*/
	suspend() {
		if (this.#closed || this.#suspended) return () => {};
		this.#suspended = true;
		this.#erase();
		let resumed = false;
		return () => {
			if (resumed) return;
			resumed = true;
			this.#suspended = false;
			this.#paint();
		};
	}
	/** Replace the panel content and repaint whatever changed. */
	render(lines) {
		const unchanged = this.#painted === lines.length && lines.every((line, index) => line === this.#lines[index]);
		this.#lines = lines;
		if (this.#closed || this.#screen === "alternate-screen" || unchanged) return;
		this.#paint(this.#eraseSequence());
	}
	/** Paint `lines` already resting on the last row, in one write. */
	renderAtBottom(lines) {
		this.#lines = lines;
		this.padToBottom();
	}
	/**
	* Fill the screen so the panel rests on the last row, otherwise it starts
	* just below the command and walks down the screen as output arrives.
	*
	* Rows already used are subtracted so a session that has printed nothing does
	* not push a whole screen of history out of view.
	*/
	padToBottom() {
		if (this.#closed || this.#suspended || this.#screen === "alternate-screen") return;
		const erase = this.#eraseSequence();
		const padding = (process.stdout.rows || 24) - this.#lines.length - this.#rowsWritten - 1;
		if (padding <= 0) {
			this.#paint(erase);
			return;
		}
		this.#rowsWritten += padding;
		this.#atLineStart = true;
		this.#paint(`${erase}${"\n".repeat(padding)}`);
	}
	#scheduleRecovery() {
		clearTimeout(this.#recoverTimer);
		this.#recoverTimer = setTimeout(() => {
			this.#recoverTimer = void 0;
			this.#recover();
		}, RESIZE_SETTLE_MS);
		this.#recoverTimer.unref?.();
	}
	/**
	* Scroll the screen into the scrollback and paint the panel on what is left.
	*
	* A terminal re-wraps the screen when its width changes, so afterwards
	* neither the rows the panel occupies nor the row the cursor is on follow
	* from what was painted, and there is nothing to erase against.
	*/
	#recover() {
		if (this.#closed || this.#suspended || this.#screen !== "split-footer" || !this.#lines.length) return;
		this.#painted = 0;
		this.#raw("\n".repeat(process.stdout.rows || 24));
		this.#atLineStart = true;
		this.#reseat = true;
		this.#paint();
	}
	/** Forget the rows counted so far, after the screen has been cleared. */
	resetRows() {
		this.#rowsWritten = 0;
	}
	/** Write straight to the terminal, bypassing interception and the queue. */
	writeRaw(chunk) {
		this.#raw(chunk);
	}
	/**
	* Put `text` into scrollback above the panel, whatever is capturing output.
	*
	* Written to the stream directly rather than through consola, whose deferred
	* write would be captured like any other output and surfaced twice. It always
	* ends a line, so the panel cannot end up sharing one with it.
	*/
	writeAbove(text) {
		const line = text.endsWith("\n") ? text : `${text}\n`;
		if (this.#closed) {
			this.#raw(line);
			return;
		}
		if (this.#screen === "alternate-screen") {
			this.#queue({
				text: line,
				scrollback: true
			});
			return;
		}
		this.#toScrollback(line);
	}
	/** Erase the panel and stop intercepting writes. Scrollback is untouched. */
	close(options = {}) {
		if (this.#closed) return;
		this.#externalOutput = "passthrough";
		this.#sink = void 0;
		this.#reseat = false;
		clearTimeout(this.#recoverTimer);
		this.#erase();
		this.#screen = "split-footer";
		this.#flush();
		if (options.keep && this.#lines.length) this.#raw(`${this.#lines.join("\n")}\n`);
		this.#closed = true;
		for (const restore of this.#restore) restore();
	}
	/**
	* Intercept the stream's bottom-most write. Where consola has wrapped the
	* stream, `__write` is the sink its reporter and `writeDirect` use, so
	* guarding that catches formatted logs without re-entering consola.
	*/
	#guard(stream) {
		const target = stream.__write ? "__write" : "write";
		const original = stream[target];
		const guarded = (chunk, encoding, callback) => {
			if (this.#closed) return original.call(stream, chunk, encoding, callback);
			if (this.#suspended) {
				this.#track(asText(chunk));
				return original.call(stream, chunk, encoding, callback);
			}
			if (this.#screen === "alternate-screen" || this.#externalOutput === "capture") {
				const text = asText(chunk);
				if (text !== void 0) this.#divert(text);
				const done = typeof encoding === "function" ? encoding : callback;
				if (typeof done === "function") done();
				return true;
			}
			this.#erase();
			this.#track(asText(chunk));
			const result = original.call(stream, chunk, encoding, callback);
			this.#paint();
			return result;
		};
		stream[target] = guarded;
		this.#restore.push(() => {
			if (stream[target] === guarded) stream[target] = original;
		});
	}
	/** Output the panel intercepted, held for a view or handed to the sink. */
	#divert(text) {
		if (this.#screen === "alternate-screen") {
			this.#queue({
				text,
				scrollback: false
			});
			return;
		}
		this.#sink?.(text);
	}
	#queue(output) {
		this.#pending.push(output);
		if (this.#pending.length > PENDING_CHUNK_LIMIT) this.#pending.shift();
	}
	/**
	* Deal with everything that arrived while a view owned the screen, as if the
	* view had never been open: intercepted output is folded away like any other,
	* and what was meant for scrollback lands there.
	*/
	#flush() {
		const pending = this.#pending;
		this.#pending = [];
		for (const { text, scrollback } of pending) {
			if (scrollback || !this.#sink || this.#externalOutput === "passthrough") {
				this.#toScrollback(text);
				continue;
			}
			this.#sink(text);
		}
	}
	#toScrollback(text) {
		const erase = this.#eraseSequence();
		this.#track(text);
		this.#paint(`${erase}${text}`);
	}
	#track(text) {
		if (!text) return;
		this.#rowsWritten += text.split("\n").length - 1;
		this.#atLineStart = text.endsWith("\n");
	}
	/** `before` is written in the same call, for callers making room first. */
	#paint(before = "") {
		if (!this.#lines.length || this.#closed || this.#suspended || this.#screen === "alternate-screen") {
			if (before) this.#raw(before);
			return;
		}
		let prefix = before;
		if (this.#reseat) {
			this.#reseat = false;
			const rows = process.stdout.rows || 24;
			this.#rowsWritten = Math.max(0, rows - this.#lines.length);
			prefix = `\u001B[${Math.max(1, rows - this.#lines.length + 1)};1H\u001B[J`;
			this.#atLineStart = true;
		}
		const leading = this.#atLineStart ? "" : "\n";
		this.#raw(`${prefix}${leading}${this.#lines.join("\n")}`);
		this.#painted = this.#lines.length;
	}
	#erase() {
		const sequence = this.#eraseSequence();
		if (sequence) this.#raw(sequence);
	}
	/**
	* The sequence that takes the painted rows off the screen, marking them gone.
	*
	* Returned rather than written so a repaint sends it with the rows that
	* replace it: two writes are two frames on a terminal that presents between.
	*/
	#eraseSequence() {
		if (!this.#painted) return "";
		const up = this.#painted - 1;
		this.#painted = 0;
		this.#atLineStart = true;
		return `\r${up > 0 ? `\u001B[${up}A` : ""}\u001B[J`;
	}
};
function asText(chunk) {
	if (typeof chunk === "string") return chunk;
	return chunk instanceof Uint8Array ? Buffer.from(chunk).toString() : void 0;
}
//#endregion
//#region src/dev/tui/first-frame.ts
var first_frame_exports = /* @__PURE__ */ __exportAll({
	createPanelState: () => createPanelState,
	paintFirstFrame: () => paintFirstFrame,
	renderPanelState: () => renderPanelState,
	resolveNuxtVersion: () => resolveNuxtVersion
});
function resolveNuxtVersion(options) {
	const cwd = options.cwd || process.cwd();
	return options.version || getNuxtPkgVersion(cwd) || void 0;
}
/** The panel as it looks before anything has been loaded. */
function createPanelState(options = {}) {
	return {
		status: "starting",
		version: resolveNuxtVersion(options),
		warnings: 0,
		errors: 0,
		ascii: !supportsUnicode(),
		background: resolveBackground(),
		loadStartedAt: options.startTime ?? Date.now(),
		elapsedMs: 0,
		progress: 0,
		hints: DEFAULT_HINTS,
		hintsDimmed: true
	};
}
function renderPanelState(surface, state) {
	surface.render(panelLines(state));
}
function panelLines(state) {
	return renderPanel(state, process.stdout.columns || 80, process.stdout.rows || 24);
}
/**
* Put the panel on screen before the session that drives it exists.
*
* Log capture, the event log and the progress feed all cost more to load than
* the frame, and none of them has anything to show yet.
*/
function paintFirstFrame(options = {}) {
	if (!resolveDevUISupport(options).enabled) return;
	const state = createPanelState(options);
	const surface = new PanelSurface();
	surface.onResize(() => renderPanelState(surface, state));
	surface.renderAtBottom(panelLines(state));
	return {
		surface,
		state
	};
}
//#endregion
export { PanelSurface as a, describeListenURLs as c, resolveNuxtVersion as i, paintStatus as l, first_frame_exports as n, URL_LABELS as o, renderPanelState as r, URL_STYLES as s, createPanelState as t };
