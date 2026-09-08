/**
 * Connectors screen — list of locally-registered connectors. `j/k` or
 * arrow keys move the selection; Enter activates the highlighted
 * connector (closes the loop back to the Question screen via `onSelect`).
 */

import { Box, Text, useInput } from "ink";
import { useState } from "react";
import { loadConnectors, type StoredConnector } from "../../config/connectors-store.js";

interface Props {
	active?: string;
	onSelect: (name: string) => void;
}

function describe(c: StoredConnector): string {
	const host = c.type === "sqlite" ? c.database : `${c.host ?? "?"}:${c.port ?? "?"}`;
	return `${c.type}@${host}/${c.database}`;
}

export function ConnectorsScreen({ active, onSelect }: Props) {
	const [list] = useState(() => loadConnectors());
	const [cursor, setCursor] = useState(() =>
		Math.max(0, list.findIndex((c) => c.name === active)),
	);

	useInput((input, key) => {
		if (list.length === 0) return;
		if (key.downArrow || input === "j") {
			setCursor((c) => (c + 1) % list.length);
		} else if (key.upArrow || input === "k") {
			setCursor((c) => (c - 1 + list.length) % list.length);
		} else if (key.return) {
			const picked = list[cursor];
			if (picked) onSelect(picked.name);
		}
	});

	if (list.length === 0) {
		return (
			<Box paddingX={1} flexDirection="column">
				<Text color="yellow">No local connectors yet.</Text>
				<Text dimColor>Run `easysql demo` or `easysql connector add` first.</Text>
			</Box>
		);
	}

	return (
		<Box paddingX={1} flexDirection="column">
			<Text bold>Connectors ({list.length})</Text>
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
			<Text dimColor>↑/↓ or j/k to move · Enter to activate</Text>
		</Box>
	);
}