/**
 * Ink-native table for query results. Rendering the table as real ink
 * elements (instead of a pre-formatted string with chalk ANSI codes)
 * guarantees the borders line up: ink measures each Text node's plain
 * content, so escape sequences can't shift the columns.
 */

import { Box, Text } from "ink";

function stringCell(v: unknown): string {
	if (v === null || v === undefined) return "NULL";
	if (typeof v === "object") return JSON.stringify(v);
	return String(v);
}

export function ResultTable({
	columns,
	rows,
}: {
	columns: string[];
	rows: Record<string, unknown>[];
}) {
	if (columns.length === 0) return <Text dimColor>(empty result set)</Text>;

	const widths = columns.map((c) => c.length);
	for (const row of rows) {
		columns.forEach((c, i) => {
			widths[i] = Math.max(widths[i] ?? 0, stringCell(row[c]).length);
		});
	}

	const rule = (left: string, mid: string, right: string) =>
		left +
		widths.map((w) => "─".repeat(w + 2)).join(mid) +
		right;

	const renderRow = (cells: string[]) =>
		`│ ${cells.map((c, i) => c.padEnd(widths[i] ?? 0)).join(" │ ")} │`;

	return (
		<Box flexDirection="column">
			<Text color="gray">{rule("┌", "┬", "┐")}</Text>
			<Text bold>{renderRow(columns)}</Text>
			<Text color="gray">{rule("├", "┼", "┤")}</Text>
			{rows.map((row, i) => (
				<Text key={i}>{renderRow(columns.map((c) => stringCell(row[c])))}</Text>
			))}
			<Text color="gray">{rule("└", "┴", "┘")}</Text>
		</Box>
	);
}
