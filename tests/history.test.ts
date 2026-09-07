import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { appendFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	appendHistory,
	clearHistory,
	type HistoryEntry,
	readHistory,
} from "../src/history/store.js";
import { setDataDirOverride } from "./_helpers.js";

describe("history store", () => {
	let tmp: string;

	beforeEach(() => {
		tmp = mkdtempSync(join(tmpdir(), "easysql-history-"));
		setDataDirOverride(tmp);
	});

	afterEach(() => {
		setDataDirOverride(undefined);
		rmSync(tmp, { recursive: true, force: true });
	});

	it("starts empty", () => {
		expect(readHistory()).toEqual([]);
	});

	it("appends and reads entries (newest first)", () => {
		const e1: HistoryEntry = {
			at: "2026-09-07T10:00:00Z",
			question: "first",
			connector: "db",
			status: "ok",
		};
		const e2: HistoryEntry = {
			at: "2026-09-07T11:00:00Z",
			question: "second",
			connector: "db",
			status: "generate-only",
		};
		appendHistory(e1);
		appendHistory(e2);

		const out = readHistory();
		expect(out).toHaveLength(2);
		expect(out[0]?.question).toBe("second");
		expect(out[1]?.question).toBe("first");
	});

	it("respects --limit (returns at most N entries)", () => {
		for (let i = 0; i < 5; i++) {
			appendHistory({
				at: `2026-09-07T10:0${i}:00Z`,
				question: `q${i}`,
				connector: "db",
				status: "ok",
			});
		}
		expect(readHistory(3)).toHaveLength(3);
	});

	it("clearHistory removes all entries", () => {
		appendHistory({
			at: "2026-09-07T10:00:00Z",
			question: "x",
			connector: "db",
			status: "ok",
		});
		expect(clearHistory()).toBe(true);
		expect(readHistory()).toEqual([]);
		// Calling clear on an already-empty file still reports success.
		expect(clearHistory()).toBe(true);
	});

	it("skips malformed JSON lines", () => {
		const path = join(tmp, "history.jsonl");
		appendFileSync(
			path,
			`not json\n${JSON.stringify({ at: "2026-09-07T10:00:00Z", question: "x", connector: "db", status: "ok" })}\n`,
		);
		const out = readHistory();
		expect(out).toHaveLength(1);
		expect(out[0]?.question).toBe("x");
	});
});
