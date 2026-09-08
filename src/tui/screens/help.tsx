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
				<Text color="cyan">[Tab]</Text> Open command palette (1/2/3/?/q)
			</Text>
			<Text>
				<Text color="cyan">[?]</Text> Toggle this help overlay
			</Text>
			<Text>
				<Text color="cyan">[Esc]</Text> Close palette/help
			</Text>
			<Text>
				<Text color="cyan">[Ctrl-C]</Text> Quit
			</Text>
			<Text> </Text>
			<Text dimColor>Inside the Question screen:</Text>
			<Text>
				<Text color="cyan">[Enter]</Text> Submit the question
			</Text>
			<Text>
				<Text color="cyan">[Backspace]</Text> Delete a character
			</Text>
			<Text>
				<Text color="cyan">[1/2/3/?/q]</Text> Pass through to your input — they're
				letters now, not shortcuts.
			</Text>
			<Text> </Text>
			<Text dimColor>Press ? or Esc to close.</Text>
		</>
	);
}