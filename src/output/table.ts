/**
 * Tabular output renderer — three formats: table (default, ASCII box),
 * json, csv. Zero dependencies: ASCII alignment via column-width math.
 */

import chalk from "chalk";

export type OutputFormat = "table" | "json" | "csv";

export function renderResult(
	format: OutputFormat,
	columns: string[],
	rows: Record<string, unknown>[],
): string {
	switch (format) {
		case "json":
			return JSON.stringify(rows, null, 2);
		case "csv":
			return renderCsv(columns, rows);
		case "table":
		default:
			return renderTable(columns, rows);
	}
}

function escapeCsvCell(value: unknown): string {
	if (value === null || value === undefined) return "";
	const s = String(value);
	if (/[",\n\r]/.test(s)) {
		return `"${s.replace(/"/g, '""')}"`;
	}
	return s;
}

function renderCsv(columns: string[], rows: Record<string, unknown>[]): string {
	const header = columns.join(",");
	const body = rows.map((r) => columns.map((c) => escapeCsvCell(r[c])).join(",")).join("\n");
	return [header, body].filter(Boolean).join("\n");
}

function colorEnabled(): boolean {
	return chalk.level > 0;
}

function dim(s: string): string {
	return colorEnabled() ? chalk.dim(s) : s;
}

function bold(s: string): string {
	return colorEnabled() ? chalk.bold(s) : s;
}

function stringCell(v: unknown): string {
	if (v === null || v === undefined) return "NULL";
	if (typeof v === "object") return JSON.stringify(v);
	return String(v);
}

function renderTable(columns: string[], rows: Record<string, unknown>[]): string {
	if (columns.length === 0) return "(empty result set)";

	const widths = columns.map((c) => c.length);
	for (const row of rows) {
		columns.forEach((c, i) => {
			const len = stringCell(row[c]).length;
			const current = widths[i] ?? 0;
			if (len > current) widths[i] = len;
		});
	}

	const fmtRow = (cells: string[]) => {
		const padded = cells.map((c, i) => c.padEnd(widths[i] ?? 0, " "));
		return `│ ${padded.join(" │ ")} │`;
	};

	const sep = `├─${widths.map((w) => "─".repeat(w)).join("─┼─")}─┤`;
	const top = `┌─${widths.map((w) => "─".repeat(w)).join("─┬─")}─┐`;
	const bottom = `└─${widths.map((w) => "─".repeat(w)).join("─┴─")}─┘`;

	const headerLine = fmtRow(columns.map(bold));
	const bodyLines = rows.map((r) => fmtRow(columns.map((c) => stringCell(r[c]))));

	const count = `${rows.length} row${rows.length === 1 ? "" : "s"}`;
	return [top, headerLine, sep, ...bodyLines, bottom, dim(count)].join("\n");
}
