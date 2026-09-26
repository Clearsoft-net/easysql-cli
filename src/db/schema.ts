/**
 * Schema types — the JSON shape that the EasySQL API accepts on
 * `POST /v1/connectors` and `POST /v1/connectors/:id/sync`.
 *
 * Re-exported from @easysql/common so the CLI and the SDK share one
 * contract. `ConnectorSchema`/`DatabaseType` are local aliases kept for
 * compatibility with existing imports.
 */

import type { ConnectorEngine, TableSchema } from "@easysql/common";

export type {
	ColumnSchema,
	ConnectorEngine,
	RawColumn,
	RawSchema,
	RawTable,
	SchemaType,
	TableSchema,
} from "@easysql/common";

export type ConnectorSchema = TableSchema[];

export type DatabaseType = ConnectorEngine;

/** Every engine the CLI can register — order matters for the TUI picker. */
export const SUPPORTED_DB_TYPES: readonly DatabaseType[] = [
	"postgresql",
	"mysql",
	"mariadb",
	"clickhouse",
	"sqlite",
];

/** Native default port per engine (`0` for file-based SQLite). */
export const DEFAULT_PORTS: Record<DatabaseType, number> = {
	mysql: 3306,
	mariadb: 3306,
	postgresql: 5432,
	clickhouse: 8123,
	sqlite: 0,
};

/** Human-readable list for prompts and error messages. */
export const DB_TYPE_LIST = SUPPORTED_DB_TYPES.join(" | ");

export interface ConnectorSummary {
	id: string;
	type: DatabaseType | "external";
	name: string;
	created_at?: string;
	updated_at?: string;
}
