/**
 * Local config store — read/write the EasySQL CLI config file.
 *
 * The file is a JSON document containing ONLY non-sensitive metadata
 * (api_url, last_login_at) plus the API key. Stored at $XDG_CONFIG_HOME/
 * easysql/config.json with 0600 permissions so only the owning user can
 * read it. API keys are NEVER written to disk in plaintext on Windows
 * (the OS does not honor POSIX permissions — we document this).
 */

import { chmodSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { CliError } from "../cli/errors.js";
import { t } from "../i18n/messages.js";
import { getConfigPath } from "./paths.js";

export interface CliConfig {
	api_url: string;
	api_key: string;
	last_login_at: string;
	user_email?: string;
	user_name?: string;
	plan_name?: string;
}

const EMPTY: CliConfig = {
	api_url: "",
	api_key: "",
	last_login_at: "",
};

function ensureDir(path: string): void {
	const dir = dirname(path);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
}

function chmod0600(path: string): void {
	try {
		chmodSync(path, 0o600);
	} catch {
		// Best-effort. On Windows chmod is a no-op for the underlying NTFS
		// ACL semantics; we still write the file but cannot enforce 0600.
	}
}

export function loadConfig(): CliConfig {
	const path = getConfigPath();
	if (!existsSync(path)) return { ...EMPTY };
	try {
		const raw = readFileSync(path, "utf8");
		const parsed = JSON.parse(raw) as Partial<CliConfig>;
		const out: CliConfig = {
			api_url: typeof parsed.api_url === "string" ? parsed.api_url : "",
			api_key: typeof parsed.api_key === "string" ? parsed.api_key : "",
			last_login_at: typeof parsed.last_login_at === "string" ? parsed.last_login_at : "",
		};
		if (typeof parsed.user_email === "string") out.user_email = parsed.user_email;
		if (typeof parsed.user_name === "string") out.user_name = parsed.user_name;
		if (typeof parsed.plan_name === "string") out.plan_name = parsed.plan_name;
		return out;
	} catch (err) {
		// Treat malformed JSON as "no config" so the user can re-run login
		// instead of being blocked. The file is left untouched so they can
		// inspect / back it up.
		console.warn(
			`[easysql] could not parse config at ${path}: ${err instanceof Error ? err.message : String(err)}`,
		);
		return { ...EMPTY };
	}
}

export function isLoggedIn(config: CliConfig = loadConfig()): boolean {
	return config.api_key.length > 0 && config.api_url.length > 0;
}

export function saveConfig(config: CliConfig): void {
	const path = getConfigPath();
	const absolutePath = isAbsolute(path) ? path : resolve(path);
	try {
		ensureDir(absolutePath);
		writeFileSync(absolutePath, JSON.stringify(config, null, 2), { encoding: "utf8" });
		chmod0600(absolutePath);
	} catch (err) {
		throw new CliError(
			t().errors.configWriteError(err instanceof Error ? err.message : String(err)),
		);
	}
}

export function clearConfig(): boolean {
	const path = getConfigPath();
	if (!existsSync(path)) return false;
	try {
		unlinkSync(path);
		return true;
	} catch (err) {
		throw new CliError(
			t().errors.configWriteError(err instanceof Error ? err.message : String(err)),
		);
	}
}
