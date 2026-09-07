/**
 * Interactive TUI shell — bare `easysql` (no subcommand) opens a readline
 * REPL that loops on the question flow. Type 'exit' or 'quit' to leave.
 *
 * No community TUI framework is used (per the AC). Just readline + the
 * existing command infrastructure.
 */

import { createInterface, type Interface as RLInterface } from "node:readline";
import { isatty } from "node:tty";
import { CliError } from "../cli/errors.js";
import {
	findConnectorByName,
	loadConnectors,
	upsertConnector,
} from "../config/connectors-store.js";
import { executeSelect } from "../db/execute.js";
import { appendHistory } from "../history/store.js";
import { printError, printInfo, printSuccess } from "../output/print.js";
import { renderResult } from "../output/table.js";
import { getSavedClient } from "../sdk/client.js";
import { promptSecret } from "../util/prompt.js";

interface ReplOptions {
	connector?: string;
}

const HELP_TEXT = `
Interactive shell commands:
  /connectors          List registered connectors
  /use <name>          Pick the active connector for this session
  /history [n]         Show the last N entries (default 5)
  /help                Show this help
  exit | quit | Ctrl-D Leave the shell

Otherwise type a natural-language question and press Enter.
`.trim();

function prompt(rl: RLInterface): Promise<string> {
	return new Promise((resolve) => {
		rl.question("easysql> ", (answer) => resolve(answer));
	});
}

async function readPasswordInteractive(): Promise<string> {
	const env = process.env.EASYSQL_DB_PASSWORD;
	if (env && env.length > 0) return env;
	const secret = await promptSecret("Database password: ");
	if (secret === null || secret.length === 0) {
		throw new CliError("Database password required.", 1);
	}
	return secret;
}

async function runQuestion(question: string, connectorName: string): Promise<void> {
	const stored = findConnectorByName(connectorName);
	if (!stored?.id) {
		printError(`No local connector named '${connectorName}'.`);
		return;
	}
	const { client } = getSavedClient();
	const res = (await client.createQuery({
		connector_id: stored.id,
		question,
	})) as { id?: string; sql?: string; sql_generated?: string | null };
	const sql = res.sql_generated ?? res.sql ?? "";

	printInfo("Generated SQL:");
	console.log(sql);
	printInfo("Executing locally…");
	const result = await executeSelect(
		{
			type: stored.type,
			host: stored.host,
			port: stored.port,
			user: stored.user,
			password: stored.type === "sqlite" ? "" : await readPasswordInteractive(),
			database: stored.database,
			ssl: stored.ssl,
		},
		sql,
	);
	upsertConnector({ ...stored, updated_at: new Date().toISOString() });
	console.log(renderResult("table", result.columns, result.rows));
	printSuccess(`Returned ${result.row_count} row(s).`);

	appendHistory({
		at: new Date().toISOString(),
		question,
		connector: connectorName,
		sql,
		row_count: result.row_count,
		duration_ms: result.duration_ms,
		status: "ok",
	});
}

export async function startRepl(opts: ReplOptions): Promise<number> {
	if (!isatty(0)) {
		printError("Interactive shell requires a TTY. Use 'easysql query \"...\"' instead.");
		return 1;
	}

	const list = loadConnectors();
	if (list.length === 0) {
		console.log("No local connectors yet.");
		console.log("  • Run `easysql demo` to generate a sample SQLite database.");
		console.log("  • Or run `easysql connector add --type sqlite --file <path.db>`.");
		console.log(
			"  • Or run `easysql connector add --type mysql|postgresql` to connect a server.",
		);
		return 1;
	}

	let active =
		(opts.connector && findConnectorByName(opts.connector)?.name) ||
		(list.length === 1 ? list[0]?.name : undefined);

	if (!active) {
		const names = list
			.map((c) => `  - ${c.name} (${c.type}@${c.host}/${c.database})`)
			.join("\n");
		console.log(`Registered connectors:\n${names}`);
		const rl = createInterface({ input: process.stdin, output: process.stdout });
		const pick = await new Promise<string>((resolve) => {
			rl.question("Pick a connector (name): ", (a) => {
				rl.close();
				resolve(a.trim());
			});
		});
		active = findConnectorByName(pick)?.name;
		if (!active) {
			printError(`No connector named '${pick}'.`);
			return 1;
		}
	}

	const rl = createInterface({ input: process.stdin, output: process.stdout });
	rl.on("close", () => {
		process.stdout.write("\n");
	});

	console.log(`EasySQL interactive shell — using connector '${active}'`);
	console.log("Type /help for commands, or ask a question.");

	while (true) {
		let line: string;
		try {
			line = await prompt(rl);
		} catch {
			break; // EOF
		}
		const trimmed = line.trim();
		if (trimmed.length === 0) continue;
		if (trimmed === "exit" || trimmed === "quit") break;

		if (trimmed.startsWith("/")) {
			const [cmd, ...args] = trimmed.slice(1).split(/\s+/);
			switch (cmd) {
				case "help":
					console.log(HELP_TEXT);
					continue;
				case "connectors": {
					const current = loadConnectors();
					for (const c of current) {
						console.log(`  - ${c.name} (${c.type}@${c.host}/${c.database})`);
					}
					continue;
				}
				case "use": {
					const name = args.join(" ");
					if (!findConnectorByName(name)) {
						printError(`No connector named '${name}'.`);
						continue;
					}
					active = name;
					printSuccess(`Switched to '${name}'.`);
					continue;
				}
				case "history": {
					const { readHistory } = await import("../history/store.js");
					const limit = args[0] ? Number.parseInt(args[0], 10) : 5;
					const entries = readHistory(Number.isNaN(limit) ? 5 : limit);
					if (entries.length === 0) {
						console.log("(no history yet)");
						continue;
					}
					for (const e of entries) {
						console.log(
							`  ${e.at}  [${e.connector}]  ${e.status === "ok" ? `OK (${e.row_count ?? 0} rows)` : e.status}  ${e.question}`,
						);
					}
					continue;
				}
				default:
					printError(`Unknown command: /${cmd}. Type /help.`);
					continue;
			}
		}

		if (!active) continue;
		try {
			await runQuestion(trimmed, active);
		} catch (err) {
			if (err instanceof CliError) {
				printError(err.message);
			} else {
				printError(err instanceof Error ? err.message : String(err));
			}
		}
	}

	rl.close();
	return 0;
}
