#!/usr/bin/env bun

/**
 * Binary entrypoint — minimal wrapper that calls run() with process.argv.
 *
 * Note: when the binary is built with `bun build --compile`, the resulting
 * executable embeds the Bun runtime and prepends ["bun", "<embedded-path>"]
 * to argv. We detect that and slice the actual user args from argv.
 */

import { userArgs } from "./cli/user-args.js";
import { run } from "./cli.js";

const args = userArgs(process.argv);
const code = await run(args);
if (code !== 0) process.exit(code);
