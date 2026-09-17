/**
 * Executes a (validated) SELECT statement against the local MySQL,
 * PostgreSQL or SQLite database via the @easysql/connector-* packages.
 * Returns rows as plain objects so the table renderer can format them
 * uniformly. No streaming — LIMIT<=100 keeps payloads small.
 */

import type { Connector } from "@easysql/common";
import { validateSelectOnly } from "../util/sql-validator.js";
import { loadMysqlModule, loadPostgresModule, loadSqliteModule } from "./load-connector.js";

export interface LocalQueryResult {
	columns: string[];
	rows: Record<string, unknown>[];
	row_count: number;
	duration_ms: number;
}

interface ConnSpec {
	type: "mysql" | "mariadb" | "postgresql" | "sqlite";
	host?: string;
	port?: number;
	user?: string;
	password?: string;
	database: string;
	ssl?: boolean;
}

async function openConnector(spec: ConnSpec): Promise<Connector> {
	switch (spec.type) {
		case "mysql":
		case "mariadb": {
			const { MysqlConnector } = await loadMysqlModule();
			return new MysqlConnector({
				host: spec.host ?? "127.0.0.1",
				port: spec.port ?? 3306,
				user: spec.user ?? "",
				password: spec.password ?? "",
				database: spec.database,
				ssl: spec.ssl,
			});
		}
		case "postgresql": {
			const { PostgresConnector } = await loadPostgresModule();
			return new PostgresConnector({
				host: spec.host ?? "127.0.0.1",
				port: spec.port ?? 5432,
				user: spec.user ?? "",
				password: spec.password ?? "",
				database: spec.database,
				ssl: spec.ssl,
			});
		}
		case "sqlite": {
			const { SqliteConnector } = await loadSqliteModule();
			return new SqliteConnector({ file: spec.database });
		}
		default:
			throw new Error(`Unsupported database type: ${spec.type as string}`);
	}
}

export async function executeSelect(spec: ConnSpec, sql: string): Promise<LocalQueryResult> {
	const validation = validateSelectOnly(sql);
	if (!validation.ok) {
		throw new Error(`SQL safety check failed: ${validation.reason ?? "unknown"}`);
	}

	const connector = await openConnector(spec);
	await connector.connect();
	try {
		const result = await connector.execute(sql);
		return {
			columns: result.columns,
			rows: result.rows,
			row_count: result.rowCount,
			duration_ms: result.durationMs,
		};
	} finally {
		await connector.close();
	}
}
