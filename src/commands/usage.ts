/**
 * `easysql usage` — show plan consumption fetched from the EasySQL API.
 *
 * Calls GET /v1/dashboard/stats and prints a friendly summary. Falls back
 * to printing the raw JSON if the payload doesn't match the expected shape.
 */

import type { Command } from "commander";
import { loadConfig } from "../config/store.js";
import { isJsonMode, print } from "../output/print.js";
import { getSavedClient } from "../sdk/client.js";

interface DashboardStats {
	active_connectors?: number;
	queries_used_this_month?: number;
	queries_limit?: number;
	queries_per_day?: { date?: string; count?: number }[];
	most_used_connectors?: { connector_name?: string; query_count?: number }[];
	fetched_at?: string;
}

export function registerUsage(program: Command): void {
	program
		.command("usage")
		.description("Show plan consumption (quota used vs remaining)")
		.action(async () => {
			const { client } = getSavedClient();
			const result = (await client.dashboardStats()) as DashboardStats | unknown;

			if (isJsonMode() || typeof result !== "object" || result === null) {
				print(result);
				return;
			}

			const s = result as DashboardStats;
			console.log(`Plan:               ${loadConfig().plan_name ?? "Free"}`);
			if (typeof s.queries_used_this_month === "number") {
				const limit = typeof s.queries_limit === "number" ? ` / ${s.queries_limit}` : "";
				console.log(`Queries this month: ${s.queries_used_this_month}${limit}`);
			}
			if (typeof s.active_connectors === "number") {
				console.log(`Active connectors:  ${s.active_connectors}`);
			}
			if (s.most_used_connectors && s.most_used_connectors.length > 0) {
				console.log("Most used connectors:");
				for (const c of s.most_used_connectors) {
					console.log(`  ${c.connector_name ?? "?"}  ${c.query_count ?? 0}`);
				}
			}
		});
}
