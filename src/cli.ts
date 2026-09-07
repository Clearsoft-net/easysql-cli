#!/usr/bin/env bun

/**
 * CLI entrypoint — runs the commander program with global error handling.
 *
 * Exit codes:
 *   0  success
 *   1  generic / commander parse error
 *   2  not authenticated
 *   3  network error
 *   4  API error
 *   5  safety violation (e.g. mutation rejected locally)
 */

import { CliError } from "./cli/errors.js";
import { buildProgram } from "./cli/program.js";
import { printError } from "./output/print.js";

async function main() {
	const program = buildProgram();
	try {
		await program.parseAsync(process.argv);
	} catch (err) {
		if (err instanceof CliError) {
			printError(err.message);
			process.exit(err.exitCode);
		}
		// Commander's exitOverride throws CommanderError for parse failures.
		if (err && typeof err === "object" && "code" in err) {
			const code = (err as { code: string }).code;
			if (
				code === "commander.helpDisplayed" ||
				code === "commander.versionDisplayed" ||
				code === "commander.help" ||
				code === "commander.version"
			) {
				process.exit(0);
			}
			if (code === "commander.unknownCommand" || code === "commander.unknownOption") {
				process.exit(1);
			}
		}
		const message = err instanceof Error ? err.message : String(err);
		printError(message);
		process.exit(1);
	}
}

await main();
