/**
 * PostgreSQL schema introspection using the pg (node-postgres) driver.
 *
 * Strategy mirrors introspectMysql: list user tables (excluding pg_catalog /
 * information_schema), then fetch column metadata + primary/foreign keys
 * via a single JOIN'd query against information_schema.columns joined to
 * pg_class / pg_namespace for object IDs.
 *
 * Returns the JSON-shape accepted by POST /v1/connectors.
 */

import pg from "pg";
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
	is_nullable: boolean;
	column_default: string | null;
	is_primary: boolean;
	foreign_table: string | null;
	foreign_column: string | null;
}

interface TableRow {
	table_name: string;
	rows_approx: number | null;
}

function pgSsl(spec: ConnectionSpec): boolean | { rejectUnauthorized: boolean } {
	if (!spec.ssl) return false;
	return { rejectUnauthorized: false };
}

export async function introspectPostgres(spec: ConnectionSpec): Promise<ConnectorSchema> {
	const client = new pg.Client({
		host: spec.host,
		port: spec.port,
		user: spec.user,
		password: spec.password,
		database: spec.database,
		ssl: pgSsl(spec),
		connectionTimeoutMillis: 10_000,
	});
	await client.connect();

	try {
		const tablesRes = await client.query<TableRow>(
			`SELECT c.relname AS table_name,
			        c.reltuples::bigint AS rows_approx
			 FROM pg_class c
			 JOIN pg_namespace n ON n.oid = c.relnamespace
			 WHERE n.nspname = current_schema()
			   AND c.relkind = 'r'
			   AND NOT c.relispartition
			 ORDER BY c.relname`,
		);

		const result: ConnectorSchema = [];
		for (const row of tablesRes.rows) {
			const columnsRes = await client.query<ColumnRow>(
				`SELECT a.attname AS column_name,
				        format_type(a.atttypid, a.atttypmod) AS data_type,
				        NOT (a.attnotnull) AS is_nullable,
				        pg_get_expr(d.adbin, d.adrelid) AS column_default,
				        EXISTS (
				          SELECT 1 FROM pg_index i
				          WHERE i.indrelid = c.oid AND a.attnum = ANY(i.indkey) AND i.indisprimary
				        ) AS is_primary,
				        ref.relname AS foreign_table,
				        ref_att.attname AS foreign_column
				 FROM pg_attribute a
				 JOIN pg_class c ON c.oid = a.attrelid
				 JOIN pg_namespace n ON n.oid = c.relnamespace
				 LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
				 LEFT JOIN pg_constraint con ON con.conrelid = c.oid AND a.attnum = ANY(con.conkey) AND con.contype = 'f'
				 LEFT JOIN pg_class ref ON ref.oid = con.confrelid
				 LEFT JOIN pg_attribute ref_att ON ref_att.attrelid = ref.oid AND ref_att.attnum = con.confkey[1]
				 WHERE n.nspname = current_schema()
				   AND c.relname = $1
				   AND a.attnum > 0
				   AND NOT a.attisdropped
				 ORDER BY a.attnum`,
				[row.table_name],
			);

			const schema: TableSchema = {
				name: row.table_name,
				columns: columnsRes.rows.map((c) => ({
					name: c.column_name,
					type: c.data_type,
					nullable: c.is_nullable,
					primary_key: c.is_primary,
					default: c.column_default,
					foreign_key:
						c.foreign_table && c.foreign_column
							? { table: c.foreign_table, column: c.foreign_column }
							: null,
				})),
				rows_approx: row.rows_approx === null ? null : Number(row.rows_approx),
			};
			result.push(schema);
		}
		return result;
	} finally {
		await client.end();
	}
}
