/**
 * Global CLI options, attached to every command via commander.
 *
 * Subcommands read the parent's --api-url / --config values via the
 * `this.parent.opts()` API rather than via a global snapshot — that
 * keeps options isolated per program instance, which matters for tests
 * that build multiple programs.
 */

export interface GlobalOptions {
	apiUrl?: string;
	config?: string;
	json?: boolean;
	color?: boolean;
}

export const DEFAULT_API_URL = "https://api.easysql.net";
