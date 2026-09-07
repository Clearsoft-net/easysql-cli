/**
 * Executes a (validated) SELECT statement against the local MySQL or
 * PostgreSQL database. Returns rows as plain objects so the table renderer
 * can format them uniformly. No streaming — LIMIT<=100 keeps payloads small.
 */

import { createConnection } from "mysql2/promise";
import pg from "pg";
import { validateSelectOnly } from "../util/sql-validator.js";

export interface LocalQueryResult {
	columns: string[];
	rows: Record<string, unknown>[];
	row_count: number;
	duration_ms: number;
}

interface ConnSpec {
	type: "mysql" | "mariadb" | "postgresql";
	host: string;
	port: number;
	user: string;
	password: string;
	database: string;
	ssl?: boolean;
}

function pgSsl(spec: ConnSpec): boolean | { rejectUnauthorized: boolean } {
	if (!spec.ssl) return false;
	return { rejectUnauthorized: false };
}

export async function executeSelect(spec: ConnSpec, sql: string): Promise<LocalQueryResult> {
	const validation = validateSelectOnly(sql);
	if (!validation.ok) {
		throw new Error(`SQL safety check failed: ${validation.reason ?? "unknown"}`);
	}

	const started = Date.now();
	if (spec.type === "mysql" || spec.type === "mariadb") {
		return runMysql(spec, sql, started);
	}
	return runPostgres(spec, sql, started);
}

async function runMysql(spec: ConnSpec, sql: string, started: number): Promise<LocalQueryResult> {
	const auth = `${encodeURIComponent(spec.user)}:${encodeURIComponent(spec.password)}@`;
	const ssl = spec.ssl ? "?ssl=true" : "";
	const uri = `mysql://${auth}${spec.host}:${spec.port}/${spec.database}${ssl}`;
	const conn = await createConnection({ uri, connectTimeout: 10_000 });
	try {
		const [rows, fields] = await conn.query(sql);
		const arr = rows as Record<string, unknown>[];
		const columns = (fields ?? []).map((f) => f.name);
		return {
			columns,
			rows: arr.map((r) => {
				const out: Record<string, unknown> = {};
				for (const col of columns) out[col] = r[col];
				return out;
			}),
			row_count: arr.length,
			duration_ms: Date.now() - started,
		};
	} finally {
		await conn.end();
	}
}

async function runPostgres(
	spec: ConnSpec,
	sql: string,
	started: number,
): Promise<LocalQueryResult> {
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
		const res = await client.query(sql);
		const rows = res.rows as Record<string, unknown>[];
		const columns = (res.fields ?? []).map((f) => f.name);
		return {
			columns,
			rows: rows.map((r) => {
				const out: Record<string, unknown> = {};
				for (const col of columns) out[col] = r[col];
				return out;
			}),
			row_count: rows.length,
			duration_ms: Date.now() - started,
		};
	} finally {
		await client.end();
	}
}
