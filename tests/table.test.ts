import { describe, expect, it } from "bun:test";
import { renderResult } from "../src/output/table.js";

describe("renderResult", () => {
	const columns = ["id", "name"];
	const rows = [
		{ id: 1, name: "Alice" },
		{ id: 2, name: "Bob" },
		{ id: null, name: "Carol" },
	];

	it("renders json", () => {
		const out = renderResult("json", columns, rows);
		expect(out).toContain('"id": 1');
		expect(out).toContain('"name": "Alice"');
	});

	it("renders csv", () => {
		const out = renderResult("csv", columns, rows);
		const lines = out.split("\n");
		expect(lines[0]).toBe("id,name");
		expect(lines[1]).toBe("1,Alice");
		expect(lines[3]).toBe(",Carol");
	});

	it("renders table with row count", () => {
		const out = renderResult("table", columns, rows);
		expect(out).toMatch(/┌─[\s\S]+┐/);
		expect(out).toMatch(/└─[\s\S]+┘/);
		expect(out).toMatch(/3 rows/);
	});

	it("renders NULL for null values", () => {
		const out = renderResult("table", columns, rows);
		expect(out).toMatch(/NULL/);
	});

	it("renders empty result message when columns are empty", () => {
		const out = renderResult("table", [], []);
		expect(out).toMatch(/empty result/);
	});

	it("escapes commas and quotes in csv cells", () => {
		const out = renderResult("csv", ["note"], [{ note: 'has,comma and "quote"' }]);
		expect(out).toMatch(/"has,comma and ""quote"""$/);
	});
});
