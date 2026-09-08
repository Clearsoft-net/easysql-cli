/**
 * Top-level TUI shell (ink-based). Renders the chrome (header + tab bar
 * + footer) around the active screen slot, plus a help modal overlay
 * and a command palette.
 *
 * Always-on global shortcuts (work even while typing into the Question
 * screen — these are the keys that never appear in normal text):
 *   Ctrl-C  — quit
 *   Esc     — close whatever overlay is on top (palette / help)
 *   Tab     — open the command palette
 *
 * While the palette is open (after Tab), number / letter shortcuts are
 * consumed:
 *   1 — Connectors  (list + j/k navigation, Enter to activate)
 *   2 — History     (paginated local history)
 *   3 — Question    (textarea + generate SQL + execute locally + render table)
 *   ? — Help modal
 *   q — Quit
 *
 * The design avoids the classic TUI problem where global shortcuts eat
 * characters a user is trying to type: while the Question screen has
 * focus, only Esc / Ctrl-C / Tab reach the App-level handler. Every
 * other key flows through to the Question screen's useInput.
 *
 * No external TUI dependencies beyond `ink` + `react`. All domain logic
 * stays in `src/db/`, `src/sdk/`, `src/config/` — this file is pure UI.
 */

import { Box, Text, useApp, useInput } from "ink";
import { useState } from "react";
import {
	findConnectorByName,
	loadConnectors,
	type StoredConnector,
} from "../config/connectors-store.js";
import { loadConfig } from "../config/store.js";
import { Footer, Header, TabBar } from "./chrome.js";
import { ConnectorsScreen } from "./screens/connectors.js";
import { HelpScreen } from "./screens/help.js";
import { HistoryScreen } from "./screens/history.js";
import { QuestionScreen } from "./screens/question.js";

export type ScreenName = "connectors" | "history" | "question";

interface AppProps {
	initialConnector?: string;
}

export function App({ initialConnector }: AppProps) {
	const { exit } = useApp();
	const [screen, setScreen] = useState<ScreenName>("question");
	const [helpOpen, setHelpOpen] = useState(false);
	const [paletteOpen, setPaletteOpen] = useState(false);
	// Set true while the Question screen is mid-query so a stray Tab
	// from the user doesn't yank focus away from in-flight work.
	const [questionBusy, setQuestionBusy] = useState(false);
	const [active, setActive] = useState<string | undefined>(() => {
		if (initialConnector) {
			return findConnectorByName(initialConnector)?.name ?? initialConnector;
		}
		const list = loadConnectors();
		return list.length === 1 ? list[0]?.name : undefined;
	});
	const cfg = loadConfig();

	// The Question screen has input focus by default — number / letter
	// shortcuts are routed through the palette so they don't intercept
	// typed characters (e.g. "qual o cliente mais novo?" contains 'q').
	const inputFocused = screen === "question" && !questionBusy;

	useInput((input, key) => {
		// Always-on: Ctrl-C quits regardless of state.
		if (key.ctrl && input === "c") {
			exit();
			return;
		}

		// Esc closes whichever overlay is on top.
		if (key.escape) {
			if (helpOpen) setHelpOpen(false);
			else if (paletteOpen) setPaletteOpen(false);
			return;
		}

		// Inside the palette, every key is consumed for navigation.
		if (paletteOpen) {
			if (input === "1") {
				setScreen("connectors");
				setPaletteOpen(false);
				return;
			}
			if (input === "2") {
				setScreen("history");
				setPaletteOpen(false);
				return;
			}
			if (input === "3") {
				setScreen("question");
				setPaletteOpen(false);
				return;
			}
			if (input === "?") {
				setHelpOpen(true);
				setPaletteOpen(false);
				return;
			}
			if (input === "q") {
				exit();
				return;
			}
			// Any other key closes the palette so a stray character
			// typed while waiting for a selection isn't lost.
			setPaletteOpen(false);
			return;
		}

		if (helpOpen) {
			if (input === "?") setHelpOpen(false);
			return;
		}

		// Input-focus mode: only Tab to open the palette; every other
		// key flows through to the Question screen's useInput.
		if (inputFocused) {
			if (key.tab) setPaletteOpen(true);
			return;
		}

		// Outside input focus (Connectors / History screens): full set.
		if (key.tab) {
			setPaletteOpen(true);
			return;
		}
		if (input === "?") {
			setHelpOpen(true);
			return;
		}
		if (input === "q") {
			exit();
			return;
		}
	});

	const activeConnector: StoredConnector | undefined = active
		? findConnectorByName(active)
		: undefined;
	const apiUrl = cfg.api_url || undefined;

	return (
		<Box flexDirection="column" height="100%">
			<Header
				active={active}
				connectorType={activeConnector?.type}
				apiUrl={apiUrl}
				online={cfg.api_key.length > 0}
			/>
			<TabBar active={screen} />
			<Box flexDirection="column" flexGrow={1} overflow="hidden" paddingX={1}>
				{screen === "connectors" && (
					<ConnectorsScreen active={active} onSelect={setActive} />
				)}
				{screen === "history" && <HistoryScreen />}
				{screen === "question" && active && (
					<QuestionScreen connector={active} onBusyChange={setQuestionBusy} />
				)}
				{screen === "question" && !active && (
					<Text color="yellow">Pick a connector first.</Text>
				)}
			</Box>
			<Footer screen={screen} paletteOpen={paletteOpen} />

			{paletteOpen && (
				<Box
					position="absolute"
					borderStyle="double"
					borderColor="magenta"
					paddingX={2}
					flexDirection="column"
				>
					<Text bold color="magenta">
						Command palette (Tab/Esc to close)
					</Text>
					<Text> </Text>
					<Text>
						<Text color="cyan">[1]</Text> Connectors
					</Text>
					<Text>
						<Text color="cyan">[2]</Text> History
					</Text>
					<Text>
						<Text color="cyan">[3]</Text> Question
					</Text>
					<Text>
						<Text color="cyan">[?]</Text> Help
					</Text>
					<Text>
						<Text color="cyan">[q]</Text> Quit
					</Text>
				</Box>
			)}

			{helpOpen && (
				<Box
					position="absolute"
					borderStyle="double"
					borderColor="yellow"
					paddingX={2}
					flexDirection="column"
				>
					<HelpScreen />
				</Box>
			)}
		</Box>
	);
}