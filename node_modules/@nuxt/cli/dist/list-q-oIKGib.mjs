import { h as defineCommand, l as rootDirArgs, o as jsonArgs } from "./_shared-YyGADOl7.mjs";
import { u as logger } from "./startup-clock-DXZlxuSA.mjs";
import { i as printJson } from "./console-BgmzEcbV.mjs";
import { i as resolveRootDir } from "./paths-DlXZaaIg.mjs";
import { a as reportTaskError, i as missingTaskRoutesHint, l as taskArgs, n as fetchTasks, s as resolveTaskServer, t as emptyTaskListHint } from "./_utils-Cojb-kuS.mjs";
import process from "node:process";
import { styleText } from "node:util";
//#region src/commands/task/list.ts
var list_default = defineCommand({
	meta: {
		name: "list",
		description: "List the tasks a Nuxt server exposes"
	},
	args: {
		...rootDirArgs,
		...taskArgs,
		...jsonArgs
	},
	async run(ctx) {
		const cwd = resolveRootDir(ctx.args);
		const server = await resolveTaskServer(ctx.args);
		const response = await fetchTasks(server);
		if (!response.ok) {
			reportTaskError(response);
			if (response.status === 404) logger.info(missingTaskRoutesHint());
			process.exit(1);
		}
		const { tasks = {}, scheduledTasks } = response.data || {};
		const names = Object.keys(tasks).sort();
		if (ctx.args.json) {
			await printJson({
				tasks: names.map((name) => ({
					name,
					description: tasks[name]?.description || null
				})),
				scheduledTasks: (scheduledTasks || []).map(({ cron, tasks }) => ({
					cron,
					tasks
				}))
			});
			return;
		}
		if (names.length === 0) {
			logger.info(`No tasks found. ${await emptyTaskListHint(cwd)}`);
			return;
		}
		const width = Math.max(...names.map((name) => name.length));
		const lines = names.map((name) => `  ${styleText("cyan", name.padEnd(width))}  ${styleText("dim", tasks[name]?.description || "")}`.trimEnd());
		if (scheduledTasks && scheduledTasks.length > 0) {
			lines.push("", `  ${styleText("bold", "Scheduled")}`);
			for (const { cron, tasks: scheduled } of scheduledTasks) lines.push(`  ${styleText("cyan", cron)}  ${styleText("dim", scheduled.join(", "))}`);
		}
		process.stdout.write(`${lines.join("\n")}\n`);
	}
});
//#endregion
export { list_default as default };
