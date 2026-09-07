/**
 * Local read-only question log — one JSON object per line at
 * $XDG_DATA_HOME/easysql/history.jsonl.
 *
 * Entries are appended by `easysql query` after a successful execution
 * and never sent to the API. The history command renders them in
 * reverse-chronological order with --limit and --clear support.
 */

import {
	appendFileSync,
	chmodSync,
	existsSync,
	mkdirSync,
	readFileSync,
	truncateSync,
	writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { getHistoryPath } from "../config/paths.js";

export interface HistoryEntry {
	at: string;
	question: string;
	connector: string;
	sql?: string;
	row_count?: number;
	duration_ms?: number;
	status: "ok" | "error" | "generate-only";
	error?: string;
}

function chmod0600(path: string): void {
	try {
		chmodSync(path, 0o600);
	} catch {
		// best-effort on Windows
	}
}

function ensureFile(): void {
	const path = getHistoryPath();
	const abs = isAbsolute(path) ? path : resolve(path);
	const dir = dirname(abs);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
	if (!existsSync(abs)) {
		writeFileSync(abs, "", { encoding: "utf8" });
		chmod0600(abs);
	}
}

export function appendHistory(entry: HistoryEntry): void {
	ensureFile();
	const path = getHistoryPath();
	appendFileSync(path, JSON.stringify(entry) + "\n", { encoding: "utf8" });
}

export function readHistory(limit = 50): HistoryEntry[] {
	const path = getHistoryPath();
	if (!existsSync(path)) return [];
	const raw = readFileSync(path, "utf8");
	const lines = raw.split("\n").filter((l) => l.trim().length > 0);
	const entries: HistoryEntry[] = [];
	for (const line of lines) {
		try {
			entries.push(JSON.parse(line) as HistoryEntry);
		} catch {
			// skip malformed lines
		}
	}
	return entries.slice(-limit).reverse();
}

export function clearHistory(): boolean {
	const path = getHistoryPath();
	if (!existsSync(path)) return false;
	truncateSync(path, 0);
	return true;
}
