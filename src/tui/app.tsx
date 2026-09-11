/**
 * Top-level TUI shell (ink-based). Renders the chrome (header + tab bar
 * + footer) around the active screen slot, plus a help modal overlay.
 *
 * Keybindings:
 *   Tab / Shift-Tab — cycle between Connectors / History / Question.
 *   Ctrl-C          — quit immediately.
 *   Esc             — close the help modal.
 *
 * Inside any screen, `/` opens a transient slash-prompt at the bottom
 * where the user can type slash-commands. The Question screen has its
 * own normal typing input; the slash-prompt is the only place where
 * `/help`, `/quit`, `/connectors`, etc. are consumed.
 *
 * The design avoids the classic TUI problem where global shortcuts eat
 * characters a user is trying to type — Tab is the only navigation key
 * reachable from anywhere, and every other character flows through to
 * the active screen's useInput.
 *
 * No external TUI dependencies beyond `ink` + `react`. All domain logic
 * stays in `src/db/`, `src/sdk/`, `src/config/` — this file is pure UI.
 */

import { Box, Text, useApp, useInput, useWindowSize } from "ink";
import { useEffect, useState } from "react";
import {
	findConnectorByName,
	loadConnectors,
	type StoredConnector,
} from "../config/connectors-store.js";
import { loadConfig, saveConfig } from "../config/store.js";
import { getSavedClient } from "../sdk/client.js";
import { Footer, Header, TabBar } from "./chrome.js";
import { ConnectorsScreen } from "./screens/connectors.js";
import { HelpScreen } from "./screens/help.js";
import { HistoryScreen } from "./screens/history.js";
import { QuestionScreen } from "./screens/question.js";

export type ScreenName = "connectors" | "history" | "question";

const SCREENS: ScreenName[] = ["connectors", "history", "question"];

export function nextScreen(current: ScreenName, reverse = false): ScreenName {
	const idx = SCREENS.indexOf(current);
	const step = reverse ? -1 : 1;
	const next = (idx + step + SCREENS.length) % SCREENS.length;
	return SCREENS[next] as ScreenName;
}

interface AppProps {
	initialConnector?: string;
}

export function App({ initialConnector }: AppProps) {
	const { exit } = useApp();
	// Pin the frame to the real terminal height. Ink's height="100%" on the
	// root resolves to the content's natural height (the root's own height is
	// auto), so a short frame would float at the bottom of a tall terminal
	// whenever the alternate-screen buffer is unavailable (some terminals and
	// multiplexers ignore the 1049h escape and fall back to log-update).
	// Using the measured `rows` here guarantees a full-height layout —
	// header at top, footer at bottom, content area filling the middle —
	// regardless of alternate-screen support, and it tracks live resizes.
	const { rows, columns } = useWindowSize();
	const [screen, setScreen] = useState<ScreenName>("question");
	const [helpOpen, setHelpOpen] = useState(false);
	// While the Question screen is mid-query, suppress the Tab cycle
	// so a stray keypress doesn't yank focus away from in-flight work.
	const [questionBusy, setQuestionBusy] = useState(false);
	const [active, setActive] = useState<string | undefined>(() => {
		if (initialConnector) {
			return findConnectorByName(initialConnector)?.name ?? initialConnector;
		}
		const list = loadConnectors();
		return list.length === 1 ? list[0]?.name : undefined;
	});
	const cfg = loadConfig();
	// Active user identity/plan. Seeded from the config cache (written at
	// login) so it renders instantly and survives offline, then refreshed
	// from /v1/auth/me on mount when credentials are available.
	const [user, setUser] = useState<{ email?: string; plan?: string }>(() => ({
		email: cfg.user_email,
		plan: cfg.plan_name,
	}));

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const { client } = getSavedClient();
				const me = await client.me();
				if (cancelled) return;
				setUser({ email: me.email, plan: me.active_plan?.name });
				const current = loadConfig();
				if (current.user_email !== me.email || current.plan_name !== me.active_plan?.name) {
					saveConfig({
						...current,
						user_email: me.email,
						user_name: me.name,
						plan_name: me.active_plan?.name,
					});
				}
			} catch {
				// Offline or not logged in — keep the cached identity.
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	useInput((input, key) => {
		if (key.ctrl && input === "c") {
			exit();
			return;
		}

		if (helpOpen) {
			if (key.escape || input === "?") setHelpOpen(false);
			return;
		}

		// Tab / Shift-Tab cycle the active screen. We allow Tab even
		// while the Question screen has input focus so the user can
		// hop to Connectors without losing the buffer — but only when
		// the Question screen isn't mid-query.
		const inputBusy = screen === "question" && questionBusy;
		if (!inputBusy && key.tab) {
			setScreen((cur) => nextScreen(cur, key.shift));
			return;
		}

		// '?' toggles the help overlay, but only outside the Question
		// screen — there '?' belongs to the typed buffer (that's the
		// whole point of the slash-prompt design).
		if (screen !== "question" && input === "?") {
			setHelpOpen(true);
			return;
		}

		// Esc on the Question screen is just a no-op for the buffer
		// (the screen's own useInput ignores it).
		void input;
	});

	const activeConnector: StoredConnector | undefined = active
		? findConnectorByName(active)
		: undefined;
	const apiUrl = cfg.api_url || undefined;

	return (
		<Box flexDirection="column" height={rows}>
			<Header
				active={active}
				connectorType={activeConnector?.type}
				apiUrl={apiUrl}
				online={cfg.api_key.length > 0}
				userEmail={user.email}
				planName={user.plan}
			/>
			<TabBar active={screen} />
			<Box flexDirection="column" flexGrow={1} overflow="hidden" paddingX={1}>
				{screen === "connectors" && (
					<ConnectorsScreen active={active} onSelect={setActive} />
				)}
				{screen === "history" && <HistoryScreen />}
				{screen === "question" && active && (
					<QuestionScreen
						connector={active}
						onBusyChange={setQuestionBusy}
						onSwitchScreen={setScreen}
						onOpenHelp={() => setHelpOpen(true)}
						onQuit={() => exit()}
					/>
				)}
				{screen === "question" && !active && (
					<Box flexDirection="column">
						<Text bold color="yellow">
							No connector selected
						</Text>
						<Text> </Text>
						<Text>
							Press <Text color="cyan">[Tab]</Text> to switch to Connectors
							and pick one with <Text color="cyan">Enter</Text>.
						</Text>
						<Text> </Text>
						<Text dimColor>Or run `easysql demo` outside the TUI to generate one.</Text>
					</Box>
				)}
			</Box>
			<Footer screen={screen} />

			{helpOpen && (
				<Box
					position="absolute"
					top={Math.max(1, Math.floor(rows / 2) - 8)}
					left={Math.floor(columns / 4)}
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