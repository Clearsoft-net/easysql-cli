/**
 * Commander program setup — wires every subcommand and the global options.
 */

import { Command } from "commander";
import { registerConnector } from "../commands/connector.js";
import { registerHelp } from "../commands/help.js";
import { registerHistory } from "../commands/history.js";
import { registerLogin } from "../commands/login.js";
import { registerLogout } from "../commands/logout.js";
import { registerQuery } from "../commands/query.js";
import { registerUpdate } from "../commands/stubs.js";
import { registerUsage } from "../commands/usage.js";
import { setConfigPathOverride } from "../config/paths.js";
import { HELP_COMMANDS, HELP_GLOBAL_OPTIONS, HELP_TOP } from "../i18n/help.js";
import { setColorsEnabled, setJsonMode } from "../output/print.js";
import { startRepl } from "../tui/repl.js";
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
		.exitOverride()
		.action(async (_opts, command) => {
			// Bare 'easysql' (no subcommand) opens the interactive TUI shell.
			const parentOpts = (command.parent?.opts() ?? {}) as { connector?: string };
			const code = await startRepl({ connector: parentOpts.connector });
			if (code !== 0) process.exit(code);
		});

	// Pre-action: apply global flags before any subcommand runs.
	program.hook("preAction", (_thisCommand, actionCommand) => {
		const opts = program.opts<GlobalOptions>();
		if (opts.json) setJsonMode(true);
		if (opts.color === false) setColorsEnabled(false);
		if (opts.config) setConfigPathOverride(opts.config);
		void actionCommand;
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
