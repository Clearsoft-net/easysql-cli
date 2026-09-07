import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildProgram } from "../src/cli/program.js";

type Output = { stdout: string; stderr: string; exitCode: number };

function captureProgramOutput(fn: () => void): Output {
	const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
	const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
	const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
	const exit = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
		throw new Error(`__exit__:${code ?? 0}`);
	}) as never);

	let exitCode = 0;
	try {
		fn();
	} catch (err) {
		if (err instanceof Error && err.message.startsWith("__exit__")) {
			exitCode = Number(err.message.split(":")[1] ?? "0");
		} else if (err && typeof err === "object" && "code" in err) {
			// Commander throws CommanderError for --version / --help.
			const code = (err as { code: string }).code;
			if (
				code === "commander.versionDisplayed" ||
				code === "commander.helpDisplayed" ||
				code === "commander.version" ||
				code === "commander.help"
			) {
				exitCode = 0;
			} else {
				throw err;
			}
		} else {
			throw err;
		}
	}

	const out: Output = {
		stdout:
			stdout.mock.calls.map((c) => String(c[0])).join("") +
			logSpy.mock.calls.map((c) => String(c[0])).join("\n"),
		stderr: stderr.mock.calls.map((c) => String(c[0])).join(""),
		exitCode,
	};

	stdout.mockRestore();
	stderr.mockRestore();
	logSpy.mockRestore();
	exit.mockRestore();
	return out;
}

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
			"connector",
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
