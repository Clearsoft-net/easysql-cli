/**
 * Persisted list of locally-registered connectors — what name maps to which
 * local DB. Stored at $XDG_CONFIG_HOME/easysql/connectors.json with 0600
 * permissions. Holds ONLY non-credential metadata: name, type, host, port,
 * database, user, ssl. The password is NEVER persisted. SQLite connectors
 * have no credentials — only the absolute file path lives in `database`.
 */

import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { getConfigDir } from "./paths.js";

export interface StoredConnector {
	id?: string;
	name: string;
	type: "mysql" | "mariadb" | "postgresql" | "sqlite";
	host: string;
	port: number;
	user: string;
	database: string;
	ssl: boolean;
	updated_at: string;
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

export function loadConnectors(): StoredConnector[] {
	const path = connectorsPath();
	if (!existsSync(path)) return [];
	try {
		const raw = readFileSync(path, "utf8");
		const parsed = JSON.parse(raw);
		if (Array.isArray(parsed)) return parsed as StoredConnector[];
		return [];
	} catch {
		return [];
	}
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
	const list = loadConnectors();
	const idx = list.findIndex((c) => c.name === entry.name);
	if (idx >= 0) list[idx] = entry;
	else list.push(entry);
	saveConnectors(list);
}

export function findConnectorByName(name: string): StoredConnector | undefined {
	return loadConnectors().find((c) => c.name === name);
}

export function findConnectorById(id: string): StoredConnector | undefined {
	return loadConnectors().find((c) => c.id === id);
}
