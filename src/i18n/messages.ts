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
			noConnector: "No connector selected. Use --connector or run 'easysql connector list'.",
			multipleConnectors: (n: number) =>
				`${n} connectors available. Use --connector <id> to pick one.`,
			queryRejected: (sql: string, reason: string) =>
				`Generated SQL was rejected by the local safety check (${reason}). SQL:\n${sql}`,
			updateNoBinary: "Could not determine the path of the running binary.",
			updateUnsupportedPlatform: (platform: string) =>
				`No release asset matches your platform (${platform}).`,
			updateAlreadyLatest: (current: string, latest: string) =>
				`Already on the latest version (current: ${current}, latest: ${latest}).`,
		},
		prompts: {
			passwordPrompt: "Password",
			apiKeyPrompt: "EasySQL API key",
			connectorPickPrompt: "Pick a connector",
		},
		success: {
			loggedIn: "Logged in successfully.",
			loggedOut: "Logged out.",
			connectorAdded: (name: string, id: string) => `Connector '${name}' added (id: ${id}).`,
			connectorSynced: (n: number) => `Synced schema for ${n} connector(s).`,
			queryDone: (rows: number) => `Returned ${rows} row(s).`,
			updated: (from: string, to: string) => `Updated ${from} → ${to}.`,
		},
		info: {
			fetchingLatest: "Fetching latest release…",
			generatingSql: "Generating SQL via EasySQL…",
			executingSql: "Executing SQL locally…",
			introspectingDb: "Introspecting local database schema…",
		},
	},
} as const;

export type Locale = keyof typeof MESSAGES;

export function t(locale: Locale = "en") {
	return MESSAGES[locale];
}
