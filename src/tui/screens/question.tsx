/**
 * Question screen — type a natural-language question, get SQL from the
 * EasySQL API, execute it locally against the active connection, and
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
 *   /connections       — switch to Connections
 *   /history          — switch to History
 *   /question         — switch to Question (no-op)
 *   /clear            — clear the buffer + result panel
 *   /logout           — clear stored credentials (log in again with `easysql login`)
 *   /login            — prompt for an API key and sign in without leaving the TUI
 *   /<anything-else>  — unknown command, stays in slash mode with a hint
 *
 * Errors are surfaced as inline text (no console.log side-effects).
 */

import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import {
	findConnectionByName,
	type StoredConnection,
	upsertConnection,
} from "../../config/connections-store.js";
import { executeSelect, type LocalQueryResult } from "../../db/execute.js";
import { storedPassword } from "../../db/password.js";
import { appendHistory } from "../../history/store.js";
import { t } from "../../i18n/messages.js";
import {
	type AuthenticatedClient,
	getSavedClient,
	isConnectionNotFoundError,
} from "../../sdk/client.js";
import type { ScreenName } from "../app.js";
import { Cursor } from "../cursor.js";
import { ResultTable } from "../result-table.js";
import { Spinner } from "../spinner.js";
import { SqlText } from "../sql-highlight.js";
import { ConnectionSync } from "./connection-sync.js";
import { LoginScreen, type LoggedInUser } from "./login.js";
import { UsageView } from "./usage.js";

type Status = "idle" | "generating" | "executing" | "ok" | "error";

interface Props {
	connection: string;
	onBusyChange?: (busy: boolean) => void;
	onSwitchScreen?: (s: ScreenName) => void;
	onOpenHelp?: () => void;
	onQuit?: () => void;
	onLogout?: () => boolean;
	onLoggedIn?: (user: LoggedInUser) => void;
}

interface QueryResponse {
	id?: string;
	sql?: string;
	sql_generated?: string | null;
	needs_local_execution?: boolean;
}

/**
 * A query whose SQL was generated but whose local execution is waiting for
 * the database password: `$EASYSQL_DB_PASSWORD` and the OS keyring were
 * consulted first and came up empty, so the TUI asks inline (a
 * `promptSecret` on stderr would be wiped by ink's alternate-screen
 * redraws and look like a hang).
 */
interface PendingExecution {
	client: AuthenticatedClient;
	connection: StoredConnection;
	sql: string;
	queryId?: string;
}

type SlashCmd =
	| { kind: "help" }
	| { kind: "quit" }
	| { kind: "screen"; screen: ScreenName }
	| { kind: "clear" }
	| { kind: "sync" }
	| { kind: "usage" }
	| { kind: "logout" }
	| { kind: "login" };

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
		case "connections":
		case "c":
		case "1":
			return { kind: "screen", screen: "connections" };
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
		case "sync":
		case "sy":
			return { kind: "sync" };
		case "usage":
		case "u":
			return { kind: "usage" };
		case "logout":
		case "lo":
			return { kind: "logout" };
		case "login":
		case "li":
			return { kind: "login" };
		default:
			return { kind: "unknown", raw: cmd };
	}
}

interface SlashCommand {
	name: string;
	aliases: string[];
	desc: string;
}

const SLASH_COMMANDS: SlashCommand[] = [
	{ name: "help", aliases: ["h", "?"], desc: "Show keybindings" },
	{ name: "connections", aliases: ["c", "1"], desc: "Go to Connections" },
	{ name: "history", aliases: ["h2", "2"], desc: "Go to History" },
	{ name: "question", aliases: ["q2", "3"], desc: "Go to Question" },
	{ name: "clear", aliases: ["cls"], desc: "Clear buffer and result" },
	{ name: "sync", aliases: ["sy"], desc: "Sync the active connection" },
	{ name: "usage", aliases: ["u"], desc: "Show plan usage/quota" },
	{ name: "logout", aliases: ["lo"], desc: "Log out (clear credentials)" },
	{ name: "login", aliases: ["li"], desc: "Log in with an API key" },
	{ name: "quit", aliases: ["q", "exit"], desc: "Quit the TUI" },
];

function filterCommands(query: string): SlashCommand[] {
	const q = query.toLowerCase();
	if (q === "") return SLASH_COMMANDS;
	return SLASH_COMMANDS.filter(
		(c) => c.name.startsWith(q) || c.aliases.some((a) => a.startsWith(q)),
	);
}

