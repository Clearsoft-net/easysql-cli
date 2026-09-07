/**
 * Filesystem paths for CLI state — XDG-aware on Linux/macOS, falls back to
 * %APPDATA% on Windows. Honors --config override via getConfigPath().
 *
 *   config dir:   $XDG_CONFIG_HOME/easysql        (default ~/.config/easysql)
 *   history file: $XDG_DATA_HOME/easysql/history.jsonl
 */

import { homedir, platform } from "node:os";
import { join } from "node:path";

let overrideConfigPath: string | undefined;

export function setConfigPathOverride(path: string | undefined): void {
	overrideConfigPath = path;
}

function xdgHome(envVar: string, fallback: string): string {
	const v = process.env[envVar];
	if (v && v.length > 0) return v;
	return join(homedir(), fallback);
}

/**
 * Returns the OS-appropriate config directory for EasySQL.
 *
 *   Linux/macOS: $XDG_CONFIG_HOME/easysql or ~/.config/easysql
 *   Windows:     %APPDATA%/easysql
 */
export function getConfigDir(): string {
	if (overrideConfigPath) return join(overrideConfigPath, "..");
	const isWin = platform() === "win32";
	if (isWin) {
		const appData = process.env.APPDATA ?? join(homedir(), "AppData", "Roaming");
		return join(appData, "easysql");
	}
	return join(xdgHome("XDG_CONFIG_HOME", ".config"), "easysql");
}

/**
 * Returns the path of the config file. Honors the --config override when set.
 */
export function getConfigPath(): string {
	if (overrideConfigPath) return overrideConfigPath;
	return join(getConfigDir(), "config.json");
}

/**
 * Returns the directory where local data (history, etc.) is stored.
 */
export function getDataDir(): string {
	const isWin = platform() === "win32";
	if (isWin) {
		const localAppData = process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local");
		return join(localAppData, "easysql");
	}
	return join(xdgHome("XDG_DATA_HOME", ".local/share"), "easysql");
}

export function getHistoryPath(): string {
	return join(getDataDir(), "history.jsonl");
}
