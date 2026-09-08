/**
 * Top-level TUI shell (ink-based). Renders the chrome (header + tab bar
 * + footer) around the active screen slot, plus a help modal overlay.
 *
 *   1 — Connectors  (list + j/k navigation, Enter to activate)
 *   2 — History     (paginated local history)
 *   3 — Question    (textarea + generate SQL + execute locally + render table)
 *   ? — Help modal
 *   q — Quit
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
	const [active, setActive] = useState<string | undefined>(() => {
		if (initialConnector) {
			return findConnectorByName(initialConnector)?.name ?? initialConnector;
		}
		const list = loadConnectors();
		return list.length === 1 ? list[0]?.name : undefined;
	});
	const cfg = loadConfig();

	useInput((input, key) => {
		if (key.ctrl && input === "c") {
			exit();
			return;
		}
		if (helpOpen) {
			if (input === "?" || key.escape) setHelpOpen(false);
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
		switch (input) {
			case "1":
				setScreen("connectors");
				return;
			case "2":
				setScreen("history");
				return;
			case "3":
				setScreen("question");
				return;
			default:
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
				{screen === "question" && active && <QuestionScreen connector={active} />}
				{screen === "question" && !active && (
					<Text color="yellow">Pick a connector first (press 1).</Text>
				)}
			</Box>
			<Footer screen={screen} />

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