export function QuestionScreen({
	connection,
	onBusyChange,
	onSwitchScreen,
	onOpenHelp,
	onQuit,
	onLogout,
	onLoggedIn,
}: Props) {
	const [buf, setBuf] = useState("");
	const [slashBuf, setSlashBuf] = useState<string | null>(null);
	const [slashHint, setSlashHint] = useState<string | null>(null);
	const [slashSel, setSlashSel] = useState(0);
	const [status, setStatus] = useState<Status>("idle");
	const [asked, setAsked] = useState<string | null>(null);
	const [sql, setSql] = useState<string | null>(null);
	const [result, setResult] = useState<LocalQueryResult | null>(null);
	const [err, setErr] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [pending, setPending] = useState<PendingExecution | null>(null);
	const [password, setPassword] = useState("");
	const [syncTarget, setSyncTarget] = useState<StoredConnection | null>(null);
	const [usageOpen, setUsageOpen] = useState(false);
	const [loginOpen, setLoginOpen] = useState(false);

	useEffect(() => {
		onBusyChange?.(busy || loginOpen || pending !== null);
	}, [busy, loginOpen, pending, onBusyChange]);

	useInput((input, key) => {
		if (syncTarget || usageOpen || loginOpen) return;
		if (pending) {
			if (key.escape) {
				setPending(null);
				setPassword("");
				setNotice("Query cancelled — no password entered.");
				return;
			}
			if (key.return) {
				void submitPassword();
				return;
			}
			if (key.backspace || key.delete) {
				setPassword((p) => p.slice(0, -1));
				return;
			}
			if (key.ctrl || key.meta || key.tab) return;
			if (input) setPassword((p) => p + input);
			return;
		}
		if (busy) return;

		// Slash-command mode.
		if (slashBuf !== null) {
			const matches = filterCommands(slashBuf.slice(1));
			if (key.upArrow || key.downArrow) {
				if (matches.length > 0) {
					const n = matches.length;
					setSlashSel((s) => (key.upArrow ? (s - 1 + n) % n : (s + 1) % n));
				}
				return;
			}
			if (key.return) {
				const chosen = matches[Math.min(slashSel, matches.length - 1)];
				const parsed = parseSlash(chosen ? `/${chosen.name}` : slashBuf);
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
					setAsked(null);
					setSql(null);
					setResult(null);
					setErr(null);
					setNotice(null);
					setSlashBuf(null);
					setSlashHint(null);
					return;
					case "sync": {
						const target = findConnectionByName(connection);
						if (!target) {
							setSlashHint(`No connection named '${connection}'.`);
							return;
						}
						setSyncTarget(target);
						setSlashBuf(null);
						setSlashHint(null);
						return;
					}
					case "usage":
						setUsageOpen(true);
						setSlashBuf(null);
						setSlashHint(null);
						return;
					case "logout": {
						const cleared = onLogout?.() ?? false;
						setNotice(
							cleared
								? "Logged out. Run `easysql login` to sign in as another user."
								: "Could not clear stored credentials.",
						);
						setSlashBuf(null);
						setSlashHint(null);
						return;
					}
					case "login":
						setLoginOpen(true);
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
				setSlashSel(0);
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
				setSlashSel(0);
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
			setSlashSel(0);
			setSlashBuf(input);
			setSlashHint(null);
			return;
		}
		if (input) {
			setBuf((s) => s + input);
		}
	});

	function fail(e: unknown, connectionName: string): void {
		if (isConnectionNotFoundError(e)) {
			setErr(t().errors.connectionNotFoundOnApi(connectionName));
		} else {
			setErr(e instanceof Error ? e.message : String(e));
		}
		setStatus("error");
	}

	async function finishExecution(
		stored: StoredConnection,
		generated: string,
		pw: string,
		question: string,
	): Promise<void> {
		setStatus("executing");
		const r = await executeSelect(
			{
				type: stored.type,
				host: stored.host,
				port: stored.port,
				user: stored.user,
				password: pw,
				database: stored.database,
				ssl: stored.ssl,
			},
			generated,
		);
		setResult(r);
		setStatus("ok");

		// EZSQL-37: no answer upload — the API never receives result rows;
		// the local table above is the rendered answer.
		upsertConnection({ ...stored, updated_at: new Date().toISOString() });
		appendHistory({
			at: new Date().toISOString(),
			question,
			connection: stored.name,
			sql: generated,
			row_count: r.row_count,
			duration_ms: r.duration_ms,
			status: "ok",
		});
	}

	async function submitPassword(): Promise<void> {
		if (!pending) return;
		setBusy(true);
		setErr(null);
		try {
			await finishExecution(pending.connection, pending.sql, password, asked ?? "");
		} catch (e) {
			fail(e, pending.connection.name);
		} finally {
			setPending(null);
			setPassword("");
			setBusy(false);
		}
	}

	async function runFlow() {
		const question = buf.trim();
		if (question.length === 0) return;
		const stored = findConnectionByName(connection);
		if (!stored?.id) {
			setErr(`No connection named '${connection}'.`);
			setStatus("error");
			return;
		}
		setBusy(true);
		setErr(null);
		setNotice(null);
		setResult(null);
		setSql(null);
		setAsked(question);
		setBuf("");
		try {
			setStatus("generating");
			const { client } = getSavedClient();
			const createRes = (await client.createQuery({
				connection_id: stored.id,
				question,
			})) as QueryResponse;
			const generated = createRes.sql_generated ?? createRes.sql ?? "";
			setSql(generated);

			const direct =
				stored.type === "sqlite" ? "" : ((await storedPassword(stored)) ?? "");
			if (stored.type !== "sqlite" && direct.length === 0) {
				// Ask for the password inline: a raw-mode stderr prompt would
				// be erased by ink's redraws and look like a hang.
				setStatus("idle");
				setPending({
					client,
					connection: stored,
					sql: generated,
					queryId: createRes.id,
				});
				return;
			}

			await finishExecution(stored, generated, direct, question);
		} catch (e) {
			fail(e, stored.name);
		} finally {
			setBusy(false);
		}
	}

	const showWelcome = status === "idle" && !result && !sql && !asked && buf.length === 0;
	const slashMatches = slashBuf === null ? [] : filterCommands(slashBuf.slice(1));
	const slashSelClamped =
		slashMatches.length === 0 ? 0 : Math.min(slashSel, slashMatches.length - 1);

	return (
		<Box paddingX={1} flexDirection="column" flexGrow={1}>
			{slashBuf === null ? (
				<Box flexDirection="column" flexGrow={1} overflow="hidden">
					{showWelcome && (
						<Box marginTop={1} flexDirection="column">
							<Text dimColor>Examples:</Text>
							<Text color="cyan">  • Top 10 customers by revenue</Text>
							<Text color="cyan">  • How many orders last week?</Text>
							<Text color="cyan">  • Products with low stock</Text>
						</Box>
					)}

				<Box marginTop={1} flexDirection="column">
					{status === "generating" && <Spinner label="Generating SQL…" />}
					{status === "executing" && <Spinner label="Executing locally…" />}
					{err && <Text color="red">Error: {err}</Text>}
					{notice && <Text color="yellow">{notice}</Text>}
				</Box>

				{pending && (
					<Box marginTop={1} flexDirection="column">
						<Text color="cyan">
							Password for {pending.connection.name} ({pending.connection.type})
						</Text>
						<Text>
							{"*".repeat(password.length)}
							{!busy && <Cursor color="cyan" />}
							{password.length === 0 && <Text dimColor> type the password…</Text>}
						</Text>
						<Text dimColor>Enter execute · Esc cancel</Text>
					</Box>
				)}

				{asked && (status === "generating" || status === "executing" || result || sql) && (
					<Box marginTop={1} flexDirection="column">
						<Text dimColor>Question</Text>
						<Text bold>{asked}</Text>
					</Box>
				)}

				{result && (
						<Box marginTop={1} flexDirection="column">
							<Text dimColor>
								{result.row_count} row(s) in {result.duration_ms}ms
							</Text>
							<ResultTable columns={result.columns} rows={result.rows} />
						</Box>
					)}

					{sql && (
						<Box marginTop={1} flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
							<Text dimColor>SQL</Text>
							<SqlText sql={sql} />
						</Box>
					)}
				</Box>
			) : (
				<Box flexGrow={1} />
			)}

			{loginOpen ? (
				<LoginScreen
					onExit={() => setLoginOpen(false)}
					onSuccess={(user) => onLoggedIn?.(user)}
				/>
			) : usageOpen ? (
				<UsageView onExit={() => setUsageOpen(false)} />
			) : syncTarget ? (
				<ConnectionSync
					connection={syncTarget}
					title="/sync"
					onExit={() => setSyncTarget(null)}
				/>
			) : slashBuf !== null ? (
				<Box flexDirection="column">
					{slashMatches.length > 0 && (
						<Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
							{slashMatches.map((c, i) => {
								const isSel = i === slashSelClamped;
								return (
									<Text
										key={c.name}
										color={isSel ? "black" : undefined}
										backgroundColor={isSel ? "cyan" : undefined}
										bold={isSel}
									>
										{isSel ? "› " : "  "}
										{`/${c.name}`.padEnd(12)}
										{"  "}
										<Text dimColor={!isSel}>{c.desc}</Text>
									</Text>
								);
							})}
						</Box>
					)}
				<Box borderStyle="round" borderColor="magenta" paddingX={1}>
					<Text color="magenta">/</Text>
					<Text>
						{" "}
						{slashBuf.slice(1).length === 0 ? (
							<>
								<Cursor color="magenta" />
								<Text dimColor>type a command…</Text>
							</>
						) : (
							<>
								{slashBuf.slice(1)}
								<Cursor color="magenta" />
							</>
						)}
					</Text>
				</Box>
					{slashMatches.length === 0 ? (
						<Text color="yellow"> No matching command · Esc to cancel</Text>
					) : (
						<Text dimColor> ↑/↓ select · Enter run · Esc cancel · Backspace edit</Text>
					)}
					{slashHint && <Text color="yellow"> {slashHint}</Text>}
				</Box>
			) : (
			<Box borderStyle="round" borderColor="green" paddingX={1}>
				<Text color="green">›</Text>
				<Text>
					{" "}
					{buf.length === 0 ? (
						<>
							<Cursor />
							<Text dimColor>(type a question, hit Enter · / for commands)</Text>
						</>
					) : (
						<>
							{buf}
							<Cursor />
						</>
					)}
				</Text>
			</Box>
			)}
		</Box>
	);
}