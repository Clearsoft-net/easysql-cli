import { describe, expect, it } from "bun:test";
import { userArgs } from "../src/cli/user-args.js";

describe("userArgs", () => {
	it("strips the bun-compiled binary prefix", () => {
		expect(userArgs(["bun", "/$bunfs/root/easysql", "connector", "list"])).toEqual([
			"connector",
			"list",
		]);
	});

	it("strips interpreter + script (bun run src/bin.ts)", () => {
		expect(userArgs(["bun", "src/bin.ts", "connector", "list"])).toEqual(["connector", "list"]);
	});

	it("strips interpreter + script (node dist/bin.js)", () => {
		expect(userArgs(["/usr/bin/node", "dist/bin.js", "query", "hi"])).toEqual(["query", "hi"]);
	});

	it("strips a package-manager shim (node_modules/.bin, no extension)", () => {
		expect(
			userArgs(["/usr/bin/node", "/app/node_modules/.bin/easysql", "connector", "list"]),
		).toEqual(["connector", "list"]);
	});

	it("strips the installed binary path", () => {
		expect(userArgs(["/usr/local/bin/easysql", "usage"])).toEqual(["usage"]);
	});

	it("leaves a bare interpreter argv untouched", () => {
		expect(userArgs(["bun"])).toEqual(["bun"]);
	});
});
