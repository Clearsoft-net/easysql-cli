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
	it("renders the header and key bar on first paint", () => {
		const { lastFrame } = render(<App />);
		const frame = lastFrame();
		expect(frame).toContain("easysql");
		expect(frame).toContain("[1] Connectors");
		expect(frame).toContain("[2] History");
		expect(frame).toContain("[3] Question");
		expect(frame).toContain("[?] Help");
		expect(frame).toContain("[q] Quit");
	});

	it("switches to the History screen when 2 is pressed", async () => {
		const { lastFrame, stdin } = render(<App />);
		stdin.write("2");
		// Let React flush the state update
		await new Promise((r) => setTimeout(r, 50));
		const frame = lastFrame();
		expect(frame).toContain("History");
		expect(frame).toMatch(/History — page \d+\/\d+/);
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

	it("renders the Question empty state when there are no connectors", () => {
		const { lastFrame, stdin } = render(<App />);
		stdin.write("3");
		expect(lastFrame()).toContain("Pick a connector first");
	});
});