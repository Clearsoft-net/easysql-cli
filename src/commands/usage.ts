/**
 * `easysql usage` — show plan consumption fetched from the EasySQL API.
 *
 * Calls GET /v1/dashboard/stats (which includes quota_used / quota_remaining
 * for the current plan tier) and prints a friendly summary. Falls back to
 * printing the raw JSON if the payload doesn't match the expected shape.
 */

import type { Command } from "commander";
import { isJsonMode, print } from "../output/print.js";
import { getSavedClient } from "../sdk/client.js";

interface UsageShape {
	plan?: { name?: string; tier?: string };
	queries_used?: { day?: number; week?: number; month?: number };
	queries_remaining?: { day?: number; week?: number; month?: number };
	connectors_used?: number;
	connectors_limit?: number;
}

export function registerUsage(program: Command): void {
	program
		.command("usage")
		.description("Show plan consumption (quota used vs remaining)")
		.action(async () => {
			const { client } = getSavedClient();
			const result = (await client.dashboardStats()) as UsageShape | unknown;

			if (!isJsonMode() && typeof result === "object" && result !== null) {
				const r = result as UsageShape;
				const planName = r.plan?.name ?? r.plan?.tier ?? "—";
				console.log(`Plan:            ${planName}`);
				if (typeof r.queries_used?.day === "number") {
					console.log(
						`Queries today:   ${r.queries_used.day} / ${
							typeof r.queries_remaining?.day === "number"
								? r.queries_used.day + r.queries_remaining.day
								: "?"
						}`,
					);
				}
				if (typeof r.queries_used?.week === "number") {
					console.log(`Queries this week:  ${r.queries_used.week}`);
				}
				if (typeof r.queries_used?.month === "number") {
					console.log(`Queries this month: ${r.queries_used.month}`);
				}
				if (typeof r.connectors_used === "number") {
					console.log(
						`Connectors:      ${r.connectors_used} / ${r.connectors_limit ?? "?"}`,
					);
				}
				return;
			}

			print(result);
		});
}
