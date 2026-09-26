/**
 * Persisted list of locally-registered connectors — what name maps to which
 * local DB. Stored at $XDG_CONFIG_HOME/easysql/connectors.json with 0600
 * permissions. Holds ONLY non-credential metadata: name, type, host, port,
 * database, user, ssl. The password is NEVER persisted. SQLite connectors
 * have no credentials — only the absolute file path lives in `database`.
 *
 * Entries are scoped per account via `owner` (the email of the EasySQL user
 * that registered them). The registry is shared on disk, so without this a
 * connector id from a previous account would leak into the next one. Entries
 * written before scoping existed carry no `owner` and are adopted by the
 * first account that loads them.
 */

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { getConfigDir } from "./paths.js";
import { loadConfig } from "./store.js";

export interface StoredConnector {
	id?: string;
	name: string;
	type: "mysql" | "mariadb" | "postgresql" | "clickhouse" | "sqlite";
	host: string;
	port: number;
	user: string;
	database: string;
	ssl: boolean;
	updated_at: string;
	/** Email of the EasySQL account that owns this connector. */
	owner?: string;
}

const FILE_NAME = "connectors.json";

function connectorsPath(): string {
	return isAbsolute(FILE_NAME) ? FILE_NAME : resolve(getConfigDir(), FILE_NAME);
}

function chmod0600(path: string): void {
	try {
		chmodSync(path, 0o600);
	} catch {
		// best-effort on Windows
	}
}

function currentUser(): string | undefined {
	const email = loadConfig().user_email;
	return email && email.length > 0 ? email : undefined;
}

function readRaw(): StoredConnector[] {
	const path = connectorsPath();
	if (!existsSync(path)) return [];
	try {
		const parsed = JSON.parse(readFileSync(path, "utf8"));
		return Array.isArray(parsed) ? (parsed as StoredConnector[]) : [];
	} catch {
		return [];
	}
}

/**
 * Reads the full registry, adopting any pre-scoping entry (no `owner`) into
 * the current account so it stops leaking across users. The adoption is
 * persisted once and is best-effort: a failed write must not break reads.
 */
function loadAllConnectors(): StoredConnector[] {
	const all = readRaw();
	const user = currentUser();
	if (!user) return all;
	let changed = false;
	for (const c of all) {
		if (c.owner === undefined) {
			c.owner = user;
			changed = true;
		}
	}
	if (changed) {
		try {
			saveConnectors(all);
		} catch {
			// best-effort migration
		}
	}
	return all;
}

/** Connectors visible to the current account (legacy ones while logged out). */
export function loadConnectors(): StoredConnector[] {
	const user = currentUser();
	const all = loadAllConnectors();
	if (user) return all.filter((c) => c.owner === user);
	return all.filter((c) => c.owner === undefined);
}

export function saveConnectors(list: StoredConnector[]): void {
	const path = connectorsPath();
	const abs = isAbsolute(path) ? path : resolve(path);
	const dir = dirname(abs);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
	writeFileSync(abs, JSON.stringify(list, null, 2), { encoding: "utf8" });
	chmod0600(abs);
}

export function upsertConnector(entry: StoredConnector): void {
	const user = currentUser();
	const scoped: StoredConnector = user ? { ...entry, owner: user } : entry;
	const all = loadAllConnectors();
	const idx = all.findIndex((c) => c.name === entry.name && c.owner === scoped.owner);
	if (idx >= 0) all[idx] = scoped;
	else all.push(scoped);
	saveConnectors(all);
}

export function removeConnector(name: string): boolean {
	const user = currentUser();
	const all = loadAllConnectors();
	const next = all.filter(
		(c) => !(c.name === name && (user ? c.owner === user : c.owner === undefined)),
	);
	if (next.length === all.length) return false;
	saveConnectors(next);
	return true;
}

export function findConnectorByName(name: string): StoredConnector | undefined {
	return loadConnectors().find((c) => c.name === name);
}

export function findConnectorById(id: string): StoredConnector | undefined {
	return loadConnectors().find((c) => c.id === id);
}
