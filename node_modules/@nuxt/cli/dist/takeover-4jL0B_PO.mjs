import { g as isInteractiveSession, i as withUserAttention, u as logger } from "./startup-clock-DXZlxuSA.mjs";
import { c as withDirectStdout, o as restoreRawMode } from "./console-BgmzEcbV.mjs";
import { c as isProcessAlive, f as readLock, i as clearTakeover, l as markTakenOver, r as clearStaleLock, s as isLockEnabled } from "./lockfile-BZHfAuKg.mjs";
import "./shutdown-BavsC3O_.mjs";
import process from "node:process";
import { styleText } from "node:util";
import { isCI } from "std-env";
import { cancel, isCancel, select, spinner } from "@clack/prompts";
import { checkPort } from "get-port-please";
//#region src/dev/takeover.ts
/** How long a `SIGKILL`ed process has to disappear before we give up. */
const TAKEOVER_KILL_TIMEOUT_MS = 1e3;
const TAKEOVER_POLL_INTERVAL_MS = 100;
const SERVER_KINDS = {
	dev: {
		label: "dev server",
		startAnywayHint: "unsupported: both servers share the build directory",
		secondServer: "`NUXT_IGNORE_LOCK=1` to run a second server (unsupported)"
	},
	preview: {
		label: "preview server",
		startAnywayHint: "on another free port",
		secondServer: "`--port` to run a second one alongside it"
	}
};
/**
* Decide what to do about an existing server of the same kind recorded in
* `lockDir`, and carry out a takeover if that is the answer.
*
* Must be called before anything binds a port or writes to the build directory,
* because a takeover adopts the port the outgoing server was using.
*/
function takeOverServer(lockDir, options = {}) {
	return withDirectStdout(() => resolveTakeover(lockDir, options));
}
async function resolveTakeover(lockDir, options) {
	if (!isLockEnabled()) return { action: "none" };
	const existing = readLock(lockDir);
	if (!existing || existing.pid === process.pid) return { action: "none" };
	if (existing.command !== (options.command ?? "dev") || !existing.port) return { action: "none" };
	const alive = isProcessAlive(existing.pid);
	const portFree = await isPortFree(existing.port, existing.hostname);
	if (!alive || portFree) {
		if (!alive && !portFree) logger.warn(`The ${describeServer(existing)} that was using port ${existing.port} is gone, but something is still listening there.`);
		clearStaleLock(lockDir, existing);
		return { action: "stale" };
	}
	if (options.requestedPort !== void 0 && options.requestedPort !== existing.port) return { action: "none" };
	if (options.takeover === false) return {
		action: "refused",
		existing,
		reason: "disabled"
	};
	if (options.takeover !== true) {
		if (!(options.interactive ?? isInteractiveSession())) {
			if (existing.interactive) return {
				action: "refused",
				existing,
				reason: "holder-interactive"
			};
		} else {
			const prompt = options.prompt ?? promptForTakeover;
			const choice = await withUserAttention(() => prompt(existing, existing.interactive ? "abort" : "takeover"));
			if (choice === "abort") return {
				action: "refused",
				existing,
				reason: "declined"
			};
			if (choice === "start-anyway") {
				if (existing.command === "dev") logger.warn(`Starting a second dev server: both will write to ${styleText("cyan", lockDir)}, which is unsupported and may corrupt the build.`);
				return {
					action: "start-anyway",
					existing
				};
			}
		}
	}
	return withUserAttention(() => performTakeover(lockDir, existing, options.timeouts));
}
async function performTakeover(lockDir, existing, timeouts = {}) {
	const port = existing.port;
	const portFree = await isPortFree(port, existing.hostname);
	if (!matchesLock(readLock(lockDir), existing)) return { action: "none" };
	if (!isProcessAlive(existing.pid) || portFree) {
		clearStaleLock(lockDir, existing);
		return { action: "stale" };
	}
	const label = describeServer(existing);
	const startedAt = new Date(existing.startedAt).toLocaleTimeString();
	const progress = startProgress(`Taking over the ${label} on port ${port} (PID ${existing.pid}, started ${startedAt})`);
	markTakenOver(lockDir, process.pid);
	const pids = [...new Set(existing.command === "preview" ? [existing.serverPid, existing.pid] : [existing.pid, existing.parentPid])].filter((pid) => !!pid);
	const phases = [["SIGTERM", timeouts.graceful ?? 1e4], ["SIGKILL", timeouts.force ?? TAKEOVER_KILL_TIMEOUT_MS]];
	for (const [signal, timeout] of phases) {
		if (signal === "SIGKILL") progress.update(`Waiting for the ${label} on port ${port} to exit`);
		for (const pid of pids) {
			const current = readLock(lockDir);
			if (!matchesLock(current, existing) || pid !== existing.pid && pid !== current?.parentPid && pid !== current?.serverPid) continue;
			try {
				process.kill(pid, signal);
			} catch {}
		}
		if (await waitForRelease(pids, port, existing.hostname, timeout)) {
			progress.stop(`Stopped the ${label} on port ${port} (PID ${existing.pid})`);
			return {
				action: "taken",
				port,
				pid: existing.pid
			};
		}
	}
	progress.fail(`Could not stop the ${label} on port ${port}`);
	clearTakeover(lockDir, process.pid);
	return {
		action: "refused",
		existing,
		reason: "timeout"
	};
}
function matchesLock(current, existing) {
	return current?.pid === existing.pid && current.startedAt === existing.startedAt && current.command === existing.command && current.port === existing.port && current.hostname === existing.hostname;
}
/**
* Stopping the outgoing server can take several seconds, so a terminal gets a
* spinner. Anywhere else (CI, an agent, a piped log) the frames are noise, so
* the same information is logged as plain lines.
*/
function startProgress(message) {
	if (!process.stdout.isTTY || isCI) {
		logger.info(`${message}.`);
		return {
			update: (text) => logger.info(`${text}.`),
			stop: (text) => logger.info(`${text}.`),
			fail: (text) => logger.error(`${text}.`)
		};
	}
	const indicator = spinner();
	indicator.start(message);
	const finish = (report) => (text) => {
		report(text);
		restoreRawMode();
	};
	return {
		update: (text) => indicator.message(text),
		stop: finish((text) => indicator.stop(text)),
		fail: finish((text) => indicator.error(text))
	};
}
/** Human-readable explanation for a refusal, including how to override it. */
function formatTakeoverRefusal(existing, reason) {
	const location = describeLocation(existing);
	const lines = [
		"",
		reason === "timeout" ? `The ${describeServer(existing)} on port ${existing.port} did not exit, so this one will not start.` : `Another Nuxt ${describeServer(existing)} is already running:`,
		"",
		`  URL:     ${location}`,
		`  PID:     ${existing.pid}`,
		`  Dir:     ${existing.cwd}`,
		`  Started: ${new Date(existing.startedAt).toLocaleString()}${existing.interactive ? " (in a terminal)" : ""}`,
		""
	];
	if (reason === "holder-interactive") lines.push("It was started interactively, so it is not stopped automatically.");
	if (reason !== "timeout") lines.push(`Pass \`--takeover\` to stop it and start this server in its place, or ${serverKind(existing).secondServer}.`);
	lines.push("");
	return lines.join("\n");
}
function serverKind(existing) {
	return SERVER_KINDS[existing.command === "preview" ? "preview" : "dev"];
}
function describeServer(existing) {
	return serverKind(existing).label;
}
function describeLocation(existing) {
	return existing.url || "starting up (no URL yet)";
}
async function promptForTakeover(existing, defaultChoice) {
	logger.info(`A Nuxt ${describeServer(existing)} is already running here (PID ${existing.pid}, ${describeLocation(existing)}).`);
	const choice = await select({
		message: "What would you like to do?",
		initialValue: defaultChoice,
		options: [
			{
				value: "takeover",
				label: `Take over port ${existing.port}`,
				hint: "stops the running server (--takeover)"
			},
			{
				value: "abort",
				label: "Do not start",
				hint: "--no-takeover"
			},
			{
				value: "start-anyway",
				label: "Start anyway",
				hint: serverKind(existing).startAnywayHint
			}
		]
	});
	restoreRawMode();
	if (isCancel(choice)) {
		cancel(`Not starting a second ${describeServer(existing)}.`);
		return "abort";
	}
	return choice;
}
async function isPortFree(port, hostname) {
	return await checkPort(port, hostname || void 0) !== false;
}
async function waitForRelease(pids, port, hostname, timeout) {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		if (!pids.some(isProcessAlive) && await isPortFree(port, hostname)) return true;
		await new Promise((resolve) => setTimeout(resolve, TAKEOVER_POLL_INTERVAL_MS));
	}
	return false;
}
//#endregion
export { takeOverServer as n, formatTakeoverRefusal as t };
