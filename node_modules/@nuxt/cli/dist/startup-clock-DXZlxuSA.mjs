import { t as __exportAll } from "./rolldown-runtime-D7D4PA-g.mjs";
import process from "node:process";
import { styleText } from "node:util";
import { hasTTY, isCI, isTest } from "std-env";
import { S_ERROR, S_INFO, S_STEP_SUBMIT, S_SUCCESS, S_WARN, intro, log, outro } from "@clack/prompts";
import { createDebug } from "obug";
//#region src/utils/errors.ts
const REMOTE_PEER_ERROR_CODES = /* @__PURE__ */ new Set([
	"EPIPE",
	"ERR_STREAM_DESTROYED",
	"ECONNRESET",
	"ECONNABORTED",
	"ERR_STREAM_PREMATURE_CLOSE"
]);
/**
* An error whose message already contains everything the user needs: what went
* wrong and the command to run. The stack is replaced with the message so the
* terminal shows the advice rather than frames inside `dist`.
*/
var ActionableError = class extends Error {
	name = "ActionableError";
	constructor(message) {
		super(message);
		this.stack = message;
	}
};
/**
* Re-raise a Nuxt error by the remedy it carries rather than by its stack.
*
* Nuxt tags the errors it raises with `fix`, the command that resolves it, and
* `docs`, where the rest is explained. Those frames are all inside
* `node_modules` or this CLI's own `dist`, so the remedy is the whole of what a
* reader can act on. An untagged error is returned as it came.
*/
function asActionableError(error) {
	if (!(error instanceof Error)) return error;
	const { fix, docs } = error;
	if (typeof fix !== "string" || !fix.trim()) return error;
	const lines = [error.message, fix];
	if (typeof docs === "string" && docs.trim()) lines.push(`See ${docs}`);
	return new ActionableError(lines.join("\n"));
}
/**
* Errors that say something about the other end of a connection rather than
* about this process: a broken pipe, a client hanging up mid-request, a tab
* closed mid-navigation. These should not be reported as crashes or trigger
* a restart.
*/
function isRemotePeerError(error) {
	const code = error?.code;
	return !!code && REMOTE_PEER_ERROR_CODES.has(code);
}
/**
* Marks an `uncaughtException` listener that keeps the process alive (by
* replacing the crashed server) rather than letting it exit. The interactive
* dev UI leaves the terminal to such a listener instead of tearing down.
*/
const KEEPS_PROCESS_ALIVE = Symbol.for("nuxt:keeps-process-alive");
//#endregion
//#region src/utils/stdout.ts
var stdout_exports = /* @__PURE__ */ __exportAll({
	blankLineBefore: () => blankLineBefore,
	isInteractive: () => isInteractive,
	isInteractiveSession: () => isInteractiveSession,
	observeOutput: () => observeOutput,
	tapOutput: () => tapOutput,
	trackOutputSpacing: () => trackOutputSpacing,
	writeDirect: () => writeDirect,
	writeDirectTo: () => writeDirectTo
});
/** Whether this process is attached to a terminal a user can answer prompts on. */
function isInteractiveSession() {
	return !!process.stdin.isTTY && !isCI;
}
/**
* Whether a question can be asked and answered right now. `hasTTY` is required
* as well as an interactive session, so a prompt cannot be written into a
* redirected stdout where nobody will see it.
*/
function isInteractive() {
	return isInteractiveSession() && hasTTY && !isTest;
}
/** One blank line needs two newlines: one to end the last line, one to skip a row. */
const BLANK_LINE = 2;
/**
* How many newlines everything written so far ends with, capped at the most a
* caller can ask about. Starts at one because a shell hands us a cursor at the
* start of an empty line and nothing has been written to move it.
*/
let trailingNewlines = 1;
function isNewline(chunk, index) {
	return typeof chunk === "string" ? chunk[index] === "\n" : chunk[index] === 10;
}
/**
* Record `chunk` as written to stdout. Exported for the tracker's tests; every
* other caller should go through {@link trackOutputSpacing}.
*/
function observeOutput(chunk) {
	if (!chunk.length) return;
	let newlines = 0;
	while (newlines < chunk.length && isNewline(chunk, chunk.length - 1 - newlines)) newlines++;
	const total = newlines === chunk.length ? trailingNewlines + newlines : newlines;
	trailingNewlines = Math.min(total, BLANK_LINE);
}
/**
* The newlines to write before a block of output for it to be separated from
* whatever came before by exactly one blank line, wherever the cursor is now.
*/
function blankLineBefore() {
	return "\n".repeat(Math.max(0, BLANK_LINE - trailingNewlines));
}
/** The lowest `write` on the stream: below consola's line logger, if it is there. */
function baseWrite(stream) {
	return stream.__write ?? stream.write;
}
function installBaseWrite(stream, write) {
	if (stream.__write) stream.__write = write;
	else stream.write = write;
}
const taps = /* @__PURE__ */ new WeakMap();
/**
* Watch everything written to `stream`, and get a handle on the stream's own
* `write` to bypass both this wrapper and anything layered above it.
*
* More than one part of the CLI watches stdout at a time, so the wrapper is
* shared: a listener that uninstalled on the way out would take the others with
* it. It is reinstalled if anything else has replaced `write` since.
*/
function tapOutput(stream, listener) {
	let tap = taps.get(stream);
	if (!tap || baseWrite(stream) !== tap.wrapper) {
		const write = baseWrite(stream).bind(stream);
		const listeners = tap?.listeners ?? /* @__PURE__ */ new Set();
		const wrapper = ((chunk, encoding, callback) => {
			if (typeof chunk === "string" || chunk instanceof Uint8Array) for (const listener of [...listeners]) listener(chunk);
			return write(chunk, encoding, callback);
		});
		tap = {
			write,
			wrapper,
			listeners
		};
		taps.set(stream, tap);
		installBaseWrite(stream, wrapper);
	}
	tap.listeners.add(listener);
	return {
		write: tap.write,
		dispose: () => void tap.listeners.delete(listener)
	};
}
/**
* Watch stdout so {@link blankLineBefore} knows how much vertical space is
* already on screen. Every writer has to be seen for the count to be right, so
* this is installed as soon as something knows it will print later, and stays.
*/
function trackOutputSpacing() {
	tapOutput(process.stdout, observeOutput);
}
/**
* Write to stdout bypassing consola's line wrapping, for output that carries its
* own newlines (see {@link withDirectStdout}). Consola would trim the chunk,
* dropping any deliberate leading or trailing blank line.
*/
function writeDirect(chunk) {
	writeDirectTo(process.stdout, chunk);
}
/** {@link writeDirect} for an arbitrary standard stream. */
function writeDirectTo(stream, chunk) {
	const target = stream;
	(target.__write || target.write).call(stream, chunk);
}
//#endregion
//#region src/utils/logger.ts
/**
* A log line with no clack framing: the `│` gutter connects one prompt to the
* next on screen, and in a redirected log it is a bare column of punctuation
* between every line of real output.
*/
function plainLine(symbol, color, message) {
	const body = String(message ?? "").replace(/\n/g, "\n  ");
	writeDirect(`${styleText(color, symbol)} ${body}\n`);
}
const plain = {
	info: (message) => plainLine(S_INFO, "blue", message),
	warn: (message) => plainLine(S_WARN, "yellow", message),
	error: (message) => plainLine(S_ERROR, "red", message),
	success: (message) => plainLine(S_SUCCESS, "green", message),
	step: (message) => plainLine(S_STEP_SUBMIT, "green", message),
	message: (message) => writeDirect(`${String(message ?? "")}\n`)
};
function defaultImpl() {
	return !process.stdout.isTTY || isCI ? plain : log;
}
let impl;
let depth$1 = 0;
/**
* Whether the CLI itself is emitting a log right now.
*
* The app, its build tools and the CLI all log through consola, so a reporter
* cannot otherwise tell whose message it is holding. Checked synchronously,
* while the call is on the stack.
*/
function isEmittingCliLog() {
	return depth$1 > 0;
}
function emit(write) {
	depth$1++;
	try {
		return write();
	} finally {
		depth$1--;
	}
}
/**
* Swap the presentation of CLI logs, or restore the default when called with
* nothing. The interactive dev UI uses this to drop clack's connecting `│`
* guideline, which reads as a stray artefact next to a persistent footer.
*/
function setLoggerImpl(next) {
	impl = next;
}
const logger = {
	info: (message) => emit(() => (impl ?? defaultImpl()).info(message)),
	warn: (message) => emit(() => (impl ?? defaultImpl()).warn(message)),
	error: (message) => emit(() => (impl ?? defaultImpl()).error(message)),
	success: (message) => emit(() => (impl ?? defaultImpl()).success(message)),
	step: (message) => emit(() => (impl ?? defaultImpl()).step(message)),
	message: (message, options) => emit(() => (impl ?? defaultImpl()).message(message, options))
};
/**
* Open a command's output. Falls back to a bare headline where clack's opening
* corner would only introduce a gutter nothing draws against.
*/
function intro$1(message) {
	if (!process.stdout.isTTY || isCI) {
		writeDirect(`${message}\n`);
		return;
	}
	intro(message);
}
/** {@link intro}, for the line a command finishes on. */
function outro$1(message) {
	if (!process.stdout.isTTY || isCI) {
		writeDirect(`${styleText("green", S_SUCCESS)} ${message}\n`);
		return;
	}
	outro(message);
}
const debug = createDebug("nuxi");
/**
* Write a standalone info line, optionally followed by an indented instruction
* on a line of its own so the user can select whatever they need to type.
*
* Unlike {@link logger}`.info` this leaves no connecting `│` and aligns the text
* two columns in, which is what the standalone notices at the end of a command
* share.
*
* Commands leave the cursor in different places (`init` ends on the blank line
* after clack's outro, `dev` and `build` on the line after their last log), so
* the leading gap is measured rather than assumed.
*/
function writeNotice(headline, instruction) {
	const body = instruction ? `${headline}\n  ${instruction}\n` : `${headline}\n`;
	writeDirect(`${blankLineBefore()}${styleText("blue", S_INFO)} ${body}`);
}
//#endregion
//#region src/utils/terminal-host.ts
/**
* The in-process contract between whatever owns the terminal and code that
* needs it: prompts, spinners, anything that would otherwise animate frames
* into the output stream.
*
* `nuxt dev` runs the framework, `@nuxt/kit` and often a second copy of
* `@nuxt/cli` (nuxt's `installNuxtModule` imports the *project's* `@nuxt/cli`
* and runs `module add` in-process) inside one process but from separate
* module graphs, so the contract cannot live in a shared import: each copy
* would see its own. It lives on `globalThis` under a well-known symbol
* instead, published by whoever is drawing the terminal and looked up by
* whoever wants it.
*
* A consumer that finds no host owns the terminal itself and carries on as it
* always has, so a host is never required, only an offer.
*/
const HOST_KEY = Symbol.for("nuxt:terminal-host");
/** Publish `host` for everything in the process, until the returned call. */
function registerTerminalHost(host) {
	const carrier = globalThis;
	carrier[HOST_KEY] = host;
	return () => {
		if (carrier[HOST_KEY] === host) delete carrier[HOST_KEY];
	};
}
/** The terminal host published in this process, if a compatible one is. */
function useTerminalHost() {
	const host = globalThis[HOST_KEY];
	return host?.version === 1 ? host : void 0;
}
//#endregion
//#region src/utils/startup-clock.ts
/**
* Time spent away from actual startup work: interactive prompts, dependency
* installs, taking over another server, one-time tool downloads. The reported
* time-to-ready subtracts it, so `ready in 800ms` describes the server rather
* than how long a question sat on screen.
*/
var startup_clock_exports = /* @__PURE__ */ __exportAll({
	startupElapsedMs: () => startupElapsedMs,
	withStartupClockPaused: () => withStartupClockPaused,
	withUserAttention: () => withUserAttention
});
/** Closed pauses, as `[start, end]`. Only a handful happen in a session. */
const pauses = [];
let pausedAt;
let depth = 0;
function pauseStartupClock() {
	if (depth++ === 0) pausedAt = Date.now();
}
function resumeStartupClock() {
	if (depth > 0 && --depth === 0 && pausedAt !== void 0) {
		pauses.push([pausedAt, Date.now()]);
		pausedAt = void 0;
	}
}
/** Run `work` without its duration counting towards time-to-ready. */
async function withStartupClockPaused(work) {
	pauseStartupClock();
	try {
		return await work();
	} finally {
		resumeStartupClock();
	}
}
/**
* {@link withStartupClockPaused}, with the terminal to itself.
*
* For work that talks to the user without going through consola's prompt,
* which borrows the terminal itself.
*/
function withUserAttention(work) {
	const host = useTerminalHost();
	return withStartupClockPaused(host ? () => host.withTerminal(work) : work);
}
/**
* Milliseconds since `since`, not counting paused stretches.
*
* Only the part of a pause that falls after `since` is subtracted, so a
* baseline taken after a prompt is not charged for the time it took to answer.
*/
function startupElapsedMs(since) {
	const now = Date.now();
	const open = pausedAt === void 0 ? [] : [[pausedAt, now]];
	const excluded = [...pauses, ...open].reduce((total, [start, end]) => total + Math.max(0, Math.min(end, now) - Math.max(start, since)), 0);
	return Math.max(0, now - since - excluded);
}
//#endregion
export { KEEPS_PROCESS_ALIVE as C, ActionableError as S, isRemotePeerError as T, stdout_exports as _, registerTerminalHost as a, writeDirect as b, intro$1 as c, outro$1 as d, setLoggerImpl as f, isInteractiveSession as g, isInteractive as h, withUserAttention as i, isEmittingCliLog as l, blankLineBefore as m, startup_clock_exports as n, useTerminalHost as o, writeNotice as p, withStartupClockPaused as r, debug as s, startupElapsedMs as t, logger as u, tapOutput as v, asActionableError as w, writeDirectTo as x, trackOutputSpacing as y };
