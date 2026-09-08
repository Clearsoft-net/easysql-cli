/**
 * Question screen — type a natural-language question, get SQL from the
 * EasySQL API, execute it locally against the active connector, and
 * render the result table inline.
 *
 * The input box accepts free text. Typing `/` switches the input into
 * slash-command mode: a prompt appears below the box with `/` already
 * typed, and subsequent characters are interpreted as a command. Enter
 * runs the command; Esc or backspacing the `/` returns to question mode.
 *
 * Slash commands recognised here:
 *   /help             — open the help overlay (App-level)
 *   /quit             — quit the TUI
 *   /connectors       — switch to Connectors
 *   /history          — switch to History
 *   /question         — switch to Question (no-op)
 *   /clear            — clear the buffer + result panel
 *   /<anything-else>  — unknown command, stays in slash mode with a hint
 *
 * Errors are surfaced as inline text (no console.log side-effects).
 */

import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import {
	findConnectorByName,
	upsertConnector,
} from "../../config/connectors-store.js";
import { executeSelect, type LocalQueryResult } from "../../db/execute.js";
import { appendHistory } from "../../history/store.js";
import { renderResult } from "../../output/table.js";
import { getSavedClient } from "../../sdk/client.js";
import { promptSecret } from "../../util/prompt.js";
import type { ScreenName } from "../app.js";

type Status = "idle" | "generating" | "executing" | "ok" | "error";

interface Props {
	connector: string;
	onBusyChange?: (busy: boolean) => void;
	onSwitchScreen?: (s: ScreenName) => void;
	onOpenHelp?: () => void;
	onQuit?: () => void;
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

type SlashCmd =
	| { kind: "help" }
	| { kind: "quit" }
	| { kind: "screen"; screen: ScreenName }
	| { kind: "clear" };

function parseSlash(cmd: string): SlashCmd | { kind: "unknown"; raw: string } {
	const lower = cmd.trim().toLowerCase();
	if (lower === "" || lower === "/") return { kind: "unknown", raw: cmd };
	switch (lower.replace(/^\//, "")) {
		case "help":
		case "h":
		case "?":
			return { kind: "help" };
		case "quit":
		case "q":
		case "exit":
			return { kind: "quit" };
		case "connectors":
		case "c":
		case "1":
			return { kind: "screen", screen: "connectors" };
		case "history":
		case "h2":
		case "2":
			return { kind: "screen", screen: "history" };
		case "question":
		case "q2":
		case "3":
			return { kind: "screen", screen: "question" };
		case "clear":
		case "cls":
			return { kind: "clear" };
		default:
			return { kind: "unknown", raw: cmd };
	}
}

export function QuestionScreen({
	connector,
	onBusyChange,
	onSwitchScreen,
	onOpenHelp,
	onQuit,
}: Props) {
	const [buf, setBuf] = useState("");
	const [slashBuf, setSlashBuf] = useState<string | null>(null);
	const [slashHint, setSlashHint] = useState<string | null>(null);
	const [status, setStatus] = useState<Status>("idle");
	const [sql, setSql] = useState<string | null>(null);
	const [result, setResult] = useState<LocalQueryResult | null>(null);
	const [err, setErr] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		onBusyChange?.(busy);
	}, [busy, onBusyChange]);

	useInput((input, key) => {
		if (busy) return;

		// Slash-command mode.
		if (slashBuf !== null) {
			if (key.return) {
				const parsed = parseSlash(slashBuf);
				switch (parsed.kind) {
					case "help":
						onOpenHelp?.();
						setSlashBuf(null);
						setSlashHint(null);
						return;
					case "quit":
						onQuit?.();
						return;
					case "screen":
						onSwitchScreen?.(parsed.screen);
						setSlashBuf(null);
						setSlashHint(null);
						return;
					case "clear":
						setBuf("");
						setSql(null);
						setResult(null);
						setErr(null);
						setSlashBuf(null);
						setSlashHint(null);
						return;
					case "unknown":
						setSlashHint(`Unknown command: /${parsed.raw.slice(1) || ""}`);
						// keep slashBuf so the user can edit
						return;
				}
			}
			if (key.escape) {
				setSlashBuf(null);
				setSlashHint(null);
				return;
			}
			if (key.backspace || key.delete) {
				setSlashBuf((s) => {
					if (s === null) return null;
					const next = s.slice(0, -1);
					if (next === "" || next === "/") {
						setSlashHint(null);
						return null;
					}
					return next;
				});
				return;
			}
			// Don't echo `/` more than once.
			if (input === "/") return;
			if (input && !key.ctrl && !key.meta && !key.tab) {
				// Strip any leading `/` already in the buffer (defence
				// against pasted multi-char input).
				const rest = input.replace(/^\/+/, "");
				setSlashBuf((s) => (s ?? "") + rest);
			}
			return;
		}

		// Normal question-mode input.
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
		// Tab is the global screen-cycle key — never append to the buffer.
		if (key.tab || key.escape || key.ctrl || key.meta) return;

		if (input.includes("/")) {
			// Switch into slash-command mode. We accept the whole input
			// as the slash buffer so pasted strings ("/help", "/quit")
			// and the test harness (which batches chars into one event)
			// both work.
			setSlashBuf(input);
			setSlashHint(null);
			return;
		}
		if (input) {
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
				<Text> {buf.length === 0 ? <Text dimColor>(type, hit Enter · / for commands)</Text> : buf}</Text>
			</Box>

			{slashBuf !== null && (
				<Box marginTop={1} flexDirection="column">
					<Box borderStyle="round" borderColor="magenta" paddingX={1}>
						<Text color="magenta">/</Text>
						<Text> {slashBuf.length === 1 ? <Text dimColor>(help, quit, connectors, history, clear)</Text> : slashBuf.slice(1)}</Text>
					</Box>
					{slashHint && (
						<Text color="yellow"> {slashHint}</Text>
					)}
					<Text dimColor> Enter to run · Esc to cancel · Backspace to edit</Text>
				</Box>
			)}

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