/**
 * Global CLI options, attached to every command via commander.
 */

export interface GlobalOptions {
	apiUrl?: string;
	config?: string;
	json?: boolean;
	color?: boolean;
}

export const DEFAULT_API_URL = "https://api.easysql.net";
