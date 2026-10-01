/**
 * Persisted list of locally-registered connections — what name maps to which
 * local DB. Stored at $XDG_CONFIG_HOME/easysql/connections.json with 0600
 * permissions. Holds ONLY non-credential metadata: `uid`, name, type, host,
 * port, database, user, ssl. The password is NEVER persisted. SQLite
 * connections have no credentials — only the absolute file path lives in
 * `database`.
 *
 * Entries are scoped per account via `owner` (the email of the EasySQL user
 * that registered them). The registry is shared on disk, so without this a
 * connection id from a previous account would leak into the next one. Entries
 * written before scoping existed carry no `owner` and are adopted by the
 * first account that loads them.
 */

import { randomUUID } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { getConfigDir } from "./paths.js";
import { loadConfig } from "./store.js";

export interface StoredConnection {
	id?: string;
	/** Stable local identity — the OS keyring account key. Survives a rename. */
	uid: string;
	name: string;
	type: "mysql" | "mariadb" | "postgresql" | "clickhouse" | "sqlite";
	host: string;
	port: number;
	user: string;
	database: string;
	ssl: boolean;
	updated_at: string;
	/** Email of the EasySQL account that owns this connection. */
	owner?: string;
}

/** A connection to persist: `uid` is preserved when present, minted otherwise. */
export type StoredConnectionInput = Omit<StoredConnection, "uid"> & { uid?: string };

const FILE_NAME = "connections.json";

function connectionsPath(): string {
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

function readRaw(): StoredConnection[] {
	const path = connectionsPath();
	if (!existsSync(path)) return [];
	try {
		const parsed = JSON.parse(readFileSync(path, "utf8"));
		return Array.isArray(parsed) ? (parsed as StoredConnection[]) : [];
	} catch {
		return [];
	}
}

/**
 * Reads the full registry, migrating legacy entries in place: pre-scoping
 * entries (no `owner`) are adopted into the current account, and entries
 * written before `uid` existed get one minted. The migration is persisted once
 * and is best-effort: a failed write must not break reads.
 */
function loadAllConnections(): StoredConnection[] {
	const all = readRaw();
	const user = currentUser();
	let changed = false;
	for (const c of all) {
		if (c.owner === undefined && user) {
			c.owner = user;
			changed = true;
		}
		if (!c.uid) {
			c.uid = randomUUID();
			changed = true;
		}
	}
	if (changed) {
		try {
			saveConnections(all);
		} catch {
			// best-effort migration
		}
	}
	return all;
}

/** Connections visible to the current account (legacy ones while logged out). */
export function loadConnections(): StoredConnection[] {
	const user = currentUser();
	const all = loadAllConnections();
	if (user) return all.filter((c) => c.owner === user);
	return all.filter((c) => c.owner === undefined);
}

export function saveConnections(list: StoredConnection[]): void {
	const path = connectionsPath();
	const abs = isAbsolute(path) ? path : resolve(path);
	const dir = dirname(abs);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
	writeFileSync(abs, JSON.stringify(list, null, 2), { encoding: "utf8" });
	chmod0600(abs);
}

export function upsertConnection(entry: StoredConnectionInput): void {
	const user = currentUser();
	const all = loadAllConnections();
	const idx = all.findIndex(
		(c) => c.name === entry.name && (user ? c.owner === user : c.owner === undefined),
	);
	const uid = entry.uid ?? (idx >= 0 ? all[idx]?.uid : undefined) ?? randomUUID();
	const scoped: StoredConnection = user ? { ...entry, uid, owner: user } : { ...entry, uid };
	if (idx >= 0) all[idx] = scoped;
	else all.push(scoped);
	saveConnections(all);
}

export function removeConnection(name: string): boolean {
	const user = currentUser();
	const all = loadAllConnections();
	const next = all.filter(
		(c) => !(c.name === name && (user ? c.owner === user : c.owner === undefined)),
	);
	if (next.length === all.length) return false;
	saveConnections(next);
	return true;
}

export function findConnectionByName(name: string): StoredConnection | undefined {
	return loadConnections().find((c) => c.name === name);
}

export function findConnectionById(id: string): StoredConnection | undefined {
	return loadConnections().find((c) => c.id === id);
}
