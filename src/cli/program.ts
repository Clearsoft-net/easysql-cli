/**
 * Commander program setup — wires every subcommand and the global options.
 */

import { Command } from "commander";
import { registerHelp } from "../commands/help.js";
import {
	registerConnector,
	registerHistory,
	registerLogin,
	registerLogout,
	registerQuery,
	registerUpdate,
	registerUsage,
} from "../commands/stubs.js";
import { HELP_COMMANDS, HELP_GLOBAL_OPTIONS, HELP_TOP } from "../i18n/help.js";
import { setColorsEnabled, setJsonMode } from "../output/print.js";
import { VERSION } from "../version.js";
import type { GlobalOptions } from "./global-options.js";

export function buildProgram(): Command {
	const program = new Command();

	program
		.name("easysql")
		.description("EasySQL CLI — run natural-language queries against your local database")
		.version(VERSION, "-v, --version", "Print version")
		.helpOption("-h, --help", "Print help")
		.addHelpText("beforeAll", () => HELP_TOP)
		.addHelpText("after", () => `\n${HELP_COMMANDS}\n\n${HELP_GLOBAL_OPTIONS}`)
		.option("--api-url <url>", "EasySQL API base URL")
		.option("--config <path>", "Override the local config file path")
		.option("--json", "Output machine-readable JSON")
		.option("--no-color", "Disable ANSI colors")
		.showHelpAfterError(true)
		.exitOverride();

	// Pre-action: apply global flags before any subcommand runs.
	program.hook("preAction", (thisCommand) => {
		const opts = thisCommand.opts<GlobalOptions>();
		if (opts.json) setJsonMode(true);
		if (opts.color === false) setColorsEnabled(false);
	});

	registerHelp(program);
	registerLogin(program);
	registerLogout(program);
	registerConnector(program);
	registerQuery(program);
	registerUsage(program);
	registerHistory(program);
	registerUpdate(program);

	return program;
}
