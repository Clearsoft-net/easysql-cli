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
		// Header
		expect(frame).toContain("easysql");
		expect(frame).toContain("connector:");
		expect(frame).toContain("no connector selected");
		// Tab bar — all three tabs present, the active one prefixed with ▸
		expect(frame).toContain("[1] Connectors");
		expect(frame).toContain("[2] History");
		expect(frame).toContain("[3] Question");
		expect(frame).toContain("▸ [3] Question");
		// Footer — screen hint + global hints
		expect(frame).toContain("[1/2/3] switch");
		expect(frame).toContain("[?] help");
		expect(frame).toContain("[q] quit");
	});

	it("switches to the History screen when 2 is pressed", async () => {
		const { lastFrame, stdin } = render(<App />);
		stdin.write("2");
		await new Promise((r) => setTimeout(r, 50));
		const frame = lastFrame();
		expect(frame).toContain("▸ [2] History");
		expect(frame).toContain("History — page");
		expect(frame).toContain("←/→ or h/l switch page");
	});

	it("opens the help modal on ? and dismisses on ?", async () => {
		const { lastFrame, stdin } = render(<App />);
		stdin.write("?");
		await new Promise((r) => setTimeout(r, 50));
		expect(lastFrame()).toContain("keybindings");
		stdin.write("?");
		await new Promise((r) => setTimeout(r, 50));
		expect(lastFrame()).not.toContain("keybindings");
	});

	it("shows screen-specific hints for Connectors", async () => {
		const { lastFrame, stdin } = render(<App />);
		stdin.write("1");
		await new Promise((r) => setTimeout(r, 50));
		expect(lastFrame()).toContain("↑/↓ or j/k navigate");
	});

	it("shows screen-specific hints for Question", async () => {
		const { lastFrame, stdin } = render(<App />);
		// The Question screen is already the default, but the hint should
		// still reflect it
		expect(lastFrame()).toContain("Type · Enter submit · Backspace delete");
	});

	it("renders the Question empty state when there are no connectors", () => {
		const { lastFrame, stdin } = render(<App />);
		stdin.write("3");
		expect(lastFrame()).toContain("Pick a connector first");
	});
});