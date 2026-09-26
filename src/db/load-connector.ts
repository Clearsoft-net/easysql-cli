/**
 * Lazy loader for the engine-specific @easysql/connector-* packages.
 * mysql/postgres/clickhouse are optionalDependencies — installed only when
 * used — so a missing package surfaces as an install hint instead of a bare
 * module-resolution error.
 */

import { CliError } from "../cli/errors.js";

type MysqlModule = typeof import("@easysql/connector-mysql");
type PostgresModule = typeof import("@easysql/connector-postgres");
type ClickhouseModule = typeof import("@easysql/connector-clickhouse");
type SqliteModule = typeof import("@easysql/connector-sqlite");

function isMissingModule(err: unknown): boolean {
	if (!err || typeof err !== "object") return false;
	const code = (err as { code?: unknown }).code;
	if (code === "ERR_MODULE_NOT_FOUND" || code === "MODULE_NOT_FOUND") return true;
	const msg = err instanceof Error ? err.message : String(err);
	return /cannot find (module|package)/i.test(msg);
}

function hint(engine: string, pkg: string): string {
	return (
		`${engine} support needs '${pkg}', which is not installed. ` +
		`Install it with: bun add ${pkg}`
	);
}

export async function loadMysqlModule(): Promise<MysqlModule> {
	try {
		return await import("@easysql/connector-mysql");
	} catch (err) {
		if (isMissingModule(err))
			throw new CliError(hint("MySQL/MariaDB", "@easysql/connector-mysql"), 1);
		throw err;
	}
}

export async function loadPostgresModule(): Promise<PostgresModule> {
	try {
		return await import("@easysql/connector-postgres");
	} catch (err) {
		if (isMissingModule(err))
			throw new CliError(hint("PostgreSQL", "@easysql/connector-postgres"), 1);
		throw err;
	}
}

export async function loadClickhouseModule(): Promise<ClickhouseModule> {
	try {
		return await import("@easysql/connector-clickhouse");
	} catch (err) {
		if (isMissingModule(err))
			throw new CliError(hint("ClickHouse", "@easysql/connector-clickhouse"), 1);
		throw err;
	}
}

export async function loadSqliteModule(): Promise<SqliteModule> {
	try {
		return await import("@easysql/connector-sqlite");
	} catch (err) {
		if (isMissingModule(err))
			throw new CliError(hint("SQLite", "@easysql/connector-sqlite"), 1);
		throw err;
	}
}
