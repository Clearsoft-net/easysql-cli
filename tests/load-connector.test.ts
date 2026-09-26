import { describe, expect, it } from "bun:test";
import { CliError } from "../src/cli/errors.js";
import {
	loadClickhouseModule,
	loadMysqlModule,
	loadPostgresModule,
	loadSqliteModule,
} from "../src/db/load-connector.js";

describe("load-connector", () => {
	it("loads the installed sqlite module", async () => {
		const mod = await loadSqliteModule();
		expect(typeof mod.SqliteConnector).toBe("function");
	});

	it("loads the installed mysql/postgres modules", async () => {
		const mysql = await loadMysqlModule();
		expect(typeof mysql.MysqlConnector).toBe("function");
		const pg = await loadPostgresModule();
		expect(typeof pg.PostgresConnector).toBe("function");
	});

	it("loads the installed clickhouse module", async () => {
		const ch = await loadClickhouseModule();
		expect(typeof ch.ClickhouseConnector).toBe("function");
	});

	it("CliError carries exit code 1 for the install hint path", () => {
		const err = new CliError("x", 1);
		expect(err.exitCode).toBe(1);
	});
});
