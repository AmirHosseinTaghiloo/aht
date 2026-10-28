import { C as KEEPS_PROCESS_ALIVE, a as registerTerminalHost, f as setLoggerImpl, l as isEmittingCliLog, s as debug, t as startupElapsedMs } from "./startup-clock-DXZlxuSA.mjs";
import { a as rememberBackground, o as resolveBackground } from "./terminal-theme-BUtyan0v.mjs";
import "./progress-snapshot-BsUn_089.mjs";
import { n as currentRequest } from "./serving-state-Cts7VBoa.mjs";
import { i as stripAnsi } from "./formatting-Co5DEjad.mjs";
import { i as isShutdownAdopted } from "./shutdown-BavsC3O_.mjs";
import { a as PanelSurface, c as describeListenURLs, i as resolveNuxtVersion, r as renderPanelState, t as createPanelState } from "./first-frame-BfGM-BAA.mjs";
import { t as resolveDevUISupport } from "./support-Dvae58g8.mjs";
import process from "node:process";
import { formatWithOptions, styleText } from "node:util";
import { isCI, isTest } from "std-env";
import { consola } from "consola";
import { Buffer } from "node:buffer";
//#region src/dev/tui/events.ts
/**
* Badges that tools print themselves, in the order they are tested.
*
* Output arriving as plain text has already been formatted by whatever produced
* it, so its severity only exists in the text.
*/
const BADGES = [
	{
		pattern: /^\s*fatal\b[\s:]*/i,
		level: 0,
		type: "fatal"
	},
	{
		pattern: /^\s*err(?:or)?\b[\s:]*/i,
		level: 0,
		type: "error"
	},
	{
		pattern: /^\s*warn(?:ing)?\b[\s:]*/i,
		level: 1,
		type: "warn"
	}
];
/**
* Text as it reads, so a difference in padding cannot make two logs distinct.
* Backticks go too: a structured report keeps its markdown quoting while the
* printed form renders it, and the same words must compare equal either way.
*/
function normaliseMessage(text) {
	return stripAnsi(text).replaceAll("`", "").replace(/\s+/g, " ").trim();
}
/**
* Box drawing and the ASCII fallback's `>` gutter, so a boxed log can be
* recognised as the printed form of the message it was built from. The borders
* sit between every line of the message, which plain containment cannot see
* past.
*/
const BOX_DECORATION_RE = /[\u2500-\u257F]|^[ \t]*>[ \t]?/gm;
/** Text as it reads with any box the printer drew around it taken off. */
function undecorate(text) {
	return normaliseMessage(stripAnsi(text).replaceAll(BOX_DECORATION_RE, " "));
}
/**
* Whether the event is asking the user for something rather than reporting.
*
* A tool only draws a box around output it needs read, and what is inside is
* usually a URL to open or a token to paste: useless unheeded, and useless
* truncated onto a status line. Tools that know the terminal host say so
* through `notify` instead; a box is how everything else says it.
*/
function isBoxedNotice(event) {
	return event.type === "box";
}
/** Record an arrival of `event` by `route`, up to the occurrences on record. */
function noteRoute(event, route) {
	const routes = event.routes;
	routes?.set(route, Math.min((routes.get(route) ?? 0) + 1, Math.max(occurrences(event), 1)));
}
/** How many times heard, by the route that has heard it most. */
function occurrences(event) {
	let heard = 0;
	for (const count of event.routes?.values() ?? []) heard = Math.max(heard, count);
	return heard;
}
/** Either text may carry a badge the other does not, so neither has to be exact. */
function sameMessage(a, b) {
	return a.includes(b) || b.includes(a);
}
/**
* The core complaint of an error, for recognising the same problem described
* by different tools. Each wraps it in its own prose (`Internal server error:
* …`, `/pages/index.vue — …`, `[plugin] …`) and follows it with its own
* stack or code frame, so whole-text containment cannot pair them; the first
* line with the wrapping removed can.
*/
function errorSignature(message) {
	const first = stripAnsi(message).split("\n", 1)[0].replace(/^\s*\[[^\]]+\]\s*/, "").replace(/^\s*(?:internal server error|pre-transform error|transform failed|error|fatal)\s*:\s*/i, "").replace(/^\s*\S+ — /, "").replace(/[`\s]+/g, " ").trim();
	return first.length >= 10 ? first.toLowerCase() : void 0;
}
/**
* Recover the severity of an event whose level says nothing, since anything a
* tool writes to stdout reaches us as a generic log.
*
* Badges usually arrive wrapped in colour, so matching happens against plain
* text. Only an uncoloured badge is cut from the message: slicing through an
* escape sequence would drop the reset and leave the rest of the line styled.
*
* A boxed notice already knows what it is, and inferring a severity from its
* opening words would rewrite it into a warning that no longer reaches the
* panel as one.
*/
function classify(event) {
	if (event.level < 2 || isBoxedNotice(event)) return event;
	const plain = stripAnsi(event.message);
	for (const { pattern, level, type } of BADGES) {
		const match = plain.match(pattern);
		if (match) {
			const message = plain === event.message ? event.message.slice(match[0].length) : event.message;
			return {
				...event,
				level,
				type,
				message
			};
		}
	}
	return event;
}
/** Indices of the first and last of the fewest consecutive `logs` that print `message`. */
function printedSpan(logs, message) {
	const target = normaliseMessage(message);
	const holds = (start, end) => {
		const plain = logs.slice(start, end + 1).map((log) => log.message).join("\n");
		return normaliseMessage(plain).includes(target) || undecorate(plain).includes(target);
	};
	if (!target || !logs.length || !holds(0, logs.length - 1)) return;
	let low = 0;
	let high = logs.length - 1;
	while (low < high) {
		const mid = low + high >> 1;
		if (holds(0, mid)) high = mid;
		else low = mid + 1;
	}
	const end = low;
	low = 0;
	while (low < high) {
		const mid = low + high + 1 >> 1;
		if (holds(mid, end)) low = mid;
		else high = mid - 1;
	}
	return [low, end];
}
/** How far back a merge or pairing looks for a match. */
const RECENT_SCAN = 20;
/**
* How close together two reports of the same problem have to be to collapse
* into one entry. Vite, the Vue plugin and Nitro each describe a failing
* transform in their own words within a few hundred milliseconds, and every
* request to a broken page repeats all of them.
*/
const DEDUPE_WINDOW_MS = 3e3;
/**
* Structured log history for the dev session, independent of what was printed.
*
* The terminal shows formatted output as it always has; this is the backing
* store for everything that interrogates the past: the error badge, the jump
* to the last error, retroactive filtering and the log view.
*/
var DevEventLog = class {
	#events = [];
	#listeners = /* @__PURE__ */ new Set();
	#clearListeners = /* @__PURE__ */ new Set();
	#capacity;
	constructor(capacity = 1e4) {
		this.#capacity = capacity;
	}
	/**
	* Record `event`, returning it as stored so callers can amend it later.
	*
	* An event with a `route` joins the entry the same log already made by
	* another one; one without always stands alone.
	*/
	push(event, options = {}) {
		const { route } = options;
		const merged = route && this.#join(event, route);
		if (merged) return merged;
		const stored = classify(event);
		if (route) stored.routes = /* @__PURE__ */ new Map([[route, 1]]);
		const deduped = this.#dedupe(stored);
		if (deduped) return deduped;
		this.#events.push(stored);
		if (this.#events.length > this.#capacity) this.#events.splice(0, this.#events.length - this.#capacity);
		for (const listener of this.#listeners) listener(stored);
		return stored;
	}
	/**
	* Attach printed logs to the events waiting for them, `owner` first,
	* returning the rest.
	*
	* A log forwarded from a fork arrives over IPC while its output arrives down a
	* pipe, so the two cannot be paired by ordering alone.
	*/
	attachRendered(logs, owner) {
		const event = owner ?? (logs.length ? this.#awaitingOutput(logs.map((log) => log.message).join("\n")) : void 0);
		const span = event && printedSpan(logs, event.message);
		if (!event || !span) return logs;
		const [start, end] = span;
		event.rendered ??= logs.slice(start, end + 1).map((log) => log.rendered).join("");
		noteRoute(event, "output");
		return [...this.attachRendered(logs.slice(0, start)), ...this.attachRendered(logs.slice(end + 1))];
	}
	#awaitingOutput(plain, withinMs = 500) {
		const text = normaliseMessage(plain);
		if (!text) return;
		const boxed = undecorate(plain);
		const now = Date.now();
		for (let index = this.#events.length - 1; index >= 0 && index > this.#events.length - RECENT_SCAN; index--) {
			const event = this.#events[index];
			if (now - event.time > withinMs) return;
			const message = normaliseMessage(event.message);
			if (message && (text.includes(message) || boxed.includes(message)) && (!event.rendered || isBoxedNotice(event))) return event;
		}
	}
	/**
	* Fold `event` into the entry the same log already made by another route.
	*
	* The report is the fullest account of a log, then the reporter's, and
	* whatever was printed is kept throughout: it is what the log view shows.
	* Two requests can log the same line at once, so the entry written for the
	* same request is preferred and one held by another request is refused.
	* Printed output is exempt, being attributed when the capture is flushed,
	* which can be on another request's call stack.
	*/
	#join(event, route) {
		/** An occurrence is still waiting to be heard by `route`. */
		const open = (candidate) => !!candidate.routes && (candidate.routes.get(route) ?? 0) < occurrences(candidate);
		const attributed = (candidate) => route !== "output" && !(candidate.routes.size === 1 && candidate.routes.has("output"));
		const sameRequest = (candidate) => {
			if (!attributed(candidate)) return true;
			if (candidate.requestId !== void 0 && event.requestId !== void 0) return candidate.requestId === event.requestId;
			return candidate.request === void 0 || event.request === void 0 || candidate.request === event.request;
		};
		const apply = (candidate) => {
			const routes = candidate.routes;
			const rendered = candidate.rendered ?? event.rendered;
			if (route === "report") Object.assign(candidate, event);
			else if (route === "reporter" && !routes?.has("report")) Object.assign(candidate, event);
			candidate.rendered = rendered;
			candidate.routes = routes;
			noteRoute(candidate, route);
		};
		if (event.requestId !== void 0) {
			const exact = this.#merge(event, (candidate) => open(candidate) && candidate.requestId === event.requestId, apply);
			if (exact) return exact;
		}
		return this.#merge(event, (candidate) => open(candidate) && sameRequest(candidate), apply);
	}
	/**
	* Collapse another report of a problem already on record into that record.
	*
	* One broken transform is described by every tool that meets it, each in its
	* own words, and again on every request. The entry keeps the longest wording
	* (the one with the file and the stack) and counts the rest.
	*/
	#dedupe(event) {
		if (event.level > 1 && !isBoxedNotice(event)) return;
		const signature = errorSignature(event.message);
		const sameProblem = (candidate) => !!signature && signature === errorSignature(candidate.message);
		const matches = isBoxedNotice(event) ? isBoxedNotice : (candidate) => candidate.level <= 1 || isBoxedNotice(candidate);
		return this.#merge(event, matches, (candidate) => {
			candidate.repeats = (candidate.repeats ?? 1) + 1;
			if (normaliseMessage(candidate.message).length < normaliseMessage(event.message).length) {
				candidate.message = event.message;
				candidate.rendered = event.rendered ?? candidate.rendered;
			}
			candidate.requestId ??= event.requestId;
			candidate.request ??= event.request;
			for (const [route, count] of event.routes ?? []) {
				candidate.routes ??= /* @__PURE__ */ new Map();
				candidate.routes.set(route, (candidate.routes.get(route) ?? 0) + count);
			}
		}, DEDUPE_WINDOW_MS, sameProblem);
	}
	/**
	* The most recent event saying the same thing, updated in place.
	*
	* A match is consumed rather than filtered against, so two logs that happen to
	* say the same thing pair off one to one instead of collapsing into one.
	*/
	#merge(event, matches, apply, withinMs = 500, alsoSame) {
		const text = normaliseMessage(event.message);
		if (!text) return;
		const now = Date.now();
		for (let index = this.#events.length - 1; index >= 0 && index > this.#events.length - RECENT_SCAN; index--) {
			const candidate = this.#events[index];
			if (now - candidate.time > withinMs) return;
			if (matches(candidate) && (sameMessage(normaliseMessage(candidate.message), text) || alsoSame?.(candidate))) {
				apply(candidate);
				for (const listener of this.#listeners) listener(candidate, true);
				return candidate;
			}
		}
	}
	recent(count, filter) {
		return (filter ? this.#events.filter(filter) : this.#events).slice(-count);
	}
	onEvent(listener) {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}
	/** Drop the history, telling anyone counting or displaying it. */
	clear() {
		this.#events.length = 0;
		for (const listener of this.#clearListeners) listener();
	}
	onClear(listener) {
		this.#clearListeners.add(listener);
		return () => this.#clearListeners.delete(listener);
	}
};
//#endregion
//#region src/dev/tui/background.ts
/** OSC 11: report the background colour. */
const QUERY = "\x1B]11;?\x07";
/** How far a reply is recognisable before its payload begins. */
const REPLY_PREFIX = "\x1B]11;";
/** `ESC ] 11 ; rgb:RRRR/GGGG/BBBB` followed by BEL or ST. */
const REPLY_RE = /\u001B\]11;rgb:([0-9a-f]{1,4})\/([0-9a-f]{1,4})\/([0-9a-f]{1,4})(?:\u0007|\u001B\\)?/i;
/**
* Nothing waits on the answer, so this is generous: a reply that arrives after
* the wait is over would be read as keystrokes by whatever reads keys next.
* Terminals that answer at all do so in a millisecond or two.
*/
const REPLY_TIMEOUT_MS = 250;
/** Above this the background is treated as light. */
const LIGHT_THRESHOLD = .5;
let pending;
let held;
/**
* Settles when the query has given stdin back, or is undefined if nothing is
* holding it. A key reader must wait for this, or it parses the terminal's
* escape-sequence answer as a run of keystrokes.
*/
function whenStdinReleased() {
	return held;
}
/**
* Ask the terminal what colour its background is, and remember the answer.
*
* Most terminals answer an OSC 11 query in a millisecond or two; some ignore it
* and a few never had a reply to give. Nothing waits on the result: the panel
* paints in colours that are safe either way and repaints if an answer arrives,
* so a terminal that stays silent costs a 100ms timer and nothing else.
*/
function queryBackground(options) {
	pending ??= resolve(options).then((background) => {
		if (background !== "unknown") rememberBackground(background);
		return background;
	});
	return pending;
}
async function resolve(options) {
	const env = options.env ?? process.env;
	const known = resolveBackground(env);
	if (known !== "unknown" || !canAsk(options, env)) return known;
	const stdin = options.stdin ?? process.stdin;
	let releaseStdin;
	held = new Promise((settle) => {
		releaseStdin = () => {
			held = void 0;
			settle();
		};
	});
	try {
		const session = listen(stdin, options.timeout ?? REPLY_TIMEOUT_MS, () => options.write(QUERY), releaseStdin);
		const buffer = await session.typed;
		const answered = REPLY_RE.exec(buffer);
		const typed = answered ? buffer.replace(answered[0], "") : buffer;
		if (typed) stdin.unshift(Buffer.from(typed, "latin1"));
		if (typed.includes("")) process.emit("SIGINT");
		const reply = answered ?? REPLY_RE.exec(await session.reply);
		if (!reply) {
			debug("The terminal did not report a background colour");
			return "unknown";
		}
		return brightness(reply) > LIGHT_THRESHOLD ? "light" : "dark";
	} catch (error) {
		debug("Could not ask the terminal for its background:", error);
		return "unknown";
	} finally {
		releaseStdin();
	}
}
/**
* Ask the terminal, and hold stdin only for as long as nothing else needs it.
*
* Owning stdin is what makes a reply readable, but it is also what makes the
* keyboard dead, so the moment the first keystroke shows that someone is typing
* the stream is handed back and the rest of the wait is spent observing it: a
* `data` listener alongside the key reader sees the same bytes without taking
* them, and {@link filterTerminalReplies} keeps the reply out of the keys.
*/
function listen(stdin, timeout, ask, handOver) {
	const deadline = Date.now() + timeout;
	const wasRaw = !!stdin.isRaw;
	const wasPaused = stdin.isPaused();
	let buffer = "";
	let timer;
	let listening = true;
	let settleTyped;
	let settleReply;
	const typed = new Promise((resolve) => {
		settleTyped = resolve;
	});
	const reply = new Promise((resolve) => {
		settleReply = resolve;
	});
	const onData = (chunk) => {
		buffer += chunk.toString("latin1");
		if (REPLY_RE.test(buffer) || buffer.includes("") || !isReplyPrefix(buffer)) finish();
	};
	function observe() {
		let observed = "";
		let expiry;
		function stop() {
			clearTimeout(expiry);
			stdin.off("data", onObserved);
			settleReply(observed);
		}
		function onObserved(chunk) {
			observed += chunk.toString("latin1");
			if (REPLY_RE.test(observed)) stop();
		}
		expiry = setTimeout(stop, Math.max(0, deadline - Date.now()));
		expiry.unref?.();
		stdin.on("data", onObserved);
	}
	function finish() {
		if (!listening) return;
		listening = false;
		clearTimeout(timer);
		stdin.off("data", onData);
		if (!wasRaw) stdin.setRawMode?.(false);
		if (wasPaused) stdin.pause();
		handOver();
		if (REPLY_RE.test(buffer)) settleReply("");
		else observe();
		settleTyped(buffer);
	}
	timer = setTimeout(finish, timeout);
	timer.unref?.();
	stdin.setRawMode?.(true);
	stdin.resume();
	stdin.on("data", onData);
	ask();
	return {
		typed,
		reply
	};
}
/** Whether everything read so far could still be the terminal beginning to answer. */
function isReplyPrefix(buffer) {
	return buffer.length < 5 ? REPLY_PREFIX.startsWith(buffer) : buffer.startsWith(REPLY_PREFIX);
}
/**
* Whether asking is worth the keystrokes it might interrupt.
*
* GNU screen rewrites the sequence and never passes the reply back; inside tmux
* it is tmux that answers, which is the right answer for what is on screen.
*/
function canAsk(options, env) {
	const stdout = options.stdout ?? process.stdout;
	const stdin = options.stdin ?? process.stdin;
	if (!stdout.isTTY || !stdin.isTTY || env.NO_COLOR || env.TERM === "dumb") return false;
	if (env.TERM?.startsWith("screen") && !env.TMUX) return false;
	return !(options.ci ?? isCI) && !(options.test ?? isTest);
}
/**
* How bright the reported colour looks, 0 to 1.
*
* Weighted for how the eye sees each channel but left gamma-encoded, which puts
* the midpoint where a reader would put it: `#808080` reads as neither.
*/
function brightness([, ...channels]) {
	const [r, g, b] = channels.map((channel) => {
		const scale = 16 ** channel.length - 1;
		return Number.parseInt(channel, 16) / scale;
	});
	return .2126 * r + .7152 * g + .0722 * b;
}
//#endregion
//#region src/dev/tui/session.ts
const SHOW_CURSOR = "\x1B[?25h";
/** Long enough for a forwarded log to be paired with its printed output. */
const ERROR_SURFACE_DELAY_MS = 60;
/** Cursor movement and erasure: output that repaints rather than appends. */
const REWRITE_RE = /\r(?!\n)|\u001B\[[0-9;]*[A-GJK]/;
/** Sequences a settled line no longer needs: movement, erasure, visibility. */
const CURSOR_RE = /\u001B\[[0-9;]*[A-GJK]|\u001B\[\?25[hl]/g;
/**
* What a run of self-rewriting output leaves on screen: each line keeps only
* what follows its last carriage return, and the cursor control goes.
*/
function settleRewrites(plain) {
	return plain.replaceAll(CURSOR_RE, "").split("\n").map((line) => line.slice(line.lastIndexOf("\r") + 1)).join("\n");
}
/** How a printed log opens: a `[tag]`, a consola badge, or a consola icon or its non-unicode fallback. */
const LOG_START_RE = /^(?:\[[^\]\s]+\]\s| (?:FATAL|ERROR|WARN) {2}|[\u2139\u2714\u2716\u26A0\u2699\u2192\u25D0\u221A\u00D7\u203C] )/;
/** A badge, which consola prints with a blank line on either side. */
const FRAMED_RE = /^(?:\[[^\]\s]+\] )? (?:FATAL|ERROR|WARN) {2}/;
/**
* Split printed output into logs. A line that does not open a log, such as a
* stack frame, continues the one above. The `rendered` parts concatenate back
* to `chunk`.
*/
function splitLogs(chunk) {
	const logs = [];
	let blanks = [];
	for (const line of chunk.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
		const plain = stripAnsi(line).replace(/\n$/, "");
		if (!plain.trim()) {
			blanks.push(line);
			continue;
		}
		const last = logs.at(-1);
		if (last && !LOG_START_RE.test(plain)) {
			if (blanks.length) last.plain.push("");
			last.plain.push(plain);
			last.rendered += blanks.join("") + line;
		} else {
			const own = !last ? blanks.length : FRAMED_RE.test(plain) ? Math.min(1, blanks.length) : 0;
			if (last) last.rendered += blanks.slice(0, blanks.length - own).join("");
			logs.push({
				plain: [plain],
				rendered: blanks.slice(blanks.length - own).join("") + line
			});
		}
		blanks = [];
	}
	const last = logs.at(-1);
	if (last) last.rendered += blanks.join("");
	return logs.map((log) => ({
		message: log.plain.join("\n"),
		rendered: log.rendered
	}));
}
let current;
/** Point the running session at the project the resolved arguments name. */
let retargetCurrent;
/** Give the terminal back, if this process has taken it. */
function teardownDevUI() {
	current?.teardown();
}
/**
* Take over the terminal before anything is loaded.
*
* Nuxt, Nitro and Vite all print during startup, so the panel has to be in
* place and capturing before the dev server is initialised or the calm default
* view would begin with a screen of build output.
*/
function beginDevUI(options = {}) {
	const support = resolveDevUISupport(options);
	if (current) {
		if (support.reason === "flag" || support.reason === "inspector") {
			debug(`Interactive dev UI disabled: ${support.reason}`);
			current.teardown();
			return;
		}
		retargetCurrent?.(options);
		return current;
	}
	if (!support.enabled) {
		debug(`Interactive dev UI disabled: ${support.reason}`);
		return;
	}
	const cwd = options.cwd || process.cwd();
	const state = options.start?.state ?? createPanelState(options);
	const events = new DevEventLog();
	const surface = options.start?.surface ?? new PanelSurface();
	surface.onResize(() => render());
	queryBackground({ write: (chunk) => surface.writeRaw(chunk) }).then((background) => {
		if (background === "unknown" || background === state.background) return;
		state.background = background;
		render();
	});
	let awaiting;
	/** The entry the current run of self-rewriting frames is folded into. */
	let transient;
	let buffered = "";
	let flushTimer;
	let surfacing = [];
	let lastSurfacedError;
	let torn = false;
	let handlers = [];
	const teardownTasks = [];
	/** Text whose surface delay has not fired yet, keyed by that timer. */
	const pendingSurfaces = /* @__PURE__ */ new Map();
	const startupTicker = setInterval(() => {
		if (state.status === "ready" || state.status === "error") return;
		state.frame = (state.frame ?? 0) + 1;
		state.elapsedMs = startupElapsedMs(state.loadStartedAt ?? Date.now());
		state.phaseElapsedMs = state.phaseStartedAt === void 0 ? void 0 : Date.now() - state.phaseStartedAt;
		render();
	}, 120);
	startupTicker.unref?.();
	function stopStartupTicker() {
		clearInterval(startupTicker);
	}
	function render() {
		renderPanelState(surface, state);
	}
	const tasks = [];
	const releaseHost = registerTerminalHost({
		version: 1,
		withTerminal: async (work) => {
			const resume = surface.suspend();
			try {
				return await work();
			} finally {
				if (!torn) resume();
			}
		},
		startTask: (label) => {
			const task = {
				label,
				startedAt: Date.now()
			};
			tasks.push(task);
			state.task = tasks.at(-1);
			repaint();
			const forget = () => {
				const index = tasks.indexOf(task);
				if (index !== -1) tasks.splice(index, 1);
				state.task = tasks.at(-1);
				repaint();
			};
			return {
				update: (next) => {
					task.label = next;
					repaint();
				},
				stop: forget
			};
		}
	});
	teardownTasks.push(releaseHost);
	let progressListener;
	/** Repaint through the controller where one is attached, so it sees the change. */
	function repaint() {
		if (progressListener) {
			progressListener();
			return;
		}
		render();
	}
	function reportProgress(snapshot) {
		if (snapshot.status === "ready") {
			const waiting = !snapshot.serving && snapshot.message !== "Ready";
			state.awaitingFirstRender = !snapshot.serving;
			state.note = waiting ? snapshot.message : void 0;
			state.progress = waiting ? snapshot.progress : void 0;
			state.rendering = snapshot.pending && {
				label: snapshot.pending.label,
				startedAt: snapshot.pending.startedAt
			};
			state.renderingMs = snapshot.pending && Date.now() - snapshot.pending.startedAt;
			state.phaseStartedAt = void 0;
			state.phaseElapsedMs = void 0;
			if (state.status === "ready" || state.status === "warming") state.status = waiting ? "warming" : "ready";
			repaint();
			return;
		}
		if (snapshot.status !== "loading") return;
		Object.assign(state, {
			status: snapshot.reload ? "building" : "starting",
			note: snapshot.message,
			rendering: void 0,
			renderingMs: void 0,
			loadStartedAt: Date.now() - snapshot.elapsed,
			elapsedMs: snapshot.elapsed,
			phaseStartedAt: Date.now() - snapshot.phaseElapsed,
			phaseElapsedMs: snapshot.phaseElapsed,
			progress: snapshot.progress
		});
		render();
	}
	function reportListening(info) {
		if (state.readyMs !== void 0) return;
		state.urls = describeListenURLs(info.urls, { pending: !info.confirmed });
		render();
	}
	function surfaceText(text) {
		surfacing.push(text);
		if (surfacing.length > 1) return;
		queueMicrotask(() => {
			const pending = surfacing;
			surfacing = [];
			if (!pending.length) return;
			for (const chunk of pending) surface.writeAbove(chunk);
		});
	}
	function expectRender(event) {
		flushCapture();
		awaiting = event;
	}
	/**
	* Record everything captured since the last log event.
	*
	* A single log can reach the stream as several writes, so chunks are
	* accumulated until a new log event begins or the tick ends, and only then
	* split into logs.
	*/
	function flushCapture() {
		const chunk = buffered;
		const owner = awaiting;
		buffered = "";
		awaiting = void 0;
		if (!chunk) return;
		const rewriting = REWRITE_RE.test(chunk);
		if (owner) {
			transient = void 0;
			const rest = events.attachRendered(rewriting ? [] : splitLogs(chunk), owner);
			if (owner.rendered === void 0) {
				owner.rendered = chunk;
				noteRoute(owner, "output");
				return;
			}
			for (const log of rest) record(log.message, log.rendered);
			return;
		}
		const plain = stripAnsi(chunk);
		const message = (rewriting ? settleRewrites(plain) : plain).replace(/\n+$/, "");
		if (!message.trim()) return;
		if (rewriting && transient) {
			Object.assign(transient, {
				time: Date.now(),
				message,
				rendered: chunk
			});
			return;
		}
		if (rewriting) {
			transient = record(message, chunk);
			return;
		}
		transient = void 0;
		for (const log of events.attachRendered(splitLogs(chunk))) record(log.message, log.rendered);
	}
	/** Record printed output, returning the entry unless it merged into another. */
	function record(message, rendered) {
		const request = currentRequest();
		const event = {
			time: Date.now(),
			level: 2,
			type: "log",
			message,
			rendered,
			source: request ? "runtime" : "build",
			request: request?.label,
			requestId: request?.id
		};
		return events.push(event, { route: "output" }) === event ? event : void 0;
	}
	function surfaceLater(event, fallback) {
		event.surfaced = true;
		const render = () => event.rendered ?? fallback;
		const timer = setTimeout(() => {
			pendingSurfaces.delete(timer);
			surfaceText(render());
		}, ERROR_SURFACE_DELAY_MS);
		timer.unref?.();
		pendingSurfaces.set(timer, render);
	}
	function surfaceEvent(event) {
		const text = normaliseMessage(event.message);
		if (event.surfaced || !text) return;
		if (isBoxedNotice(event)) return surfaceLater(event, `${event.message}\n`);
		if (state.readyMs !== void 0) return;
		if (event.level <= 0 && text !== lastSurfacedError) {
			lastSurfacedError = text;
			surfaceLater(event, `${styleText(["red", "bold"], "ERROR")} ${event.message}`);
		} else if (event.level === 1 && event.source === "cli") surfaceLater(event, `${styleText(["yellow", "bold"], "WARN")} ${event.message}`);
	}
	const reporter = { log(logObj) {
		const cli = isEmittingCliLog();
		const request = cli ? void 0 : currentRequest();
		expectRender(events.push({
			time: Date.now(),
			level: logObj.level,
			type: logObj.type,
			tag: logObj.tag || void 0,
			message: formatWithOptions({ colors: false }, ...logObj.args),
			source: cli ? "cli" : request ? "runtime" : "build",
			request: request?.label,
			requestId: request?.id
		}, { route: cli ? void 0 : "reporter" }));
	} };
	function teardown(teardownOptions = {}) {
		if (torn) return;
		torn = true;
		current = void 0;
		retargetCurrent = void 0;
		stopStartupTicker();
		clearImmediate(flushTimer);
		const unsurfaced = [...pendingSurfaces.entries()];
		for (const [timer] of unsurfaced) clearTimeout(timer);
		flushCapture();
		for (const task of teardownTasks.toReversed()) task();
		surface.externalOutput = "passthrough";
		surface.writeRaw(SHOW_CURSOR);
		for (const [, render] of unsurfaced) surface.writeRaw(`${render()}\n`);
		surface.close({ keep: teardownOptions.keep });
		consola.removeReporter(reporter);
		setLoggerImpl();
		for (const [event, handler] of handlers) process.off(event, handler);
	}
	const session = {
		surface,
		events,
		state,
		render,
		surfaceText,
		expectRender,
		stopStartupTicker,
		reportProgress,
		onProgressChange: (listener) => {
			progressListener = listener;
		},
		reportListening,
		teardown,
		onTeardown: (task) => void teardownTasks.push(task)
	};
	events.onEvent(surfaceEvent);
	consola.addReporter(reporter);
	setLoggerImpl({
		info: (message) => consola.info(message),
		warn: (message) => consola.warn(message),
		error: (message) => consola.error(message),
		success: (message) => consola.success(message),
		step: (message) => consola.log(message),
		message: (message) => consola.log(message ?? "")
	});
	surface.onExternalOutput((chunk) => {
		buffered += chunk;
		if (flushTimer) return;
		flushTimer = setImmediate(() => {
			flushTimer = void 0;
			flushCapture();
		});
		flushTimer.unref?.();
	});
	surface.externalOutput = "capture";
	const onSignal = () => teardown({ keep: true });
	const onInterrupt = (code) => () => {
		teardown({ keep: true });
		if (!isShutdownAdopted()) process.exit(code);
	};
	const onHangup = () => {
		teardown({ keep: true });
		process.exit(129);
	};
	const onFatal = (error) => {
		if (process.listeners("uncaughtException").some((listener) => listener[KEEPS_PROCESS_ALIVE])) return;
		teardown();
		console.error(error);
		process.exit(1);
	};
	handlers = [
		["exit", onSignal],
		["SIGINT", onInterrupt(130)],
		["SIGTERM", onInterrupt(143)],
		["SIGQUIT", onInterrupt(131)],
		["SIGHUP", onHangup],
		["uncaughtException", onFatal]
	];
	for (const [event, handler] of handlers) process.on(event, handler);
	current = session;
	retargetCurrent = (next) => {
		const version = resolveNuxtVersion({
			version: next.version,
			cwd: next.cwd || cwd
		});
		if (version === state.version) return;
		state.version = version;
		render();
	};
	if (!options.start) {
		render();
		surface.padToBottom();
	}
	return session;
}
//#endregion
export { beginDevUI, isBoxedNotice as n, normaliseMessage as r, whenStdinReleased as t, teardownDevUI };
