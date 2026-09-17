#!/usr/bin/env node

/**
 * Binary entrypoint — minimal wrapper that calls run() with process.argv.
 *
 * Runs on Node >=22.13 (node:sqlite) and on Bun >=1.4. When compiled with
 * `bun build --compile`, the executable embeds the Bun runtime and prepends
 * ["bun", "<embedded-path>"] to argv; we detect that and slice the real args.
 */

import { userArgs } from "./cli/user-args.js";
import { run } from "./cli.js";

const args = userArgs(process.argv);
const code = await run(args);
if (code !== 0) process.exit(code);
