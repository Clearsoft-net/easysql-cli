/**
 * Usage panel for the chat (`/usage`): plan + monthly query quota +
 * active connectors + most-used connectors, fetched from
 * GET /v1/dashboard/stats.
 */

import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import { loadConfig } from "../../config/store.js";
import { getSavedClient } from "../../sdk/client.js";

interface DashboardStats {
	active_connectors?: number;
	queries_used_this_month?: number;
	queries_limit?: number;
	most_used_connectors?: { connector_name?: string; query_count?: number }[];
}

export function UsageView({ onExit }: { onExit: () => void }) {
	const [stats, setStats] = useState<DashboardStats | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const { client } = getSavedClient();
				const result = (await client.dashboardStats()) as DashboardStats;
				if (!cancelled) setStats(result);
			} catch (e) {
				if (!cancelled) setError(e instanceof Error ? e.message : String(e));
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	useInput((input, key) => {
		if (key.escape || key.return || input === "q") onExit();
	});

	const plan = loadConfig().plan_name ?? "Free";
	const used = stats?.queries_used_this_month;
	const limit = stats?.queries_limit;

	return (
		<Box flexDirection="column" paddingX={1}>
			<Text bold color="cyan">
				Usage
			</Text>
			<Text>
				Plan:{" "}
				<Text color="magenta" bold>
					{plan}
				</Text>
			</Text>
			{!stats && !error && <Text dimColor>Loading…</Text>}
			{error && <Text color="red">Error: {error}</Text>}
			{stats && (
				<Box flexDirection="column">
					<Text>
						Queries this month: {typeof used === "number" ? used : "?"}
						{typeof limit === "number" ? ` / ${limit}` : ""}
					</Text>
					<Text>Active connectors:  {stats.active_connectors ?? "?"}</Text>
					{stats.most_used_connectors && stats.most_used_connectors.length > 0 && (
						<Box flexDirection="column" marginTop={1}>
							<Text dimColor>Most used connectors</Text>
							{stats.most_used_connectors.slice(0, 5).map((c, i) => (
								<Text key={`${c.connector_name ?? "?"}-${i}`}>
									{"  "}
									<Text color="cyan">{c.connector_name ?? "?"}</Text> {c.query_count ?? 0}
								</Text>
							))}
						</Box>
					)}
				</Box>
			)}
			<Text dimColor>Enter/Esc to return</Text>
		</Box>
	);
}
