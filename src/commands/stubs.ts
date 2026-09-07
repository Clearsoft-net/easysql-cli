/**
 * Command stubs for commands that are NOT yet wired in the current commit.
 * Each is replaced with a real implementation in a subsequent commit so
 * the program tree is verifiable end-to-end before business logic lands.
 */

import type { Command } from "commander";

function notImplemented(name: string) {
	return () => {
		console.error(`'${name}' is not implemented yet (arrives in a later commit).`);
		process.exit(1);
	};
}

export function registerUpdate(program: Command): void {
	program
		.command("update")
		.description("Self-update to the latest release")
		.option("--check", "Report current and latest version without installing")
		.option("--target <path>", "Path of the binary to replace")
		.action(notImplemented("update"));
}
