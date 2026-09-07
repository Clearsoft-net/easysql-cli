/**
 * Schema types — the JSON shape that the EasySQL API accepts on
 * `POST /v1/connectors` and `POST /v1/connectors/:id/sync`.
 *
 * These mirror apps/api/src/db/schema.ts:connectors.schema_cache.
 */

export interface ColumnSchema {
	name: string;
	type: string;
	nullable: boolean;
	primary_key?: boolean;
	default?: string | null;
	foreign_key?: { table: string; column: string } | null;
}

export interface TableSchema {
	name: string;
	columns: ColumnSchema[];
	rows_approx?: number | null;
}

export type ConnectorSchema = TableSchema[];

export type DatabaseType = "mysql" | "mariadb" | "postgresql" | "sqlite";

export interface ConnectorSummary {
	id: string;
	type: DatabaseType | "external";
	name: string;
	created_at?: string;
	updated_at?: string;
}
