/**
 * `easysql query "<question>"` — natural-language → SQL via the EasySQL
 * API, then execute the SQL against the LOCAL database.
 *
 * `--generate-only` skips local execution and just prints the SQL.
 */

import type { Command } from "commander";
import { ApiError, CliError } from "../cli/errors.js";
import {
	findConnectorByName,
	loadConnectors,
	upsertConnector,
} from "../config/connectors-store.js";
import { executeSelect } from "../db/execute.js";
import { appendHistory } from "../history/store.js";
import { t } from "../i18n/messages.js";
import { printError, printInfo, printSuccess } from "../output/print.js";
import { renderResult } from "../output/table.js";
import { getSavedClient } from "../sdk/client.js";
import { promptLine } from "../util/prompt.js";

interface QueryOptions {
	connector?: string;
	generateOnly?: boolean;
	rows?: number;
	format?: string;
}

async function pickConnector(picked: string | undefined): Promise<{ id: string; name: string }> {
	const list = loadConnectors();
	if (list.length === 0) {
		throw new CliError(
			"No local connectors registered. Run `easysql connector add ...` first.",
			1,
		);
	}
	if (picked) {
		const byName = findConnectorByName(picked);
		if (byName?.id) return { id: byName.id, name: byName.name };
		// Allow bare ID
		const byId = list.find((c) => c.id === picked);
		if (byId?.id) return { id: byId.id, name: byId.name };
		throw new CliError(
			`No local connector named '${picked}'. Run \`easysql connector list\`.`,
			1,
		);
	}
	if (list.length === 1 && list[0]?.id) {
		return { id: list[0].id, name: list[0].name };
	}
	// Interactive picker — list names and ask.
	const names = list.map((c) => `${c.name} (${c.type}@${c.host}/${c.database})`).join("\n  ");
	const answer = await promptLine(`Pick a connector:\n  ${names}\n> `);
	if (!answer) throw new CliError("Aborted.", 1);
	const found = findConnectorByName(answer.trim());
	if (!found?.id) throw new CliError(`No connector named '${answer}'.`, 1);
	return { id: found.id, name: found.name };
}

function getConnectorForExecution(name: string) {
	const c = findConnectorByName(name);
	if (!c) throw new CliError(`No local connector named '${name}'.`, 1);
	return c;
}

export function registerQuery(program: Command): void {
	program
		.command("query")
		.description("Generate SQL and run it against the local DB")
		.argument("<question...>", "Natural-language question")
		.option("--connector <id|name>", "Connector to use (otherwise prompted)")
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
			const connector = await pickConnector(opts.connector);

			printInfo(t().info.generatingSql);
			const createRes = (await client.createQuery({
				connector_id: connector.id,
				question,
				rows_limit: opts.rows,
			})) as {
				id?: string;
				sql?: string;
				sql_generated?: string | null;
				needs_local_execution?: boolean;
				status?: string;
			};

			const sql = createRes.sql_generated ?? createRes.sql ?? "";
			const queryId = createRes.id ?? "";

			if (opts.generateOnly) {
				console.log(sql);
				appendHistory({
					at: new Date().toISOString(),
					question,
					connector: connector.name,
					sql,
					status: "generate-only",
				});
				return;
			}

			// Persist to local history (handled in commit 6 via HistoryStore).
			// Local execution
			const local = getConnectorForExecution(connector.name);
			printInfo(t().info.executingSql);
			const result = await executeSelect(
				{
					type: local.type,
					host: local.host,
					port: local.port,
					user: local.user,
					// Re-prompt for the password since we never persist it.
					// SQLite connectors have no credentials — skip the prompt.
					password: local.type === "sqlite" ? "" : await readPasswordInteractive(),
					database: local.database,
					ssl: local.ssl,
				},
				sql,
			);

			// Tell the API the local result so it can generate answer+chart.
			if (queryId) {
				try {
					await client.answerQuery({ result_data: result.rows }, queryId);
				} catch (err) {
					if (!(err instanceof ApiError)) throw err;
					printError(`Could not upload result to API: ${err.message}`);
				}
			}

			// Update the local registry so the connector has an id mapping.
			upsertConnector({ ...local, id: connector.id, updated_at: new Date().toISOString() });

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
				connector: connector.name,
				sql,
				row_count: result.row_count,
				duration_ms: result.duration_ms,
				status: "ok",
			});
		});
}

async function readPasswordInteractive(): Promise<string> {
	const env = process.env.EASYSQL_DB_PASSWORD;
	if (env && env.length > 0) return env;
	// The password is required to actually execute the SQL — without a
	// stored password the CLI must ask every time. This is by design
	// (security): never persist database credentials to disk.
	const { promptSecret } = await import("../util/prompt.js");
	const secret = await promptSecret(`${t().prompts.passwordPrompt}: `);
	if (secret === null || secret.length === 0) {
		throw new CliError("Database password required to execute the query.", 1);
	}
	return secret;
}
