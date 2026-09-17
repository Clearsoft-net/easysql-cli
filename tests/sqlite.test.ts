import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executeSelect } from "../src/db/execute.js";
import { introspectDatabase, mergeConnection } from "../src/db/introspect.js";
import { introspectSqlite } from "../src/db/introspect-sqlite.js";
import { parseConnectionUrl } from "../src/db/parse-url.js";

function tmpDbPath(): { dir: string; file: string } {
	const dir = mkdtempSync(join(tmpdir(), "easysql-sqlite-"));
	const file = join(dir, "test.db");
	return { dir, file };
}

function seedDatabase(file: string): void {
	const db = new Database(file);
	try {
		db.exec(`
			CREATE TABLE users (
				id INTEGER PRIMARY KEY,
				email TEXT NOT NULL UNIQUE,
				age INTEGER
			);
			CREATE TABLE posts (
				id INTEGER PRIMARY KEY,
				user_id INTEGER NOT NULL REFERENCES users(id),
				title TEXT NOT NULL,
				published INTEGER NOT NULL DEFAULT 0
			);
			INSERT INTO users (email, age) VALUES ('alice@example.com', 30), ('bob@example.com', 25);
			INSERT INTO posts (user_id, title, published) VALUES
				(1, 'Hello', 1),
				(1, 'World', 0),
				(2, 'Sqlite', 1);
		`);
	} finally {
		db.close();
	}
}

describe("introspectSqlite", () => {
	let cleanup: { dir: string } | undefined;
	afterEach(() => {
		if (cleanup) rmSync(cleanup.dir, { recursive: true, force: true });
		cleanup = undefined;
	});

	it("returns user tables, columns, types, primary keys and foreign keys", async () => {
		const { dir, file } = tmpDbPath();
		cleanup = { dir };
		seedDatabase(file);

		const schema = await introspectSqlite({ file });
		expect(schema.length).toBe(2);

		const users = schema.find((t) => t.name === "users");
		expect(users).toBeDefined();
		expect(users?.columns.length).toBe(3);
		const id = users?.columns.find((c) => c.name === "id");
		expect(id?.primary_key).toBe(true);
		expect(id?.type).toBe("integer");
		const email = users?.columns.find((c) => c.name === "email");
		expect(email?.nullable).toBe(false);
		expect(email?.type).toBe("text");
		const age = users?.columns.find((c) => c.name === "age");
		expect(age?.nullable).toBe(true);

		const posts = schema.find((t) => t.name === "posts");
		const userId = posts?.columns.find((c) => c.name === "user_id");
		expect(userId?.foreign_key).toEqual({ table: "users", column: "id" });

		expect(users?.rows_approx).toBe(2);
		expect(posts?.rows_approx).toBe(3);
	});

	it("skips sqlite_* internal tables", async () => {
		const { dir, file } = tmpDbPath();
		cleanup = { dir };
		const db = new Database(file);
		try {
			db.exec("CREATE TABLE t (x INTEGER PRIMARY KEY)");
		} finally {
			db.close();
		}
		const schema = await introspectSqlite({ file });
		expect(schema.map((t) => t.name)).toEqual(["t"]);
	});
});

describe("parseConnectionUrl (sqlite)", () => {
	it("parses sqlite:///absolute/path", () => {
		const c = parseConnectionUrl("sqlite:///tmp/app.db");
		expect(c.type).toBe("sqlite");
		expect(c.database).toBe("/tmp/app.db");
	});

	it("parses sqlite://localhost/path", () => {
		const c = parseConnectionUrl("sqlite://localhost/tmp/app.db");
		expect(c.type).toBe("sqlite");
		expect(c.database).toBe("/tmp/app.db");
	});
});

describe("introspectDatabase (sqlite dispatcher)", () => {
	it("dispatches to the sqlite introspector", async () => {
		const { dir, file } = tmpDbPath();
		try {
			const db = new Database(file);
			db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)");
			db.close();
			const schema = await introspectDatabase({
				type: "sqlite",
				host: "",
				port: 0,
				user: "",
				password: "",
				database: file,
				ssl: false,
			});
			expect(schema).toHaveLength(1);
			expect(schema[0]?.name).toBe("t");
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});

describe("mergeConnection (sqlite)", () => {
	it("builds a sqlite spec without user/password", () => {
		const merged = mergeConnection({}, { type: "sqlite", database: "/x.db" });
		expect(merged.type).toBe("sqlite");
		expect(merged.database).toBe("/x.db");
		expect(merged.user).toBe("");
		expect(merged.password).toBe("");
	});

	it("requires a file path for sqlite", () => {
		expect(() => mergeConnection({}, { type: "sqlite" })).toThrow(/file path/i);
	});
});

describe("executeSelect (sqlite)", () => {
	let dir: string | undefined;
	beforeEach(() => {
		const t = tmpDbPath();
		dir = t.dir;
		seedDatabase(t.file);
	});
	afterEach(() => {
		if (dir) rmSync(dir, { recursive: true, force: true });
		dir = undefined;
	});

	it("executes a SELECT against a sqlite file", async () => {
		const { file } = tmpDbPath();
		seedDatabase(file);
		// We rely on the second tmp (cleaner) — beforeEach already seeded one in `dir`,
		// but we want to control the path explicitly, so we reuse the temp dir.
		// Re-derive the file path the same way beforeEach did.
		const seededFile = join(dir as string, "test.db");
		const result = await executeSelect(
			{ type: "sqlite", database: seededFile },
			"SELECT email FROM users ORDER BY email",
		);
		expect(result.columns).toEqual(["email"]);
		expect(result.row_count).toBe(2);
		expect(result.rows[0]?.email).toBe("alice@example.com");
		expect(result.duration_ms).toBeGreaterThanOrEqual(0);
		void file;
	});

	it("rejects non-SELECT SQL before touching the file", async () => {
		const seededFile = join(dir as string, "test.db");
		expect(
			executeSelect({ type: "sqlite", database: seededFile }, "DELETE FROM users"),
		).rejects.toThrow(/safety check/i);
	});

	it("returns empty columns/rows when the result set is empty", async () => {
		const seededFile = join(dir as string, "test.db");
		const result = await executeSelect(
			{ type: "sqlite", database: seededFile },
			"SELECT * FROM users WHERE 1 = 0",
		);
		expect(result.row_count).toBe(0);
		expect(result.rows).toEqual([]);
	});
});
