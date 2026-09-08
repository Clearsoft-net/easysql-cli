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
	});
}