/**
 * Command stubs — wired in commits 3+. Kept as `throw new Error("not implemented")`
 * so the program tree is verifiable end-to-end before business logic lands.
 */

import type { Command } from "commander";

function notImplemented(name: string) {
	return () => {
		console.error(`'${name}' is not implemented yet (arrives in a later commit).`);
		process.exit(1);
	};
}

export function registerLogin(program: Command): void {
	program
		.command("login")
		.description("Authenticate with an EasySQL API key")
		.option("--api-key <key>", "Provide the API key inline (otherwise prompted)")
		.option("--api-url <url>", "Override the API base URL for this login")
		.action(notImplemented("login"));
}

export function registerLogout(program: Command): void {
	program
		.command("logout")
		.description("Clear stored credentials")
		.action(notImplemented("logout"));
}

export function registerConnector(program: Command): void {
	const conn = program.command("connector").description("Manage local connectors");

	conn.command("add")
		.description("Add a local MySQL/Postgres connector")
		.option("--name <name>", "Connector name")
		.option("--type <type>", "mysql | mariadb | postgresql")
		.option("--connection-url <url>", "Full connection URL")
		.option("--host <host>", "Database host")
		.option("--port <port>", "Database port", (v) => Number.parseInt(v, 10))
		.option("--user <user>", "Database user")
		.option("--password <pass>", "Database password (otherwise prompted)")
		.option("--database <db>", "Database name")
		.option("--ssl", "Require SSL/TLS")
		.action(notImplemented("connector add"));

	conn.command("sync")
		.description("Re-extract and push schema metadata")
		.option("--id <id>", "Sync a specific connector")
		.action(notImplemented("connector sync"));

	conn.command("list")
		.description("List connectors known to EasySQL")
		.action(notImplemented("connector list"));
}

export function registerQuery(program: Command): void {
	program
		.command("query")
		.description("Generate SQL and run it against the local DB")
		.argument("<question...>", "Natural-language question")
		.option("--connector <id|name>", "Connector to use (otherwise prompted)")
		.option("--generate-only", "Print the SQL without executing")
		.option("--rows <n>", "Override LIMIT", (v) => Number.parseInt(v, 10))
		.option("--format <fmt>", "table | json | csv", "table")
		.allowExcessArguments(true)
		.action(notImplemented("query"));
}

export function registerUsage(program: Command): void {
	program
		.command("usage")
		.description("Show plan consumption (quota used vs remaining)")
		.action(notImplemented("usage"));
}

export function registerHistory(program: Command): void {
	program
		.command("history")
		.description("Show the local read-only question log")
		.option("--limit <n>", "Show the last N entries", (v) => Number.parseInt(v, 10), 50)
		.option("--clear", "Clear the local history")
		.action(notImplemented("history"));
}

export function registerUpdate(program: Command): void {
	program
		.command("update")
		.description("Self-update to the latest release")
		.option("--check", "Report current and latest version without installing")
		.option("--target <path>", "Path of the binary to replace")
		.action(notImplemented("update"));
}
