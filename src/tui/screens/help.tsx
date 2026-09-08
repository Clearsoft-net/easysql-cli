/**
 * Help overlay — listing of every keybinding the App shell understands.
 * Press `?` or Escape to dismiss.
 */

import { Text } from "ink";

export function HelpScreen() {
	return (
		<>
			<Text bold color="yellow">
				easysql TUI — keybindings
			</Text>
			<Text> </Text>
			<Text>
				<Text color="cyan">[1]</Text> Connectors screen — list, navigate (j/k), activate (Enter)
			</Text>
			<Text>
				<Text color="cyan">[2]</Text> History screen — paginated local question log
			</Text>
			<Text>
				<Text color="cyan">[3]</Text> Question screen — type NL question, Enter to run
			</Text>
			<Text>
				<Text color="cyan">[?]</Text> Toggle this help overlay
			</Text>
			<Text>
				<Text color="cyan">[q]</Text> Quit
			</Text>
			<Text>
				<Text color="cyan">[Ctrl-C]</Text> Force quit
			</Text>
			<Text> </Text>
			<Text dimColor>Press ? or Esc to close.</Text>
		</>
	);
}