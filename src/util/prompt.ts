/**
 * Secure interactive prompt — reads a value from stdin with the terminal
 * echo disabled (e.g. API keys, passwords).
 *
 * Falls back to a visible prompt when stdin is not a TTY (CI, piped input).
 */

import { createInterface, type Interface as RLInterface } from "node:readline";
import { isatty } from "node:tty";

function readline(prompt: string): RLInterface {
	const rl = createInterface({ input: process.stdin, output: process.stderr });
	rl.write(prompt);
	return rl;
}

/**
 * Reads a value from stdin with terminal echo suppressed. Returns null when
 * stdin is not a TTY (caller should fall back to --flag).
 */
export async function promptSecret(question: string): Promise<string | null> {
	if (!isatty(0)) return null;
	return new Promise((resolve) => {
		const stdin = process.stdin;
		const stdout = process.stderr;
		stdin.setRawMode?.(true);
		stdin.resume();
		stdin.setEncoding("utf8");

		stdout.write(question);
		let buf = "";
		stdin.on("data", (ch: string) => {
			for (const c of ch) {
				if (c === "\n" || c === "\r" || c === "\u0004") {
					stdin.setRawMode?.(false);
					stdin.pause();
					stdin.removeAllListeners("data");
					stdout.write("\n");
					resolve(buf);
					return;
				}
				if (c === "\u0003") {
					// Ctrl+C
					stdin.setRawMode?.(false);
					stdin.pause();
					stdin.removeAllListeners("data");
					stdout.write("\n");
					process.exit(130);
				}
				if (c === "\u007f" || c === "\b") {
					// Backspace
					buf = buf.slice(0, -1);
					stdout.write("\b \b");
					continue;
				}
				buf += c;
				stdout.write("*");
			}
		});
	});
}

/**
 * Reads a single line from stdin (echo visible). Returns null on EOF.
 */
export async function promptLine(question: string): Promise<string | null> {
	return new Promise((resolve) => {
		const rl = readline(question);
		rl.once("line", (line) => {
			rl.close();
			resolve(line);
		});
		rl.once("close", () => resolve(null));
	});
}
