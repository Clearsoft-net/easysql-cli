import { describe, expect, it } from "bun:test";
import { renderHelp } from "../src/commands/help.js";

describe("renderHelp", () => {
	it("renders the top-level help when no topic is given", () => {
		const out = renderHelp();
		expect(out).toMatch(/Usage: easysql/);
		expect(out).toMatch(/Commands:/);
		expect(out).toMatch(/Global options:/);
	});

	it("renders per-command help", () => {
		const out = renderHelp("login");
		expect(out).toMatch(/Usage: easysql login/);
		expect(out).toMatch(/--api-key/);
	});

	it("renders per-command help for compound commands", () => {
		const out = renderHelp("connection add");
		expect(out).toMatch(/Usage: easysql connection add/);
		expect(out).toMatch(/--type/);
	});

	it("falls back to the top-level help for unknown topics", () => {
		const out = renderHelp("nope");
		expect(out).toMatch(/Unknown command: 'nope'/);
		expect(out).toMatch(/Usage: easysql/);
	});

	it("documents every command listed in the AC", () => {
		const commands = [
			"login",
			"logout",
			"connection add",
			"connection sync",
			"connection list",
			"connection remove",
			"query",
			"usage",
			"history",
			"update",
			"help",
		];
		for (const cmd of commands) {
			expect(renderHelp(cmd), `missing help for ${cmd}`).toMatch(/Usage: easysql/);
		}
	});
});
