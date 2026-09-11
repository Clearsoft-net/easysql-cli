#!/usr/bin/env bun
/**
 * Dev helper: render the interactive TUI inside a real PTY (tmux) and
 * print the visible screen — as plain text, raw ANSI, or a PNG
 * screenshot (ANSI -> HTML -> headless Chromium). Lets an agent (or a
 * human on a headless box) inspect the TUI exactly as a user sees it —
 * alternate screen, colors, real terminal size and live re-renders.
 *
 * Usage:
 *   bun run scripts/tui-capture.ts                       # default Question screen
 *   bun run scripts/tui-capture.ts '$Tab'                # switch to Connectors
 *   bun run scripts/tui-capture.ts '$/' help '$Enter'    # open the help modal
 *   bun run scripts/tui-capture.ts --size 100x24 '$Tab' '$Tab'
 *   bun run scripts/tui-capture.ts --png /tmp/tui.png    # render a screenshot
 *
 * Tokens starting with `$` are tmux key names (Tab, BTab, Enter, Escape,
 * Up, Down, Left, Right, C-c, ...). Anything else is sent as literal text.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const ROOT = dirname(import.meta.dir);

interface Options {
	size: string;
	waitMs: number;
	perKeyMs: number;
	session: string;
	cmd: string;
	keep: boolean;
	ansi: boolean;
	png?: string;
	fontSize: number;
	scale: number;
	chrome?: string;
	keepHtml: boolean;
	tokens: string[];
}

function parseArgs(argv: string[]): Options {
	const opts: Options = {
		size: "120x30",
		waitMs: 1200,
		perKeyMs: 350,
		session: "easysql-capture",
		cmd: "bun run src/bin.ts",
		keep: false,
		ansi: false,
		fontSize: 14,
		scale: 2,
		keepHtml: false,
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
			case "--session":
				opts.session = argv[++i] as string;
				break;
			case "--cmd":
				opts.cmd = argv[++i] as string;
				break;
			case "--png":
				opts.png = argv[++i] as string;
				break;
			case "--font-size":
				opts.fontSize = Number(argv[++i]);
				break;
			case "--scale":
				opts.scale = Number(argv[++i]);
				break;
			case "--chrome":
				opts.chrome = argv[++i] as string;
				break;
			case "--keep":
				opts.keep = true;
				break;
			case "--keep-html":
				opts.keepHtml = true;
				break;
			case "--ansi":
				opts.ansi = true;
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

// --- ANSI -> HTML ---------------------------------------------------------

const FG: Record<number, string> = {
	30: "#1c1c1c",
	31: "#e05252",
	32: "#5fd35f",
	33: "#e0c95f",
	34: "#6f9bff",
	35: "#d966d9",
	36: "#4fd6d6",
	37: "#e0e0e0",
	90: "#7f7f7f",
	91: "#ff5c5c",
	92: "#7cff7c",
	93: "#fff07c",
	94: "#8fb0ff",
	95: "#ff8fff",
	96: "#7cffff",
	97: "#ffffff",
};

const BG: Record<number, string> = {
	40: "#1c1c1c",
	41: "#e05252",
	42: "#5fd35f",
	43: "#e0c95f",
	44: "#6f9bff",
	45: "#d966d9",
	46: "#4fd6d6",
	47: "#e0e0e0",
	100: "#7f7f7f",
	101: "#ff5c5c",
	102: "#7cff7c",
	103: "#fff07c",
	104: "#8fb0ff",
	105: "#ff8fff",
	106: "#7cffff",
	107: "#ffffff",
};

interface AnsiState {
	bold: boolean;
	dim: boolean;
	underline: boolean;
	inverse: boolean;
	fg?: string;
	bg?: string;
}

function cssFor(s: AnsiState): string {
	let fg = s.fg;
	let bg = s.bg;
	if (s.inverse) [fg, bg] = [bg ?? "#0c0c0c", fg ?? "#e0e0e0"];
	const parts = [`color:${fg ?? "#e0e0e0"}`];
	if (bg) parts.push(`background:${bg}`);
	if (s.bold) parts.push("font-weight:700");
	if (s.underline) parts.push("text-decoration:underline");
	if (s.dim) parts.push("opacity:0.55");
	return parts.join(";");
}

function escapeHtml(t: string): string {
	return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function applySgr(state: AnsiState, params: string): void {
	const codes = params === "" ? [0] : params.split(";").map((c) => Number.parseInt(c, 10));
	for (const code of codes) {
		if (code === 0) {
			state.bold = state.dim = state.underline = state.inverse = false;
			state.fg = state.bg = undefined;
		} else if (code === 1) state.bold = true;
		else if (code === 2) state.dim = true;
		else if (code === 4) state.underline = true;
		else if (code === 7) state.inverse = true;
		else if (code === 22) state.bold = state.dim = false;
		else if (code === 24) state.underline = false;
		else if (code === 27) state.inverse = false;
		else if (code === 39) state.fg = undefined;
		else if (code === 49) state.bg = undefined;
		else if (FG[code]) state.fg = FG[code];
		else if (BG[code]) state.bg = BG[code];
	}
}

function ansiToHtml(input: string, fontSize: number): string {
	const state: AnsiState = { bold: false, dim: false, underline: false, inverse: false };
	const ESC = 27;
	const BEL = 7;
	let body = "";
	let i = 0;
	let start = 0;
	while (i < input.length) {
		if (input.charCodeAt(i) !== ESC) {
			i++;
			continue;
		}
		if (i > start) {
			body += `<span style="${cssFor(state)}">${escapeHtml(input.slice(start, i))}</span>`;
		}
		const next = input[i + 1];
		if (next === "[") {
			let j = i + 2;
			while (j < input.length && input[j] !== "m") j++;
			applySgr(state, input.slice(i + 2, j));
			i = j + 1;
		} else if (next === "]") {
			let j = i + 2;
			while (j < input.length && input.charCodeAt(j) !== BEL && input.charCodeAt(j) !== ESC)
				j++;
			i = input.charCodeAt(j) === ESC ? j + 2 : j + 1;
		} else {
			i += 3;
		}
		start = i;
	}
	if (start < input.length) {
		body += `<span style="${cssFor(state)}">${escapeHtml(input.slice(start))}</span>`;
	}

	return `<!doctype html><html><head><meta charset="utf-8"><style>
	html,body{margin:0;background:#0c0c0c}
	pre{font-family:'DejaVu Sans Mono','Liberation Mono',monospace;font-size:${fontSize}px;
		line-height:1.25;color:#e0e0e0;background:#0c0c0c;padding:10px;margin:0;
		white-space:pre;display:inline-block}
	</style></head><body><pre>${body}\n</pre></body></html>`;
}

// --- PNG rendering --------------------------------------------------------

const CHROME_CANDIDATES = ["google-chrome", "google-chrome-stable", "chromium-browser", "chromium"];

function findChrome(explicit?: string): string {
	if (explicit) return explicit;
	if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
	for (const candidate of CHROME_CANDIDATES) {
		const proc = spawnSync("which", [candidate], { encoding: "utf8" });
		if (proc.status === 0 && proc.stdout.trim()) return proc.stdout.trim();
	}
	throw new Error("No Chrome/Chromium found. Pass --chrome <path> or set CHROME_PATH.");
}

// DejaVu Sans Mono advance width is ~0.602em; used to size the viewport
// so the captured PNG fits the frame without scrollbars or clipping.
const CHAR_WIDTH_EM = 0.6023;
const LINE_HEIGHT = 1.25;
const PADDING = 24;

function renderPng(ansi: string, pngPath: string, opts: Options): void {
	const [cols, rows] = opts.size.split("x").map((n) => Number(n));
	const htmlPath = `${pngPath}.html`;
	mkdirSync(dirname(pngPath), { recursive: true });
	writeFileSync(htmlPath, ansiToHtml(ansi, opts.fontSize));

	const width = Math.ceil((cols as number) * opts.fontSize * CHAR_WIDTH_EM + PADDING);
	const height = Math.ceil((rows as number) * opts.fontSize * LINE_HEIGHT + PADDING);
	const chrome = findChrome(opts.chrome);
	const proc = spawnSync(
		chrome,
		[
			"--headless=new",
			"--no-sandbox",
			"--disable-gpu",
			"--hide-scrollbars",
			`--force-device-scale-factor=${opts.scale}`,
			`--window-size=${width},${height}`,
			`--screenshot=${pngPath}`,
			`file://${htmlPath}`,
		],
		{ encoding: "utf8" },
	);
	if (proc.status !== 0 || !existsSync(pngPath)) {
		throw new Error(`Chromium screenshot failed: ${proc.stderr.trim()}`);
	}
	if (!opts.keepHtml) unlinkSync(htmlPath);
	process.stdout.write(`${resolve(pngPath)}\n`);
}

// --- main -----------------------------------------------------------------

const opts = parseArgs(process.argv.slice(2));
const [width, height] = opts.size.split("x");

spawnSync("tmux", ["kill-session", "-t", opts.session]);
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
	`${opts.cmd}; sleep 3600`,
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
	const captureArgs = ["capture-pane", "-t", opts.session, "-p"];
	if (opts.png || opts.ansi) captureArgs.push("-e");
	const frame = tmux(captureArgs);
	if (opts.png) {
		renderPng(frame, opts.png, opts);
	} else {
		process.stdout.write(frame);
		process.stdout.write("\n");
	}
} finally {
	if (opts.keep) {
		process.stderr.write(`session kept: tmux attach -t ${opts.session}\n`);
	} else {
		tmux(["kill-session", "-t", opts.session]);
	}
}
