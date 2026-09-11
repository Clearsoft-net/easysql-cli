/**
 * `easysql connector add|sync|list` — manage local connectors.
 *
 * `add` introspects a LOCAL MySQL/PostgreSQL/SQLite database and pushes
 * ONLY the schema metadata to the EasySQL API. Credentials never leave
 * the host. SQLite connectors have no credentials — the connection
 * parameter is the absolute path to a `.db` file.
 *
 * `sync` re-extracts the schema from a registered local DB and updates
 * the API-side cache.
 *
 * `list` shows the connectors known to the user's EasySQL account.
 *
 * `add` is interactive by default: when a required flag is missing, the
 * CLI asks for it via promptLine. Pass --non-interactive (alias -y) to
 * disable prompts and fail with a clear error instead.
 */

import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { isatty } from "node:tty";
import type { Command } from "commander";
import { ApiError, CliError, NotLoggedInError } from "../cli/errors.js";
import {
	findConnectorById,
	findConnectorByName,
	loadConnectors,
	removeConnector,
	upsertConnector,
} from "../config/connectors-store.js";
import {
	introspectDatabase,
	mergeConnection,
	type ParsedConnection,
	parseConnectionUrl,
} from "../db/introspect.js";
import { syncLocalConnector } from "../db/sync-connector.js";
import { t } from "../i18n/messages.js";
import { printError, printInfo, printSuccess } from "../output/print.js";
import { getSavedClient } from "../sdk/client.js";
import { promptLine, promptLineDefault, promptSecret } from "../util/prompt.js";

interface ConnectorAddOptions {
	name?: string;
	type?: string;
	connectionUrl?: string;
	file?: string;
	host?: string;
	port?: number;
	user?: string;
	password?: string;
	database?: string;
	ssl?: boolean;
	nonInteractive?: boolean;
}

const ALLOWED_TYPES: ParsedConnection["type"][] = ["mysql", "mariadb", "postgresql", "sqlite"];

async function askLine(
	question: string,
	defaultValue: string | undefined,
	nonInteractive: boolean,
): Promise<string> {
	if (nonInteractive) {
		throw new CliError(
			`Missing required value. Re-run without --non-interactive to be prompted, or pass the corresponding flag. (${question})`,
			1,
		);
	}
	const answer =
		defaultValue !== undefined
			? await promptLineDefault(question, defaultValue)
			: await promptLine(question);
	if (answer === null || answer.trim().length === 0) {
		throw new CliError(`Aborted. (${question})`, 1);
	}
	return answer.trim();
}

async function resolveConnection(opts: ConnectorAddOptions): Promise<ParsedConnection> {
	const nonInteractive = !!opts.nonInteractive;

	const name = opts.name ?? (await askLine("Connector name", undefined, nonInteractive));
	if (!name) throw new CliError("--name is required.", 1);

	const rawType =
		opts.type ??
		(await askLine(
			"Database type (mysql | mariadb | postgresql | sqlite)",
			undefined,
			nonInteractive,
		));
	if (!rawType)
		throw new CliError("--type is required (mysql | mariadb | postgresql | sqlite).", 1);
	const type = rawType as ParsedConnection["type"];
	if (!ALLOWED_TYPES.includes(type)) {
		throw new CliError(
			`Invalid --type '${rawType}'. Use one of: ${ALLOWED_TYPES.join(", ")}`,
			1,
		);
	}

	if (type === "sqlite") {
		return resolveSqliteConnection(opts, nonInteractive);
	}
	return resolveNetworkConnection(opts, type, nonInteractive);
}

async function resolveSqliteConnection(
	opts: ConnectorAddOptions,
	nonInteractive: boolean,
): Promise<ParsedConnection> {
	const rawFile =
		opts.file ??
		opts.connectionUrl ??
		(await askLine("SQLite file path (absolute)", undefined, nonInteractive));
	if (!rawFile) {
		throw new CliError("--file is required for sqlite connectors.", 1);
	}
	const file = normalizeSqliteFile(rawFile);
	if (!existsSync(file)) {
		throw new CliError(`SQLite file not found: ${file}`, 1);
	}
	return mergeConnection({}, { type: "sqlite", database: file });
}

