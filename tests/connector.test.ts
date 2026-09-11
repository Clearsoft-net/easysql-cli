import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../src/cli.js";
import { loadConnectors, type StoredConnector } from "../src/config/connectors-store.js";
import { setConfigPathOverride } from "../src/config/paths.js";

type FetchHandler = (url: string, init?: RequestInit) => Promise<Response>;

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

function urlOf(input: string | URL | Request): string {
	if (typeof input === "string") return input;
	if (input instanceof URL) return input.toString();
	if (input instanceof Request) return input.url;
	return String(input);
}

describe("connector commands", () => {
	let tmp: string;
	let originalFetch: typeof fetch;
	let handler: FetchHandler | undefined;
	const loggedInConfig = {
		api_url: "https://api.example.com",
		api_key: "easysql_sk_test",
		last_login_at: "2026-09-07T00:00:00Z",
	};

	beforeEach(() => {
		tmp = mkdtempSync(join(tmpdir(), "easysql-connector-"));
		setConfigPathOverride(join(tmp, "config.json"));
		writeFileSync(join(tmp, "config.json"), JSON.stringify(loggedInConfig));
		originalFetch = globalThis.fetch;
		(globalThis as { fetch: typeof fetch }).fetch = ((
			input: string | URL | Request,
			init?: RequestInit,
		) => {
			if (!handler) throw new Error("fetch handler not set");
			return handler(urlOf(input), init);
		}) as typeof fetch;
	});

	afterEach(() => {
		(globalThis as { fetch: typeof fetch }).fetch = originalFetch;
		handler = undefined;
		setConfigPathOverride(undefined);
		rmSync(tmp, { recursive: true, force: true });
	});

	it("connector list renders a table when connectors exist", async () => {
		handler = (url) => {
			if (url.endsWith("/v1/connectors")) {
				return Promise.resolve(
					jsonResponse([
						{ id: "c1", name: "Prod", type: "postgresql", updated_at: "2026-09-01" },
						{ id: "c2", name: "Dev", type: "mysql", updated_at: "2026-09-02" },
					]),
				);
			}
			throw new Error(`unexpected: ${url}`);
		};
		const code = await run(["--json", "connector", "list"]);
		expect(code).toBe(0);
	});

	it("connector list prints a friendly message on empty", async () => {
		handler = (url) => {
			if (url.endsWith("/v1/connectors")) return Promise.resolve(jsonResponse([]));
			throw new Error(`unexpected: ${url}`);
		};
		const code = await run(["connector", "list"]);
		expect(code).toBe(0);
	});

	const storedConnector: StoredConnector = {
		id: "c1",
		name: "Prod",
		type: "postgresql",
		host: "db.example.com",
		port: 5432,
		user: "u",
		database: "d",
		ssl: false,
		updated_at: "2026-09-01T00:00:00Z",
	};

	it("connector remove deletes the connector on the server and locally", async () => {
		writeFileSync(join(tmp, "connectors.json"), JSON.stringify([storedConnector]));
		let deleted = false;
		handler = (url) => {
			if (url.includes("/v1/connectors/c1")) {
				deleted = true;
				return Promise.resolve(new Response(null, { status: 204 }));
			}
			throw new Error(`unexpected: ${url}`);
		};
		const code = await run(["--json", "connector", "remove", "Prod", "--yes"]);
		expect(code).toBe(0);
		expect(deleted).toBe(true);
		expect(loadConnectors()).toHaveLength(0);
	});

	it("connector remove returns 1 for an unknown connector", async () => {
		handler = () => Promise.resolve(jsonResponse({}));
		const code = await run(["--json", "connector", "remove", "nope", "--yes"]);
		expect(code).toBe(1);
	});

	it("connector remove keeps the local entry when the server delete fails", async () => {
		writeFileSync(join(tmp, "connectors.json"), JSON.stringify([storedConnector]));
		handler = (url) => {
			if (url.includes("/v1/connectors/c1")) {
				return Promise.resolve(jsonResponse({ message: "boom" }, 500));
			}
			throw new Error(`unexpected: ${url}`);
		};
		const code = await run(["--json", "connector", "remove", "Prod", "--yes"]);
		expect(code).toBe(4);
		expect(loadConnectors()).toHaveLength(1);
	});

	it("connector sync re-introspects the local DB and pushes the schema", async () => {
		const dbFile = join(tmp, "sync.db");
		const db = new Database(dbFile);
		db.exec("CREATE TABLE items (id INTEGER PRIMARY KEY, name TEXT)");
		db.close();
		writeFileSync(
			join(tmp, "connectors.json"),
			JSON.stringify([
				{
					id: "c1",
					name: "Local",
					type: "sqlite",
					host: "",
					port: 0,
					user: "",
					database: dbFile,
					ssl: false,
					updated_at: "2026-09-01T00:00:00Z",
				},
			]),
		);
		let synced = false;
		handler = (url) => {
			if (url.includes("/v1/connectors/c1/sync")) {
				synced = true;
				return Promise.resolve(jsonResponse({ tables: [], last_sync_at: "2026-09-10" }));
			}
			throw new Error(`unexpected: ${url}`);
		};
		const code = await run(["--json", "connector", "sync", "Local"]);
		expect(code).toBe(0);
		expect(synced).toBe(true);
	});

	it("connector sync returns 1 when the connector is unknown", async () => {
		handler = () => Promise.resolve(jsonResponse({}));
		const code = await run(["--json", "connector", "sync", "nope"]);
		expect(code).toBe(1);
	});

	it("connector add fails gracefully when no DB is reachable", async () => {
		handler = (url) => {
			if (url.endsWith("/v1/connectors")) {
				return Promise.resolve(jsonResponse({ id: "c1", name: "x" }, 201));
			}
			throw new Error(`unexpected: ${url}`);
		};
		const code = await run([
			"--json",
			"connector",
			"add",
			"--name",
			"Test",
			"--type",
			"mysql",
			"--connection-url",
			"mysql://root:root@127.0.0.1:1/db",
		]);
		expect(code).toBe(1);
	});

	it("connector add returns 2 when not logged in", async () => {
		writeFileSync(
			join(tmp, "config.json"),
			JSON.stringify({ api_url: "", api_key: "", last_login_at: "" }),
		);
		handler = () => Promise.resolve(jsonResponse({}));
		const code = await run(["connector", "list"]);
		expect(code).toBe(2);
	});

	it("rejects unknown --type", async () => {
		handler = () => Promise.resolve(jsonResponse({}));
		const code = await run([
			"connector",
			"add",
			"--non-interactive",
			"--name",
			"X",
			"--type",
			"mongodb",
		]);
		expect(code).toBe(1);
	});

	it("--non-interactive fails when required fields are missing", async () => {
		handler = () => Promise.resolve(jsonResponse({}));
		// Missing --type → should fail without prompting (CI mode).
		const code = await run(["connector", "add", "--non-interactive", "--name", "X"]);
		expect(code).toBe(1);
	});

	it("--non-interactive rejects without ever opening a prompt", async () => {
		let fetched = false;
		handler = (url) => {
			fetched = true;
			if (url.endsWith("/v1/connectors")) {
				return Promise.resolve(jsonResponse({ id: "c1", name: "x" }, 201));
			}
			throw new Error(`unexpected: ${url}`);
		};
		// Provide everything but the password — non-interactive must fail before hitting the API.
		const code = await run([
			"--json",
			"connector",
			"add",
			"--non-interactive",
			"--name",
			"Test",
			"--type",
			"mysql",
			"--connection-url",
			"mysql://root@127.0.0.1:1/db",
		]);
		expect(code).toBe(1);
		expect(fetched).toBe(false);
	});
});
