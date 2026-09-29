/**
 * Database password resolution chain:
 *
 *   $EASYSQL_DB_PASSWORD  →  OS keyring  →  interactive prompt
 *
 * The env var always wins (CI/scripts), the keyring is the opt-in persisted
 * store (`connector add/sync --save-password`), and the prompt is the
 * fallback — with no keyring entry the behavior is exactly the pre-keyring
 * behavior. SQLite connectors have no password and never reach this chain.
 *
 * Nothing here ever travels to the API: only the schema does.
 */

import { keyringGet, keyringSet } from "../config/keyring.js";
import { t } from "../i18n/messages.js";
import { promptSecret } from "../util/prompt.js";

export type PasswordSource = "env" | "keyring" | "prompt" | "none";

export interface ResolvedPassword {
	password: string;
	source: PasswordSource;
}

export interface PasswordDeps {
	/** Override for the interactive prompt (tests). */
	prompt?: (question: string) => Promise<string | null>;
}

/** env > keyring > prompt. `source: "none"` means nothing was available. */
export async function resolveDbPassword(
	connectorName: string,
	deps: PasswordDeps = {},
): Promise<ResolvedPassword> {
	const env = process.env.EASYSQL_DB_PASSWORD;
	if (env && env.length > 0) return { password: env, source: "env" };
	const stored = await keyringGet(connectorName);
	if (stored && stored.length > 0) return { password: stored, source: "keyring" };
	const prompt = deps.prompt ?? promptSecret;
	const secret = await prompt(`${t().prompts.passwordPrompt}: `);
	if (secret && secret.length > 0) return { password: secret, source: "prompt" };
	return { password: "", source: "none" };
}

/** env > keyring, no prompt — the TUI shows its own inline field instead. */
export async function storedPassword(connectorName: string): Promise<string | null> {
	const env = process.env.EASYSQL_DB_PASSWORD;
	if (env && env.length > 0) return env;
	return keyringGet(connectorName);
}

/** Opt-in persistence into the OS keyring (`--save-password`). */
export async function saveDbPassword(connectorName: string, password: string): Promise<void> {
	await keyringSet(connectorName, password);
}
