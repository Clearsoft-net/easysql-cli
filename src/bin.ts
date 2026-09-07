#!/usr/bin/env bun
/**
 * Binary entrypoint — minimal wrapper that calls run() with process.argv.
 *
 * Note: when the binary is built with `bun build --compile`, the resulting
 * executable embeds the Bun runtime and prepends ["bun", "<embedded-path>"]
 * to argv. We detect that and slice the actual user args from argv.
 */

import { run } from "./cli.js";

function userArgs(argv: string[]): string[] {
	const a0 = argv[0] ?? "";
	const a1 = argv[1] ?? "";
	// bun-compiled binary: ["bun", "/$bunfs/root/<entry>", ...user]
	if ((a0 === "bun" || a0.endsWith("/bun")) && a1.includes("$bunfs/")) {
		return argv.slice(2);
	}
	// Normal node / bun invocation: ["<exe>", ...user]
	if (
		a0.endsWith("easysql") ||
		a0.endsWith("node") ||
		a0.endsWith("bun") ||
		a0.endsWith("easysql-cli")
	) {
		return argv.slice(1);
	}
	return argv;
}

const args = userArgs(process.argv);
const code = await run(args);
if (code !== 0) process.exit(code);
