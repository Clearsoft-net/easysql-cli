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

/**
 * Runs the CLI with the given argv. Returns the exit code instead of
 * calling process.exit — used by the binary entrypoint and by tests.
 */
export async function run(argv: string[]): Promise<number> {
	const program = buildProgram();
	try {
		await program.parseAsync(argv, { from: "user" });
		return 0;
	} catch (err) {
		if (err instanceof CliError) {
			printError(err.message);
			return err.exitCode;
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
				return 0;
			}
			if (code === "commander.unknownCommand" || code === "commander.unknownOption") {
				return 1;
			}
		}
		const message = err instanceof Error ? err.message : String(err);
		printError(message);
		return 1;
	}
}
