/**
 * Connectors screen — list of locally-registered connectors.
 *
 * List:      j/k or arrows move the selection; Enter activates the
 *            highlighted connector, or opens the add form when the last
 *            row ("+ Add a connector…") is selected; `d`/Del removes the
 *            highlighted connector (with confirmation).
 * Add form:  ↑/↓ move between fields; ←/→ cycle the type / toggle SSL;
 *            printable keys edit the focused field; Enter saves; Esc cancels.
 *            Adding introspects the LOCAL database and pushes only the
 *            schema to the API — the password is used in memory and is
 *            never persisted.
 * Remove:    `y`/Enter confirms; `n`/Esc cancels. Deletes on the server
 *            (best-effort) and from the local store.
 */

import { existsSync } from "node:fs";
import { Box, Text, useInput } from "ink";
import { useState } from "react";
import { ApiError, NotLoggedInError } from "../../cli/errors.js";
import {
	loadConnectors,
	removeConnector,
	type StoredConnector,
	upsertConnector,
} from "../../config/connectors-store.js";
import { introspectDatabase, type ParsedConnection } from "../../db/introspect.js";
import { DEFAULT_PORTS, SUPPORTED_DB_TYPES } from "../../db/schema.js";
import { getSavedClient } from "../../sdk/client.js";
import { ConnectorSync } from "./connector-sync.js";

type DbType = StoredConnector["type"];

interface Props {
	active?: string;
	onSelect: (name: string) => void;
}

function describe(c: StoredConnector): string {
	if (c.type === "sqlite") return `${c.type}@${c.database}`;
	return `${c.type}@${c.host ?? "?"}:${c.port ?? "?"}/${c.database}`;
}

export function ConnectorsScreen({ active, onSelect }: Props) {
	const [list, setList] = useState<StoredConnector[]>(() => loadConnectors());
	const [mode, setMode] = useState<"list" | "add">("list");
	const [removing, setRemoving] = useState<StoredConnector | null>(null);
	const [syncing, setSyncing] = useState<StoredConnector | null>(null);

	const reload = () => setList(loadConnectors());

	if (syncing) {
		return (
			<ConnectorSync
				connector={syncing}
				onExit={() => {
					reload();
					setSyncing(null);
				}}
			/>
		);
	}

	if (removing) {
		return (
			<RemoveConfirm
				connector={removing}
				onCancel={() => setRemoving(null)}
				onDone={() => {
					reload();
					setRemoving(null);
				}}
			/>
		);
	}

	if (mode === "add") {
		return (
			<ConnectorAddForm
				onCancel={() => setMode("list")}
				onDone={() => {
					reload();
					setMode("list");
				}}
			/>
		);
	}

	return (
		<ConnectorList
			list={list}
			active={active}
			onSelect={onSelect}
			onAdd={() => setMode("add")}
			onRemove={setRemoving}
			onSync={setSyncing}
		/>
	);
}

interface ListProps {
	list: StoredConnector[];
	active?: string;
	onSelect: (name: string) => void;
	onAdd: () => void;
	onRemove: (c: StoredConnector) => void;
	onSync: (c: StoredConnector) => void;
}

function ConnectorList({ list, active, onSelect, onAdd, onRemove, onSync }: ListProps) {
	const total = list.length + 1;
	const addIndex = list.length;
	const [cursor, setCursor] = useState(() =>
		Math.max(0, list.findIndex((c) => c.name === active)),
	);

	useInput((input, key) => {
		if (key.downArrow || input === "j") {
			setCursor((c) => (c + 1) % total);
		} else if (key.upArrow || input === "k") {
			setCursor((c) => (c - 1 + total) % total);
		} else if (key.return) {
			if (cursor === addIndex) {
				onAdd();
			} else {
				const picked = list[cursor];
				if (picked) onSelect(picked.name);
			}
		} else if (input === "s" && cursor < addIndex) {
			const picked = list[cursor];
			if (picked) onSync(picked);
		} else if ((input === "d" || key.delete) && cursor < addIndex) {
			const picked = list[cursor];
			if (picked) onRemove(picked);
		}
	});

	return (
		<Box paddingX={1} flexDirection="column">
			<Text bold>Connectors ({list.length})</Text>
			{list.length === 0 && <Text dimColor>No local connectors yet.</Text>}
			{list.map((c, i) => {
				const isActive = c.name === active;
				const isCursor = i === cursor;
				const marker = isCursor ? "▶ " : "  ";
				const label = `${c.name}  ${describe(c)}`;
				return (
					<Text
						key={c.name}
						color={isActive ? "green" : isCursor ? "cyan" : undefined}
						inverse={isCursor}
					>
						{marker}
						{label}
						{isActive ? "  (active)" : ""}
					</Text>
				);
			})}
			<Text
				color={cursor === addIndex ? "cyan" : "green"}
				bold={cursor === addIndex}
				inverse={cursor === addIndex}
			>
				{cursor === addIndex ? "▶ " : "  "}+ Add a connector…
			</Text>
			<Text dimColor>↑/↓ or j/k to move · Enter select · s sync · d remove</Text>
		</Box>
	);
}

