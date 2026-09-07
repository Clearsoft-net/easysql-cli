/**
 * SQLite schema introspection using Bun's built-in bun:sqlite module.
 *
 * Strategy:
 *   1. List user tables from sqlite_master (exclude sqlite_% internal tables).
 *   2. For each table, fetch column metadata + primary keys via PRAGMA
 *      table_info, then foreign keys via PRAGMA foreign_key_list.
 *   3. Best-effort row-count estimate via SELECT COUNT(*) (SQLite has no
 *      cheap statistics-based row estimate).
 *
 * Returns the JSON-shape accepted by POST /v1/connectors. No credentials
 * ever leave the host — the file path is metadata, but we still only
 * send the schema, never the path itself.
 */

import { Database } from "bun:sqlite";
import type { ConnectorSchema, TableSchema } from "./schema.js";

interface SqliteSpec {
	file: string;
}

interface ColumnRow {
	cid: number;
	name: string;
	type: string;
	notnull: number;
	dflt_value: string | null;
	pk: number;
}

interface ForeignKeyRow {
	id: number;
	seq: number;
	table: string;
	from: string;
	to: string;
}

export async function introspectSqlite(spec: SqliteSpec): Promise<ConnectorSchema> {
	const db = new Database(spec.file, { readonly: true });
	try {
		const tableRows = db
			.query<{ name: string }, []>(
				"SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
			)
			.all();

		const result: ConnectorSchema = [];
		for (const { name } of tableRows) {
			const cols = db.query<ColumnRow, []>(`PRAGMA table_info(${quoteIdent(name)})`).all();
			const fks = db
				.query<ForeignKeyRow, []>(`PRAGMA foreign_key_list(${quoteIdent(name)})`)
				.all();

			const fkByColumn = new Map<string, { table: string; column: string }>();
			for (const fk of fks) {
				fkByColumn.set(fk.from, { table: fk.table, column: fk.to });
			}

			const table: TableSchema = {
				name,
				columns: cols.map((c) => ({
					name: c.name,
					type: c.type || "BLOB",
					nullable: c.notnull === 0,
					primary_key: c.pk > 0,
					default: c.dflt_value,
					foreign_key: fkByColumn.get(c.name) ?? null,
				})),
				rows_approx: countRows(db, name),
			};
			result.push(table);
		}
		return result;
	} finally {
		db.close();
	}
}

function countRows(db: Database, table: string): number | null {
	try {
		const row = db
			.query<{ c: number }, []>(`SELECT COUNT(*) AS c FROM ${quoteIdent(table)}`)
			.get();
		return row?.c ?? null;
	} catch {
		return null;
	}
}

/**
 * Quote a SQLite identifier with double-quotes (SQL standard). Names
 * coming from sqlite_master are user-controlled in theory, so we defensively
 * double any embedded `"`.
 */
function quoteIdent(name: string): string {
	return `"${name.replace(/"/g, '""')}"`;
}
