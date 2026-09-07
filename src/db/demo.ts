/**
 * Demo SQLite database — generates a small fictional sample database
 * (3-4 tables) using Bun's built-in bun:sqlite module. Idempotent: the
 * existing file is removed before regeneration so a re-run resets the
 * data deterministically. Intended for `easysql demo`, which registers
 * the resulting file as a local connector named `local-demo`.
 *
 * The schema is designed to look like a small e-commerce / product
 * catalog so the natural-language queries feel realistic.
 */

import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";

export const DEMO_CONNECTOR_NAME = "local-demo";

export interface DemoOptions {
	file: string;
}

export interface DemoResult {
	file: string;
	tables: string[];
}

/**
 * Build a fresh demo SQLite database at `file`. Any existing file is
 * removed first so the data is deterministic across re-runs. The parent
 * directory is created with 0700 permissions if it doesn't exist.
 */
export function buildDemoDatabase(opts: DemoOptions): DemoResult {
	const file = opts.file;
	const dir = dirname(file);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
	if (existsSync(file)) rmSync(file);

	const db = new Database(file);
	try {
		db.exec(`
			PRAGMA foreign_keys = ON;

			CREATE TABLE customers (
				id INTEGER PRIMARY KEY,
				email TEXT NOT NULL UNIQUE,
				full_name TEXT NOT NULL,
				signup_date TEXT NOT NULL,
				country TEXT NOT NULL
			);

			CREATE TABLE products (
				id INTEGER PRIMARY KEY,
				sku TEXT NOT NULL UNIQUE,
				name TEXT NOT NULL,
				category TEXT NOT NULL,
				price_cents INTEGER NOT NULL,
				stock INTEGER NOT NULL DEFAULT 0
			);

			CREATE TABLE orders (
				id INTEGER PRIMARY KEY,
				customer_id INTEGER NOT NULL REFERENCES customers(id),
				placed_at TEXT NOT NULL,
				status TEXT NOT NULL CHECK (status IN ('placed','shipped','delivered','returned','cancelled')),
				total_cents INTEGER NOT NULL
			);

			CREATE TABLE order_items (
				id INTEGER PRIMARY KEY,
				order_id INTEGER NOT NULL REFERENCES orders(id),
				product_id INTEGER NOT NULL REFERENCES products(id),
				quantity INTEGER NOT NULL CHECK (quantity > 0),
				unit_price_cents INTEGER NOT NULL
			);
		`);

		const insertCustomer = db.prepare(
			"INSERT INTO customers (id, email, full_name, signup_date, country) VALUES (?, ?, ?, ?, ?)",
		);
		const insertProduct = db.prepare(
			"INSERT INTO products (id, sku, name, category, price_cents, stock) VALUES (?, ?, ?, ?, ?, ?)",
		);
		const insertOrder = db.prepare(
			"INSERT INTO orders (id, customer_id, placed_at, status, total_cents) VALUES (?, ?, ?, ?, ?)",
		);
		const insertItem = db.prepare(
			"INSERT INTO order_items (id, order_id, product_id, quantity, unit_price_cents) VALUES (?, ?, ?, ?, ?)",
		);

		const customers: Array<[number, string, string, string, string]> = [
			[1, "alice@example.com", "Alice Martins", "2026-01-12", "BR"],
			[2, "bob@example.com", "Bob Tanaka", "2026-02-03", "JP"],
			[3, "carol@example.com", "Carol Silva", "2026-02-19", "BR"],
			[4, "diana@example.com", "Diana Costa", "2026-03-07", "PT"],
			[5, "ethan@example.com", "Ethan Brown", "2026-04-22", "US"],
		];
		for (const row of customers) insertCustomer.run(...row);

		const products: Array<[number, string, string, string, number, number]> = [
			[1, "EAS-001", "Mechanical keyboard", "electronics", 18900, 42],
			[2, "EAS-002", "Wireless mouse", "electronics", 7900, 120],
			[3, "EAS-003", '27" monitor', "electronics", 219900, 15],
			[4, "BOK-101", "The Pragmatic Programmer", "books", 4900, 80],
			[5, "BOK-102", "Designing Data-Intensive Apps", "books", 6900, 60],
			[6, "HOM-201", "Ceramic mug", "home", 1900, 200],
		];
		for (const row of products) insertProduct.run(...row);

		const orders: Array<[number, number, string, string, number]> = [
			[1, 1, "2026-05-01 10:14", "delivered", 26800],
			[2, 1, "2026-05-18 16:02", "shipped", 18900],
			[3, 2, "2026-05-20 09:30", "delivered", 11800],
			[4, 3, "2026-05-21 13:45", "delivered", 4900],
			[5, 4, "2026-05-23 11:11", "placed", 226800],
			[6, 5, "2026-05-24 18:05", "placed", 3800],
			[7, 2, "2026-05-25 12:00", "cancelled", 7900],
		];
		for (const row of orders) insertOrder.run(...row);

		const items: Array<[number, number, number, number, number]> = [
			[1, 1, 1, 1, 18900],
			[2, 1, 6, 4, 1900],
			[3, 2, 1, 1, 18900],
			[4, 3, 2, 1, 7900],
			[5, 3, 4, 1, 4900],
			[6, 4, 4, 1, 4900],
			[7, 5, 3, 1, 219900],
			[8, 5, 2, 1, 7900],
			[9, 6, 6, 2, 1900],
			[10, 7, 2, 1, 7900],
		];
		for (const row of items) insertItem.run(...row);
	} finally {
		db.close();
	}

	return {
		file,
		tables: ["customers", "order_items", "orders", "products"],
	};
}
