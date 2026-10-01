/**
 * Connections screen — list of locally-registered connections.
 *
 * List:      j/k or arrows move the selection; Enter activates the
 *            highlighted connection, or opens the add form when the last
 *            row ("+ Add a connection…") is selected; `e` edits the highlighted
 *            connection, `s` re-syncs it, `d`/Del removes it (confirmation).
 * Add/edit:  ↑/↓ move between fields; ←/→ cycle the type / toggle the SSL
 *            and "remember password" switches; printable keys edit the
 *            focused field; Enter saves; Esc cancels. Both paths introspect
 *            the LOCAL database and push only the schema to the API.
 *            "Remember password" (on by default) persists the password in the
 *            OS keyring, keyed by the connection's local uid — it is never
 *            written to `connections.json` and never leaves the host. Editing
 *            keeps the
 *            name and type fixed (they are the API identity) and re-syncs the
 *            schema; an empty password reuses the stored one.
 * Remove:    `y`/Enter confirms; `n`/Esc cancels. Deletes on the server
 *            (best-effort) and from the local store.
 */

import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { Box, Text, useInput } from "ink";
import { type ReactNode, useState } from "react";
import { ApiError, NotLoggedInError } from "../../cli/errors.js";
import {
	loadConnections,
	removeConnection,
	type StoredConnection,
	upsertConnection,
} from "../../config/connections-store.js";
import { introspectDatabase, type ParsedConnection } from "../../db/introspect.js";
import { keyringDelete } from "../../config/keyring.js";
import { type PasswordTarget, saveDbPassword, storedPassword } from "../../db/password.js";
import { syncLocalConnection } from "../../db/sync-connection.js";
import { DEFAULT_PORTS, SUPPORTED_DB_TYPES } from "../../db/schema.js";
import { getSavedClient } from "../../sdk/client.js";
import { ConnectionSync } from "./connection-sync.js";

type DbType = StoredConnection["type"];

interface Props {
	active?: string;
	onSelect: (name: string) => void;
}

function describe(c: StoredConnection): string {
	if (c.type === "sqlite") return `${c.type}@${c.database}`;
	return `${c.type}@${c.host ?? "?"}:${c.port ?? "?"}/${c.database}`;
}

export function ConnectionsScreen({ active, onSelect }: Props) {
	const [list, setList] = useState<StoredConnection[]>(() => loadConnections());
	const [mode, setMode] = useState<"list" | "add">("list");
	const [editing, setEditing] = useState<StoredConnection | null>(null);
	const [removing, setRemoving] = useState<StoredConnection | null>(null);
	const [syncing, setSyncing] = useState<StoredConnection | null>(null);
	const [notice, setNotice] = useState<string | null>(null);

	const reload = () => setList(loadConnections());

	if (syncing) {
		return (
			<ConnectionSync
				connection={syncing}
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
				connection={removing}
				onCancel={() => setRemoving(null)}
				onDone={() => {
					reload();
					setRemoving(null);
				}}
			/>
		);
	}

	const finish = (next: "add" | "list") => (notice?: string) => {
		reload();
		setNotice(notice ?? null);
		if (next === "add") setMode("list");
		else setEditing(null);
	};

	if (editing) {
		return (
			<ConnectionForm
				mode="edit"
				existing={editing}
				existingNames={list.map((c) => c.name)}
				onCancel={() => setEditing(null)}
				onDone={finish("list")}
			/>
		);
	}

	if (mode === "add") {
		return (
			<ConnectionForm
				mode="add"
				existingNames={list.map((c) => c.name)}
				onCancel={() => setMode("list")}
				onDone={finish("add")}
			/>
		);
	}

	return (
		<ConnectionList
			list={list}
			active={active}
			notice={notice}
			onSelect={onSelect}
			onAdd={() => setMode("add")}
			onEdit={setEditing}
			onRemove={setRemoving}
			onSync={setSyncing}
		/>
	);
}

interface ListProps {
	list: StoredConnection[];
	active?: string;
	notice?: string | null;
	onSelect: (name: string) => void;
	onAdd: () => void;
	onEdit: (c: StoredConnection) => void;
	onRemove: (c: StoredConnection) => void;
	onSync: (c: StoredConnection) => void;
}

