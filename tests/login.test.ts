import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProgram } from "../src/cli/program.js";
import { run } from "../src/cli.js";
import { setConfigPathOverride } from "../src/config/paths.js";
import { loadConfig } from "../src/config/store.js";

type FetchHandler = (url: string) => Promise<Response>;

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

describe("login / logout commands", () => {
	// these tests touch the singleton config store; run serially.
	// (bun:test doesn't auto-isolate module-level state between cases.)
	let tmp: string;
	let originalFetch: typeof fetch;
	let handler: FetchHandler | undefined;

	beforeEach(() => {
		tmp = mkdtempSync(join(tmpdir(), "easysql-login-"));
		setConfigPathOverride(join(tmp, "config.json"));
		originalFetch = globalThis.fetch;
		(globalThis as { fetch: typeof fetch }).fetch = ((input: string | URL | Request) => {
			if (!handler) throw new Error("fetch handler not set");
			return handler(urlOf(input));
		}) as typeof fetch;
	});

	afterEach(() => {
		(globalThis as { fetch: typeof fetch }).fetch = originalFetch;
		handler = undefined;
		setConfigPathOverride(undefined);
		rmSync(tmp, { recursive: true, force: true });
	});

	it("login --api-key stores the key after a successful /v1/auth/me", async () => {
		handler = (url) => {
			if (url.endsWith("/v1/auth/me")) {
				return Promise.resolve(jsonResponse({ id: "u1", email: "a@b.c" }));
			}
			throw new Error(`unexpected fetch: ${url}`);
		};

		const argv = [
			"--api-url",
			"https://api.example.com",
			"login",
			"--api-key",
			"easysql_sk_abc",
		];
		const code = await run(argv);
		expect(code).toBe(0);

		const cfg = loadConfig();
		expect(cfg.api_key).toBe("easysql_sk_abc");
		expect(cfg.api_url).toBe("https://api.example.com");
		expect(cfg.last_login_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
	});

	it("login returns 4 when the API rejects the key with 401", async () => {
		handler = (url) => {
			if (url.endsWith("/v1/auth/me")) {
				return Promise.resolve(jsonResponse({ message: "unauthorized" }, 401));
			}
			throw new Error(`unexpected fetch: ${url}`);
		};

		const code = await run([
			"--api-url",
			"https://api.example.com",
			"login",
			"--api-key",
			"easysql_sk_bad",
		]);
		expect(code).toBe(4);

		const cfg = loadConfig();
		expect(cfg.api_key).toBe("");
	});

	it("--non-interactive fails when --api-key is missing", async () => {
		delete process.env.EASYSQL_API_KEY;
		handler = () => Promise.resolve(jsonResponse({}));
		const code = await run([
			"--api-url",
			"https://api.example.com",
			"login",
			"--non-interactive",
		]);
		expect(code).toBe(4);
		expect(loadConfig().api_key).toBe("");
	});

	it("logout removes the stored key", async () => {
		handler = (url) => {
			if (url.endsWith("/v1/auth/me")) {
				return Promise.resolve(jsonResponse({ id: "u1", email: "a@b.c" }));
			}
			throw new Error(`unexpected fetch: ${url}`);
		};

		const code1 = await run([
			"--api-url",
			"https://api.example.com",
			"login",
			"--api-key",
			"easysql_sk_abc",
		]);
		expect(code1).toBe(0);
		expect(loadConfig().api_key).toBe("easysql_sk_abc");

		const code2 = await run(["logout"]);
		expect(code2).toBe(0);
		expect(loadConfig().api_key).toBe("");
	});
});
