/**
 * `easysql demo` — generate a local sample SQLite database and register
 * it as a connector named `local-demo`. The generated file lives in the
 * user's data directory and is fully deterministic: re-running the
 * command removes and recreates it.
 *
 * This is a low-friction on-ramp for users who don't yet have a database
 * to point the CLI at — they can run `easysql demo && easysql query "..."
 * --connector local-demo` and see the end-to-end flow without setting up
 * MySQL or PostgreSQL.
 */

import { join } from "node:path";
import type { Command } from "commander";
import { CliError } from "../cli/errors.js";
import { upsertConnector } from "../config/connectors-store.js";
import { getDataDir } from "../config/paths.js";
import { buildDemoDatabase, DEMO_CONNECTOR_NAME } from "../db/demo.js";
import { introspectDatabase } from "../db/introspect.js";
import { printError, printInfo, printSuccess } from "../output/print.js";
import { getSavedClient } from "../sdk/client.js";

interface DemoOptions {
	file?: string;
	name?: string;
	register?: boolean;
	force?: boolean;
}

export function registerDemo(program: Command): void {
	program
		.command("demo")
		.description("Generate a local sample SQLite database and register it as `local-demo`")
		.option("--file <path>", "Override the path of the generated SQLite file")
		.option("--name <name>", "Override the connector name (default: local-demo)")
		.option("--no-register", "Generate the file only, skip the API/connectors-store step")
		.option("--force", "Overwrite the existing local-demo file (default: true)")
		.action(async (opts: DemoOptions) => {
			const file = opts.file ?? join(getDataDir(), "demo.db");
			const name = opts.name ?? DEMO_CONNECTOR_NAME;

			printInfo("Generating local demo database…");
			const built = buildDemoDatabase({ file });

			if (opts.register === false) {
				printSuccess(
					`Demo database written to ${built.file} (tables: ${built.tables.join(", ")}).`,
				);
				return;
			}

			printInfo("Introspecting schema…");
			const schema = await introspectDatabase({
				type: "sqlite",
				host: "",
				port: 0,
				user: "",
				password: "",
				database: built.file,
				ssl: false,
			});

			let apiId: string | undefined;
			try {
				const { client } = getSavedClient();
				const result = (await client.createConnector({
					name,
					type: "sqlite",
					schema,
				})) as { id?: string; name?: string };
				apiId = result.id;
			} catch (err) {
				if (err instanceof CliError) throw err;
				// Without login we still register locally so the user can run queries
				// once they authenticate. Print a soft warning but don't fail.
				printError(
					`Could not register with EasySQL API (continuing locally): ${
						err instanceof Error ? err.message : String(err)
					}`,
				);
			}

			upsertConnector({
				id: apiId,
				name,
				type: "sqlite",
				host: "",
				port: 0,
				user: "",
				database: built.file,
				ssl: false,
				updated_at: new Date().toISOString(),
			});

			printSuccess(
				`Demo ready. Connector '${name}' → ${built.file}\n` +
					`  Tables: ${built.tables.join(", ")}\n` +
					`  Try: easysql query "Top 3 customers by revenue" --connector ${name}`,
			);
		});
}