function ConnectionList({
	list,
	active,
	notice,
	onSelect,
	onAdd,
	onEdit,
	onRemove,
	onSync,
}: ListProps) {
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
		} else if (input === "e" && cursor < addIndex) {
			const picked = list[cursor];
			if (picked) onEdit(picked);
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
			<Text bold>Connections ({list.length})</Text>
			{notice && <Text color="yellow">{notice}</Text>}
			{list.length === 0 && <Text dimColor>No local connections yet.</Text>}
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
				{cursor === addIndex ? "▶ " : "  "}+ Add a connection…
			</Text>
			<Text dimColor>
				↑/↓ or j/k to move · Enter select · e edit · s sync · d remove
			</Text>
		</Box>
	);
}

// --- add / edit form ------------------------------------------------------

type FieldId =
	| "name"
	| "type"
	| "file"
	| "host"
	| "port"
	| "user"
	| "password"
	| "database"
	| "ssl"
	| "remember";

interface FieldDef {
	id: FieldId;
	label: string;
	secret?: boolean;
}

const TYPES: DbType[] = [...SUPPORTED_DB_TYPES];
const DEFAULT_PORT: Record<DbType, string> = Object.fromEntries(
	Object.entries(DEFAULT_PORTS).map(([type, port]) => [type, String(port)]),
) as Record<DbType, string>;

/** Switch fields — cycled with ←/→ instead of typed into. */
const SWITCHES: FieldId[] = ["type", "ssl", "remember"];

function isSwitch(id: FieldId): boolean {
	return SWITCHES.includes(id);
}

/** Name and type are the API identity — immutable once registered. */
function isLocked(id: FieldId, mode: "add" | "edit"): boolean {
	return mode === "edit" && (id === "name" || id === "type");
}

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
		{ id: "remember", label: "Remember password" },
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
	remember: "yes",
	database: "",
	ssl: "no",
};

/** Prefills the form from a registered connection (edit mode). */
function formFrom(c: StoredConnection): FormValues {
	return {
		...INITIAL_FORM,
		name: c.name,
		type: c.type,
		file: c.type === "sqlite" ? c.database : "",
		host: c.host || "127.0.0.1",
		port: String(c.port || DEFAULT_PORT[c.type]),
		user: c.user,
		database: c.type === "sqlite" ? "" : c.database,
		ssl: c.ssl ? "yes" : "no",
	};
}

interface FormProps {
	mode: "add" | "edit";
	existing?: StoredConnection;
	/** Names already in use — a duplicate is rejected (name is the identity). */
	existingNames: string[];
	onCancel: () => void;
	onDone: (notice?: string) => void;
}

