/**
 * `easysql help [command]` — manual help system.
 */

import type { Command } from "commander";
import {
	HELP_COMMANDS,
	HELP_CONNECTOR_ADD,
	HELP_CONNECTOR_LIST,
	HELP_CONNECTOR_SYNC,
	HELP_GLOBAL_OPTIONS,
	HELP_HELP,
	HELP_HISTORY,
	HELP_LOGIN,
	HELP_LOGOUT,
	HELP_QUERY,
	HELP_TOP,
	HELP_UPDATE,
	HELP_USAGE,
} from "../i18n/help.js";

const HELP_BY_TOPIC: Record<string, string> = {
	login: HELP_LOGIN,
	logout: HELP_LOGOUT,
	"connector add": HELP_CONNECTOR_ADD,
	"connector sync": HELP_CONNECTOR_SYNC,
	"connector list": HELP_CONNECTOR_LIST,
	query: HELP_QUERY,
	usage: HELP_USAGE,
	history: HELP_HISTORY,
	update: HELP_UPDATE,
	help: HELP_HELP,
};

export function renderHelp(topic?: string): string {
	if (!topic) {
		return [HELP_TOP, HELP_COMMANDS, HELP_GLOBAL_OPTIONS].join("\n\n");
	}
	const body = HELP_BY_TOPIC[topic];
	if (!body) {
		return `Unknown command: '${topic}'.\n\n${HELP_TOP}\n${HELP_COMMANDS}`;
	}
	return body;
}

export function registerHelp(program: Command): void {
	program
		.command("help [command]")
		.description("Show help (optionally for a specific command)")
		.action((command?: string) => {
			console.log(renderHelp(command));
		});
}
