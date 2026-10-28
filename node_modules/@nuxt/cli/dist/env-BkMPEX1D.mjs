import { u as logger } from "./startup-clock-DXZlxuSA.mjs";
import process from "node:process";
import { styleText } from "node:util";
//#region src/utils/env.ts
function overrideEnv(targetEnv) {
	const currentEnv = process.env.NODE_ENV;
	if (currentEnv && currentEnv !== targetEnv) logger.warn(`Changing ${styleText("cyan", "NODE_ENV")} from ${styleText("cyan", currentEnv)} to ${styleText("cyan", targetEnv)}, to avoid unintended behavior.`);
	process.env.NODE_ENV = targetEnv;
}
//#endregion
export { overrideEnv as t };
