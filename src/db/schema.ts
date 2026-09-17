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

export interface ConnectorSummary {
	id: string;
	type: DatabaseType | "external";
	name: string;
	created_at?: string;
	updated_at?: string;
}
