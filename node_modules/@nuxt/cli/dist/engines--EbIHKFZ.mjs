import { f as engines } from "./_shared-YyGADOl7.mjs";
import { u as logger } from "./startup-clock-DXZlxuSA.mjs";
import process from "node:process";
import { styleText } from "node:util";
import { satisfies } from "verkit";
//#region src/utils/engines.ts
async function checkEngines() {
	const currentNode = process.versions.node;
	if (!satisfies(currentNode, engines.node)) logger.warn(`Current version of Node.js (${styleText("cyan", currentNode)}) is unsupported and might cause issues.\n       Please upgrade to a compatible version ${styleText("cyan", engines.node)}.`);
}
//#endregion
export { checkEngines };
