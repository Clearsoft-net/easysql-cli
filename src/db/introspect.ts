/**
 * Schema introspection dispatcher — picks the right @easysql/connector-*
 * for the connector type. Credentials are passed in-memory only; the
 * schema returned is the only thing that leaves this module.
 */

import type { Connector } from "@easysql/common";
import { generateSchema } from "@easysql/schema-generation";
import {
	loadClickhouseModule,
	loadMysqlModule,
	loadPostgresModule,
	loadSqliteModule,
} from "./load-connector.js";
import type { ParsedConnection } from "./parse-url.js";
import type { ConnectorSchema } from "./schema.js";

async function openConnector(conn: ParsedConnection): Promise<Connector> {
	switch (conn.type) {
		case "mysql":
		case "mariadb": {
			const { MysqlConnector } = await loadMysqlModule();
			return new MysqlConnector({
				host: conn.host,
				port: conn.port,
				user: conn.user,
				password: conn.password,
				database: conn.database,
				ssl: conn.ssl,
			});
		}
		case "postgresql": {
			const { PostgresConnector } = await loadPostgresModule();
			return new PostgresConnector({
				host: conn.host,
				port: conn.port,
				user: conn.user,
				password: conn.password,
				database: conn.database,
				ssl: conn.ssl,
			});
		}
		case "clickhouse": {
			const { ClickhouseConnector } = await loadClickhouseModule();
			return new ClickhouseConnector({
				host: conn.host,
				port: conn.port,
				user: conn.user,
				password: conn.password,
				database: conn.database,
				ssl: conn.ssl,
			});
		}
		case "sqlite": {
			const { SqliteConnector } = await loadSqliteModule();
			return new SqliteConnector({ file: conn.database });
		}
		default:
			throw new Error(`Unsupported database type: ${conn.type as string}`);
	}
}

export async function introspectDatabase(conn: ParsedConnection): Promise<ConnectorSchema> {
	const connector = await openConnector(conn);
	await connector.connect();
	try {
		return generateSchema(await connector.introspect());
	} finally {
		await connector.close();
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
