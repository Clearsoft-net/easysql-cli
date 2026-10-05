/**
 * User-facing UI strings (NOT help content — see ./help.ts).
 * Single locale for now (EN); structure allows future translations.
 */

export const MESSAGES = {
	en: {
		errors: {
			notLoggedIn: "Not authenticated. Run 'easysql login' first.",
			apiKeyRequired: "An API key is required. Generate one in the EasySQL dashboard.",
			invalidApiKey: "The API key is invalid or has been revoked.",
			networkError: (msg: string) => `Network error: ${msg}`,
			apiError: (status: number, msg: string) => `API error (${status}): ${msg}`,
			configNotFound: "Config file not found. Run 'easysql login' first.",
			configReadError: (msg: string) => `Could not read config: ${msg}`,
			configWriteError: (msg: string) => `Could not write config: ${msg}`,
			noConnection:
				"No connection selected. Use --connection or run 'easysql connection list'.",
			connectionNotFound: (name: string) => `Connection '${name}' not found.`,
			connectionNotFoundOnApi: (name: string) =>
				`Connection '${name}' no longer exists on the EasySQL API for the current account. ` +
				`Re-register it with \`easysql connection add\` (or \`easysql demo\` for the sample database), then retry.`,
			removeNonInteractive:
				"Refusing to remove without confirmation in a non-interactive shell. Pass --yes.",
			multipleConnections: (n: number) =>
				`${n} connections available. Use --connection <id> to pick one.`,
			queryRejected: (sql: string, reason: string) =>
				`Generated SQL was rejected by the local safety check (${reason}). SQL:\n${sql}`,
			updateNoBinary: "Could not determine the path of the running binary.",
			updateUnsupportedPlatform: (platform: string) =>
				`No release asset matches your platform (${platform}).`,
			updateAlreadyLatest: (current: string, latest: string) =>
				`Already on the latest version (current: ${current}, latest: ${latest}).`,
			keyringSaveFailed: (msg: string) =>
				`Could not save the password to the OS keyring: ${msg}`,
		},
		prompts: {
			passwordPrompt: "Password",
			apiKeyPrompt: "EasySQL API key",
			connectionPickPrompt: "Pick a connection",
			connectionNamePrompt: "Connection name",
			connectionTypePrompt:
				"Database type (mysql | mariadb | postgresql | clickhouse | sqlite)",
			useConnectionUrlPrompt: "Use a full connection URL? (y/N)",
			connectionUrlPrompt: "Connection URL",
			dbHostPrompt: "Database host",
			dbPortPrompt: "Database port",
			dbUserPrompt: "Database user",
			dbNamePrompt: "Database name",
			confirmRemove: (name: string) => `Remove connection '${name}'? (y/N)`,
		},
		success: {
			loggedIn: "Logged in successfully.",
			loggedOut: "Logged out.",
			connectionAdded: (name: string, id: string) =>
				`Connection '${name}' added (id: ${id}).`,
			connectionRemoved: (name: string) => `Connection '${name}' removed.`,
			connectionSynced: (name: string, tables: number) =>
				`Synced '${name}' (${tables} table${tables === 1 ? "" : "s"}).`,
			passwordSavedKeyring: (name: string) =>
				`Password for '${name}' saved in the OS keyring.`,
			queryDone: (rows: number) => `Returned ${rows} row(s).`,
			updated: (from: string, to: string) => `Updated ${from} → ${to}.`,
			updateAlreadyLatest: (current: string, latest: string) =>
				`Already on the latest version (current: ${current}, latest: ${latest}).`,
		},
		info: {
			apiKeyGenerationHint: "Generate one for free at https://dashboard.easysql.net/api-keys",
			fetchingLatest: "Fetching latest release…",
			generatingSql: "Generating SQL via EasySQL…",
			executingSql: "Executing SQL locally…",
			introspectingDb: "Introspecting local database schema…",
			removeAborted: "Aborted. Nothing was removed.",
			connectionRemovedLocalOnly:
				"Not logged in — removed locally only (the server copy was not touched).",
		},
	},
} as const;

export type Locale = keyof typeof MESSAGES;

export function t(locale: Locale = "en") {
	return MESSAGES[locale];
}
