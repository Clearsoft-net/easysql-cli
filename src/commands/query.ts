/**
 * `easysql query "<question>"` — natural-language → SQL via the EasySQL
 * API, then execute the SQL against the LOCAL database.
 *
 * `--generate-only` skips local execution and just prints the SQL.
 */

import type { Command } from "commander";
import { CliError } from "../cli/errors.js";
import {
	findConnectionByName,
	loadConnections,
	type StoredConnection,
	upsertConnection,
} from "../config/connections-store.js";
import { executeSelect } from "../db/execute.js";
import { resolveDbPassword } from "../db/password.js";
import { appendHistory } from "../history/store.js";
import { t } from "../i18n/messages.js";
import { printError, printInfo, printSuccess } from "../output/print.js";
import { renderResult } from "../output/table.js";
import { getSavedClient, isConnectionNotFoundError } from "../sdk/client.js";
import { promptLine } from "../util/prompt.js";

interface QueryOptions {
	connection?: string;
	generateOnly?: boolean;
	rows?: number;
	format?: string;
}

async function pickConnection(picked: string | undefined): Promise<{ id: string; name: string }> {
	const list = loadConnections();
	if (list.length === 0) {
		throw new CliError(
			"No local connections registered. Run `easysql connection add ...` first.",
			1,
		);
	}
	if (picked) {
		const byName = findConnectionByName(picked);
		if (byName?.id) return { id: byName.id, name: byName.name };
		// Allow bare ID
		const byId = list.find((c) => c.id === picked);
		if (byId?.id) return { id: byId.id, name: byId.name };
		throw new CliError(
			`No local connection named '${picked}'. Run \`easysql connection list\`.`,
			1,
		);
	}
	if (list.length === 1 && list[0]?.id) {
		return { id: list[0].id, name: list[0].name };
	}
	// Interactive picker — list names and ask.
	const names = list.map((c) => `${c.name} (${c.type}@${c.host}/${c.database})`).join("\n  ");
	const answer = await promptLine(`Pick a connection:\n  ${names}\n> `);
	if (!answer) throw new CliError("Aborted.", 1);
	const found = findConnectionByName(answer.trim());
	if (!found?.id) throw new CliError(`No connection named '${answer}'.`, 1);
	return { id: found.id, name: found.name };
}

function getConnectionForExecution(name: string) {
	const c = findConnectionByName(name);
	if (!c) throw new CliError(`No local connection named '${name}'.`, 1);
	return c;
}

export function registerQuery(program: Command): void {
	program
		.command("query")
		.description("Generate SQL and run it against the local DB")
		.argument("<question...>", "Natural-language question")
		.option("--connection <id|name>", "Connection to use (otherwise prompted)")
		.option("--generate-only", "Print the SQL without executing")
		.option("--rows <n>", "Override LIMIT (1..100)", (v) => Number.parseInt(v, 10))
		.option("--format <fmt>", "table | json | csv", "table")
		.allowExcessArguments(true)
		.action(async (questionParts: string[], opts: QueryOptions) => {
			const question = questionParts.join(" ").trim();
			if (!question) {
				printError("Question is required.");
				throw new CliError("Missing question", 1);
			}

			const { client } = getSavedClient();
			const connection = await pickConnection(opts.connection);

			printInfo(t().info.generatingSql);
			let createRes: {
				id?: string;
				sql?: string;
				sql_generated?: string | null;
				needs_local_execution?: boolean;
				status?: string;
			};
			try {
				createRes = (await client.createQuery({
					connection_id: connection.id,
					question,
					rows_limit: opts.rows,
				})) as typeof createRes;
			} catch (err) {
				if (isConnectionNotFoundError(err)) {
					throw new CliError(t().errors.connectionNotFoundOnApi(connection.name), 1);
				}
				throw err;
			}

			const sql = createRes.sql_generated ?? createRes.sql ?? "";

			if (opts.generateOnly) {
				console.log(sql);
				appendHistory({
					at: new Date().toISOString(),
					question,
					connection: connection.name,
					sql,
					status: "generate-only",
				});
				return;
			}

			// Persist to local history (handled in commit 6 via HistoryStore).
			// Local execution
			const local = getConnectionForExecution(connection.name);
			printInfo(t().info.executingSql);
			const result = await executeSelect(
				{
					type: local.type,
					host: local.host,
					port: local.port,
					user: local.user,
					// Resolution chain: $EASYSQL_DB_PASSWORD > OS keyring > prompt.
					// SQLite connections have no credentials — skip the chain.
					password: local.type === "sqlite" ? "" : await readPassword(local),
					database: local.database,
					ssl: local.ssl,
				},
				sql,
			);

			// EZSQL-37: the API never receives result rows — rendering is fully
			// client-side, so there is no answer upload step anymore.

			// Update the local registry so the connection has an id mapping.
			upsertConnection({ ...local, id: connection.id, updated_at: new Date().toISOString() });

			console.log(
				renderResult(
					(opts.format as "table" | "json" | "csv") || "table",
					result.columns,
					result.rows,
				),
			);
			printSuccess(t().success.queryDone(result.row_count));

			appendHistory({
				at: new Date().toISOString(),
				question,
				connection: connection.name,
				sql,
				row_count: result.row_count,
				duration_ms: result.duration_ms,
				status: "ok",
			});
		});
}

async function readPassword(connection: StoredConnection): Promise<string> {
	const { password } = await resolveDbPassword(connection);
	if (password.length === 0) {
		throw new CliError("Database password required to execute the query.", 1);
	}
	return password;
}
