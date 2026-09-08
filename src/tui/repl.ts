/**
 * Entry point for `easysql` (no subcommand). Renders the ink TUI
 * defined in `./app.tsx`. Non-TTY callers are rejected — the TUI needs
 * a real terminal to drive `useInput`. Those callers should use the
 * `easysql query "..."` subcommand instead.
 */

import { isatty } from "node:tty";
import { printError } from "../output/print.js";
import { mountTui } from "./mount.js";

interface ReplOptions {
	connector?: string;
}

export async function startRepl(opts: ReplOptions): Promise<number> {
	if (!isatty(0) || !isatty(1)) {
		printError("Interactive TUI requires a TTY. Use 'easysql query \"...\"' instead.");
		return 1;
	}
	const instance = mountTui(opts);
	try {
		await instance.waitUntilExit();
		return 0;
	} finally {
		instance.unmount();
	}
}
