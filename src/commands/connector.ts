/**
 * `easysql connector add|sync|list` — manage local connectors.
 *
 * `add` introspects a LOCAL MySQL/PostgreSQL database and pushes ONLY the
 * schema metadata to the EasySQL API. Credentials never leave the host.
 *
 * `sync` re-extracts the schema from a registered local DB and updates
 * the API-side cache.
 *
 * `list` shows the connectors known to the user's EasySQL account.
 */

import type { Command } from "commander";
import { CliError, NotLoggedInError } from "../cli/errors.js";
import {
	introspectDatabase,
	mergeConnection,
	type ParsedConnection,
	parseConnectionUrl,
} from "../db/introspect.js";
import { t } from "../i18n/messages.js";
import { printError, printInfo, printSuccess } from "../output/print.js";
import { getSavedClient } from "../sdk/client.js";
import { promptSecret } from "../util/prompt.js";

interface ConnectorAddOptions {
	name?: string;
	type?: string;
	connectionUrl?: string;
	host?: string;
	port?: number;
	user?: string;
	password?: string;
	database?: string;
	ssl?: boolean;
}

async function resolveConnection(opts: ConnectorAddOptions): Promise<ParsedConnection> {
	if (!opts.name) throw new Error("--name is required.");
	if (!opts.type) throw new Error("--type is required (mysql | mariadb | postgresql).");

	const type = opts.type as ParsedConnection["type"];
	const allowed: ParsedConnection["type"][] = ["mysql", "mariadb", "postgresql"];
	if (!allowed.includes(type)) {
		throw new Error(`Invalid --type '${opts.type}'. Use one of: ${allowed.join(", ")}`);
	}

	let conn: ParsedConnection;
	if (opts.connectionUrl) {
		const fromUrl = parseConnectionUrl(opts.connectionUrl);
		conn = mergeConnection(fromUrl, { type, ssl: opts.ssl });
	} else {
		if (!opts.user) throw new Error("--user is required (or pass --connection-url).");
		if (!opts.database) throw new Error("--database is required (or pass --connection-url).");
		let password = opts.password ?? "";
		if (!password) {
			const secret = await promptSecret(`${t().prompts.passwordPrompt}: `);
			if (secret !== null) password = secret;
		}
		const port = opts.port ?? (type === "postgresql" ? 5432 : 3306);
		conn = {
			type,
			host: opts.host ?? "127.0.0.1",
			port,
			user: opts.user,
			password,
			database: opts.database,
			ssl: opts.ssl ?? false,
		};
	}

	if (!conn.password) {
		const secret = await promptSecret(`${t().prompts.passwordPrompt}: `);
		if (secret !== null) conn.password = secret;
	}
	return conn;
}

function registerAdd(program: Command): void {
	program
		.command("add")
		.description("Add a local MySQL/Postgres connector (schema-only)")
		.option("--name <name>", "Connector name")
		.option("--type <type>", "mysql | mariadb | postgresql")
		.option("--connection-url <url>", "Full connection URL")
		.option("--host <host>", "Database host")
		.option("--port <port>", "Database port", (v) => Number.parseInt(v, 10))
		.option("--user <user>", "Database user")
		.option("--password <pass>", "Database password (otherwise prompted)")
		.option("--database <db>", "Database name")
		.option("--ssl", "Require SSL/TLS")
		.action(async (opts: ConnectorAddOptions) => {
			let conn: ParsedConnection;
			try {
				conn = await resolveConnection(opts);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				printError(msg);
				throw new CliError(msg, 1);
			}

			printInfo(t().info.introspectingDb);
			const schema = await introspectDatabase(conn);

			const { client } = getSavedClient();
			const result = (await client.createConnector({
				name: opts.name,
				type: conn.type,
				schema,
			})) as { id?: string; name?: string };

			printSuccess(
				t().success.connectorAdded(result.name ?? opts.name ?? "", result.id ?? ""),
			);
		});
}

function registerSync(program: Command): void {
	program
		.command("sync")
		.description("Re-extract and push schema metadata")
		.option("--id <id>", "Sync a specific connector")
		.action(async (opts: { id?: string }) => {
			const { client } = getSavedClient();
			if (opts.id) {
				throw new Error(
					"--id mode is not yet supported (sync-by-name requires local DB config storage).",
				);
			}
			throw new Error(
				"To resync a connector, run `easysql connector add --name ...` again with the same name; the server updates the schema in place.",
			);
		});
}

function registerList(program: Command): void {
	program
		.command("list")
		.description("List connectors known to EasySQL")
		.action(async () => {
			const { client } = getSavedClient();
			const result = (await client.listConnectors()) as unknown;
			if (Array.isArray(result)) {
				if (result.length === 0) {
					console.log("(no connectors yet — run `easysql connector add`)");
					return;
				}
				console.table(
					result.map((c) => ({
						id: c.id ?? "",
						name: c.name ?? "",
						type: c.type ?? "",
						updated_at: c.updated_at ?? "",
					})),
				);
				return;
			}
			console.log(JSON.stringify(result, null, 2));
		});
}

export function registerConnector(program: Command): void {
	const group = program.command("connector").description("Manage local connectors");
	registerAdd(group);
	registerSync(group);
	registerList(group);
}

void NotLoggedInError; // re-exported for clarity
