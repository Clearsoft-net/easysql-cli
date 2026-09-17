/**
 * SQLite schema introspection via @easysql/connector-sqlite. Thin wrapper
 * kept so existing imports keep working; new code should use
 * introspectDatabase() from ./introspect.js instead.
 */

import { generateSchema } from "@easysql/schema-generation";
import { loadSqliteModule } from "./load-connector.js";
import type { ConnectorSchema } from "./schema.js";

interface SqliteSpec {
	file: string;
}

export async function introspectSqlite(spec: SqliteSpec): Promise<ConnectorSchema> {
	const { SqliteConnector } = await loadSqliteModule();
	const connector = new SqliteConnector({ file: spec.file });
	connector.connect();
	try {
		return generateSchema(connector.introspect());
	} finally {
		connector.close();
	}
}
