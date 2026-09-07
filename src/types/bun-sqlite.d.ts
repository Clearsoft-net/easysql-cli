/**
 * Ambient type declarations for Bun's built-in modules. The runtime is
 * guaranteed to provide these (the package's `engines` field requires
 * Bun >= 1.1), but TypeScript itself has no `@types/bun` installed, so
 * we declare the minimum surface we use directly.
 */

declare module "bun:sqlite" {
	export interface SqliteQueryOptions {
		prepare?: unknown;
		execute?: unknown;
	}

	export interface Query<ValueType = unknown, ParamsType extends unknown[] = unknown[]> {
		all(...params: ParamsType): ValueType[];
		get(...params: ParamsType): ValueType | undefined;
		run(...params: ParamsType): { changes: number; lastInsertRowid: number | bigint };
		values(...params: ParamsType): unknown[][];
		raw(...params: ParamsType): unknown[][];
	}

	export interface DatabaseOptions {
		readonly?: boolean;
		create?: boolean;
		readwrite?: boolean;
	}

	export class Database {
		constructor(filename: string, options?: DatabaseOptions);
		query<ValueType = unknown, ParamsType extends unknown[] = unknown[]>(
			sql: string,
		): Query<ValueType, ParamsType>;
		prepare<ValueType = unknown, ParamsType extends unknown[] = unknown[]>(
			sql: string,
		): Statement<ValueType, ParamsType>;
		run(
			sql: string,
			...params: unknown[]
		): { changes: number; lastInsertRowid: number | bigint };
		exec(sql: string): void;
		close(): void;
	}

	export interface Statement<ValueType = unknown, ParamsType extends unknown[] = unknown[]> {
		all(...params: ParamsType): ValueType[];
		get(...params: ParamsType): ValueType | undefined;
		run(...params: ParamsType): { changes: number; lastInsertRowid: number | bigint };
		values(...params: ParamsType): unknown[][];
	}

	const _default: { Database: typeof Database };
	export default _default;
}
