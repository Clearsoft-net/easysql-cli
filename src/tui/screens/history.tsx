/**
 * History screen — paginated local read-only history of questions asked
 * via this CLI. Newest first. `j/k` or arrows navigate; no further
 * action (just inspection — the question screen has the input box).
 */

import { Box, Text, useInput } from "ink";
import { useMemo, useState } from "react";
import { readHistory } from "../../history/store.js";

const PAGE_SIZE = 10;

function truncate(s: string, n: number): string {
	return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

export function HistoryScreen() {
	const entries = useMemo(() => readHistory(50), []);
	const [page, setPage] = useState(0);
	const maxPage = Math.max(0, Math.ceil(entries.length / PAGE_SIZE) - 1);
	const pageEntries = entries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

	useInput((input, key) => {
		if (key.rightArrow || input === "l") setPage((p) => Math.min(maxPage, p + 1));
		else if (key.leftArrow || input === "h") setPage((p) => Math.max(0, p - 1));
	});

	if (entries.length === 0) {
		return (
			<Box paddingX={1} flexDirection="column">
				<Text color="yellow">(no history yet)</Text>
				<Text dimColor>Ask a question on the [3] Question screen.</Text>
			</Box>
		);
	}

	return (
		<Box paddingX={1} flexDirection="column">
			<Text bold>
				History — page {page + 1}/{maxPage + 1} ({entries.length} total)
			</Text>
			{pageEntries.map((e, i) => {
				const status =
					e.status === "ok"
						? `OK (${e.row_count ?? 0} rows)`
						: e.status === "generate-only"
							? "SQL only"
							: e.status;
				return (
					<Text key={`${e.at}-${i}`}>
						<Text dimColor>{truncate(e.at, 19)}</Text>{" "}
						<Text color="cyan">[{e.connector}]</Text>{" "}
						<Text color={e.status === "ok" ? "green" : "yellow"}>{status}</Text>{" "}
						{truncate(e.question, 60)}
					</Text>
				);
			})}
			<Text dimColor>←/→ or h/l to switch page</Text>
		</Box>
	);
}