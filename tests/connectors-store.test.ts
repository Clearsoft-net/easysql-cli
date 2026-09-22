import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	findConnectorByName,
	loadConnectors,
	removeConnector,
	type StoredConnector,
	upsertConnector,
} from "../src/config/connectors-store.js";
import { setConfigPathOverride } from "../src/config/paths.js";

let tmp: string;
let configPath: string;
let connectorsPath: string;

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

function connector(name: string, owner?: string, id?: string): StoredConnector {
	return {
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

function readRaw(): StoredConnector[] {
	return JSON.parse(readFileSync(connectorsPath, "utf8")) as StoredConnector[];
}

beforeEach(() => {
	tmp = mkdtempSync(join(tmpdir(), "easysql-connectors-store-"));
	configPath = join(tmp, "config.json");
	connectorsPath = join(tmp, "connectors.json");
	setConfigPathOverride(configPath);
});

afterEach(() => {
	setConfigPathOverride(undefined);
	rmSync(tmp, { recursive: true, force: true });
});

describe("connectors-store — per-account scoping", () => {
	it("returns only the current account's connectors", () => {
		writeConfig("a@x.com");
		writeFileSync(
			connectorsPath,
			JSON.stringify([connector("A", "a@x.com"), connector("B", "b@x.com")]),
		);
		expect(loadConnectors().map((c) => c.name)).toEqual(["A"]);

		writeConfig("b@x.com");
		expect(loadConnectors().map((c) => c.name)).toEqual(["B"]);
	});

	it("hides account-owned connectors while logged out", () => {
		writeConfig();
		writeFileSync(connectorsPath, JSON.stringify([connector("A", "a@x.com")]));
		expect(loadConnectors()).toHaveLength(0);
	});

	it("adopts pre-scoping connectors (no owner) into the current account", () => {
		writeConfig("a@x.com");
		writeFileSync(connectorsPath, JSON.stringify([connector("Legacy")]));

		expect(loadConnectors().map((c) => c.name)).toEqual(["Legacy"]);
		expect(readRaw()[0]?.owner).toBe("a@x.com");
	});

	it("upsert stamps the owner and does not clobber another account's connector", () => {
		writeConfig("a@x.com");
		writeFileSync(connectorsPath, JSON.stringify([connector("Shared", "b@x.com", "b-id")]));

		upsertConnector(connector("Shared", undefined, "a-id"));

		expect(readRaw()).toHaveLength(2);
		expect(loadConnectors()).toHaveLength(1);
		expect(findConnectorByName("Shared")?.id).toBe("a-id");
		expect(findConnectorByName("Shared")?.owner).toBe("a@x.com");
	});

	it("remove only deletes the current account's connector", () => {
		writeConfig("a@x.com");
		writeFileSync(
			connectorsPath,
			JSON.stringify([connector("Shared", "a@x.com"), connector("Shared", "b@x.com")]),
		);

		expect(removeConnector("Shared")).toBe(true);
		const raw = readRaw();
		expect(raw).toHaveLength(1);
		expect(raw[0]?.owner).toBe("b@x.com");
	});

	it("returns false when removing a connector that belongs to another account", () => {
		writeConfig("a@x.com");
		writeFileSync(connectorsPath, JSON.stringify([connector("B", "b@x.com")]));
		expect(removeConnector("B")).toBe(false);
		expect(readRaw()).toHaveLength(1);
	});
});
