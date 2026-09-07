/**
 * `easysql history` — render the local read-only question log.
 *
 * Stored at \$XDG_DATA_HOME/easysql/history.jsonl (see ./store.ts). Entries
 * are appended by `easysql query` after every successful execution and
 * are NEVER sent to the API. The log is local-only, read-only by design.
 */

import type { Command } from "commander";
import { clearHistory, readHistory } from "../history/store.js";
import { isJsonMode, print, printInfo, printSuccess } from "../output/print.js";

export function registerHistory(program: Command): void {
	program
		.command("history")
		.description("Show the local read-only question log")
		.option("--limit <n>", "Show the last N entries", (v) => Number.parseInt(v, 10), 50)
		.option("--clear", "Clear the local history")
		.action((opts: { limit?: number; clear?: boolean }) => {
			if (opts.clear) {
				const removed = clearHistory();
				printSuccess(removed ? "History cleared." : "Nothing to clear.");
				return;
			}

			const entries = readHistory(opts.limit ?? 50);

			if (isJsonMode()) {
				print(entries);
				return;
			}

			if (entries.length === 0) {
				printInfo("(no history yet — run `easysql query` to populate)");
				return;
			}

			for (const e of entries) {
				const status =
					e.status === "ok"
						? `OK (${e.row_count ?? 0} rows, ${e.duration_ms ?? 0}ms)`
						: e.status === "generate-only"
							? "GENERATE-ONLY"
							: `ERROR: ${e.error ?? "unknown"}`;
				console.log(
					`${e.at}  [${e.connector}]  ${status}\n    Q: ${e.question}${
						e.sql ? `\n    SQL: ${e.sql.replace(/\s+/g, " ").slice(0, 120)}` : ""
					}`,
				);
			}
		});
}
