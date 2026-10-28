import { a as registerTerminalHost, t as startupElapsedMs } from "./startup-clock-DXZlxuSA.mjs";
import { c as withDirectStdout, r as guardReplayedInput } from "./console-BgmzEcbV.mjs";
import { i as paint, n as MUTED } from "./terminal-theme-BUtyan0v.mjs";
import { a as terminalLink, i as stripAnsi, n as formatDuration, o as truncate, s as visibleWidth } from "./formatting-Co5DEjad.mjs";
import { n as resolveStackVersions } from "./banner-lMLtjrKS.mjs";
import { d as writeClipboard, o as openBrowser } from "./listen-BjyzPJ2X.mjs";
import { i as isShutdownAdopted } from "./shutdown-BavsC3O_.mjs";
import { NOOP_CONTROLLER } from "./controller-jGDcJtoA.mjs";
import { setupShortcuts } from "./shortcuts-Dh7e3ttO.mjs";
import { c as describeListenURLs, l as paintStatus, o as URL_LABELS, s as URL_STYLES } from "./first-frame-BfGM-BAA.mjs";
import { t as releaseNotesUrl } from "./release-notes-BQieF1F4.mjs";
import { beginDevUI, n as isBoxedNotice, r as normaliseMessage, t as whenStdinReleased } from "./session-DCdLW1mF.mjs";
import { relative } from "node:path";
import process from "node:process";
import { promisify, styleText } from "node:util";
import { AsyncLocalStorage } from "node:async_hooks";
import { link } from "clickable-path";
import { Buffer } from "node:buffer";
import { execFile } from "node:child_process";
import { emitKeypressEvents } from "node:readline";
//#region src/dev/tui/screen.ts
const RENDER_DELAY_MS = 50;
const NOTICE_MS$1 = 2e3;
const COPY_ALL_MAX_CHARS = 6e4;
const SELECTED_GUTTER = "▎ ";
const GUTTER = "  ";
const GUTTER_WIDTH = 2;
const ENTER_ALT = "\x1B[?1049h\x1B[?25l";
const LEAVE_ALT = "\x1B[?25h\x1B[?1049l";
/** Alternate-screen view with navigation, search and copying. */
var ScreenOverlay = class {
	#write;
	#onClose;
	#subscribe;
	#open = false;
	#offset = 0;
	#following = true;
	#top = 0;
	#anchor;
	#revealSelection = false;
	#renderTimer;
	#unsubscribe;
	#onResize = () => this.#scheduleRender();
	#query = "";
	#searching = false;
	#selected;
	#selectedKey;
	#notice;
	constructor(options) {
		this.#write = options.write;
		this.#onClose = options.onClose;
		this.#subscribe = options.subscribe ?? (() => () => {});
	}
	/** Handle a view-specific key; return `true` if it changed anything. */
	handleViewKey(_key) {
		return false;
	}
	/** Handle enter on the selected entry; return `true` to consume it. Copy is the fallback. */
	activate(_index) {
		return false;
	}
	/** Text `Y` copies instead of every entry's own. */
	copyAllText() {}
	get isOpen() {
		return this.#open;
	}
	/** Repaint now, for data changes made from outside the view's own keys. */
	repaint() {
		if (this.#open) this.render();
	}
	open() {
		if (this.#open) return;
		this.#open = true;
		this.resetScroll();
		this.resetSelection();
		this.#write(ENTER_ALT);
		this.#unsubscribe = this.#subscribe(() => this.#scheduleRender());
		process.stdout.on("resize", this.#onResize);
		this.render();
	}
	close() {
		if (!this.#open) return;
		this.#open = false;
		clearTimeout(this.#renderTimer);
		this.#renderTimer = void 0;
		process.stdout.off("resize", this.#onResize);
		this.#unsubscribe?.();
		this.#write(LEAVE_ALT);
		this.#onClose();
	}
	handleNavigationKey(_key) {
		return false;
	}
	handleKey(key) {
		if (key.ctrl || key.meta) return;
		if (this.#searching) return this.#handleSearchKey(key);
		if (key.sequence === "/") {
			this.#searching = true;
			return this.render();
		}
		if (this.handleNavigationKey(key)) return;
		const page = Math.max(1, this.bodyRows() - 1);
		switch (key.name) {
			case "q":
			case "escape": return this.close();
			case "up":
			case "k":
				this.#move(-1);
				break;
			case "down":
			case "j":
				this.#move(1);
				break;
			case "pageup":
				this.#page(-page);
				break;
			case "pagedown":
				this.#page(page);
				break;
			case "home":
				this.select(0);
				break;
			case "end":
				this.resetSelection();
				this.resetScroll();
				break;
			case "g":
				if (key.sequence === "G") {
					this.resetSelection();
					this.resetScroll();
				} else this.select(0);
				break;
			case "return":
				if (this.#selected !== void 0 && this.activate(this.#selected)) break;
				this.#copySelected();
				return;
			case "y":
				key.sequence === "Y" ? this.#copyAll() : this.#copySelected();
				return;
			default:
				if (key.name && this.closeKeys.includes(key.name) || key.sequence && this.closeKeys.includes(key.sequence)) return this.close();
				if (!this.handleViewKey(key)) return;
		}
		this.render();
	}
	/** Rows available for content, once the title, rule and hints are taken. */
	bodyRows() {
		return Math.max(1, (process.stdout.rows || 24) - 3);
	}
	renderPosition() {
		return this.#following ? "" : ` · ${paint("warning", `follow paused${this.#offset > 0 ? ` · ↓${this.#offset} rows below` : ""}`)}`;
	}
	/** The active search text, lowercased. Empty when nothing is being searched. */
	get query() {
		return this.#query.toLowerCase();
	}
	/** The search box, or an empty string when no search is active. */
	renderSearch() {
		if (!this.#searching && !this.#query) return "";
		const caret = this.#searching ? styleText("inverse", " ") : "";
		return ` · ${styleText(MUTED, "search")} ${styleText("bold", this.#query)}${caret}`;
	}
	#handleSearchKey(key) {
		if (key.name === "escape") {
			this.#searching = false;
			this.#query = "";
		} else if (key.name === "return") this.#searching = false;
		else if (key.name === "backspace") this.#query = this.#query.slice(0, -1);
		else if (key.sequence && key.sequence.length === 1 && key.sequence >= " ") this.#query += key.sequence;
		else return;
		this.resetSelection();
		this.resetScroll();
		this.render();
	}
	resetScroll() {
		this.#offset = 0;
		this.#following = true;
		this.#anchor = void 0;
		this.#revealSelection = false;
	}
	resetSelection() {
		this.#selected = void 0;
		this.#selectedKey = void 0;
	}
	/** Move the selection to `index`; rendering scrolls it into view. */
	select(index) {
		this.#selected = index;
		this.#following = false;
		this.#revealSelection = true;
	}
	render() {
		const columns = process.stdout.columns || 80;
		const bodyRows = this.bodyRows();
		const entries = this.#entries();
		if (!this.#revealSelection && this.#selectedKey !== void 0) {
			const index = entries.findIndex((entry) => entry.key === this.#selectedKey);
			this.#selected = index < 0 ? void 0 : index;
		}
		if (this.#selected !== void 0) this.#selected = entries.length ? Math.min(this.#selected, entries.length - 1) : void 0;
		this.#selectedKey = this.#selected === void 0 ? void 0 : entries[this.#selected]?.key;
		const rows = [];
		let selectedRows;
		for (const [index, entry] of entries.entries()) {
			const selected = index === this.#selected;
			if (selected) selectedRows = {
				start: rows.length,
				end: rows.length + entry.lines.length
			};
			for (const line of entry.lines) rows.push(`${selected ? styleText("green", SELECTED_GUTTER) : GUTTER}${line}`);
		}
		const maxTop = Math.max(0, rows.length - bodyRows);
		let top = this.#following ? maxTop : this.#top;
		if (!this.#following && this.#anchor) {
			const anchor = this.#anchor;
			const index = anchor.key === void 0 ? anchor.index : entries.findIndex((entry) => entry.key === anchor.key);
			top = index < 0 ? 0 : entries.slice(0, index).reduce((total, entry) => total + entry.lines.length, 0) + Math.min(anchor.line, Math.max(0, (entries[index]?.lines.length ?? 1) - 1));
		}
		if (selectedRows && this.#revealSelection) {
			if (selectedRows.end - selectedRows.start > bodyRows || selectedRows.start < top) top = selectedRows.start;
			else if (selectedRows.end > top + bodyRows) top = selectedRows.end - bodyRows;
		}
		this.#revealSelection = false;
		this.#top = Math.min(Math.max(0, top), maxTop);
		this.#offset = Math.max(0, rows.length - this.#top - bodyRows);
		this.#anchor = this.#rowAnchor(entries, this.#top);
		const visible = rows.slice(this.#top, this.#top + bodyRows);
		const frame = [
			this.renderTitle(columns),
			styleText(MUTED, "─".repeat(Math.max(0, columns))),
			...visible,
			...Array.from({ length: bodyRows - visible.length }).fill(""),
			this.#hintLine()
		].map((row) => truncate(row, columns));
		this.#write(`\u001B[H\u001B[2J${frame.join("\n")}`);
	}
	#hintLine() {
		if (this.#notice && this.#notice.until > Date.now()) return styleText("green", this.#notice.text);
		const columns = process.stdout.columns || 80;
		return this.#searching ? formatHints([
			["enter", "apply"],
			["esc", "cancel"],
			["⌫", "delete"]
		], columns) : this.renderHints(columns);
	}
	#entries() {
		return this.renderEntries((process.stdout.columns || 80) - GUTTER_WIDTH);
	}
	#move(delta) {
		const entries = this.#entries();
		if (!entries.length) return;
		if (this.#selected === void 0) {
			const first = this.#rowAnchor(entries, this.#top);
			this.select(delta > 0 ? Math.min((first?.index ?? 0) + (first?.line ? 1 : 0), entries.length - 1) : entries.length - 1);
			return;
		}
		this.select(Math.min(Math.max(this.#selected + delta, 0), entries.length - 1));
	}
	#page(delta) {
		const entries = this.#entries();
		const rows = entries.reduce((total, entry) => total + entry.lines.length, 0);
		this.#following = false;
		this.#top = Math.min(Math.max(0, this.#top + delta), Math.max(0, rows - this.bodyRows()));
		this.#anchor = this.#rowAnchor(entries, this.#top);
		this.#selected = this.#rowAnchor(entries, delta < 0 ? this.#top : Math.min(rows - 1, this.#top + this.bodyRows() - 1))?.index;
		this.#selectedKey = this.#selected === void 0 ? void 0 : entries[this.#selected]?.key;
		this.#revealSelection = false;
	}
	#rowAnchor(entries, row) {
		let start = 0;
		for (const [index, entry] of entries.entries()) {
			if (row < start + entry.lines.length) return {
				key: entry.key,
				index,
				line: Math.max(0, row - start)
			};
			start += entry.lines.length;
		}
	}
	async #copySelected() {
		const entries = this.#entries();
		const text = this.#selected === void 0 ? void 0 : entries[this.#selected]?.copy;
		if (!text) {
			this.notify("nothing selected to copy");
			return;
		}
		await this.#copy(text, "copied");
	}
	async #copyAll() {
		let custom;
		try {
			custom = await this.copyAllText();
		} catch {
			this.notify("could not gather what to copy");
			return;
		}
		if (custom) return this.#copy(custom.slice(0, COPY_ALL_MAX_CHARS), "copied");
		const texts = this.#entries().map((entry) => entry.copy).filter((text) => !!text);
		if (!texts.length) {
			this.notify("nothing to copy");
			return;
		}
		let length = 0;
		let start = texts.length;
		while (start > 0 && length + texts[start - 1].length + 1 <= COPY_ALL_MAX_CHARS) length += texts[--start].length + 1;
		const kept = start === texts.length ? [texts.at(-1).slice(0, COPY_ALL_MAX_CHARS)] : texts.slice(start);
		const count = kept.length === texts.length ? `${kept.length}` : `the last ${kept.length} of ${texts.length}`;
		await this.#copy(kept.join("\n"), `copied ${count} ${texts.length === 1 ? "entry" : "entries"}`);
	}
	async #copy(text, done) {
		this.notify(await writeClipboard(stripAnsi(text)) ? `${done} to clipboard` : "no clipboard available");
	}
	/** Replace the hint line with `text` for a moment. */
	notify(text) {
		this.#notice = {
			text: `  ${text}`,
			until: Date.now() + NOTICE_MS$1
		};
		this.repaint();
		setTimeout(() => this.repaint(), 2050).unref?.();
	}
	#scheduleRender() {
		if (!this.#open || this.#renderTimer) return;
		this.#renderTimer = setTimeout(() => {
			this.#renderTimer = void 0;
			if (this.#open) this.render();
		}, RENDER_DELAY_MS);
		this.#renderTimer.unref?.();
	}
};
/** Format hints to fit, preserving the first and last. */
function formatHints(hints, columns = Number.POSITIVE_INFINITY) {
	const remaining = [...hints];
	const render = () => remaining.map(([key, description]) => `${styleText("bold", key)} ${styleText(MUTED, description)}`).join(styleText(MUTED, " · "));
	while (remaining.length > 2 && visibleWidth(render()) > columns) remaining.splice(remaining.length - 2, 1);
	return render();
}
//#endregion
//#region src/dev/tui/help-overlay.ts
const VIEW_ENTRIES = [
	{
		keys: ["↑ / k", "↓ / j"],
		description: "select an entry"
	},
	{
		keys: ["Page Up", "Page Down"],
		description: "scroll a screenful"
	},
	{
		keys: ["Home", "g"],
		description: "go to the beginning"
	},
	{
		keys: ["End", "G"],
		description: "follow the latest entries"
	},
	{
		keys: ["y"],
		description: "copy the selected entry"
	},
	{
		keys: ["enter"],
		description: "open details, otherwise copy"
	},
	{
		keys: ["Y"],
		description: "copy the whole view"
	},
	{
		keys: ["/"],
		description: "search (enter applies, esc cancels)"
	},
	{
		keys: ["esc", "q"],
		description: "close or go back; opening key also closes"
	}
];
/** Keyboard shortcut reference. */
var HelpOverlay = class extends ScreenOverlay {
	#entries;
	constructor(entries, write, onClose) {
		super({
			write,
			onClose
		});
		this.#entries = entries;
	}
	open() {
		if (this.isOpen) return;
		super.open();
		this.select(0);
		this.repaint();
	}
	get closeKeys() {
		return ["h", "?"];
	}
	renderTitle() {
		return ` ${styleText("bold", "keyboard shortcuts")}`;
	}
	renderEntries() {
		const entries = this.#entries();
		const width = Math.max(...[...entries, ...VIEW_ENTRIES].map((entry) => formatKeys(entry).length));
		const row = (entry) => ({ lines: [`${styleText("bold", formatKeys(entry).padEnd(width))}   ${styleText(MUTED, entry.description)}`] });
		return [
			{ lines: [styleText("bold", "global")] },
			...entries.filter((entry) => entry.ctrl).map(row),
			{ lines: ["", styleText("bold", "main panel")] },
			...entries.filter((entry) => !entry.ctrl).map(row),
			{ lines: ["", styleText("bold", "in a view")] },
			...VIEW_ENTRIES.map(row)
		];
	}
	renderHints(columns) {
		return formatHints([
			["↑/↓", "select"],
			["PgUp/PgDn", "scroll"],
			["esc/q", "close"]
		], columns);
	}
};
function formatKeys({ keys, ctrl }) {
	return [...keys.map((key) => /^[A-Z]$/.test(key) ? `shift-${key.toLowerCase()}` : key), ...ctrl ? [`ctrl-${ctrl}`] : []].join(" / ");
}
//#endregion
//#region src/dev/tui/info-overlay.ts
/** Columns needed before a side panel is worth splitting the view into. */
const SIDE_PANEL_MIN_GAP = 8;
/** Values matching these are coloured, so the view stays scannable. */
const VALUE_STYLES = [{
	pattern: /^https?:\/\//,
	style: "cyan"
}, {
	pattern: /^\d[\w.\-+]*$/,
	style: "green"
}];
/** Versions, every URL the session is reachable on, and how it has behaved. */
var InfoOverlay = class extends ScreenOverlay {
	#sections;
	#panel;
	#report;
	constructor(sections, write, onClose, panel = () => void 0, report) {
		super({
			write,
			onClose,
			subscribe: (listener) => {
				const timer = setInterval(listener, 1e3);
				timer.unref?.();
				return () => clearInterval(timer);
			}
		});
		this.#sections = sections;
		this.#panel = panel;
		this.#report = report;
	}
	async copyAllText() {
		if (!this.#report) return;
		this.notify("collecting project info…");
		return this.#report();
	}
	get closeKeys() {
		return ["i", "u"];
	}
	renderTitle() {
		return ` ${styleText("bold", "info")}`;
	}
	renderEntries(columns) {
		const sections = this.#sections();
		const width = Math.max(...sections.flatMap(({ entries }) => entries.map(([label]) => label.length)));
		return withSidePanel(sections.flatMap(({ heading, entries }, index) => [
			...index > 0 ? [""] : [],
			`  ${styleText(["bold", "underline"], heading)}`,
			...entries.filter(([, value]) => !!value).map(([label, value, style]) => `  ${styleText(MUTED, label.padEnd(width))}  ${style ? styleText(style, value) : colorize(value)}`)
		]), this.#panel(), columns).map((line) => ({
			lines: [line],
			copy: stripAnsi(line).trim().split(/\s{2,}/).at(-1)
		}));
	}
	renderHints(columns) {
		return formatHints([
			["↑/↓", "select"],
			["y", "copy"],
			...this.#report ? [["Y", "copy for an issue"]] : [],
			["q", "close"]
		], columns);
	}
};
/**
* Place `panel` to the right of `rows` when the terminal is wide enough for
* both, and underneath when it is not.
*/
function withSidePanel(rows, panel, columns) {
	if (!panel) return rows;
	const panelLines = panel.split("\n");
	const panelWidth = Math.max(...panelLines.map((line) => visibleWidth(line)));
	const contentWidth = Math.max(...rows.map((line) => visibleWidth(line)));
	if (columns < contentWidth + panelWidth + SIDE_PANEL_MIN_GAP) return [
		...rows,
		"",
		...panelLines.map((line) => `  ${line}`)
	];
	const gutter = contentWidth + 4;
	return Array.from({ length: Math.max(rows.length, panelLines.length) }, (_, index) => {
		const left = rows[index] ?? "";
		const right = panelLines[index];
		return right ? `${left}${" ".repeat(gutter - visibleWidth(left))}${right}` : left;
	});
}
/** Leave values that already carry styling alone; colour the plain ones by shape. */
function colorize(value) {
	if (value.includes("\x1B[")) return value;
	const match = VALUE_STYLES.find(({ pattern }) => pattern.test(value));
	return match ? styleText(match.style, value) : value;
}
//#endregion
//#region src/dev/tui/terminal-replies.ts
/** Introduces an OSC, DCS, APC or PM string, which runs until its terminator. */
const STRING_REPLY_RE = /^\u001B[\]P^_X]/;
/** Ends an OSC, DCS, APC or PM string. */
const STRING_TERMINATOR_RE = /\u0007|\u001B\\/;
/**
* A whole CSI report: cursor position, device attributes, window size. Narrow,
* because cursor keys and `alt`ed letters are escape sequences too.
*/
const CSI_REPLY_RE = /^\u001B\[[\d;?]*[Rcnty]/;
/**
* A CSI report whose final byte has not arrived yet. A lone `ESC` is
* deliberately not one of these: it is also the Escape key, and holding it back
* on the chance that a report follows would cost more than it saves.
*/
const PARTIAL_CSI_RE = /^\u001B\[[\d;?]*$/;
/** How long an unterminated reply may swallow keys before it is dropped. */
const REPLY_TIMEOUT_MS = 200;
/** Longest tail of an unfinished reply held while the rest is awaited. */
const MAX_PENDING = 64;
/**
* Watch a stream for answers from the terminal, so a key reader can tell them
* apart from typing: a background colour reply arrives as `ESC ] 1 1 ; r g b : …`,
* every character of which is also a shortcut.
*
* Attach before the `keypress` listener, so each chunk is classified by the time
* `readline` turns it into keys.
*/
function filterTerminalReplies(stdin) {
	let replying = false;
	let pending = "";
	let timer;
	function stopReplying() {
		replying = false;
		pending = "";
		clearTimeout(timer);
		timer = void 0;
	}
	/**
	* Finish a reply that ends `length` characters into what has been buffered.
	*
	* The whole chunk is suppressed, since `readline` has not turned it into keys
	* yet and there is no way to drop only part of it. Anything the reply did not
	* account for was typed, so it is put back to be read as keys of its own.
	*/
	function endReply(buffered, length) {
		const typed = buffered.slice(length);
		clearTimeout(timer);
		timer = void 0;
		pending = "";
		setImmediate(() => {
			stopReplying();
			if (typed) stdin.unshift(Buffer.from(typed, "latin1"));
		});
	}
	/** Wait for the rest of a reply, without waiting on it forever. */
	function awaitRest(buffered) {
		if (buffered.length > MAX_PENDING) return stopReplying();
		pending = buffered;
		timer ??= setTimeout(stopReplying, REPLY_TIMEOUT_MS);
		timer.unref?.();
	}
	const onData = (chunk) => {
		const buffered = pending + chunk.toString("latin1");
		const csi = CSI_REPLY_RE.exec(buffered);
		if (csi) {
			replying = true;
			return endReply(buffered, csi[0].length);
		}
		if (STRING_REPLY_RE.test(buffered)) {
			replying = true;
			const terminator = STRING_TERMINATOR_RE.exec(buffered);
			return terminator ? endReply(buffered, terminator.index + terminator[0].length) : awaitRest(buffered);
		}
		if (PARTIAL_CSI_RE.test(buffered)) {
			replying = true;
			return awaitRest(buffered);
		}
		stopReplying();
	};
	stdin.on("data", onData);
	return {
		isReplying: () => replying,
		stop: () => {
			stopReplying();
			stdin.off("data", onData);
		}
	};
}
//#endregion
//#region src/dev/tui/keys.ts
/**
* Deliver raw keypresses, excluding terminal replies. The handler owns Ctrl-C.
* Set `ignoreBufferedInput` when returning from a prompt.
*/
function attachKeys(onKey, { ignoreBufferedInput = false } = {}) {
	let release;
	let detached = false;
	function attach() {
		if (detached) return;
		const { stdin } = process;
		const wasRaw = stdin.isRaw;
		stdin.setRawMode(true);
		const replies = filterTerminalReplies(stdin);
		const isReplayedInput = ignoreBufferedInput ? guardReplayedInput() : () => false;
		emitKeypressEvents(stdin);
		stdin.resume();
		const handler = (_input, key) => {
			if (replies.isReplying() || isReplayedInput()) return;
			if (key) onKey(key);
		};
		stdin.on("keypress", handler);
		release = () => {
			replies.stop();
			stdin.off("keypress", handler);
			if (stdin.isTTY) stdin.setRawMode(wasRaw ?? false);
			stdin.pause();
		};
	}
	const held = whenStdinReleased();
	if (held) held.then(attach);
	else attach();
	return () => {
		detached = true;
		release?.();
		release = void 0;
	};
}
//#endregion
//#region src/dev/tui/overlay.ts
const LEVEL_THRESHOLDS = {
	all: Number.POSITIVE_INFINITY,
	warn: 1,
	error: 0
};
/** Rendering considers at most this many events per frame. */
const SCAN_LIMIT$1 = 2e3;
/**
* Log history with retroactive filtering by source and level, and scrollback
* independent of the terminal's.
*/
var LogOverlay = class extends ScreenOverlay {
	#events;
	#sources = {
		cli: true,
		build: true,
		runtime: true
	};
	#level = "all";
	constructor(events, write, onClose) {
		super({
			write,
			onClose,
			subscribe: (listener) => events.onEvent(listener)
		});
		this.#events = events;
	}
	get closeKeys() {
		return ["l"];
	}
	/** Open with the newest error selected. */
	openAtLastError() {
		this.open();
		const index = this.#matching().findLastIndex((event) => event.level <= 0);
		if (index >= 0) {
			this.select(index);
			this.repaint();
		}
	}
	handleViewKey(key) {
		switch (key.name) {
			case "a": return this.#setLevel("all");
			case "w": return this.#setLevel("warn");
			case "e": return this.#setLevel("error");
			case "t": return this.#toggleSource("cli");
			case "b": return this.#toggleSource("build");
			case "r": return this.#toggleSource("runtime");
			case "x":
				this.#events.clear();
				this.resetSelection();
				this.resetScroll();
				return true;
			default: return false;
		}
	}
	renderTitle() {
		const sources = [
			"cli",
			"build",
			"runtime"
		].map((source) => this.#sources[source] ? styleText("bold", source) : styleText([MUTED, "strikethrough"], source)).join(styleText(MUTED, "+"));
		const level = this.#level === "all" ? "all levels" : `${this.#level}+ only`;
		const hidden = this.#events.recent(SCAN_LIMIT$1).length - this.#matching().length;
		const hiddenNote = hidden > 0 ? ` · ${styleText(MUTED, `${hidden} hidden`)}` : "";
		return ` ${styleText("bold", "logs")}${this.renderPosition()} · ${sources} · ${level}${hiddenNote}${this.renderSearch()}`;
	}
	renderEntries(columns) {
		const events = this.#matching();
		let heading;
		return events.map((event) => {
			const repeated = event.requestId !== void 0 && event.requestId === heading;
			heading = event.requestId;
			return {
				key: event,
				lines: formatEvent(event, columns, repeated),
				copy: [
					formatTime(event.time),
					event.request,
					event.message
				].filter(Boolean).join(" ")
			};
		});
	}
	renderHints(columns) {
		return formatHints([
			["↑/↓", "select"],
			["Home/End", "top/live"],
			["PgUp/PgDn", "scroll"],
			["e", "errors"],
			["w", "warnings"],
			["a", "all"],
			["t/b/r", "cli/build/runtime"],
			["/", "search"],
			["x", "delete logs"],
			["y", "copy"],
			["Y", "copy all"],
			["q", "close"]
		], columns);
	}
	#matching() {
		const query = this.query;
		return this.#events.recent(SCAN_LIMIT$1, (event) => this.#sources[event.source] && event.level <= LEVEL_THRESHOLDS[this.#level] && (!query || event.message.toLowerCase().includes(query) || !!event.tag?.toLowerCase().includes(query) || !!event.request?.toLowerCase().includes(query)));
	}
	#setLevel(level) {
		this.#level = this.#level === level ? "all" : level;
		this.resetSelection();
		this.resetScroll();
		return true;
	}
	#toggleSource(source) {
		this.#sources[source] = !this.#sources[source];
		if (Object.values(this.#sources).every((shown) => !shown)) this.#sources[source] = true;
		this.resetSelection();
		this.resetScroll();
		return true;
	}
};
function formatTime(time) {
	return new Date(time).toLocaleTimeString();
}
/** Format log rows with timestamps and request headings. */
function formatEvent(event, columns, sameRequest = false) {
	const messageColumn = 9;
	const date = new Date(event.time);
	const clock = [
		date.getHours(),
		date.getMinutes(),
		date.getSeconds()
	].map((part) => String(part).padStart(2, "0")).join(":");
	const time = styleText(MUTED, clock);
	const budget = columns - messageColumn - 1;
	const indent = " ".repeat(messageColumn);
	const marker = event.repeats && event.repeats > 1 ? styleText(MUTED, ` ×${event.repeats}`) : "";
	const markerWidth = event.repeats && event.repeats > 1 ? ` ×${event.repeats}`.length : 0;
	const firstLineWidth = visibleWidth(event.message.split("\n", 1)[0] ?? "");
	const tagRoom = Math.max(Math.floor(budget / 2), budget - markerWidth - firstLineWidth - 1);
	const tag = event.tag && !event.request ? styleText(MUTED, `[${truncate(event.tag, Math.max(1, tagRoom - 2))}] `) : "";
	const tagWidth = visibleWidth(tag);
	const lines = event.message.split("\n").map((line, index) => {
		const room = Math.max(1, budget - (index === 0 ? markerWidth + tagWidth : 0));
		const text = colorBySeverity(truncate(line, room), event);
		return index === 0 ? `${text}${marker}` : text;
	});
	if (event.request) return [...sameRequest ? [] : [`${time} ${styleText(["magenta", "bold"], event.request)}`], ...lines.map((line) => `${indent}${line}`)];
	return lines.map((line, index) => index === 0 ? `${time} ${tag}${line}` : `${indent}${line}`);
}
/** Colour a message by its level, unless it already carries its own colour. */
function colorBySeverity(line, event) {
	if (event.styled || line.includes("\x1B[")) return line;
	if (event.level <= 0) return styleText("red", line);
	return event.level <= 1 ? paint("warning", line) : line;
}
//#endregion
//#region src/dev/tui/project-report.ts
/** The `nuxt info` table for the project in `cwd`, gathered in a separate process. */
async function readProjectReport(cwd) {
	const { stdout } = await promisify(execFile)(process.execPath, [
		globalThis.__nuxt_cli__.entry,
		"info",
		"--json",
		cwd
	], {
		cwd,
		timeout: 3e4
	});
	const { formatJsonAsMarkdownTable } = await import("./info-3RG9T46s.mjs");
	return formatJsonAsMarkdownTable(JSON.parse(stdout));
}
//#endregion
//#region src/dev/tui/request-overlay.ts
/** Requests at or above this duration are highlighted, and matched by the slow filter. */
const SLOW_MS = 100;
const VERY_SLOW_MS = 500;
const SCAN_LIMIT = 1e3;
const EVENT_SCAN_LIMIT = 1e4;
/** A live table of served requests: the server-side view a browser cannot show. */
var RequestOverlay = class extends ScreenOverlay {
	#requests;
	#events;
	#filter = "all";
	#showInternal = false;
	#detail;
	#resolveFile;
	#cwd;
	constructor(requests, write, onClose, options = {}) {
		super({
			write,
			onClose,
			subscribe: (listener) => requests.onChange(listener)
		});
		this.#requests = requests;
		this.#events = options.events;
		this.#resolveFile = options.resolveFile ?? (() => void 0);
		this.#cwd = options.cwd ?? process.cwd();
	}
	get closeKeys() {
		return ["n"];
	}
	handleNavigationKey(key) {
		if (this.#detail && (key.name === "escape" || key.name === "q" || key.name === "backspace" || key.name === "n")) {
			this.#detail = void 0;
			this.resetSelection();
			this.resetScroll();
			this.repaint();
			return true;
		}
		return false;
	}
	activate(index) {
		if (this.#detail) return false;
		const request = this.#matching()[index];
		if (!request) return false;
		this.#detail = request;
		this.resetSelection();
		this.resetScroll();
		return true;
	}
	handleViewKey(key) {
		if (this.#detail) return false;
		switch (key.name) {
			case "a": return this.#setFilter("all");
			case "e": return this.#setFilter("errors");
			case "s": return this.#setFilter("slow");
			case "b":
				this.#showInternal = !this.#showInternal;
				this.resetScroll();
				return true;
			default: return false;
		}
	}
	renderTitle() {
		if (this.#detail) {
			const request = this.#detail;
			const status = paintStatus(request.status);
			return ` ${styleText("bold", "trace")} · ${styleText("bold", `${request.method} ${request.url}`)} · ${status} · ${formatDuration(request.duration)}${this.renderSearch()}`;
		}
		const shown = this.#matching().length;
		const label = this.#filter === "all" ? "all" : this.#filter;
		const median = this.#requests.medianDuration();
		const summary = styleText(MUTED, `${this.#requests.total} total · median ${formatDuration(median)}`);
		const hiddenInternal = this.#showInternal ? 0 : this.#requests.recent(SCAN_LIMIT, (request) => !!request.internal).length;
		const bundler = hiddenInternal ? ` · ${styleText(MUTED, `${hiddenInternal} bundler hidden`)}` : "";
		return ` ${styleText("bold", "traffic")} · ${label} (${shown}) · ${summary}${bundler}${this.renderPosition()}${this.renderSearch()}`;
	}
	renderEntries(columns) {
		if (this.#detail) return this.#renderTrace(this.#detail, columns);
		const matching = this.#matching();
		if (!matching.length) return [{ lines: [styleText(MUTED, this.#requests.total ? "no requests match this filter" : "waiting for requests…")] }];
		const errors = this.#errorCounts();
		return matching.map((request) => ({
			lines: [this.#format(request, columns, request.id === void 0 ? 0 : errors.get(request.id) ?? 0)],
			copy: describeRequest(request)
		}));
	}
	renderHints(columns) {
		if (this.#detail) return formatHints([
			["↑/↓", "select"],
			["y", "copy"],
			["Y", "copy all"],
			["esc", "back"]
		], columns);
		return formatHints([
			["↑/↓", "select"],
			["enter", "trace"],
			["Home/End", "top/live"],
			["PgUp/PgDn", "scroll"],
			["e", "errors"],
			["s", `slow >${SLOW_MS}ms`],
			["a", "all"],
			["b", "bundler"],
			["/", "search"],
			["y", "copy"],
			["Y", "copy all"],
			["q", "close"]
		], columns);
	}
	/** The request as a heading, then every log the server attributed to it. */
	#renderTrace(request, columns) {
		const file = this.#resolveFile(request);
		const summary = [
			{
				lines: [this.#format(request, columns, 0)],
				copy: describeRequest(request)
			},
			...file ? [{
				lines: [`${" ".repeat(12)}${styleText(MUTED, "served by ")}${link(file, { cwd: this.#cwd })}`],
				copy: file
			}] : [],
			{ lines: [""] },
			...renderTimeline(request, this.#requests.spansFor(request), columns)
		];
		const events = this.#traceEvents(request);
		if (!events.length) return [...summary, { lines: [styleText(MUTED, request.id === void 0 ? "this request predates log attribution" : "no logs were captured for this request")] }];
		return [...summary, ...events.map((event) => ({
			key: event,
			lines: formatEvent(event, columns, true),
			copy: [formatTime(event.time), event.message].filter(Boolean).join(" ")
		}))];
	}
	#traceEvents(request) {
		if (!this.#events || request.id === void 0) return [];
		return this.#events.recent(EVENT_SCAN_LIMIT, (event) => event.requestId === request.id);
	}
	/** Error-log counts per request id, for the markers in the table. */
	#errorCounts() {
		const counts = /* @__PURE__ */ new Map();
		for (const event of this.#events?.recent(EVENT_SCAN_LIMIT, (event) => event.requestId !== void 0 && event.level <= 0) ?? []) counts.set(event.requestId, (counts.get(event.requestId) ?? 0) + 1);
		return counts;
	}
	#format(request, columns, errors) {
		const file = this.#resolveFile(request);
		return formatRequest(request, columns, file ? {
			file,
			cwd: this.#cwd
		} : void 0, errors);
	}
	#matching() {
		const query = this.query;
		return this.#requests.recent(SCAN_LIMIT, (request) => {
			if (request.internal && !this.#showInternal) return false;
			if (query && !`${request.method} ${request.url} ${request.status}`.toLowerCase().includes(query)) return false;
			if (this.#filter === "errors") return request.status >= 400;
			if (this.#filter === "slow") return request.duration >= SLOW_MS;
			return true;
		});
	}
	#setFilter(filter) {
		this.#filter = this.#filter === filter ? "all" : filter;
		this.resetScroll();
		return true;
	}
};
const SPAN_COLORS = {
	route: "green",
	middleware: "green",
	fetch: "magenta",
	hook: "cyan",
	plugin: "blue",
	data: "yellow",
	render: "white",
	island: "white",
	compile: "gray"
};
/** Columns taken by the kind, the duration and the gaps between them and the label and bar. */
const TIMELINE_CHROME = 22;
const LABEL_MIN_WIDTH = 16;
const TIMELINE_MIN_WIDTH = 10;
/** How many Vite plugins and modules the compile breakdown lists. */
const TOP_PLUGINS = 8;
const TOP_MODULES = 5;
/**
* The request and every span timed for it, as bars on one time axis spanning
* the request. Each span is indented beneath the spans it ran inside, and the
* server modules compiled for it are drawn as one row wherever any was
* compiling.
*/
function renderTimeline(request, spans, columns) {
	if (!spans.length) return [];
	const origin = Math.min(request.start ?? Number.POSITIVE_INFINITY, ...spans.map((span) => span.start));
	const end = Math.max(origin + request.duration, ...spans.map((span) => span.start + span.duration));
	const total = Math.max(end - origin, 1);
	const requestStart = request.start ?? origin;
	const compiled = spans.filter((span) => span.kind === "compile");
	const rows = [{
		kind: "request",
		label: `${request.method} ${request.url}`,
		segments: [[requestStart, requestStart + request.duration]],
		duration: request.duration,
		color: "white"
	}];
	if (compiled.length) {
		const segments = mergeIntervals(compiled.map((span) => [span.start, span.start + span.duration]));
		const shared = compiled.some((span) => span.shared) ? ", shared" : "";
		rows.push({
			kind: "compile",
			label: `  ${compiled.length} ${compiled.length === 1 ? "module" : "modules"}${shared}`,
			segments,
			duration: segments.reduce((sum, [from, to]) => sum + to - from, 0),
			color: SPAN_COLORS.compile
		});
	}
	const open = [];
	for (const span of spans) {
		if (span.kind === "compile") continue;
		const spanEnd = span.start + span.duration;
		while (open.length && open.at(-1).start + open.at(-1).duration < spanEnd) open.pop();
		rows.push({
			kind: span.kind,
			label: `${"  ".repeat(open.length + 1)}${span.name}${span.status ? ` ${span.status}` : ""}`,
			segments: [[span.start, spanEnd]],
			duration: span.duration,
			color: span.error || (span.status ?? 0) >= 400 ? "red" : SPAN_COLORS[span.kind] ?? "white"
		});
		open.push(span);
	}
	const longest = Math.max(...rows.map((row) => row.label.length));
	const labelWidth = Math.max(LABEL_MIN_WIDTH, Math.min(longest, Math.floor(columns * .4)));
	const width = Math.max(TIMELINE_MIN_WIDTH, columns - labelWidth - TIMELINE_CHROME);
	const totalLabel = formatDuration(total);
	const axis = styleText(MUTED, `${"0ms".padEnd(width - totalLabel.length)}${totalLabel}`);
	return [
		{ lines: [`${styleText("bold", "timeline".padEnd(labelWidth + 11))} ${axis}`] },
		...rows.map((row) => {
			const label = truncate(row.label, labelWidth).padEnd(labelWidth);
			const time = formatDuration(row.duration).padStart(9);
			return {
				lines: [`${styleText(MUTED, row.kind.padEnd(10))} ${label} ${drawBar(row, origin, total, width)} ${styleText(MUTED, time)}`],
				copy: `+${formatDuration(row.segments[0][0] - origin)} ${row.kind} ${row.label.trim()} ${formatDuration(row.duration)}`
			};
		}),
		{ lines: [""] },
		...renderCompileBreakdown(compiled, columns)
	];
}
function drawBar(row, origin, total, width) {
	const cells = Array.from({ length: width }).fill(false);
	for (const [from, to] of row.segments) {
		const offset = Math.min(width - 1, Math.floor((from - origin) / total * width));
		const length = Math.max(1, Math.min(width - offset, Math.round((to - from) / total * width)));
		cells.fill(true, offset, offset + length);
	}
	return cells.map((filled) => filled ? "█" : " ").join("").replace(/█+/g, (run) => styleText(row.color, run));
}
function mergeIntervals(intervals) {
	const merged = [];
	for (const [from, to] of intervals.sort((a, b) => a[0] - b[0])) {
		const last = merged.at(-1);
		if (last && from <= last[1]) last[1] = Math.max(last[1], to);
		else merged.push([from, to]);
	}
	return merged;
}
/** Where the compile time went: the busiest Vite plugins, then the slowest modules. */
function renderCompileBreakdown(compiled, columns) {
	if (!compiled.length) return [];
	const byPlugin = /* @__PURE__ */ new Map();
	for (const span of compiled) for (const [plugin, time] of Object.entries(span.plugins ?? {})) byPlugin.set(plugin, (byPlugin.get(plugin) ?? 0) + time);
	const plugins = [...byPlugin].sort((a, b) => b[1] - a[1]).slice(0, TOP_PLUGINS);
	const modules = [...compiled].sort((a, b) => b.duration - a.duration).slice(0, TOP_MODULES);
	const nameWidth = Math.max(0, columns - 12);
	const row = (name, duration) => ({
		lines: [`  ${formatDuration(duration).padStart(8)}  ${truncate(name, nameWidth)}`],
		copy: `${formatDuration(duration)} ${name}`
	});
	return [
		...plugins.length ? [
			{ lines: [styleText("bold", "vite plugins") + styleText(MUTED, " · time spent compiling for this request")] },
			...plugins.map(([plugin, time]) => row(plugin, time)),
			{ lines: [""] }
		] : [],
		{ lines: [styleText("bold", "slowest modules")] },
		...modules.map((span) => row(span.environment ? `${span.name} ${styleText(MUTED, `(${span.environment})`)}` : span.name, span.duration)),
		{ lines: [""] }
	];
}
function describeRequest(request) {
	return `${request.method} ${request.url} ${request.status} ${formatDuration(request.duration)}`;
}
function paintDuration(duration) {
	const text = formatDuration(duration).padStart(7);
	if (duration >= VERY_SLOW_MS) return styleText("red", text);
	return duration >= SLOW_MS ? paint("warning", text) : styleText(MUTED, text);
}
function formatRequest(request, columns, target, errors = 0) {
	const time = styleText(MUTED, formatTime(request.time).padStart(11));
	const method = styleText("bold", request.method.padEnd(6));
	const status = paintStatus(request.status, String(request.status).padEnd(4));
	const duration = paintDuration(request.duration);
	const marker = errors ? ` ${styleText(["red", "bold"], `✗ ${errors}`)}` : "";
	const room = Math.max(10, columns - 34 - (errors ? `  ✗ ${errors}`.length : 0));
	const label = truncate(request.url, room);
	return `${time} ${method} ${status} ${duration}  ${target ? link(target.file, {
		cwd: target.cwd,
		formatter: () => label
	}) : label}${marker}`;
}
//#endregion
//#region src/dev/tui/requests.ts
/** Rolling history of served requests, backing the ticker and the traffic view. */
var RequestLog = class {
	#requests = [];
	#listeners = /* @__PURE__ */ new Set();
	#capacity;
	#total = 0;
	#spans = /* @__PURE__ */ new Map();
	constructor(capacity = 1e3) {
		this.#capacity = capacity;
	}
	/** Requests served since the session started, including any dropped from the buffer. */
	get total() {
		return this.#total;
	}
	push(requests) {
		if (!requests.length) return;
		this.#total += requests.length;
		this.#requests.push(...requests);
		if (this.#requests.length > this.#capacity) {
			for (const dropped of this.#requests.splice(0, this.#requests.length - this.#capacity)) if (dropped.id !== void 0) this.#spans.delete(dropped.id);
		}
		for (const listener of this.#listeners) listener();
	}
	/** Record spans the app timed, against the requests they were timed for. */
	pushSpans(spans) {
		if (!spans.length) return;
		for (const span of spans) {
			const list = this.#spans.get(span.requestId);
			if (list) list.push(span);
			else this.#spans.set(span.requestId, [span]);
		}
		while (this.#spans.size > this.#capacity) this.#spans.delete(this.#spans.keys().next().value);
		for (const listener of this.#listeners) listener();
	}
	/** The spans timed for a request, in the order they started, outermost first. */
	spansFor(request) {
		if (request.id === void 0) return [];
		return [...this.#spans.get(request.id) ?? []].sort((a, b) => a.start - b.start || b.duration - a.duration);
	}
	recent(count, filter) {
		return (filter ? this.#requests.filter(filter) : this.#requests).slice(-count);
	}
	last() {
		return this.#requests.at(-1);
	}
	/**
	* Median is used rather than the mean so one cold start does not skew it.
	* Bundler-served module requests are excluded when any app traffic exists:
	* hundreds of sub-millisecond module fetches say nothing about the app.
	*/
	medianDuration() {
		if (!this.#requests.length) return 0;
		const app = this.#requests.filter((request) => !request.internal);
		const sorted = (app.length ? app : this.#requests).map((request) => request.duration).sort((a, b) => a - b);
		return sorted[Math.floor(sorted.length / 2)] ?? 0;
	}
	/** Drop the history and the running total, telling anyone displaying them. */
	clear() {
		this.#requests.length = 0;
		this.#spans.clear();
		this.#total = 0;
		for (const listener of this.#listeners) listener();
	}
	onChange(listener) {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}
};
//#endregion
//#region src/dev/tui/route-overlay.ts
/**
* The routes the app defines, otherwise only discoverable by reading the file
* tree or opening DevTools in a browser.
*/
var RouteOverlay = class extends ScreenOverlay {
	#routes = [];
	#errorComponent;
	#listeners = /* @__PURE__ */ new Set();
	#filter = "all";
	#cwd;
	constructor(write, onClose, cwd) {
		super({
			write,
			onClose,
			subscribe: (listener) => {
				this.#listeners.add(listener);
				return () => this.#listeners.delete(listener);
			}
		});
		this.#cwd = cwd;
	}
	/**
	* The file that serves `url`, matching the most specific route first so a
	* server handler wins over the page that shares its prefix.
	*/
	fileFor(url) {
		const path = url.split("?")[0] ?? url;
		return this.#routes.filter((route) => route.file && matchesRoute(route.route, path)).sort((a, b) => b.route.length - a.route.length)[0]?.file;
	}
	/** The component that renders error responses, if the app reported one. */
	get errorComponent() {
		return this.#errorComponent;
	}
	/** Replace the known routes; the app re-reports them on every reload. */
	setRoutes({ routes, errorComponent }) {
		this.#routes = routes;
		this.#errorComponent = errorComponent;
		for (const listener of this.#listeners) listener();
	}
	get closeKeys() {
		return ["p"];
	}
	handleViewKey(key) {
		switch (key.name) {
			case "a": return this.#setFilter("all");
			case "w": return this.#setFilter("page");
			case "s": return this.#setFilter("server");
			default: return false;
		}
	}
	renderTitle() {
		const pages = this.#routes.filter((route) => route.kind === "page").length;
		const server = this.#routes.length - pages;
		const counts = styleText(MUTED, `${pages} pages · ${server} server`);
		const label = this.#filter === "all" ? "all" : `${this.#filter} only`;
		return ` ${styleText("bold", "routes")} · ${label} · ${counts}${this.renderPosition()}${this.renderSearch()}`;
	}
	renderEntries(columns) {
		const matching = this.#matching();
		if (!matching.length) return [{ lines: [styleText(MUTED, this.#routes.length ? "no routes match this filter" : "waiting for routes…")] }];
		const width = Math.min(50, Math.max(...matching.map((route) => route.route.length)) + 2);
		return matching.map((route) => ({
			lines: [this.#formatRoute(route, width, columns)],
			copy: route.file ? relative(this.#cwd, route.file) : route.route
		}));
	}
	renderHints(columns) {
		return formatHints([
			["↑/↓", "select"],
			["w", "pages"],
			["s", "server"],
			["a", "all"],
			["/", "search"],
			["y", "copy"],
			["Y", "copy all"],
			["q", "close"]
		], columns);
	}
	#formatRoute(route, width, columns) {
		const kind = route.kind === "page" ? styleText("cyan", "page  ") : styleText("magenta", (route.method?.toUpperCase() ?? "any").padEnd(6));
		const path = route.route.padEnd(width);
		const file = route.file ? relative(this.#cwd, route.file) : "";
		const room = columns - width - 10;
		const label = room < 8 ? "" : file.length > room ? `…${file.slice(1 - room)}` : file;
		const target = label && route.file ? link(route.file, {
			cwd: this.#cwd,
			formatter: () => label
		}) : label;
		return truncate(`  ${kind} ${path} ${styleText(MUTED, target)}`, columns);
	}
	#matching() {
		const query = this.query;
		return this.#routes.filter((route) => this.#filter === "all" || route.kind === this.#filter).filter((route) => !query || `${route.route} ${route.file ?? ""}`.toLowerCase().includes(query)).sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "page" ? -1 : 1) || a.route.localeCompare(b.route));
	}
	#setFilter(filter) {
		this.#filter = this.#filter === filter ? "all" : filter;
		this.resetScroll();
		return true;
	}
};
/** Whether a route pattern covers `path`, including `:param` and `**` segments. */
function matchesRoute(route, path) {
	if (route === path) return true;
	const pattern = route.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\/\*\*.*$/, "(?:/.*)?").replace(/:\w+/g, "[^/]+");
	return new RegExp(`^${pattern}/?$`).test(path);
}
//#endregion
//#region src/dev/tui/index.ts
const attached = /* @__PURE__ */ new WeakMap();
const TICKER_REPAINT_MS = 250;
const ACTIVITY_MS = 700;
const NOTICE_MS = 4e3;
const LOADING_STATUSES = /* @__PURE__ */ new Set([
	"starting",
	"building",
	"restarting"
]);
/**
* Interactive dev UI: a pinned status panel, folded-away logs and single-key
* shortcuts, falling back to the line-based shortcuts whenever the terminal
* cannot support it (pipes, CI, `--no-tui`).
*/
function setupDevUI(context, options = {}) {
	const session = options.enabled === false ? void 0 : beginDevUI(options);
	if (!session) {
		setupShortcuts(context);
		return NOOP_CONTROLLER;
	}
	if (attached.has(session)) return attached.get(session);
	const sessionStart = Date.now();
	session.stopStartupTicker();
	session.onTeardown(() => attached.delete(session));
	const { surface, events, state, surfaceText, render } = session;
	const requests = new RequestLog();
	const version = options.version ?? state.version;
	Object.assign(state, {
		version,
		versionLink: version ? linkVersion(version) : void 0
	});
	const write = (chunk) => surface.writeRaw(chunk);
	const release = () => {
		surface.screenMode = "split-footer";
	};
	const cwd = options.cwd || process.cwd();
	function acknowledgeLogs() {
		update({
			warnings: 0,
			errors: 0
		});
	}
	const overlay = new LogOverlay(events, write, () => {
		acknowledgeLogs();
		release();
	});
	const routeOverlay = new RouteOverlay(write, release, cwd);
	const trafficOverlay = new RequestOverlay(requests, write, release, {
		resolveFile: (request) => request.status >= 400 ? routeOverlay.errorComponent : routeOverlay.fileFor(request.url),
		cwd,
		events
	});
	let shortcuts = [];
	let qrCode;
	let armedOpen = false;
	let ready = false;
	const helpOverlay = new HelpOverlay(() => shortcuts.filter((shortcut) => shortcut.isAvailable?.() !== false), write, release);
	const infoOverlay = new InfoOverlay(() => describeSession(context, cwd, requests, sessionStart, state.update, state.updateLink), write, release, () => qrCode, () => readProjectReport(cwd));
	const views = [
		overlay,
		trafficOverlay,
		routeOverlay,
		helpOverlay,
		infoOverlay
	];
	const openOverlay = () => views.find((view) => view.isOpen);
	let animation;
	let animationInterval = 120;
	let activityTimer;
	let reported;
	let noticeTimer;
	let loadFailed = false;
	function update(patch) {
		Object.assign(state, patch);
		state.lastRequest = requests.last();
		state.requests = requests.total || void 0;
		state.medianMs = requests.total ? requests.medianDuration() : void 0;
		syncAnimation();
		render();
	}
	function refresh() {
		update({});
	}
	session.onProgressChange(refresh);
	function advanceFrame() {
		const working = state.status !== "ready" && state.status !== "error";
		update({
			frame: (state.frame ?? 0) + 1,
			elapsedMs: working ? Date.now() - (state.loadStartedAt ?? sessionStart) : state.elapsedMs,
			phaseElapsedMs: working && state.phaseStartedAt !== void 0 ? Date.now() - state.phaseStartedAt : state.phaseElapsedMs,
			renderingMs: state.rendering && Date.now() - state.rendering.startedAt
		});
	}
	function syncAnimation() {
		const working = (state.status !== "ready" && state.status !== "error" || !!state.task || !!state.rendering) && !openOverlay();
		const interval = state.status === "warming" || state.rendering ? 480 : 120;
		if (working && animation && interval !== animationInterval) {
			clearInterval(animation);
			animation = void 0;
		}
		if (working && !animation) {
			animationInterval = interval;
			animation = setInterval(advanceFrame, interval);
			animation.unref?.();
		} else if (!working && animation) {
			clearInterval(animation);
			animation = void 0;
		}
	}
	const heldNotices = [];
	function clearNotice() {
		const held = heldNotices.at(-1);
		update({ notice: held ? {
			text: held.text,
			tone: held.tone,
			label: held.label
		} : void 0 });
	}
	function dismissHeld(held) {
		const index = heldNotices.indexOf(held);
		if (index === -1) return;
		heldNotices.splice(index, 1);
		held.resolve();
		clearNotice();
	}
	function holdNotice(notice) {
		let resolve;
		const dismissed = new Promise((settle) => {
			resolve = settle;
		});
		const held = {
			...notice,
			text: notice.text.split("\n")[0].trim(),
			resolve
		};
		heldNotices.push(held);
		clearTimeout(noticeTimer);
		clearNotice();
		return {
			dismiss: () => dismissHeld(held),
			dismissed
		};
	}
	function showNotice(text, tone) {
		clearTimeout(noticeTimer);
		update({ notice: {
			text: text.split("\n")[0].trim(),
			tone
		} });
		noticeTimer = setTimeout(clearNotice, NOTICE_MS);
		noticeTimer.unref?.();
	}
	function clearActivity() {
		update({ active: false });
	}
	const repaintTicker = createTickerRepainter(refresh);
	function clearHistory() {
		events.clear();
		requests.clear();
		loadFailed = false;
		update({
			failures: 0,
			...state.status === "error" ? {
				status: "ready",
				note: void 0
			} : {}
		});
	}
	events.onClear(() => acknowledgeLogs());
	events.onEvent((event, merged) => {
		if (merged) return;
		if (isBoxedNotice(event)) {
			holdNotice({
				text: firstSentence(event.message),
				tone: "warn",
				label: "ACTION"
			});
			return;
		}
		if (event.level <= 0) {
			loadFailed ||= LOADING_STATUSES.has(state.status);
			update({
				errors: (state.errors ?? 0) + 1,
				status: "error",
				...state.status === "error" ? {} : { note: void 0 }
			});
		} else if (event.level === 1) {
			if (event.source === "cli") {
				if (state.readyMs === void 0) holdNotice({
					text: firstSentence(event.message),
					tone: "warn",
					label: "WARNING"
				});
				else showNotice(event.message, "warn");
			} else update({ warnings: (state.warnings ?? 0) + 1 });
		}
	});
	context.onReady(() => {
		ready = true;
		if (armedOpen && context.listener) {
			armedOpen = false;
			openBrowser(context.listener.url);
			syncHints();
		}
		const warming = state.status === "warming";
		syncHints();
		update({
			status: warming ? "warming" : "ready",
			note: warming ? state.note : void 0,
			progress: warming ? state.progress : void 0,
			readyMs: state.readyMs ?? startupElapsedMs(options.startTime ?? sessionStart),
			urls: describeURLs(context)
		});
		resolveQRCode(context).then((code) => {
			qrCode = code;
		});
	});
	resolveUpdate(version).then((latest) => {
		if (!latest) return;
		const notes = releaseNotesUrl("nuxt", latest);
		const label = `\u2192 ${latest}`;
		update({
			update: latest,
			updateLink: notes ? terminalLink(label, notes) : label
		});
	});
	const quit = (signal = "SIGINT") => {
		session.teardown({ keep: true });
		if (!isShutdownAdopted()) process.exit(signal === "SIGQUIT" ? 131 : 130);
		process.emit(signal);
	};
	const settleRestart = () => update({
		status: loadFailed ? "error" : "ready",
		note: void 0
	});
	const restart = async (options = {}) => {
		if (!context.restart) return;
		update({
			status: "restarting",
			note: options.clearCache ? "clearing caches and restarting" : void 0
		});
		try {
			if (options.clearCache) {
				const cleared = await context.clearCaches?.();
				if (cleared?.length) surfaceText(`${styleText("green", "cleared")} ${styleText(MUTED, cleared.join(", "))}`);
			}
			await context.restart();
		} catch (error) {
			showNotice(`could not restart: ${error instanceof Error ? error.message : error}`, "warn");
		} finally {
			if (state.status === "restarting") settleRestart();
		}
	};
	shortcuts = [
		{
			keys: ["r"],
			isAvailable: () => !!context.restart,
			hint: "restart",
			priority: 80,
			description: "restart the dev server",
			action: () => void restart()
		},
		{
			keys: ["R"],
			sequence: "R",
			isAvailable: () => !!context.restart && !!context.clearCaches,
			description: "restart with a cleared cache",
			action: () => void restart({ clearCache: true })
		},
		{
			keys: ["o"],
			hint: "open",
			priority: 40,
			description: "open in browser",
			isArmed: () => armedOpen,
			action: () => open()
		},
		{
			keys: ["y"],
			description: "copy the server URL to the clipboard",
			action: () => void copyURL(context, showNotice)
		},
		{
			keys: ["c"],
			description: "clear the console without deleting history",
			action: () => clearConsole(surface)
		},
		{
			keys: ["x"],
			description: "delete log and request history",
			action: clearHistory
		},
		{
			keys: ["e"],
			description: "open the logs at the last error",
			action: () => {
				surface.screenMode = "alternate-screen";
				overlay.openAtLastError();
			}
		},
		{
			keys: ["i", "u"],
			hint: "info",
			priority: 50,
			description: "show versions, URLs, QR code and session info",
			action: () => openView(infoOverlay)
		},
		{
			keys: ["l"],
			hint: "logs",
			priority: 70,
			description: "browse the log history",
			action: () => openView(overlay)
		},
		{
			keys: ["n"],
			hint: "network",
			priority: 60,
			description: "browse served requests",
			action: () => openView(trafficOverlay)
		},
		{
			keys: ["p"],
			hint: "routes",
			priority: 30,
			description: "browse pages and server routes",
			action: () => openView(routeOverlay)
		},
		{
			keys: ["?", "h"],
			hint: "help",
			priority: 100,
			description: "show this help",
			action: () => openView(helpOverlay)
		},
		{
			keys: ["q"],
			hint: "quit",
			priority: 90,
			description: "quit",
			action: () => quit()
		},
		{
			keys: [],
			ctrl: "c",
			description: "quit (press again during cleanup to force exit)",
			action: () => quit()
		},
		{
			keys: [],
			ctrl: "d",
			description: "quit",
			action: () => quit()
		},
		{
			keys: [],
			ctrl: "l",
			description: "clear the console or redraw the current view",
			action: () => {
				const active = openOverlay();
				if (active) active.repaint();
				else clearConsole(surface);
			}
		},
		{
			keys: [],
			ctrl: "r",
			isAvailable: () => !!context.restart,
			description: "restart the dev server",
			action: () => {
				openOverlay()?.close();
				restart();
			}
		},
		...process.platform === "win32" ? [] : [{
			keys: [],
			ctrl: "z",
			description: "suspend (resume with fg)",
			action: () => suspend()
		}, {
			keys: [],
			ctrl: "\\",
			description: "quit with SIGQUIT",
			action: () => quit("SIGQUIT")
		}]
	];
	function open() {
		if (ready && context.listener) {
			openBrowser(context.listener.url);
			return;
		}
		armedOpen = !armedOpen;
		syncHints();
	}
	function syncHints() {
		update({
			hints: shortcuts.filter((shortcut) => !!shortcut.hint && shortcut.isAvailable?.() !== false).map(({ keys, hint, priority, isArmed }) => ({
				key: keys[0],
				label: hint,
				priority,
				armed: isArmed?.()
			})),
			hintsDimmed: false
		});
	}
	syncHints();
	function openView(view) {
		surface.screenMode = "alternate-screen";
		view.open();
	}
	const onKey = (key) => {
		const active = openOverlay();
		for (const held of [...heldNotices]) dismissHeld(held);
		if (key.meta) return;
		if (key.ctrl) {
			const shortcut = shortcuts.find((shortcut) => shortcut.ctrl === key.name);
			if (shortcut?.isAvailable?.() === false) return showNotice("shortcut is not available yet", "info");
			return shortcut?.action();
		}
		if (active) return active.handleKey(key);
		const shortcut = shortcuts.find(({ sequence }) => sequence && sequence === key.sequence) ?? shortcuts.find(({ keys, sequence }) => !sequence && (!!key.name && !key.shift && keys.includes(key.name) || !!key.sequence && keys.includes(key.sequence)));
		if (shortcut?.isAvailable?.() === false) return showNotice("shortcut is not available yet", "info");
		shortcut?.action();
	};
	let detach = attachKeys(onKey);
	let torn = false;
	let resumeTerminal;
	let terminalHolds = 0;
	let resumeSurface;
	function holdTerminal() {
		if (terminalHolds++ === 0) {
			openOverlay()?.close();
			detach();
			resumeSurface = surface.suspend();
		}
		return () => {
			if (--terminalHolds === 0) {
				resumeSurface?.();
				resumeSurface = void 0;
				if (!torn) {
					detach = attachKeys(onKey, { ignoreBufferedInput: true });
					render();
				}
			}
		};
	}
	function suspend() {
		if (process.platform === "win32" || torn || resumeTerminal) return;
		resumeTerminal = holdTerminal();
		process.kill(process.pid, "SIGSTOP");
	}
	function onContinue() {
		if (!resumeTerminal) return;
		resumeTerminal();
		resumeTerminal = void 0;
	}
	if (process.platform !== "win32") {
		process.on("SIGTSTP", suspend);
		process.on("SIGCONT", onContinue);
	}
	async function lendTerminal(work) {
		const resume = holdTerminal();
		try {
			return await work();
		} finally {
			resume();
		}
	}
	let terminalQueue = Promise.resolve();
	const borrowScope = new AsyncLocalStorage();
	const tasks = [];
	function syncTasks() {
		update({ task: tasks.at(-1) });
	}
	const releaseHost = registerTerminalHost({
		version: 1,
		withTerminal: (work) => {
			if (borrowScope.getStore()) return work();
			const result = terminalQueue.then(() => lendTerminal(() => borrowScope.run(true, work)));
			terminalQueue = result.catch(() => {});
			return result;
		},
		notify: (notification) => {
			surfaceText(renderNotification(notification));
			events.push({
				time: Date.now(),
				level: 3,
				type: "info",
				message: [notification.title, notification.message].filter(Boolean).join("\n"),
				source: "cli"
			});
			return holdNotice({
				text: notification.title ?? notification.message,
				tone: notification.level === "warn" ? "warn" : "info"
			});
		},
		startTask: (label) => {
			const task = {
				label,
				startedAt: Date.now()
			};
			tasks.push(task);
			syncTasks();
			return {
				update: (text) => {
					task.label = text;
					syncTasks();
				},
				stop: (message, outcome) => {
					const index = tasks.indexOf(task);
					if (index !== -1) tasks.splice(index, 1);
					syncTasks();
					if (!message) return;
					showNotice(message, outcome === "failure" ? "warn" : "success");
					events.push({
						time: Date.now(),
						level: outcome === "failure" ? 0 : 3,
						type: outcome === "failure" ? "error" : "success",
						message,
						source: "cli"
					});
				}
			};
		}
	});
	session.onTeardown(() => {
		torn = true;
		process.off("SIGTSTP", suspend);
		process.off("SIGCONT", onContinue);
		onContinue();
		clearInterval(animation);
		clearTimeout(activityTimer);
		clearTimeout(noticeTimer);
		animation = void 0;
		releaseHost();
		for (const held of [...heldNotices]) dismissHeld(held);
		detach();
		openOverlay()?.close();
	});
	refresh();
	const controller = {
		interactive: true,
		settleRestart,
		setStatus: (status, note) => {
			if (status === "ready") {
				loadFailed = false;
				update({
					status,
					note: void 0,
					progress: void 0,
					phaseStartedAt: void 0,
					phaseElapsedMs: void 0,
					errors: 0,
					warnings: 0,
					failures: 0
				});
				return;
			}
			update({
				status,
				note,
				...state.status === "ready" || state.status === "error" ? {
					loadStartedAt: Date.now(),
					elapsedMs: 0,
					progress: void 0,
					phaseStartedAt: void 0,
					phaseElapsedMs: void 0
				} : {}
			});
		},
		pushServerLog: (log) => {
			session.expectRender(events.push({
				time: Date.now(),
				level: log.level,
				type: log.logType,
				tag: log.tag,
				message: log.message,
				request: log.request,
				requestId: log.requestId,
				source: log.origin ?? "build"
			}, { route: log.raw ? "reporter" : "report" }));
		},
		pushRequests: (batch) => {
			if (!batch.length) return;
			requests.push(batch.map((request) => ({
				time: Date.now(),
				...request
			})));
			const app = batch.filter((request) => !request.internal);
			const failed = app.filter((request) => request.status >= 500);
			const failing = (app.at(-1)?.status ?? 0) >= 500;
			const recovered = app.length > 0 && !failing && state.status === "error" && !loadFailed;
			const failureNote = failing && !loadFailed ? "a request failed · press n to trace it" : void 0;
			update({
				active: true,
				failures: (state.failures ?? 0) + failed.length,
				status: failing ? "error" : recovered ? "ready" : state.status,
				note: failureNote ?? (recovered ? void 0 : state.note)
			});
			repaintTicker();
			clearTimeout(activityTimer);
			activityTimer = setTimeout(clearActivity, ACTIVITY_MS);
			activityTimer.unref?.();
		},
		pushSpans: (spans) => requests.pushSpans(spans),
		pushReport: (report) => {
			reported = report.id;
			update({
				status: "error",
				note: `${report.message} · press l to read it`
			});
			events.push({
				time: Date.now(),
				level: 0,
				type: "error",
				message: report.ansi,
				rendered: report.ansi,
				styled: true,
				source: "runtime",
				request: report.request,
				requestId: report.requestId
			});
		},
		clearReport: (id) => {
			if (id !== void 0 && id !== reported) return;
			reported = void 0;
			update({ note: void 0 });
		},
		setRoutes: (payload) => routeOverlay.setRoutes(payload),
		setRendering: (pending, awaiting) => {
			update({
				rendering: pending && {
					label: pending.label,
					startedAt: pending.startedAt
				},
				renderingMs: pending && Date.now() - pending.startedAt,
				...awaiting === void 0 ? {} : { awaitingFirstRender: awaiting }
			});
		}
	};
	attached.set(session, controller);
	return controller;
}
function createTickerRepainter(render) {
	let last = 0;
	let timer;
	return () => {
		if (timer) return;
		const wait = Math.max(0, TICKER_REPAINT_MS - (Date.now() - last));
		timer = setTimeout(() => {
			timer = void 0;
			last = Date.now();
			render();
		}, wait);
		timer.unref?.();
	};
}
function clearConsole(surface) {
	withDirectStdout(() => process.stdout.write("\x1B[2J\x1B[3J\x1B[H")).then(() => {
		surface.resetRows();
		surface.padToBottom();
	});
}
async function copyURL(context, notify) {
	const url = context.listener?.publicURL || context.listener?.url;
	if (!url) {
		notify("no server to copy the url of yet", "warn");
		return;
	}
	if (await writeClipboard(url)) notify(`copied ${url} to the clipboard`, "success");
	else notify("no clipboard available", "warn");
}
function describeURLs(context) {
	const { listener } = context;
	if (!listener) return [];
	const urls = describeListenURLs(listener.getURLs());
	if (listener.publicURL && !urls.some((entry) => entry.url === listener.publicURL)) urls.push({
		label: URL_LABELS.public,
		url: listener.publicURL,
		link: terminalLink(listener.publicURL, listener.publicURL),
		style: URL_STYLES.public
	});
	return urls;
}
function describeSession(context, cwd, requests, sessionStart, update, updateLink) {
	const versions = resolveStackVersions(cwd);
	const { listener } = context;
	return [
		{
			heading: "versions",
			entries: [
				["Nuxt", update ? `${linkVersion(versions.nuxt)} ${paint("warning", updateLink ?? `\u2192 ${update} available`)}` : linkVersion(versions.nuxt)],
				["Nitro", versions.nitro],
				[versions.builder.name, versions.builder.version],
				[versions.builder.provider?.name ?? "via", versions.builder.provider?.version],
				["Vue", versions.vue ?? void 0],
				["Node", process.version.replace(/^v/, "")]
			]
		},
		{
			heading: "urls",
			entries: [...listener?.getURLs().map(({ type, url }) => [
				type,
				url,
				URL_STYLES[type]
			]) ?? [], [
				"public",
				listener?.publicURL,
				URL_STYLES.public
			]]
		},
		{
			heading: "session",
			entries: [
				["uptime", formatDuration(Date.now() - sessionStart)],
				["requests", String(requests.total)],
				["median", requests.total ? formatDuration(requests.medianDuration()) : void 0],
				["directory", cwd]
			]
		}
	];
}
function firstSentence(message) {
	return normaliseMessage(message).split(". ")[0];
}
function renderNotification({ title, message, level }) {
	const mark = level === "warn" ? styleText(["yellow", "bold"], "⚠") : styleText("cyan", "ℹ");
	return `${title ? `${mark} ${styleText("bold", title)}\n` : ""}${message}`;
}
function linkVersion(version) {
	const notes = releaseNotesUrl("nuxt", version);
	return notes ? terminalLink(version, notes) : version;
}
async function resolveQRCode(context) {
	const url = context.listener?.qrURL || context.listener?.getURLs().find(({ type }) => type !== "local")?.url;
	if (!url) return;
	const { renderUnicodeCompact } = await import("uqr");
	return renderUnicodeCompact(url);
}
async function resolveUpdate(current) {
	if (!current) return;
	try {
		const { checkForUpdate, isUpdateCheckEnabled } = await import("./update-check-DC_pUt-A.mjs");
		if (!isUpdateCheckEnabled()) return;
		return (await checkForUpdate("nuxt", current))?.latest;
	} catch {
		return;
	}
}
//#endregion
export { setupDevUI };
