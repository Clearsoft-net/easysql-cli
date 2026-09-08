/**
 * Question screen — type a natural-language question, get SQL from the
 * EasySQL API, execute it locally against the active connector, and
 * render the result table inline.
 *
 * Uses ink's `useInput` to build up a buffer; Enter triggers the flow.
 * Errors are surfaced as inline text (no console.log side-effects).
 */

import { Box, Text, useInput } from "ink";
import { useState } from "react";
import {
	findConnectorByName,
	upsertConnector,
} from "../../config/connectors-store.js";
import { executeSelect, type LocalQueryResult } from "../../db/execute.js";
import { appendHistory } from "../../history/store.js";
import { renderResult } from "../../output/table.js";
import { getSavedClient } from "../../sdk/client.js";
import { promptSecret } from "../../util/prompt.js";

type Status = "idle" | "generating" | "executing" | "ok" | "error";

interface Props {
	connector: string;
}

interface QueryResponse {
	id?: string;
	sql?: string;
	sql_generated?: string | null;
	needs_local_execution?: boolean;
}

async function readPasswordInteractive(): Promise<string> {
	const env = process.env.EASYSQL_DB_PASSWORD;
	if (env && env.length > 0) return env;
	const secret = await promptSecret("Database password: ");
	if (!secret) throw new Error("Database password required.");
	return secret;
}

export function QuestionScreen({ connector }: Props) {
	const [buf, setBuf] = useState("");
	const [status, setStatus] = useState<Status>("idle");
	const [sql, setSql] = useState<string | null>(null);
	const [result, setResult] = useState<LocalQueryResult | null>(null);
	const [err, setErr] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	useInput((input, key) => {
		if (busy) return;
		if (key.return) {
			const question = buf.trim();
			if (question.length === 0) return;
			void runFlow();
			return;
		}
		if (key.backspace || key.delete) {
			setBuf((s) => s.slice(0, -1));
			return;
		}
		if (key.ctrl || key.meta) return;
		if (input && !key.escape) {
			setBuf((s) => s + input);
		}
	});

	async function runFlow() {
		const question = buf.trim();
		if (question.length === 0) return;
		const stored = findConnectorByName(connector);
		if (!stored?.id) {
			setErr(`No connector named '${connector}'.`);
			setStatus("error");
			return;
		}
		setBusy(true);
		setErr(null);
		setResult(null);
		setSql(null);
		setBuf("");
		try {
			setStatus("generating");
			const { client } = getSavedClient();
			const createRes = (await client.createQuery({
				connector_id: stored.id,
				question,
			})) as QueryResponse;
			const generated = createRes.sql_generated ?? createRes.sql ?? "";
			setSql(generated);

			setStatus("executing");
			const r = await executeSelect(
				{
					type: stored.type,
					host: stored.host,
					port: stored.port,
					user: stored.user,
					password: stored.type === "sqlite" ? "" : await readPasswordInteractive(),
					database: stored.database,
					ssl: stored.ssl,
				},
				generated,
			);
			setResult(r);
			setStatus("ok");

			upsertConnector({ ...stored, updated_at: new Date().toISOString() });
			try {
				if (createRes.id) {
					await client.answerQuery({ result_data: r.rows }, createRes.id);
				}
			} catch {
				// answer upload is best-effort; the table is already shown
			}
			appendHistory({
				at: new Date().toISOString(),
				question,
				connector: stored.name,
				sql: generated,
				row_count: r.row_count,
				duration_ms: r.duration_ms,
				status: "ok",
			});
		} catch (e) {
			setErr(e instanceof Error ? e.message : String(e));
			setStatus("error");
		} finally {
			setBusy(false);
		}
	}

	return (
		<Box paddingX={1} flexDirection="column" flexGrow={1}>
			<Text bold>Ask a question</Text>
			<Box borderStyle="round" borderColor="green" paddingX={1}>
				<Text color="green">›</Text>
				<Text> {buf.length === 0 ? <Text dimColor>(type, hit Enter)</Text> : buf}</Text>
			</Box>

			<Box marginTop={1} flexDirection="column">
				{status === "generating" && <Text color="cyan">Generating SQL…</Text>}
				{status === "executing" && <Text color="cyan">Executing locally…</Text>}
				{err && <Text color="red">Error: {err}</Text>}
			</Box>

			{sql && (
				<Box marginTop={1} flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
					<Text dimColor>SQL</Text>
					<Text>{sql}</Text>
				</Box>
			)}

			{result && (
				<Box marginTop={1} flexDirection="column">
					<Text dimColor>
						{result.row_count} row(s) in {result.duration_ms}ms
					</Text>
					<Text>{renderResult("table", result.columns, result.rows)}</Text>
				</Box>
			)}
		</Box>
	);
}