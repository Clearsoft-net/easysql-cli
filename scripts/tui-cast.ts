#!/usr/bin/env bun
/**
 * Dev helper: record the interactive TUI (or any one-shot command) as a
 * real terminal cast. Runs the command under `asciinema rec` inside a tmux
 * pane so the TUI sees a real TTY (alternate screen and all), drives the
 * keys/tokens from the CLI, then finalizes the recording.
 *
 * Requires asciinema 3.x (`cargo install asciinema`) in $PATH, or pass
 * --asciinema <path>. Optional: `agg <file.cast> <file.gif>` to make a GIF.
 *
 * Usage:
 *   bun run scripts/tui-cast.ts --out /tmp/q.cast 'quantos clientes temos?' '$Enter'
 *   bun run scripts/tui-cast.ts --cmd 'bun run src/bin.ts query "quantos clientes?"' --quit none --out /tmp/q.cast
 *   bun run scripts/tui-cast.ts --format v2 --idle 2 --out /tmp/q.cast '$Tab' 'j' '$Enter'
 *
 * After the tokens, the script waits for the `--settle` marker (default
 * "Generating") to leave the screen before sending `--quit`, so the recording
 * captures the result of the query. Use --settle '' to just wait --hold ms.
 *
 * Tokens starting with `$` are tmux key names (Tab, BTab, Enter, Escape,
 * Up, Down, Left, Right, C-c, ...). Anything else is sent as literal text.
 */

import { spawnSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

const ROOT = dirname(import.meta.dir);

interface Options {
	size: string;
	waitMs: number;
	perKeyMs: number;
	holdMs: number;
	timeoutMs: number;
	session: string;
	cmd: string;
	out: string;
	title: string;
	idle: number;
	format: "v2" | "v3";
	quit: string;
	settle: string;
	captureInput: boolean;
	asciinema?: string;
	keep: boolean;
	tokens: string[];
}

function parseArgs(argv: string[]): Options {
	const opts: Options = {
		size: "100x26",
		waitMs: 1500,
		perKeyMs: 350,
		holdMs: 1500,
		timeoutMs: 15000,
		session: "easysql-cast",
		cmd: "bun run src/bin.ts",
		out: "/tmp/easysql-demo.cast",
		title: "EasySQL CLI",
		idle: 2,
		format: "v3",
		quit: "C-c",
		settle: "Generating",
		captureInput: false,
		keep: false,
		tokens: [],
	};

	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i] as string;
		switch (arg) {
			case "--size":
				opts.size = argv[++i] as string;
				break;
			case "--wait":
				opts.waitMs = Number(argv[++i]);
				break;
			case "--per-key":
				opts.perKeyMs = Number(argv[++i]);
				break;
			case "--hold":
				opts.holdMs = Number(argv[++i]);
				break;
			case "--timeout":
				opts.timeoutMs = Number(argv[++i]);
				break;
			case "--session":
				opts.session = argv[++i] as string;
				break;
			case "--cmd":
				opts.cmd = argv[++i] as string;
				break;
			case "--out":
				opts.out = argv[++i] as string;
				break;
			case "--title":
				opts.title = argv[++i] as string;
				break;
			case "--idle":
				opts.idle = Number(argv[++i]);
				break;
			case "--format":
				opts.format = (argv[++i] as string) === "v2" ? "v2" : "v3";
				break;
			case "--quit":
				opts.quit = argv[++i] as string;
				break;
			case "--settle":
				opts.settle = argv[++i] as string;
				break;
			case "--capture-input":
				opts.captureInput = true;
				break;
			case "--asciinema":
				opts.asciinema = argv[++i] as string;
				break;
			case "--keep":
				opts.keep = true;
				break;
			default:
				opts.tokens.push(arg);
		}
	}
	return opts;
}

function tmux(args: string[]): string {
	const proc = spawnSync("tmux", args, { encoding: "utf8" });
	if (proc.status !== 0) {
		throw new Error(`tmux ${args.join(" ")} failed: ${proc.stderr.trim()}`);
	}
	return proc.stdout;
}

