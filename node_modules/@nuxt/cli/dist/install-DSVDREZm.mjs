import { t as __exportAll } from "./rolldown-runtime-D7D4PA-g.mjs";
import { r as getLockFiles } from "./package-managers-B9HZ9pY9.mjs";
import { delimiter, resolve } from "node:path";
import process from "node:process";
import { styleText } from "node:util";
import { S_BAR, log } from "@clack/prompts";
import { rmSync, statSync } from "node:fs";
import { spawn } from "node:child_process";
import { resolveCommand } from "package-manager-detector/commands";
import { normalizeSpawnCommand } from "tinyexec";
//#region src/utils/install.ts
var install_exports = /* @__PURE__ */ __exportAll({
	createInstallLog: () => createInstallLog,
	getIgnoredBuilds: () => getIgnoredBuilds,
	isExecutableAvailable: () => isExecutableAvailable,
	isVerboseInstall: () => isVerboseInstall,
	nonInteractiveArgs: () => nonInteractiveArgs,
	runDedupe: () => runDedupe,
	runInstall: () => runInstall,
	takeUnreportedIgnoredBuilds: () => takeUnreportedIgnoredBuilds
});
const TRAILING_DOT_RE = /\.$/;
const SURROUNDING_QUOTES_RE = /^"(.*)"$/;
const STALL_TIMEOUT = 3e4;
const STALL_POLL_INTERVAL = 1e3;
const KILL_GRACE_PERIOD = 5e3;
const IGNORED_BUILDS_RE = /Ignored build scripts:\s*([^\n│]+)/;
const ANSI_RE = /\u001B\[[\d;]*[A-Z]/gi;
function getInstallCommand({ packageManager: { agent }, dependencies = [], dev, uninstall }) {
	if (!dependencies.length) return resolveCommand(agent, "install", []);
	return resolveCommand(agent, uninstall ? "uninstall" : "add", [...dev && !uninstall ? ["-D"] : [], ...dependencies], { ignoreWorkspaceRootCheck: true });
}
/**
* Run a package manager install, keeping its output quiet unless it is needed.
*
* Output is buffered and returned rather than printed, so a caller can render a
* spinner and only surface the package manager's noise when the install fails.
* Standard input is not connected to the child: a
* package manager that decides to prompt gets EOF and falls back to its default
* instead of hanging behind a spinner where its question is invisible.
*/
async function runInstall(options) {
	const { command, args } = getInstallCommand(options);
	return await execute(command, [...args, ...nonInteractiveArgs(options.packageManager)], options);
}
/**
* Dedupe a project's dependencies, or recreate its lockfile, with the same quiet
* output handling as {@link runInstall}.
*/
async function runDedupe(options) {
	if (options.recreateLockfile) {
		rmSync(resolve(options.cwd, "node_modules"), {
			recursive: true,
			force: true
		});
		const lockFiles = options.lockFile ? [options.lockFile] : getLockFiles(options.packageManager.name);
		for (const lockFile of lockFiles) rmSync(resolve(options.cwd, lockFile), { force: true });
		return await runInstall(options);
	}
	const { agent, name } = options.packageManager;
	const exec = resolveCommand(agent, agent === "yarn" ? "install" : "dedupe", []);
	if (!exec) return {
		success: false,
		output: "",
		command: "",
		ignoredBuilds: [],
		error: `Deduplication is not supported for ${name}`
	};
	return await execute(exec.command, [...exec.args, ...nonInteractiveArgs(options.packageManager)], options);
}
/**
* Flags that stop a package manager from asking a question we cannot answer, or
* from failing on something the user can act on after the fact.
*
* We deliberately do not set `CI`: package managers change more than their
* interactivity when they think they are on CI (pnpm, for one, switches to a
* frozen lockfile), which would break installs for templates whose lockfile is
* not perfectly in sync.
*/
function nonInteractiveArgs(packageManager) {
	if (packageManager.name === "pnpm") return ["--config.confirm-modules-purge=false", "--config.strict-dep-builds=false"];
	return [];
}
function isVerboseInstall(logLevel) {
	return logLevel === "verbose" || Boolean(process.env.DEBUG);
}
/**
* Collects a package manager's output and prints it once the install is over: on
* failure, or on success when `verbose` is set. It is printed as plain gutter
* lines under whatever the caller reported, and only at the end, so it neither
* decorates the output as a step of its own nor competes with a spinner for the
* cursor.
*/
function createInstallLog({ verbose = false } = {}) {
	const lines = [];
	return {
		onOutput: (line) => lines.push(line),
		finish: (result) => {
			if (result.success && !verbose) return;
			const output = (lines.length > 0 ? lines.join("\n") : result.output).trim();
			if (output) log.message(output.split("\n"), { symbol: styleText("gray", S_BAR) });
		}
	};
}
const reportedIgnoredBuilds = /* @__PURE__ */ new Set();
/**
* The packages from {@link InstallResult.ignoredBuilds} that have not been
* reported yet in this process, so a chained install (`nuxt init` followed by
* `nuxt module add`) does not repeat the same warning.
*/
function takeUnreportedIgnoredBuilds(ignoredBuilds) {
	const packages = ignoredBuilds.filter((name) => !reportedIgnoredBuilds.has(name));
	for (const name of packages) reportedIgnoredBuilds.add(name);
	return packages;
}
/** Packages whose build scripts pnpm refused to run, parsed from install output. */
function getIgnoredBuilds(output) {
	const match = output.replace(ANSI_RE, "").match(IGNORED_BUILDS_RE);
	if (!match?.[1]) return [];
	return match[1].split(",").map((name) => name.trim().replace(TRAILING_DOT_RE, "")).filter(Boolean);
}
/**
* Whether `command` can be spawned, looked up the way the platform would.
*
* Windows spawns go through `cmd.exe`, which reports a missing command as exit
* code 9009 with a localised message rather than as `ENOENT`, so the check has to
* happen before the process starts for the failure to be recognisable.
*/
function isExecutableAvailable(command, cwd = process.cwd()) {
	const isWindows = process.platform === "win32";
	const directories = command.includes("/") || command.includes("\\") ? [""] : [...isWindows ? [cwd] : [], ...(process.env.PATH || "").split(delimiter).filter(Boolean).map((directory) => isWindows ? directory.replace(SURROUNDING_QUOTES_RE, "$1") : directory)];
	const extensions = isWindows ? [...command.includes(".") ? [""] : [], ...(process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM").split(delimiter)] : [""];
	for (const directory of directories) for (const extension of extensions) try {
		if (statSync(resolve(cwd, directory, command + extension)).isFile()) return true;
	} catch {}
	return false;
}
function execute(command, args, options) {
	const displayCommand = [command, ...args].join(" ");
	if (!isExecutableAvailable(command, options.cwd)) return Promise.resolve({
		success: false,
		error: `\`${command}\` was not found. Install it (or choose a different package manager) and try again.`,
		command: displayCommand,
		output: "",
		ignoredBuilds: []
	});
	const spawnOptions = {
		cwd: options.cwd,
		stdio: [
			"ignore",
			"pipe",
			"pipe"
		],
		detached: process.platform !== "win32"
	};
	const normalized = normalizeSpawnCommand(command, args, spawnOptions);
	return new Promise((resolve) => {
		const child = spawn(normalized.command, [...normalized.args], normalized.options);
		const abort = () => killTree(child);
		if (options.signal?.aborted) abort();
		else options.signal?.addEventListener("abort", abort, { once: true });
		const chunks = [];
		let pending = "";
		let lastActivity = Date.now();
		let notifiedStall = false;
		const onData = (chunk) => {
			lastActivity = Date.now();
			const text = String(chunk);
			chunks.push(text);
			if (!options.onOutput) return;
			pending += text;
			const lines = pending.split("\n");
			pending = lines.pop() ?? "";
			for (const line of lines) options.onOutput(line);
		};
		child.stdout?.on("data", onData);
		child.stderr?.on("data", onData);
		const stallTimer = setInterval(() => {
			if (notifiedStall || Date.now() - lastActivity < STALL_TIMEOUT) return;
			notifiedStall = true;
			options.onStatus?.(`\`${displayCommand}\` has produced no output for ${STALL_TIMEOUT / 1e3}s and may be stuck`);
		}, STALL_POLL_INTERVAL);
		stallTimer.unref?.();
		let settled = false;
		const finish = (result) => {
			if (settled) return;
			settled = true;
			clearInterval(stallTimer);
			options.signal?.removeEventListener("abort", abort);
			if (pending && options.onOutput) options.onOutput(pending);
			const output = chunks.join("");
			resolve({
				...result,
				command: displayCommand,
				output: tail(output),
				ignoredBuilds: getIgnoredBuilds(output)
			});
		};
		child.on("error", (error) => {
			if (error.code === "ENOENT") {
				finish({
					success: false,
					error: `\`${command}\` was not found. Install it (or choose a different package manager) and try again.`
				});
				return;
			}
			finish({
				success: false,
				error: error.message
			});
		});
		child.on("close", (code, signal) => {
			if (code === 0) {
				finish({ success: true });
				return;
			}
			const reason = code === null ? `was terminated${signal ? ` by ${signal}` : ""}` : `failed with exit code ${code}`;
			finish({
				success: false,
				error: `\`${displayCommand}\` ${reason}.`
			});
		});
	});
}
/**
* Terminate an install, including whatever it spawned in turn, escalating to
* `SIGKILL` for a package manager that does not stop on its own.
*/
function killTree(child) {
	const kill = (signal) => {
		try {
			if (child.pid !== void 0 && process.platform !== "win32") {
				process.kill(-child.pid, signal);
				return;
			}
			child.kill(signal);
		} catch {}
	};
	kill("SIGTERM");
	setTimeout(() => {
		if (child.exitCode === null && child.signalCode === null) kill("SIGKILL");
	}, KILL_GRACE_PERIOD).unref?.();
}
function tail(output) {
	return output.replace(/\s+$/, "").split("\n").slice(-30).join("\n");
}
//#endregion
export { runInstall as a, runDedupe as i, install_exports as n, takeUnreportedIgnoredBuilds as o, isVerboseInstall as r, createInstallLog as t };
