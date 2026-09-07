/**
 * `easysql update` — self-update from GitHub Releases.
 *
 * --check   report current vs latest (no install)
 * (default) download the latest binary and atomically replace the running
 *            executable
 */

import type { Command } from "commander";
import { CliError } from "../cli/errors.js";
import { t } from "../i18n/messages.js";
import { printError, printInfo, printSuccess } from "../output/print.js";
import { currentPlatform, selfUpdate } from "../update/self-update.js";

interface UpdateOptions {
	check?: boolean;
	target?: string;
}

export function registerUpdate(program: Command): void {
	program
		.command("update")
		.description("Self-update to the latest release")
		.option("--check", "Report current and latest version without installing")
		.option(
			"--target <path>",
			"Path of the binary to replace (default: the running executable)",
		)
		.action(async (opts: UpdateOptions) => {
			let target = opts.target;
			if (!target) {
				// process.execPath works for both Node and bun-compiled binaries,
				// because bun embeds itself but keeps process.execPath pointing
				// to the user's executable.
				target = process.execPath;
			}
			if (!target) {
				throw new CliError("Could not determine the path of the running binary.", 1);
			}

			printInfo(t().info.fetchingLatest);
			const result = await selfUpdate({
				target,
				checkOnly: !!opts.check,
			}).catch((err) => {
				if (err instanceof CliError) {
					printError(err.message);
					throw new CliError(err.message, err.exitCode);
				}
				throw err;
			});

			console.log(`Current version: ${result.current}`);
			console.log(`Latest version:  ${result.latest}`);
			console.log(`Platform:        ${currentPlatform()}`);

			if (opts.check) {
				if (result.updated === false && result.latest === result.current) {
					printSuccess("Already on the latest version.");
				}
				return;
			}

			if (!result.updated) {
				printSuccess(t().success.updateAlreadyLatest(result.current, result.latest));
				return;
			}
			printSuccess(t().success.updated(result.current, result.latest));
		});
}
