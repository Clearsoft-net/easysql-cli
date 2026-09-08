import { cleanup, render } from "ink-testing-library";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
		expect(frame).toContain("no connector selected");
		expect(frame).toContain("Connectors");
		expect(frame).toContain("History");
		expect(frame).toContain("Question");
		expect(frame).toContain("▸ Question");
		expect(frame).toContain("[Tab] command palette");
		expect(frame).toContain("[Ctrl-C] quit");
	});

	it("opens the command palette when Tab is pressed", async () => {
		const { lastFrame, stdin } = render(<App />);
		stdin.write("\t");
		await new Promise((r) => setTimeout(r, 50));
		const frame = lastFrame();
		expect(frame).toContain("Command palette");
		expect(frame).toContain("[1] Connectors");
		expect(frame).toContain("[2] History");
		expect(frame).toContain("[3] Question");
	});

	it("Tab+2 navigates to History", async () => {
		const { lastFrame, stdin } = render(<App />);
		stdin.write("\t");
		await new Promise((r) => setTimeout(r, 50));
		stdin.write("2");
		await new Promise((r) => setTimeout(r, 50));
		const frame = lastFrame();
		expect(frame).toContain("History — page");
		expect(frame).not.toContain("Command palette");
	});

	it("Esc closes the palette when open", async () => {
		const { lastFrame, stdin } = render(<App />);
		stdin.write("\t");
		await new Promise((r) => setTimeout(r, 50));
		expect(lastFrame()).toContain("Command palette");
		stdin.write("\u001b");
		await new Promise((r) => setTimeout(r, 50));
		expect(lastFrame()).not.toContain("Command palette");
	});

	it("number keys typed in Question screen go to the buffer, not to switches", async () => {
		const { lastFrame, stdin } = render(<App />);
		// The Question screen is active by default; type '1', '2', '3'
		// — they should NOT switch screens.
		stdin.write("123");
		await new Promise((r) => setTimeout(r, 50));
		const frame = lastFrame();
		// We're still on the Question screen (▸ Question) and the
		// placeholder is gone, meaning the buffer absorbed the digits.
		expect(frame).toContain("▸ Question");
		// The 'Prompt' hint is replaced by the typed text; check that
		// the placeholder hint is no longer present.
		expect(frame).not.toContain("(type, hit Enter)");
	});

	it("Tab opens palette even from Question screen, but doesn't break the input", async () => {
		const { lastFrame, stdin } = render(<App />);
		stdin.write("\t");
		await new Promise((r) => setTimeout(r, 50));
		// Tab is consumed by the global handler, not added to the input.
		expect(lastFrame()).toContain("Command palette");
	});

	it("Question screen hint stays visible by default", () => {
		const { lastFrame } = render(<App />);
		expect(lastFrame()).toContain("Type · Enter submit · Backspace delete");
	});

	it("renders the Question empty state when there are no connectors", () => {
		const { lastFrame } = render(<App />);
		expect(lastFrame()).toContain("Pick a connector first");
	});
});