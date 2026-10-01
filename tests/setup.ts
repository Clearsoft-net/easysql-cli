/**
 * Global test preload (see bunfig.toml).
 *
 * Three things make `bun test` output env-dependent, so freeze them here:
 *
 * 1. Terminal size. ink resolves the viewport through `terminal-size`, which
 *    prefers `stdout.columns/rows`. Rendering against a window shorter than 24
 *    rows clips (and garbles) the frames, so `toContain` assertions and the
 *    `>= 24` height check fail purely because of how tall the user's window is.
 *    Pin a fixed viewport instead.
 * 2. Colours. The specs were written against non-TTY output (CI). On an
 *    interactive terminal chalk/ink emit ANSI and assertions on plain text
 *    such as `toContain("SELECT 1")` break. `chalk` is hoisted, so one shared
 *    instance drives both the app and ink — level 0 reproduces CI everywhere.
 * 3. Console chatter. Many specs exercise failure paths on purpose: they run
 *    the CLI against unreachable hosts or invalid input, and third-party
 *    loggers (@clickhouse) write to the console. The specs assert on return
 *    codes and stored state, never on stdout, so that chatter is noise.
 *
 * Set EASYSQL_TEST_VERBOSE=1 to keep the chatter. Assertion failures still
 * surface through the runner, which uses neither chalk nor `console`.
 */

import chalk from "chalk";

const TEST_COLUMNS = 100;
const TEST_ROWS = 30;

for (const stream of [process.stdout, process.stderr]) {
	Object.defineProperty(stream, "columns", { value: TEST_COLUMNS, configurable: true });
	Object.defineProperty(stream, "rows", { value: TEST_ROWS, configurable: true });
}
process.env.COLUMNS = String(TEST_COLUMNS);
process.env.LINES = String(TEST_ROWS);

chalk.level = 0;

if (process.env.EASYSQL_TEST_VERBOSE !== "1") {
	const noop = (): void => {};
	console.log = noop;
	console.info = noop;
	console.warn = noop;
	console.error = noop;
	console.debug = noop;
	console.table = noop;
}
