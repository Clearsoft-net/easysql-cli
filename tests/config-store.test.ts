import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getConfigPath, setConfigPathOverride } from "../src/config/paths.js";
import {
	type CliConfig,
	clearConfig,
	isLoggedIn,
	loadConfig,
	saveConfig,
} from "../src/config/store.js";

describe("config store", () => {
	let tmp: string;

	beforeEach(() => {
		tmp = mkdtempSync(join(tmpdir(), "easysql-test-"));
		setConfigPathOverride(join(tmp, "config.json"));
	});

	afterEach(() => {
		setConfigPathOverride(undefined);
		rmSync(tmp, { recursive: true, force: true });
	});

	it("returns empty config when no file exists", () => {
		const cfg = loadConfig();
		expect(cfg.api_key).toBe("");
		expect(cfg.api_url).toBe("");
		expect(isLoggedIn(cfg)).toBe(false);
	});

	it("saves and reloads a config", () => {
		const cfg: CliConfig = {
			api_key: "easysql_sk_test",
			api_url: "https://api.example.com",
			last_login_at: "2026-09-07T00:00:00Z",
		};
		saveConfig(cfg);
		const loaded = loadConfig();
		expect(loaded).toEqual(cfg);
		expect(isLoggedIn(loaded)).toBe(true);
	});

	it("writes the config file with 0600 permissions on POSIX", () => {
		if (process.platform === "win32") return;
		saveConfig({
			api_key: "easysql_sk_test",
			api_url: "https://api.example.com",
			last_login_at: "",
		});
		const stat = statSync(getConfigPath());
		const mode = stat.mode & 0o777;
		expect(mode).toBe(0o600);
	});

	it("clearConfig removes the file", () => {
		saveConfig({
			api_key: "easysql_sk_test",
			api_url: "https://api.example.com",
			last_login_at: "",
		});
		expect(clearConfig()).toBe(true);
		expect(loadConfig().api_key).toBe("");
		expect(clearConfig()).toBe(false);
	});

	it("ignores malformed JSON", () => {
		writeFileSync(getConfigPath(), "{ not json");
		const cfg = loadConfig();
		expect(cfg.api_key).toBe("");
	});

	it("sanitizes wrong types on load", () => {
		writeFileSync(
			getConfigPath(),
			JSON.stringify({ api_key: 42, api_url: null, last_login_at: true }),
		);
		const cfg = loadConfig();
		expect(cfg.api_key).toBe("");
		expect(cfg.api_url).toBe("");
		expect(cfg.last_login_at).toBe("");
	});
});
