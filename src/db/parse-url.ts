/**
 * URL parser for connection strings of the form
 *   mysql://user:pass@host:port/db
 *   postgresql://user:pass@host:port/db
 *   sqlite:///absolute/path/to.db
 *
 * Used by `easysql connector add --connection-url ...`. The returned
 * object intentionally OMITS the password once it has been used to
 * connect — credentials are NEVER persisted. SQLite has no credentials:
 * the "URL" is just `sqlite:///<file-path>` (or `sqlite://localhost/<file-path>`
 * for tooling that expects a host); we accept both shapes.
 */

export interface ParsedConnection {
	type: "mysql" | "mariadb" | "postgresql" | "sqlite";
	host: string;
	port: number;
	user: string;
	password: string;
	database: string;
	ssl: boolean;
}

const DEFAULTS: Record<ParsedConnection["type"], { port: number }> = {
	mysql: { port: 3306 },
	mariadb: { port: 3306 },
	postgresql: { port: 5432 },
	sqlite: { port: 0 },
};

function parseSqliteUrl(raw: string): ParsedConnection {
	let file = raw.replace(/^sqlite:\/\//, "");
	if (file.startsWith("localhost/")) {
		file = file.slice("localhost".length);
	}
	if (file.endsWith("/") && file.length > 1) file = file.slice(0, -1);
	if (file.length === 0) {
		throw new Error("SQLite URL must include a file path (e.g. sqlite:///tmp/db.db).");
	}
	return {
		type: "sqlite",
		host: "",
		port: 0,
		user: "",
		password: "",
		database: file,
		ssl: false,
	};
}

export function parseConnectionUrl(raw: string): ParsedConnection {
	if (raw.startsWith("sqlite:")) {
		return parseSqliteUrl(raw);
	}
	const url = new URL(raw);
	const protocol = url.protocol.replace(":", "");
	let type: ParsedConnection["type"];
	switch (protocol) {
		case "mysql":
			type = "mysql";
			break;
		case "mariadb":
			type = "mariadb";
			break;
		case "postgres":
		case "postgresql":
			type = "postgresql";
			break;
		default:
			throw new Error(
				`Unsupported protocol '${protocol}'. Use mysql://, postgresql://, or sqlite:///path/to.db`,
			);
	}

	const host = url.hostname || "127.0.0.1";
	const port = url.port ? Number.parseInt(url.port, 10) : DEFAULTS[type].port;
	const user = decodeURIComponent(url.username || "");
	const password = decodeURIComponent(url.password || "");
	const database = (url.pathname || "/").replace(/^\//, "");
	const ssl =
		url.searchParams.get("sslmode") === "require" || protocol === "mysql"
			? url.searchParams.get("ssl") === "true"
			: false;

	if (!user) throw new Error("Missing database user in connection URL.");
	if (!database) throw new Error("Missing database name in connection URL.");

	return { type, host, port, user, password, database, ssl };
}

export function mergeConnection(
	base: Partial<ParsedConnection>,
	overrides: Partial<ParsedConnection>,
): ParsedConnection {
	const type = overrides.type ?? base.type ?? "mysql";
	if (type === "sqlite") {
		const database = overrides.database ?? base.database;
		if (!database) throw new Error("SQLite file path is required.");
		return {
			type,
			host: "",
			port: 0,
			user: "",
			password: "",
			database,
			ssl: false,
		};
	}
	const port = overrides.port ?? base.port ?? DEFAULTS[type].port;
	const host = overrides.host ?? base.host ?? "127.0.0.1";
	const user = overrides.user ?? base.user;
	const database = overrides.database ?? base.database;
	if (!user) throw new Error("Database user is required.");
	if (!database) throw new Error("Database name is required.");
	return {
		type,
		host,
		port,
		user,
		password: overrides.password ?? base.password ?? "",
		database,
		ssl: overrides.ssl ?? base.ssl ?? false,
	};
}