function normalizeSqliteFile(raw: string): string {
	let file = raw.trim();
	if (file.startsWith("sqlite:")) {
		file = file.replace(/^sqlite:\/\//, "");
		if (file.startsWith("localhost/")) file = file.slice("localhost".length);
		if (file.length === 0) {
			throw new CliError(
				"SQLite URL must include a file path (e.g. sqlite:///tmp/db.db).",
				1,
			);
		}
	}
	if (!isAbsolute(file)) {
		file = resolve(process.cwd(), file);
	}
	return file;
}

async function resolveNetworkConnection(
	opts: ConnectorAddOptions,
	type: Exclude<ParsedConnection["type"], "sqlite">,
	nonInteractive: boolean,
): Promise<ParsedConnection> {
	const useUrl =
		opts.connectionUrl !== undefined
			? opts.connectionUrl.length > 0
			: nonInteractive
				? false
				: (await askLine("Use a full connection URL? (y/N)", "N", nonInteractive))
						.trim()
						.toLowerCase()
						.startsWith("y");

	let conn: ParsedConnection;
	if (useUrl) {
		const url =
			opts.connectionUrl ?? (await askLine("Connection URL", undefined, nonInteractive));
		const fromUrl = parseConnectionUrl(url);
		conn = mergeConnection(fromUrl, { type, ssl: opts.ssl });
	} else {
		const user = opts.user ?? (await askLine("Database user", undefined, nonInteractive));
		if (!user) throw new CliError("--user is required.", 1);
		const database =
			opts.database ?? (await askLine("Database name", undefined, nonInteractive));
		if (!database) throw new CliError("--database is required.", 1);
		const host = opts.host ?? (await askLine("Database host", "127.0.0.1", nonInteractive));
		const portDefault = type === "postgresql" ? 5432 : 3306;
		const portRaw =
			opts.port ?? (await askLine("Database port", String(portDefault), nonInteractive));
		const port = Number.parseInt(String(portRaw), 10);
		if (Number.isNaN(port)) throw new CliError("Port must be a number.", 1);

		let password = opts.password ?? "";
		if (!password) {
			if (nonInteractive) {
				throw new CliError(
					"--password is required in non-interactive mode (or set $EASYSQL_DB_PASSWORD).",
					1,
				);
			}
			const secret = await promptSecret(`${t().prompts.passwordPrompt}: `);
			if (secret !== null) password = secret;
		}

		conn = {
			type,
			host,
			port,
			user,
			password,
			database,
			ssl: opts.ssl ?? false,
		};
	}

	if (!conn.password) {
		if (nonInteractive) {
			throw new CliError(
				"Database password is required (set $EASYSQL_DB_PASSWORD or use --password).",
				1,
			);
		}
		const secret = await promptSecret(`${t().prompts.passwordPrompt}: `);
		if (secret !== null) conn.password = secret;
	}

	return conn;
}

function persistConnector(opts: ConnectorAddOptions, conn: ParsedConnection): StoredConnectorView {
	const entry: StoredConnectorView = {
		name: opts.name ?? "",
		type: conn.type,
		host: conn.host,
		port: conn.port,
		user: conn.user,
		database: conn.database,
		ssl: conn.ssl,
		updated_at: new Date().toISOString(),
	};
	return entry;
}

interface StoredConnectorView {
	id?: string;
	name: string;
	type: ParsedConnection["type"];
	host: string;
	port: number;
	user: string;
	database: string;
	ssl: boolean;
	updated_at: string;
}

function registerAdd(program: Command): void {
	program
		.command("add")
		.description("Add a local MySQL/Postgres/SQLite connector (schema-only)")
		.option("--name <name>", "Connector name")
		.option("--type <type>", "mysql | mariadb | postgresql | sqlite")
		.option("--connection-url <url>", "Full connection URL")
		.option("--file <path>", "SQLite file path (when --type sqlite)")
		.option("--host <host>", "Database host")
		.option("--port <port>", "Database port", (v) => Number.parseInt(v, 10))
		.option("--user <user>", "Database user")
		.option("--password <pass>", "Database password (otherwise prompted)")
		.option("--database <db>", "Database name")
		.option("--ssl", "Require SSL/TLS")
		.option("-y, --non-interactive", "Disable prompts; fail when required values are missing")
		.action(async (opts: ConnectorAddOptions) => {
			let conn: ParsedConnection;
			try {
				conn = await resolveConnection(opts);
			} catch (err) {
				const msg = err instanceof Error ? err.message : String(err);
				printError(msg);
				throw err instanceof CliError ? err : new CliError(msg, 1);
			}

			printInfo(t().info.introspectingDb);
			const schema = await introspectDatabase(conn);

			const { client } = getSavedClient();
			const result = (await client.createConnector({
				name: opts.name,
				type: conn.type,
				schema,
			})) as { id?: string; name?: string };

			const entry = persistConnector(opts, conn);
			upsertConnector({
				...entry,
				id: result.id,
				name: result.name ?? opts.name ?? entry.name,
			});

			printSuccess(
				t().success.connectorAdded(result.name ?? opts.name ?? "", result.id ?? ""),
			);
		});
}

function registerSync(program: Command): void {
	program
		.command("sync [name]")
		.description("Re-introspect a local connector and push the updated schema")
		.option("--id <id>", "Sync a specific connector by id")
		.option("--password <pass>", "Database password (otherwise $EASYSQL_DB_PASSWORD or prompt)")
		.option("-y, --non-interactive", "Disable prompts; fail when the password is missing")
		.action(
			async (
				name: string | undefined,
				opts: { id?: string; password?: string; nonInteractive?: boolean },
			) => {
				let stored = opts.id
					? findConnectorById(opts.id)
					: name
						? findConnectorByName(name)
						: undefined;
				if (!stored && !opts.id && !name) {
					const list = loadConnectors();
					if (list.length === 1) stored = list[0];
				}
				if (!stored) {
					const list = loadConnectors();
					if (list.length === 0) {
						throw new CliError(
							"No local connectors to sync. Run `easysql connector add` first.",
							1,
						);
					}
					throw new CliError(
						`Specify a connector to sync: ${list.map((c) => c.name).join(", ")}`,
						1,
					);
				}

				let password = "";
				if (stored.type !== "sqlite") {
					password = opts.password ?? process.env.EASYSQL_DB_PASSWORD ?? "";
					if (!password) {
						if (opts.nonInteractive) {
							throw new CliError(
								"Database password required (--password or $EASYSQL_DB_PASSWORD).",
								1,
							);
						}
						const secret = await promptSecret(`${t().prompts.passwordPrompt}: `);
						if (!secret) throw new CliError("Database password required.", 1);
						password = secret;
					}
				}

				printInfo(t().info.introspectingDb);
				const result = await syncLocalConnector(stored, password);
				printSuccess(t().success.connectorSynced(stored.name, result.tables ?? 0));
			},
		);
}

function registerRemove(program: Command): void {
	program
		.command("remove <name>")
		.description("Remove a local connector (and delete it from EasySQL)")
		.option("-y, --yes", "Skip the confirmation prompt")
		.action(async (name: string, opts: { yes?: boolean }) => {
			const stored = findConnectorByName(name);
			if (!stored) throw new CliError(t().errors.connectorNotFound(name), 1);

			if (!opts.yes) {
				if (!isatty(0)) {
					throw new CliError(t().errors.removeNonInteractive, 1);
				}
				const answer = await promptLine(`${t().prompts.confirmRemove(name)} `);
				if (!answer || !answer.trim().toLowerCase().startsWith("y")) {
					printInfo(t().info.removeAborted);
					return;
				}
			}

			if (stored.id) {
				try {
					const { client } = getSavedClient();
					await client.deleteConnector(stored.id);
				} catch (err) {
					if (err instanceof ApiError && err.status === 404) {
						// Already gone server-side — proceed with the local cleanup.
					} else if (err instanceof NotLoggedInError) {
						printInfo(t().info.connectorRemovedLocalOnly);
					} else {
						throw err;
					}
				}
			}

			removeConnector(name);
			printSuccess(t().success.connectorRemoved(name));
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
					console.log(
						"(no connectors yet — run `easysql connector add` or `easysql demo`)",
					);
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
	registerRemove(group);
	registerList(group);
}
