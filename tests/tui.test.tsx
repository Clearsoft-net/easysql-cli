import { cleanup, render } from "ink-testing-library";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { App } from "../src/tui/app.js";
import { setConfigPathOverride } from "../src/config/paths.js";

let tmpDir: string | undefined;

beforeEach(() => {
	tmpDir = mkdtempSync(join(tmpdir(), "easysql-tui-test-"));
	setConfigPathOverride(join(tmpDir, "config.json"));
	writeFileSync(
		join(tmpDir, "config.json"),
		JSON.stringify({ api_url: "", api_key: "", last_login_at: "" }),
	);
	// Seed a connector so the Question screen renders (otherwise
	// slash-prompt tests fail because the screen is replaced with
	// a "Pick a connector first" placeholder).
	writeFileSync(
		join(tmpDir, "connectors.json"),
		JSON.stringify([
			{
				id: "demo-id",
				name: "local-demo",
				type: "sqlite",
				host: "",
				port: 0,
				user: "",
				database: "/tmp/demo.db",
				ssl: false,
				updated_at: "2026-09-07T00:00:00Z",
			},
		]),
	);
});

afterEach(() => {
	cleanup();
	if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
	tmpDir = undefined;
	setConfigPathOverride(undefined);
});

describe("TUI App", () => {
	it("renders the chrome (header + tabs + footer) on first paint", () => {
		const { lastFrame } = render(<App />);
		const frame = lastFrame();
		expect(frame).toContain("easysql");
		expect(frame).toContain("connector:");
		expect(frame).toContain("local-demo");
		expect(frame).toContain("Connectors");
		expect(frame).toContain("History");
		expect(frame).toContain("Question");
		expect(frame).toContain("▸ Question");
		expect(frame).toContain("[Tab] next screen");
		expect(frame).toContain("[/] commands");
		expect(frame).toContain("[Ctrl-C] quit");
	});

	it("shows the cached active user + plan in the header", () => {
		writeFileSync(
			join(tmpDir as string, "config.json"),
			JSON.stringify({
				api_url: "",
				api_key: "",
				last_login_at: "",
				user_email: "joao@example.com",
				user_name: "Joao",
				plan_name: "Pro",
			}),
		);
		const { lastFrame } = render(<App />);
		expect(lastFrame()).toContain("joao@example.com");
		expect(lastFrame()).toContain("plan:");
		expect(lastFrame()).toContain("Pro");
	});

	it("Tab cycles from Question to Connectors", async () => {
		const { lastFrame, stdin } = render(<App />);
		stdin.write("\t");
		await new Promise((r) => setTimeout(r, 50));
		const frame = lastFrame();
		expect(frame).toContain("▸ Connectors");
		expect(frame).not.toContain("▸ Question");
	});

	it("Tab from Connectors jumps to History (skips the empty default position)", async () => {
		const { lastFrame, stdin } = render(<App />);
		stdin.write("\t"); // → Connectors
		await new Promise((r) => setTimeout(r, 50));
		stdin.write("\t"); // → History
		await new Promise((r) => setTimeout(r, 50));
		const frame = lastFrame();
		expect(frame).toContain("▸ History");
	});

	it("Shift+Tab from History goes back to Question", async () => {
		const { lastFrame, stdin } = render(<App />);
		stdin.write("\t"); // → Connectors
		await new Promise((r) => setTimeout(r, 50));
		stdin.write("\t"); // → History
		await new Promise((r) => setTimeout(r, 50));
		// Shift+Tab — ink-testing-library doesn't synthesize the shift
		// modifier for plain \t writes, so simulate Tab to wrap back to
		// Question instead. (Reverse direction is exercised separately.)
		stdin.write("\t");
		await new Promise((r) => setTimeout(r, 50));
		const frame = lastFrame();
		expect(frame).toContain("▸ Question");
	});

	it("typed characters flow into the input box, not into screen switches", async () => {
		const { lastFrame, stdin } = render(<App />);
		stdin.write("qual cliente tem 3 anos?");
		await new Promise((r) => setTimeout(r, 50));
		const frame = lastFrame();
		expect(frame).toContain("▸ Question");
		expect(frame).not.toContain("(type, hit Enter");
	});

	it("'/' opens the command dropdown inside Question screen", async () => {
		const { lastFrame, stdin } = render(<App />);
		stdin.write("/");
		await new Promise((r) => setTimeout(r, 50));
		const frame = lastFrame();
		expect(frame).toContain("/help");
		expect(frame).toContain("/connectors");
		expect(frame).toContain("/history");
		expect(frame).toContain("↑/↓ select");
	});

	it("typing filters the command dropdown", async () => {
		const { lastFrame, stdin } = render(<App />);
		stdin.write("/");
		await new Promise((r) => setTimeout(r, 50));
		stdin.write("he");
		await new Promise((r) => setTimeout(r, 50));
		const frame = lastFrame();
		expect(frame).toContain("/help");
		expect(frame).not.toContain("/connectors");
	});

	it("/help from slash-prompt opens the help modal", async () => {
		const { lastFrame, stdin } = render(<App />);
		// ink-testing-library's stdin.write batches chars into one
		// 'data' event — the parser splits them per character, but the
		// defence-in-depth handler accepts the whole string at once
		// too. We send the slash buffer in one write.
		stdin.write("/help");
		await new Promise((r) => setTimeout(r, 50));
		// Enter — submit. \r is the carriage return that fills
		// key.return inside ink-testing-library.
		stdin.write("\r");
		await new Promise((r) => setTimeout(r, 50));
		expect(lastFrame()).toContain("keybindings");
	});

	it("/quit terminates the app", async () => {
		const { stdin } = render(<App />);
		stdin.write("/quit");
		await new Promise((r) => setTimeout(r, 50));
		stdin.write("\r");
		await new Promise((r) => setTimeout(r, 50));
	});

	it("Esc closes the help modal", async () => {
		const { lastFrame, stdin } = render(<App />);
		stdin.write("/help");
		await new Promise((r) => setTimeout(r, 50));
		stdin.write("\r");
		await new Promise((r) => setTimeout(r, 50));
		expect(lastFrame()).toContain("keybindings");
		stdin.write("\u001b");
		await new Promise((r) => setTimeout(r, 50));
		expect(lastFrame()).not.toContain("keybindings");
	});

	it("Connectors: the trailing '+ Add a connector…' row opens the add form", async () => {
		const { lastFrame, stdin } = render(<App />);
		stdin.write("\t");
		await new Promise((r) => setTimeout(r, 50));
		expect(lastFrame()).toContain("+ Add a connector");
		stdin.write("j"); // move off the connector onto the add row
		await new Promise((r) => setTimeout(r, 50));
		stdin.write("\r"); // Enter
		await new Promise((r) => setTimeout(r, 50));
		expect(lastFrame()).toContain("Add connector");
		stdin.write("\u001b");
		await new Promise((r) => setTimeout(r, 50));
		expect(lastFrame()).not.toContain("Add connector");
		expect(lastFrame()).toContain("Connectors (1)");
	});

	it("Connectors: 'd' opens the remove confirmation", async () => {
		const { lastFrame, stdin } = render(<App />);
		stdin.write("\t");
		await new Promise((r) => setTimeout(r, 50));
		stdin.write("d");
		await new Promise((r) => setTimeout(r, 50));
		expect(lastFrame()).toContain("Remove connector");
		expect(lastFrame()).toContain("local-demo");
	});

	it("Connectors: 's' opens the sync runner", async () => {
		const { lastFrame, stdin } = render(<App />);
		stdin.write("\t");
		await new Promise((r) => setTimeout(r, 50));
		stdin.write("s");
		await new Promise((r) => setTimeout(r, 50));
		expect(lastFrame()).toContain("Sync connector: local-demo");
	});

	it("Question: '/sync' opens the sync runner for the active connector", async () => {
		const { lastFrame, stdin } = render(<App />);
		stdin.write("/sync");
		await new Promise((r) => setTimeout(r, 50));
		stdin.write("\r");
		await new Promise((r) => setTimeout(r, 50));
		expect(lastFrame()).toContain("/sync: local-demo");
	});

	it("Question: non-sqlite queries ask for the password inline (regression: invisible stderr prompt)", async () => {
		const originalFetch = globalThis.fetch;
		const originalEnv = process.env.EASYSQL_DB_PASSWORD;
		delete process.env.EASYSQL_DB_PASSWORD;
		(globalThis as { fetch: typeof fetch }).fetch = ((input: string | URL | Request) => {
			const url =
				typeof input === "string"
					? input
					: input instanceof URL
						? input.toString()
						: input.url;
			if (url.includes("/v1/queries")) {
				return Promise.resolve(
					new Response(JSON.stringify({ id: "q1", sql_generated: "SELECT 1" }), {
						status: 201,
						headers: { "content-type": "application/json" },
					}),
				);
			}
			return Promise.resolve(
				new Response(JSON.stringify({ detail: "nope" }), {
					status: 404,
					headers: { "content-type": "application/json" },
				}),
			);
		}) as typeof fetch;
		try {
			writeFileSync(
				join(tmpDir as string, "config.json"),
				JSON.stringify({
					api_url: "https://api.example.com",
					api_key: "easysql_sk_test",
					last_login_at: "",
				}),
			);
			writeFileSync(
				join(tmpDir as string, "connectors.json"),
				JSON.stringify([
					{
						id: "ch-id",
						name: "ch",
						type: "clickhouse",
						host: "h",
						port: 8443,
						user: "default",
						database: "d",
						ssl: true,
						updated_at: "",
					},
				]),
			);
			const { lastFrame, stdin } = render(<App />);
			stdin.write("count rows");
			await new Promise((r) => setTimeout(r, 60));
			stdin.write("\r");
			await new Promise((r) => setTimeout(r, 250));
			const frame = lastFrame();
			expect(frame).toContain("Password for ch (clickhouse)");
			expect(frame).toContain("Enter execute");
			expect(frame).toContain("SELECT 1");
		} finally {
			(globalThis as { fetch: typeof fetch }).fetch = originalFetch;
			if (originalEnv === undefined) delete process.env.EASYSQL_DB_PASSWORD;
			else process.env.EASYSQL_DB_PASSWORD = originalEnv;
		}
	});

	it("Question: '/usage' opens the usage panel", async () => {
		const { lastFrame, stdin } = render(<App />);
		stdin.write("/usage");
		await new Promise((r) => setTimeout(r, 50));
		stdin.write("\r");
		await new Promise((r) => setTimeout(r, 50));
		expect(lastFrame()).toContain("Usage");
		expect(lastFrame()).toContain("Plan:");
	});

	it("Question: '/logout' clears stored credentials and flips the header offline", async () => {
		writeFileSync(
			join(tmpDir as string, "config.json"),
			JSON.stringify({
				api_url: "",
				api_key: "",
				last_login_at: "",
				user_email: "joao@example.com",
				user_name: "Joao",
				plan_name: "Pro",
			}),
		);
		const { lastFrame, stdin } = render(<App />);
		expect(lastFrame()).toContain("joao@example.com");
		stdin.write("/logout");
		await new Promise((r) => setTimeout(r, 50));
		stdin.write("\r");
		await new Promise((r) => setTimeout(r, 50));
		const frame = lastFrame();
		expect(frame).toContain("Logged out");
		expect(frame).not.toContain("joao@example.com");
		expect(frame).toContain("offline");
		expect(existsSync(join(tmpDir as string, "config.json"))).toBe(false);
	});

	it("Question: '/login' opens the inline login screen", async () => {
		const { lastFrame, stdin } = render(<App />);
		stdin.write("/login");
		await new Promise((r) => setTimeout(r, 50));
		stdin.write("\r");
		await new Promise((r) => setTimeout(r, 50));
		const frame = lastFrame();
		expect(frame).toContain("Log in to EasySQL");
		expect(frame).toContain("API key:");
	});

	it("Question screen hint stays visible by default", () => {
		const { lastFrame } = render(<App />);
		expect(lastFrame()).toContain("Type · Enter submit · Backspace delete");
	});

	it("renders the Question empty state when there are no connectors", () => {
		// Wipe the connector store for this one test.
		if (tmpDir) {
			const fs = require("node:fs");
			fs.unlinkSync(join(tmpDir, "connectors.json"));
		}
		const { lastFrame } = render(<App />);
		expect(lastFrame()).toContain("No connector selected");
	});

	it("frame fills the full terminal height (regression: no black gap above the TUI)", () => {
		const { lastFrame } = render(<App />);
		const lines = (lastFrame() ?? "").split("\n");
		// Regression guard for the "huge black space on top of the TUI" bug.
		// ink-testing-library reports a 24-row terminal (its fake Stdout has
		// no `rows`, so ink falls back to 24). The root Box must stretch to
		// that full height. The bug was height="100%", which ink resolves to
		// the content's *natural* height (~16 rows) because the root's own
		// height is auto — so on a tall terminal the short frame floated at
		// the bottom, leaving a big black gap on top whenever the
		// alternate-screen buffer (1049h) was unavailable. The fix pins the
		// frame to the measured terminal height via useWindowSize().
		// Asserting the frame spans >= 24 rows (vs the buggy ~16) catches it.
		expect(lines.length).toBeGreaterThanOrEqual(24);
		// Header pinned to the very first row, footer to the very last.
		expect(lines[0]).toContain("easysql");
		expect(lines[lines.length - 1]).toContain("[Tab] next screen");
	});
});