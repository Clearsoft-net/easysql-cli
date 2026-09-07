import { describe, expect, it } from "bun:test";
import { validateSelectOnly } from "../src/util/sql-validator.js";

describe("validateSelectOnly", () => {
	it("accepts a plain SELECT", () => {
		expect(validateSelectOnly("SELECT 1").ok).toBe(true);
	});

	it("accepts WITH ... SELECT", () => {
		expect(validateSelectOnly("WITH x AS (SELECT 1) SELECT * FROM x").ok).toBe(true);
	});

	it("accepts EXPLAIN SELECT", () => {
		expect(validateSelectOnly("EXPLAIN SELECT 1").ok).toBe(true);
	});

	it("rejects empty input", () => {
		expect(validateSelectOnly("").ok).toBe(false);
		expect(validateSelectOnly("   ").ok).toBe(false);
	});

	it("rejects INSERT", () => {
		const r = validateSelectOnly("INSERT INTO x (a) VALUES (1)");
		expect(r.ok).toBe(false);
	});

	it("rejects UPDATE", () => {
		const r = validateSelectOnly("UPDATE x SET a = 1");
		expect(r.ok).toBe(false);
	});

	it("rejects DELETE", () => {
		const r = validateSelectOnly("DELETE FROM x");
		expect(r.ok).toBe(false);
	});

	it("rejects DROP", () => {
		const r = validateSelectOnly("DROP TABLE x");
		expect(r.ok).toBe(false);
	});

	it("rejects ALTER", () => {
		const r = validateSelectOnly("ALTER TABLE x ADD COLUMN y INT");
		expect(r.ok).toBe(false);
	});

	it("rejects CREATE", () => {
		const r = validateSelectOnly("CREATE TABLE x (id INT)");
		expect(r.ok).toBe(false);
	});

	it("rejects multi-statement (semicolon in the middle)", () => {
		const r = validateSelectOnly("SELECT 1; DROP TABLE x");
		expect(r.ok).toBe(false);
	});

	it("rejects stacked statements even when the first looks fine", () => {
		const r = validateSelectOnly("SELECT 1; SELECT 2");
		expect(r.ok).toBe(false);
	});

	it("accepts a single trailing semicolon", () => {
		expect(validateSelectOnly("SELECT 1;").ok).toBe(true);
	});

	it("ignores comments and string literals when scanning for keywords", () => {
		// The keyword DROP lives inside a comment; should be OK.
		expect(validateSelectOnly("-- DROP TABLE x\nSELECT 1").ok).toBe(true);
		expect(validateSelectOnly("/* DROP TABLE x */ SELECT 1").ok).toBe(true);
		expect(validateSelectOnly("SELECT 'DROP TABLE x'").ok).toBe(true);
	});

	it("rejects keywords that bypass string-literal evasion via case variation", () => {
		const r = validateSelectOnly("select 1; DrOp TABLE x");
		expect(r.ok).toBe(false);
	});
});