function sleep(ms: number): void {
	Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function shq(s: string): string {
	return `'${s.replace(/'/g, "'\\''")}'`;
}

function resolveAsciinema(explicit?: string): string {
	if (explicit) return explicit;
	if (process.env.ASCIINEMA) return process.env.ASCIINEMA;
	const which = spawnSync("which", ["asciinema"], { encoding: "utf8" });
	if (which.status === 0 && which.stdout.trim()) return which.stdout.trim();
	const cargo = `${process.env.HOME ?? ""}/.cargo/bin/asciinema`;
	if (existsSync(cargo)) return cargo;
	throw new Error(
		"asciinema not found. Install it with `cargo install asciinema` or pass --asciinema <path>.",
	);
}

function paneCommand(session: string): string {
	const proc = spawnSync(
		"tmux",
		["display-message", "-p", "-t", session, "#{pane_current_command}"],
		{
			encoding: "utf8",
		},
	);
	return proc.stdout.trim();
}

function buildAsciinemaArgs(opts: Options, bin: string): string[] {
	const args = [bin, "rec", "--overwrite", "--quiet"];
	if (opts.captureInput) args.push("--capture-input");
	args.push(
		"--window-size",
		opts.size,
		"--idle-time-limit",
		String(opts.idle),
		"--title",
		opts.title,
		"-f",
		opts.format === "v2" ? "asciicast-v2" : "asciicast-v3",
		"--command",
		opts.cmd,
		opts.out,
	);
	return args;
}

const opts = parseArgs(process.argv.slice(2));
const [width, height] = opts.size.split("x");
const asciinema = resolveAsciinema(opts.asciinema);
const outPath = resolve(opts.out);

spawnSync("tmux", ["kill-session", "-t", opts.session]);
const paneCmd = `${buildAsciinemaArgs(opts, asciinema).map(shq).join(" ")}; sleep 3600`;
tmux([
	"new-session",
	"-d",
	"-s",
	opts.session,
	"-x",
	width as string,
	"-y",
	height as string,
	"-c",
	ROOT,
	paneCmd,
]);

try {
	sleep(opts.waitMs);
	for (const token of opts.tokens) {
		if (token.startsWith("$")) {
			tmux(["send-keys", "-t", opts.session, token.slice(1)]);
		} else {
			tmux(["send-keys", "-t", opts.session, "-l", token]);
		}
		sleep(opts.perKeyMs);
	}

	if (opts.settle) {
		sleep(700);
		const settleDeadline = Date.now() + opts.timeoutMs;
		while (Date.now() < settleDeadline) {
			const frame = tmux(["capture-pane", "-t", opts.session, "-p"]);
			if (!frame.includes(opts.settle)) break;
			sleep(300);
		}
	}

	sleep(opts.holdMs);
	if (opts.quit !== "none") {
		tmux(["send-keys", "-t", opts.session, opts.quit]);
	}

	const deadline = Date.now() + opts.timeoutMs;
	let finished = false;
	while (Date.now() < deadline) {
		if (paneCommand(opts.session) !== "asciinema") {
			finished = true;
			break;
		}
		sleep(150);
	}
	sleep(opts.holdMs);

	if (!existsSync(outPath)) {
		throw new Error(
			`cast not written: ${outPath}${finished ? "" : " (recording still running — raise --timeout or check --quit)"}`,
		);
	}
	const bytes = statSync(outPath).size;
	process.stdout.write(`${outPath}\n`);
	process.stdout.write(`${opts.size}  ${bytes} bytes  finalizado=${finished}\n`);
	process.stdout.write(`play:  asciinema play ${outPath}\n`);
	process.stdout.write(`gif:   agg ${outPath} ${outPath.replace(/\.cast$/, ".gif")}\n`);
} finally {
	if (opts.keep) {
		process.stderr.write(`session kept: tmux attach -t ${opts.session}\n`);
	} else {
		tmux(["kill-session", "-t", opts.session]);
	}
}
