/**
 * Inline "sync connector" runner shared by the Connectors screen and the
 * Question screen (`/sync`). Re-introspects the local DB and pushes the
 * schema to EasySQL. For MySQL/Postgres/ClickHouse it resolves the password
 * via `$EASYSQL_DB_PASSWORD` > OS keyring and asks inline only when both
 * come up empty; SQLite needs none.
 */

import { Box, Text, useInput } from "ink";
import { useEffect, useRef, useState } from "react";
import type { StoredConnector } from "../../config/connectors-store.js";
import { storedPassword } from "../../db/password.js";
import { syncLocalConnector } from "../../db/sync-connector.js";

interface Props {
	connector: StoredConnector;
	title?: string;
	onExit: () => void;
}

export function ConnectorSync({ connector, title = "Sync connector", onExit }: Props) {
	const [needsPassword, setNeedsPassword] = useState(connector.type !== "sqlite");
	const [ready, setReady] = useState(false);
	const [password, setPassword] = useState("");
	const [busy, setBusy] = useState(false);
	const [status, setStatus] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [done, setDone] = useState(false);
	const started = useRef(false);

	async function run(pw: string): Promise<void> {
		setBusy(true);
		setError(null);
		setStatus("Introspecting local schema…");
		try {
			const res = await syncLocalConnector(connector, pw);
			const tables = res.tables;
			setStatus(
				`Synced${tables != null ? ` (${tables} table${tables === 1 ? "" : "s"})` : ""}.`,
			);
			setDone(true);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setBusy(false);
		}
	}

	useEffect(() => {
		if (started.current) return;
		started.current = true;
		void (async () => {
			if (connector.type === "sqlite") {
				await run("");
				setReady(true);
				return;
			}
			const direct = await storedPassword(connector.name);
			if (direct) {
				setNeedsPassword(false);
				await run(direct);
			}
			setReady(true);
		})();
	}, []);

	useInput((input, key) => {
		if (busy) return;
		if (done) {
			if (key.return || key.escape) onExit();
			return;
		}
		if (!ready) {
			if (key.escape) onExit();
			return;
		}
		if (key.escape) {
			onExit();
			return;
		}
		if (!needsPassword) {
			if (key.return) onExit();
			return;
		}
		if (key.return) {
			void run(password);
			return;
		}
		if (key.backspace || key.delete) {
			setPassword((p) => p.slice(0, -1));
			return;
		}
		if (key.ctrl || key.meta || key.tab) return;
		if (input) setPassword((p) => p + input);
	});

	return (
		<Box flexDirection="column" paddingX={1}>
			<Text bold color="cyan">
				{title}: {connector.name}
			</Text>
		{needsPassword && !done && (
			<Text>
				Password:{" "}
				{password.length === 0 ? (
					<>
						{!busy && <Text color="cyan">▏</Text>}
						<Text dimColor>type the password…</Text>
					</>
				) : (
					<>
						{"*".repeat(password.length)}
						{!busy && <Text color="cyan">▏</Text>}
					</>
				)}
			</Text>
		)}
			{status && <Text color="cyan">{status}</Text>}
			{error && <Text color="red">Error: {error}</Text>}
			<Text dimColor>
				{done ? "Enter/Esc to return" : needsPassword ? "Enter sync · Esc cancel" : "Esc cancel"}
			</Text>
		</Box>
	);
}
