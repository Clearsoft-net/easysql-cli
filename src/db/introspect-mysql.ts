/**
 * MySQL/MariaDB schema introspection using mysql2's promise API.
 *
 * Strategy:
 *   1. List user tables from a single SELECT (excludes information_schema
 *      and performance_schema so we don't accidentally ship metadata).
 *   2. For each table, fetch column metadata + primary keys + foreign keys
 *      in one batched query against information_schema.
 *   3. Best-effort row-count estimate via information_schema.TABLES.
 *
 * Returns the JSON-shape accepted by POST /v1/connectors.
 */

import { createConnection } from "mysql2/promise";
import type { ConnectorSchema, TableSchema } from "./schema.js";

interface ConnectionSpec {
	host: string;
	port: number;
	user: string;
	password: string;
	database: string;
	ssl?: boolean;
}

interface ColumnRow {
	column_name: string;
	data_type: string;
	is_nullable: string;
	column_default: string | null;
	column_key: string;
	referenced_table_name: string | null;
	referenced_column_name: string | null;
}

interface TableRow {
	table_name: string;
	table_rows: number | null;
}

function buildMysqlDsn(spec: ConnectionSpec): string {
	const auth = `${encodeURIComponent(spec.user)}:${encodeURIComponent(spec.password)}@`;
	const db = `/${spec.database}`;
	const ssl = spec.ssl ? "?ssl=true" : "";
	return `mysql://${auth}${spec.host}:${spec.port}${db}${ssl}`;
}

export async function introspectMysql(spec: ConnectionSpec): Promise<ConnectorSchema> {
	const conn = await createConnection({
		uri: buildMysqlDsn(spec),
		multipleStatements: false,
		connectTimeout: 10_000,
	});

	try {
		const [tables] = await conn.query(
			`SELECT TABLE_NAME AS table_name, TABLE_ROWS AS table_rows
			 FROM information_schema.TABLES
			 WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
			 ORDER BY TABLE_NAME`,
			[spec.database],
		);
		const tableRows = tables as TableRow[];

		const result: ConnectorSchema = [];
		for (const table of tableRows) {
			const [columns] = await conn.query(
				`SELECT COLUMN_NAME AS column_name, DATA_TYPE AS data_type,
				        IS_NULLABLE AS is_nullable, COLUMN_DEFAULT AS column_default,
				        COLUMN_KEY AS column_key,
				        REFERENCED_TABLE_NAME AS referenced_table_name,
				        REFERENCED_COLUMN_NAME AS referenced_column_name
				 FROM information_schema.COLUMNS
				 WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
				 ORDER BY ORDINAL_POSITION`,
				[spec.database, table.table_name],
			);
			const columnRows = columns as ColumnRow[];

			const schema: TableSchema = {
				name: table.table_name,
				columns: columnRows.map((c) => ({
					name: c.column_name,
					type: c.data_type,
					nullable: c.is_nullable === "YES",
					primary_key: c.column_key === "PRI",
					default: c.column_default,
					foreign_key:
						c.referenced_table_name && c.referenced_column_name
							? { table: c.referenced_table_name, column: c.referenced_column_name }
							: null,
				})),
				rows_approx: table.table_rows,
			};
			result.push(schema);
		}
		return result;
	} finally {
		await conn.end();
	}
}