// --- add form -------------------------------------------------------------

type FieldId =
	| "name"
	| "type"
	| "file"
	| "host"
	| "port"
	| "user"
	| "password"
	| "database"
	| "ssl";

interface FieldDef {
	id: FieldId;
	label: string;
	secret?: boolean;
}

const TYPES: DbType[] = [...SUPPORTED_DB_TYPES];
const DEFAULT_PORT: Record<DbType, string> = Object.fromEntries(
	Object.entries(DEFAULT_PORTS).map(([type, port]) => [type, String(port)]),
) as Record<DbType, string>;

function fieldsFor(type: DbType): FieldDef[] {
	if (type === "sqlite") {
		return [
			{ id: "name", label: "Name" },
			{ id: "type", label: "Type" },
			{ id: "file", label: "File (absolute path)" },
		];
	}
	return [
		{ id: "name", label: "Name" },
		{ id: "type", label: "Type" },
		{ id: "host", label: "Host" },
		{ id: "port", label: "Port" },
		{ id: "user", label: "User" },
		{ id: "password", label: "Password", secret: true },
		{ id: "database", label: "Database" },
		{ id: "ssl", label: "SSL" },
	];
}

type FormValues = Record<FieldId, string>;

const INITIAL_FORM: FormValues = {
	name: "",
	type: "postgresql",
	file: "",
	host: "127.0.0.1",
	port: "5432",
	user: "",
	password: "",
	database: "",
	ssl: "no",
};

