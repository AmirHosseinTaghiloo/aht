import { fileURLToPath } from "node:url";
import { readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { serve } from "srvx/node";
import { staticMiddleware } from "srvx/static";
//#region src/runtime/node.ts
/**
* Serve the build's static assets, and hand everything else to the renderer.
*
* The static handler comes first so a request for a hashed asset never reaches a render.
*/
function createNodeServer(options) {
	const dir = typeof options.publicDir === "string" ? options.publicDir : fileURLToPath(options.publicDir);
	const serveStatic = staticMiddleware({ dir });
	const publicFiles = listFiles(dir);
	return { fetch: async (request) => {
		const files = await publicFiles;
		if (!files || mayBeStaticFile(files, request)) return serveStatic(request, () => options.fetch(request));
		return options.fetch(request);
	} };
}
async function listFiles(dir) {
	try {
		const entries = await readdir(dir, {
			recursive: true,
			withFileTypes: true
		});
		const files = /* @__PURE__ */ new Set();
		for (const entry of entries) if (entry.isFile()) files.add("/" + relative(dir, join(entry.parentPath, entry.name)).split(sep).join("/"));
		return files;
	} catch {
		return;
	}
}
/** Whether the request path, or one of the variants the static handler tries, is a public file. */
function mayBeStaticFile(files, request) {
	let path;
	try {
		path = decodeURIComponent(new URL(request.url).pathname);
	} catch {
		return true;
	}
	if (path.endsWith("/")) return files.has(path + "index.html");
	return files.has(path) || files.has(path + ".html") || files.has(path + "/index.html");
}
/** Listen for requests, using the port and host the platform environment configures. */
function listen(server) {
	serve({ fetch: server.fetch });
}
//#endregion
export { createNodeServer, listen };
