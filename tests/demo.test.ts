import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildDemoDatabase, DEMO_CONNECTOR_NAME } from "../src/db/demo.js";
import { executeSelect } from "../src/db/execute.js";
import { introspectSqlite } from "../src/db/introspect-sqlite.js";

describe("buildDemoDatabase", () => {
	let dir: string | undefined;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "easysql-demo-"));
	});

	afterEach(() => {
		if (dir) rmSync(dir, { recursive: true, force: true });
		dir = undefined;
	});

	it("creates a fresh SQLite file at the given path", () => {
		const file = join(dir as string, "demo.db");
		const result = buildDemoDatabase({ file });
		expect(result.file).toBe(file);
		expect(existsSync(file)).toBe(true);
		expect(result.tables.sort()).toEqual(["customers", "order_items", "orders", "products"]);
	});

	it("regenerates the file deterministically when re-run", () => {
		const file = join(dir as string, "demo.db");
		buildDemoDatabase({ file });
		buildDemoDatabase({ file });
		expect(existsSync(file)).toBe(true);
	});

	it("produces a schema that introspectSqlite can read", async () => {
		const file = join(dir as string, "demo.db");
		buildDemoDatabase({ file });
		const schema = await introspectSqlite({ file });
		expect(schema.length).toBe(4);

		const orders = schema.find((t) => t.name === "orders");
		const customerId = orders?.columns.find((c) => c.name === "customer_id");
		expect(customerId?.foreign_key).toEqual({ table: "customers", column: "id" });
	});

	it("supports the same SELECT queries the CLI exercises", async () => {
		const file = join(dir as string, "demo.db");
		buildDemoDatabase({ file });

		const result = await executeSelect(
			{ type: "sqlite", database: file },
			"SELECT COUNT(*) AS c FROM customers",
		);
		expect(result.row_count).toBe(1);
		expect(result.rows[0]?.c).toBe(5);
	});

	it("exports the canonical connector name", () => {
		expect(DEMO_CONNECTOR_NAME).toBe("local-demo");
	});
});
