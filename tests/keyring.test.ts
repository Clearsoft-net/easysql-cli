import { afterEach, describe, expect, it } from "bun:test";
import {
	__setTestHooks,
	backendFor,
	KEYRING_SERVICE,
	keyringDelete,
	keyringGet,
	keyringSet,
	type Runner,
	type RunResult,
} from "../src/config/keyring.js";

interface Call {
	file: string;
	args: string[];
	stdin?: string;
}

const calls: Call[] = [];

function fakeRunner(result: RunResult | ((call: Call) => RunResult)): Runner {
	return async (file, args, stdin) => {
		const call = { file, args, stdin };
		calls.push(call);
		return typeof result === "function" ? result(call) : result;
	};
}

const ok: RunResult = { code: 0, stdout: "", stderr: "" };

afterEach(() => {
	__setTestHooks({ runner: null, platform: null });
	calls.length = 0;
});

describe("backendFor", () => {
	it("picks the native tool per platform", () => {
		expect(backendFor("darwin")).toBe("security");
		expect(backendFor("linux")).toBe("secret-tool");
		expect(backendFor("win32")).toBe("powershell");
		expect(backendFor("freebsd")).toBe("disabled");
	});

	it("EASYSQL_KEYRING=0 disables the keyring", () => {
		expect(backendFor("linux", { EASYSQL_KEYRING: "0" })).toBe("disabled");
		expect(backendFor("darwin", { EASYSQL_KEYRING: "0" })).toBe("disabled");
	});
});

describe("linux (secret-tool)", () => {
	it("get looks up account/service and trims the newline", async () => {
		__setTestHooks({ platform: "linux", runner: fakeRunner({ ...ok, stdout: "s3cret\n" }) });
		expect(await keyringGet("prod")).toBe("s3cret");
		expect(calls).toEqual([
			{
				file: "secret-tool",
				args: ["lookup", "account", "prod", "service", KEYRING_SERVICE],
				stdin: undefined,
			},
		]);
	});

	it("get returns null when the entry does not exist", async () => {
		__setTestHooks({
			platform: "linux",
			runner: fakeRunner({ code: 1, stdout: "", stderr: "" }),
		});
		expect(await keyringGet("prod")).toBeNull();
	});

	it("get returns null when the entry is empty", async () => {
		__setTestHooks({ platform: "linux", runner: fakeRunner({ ...ok, stdout: "" }) });
		expect(await keyringGet("prod")).toBeNull();
	});

	it("set passes the secret via stdin, never argv", async () => {
		__setTestHooks({ platform: "linux", runner: fakeRunner(ok) });
		await keyringSet("prod", "p@ss word");
		expect(calls[0]?.file).toBe("secret-tool");
		expect(calls[0]?.args).toContain("store");
		expect(calls[0]?.args).toEqual(
			expect.arrayContaining(["account", "prod", "service", KEYRING_SERVICE]),
		);
		expect(calls[0]?.stdin).toBe("p@ss word");
		expect(calls[0]?.args).not.toContain("p@ss word");
	});

	it("set surfaces the backend error message", async () => {
		__setTestHooks({
			platform: "linux",
			runner: fakeRunner({ code: 1, stdout: "", stderr: "secret service locked" }),
		});
		await expect(keyringSet("prod", "pw")).rejects.toThrow("secret service locked");
	});

	it("set reports a missing tool clearly", async () => {
		__setTestHooks({
			platform: "linux",
			runner: fakeRunner({ code: 127, stdout: "", stderr: "" }),
		});
		await expect(keyringSet("prod", "pw")).rejects.toThrow("secret-tool not found");
	});

	it("delete is best-effort", async () => {
		__setTestHooks({
			platform: "linux",
			runner: fakeRunner({ code: 1, stdout: "", stderr: "" }),
		});
		await expect(keyringDelete("prod")).resolves.toBeUndefined();
		expect(calls[0]?.args).toContain("clear");
	});
});

describe("macOS (security)", () => {
	it("get reads with find-generic-password -w", async () => {
		__setTestHooks({ platform: "darwin", runner: fakeRunner({ ...ok, stdout: "macpw\n" }) });
		expect(await keyringGet("prod")).toBe("macpw");
		expect(calls[0]?.file).toBe("/usr/bin/security");
		expect(calls[0]?.args).toEqual([
			"find-generic-password",
			"-a",
			"prod",
			"-s",
			KEYRING_SERVICE,
			"-w",
		]);
	});

	it("set uses add-generic-password -U", async () => {
		__setTestHooks({ platform: "darwin", runner: fakeRunner(ok) });
		await keyringSet("prod", "pw");
		expect(calls[0]?.args).toEqual([
			"add-generic-password",
			"-a",
			"prod",
			"-s",
			KEYRING_SERVICE,
			"-w",
			"pw",
			"-U",
		]);
	});
});

describe("windows (powershell)", () => {
	function decodePayload(stdin?: string): Record<string, string> {
		return JSON.parse(Buffer.from(stdin ?? "", "base64").toString("utf8"));
	}

	it("set ships a base64 JSON payload on stdin", async () => {
		__setTestHooks({ platform: "win32", runner: fakeRunner(ok) });
		await keyringSet("prod", "pässword");
		expect(calls[0]?.file).toBe("powershell.exe");
		expect(calls[0]?.args).toContain("-NoProfile");
		expect(calls[0]?.args).toContain("-NonInteractive");
		expect(decodePayload(calls[0]?.stdin)).toEqual({
			op: "set",
			account: "prod",
			secret: "pässword",
		});
	});

	it("get decodes the base64 stdout", async () => {
		const b64 = Buffer.from("winpw", "utf8").toString("base64");
		__setTestHooks({ platform: "win32", runner: fakeRunner({ ...ok, stdout: `${b64}\r\n` }) });
		expect(await keyringGet("prod")).toBe("winpw");
		expect(decodePayload(calls[0]?.stdin).op).toBe("get");
	});

	it("get returns null when the credential is missing", async () => {
		__setTestHooks({
			platform: "win32",
			runner: fakeRunner({ code: 1, stdout: "", stderr: "not found" }),
		});
		expect(await keyringGet("prod")).toBeNull();
	});
});

describe("disabled", () => {
	const original = process.env.EASYSQL_KEYRING;

	afterEach(() => {
		if (original === undefined) delete process.env.EASYSQL_KEYRING;
		else process.env.EASYSQL_KEYRING = original;
	});

	it("never spawns anything and reads as null", async () => {
		process.env.EASYSQL_KEYRING = "0";
		__setTestHooks({
			platform: "linux",
			runner: fakeRunner(() => {
				throw new Error("runner must not be called");
			}),
		});
		expect(await keyringGet("prod")).toBeNull();
		expect(calls).toHaveLength(0);
	});

	it("set fails with the disable reason", async () => {
		process.env.EASYSQL_KEYRING = "0";
		__setTestHooks({ platform: "linux", runner: fakeRunner(ok) });
		await expect(keyringSet("prod", "pw")).rejects.toThrow("EASYSQL_KEYRING=0");
		expect(calls).toHaveLength(0);
	});
});
