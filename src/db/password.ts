/**
 * Database password resolution chain:
 *
 *   $EASYSQL_DB_PASSWORD  →  OS keyring  →  interactive prompt
 *
 * The env var always wins (CI/scripts), the keyring is the opt-in persisted
 * store (`connection add/sync --save-password`), and the prompt is the
 * fallback — with no keyring entry the behavior is exactly the pre-keyring
 * behavior. SQLite connections have no password and never reach this chain.
 *
 * The keyring account is the connection's local `uid`, not its display name, so
 * renaming a connection never orphans the secret. Entries written by older
 * versions live under the name; the first read migrates them to the uid.
 *
 * Nothing here ever travels to the API: only the schema does.
 */

import { keyringDelete, keyringGet, keyringSet } from "../config/keyring.js";
import { t } from "../i18n/messages.js";
import { promptSecret } from "../util/prompt.js";

export type PasswordSource = "env" | "keyring" | "prompt" | "none";

export interface ResolvedPassword {
	password: string;
	source: PasswordSource;
}

/** A connection's keyring identity: `uid` (canonical) + `name` (legacy fallback). */
export interface PasswordTarget {
	uid: string;
	name: string;
}

export interface PasswordDeps {
	/** Override for the interactive prompt (tests). */
	prompt?: (question: string) => Promise<string | null>;
}

/**
 * Looks up the keyring by uid, falling back to a legacy entry stored under the
 * display name — and migrating it to the uid, best-effort.
 */
async function keyringLookup(target: PasswordTarget): Promise<string | null> {
	const current = await keyringGet(target.uid);
	if (current && current.length > 0) return current;
	if (target.name === target.uid) return null;
	const legacy = await keyringGet(target.name);
	if (!legacy || legacy.length === 0) return null;
	try {
		await keyringSet(target.uid, legacy);
		await keyringDelete(target.name);
	} catch {
		// best-effort: still return the legacy value even if the move fails
	}
	return legacy;
}

/** env > keyring > prompt. `source: "none"` means nothing was available. */
export async function resolveDbPassword(
	target: PasswordTarget,
	deps: PasswordDeps = {},
): Promise<ResolvedPassword> {
	const env = process.env.EASYSQL_DB_PASSWORD;
	if (env && env.length > 0) return { password: env, source: "env" };
	const stored = await keyringLookup(target);
	if (stored && stored.length > 0) return { password: stored, source: "keyring" };
	const prompt = deps.prompt ?? promptSecret;
	const secret = await prompt(`${t().prompts.passwordPrompt}: `);
	if (secret && secret.length > 0) return { password: secret, source: "prompt" };
	return { password: "", source: "none" };
}

/** env > keyring, no prompt — the TUI shows its own inline field instead. */
export async function storedPassword(target: PasswordTarget): Promise<string | null> {
	const env = process.env.EASYSQL_DB_PASSWORD;
	if (env && env.length > 0) return env;
	return keyringLookup(target);
}

/** Opt-in persistence into the OS keyring (`--save-password`). */
export async function saveDbPassword(target: PasswordTarget, password: string): Promise<void> {
	await keyringSet(target.uid, password);
	if (target.name !== target.uid) {
		try {
			await keyringDelete(target.name);
		} catch {
			// best-effort cleanup of a leftover legacy entry
		}
	}
}
