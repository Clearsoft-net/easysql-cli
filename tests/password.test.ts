import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { __setTestHooks, type RunResult } from "../src/config/keyring.js";
import { resolveDbPassword, storedPassword } from "../src/db/password.js";

const neverPrompt = async (): Promise<string | null> => {
	throw new Error("prompt must not run");
};

const miss: RunResult = { code: 1, stdout: "", stderr: "" };
const hit = (stdout: string): RunResult => ({ code: 0, stdout, stderr: "" });

let originalEnv: string | undefined;
let originalKeyring: string | undefined;

beforeEach(() => {
	originalEnv = process.env.EASYSQL_DB_PASSWORD;
	originalKeyring = process.env.EASYSQL_KEYRING;
	__setTestHooks({ platform: "linux" });
});

afterEach(() => {
	if (originalEnv === undefined) delete process.env.EASYSQL_DB_PASSWORD;
	else process.env.EASYSQL_DB_PASSWORD = originalEnv;
	if (originalKeyring === undefined) delete process.env.EASYSQL_KEYRING;
	else process.env.EASYSQL_KEYRING = originalKeyring;
	__setTestHooks({ runner: null, platform: null });
});

describe("resolveDbPassword", () => {
	it("prefers $EASYSQL_DB_PASSWORD over everything", async () => {
		process.env.EASYSQL_DB_PASSWORD = "env-pw";
		__setTestHooks({
			platform: "linux",
			runner: async () => {
				throw new Error("keyring must not be consulted");
			},
		});
		const resolved = await resolveDbPassword("prod", { prompt: neverPrompt });
		expect(resolved).toEqual({ password: "env-pw", source: "env" });
	});

	it("falls back to the keyring without prompting", async () => {
		delete process.env.EASYSQL_DB_PASSWORD;
		__setTestHooks({ platform: "linux", runner: async () => hit("ring-pw\n") });
		const resolved = await resolveDbPassword("prod", { prompt: neverPrompt });
		expect(resolved).toEqual({ password: "ring-pw", source: "keyring" });
	});

	it("prompts when env and keyring are empty", async () => {
		delete process.env.EASYSQL_DB_PASSWORD;
		__setTestHooks({ platform: "linux", runner: async () => miss });
		const resolved = await resolveDbPassword("prod", {
			prompt: async (q) => (q.includes("Password") ? "typed-pw" : null),
		});
		expect(resolved).toEqual({ password: "typed-pw", source: "prompt" });
	});

	it("returns source none when nothing is available", async () => {
		delete process.env.EASYSQL_DB_PASSWORD;
		__setTestHooks({ platform: "linux", runner: async () => miss });
		const resolved = await resolveDbPassword("prod", { prompt: async () => null });
		expect(resolved).toEqual({ password: "", source: "none" });
	});
});

describe("storedPassword", () => {
	it("reads the env var first", async () => {
		process.env.EASYSQL_DB_PASSWORD = "env-pw";
		expect(await storedPassword("prod")).toBe("env-pw");
	});

	it("reads the keyring when the env var is absent", async () => {
		delete process.env.EASYSQL_DB_PASSWORD;
		__setTestHooks({ platform: "linux", runner: async () => hit("ring-pw\n") });
		expect(await storedPassword("prod")).toBe("ring-pw");
	});

	it("returns null when neither source has a password", async () => {
		delete process.env.EASYSQL_DB_PASSWORD;
		__setTestHooks({ platform: "linux", runner: async () => miss });
		expect(await storedPassword("prod")).toBeNull();
	});
});
