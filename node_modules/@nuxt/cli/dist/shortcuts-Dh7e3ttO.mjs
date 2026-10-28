import { c as withDirectStdout, o as restoreRawMode, r as guardReplayedInput } from "./console-BgmzEcbV.mjs";
import { c as printQRCode, n as copyURL, o as openBrowser } from "./listen-BjyzPJ2X.mjs";
import { i as isShutdownAdopted } from "./shutdown-BavsC3O_.mjs";
import process from "node:process";
import { styleText } from "node:util";
import { isCI, isTest } from "std-env";
import { createInterface } from "node:readline";
//#region src/dev/shortcuts.ts
const shortcuts = [
	{
		keys: ["r", "restart"],
		description: "restart the dev server",
		isAvailable: (context) => !!context.restart,
		action: (context) => context.restart?.()
	},
	{
		keys: ["restart-clear", "restart --clear"],
		description: "restart with a cleared cache",
		isAvailable: (context) => !!context.restart && !!context.clearCaches,
		action: async (context) => {
			await context.clearCaches?.();
			await context.restart?.();
		}
	},
	{
		keys: ["o", "open"],
		description: "open in browser (press again while starting to cancel)",
		action: (context) => context.open()
	},
	{
		keys: ["u", "urls"],
		description: "show server URLs",
		isAvailable: (context) => !!context.listener,
		action: (context) => context.listener?.showURLs()
	},
	{
		keys: ["qr"],
		description: "show a QR code for the server URL",
		isAvailable: (context) => !!context.listener,
		action: (context) => context.listener && printQRCode(resolveShareableURL(context.listener), { showURL: true })
	},
	{
		keys: ["y", "copy"],
		description: "copy the server URL to the clipboard",
		isAvailable: (context) => !!context.listener,
		action: (context) => context.listener && copyURL(resolveShareableURL(context.listener))
	},
	{
		keys: ["c", "clear"],
		description: "clear the console",
		action: async (context) => {
			await withDirectStdout(() => process.stdout.write("\x1B[2J\x1B[3J\x1B[H"));
			context.listener?.showURLs();
		}
	},
	{
		keys: [
			"q",
			"quit",
			"exit"
		],
		description: "quit",
		action: quit
	},
	{
		keys: [
			"h",
			"help",
			"?"
		],
		description: "show this help",
		action: printHelp
	}
];
/** The URL most likely to work on another device, for QR codes and sharing. */
function resolveShareableURL(listener) {
	return listener.qrURL || listener.publicURL || listener.getURLs().find(({ type }) => type === "network")?.url || listener.url;
}
async function quit(context) {
	context.closeInput();
	if (isShutdownAdopted()) {
		process.emit("SIGINT");
		return;
	}
	try {
		await context.close();
	} catch (error) {
		console.error(error);
		process.exitCode = 1;
	}
	process.exit();
}
function printHelp(context) {
	const lines = availableShortcuts(context).map(({ keys, description }) => `  ${styleText("dim", "press")} ${styleText("bold", `${keys[0]} + enter`)} ${styleText("dim", `to ${description}`)}`);
	console.log(`\n${lines.join("\n")}\n  ${styleText("bold", "Ctrl-C")} ${styleText("dim", "to quit; press again during cleanup to force exit")}\n`);
}
function printRequestHint() {
	console.log(`\n  ${styleText("dim", "run")} ${styleText("bold", "nuxt curl /")} ${styleText("dim", "to send a request to this server")}\n`);
}
function availableShortcuts(context) {
	return shortcuts.filter((shortcut) => shortcut.isAvailable?.(context) !== false);
}
/** Bind line-based commands without raw mode or intercepting Ctrl-C. */
function setupShortcuts(context) {
	if (!process.stdin.isTTY || isCI || isTest) {
		if (process.stdout.isTTY && !isCI && !isTest) context.onReady(() => printRequestHint());
		return;
	}
	let armedOpen = false;
	let ready = false;
	context.onReady(() => {
		ready = true;
		if (armedOpen && context.listener) {
			armedOpen = false;
			openBrowser(context.listener.url);
		}
		console.log(`\n  ${styleText("dim", "press")} ${styleText("bold", "h + enter")} ${styleText("dim", "to see available shortcuts")}\n`);
	});
	restoreRawMode();
	const rl = createInterface({ input: process.stdin });
	const isReplayedInput = guardReplayedInput();
	rl.on("line", async (line) => {
		if (isReplayedInput()) return;
		const input = line.trim().toLowerCase();
		const shortcut = availableShortcuts(context).find(({ keys }) => keys.includes(input));
		if (!shortcut) return;
		try {
			await shortcut.action({
				...context,
				closeInput: () => rl.close(),
				open: () => {
					if (ready && context.listener) openBrowser(context.listener.url);
					else {
						armedOpen = !armedOpen;
						console.log(armedOpen ? "Browser will open when the server is ready." : "Browser opening cancelled.");
					}
				}
			});
		} catch (error) {
			console.error(error);
		}
	});
}
//#endregion
export { setupShortcuts };
