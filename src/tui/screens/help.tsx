/**
 * Help overlay — listing of every keybinding the App shell understands.
 * Press `?` or Esc to dismiss.
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
				<Text color="cyan">[Tab]</Text> Next screen · <Text color="cyan">[Shift-Tab]</Text> previous
			</Text>
			<Text>
				<Text color="cyan">[/]</Text> Slash-commands: <Text color="cyan">/help</Text>, <Text color="cyan">/quit</Text>,{" "}
				<Text color="cyan">/connectors</Text>, <Text color="cyan">/history</Text>, <Text color="cyan">/clear</Text>
			</Text>
			<Text>
				<Text color="cyan">[Esc]</Text> Close slash-prompt / help
			</Text>
			<Text>
				<Text color="cyan">[Ctrl-C]</Text> Force quit
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
				<Text color="cyan">[/?q1q2...]</Text> Pass through to your input — they're
				letters now, not shortcuts.
			</Text>
			<Text> </Text>
			<Text dimColor>Press ? or Esc to close.</Text>
		</>
	);
}