import { describe, expect, it } from "bun:test";
import { NAME, REPO, VERSION } from "../src/version.js";

describe("version", () => {
	it("exports a semver string", () => {
		expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
	});

	it("exports the correct package name", () => {
		expect(NAME).toBe("@easysql/cli");
	});

	it("exports the GitHub repo path", () => {
		expect(REPO).toBe("Clearsoft-net/easysql-cli");
	});
});