function ConnectionForm({ mode, existing, existingNames, onCancel, onDone }: FormProps) {
	const editing = mode === "edit";
	const [form, setForm] = useState<FormValues>(() =>
		existing ? formFrom(existing) : INITIAL_FORM,
	);
	const [cursor, setCursor] = useState(0);
	const [busy, setBusy] = useState(false);
	const [status, setStatus] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	const fields = fieldsFor(form.type as DbType);

	// `name` is the identity in connections.json — a duplicate would silently
	// overwrite the existing entry, so block it.
	const trimmedName = form.name.trim();
	const duplicate =
		!editing && trimmedName.length > 0 && existingNames.includes(trimmedName);
	const duplicateMessage = `A connection named '${trimmedName}' already exists.`;

	/** Keyring persistence for the "Remember password" switch — never fatal. */
	async function applyPasswordChoice(
		target: PasswordTarget,
		password: string,
	): Promise<string | undefined> {
		if (form.type === "sqlite") return undefined;
		if (form.remember !== "yes") {
			await keyringDelete(target.uid);
			if (target.name !== target.uid) await keyringDelete(target.name);
			return undefined;
		}
		if (!password) return undefined;
		try {
			await saveDbPassword(target, password);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			return `Connection saved, but the password was not stored: ${msg}`;
		}
		return undefined;
	}

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
		const name = editing ? (existing?.name ?? "") : form.name.trim();
		if (name.length === 0) {
			setError("Connection name is required.");
			return;
		}
		if (duplicate) {
			setError(duplicateMessage);
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
			if (editing && existing) {
				// An empty password reuses whatever the keyring already holds.
				const password = form.password || (await storedPassword(existing)) || "";
				const updated: StoredConnection = {
					...existing,
					type: conn.type,
					host: conn.host,
					port: conn.port,
					user: conn.user,
					database: conn.database,
					ssl: conn.ssl,
					updated_at: new Date().toISOString(),
				};
				setStatus("Introspecting local schema…");
				await syncLocalConnection(updated, password);
				onDone(await applyPasswordChoice(existing, form.password || password));
				return;
			}

			setStatus("Introspecting local schema…");
			const schema = await introspectDatabase(conn);
			setStatus("Registering with EasySQL…");
			const { client } = getSavedClient();
			const result = (await client.createConnection({
				name,
				type: conn.type,
				schema,
			})) as { id?: string; name?: string };
			const finalName = result.name ?? name;
			const uid = randomUUID();
			upsertConnection({
				uid,
				id: result.id,
				name: finalName,
				type: conn.type,
				host: conn.host,
				port: conn.port,
				user: conn.user,
				database: conn.database,
				ssl: conn.ssl,
				updated_at: new Date().toISOString(),
			});
			onDone(await applyPasswordChoice({ uid, name: finalName }, conn.password));
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
		const locked = isLocked(field.id, mode);
		if (key.leftArrow || key.rightArrow) {
			const step = key.leftArrow ? -1 : 1;
			if (locked) return;
			if (field.id === "type") cycleType(step);
			else if (field.id === "ssl") update("ssl", form.ssl === "yes" ? "no" : "yes");
			else if (field.id === "remember") {
				update("remember", form.remember === "yes" ? "no" : "yes");
			}
			return;
		}
		if (key.return) {
			void submit();
			return;
		}
		if (key.backspace || key.delete) {
			if (!locked && !isSwitch(field.id)) {
				update(field.id, (form[field.id] ?? "").slice(0, -1));
			}
			return;
		}
		if (key.ctrl || key.meta || key.tab) return;
		if (input && !locked && !isSwitch(field.id)) {
			update(field.id, (form[field.id] ?? "") + input);
		}
	});

	return (
		<Box paddingX={1} flexDirection="column">
			<Text bold color="cyan">
				{editing ? "Edit connection" : "Add connection"}
			</Text>
			<Text> </Text>
			{fields.map((field, i) => {
				const isCursor = i === cursor;
				const raw = form[field.id] ?? "";
				const shown = field.secret ? "*".repeat(raw.length) : raw;
				const locked = isLocked(field.id, mode);
				const typeable = !isSwitch(field.id) && !locked;
				let value: ReactNode;
				if (field.id === "type") value = `< ${raw} >`;
				else if (field.id === "ssl") value = raw === "yes" ? "[x] required" : "[ ] disabled";
				else if (field.id === "remember") {
					value = raw === "yes" ? "[x] saved in the OS keyring" : "[ ] do not save";
				} else if (locked) value = raw;
				else if (shown.length === 0) value = <>{isCursor ? "▏" : "—"}</>;
				else
					value = (
						<>
							{shown}
							{isCursor && typeable ? "▏" : ""}
						</>
					);
				return (
					<Text key={field.id} color={isCursor ? "cyan" : undefined} bold={isCursor}>
						{isCursor ? "› " : "  "}
						{field.label.padEnd(22)}
						{value}
					</Text>
				);
			})}
			<Text> </Text>
			{editing && form.type !== "sqlite" && (
				<Text dimColor>Leave Password empty to keep the stored one.</Text>
			)}
			{duplicate && <Text color="yellow">Warning: {duplicateMessage}</Text>}
			{status && <Text color="cyan">{status}</Text>}
			{error && <Text color="red">Error: {error}</Text>}
			<Text dimColor>↑/↓ field · ←/→ switch · Enter save · Esc cancel</Text>
		</Box>
	);
}

// --- remove confirmation --------------------------------------------------

function RemoveConfirm({
	connection,
	onCancel,
	onDone,
}: {
	connection: StoredConnection;
	onCancel: () => void;
	onDone: () => void;
}) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function doRemove(): Promise<void> {
		if (busy) return;
		setBusy(true);
		try {
			if (connection.id) {
				try {
					const { client } = getSavedClient();
					await client.deleteConnection(connection.id);
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
			removeConnection(connection.name);
			await keyringDelete(connection.uid);
			if (connection.name !== connection.uid) await keyringDelete(connection.name);
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
				Remove connection
			</Text>
			<Text> </Text>
			<Text>
				Delete <Text bold>{connection.name}</Text> ({describe(connection)})?
			</Text>
			<Text dimColor>It will be deleted from EasySQL and locally.</Text>
			<Text> </Text>
			{error && <Text color="red">Error: {error}</Text>}
			<Text dimColor>y / Enter confirm · n / Esc cancel</Text>
		</Box>
	);
}
