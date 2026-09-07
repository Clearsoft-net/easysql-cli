import { describe, expect, it } from "bun:test";
import { compareSemver, currentPlatform } from "../src/update/self-update.js";

describe("compareSemver", () => {
	it("treats equal versions as 0", () => {
		expect(compareSemver("1.2.3", "1.2.3")).toBe(0);
	});

	it("ignores the v prefix", () => {
		expect(compareSemver("v1.2.3", "v1.2.3")).toBe(0);
		expect(compareSemver("v1.2.3", "1.2.3")).toBe(0);
	});

	it("returns positive when a > b", () => {
		expect(compareSemver("1.2.4", "1.2.3")).toBeGreaterThan(0);
		expect(compareSemver("1.3.0", "1.2.99")).toBeGreaterThan(0);
		expect(compareSemver("2.0.0", "1.99.99")).toBeGreaterThan(0);
	});

	it("returns negative when a < b", () => {
		expect(compareSemver("1.2.3", "1.2.4")).toBeLessThan(0);
		expect(compareSemver("1.2.99", "1.3.0")).toBeLessThan(0);
	});

	it("treats missing components as zero", () => {
		expect(compareSemver("1.2", "1.2.0")).toBe(0);
		expect(compareSemver("1", "1.0.0")).toBe(0);
		expect(compareSemver("1.2", "1.2.1")).toBeLessThan(0);
	});
});

describe("currentPlatform", () => {
	it("returns a recognized suffix", () => {
		const p = currentPlatform();
		expect(p).toMatch(/^(linux|darwin|windows)-(x64|arm64)$/);
	});
});
