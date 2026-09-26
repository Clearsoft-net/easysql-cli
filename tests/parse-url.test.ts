import { describe, expect, it } from "bun:test";
import { mergeConnection, parseConnectionUrl } from "../src/db/parse-url.js";

describe("parseConnectionUrl", () => {
	it("parses a standard MySQL URL", () => {
		const c = parseConnectionUrl("mysql://alice:secret@db.example.com:3307/shop");
		expect(c.type).toBe("mysql");
		expect(c.host).toBe("db.example.com");
		expect(c.port).toBe(3307);
		expect(c.user).toBe("alice");
		expect(c.password).toBe("secret");
		expect(c.database).toBe("shop");
	});

	it("parses a postgresql:// URL with default port", () => {
		const c = parseConnectionUrl("postgresql://bob:hunter2@pg.local/analytics");
		expect(c.type).toBe("postgresql");
		expect(c.port).toBe(5432);
		expect(c.user).toBe("bob");
		expect(c.password).toBe("hunter2");
		expect(c.database).toBe("analytics");
	});

	it("parses a clickhouse:// URL with the HTTP default port", () => {
		const c = parseConnectionUrl("clickhouse://default:secret@ch.local/analytics");
		expect(c.type).toBe("clickhouse");
		expect(c.port).toBe(8123);
		expect(c.user).toBe("default");
		expect(c.password).toBe("secret");
		expect(c.database).toBe("analytics");
		expect(c.ssl).toBe(false);
	});

	it("parses a clickhouses:// URL as TLS on the HTTPS port", () => {
		const c = parseConnectionUrl("clickhouses://default:secret@ch.local/db");
		expect(c.type).toBe("clickhouse");
		expect(c.port).toBe(8443);
		expect(c.ssl).toBe(true);
	});

	it("decodes percent-encoded credentials", () => {
		const c = parseConnectionUrl("mysql://user%40dom:p%40ss@db/x");
		expect(c.user).toBe("user@dom");
		expect(c.password).toBe("p@ss");
	});

	it("rejects unsupported protocols", () => {
		expect(() => parseConnectionUrl("mongodb://localhost/db")).toThrow(/Unsupported protocol/);
	});

	it("parses a sqlite:/// URL into the file path", () => {
		const c = parseConnectionUrl("sqlite:///tmp/db.sqlite");
		expect(c.type).toBe("sqlite");
		expect(c.database).toBe("/tmp/db.sqlite");
		expect(c.host).toBe("");
		expect(c.port).toBe(0);
	});

	it("rejects missing user", () => {
		expect(() => parseConnectionUrl("mysql://host/db")).toThrow(/user/i);
	});

	it("rejects missing database", () => {
		expect(() => parseConnectionUrl("mysql://user@host")).toThrow(/database/i);
	});
});

describe("mergeConnection", () => {
	it("overrides individual fields", () => {
		const base = parseConnectionUrl("mysql://alice:secret@db/x");
		const merged = mergeConnection(base, { port: 3307, password: "new" });
		expect(merged.port).toBe(3307);
		expect(merged.password).toBe("new");
	});

	it("uses base defaults when overrides are missing", () => {
		const base = parseConnectionUrl("postgresql://bob:hunter2@pg/analytics");
		const merged = mergeConnection(base, {});
		expect(merged.type).toBe("postgresql");
		expect(merged.host).toBe("pg");
	});

	it("throws when user is missing", () => {
		expect(() => mergeConnection({}, {})).toThrow(/user/i);
	});

	it("throws when database is missing", () => {
		expect(() => mergeConnection({ user: "u" }, {})).toThrow(/database/i);
	});
});
