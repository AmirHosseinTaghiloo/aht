import { S as ActionableError, s as debug, u as logger } from "./startup-clock-DXZlxuSA.mjs";
import { t as findInPath } from "./path-env-D9Xd_BAN.mjs";
import { t as getCacheDir } from "./cache-CKYx3gns.mjs";
import { t as resolveTool } from "./binaries-BwgN39nD.mjs";
import process from "node:process";
import { styleText } from "node:util";
import { join } from "pathe";
import { existsSync, readFileSync } from "node:fs";
import { isIP } from "node:net";
import { X509Certificate, createHash, createPrivateKey } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
//#region src/dev/cert.ts
async function resolveCertificate(options) {
	if (options.pfx) return {
		pfx: await readCertificateFile(options.pfx, "--https.pfx"),
		pfxPath: options.pfx,
		passphrase: options.passphrase
	};
	if (options.cert && options.key) {
		const [cert, key] = await Promise.all([readCertificateFile(options.cert, "--https.cert"), readCertificateFile(options.key, "--https.key")]);
		return {
			cert: cert.toString("utf8"),
			key: key.toString("utf8"),
			passphrase: options.passphrase
		};
	}
	return generateCertificate(options);
}
/** Read a file the user pointed `--https.*` at, naming the flag when it cannot be read. */
async function readCertificateFile(path, flag) {
	try {
		return await readFile(path);
	} catch (error) {
		const reason = error.code === "ENOENT" ? `There is no file at ${styleText("cyan", path)}` : `Cannot read ${styleText("cyan", path)} (${error.code})`;
		throw new ActionableError([
			`${styleText("red", reason)}${styleText("red", ", given as")} ${styleText("cyan", flag)}${styleText("red", ".")}`,
			"",
			`Point ${styleText("cyan", flag)} at a readable file, or drop it and let Nuxt generate a certificate.`
		].join("\n"));
	}
}
/** Regenerate rather than serve a certificate that expires within the day. */
const CERT_MIN_REMAINING_MS = 864e5;
async function generateCertificate(options) {
	const domains = options.domains?.length ? options.domains : [
		"localhost",
		"127.0.0.1",
		"::1"
	];
	const hash = createHash("sha256").update(domains.join(",")).digest("hex").slice(0, 8);
	const dir = getCacheDir("certs", hash);
	const certPath = join(dir, "cert.pem");
	const keyPath = join(dir, "key.pem");
	const caRootPath = join(dir, "caroot");
	if (!isCertificateUsable(certPath, keyPath, domains)) {
		const caRoot = await generateWithMkcert(certPath, keyPath, domains);
		if (caRoot === void 0 && !generateWithOpenssl(certPath, keyPath, domains, options.validityDays)) throw new ActionableError("Could not generate a development certificate. Install `mkcert` (https://github.com/FiloSottile/mkcert) or provide `--https.cert` and `--https.key`.");
		await writeFile(caRootPath, caRoot ?? "", "utf8").catch((error) => debug("Could not record the certificate authority root:", error));
	}
	return {
		cert: await readFile(certPath, "utf8"),
		key: await readFile(keyPath, "utf8"),
		caRoot: await readFile(caRootPath, "utf8").then((value) => value.trim() || void 0).catch(() => void 0)
	};
}
/**
* A cached certificate is only reusable if it still has meaningful validity
* left, covers every requested domain, and matches the cached key. Checking the
* certificate itself means a shorter `--https.validityDays` is respected.
*/
function isCertificateUsable(certPath, keyPath, domains) {
	if (!existsSync(certPath) || !existsSync(keyPath)) return false;
	try {
		const certificate = new X509Certificate(readFileSync(certPath));
		if (Date.parse(certificate.validTo) - Date.now() < CERT_MIN_REMAINING_MS) return false;
		return domains.every((domain) => isIP(domain) ? certificate.checkIP(domain) !== void 0 : certificate.checkHost(domain) !== void 0) && certificate.checkPrivateKey(createPrivateKey(readFileSync(keyPath)));
	} catch (error) {
		debug("Ignoring unreadable cached certificate:", error);
		return false;
	}
}
/** The certificate authority root `mkcert` issued from, or `undefined` if it could not be used. */
async function generateWithMkcert(certPath, keyPath, domains) {
	const binary = await resolveMkcert();
	if (!binary) return;
	try {
		execFileSync(binary, ["-install"], { stdio: [
			"inherit",
			"ignore",
			"inherit"
		] });
		execFileSync(binary, [
			"-cert-file",
			certPath,
			"-key-file",
			keyPath,
			...domains
		], { stdio: "ignore" });
		return execFileSync(binary, ["-CAROOT"], { encoding: "utf8" }).trim() || "";
	} catch (error) {
		debug("Failed to generate certificate with mkcert:", error);
		return;
	}
}
async function resolveMkcert() {
	const platform = {
		darwin: "darwin",
		linux: "linux",
		win32: "windows"
	}[process.platform];
	const arch = process.arch === "arm64" ? "arm64" : "amd64";
	return resolveTool("mkcert", {
		url: platform && `https://dl.filippo.io/mkcert/latest?for=${platform}/${arch}`,
		consent: {
			key: "mkcert",
			notice: [
				"`--https` can install `mkcert` to generate a locally-trusted certificate.",
				"This downloads the `mkcert` binary and adds a local certificate authority to your system trust store.",
				"",
				"Project: https://github.com/FiloSottile/mkcert (BSD-3-Clause)"
			],
			message: "Download `mkcert` and install a local certificate authority?",
			nonInteractiveWarning: "Skipping `mkcert` download (needs interactive consent). Falling back to a self-signed certificate. Install `mkcert` manually for a locally-trusted certificate."
		}
	});
}
function generateWithOpenssl(certPath, keyPath, domains, validityDays = 30) {
	if (!findInPath("openssl")) return false;
	const altNames = domains.map((domain) => isIP(domain) ? `IP:${domain}` : `DNS:${domain}`).join(",");
	try {
		execFileSync("openssl", [
			"req",
			"-x509",
			"-newkey",
			"ec",
			"-pkeyopt",
			"ec_paramgen_curve:prime256v1",
			"-nodes",
			"-keyout",
			keyPath,
			"-out",
			certPath,
			"-days",
			String(validityDays),
			"-subj",
			`/CN=${domains[0]}`,
			"-addext",
			`subjectAltName=${altNames}`
		], { stdio: "ignore" });
		logger.warn("Generated a self-signed certificate. Install `mkcert` for a locally-trusted certificate.");
		return true;
	} catch (error) {
		debug("Failed to generate certificate with openssl:", error);
		return false;
	}
}
//#endregion
export { resolveCertificate };
