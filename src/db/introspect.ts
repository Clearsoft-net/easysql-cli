/**
 * Schema introspection dispatcher — picks the right driver for the
 * connector type. Credentials are passed in-memory only; the schema
 * returned is the only thing that leaves this module.
 */

import { introspectMysql } from "./introspect-mysql.js";
import { introspectPostgres } from "./introspect-postgres.js";
import { introspectSqlite } from "./introspect-sqlite.js";
import type { ParsedConnection } from "./parse-url.js";
import type { ConnectorSchema } from "./schema.js";

export async function introspectDatabase(conn: ParsedConnection): Promise<ConnectorSchema> {
	switch (conn.type) {
		case "mysql":
		case "mariadb":
			return introspectMysql(conn);
		case "postgresql":
			return introspectPostgres(conn);
		case "sqlite":
			return introspectSqlite({ file: conn.database });
		default:
			throw new Error(`Unsupported database type: ${conn.type as string}`);
	}
}

export { mergeConnection, type ParsedConnection, parseConnectionUrl } from "./parse-url.js";
export type {
	ColumnSchema,
	ConnectorSchema,
	ConnectorSummary,
	DatabaseType,
	TableSchema,
} from "./schema.js";
