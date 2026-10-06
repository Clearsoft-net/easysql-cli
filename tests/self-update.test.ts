import { describe, expect, it } from "bun:test";
import {
	compareSemver,
	currentPlatform,
	resolveUpdateTarget,
	updateTempPath,
} from "../src/update/self-update.js";

describe("resolveUpdateTarget", () => {
	it("uses the runtime path for check-only runs with an entry script", () => {
		expect(
			resolveUpdateTarget(
				"/home/user/.nvm/versions/node/v24/bin/node",
				"/home/user/.nvm/versions/node/v24/lib/node_modules/@easysql/cli/dist/bin.js",
				true,
			),
		).toBe("/home/user/.nvm/versions/node/v24/bin/node");
	});

	it("does not use the runtime path when no entry script is available", () => {
		expect(
			resolveUpdateTarget("/home/user/.nvm/versions/node/v24/bin/node", undefined, true),
		).toBeNull();
	});

	it("returns no target for Node/npm executions", () => {
		expect(
			resolveUpdateTarget(
				"/home/user/.nvm/versions/node/v24/bin/node",
				"/home/user/.nvm/versions/node/v24/lib/node_modules/@easysql/cli/dist/bin.js",
			),
		).toBeNull();
		expect(
			resolveUpdateTarget(
				"/home/user/.nvm/versions/node/v24/bin/node",
				"/home/user/.nvm/versions/node/v24/lib/node_modules/@easysql/cli/node_modules/.bin/easysql",
			),
		).toBeNull();
	});

	it("uses the executable path for a Bun-compiled standalone binary", () => {
		expect(resolveUpdateTarget("/usr/local/bin/easysql", "/$bunfs/root/src/bin.js")).toBe(
			"/usr/local/bin/easysql",
		);
		expect(
			resolveUpdateTarget(
				"C:\\Program Files\\EasySQL\\easysql.exe",
				"C:\\$bunfs\\root\\src\\bin.js",
			),
		).toBe("C:\\Program Files\\EasySQL\\easysql.exe");
	});
});

describe("updateTempPath", () => {
	it("creates the temporary download beside the target executable", () => {
		expect(updateTempPath("/usr/local/bin/easysql")).toBe(
			"/usr/local/bin/easysql.easysql-update.tmp",
		);
	});
});

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
