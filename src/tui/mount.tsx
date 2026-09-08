/**
 * Renders the ink TUI for `easysql` (no subcommand). Thin wrapper so
 * `repl.ts` can stay as a plain `.ts` module that program.ts can
 * import — the JSX lives here.
 */

import { render } from "ink";
import { App } from "./app.js";

export interface MountOptions {
	connector?: string;
}

export function mountTui(opts: MountOptions) {
	return render(<App initialConnector={opts.connector} />, {
		exitOnCtrlC: true,
		patchConsole: true,
		alternateScreen: true,
		// Force interactive mode. Ink's auto-detection disables it
		// whenever the CI env var is set (even on a real TTY), which
		// silently kills alternateScreen and frame rendering — the
		// visible symptom was the TUI painting nothing while running
		// and leaving a huge black gap above its final frame. startRepl
		// already gates on isatty(), so interactive is always correct
		// here.
		interactive: true,
	});
}