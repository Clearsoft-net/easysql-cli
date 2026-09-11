/**
 * Static chrome for the TUI shell — three components rendered around
 * the active screen slot: `Header` (status bar with name, version,
 * connector), `TabBar` (3 tabs with the active one highlighted), and
 * `Footer` (contextual keybinding hints). Pure presentational; no
 * domain logic, no `useInput`.
 */

import { Box, Text, useWindowSize } from "ink";
import { VERSION } from "../version.js";
import type { ScreenName } from "./app.js";

interface HeaderProps {
	active?: string;
	connectorType?: string;
	apiUrl?: string;
	online?: boolean;
	userEmail?: string;
	planName?: string;
}

/**
 * Header — full-width banner above the tab bar. Three rows:
 *   1. easysql mark + tagline
 *   2. active connector (or "no connector selected")
 *   3. API host + online/offline dot
 *
 * Two-column layout: left column is the brand, right column is the
 * status. Border is double to make it feel like a dashboard header.
 */
export function Header({ active, connectorType, apiUrl, online, userEmail, planName }: HeaderProps) {
	// Drop the least-important fields as the terminal narrows so the header
	// never wraps into a broken second line. Email + plan + online are kept
	// as long as there is room.
	const { columns } = useWindowSize();
	const cols = columns ?? 80;
	const showEmail = cols >= 72;
	const showType = cols >= 96;
	const showVersion = cols >= 112;
	const showApi = cols >= 140;

	const connectorLabel = active
		? `${active}${connectorType && showType ? ` (${connectorType})` : ""}`
		: "no connector selected";

	return (
		<Box
			borderStyle="single"
			borderColor="cyan"
			borderTop={false}
			borderLeft={false}
			borderRight={false}
			paddingX={1}
			flexShrink={0}
			flexDirection="row"
			justifyContent="space-between"
		>
			<Box>
				<Text bold color="cyan">
					easysql
				</Text>
				{userEmail && showEmail && <Text dimColor>  {userEmail}</Text>}
			</Box>
			<Box>
				<Text>
					<Text dimColor>connector: </Text>
					<Text color={active ? "green" : "yellow"} bold={!active}>
						{connectorLabel}
					</Text>
				</Text>
				<Text dimColor>{"  │  plan: "}</Text>
				<Text color="magenta" bold>
					{planName ?? "Free"}
				</Text>
				{showVersion && <Text dimColor>  │  {VERSION}</Text>}
				{showApi && apiUrl && (
					<Text dimColor>
						{"  "}
						{apiUrl.replace(/^https?:\/\//, "")}
					</Text>
				)}
				<Text color={online ? "green" : "red"}>
					{"  "}
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
			{TABS.map((tab) => {
				const isActive = tab.value === active;
				return (
					<Text
						key={tab.value}
						color={isActive ? "black" : "gray"}
						backgroundColor={isActive ? "cyan" : undefined}
						bold={isActive}
					>
						{isActive ? "  ▸ " : "  "}
						{tab.name}
						{"  "}
					</Text>
				);
			})}
		</Box>
	);
}

interface FooterProps {
	screen: ScreenName;
}

const GLOBAL_HINTS = "[Tab] next screen · Shift+Tab previous · [/] commands · [Ctrl-C] quit";

const SCREEN_HINTS: Record<ScreenName, string> = {
	connectors: "↑/↓ or j/k navigate · Enter select · s sync · d remove",
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