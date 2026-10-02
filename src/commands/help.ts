/**
 * `easysql help [command]` — manual help system.
 */

import type { Command } from "commander";
import {
	HELP_COMMANDS,
	HELP_CONNECTION_ADD,
	HELP_CONNECTION_LIST,
	HELP_CONNECTION_REMOVE,
	HELP_CONNECTION_SYNC,
	HELP_DEMO,
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
	demo: HELP_DEMO,
	"connection add": HELP_CONNECTION_ADD,
	"connection sync": HELP_CONNECTION_SYNC,
	"connection list": HELP_CONNECTION_LIST,
	"connection remove": HELP_CONNECTION_REMOVE,
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
