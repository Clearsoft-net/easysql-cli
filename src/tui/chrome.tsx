/**
 * Static chrome for the TUI shell — three components rendered around
 * the active screen slot: `Header` (status bar with name, version,
 * connector), `TabBar` (3 tabs with the active one highlighted), and
 * `Footer` (contextual keybinding hints). Pure presentational; no
 * domain logic, no `useInput`.
 */

import { Box, Text } from "ink";
import { VERSION } from "../version.js";
import type { ScreenName } from "./app.js";

interface HeaderProps {
	active?: string;
	connectorType?: string;
	apiUrl?: string;
	online?: boolean;
}

export function Header({ active, connectorType, apiUrl, online }: HeaderProps) {
	const connectorLabel = active
		? `${active}${connectorType ? ` (${connectorType})` : ""}`
		: "no connector selected";

	return (
		<Box
			borderStyle="round"
			borderColor="cyan"
			paddingX={1}
			flexShrink={0}
			flexDirection="row"
			justifyContent="space-between"
		>
			<Box>
				<Text bold color="cyan">
					easysql
				</Text>
				<Text dimColor> v{VERSION}</Text>
				<Text>  ─  connector: </Text>
				<Text color={active ? "green" : "yellow"} bold={!active}>
					{connectorLabel}
				</Text>
			</Box>
			<Box>
				{apiUrl && (
					<Text dimColor>
						{apiUrl.replace(/^https?:\/\//, "")}
						{"  "}
					</Text>
				)}
				<Text color={online ? "green" : "red"}>
					{online ? "● online" : "○ offline"}
				</Text>
			</Box>
		</Box>
	);
}

interface Tab {
	name: string;
	value: ScreenName;
}

const TABS: Tab[] = [
	{ name: "Connectors", value: "connectors" },
	{ name: "History", value: "history" },
	{ name: "Question", value: "question" },
];

export function TabBar({ active }: { active: ScreenName }) {
	const idx = TABS.findIndex((t) => t.value === active);
	return (
		<Box
			flexDirection="row"
			borderStyle="single"
			borderColor="gray"
			borderTop={false}
			borderLeft={false}
			borderRight={false}
			paddingX={1}
			flexShrink={0}
		>
			<Text dimColor>{"◀ "}</Text>
			{TABS.map((tab) => {
				const isActive = tab.value === active;
				return (
					<Box key={tab.value} marginRight={3}>
						<Text color={isActive ? "cyan" : "gray"} bold={isActive}>
							{isActive ? "▸ " : "  "}
							{tab.name}
						</Text>
					</Box>
				);
			})}
			<Text dimColor>{" ▶"}</Text>
		</Box>
	);
}

interface FooterProps {
	screen: ScreenName;
}

const GLOBAL_HINTS = "[Tab] next screen · Shift+Tab previous · [/] commands · [Ctrl-C] quit";

const SCREEN_HINTS: Record<ScreenName, string> = {
	connectors: "↑/↓ or j/k navigate · Enter activate",
	history: "←/→ or h/l switch page",
	question: "Type · Enter submit · Backspace delete · / for commands",
};

export function Footer({ screen }: FooterProps) {
	return (
		<Box
			flexDirection="column"
			flexShrink={0}
			borderStyle="single"
			borderColor="gray"
			borderBottom={false}
			borderLeft={false}
			borderRight={false}
			paddingX={1}
		>
			<Box>
				<Text dimColor>{SCREEN_HINTS[screen]}</Text>
			</Box>
			<Box>
				<Text dimColor>{GLOBAL_HINTS}</Text>
			</Box>
		</Box>
	);
}