function ConnectorAddForm({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
	const [form, setForm] = useState<FormValues>(INITIAL_FORM);
	const [cursor, setCursor] = useState(0);
	const [busy, setBusy] = useState(false);
	const [status, setStatus] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const fields = fieldsFor(form.type as DbType);

	function update(id: FieldId, value: string): void {
		setForm((f) => ({ ...f, [id]: value }));
	}

	function cycleType(step: number): void {
		const idx = TYPES.indexOf(form.type as DbType);
		const next = TYPES[(idx + step + TYPES.length) % TYPES.length] as DbType;
		setForm((f) => ({ ...f, type: next, port: DEFAULT_PORT[next] }));
	}

	async function submit(): Promise<void> {
		if (busy) return;
		setError(null);
		const name = form.name.trim();
		if (name.length === 0) {
			setError("Connector name is required.");
			return;
		}

		let conn: ParsedConnection;
		if (form.type === "sqlite") {
			const file = form.file.trim();
			if (file.length === 0) {
				setError("SQLite file path is required.");
				return;
			}
			if (!existsSync(file)) {
				setError(`SQLite file not found: ${file}`);
				return;
			}
			conn = {
				type: "sqlite",
				host: "",
				port: 0,
				user: "",
				password: "",
				database: file,
				ssl: false,
			};
		} else {
			const port = Number.parseInt(form.port, 10);
			if (Number.isNaN(port)) {
				setError("Port must be a number.");
				return;
			}
			conn = {
				type: form.type as DbType,
				host: form.host.trim() || "127.0.0.1",
				port,
				user: form.user.trim(),
				password: form.password,
				database: form.database.trim(),
				ssl: form.ssl === "yes",
			};
			if (!conn.user) {
				setError("Database user is required.");
				return;
			}
			if (!conn.database) {
				setError("Database name is required.");
				return;
			}
		}

		setBusy(true);
		try {
			setStatus("Introspecting local schema…");
			const schema = await introspectDatabase(conn);
			setStatus("Registering with EasySQL…");
			const { client } = getSavedClient();
			const result = (await client.createConnector({
				name,
				type: conn.type,
				schema,
			})) as { id?: string; name?: string };
			upsertConnector({
				id: result.id,
				name: result.name ?? name,
				type: conn.type,
				host: conn.host,
				port: conn.port,
				user: conn.user,
				database: conn.database,
				ssl: conn.ssl,
				updated_at: new Date().toISOString(),
			});
			onDone();
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
			setBusy(false);
			setStatus(null);
		}
	}

	useInput((input, key) => {
		if (busy) return;
		if (key.escape) {
			onCancel();
			return;
		}
		if (key.upArrow) {
			setCursor((c) => (c - 1 + fields.length) % fields.length);
			return;
		}
		if (key.downArrow) {
			setCursor((c) => (c + 1) % fields.length);
			return;
		}
		const field = fields[cursor];
		if (!field) return;
		if (key.leftArrow || key.rightArrow) {
			const step = key.leftArrow ? -1 : 1;
			if (field.id === "type") cycleType(step);
			else if (field.id === "ssl") update("ssl", form.ssl === "yes" ? "no" : "yes");
			return;
		}
		if (key.return) {
			void submit();
			return;
		}
		if (key.backspace || key.delete) {
			if (field.id !== "type" && field.id !== "ssl") {
				update(field.id, (form[field.id] ?? "").slice(0, -1));
			}
			return;
		}
		if (key.ctrl || key.meta || key.tab) return;
		if (input && field.id !== "type" && field.id !== "ssl") {
			update(field.id, (form[field.id] ?? "") + input);
		}
	});

	return (
		<Box paddingX={1} flexDirection="column">
			<Text bold color="cyan">
				Add connector
			</Text>
			<Text> </Text>
			{fields.map((field, i) => {
				const isCursor = i === cursor;
				const raw = form[field.id] ?? "";
				const shown = field.secret ? "*".repeat(raw.length) : raw;
		const editable = field.id !== "type" && field.id !== "ssl";
		return (
			<Text key={field.id} color={isCursor ? "cyan" : undefined} bold={isCursor}>
				{isCursor ? "› " : "  "}
				{field.label.padEnd(22)}
				{field.id === "type" ? (
					`< ${raw} >`
				) : field.id === "ssl" ? (
					raw === "yes" ? "[x] required" : "[ ] disabled"
			) : shown.length === 0 ? (
				<>{isCursor ? "▏" : "—"}</>
			) : (
					<>
						{shown}
						{isCursor && editable ? "▏" : ""}
					</>
				)}
			</Text>
		);
			})}
			<Text> </Text>
			{status && <Text color="cyan">{status}</Text>}
			{error && <Text color="red">Error: {error}</Text>}
			<Text dimColor>↑/↓ field · ←/→ type/ssl · Enter save · Esc cancel</Text>
		</Box>
	);
}

// --- remove confirmation --------------------------------------------------

function RemoveConfirm({
	connector,
	onCancel,
	onDone,
}: {
	connector: StoredConnector;
	onCancel: () => void;
	onDone: () => void;
}) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function doRemove(): Promise<void> {
		if (busy) return;
		setBusy(true);
		try {
			if (connector.id) {
				try {
					const { client } = getSavedClient();
					await client.deleteConnector(connector.id);
				} catch (e) {
					if (e instanceof ApiError && e.status === 404) {
						// Already gone server-side — proceed with the local cleanup.
					} else if (e instanceof NotLoggedInError) {
						// Offline / logged out — remove the local copy only.
					} else {
						throw e;
					}
				}
			}
			removeConnector(connector.name);
			onDone();
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
			setBusy(false);
		}
	}

	useInput((input, key) => {
		if (busy) return;
		if (key.escape || input === "n") {
			onCancel();
			return;
		}
		if (input === "y" || key.return) {
			void doRemove();
		}
	});

	return (
		<Box paddingX={1} flexDirection="column">
			<Text bold color="yellow">
				Remove connector
			</Text>
			<Text> </Text>
			<Text>
				Delete <Text bold>{connector.name}</Text> ({describe(connector)})?
			</Text>
			<Text dimColor>It will be deleted from EasySQL and locally.</Text>
			<Text> </Text>
			{error && <Text color="red">Error: {error}</Text>}
			<Text dimColor>y / Enter confirm · n / Esc cancel</Text>
		</Box>
	);
}
