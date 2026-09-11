/**
 * Re-introspect a locally-registered connector and push the fresh schema
 * to EasySQL (`POST /v1/connectors/{id}/sync`). Credentials are used in
 * memory only; the password is never persisted.
 */

import { type StoredConnector, upsertConnector } from "../config/connectors-store.js";
import { getSavedClient } from "../sdk/client.js";
import { introspectDatabase, type ParsedConnection } from "./introspect.js";

export interface SyncResult {
	tables?: number;
	last_sync_at?: string;
}

export async function syncLocalConnector(
	stored: StoredConnector,
	password: string,
): Promise<SyncResult> {
	if (!stored.id) {
		throw new Error(
			`Connector '${stored.name}' has no server id — re-add it with \`easysql connector add\`.`,
		);
	}
	const conn: ParsedConnection = {
		type: stored.type,
		host: stored.host,
		port: stored.port,
		user: stored.user,
		password,
		database: stored.database,
		ssl: stored.ssl,
	};
	const schema = await introspectDatabase(conn);
	const { client } = getSavedClient();
	const result = (await client.syncConnector({ schema }, stored.id)) as {
		tables?: Record<string, never>[];
		last_sync_at?: string;
	};
	upsertConnector({ ...stored, updated_at: new Date().toISOString() });
	return { tables: result?.tables?.length, last_sync_at: result?.last_sync_at };
}
