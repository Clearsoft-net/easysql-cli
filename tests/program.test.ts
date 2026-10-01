import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { buildProgram } from "../src/cli/program.js";

describe("CLI program", () => {
	let originalArgv: string[];

	beforeEach(() => {
		originalArgv = process.argv;
	});

	afterEach(() => {
		process.argv = originalArgv;
	});

	it("prints the version", () => {
		const program = buildProgram();
		expect(program.version()).toMatch(/^\d+\.\d+\.\d+/);
	});

	it("builds a program with the expected subcommands", () => {
		const program = buildProgram();
		const names = program.commands.map((c) => c.name());
		for (const cmd of [
			"help",
			"login",
			"logout",
			"demo",
			"connection",
			"query",
			"usage",
			"history",
			"update",
		]) {
			expect(names, `missing command: ${cmd}`).toContain(cmd);
		}
	});

	it("exposes global flags in the help text", () => {
		const program = buildProgram();
		const help = program.helpInformation();
		expect(help).toMatch(/--api-url/);
		expect(help).toMatch(/--json/);
		expect(help).toMatch(/--no-color/);
	});
});
