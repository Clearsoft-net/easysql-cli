import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	findConnectionByName,
	loadConnections,
	removeConnection,
	type StoredConnection,
	upsertConnection,
} from "../src/config/connections-store.js";
import { setConfigPathOverride } from "../src/config/paths.js";

let tmp: string;
let configPath: string;
let connectionsPath: string;

function writeConfig(email?: string): void {
	writeFileSync(
		configPath,
		JSON.stringify({
			api_url: "https://api.example.com",
			api_key: "easysql_sk_test",
			last_login_at: "2026-09-07T00:00:00Z",
			...(email ? { user_email: email } : {}),
		}),
	);
}

function connection(name: string, owner?: string, id?: string): StoredConnection {
	return {
		uid: `uid-${name}`,
		name,
		type: "sqlite",
		host: "",
		port: 0,
		user: "",
		database: "/tmp/x.db",
		ssl: false,
		updated_at: "2026-09-07T00:00:00Z",
		...(owner ? { owner } : {}),
		...(id ? { id } : {}),
	};
}

function readRaw(): StoredConnection[] {
	return JSON.parse(readFileSync(connectionsPath, "utf8")) as StoredConnection[];
}

beforeEach(() => {
	tmp = mkdtempSync(join(tmpdir(), "easysql-connections-store-"));
	configPath = join(tmp, "config.json");
	connectionsPath = join(tmp, "connections.json");
	setConfigPathOverride(configPath);
});

afterEach(() => {
	setConfigPathOverride(undefined);
	rmSync(tmp, { recursive: true, force: true });
});

describe("connections-store — per-account scoping", () => {
	it("returns only the current account's connections", () => {
		writeConfig("a@x.com");
		writeFileSync(
			connectionsPath,
			JSON.stringify([connection("A", "a@x.com"), connection("B", "b@x.com")]),
		);
		expect(loadConnections().map((c) => c.name)).toEqual(["A"]);

		writeConfig("b@x.com");
		expect(loadConnections().map((c) => c.name)).toEqual(["B"]);
	});

	it("hides account-owned connections while logged out", () => {
		writeConfig();
		writeFileSync(connectionsPath, JSON.stringify([connection("A", "a@x.com")]));
		expect(loadConnections()).toHaveLength(0);
	});

	it("adopts pre-scoping connections (no owner) into the current account", () => {
		writeConfig("a@x.com");
		writeFileSync(connectionsPath, JSON.stringify([connection("Legacy")]));

		expect(loadConnections().map((c) => c.name)).toEqual(["Legacy"]);
		expect(readRaw()[0]?.owner).toBe("a@x.com");
	});

	it("mints a uid for legacy entries (no uid) and persists it", () => {
		writeConfig("a@x.com");
		writeFileSync(
			connectionsPath,
			JSON.stringify([
				{
					name: "Legacy",
					type: "sqlite",
					host: "",
					port: 0,
					user: "",
					database: "/tmp/x.db",
					ssl: false,
					updated_at: "2026-09-07T00:00:00Z",
					owner: "a@x.com",
				},
			]),
		);
		const first = loadConnections()[0];
		expect(first?.uid).toBeTruthy();
		expect(readRaw()[0]?.uid).toBe(first?.uid);
	});

	it("keeps the uid stable across upserts", () => {
		writeConfig("a@x.com");
		const base = {
			name: "A",
			type: "sqlite" as const,
			host: "",
			port: 0,
			user: "",
			database: "/tmp/x.db",
			ssl: false,
			updated_at: "2026-09-07T00:00:00Z",
		};
		upsertConnection(base);
		const uid = findConnectionByName("A")?.uid;
		expect(uid).toBeTruthy();
		upsertConnection({ ...base, host: "changed" });
		expect(findConnectionByName("A")?.uid).toBe(uid);
	});

	it("upsert stamps the owner and does not clobber another account's connection", () => {
		writeConfig("a@x.com");
		writeFileSync(connectionsPath, JSON.stringify([connection("Shared", "b@x.com", "b-id")]));

		upsertConnection(connection("Shared", undefined, "a-id"));

		expect(readRaw()).toHaveLength(2);
		expect(loadConnections()).toHaveLength(1);
		expect(findConnectionByName("Shared")?.id).toBe("a-id");
		expect(findConnectionByName("Shared")?.owner).toBe("a@x.com");
	});

	it("remove only deletes the current account's connection", () => {
		writeConfig("a@x.com");
		writeFileSync(
			connectionsPath,
			JSON.stringify([connection("Shared", "a@x.com"), connection("Shared", "b@x.com")]),
		);

		expect(removeConnection("Shared")).toBe(true);
		const raw = readRaw();
		expect(raw).toHaveLength(1);
		expect(raw[0]?.owner).toBe("b@x.com");
	});

	it("returns false when removing a connection that belongs to another account", () => {
		writeConfig("a@x.com");
		writeFileSync(connectionsPath, JSON.stringify([connection("B", "b@x.com")]));
		expect(removeConnection("B")).toBe(false);
		expect(readRaw()).toHaveLength(1);
	});
});
