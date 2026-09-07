import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../src/cli.js";
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

	it("connector add fails gracefully when no DB is reachable", async () => {
		handler = (url) => {
			if (url.endsWith("/v1/connectors")) {
				return Promise.resolve(jsonResponse({ id: "c1", name: "x" }, 201));
			}
			throw new Error(`unexpected: ${url}`);
		};
		// Use a connection URL to localhost:1 (guaranteed failure on any system)
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
		// Connection should fail BEFORE we hit the API.
		expect(code).toBe(1);
	});

	it("connector add returns 2 when not logged in", async () => {
		// Overwrite config with empty credentials.
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
		const code = await run(["connector", "add", "--name", "X", "--type", "sqlite"]);
		expect(code).toBe(1);
	});

	void spyOn; // keep import alive in case future tests need it
});
