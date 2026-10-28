import { u as logger, v as tapOutput } from "./startup-clock-DXZlxuSA.mjs";
import { i as paint } from "./terminal-theme-BUtyan0v.mjs";
import "./progress-snapshot-BsUn_089.mjs";
import { a as terminalLink, n as formatDuration, t as decapitalise } from "./formatting-Co5DEjad.mjs";
import process from "node:process";
import { styleText } from "node:util";
import { isCI } from "std-env";
import { box } from "@clack/prompts";
import { join, relative } from "pathe";
import { mkdirSync, writeFileSync } from "node:fs";
//#region src/utils/profile.ts
const RELATIVE_PATH_RE = /^(?![^.]{1,2}\/)/;
let session;
let profileCount = 0;
async function startCpuProfile() {
	const cli = globalThis.__nuxt_cli__;
	if (cli?.cpuProfileSession) {
		session = cli.cpuProfileSession;
		delete cli.cpuProfileSession;
		return;
	}
	session = new (await (import("node:inspector"))).Session();
	session.connect();
	try {
		await new Promise((res, rej) => {
			session.post("Profiler.enable", (err) => {
				if (err) return rej(err);
				session.post("Profiler.start", (err) => {
					if (err) return rej(err);
					res();
				});
			});
		});
	} catch (err) {
		session.disconnect();
		session = void 0;
		throw err;
	}
}
async function stopCpuProfile(outDir, command) {
	if (!session) return;
	const s = session;
	session = void 0;
	const count = profileCount++;
	const outPath = join(outDir, `nuxt-${command}${count ? `-${count}` : ""}.cpuprofile`);
	const relativeOutPath = relative(process.cwd(), outPath).replace(RELATIVE_PATH_RE, "./");
	try {
		const profile = await new Promise((resolve, reject) => {
			s.post("Profiler.stop", (err, params) => err ? reject(err) : resolve(params?.profile));
		});
		if (!profile) return;
		try {
			mkdirSync(outDir, { recursive: true });
			writeFileSync(outPath, JSON.stringify(profile));
		} catch {
			return;
		}
		try {
			const nextSteps = [`CPU profile written to ${styleText("cyan", relativeOutPath)}.`, `Open it in a CPU profile viewer like your IDE, or ${styleText("cyan", "https://discoveryjs.github.io/cpupro")}.`];
			box(`\n${nextSteps.map((step) => ` › ${step}`).join("\n")}\n`, "", {
				contentAlign: "left",
				titleAlign: "left",
				width: "auto",
				titlePadding: 2,
				contentPadding: 2,
				rounded: true,
				withGuide: false,
				formatBorder: (text) => paint("brand", text)
			});
		} catch {}
		return outPath;
	} finally {
		s.disconnect();
	}
}
//#endregion
//#region src/utils/phase-reporter.ts
const FRAMES = [
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
const FRAME_INTERVAL = 80;
const CLEAR_LINE = "\r\x1B[2K";
const COLUMN_ONE = "\r";
/**
* How far the phase clock has to be behind the total before both are worth
* showing. During the first phase they are the same number twice.
*/
const PHASE_ELAPSED_THRESHOLD = 100;
const HIDE_CURSOR = "\x1B[?25l";
const SHOW_CURSOR = "\x1B[?25h";
/**
* A ticking elapsed time, in tenths of a second. Anything finer changes the
* line on every frame, which is the whole cost the frame-only repaint avoids.
*/
/**
* How long the phase in flight has taken, and how long the command has been
* running, where those have parted company. A phase can hold a command for most
* of its run, and its own clock is what says a still label is still working.
*/
function formatElapsed(snapshot, drift) {
	const total = snapshot.elapsed + drift;
	const phase = snapshot.phaseElapsed + drift;
	return total - phase >= PHASE_ELAPSED_THRESHOLD ? `${formatDuration(phase)} \u00B7 ${formatDuration(total)}` : formatDuration(total);
}
function isAnimationSupported(stream = process.stdout) {
	return !!stream.isTTY && !isCI && !process.env.NO_COLOR;
}
/** `config 40ms · modules 1.2s · …`, or nothing if every phase was trivial. */
function formatPhaseBreakdown(timings) {
	return timings.filter((timing) => timing.duration >= 10).map((timing) => `${timing.phase} ${formatDuration(timing.duration)}`).join(" · ");
}
/**
* The URL the summary points at, so the address is on screen at the moment the
* user is being told they can click it rather than a screenful further up.
*/
function formatURL(url) {
	return `  ${styleText("dim", "→")} ${styleText("cyan", terminalLink(url, url))}`;
}
/**
* The line a long-running command leaves behind once it is up. A command that
* only builds never reaches `ready` and reports its own completion instead.
*/
function formatSummary(snapshot, url) {
	const breakdown = formatPhaseBreakdown(snapshot.timings);
	const detail = snapshot.serving || !snapshot.message || snapshot.message === "Ready" ? "" : styleText("dim", ` \u00B7 ${decapitalise(snapshot.message)}`);
	const headline = `${snapshot.reload ? "Reloaded" : "Ready"} in ${formatDuration(snapshot.elapsed)}${detail}${url ? formatURL(url) : ""}`;
	return breakdown ? `${headline}\n${styleText("dim", breakdown)}` : headline;
}
/**
* Report progress through a command's phases on a single line that updates in
* place, collapsing to one summary line with a phase breakdown once the command
* reports itself ready, and then narrating the first page render, which is where
* the rest of the wait is spent. Falls back to sequential logs when the output
* is not an interactive terminal.
*/
function createPhaseReporter(options = {}) {
	const stream = options.stream ?? process.stdout;
	const animated = options.animated ?? isAnimationSupported(stream);
	let snapshot;
	let summarised = false;
	let lastPhase;
	let lastMessage;
	let lastLoggedAt = 0;
	let frame = 0;
	let dirty = false;
	let painted;
	/** Whether the cursor is currently hidden for the transient line. */
	let hidden = false;
	let timer;
	let stopped = false;
	let receivedAt = Date.now();
	let pulse;
	let url;
	/** The request the line is currently reporting, so it is announced once. */
	let narrating;
	/** Whether the wait was ever narrated, and so is worth closing off. */
	let narrated = false;
	/** When the render being waited on arrived, so the wait can be measured. */
	let renderStartedAt;
	const tap = animated ? tapOutput(stream, () => clear()) : void 0;
	const write = tap?.write ?? stream.write.bind(stream);
	function log(line, message) {
		lastMessage = message;
		lastLoggedAt = Date.now();
		logger.info(line);
	}
	function clear() {
		if (dirty) {
			write(CLEAR_LINE);
			dirty = false;
			painted = void 0;
		}
	}
	/**
	* The line after the spinner glyph: what the command is doing and how long it
	* has been doing it. Once the summary is printed that is no longer a phase but
	* the request being rendered, which has its own clock.
	*/
	function describe() {
		const pending = summarised ? snapshot.pending : void 0;
		return pending ? `rendering ${pending.label} ${styleText("dim", formatDuration(Date.now() - pending.startedAt))}` : `${snapshot.message} ${styleText("dim", formatElapsed(snapshot, Date.now() - receivedAt))}`;
	}
	function render() {
		if (!snapshot || stopped) return;
		const glyph = styleText("cyan", FRAMES[frame = (frame + 1) % FRAMES.length]);
		const line = describe();
		if (dirty && line === painted) {
			write(`${COLUMN_ONE}${glyph}`);
			return;
		}
		clear();
		write(`${glyph} ${line}`);
		painted = line;
		dirty = true;
	}
	function animate() {
		if (!animated || timer) return;
		hidden = true;
		write(HIDE_CURSOR);
		timer = setInterval(render, FRAME_INTERVAL);
		timer.unref?.();
	}
	animate();
	/**
	* Repeat whatever is in flight, with the time it has taken so far, so a long
	* silent stretch in a piped log still shows something is alive. A render is
	* repeated the same way: nothing else is printed while it compiles.
	*/
	function schedulePulse() {
		clearInterval(pulse);
		pulse = void 0;
		if (!options.heartbeat || animated) return;
		pulse = setInterval(() => {
			if (!snapshot || stopped) return;
			const pending = summarised ? snapshot.pending : void 0;
			if (pending) {
				log(announce(pending.label, Date.now() - pending.startedAt), `rendering ${pending.label}`);
				return;
			}
			log(`${snapshot.message} ${styleText("dim", `(${formatElapsed(snapshot, Date.now() - receivedAt)})`)}`, snapshot.message);
		}, options.heartbeat);
		pulse.unref?.();
	}
	/** A render, as its own line, for output that cannot redraw one in place. */
	function announce(label, elapsed) {
		return `Rendering ${label}${elapsed === void 0 ? "" : ` ${styleText("dim", `(${formatDuration(elapsed)})`)}`}`;
	}
	/** Take the line down, leaving the terminal as it was found. */
	function restore() {
		clearInterval(pulse);
		pulse = void 0;
		if (timer) {
			clearInterval(timer);
			timer = void 0;
		}
		if (animated && hidden) {
			hidden = false;
			clear();
			write(SHOW_CURSOR);
		}
	}
	function finish() {
		stopped = true;
		restore();
		tap?.dispose();
	}
	return {
		setURL(next) {
			url = next;
		},
		update(next) {
			if (stopped) return;
			if (summarised && next.status !== "ready") return;
			snapshot = next;
			receivedAt = Date.now();
			if (next.status === "error") {
				finish();
				return;
			}
			if (next.status !== "ready") {
				if (animated) {
					render();
					return;
				}
				if (next.phase !== lastPhase) {
					lastPhase = next.phase;
					log(next.message, next.message);
					schedulePulse();
					return;
				}
				if (options.heartbeat && next.message !== lastMessage && Date.now() - lastLoggedAt >= options.heartbeat) log(`${next.message} ${styleText("dim", `(${formatElapsed(next, 0)})`)}`, next.message);
				return;
			}
			if (!summarised) {
				restore();
				summarised = true;
				narrated = !next.serving && next.message !== "Ready";
				logger.success(formatSummary(next, url));
			}
			if (next.serving) {
				restore();
				if (narrated) logger.success(renderStartedAt === void 0 ? `Serving in ${formatDuration(next.elapsed)}` : `First render in ${formatDuration(Date.now() - renderStartedAt)}`);
				finish();
				return;
			}
			if (!next.pending) {
				narrating = void 0;
				restore();
				return;
			}
			narrated = true;
			renderStartedAt ??= next.pending.startedAt;
			if (animated) {
				animate();
				render();
				return;
			}
			if (narrating !== next.pending.label) {
				narrating = next.pending.label;
				log(announce(next.pending.label), `rendering ${next.pending.label}`);
				schedulePulse();
			}
		},
		stop() {
			finish();
		}
	};
}
//#endregion
export { stopCpuProfile as i, formatPhaseBreakdown as n, startCpuProfile as r, createPhaseReporter as t };
