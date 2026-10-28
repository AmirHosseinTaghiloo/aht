import { S as ActionableError, s as debug, u as logger } from "./startup-clock-DXZlxuSA.mjs";
import process from "node:process";
import { styleText } from "node:util";
import { isCI, provider } from "std-env";
import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createServer as createServer$1 } from "node:https";
import { networkInterfaces, release } from "node:os";
import { getPort } from "get-port-please";
//#region src/dev/environment.ts
let dockerCache;
let wslKernelCache;
/** Whether this process is running inside a Docker (or compatible) container. */
function isDocker() {
	dockerCache ??= existsSync("/.dockerenv") || readTextFile("/proc/self/cgroup").includes("docker");
	return dockerCache;
}
/**
* Whether this process is running under the Windows Subsystem for Linux.
*
* WSL1 spells the kernel release `Microsoft`, WSL2 `microsoft-standard-WSL2`.
* A custom-kernel WSL2 install has neither, so `/proc/version` is checked too.
*/
function isWsl(platform = process.platform, env = process.env) {
	if (platform !== "linux") return false;
	if (env.WSL_DISTRO_NAME) return true;
	wslKernelCache ??= release().toLowerCase().includes("microsoft") || readTextFile("/proc/version").toLowerCase().includes("microsoft");
	return wslKernelCache;
}
/**
* The name of the container-like environment a loopback bind is unreachable
* from, or `undefined` when the dev server is running directly on the host.
*/
function detectIsolatedEnvironment() {
	if (isDocker()) return "the container";
	if (isWsl()) return "WSL";
}
function readTextFile(path) {
	try {
		return readFileSync(path, "utf8");
	} catch {
		return "";
	}
}
//#endregion
//#region src/dev/portless.ts
/**
* Resolve the URLs of the [portless](https://portless.sh) proxy, if the dev
* server was started through it (`portless myapp nuxt dev`).
*
* portless runs as the parent process: it assigns a random `PORT`, proxies a
* stable hostname to it, and passes the resulting URLs down in the environment.
* Requests therefore arrive with a `Host` header we would otherwise reject.
*/
function resolvePortlessURLs(env = process.env) {
	const url = normalize(env.PORTLESS_URL);
	const shareURL = normalize(env.PORTLESS_NGROK_URL) || normalize(env.PORTLESS_TAILSCALE_URL);
	return {
		url,
		shareURL,
		all: [...new Set([url, shareURL].filter(Boolean))]
	};
}
function normalize(value) {
	if (!value) return;
	try {
		return new URL(value).origin;
	} catch {
		return;
	}
}
//#endregion
//#region src/dev/stackblitz.ts
/**
* Resolve the reachable editor URL for a dev server running inside StackBlitz
* or Codeflow, where the app is served through the editor rather than on a
* port the user can open locally.
*
* The project is identified by the working directory: `/home/projects/<id>`
* in the editor, `/home/<org>/<repo>` in Codeflow. `PWD` is used rather than
* `process.cwd()` because the latter is resolved through symlinks.
*/
function resolveStackblitzURL(env = process.env, provider$1 = provider) {
	if (provider$1 !== "stackblitz") return;
	const cwd = env.PWD;
	if (!cwd) return;
	if (cwd.startsWith("/home/projects/")) {
		const projectId = cwd.split("/")[3];
		return projectId ? `https://stackblitz.com/edit/${projectId}` : void 0;
	}
	if (cwd.startsWith("/home/")) {
		const [owner, repository] = cwd.split("/").slice(2);
		return owner && repository ? `https://stackblitz.com/edit/~/github.com/${owner}/${repository}` : void 0;
	}
}
//#endregion
//#region src/dev/listen.ts
const ANY_HOSTS = /* @__PURE__ */ new Set([
	"",
	"0.0.0.0",
	"::"
]);
const LOOPBACK_HOSTS = /* @__PURE__ */ new Set([
	"localhost",
	"127.0.0.1",
	"::1"
]);
const DEFAULT_PORTS = {
	http: 80,
	https: 443
};
/** How long in-flight requests have to finish before their sockets are killed. */
const CONNECTION_DRAIN_TIMEOUT_MS = 1e3;
/**
* Render a URL for display: the port is omitted when it is the protocol
* default, and percent-encoding is decoded so a non-ASCII `baseURL` is
* readable. A malformed sequence is left as-is rather than throwing.
*/
function formatDisplayURL(protocol, host, port, baseURL) {
	const url = `${protocol}://${host.includes(":") ? `[${host}]` : host}${port === DEFAULT_PORTS[protocol] ? "" : `:${port}`}${baseURL}`;
	try {
		return decodeURI(url);
	} catch {
		return url;
	}
}
const HOSTNAME_RE = /^(?!-)[\d.:a-z-]{1,253}(?<!-)$/i;
/**
* Check `hostname` is a plausible host or IP address, falling back to a
* bindable default (with a warning) when it is not.
*/
function validateHostname(hostname, isPublic, options = {}) {
	const isValid = !!hostname && HOSTNAME_RE.test(hostname) && hostname.split(".").every((label) => label.length <= 63);
	if (!hostname || isValid) return hostname;
	const fallback = isPublic ? "" : "localhost";
	if (!options.silent) logger.warn(`Invalid host \`${hostname}\`, using \`${fallback || "0.0.0.0"}\` instead.`);
	return fallback;
}
/** Hostname `bindListener` will bind for `options`. */
function resolveBindHostname(options, silent = false) {
	const isolated = options.hostname === void 0 && !options.public && detectIsolatedEnvironment();
	return validateHostname(options.hostname, options.public, { silent }) ?? (options.public || isolated ? "" : "localhost");
}
/**
* Whether an already bound server can serve `options`, so a listener bound
* before the Nuxt config was known can be kept rather than rebound.
*/
function matchesBoundTarget(bound, options) {
	if (resolveBindHostname(options, true) !== bound.hostname) return false;
	if (!!options.https !== !!bound.https) return false;
	const port = options.port === void 0 || options.port === "" ? void 0 : Number(options.port);
	return port === void 0 || port === bound.address.port || port === bound.requestedPort;
}
/**
* External IPv4 addresses other devices can reach. IPv4 link-local addresses
* (169.254.0.0/16, from a macOS Thunderbolt Bridge or an unconfigured adapter)
* are excluded because they are unreachable from the rest of the network.
*/
function getNetworkAddresses() {
	const addresses = [];
	for (const info of Object.values(networkInterfaces()).flat()) {
		if (!info || info.internal || info.family !== "IPv4" || info.address.startsWith("169.254.")) continue;
		if (isNetworkBaseAddress(info.address, info.cidr)) continue;
		addresses.push(info.address);
	}
	return addresses;
}
/**
* Whether `address` is its subnet's base (all host bits zero), which no host
* answers on. macOS assigns one to bridge interfaces (Personal Hotspot,
* container bridges), and it would otherwise be listed as reachable.
*/
function isNetworkBaseAddress(address, cidr) {
	const prefix = Number(cidr?.split("/")[1]);
	if (!Number.isFinite(prefix) || prefix >= 31) return false;
	return (address.split(".").reduce((total, octet) => total << 8 | Number(octet), 0) >>> 0 & 2 ** (32 - prefix) - 1) === 0;
}
/**
* OpenSSL 3 moved the ciphers used by older PKCS#12 exports (RC2-40, RC4, DES)
* into the legacy provider, which Node does not load, so such keystores fail
* with `ERR_CRYPTO_UNSUPPORTED_OPERATION`.
*/
function createSecureServer(certificate, handler) {
	try {
		return createServer$1(certificate, handler);
	} catch (error) {
		if (certificate.pfx && error?.code === "ERR_CRYPTO_UNSUPPORTED_OPERATION") throw new Error([
			`Could not read \`${certificate.pfxPath}\`: it uses encryption that OpenSSL 3 no longer enables by default.`,
			"Convert it once with:",
			`  openssl pkcs12 -legacy -in ${certificate.pfxPath} -nodes -out converted.pem`,
			"  openssl pkcs12 -export -in converted.pem -out converted.pfx",
			"Alternatively, pass `--https.cert` and `--https.key`."
		].join("\n"), { cause: error });
		throw error;
	}
}
/**
* Bind a socket and nothing else, so the port can be taken before the Nuxt
* config is known and requests can be answered while it loads.
*/
async function bindListener(handler, options = {}) {
	const hostname = resolveBindHostname(options);
	const requestedPort = parsePort(options.port);
	const port = options.handover && requestedPort ? requestedPort : await resolvePort(requestedPort, hostname, options.strictPort);
	const httpsOptions = options.https === true ? {} : options.https;
	const certificate = httpsOptions ? await import("./cert-kjBThizO.mjs").then(({ resolveCertificate }) => resolveCertificate(httpsOptions)) : false;
	const server = certificate ? createSecureServer(certificate, handler) : createServer(handler);
	await bindServer(server, port, hostname, !!options.reusePort).catch((error) => {
		throw describeBindError(error, port, hostname, options.strictPort);
	});
	server.on("error", (error) => logger.error(`Dev server error: ${error.message}`));
	return {
		server,
		address: server.address(),
		https: certificate,
		hostname,
		requestedPort
	};
}
/**
* Resolve the URLs of an already bound server and, unless `announce` is false,
* start any tunnel and print, copy and open the URLs.
*/
async function createListener(bound, options = {}, { announce = true } = {}) {
	const { server, address, hostname, https: certificate } = bound;
	let tunnel;
	try {
		return await resolveListener();
	} catch (error) {
		await tunnel?.close().catch(() => {});
		throw error;
	}
	async function resolveListener() {
		const protocol = certificate ? "https" : "http";
		const baseURL = options.baseURL || "/";
		const formatURL = (host) => formatDisplayURL(protocol, host, address.port, baseURL);
		const anyHost = ANY_HOSTS.has(hostname);
		const url = formatURL(anyHost ? "localhost" : hostname);
		if (announce && options.tunnel) {
			const { startTunnel } = await import("./tunnel-CneTg7qS.mjs");
			tunnel = await startTunnel(`${protocol}://localhost:${address.port}`, !!certificate);
		}
		const tunnelURL = tunnel?.url && tunnel.url + baseURL;
		const portless = resolvePortlessURLs();
		const portlessURL = portless.url && portless.url + baseURL;
		const portlessShareURL = portless.shareURL && portless.shareURL + baseURL;
		const stackblitzURL = resolveStackblitzURL();
		function getURLs() {
			const urls = [];
			if (tunnelURL) urls.push({
				url: tunnelURL,
				type: "tunnel"
			});
			for (const portlessURL of portless.all) urls.push({
				url: portlessURL + baseURL,
				type: "public"
			});
			if (stackblitzURL) urls.push({
				url: stackblitzURL,
				type: "public"
			});
			if (anyHost) {
				urls.push({
					url: formatURL("localhost"),
					type: "local"
				});
				for (const address of getNetworkAddresses()) urls.push({
					url: formatURL(address),
					type: "network"
				});
			} else urls.push({
				url,
				type: "local"
			});
			return urls;
		}
		const shareableURL = options.publicURL || tunnelURL || portlessShareURL || portlessURL;
		const publicURL = shareableURL || stackblitzURL;
		const qrURL = options.qr === false ? void 0 : shareableURL || getURLs().find(({ type }) => type === "network")?.url || (options.qr ? url : void 0);
		function showURLs({ qr = false } = {}) {
			const urls = getURLs();
			const labels = {
				local: "Local:",
				network: "Network:",
				tunnel: "Tunnel:",
				public: "Public:"
			};
			const labelColors = {
				local: "green",
				network: "magenta",
				tunnel: "cyan",
				public: "magenta"
			};
			const lines = [];
			const line = (color, label, value, isQR) => `  ${color("➜")} ${styleText("bold", color(label.padEnd(10)))}${value}${isQR ? styleText("gray", " [QR code]") : ""}`;
			for (const { url: displayURL, type } of urls) lines.push(line((text) => styleText(labelColors[type], text), labels[type], styleText("cyan", displayURL), qr && displayURL === qrURL));
			if (!anyHost && !tunnel && !portless.url && !stackblitzURL) {
				const isolated = LOOPBACK_HOSTS.has(hostname) ? detectIsolatedEnvironment() : void 0;
				const hint = isolated ? `use ${styleText("white", "--host")} to reach this server from outside ${isolated}` : `use ${styleText("white", "--host")} to expose`;
				lines.push(line((text) => styleText("magenta", text), "Network:", styleText("gray", hint), false));
			}
			if (publicURL && publicURL !== url && !urls.some((entry) => entry.url === publicURL)) lines.push(line((text) => styleText("magenta", text), "Public:", styleText("cyan", publicURL), qr && publicURL === qrURL));
			console.log(`${qr ? "" : "\n"}${lines.join("\n")}\n`);
		}
		if (announce && (anyHost || !LOOPBACK_HOSTS.has(hostname))) logger.warn("The dev server is reachable from the network without authentication: anyone who can connect can read the app, build errors and source code.");
		if (announce) {
			if (options.showURL !== false) {
				const showQR = !!qrURL && isQRCodeVisible();
				if (showQR) await printQRCode(qrURL);
				showURLs({ qr: showQR });
			}
			if (options.clipboard) await copyURL(publicURL || url);
			if (options.open) openBrowser(options.openURL ? resolveOpenURL(options.openURL, url) : url);
		}
		return {
			url,
			publicURL,
			qrURL,
			address,
			server,
			https: certificate,
			getURLs,
			showURLs,
			close: () => Promise.all([tunnel?.close(), closeServer(server)]).then(() => {})
		};
	}
}
function closeServer(server) {
	return new Promise((resolve, reject) => {
		let forceClose;
		server.close((error) => {
			if (forceClose) clearTimeout(forceClose);
			if (error) reject(error);
			else resolve();
		});
		server.closeIdleConnections?.();
		forceClose = setTimeout(() => server.closeAllConnections?.(), CONNECTION_DRAIN_TIMEOUT_MS);
		forceClose.unref();
	});
}
function bindServer(server, port, hostname, reusePort) {
	return new Promise((resolve, reject) => {
		const onError = (error) => {
			if (reusePort && isUnsupportedOptionError(error)) {
				debug("`reusePort` is unsupported on this platform, binding without it:", error);
				bindServer(server, port, hostname, false).then(resolve, reject);
				return;
			}
			reject(error);
		};
		server.once("error", onError);
		try {
			server.listen({
				port,
				host: hostname || void 0,
				reusePort,
				exclusive: !reusePort
			}, () => {
				server.removeListener("error", onError);
				resolve();
			});
		} catch (error) {
			server.removeListener("error", onError);
			onError(error);
		}
	});
}
/**
* Whether the platform rejected the `reusePort` listen option itself, as opposed
* to refusing this particular bind. Linux reports `ENOTSUP`, Windows `EINVAL`,
* and Node validates the option before the bind on runtimes without support.
*/
function isUnsupportedOptionError(error) {
	return error.code === "ENOTSUP" || error.code === "EINVAL" || error.code === "ERR_INVALID_ARG_VALUE";
}
let reusePortSupport;
/**
* Whether two sockets can bind the same port at once via `SO_REUSEPORT`, probed
* on an ephemeral port. A single successful bind is not enough: some platforms
* accept the option and still reject the second socket. Support is a property of
* the platform rather than of an address, so the loopback probe stands in for
* whichever hostname the dev server ends up binding. Cached per process.
*/
function isReusePortSupported() {
	reusePortSupport ??= (async () => {
		const first = createServer();
		const second = createServer();
		try {
			await bindServer(first, 0, "127.0.0.1", true);
			const { port } = first.address();
			await bindServer(second, port, "127.0.0.1", true);
			return true;
		} catch (error) {
			debug("`reusePort` is not available:", error);
			return false;
		} finally {
			for (const server of [first, second]) if (server.listening) server.close();
		}
	})();
	return reusePortSupport;
}
function parsePort(value) {
	if (value === void 0 || value === "") return;
	const port = Number(value);
	if (!Number.isInteger(port) || port < 0 || port > 65535) throw new ActionableError(`Invalid port \`${value}\`; expected an integer between 0 and 65535.`);
	return port;
}
async function resolvePort(requestedPort, hostname, strictPort) {
	if (requestedPort === 0) return getPort({
		random: true,
		host: hostname || void 0
	});
	if (strictPort) return requestedPort ?? 3e3;
	const port = await getPort({
		port: requestedPort,
		alternativePortRange: [3e3, 3100],
		host: hostname || void 0
	});
	if (requestedPort && port !== requestedPort) logger.warn(`Port ${requestedPort} is in use, using port ${port} instead.`);
	return port;
}
/**
* Turn a `listen()` failure into actionable advice, leaving anything we have
* nothing better to say about untouched.
*/
function describeBindError(error, port, hostname, strictPort) {
	switch (error.code) {
		case "EADDRINUSE": return new Error(strictPort ? `Port ${port} is already in use (\`--strictPort\` is enabled).` : `Port ${port} is already in use.`, { cause: error });
		case "EACCES": return new Error(`Port ${port} requires elevated privileges. Pass \`--port\` with a port above 1023.`, { cause: error });
		case "EADDRNOTAVAIL": return new Error(`\`${hostname}\` is not an address of this machine. Pass \`--host\` with a local address, or omit it to listen on localhost.`, { cause: error });
		case "ENOTFOUND": return new Error(`\`${hostname}\` could not be resolved. Pass \`--host\` with a local address, or omit it to listen on localhost.`, { cause: error });
	}
	return error;
}
/**
* Whether block art is worth printing. A QR code is a couple of dozen lines of
* Unicode blocks that nothing downstream of a pipe can scan, so it is only
* drawn where someone is looking at a terminal.
*/
function isQRCodeVisible() {
	return !!process.stdout.isTTY && !isCI;
}
async function printQRCode(url, { showURL = false } = {}) {
	const { renderUnicodeCompact } = await import("uqr");
	const caption = showURL ? `\n${centerBlock(styleText("cyan", url), url.length)}` : "";
	console.log(`\n${centerBlock(renderUnicodeCompact(url))}${caption}\n`);
}
/** Write `text` to the system clipboard, resolving whether it succeeded. */
async function writeClipboard(text) {
	if (!hasDisplayServer()) return false;
	try {
		const { writeText } = await import("tinyclip");
		await writeText(text);
		return true;
	} catch (error) {
		debug("Failed to write to the clipboard:", error);
		return false;
	}
}
async function copyURL(url) {
	if (await writeClipboard(url)) logger.info("URL copied to clipboard.");
	else logger.warn("No clipboard is available in this environment.");
}
const DISPLAY_REQUIRED_PLATFORMS = /* @__PURE__ */ new Set([
	"linux",
	"freebsd",
	"openbsd"
]);
/**
* Whether a graphical session exists to receive a clipboard write or a browser
* launch. The tools involved on Linux and BSD (`wl-copy`, `xsel`, `xclip`,
* `xdg-open`) all need one, and fail in unhelpful ways without it: clipboard
* tools exit before reading their input, so the write fails with `EPIPE`.
*/
function hasDisplayServer(env = process.env) {
	if (!DISPLAY_REQUIRED_PLATFORMS.has(process.platform)) return true;
	return !!(env.WSL_DISTRO_NAME || env.WAYLAND_DISPLAY || env.DISPLAY);
}
function centerBlock(block, blockWidth) {
	const lines = block.split("\n");
	const width = blockWidth ?? Math.max(...lines.map((line) => line.length));
	const columns = Math.min(process.stdout.columns || 80, 80);
	const indent = " ".repeat(Math.max(0, Math.floor((columns - width) / 2)));
	return lines.map((line) => indent + line).join("\n");
}
function resolveOpenURL(target, baseURL) {
	try {
		return new URL(target, baseURL).href;
	} catch {
		logger.warn(`Ignoring invalid \`--open.url\` value: ${target}`);
		return baseURL;
	}
}
const DEFAULT_LAUNCHERS = /* @__PURE__ */ new Set([
	"open",
	"xdg-open",
	"start",
	"cmd",
	"cmd.exe"
]);
/**
* Resolve the command that opens `url`, honouring the de facto `BROWSER` and
* `BROWSER_ARGS` environment variables (`BROWSER=none` disables opening).
*/
function resolveOpenCommand(url, platform = process.platform, env = process.env) {
	const browser = env.BROWSER?.trim();
	if (browser === "none") return;
	if (browser && !DEFAULT_LAUNCHERS.has(browser)) {
		const browserArgs = env.BROWSER_ARGS?.trim().split(/\s+/).filter(Boolean) ?? [];
		return platform === "darwin" && !browser.includes("/") ? ["open", [
			"-a",
			browser,
			url,
			...browserArgs.length > 0 ? ["--args", ...browserArgs] : []
		]] : [browser, [...browserArgs, url]];
	}
	if (platform === "darwin") return ["open", [url]];
	if (platform === "win32" || isWsl(platform, env)) return ["cmd.exe", [
		"/c",
		"start",
		"\"\"",
		url.replace(/[&^]/g, "^$&")
	]];
	return ["xdg-open", [url]];
}
/** How long a launcher has to fail before we assume the browser did open. */
const BROWSER_LAUNCH_TIMEOUT_MS = 3e3;
function openBrowser(url) {
	const resolved = resolveOpenCommand(url);
	if (!resolved) return;
	const [command, args] = resolved;
	if (command === "xdg-open" && !hasDisplayServer()) {
		logger.warn(`No browser is available in this environment. Open ${styleText("cyan", url)} manually.`);
		return;
	}
	const onFailure = (error) => {
		debug("Failed to open browser:", error);
		logger.warn(`Could not open ${styleText("cyan", url)} in a browser.`);
	};
	try {
		const child = spawn(command, args, {
			stdio: "ignore",
			detached: true
		});
		child.once("error", onFailure);
		const onExit = (code) => {
			if (code) onFailure(/* @__PURE__ */ new Error(`\`${command}\` exited with code ${code}`));
		};
		child.once("exit", onExit);
		setTimeout(() => child.off("exit", onExit), BROWSER_LAUNCH_TIMEOUT_MS).unref();
		child.unref();
	} catch (error) {
		onFailure(error);
	}
}
//#endregion
export { matchesBoundTarget as a, printQRCode as c, writeClipboard as d, resolvePortlessURLs as f, isReusePortSupported as i, resolveOpenURL as l, copyURL as n, openBrowser as o, createListener as r, parsePort as s, bindListener as t, resolvePort as u };
